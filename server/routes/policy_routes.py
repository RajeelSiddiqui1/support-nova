import os
import io
import shutil
import hashlib
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Query, status
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime

from lib.db import get_database
from models.kb_doc import KBDocCreate, KBDocUpdate, DocStatus, PolicyImpactCheckResponse
from ai.pdf_extractor import DocumentExtractor
from lib.s3_service import s3_service
from services.complaint_intelligence import ComplaintIntelligenceService
from services.audit_service import AuditService

router = APIRouter(prefix="/api/policies", tags=["Policy & Knowledge Base Management"])

import tempfile

if os.getenv("VERCEL") or os.getenv("VERCEL_ENV"):
    UPLOAD_DIR = os.path.join(tempfile.gettempdir(), "uploads", "policies")
else:
    UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads", "policies")

try:
    os.makedirs(UPLOAD_DIR, exist_ok=True)
except Exception as e:
    print(f"[POLICY UPLOAD DIR NOTICE] {e}")


def validate_kb_file(file_bytes: bytes, filename: str, max_size_bytes: int = 15728640) -> str:
    """
    Validates file extension and magic bytes.
    Returns detected canonical file type ('PDF', 'DOCX', 'TXT', 'MD').
    Raises HTTPException 400 on invalid or corrupted files.
    """
    if not file_bytes or len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty (0 bytes).")

    if len(file_bytes) > max_size_bytes:
        raise HTTPException(status_code=400, detail=f"File exceeds maximum allowed size ({max_size_bytes / (1024*1024):.1f} MB).")

    ext = os.path.splitext(filename)[1].lower()

    # Magic byte checks
    if ext == ".pdf":
        if not file_bytes.startswith(b"%PDF"):
            raise HTTPException(status_code=400, detail="Invalid PDF file: Missing %PDF magic header.")
        return "PDF"
    elif ext == ".docx":
        # ZIP magic bytes PK\x03\x04
        if not file_bytes.startswith(b"PK\x03\x04"):
            raise HTTPException(status_code=400, detail="Invalid DOCX file: Missing PK archive signature.")
        return "DOCX"
    elif ext in [".txt", ".md"]:
        try:
            file_bytes.decode("utf-8")
        except UnicodeDecodeError:
            raise HTTPException(status_code=400, detail="Invalid text file: Must be UTF-8 encoded text.")
        return "TXT" if ext == ".txt" else "MD"
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported file type '{ext}'. Allowed: .pdf, .docx, .txt, .md")


@router.get("")
@router.get("/")
@router.get("/documents")
async def list_policies(
    department_id: Optional[str] = None,
    category: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None
):
    """Retrieve all policies & KB documents with optional department filter & text search."""
    db = get_database()
    query: Dict[str, Any] = {}

    if department_id:
        query["department_id"] = department_id
    if category and category != "All":
        query["category"] = category
    if status and status != "All":
        query["status"] = {"$regex": f"^{status.strip()}$", "$options": "i"}
    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"doc_id": {"$regex": search, "$options": "i"}},
            {"category": {"$regex": search, "$options": "i"}},
            {"full_text": {"$regex": search, "$options": "i"}}
        ]

    cursor = db.kb_docs.find(query).sort("uploaded_at", -1)
    policies = await cursor.to_list(length=300)

    for p in policies:
        p["_id"] = str(p["_id"])
        dept_id = p.get("department_id")
        if dept_id and not p.get("department"):
            dept_obj = await db.departments.find_one({"dept_id": dept_id})
            if dept_obj:
                p["department"] = dept_obj.get("name")

    return policies


@router.get("/conflicts")
async def list_policy_conflicts():
    """Returns detected policy conflicts from `policy_conflicts` collection."""
    db = get_database()
    cursor = db.policy_conflicts.find({}).sort("created_at", -1)
    conflicts = await cursor.to_list(length=100)
    for c in conflicts:
        c["_id"] = str(c["_id"])
    return conflicts


@router.get("/{doc_id}")
async def get_policy_by_id(doc_id: str):
    """Retrieve single policy with full extracted text and structured chunks."""
    db = get_database()
    policy = await db.kb_docs.find_one({"doc_id": doc_id})

    if not policy:
        raise HTTPException(status_code=404, detail="Policy / KB document not found.")

    policy["_id"] = str(policy["_id"])
    return policy


@router.get("/{doc_id}/versions")
@router.get("/documents/{doc_id}/versions")
async def get_document_versions(doc_id: str):
    """Fetches all versions of a document across its lifecycle (ACTIVE, SUPERSEDED, etc.)."""
    db = get_database()
    # Find either exact doc_id or documents sharing root ID
    root_id = doc_id.split("-v")[0] if "-v" in doc_id else doc_id
    cursor = db.kb_docs.find({
        "$or": [
            {"doc_id": doc_id},
            {"doc_id": {"$regex": f"^{root_id}", "$options": "i"}},
            {"supersedes": doc_id},
            {"superseded_by": doc_id}
        ]
    }).sort("uploaded_at", -1)
    versions = await cursor.to_list(length=50)
    for v in versions:
        v["_id"] = str(v["_id"])
    return versions


@router.post("/upload")
@router.post("/documents/upload")
async def upload_policy_file(
    file: UploadFile = File(...),
    doc_id: Optional[str] = Form(None),
    title: Optional[str] = Form(None),
    category_id: Optional[str] = Form(None),
    category: Optional[str] = Form("General"),
    department_id: Optional[str] = Form(None),
    department: Optional[str] = Form(None),
    version: str = Form("v1.0"),
    doc_type: str = Form("POLICY"),
    effective_date: Optional[str] = Form(None),
    expiry_date: Optional[str] = Form(None)
):
    """
    F10 Knowledge Base Upload with:
    - Magic bytes and max file size validation.
    - SHA-256 duplicate detection.
    - Automatic superseding of older ACTIVE versions for the same doc_id.
    - Adversarial scan on document contents.
    - Text and section extraction for PDF, DOCX, and TXT.
    """
    db = get_database()
    file_bytes = await file.read()

    # 1. Validate Extension & Magic Bytes
    canon_file_type = validate_kb_file(file_bytes, file.filename)

    # 2. Duplicate Detection via SHA-256
    file_sha256 = hashlib.sha256(file_bytes).hexdigest()
    duplicate_doc = await db.kb_docs.find_one({"sha256_hash": file_sha256})
    if duplicate_doc:
        raise HTTPException(
            status_code=400,
            detail=f"Duplicate file rejected: Exact file already uploaded under document ID '{duplicate_doc.get('doc_id')}' ({duplicate_doc.get('title')})."
        )

    assigned_doc_id = doc_id.strip() if doc_id and doc_id.strip() else f"KB-{int(datetime.utcnow().timestamp())}"

    # Resolve Department
    dept_id = department_id
    dept_name = department
    if dept_id:
        dept_obj = await db.departments.find_one({"dept_id": dept_id})
        if dept_obj:
            dept_name = dept_obj.get("name", dept_name)
    elif dept_name:
        dept_obj = await db.departments.find_one({"name": {"$regex": f"^{dept_name.strip()}$", "$options": "i"}})
        if dept_obj:
            dept_id = dept_obj.get("dept_id")

    # Resolve Category
    cat_id = category_id
    cat_name = category
    if cat_id:
        cat_obj = await db.categories.find_one({"cat_id": cat_id})
        if cat_obj:
            cat_name = cat_obj.get("name", cat_name)
    elif cat_name:
        cat_obj = await db.categories.find_one({"name": {"$regex": f"^{cat_name.strip()}$", "$options": "i"}})
        if cat_obj:
            cat_id = cat_obj.get("cat_id")

    # Upload to S3
    s3_key = f"policies/{assigned_doc_id}_{file.filename}"
    upload_res = s3_service.upload_file_bytes(file_bytes, s3_key, file.content_type)

    # Extract text and sections
    extracted = DocumentExtractor.extract_from_bytes(file_bytes, file.filename, assigned_doc_id, version)
    full_text = extracted.get("full_text", "")

    # 3. Adversarial scan on document contents (F5)
    adv_flags = ComplaintIntelligenceService.detect_adversarial_patterns(full_text)
    initial_status = "DRAFT" if adv_flags else "ACTIVE"

    # Precedence level: POLICY=1, SOP=2, FAQ=3, TEMPLATE=4
    PRECEDENCE = {"POLICY": 1, "SOP": 2, "FAQ": 3, "TEMPLATE": 4}
    clean_doc_type = doc_type.upper() if doc_type else "POLICY"
    precedence_val = PRECEDENCE.get(clean_doc_type, 1)

    eff_dt = datetime.fromisoformat(effective_date) if effective_date else datetime.utcnow()
    exp_dt = datetime.fromisoformat(expiry_date) if expiry_date else None

    # 4. Version Lifecycle: If active version already exists for this doc_id, supersede it
    superseded_id = None
    existing_active = await db.kb_docs.find_one({
        "doc_id": assigned_doc_id,
        "status": {"$in": ["ACTIVE", "Active"]}
    })

    if existing_active and not adv_flags:
        superseded_id = existing_active.get("doc_id")
        await db.kb_docs.update_one(
            {"_id": existing_active["_id"]},
            {
                "$set": {
                    "status": "SUPERSEDED",
                    "superseded_by": assigned_doc_id,
                    "updated_at": datetime.utcnow()
                }
            }
        )
        await AuditService.log_event(
            event_type="DOCUMENT_SUPERSEDED",
            ticket_id="KB_SYSTEM",
            actor="SYSTEM_KB_MANAGER",
            actor_id="SYSTEM",
            original_value={"doc_id": assigned_doc_id, "version": existing_active.get("version"), "status": "ACTIVE"},
            new_value={"doc_id": assigned_doc_id, "version": version, "status": "SUPERSEDED"},
            reason=f"New version {version} uploaded and activated.",
            db=db
        )

    doc_title = title.strip() if title and title.strip() else file.filename

    # Build chunk metadata with Document ID, Section ID, category, and date bounds
    raw_chunks = extracted.get("chunks", [])
    processed_chunks = []
    for idx, chk in enumerate(raw_chunks, start=1):
        sec_id = chk.get("section_id") or f"{assigned_doc_id}-SEC-{idx:03d}"
        processed_chunks.append({
            "chunk_id": chk.get("chunk_id") or f"{assigned_doc_id}-CHK-{idx:03d}",
            "doc_id": assigned_doc_id,
            "section_id": sec_id,
            "title": chk.get("title") or doc_title,
            "section": chk.get("section") or f"Section {idx}",
            "heading": chk.get("heading") or chk.get("section") or "General",
            "page_number": chk.get("page_number", 1),
            "content": chk.get("content", ""),
            "version": version,
            "category": cat_name or "General",
            "effective_date": eff_dt,
            "expiry_date": exp_dt,
            "status": initial_status
        })

    new_policy = {
        "doc_id": assigned_doc_id,
        "title": doc_title,
        "category_id": cat_id,
        "category": cat_name or "General",
        "department_id": dept_id,
        "department": dept_name or "General",
        "file_type": canon_file_type,
        "file_size_kb": extracted.get("file_size_kb", 0.0),
        "sha256_hash": file_sha256,
        "file_path": upload_res["url"],
        "s3_url": upload_res["url"],
        "s3_key": upload_res["s3_key"],
        "storage": upload_res["storage"],
        "full_text": full_text,
        "version": version,
        "status": initial_status,
        "doc_type": clean_doc_type,
        "precedence_level": precedence_val,
        "chunk_count": len(processed_chunks),
        "chunks": processed_chunks,
        "effective_date": eff_dt,
        "expiry_date": exp_dt,
        "supersedes": superseded_id,
        "superseded_by": None,
        "adversarial_flags": adv_flags,
        "uploaded_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }

    await db.kb_docs.insert_one(new_policy)
    new_policy["_id"] = str(new_policy["_id"])

    return {
        "status": "success",
        "message": f"Document '{doc_title}' ({version}) uploaded successfully. Status: {initial_status}.",
        "policy": new_policy,
        "adversarial_warning": bool(adv_flags)
    }


@router.patch("/{doc_id}/status")
@router.patch("/documents/{doc_id}/status")
async def update_document_status(doc_id: str, body: Dict[str, Any]):
    """Updates document lifecycle status (ACTIVE, SUPERSEDED, DRAFT, EXPIRED, ARCHIVED)."""
    new_status = body.get("status")
    if not new_status:
        raise HTTPException(status_code=400, detail="Missing 'status' in request body.")

    clean_status = new_status.upper().strip()
    db = get_database()
    existing = await db.kb_docs.find_one({"doc_id": doc_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Document not found.")

    old_status = existing.get("status", "ACTIVE")
    await db.kb_docs.update_one(
        {"doc_id": doc_id},
        {"$set": {"status": clean_status, "updated_at": datetime.utcnow()}}
    )

    await AuditService.log_event(
        event_type="DOCUMENT_STATUS_CHANGED",
        ticket_id="KB_SYSTEM",
        actor="ADMIN",
        actor_id="ADMIN",
        original_value=old_status,
        new_value=clean_status,
        reason=f"Status changed from {old_status} to {clean_status} for {doc_id}",
        db=db
    )

    return {"status": "success", "doc_id": doc_id, "new_status": clean_status}


@router.post("/impact-check/{doc_id}")
@router.post("/documents/{doc_id}/impact-check")
async def check_policy_change_impact(doc_id: str) -> PolicyImpactCheckResponse:
    """
    F10 Impact Check: When a policy changes or is superseded,
    identifies all open/in-progress tickets whose cited policy is now superseded.
    """
    db = get_database()
    target_doc = await db.kb_docs.find_one({"doc_id": doc_id})
    if not target_doc:
        raise HTTPException(status_code=404, detail=f"Policy '{doc_id}' not found.")

    # Find tickets currently open that cited this policy
    cursor = db.tickets.find({
        "$or": [
            {"genai_output.policy_id": doc_id},
            {"python_rule_output.matched_rule_id": doc_id},
            {"policy_id": doc_id}
        ],
        "status": {"$in": ["In Triage", "AI Review", "In Progress", "Awaiting Customer", "Escalated"]}
    }, {"ticket_id": 1, "status": 1, "title": 1})

    tickets = await cursor.to_list(length=200)
    affected_ids = [t["ticket_id"] for t in tickets if "ticket_id" in t]

    return PolicyImpactCheckResponse(
        document_id=doc_id,
        new_version=target_doc.get("version", "v1.0"),
        affected_open_tickets=affected_ids,
        affected_count=len(affected_ids),
        message=f"Found {len(affected_ids)} active ticket(s) citing policy '{doc_id}'. Responses may require regeneration."
    )


@router.delete("/{doc_id}")
async def delete_policy(doc_id: str):
    """Admin deletes a policy document and its associated file in AWS S3 bucket."""
    db = get_database()
    existing = await db.kb_docs.find_one({"doc_id": doc_id})

    if not existing:
        raise HTTPException(status_code=404, detail="Policy not found.")

    s3_key = existing.get("s3_key")
    if s3_key:
        s3_service.delete_file(s3_key)

    await db.kb_docs.delete_one({"doc_id": doc_id})

    return {
        "status": "success",
        "message": f"Policy '{existing.get('title')}' ({doc_id}) deleted successfully."
    }
