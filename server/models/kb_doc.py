from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum

class DocStatus(str, Enum):
    ACTIVE = "Active"
    SUPERSEDED = "Superseded"
    DRAFT = "Draft"
    ARCHIVED = "Archived"

class DocChunk(BaseModel):
    chunk_id: str
    doc_id: str
    section: Optional[str] = "General"
    heading: Optional[str] = None
    page_number: Optional[int] = 1
    content: str
    version: str = "v1.0"

class KBDocBase(BaseModel):
    doc_id: str = Field(..., description="Unique Document ID e.g. KB-001")
    title: str
    category_id: Optional[str] = Field(None, description="Foreign Key reference to Category")
    category: str = "General"  # Delivery, Refund, Replacement, Warranty, SOP, General
    department_id: Optional[str] = Field(None, description="Foreign Key reference to Department")
    department: Optional[str] = Field("General", description="Department Name")
    file_type: str  # PDF, DOCX, TXT
    file_size_kb: float = 0.0
    file_path: Optional[str] = None
    full_text: Optional[str] = ""
    version: str = "v1.0"
    status: DocStatus = DocStatus.ACTIVE
    chunk_count: int = 0
    chunks: List[DocChunk] = []
    effective_date: Optional[datetime] = Field(default_factory=datetime.utcnow)
    uploaded_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None

class KBDocCreate(BaseModel):
    title: str
    category_id: Optional[str] = None
    category: Optional[str] = "General"
    department_id: Optional[str] = None
    department: Optional[str] = "General"
    file_type: Optional[str] = "TXT"
    full_text: Optional[str] = ""
    version: Optional[str] = "v1.0"
    status: Optional[DocStatus] = DocStatus.ACTIVE

class KBDocUpdate(BaseModel):
    title: Optional[str] = None
    category_id: Optional[str] = None
    category: Optional[str] = None
    department_id: Optional[str] = None
    department: Optional[str] = None
    full_text: Optional[str] = None
    version: Optional[str] = None
    status: Optional[DocStatus] = None

class KBDocResponse(KBDocBase):
    id: Optional[str] = Field(None, alias="_id")
