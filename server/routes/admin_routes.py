from fastapi import APIRouter, HTTPException, status, Query
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime

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
    if role_upper in ["AGENT", "REVIEWER"]:
        if not req.reporting_manager_id or not req.reporting_manager_id.strip():
            raise HTTPException(
                status_code=400,
                detail=f"Reporting Manager is required for {role_upper.capitalize()} role."
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
    if new_role in ["AGENT", "REVIEWER"]:
        mgr_id = req.reporting_manager_id or user.get("reporting_manager_id")
        if not mgr_id or not str(mgr_id).strip():
            raise HTTPException(
                status_code=400,
                detail=f"Reporting Manager is required for {new_role.capitalize()} role."
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
