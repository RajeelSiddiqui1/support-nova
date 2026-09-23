import os
import json
from typing import Dict, Any, Optional
from dotenv import load_dotenv

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

class GroqAIClient:
    """Groq API Client for Pipeline 1 (GenAI Complaint Intelligence)."""

    def __init__(self):
        self.api_key = GROQ_API_KEY
        self.model = GROQ_MODEL
        self.client = None

        if self.api_key and self.api_key != "gsk_your_groq_api_key_here":
            try:
                from groq import Groq
                self.client = Groq(api_key=self.api_key)
            except Exception as e:
                print(f"⚠️ Groq client initialization warning: {e}")

    def analyze_complaint(
        self,
        complaint_id: str,
        title: str,
        description: str,
        order_id: Optional[str] = None,
        policy_context: str = ""
    ) -> Dict[str, Any]:
        """Executes Pipeline 1 GenAI analysis and returns structured JSON output matching SRS format."""

        system_prompt = """You are SupportNova GenAI Complaint Intelligence Engine (Pipeline 1).
Analyze the customer complaint and return ONLY a valid structured JSON object matching the exact schema below.

JSON SCHEMA:
{
  "complaint_id": "CMP-XXXXX",
  "issue_category": "Delivery | Refund | Wrong Product | Billing | Product Defect | Technical Support | Other",
  "subcategory": "string",
  "sentiment": "Positive | Neutral | Negative | Extremely Angry",
  "urgency": "Low | Medium | High | Critical",
  "priority": "P0 | P1 | P2 | P3",
  "department": "Logistics | Finance | Quality | Fulfillment | Tech | Management",
  "policy_id": "DEL-POL-04 | REF-POL-07 | WP-POL-02 | BIL-POL-03 | ESC-POL-01",
  "policy_section": "string",
  "resolution_steps": ["step 1", "step 2", "step 3"],
  "escalation_required": boolean,
  "response_type": "string",
  "follow_up_required": boolean,
  "draft_response": "Professional, empathetic response string to customer"
}
"""

        user_prompt = f"""COMPLAINT DATA:
ID: {complaint_id}
Title: {title}
Order ID: {order_id or 'N/A'}
Description: {description}

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
                )
                response_text = chat_completion.choices[0].message.content
                return json.loads(response_text)
            except Exception as e:
                print(f"⚠️ Groq API Call Failed: {e}. Falling back to structured stub.")

        # Structured Fallback Stub (matching SRS Page 7 schema)
        return {
            "complaint_id": complaint_id,
            "issue_category": "Delivery",
            "subcategory": "Delayed Delivery",
            "sentiment": "Negative",
            "urgency": "High",
            "priority": "P1",
            "department": "Logistics Support",
            "policy_id": "DEL-POL-04",
            "policy_section": "5.2",
            "resolution_steps": [
                "Verify shipment status with carrier",
                "Confirm expected delivery date",
                "Offer approved compensation if eligibility conditions are met"
            ],
            "escalation_required": False,
            "response_type": "Apology and Resolution Update",
            "follow_up_required": True,
            "draft_response": f"Dear Customer, we sincerely apologize for the delay with order {order_id or 'your order'}. Our logistics team is actively tracking your shipment."
        }

# Global Groq Client Instance
groq_client = GroqAIClient()
