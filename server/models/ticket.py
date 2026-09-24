from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum

class PriorityLevel(str, Enum):
    P0 = "P0"
    P1 = "P1"
    P2 = "P2"
    P3 = "P3"

class TicketStatus(str, Enum):
    IN_TRIAGE = "In Triage"
    AI_REVIEW = "AI Review"
    ESCALATED = "Escalated"
    RESOLVED = "Resolved"
    CLOSED = "Closed"

class GenAIStructuredOutput(BaseModel):
    complaint_id: str
    issue_category: str
    subcategory: Optional[str] = None
    sentiment: str
    urgency: str
    priority: PriorityLevel
    department: str
    policy_id: Optional[str] = None
    policy_section: Optional[str] = None
    resolution_steps: List[str] = []
    escalation_required: bool = False
    response_type: Optional[str] = None
    follow_up_required: bool = False
    draft_response: str

class PythonRuleOutput(BaseModel):
    matched_rule_id: str
    category_verified: bool
    escalation_required: bool
    refund_eligible: bool
    mandatory_actions: List[str] = []
    prohibited_actions: List[str] = []
    policy_reference: str
    confidence_score: float = 100.0

class TicketBase(BaseModel):
    ticket_id: str = Field(..., description="Unique ticket ID e.g. CMP-00421")
    title: str
    description: str
    customer_id: str
    customer_type: Optional[str] = "Regular Customer"
    order_id: Optional[str] = None
    channel: Optional[str] = "Online Store"
    category: str
    sub_category: Optional[str] = None
    department: Optional[str] = "Logistics"
    department_id: Optional[str] = None
    priority: PriorityLevel = PriorityLevel.P2
    status: TicketStatus = TicketStatus.IN_TRIAGE
    assigned_agent_id: Optional[str] = None
    assigned_agent: Optional[str] = None
    assigned_agent_email: Optional[str] = None
    assigned_agent_history: List[Dict[str, Any]] = []
    assignedAgentId: Optional[str] = None
    assignedAgentHistory: Optional[List[Dict[str, Any]]] = None
    revoked_agent_ids: List[str] = []
    revoked_agents: List[Dict[str, Any]] = []
    sla_hours_remaining: Optional[float] = 24.0
    sla_risk_percentage: float = 0.0
    
    # Dual Pipeline Data
    genai_output: Optional[GenAIStructuredOutput] = None
    python_rule_output: Optional[PythonRuleOutput] = None
    match_status: bool = True  # True = Verified Match, False = Mismatch Detected
    
    attachments: List[str] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class TicketCreate(BaseModel):
    title: str
    description: str
    customer_id: str
    category: str
    order_id: Optional[str] = None
    channel: Optional[str] = "Online Store"
    customer_type: Optional[str] = "Regular Customer"
    attachments: List[str] = []

class TicketResponse(TicketBase):
    id: Optional[str] = Field(None, alias="_id")
