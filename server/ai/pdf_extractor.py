import os
import io
from typing import List, Dict, Any
from pypdf import PdfReader
import docx

class DocumentExtractor:
    """Extracts text and metadata from PDF, DOCX & TXT documents directly from memory or disk."""

    @staticmethod
    def extract_from_pdf_stream(stream, filename: str, doc_id: str, version: str = "v1.0", file_size_kb: float = 0.0) -> Dict[str, Any]:
        """Extracts text, headings, page numbers and creates chunks from a PDF stream or file."""
        reader = PdfReader(stream)
        full_text = ""
        chunks = []
        chunk_idx = 1

        for page_num, page in enumerate(reader.pages, start=1):
            text = page.extract_text() or ""
            full_text += f"\n--- Page {page_num} ---\n" + text

            lines = [line.strip() for line in text.split("\n") if line.strip()]
            current_heading = f"Page {page_num} Content"
            current_chunk = []

            for line in lines:
                if len(line) < 60 and (line.isupper() or line.startswith("Step") or line.startswith("Section") or line.startswith("Pipeline") or line.startswith("Policy") or line.startswith("Rule")):
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
            "title": os.path.basename(filename),
            "file_type": "PDF",
            "file_size_kb": file_size_kb,
            "total_pages": len(reader.pages),
            "version": version,
            "full_text": full_text.strip(),
            "chunk_count": len(chunks),
            "chunks": chunks
        }

    @classmethod
    def extract_from_pdf(cls, file_path: str, doc_id: str, version: str = "v1.0") -> Dict[str, Any]:
        """Extracts from PDF file on disk."""
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")
        size_kb = round(os.path.getsize(file_path) / 1024, 2)
        with open(file_path, "rb") as f:
            return cls.extract_from_pdf_stream(f, os.path.basename(file_path), doc_id, version, size_kb)

    @staticmethod
    def extract_from_docx_stream(stream, filename: str, doc_id: str, version: str = "v1.0", file_size_kb: float = 0.0) -> Dict[str, Any]:
        """Extracts text, headings and section chunks from DOCX stream."""
        doc = docx.Document(stream)
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
            chunk_idx += 1

        return {
            "doc_id": doc_id,
            "title": os.path.basename(filename),
            "file_type": "DOCX",
            "file_size_kb": file_size_kb,
            "version": version,
            "full_text": full_text.strip(),
            "chunk_count": len(chunks),
            "chunks": chunks
        }

    @classmethod
    def extract_from_docx(cls, file_path: str, doc_id: str, version: str = "v1.0") -> Dict[str, Any]:
        """Extracts from DOCX file on disk."""
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")
        size_kb = round(os.path.getsize(file_path) / 1024, 2)
        with open(file_path, "rb") as f:
            return cls.extract_from_docx_stream(f, os.path.basename(file_path), doc_id, version, size_kb)

    @staticmethod
    def extract_from_txt_text(text: str, filename: str, doc_id: str, version: str = "v1.0", file_size_kb: float = 0.0) -> Dict[str, Any]:
        """Extracts text and section chunks from plain text string."""
        paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()] or [text]
        chunks = []

        for idx, para in enumerate(paragraphs, start=1):
            chunks.append({
                "chunk_id": f"{doc_id}-CHK-{idx:03d}",
                "doc_id": doc_id,
                "section": f"Section {idx}",
                "heading": f"Section {idx}",
                "page_number": 1,
                "content": para,
                "version": version
            })

        return {
            "doc_id": doc_id,
            "title": os.path.basename(filename),
            "file_type": "TXT",
            "file_size_kb": file_size_kb,
            "version": version,
            "full_text": text.strip(),
            "chunk_count": len(chunks),
            "chunks": chunks
        }

    @classmethod
    def extract_from_txt(cls, file_path: str, doc_id: str, version: str = "v1.0") -> Dict[str, Any]:
        """Extracts from TXT file on disk."""
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")
        size_kb = round(os.path.getsize(file_path) / 1024, 2)
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            text = f.read()
        return cls.extract_from_txt_text(text, os.path.basename(file_path), doc_id, version, size_kb)

    @classmethod
    def extract_from_bytes(cls, file_bytes: bytes, filename: str, doc_id: str, version: str = "v1.0") -> Dict[str, Any]:
        """Extracts text directly from bytes in memory (perfect for S3 & Vercel serverless)."""
        ext = os.path.splitext(filename)[1].lower()
        size_kb = round(len(file_bytes) / 1024, 2)

        if ext == ".pdf":
            stream = io.BytesIO(file_bytes)
            return cls.extract_from_pdf_stream(stream, filename, doc_id, version, size_kb)
        elif ext in [".docx", ".doc"]:
            stream = io.BytesIO(file_bytes)
            return cls.extract_from_docx_stream(stream, filename, doc_id, version, size_kb)
        else:
            text = file_bytes.decode("utf-8", errors="ignore")
            return cls.extract_from_txt_text(text, filename, doc_id, version, size_kb)

    @classmethod
    def extract_file(cls, file_path: str, doc_id: str, version: str = "v1.0") -> Dict[str, Any]:
        """Dispatches file extraction based on file extension."""
        ext = os.path.splitext(file_path)[1].lower()
        if ext == ".pdf":
            return cls.extract_from_pdf(file_path, doc_id, version)
        elif ext in [".docx", ".doc"]:
            return cls.extract_from_docx(file_path, doc_id, version)
        else:
            return cls.extract_from_txt(file_path, doc_id, version)
