from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class DepartmentBase(BaseModel):
    name: str
    code: str
    description: Optional[str] = None
    status: str = "ACTIVE"

class DepartmentCreate(BaseModel):
    name: str
    code: str
    description: Optional[str] = None
    status: str = "ACTIVE"

class DepartmentUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None

class DepartmentResponse(DepartmentBase):
    id: Optional[str] = Field(None, alias="_id")
    dept_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None
    member_count: Optional[int] = 0
