from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum

class CustomerType(str, Enum):
    REGULAR = "Regular Customer"
    PREMIUM = "Premium Member"
    BUSINESS = "Business Account"
    FIRST_TIME = "First-Time Buyer"

class CustomerBase(BaseModel):
    customer_id: str = Field(..., description="Unique customer identifier e.g. USR-001")
    name: str
    email: EmailStr
    phone: Optional[str] = None
    customer_type: CustomerType = CustomerType.REGULAR
    city: Optional[str] = "Karachi"
    total_spend: float = 0.0
    status: str = "Active"
    created_at: datetime = Field(default_factory=datetime.utcnow)

class CustomerCreate(CustomerBase):
    pass

class CustomerResponse(CustomerBase):
    id: Optional[str] = Field(None, alias="_id")
