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
    category: str  # Delivery, Refund, Replacement, Warranty, SOP
    file_type: str  # PDF, DOCX
    file_size_kb: float
    file_path: Optional[str] = None
    version: str = "v1.0"
    status: DocStatus = DocStatus.ACTIVE
    chunk_count: int = 0
    chunks: List[DocChunk] = []
    effective_date: Optional[datetime] = Field(default_factory=datetime.utcnow)
    uploaded_at: datetime = Field(default_factory=datetime.utcnow)

class KBDocCreate(BaseModel):
    title: str
    category: str
    file_type: str
    version: Optional[str] = "v1.0"

class KBDocResponse(KBDocBase):
    id: Optional[str] = Field(None, alias="_id")
