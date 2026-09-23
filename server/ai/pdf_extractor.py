import os
from typing import List, Dict, Any
from pypdf import PdfReader
import docx

class DocumentExtractor:
    """Extracts text and metadata from PDF & DOCX documents based on SRS Step 5 & 6 specs."""

    @staticmethod
    def extract_from_pdf(file_path: str, doc_id: str, version: str = "v1.0") -> Dict[str, Any]:
        """Extracts text, headings, page numbers and creates chunks from PDF files."""
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")

        reader = PdfReader(file_path)
        full_text = ""
        chunks = []
        chunk_idx = 1

        for page_num, page in enumerate(reader.pages, start=1):
            text = page.extract_text() or ""
            full_text += f"\n--- Page {page_num} ---\n" + text

            # Simple section/heading chunking logic
            lines = [line.strip() for line in text.split("\n") if line.strip()]
            current_heading = f"Page {page_num} Content"
            current_chunk = []

            for line in lines:
                # Detect heading-like lines (short, capitalized or numbered)
                if len(line) < 60 and (line.isupper() or line.startswith("Step") or line.startswith("Section") or line.startswith("Pipeline")):
                    if current_chunk:
                        chunk_text = " ".join(current_chunk)
                        chunks.append({
                            "chunk_id": f"{doc_id}-CHK-{chunk_idx:03d}",
                            "doc_id": doc_id,
                            "section": current_heading,
                            "heading": current_heading,
                            "page_number": page_num,
                            "content": chunk_text,
                            "version": version
                        })
                        chunk_idx += 1
                        current_chunk = []
                    current_heading = line
                else:
                    current_chunk.append(line)

            if current_chunk:
                chunk_text = " ".join(current_chunk)
                chunks.append({
                    "chunk_id": f"{doc_id}-CHK-{chunk_idx:03d}",
                    "doc_id": doc_id,
                    "section": current_heading,
                    "heading": current_heading,
                    "page_number": page_num,
                    "content": chunk_text,
                    "version": version
                })
                chunk_idx += 1

        return {
            "doc_id": doc_id,
            "title": os.path.basename(file_path),
            "file_type": "PDF",
            "file_size_kb": round(os.path.getsize(file_path) / 1024, 2),
            "total_pages": len(reader.pages),
            "version": version,
            "full_text": full_text.strip(),
            "chunk_count": len(chunks),
            "chunks": chunks
        }

    @staticmethod
    def extract_from_docx(file_path: str, doc_id: str, version: str = "v1.0") -> Dict[str, Any]:
        """Extracts text, headings and section chunks from DOCX files."""
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")

        doc = docx.Document(file_path)
        full_text = ""
        chunks = []
        chunk_idx = 1

        current_heading = "General Policy"
        current_chunk = []

        for para in doc.paragraphs:
            text = para.text.strip()
            if not text:
                continue
            full_text += text + "\n"

            # Heading styles check
            if para.style.name.startswith("Heading") or len(text) < 50:
                if current_chunk:
                    chunk_text = " ".join(current_chunk)
                    chunks.append({
                        "chunk_id": f"{doc_id}-CHK-{chunk_idx:03d}",
                        "doc_id": doc_id,
                        "section": current_heading,
                        "heading": current_heading,
                        "page_number": 1,
                        "content": chunk_text,
                        "version": version
                    })
                    chunk_idx += 1
                    current_chunk = []
                current_heading = text
            else:
                current_chunk.append(text)

        if current_chunk:
            chunk_text = " ".join(current_chunk)
            chunks.append({
                "chunk_id": f"{doc_id}-CHK-{chunk_idx:03d}",
                "doc_id": doc_id,
                "section": current_heading,
                "heading": current_heading,
                "page_number": 1,
                "content": chunk_text,
                "version": version
            })

        return {
            "doc_id": doc_id,
            "title": os.path.basename(file_path),
            "file_type": "DOCX",
            "file_size_kb": round(os.path.getsize(file_path) / 1024, 2),
            "version": version,
            "full_text": full_text.strip(),
            "chunk_count": len(chunks),
            "chunks": chunks
        }
