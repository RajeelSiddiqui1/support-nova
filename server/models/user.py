from pydantic import BaseModel, Field, EmailStr
from typing import Optional
from datetime import datetime
from enum import Enum

class UserRole(str, Enum):
    CUSTOMER = "CUSTOMER"
    AGENT = "AGENT"
    REVIEWER = "REVIEWER"
    MANAGER = "MANAGER"
    ADMIN = "ADMIN"

class UserStatus(str, Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    MUST_CHANGE_PASSWORD = "MUST_CHANGE_PASSWORD"

class UserBase(BaseModel):
    user_id: str
    email: EmailStr
    name: str
    role: UserRole = UserRole.CUSTOMER
    department: Optional[str] = "Customer Support"
    status: UserStatus = UserStatus.ACTIVE
    deactivation_reason: Optional[str] = None
    is_temp_password: bool = False
    google_id: Optional[str] = None
    otp_code: Optional[str] = None
    otp_expires_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class UserCreate(BaseModel):
    email: EmailStr
    name: str
    role: UserRole
    department: Optional[str] = "Customer Support"

class UserInDB(UserBase):
    hashed_password: Optional[str] = None

class UserResponse(UserBase):
    id: Optional[str] = Field(None, alias="_id")
