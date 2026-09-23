from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class RuleMatrixBase(BaseModel):
    rule_id: str = Field(..., description="Unique Rule ID e.g. DEL-POL-04")
    category: str
    condition: str
    department: str
    mandatory_actions: List[str] = []
    prohibited_actions: List[str] = []
    max_discount_percentage: float = 0.0
    refund_eligible: bool = False
    escalation_required: bool = False
    policy_reference: str
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)

class RuleMatrixCreate(RuleMatrixBase):
    pass

class RuleMatrixResponse(RuleMatrixBase):
    id: Optional[str] = Field(None, alias="_id")
