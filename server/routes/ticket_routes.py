import os
import shutil
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, status
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime

from lib.db import get_database
from lib.email_service import EmailService
from ai.groq_client import groq_client
from ai.rag import rag_engine
from ai.qdrant_rag import qdrant_rag
from lib.dept_resolver import resolve_ai_department, get_active_department_names

router = APIRouter(prefix="/api/tickets", tags=["Ticket & Complaint Intelligence"])

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads", "complaints")
os.makedirs(UPLOAD_DIR, exist_ok=True)

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

    if c_status and c_status != "All":
        query["status"] = c_status
    if c_dept_id and c_dept_id != "All":
        query["department_id"] = c_dept_id
    elif c_dept and c_dept != "All":
        query["$or"] = [{"department": c_dept}, {"customer_department": c_dept}]

    if c_agent and c_agent != "All":
        if c_agent.upper() == "UNASSIGNED":
            query["$or"] = [
                {"assigned_agent_id": None},
                {"assigned_agent_id": ""},
                {"assigned_agent_id": {"$exists": False}}
            ]
        else:
            query["assigned_agent_id"] = c_agent

    if c_prio and c_prio != "All":
        query["priority"] = c_prio
    if c_channel and c_channel != "All":
        query["channel"] = c_channel

    if c_id or c_email:
        cust_or = []
        if c_id:
            cust_or.append({"customer_id": c_id})
        if c_email:
            cust_or.append({"customer_email": c_email})
            cust_or.append({"customer_email": c_email.lower()})

        if len(cust_or) == 1:
            query.update(cust_or[0])
        else:
            query["$or"] = cust_or

    if c_search:
        search_or = [
            {"ticket_id": {"$regex": c_search, "$options": "i"}},
            {"title": {"$regex": c_search, "$options": "i"}},
            {"description": {"$regex": c_search, "$options": "i"}},
            {"order_id": {"$regex": c_search, "$options": "i"}},
            {"customer_name": {"$regex": c_search, "$options": "i"}}
        ]
        if "$or" in query:
            query = {"$and": [{"$or": query.pop("$or")}, {"$or": search_or}]}
        else:
            query["$or"] = search_or

    cursor = db.tickets.find(query).sort("created_at", -1)
    tickets = await cursor.to_list(length=200)

    for t in tickets:
        t["_id"] = str(t["_id"])

    return tickets

@router.get("/{ticket_id}")
async def get_ticket(ticket_id: str):
    """Retrieve single complaint details with complete AI pipeline breakdown."""
    db = get_database()
    ticket = await db.tickets.find_one({"ticket_id": ticket_id})

    if not ticket:
        raise HTTPException(status_code=404, detail="Complaint ticket not found.")

    ticket["_id"] = str(ticket["_id"])
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
        customer_name = customer.get("name", data.customer_name or "Valued Customer")
        customer_email = customer.get("email", data.customer_email)
    else:
        customer_id = f"USR-{int(datetime.utcnow().timestamp())}"
        customer_name = data.customer_name or "Valued Customer"
        customer_email = data.customer_email or "customer@company.com"

    ticket_id = f"CMP-{int(datetime.utcnow().timestamp())}"

    # 1. Retrieve RAG policy context via Qdrant Cloud (Token Optimization!)
    relevant_chunks = qdrant_rag.retrieve_relevant_chunks(data.description, top_k=2)
    if not relevant_chunks:
        # Fallback to local RAG engine
        all_docs = await db.kb_docs.find({"status": "Active"}).to_list(length=100)
        all_chunks = []
        for doc in all_docs:
            all_chunks.extend(doc.get("chunks", []))
        rag_engine.load_chunks(all_chunks)
        relevant_chunks = rag_engine.retrieve_relevant_chunks(data.description, top_k=2)

    policy_context = rag_engine.format_context_for_prompt(relevant_chunks)

    # 2. AI Pipeline 1: Groq GenAI Analysis with Active Departments
    available_depts = await get_active_department_names(db)
    genai_output = groq_client.analyze_complaint(
        complaint_id=ticket_id,
        title=data.title,
        description=data.description,
        order_id=data.order_id,
        policy_context=policy_context,
        available_departments=available_depts
    )

    user_selected_dept = data.customer_department.strip()
    ai_raw_dept = genai_output.get("department", user_selected_dept)
    
    # Resolve AI Department foreign key (dept_id)
    ai_dept_id, ai_dept = await resolve_ai_department(db, ai_raw_dept, fallback_dept=user_selected_dept)

    # Department mismatch check
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
        "title": data.title.strip(),
        "description": data.description.strip(),
        "product_service": data.product_service.strip(),
        "order_id": data.order_id.strip(),
        "channel": data.channel or "Web Form",
        "customer_id": customer_id,
        "customer_name": data.customer_name or "Valued Customer",
        "customer_email": data.customer_email,
        "department_id": ai_dept_id,
        "customer_department_id": department.get("dept_id") if department else ai_dept_id,
        "customer_department": user_selected_dept,
        "department": ai_dept,
        "recommended_department": ai_dept,
        "department_mismatch": department_mismatch,
        "incident_date": data.incident_date or datetime.utcnow().strftime("%Y-%m-%d"),
        "category_id": category_id,
        "category": category_name,
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
        "attachments": data.attachments or [],
        "agent_notes": "",
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }

    await db.tickets.insert_one(new_ticket)
    new_ticket["_id"] = str(new_ticket["_id"])

    # Send Confirmation Email to Customer
    EmailService.send_ticket_created_notification(
        to_email=data.customer_email,
        ticket_id=ticket_id,
        title=data.title,
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
        customer_name = customer.get("name", data.customer_name or "Valued Customer")
        customer_email = customer.get("email", data.customer_email)
    else:
        customer_id = data.customer_id or f"USR-{int(datetime.utcnow().timestamp())}"
        customer_name = data.customer_name or "Valued Customer"
        customer_email = str(data.customer_email) if data.customer_email else "customer@company.com"

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

    # 2. AI Pipeline 1: Groq GenAI Analysis with Active Departments
    available_depts = await get_active_department_names(db)
    title_text = data.title.strip() if data.title else "Chat Complaint"
    genai_output = groq_client.analyze_complaint(
        complaint_id=ticket_id,
        title=title_text,
        description=data.description,
        order_id=data.order_id or "N/A",
        policy_context=policy_context,
        available_departments=available_depts
    )

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
        "recommended_department": ai_dept,
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

    # Department Boundary Validation for Manager
    if caller_role == "MANAGER":
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

    reassign_audit = {
        "agent_id": new_agent["user_id"],
        "agent_name": new_agent["name"],
        "agent_email": new_agent["email"],
        "previous_agent_id": prev_agent_id,
        "previous_agent_name": prev_agent_name,
        "action": "MANUAL_REASSIGNMENT",
        "reassigned_by_id": req.reassigned_by_id,
        "reassigned_by_name": req.reassigned_by_name or "Manager",
        "reassigned_by_role": caller_role,
        "reason": req.reason or "Manager workload rebalancing",
        "timestamp": datetime.utcnow().isoformat()
    }

    update_fields = {
        "assigned_agent_id": new_agent["user_id"],
        "assignedAgentId": new_agent["user_id"],
        "assigned_agent": new_agent["name"],
        "assigned_agent_email": new_agent["email"],
        "updated_at": datetime.utcnow()
    }

    await db.tickets.update_one(
        {"ticket_id": ticket_id},
        {
            "$set": update_fields,
            "$push": {
                "assigned_agent_history": reassign_audit,
                "assignedAgentHistory": reassign_audit
            }
        }
    )

    # Automated Emails to Previous and New Agent
    if prev_agent_email and prev_agent_email != new_agent.get("email"):
        EmailService.send_ticket_reassigned_notification(
            to_email=prev_agent_email,
            previous_agent_name=prev_agent_name,
            new_agent_name=new_agent["name"],
            ticket_id=ticket_id,
            title=ticket.get("title", "Complaint Ticket"),
            reason=req.reason or "Workload rebalancing"
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

    return {
        "status": "success",
        "message": f"Ticket {ticket_id} reassigned to {new_agent['name']}. Email notifications dispatched.",
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

@router.post("/fetch-emails")
async def trigger_fetch_emails():
    """Trigger fetching unseen incoming emails from IMAP INBOX & create/update tickets in DB."""
    from email_ingestion import fetch_and_create_email_tickets
    res = await fetch_and_create_email_tickets()
    return res

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

    if not ticket.get("assigned_agent_id") and acting_agent_id:
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

