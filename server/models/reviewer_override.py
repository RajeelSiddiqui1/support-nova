from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class ReviewerOverrideBase(BaseModel):
    override_id: str
    ticket_id: str
    reviewer_id: str
    reviewer_name: str
    conflict_type: str  # GenAI vs Python Disagreement, Security Injection, Hallucination
    genai_decision: str
    python_decision: str
    final_override_action: str  # Approve GenAI, Enforce Rule, Custom Resolution
    mandatory_reason: str = Field(..., min_length=10, description="Mandatory audit trail justification")
    created_at: datetime = Field(default_factory=datetime.utcnow)

class ReviewerOverrideCreate(ReviewerOverrideBase):
    pass
