import os
import math
import hashlib
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv

load_dotenv()

# Attempt importing qdrant_client
try:
    from qdrant_client import QdrantClient
    from qdrant_client.http import models as qmodels
    QDRANT_AVAILABLE = True
except ImportError:
    QDRANT_AVAILABLE = False


def generate_simple_vector(text: str, dim: int = 128) -> List[float]:
    """
    Generates a deterministic float vector representation for text chunks
    without requiring heavy local model downloads.
    """
    vector = [0.0] * dim
    words = text.lower().split()
    if not words:
        return vector

    for i, word in enumerate(words):
        # Hash word into bucket
        h = int(hashlib.md5(word.encode('utf-8')).hexdigest(), 16)
        bucket = h % dim
        val = ((h >> 8) % 100) / 100.0
        vector[bucket] += val

    # Normalize vector to unit length
    norm = math.sqrt(sum(v * v for v in vector))
    if norm > 0:
        vector = [v / norm for v in vector]
    return vector


class QdrantCloudRAG:
    """
    Hosted Qdrant Cloud RAG Engine.
    Retrieves top 2-3 relevant policy chunks to minimize Groq token usage and optimize speed.
    Enforces filtering for active policies and version control.
    """

    def __init__(self, collection_name: str = "support_policies"):
        self.collection_name = collection_name
        self.url = os.getenv("QDRANT_END_POINT") or os.getenv("QDRANT_URL") or ""
        self.api_key = os.getenv("QDRANT_API_KEY") or ""
        self.client = None
        self.is_connected = False
        self.vector_dim = 128

        self._connect()

    def _connect(self):
        """Establish connection to Qdrant Cloud cluster."""
        if not QDRANT_AVAILABLE or not self.url or not self.api_key:
            print("[!] Qdrant Cloud: Credentials missing or client not available. Using local fallback.")
            return

        try:
            self.client = QdrantClient(url=self.url, api_key=self.api_key, timeout=10.0)
            # Ensure collection exists
            collections = self.client.get_collections().collections
            col_names = [c.name for c in collections]

            if self.collection_name not in col_names:
                self.client.create_collection(
                    collection_name=self.collection_name,
                    vectors_config=qmodels.VectorParams(
                        size=self.vector_dim,
                        distance=qmodels.Distance.COSINE
                    )
                )
                print(f"[+] Qdrant Cloud: Collection '{self.collection_name}' created.")

            self.is_connected = True
            print(f"[OK] Qdrant Cloud: Connected successfully to cluster ({self.url}).")
        except Exception as e:
            print(f"[!] Qdrant Cloud Connection Warning: {e}. Fallback enabled.")
            self.is_connected = False

    def index_chunks(self, chunks: List[Dict[str, Any]]):
        """Indexes policy document chunks into Qdrant Cloud collection."""
        if not self.is_connected or not self.client:
            return

        try:
            points = []
            for idx, c in enumerate(chunks):
                text_content = f"{c.get('heading', '')} {c.get('content', '')}"
                vector = generate_simple_vector(text_content, dim=self.vector_dim)

                point_id = int(hashlib.md5(f"{c.get('chunk_id', idx)}".encode()).hexdigest(), 16) % (2**31 - 1)
                payload = {
                    "doc_id": c.get("doc_id", "KB"),
                    "chunk_id": c.get("chunk_id", f"CHK-{idx}"),
                    "heading": c.get("heading", "Policy Section"),
                    "content": c.get("content", ""),
                    "version": c.get("version", "v1.0"),
                    "status": c.get("status", "ACTIVE"),
                    "department_id": c.get("department_id", "GENERAL"),
                    "department": c.get("department", "General")
                }

                points.append(
                    qmodels.PointStruct(
                        id=point_id,
                        vector=vector,
                        payload=payload
                    )
                )

            if points:
                self.client.upsert(
                    collection_name=self.collection_name,
                    points=points
                )
                print(f"[+] Qdrant Cloud: Indexed {len(points)} chunks into '{self.collection_name}'.")
        except Exception as e:
            print(f"[!] Qdrant Cloud Indexing Error: {e}")

    def retrieve_relevant_chunks(
        self,
        query: str,
        top_k: int = 2,
        active_version_only: bool = True
    ) -> List[Dict[str, Any]]:
        """
        Retrieves top-K (default top 2-3) most relevant policy chunks from Qdrant Cloud.
        Filters out inactive / legacy policy versions to ensure accurate compliance.
        """
        if not self.is_connected or not self.client:
            return []

        try:
            query_vector = generate_simple_vector(query, dim=self.vector_dim)

            # Build metadata filter for active status & version compliance
            query_filter = None
            if active_version_only:
                query_filter = qmodels.Filter(
                    must=[
                        qmodels.FieldCondition(
                            key="status",
                            match=qmodels.MatchValue(value="ACTIVE")
                        )
                    ]
                )

            # Execute Qdrant Vector Search
            results = self.client.search(
                collection_name=self.collection_name,
                query_vector=query_vector,
                query_filter=query_filter,
                limit=top_k
            )

            retrieved = []
            for hit in results:
                payload = hit.payload
                retrieved.append({
                    "doc_id": payload.get("doc_id"),
                    "chunk_id": payload.get("chunk_id"),
                    "heading": payload.get("heading"),
                    "content": payload.get("content"),
                    "version": payload.get("version"),
                    "department": payload.get("department"),
                    "score": round(hit.score, 4),
                    "retrieved_via": "Qdrant Cloud RAG"
                })

            print(f"[OK] Qdrant Cloud RAG: Retrieved top {len(retrieved)} policy chunks for query.")
            return retrieved

        except Exception as e:
            print(f"[!] Qdrant Cloud Retrieval Error: {e}")
            return []


# Global Singleton Instance
qdrant_rag = QdrantCloudRAG()
