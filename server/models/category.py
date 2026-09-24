from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class CategoryBase(BaseModel):
    name: str
    code: str  # e.g., "DEL", "REF", "REP", "WAR", "BIL", "QUAL"
    description: Optional[str] = None
    status: str = "ACTIVE"

class CategoryCreate(BaseModel):
    name: str
    code: str
    description: Optional[str] = None
    status: str = "ACTIVE"

class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None

class CategoryResponse(CategoryBase):
    id: Optional[str] = Field(None, alias="_id")
    cat_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None
    policy_count: Optional[int] = 0
