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


# ── Feature 14: Native MongoDB Aggregation Pipeline for Analytics Summary ──
@router.get("/analytics/summary")
async def get_analytics_summary_aggregated(
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    department: Optional[str] = Query(None)
):
    """
    Feature 14: Pure MongoDB Aggregation Pipeline for Analytics Summary.
    Computes counts by category, subcategory, department, priority, urgency, sentiment, channel,
    status, escalation rate, SLA risk counts, repeat rate, avg resolution time, manual-review rate,
    GenAI/Python mismatch rate, and avg verification score directly within MongoDB Atlas.
    """
    db = get_database()
    match_query: Dict[str, Any] = {}

    if department and department.strip():
        match_query["department"] = {"$regex": f"^{department.strip()}$", "$options": "i"}

    # Parse date filters if provided
    dt_from = None
    dt_to = None
    if from_date:
        try:
            dt_from = datetime.fromisoformat(from_date.strip().replace("Z", "+00:00"))
        except Exception:
            try:
                dt_from = datetime.strptime(from_date.strip()[:10], "%Y-%m-%d")
            except Exception:
                pass
    if to_date:
        try:
            dt_to = datetime.fromisoformat(to_date.strip().replace("Z", "+00:00"))
        except Exception:
            try:
                dt_to = datetime.strptime(to_date.strip()[:10], "%Y-%m-%d")
                dt_to = dt_to.replace(hour=23, minute=59, second=59, microsecond=999999)
            except Exception:
                pass

    if dt_from or dt_to:
        date_q = {}
        if dt_from:
            date_q["$gte"] = dt_from
        if dt_to:
            date_q["$lte"] = dt_to
        match_query["$or"] = [
            {"created_at": date_q},
            {"created_at": {
                k: (v.isoformat() if isinstance(v, datetime) else v)
                for k, v in date_q.items()
            }}
        ]

    pipeline = [
        {"$match": match_query} if match_query else {"$match": {}},
        {
            "$facet": {
                "by_category": [
                    {"$group": {"_id": {"$ifNull": ["$category", "Uncategorized"]}, "count": {"$sum": 1}}}
                ],
                "by_subcategory": [
                    {
                        "$project": {
                            "sub": {
                                "$ifNull": [
                                    "$sub_category",
                                    {"$ifNull": ["$genai_output.subcategory", "General"]}
                                ]
                            }
                        }
                    },
                    {"$group": {"_id": "$sub", "count": {"$sum": 1}}}
                ],
                "by_department": [
                    {"$group": {"_id": {"$ifNull": ["$department", "Unassigned"]}, "count": {"$sum": 1}}}
                ],
                "by_priority": [
                    {"$group": {"_id": {"$ifNull": ["$priority", "P2"]}, "count": {"$sum": 1}}}
                ],
                "by_urgency": [
                    {
                        "$project": {
                            "urg": {
                                "$ifNull": [
                                    "$urgency",
                                    {"$ifNull": ["$genai_output.urgency", "Medium"]}
                                ]
                            }
                        }
                    },
                    {"$group": {"_id": "$urg", "count": {"$sum": 1}}}
                ],
                "by_sentiment": [
                    {
                        "$project": {
                            "sen": {
                                "$ifNull": [
                                    "$sentiment",
                                    {"$ifNull": ["$genai_output.sentiment", "Neutral"]}
                                ]
                            }
                        }
                    },
                    {"$group": {"_id": "$sen", "count": {"$sum": 1}}}
                ],
                "by_channel": [
                    {"$group": {"_id": {"$ifNull": ["$channel", "Web Portal"]}, "count": {"$sum": 1}}}
                ],
                "by_status": [
                    {"$group": {"_id": {"$ifNull": ["$status", "In Triage"]}, "count": {"$sum": 1}}}
                ],
                "metrics": [
                    {
                        "$group": {
                            "_id": None,
                            "total": {"$sum": 1},
                            "escalated": {
                                "$sum": {
                                    "$cond": [
                                        {"$or": [
                                            {"$eq": ["$status", "Escalated"]},
                                            {"$eq": ["$escalation_required", True]}
                                        ]}, 1, 0
                                    ]
                                }
                            },
                            "sla_breached": {
                                "$sum": {
                                    "$cond": [
                                        {"$or": [
                                            {"$eq": ["$sla_breach", True]},
                                            {"$eq": ["$sla_status", "breached"]}
                                        ]}, 1, 0
                                    ]
                                }
                            },
                            "sla_approaching": {
                                "$sum": {
                                    "$cond": [
                                        {"$or": [
                                            {"$eq": ["$sla_status", "approaching"]},
                                            {"$and": [
                                                {"$ne": ["$sla_breach", True]},
                                                {"$lte": ["$sla_hours_remaining", 4]},
                                                {"$nin": ["$status", ["Resolved", "Closed"]]}
                                            ]}
                                        ]}, 1, 0
                                    ]
                                }
                            },
                            "repeat_count": {
                                "$sum": {
                                    "$cond": [
                                        {"$or": [
                                            {"$eq": ["$is_repeat", True]},
                                            {"$ne": [{"$ifNull": ["$duplicate_of", None]}, None]}
                                        ]}, 1, 0
                                    ]
                                }
                            },
                            "manual_review_count": {
                                "$sum": {
                                    "$cond": [
                                        {"$or": [
                                            {"$eq": ["$department_mismatch", True]},
                                            {"$eq": ["$status", "AI Review"]},
                                            {"$ne": [{"$ifNull": ["$reviewer_override", None]}, None]}
                                        ]}, 1, 0
                                    ]
                                }
                            },
                            "mismatch_count": {
                                "$sum": {
                                    "$cond": [
                                        {"$or": [
                                            {"$eq": ["$department_mismatch", True]},
                                            {"$ne": [{"$ifNull": ["$mismatch_type", None]}, None]}
                                        ]}, 1, 0
                                    ]
                                }
                            },
                            "avg_verification_score": {"$avg": "$verification_score"}
                        }
                    }
                ],
                "resolved_durations": [
                    {
                        "$match": {
                            "status": {"$in": ["Resolved", "Closed"]},
                            "resolved_at": {"$exists": True, "$ne": None},
                            "created_at": {"$exists": True, "$ne": None}
                        }
                    },
                    {
                        "$project": {
                            "hours": {
                                "$divide": [
                                    {"$subtract": ["$resolved_at", "$created_at"]},
                                    3600000
                                ]
                            }
                        }
                    },
                    {
                        "$group": {
                            "_id": None,
                            "avg_hours": {"$avg": "$hours"}
                        }
                    }
                ]
            }
        }
    ]

    try:
        facet_res = await db.tickets.aggregate(pipeline).to_list(length=1)
        res = facet_res[0] if facet_res else {}
    except Exception as agg_err:
        # Graceful fallback if aggregation facet encounters type difference on date math
        res = {}

    by_category = {item["_id"]: item["count"] for item in res.get("by_category", [])}
    by_subcategory = {item["_id"]: item["count"] for item in res.get("by_subcategory", [])}
    by_department = {item["_id"]: item["count"] for item in res.get("by_department", [])}
    by_priority = {item["_id"]: item["count"] for item in res.get("by_priority", [])}
    by_urgency = {item["_id"]: item["count"] for item in res.get("by_urgency", [])}
    by_sentiment = {item["_id"]: item["count"] for item in res.get("by_sentiment", [])}
    by_channel = {item["_id"]: item["count"] for item in res.get("by_channel", [])}
    by_status = {item["_id"]: item["count"] for item in res.get("by_status", [])}

    metrics_list = res.get("metrics", [])
    m = metrics_list[0] if metrics_list else {}

    total_tickets = m.get("total", 0)
    escalated_count = m.get("escalated", 0)
    sla_breached = m.get("sla_breached", 0)
    sla_approaching = m.get("sla_approaching", 0)
    repeat_count = m.get("repeat_count", 0)
    manual_review_count = m.get("manual_review_count", 0)
    mismatch_count = m.get("mismatch_count", 0)
    avg_score = m.get("avg_verification_score")

    # If facet didn't return (e.g. empty DB), compute fallback total
    if total_tickets == 0 and not match_query:
        total_tickets = await db.tickets.count_documents({})

    escalation_rate = round((escalated_count / total_tickets * 100), 1) if total_tickets > 0 else 0.0
    sla_safe = max(0, total_tickets - (sla_breached + sla_approaching))
    repeat_rate = round((repeat_count / total_tickets * 100), 1) if total_tickets > 0 else 0.0
    manual_review_rate = round((manual_review_count / total_tickets * 100), 1) if total_tickets > 0 else 0.0
    genai_python_mismatch_rate = round((mismatch_count / total_tickets * 100), 1) if total_tickets > 0 else 0.0

    dur_list = res.get("resolved_durations", [])
    avg_res_time = round(dur_list[0].get("avg_hours", 0.0), 1) if dur_list and dur_list[0].get("avg_hours") is not None else 0.0
    avg_verification_score = round(avg_score, 1) if avg_score is not None else 0.0

    return {
        "total_tickets": total_tickets,
        "by_category": by_category,
        "by_subcategory": by_subcategory,
        "by_department": by_department,
        "by_priority": by_priority,
        "by_urgency": by_urgency,
        "by_sentiment": by_sentiment,
        "by_channel": by_channel,
        "by_status": by_status,
        "escalation_rate": escalation_rate,
        "escalated_count": escalated_count,
        "sla_risk_counts": {
            "safe": sla_safe,
            "approaching": sla_approaching,
            "breached": sla_breached
        },
        "sla_risk_count": sla_breached + sla_approaching,
        "repeat_rate": repeat_rate,
        "repeat_count": repeat_count,
        "avg_resolution_time": avg_res_time,
        "manual_review_rate": manual_review_rate,
        "manual_review_count": manual_review_count,
        "genai_python_mismatch_rate": genai_python_mismatch_rate,
        "mismatch_count": mismatch_count,
        "avg_verification_score": avg_verification_score
    }


# ── Feature 14: Deterministic Trend Alerts (Zero LLM) ──
@router.get("/analytics/alerts")
async def get_analytics_alerts():
    """
    Feature 14: Deterministic trend detection (Volume spike > +30% & >=5 tickets,
    recurring product in >=3 tickets, escalation spike > 20%, high mismatch rate > 25%).
    Zero LLM calls — 100% deterministic MongoDB aggregations and statistical checks.
    """
    db = get_database()
    now = datetime.utcnow()
    day_ago = now - timedelta(days=1)
    two_days_ago = now - timedelta(days=2)
    seven_days_ago = now - timedelta(days=7)

    alerts = []

    # 1. Volume Spike: Last 24 hours vs previous 24 hours
    current_count = await db.tickets.count_documents({"created_at": {"$gte": day_ago}})
    prev_count = await db.tickets.count_documents({"created_at": {"$gte": two_days_ago, "$lt": day_ago}})

    if current_count >= 5 and prev_count > 0:
        increase_pct = round(((current_count - prev_count) / prev_count) * 100, 1)
        if increase_pct >= 30.0:
            alerts.append({
                "alert_id": "ALERT-VOL-SPIKE",
                "type": "VOLUME_SPIKE",
                "severity": "HIGH",
                "title": "Complaint Volume Spike Detected",
                "message": f"Inflow increased by {increase_pct}% in the last 24 hours ({current_count} tickets vs {prev_count} in previous 24h).",
                "metrics": {
                    "current_24h_tickets": current_count,
                    "previous_24h_tickets": prev_count,
                    "increase_percentage": increase_pct
                },
                "triggered_at": now.isoformat()
            })

    # 2. Recurring Product / Defect Issue (>= 3 complaints on same order_id or subcategory in last 7 days)
    rec_pipeline = [
        {"$match": {"created_at": {"$gte": seven_days_ago}}},
        {
            "$group": {
                "_id": {
                    "category": "$category",
                    "sub_category": {"$ifNull": ["$sub_category", "$genai_output.subcategory"]}
                },
                "count": {"$sum": 1},
                "tickets": {"$push": "$ticket_id"}
            }
        },
        {"$match": {"count": {"$gte": 3}}}
    ]
    recurring_items = await db.tickets.aggregate(rec_pipeline).to_list(length=10)
    for item in recurring_items:
        cat_info = item["_id"]
        cat_name = cat_info.get("category") or "General"
        sub_name = cat_info.get("sub_category") or "Unknown"
        count = item["count"]
        alerts.append({
            "alert_id": f"ALERT-REC-{cat_name.replace(' ', '_')}-{sub_name.replace(' ', '_')}",
            "type": "RECURRING_DEFECT",
            "severity": "MEDIUM",
            "title": f"Recurring Issue: {cat_name} ({sub_name})",
            "message": f"Cluster of {count} complaints detected for {cat_name} / {sub_name} in the past 7 days.",
            "metrics": {
                "category": cat_name,
                "subcategory": sub_name,
                "count": count,
                "sample_tickets": item.get("tickets", [])[:5]
            },
            "triggered_at": now.isoformat()
        })

    # 3. Escalation Spike in Last 24 Hours (> 20% and >= 5 tickets)
    if current_count >= 5:
        esc_count_24h = await db.tickets.count_documents({
            "created_at": {"$gte": day_ago},
            "$or": [{"status": "Escalated"}, {"escalation_required": True}]
        })
        esc_rate_24h = round((esc_count_24h / current_count) * 100, 1)
        if esc_rate_24h >= 20.0:
            alerts.append({
                "alert_id": "ALERT-ESC-SPIKE",
                "type": "ESCALATION_SPIKE",
                "severity": "HIGH",
                "title": "High Escalation Spike",
                "message": f"Escalation rate is {esc_rate_24h}% ({esc_count_24h} of {current_count} tickets in the past 24 hours).",
                "metrics": {
                    "escalated_count": esc_count_24h,
                    "total_tickets": current_count,
                    "escalation_rate": esc_rate_24h
                },
                "triggered_at": now.isoformat()
            })

    # 4. AI Routing Mismatch Spike (> 25% and >= 5 tickets)
    if current_count >= 5:
        mismatch_count_24h = await db.tickets.count_documents({
            "created_at": {"$gte": day_ago},
            "$or": [{"department_mismatch": True}, {"status": "AI Review"}]
        })
        mismatch_rate_24h = round((mismatch_count_24h / current_count) * 100, 1)
        if mismatch_rate_24h >= 25.0:
            alerts.append({
                "alert_id": "ALERT-MISMATCH-SPIKE",
                "type": "HIGH_MISMATCH_RATE",
                "severity": "MEDIUM",
                "title": "Elevated AI/Policy Mismatch Rate",
                "message": f"AI Review quarantine rate is {mismatch_rate_24h}% ({mismatch_count_24h} tickets). Reviewer triage required.",
                "metrics": {
                    "mismatch_count": mismatch_count_24h,
                    "total_tickets": current_count,
                    "mismatch_rate": mismatch_rate_24h
                },
                "triggered_at": now.isoformat()
            })

    return {
        "alerts": alerts,
        "total_active_alerts": len(alerts),
        "evaluated_at": now.isoformat()
    }


# ── Feature 16: Universal System Audit Logs Endpoint ──
@router.get("/audit-logs")
async def get_system_audit_logs(
    ticket_id: Optional[str] = Query(None),
    event_type: Optional[str] = Query(None),
    user_id: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    skip: int = Query(0, ge=0)
):
    """
    Feature 16: Unified immutable system audit trail.
    Queries system_audit_logs collection with pagination and filtering.
    """
    db = get_database()
    query: Dict[str, Any] = {}
    if ticket_id and ticket_id.strip():
        query["ticket_id"] = ticket_id.strip()
    if event_type and event_type.strip():
        query["event_type"] = event_type.strip()
    if user_id and user_id.strip():
        query["actor.user_id"] = user_id.strip()

    total = await db.system_audit_logs.count_documents(query)
    cursor = db.system_audit_logs.find(query).sort("timestamp", -1).skip(skip).limit(limit)
    logs = await cursor.to_list(length=limit)
    for l in logs:
        l["_id"] = str(l["_id"])
        if isinstance(l.get("timestamp"), datetime):
            l["timestamp"] = l["timestamp"].isoformat()

    return {"logs": logs, "total": total, "limit": limit, "skip": skip}


# ── Feature 15: Reports Generation & Multi-Format Export Engine ──
import io
import csv
from fastapi.responses import StreamingResponse

def _clean_str(val: Any) -> Optional[str]:
    if val is None or not isinstance(val, str):
        return None
    s = val.strip()
    return s if s else None

def _build_ticket_report_query(
    from_date: Any = None,
    to_date: Any = None,
    from_param: Any = None,
    to_param: Any = None,
    status: Any = None,
    department: Any = None,
    priority: Any = None,
    category: Any = None
) -> dict:
    query = {}
    c_status = _clean_str(status)
    c_department = _clean_str(department)
    c_priority = _clean_str(priority)
    c_category = _clean_str(category)

    if c_status:
        query["status"] = c_status
    if c_department:
        query["department"] = {"$regex": c_department, "$options": "i"}
    if c_priority:
        query["priority"] = c_priority
    if c_category:
        query["category"] = {"$regex": c_category, "$options": "i"}

    raw_from = _clean_str(from_date) or _clean_str(from_param)
    raw_to = _clean_str(to_date) or _clean_str(to_param)

    dt_from = None
    dt_to = None

    if raw_from:
        try:
            dt_from = datetime.fromisoformat(raw_from.replace("Z", "+00:00"))
        except Exception:
            try:
                dt_from = datetime.strptime(raw_from[:10], "%Y-%m-%d")
            except Exception:
                dt_from = None

    if raw_to:
        try:
            dt_to = datetime.fromisoformat(raw_to.replace("Z", "+00:00"))
        except Exception:
            try:
                dt_to = datetime.strptime(raw_to[:10], "%Y-%m-%d")
                dt_to = dt_to.replace(hour=23, minute=59, second=59, microsecond=999999)
            except Exception:
                dt_to = None

    if dt_from or dt_to:
        date_q = {}
        if dt_from:
            date_q["$gte"] = dt_from
        if dt_to:
            date_q["$lte"] = dt_to
        query["$or"] = [
            {"created_at": date_q},
            {"created_at": {
                k: (v.isoformat() if isinstance(v, datetime) else v)
                for k, v in date_q.items()
            }}
        ]

    return query


def _build_report_rows(tickets: List[Dict[str, Any]], report_type: str = "complaint_analysis"):
    """
    Transforms MongoDB ticket documents into structured report rows and column specifications.
    Supports report types: complaint_analysis (34 cols), genai_python_comparison (14 cols),
    escalations, sla_status, policy_usage, resolution_compliance, manual_reviews.
    """
    r_type = (report_type or "complaint_analysis").strip().lower()

    if r_type == "genai_python_comparison":
        specs = [
            ("ticket_id", "Ticket ID"),
            ("created_at", "Date Created"),
            ("category", "Category"),
            ("genai_dept", "GenAI Proposed Dept"),
            ("python_dept", "Python Rule Dept"),
            ("dept_match", "Dept Match"),
            ("genai_priority", "GenAI Priority"),
            ("python_priority", "Python Priority"),
            ("priority_match", "Priority Match"),
            ("genai_escalation", "GenAI Escalation"),
            ("python_escalation", "Python Escalation"),
            ("escalation_match", "Escalation Match"),
            ("verification_score", "Verification Score"),
            ("final_routing", "Final Routing Decision")
        ]
        rows = []
        for t in tickets:
            created = t.get("created_at")
            c_str = created.strftime("%Y-%m-%d %H:%M") if isinstance(created, datetime) else str(created or "")[:16]
            genai = t.get("genai_output") or {}
            py_rule = t.get("python_rule_output") or {}

            g_dept = str(genai.get("department") or t.get("recommended_department") or "")
            p_dept = str(t.get("department") or py_rule.get("primary_department") or "")
            dept_m = "MATCH" if (g_dept.lower() == p_dept.lower() and g_dept) else "MISMATCH"

            g_pri = str(genai.get("priority") or "")
            p_pri = str(t.get("priority") or py_rule.get("priority") or "P2")
            pri_m = "MATCH" if (g_pri.upper() == p_pri.upper() and g_pri) else "MISMATCH"

            g_esc = "YES" if genai.get("escalation_required") else "NO"
            p_esc = "YES" if (t.get("escalation_required") or py_rule.get("escalation_required")) else "NO"
            esc_m = "MATCH" if g_esc == p_esc else "MISMATCH"

            routing = "AI Review Quarantine" if t.get("department_mismatch") or t.get("status") == "AI Review" else "Agent Pool"

            rows.append({
                "ticket_id": str(t.get("ticket_id") or ""),
                "created_at": c_str,
                "category": str(t.get("category") or ""),
                "genai_dept": g_dept,
                "python_dept": p_dept,
                "dept_match": dept_m,
                "genai_priority": g_pri,
                "python_priority": p_pri,
                "priority_match": pri_m,
                "genai_escalation": g_esc,
                "python_escalation": p_esc,
                "escalation_match": esc_m,
                "verification_score": str(t.get("verification_score") or ""),
                "final_routing": routing
            })
        return specs, rows

    elif r_type == "escalations":
        specs = [
            ("ticket_id", "Ticket ID"),
            ("created_at", "Date Created"),
            ("customer_name", "Customer Name"),
            ("category", "Category"),
            ("department", "Department"),
            ("priority", "Priority"),
            ("escalation_level", "Escalation Level"),
            ("escalation_source", "Escalation Source"),
            ("triggered_rules", "Triggered Rules"),
            ("status", "Status"),
            ("assigned_agent", "Assigned Agent"),
            ("assigned_reviewer", "Assigned Reviewer")
        ]
        rows = []
        for t in tickets:
            if not (t.get("status") == "Escalated" or t.get("escalation_required") or (t.get("python_rule_output") or {}).get("escalation_required")):
                continue
            created = t.get("created_at")
            c_str = created.strftime("%Y-%m-%d %H:%M") if isinstance(created, datetime) else str(created or "")[:16]
            py_rule = t.get("python_rule_output") or {}
            trig = py_rule.get("triggered_rules") or t.get("escalation_rules_triggered") or []
            trig_str = "; ".join(trig) if isinstance(trig, list) else str(trig)

            rows.append({
                "ticket_id": str(t.get("ticket_id") or ""),
                "created_at": c_str,
                "customer_name": str(t.get("customer_name") or "Customer"),
                "category": str(t.get("category") or ""),
                "department": str(t.get("department") or ""),
                "priority": str(t.get("priority") or "P0"),
                "escalation_level": str(t.get("escalation_level") or py_rule.get("escalation_level") or "LEVEL_1"),
                "escalation_source": str(t.get("escalation_source") or "PYTHON_RULE"),
                "triggered_rules": trig_str,
                "status": str(t.get("status") or ""),
                "assigned_agent": str(t.get("assigned_agent") or "Unassigned"),
                "assigned_reviewer": str(t.get("assigned_reviewer_name") or "")
            })
        return specs, rows

    elif r_type == "sla_status":
        specs = [
            ("ticket_id", "Ticket ID"),
            ("created_at", "Date Created"),
            ("priority", "Priority"),
            ("status", "Status"),
            ("sla_status", "SLA Status"),
            ("sla_hours_remaining", "Hours Remaining"),
            ("sla_risk_pct", "Risk %"),
            ("department", "Department"),
            ("assigned_agent", "Assigned Agent")
        ]
        rows = []
        for t in tickets:
            created = t.get("created_at")
            c_str = created.strftime("%Y-%m-%d %H:%M") if isinstance(created, datetime) else str(created or "")[:16]
            rows.append({
                "ticket_id": str(t.get("ticket_id") or ""),
                "created_at": c_str,
                "priority": str(t.get("priority") or "P2"),
                "status": str(t.get("status") or ""),
                "sla_status": str(t.get("sla_status") or ("breached" if t.get("sla_breach") else "safe")),
                "sla_hours_remaining": str(t.get("sla_hours_remaining") if t.get("sla_hours_remaining") is not None else ""),
                "sla_risk_pct": str(t.get("sla_risk_pct") or 0.0),
                "department": str(t.get("department") or ""),
                "assigned_agent": str(t.get("assigned_agent") or "Unassigned")
            })
        return specs, rows

    elif r_type in ["policy_usage", "policy-usage"]:
        specs = [
            ("ticket_id", "Ticket ID"),
            ("created_at", "Date Created"),
            ("policy_id", "Cited Policy ID"),
            ("category", "Category"),
            ("department", "Department"),
            ("match_status", "Policy Verified"),
            ("hallucination_flag", "Hallucinated Citation"),
            ("assigned_agent", "Handling Agent"),
            ("status", "Ticket Status")
        ]
        rows = []
        for t in tickets:
            created = t.get("created_at")
            c_str = created.strftime("%Y-%m-%d %H:%M") if isinstance(created, datetime) else str(created or "")[:16]
            py_rule = t.get("python_rule_output") or {}
            genai = t.get("genai_output") or {}
            pol_id = t.get("policy_id") or genai.get("policy_id") or py_rule.get("matched_rule_id") or "None"
            h_flags = t.get("hallucination_flags") or []
            is_hallucinated = any(f.get("type") in ["FABRICATED_POLICY", "INVALID_POLICY_CITATION"] for f in h_flags) if isinstance(h_flags, list) else False

            rows.append({
                "ticket_id": str(t.get("ticket_id") or ""),
                "created_at": c_str,
                "policy_id": pol_id,
                "category": str(t.get("category") or ""),
                "department": str(t.get("department") or ""),
                "match_status": "YES" if (t.get("match_status") is True and not is_hallucinated) else "NO",
                "hallucination_flag": "YES (Invalid)" if is_hallucinated else "NO (Valid)",
                "assigned_agent": str(t.get("assigned_agent") or "Unassigned"),
                "status": str(t.get("status") or "")
            })
        return specs, rows

    elif r_type in ["resolution_compliance", "resolution-compliance"]:
        specs = [
            ("ticket_id", "Ticket ID"),
            ("created_at", "Date Created"),
            ("category", "Category"),
            ("priority", "Priority"),
            ("status", "Status"),
            ("sla_breach", "SLA Breached"),
            ("verification_score", "Verification Score"),
            ("policy_compliant", "Policy Compliant"),
            ("mandatory_actions_taken", "Actions Completed"),
            ("assigned_agent", "Agent")
        ]
        rows = []
        for t in tickets:
            created = t.get("created_at")
            c_str = created.strftime("%Y-%m-%d %H:%M") if isinstance(created, datetime) else str(created or "")[:16]
            comp = t.get("policy_compliance") or {}
            is_comp = comp.get("status") == "COMPLIANT" or (not t.get("department_mismatch") and not t.get("hallucination_flags"))
            rows.append({
                "ticket_id": str(t.get("ticket_id") or ""),
                "created_at": c_str,
                "category": str(t.get("category") or ""),
                "priority": str(t.get("priority") or "P2"),
                "status": str(t.get("status") or ""),
                "sla_breach": "YES" if t.get("sla_breach") else "NO",
                "verification_score": str(t.get("verification_score") if t.get("verification_score") is not None else ""),
                "policy_compliant": "YES" if is_comp else "NO",
                "mandatory_actions_taken": "YES" if t.get("agent_notes") or t.get("status") == "Resolved" else "PENDING",
                "assigned_agent": str(t.get("assigned_agent") or "Unassigned")
            })
        return specs, rows

    elif r_type in ["manual_reviews", "manual-reviews"]:
        specs = [
            ("ticket_id", "Ticket ID"),
            ("created_at", "Date Created"),
            ("mismatch_type", "Mismatch / Reason"),
            ("original_dept", "Customer / GenAI Dept"),
            ("active_dept", "Assigned Dept"),
            ("assigned_reviewer", "Reviewer"),
            ("status", "Status"),
            ("reviewer_action", "Action Taken"),
            ("assigned_agent", "Reassigned Agent")
        ]
        rows = []
        for t in tickets:
            if not (t.get("department_mismatch") or t.get("status") in ["AI Review", "Escalated"] or t.get("reviewer_override") or t.get("assigned_reviewer_id")):
                continue
            created = t.get("created_at")
            c_str = created.strftime("%Y-%m-%d %H:%M") if isinstance(created, datetime) else str(created or "")[:16]
            act = "REASSIGNED" if t.get("reviewer_override") else ("IN_REVIEW" if t.get("assigned_reviewer_id") else "PENDING_CLAIM")
            rows.append({
                "ticket_id": str(t.get("ticket_id") or ""),
                "created_at": c_str,
                "mismatch_type": str(t.get("mismatch_type") or "DEPARTMENT_OR_POLICY_MISMATCH"),
                "original_dept": str(t.get("customer_department") or (t.get("genai_output") or {}).get("department") or ""),
                "active_dept": str(t.get("department") or ""),
                "assigned_reviewer": str(t.get("assigned_reviewer_name") or t.get("reviewed_by_name") or "Unclaimed"),
                "status": str(t.get("status") or ""),
                "reviewer_action": act,
                "assigned_agent": str(t.get("assigned_agent") or "Unassigned")
            })
        return specs, rows

    # Default: complaint_analysis (Original 27 columns + 7 new columns = 34 columns)
    specs = [
        ("ticket_id", "Ticket ID"),
        ("created_at", "Date Created"),
        ("customer_name", "Customer Name"),
        ("customer_email", "Customer Email"),
        ("order_id", "Order ID"),
        ("channel", "Channel"),
        ("title", "Complaint Title"),
        ("description", "Complaint Description"),
        ("customer_department", "Customer Department"),
        ("department", "Active Department"),
        ("category", "Issue Category"),
        ("sub_category", "Subcategory"),
        ("priority", "Priority"),
        ("urgency", "Urgency"),
        ("sentiment", "Sentiment"),
        ("status", "Ticket Status"),
        ("match_status", "Policy / Dept Match"),
        ("assigned_agent", "Assigned Agent"),
        ("assigned_agent_email", "Agent Email"),
        ("assigned_reviewer", "Reviewer / Manager"),
        ("policy_id", "Policy Reference"),
        ("escalation_status", "Escalation Status"),
        ("sla_breach", "SLA Breached"),
        ("agent_notes", "Agent Resolution Notes"),
        ("draft_response", "AI Recommended Response"),
        ("resolution_steps", "Resolution Steps"),
        ("updated_at", "Last Updated"),
        # ── 7 New Enterprise Extension Columns ──
        ("secondary_issues", "Secondary Issues"),
        ("supporting_departments", "Supporting Departments"),
        ("verification_score", "Verification Score"),
        ("escalation_level", "Escalation Level"),
        ("is_repeat", "Repeat Complaint"),
        ("missing_fields", "Missing Fields"),
        ("hallucination_flags_count", "Hallucination Flags Count")
    ]

    rows = []
    for t in tickets:
        created = t.get("created_at")
        created_str = created.strftime("%Y-%m-%d %H:%M:%S") if isinstance(created, datetime) else str(created or "")
        updated = t.get("updated_at")
        updated_str = updated.strftime("%Y-%m-%d %H:%M:%S") if isinstance(updated, datetime) else str(updated or "")

        genai = t.get("genai_output") or {}
        py_rule = t.get("python_rule_output") or {}

        raw_steps = genai.get("resolution_steps") or py_rule.get("mandatory_actions") or []
        res_steps = "; ".join(str(s).strip() for s in raw_steps if str(s).strip()) if isinstance(raw_steps, list) else str(raw_steps or "")

        policy = t.get("policy_id") or genai.get("policy_id") or py_rule.get("matched_rule_id") or ""

        if t.get("reviewer_override"):
            match_status = "Reviewer Triaged & Approved"
        elif t.get("department_mismatch") or (t.get("match_status") is False):
            match_status = "Mismatch Detected"
        else:
            match_status = "Verified Match"

        is_escalated = bool(
            t.get("status") == "Escalated" or
            t.get("escalation_required") or
            genai.get("escalation_required") or
            py_rule.get("escalation_required")
        )

        sec_issues = genai.get("secondary_issues") or t.get("secondary_issues") or []
        sec_str = "; ".join(f"{s.get('category')}: {s.get('summary')}" if isinstance(s, dict) else str(s) for s in sec_issues) if sec_issues else "None"

        sup_depts = t.get("supporting_departments") or genai.get("supporting_departments") or []
        sup_str = ", ".join(sup_depts) if isinstance(sup_depts, list) and sup_depts else "None"

        missing = t.get("missing_fields") or []
        missing_str = ", ".join(missing) if isinstance(missing, list) and missing else "None"

        h_flags = t.get("hallucination_flags") or []
        h_count = str(len(h_flags)) if isinstance(h_flags, list) else "0"

        is_repeat_str = "YES" if (t.get("is_repeat") or t.get("duplicate_of")) else "NO"
        esc_level = str(t.get("escalation_level") or (py_rule.get("escalation_level") if is_escalated else "NONE"))

        rows.append({
            "ticket_id": str(t.get("ticket_id") or ""),
            "created_at": created_str,
            "customer_name": str(t.get("customer_name") or t.get("customer_id") or "Customer"),
            "customer_email": str(t.get("customer_email") or ""),
            "order_id": str(t.get("order_id") or ""),
            "channel": str(t.get("channel") or "Web Portal"),
            "title": str(t.get("title") or ""),
            "description": str(t.get("description") or ""),
            "customer_department": str(t.get("customer_department") or t.get("department") or ""),
            "department": str(t.get("department") or ""),
            "category": str(t.get("category") or ""),
            "sub_category": str(t.get("sub_category") or genai.get("subcategory") or ""),
            "priority": str(t.get("priority") or "P2"),
            "urgency": str(t.get("urgency") or genai.get("urgency") or "Medium"),
            "sentiment": str(t.get("sentiment") or genai.get("sentiment") or "Neutral"),
            "status": str(t.get("status") or "In Triage"),
            "match_status": match_status,
            "assigned_agent": str(t.get("assigned_agent") or t.get("assigned_agent_id") or "Unassigned"),
            "assigned_agent_email": str(t.get("assigned_agent_email") or ""),
            "assigned_reviewer": str(t.get("assigned_reviewer_name") or t.get("reviewed_by_name") or ""),
            "policy_id": str(policy),
            "escalation_status": "Escalated" if is_escalated else "Standard",
            "sla_breach": "YES (Breached)" if t.get("sla_breach") else "NO (Within SLA)",
            "agent_notes": str(t.get("agent_notes") or ""),
            "draft_response": str(t.get("draft_response") or genai.get("draft_response") or ""),
            "resolution_steps": res_steps,
            "updated_at": updated_str,
            # ── 7 New Enterprise Extension Columns ──
            "secondary_issues": sec_str,
            "supporting_departments": sup_str,
            "verification_score": str(t.get("verification_score") if t.get("verification_score") is not None else ""),
            "escalation_level": esc_level,
            "is_repeat": is_repeat_str,
            "missing_fields": missing_str,
            "hallucination_flags_count": h_count
        })

    return specs, rows


@router.get("/reports/preview")
async def get_report_preview(
    report_type: str = Query("complaint_analysis"),
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    from_param: Optional[str] = Query(None, alias="from"),
    to_param: Optional[str] = Query(None, alias="to"),
    status: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    limit: int = Query(50)
):
    """
    Feature 15: Returns report preview matching filters and selected report type.
    """
    db = get_database()
    query = _build_ticket_report_query(
        from_date=from_date, to_date=to_date, from_param=from_param, to_param=to_param,
        status=status, department=department, priority=priority, category=category
    )
    cursor = db.tickets.find(query).sort("created_at", -1).limit(limit)
    tickets = await cursor.to_list(length=limit)

    specs, rows = _build_report_rows(tickets, report_type=report_type)
    return {
        "report_type": report_type,
        "columns": [label for _, label in specs],
        "rows": rows,
        "total": len(rows)
    }


@router.get("/reports/export")
async def export_reports(
    report_type: str = Query("complaint_analysis"),
    format: str = Query("csv"),  # csv | pdf | xlsx
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    from_param: Optional[str] = Query(None, alias="from"),
    to_param: Optional[str] = Query(None, alias="to"),
    status: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    category: Optional[str] = Query(None)
):
    """
    Feature 15: Export complaint reports in CSV, Excel (XLSX), or PDF format.
    Supports complaint_analysis (34 columns: 27 original + 7 new), genai_python_comparison,
    escalations, sla_status, policy_usage, resolution_compliance, and manual_reviews.
    """
    db = get_database()
    query = _build_ticket_report_query(
        from_date=from_date, to_date=to_date, from_param=from_param, to_param=to_param,
        status=status, department=department, priority=priority, category=category
    )

    cursor = db.tickets.find(query).sort("created_at", -1)
    tickets = await cursor.to_list(length=5000)

    column_specs, rows = _build_report_rows(tickets, report_type=report_type)
    fmt = (_clean_str(format) or "csv").lower()
    timestamp_suffix = datetime.utcnow().strftime("%Y%m%d_%H%M")
    file_prefix = f"novawear-{report_type.replace('_', '-')}"

    # ─── 1. CSV EXPORT ───────────────────────────────────────────────────────────
    if fmt == "csv":
        output = io.StringIO()
        field_keys = [k for k, _ in column_specs]
        field_labels = [label for _, label in column_specs]

        writer = csv.writer(output)
        writer.writerow(field_labels)
        for r in rows:
            writer.writerow([r.get(k, "") for k in field_keys])

        output.seek(0)
        csv_bytes = b"\xef\xbb\xbf" + output.getvalue().encode("utf-8")
        return StreamingResponse(
            io.BytesIO(csv_bytes),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": f"attachment; filename={file_prefix}-{timestamp_suffix}.csv"}
        )

    # ─── 2. EXCEL (XLSX) EXPORT ─────────────────────────────────────────────────
    elif fmt == "xlsx":
        try:
            import openpyxl
            from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
            from openpyxl.utils import get_column_letter

            wb = openpyxl.Workbook()
            ws = wb.active
            sheet_title = report_type.replace("_", " ").title()[:30]
            ws.title = sheet_title

            field_keys = [k for k, _ in column_specs]
            field_labels = [label for _, label in column_specs]

            # Write header row
            ws.append(field_labels)

            header_fill = PatternFill(start_color="151922", end_color="151922", fill_type="solid")
            header_font = Font(name="Calibri", size=11, bold=True, color="F2EFEA")
            thin_border = Border(
                left=Side(style="thin", color="CBD5E1"),
                right=Side(style="thin", color="CBD5E1"),
                top=Side(style="thin", color="CBD5E1"),
                bottom=Side(style="thin", color="CBD5E1")
            )

            for col_idx in range(1, len(field_labels) + 1):
                cell = ws.cell(row=1, column=col_idx)
                cell.fill = header_fill
                cell.font = header_font
                cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=False)
                cell.border = thin_border
            ws.row_dimensions[1].height = 28

            zebra_fill = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")
            regular_font = Font(name="Calibri", size=10, color="0F172A")

            for row_idx, r in enumerate(rows, start=2):
                ws.append([r.get(k, "") for k in field_keys])
                is_even = (row_idx % 2 == 0)
                ws.row_dimensions[row_idx].height = 20
                for col_idx in range(1, len(field_keys) + 1):
                    cell = ws.cell(row=row_idx, column=col_idx)
                    cell.font = regular_font
                    cell.border = thin_border
                    if is_even:
                        cell.fill = zebra_fill
                    cell.alignment = Alignment(vertical="center")

            # Auto-fit column widths
            for col in ws.columns:
                max_len = 0
                col_letter = get_column_letter(col[0].column)
                for cell in col:
                    val_str = str(cell.value or "")
                    if len(val_str) > max_len:
                        max_len = len(val_str)
                ws.column_dimensions[col_letter].width = max(12, min(max_len + 3, 50))

            ws.freeze_panes = "A2"

            bio = io.BytesIO()
            wb.save(bio)
            bio.seek(0)
            return StreamingResponse(
                bio,
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                headers={"Content-Disposition": f"attachment; filename={file_prefix}-{timestamp_suffix}.xlsx"}
            )
        except ImportError:
            raise HTTPException(status_code=500, detail="OpenPyXL library is required for XLSX export.")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Excel generation error: {str(e)}")

    # ─── 3. PDF EXPORT ──────────────────────────────────────────────────────────
    elif fmt == "pdf":
        try:
            from reportlab.lib.pagesizes import letter, landscape
            from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
            from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
            from reportlab.lib import colors

            bio = io.BytesIO()
            doc = SimpleDocTemplate(
                bio,
                pagesize=landscape(letter),
                rightMargin=24, leftMargin=24,
                topMargin=24, bottomMargin=24
            )
            elements = []
            styles = getSampleStyleSheet()

            title_style = ParagraphStyle("ReportTitle", parent=styles["Heading1"], fontSize=15, leading=19, textColor=colors.HexColor("#0B0E14"))
            meta_style = ParagraphStyle("ReportMeta", parent=styles["Normal"], fontSize=8, leading=11, textColor=colors.HexColor("#64748B"))
            th_style = ParagraphStyle("ReportTh", parent=styles["Normal"], fontSize=8, leading=10, fontName="Helvetica-Bold", textColor=colors.HexColor("#FFFFFF"))
            td_style = ParagraphStyle("ReportTd", parent=styles["Normal"], fontSize=7.5, leading=9.5, textColor=colors.HexColor("#1E293B"))
            td_bold = ParagraphStyle("ReportTdBold", parent=td_style, fontName="Helvetica-Bold")

            report_display_title = report_type.replace("_", " ").title()
            elements.append(Paragraph(f"NovaWear Apparel — {report_display_title} Report", title_style))
            elements.append(Spacer(1, 3))

            elements.append(Paragraph(
                f"Generated on {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')} | "
                f"Total Records: {len(rows)} | Report Type: {report_type}",
                meta_style
            ))
            elements.append(Spacer(1, 10))

            # Select appropriate concise columns for PDF landscape layout
            if report_type == "genai_python_comparison":
                pdf_cols = [
                    ("ticket_id", "Ticket ID", 65),
                    ("category", "Category", 85),
                    ("genai_dept", "GenAI Dept", 80),
                    ("python_dept", "Python Dept", 80),
                    ("dept_match", "Dept Match", 65),
                    ("genai_priority", "GenAI Pri", 55),
                    ("python_priority", "Py Pri", 50),
                    ("verification_score", "Score", 45),
                    ("final_routing", "Final Routing", 100),
                    ("created_at", "Date", 70)
                ]
            elif report_type == "escalations":
                pdf_cols = [
                    ("ticket_id", "Ticket ID", 65),
                    ("customer_name", "Customer", 85),
                    ("category", "Category", 80),
                    ("department", "Dept", 75),
                    ("priority", "Pri", 40),
                    ("escalation_level", "Level", 60),
                    ("escalation_source", "Source", 75),
                    ("triggered_rules", "Triggered Rules", 140),
                    ("status", "Status", 65)
                ]
            elif report_type == "sla_status":
                pdf_cols = [
                    ("ticket_id", "Ticket ID", 70),
                    ("priority", "Priority", 50),
                    ("status", "Status", 75),
                    ("sla_status", "SLA Status", 75),
                    ("sla_hours_remaining", "Remaining (h)", 75),
                    ("sla_risk_pct", "Risk %", 60),
                    ("department", "Department", 85),
                    ("assigned_agent", "Agent", 85),
            elif report_type in ["policy_usage", "policy-usage"]:
                pdf_cols = [
                    ("ticket_id", "Ticket ID", 70),
                    ("policy_id", "Policy ID", 85),
                    ("category", "Category", 85),
                    ("department", "Department", 80),
                    ("match_status", "Verified", 55),
                    ("hallucination_flag", "Citation Validity", 95),
                    ("assigned_agent", "Agent", 80),
                    ("created_at", "Date", 70)
                ]
            elif report_type in ["resolution_compliance", "resolution-compliance"]:
                pdf_cols = [
                    ("ticket_id", "Ticket ID", 65),
                    ("category", "Category", 75),
                    ("priority", "Pri", 40),
                    ("status", "Status", 65),
                    ("sla_breach", "SLA Breach", 65),
                    ("verification_score", "Score", 45),
                    ("policy_compliant", "Compliant", 60),
                    ("mandatory_actions_taken", "Actions", 60),
                    ("assigned_agent", "Agent", 75),
                    ("created_at", "Date", 70)
                ]
            elif report_type in ["manual_reviews", "manual-reviews"]:
                pdf_cols = [
                    ("ticket_id", "Ticket ID", 65),
                    ("mismatch_type", "Mismatch Reason", 110),
                    ("original_dept", "Original Dept", 75),
                    ("active_dept", "Assigned Dept", 75),
                    ("assigned_reviewer", "Reviewer", 75),
                    ("reviewer_action", "Action", 75),
                    ("assigned_agent", "Assigned Agent", 75),
                    ("created_at", "Date", 70)
                ]
            else:
                # Default complaint summary
                pdf_cols = [
                    ("ticket_id", "Ticket ID", 65),
                    ("customer_name", "Customer", 80),
                    ("title", "Complaint Title", 160),
                    ("department", "Dept", 65),
                    ("category", "Category", 75),
                    ("priority", "Pri", 40),
                    ("status", "Status", 60),
                    ("verification_score", "Score", 40),
                    ("assigned_agent", "Agent", 80),
                    ("created_at", "Date", 65)
                ]

            pdf_headers = [label for _, label, _ in pdf_cols]
            col_widths = [w for _, _, w in pdf_cols]

            pdf_rows = rows[:300]
            table_data = [[Paragraph(h, th_style) for h in pdf_headers]]

            for r in pdf_rows:
                row_cells = []
                for key, _, _ in pdf_cols:
                    val = str(r.get(key, ""))
                    if key in ["ticket_id", "priority", "dept_match", "escalation_level"]:
                        row_cells.append(Paragraph(val, td_bold))
                    elif key in ["title", "description"]:
                        snippet = (val[:80] + "...") if len(val) > 80 else val
                        row_cells.append(Paragraph(snippet, td_style))
                    elif key == "created_at":
                        row_cells.append(Paragraph(val[:10], td_style))
                    else:
                        row_cells.append(Paragraph(val, td_style))
                table_data.append(row_cells)

            t_table = Table(table_data, colWidths=col_widths, repeatRows=1)
            t_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#151922')),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('TOPPADDING', (0, 0), (-1, -1), 4),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
                ('LEFTPADDING', (0, 0), (-1, -1), 4),
                ('RIGHTPADDING', (0, 0), (-1, -1), 4),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.HexColor('#FFFFFF'), colors.HexColor('#F8FAFC')]),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
            ]))
            elements.append(t_table)

            if len(rows) > 300:
                elements.append(Spacer(1, 8))
                elements.append(Paragraph(
                    f"<i>Note: PDF Executive Digest displays top 300 of {len(rows)} matching complaints. For complete dataset with all columns, please export as Excel (XLSX) or CSV.</i>",
                    meta_style
                ))

            doc.build(elements)
            bio.seek(0)
            return StreamingResponse(
                bio,
                media_type="application/pdf",
                headers={"Content-Disposition": f"attachment; filename={file_prefix}-{timestamp_suffix}.pdf"}
            )
        except ImportError:
            raise HTTPException(status_code=500, detail="ReportLab library is required for PDF export.")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"PDF generation error: {str(e)}")

    else:
        raise HTTPException(status_code=400, detail="Invalid format. Supported formats: csv, xlsx, pdf.")




