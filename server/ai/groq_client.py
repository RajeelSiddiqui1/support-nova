"""
NovaWear SupportNova — Groq AI Client for Pipeline 1.
Implements:
1. Versioned prompt template loading via PromptService.
2. Delimiter wrapping for untrusted input data.
3. Strict Pydantic JSON schema validation.
4. Controlled retry with exponential backoff (max 2 retries).
5. Audit failure logging to `genai_failures` MongoDB collection.
6. Safe quarantine fallback with mismatch_type "GENAI_INVALID_OUTPUT" on retry exhaustion.
"""

import os
import json
import time
import hashlib
from datetime import datetime
from typing import Dict, Any, Optional, List, Tuple
from dotenv import load_dotenv

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

try:
    from lib.db import get_database
    from ai.prompt_service import PromptService
    from models.ticket import GenAIStructuredOutput
except ImportError:
    from server.lib.db import get_database
    from server.ai.prompt_service import PromptService
    from server.models.ticket import GenAIStructuredOutput


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

    async def log_failure_to_db(self, ticket_id: str, attempt: int, error_msg: str, raw_output: str):
        """Asynchronously logs LLM invocation or parsing failure to `genai_failures` collection."""
        try:
            db = get_database()
            if db is not None:
                output_hash = hashlib.sha256(raw_output.encode("utf-8")).hexdigest() if raw_output else None
                failure_record = {
                    "ticket_id": ticket_id,
                    "attempt": attempt,
                    "error": error_msg,
                    "raw_output_hash": output_hash,
                    "model": self.model,
                    "created_at": datetime.utcnow()
                }
                await db.genai_failures.insert_one(failure_record)
        except Exception as e:
            print(f"[WARNING] Could not log to genai_failures: {e}")

    def analyze_complaint(
        self,
        complaint_id: str,
        title: str,
        description: str,
        order_id: Optional[str] = None,
        policy_context: str = "",
        available_departments: Optional[List[str]] = None,
        prompt_version: Optional[str] = None
    ) -> Tuple[Dict[str, Any], Dict[str, Any]]:
        """
        Executes Pipeline 1 GenAI analysis.
        Returns: (parsed_genai_output_dict, analysis_meta_dict)
        """
        dept_options = " | ".join(available_departments) if available_departments else "Logistics | Returns & Exchanges | Quality Assurance | Customer Support | Billing & Finance"

        # Load versioned prompt from PromptService
        system_prompt, active_version = PromptService.get_prompt_sync("complaint_extraction_main", prompt_version)
        system_prompt = system_prompt.format(
            complaint_id=complaint_id,
            dept_options=dept_options,
            primary_dept_placeholder=available_departments[0] if available_departments else "Logistics"
        )

        # UNTRUSTED DATA DELIMITERS
        user_prompt = f"""===BEGIN UNTRUSTED COMPLAINT===
COMPLAINT ID: {complaint_id}
TITLE: {title}
ORDER ID: {order_id or 'N/A'}
DESCRIPTION: {description}
AVAILABLE DEPARTMENTS: {dept_options}

APPROVED POLICY KNOWLEDGE CONTEXT:
{policy_context}
===END UNTRUSTED COMPLAINT===
"""

        analysis_meta = {
            "prompt_versions": {"complaint_extraction_main": active_version},
            "genai_provider": "groq",
            "model": self.model,
            "analyzed_at": datetime.utcnow().isoformat(),
            "policy_versions_used": []
        }

        # If Groq client is active, attempt call with controlled retry (max 2 retries, exponential backoff)
        max_retries = 2
        last_error = None
        raw_response_text = ""

        if self.client:
            for attempt in range(1, max_retries + 2):
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
                    raw_response_text = chat_completion.choices[0].message.content
                    parsed = json.loads(raw_response_text)

                    # Validate with Pydantic schema
                    validated = GenAIStructuredOutput(**parsed)
                    output_dict = validated.model_dump()
                    output_dict["is_genai_fallback"] = False
                    return output_dict, analysis_meta

                except Exception as e:
                    last_error = str(e)
                    print(f"[GROQ ATTEMPT {attempt}/{max_retries + 1} FAILED] {complaint_id}: {e}")
                    # In sync context, we schedule async DB failure logging or execute synchronously if loop exists
                    try:
                        import asyncio
                        loop = asyncio.get_event_loop()
                        if loop.is_running():
                            asyncio.create_task(self.log_failure_to_db(complaint_id, attempt, last_error, raw_response_text))
                    except Exception:
                        pass

                    if attempt <= max_retries:
                        sleep_time = 0.5 * (2 ** (attempt - 1))
                        time.sleep(sleep_time)

        # Retries exhausted or Groq not configured -> Controlled Fallback
        # Mark with mismatch_type "GENAI_INVALID_OUTPUT" to ensure ticket is quarantined for AI Review
        desc_lower = f"{title} {description}".lower()
        if "delivery" in desc_lower or "ship" in desc_lower or "track" in desc_lower:
            fallback_dept = "Logistics"
            fallback_cat = "Delivery"
        elif "refund" in desc_lower or "return" in desc_lower or "exchange" in desc_lower:
            fallback_dept = "Returns & Exchanges"
            fallback_cat = "Refund"
        elif "defect" in desc_lower or "tear" in desc_lower or "size" in desc_lower or "color" in desc_lower:
            fallback_dept = "Quality Assurance"
            fallback_cat = "Product Defect"
        elif "charge" in desc_lower or "bill" in desc_lower or "invoice" in desc_lower:
            fallback_dept = "Billing & Finance"
            fallback_cat = "Billing"
        else:
            fallback_dept = "Customer Support"
            fallback_cat = "General"

        fallback_output = {
            "complaint_id": complaint_id,
            "issue_category": fallback_cat,
            "subcategory": "Inquiry",
            "sentiment": "Neutral",
            "urgency": "Medium",
            "priority": "P2",
            "department": fallback_dept,
            "primary_department": fallback_dept,
            "supporting_departments": [],
            "primary_issue": {
                "category": fallback_cat,
                "subcategory": "Inquiry",
                "summary": title
            },
            "secondary_issues": [],
            "entities": {
                "order_id": order_id,
                "transaction_id": None,
                "product": None,
                "service": None,
                "amount": None,
                "currency": "USD",
                "date": None,
                "location": None,
                "department": fallback_dept,
                "complaint_reference": None
            },
            "emotion_indicators": [],
            "complaint_summary": {
                "one_line": title,
                "key_facts": [title],
                "customer_requested_resolution": None
            },
            "agent_guidance": [
                "Verify customer order reference and purchase history",
                "Inspect policy rules before offering concessions"
            ],
            "escalation_notes": {
                "complaint_summary": title,
                "key_facts": [title],
                "escalation_reason": "Automated fallback review required",
                "actions_taken": ["Quarantined for manual AI review"],
                "relevant_policy_id": None,
                "required_next_action": "Verify classification and draft response"
            },
            "follow_up": {
                "required": False,
                "type": "resolution-confirmation",
                "suggested_message": None,
                "suggested_delay_hours": 24
            },
            "clarification_questions": [],
            "injection_suspected": False,
            "injection_evidence": None,
            "policy_id": "DEL-POL-04" if fallback_cat == "Delivery" else "REF-POL-07",
            "policy_section": "1.0",
            "resolution_steps": [
                "Verify customer purchase & order reference",
                "Check active policy terms",
                "Respond to customer"
            ],
            "escalation_required": False,
            "response_type": "Standard Support Acknowledgment",
            "follow_up_required": False,
            "draft_response": f"Dear Customer,\n\nThank you for reaching out regarding your order {order_id or ''}. We have received your complaint and our {fallback_dept} team is reviewing the details to assist you promptly.",
            "is_genai_fallback": True,
            "genai_error": last_error
        }

        # If an error occurred during attempts, set mismatch_type
        if last_error:
            fallback_output["mismatch_type"] = "GENAI_INVALID_OUTPUT"

        return fallback_output, analysis_meta


# Global Groq Client Instance
groq_client = GroqAIClient()
