from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, Union
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
    AWAITING_CUSTOMER = "Awaiting Customer"

class EscalationLevelEnum(str, Enum):
    NONE = "NONE"
    SUPERVISOR_REVIEW = "SUPERVISOR_REVIEW"
    DEPARTMENT_MANAGER = "DEPARTMENT_MANAGER"
    SPECIALIST_TEAM = "SPECIALIST_TEAM"
    COMPLIANCE_REVIEW = "COMPLIANCE_REVIEW"
    CRITICAL_MANAGEMENT = "CRITICAL_MANAGEMENT"

class SLARiskEnum(str, Enum):
    NONE = "none"
    APPROACHING = "approaching"
    BREACHED = "breached"

# ── F1: Analysis Meta ──
class AnalysisMeta(BaseModel):
    prompt_versions: Dict[str, str] = Field(default_factory=dict)
    genai_provider: str = "groq"
    model: str = "llama-3.3-70b-versatile"
    analyzed_at: datetime = Field(default_factory=datetime.utcnow)
    policy_versions_used: List[str] = Field(default_factory=list)

# ── F2: Issue & Entity Models ──
class IssueItem(BaseModel):
    category: str
    subcategory: Optional[str] = None
    summary: str = ""
    suggested_department: Optional[str] = None

class SecondaryIssueItem(BaseModel):
    category: str
    department: Optional[str] = None
    description: Optional[str] = None
    subcategory: Optional[str] = None
    summary: Optional[str] = None
    suggested_department: Optional[str] = None

class ExtractedEntities(BaseModel):
    order_id: Optional[str] = None
    transaction_id: Optional[str] = None
    product: Optional[str] = None
    service: Optional[str] = None
    amount: Optional[float] = None
    currency: Optional[str] = "USD"
    date: Optional[str] = None
    location: Optional[str] = None
    department: Optional[str] = None
    complaint_reference: Optional[str] = None

# ── F1 & F11: Follow-Up Item & Schemas ──
class FollowUpItem(BaseModel):
    id: Optional[str] = None
    follow_up_id: Optional[str] = None
    type: str  # info-request, resolution-confirmation, refund-status, replacement-status, escalation-ack, closure-confirmation
    message: str
    scheduled_at: datetime
    sent_at: Optional[datetime] = None
    status: str = "SCHEDULED"  # SCHEDULED, SENT, CANCELLED, FAILED, pending
    approved_by: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class FollowUpSuggestion(BaseModel):
    required: bool = False
    type: Optional[str] = None
    suggested_message: Optional[str] = None
    suggested_delay_hours: int = 24

class GenerateFollowUpRequest(BaseModel):
    type: str
    custom_delay_hours: Optional[int] = 24
    custom_message: Optional[str] = None

class FollowUpUpdateRequest(BaseModel):
    message: Optional[str] = None
    status: Optional[str] = None
    scheduled_at: Optional[datetime] = None

class FollowUpListResponse(BaseModel):
    ticket_id: str
    follow_ups: List[FollowUpItem] = []

# ── F2 & F3: Clarification Schemas ──
class ClarificationAnswerItem(BaseModel):
    field: str
    value: str

class ClarificationReplyRequest(BaseModel):
    reply: Optional[str] = None
    answers: Optional[List[ClarificationAnswerItem]] = None

class ClarificationReplyResponse(BaseModel):
    status: str
    updated_description: Optional[str] = None
    clarification_status: str

# ── F2 & F3: Complaint Summary Schema ──
class StructuredComplaintSummary(BaseModel):
    one_line: Optional[str] = None
    one_line_summary: Optional[str] = None
    issue: Optional[str] = None
    category: Optional[str] = None
    sentiment: Optional[str] = None
    urgency: Optional[str] = None
    key_facts: List[str] = []
    customer_requested_resolution: Optional[str] = None

# ── F2 & F7: Escalation Notes Schemas ──
class StructuredEscalationNotes(BaseModel):
    complaint_summary: str = ""
    key_facts: List[str] = []
    escalation_reason: str = ""
    actions_taken: List[str] = []
    relevant_policy_id: Optional[str] = None
    required_next_action: str = ""

class EscalationRequest(BaseModel):
    escalation_reason: str
    actions_taken: List[str] = []
    escalation_level: Optional[str] = "DEPARTMENT_MANAGER"

# ── F5: Adversarial Flags Schema ──
class AdversarialFlagItem(BaseModel):
    type: Optional[str] = "KEYWORD_MATCH"
    pattern_id: Optional[str] = None
    matched_text: str
    severity: str = "CRITICAL"
    detected_at: datetime = Field(default_factory=datetime.utcnow)

# ── F8: Hallucination Check Schema ──
class HallucinationFlagItem(BaseModel):
    type: str  # FABRICATED_POLICY | UNSUPPORTED_PROMISE | UNTRACEABLE_FACT | PROHIBITED_ACTION
    claim: str
    reason: str
    severity: str = "HIGH"

class HallucinationCheckResult(BaseModel):
    has_hallucination: bool = False
    hallucination_flags: List[Union[str, HallucinationFlagItem]] = []
    unsupported_promises: List[str] = []

# ── F9: Verification Score Breakdown ──
class VerificationComponentScore(BaseModel):
    matched: bool = True
    weight: float = 0.0
    earned: float = 0.0

class VerificationScoreBreakdown(BaseModel):
    category_match: float = 0.0
    department_match: float = 0.0
    urgency_match: float = 0.0
    escalation_match: float = 0.0
    policy_citation_match: float = 0.0
    total_score: float = 100.0
    category: Optional[VerificationComponentScore] = None
    department: Optional[VerificationComponentScore] = None
    urgency_priority: Optional[VerificationComponentScore] = None
    escalation: Optional[VerificationComponentScore] = None
    policy_citation: Optional[VerificationComponentScore] = None
    hallucination_absence: Optional[VerificationComponentScore] = None

# ── F2: Extended Pipeline 1 Output Schema ──
class GenAIStructuredOutput(BaseModel):
    complaint_id: str
    issue_category: str
    subcategory: Optional[str] = None
    sentiment: str = "Neutral"
    urgency: str = "Medium"
    priority: PriorityLevel = PriorityLevel.P2
    department: str = "Logistics"
    primary_department: Optional[str] = None
    supporting_departments: List[str] = []
    primary_issue: Optional[Union[Dict[str, Any], IssueItem]] = None
    secondary_issues: List[Union[Dict[str, Any], SecondaryIssueItem, IssueItem]] = []
    entities: Optional[ExtractedEntities] = None
    emotion_indicators: List[str] = []
    complaint_summary: Optional[Union[Dict[str, Any], StructuredComplaintSummary]] = None
    agent_guidance: List[str] = []
    escalation_notes: Optional[Union[Dict[str, Any], StructuredEscalationNotes]] = None
    follow_up: Optional[FollowUpSuggestion] = None
    clarification_questions: List[str] = []
    injection_suspected: bool = False
    injection_evidence: Optional[str] = None
    policy_id: Optional[str] = None
    policy_section: Optional[str] = None
    resolution_steps: List[str] = []
    escalation_required: bool = False
    response_type: Optional[str] = None
    follow_up_required: bool = False
    draft_response: str = ""

# ── Pipeline 2 Deterministic Rule Output ──
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

# ── Unified Core Ticket Base Model ──
class TicketBase(BaseModel):
    ticket_id: str = Field(..., description="Unique ticket ID e.g. CMP-00421")
    title: str
    description: str
    customer_id: str
    customer_name: Optional[str] = None
    customer_email: Optional[str] = None
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
    department_mismatch: bool = False
    mismatch_type: Optional[str] = None
    
    # F1: Analysis Meta
    analysis_meta: Optional[AnalysisMeta] = None

    # F1 & F11: Follow-Ups
    follow_ups: List[FollowUpItem] = []

    # F2 & F3: Missing Information & Clarifications
    missing_fields: List[str] = []
    clarification_questions: List[str] = []
    clarification_status: str = "none"  # "none" | "pending" | "answered"
    clarification_history: List[Dict[str, Any]] = []

    # F2 & F3: Complaint Summary
    complaint_summary: Optional[Union[Dict[str, Any], StructuredComplaintSummary]] = None

    # F2, F4 & F6: Multi-Issue, Routing & Deduplication
    primary_issue: Optional[Union[Dict[str, Any], IssueItem]] = None
    secondary_issues: List[Union[Dict[str, Any], SecondaryIssueItem, IssueItem]] = []
    primary_department: Optional[str] = None
    supporting_departments: List[str] = []
    secondary_issue_departments: List[str] = []
    routing_match: Optional[str] = "full"
    
    # F4: Validation & Deduplication
    content_hash: Optional[str] = None
    duplicate_of: Optional[str] = None
    duplicate_score: Optional[float] = None
    is_duplicate: bool = False

    # F5: Adversarial Hardening
    adversarial_flags: List[Union[Dict[str, Any], AdversarialFlagItem]] = []

    # F7: Escalation Rule Details
    escalation_required: bool = False
    escalation_level: Optional[str] = "NONE"
    escalation_source: Optional[str] = "SYSTEM_DEFAULT"
    escalation_rules_triggered: List[str] = []
    escalation_notes: Optional[Union[Dict[str, Any], StructuredEscalationNotes]] = None

    # F8: Explicit Hallucination Flags
    has_hallucination: bool = False
    hallucination_flags: List[Union[str, Dict[str, Any], HallucinationFlagItem]] = []
    unsupported_promises: List[str] = []

    # F9: Verification Score (0-100) & Breakdown
    verification_score: float = 100.0
    verification_breakdown: Optional[Union[Dict[str, Any], VerificationScoreBreakdown]] = None

    # F12: Repeat Complaint Detection
    is_repeat: bool = False
    related_ticket_ids: List[str] = []
    repeat_count: int = 0
    repeat_similarity_score: float = 0.0

    # F13: SLA Risk Status
    sla_risk: str = "none"  # none | approaching | breached
    sla_response_target_at: Optional[datetime] = None
    sla_resolution_target_at: Optional[datetime] = None

    attachments: List[str] = []
    agent_notes: Optional[str] = ""
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
