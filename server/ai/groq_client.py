import os
import json
from typing import Dict, Any, Optional, List
from dotenv import load_dotenv

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-20b")

class GroqAIClient:
    """Groq API Client for Pipeline 1 (GenAI Complaint Intelligence)."""

    def __init__(self):
        self.api_key = GROQ_API_KEY
        self.model = GROQ_MODEL
        self.client = None

        if self.api_key and self.api_key != "gsk_your_groq_api_key_here":
            try:
                from groq import Groq
                self.client = Groq(api_key=self.api_key, max_retries=0)
            except Exception as e:
                print(f"[WARNING] Groq client initialization warning: {e}")

    def analyze_complaint(
        self,
        complaint_id: str,
        title: str,
        description: str,
        order_id: Optional[str] = None,
        policy_context: str = "",
        available_departments: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Executes Pipeline 1 GenAI analysis and returns structured JSON output matching SRS format."""

        dept_options = " | ".join(available_departments) if available_departments else "Ebook | Cloud | Logistics | Billing | Technical Support"

        system_prompt = f"""You are SupportNova GenAI Complaint Intelligence Engine (Pipeline 1).
Analyze the customer complaint and return ONLY a valid structured JSON object matching the exact schema below.

IMPORTANT INSTRUCTION FOR DEPARTMENT CLASSIFICATION:
You MUST classify the complaint into the single most appropriate department from this list:
{dept_options}

JSON SCHEMA:
{{
  "complaint_id": "{complaint_id}",
  "issue_category": "Delivery | Refund | Wrong Product | Billing | Product Defect | Technical Support | Other",
  "subcategory": "string",
  "sentiment": "Positive | Neutral | Negative | Extremely Angry",
  "urgency": "Low | Medium | High | Critical",
  "priority": "P0 | P1 | P2 | P3",
  "department": "{dept_options}",
  "policy_id": "DEL-POL-04 | REF-POL-07 | WP-POL-02 | BIL-POL-03 | ESC-POL-01",
  "policy_section": "string",
  "resolution_steps": ["step 1", "step 2", "step 3"],
  "escalation_required": boolean,
  "response_type": "string",
  "follow_up_required": boolean,
  "draft_response": "Professional, empathetic response string to customer"
}}
"""

        user_prompt = f"""COMPLAINT DATA:
ID: {complaint_id}
Title: {title}
Order ID: {order_id or 'N/A'}
Description: {description}
AVAILABLE DEPARTMENTS: {dept_options}

APPROVED POLICY KNOWLEDGE CONTEXT:
{policy_context}
"""

        if self.client:
            try:
                chat_completion = self.client.chat.completions.create(
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    model=self.model,
                    response_format={"type": "json_object"},
                    temperature=0.2,
                    timeout=5.0,
                )
                response_text = chat_completion.choices[0].message.content
                parsed = json.loads(response_text)
                return parsed
            except Exception as e:
                print(f"[WARNING] Groq API Call Failed: {e}. Falling back to structured stub.")

        # Structured Fallback Stub (matching real departments)
        desc_lower = f"{title} {description}".lower()
        if "ebook" in desc_lower or "book" in desc_lower:
            fallback_dept = "Ebook"
        elif "cloud" in desc_lower or "server" in desc_lower or "instance" in desc_lower:
            fallback_dept = "Cloud"
        elif available_departments and len(available_departments) > 0:
            fallback_dept = available_departments[0]
        else:
            fallback_dept = "Ebook"

        return {
            "complaint_id": complaint_id,
            "issue_category": "Delivery" if "delivery" in desc_lower else "Digital Product",
            "subcategory": "Access / Download Issue" if "download" in desc_lower or "404" in desc_lower else "Inquiry",
            "sentiment": "Negative",
            "urgency": "High",
            "priority": "P1",
            "department": fallback_dept,
            "policy_id": "DEL-POL-04",
            "policy_section": "1.0",
            "resolution_steps": [
                "Verify customer purchase & order reference",
                "Restore download link access or provide alternate copy",
                "Send resolution confirmation email to customer"
            ],
            "escalation_required": False,
            "response_type": "Apology and Access Restoration",
            "follow_up_required": True,
            "draft_response": f"Dear Customer,\n\nThank you for reaching out regarding your order {order_id or ''}. We have escalated this to the {fallback_dept} team to resolve your access immediately."
        }

# Global Groq Client Instance
groq_client = GroqAIClient()
