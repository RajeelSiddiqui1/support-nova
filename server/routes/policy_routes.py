import os
import shutil
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Query, status
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from lib.db import get_database
from models.kb_doc import KBDocCreate, KBDocUpdate, DocStatus
from ai.pdf_extractor import DocumentExtractor

router = APIRouter(prefix="/api/policies", tags=["Policy & Knowledge Base Management"])

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads", "policies")
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.get("")
@router.get("/")
async def list_policies(
    department_id: Optional[str] = None,
    category: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None
):
    """Retrieve all policies & KB documents with optional department filter & text search."""
    db = get_database()
    query = {}

    if department_id:
        query["department_id"] = department_id
    if category and category != "All":
        query["category"] = category
    if status and status != "All":
        query["status"] = status
    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"doc_id": {"$regex": search, "$options": "i"}},
            {"category": {"$regex": search, "$options": "i"}},
            {"full_text": {"$regex": search, "$options": "i"}}
        ]

    cursor = db.kb_docs.find(query)
    policies = await cursor.to_list(length=200)

    for p in policies:
        p["_id"] = str(p["_id"])
        # Resolve department details if department_id present
        dept_id = p.get("department_id")
        if dept_id and not p.get("department"):
            dept_obj = await db.departments.find_one({"dept_id": dept_id})
            if dept_obj:
                p["department"] = dept_obj.get("name")

    return policies

@router.get("/{doc_id}")
async def get_policy_by_id(doc_id: str):
    """Retrieve single policy with full extracted text and structured chunks."""
    db = get_database()
    policy = await db.kb_docs.find_one({"doc_id": doc_id})

    if not policy:
        raise HTTPException(status_code=404, detail="Policy / KB document not found.")

    policy["_id"] = str(policy["_id"])
    return policy

@router.post("/upload")
async def upload_policy_file(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    category_id: Optional[str] = Form(None),
    category: Optional[str] = Form("General"),
    department_id: Optional[str] = Form(None),
    department: Optional[str] = Form(None),
    version: str = Form("v1.0")
):
    """Upload a PDF, DOCX, or TXT policy document, extract text, and save with department & category foreign keys."""
    db = get_database()
    doc_id = f"KB-{int(datetime.utcnow().timestamp())}"
    
    # Resolve Department name / ID
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

    # Resolve Category name / ID
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

    # Save uploaded file to disk
    file_ext = os.path.splitext(file.filename)[1].lower()
    save_filename = f"{doc_id}_{file.filename}"
    file_path = os.path.join(UPLOAD_DIR, save_filename)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Perform text extraction
    extracted = DocumentExtractor.extract_file(file_path, doc_id, version)

    doc_title = title.strip() if title and title.strip() else file.filename

    new_policy = {
        "doc_id": doc_id,
        "title": doc_title,
        "category_id": cat_id,
        "category": cat_name or "General",
        "department_id": dept_id,
        "department": dept_name or "General",
        "file_type": file_ext.replace(".", "").upper(),
        "file_size_kb": extracted.get("file_size_kb", 0.0),
        "file_path": file_path,
        "full_text": extracted.get("full_text", ""),
        "version": version,
        "status": "Active",
        "chunk_count": extracted.get("chunk_count", 0),
        "chunks": extracted.get("chunks", []),
        "effective_date": datetime.utcnow(),
        "uploaded_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }

    await db.kb_docs.insert_one(new_policy)
    new_policy["_id"] = str(new_policy["_id"])

    return {
        "status": "success",
        "message": f"Policy '{doc_title}' uploaded and text extracted successfully.",
        "policy": new_policy
    }

@router.post("")
@router.post("/")
async def create_manual_policy(policy: KBDocCreate):
    """Manually create a policy with text content (without uploading file)."""
    db = get_database()
    doc_id = f"KB-{int(datetime.utcnow().timestamp())}"

    dept_id = policy.department_id
    dept_name = policy.department

    if dept_id:
        dept_obj = await db.departments.find_one({"dept_id": dept_id})
        if dept_obj:
            dept_name = dept_obj.get("name", dept_name)
    elif dept_name:
        dept_obj = await db.departments.find_one({"name": {"$regex": f"^{dept_name.strip()}$", "$options": "i"}})
        if dept_obj:
            dept_id = dept_obj.get("dept_id")

    cat_id = policy.category_id
    cat_name = policy.category
    if cat_id:
        cat_obj = await db.categories.find_one({"cat_id": cat_id})
        if cat_obj:
            cat_name = cat_obj.get("name", cat_name)
    elif cat_name:
        cat_obj = await db.categories.find_one({"name": {"$regex": f"^{cat_name.strip()}$", "$options": "i"}})
        if cat_obj:
            cat_id = cat_obj.get("cat_id")

    full_text = policy.full_text or ""
    paragraphs = [p.strip() for p in full_text.split("\n\n") if p.strip()] or [full_text]

    chunks = []
    for idx, p in enumerate(paragraphs, start=1):
        chunks.append({
            "chunk_id": f"{doc_id}-CHK-{idx:03d}",
            "doc_id": doc_id,
            "section": f"Section {idx}",
            "heading": f"Section {idx}",
            "page_number": 1,
            "content": p,
            "version": policy.version or "v1.0"
        })

    new_policy = {
        "doc_id": doc_id,
        "title": policy.title,
        "category_id": cat_id,
        "category": cat_name or "General",
        "department_id": dept_id,
        "department": dept_name or "General",
        "file_type": policy.file_type or "TXT",
        "file_size_kb": round(len(full_text.encode('utf-8')) / 1024, 2),
        "file_path": None,
        "full_text": full_text,
        "version": policy.version or "v1.0",
        "status": policy.status.value if isinstance(policy.status, DocStatus) else (policy.status or "Active"),
        "chunk_count": len(chunks),
        "chunks": chunks,
        "effective_date": datetime.utcnow(),
        "uploaded_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }

    await db.kb_docs.insert_one(new_policy)
    new_policy["_id"] = str(new_policy["_id"])

    return {
        "status": "success",
        "message": f"Policy '{policy.title}' created successfully.",
        "policy": new_policy
    }

@router.put("/{doc_id}")
async def update_policy(doc_id: str, policy_data: KBDocUpdate):
    """Admin updates an existing policy's details or content."""
    db = get_database()
    existing = await db.kb_docs.find_one({"doc_id": doc_id})

    if not existing:
        raise HTTPException(status_code=404, detail="Policy not found.")

    update_fields = {}
    if policy_data.title is not None:
        update_fields["title"] = policy_data.title.strip()
    if policy_data.version is not None:
        update_fields["version"] = policy_data.version
    if policy_data.status is not None:
        val = policy_data.status.value if isinstance(policy_data.status, DocStatus) else policy_data.status
        update_fields["status"] = val

    if policy_data.category_id is not None or policy_data.category is not None:
        cat_id = policy_data.category_id or existing.get("category_id")
        cat_name = policy_data.category or existing.get("category")
        if policy_data.category_id:
            cat_obj = await db.categories.find_one({"cat_id": policy_data.category_id})
            if cat_obj:
                cat_name = cat_obj.get("name")
        update_fields["category_id"] = cat_id
        update_fields["category"] = cat_name

    if policy_data.department_id is not None or policy_data.department is not None:
        dept_id = policy_data.department_id or existing.get("department_id")
        dept_name = policy_data.department or existing.get("department")
        if policy_data.department_id:
            dept_obj = await db.departments.find_one({"dept_id": policy_data.department_id})
            if dept_obj:
                dept_name = dept_obj.get("name")
        update_fields["department_id"] = dept_id
        update_fields["department"] = dept_name

    if policy_data.full_text is not None:
        new_text = policy_data.full_text
        update_fields["full_text"] = new_text
        update_fields["file_size_kb"] = round(len(new_text.encode('utf-8')) / 1024, 2)
        
        # Re-generate chunks
        paragraphs = [p.strip() for p in new_text.split("\n\n") if p.strip()] or [new_text]
        new_chunks = []
        for idx, p in enumerate(paragraphs, start=1):
            new_chunks.append({
                "chunk_id": f"{doc_id}-CHK-{idx:03d}",
                "doc_id": doc_id,
                "section": f"Section {idx}",
                "heading": f"Section {idx}",
                "page_number": 1,
                "content": p,
                "version": update_fields.get("version", existing.get("version", "v1.0"))
            })
        update_fields["chunk_count"] = len(new_chunks)
        update_fields["chunks"] = new_chunks

    update_fields["updated_at"] = datetime.utcnow()

    await db.kb_docs.update_one({"doc_id": doc_id}, {"$set": update_fields})
    updated = await db.kb_docs.find_one({"doc_id": doc_id})
    updated["_id"] = str(updated["_id"])

    return {
        "status": "success",
        "message": f"Policy '{doc_id}' updated successfully.",
        "policy": updated
    }

@router.delete("/{doc_id}")
async def delete_policy(doc_id: str):
    """Admin deletes a policy document."""
    db = get_database()
    existing = await db.kb_docs.find_one({"doc_id": doc_id})

    if not existing:
        raise HTTPException(status_code=404, detail="Policy not found.")

    # Remove file from disk if exists
    file_path = existing.get("file_path")
    if file_path and os.path.exists(file_path):
        try:
            os.remove(file_path)
        except Exception:
            pass

    await db.kb_docs.delete_one({"doc_id": doc_id})

    return {
        "status": "success",
        "message": f"Policy '{existing.get('title')}' ({doc_id}) deleted successfully."
    }
