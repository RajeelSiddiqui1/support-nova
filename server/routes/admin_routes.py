from fastapi import APIRouter, HTTPException, status
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
    role: str  # AGENT, REVIEWER, MANAGER
    department: str

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

@router.post("/create-staff")
async def create_staff(req: CreateStaffRequest):
    """Admin creates a staff member (Manager, Reviewer, Agent) with temporary password & emails credentials."""
    db = get_database()
    existing = await db.users.find_one({"email": req.email.lower()})

    if existing:
        raise HTTPException(status_code=400, detail="User with this email already exists.")

    temp_pwd = generate_temp_password()
    hashed_pwd = hash_password(temp_pwd)
    user_id = f"STF-{int(datetime.utcnow().timestamp())}"

    new_staff = {
        "user_id": user_id,
        "name": req.name,
        "email": req.email.lower(),
        "role": req.role.upper(),
        "department": req.department,
        "hashed_password": hashed_pwd,
        "status": "MUST_CHANGE_PASSWORD",
        "is_temp_password": True,
        "created_at": datetime.utcnow()
    }

    await db.users.insert_one(new_staff)

    # Email staff credentials with temporary password
    EmailService.send_staff_credentials(req.email.lower(), req.name, req.role, temp_pwd)

    return {
        "status": "success",
        "message": f"Staff member {req.name} created. Temporary password sent to email.",
        "user_id": user_id,
        "temp_password": temp_pwd
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
