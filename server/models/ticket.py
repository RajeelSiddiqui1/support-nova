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

# Feature 4: Secondary Issue Item
class SecondaryIssueItem(BaseModel):
    category: str
    department: str
    description: str

# Feature 1: Follow-Up Item & Schemas
class FollowUpItem(BaseModel):
    follow_up_id: str
    type: str  # info-request, resolution-confirmation, refund-status, replacement-status, escalation-ack, closure-confirmation
    message: str
    scheduled_at: datetime
    sent_at: Optional[datetime] = None
    status: str = "pending"  # pending, sent, cancelled

class GenerateFollowUpRequest(BaseModel):
    type: str
    custom_delay_hours: Optional[int] = 24

class FollowUpListResponse(BaseModel):
    ticket_id: str
    follow_ups: List[FollowUpItem] = []

# Feature 2: Clarification Schemas
class ClarificationReplyRequest(BaseModel):
    reply: str

class ClarificationReplyResponse(BaseModel):
    status: str
    updated_description: str
    clarification_status: str

# Feature 3: Complaint Summary Schema
class StructuredComplaintSummary(BaseModel):
    issue: str
    category: str
    sentiment: str
    urgency: str
    key_facts: List[str] = []
    one_line_summary: str

# Feature 5: Escalation Notes Schemas
class StructuredEscalationNotes(BaseModel):
    complaint_summary: str
    key_facts: List[str] = []
    escalation_reason: str
    actions_taken: List[str] = []
    relevant_policy_id: Optional[str] = None
    required_next_action: str

class EscalationRequest(BaseModel):
    escalation_reason: str
    actions_taken: List[str] = []

# Feature 9: Hallucination Check Schema
class HallucinationCheckResult(BaseModel):
    has_hallucination: bool
    hallucination_flags: List[str] = []

# Feature 11: Verification Score Breakdown
class VerificationScoreBreakdown(BaseModel):
    category_match: float = 0.0
    department_match: float = 0.0
    urgency_match: float = 0.0
    escalation_match: float = 0.0
    policy_citation_match: float = 0.0
    total_score: float = 100.0

# Extended Pipeline Outputs
class GenAIStructuredOutput(BaseModel):
    complaint_id: str
    issue_category: str
    subcategory: Optional[str] = None
    sentiment: str
    urgency: str
    priority: PriorityLevel
    department: str
    primary_department: Optional[str] = None
    supporting_departments: List[str] = []
    primary_issue: Optional[Dict[str, str]] = None
    secondary_issues: List[SecondaryIssueItem] = []
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
    verified_primary_department: Optional[str] = None
    verified_secondary_departments: List[str] = []
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
    
    # Feature 1: Follow-Ups
    follow_ups: List[FollowUpItem] = []

    # Feature 2: Missing Information & Clarifications
    missing_fields: List[str] = []
    clarification_questions: List[str] = []
    clarification_status: str = "none"  # "none" | "pending" | "answered"

    # Feature 3: Complaint Summary
    complaint_summary: Optional[StructuredComplaintSummary] = None

    # Feature 4 & 10: Multi-Issue & Multi-Department
    primary_issue: Optional[Dict[str, str]] = None
    secondary_issues: List[SecondaryIssueItem] = []
    primary_department: Optional[str] = None
    supporting_departments: List[str] = []

    # Feature 5: Escalation Notes
    escalation_notes: Optional[StructuredEscalationNotes] = None

    # Feature 8: Repeat Complaint Detection
    is_repeat: bool = False
    related_ticket_ids: List[str] = []
    repeat_similarity_score: float = 0.0

    # Feature 9: Explicit Hallucination Flags
    has_hallucination: bool = False
    hallucination_flags: List[str] = []

    # Feature 11: Verification Score (0-100)
    verification_score: float = 100.0

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
