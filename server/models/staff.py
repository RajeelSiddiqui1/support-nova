from pydantic import BaseModel, Field, EmailStr
from typing import Optional
from datetime import datetime
from enum import Enum

class StaffRole(str, Enum):
    AGENT = "Agent"
    REVIEWER = "Reviewer"
    MANAGER = "Manager"
    ADMIN = "Admin"

class StaffBase(BaseModel):
    staff_id: str = Field(..., description="Unique staff identifier e.g. STF-001")
    name: str
    email: EmailStr
    role: StaffRole = StaffRole.AGENT
    department: str = "Logistics"
    status: str = "Active"
    created_at: datetime = Field(default_factory=datetime.utcnow)

class StaffCreate(StaffBase):
    pass

class StaffResponse(StaffBase):
    id: Optional[str] = Field(None, alias="_id")
