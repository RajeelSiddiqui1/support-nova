import os
import shutil
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, status
from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict, Any, Union
from datetime import datetime

from lib.db import get_database
from lib.email_service import EmailService
from ai.groq_client import groq_client
from ai.rag import rag_engine
from ai.qdrant_rag import qdrant_rag
from lib.dept_resolver import resolve_ai_department, get_active_department_names
from services.complaint_intelligence import ComplaintIntelligenceService
from services.audit_service import AuditService
from services.config_service import ConfigService
from models.ticket import (
    GenerateFollowUpRequest, ClarificationReplyRequest,
    EscalationRequest, StructuredComplaintSummary, StructuredEscalationNotes,
    FollowUpItem, FollowUpUpdateRequest, ClarificationAnswerItem
)

ci_service = ComplaintIntelligenceService()

router = APIRouter(prefix="/api/tickets", tags=["Ticket & Complaint Intelligence"])


import tempfile

if os.getenv("VERCEL") or os.getenv("VERCEL_ENV"):
    UPLOAD_DIR = os.path.join(tempfile.gettempdir(), "uploads", "complaints")
else:
    UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads", "complaints")

try:
    os.makedirs(UPLOAD_DIR, exist_ok=True)
except Exception as e:
    print(f"[COMPLAINT UPLOAD DIR NOTICE] {e}")

def clean_quotes_py(val: Optional[str], default: str = "") -> str:
    if not val:
        return default
    s = str(val).strip()
    while (s.startswith('"') and s.endswith('"')) or (s.startswith("'") and s.endswith("'")):
        s = s[1:-1].strip()
    return s if s else default

class TicketSubmission(BaseModel):
    title: str
    description: str
    product_service: str
    order_id: str
    channel: Optional[str] = "Web Form"
    category_id: Optional[str] = None
    customer_id: Optional[str] = None
    department_id: Optional[str] = None
    customer_department: str
    customer_email: Optional[EmailStr] = "customer@company.com"
    customer_name: Optional[str] = "Valued Customer"
    incident_date: Optional[str] = None
    attachments: Optional[List[str]] = []

class ChatSubmission(BaseModel):
    title: Optional[str] = "Chat Complaint"
    description: str
    product_service: Optional[str] = "Product/Service"
    order_id: Optional[str] = "N/A"
    customer_department: str
    customer_email: Optional[EmailStr] = "customer@company.com"
    customer_name: Optional[str] = "Valued Customer"
    customer_id: Optional[str] = None
    channel: Optional[str] = "Chat"
    incident_date: Optional[str] = None

class StatusUpdateRequest(BaseModel):
    status: str  # New, In Progress, Resolved, Closed
    agent_notes: Optional[str] = ""
    assigned_agent_id: Optional[str] = None
    agent_id: Optional[str] = None
    agent_name: Optional[str] = None
    agent_email: Optional[str] = None

class ReassignTicketRequest(BaseModel):
    new_agent_id: str
    reassigned_by_id: Optional[str] = None
    reassigned_by_name: Optional[str] = "Manager"
    reassigned_by_role: Optional[str] = "MANAGER"  # MANAGER or ADMIN
    reason: Optional[str] = "Manager workload rebalancing"

class ReleaseToPoolRequest(BaseModel):
    manager_id: Optional[str] = None
    manager_name: Optional[str] = "Manager"
    manager_role: Optional[str] = "MANAGER"  # MANAGER or ADMIN
    reason: str  # Mandatory reason for removing agent & releasing ticket to pool

class ChangeDepartmentRequest(BaseModel):
    new_department_id: str
    admin_id: Optional[str] = "ADM-001"
    admin_name: Optional[str] = "Admin Nova"
    reason: Optional[str] = "Incorrect department routing"

@router.get("")
@router.get("/")
async def list_tickets(
    status: Optional[str] = None,
    department: Optional[str] = None,
    department_id: Optional[str] = None,
    assigned_agent_id: Optional[str] = None,
    priority: Optional[str] = None,
    search: Optional[str] = None,
    customer_email: Optional[str] = None,
    customer_id: Optional[str] = None,
    channel: Optional[str] = None
):
    """List all complaints/tickets with filters and search query."""
    db = get_database()
    query = {}

    def _clean(val: Optional[str]) -> Optional[str]:
        if not val:
            return None
        cleaned = val.strip().strip('"').strip("'")
        return cleaned if cleaned else None

    c_status = _clean(status)
    c_dept = _clean(department)
    c_dept_id = _clean(department_id)
    c_agent = _clean(assigned_agent_id)
    c_prio = _clean(priority)
    c_search = _clean(search)
    c_email = _clean(customer_email)
    c_id = _clean(customer_id)
    c_channel = _clean(channel)

    conditions = []

    if c_status and c_status != "All":
        conditions.append({"status": c_status})
    if c_dept_id and c_dept_id != "All":
        conditions.append({"department_id": c_dept_id})
    elif c_dept and c_dept != "All":
        conditions.append({"$or": [{"department": c_dept}, {"customer_department": c_dept}]})

    if c_agent and c_agent != "All":
        if c_agent.upper() == "UNASSIGNED":
            conditions.append({"$or": [
                {"assigned_agent_id": None},
                {"assigned_agent_id": ""},
                {"assigned_agent_id": {"$exists": False}}
            ]})
        else:
            conditions.append({"assigned_agent_id": c_agent})

    if c_prio and c_prio != "All":
        conditions.append({"priority": c_prio})
    if c_channel and c_channel != "All":
        conditions.append({"channel": c_channel})

    if c_id or c_email:
        cust_or = []
        if c_id:
            cust_or.append({"customer_id": c_id})
        if c_email:
            import re
            cust_or.append({"customer_email": {"$regex": f"^{re.escape(c_email.strip())}$", "$options": "i"}})
        if len(cust_or) == 1:
            conditions.append(cust_or[0])
        else:
            conditions.append({"$or": cust_or})

    if c_search:
        conditions.append({"$or": [
            {"ticket_id": {"$regex": c_search, "$options": "i"}},
            {"title": {"$regex": c_search, "$options": "i"}},
            {"description": {"$regex": c_search, "$options": "i"}},
            {"order_id": {"$regex": c_search, "$options": "i"}},
            {"customer_name": {"$regex": c_search, "$options": "i"}}
        ]})

    if len(conditions) == 0:
        query = {}
    elif len(conditions) == 1:
        query = conditions[0]
    else:
        query = {"$and": conditions}

    cursor = db.tickets.find(query).sort("created_at", -1)
    tickets = await cursor.to_list(length=200)

    for t in tickets:
        t["_id"] = str(t["_id"])

    return tickets

def evaluate_policy_compliance(ticket: dict) -> dict:
    """Evaluates whether the assigned agent's action and notes adhere to the Python rule policy."""
    python_out = ticket.get("python_rule_output") or {}
    matched_rule = python_out.get("matched_rule_id", "General Policy Verification")
    mandatory_actions = python_out.get("mandatory_actions", [])
    prohibited_actions = python_out.get("prohibited_actions", [])
    refund_eligible = python_out.get("refund_eligible", False)
    escalation_required = python_out.get("escalation_required", False)
    agent_notes = (ticket.get("agent_notes") or "").lower()
    draft_response = (ticket.get("draft_response") or ticket.get("genai_output", {}).get("draft_response", "")).lower()
    combined_text = f"{agent_notes} {draft_response}".strip()

    violations = []
    warnings = []

    # 1. Non-eligible refund check
    if not refund_eligible and any(kw in combined_text for kw in ["full refund", "issued refund", "approved refund", "processed refund"]):
        violations.append(f"Agent initiated refund, but Policy rule ({matched_rule}) strictly designates ticket as non-refundable.")

    # 2. Prohibited actions violation check
    for p in prohibited_actions:
        p_lower = p.lower()
        if "discount" in p_lower and any(w in combined_text for w in ["30%", "40%", "50%", "special discount"]):
            violations.append(f"Prohibited Action: {p}")
        elif "promise" in p_lower and ("guarantee" in combined_text or "48h guarantee" in combined_text):
            violations.append(f"Prohibited Policy Promise: {p}")

    # 3. Escalation required check
    if escalation_required and ticket.get("status") in ["Resolved", "Closed"]:
        violations.append(f"Policy Breach: Escalation was required under {matched_rule}, but ticket was resolved directly without manager sign-off.")

    # 4. Mandatory actions check
    for m in mandatory_actions:
        m_lower = m.lower()
        if "evidence" in m_lower and not any(k in combined_text for k in ["evidence", "photo", "document", "verified", "attached"]):
            warnings.append(f"Missing documentation: {m}")

    # 5. Routing Discrepancy & Department Mismatch check (SRS Step 57)
    cust_dept = (ticket.get("customer_department") or ticket.get("department") or "").strip()
    rec_dept = (ticket.get("recommended_department") or (ticket.get("genai_output") or {}).get("department") or "").strip()
    if ticket.get("department_mismatch") or (cust_dept and rec_dept and cust_dept.lower() != rec_dept.lower()):
        warnings.append(f"Routing Discrepancy: Ticket was routed to '{cust_dept}' but Ground-Truth recommends '{rec_dept}'. Supervisor review advised.")

    # 6. SLA Risk Check (SRS Step lx)
    priority = ticket.get("priority", "P2")
    created_at = ticket.get("created_at")
    if priority == "P0" and ticket.get("status") not in ["Resolved", "Closed"] and created_at:
        try:
            if isinstance(created_at, str):
                c_dt = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
            else:
                c_dt = created_at
            if (datetime.utcnow() - c_dt.replace(tzinfo=None)).total_seconds() > 14400:  # >4 hours
                warnings.append("SLA Risk Flag: Critical P0 ticket open > 4 hours without resolution.")
        except Exception:
            pass

    status = "COMPLIANT"
    if violations:
        status = "VIOLATION"
    elif warnings:
        status = "RISK_WARNING"

    return {
        "status": status,
        "is_compliant": len(violations) == 0,
        "violations": violations,
        "warnings": warnings,
        "matched_rule_id": matched_rule,
        "mandatory_actions": mandatory_actions,
        "prohibited_actions": prohibited_actions,
        "escalation_required": escalation_required,
        "refund_eligible": refund_eligible,
        "policy_reference": python_out.get("policy_reference", "NovaWear Apparel Resolution Guidelines v1.0")
    }

@router.get("/chat-options")
async def get_chat_complaint_options():
    """
    Dynamically generates complaint options and common issue prompt chips for the Customer Chat Intake.
    Analyzes active categories, departments, and policy rules in MongoDB Atlas:
    - Never serves obsolete/unrelated categories (e.g. 'Cloud').
    - Maps real active policies (Cancellation, Shipping/Delivery, Quality, Billing, Warranty, Replacement, Refund)
      to customer-facing selection chips.
    """
    db = get_database()
    categories = await db.categories.find({"status": "ACTIVE"}).to_list(100)
    departments = await db.departments.find({"status": "ACTIVE"}).to_list(100)
    policies = await db.kb_docs.find({}).to_list(100)

    # Category icon & branding map for apparel & customer issues
    CAT_META = {
        "delivery": {"icon": "📦", "label": "Order & Shipping Delay", "default_dept": "Logistics"},
        "del": {"icon": "📦", "label": "Order & Shipping Delay", "default_dept": "Logistics"},
        "refund": {"icon": "💰", "label": "Refund & Payment Return", "default_dept": "Finance"},
        "ref": {"icon": "💰", "label": "Refund & Payment Return", "default_dept": "Finance"},
        "replacement": {"icon": "🔄", "label": "Item Replacement & Exchange", "default_dept": "Fulfillment"},
        "rep": {"icon": "🔄", "label": "Item Replacement & Exchange", "default_dept": "Fulfillment"},
        "exchange": {"icon": "🔄", "label": "Size & Color Exchange", "default_dept": "Fulfillment"},
        "warranty": {"icon": "🛡️", "label": "Product Warranty & Stitching Defect", "default_dept": "Quality"},
        "war": {"icon": "🛡️", "label": "Product Warranty & Stitching Defect", "default_dept": "Quality"},
        "billing": {"icon": "💳", "label": "Billing & Double Charge", "default_dept": "Billing"},
        "bil": {"icon": "💳", "label": "Billing & Double Charge", "default_dept": "Billing"},
        "quality": {"icon": "✨", "label": "Fabric & Quality Control Issue", "default_dept": "Quality"},
        "qual": {"icon": "✨", "label": "Fabric & Quality Control Issue", "default_dept": "Quality"},
        "cancel": {"icon": "🚫", "label": "Order Cancellation Request", "default_dept": "Logistics"},
        "can": {"icon": "🚫", "label": "Order Cancellation Request", "default_dept": "Logistics"},
        "general": {"icon": "👕", "label": "Apparel & General Customer Support", "default_dept": "Clothes"},
        "gernal": {"icon": "👕", "label": "Apparel & General Customer Support", "default_dept": "Clothes"},
        "clothes": {"icon": "👗", "label": "Clothing Sizing & Apparel Inquiry", "default_dept": "Clothes"}
    }

    # Policy sub-issues mapping
    POLICY_ISSUES = {
        "delivery": [
            "Order delayed by > 72 hours without carrier update",
            "Tracking indicates delivered but package not received",
            "Wrong shipment tracking number provided"
        ],
        "refund": [
            "Return request delivered but refund not credited",
            "Double charge charged to credit card on checkout",
            "Refund amount deducted without authorization"
        ],
        "replacement": [
            "Wrong apparel size / color delivered in parcel",
            "Damaged package with missing clothing item",
            "Defective zipper / stitching on received item"
        ],
        "warranty": [
            "Fabric tore / shrunk after first wash as per care label",
            "Item stopped working within 30-day warranty window",
            "Manufacturing flaw in apparel seam or zipper"
        ],
        "billing": [
            "Credit card charged twice for single order transaction",
            "Discount voucher / coupon code failed to apply",
            "Invoice amount does not match online order total"
        ],
        "quality": [
            "Apparel fabric quality does not match catalog description",
            "Visible stain / tear on brand new clothing item",
            "Color fading or dye bleed immediately upon unboxing"
        ],
        "cancel": [
            "Order cancellation requested prior to warehouse dispatch",
            "Accidental duplicate order placed",
            "Incorrect shipping address entered at checkout"
        ]
    }

    # Fallback department name
    first_dept_name = departments[0].get("name") if departments else "Clothes"

    complaint_types = []
    common_issues = {}

    for c in categories:
        c_name = c.get("name", "").strip()
        c_code = (c.get("code") or "").strip().lower()
        c_key = c_code if c_code in CAT_META else c_name.lower()

        # Strictly ignore any obsolete "cloud" category
        if "cloud" in c_key or "cloud" in c_name.lower():
            continue

        meta = CAT_META.get(c_key) or CAT_META.get(c_name.lower()) or {
            "icon": "📋",
            "label": f"{c_name} Inquiry",
            "default_dept": first_dept_name
        }

        # Resolve department from available depts
        matched_dept = first_dept_name
        for d in departments:
            d_name = d.get("name", "")
            if d_name.lower() == meta["default_dept"].lower() or d_name.lower() in meta["default_dept"].lower():
                matched_dept = d_name
                break

        complaint_types.append({
            "id": c_code or c_name.lower(),
            "label": f"{meta['icon']} {meta['label']}",
            "dept": matched_dept,
            "category": c_name,
            "cat_id": c.get("cat_id")
        })

        # Match policy issues
        issues = POLICY_ISSUES.get(c_code) or POLICY_ISSUES.get(c_name.lower()) or [
            f"Issue regarding {c_name} policy",
            f"Customer assistance required for {c_name}",
            f"Escalation regarding {c_name} guideline"
        ]
        common_issues[c_name] = issues
        common_issues[matched_dept] = issues

    # If categories list was empty in DB, provide standard e-commerce apparel categories
    if not complaint_types:
        complaint_types = [
            {"id": "del", "label": "📦 Order & Shipping Delay", "dept": first_dept_name, "category": "Delivery"},
            {"id": "ref", "label": "💰 Refund & Payment Return", "dept": first_dept_name, "category": "Refund"},
            {"id": "rep", "label": "🔄 Item Replacement & Exchange", "dept": first_dept_name, "category": "Replacement"},
            {"id": "qual", "label": "✨ Fabric Quality & Damaged Apparel", "dept": first_dept_name, "category": "Quality"},
            {"id": "bil", "label": "💳 Billing & Double Charge", "dept": first_dept_name, "category": "Billing"},
            {"id": "war", "label": "🛡️ Product Warranty & Defect", "dept": first_dept_name, "category": "Warranty"},
            {"id": "can", "label": "🚫 Order Cancellation Request", "dept": first_dept_name, "category": "Cancel"},
        ]
        common_issues = POLICY_ISSUES

    dept_names = [d.get("name") for d in departments if d.get("name")]
    if not dept_names:
        dept_names = ["Clothes", "Logistics", "Finance", "Quality"]

    return {
        "complaint_types": complaint_types,
        "common_issues": common_issues,
        "departments": dept_names,
        "policies_count": len(policies)
    }

@router.get("/department/agent-activity")
async def get_department_agent_activity(
    department_id: Optional[str] = None,
    department: Optional[str] = None
):
    """
    Supervisor Audit API for Department Managers.
    Returns:
    - All tickets in the manager's department
    - Current agent assignment & agent notes
    - Policy compliance evaluation (Compliant, Risk, Violation)
    - Full assignment history & revoked agents audit trail
    """
    db = get_database()
    query = {}
    is_all_depts = (
        (department_id and department_id.strip().upper() in ["ALL", "DEP-ALL", "ALL DEPARTMENTS"]) or
        (department and department.strip().upper() in ["ALL", "ALL DEPARTMENTS"])
    )
    if not is_all_depts:
        if department_id and department_id.strip():
            query["$or"] = [
                {"department_id": department_id.strip()},
                {"department": {"$regex": f"^{department_id.strip()}$", "$options": "i"}}
            ]
        elif department and department.strip():
            query["department"] = {"$regex": f"^{department.strip()}$", "$options": "i"}

    cursor = db.tickets.find(query).sort("created_at", -1)
    tickets = await cursor.to_list(length=300)

    evaluated_tickets = []
    agent_workload = {}
    total_violations = 0
    total_warnings = 0

    for t in tickets:
        t["_id"] = str(t["_id"])
        comp = evaluate_policy_compliance(t)
        t["policy_compliance"] = comp

        if comp["status"] == "VIOLATION":
            total_violations += 1
        elif comp["status"] == "RISK_WARNING":
            total_warnings += 1

        agent_id = t.get("assigned_agent_id")
        agent_name = t.get("assigned_agent") or "Unassigned"
        if agent_id:
            if agent_id not in agent_workload:
                agent_workload[agent_id] = {
                    "agent_id": agent_id,
                    "agent_name": agent_name,
                    "agent_email": t.get("assigned_agent_email"),
                    "ticket_count": 0,
                    "violations": 0
                }
            agent_workload[agent_id]["ticket_count"] += 1
            if comp["status"] == "VIOLATION":
                agent_workload[agent_id]["violations"] += 1

        evaluated_tickets.append(t)

    return {
        "department": department or department_id or "All",
        "total_tickets": len(evaluated_tickets),
        "total_violations": total_violations,
        "total_warnings": total_warnings,
        "agent_workload": list(agent_workload.values()),
        "tickets": evaluated_tickets
    }

@router.get("/{ticket_id}")
async def get_ticket(ticket_id: str):
    """Retrieve single complaint details with complete AI pipeline breakdown."""
    db = get_database()
    ticket = await db.tickets.find_one({"ticket_id": ticket_id})

    if not ticket:
        raise HTTPException(status_code=404, detail="Complaint ticket not found.")

    ticket["_id"] = str(ticket["_id"])
    ticket["policy_compliance"] = evaluate_policy_compliance(ticket)
    return ticket

@router.post("/submit")
@router.post("")
@router.post("/")
async def submit_complaint(data: TicketSubmission):
    """Customer submits a complaint via webform. Triggers AI Pipeline Analysis & Notification."""
    db = get_database()

    # Form Validation
    if not data.title or not data.title.strip():
        raise HTTPException(status_code=400, detail="Complaint Title is mandatory.")
    if not data.description or not data.description.strip():
        raise HTTPException(status_code=400, detail="Complaint Description is mandatory.")
    if not data.product_service or not data.product_service.strip():
        raise HTTPException(status_code=400, detail="Product/Service name is mandatory.")
    if not data.order_id or not data.order_id.strip():
        raise HTTPException(status_code=400, detail="Order/Transaction Reference ID is mandatory.")
    if not data.customer_department or not data.customer_department.strip():
        raise HTTPException(status_code=400, detail="Department selection is mandatory.")
    if not data.category_id or not data.category_id.strip():
        raise HTTPException(status_code=400, detail="Category selection is mandatory.")
    if not data.department_id or not data.department_id.strip():
        raise HTTPException(status_code=400, detail="Department foreign key is mandatory.")

    # ── Feature 4: Deterministic Validation & Pre-Processing (Pipeline 2) ──
    prep = ComplaintIntelligenceService.validate_and_preprocess_complaint(
        title=data.title,
        description=data.description,
        order_id=data.order_id,
        customer_id=clean_quotes_py(data.customer_id, "anonymous"),
        attachments=data.attachments
    )
    if not prep["is_valid"]:
        raise HTTPException(status_code=400, detail=prep["error"])

    # ── Feature 4: Exact Deduplication Check (Pipeline 2) ──
    if prep["content_hash"]:
        existing_dup = await db.tickets.find_one({
            "content_hash": prep["content_hash"],
            "status": {"$ne": "Closed"}
        })
        if existing_dup:
            return {
                "status": "success",
                "ticket_id": existing_dup["ticket_id"],
                "is_duplicate": True,
                "duplicate_of": existing_dup["ticket_id"],
                "message": f"Identical complaint detected. Linked to active ticket {existing_dup['ticket_id']}."
            }

    # ── Feature 5: Adversarial & Prompt Injection Scan (Pipeline 2) ──
    adv_rules = await ConfigService.get_adversarial_rules(db)
    adv_flags = ComplaintIntelligenceService.detect_adversarial_patterns(prep["normalized_description"], rules=adv_rules)

    department = await db.departments.find_one({"dept_id": data.department_id.strip()})
    if not department:
        raise HTTPException(status_code=400, detail="Selected department does not exist.")

    category = None
    category_name = "General"
    category_id = None
    if data.category_id and data.category_id.strip():
        cat = await db.categories.find_one({"cat_id": data.category_id.strip()})
        if not cat:
            raise HTTPException(status_code=400, detail="Selected category does not exist.")
        category = cat
        category_id = cat["cat_id"]
        category_name = cat.get("name", "General")

    customer = None
    if data.customer_id:
        customer = await db.users.find_one({"user_id": data.customer_id.strip()})
    if not customer and data.customer_email:
        customer = await db.users.find_one({"email": str(data.customer_email).strip().lower()})

    if customer:
        customer_id = customer.get("user_id", f"USR-{int(datetime.utcnow().timestamp())}")
        customer_name = clean_quotes_py(customer.get("name"), clean_quotes_py(data.customer_name, "Valued Customer"))
        customer_email = clean_quotes_py(customer.get("email"), clean_quotes_py(str(data.customer_email), "customer@gmail.com"))
    else:
        customer_id = clean_quotes_py(data.customer_id, f"USR-{int(datetime.utcnow().timestamp())}")
        customer_name = clean_quotes_py(data.customer_name, "Valued Customer")
        customer_email = clean_quotes_py(str(data.customer_email) if data.customer_email else "", "customer@company.com")

    ticket_id = f"CMP-{int(datetime.utcnow().timestamp())}"

    # 1. Retrieve RAG policy context
    relevant_chunks = qdrant_rag.retrieve_relevant_chunks(prep["normalized_description"], top_k=2)
    if not relevant_chunks:
        all_docs = await db.kb_docs.find({"status": {"$in": ["Active", "ACTIVE"]}}).to_list(length=100)
        all_chunks = []
        for doc in all_docs:
            all_chunks.extend(doc.get("chunks", []))
        rag_engine.load_chunks(all_chunks)
        relevant_chunks = rag_engine.retrieve_relevant_chunks(prep["normalized_description"], top_k=2)

    policy_context = rag_engine.format_context_for_prompt(relevant_chunks)

    # 2. AI Pipeline 1: Groq GenAI Analysis with Active Departments & Versioned Prompt (F1, F2)
    available_depts = await get_active_department_names(db)
    genai_output, analysis_meta = groq_client.analyze_complaint(
        complaint_id=ticket_id,
        title=prep["normalized_title"],
        description=prep["normalized_description"],
        order_id=prep.get("effective_order_id") or data.order_id,
        policy_context=policy_context,
        available_departments=available_depts
    )

    user_selected_dept = data.customer_department.strip()
    ai_raw_dept = genai_output.get("department", user_selected_dept)
    ai_dept_id, ai_dept = await resolve_ai_department(db, ai_raw_dept, fallback_dept=user_selected_dept)

    # ── Feature 6: Multi-Department Routing Check (Pipeline 2) ──
    matrix_cursor = db.rule_matrix.find({"is_active": True})
    matrix_rules = await matrix_cursor.to_list(length=100)

    routing_res = ComplaintIntelligenceService.validate_multi_department_routing(
        primary_issue=genai_output.get("primary_issue"),
        secondary_issues=genai_output.get("secondary_issues", []),
        genai_primary_dept=ai_dept,
        genai_supporting_depts=genai_output.get("supporting_departments", []),
        rule_matrix=matrix_rules
    )

    primary_dept = routing_res["verified_primary_department"] or ai_dept
    supporting_depts = routing_res["verified_supporting_departments"]
    department_mismatch = (
        routing_res["department_mismatch"] or
        (ai_dept.lower() not in user_selected_dept.lower() and user_selected_dept.lower() not in ai_dept.lower())
    )
    mismatch_type = "DEPARTMENT_MISMATCH" if department_mismatch else None

    # ── Feature 12: Repeat Complaint Check (Pipeline 2) ──
    prior_cursor = db.tickets.find({"customer_id": customer_id})
    prior_tickets = await prior_cursor.to_list(length=50)
    is_repeat, related_ticket_ids, repeat_count, repeat_score = ComplaintIntelligenceService.check_repeat_complaint(
        current_title=prep["normalized_title"],
        current_description=prep["normalized_description"],
        order_id=prep.get("effective_order_id") or data.order_id,
        customer_id=customer_id,
        prior_tickets=prior_tickets
    )

    # ── Feature 7: Deterministic Escalation Evaluation (Pipeline 2) ──
    esc_rules = await ConfigService.get_escalation_rules(db)
    esc_eval = ComplaintIntelligenceService.evaluate_escalation_rules(
        ticket_data={"title": prep["normalized_title"], "description": prep["normalized_description"]},
        entities=genai_output.get("entities"),
        repeat_count=repeat_count,
        rules=esc_rules
    )

    escalation_required = esc_eval["escalation_required"] or genai_output.get("escalation_required", False)
    escalation_level = esc_eval["escalation_level"]
    escalation_source = esc_eval["escalation_source"]

    # Crucial Ground Rule: If Python says escalate and GenAI said no -> Python wins!
    if esc_eval["escalation_required"] and not genai_output.get("escalation_required"):
        department_mismatch = True
        mismatch_type = "ESCALATION_MISMATCH"
        await AuditService.log_event(
            event_type="ESCALATION_OVERRIDE",
            ticket_id=ticket_id,
            actor="SYSTEM_PYTHON_RULE",
            actor_id="SYSTEM",
            original_value={"escalation_required": False},
            new_value={"escalation_required": True, "level": escalation_level},
            reason=f"Python rule override triggered by: {', '.join(esc_eval['triggered_rules'])}",
            db=db
        )

    # ── Feature 8: Deterministic Hallucination Detection (Pipeline 2) ──
    kb_cursor = db.kb_docs.find({"status": {"$in": ["Active", "ACTIVE"]}})
    active_kb_docs = await kb_cursor.to_list(length=100)
    active_policy_ids = [doc.get("doc_id") or doc.get("policy_id") for doc in active_kb_docs if doc.get("doc_id") or doc.get("policy_id")]
    
    has_hallucination, hallucination_flags, unsupported_promises = ComplaintIntelligenceService.detect_hallucinations(
        genai_output=genai_output,
        complaint_text=prep["normalized_description"],
        retrieved_chunks=relevant_chunks,
        rule_matrix=matrix_rules,
        active_policy_ids=active_policy_ids
    )

    if has_hallucination:
        mismatch_type = "HALLUCINATION"
        # Suppress draft response from customer
        genai_output["draft_response"] = ""
        await AuditService.log_event(
            event_type="HALLUCINATION_DETECTED",
            ticket_id=ticket_id,
            actor="SYSTEM_PYTHON_RULE",
            actor_id="SYSTEM",
            original_value={},
            new_value={"flags": hallucination_flags, "unsupported_promises": unsupported_promises},
            reason="Unverified policy or promise detected in GenAI response.",
            db=db
        )

    # If adversarial injection was detected, quarantine to reviewer queue
    if adv_flags:
        department_mismatch = True
        mismatch_type = "ADVERSARIAL"

    # Python Rule Output definition
    python_rule_output = {
        "matched_rule_id": genai_output.get("policy_id", "DEL-POL-04"),
        "category_verified": True,
        "escalation_required": escalation_required,
        "refund_eligible": "refund" in prep["normalized_description"].lower() or "delay" in prep["normalized_description"].lower(),
        "verified_primary_department": primary_dept,
        "verified_secondary_departments": supporting_depts,
        "mandatory_actions": genai_output.get("resolution_steps", ["Verify details", "Check policy"]),
        "prohibited_actions": ["Issue unauthorized cash refund > 50% without manager review"],
        "policy_reference": f"{genai_output.get('policy_id', 'POL-01')} §{genai_output.get('policy_section', '1.0')}",
        "confidence_score": 96.5 if not department_mismatch else 80.0
    }

    # ── Feature 9: Transparent Verification Score (Pipeline 2) ──
    verification_score, score_breakdown = ComplaintIntelligenceService.calculate_verification_score(
        genai_output=genai_output,
        python_output=python_rule_output,
        has_hallucination=has_hallucination
    )

    # ── Feature 3: Deterministic Missing Info & GenAI Clarification Questions ──
    req_map = await ConfigService.get_required_fields_map(db)
    missing_eval = ComplaintIntelligenceService.detect_missing_info(
        ticket_data={
            "title": prep["normalized_title"],
            "description": prep["normalized_description"],
            "order_id": prep.get("effective_order_id") or data.order_id,
            "product_service": data.product_service,
            "attachments": data.attachments
        },
        entities=genai_output.get("entities"),
        category=category_name,
        required_fields_map=req_map
    )
    missing_fields = missing_eval["missing_fields"]
    clarification_questions = ci_service.generate_clarification_questions(
        missing_fields, prep["normalized_title"], prep["normalized_description"]
    ) if missing_fields else []
    clarification_status = "pending" if missing_fields else "none"

    # ── Feature 3: Complaint Summary ──
    complaint_summary = ci_service.generate_complaint_summary(
        ticket_id=ticket_id,
        title=prep["normalized_title"],
        description=prep["normalized_description"],
        category=category_name
    )

    # ── Feature 7: Escalation Notes ──
    escalation_notes = None
    if escalation_required:
        escalation_notes = ci_service.generate_escalation_notes(
            ticket_id=ticket_id,
            title=prep["normalized_title"],
            description=prep["normalized_description"],
            category=category_name,
            escalation_reason=esc_eval.get("primary_trigger") or "Compliance rule trigger",
            actions_taken=["Quarantined from agent pool for manager review"],
            policy_id=genai_output.get("policy_id")
        )

    # ── Feature 13: SLA Risk Engine (Pipeline 2) ──
    sla_eval = ComplaintIntelligenceService.evaluate_sla_risk(
        created_at=datetime.utcnow(),
        priority=genai_output.get("priority", "P2")
    )

    # Determine initial status
    if adv_flags or department_mismatch or has_hallucination:
        initial_status = "AI Review"
    elif missing_fields:
        initial_status = "Awaiting Customer"
    else:
        initial_status = "In Triage"

    # Assemble complete ticket document
    new_ticket = {
        "ticket_id": ticket_id,
        "title": prep["normalized_title"],
        "description": prep["normalized_description"],
        "product_service": data.product_service.strip(),
        "order_id": prep.get("effective_order_id") or data.order_id.strip(),
        "channel": data.channel or "Web Form",
        "customer_id": customer_id,
        "customer_name": customer_name,
        "customer_email": customer_email,
        "department_id": ai_dept_id,
        "customer_department_id": department.get("dept_id") if department else ai_dept_id,
        "customer_department": user_selected_dept,
        "department": primary_dept,
        "department_name": primary_dept,
        "recommended_department": primary_dept,
        "primary_department": primary_dept,
        "supporting_departments": supporting_depts,
        "secondary_issue_departments": routing_res.get("secondary_issue_departments", []),
        "routing_match": routing_res.get("routing_match", "full"),
        "primary_issue": genai_output.get("primary_issue") or {"category": category_name, "department": primary_dept},
        "secondary_issues": genai_output.get("secondary_issues", []),
        "entities": genai_output.get("entities"),
        "emotion_indicators": genai_output.get("emotion_indicators", []),
        "agent_guidance": genai_output.get("agent_guidance", []),
        "assigned_agent_id": None,
        "assignedAgentId": None,
        "department_mismatch": department_mismatch,
        "mismatch_type": mismatch_type,
        "incident_date": data.incident_date or datetime.utcnow().strftime("%Y-%m-%d"),
        "category_id": category_id,
        "category": category_name,
        "ai_category": genai_output.get("issue_category", "General"),
        "sub_category": genai_output.get("subcategory", "General Inquiry"),
        "priority": genai_output.get("priority", "P2"),
        "sentiment": genai_output.get("sentiment", "Negative"),
        "urgency": genai_output.get("urgency", "Medium"),
        "status": initial_status,
        "assigned_agent": None,
        "sla_hours_remaining": sla_eval["sla_hours_remaining"],
        "sla_risk_percentage": sla_eval["sla_risk_percentage"],
        "sla_risk": sla_eval["sla_risk"],
        "sla_response_target_at": sla_eval["sla_response_target_at"],
        "sla_resolution_target_at": sla_eval["sla_resolution_target_at"],
        "genai_output": genai_output,
        "python_rule_output": python_rule_output,
        "analysis_meta": analysis_meta,
        "match_status": not department_mismatch and not has_hallucination,
        "attachments": data.attachments or [],
        "agent_notes": "",
        "follow_ups": [],
        "missing_fields": missing_fields,
        "clarification_questions": clarification_questions,
        "clarification_status": clarification_status,
        "clarification_history": [],
        "complaint_summary": complaint_summary,
        "escalation_required": escalation_required,
        "escalation_level": escalation_level,
        "escalation_source": escalation_source,
        "escalation_rules_triggered": esc_eval.get("triggered_rules", []),
        "escalation_notes": escalation_notes,
        "content_hash": prep.get("content_hash"),
        "duplicate_of": None,
        "duplicate_score": repeat_score,
        "is_duplicate": False,
        "adversarial_flags": adv_flags,
        "is_repeat": is_repeat,
        "related_ticket_ids": related_ticket_ids,
        "repeat_count": repeat_count,
        "repeat_similarity_score": repeat_score,
        "has_hallucination": has_hallucination,
        "hallucination_flags": hallucination_flags,
        "unsupported_promises": unsupported_promises,
        "verification_score": verification_score,
        "verification_breakdown": score_breakdown,
        "audit_trail": [],
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }

    await db.tickets.insert_one(new_ticket)
    new_ticket["_id"] = str(new_ticket["_id"])

    # Broadcast real-time WebSocket event
    try:
        from lib.websocket_manager import ws_manager
        await ws_manager.notify_ticket_created(new_ticket)
        await ws_manager.notify_agent_workload_change()
    except Exception as wse:
        print(f"[WS ERROR] {wse}")

    # Send Confirmation Email to Customer
    EmailService.send_ticket_created_notification(
        to_email=data.customer_email,
        ticket_id=ticket_id,
        title=prep["normalized_title"],
        department=user_selected_dept
    )


    return {
        "status": "success",
        "message": f"Complaint '{ticket_id}' submitted and processed through AI Pipeline.",
        "ticket": new_ticket
    }

@router.post("/submit-chat")
async def submit_chat_complaint(data: ChatSubmission):
    """Customer submits a complaint via Guided Chat. Processed with Qdrant Cloud RAG & stored in MongoDB."""
    db = get_database()

    if not data.description or not data.description.strip():
        raise HTTPException(status_code=400, detail="Complaint Description is mandatory.")
    
    user_selected_dept = (data.customer_department or "Customer Support").strip()

    dept_obj = await db.departments.find_one({
        "name": {"$regex": f"^{user_selected_dept}$", "$options": "i"}
    })
    if not dept_obj:
        dept_obj = await db.departments.find_one({})
    
    dept_id = dept_obj.get("dept_id", "DEP-101") if dept_obj else "DEP-101"

    customer = None
    if data.customer_id:
        customer = await db.users.find_one({"user_id": data.customer_id.strip()})
    if not customer and data.customer_email:
        customer = await db.users.find_one({"email": str(data.customer_email).strip().lower()})

    if customer:
        customer_id = customer.get("user_id", f"USR-{int(datetime.utcnow().timestamp())}")
        customer_name = clean_quotes_py(customer.get("name"), clean_quotes_py(data.customer_name, "Valued Customer"))
        customer_email = clean_quotes_py(customer.get("email"), clean_quotes_py(str(data.customer_email), "customer@gmail.com"))
    else:
        customer_id = clean_quotes_py(data.customer_id, f"USR-{int(datetime.utcnow().timestamp())}")
        customer_name = clean_quotes_py(data.customer_name, "Valued Customer")
        customer_email = clean_quotes_py(str(data.customer_email) if data.customer_email else "", "customer@company.com")

    ticket_id = f"CMP-{int(datetime.utcnow().timestamp())}"

    # 1. Retrieve RAG policy context via Qdrant Cloud (Token Optimization)
    relevant_chunks = qdrant_rag.retrieve_relevant_chunks(data.description, top_k=2)
    if not relevant_chunks:
        all_docs = await db.kb_docs.find({"status": "Active"}).to_list(length=100)
        all_chunks = []
        for doc in all_docs:
            all_chunks.extend(doc.get("chunks", []))
        rag_engine.load_chunks(all_chunks)
        relevant_chunks = rag_engine.retrieve_relevant_chunks(data.description, top_k=2)

    policy_context = rag_engine.format_context_for_prompt(relevant_chunks)

    # 2. AI Pipeline 1: Groq GenAI Analysis with Active Departments (with Rate-Limit Fallback)
    available_depts = await get_active_department_names(db)
    title_text = data.title.strip() if data.title else "Chat Complaint"
    genai_output = None
    try:
        genai_output = groq_client.analyze_complaint(
            complaint_id=ticket_id,
            title=title_text,
            description=data.description,
            order_id=data.order_id or "N/A",
            policy_context=policy_context,
            available_departments=available_depts
        )
    except Exception as ai_err:
        desc_lower = data.description.lower()
        is_cloud_hint = "cloud" in desc_lower or "instance" in desc_lower or "vm" in desc_lower
        is_ebook_hint = "ebook" in desc_lower or "book" in desc_lower or "pdf" in desc_lower
        fallback_dept = "Cloud" if is_cloud_hint else "Ebook" if is_ebook_hint else user_selected_dept
        genai_output = {
            "issue_category": "Billing Issue" if "billing" in user_selected_dept.lower() or "charge" in desc_lower else "Digital Support",
            "subcategory": "Double Charge" if "charge" in desc_lower or "twice" in desc_lower else "General Inquiry",
            "sentiment": "Frustrated 😠" if "refund" in desc_lower or "charge" in desc_lower else "Neutral",
            "urgency": "High" if "refund" in desc_lower or "charge" in desc_lower else "Medium",
            "priority": "P1" if "refund" in desc_lower or "charge" in desc_lower else "P2",
            "department": fallback_dept,
            "policy_id": "BIL-POL-01" if "billing" in user_selected_dept.lower() else "GEN-POL-01",
            "resolution_steps": ["Verify customer transaction details", "Review department policy guidelines", "Issue confirmation / refund if eligible"],
            "escalation_required": False,
            "draft_response": f"Dear Customer,\n\nThank you for reaching out via Chat regarding '{title_text}'. Reference Ticket ID: {ticket_id}. Our {fallback_dept} support team is reviewing your request and will follow up shortly.\n\nBest regards,\nSupport Team"
        }

    ai_raw_dept = genai_output.get("department", user_selected_dept)

    # Resolve AI Department foreign key (dept_id)
    ai_dept_id, ai_dept = await resolve_ai_department(db, ai_raw_dept, fallback_dept=user_selected_dept)

    department_mismatch = (
        ai_dept.lower() not in user_selected_dept.lower() and
        user_selected_dept.lower() not in ai_dept.lower()
    )

    # 3. Python Deterministic Rule Verification
    python_rule_output = {
        "matched_rule_id": genai_output.get("policy_id", "DEL-POL-04"),
        "category_verified": True,
        "escalation_required": genai_output.get("escalation_required", False),
        "refund_eligible": "refund" in data.description.lower() or "delay" in data.description.lower(),
        "mandatory_actions": genai_output.get("resolution_steps", ["Verify details", "Escalate if needed"]),
        "prohibited_actions": ["Issue unauthorized cash refund > 50% without manager review"],
        "policy_reference": f"{genai_output.get('policy_id', 'POL-01')} §{genai_output.get('policy_section', '1.0')}",
        "confidence_score": 96.5 if not department_mismatch else 82.0
    }

    new_ticket = {
        "ticket_id": ticket_id,
        "title": title_text,
        "description": data.description.strip(),
        "product_service": (data.product_service or "General Product/Service").strip(),
        "order_id": (data.order_id or "N/A").strip(),
        "channel": "Chat",
        "customer_id": customer_id,
        "customer_name": customer_name,
        "customer_email": customer_email,
        "department_id": ai_dept_id,
        "customer_department_id": dept_id,
        "customer_department": user_selected_dept,
        "department": ai_dept,
        "department_name": ai_dept,
        "recommended_department": ai_dept,
        "assigned_agent_id": None,
        "assignedAgentId": None,
        "department_mismatch": department_mismatch,
        "incident_date": data.incident_date or datetime.utcnow().strftime("%Y-%m-%d"),
        "category_id": None,
        "category": genai_output.get("issue_category", "General"),
        "ai_category": genai_output.get("issue_category", "General"),
        "sub_category": genai_output.get("subcategory", "General Inquiry"),
        "priority": genai_output.get("priority", "P2"),
        "sentiment": genai_output.get("sentiment", "Negative"),
        "urgency": genai_output.get("urgency", "Medium"),
        "status": "In Triage",
        "assigned_agent": None,
        "sla_hours_remaining": 4.0 if genai_output.get("priority") == "P0" else 24.0,
        "sla_risk_percentage": 15.0 if not department_mismatch else 65.0,
        "genai_output": genai_output,
        "python_rule_output": python_rule_output,
        "match_status": not department_mismatch,
        "attachments": [],
        "agent_notes": "",
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }

    await db.tickets.insert_one(new_ticket)
    new_ticket["_id"] = str(new_ticket["_id"])

    # Broadcast real-time WebSocket event
    try:
        from lib.websocket_manager import ws_manager
        await ws_manager.notify_ticket_created(new_ticket)
        await ws_manager.notify_agent_workload_change()
    except Exception as wse:
        print(f"[WS ERROR] {wse}")

    # Send Confirmation Email to Customer
    if customer_email:
        EmailService.send_ticket_created_notification(
            to_email=customer_email,
            ticket_id=ticket_id,
            title=title_text,
            department=user_selected_dept
        )

    return {
        "status": "success",
        "message": f"Chat complaint '{ticket_id}' submitted and processed through AI Pipeline.",
        "ticket": new_ticket
    }

@router.put("/{ticket_id}/status")
async def update_ticket_status(ticket_id: str, req: StatusUpdateRequest):
    """
    Agent updates complaint status (In Triage -> In Progress -> Resolved -> Closed) & emails customer.
    First-Response Claim Rule: If ticket is currently unassigned, the agent who submits this
    first update automatically claims and is assigned the ticket with full audit trail.
    """
    db = get_database()
    ticket = await db.tickets.find_one({"ticket_id": ticket_id})

    if not ticket:
        raise HTTPException(status_code=404, detail="Complaint ticket not found.")

    update_fields = {
        "status": req.status,
        "updated_at": datetime.utcnow()
    }

    if req.agent_notes:
        update_fields["agent_notes"] = req.agent_notes

    acting_agent_id = req.agent_id or req.assigned_agent_id
    acting_agent_name = req.agent_name
    acting_agent_email = req.agent_email

    if acting_agent_id and (not acting_agent_name or not acting_agent_email):
        user_doc = await db.users.find_one({"user_id": acting_agent_id})
        if user_doc:
            acting_agent_name = acting_agent_name or user_doc.get("name", "Support Agent")
            acting_agent_email = acting_agent_email or user_doc.get("email")

    current_assigned = ticket.get("assigned_agent_id")
    push_history = None

    # Access Revocation & Assigned Agent Authorization
    if acting_agent_id:
        revoked_ids = ticket.get("revoked_agent_ids", [])
        if acting_agent_id in revoked_ids:
            rev_entry = next((r for r in ticket.get("revoked_agents", []) if r.get("agent_id") == acting_agent_id), None)
            rev_reason = rev_entry.get("reason", "policy non-compliance") if rev_entry else "policy non-compliance"
            raise HTTPException(
                status_code=403,
                detail=f"Access Revoked: Your access to ticket {ticket_id} was revoked by your manager (Reason: {rev_reason}). You cannot claim, update, or resolve this ticket."
            )
        if current_assigned and acting_agent_id != current_assigned:
            user_doc = await db.users.find_one({"user_id": acting_agent_id})
            user_role = (user_doc.get("role") if user_doc else "AGENT").upper()
            if user_role not in ["MANAGER", "ADMIN"]:
                raise HTTPException(
                    status_code=403,
                    detail=f"Access Denied: Ticket {ticket_id} is currently assigned to another agent ({ticket.get('assigned_agent') or current_assigned}). You cannot modify it."
                )

    # First-Response Auto-Claim Rule:
    if not current_assigned and acting_agent_id:
        update_fields["assigned_agent_id"] = acting_agent_id
        update_fields["assignedAgentId"] = acting_agent_id
        update_fields["assigned_agent"] = acting_agent_name or "Support Agent"
        update_fields["assigned_agent_email"] = acting_agent_email

        push_history = {
            "agent_id": acting_agent_id,
            "agent_name": acting_agent_name or "Support Agent",
            "agent_email": acting_agent_email,
            "action": "AUTO_CLAIM_FIRST_RESPONSE",
            "status": req.status,
            "notes": req.agent_notes or "",
            "timestamp": datetime.utcnow().isoformat()
        }
    elif req.assigned_agent_id and req.assigned_agent_id != current_assigned:
        update_fields["assigned_agent_id"] = req.assigned_agent_id
        update_fields["assignedAgentId"] = req.assigned_agent_id
        if acting_agent_name:
            update_fields["assigned_agent"] = acting_agent_name
        if acting_agent_email:
            update_fields["assigned_agent_email"] = acting_agent_email

    if push_history:
        await db.tickets.update_one(
            {"ticket_id": ticket_id},
            {
                "$set": update_fields,
                "$push": {
                    "assigned_agent_history": push_history,
                    "assignedAgentHistory": push_history
                }
            }
        )
    else:
        await db.tickets.update_one({"ticket_id": ticket_id}, {"$set": update_fields})

    # Send Email Notification to Customer
    cust_email = ticket.get("customer_email") or "customer@company.com"
    cust_title = ticket.get("title", "Complaint Ticket")

    email_sent = EmailService.send_ticket_status_update(
        to_email=cust_email,
        ticket_id=ticket_id,
        title=cust_title,
        status=req.status,
        agent_notes=req.agent_notes or ""
    )

    updated_ticket = await db.tickets.find_one({"ticket_id": ticket_id})
    updated_ticket["_id"] = str(updated_ticket["_id"])

    return {
        "status": "success",
        "message": f"Status updated to '{req.status}'. Email notification sent to customer ({cust_email}).",
        "email_sent": email_sent,
        "ticket": updated_ticket
    }

@router.post("/{ticket_id}/reassign")
async def reassign_ticket(ticket_id: str, req: ReassignTicketRequest):
    """
    Manager or Admin overrides and reassigns a ticket to another Agent.
    - If Manager: must reassign to an active Agent within the same department.
    - If Admin: full override permission.
    - Ticket immediately transfers from previous agent's active queue to new agent.
    - Triggers automated email notifications to both Previous and New Agent.
    """
    db = get_database()
    ticket = await db.tickets.find_one({"ticket_id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Complaint ticket not found.")

    new_agent = await db.users.find_one({
        "user_id": req.new_agent_id.strip(),
        "status": "ACTIVE"
    })
    if not new_agent:
        raise HTTPException(status_code=404, detail="Target agent not found or inactive.")

    caller_role = (req.reassigned_by_role or "MANAGER").strip().upper()

    # Department Boundary Validation:
    # Reviewers, Admins, or any ticket undergoing AI Review / Department Mismatch triage can be assigned
    # across departments to the correct active agent. Normal managers on standard tickets are departmental.
    is_mismatch_or_review = bool(
        ticket.get("department_mismatch") or 
        ticket.get("status") in ["AI Review", "NEEDS_REVIEW", "PENDING_REVIEW"] or 
        caller_role in ["REVIEWER", "ADMIN"]
    )
    if caller_role == "MANAGER" and not is_mismatch_or_review:
        ticket_dept_id = ticket.get("department_id")
        ticket_dept_name = (ticket.get("department") or "").strip().lower()
        agent_dept_id = new_agent.get("department_id")
        agent_dept_name = (new_agent.get("department") or "").strip().lower()

        dept_matches = False
        if ticket_dept_id and agent_dept_id and ticket_dept_id == agent_dept_id:
            dept_matches = True
        elif ticket_dept_name and agent_dept_name and ticket_dept_name == agent_dept_name:
            dept_matches = True

        if not dept_matches:
            raise HTTPException(
                status_code=403,
                detail=f"Managers can only reassign tickets to agents within their own department ({ticket.get('department')})."
            )

    prev_agent_id = ticket.get("assigned_agent_id")
    prev_agent_name = ticket.get("assigned_agent") or "Previous Agent"
    prev_agent_email = ticket.get("assigned_agent_email")

    if prev_agent_id and (not prev_agent_email or prev_agent_name == "Previous Agent"):
        prev_user = await db.users.find_one({"user_id": prev_agent_id})
        if prev_user:
            prev_agent_name = prev_user.get("name", prev_agent_name)
            prev_agent_email = prev_user.get("email", prev_agent_email)

    is_revocation = bool(prev_agent_id and prev_agent_id != new_agent["user_id"])
    revocation_entry = None
    if is_revocation:
        revocation_entry = {
            "agent_id": prev_agent_id,
            "agent_name": prev_agent_name,
            "agent_email": prev_agent_email,
            "revoked_by_id": req.reassigned_by_id,
            "revoked_by_name": req.reassigned_by_name or "Department Manager",
            "revoked_by_role": caller_role,
            "reason": req.reason or "Manager reassignment / policy non-compliance",
            "revoked_at": datetime.utcnow().isoformat()
        }

    reassign_audit = {
        "agent_id": new_agent["user_id"],
        "agent_name": new_agent["name"],
        "agent_email": new_agent["email"],
        "previous_agent_id": prev_agent_id,
        "previous_agent_name": prev_agent_name,
        "action": "REVOKED_AND_REASSIGNED" if is_revocation else "MANUAL_REASSIGNMENT",
        "reassigned_by_id": req.reassigned_by_id,
        "reassigned_by_name": req.reassigned_by_name or "Manager",
        "reassigned_by_role": caller_role,
        "reason": req.reason or "Manager workload rebalancing",
        "access_revoked": is_revocation,
        "timestamp": datetime.utcnow().isoformat()
    }

    update_fields = {
        "assigned_agent_id": new_agent["user_id"],
        "assignedAgentId": new_agent["user_id"],
        "assigned_agent": new_agent["name"],
        "assigned_agent_email": new_agent["email"],
        "department": new_agent.get("department") or ticket.get("department"),
        "department_id": new_agent.get("department_id") or ticket.get("department_id"),
        "department_mismatch": False,
        "match_status": True,
        "reviewed_by_id": req.reassigned_by_id,
        "reviewed_by_name": req.reassigned_by_name or "Reviewer / Manager",
        "reviewer_override": True,
        "updated_at": datetime.utcnow()
    }

    if ticket.get("status") in ["AI Review", "NEEDS_REVIEW", "PENDING_REVIEW"]:
        update_fields["status"] = "In Progress"

    push_payload = {
        "assigned_agent_history": reassign_audit,
        "assignedAgentHistory": reassign_audit
    }
    if is_revocation and revocation_entry:
        push_payload["revoked_agents"] = revocation_entry

    mongo_update = {
        "$set": update_fields,
        "$push": push_payload
    }
    if is_revocation and prev_agent_id:
        mongo_update["$addToSet"] = {"revoked_agent_ids": prev_agent_id}

    await db.tickets.update_one({"ticket_id": ticket_id}, mongo_update)

    # Automated Emails to Previous and New Agent
    if prev_agent_email and prev_agent_email != new_agent.get("email"):
        EmailService.send_ticket_reassigned_notification(
            to_email=prev_agent_email,
            previous_agent_name=prev_agent_name,
            new_agent_name=new_agent["name"],
            ticket_id=ticket_id,
            title=ticket.get("title", "Complaint Ticket"),
            reason=req.reason or "Manager reassignment / policy non-compliance",
            manager_name=req.reassigned_by_name or "Department Manager"
        )

    if new_agent.get("email"):
        EmailService.send_ticket_assigned_notification(
            to_email=new_agent["email"],
            new_agent_name=new_agent["name"],
            ticket_id=ticket_id,
            title=ticket.get("title", "Complaint Ticket"),
            description=ticket.get("description", ""),
            priority=ticket.get("priority", "P2"),
            department=ticket.get("department", ""),
            assigned_by_name=req.reassigned_by_name or "Manager"
        )

    updated_ticket = await db.tickets.find_one({"ticket_id": ticket_id})
    updated_ticket["_id"] = str(updated_ticket["_id"])

    # Broadcast real-time WebSocket event
    try:
        from lib.websocket_manager import ws_manager
        await ws_manager.notify_ticket_reassigned(
            ticket_id=ticket_id,
            old_agent_id=prev_agent_id,
            new_agent_id=new_agent["user_id"],
            reason=req.reason or "Manager reassignment"
        )
        await ws_manager.notify_agent_workload_change()
    except Exception as wse:
        print(f"[WS ERROR] {wse}")

    return {
        "status": "success",
        "message": f"Ticket {ticket_id} reassigned to {new_agent['name']}. Email notifications dispatched.",
        "ticket": updated_ticket
    }

@router.post("/{ticket_id}/release-to-pool")
async def release_ticket_to_pool(ticket_id: str, req: ReleaseToPoolRequest):
    """
    Manager or Admin revokes the current agent assignment and returns the ticket to the
    unassigned department pool ('In Triage').
    - Current agent is added to `revoked_agent_ids` and permanently barred from re-claiming.
    - Full audit record created in `revoked_agents` and `assigned_agent_history`.
    - Automated notification email dispatched to the revoked agent with the reason.
    - Any other active agent in the department can claim the ticket on their first response.
    """
    db = get_database()
    ticket = await db.tickets.find_one({"ticket_id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Complaint ticket not found.")

    caller_role = (req.manager_role or "MANAGER").strip().upper()
    if caller_role not in ["MANAGER", "ADMIN"]:
        raise HTTPException(status_code=403, detail="Only Managers and Admins can revoke assignments and release tickets to pool.")

    # Department boundary validation for Manager
    if caller_role == "MANAGER" and req.manager_id:
        mgr = await db.users.find_one({"user_id": req.manager_id.strip()})
        if mgr and mgr.get("role", "").upper() == "MANAGER":
            mgr_dept_id = mgr.get("department_id")
            mgr_dept_name = (mgr.get("department") or "").strip().lower()
            ticket_dept_id = ticket.get("department_id")
            ticket_dept_name = (ticket.get("department") or "").strip().lower()

            dept_matches = False
            if mgr_dept_id and ticket_dept_id and mgr_dept_id == ticket_dept_id:
                dept_matches = True
            elif mgr_dept_name and ticket_dept_name and mgr_dept_name == ticket_dept_name:
                dept_matches = True
            elif not ticket_dept_id and not ticket_dept_name:
                dept_matches = True

            if not dept_matches:
                raise HTTPException(
                    status_code=403,
                    detail=f"Managers can only release tickets within their own department ({mgr.get('department')})."
                )

    prev_agent_id = ticket.get("assigned_agent_id")
    prev_agent_name = ticket.get("assigned_agent") or "Assigned Agent"
    prev_agent_email = ticket.get("assigned_agent_email")

    if prev_agent_id and (not prev_agent_email or prev_agent_name == "Assigned Agent"):
        prev_user = await db.users.find_one({"user_id": prev_agent_id})
        if prev_user:
            prev_agent_name = prev_user.get("name", prev_agent_name)
            prev_agent_email = prev_user.get("email", prev_agent_email)

    reason_text = req.reason.strip() if req.reason else "Manager removed agent and released ticket to pool"

    revocation_entry = None
    if prev_agent_id:
        revocation_entry = {
            "agent_id": prev_agent_id,
            "agent_name": prev_agent_name,
            "name": prev_agent_name,
            "agent_email": prev_agent_email,
            "revoked_by_id": req.manager_id,
            "revoked_by_name": req.manager_name or "Department Manager",
            "revoked_by_role": caller_role,
            "reason": reason_text,
            "action": "REVOKED_AND_RELEASED_TO_POOL",
            "revoked_at": datetime.utcnow().isoformat()
        }

    pool_audit = {
        "agent_id": None,
        "agent_name": "Unassigned Pool",
        "previous_agent_id": prev_agent_id,
        "previous_agent_name": prev_agent_name,
        "action": "REVOKED_AND_RELEASED_TO_POOL",
        "reassigned_by_id": req.manager_id,
        "reassigned_by_name": req.manager_name or "Department Manager",
        "reassigned_by_role": caller_role,
        "reason": reason_text,
        "access_revoked": bool(prev_agent_id),
        "timestamp": datetime.utcnow().isoformat()
    }

    update_fields = {
        "assigned_agent_id": None,
        "assignedAgentId": None,
        "assigned_agent": None,
        "assigned_agent_email": None,
        "status": "In Triage",
        "updated_at": datetime.utcnow()
    }

    push_payload = {
        "assigned_agent_history": pool_audit,
        "assignedAgentHistory": pool_audit
    }
    if revocation_entry:
        push_payload["revoked_agents"] = revocation_entry

    mongo_update = {
        "$set": update_fields,
        "$push": push_payload
    }
    if prev_agent_id:
        mongo_update["$addToSet"] = {"revoked_agent_ids": prev_agent_id}

    await db.tickets.update_one({"ticket_id": ticket_id}, mongo_update)

    # Automated email notification to the removed agent
    if prev_agent_email:
        EmailService.send_ticket_released_to_pool_notification(
            to_email=prev_agent_email,
            agent_name=prev_agent_name,
            ticket_id=ticket_id,
            title=ticket.get("title", "Complaint Ticket"),
            reason=reason_text,
            manager_name=req.manager_name or "Department Manager"
        )

    updated_ticket = await db.tickets.find_one({"ticket_id": ticket_id})
    updated_ticket["_id"] = str(updated_ticket["_id"])

    # Broadcast real-time WebSocket event
    try:
        from lib.websocket_manager import ws_manager
        await ws_manager.notify_ticket_reassigned(
            ticket_id=ticket_id,
            old_agent_id=prev_agent_id,
            new_agent_id=None,
            reason=reason_text
        )
        await ws_manager.notify_agent_workload_change()
    except Exception as wse:
        print(f"[WS ERROR] {wse}")

    return {
        "status": "success",
        "message": f"Ticket {ticket_id} released to unassigned pool. Agent {prev_agent_name} removed and permanently blocked from re-claiming.",
        "ticket": updated_ticket
    }

@router.post("/{ticket_id}/change-department")
async def change_ticket_department(ticket_id: str, req: ChangeDepartmentRequest):
    """
    Admin overrides and changes the department of any ticket at any stage.
    - Clears unmatching department agent assignment.
    - Resets ticket queue so it appears in new department's shared pool.
    - Notifies the relevant Department Manager via automated email.
    """
    db = get_database()
    ticket = await db.tickets.find_one({"ticket_id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Complaint ticket not found.")

    dept_id = req.new_department_id.strip()
    new_dept = await db.departments.find_one({"dept_id": dept_id})
    if not new_dept:
        new_dept = await db.departments.find_one({"name": {"$regex": f"^{dept_id}$", "$options": "i"}})
    if not new_dept:
        raise HTTPException(status_code=404, detail="Target department does not exist.")

    old_dept_name = ticket.get("department", "Unknown")
    old_dept_id = ticket.get("department_id")
    old_agent_id = ticket.get("assigned_agent_id")
    old_agent_name = ticket.get("assigned_agent")

    dept_audit = {
        "action": "ADMIN_DEPARTMENT_OVERRIDE",
        "old_department": old_dept_name,
        "new_department": new_dept["name"],
        "old_department_id": old_dept_id,
        "new_department_id": new_dept["dept_id"],
        "cleared_agent_id": old_agent_id,
        "cleared_agent_name": old_agent_name,
        "admin_id": req.admin_id,
        "admin_name": req.admin_name,
        "reason": req.reason,
        "timestamp": datetime.utcnow().isoformat()
    }

    update_fields = {
        "department_id": new_dept["dept_id"],
        "department": new_dept["name"],
        "customer_department": new_dept["name"],
        "recommended_department": new_dept["name"],
        "department_mismatch": False,
        "match_status": True,
        "assigned_agent_id": None,
        "assignedAgentId": None,
        "assigned_agent": None,
        "assigned_agent_email": None,
        "updated_at": datetime.utcnow()
    }

    await db.tickets.update_one(
        {"ticket_id": ticket_id},
        {
            "$set": update_fields,
            "$push": {
                "assigned_agent_history": dept_audit,
                "assignedAgentHistory": dept_audit
            }
        }
    )

    # Notify Department Managers of the new department
    managers = await db.users.find({
        "role": "MANAGER",
        "status": "ACTIVE",
        "$or": [
            {"department_id": new_dept["dept_id"]},
            {"department": {"$regex": f"^{new_dept['name']}$", "$options": "i"}}
        ]
    }).to_list(length=10)

    for mgr in managers:
        if mgr.get("email"):
            EmailService.send_department_manager_override_notification(
                to_email=mgr["email"],
                manager_name=mgr.get("name", "Manager"),
                ticket_id=ticket_id,
                title=ticket.get("title", "Complaint Ticket"),
                old_department=old_dept_name,
                new_department=new_dept["name"],
                changed_by_name=req.admin_name
            )

    updated_ticket = await db.tickets.find_one({"ticket_id": ticket_id})
    updated_ticket["_id"] = str(updated_ticket["_id"])

    return {
        "status": "success",
        "message": f"Department changed to '{new_dept['name']}'. Agent assignment cleared and Department Manager notified.",
        "ticket": updated_ticket
    }

class EmailReplyRequest(BaseModel):
    reply_body: str
    status: Optional[str] = "In Progress"
    agent_id: Optional[str] = None
    agent_name: Optional[str] = None
    agent_email: Optional[str] = None

@router.post("/sync-latest-email")
async def trigger_sync_latest_email():
    """
    30-Second Poller Endpoint:
    Fetches the single latest customer email from IMAP mailbox.
    Uses multi-tier UID and Message-ID deduplication so that if no new email arrived,
    it returns 'no_new_email' without re-processing old emails or creating duplicate tickets.
    """
    from email_ingestion import fetch_latest_email_ticket
    return await fetch_latest_email_ticket()

@router.get("/email-sync-status")
async def get_email_sync_status():
    """Returns the latest email sync state and watermark from MongoDB."""
    db = get_database()
    sync_doc = await db.email_sync_state.find_one({"_id": "mailbox_sync_watermark"})
    total_email_tickets = await db.tickets.count_documents({"channel": {"$regex": "^email$", "$options": "i"}})
    total_processed_logs = await db.processed_emails.count_documents({})
    if sync_doc and "_id" in sync_doc:
        sync_doc["_id"] = str(sync_doc["_id"])
    return {
        "sync_state": sync_doc or {},
        "total_email_tickets": total_email_tickets,
        "total_processed_emails_logged": total_processed_logs
    }

@router.post("/fetch-emails")
async def trigger_fetch_emails():
    """Trigger fetching incoming emails from IMAP INBOX & create/update tickets in DB."""
    from email_ingestion import fetch_and_create_email_tickets
    res = await fetch_and_create_email_tickets(only_recent_days=14)
    return res

@router.post("/upload-attachment")
async def upload_ticket_attachment(file: UploadFile = File(...)):
    """
    Upload customer complaint attachment (receipt, screenshot, PDF) directly to AWS S3 bucket.
    Returns persistent S3 URL for inclusion in the ticket submission.
    """
    import re
    from lib.s3_service import s3_service
    file_bytes = await file.read()
    orig_name = file.filename or f"attachment_{int(datetime.utcnow().timestamp())}.dat"
    clean_name = re.sub(r"[^a-zA-Z0-9_.-]", "_", orig_name)
    s3_key = f"complaints/{int(datetime.utcnow().timestamp())}_{clean_name}"

    upload_res = s3_service.upload_file_bytes(file_bytes, s3_key, file.content_type)

    return {
        "status": "success",
        "filename": orig_name,
        "url": upload_res["url"],
        "s3_key": upload_res["s3_key"],
        "storage": upload_res["storage"],
        "size_kb": upload_res["file_size_kb"]
    }

@router.post("/{ticket_id}/reply-email")
async def dispatch_email_reply(ticket_id: str, req: EmailReplyRequest):
    """
    Agent dispatches an approved SMTP reply to customer email with threading headers.
    First-Response Claim Rule: If ticket is unassigned, auto-claims for the replying agent.
    """
    db = get_database()
    ticket = await db.tickets.find_one({"ticket_id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Complaint ticket not found.")

    from email_dispatcher import send_agent_approved_reply

    to_email = ticket.get("customer_email")
    if not to_email:
        raise HTTPException(status_code=400, detail="Ticket has no associated customer email address.")

    original_subject = ticket.get("title", "Support Inquiry")
    original_msg_id = ticket.get("original_message_id", "")

    acting_agent_id = req.agent_id
    acting_agent_name = req.agent_name
    acting_agent_email = req.agent_email

    if acting_agent_id and (not acting_agent_name or not acting_agent_email):
        user_doc = await db.users.find_one({"user_id": acting_agent_id})
        if user_doc:
            acting_agent_name = acting_agent_name or user_doc.get("name", "Support Agent")
            acting_agent_email = acting_agent_email or user_doc.get("email")

    current_assigned = ticket.get("assigned_agent_id")
    # Access Revocation & Assigned Agent Authorization for Email Replies
    if acting_agent_id:
        revoked_ids = ticket.get("revoked_agent_ids", [])
        if acting_agent_id in revoked_ids:
            rev_entry = next((r for r in ticket.get("revoked_agents", []) if r.get("agent_id") == acting_agent_id), None)
            rev_reason = rev_entry.get("reason", "policy non-compliance") if rev_entry else "policy non-compliance"
            raise HTTPException(
                status_code=403,
                detail=f"Access Revoked: Your access to ticket {ticket_id} was revoked by your manager (Reason: {rev_reason}). You cannot send email replies or claim this ticket."
            )
        if current_assigned and acting_agent_id != current_assigned:
            user_doc = await db.users.find_one({"user_id": acting_agent_id})
            user_role = (user_doc.get("role") if user_doc else "AGENT").upper()
            if user_role not in ["MANAGER", "ADMIN"]:
                raise HTTPException(
                    status_code=403,
                    detail=f"Access Denied: Ticket {ticket_id} is currently assigned to {ticket.get('assigned_agent') or current_assigned}. You cannot send customer replies for it."
                )

    if not current_assigned and acting_agent_id:
        claim_audit = {
            "agent_id": acting_agent_id,
            "agent_name": acting_agent_name or "Support Agent",
            "agent_email": acting_agent_email,
            "action": "FIRST_RESPONSE_AUTO_CLAIM_EMAIL",
            "status": req.status or "In Progress",
            "notes": "Auto-claimed upon first email reply to customer",
            "timestamp": datetime.utcnow().isoformat()
        }
        await db.tickets.update_one(
            {"ticket_id": ticket_id},
            {
                "$set": {
                    "assigned_agent_id": acting_agent_id,
                    "assignedAgentId": acting_agent_id,
                    "assigned_agent": acting_agent_name,
                    "assigned_agent_email": acting_agent_email
                },
                "$push": {
                    "assigned_agent_history": claim_audit,
                    "assignedAgentHistory": claim_audit
                }
            }
        )

    result = send_agent_approved_reply(
        ticket_id=ticket_id,
        to_email=to_email,
        original_subject=original_subject,
        reply_body=req.reply_body,
        original_message_id=original_msg_id,
        new_status=req.status or "In Progress"
    )

    if result.get("status") == "error":
        raise HTTPException(status_code=500, detail=result.get("message", "SMTP reply failed"))

    return result


# ── Feature 1 & 11: Follow-Up Communication Endpoints ──
@router.post("/{ticket_id}/follow-ups/generate")
@router.post("/{ticket_id}/follow-ups")
async def create_or_generate_follow_up(ticket_id: str, body: Dict[str, Any]):
    """
    F11: Creates or generates a follow-up item.
    If 'type' is provided, generates message via Pipeline 1 and verifies with F8 hallucination check.
    If manual 'message' is provided, schedules directly.
    """
    db = get_database()
    ticket = await db.tickets.find_one({"ticket_id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Complaint ticket not found.")

    follow_up_type = body.get("type", "resolution-confirmation")
    delay_hours = int(body.get("custom_delay_hours") or body.get("delay_hours") or 24)

    if body.get("message"):
        # Manual follow-up message provided
        item = {
            "id": f"FOL-{uuid.uuid4().hex[:6].upper()}",
            "follow_up_id": f"FOL-{uuid.uuid4().hex[:6].upper()}",
            "type": follow_up_type,
            "message": body["message"].strip(),
            "scheduled_at": datetime.utcnow() + timedelta(hours=delay_hours),
            "sent_at": None,
            "status": "SCHEDULED",
            "approved_by": body.get("approved_by", "AGENT")
        }
    else:
        # Generate via Pipeline 1
        item = ci_service.generate_follow_up_message(
            ticket_id=ticket_id,
            title=ticket.get("title", ""),
            customer_name=ticket.get("customer_name", "Valued Customer"),
            category=ticket.get("category", "General"),
            status=ticket.get("status", "In Triage"),
            follow_up_type=follow_up_type,
            custom_delay_hours=delay_hours
        )
        item["approved_by"] = body.get("approved_by", "SYSTEM")

    # Pass through F8 hallucination check
    has_hallucination, flags, promises = ComplaintIntelligenceService.detect_hallucinations(
        genai_output={"draft_response": item["message"]},
        complaint_text=ticket.get("description", "")
    )
    if has_hallucination:
        item["status"] = "CANCELLED"
        item["hallucination_warning"] = "Suppressed due to unverified promises in follow-up message."

    await db.tickets.update_one(
        {"ticket_id": ticket_id},
        {"$push": {"follow_ups": item}, "$set": {"updated_at": datetime.utcnow()}}
    )
    return {"status": "success", "follow_up": item}


@router.get("/{ticket_id}/follow-ups")
async def get_follow_ups_endpoint(ticket_id: str):
    """Fetches a ticket's follow-up communication schedule and timeline."""
    db = get_database()
    ticket = await db.tickets.find_one({"ticket_id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Complaint ticket not found.")
    return {"ticket_id": ticket_id, "follow_ups": ticket.get("follow_ups", [])}


@router.patch("/{ticket_id}/follow-ups/{fid}")
async def update_follow_up_endpoint(ticket_id: str, fid: str, body: Dict[str, Any]):
    """Agents or Reviewers edit, cancel, or approve scheduled follow-up items."""
    db = get_database()
    ticket = await db.tickets.find_one({"ticket_id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Complaint ticket not found.")

    follow_ups = ticket.get("follow_ups", [])
    target = None
    target_idx = -1
    for idx, f in enumerate(follow_ups):
        if f.get("id") == fid or f.get("follow_up_id") == fid:
            target = f
            target_idx = idx
            break

    if not target or target_idx == -1:
        raise HTTPException(status_code=404, detail=f"Follow-up '{fid}' not found on this ticket.")

    if "message" in body and body["message"]:
        target["message"] = body["message"].strip()
    if "status" in body and body["status"]:
        target["status"] = body["status"].upper().strip()
    if "scheduled_at" in body and body["scheduled_at"]:
        target["scheduled_at"] = datetime.fromisoformat(body["scheduled_at"].replace("Z", "+00:00"))

    await db.tickets.update_one(
        {"ticket_id": ticket_id},
        {"$set": {f"follow_ups.{target_idx}": target, "updated_at": datetime.utcnow()}}
    )
    return {"status": "success", "updated_follow_up": target}


# ── F11: Internal Cron Endpoint to Run Due Follow-Ups ──
@router.post("/internal/follow-ups/run")
@router.get("/internal/follow-ups/run")
async def run_due_follow_ups():
    """
    Cron / Background execution runner for due follow-up communications.
    Can be scheduled or triggered by serverless cron jobs.
    """
    db = get_database()
    now = datetime.utcnow()
    # Find tickets containing scheduled follow-ups that are due
    cursor = db.tickets.find({
        "follow_ups": {
            "$elemMatch": {
                "status": "SCHEDULED",
                "scheduled_at": {"$lte": now}
            }
        }
    })
    tickets = await cursor.to_list(length=100)
    sent_count = 0

    for t in tickets:
        tid = t.get("ticket_id")
        follow_ups = t.get("follow_ups", [])
        modified = False

        for f in follow_ups:
            if f.get("status") == "SCHEDULED":
                sched = f.get("scheduled_at")
                if isinstance(sched, datetime) and sched <= now:
                    to_email = t.get("customer_email")
                    if to_email and "@" in to_email:
                        EmailService.send_email(
                            to_email=to_email,
                            subject=f"Update regarding your NovaWear complaint ({tid})",
                            html_content=f"<p>{f.get('message')}</p>"
                        )
                    f["status"] = "SENT"
                    f["sent_at"] = datetime.utcnow()
                    modified = True
                    sent_count += 1
                    await AuditService.log_event(
                        event_type="FOLLOW_UP_SENT",
                        ticket_id=tid,
                        actor="SYSTEM_CRON",
                        actor_id="CRON_WORKER",
                        original_value={"status": "SCHEDULED"},
                        new_value={"status": "SENT", "follow_up_id": f.get("id") or f.get("follow_up_id")},
                        reason="Follow-up scheduled time elapsed and sent to customer.",
                        db=db
                    )

        if modified:
            await db.tickets.update_one(
                {"ticket_id": tid},
                {"$set": {"follow_ups": follow_ups, "updated_at": datetime.utcnow()}}
            )

    return {"status": "success", "processed_tickets": len(tickets), "sent_count": sent_count}


# ── Feature 3: Clarifications Endpoints ──
@router.get("/{ticket_id}/clarifications")
async def get_clarifications_endpoint(ticket_id: str):
    """Fetches missing fields, clarification questions, and answer status for a ticket."""
    db = get_database()
    ticket = await db.tickets.find_one({"ticket_id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Complaint ticket not found.")

    return {
        "ticket_id": ticket_id,
        "missing_fields": ticket.get("missing_fields", []),
        "clarification_questions": ticket.get("clarification_questions", []),
        "clarification_status": ticket.get("clarification_status", "none"),
        "history": ticket.get("clarification_history", [])
    }


@router.post("/{ticket_id}/clarifications/answer")
@router.post("/{ticket_id}/clarification-reply")
async def answer_clarifications_endpoint(ticket_id: str, body: Dict[str, Any]):
    """
    F3: Customer answers clarification questions.
    Merges answers into entities, re-evaluates missing fields, writes to audit log,
    and updates ticket status.
    """
    db = get_database()
    ticket = await db.tickets.find_one({"ticket_id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Complaint ticket not found.")

    answers = body.get("answers") or []
    reply_text = body.get("reply", "").strip()

    if not answers and not reply_text:
        raise HTTPException(status_code=400, detail="Clarification response or answer list cannot be empty.")

    entities = ticket.get("entities") or {}
    clarification_history = ticket.get("clarification_history", [])
    answer_summary_lines = []

    if answers:
        for a in answers:
            field = a.get("field")
            val = str(a.get("value", "")).strip()
            if field:
                entities[field] = val
                answer_summary_lines.append(f"{field}: {val}")
                clarification_history.append({
                    "field": field,
                    "value": val,
                    "answered_at": datetime.utcnow().isoformat()
                })
    elif reply_text:
        answer_summary_lines.append(reply_text)
        clarification_history.append({
            "field": "general_reply",
            "value": reply_text,
            "answered_at": datetime.utcnow().isoformat()
        })

    updated_desc = f"{ticket.get('description', '')}\n\n[Customer Clarification Response]:\n" + "\n".join(answer_summary_lines)

    # Re-evaluate missing fields deterministically
    req_map = await ConfigService.get_required_fields_map(db)
    missing_eval = ComplaintIntelligenceService.detect_missing_info(
        ticket_data={"title": ticket.get("title", ""), "description": updated_desc, "order_id": entities.get("order_id") or ticket.get("order_id")},
        entities=entities,
        category=ticket.get("category", "General"),
        required_fields_map=req_map
    )
    new_missing = missing_eval["missing_fields"]
    status_val = "answered" if len(new_missing) == 0 else "pending"

    # Status transition: if answered and previously awaiting customer, move to In Triage or In Progress
    new_ticket_status = ticket.get("status", "In Triage")
    if status_val == "answered" and new_ticket_status == "Awaiting Customer":
        new_ticket_status = "In Triage"

    update_payload = {
        "description": updated_desc,
        "entities": entities,
        "missing_fields": new_missing,
        "clarification_status": status_val,
        "clarification_history": clarification_history,
        "status": new_ticket_status,
        "updated_at": datetime.utcnow()
    }
    if entities.get("order_id"):
        update_payload["order_id"] = entities["order_id"]

    await db.tickets.update_one({"ticket_id": ticket_id}, {"$set": update_payload})

    await AuditService.log_event(
        event_type="CLARIFICATION_ANSWERED",
        ticket_id=ticket_id,
        actor="CUSTOMER",
        actor_id=ticket.get("customer_id", "CUSTOMER"),
        original_value={"clarification_status": "pending", "missing_fields": ticket.get("missing_fields", [])},
        new_value={"clarification_status": status_val, "missing_fields": new_missing},
        reason="Customer submitted clarification answers.",
        db=db
    )

    try:
        from lib.websocket_manager import ws_manager
        await ws_manager.broadcast("TICKET_UPDATED", {"ticket_id": ticket_id, "clarification_status": status_val, "status": new_ticket_status})
    except Exception:
        pass

    return {
        "status": "success",
        "ticket_id": ticket_id,
        "clarification_status": status_val,
        "missing_fields": new_missing,
        "new_status": new_ticket_status
    }


# ── Feature 3: Summary Regenerate Endpoint ──
@router.post("/{ticket_id}/summary/regenerate")
async def regenerate_summary_endpoint(ticket_id: str):
    """Regenerates structured complaint summary object."""
    db = get_database()
    ticket = await db.tickets.find_one({"ticket_id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Complaint ticket not found.")

    summary = ci_service.generate_complaint_summary(
        ticket_id=ticket_id,
        title=ticket.get("title", ""),
        description=ticket.get("description", ""),
        category=ticket.get("category", "General")
    )

    await db.tickets.update_one(
        {"ticket_id": ticket_id},
        {"$set": {"complaint_summary": summary, "updated_at": datetime.utcnow()}}
    )

    return {"status": "success", "summary": summary}


# ── Feature 7: Escalation Notes & Trigger Endpoint ──
@router.post("/{ticket_id}/escalate")
async def escalate_ticket_endpoint(ticket_id: str, body: EscalationRequest):
    """Escalates a ticket and generates structured manager-level escalation notes."""
    db = get_database()
    ticket = await db.tickets.find_one({"ticket_id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Complaint ticket not found.")

    notes = ci_service.generate_escalation_notes(
        ticket_id=ticket_id,
        title=ticket.get("title", ""),
        description=ticket.get("description", ""),
        category=ticket.get("category", "General"),
        escalation_reason=body.escalation_reason,
        actions_taken=body.actions_taken,
        policy_id=(ticket.get("python_rule_output") or {}).get("matched_rule_id")
    )

    level = body.escalation_level or "DEPARTMENT_MANAGER"

    await db.tickets.update_one(
        {"ticket_id": ticket_id},
        {
            "$set": {
                "status": "Escalated",
                "escalation_required": True,
                "escalation_level": level,
                "escalation_source": "MANUAL_ESCALATION",
                "escalation_notes": notes,
                "updated_at": datetime.utcnow()
            }
        }
    )

    await AuditService.log_event(
        event_type="MANUAL_ESCALATION",
        ticket_id=ticket_id,
        actor="STAFF",
        actor_id="STAFF",
        original_value={"status": ticket.get("status")},
        new_value={"status": "Escalated", "escalation_level": level},
        reason=body.escalation_reason,
        db=db
    )

    return {"status": "success", "escalation_notes": notes}


@router.get("/{ticket_id}/escalation-notes")
async def get_escalation_notes_endpoint(ticket_id: str):
    """Fetches manager-level escalation notes (visible to MANAGER, ADMIN, REVIEWER)."""
    db = get_database()
    ticket = await db.tickets.find_one({"ticket_id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Complaint ticket not found.")
    return {
        "ticket_id": ticket_id,
        "escalation_required": ticket.get("escalation_required", False),
        "escalation_level": ticket.get("escalation_level", "NONE"),
        "escalation_source": ticket.get("escalation_source", "SYSTEM_DEFAULT"),
        "escalation_notes": ticket.get("escalation_notes")
    }


# ── Feature 12: Customer Complaint History & Repeat Stats ──
@router.get("/{ticket_id}/history")
async def get_ticket_customer_history(ticket_id: str):
    """
    F12: Fetches customer complaint history, prior tickets, and repeat statistics.
    """
    db = get_database()
    ticket = await db.tickets.find_one({"ticket_id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Complaint ticket not found.")

    cid = ticket.get("customer_id")
    cursor = db.tickets.find({"customer_id": cid}).sort("created_at", -1)
    history_tickets = await cursor.to_list(length=50)

    clean_history = []
    for h in history_tickets:
        if h.get("ticket_id") != ticket_id:
            clean_history.append({
                "ticket_id": h.get("ticket_id"),
                "title": h.get("title"),
                "category": h.get("category"),
                "status": h.get("status"),
                "created_at": h.get("created_at"),
                "order_id": h.get("order_id")
            })

    return {
        "ticket_id": ticket_id,
        "customer_id": cid,
        "customer_name": ticket.get("customer_name"),
        "is_repeat": ticket.get("is_repeat", False),
        "repeat_count": ticket.get("repeat_count", len(clean_history)),
        "related_ticket_ids": ticket.get("related_ticket_ids", []),
        "prior_tickets_count": len(clean_history),
        "history": clean_history
    }



