import math
from typing import List, Dict, Any

class RAGEngine:
    """Retrieval-Augmented Generation (RAG) Engine for searching policy chunks."""

    def __init__(self):
        self.chunk_store: List[Dict[str, Any]] = []

    def load_chunks(self, chunks: List[Dict[str, Any]]):
        """Loads document chunks into the in-memory retrieval store."""
        self.chunk_store.extend(chunks)

    def retrieve_relevant_chunks(self, query: str, top_k: int = 3) -> List[Dict[str, Any]]:
        """Retrieves top-K relevant policy chunks using TF-IDF / term overlap matching."""
        if not self.chunk_store:
            return []

        query_terms = set(query.lower().split())
        scored_chunks = []

        for chunk in self.chunk_store:
            content_lower = chunk.get("content", "").lower()
            heading_lower = chunk.get("heading", "").lower()
            
            # Simple keyword matching score
            score = 0
            for term in query_terms:
                if len(term) > 3:  # Skip trivial stopwords
                    score += content_lower.count(term) * 1.0
                    score += heading_lower.count(term) * 2.5

            if score > 0:
                scored_chunks.append((score, chunk))

        # Sort by score descending
        scored_chunks.sort(key=lambda x: x[0], reverse=True)
        return [chunk for score, chunk in scored_chunks[:top_k]]

    def format_context_for_prompt(self, relevant_chunks: List[Dict[str, Any]]) -> str:
        """Formats retrieved chunks into a prompt-ready context string with document metadata."""
        if not relevant_chunks:
            return "No specific policy documents found."

        context_lines = []
        for c in relevant_chunks:
            ref = f"[{c.get('doc_id', 'KB')} | {c.get('heading', 'Policy')} (Page {c.get('page_number', 1)}) v{c.get('version', 'v1.0')}]"
            context_lines.append(f"{ref}\n{c.get('content', '')}\n")

        return "\n".join(context_lines)

# Global RAG Instance
rag_engine = RAGEngine()
