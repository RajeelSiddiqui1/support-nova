from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, Union
from datetime import datetime
from enum import Enum

class DocStatus(str, Enum):
    ACTIVE = "Active"
    ACTIVE_UPPER = "ACTIVE"
    PREVIOUS = "PREVIOUS"
    SUPERSEDED = "SUPERSEDED"
    DRAFT = "DRAFT"
    EXPIRED = "EXPIRED"
    ARCHIVED = "Archived"

class DocType(str, Enum):
    POLICY = "POLICY"
    SOP = "SOP"
    FAQ = "FAQ"
    TEMPLATE = "TEMPLATE"

class PolicyApplicabilityEnum(str, Enum):
    APPLICABLE = "APPLICABLE"
    CONDITIONALLY_APPLICABLE = "CONDITIONALLY_APPLICABLE"
    NOT_APPLICABLE = "NOT_APPLICABLE"
    OUTDATED = "OUTDATED"

class DocChunk(BaseModel):
    chunk_id: str
    doc_id: str
    section_id: Optional[str] = None
    title: Optional[str] = None
    section: Optional[str] = "General"
    heading: Optional[str] = None
    page_number: Optional[int] = 1
    content: str
    version: str = "v1.0"
    category: Optional[str] = None
    effective_date: Optional[datetime] = None
    expiry_date: Optional[datetime] = None
    status: str = "ACTIVE"

class KBDocBase(BaseModel):
    doc_id: str = Field(..., description="Unique Document ID e.g. KB-001 or DEL-POL-04")
    title: str
    category_id: Optional[str] = Field(None, description="Foreign Key reference to Category")
    category: str = "General"
    department_id: Optional[str] = Field(None, description="Foreign Key reference to Department")
    department: Optional[str] = Field("General", description="Department Name")
    file_type: str  # PDF, DOCX, TXT, MD
    file_size_kb: float = 0.0
    file_path: Optional[str] = None
    sha256_hash: Optional[str] = None
    full_text: Optional[str] = ""
    version: str = "v1.0"
    status: str = "ACTIVE"
    doc_type: str = "POLICY"  # POLICY > SOP > FAQ > TEMPLATE
    precedence_level: int = 1  # 1=POLICY, 2=SOP, 3=FAQ, 4=TEMPLATE
    chunk_count: int = 0
    chunks: List[DocChunk] = []
    effective_date: Optional[datetime] = Field(default_factory=datetime.utcnow)
    expiry_date: Optional[datetime] = None
    superseded_by: Optional[str] = None
    supersedes: Optional[str] = None
    adversarial_flags: List[Dict[str, Any]] = []
    uploaded_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None

class KBDocCreate(BaseModel):
    doc_id: Optional[str] = None
    title: str
    category_id: Optional[str] = None
    category: Optional[str] = "General"
    department_id: Optional[str] = None
    department: Optional[str] = "General"
    file_type: Optional[str] = "TXT"
    full_text: Optional[str] = ""
    version: Optional[str] = "v1.0"
    doc_type: Optional[str] = "POLICY"
    status: Optional[str] = "ACTIVE"
    effective_date: Optional[datetime] = None
    expiry_date: Optional[datetime] = None

class KBDocUpdate(BaseModel):
    title: Optional[str] = None
    category_id: Optional[str] = None
    category: Optional[str] = None
    department_id: Optional[str] = None
    department: Optional[str] = None
    full_text: Optional[str] = None
    version: Optional[str] = None
    status: Optional[str] = None
    doc_type: Optional[str] = None
    effective_date: Optional[datetime] = None
    expiry_date: Optional[datetime] = None

class KBDocResponse(KBDocBase):
    id: Optional[str] = Field(None, alias="_id")

class PolicyImpactCheckResponse(BaseModel):
    document_id: str
    new_version: str
    affected_open_tickets: List[str] = []
    affected_count: int = 0
    message: str
