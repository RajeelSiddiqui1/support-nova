from fastapi import APIRouter, HTTPException, status, Query
from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta

from lib.db import get_database
from lib.auth import hash_password, generate_temp_password
from lib.email_service import EmailService

router = APIRouter(prefix="/api/admin", tags=["Admin Management"])

class CreateStaffRequest(BaseModel):
    name: str
    email: EmailStr
    role: str  # AGENT, REVIEWER, MANAGER, ADMIN
    department: Optional[str] = None
    department_id: Optional[str] = None
    reporting_manager_id: Optional[str] = None

class UpdateStaffRequest(BaseModel):
    user_id: Optional[str] = None
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    role: Optional[str] = None  # AGENT, REVIEWER, MANAGER, ADMIN
    department: Optional[str] = None
    department_id: Optional[str] = None
    reporting_manager_id: Optional[str] = None

class ToggleStatusRequest(BaseModel):
    user_id: str
    status: str  # ACTIVE or INACTIVE
    deactivation_reason: Optional[str] = None

@router.get("/users")
async def list_users():
    """Lists all registered users and staff members."""
    db = get_database()
    cursor = db.users.find({}, {"hashed_password": 0, "otp_code": 0})
    users = await cursor.to_list(length=200)
    for u in users:
        u["_id"] = str(u["_id"])
    return users

@router.get("/managers")
async def list_department_managers(
    department_id: Optional[str] = None,
    department: Optional[str] = None
):
    """
    Returns active managers filtered by department.
    Used to dynamically populate 'Reporting Manager' dropdown for Agents and Reviewers.
    """
    db = get_database()
    query = {"role": "MANAGER", "status": "ACTIVE"}

    if department_id and department_id.strip():
        query["department_id"] = department_id.strip()
    elif department and department.strip():
        query["department"] = {"$regex": f"^{department.strip()}$", "$options": "i"}

    cursor = db.users.find(query, {"hashed_password": 0, "otp_code": 0})
    managers = await cursor.to_list(length=100)
    for m in managers:
        m["_id"] = str(m["_id"])
    return managers

@router.get("/department-agents")
async def list_department_agents(
    department_id: Optional[str] = None,
    department: Optional[str] = None
):
    """
    Returns active agents belonging to a specific department.
    Used by Managers for ticket reassignment.
    """
    db = get_database()
    query = {"role": "AGENT", "status": "ACTIVE"}

    if department_id and department_id.strip():
        query["department_id"] = department_id.strip()
    elif department and department.strip():
        query["department"] = {"$regex": f"^{department.strip()}$", "$options": "i"}

    cursor = db.users.find(query, {"hashed_password": 0, "otp_code": 0})
    agents = await cursor.to_list(length=100)
    for a in agents:
        a["_id"] = str(a["_id"])
    return agents

@router.post("/create-staff")
async def create_staff(req: CreateStaffRequest):
    """
    Admin creates a staff member (Manager, Reviewer, Agent, Admin).
    Enforces role hierarchy:
    - Agent & Reviewer require an active Reporting Manager in their department.
    - Manager & Admin do not require reporting manager.
    """
    db = get_database()
    existing = await db.users.find_one({"email": req.email.lower()})

    if existing:
        raise HTTPException(status_code=400, detail="User with this email already exists.")

    dept_id = req.department_id
    dept_name = req.department

    # Resolve department foreign key reference
    if dept_id:
        dept_obj = await db.departments.find_one({"dept_id": dept_id})
        if dept_obj:
            dept_name = dept_obj.get("name", dept_name)
    elif dept_name:
        dept_obj = await db.departments.find_one({"name": {"$regex": f"^{dept_name.strip()}$", "$options": "i"}})
        if dept_obj:
            dept_id = dept_obj.get("dept_id")

    role_upper = req.role.strip().upper()
    reporting_mgr_id = None
    reporting_mgr_name = None
    reporting_mgr_email = None

    # Role Hierarchy Enforcement
    if role_upper == "REVIEWER":
        # Reviewers have cross-department oversight across all complaints and do not report to a single department manager
        dept_name = req.department or "All Departments"
        dept_id = req.department_id or "DEP-ALL"
        reporting_mgr_id = None
        reporting_mgr_name = None
        reporting_mgr_email = None
    elif role_upper == "AGENT":
        if not req.reporting_manager_id or not req.reporting_manager_id.strip():
            raise HTTPException(
                status_code=400,
                detail="Reporting Manager is required for Agent role."
            )

        # Verify reporting manager exists, is active, is a MANAGER, and belongs to same department
        manager = await db.users.find_one({
            "user_id": req.reporting_manager_id.strip(),
            "role": "MANAGER",
            "status": "ACTIVE"
        })

        if not manager:
            raise HTTPException(
                status_code=400,
                detail="Selected Reporting Manager was not found or is not an active Manager."
            )

        if dept_id and manager.get("department_id") and manager.get("department_id") != dept_id:
            raise HTTPException(
                status_code=400,
                detail=f"Reporting Manager ({manager.get('name')}) does not belong to the selected department ({dept_name})."
            )

        reporting_mgr_id = manager["user_id"]
        reporting_mgr_name = manager.get("name", "Department Manager")
        reporting_mgr_email = manager.get("email")

    temp_pwd = generate_temp_password()
    hashed_pwd = hash_password(temp_pwd)
    user_id = f"STF-{int(datetime.utcnow().timestamp())}"

    new_staff = {
        "user_id": user_id,
        "name": req.name.strip(),
        "email": req.email.lower().strip(),
        "role": role_upper,
        "department": dept_name or "General",
        "department_id": dept_id,
        "reporting_manager_id": reporting_mgr_id,
        "reporting_manager_name": reporting_mgr_name,
        "reporting_manager_email": reporting_mgr_email,
        "hashed_password": hashed_pwd,
        "status": "MUST_CHANGE_PASSWORD",
        "is_temp_password": True,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }

    await db.users.insert_one(new_staff)

    # Email staff credentials with temporary password
    EmailService.send_staff_credentials(req.email.lower(), req.name, role_upper, temp_pwd)

    return {
        "status": "success",
        "message": f"Staff member {req.name} created. Temporary password sent to email.",
        "user_id": user_id,
        "department_id": dept_id,
        "reporting_manager_id": reporting_mgr_id,
        "reporting_manager_name": reporting_mgr_name,
        "temp_password": temp_pwd
    }

@router.put("/users/{user_id}")
@router.post("/update-user")
async def update_staff_user(req: UpdateStaffRequest, user_id: Optional[str] = None):
    """
    Admin edits an existing staff member.
    Enforces reporting manager hierarchy when switching to/from Agent & Reviewer.
    """
    db = get_database()
    target_id = user_id or req.user_id
    if not target_id:
        raise HTTPException(status_code=400, detail="User ID is required.")

    user = await db.users.find_one({"user_id": target_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    update_fields = {"updated_at": datetime.utcnow()}

    if req.name and req.name.strip():
        update_fields["name"] = req.name.strip()

    if req.email and req.email.strip():
        # Check email duplicate if changed
        if req.email.lower().strip() != user.get("email"):
            dup = await db.users.find_one({"email": req.email.lower().strip()})
            if dup:
                raise HTTPException(status_code=400, detail="Another user already has this email address.")
            update_fields["email"] = req.email.lower().strip()

    new_role = (req.role or user.get("role", "AGENT")).strip().upper()
    update_fields["role"] = new_role

    new_dept_id = req.department_id or user.get("department_id")
    new_dept_name = req.department or user.get("department")

    if req.department_id:
        dept_obj = await db.departments.find_one({"dept_id": req.department_id})
        if dept_obj:
            new_dept_name = dept_obj.get("name", new_dept_name)
            new_dept_id = dept_obj.get("dept_id")
    elif req.department:
        dept_obj = await db.departments.find_one({"name": {"$regex": f"^{req.department.strip()}$", "$options": "i"}})
        if dept_obj:
            new_dept_id = dept_obj.get("dept_id")

    update_fields["department"] = new_dept_name
    update_fields["department_id"] = new_dept_id

    # Role Hierarchy for Edit
    if new_role == "REVIEWER":
        update_fields["department"] = req.department or "All Departments"
        update_fields["department_id"] = req.department_id or "DEP-ALL"
        update_fields["reporting_manager_id"] = None
        update_fields["reporting_manager_name"] = None
        update_fields["reporting_manager_email"] = None
    elif new_role == "AGENT":
        mgr_id = req.reporting_manager_id or user.get("reporting_manager_id")
        if not mgr_id or not str(mgr_id).strip():
            raise HTTPException(
                status_code=400,
                detail="Reporting Manager is required for Agent role."
            )

        manager = await db.users.find_one({
            "user_id": str(mgr_id).strip(),
            "role": "MANAGER",
            "status": "ACTIVE"
        })

        if not manager:
            raise HTTPException(
                status_code=400,
                detail="Selected Reporting Manager was not found or is not an active Manager."
            )

        if new_dept_id and manager.get("department_id") and manager.get("department_id") != new_dept_id:
            raise HTTPException(
                status_code=400,
                detail=f"Reporting Manager ({manager.get('name')}) does not belong to the user's department ({new_dept_name})."
            )

        update_fields["reporting_manager_id"] = manager["user_id"]
        update_fields["reporting_manager_name"] = manager.get("name", "Department Manager")
        update_fields["reporting_manager_email"] = manager.get("email")
    else:
        # Managers and Admins have no reporting manager
        update_fields["reporting_manager_id"] = None
        update_fields["reporting_manager_name"] = None
        update_fields["reporting_manager_email"] = None

    await db.users.update_one({"user_id": target_id}, {"$set": update_fields})
    updated_user = await db.users.find_one({"user_id": target_id}, {"hashed_password": 0, "otp_code": 0})
    updated_user["_id"] = str(updated_user["_id"])

    return {
        "status": "success",
        "message": f"User {updated_user.get('name')} updated successfully.",
        "user": updated_user
    }

@router.post("/toggle-status")
async def toggle_user_status(req: ToggleStatusRequest):
    """Admin activates or deactivates a user. Requires deactivation reason if set to INACTIVE."""
    db = get_database()
    user = await db.users.find_one({"user_id": req.user_id})

    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    if req.status == "INACTIVE" and not req.deactivation_reason:
        raise HTTPException(status_code=400, detail="Deactivation reason is mandatory when disabling a user account.")

    update_fields = {
        "status": req.status,
        "updated_at": datetime.utcnow()
    }

    if req.status == "INACTIVE":
        update_fields["deactivation_reason"] = req.deactivation_reason
    else:
        update_fields["deactivation_reason"] = None
        # Send activation email
        EmailService.send_account_activation(user["email"], user["name"])

    await db.users.update_one({"user_id": req.user_id}, {"$set": update_fields})

    return {
        "status": "success",
        "message": f"User {user['name']} status updated to {req.status}."
    }

@router.get("/agents-overview")
async def get_agents_overview():
    """
    Admin Command Center: Complete visibility over all agents and their live activity.
    Returns:
    - Overall metrics: total agents, active working agents, idle agents, total active tickets
    - For each agent:
      - Profile info: name, email, department, status, reporting manager
      - Assigned tickets summary (count, active list, completed count)
      - What they are actively working on (latest ticket title, notes, status)
      - Violations count
    """
    db = get_database()
    cursor = db.users.find(
        {"role": {"$in": ["AGENT", "REVIEWER"]}},
        {"hashed_password": 0, "otp_code": 0}
    ).sort("name", 1)
    agents = await cursor.to_list(length=300)

    # Fetch all tickets to compute agent workloads
    ticket_cursor = db.tickets.find({}).sort("updated_at", -1)
    all_tickets = await ticket_cursor.to_list(length=1000)

    agent_data = []
    total_active_tickets = 0
    total_resolved_tickets = 0
    busy_agents_count = 0

    # Group tickets by agent_id
    tickets_by_agent = {}
    for t in all_tickets:
        t["_id"] = str(t["_id"])
        agent_id = t.get("assigned_agent_id")
        if agent_id:
            if agent_id not in tickets_by_agent:
                tickets_by_agent[agent_id] = []
            tickets_by_agent[agent_id].append(t)

    for agent in agents:
        agent["_id"] = str(agent["_id"])
        u_id = agent.get("user_id")
        assigned_tickets = tickets_by_agent.get(u_id, [])

        active_list = [t for t in assigned_tickets if t.get("status") in ["In Progress", "In Triage", "Escalated", "AI Review"]]
        resolved_list = [t for t in assigned_tickets if t.get("status") in ["Resolved", "Closed"]]

        total_active_tickets += len(active_list)
        total_resolved_tickets += len(resolved_list)
        if len(active_list) > 0:
            busy_agents_count += 1

        # Current working item: latest updated active ticket
        current_work = None
        if active_list:
            top_ticket = active_list[0]
            current_work = {
                "ticket_id": top_ticket.get("ticket_id"),
                "title": top_ticket.get("title"),
                "status": top_ticket.get("status"),
                "priority": top_ticket.get("priority", "P2"),
                "channel": top_ticket.get("channel", "Web Form"),
                "customer": top_ticket.get("customer_name"),
                "latest_notes": top_ticket.get("agent_notes") or "Working on investigation/resolution",
                "updated_at": top_ticket.get("updated_at")
            }

        # Count violations for this agent across their tickets
        violations_count = 0
        for t in assigned_tickets:
            comp = t.get("policy_compliance")
            if comp and comp.get("status") == "VIOLATION":
                violations_count += 1
            if u_id in t.get("revoked_agent_ids", []):
                violations_count += 1

        agent_data.append({
            "agent_id": u_id,
            "name": agent.get("name"),
            "email": agent.get("email"),
            "role": agent.get("role"),
            "department": agent.get("department") or "General",
            "department_id": agent.get("department_id"),
            "status": agent.get("status", "ACTIVE"),
            "reporting_manager": agent.get("reporting_manager_name") or "Department Manager",
            "total_assigned": len(assigned_tickets),
            "active_count": len(active_list),
            "resolved_count": len(resolved_list),
            "violations_count": violations_count,
            "current_work": current_work,
            "active_tickets": [{
                "ticket_id": t.get("ticket_id"),
                "title": t.get("title"),
                "status": t.get("status"),
                "priority": t.get("priority", "P2"),
                "channel": t.get("channel", "Web Form"),
                "customer_name": t.get("customer_name")
            } for t in active_list[:5]]
        })

    return {
        "status": "success",
        "total_agents": len(agents),
        "busy_agents": busy_agents_count,
        "idle_agents": len(agents) - busy_agents_count,
        "total_active_tickets": total_active_tickets,
        "total_resolved_tickets": total_resolved_tickets,
        "agents": agent_data
    }


def _parse_datetime(val):
    if not val:
        return None
    if isinstance(val, datetime):
        return val.replace(tzinfo=None) if val.tzinfo else val
    if isinstance(val, str):
        try:
            cleaned = val.replace("Z", "+00:00")
            dt = datetime.fromisoformat(cleaned)
            return dt.replace(tzinfo=None) if dt.tzinfo else dt
        except Exception:
            return None
    return None


@router.get("/analytics")
async def get_admin_analytics():
    """
    Live aggregated real-time analytics for the Admin Command Center dashboard.
    Fetches and computes live stats directly from MongoDB:
    - Stat cards: Total tickets, open tickets, AI match rate, SLA breach, KB docs, active rules.
    - Complaint volume: 7-day daily breakdown.
    - Department workload: Active tickets per department.
    - AI Pipeline Accuracy: Match vs Mismatch vs Override.
    - SLA Risk Monitor: Active tickets by priority (P0, P1, P2, P3).
    - Weekly Trend: Tickets opened vs resolved over the past 7 days.
    - Quick access counts: review queue, users, agents, total tickets.
    """
    db = get_database()

    # Fetch all tickets
    ticket_cursor = db.tickets.find({})
    tickets = await ticket_cursor.to_list(length=5000)

    # Fetch counts from other collections
    kb_docs_count = await db.kb_docs.count_documents({})
    active_kb_docs = await db.kb_docs.count_documents({"status": "Active"})
    active_rules_count = await db.rule_matrix.count_documents({"is_active": True})
    total_customers = await db.users.count_documents({"role": "CUSTOMER"})
    total_staff = await db.users.count_documents({"role": {"$ne": "CUSTOMER"}})

    # Active departments list
    dept_cursor = db.departments.find({"status": "ACTIVE"})
    all_depts = await dept_cursor.to_list(length=100)
    dept_names = [d.get("name") for d in all_depts if d.get("name")]
    if not dept_names:
        dept_names = ["Logistics", "Finance", "Quality", "Fulfillment", "Operations", "Tech", "Customer Experience"]

    total_tickets = len(tickets)
    open_tickets = 0
    resolved_tickets = 0
    review_queue_count = 0
    sla_breach_count = 0

    match_count = 0
    mismatch_count = 0
    override_count = 0

    priority_counts = {"P0": 0, "P1": 0, "P2": 0, "P3": 0}
    department_counts = {name: 0 for name in dept_names}

    now = datetime.utcnow()
    today_start = datetime(now.year, now.month, now.day)

    # Initialize 7-day buckets (from 6 days ago up to today)
    day_buckets = []
    for i in range(6, -1, -1):
        d_start = today_start - timedelta(days=i)
        d_end = d_start + timedelta(days=1)
        day_buckets.append({
            "d": d_start.strftime("%a"),
            "date": d_start.strftime("%Y-%m-%d"),
            "start": d_start,
            "end": d_end,
            "open": 0,
            "resolved": 0,
            "v": 0
        })

    for t in tickets:
        status_val = t.get("status", "In Triage")
        is_resolved = status_val in ["Resolved", "Closed"]
        if is_resolved:
            resolved_tickets += 1
        else:
            open_tickets += 1

        # Review Queue count
        if status_val == "AI Review" or t.get("match_status") is False:
            review_queue_count += 1

        # SLA breach check
        sla_hrs = t.get("sla_hours_remaining")
        is_breached = False
        if sla_hrs is not None and sla_hrs <= 0:
            is_breached = True
        elif t.get("sla_breach") is True or t.get("sla_breached") is True:
            is_breached = True
        elif (t.get("policy_compliance") or {}).get("status") == "VIOLATION":
            is_breached = True
        if is_breached:
            sla_breach_count += 1

        # AI Pipeline accuracy categorization
        has_override = bool(
            t.get("reviewer_override") or 
            t.get("override_action") or 
            t.get("overridden_by") or 
            status_val == "OVERRIDE"
        )
        if has_override:
            override_count += 1
        elif t.get("match_status") is False or status_val == "AI Review":
            mismatch_count += 1
        else:
            match_count += 1

        # Priority breakdown
        prio = t.get("priority", "P2")
        if prio in priority_counts:
            priority_counts[prio] += 1
        else:
            priority_counts["P2"] += 1

        # Department breakdown (active tickets)
        if not is_resolved:
            dept = t.get("department") or t.get("customer_department") or "General"
            department_counts[dept] = department_counts.get(dept, 0) + 1

        # 7-day Volume and Weekly Trend
        created_dt = _parse_datetime(t.get("created_at"))
        updated_dt = _parse_datetime(t.get("updated_at")) or created_dt

        if created_dt:
            for b in day_buckets:
                if b["start"] <= created_dt < b["end"]:
                    b["open"] += 1
                    b["v"] += 1
                    break

        if is_resolved and updated_dt:
            for b in day_buckets:
                if b["start"] <= updated_dt < b["end"]:
                    b["resolved"] += 1
                    break

    # Format AI Accuracy percentage
    total_ai_eval = match_count + mismatch_count + override_count
    if total_ai_eval > 0:
        match_pct = round((match_count / total_ai_eval) * 100, 1)
        mismatch_pct = round((mismatch_count / total_ai_eval) * 100, 1)
        override_pct = round((override_count / total_ai_eval) * 100, 1)
    else:
        match_pct = 100.0
        mismatch_pct = 0.0
        override_pct = 0.0

    sla_breach_rate = round((sla_breach_count / max(total_tickets, 1)) * 100, 1)

    # Department Workload formatting (sorted descending)
    dept_workload = [
        {"d": k, "v": v} 
        for k, v in sorted(department_counts.items(), key=lambda item: item[1], reverse=True)
    ]
    if len(dept_workload) > 6:
        dept_workload = dept_workload[:6]

    # SLA Risk formatting
    max_active = max(open_tickets, 10)
    sla_risk_data = [
        {"l": "Critical (P0)", "v": priority_counts["P0"], "m": max(priority_counts["P0"] * 2, 10), "c": "#E11D48"},
        {"l": "High (P1)",     "v": priority_counts["P1"], "m": max(priority_counts["P1"] * 2, 10), "c": "#D97706"},
        {"l": "Medium (P2)",   "v": priority_counts["P2"], "m": max(priority_counts["P2"] * 2, 10), "c": "#0891B2"},
        {"l": "Low (P3)",      "v": priority_counts["P3"], "m": max(priority_counts["P3"] * 2, 10), "c": "#059669"},
    ]

    volume_chart = [{"d": b["d"], "v": b["v"], "date": b["date"]} for b in day_buckets]
    weekly_chart = [{"d": b["d"], "open": b["open"], "resolved": b["resolved"]} for b in day_buckets]

    return {
        "status": "success",
        "summary": {
            "total_tickets": total_tickets,
            "open_tickets": open_tickets,
            "resolved_tickets": resolved_tickets,
            "ai_match_rate": match_pct,
            "sla_breach_count": sla_breach_count,
            "sla_breach_rate": sla_breach_rate,
            "kb_docs_count": kb_docs_count,
            "active_kb_docs_count": active_kb_docs,
            "active_rules_count": active_rules_count,
            "total_customers": total_customers,
            "total_staff": total_staff,
            "review_queue_count": review_queue_count,
            "agent_queue_count": open_tickets
        },
        "volume": volume_chart,
        "department_workload": dept_workload,
        "ai_pipeline_accuracy": [
            {"name": "Match",    "v": match_pct,    "count": match_count,    "c": "#059669"},
            {"name": "Mismatch", "v": mismatch_pct, "count": mismatch_count, "c": "#D97706"},
            {"name": "Override", "v": override_pct, "count": override_count, "c": "#7C3AED"}
        ],
        "sla_risk": sla_risk_data,
        "weekly_trend": weekly_chart
    }


class CreateRuleRequest(BaseModel):
    rule_id: str
    category: str
    condition: str
    department: str
    mandatory_actions: List[str] = []
    prohibited_actions: List[str] = []
    policy_reference: Optional[str] = None
    refund_eligible: Optional[bool] = False
    escalation_required: Optional[bool] = False


@router.get("/rules")
async def list_rules():
    """Lists all rules from the Rule Matrix collection."""
    db = get_database()
    cursor = db.rule_matrix.find({}).sort("rule_id", 1)
    rules = await cursor.to_list(length=300)
    for r in rules:
        r["_id"] = str(r["_id"])
    return rules


@router.post("/rules")
async def create_rule(req: CreateRuleRequest):
    """Admin creates a new policy rule in the rule matrix."""
    db = get_database()
    existing = await db.rule_matrix.find_one({"rule_id": req.rule_id.strip()})
    if existing:
        raise HTTPException(status_code=400, detail="Rule with this ID already exists.")

    rule_doc = req.model_dump()
    rule_doc["is_active"] = True
    rule_doc["created_at"] = datetime.utcnow()
    await db.rule_matrix.insert_one(rule_doc)
    rule_doc["_id"] = str(rule_doc["_id"])
    return {"status": "success", "rule": rule_doc}


@router.delete("/rules/{rule_id}")
async def delete_rule(rule_id: str):
    """Admin deletes a rule from the rule matrix."""
    db = get_database()
    result = await db.rule_matrix.delete_one({"rule_id": rule_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Rule not found.")
    return {"status": "success", "message": f"Rule {rule_id} deleted."}


@router.get("/analytics/trends")
async def get_analytics_trends(range: str = "30d"):
    """
    Time-series trend data for the /admin/analytics page.
    Generates volume_by_day, category breakdown, sentiment breakdown,
    escalation trend, SLA risk trend, repeat trend, and AI accuracy.
    """
    db = get_database()
    days_map = {"7d": 7, "30d": 30, "90d": 90}
    num_days = days_map.get(range, 30)

    now = datetime.utcnow()
    start_date = now - timedelta(days=num_days)

    tickets = await db.tickets.find({
        "created_at": {"$gte": start_date.isoformat()}
    }).to_list(length=1000)

    # Volume by day
    daily_counts = {}
    escalation_counts = {}
    sla_counts = {}
    ai_counts = {}
    for i in range(num_days):
        d_str = (start_date + timedelta(days=i)).strftime("%Y-%m-%d")
        daily_counts[d_str] = 0
        escalation_counts[d_str] = 0
        sla_counts[d_str] = {"breached": 0, "at_risk": 0, "safe": 0}
        ai_counts[d_str] = {"total": 0, "match": 0}

    cat_counts = {}
    sentiment_counts = {"positive": 0, "neutral": 0, "negative": 0, "urgent": 0}
    total_count = len(tickets)
    open_count = 0
    resolved_count = 0
    breached_count = 0

    for t in tickets:
        status = t.get("status", "")
        if status in ["In Triage", "In Progress", "AI Review", "Escalated"]:
            open_count += 1
        elif status in ["Resolved", "Closed"]:
            resolved_count += 1

        if t.get("sla_breach"):
            breached_count += 1

        # Date parsing
        created_dt = _parse_datetime(t.get("created_at"))
        d_str = created_dt.strftime("%Y-%m-%d") if created_dt else None

        if d_str and d_str in daily_counts:
            daily_counts[d_str] += 1
            if status == "Escalated":
                escalation_counts[d_str] += 1

            if t.get("sla_breach"):
                sla_counts[d_str]["breached"] += 1
            elif (t.get("sla_hours_remaining") or 99) <= 4:
                sla_counts[d_str]["at_risk"] += 1
            else:
                sla_counts[d_str]["safe"] += 1

            ai_counts[d_str]["total"] += 1
            if t.get("match_status"):
                ai_counts[d_str]["match"] += 1

        cat = t.get("category") or "General"
        cat_counts[cat] = cat_counts.get(cat, 0) + 1

        sen = ((t.get("genai_output") or {}).get("sentiment") or "neutral").lower()
        if sen in sentiment_counts:
            sentiment_counts[sen] += 1

    volume_by_day = [{"date": k, "count": v} for k, v in daily_counts.items()]
    by_category = [{"category": k, "count": v} for k, v in cat_counts.items()]
    escalation_by_day = [{"date": k, "count": v} for k, v in escalation_counts.items()]
    sla_by_day = [{"date": k, **v} for k, v in sla_counts.items()]

    ai_accuracy_by_day = []
    for k, v in ai_counts.items():
        pct = round((v["match"] / v["total"] * 100), 1) if v["total"] > 0 else 100.0
        ai_accuracy_by_day.append({"date": k, "match_pct": pct})

    # Repeat by week
    num_weeks = max(1, num_days // 7)
    repeat_by_week = []
    for w in range(num_weeks):
        w_start = start_date + timedelta(days=w * 7)
        w_label = f"W{w+1}"
        w_tickets = [t for t in tickets if _parse_datetime(t.get("created_at")) and w_start <= _parse_datetime(t.get("created_at")) < w_start + timedelta(days=7)]
        repeats = sum(1 for t in w_tickets if t.get("duplicate_of") or t.get("is_repeat"))
        pct = round((repeats / len(w_tickets) * 100), 1) if w_tickets else 0.0
        repeat_by_week.append({"week": w_label, "repeat_pct": pct})

    return {
        "summary": {
            "total": total_count,
            "open": open_count,
            "resolved": resolved_count,
            "breach_rate": round((breached_count / total_count * 100), 1) if total_count > 0 else 0.0
        },
        "volume_by_day": volume_by_day,
        "by_category": by_category,
        "by_sentiment": sentiment_counts,
        "escalation_by_day": escalation_by_day,
        "sla_by_day": sla_by_day,
        "repeat_by_week": repeat_by_week,
        "ai_accuracy_by_day": ai_accuracy_by_day,
    }


# ── Feature 6: Native MongoDB Aggregation Pipeline for Analytics Summary ──
@router.get("/analytics/summary")
async def get_analytics_summary_aggregated():
    """
    Feature 6: Pure MongoDB Aggregation Pipeline for Analytics Summary.
    Computes counts by category, sentiment, department, priority, escalation rate, and SLA risk count
    directly within MongoDB Atlas engine — zero in-memory Python dataset iteration.
    """
    db = get_database()

    pipeline_category = [{"$group": {"_id": "$category", "count": {"$sum": 1}}}]
    pipeline_sentiment = [{"$group": {"_id": "$sentiment", "count": {"$sum": 1}}}]
    pipeline_department = [{"$group": {"_id": "$department", "count": {"$sum": 1}}}]
    pipeline_priority = [{"$group": {"_id": "$priority", "count": {"$sum": 1}}}]

    cat_res = await db.tickets.aggregate(pipeline_category).to_list(length=100)
    sen_res = await db.tickets.aggregate(pipeline_sentiment).to_list(length=100)
    dept_res = await db.tickets.aggregate(pipeline_department).to_list(length=100)
    pri_res = await db.tickets.aggregate(pipeline_priority).to_list(length=100)

    total_tickets = await db.tickets.count_documents({})
    escalated_count = await db.tickets.count_documents({"status": "Escalated"})
    sla_risk_count = await db.tickets.count_documents({"$or": [{"sla_breach": True}, {"sla_hours_remaining": {"$lte": 4}}]})

    escalation_rate = round((escalated_count / total_tickets * 100), 1) if total_tickets > 0 else 0.0

    by_category = {item["_id"] or "Uncategorized": item["count"] for item in cat_res}
    by_sentiment = {item["_id"] or "Neutral": item["count"] for item in sen_res}
    by_department = {item["_id"] or "Unassigned": item["count"] for item in dept_res}
    by_priority = {item["_id"] or "P2": item["count"] for item in pri_res}

    return {
        "total_tickets": total_tickets,
        "by_category": by_category,
        "by_sentiment": by_sentiment,
        "by_department": by_department,
        "by_priority": by_priority,
        "escalation_rate": escalation_rate,
        "sla_risk_count": sla_risk_count
    }


# ── Feature 7: Reports Generation & Export Endpoint ──
import io
import csv
from fastapi.responses import StreamingResponse

@router.get("/reports/preview")
async def get_report_preview(
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    limit: int = Query(50)
):
    """Returns report preview matching filters."""
    db = get_database()
    query = {}
    if status:
        query["status"] = status
    if department:
        query["department"] = {"$regex": department, "$options": "i"}
    if priority:
        query["priority"] = priority
    if category:
        query["category"] = {"$regex": category, "$options": "i"}
    if from_date or to_date:
        date_q = {}
        if from_date:
            date_q["$gte"] = from_date
        if to_date:
            date_q["$lte"] = to_date
        query["created_at"] = date_q

    cursor = db.tickets.find(query).sort("created_at", -1).limit(limit)
    tickets = await cursor.to_list(length=limit)
    for t in tickets:
        t["_id"] = str(t["_id"])
    return {"tickets": tickets, "total": len(tickets)}


@router.get("/reports/export")
async def export_reports(
    format: str = Query("csv"),  # csv | pdf | xlsx
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    category: Optional[str] = Query(None)
):
    """
    Feature 7: Export complaint reports in CSV, Excel (XLSX), or PDF format.
    PDF generated via ReportLab (pure Python). XLSX generated via OpenPyXL. CSV via native csv module.
    """
    db = get_database()
    query = {}
    if status:
        query["status"] = status
    if department:
        query["department"] = {"$regex": department, "$options": "i"}
    if priority:
        query["priority"] = priority
    if category:
        query["category"] = {"$regex": category, "$options": "i"}

    cursor = db.tickets.find(query).sort("created_at", -1)
    tickets = await cursor.to_list(length=5000)

    headers = ["ticket_id", "title", "category", "department", "priority", "sentiment", "match_status", "escalation_status", "status", "created_at"]

    rows = []
    for t in tickets:
        created_str = t.get("created_at").strftime("%Y-%m-%d %H:%M") if isinstance(t.get("created_at"), datetime) else str(t.get("created_at") or "")
        rows.append({
            "ticket_id": t.get("ticket_id", ""),
            "title": t.get("title", ""),
            "category": t.get("category", ""),
            "department": t.get("department", ""),
            "priority": t.get("priority", ""),
            "sentiment": t.get("sentiment", ""),
            "match_status": "Verified Match" if t.get("match_status", True) else "Mismatch Detected",
            "escalation_status": "Escalated" if t.get("status") == "Escalated" or (t.get("genai_output") or {}).get("escalation_required") else "Standard",
            "status": t.get("status", ""),
            "created_at": created_str
        })

    fmt = format.lower()

    if fmt == "csv":
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=headers)
        writer.writeheader()
        writer.writerows(rows)
        output.seek(0)
        return StreamingResponse(
            io.BytesIO(output.getvalue().encode("utf-8")),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=novawear-complaints-report.csv"}
        )

    elif fmt == "xlsx":
        import openpyxl
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Complaints Report"
        ws.append(headers)
        for r in rows:
            ws.append([r[h] for h in headers])

        bio = io.BytesIO()
        wb.save(bio)
        bio.seek(0)
        return StreamingResponse(
            bio,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=novawear-complaints-report.xlsx"}
        )

    elif fmt == "pdf":
        from reportlab.lib.pagesizes import letter, landscape
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib import colors

        bio = io.BytesIO()
        doc = SimpleDocTemplate(bio, pagesize=landscape(letter), rightMargin=20, leftMargin=20, topMargin=20, bottomMargin=20)
        elements = []
        styles = getSampleStyleSheet()

        title_style = ParagraphStyle("ReportTitle", parent=styles["Heading1"], fontSize=16, textColor=colors.HexColor("#0B0E14"), spaceAfter=12)
        elements.append(Paragraph("NovaWear Apparel — Complaint Intelligence Report", title_style))
        elements.append(Paragraph(f"Generated on {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')} | Total Records: {len(rows)}", styles["Normal"]))
        elements.append(Spacer(1, 12))

        table_data = [[h.replace("_", " ").title() for h in headers]]
        for r in rows:
            table_data.append([
                r["ticket_id"],
                r["title"][:25] + "..." if len(r["title"]) > 25 else r["title"],
                r["category"],
                r["department"],
                r["priority"],
                r["sentiment"],
                r["match_status"],
                r["escalation_status"],
                r["status"],
                r["created_at"][:10]
            ])

        t = Table(table_data)
        t.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#151922')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor('#F2EFEA')),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 6),
            ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#F8FAFC')),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
        ]))
        elements.append(t)
        doc.build(elements)
        bio.seek(0)
        return StreamingResponse(
            bio,
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=novawear-complaints-report.pdf"}
        )

    else:
        raise HTTPException(status_code=400, detail="Invalid format. Supported formats: csv, xlsx, pdf.")



