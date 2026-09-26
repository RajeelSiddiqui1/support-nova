from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum

class MismatchTypeEnum(str, Enum):
    PIPELINE_CONFLICT = "PIPELINE_CONFLICT"
    POLICY_EXCEPTION = "POLICY_EXCEPTION"
    HIGH_SENTIMENT_RISK = "HIGH_SENTIMENT_RISK"
    PROMPT_INJECTION = "PROMPT_INJECTION"
    UNAUTHORIZED_FEE_WAIVER = "UNAUTHORIZED_FEE_WAIVER"
    AMBIGUOUS_POLICY = "AMBIGUOUS_POLICY"

class ReviewerActionEnum(str, Enum):
    APPROVE = "APPROVE"
    MODIFY = "MODIFY"
    RECLASSIFY = "RECLASSIFY"
    REGENERATE = "REGENERATE"
    ESCALATE_TO_MANAGER = "ESCALATE_TO_MANAGER"
    ADD_INTERNAL_NOTE = "ADD_INTERNAL_NOTE"

class PipelineVerdictEnum(str, Enum):
    APPROVE = "APPROVE"
    BLOCK = "BLOCK"
    ESCALATE = "ESCALATE"

# --- SIDE-BY-SIDE COMPARISON SCHEMAS ---

class CustomerInputPayload(BaseModel):
    raw_message: str = Field(..., description="Raw incoming customer complaint text from Email, Chat, or Web Form")
    channel: str = Field("Web Form", description="Originating channel: Email, Chat, or Web Form")
    customer_name: Optional[str] = "Customer"
    customer_email: Optional[str] = None
    customer_type: Optional[str] = "Regular Customer"
    extracted_entities: Dict[str, Any] = Field(
        default_factory=dict,
        description="Extracted entities such as order_id, delivery_date, product_name, amount_requested"
    )

class Pipeline1GenAIPayload(BaseModel):
    primary_issue: str = Field(..., description="GenAI detected primary complaint issue")
    secondary_issue: Optional[str] = Field(None, description="Optional secondary issue")
    sentiment: str = Field(..., description="Detected customer sentiment (e.g., Neutral, Furious)")
    urgency: str = Field(..., description="Urgency assessment (Critical, High, Medium, Low)")
    priority: str = Field("P2", description="Priority level P0-P3")
    category: str = Field(..., description="Classified category")
    subcategory: Optional[str] = None
    department: str = Field(..., description="Target department for assignment")
    policy_mapping: Dict[str, Any] = Field(default_factory=dict, description="Mapped policy ID and section citations")
    drafted_response: str = Field(..., description="GenAI drafted customer reply")
    resolution_steps: List[str] = Field(default_factory=list, description="Prescribed action steps")
    escalation_required: bool = False

class Pipeline2PythonRulePayload(BaseModel):
    evaluated_rule_id: str = Field(..., description="Matched ground-truth business rule ID")
    pipeline_verdict: PipelineVerdictEnum = Field(..., description="Deterministic verdict: APPROVE, BLOCK, or ESCALATE")
    policy_exception_details: Optional[str] = Field(None, description="Details on unauthorized waiver or refund exception")
    conflict_reasons: List[str] = Field(default_factory=list, description="Deterministic reasons for mismatch with GenAI")
    mandatory_actions: List[str] = Field(default_factory=list, description="Mandatory actions enforced by business policy")
    prohibited_actions: List[str] = Field(default_factory=list, description="Actions strictly prohibited by policy")
    refund_eligible: bool = Field(False, description="Deterministic refund eligibility determination")
    confidence_score: float = Field(100.0, description="Rule confidence score")

class ReviewerComparisonPayload(BaseModel):
    ticket_id: str
    status: str
    mismatch_detected: bool
    mismatch_type: Optional[str] = None
    mismatch_summary: Optional[str] = None
    customer_input: CustomerInputPayload
    pipeline1_genai: Pipeline1GenAIPayload
    pipeline2_python_rule: Pipeline2PythonRulePayload
    audit_history: List[Dict[str, Any]] = Field(default_factory=list)

# --- QUEUE LIST SCHEMAS ---

class ReviewerQueueItem(BaseModel):
    ticket_id: str
    title: str
    channel: str
    customer_name: Optional[str] = "Customer"
    customer_email: Optional[str] = None
    category: str
    department: Optional[str] = None
    urgency: str
    priority: str
    sentiment: str
    mismatch_type: str
    conflict_reason: str
    assigned_reviewer_id: Optional[str] = None
    assigned_reviewer_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

# --- REVIEWER ACTION & OVERRIDE REQUEST/RESPONSE ---

class ReviewerActionRequest(BaseModel):
    action: ReviewerActionEnum = Field(..., description="Reviewer action to execute")
    reviewer_id: str = Field(..., description="ID of the authenticated Reviewer")
    reviewer_name: Optional[str] = Field(None, description="Display name of the Reviewer")
    override_reason: str = Field(..., min_length=5, description="Mandatory audit trail justification for reviewer action")
    
    # Optional parameters depending on action:
    modified_draft_response: Optional[str] = Field(None, description="Required when action is MODIFY")
    modified_category: Optional[str] = Field(None, description="Used when action is MODIFY or RECLASSIFY")
    modified_subcategory: Optional[str] = Field(None, description="Used when action is MODIFY or RECLASSIFY")
    modified_department: Optional[str] = Field(None, description="Used when action is RECLASSIFY")
    regenerate_feedback: Optional[str] = Field(None, description="Reviewer feedback instructions when action is REGENERATE")
    internal_note: Optional[str] = Field(None, description="Internal audit comment when action is ADD_INTERNAL_NOTE")
    escalate_to_manager_id: Optional[str] = Field(None, description="Department Manager ID when action is ESCALATE_TO_MANAGER")

class ReviewerActionResponse(BaseModel):
    success: bool
    message: str
    ticket_id: str
    action_executed: str
    new_status: str
    audit_log_id: Optional[Any] = None
    updated_ticket: Optional[Dict[str, Any]] = None

class AuditReviewerLogResponse(BaseModel):
    id: Any
    ticket_id: str
    reviewer_id: str
    reviewer_name: Optional[str] = None
    action: str
    original_ai_output: Any
    reviewer_modified_output: Any
    override_reason: str
    conflict_type: Optional[str] = None
    timestamp: datetime
