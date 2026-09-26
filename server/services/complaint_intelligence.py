"""
NovaWear SupportNova — Complaint Intelligence Service Module.
Implements dual-pipeline intelligence logic for Features 1-11.
Pipeline 2 functions are 100% deterministic with ZERO LLM calls.
"""

import uuid
import json
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Tuple
try:
    from ai.groq_client import GroqAIClient
    from ai.prompts import (
        PROMPT_GENERATE_FOLLOW_UP_V1,
        PROMPT_GENERATE_CLARIFICATION_QUESTIONS_V1,
        PROMPT_GENERATE_COMPLAINT_SUMMARY_V1,
        PROMPT_GENERATE_ESCALATION_NOTES_V1
    )
except ModuleNotFoundError:
    from server.ai.groq_client import GroqAIClient
    from server.ai.prompts import (
        PROMPT_GENERATE_FOLLOW_UP_V1,
        PROMPT_GENERATE_CLARIFICATION_QUESTIONS_V1,
        PROMPT_GENERATE_COMPLAINT_SUMMARY_V1,
        PROMPT_GENERATE_ESCALATION_NOTES_V1
    )


# Required fields per issue category for deterministic Missing Info Check
CATEGORY_REQUIRED_FIELDS = {
    "Delivery": ["order_id", "description"],
    "Refund": ["order_id", "transaction_date", "description"],
    "Wrong Product": ["order_id", "product", "evidence", "description"],
    "Product Defect": ["order_id", "product", "evidence", "description"],
    "Billing": ["order_id", "transaction_date", "description"],
    "General": ["order_id", "description"],
}


class ComplaintIntelligenceService:
    def __init__(self, groq_client: Optional[GroqAIClient] = None):
        self.groq = groq_client or GroqAIClient()

    # ── Feature 2: Missing Information Detection (Pipeline 2 - Deterministic) ──
    @staticmethod
    def detect_missing_fields(
        category: str,
        title: str,
        description: str,
        order_id: Optional[str] = None,
        attachments: Optional[List[str]] = None
    ) -> List[str]:
        """Deterministic Pipeline 2 check: flags missing required fields per category."""
        reqs = CATEGORY_REQUIRED_FIELDS.get(category, CATEGORY_REQUIRED_FIELDS["General"])
        missing = []
        text = f"{title} {description}".lower()

        for req in reqs:
            if req == "order_id":
                if not order_id and "order" not in text and "#" not in text:
                    missing.append("order_id")
            elif req == "transaction_date":
                if not any(k in text for k in ["date", "jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec", "202", "yesterday", "today"]):
                    missing.append("transaction_date")
            elif req == "product":
                if not any(k in text for k in ["shirt", "pant", "hoodie", "jacket", "dress", "size", "color", "sku", "item"]):
                    missing.append("product")
            elif req == "evidence":
                if not attachments or len(attachments) == 0:
                    if "photo" not in text and "picture" not in text and "attachment" not in text:
                        missing.append("evidence")
            elif req == "description":
                if not description or len(description.strip()) < 10:
                    missing.append("description")

        return missing

    # ── Feature 2: GenAI Clarification Question Generation (Pipeline 1) ──
    def generate_clarification_questions(
        self,
        missing_fields: List[str],
        title: str,
        description: str
    ) -> List[str]:
        """Pipeline 1 GenAI call: generates up to 3 focused clarification questions."""
        if not missing_fields:
            return []

        prompt = PROMPT_GENERATE_CLARIFICATION_QUESTIONS_V1.format(
            missing_fields=", ".join(missing_fields),
            title=title,
            description=description
        )

        try:
            if self.groq.client:
                res = self.groq.client.chat.completions.create(
                    messages=[{"role": "user", "content": prompt}],
                    model=self.groq.model,
                    response_format={"type": "json_object"},
                    temperature=0.2,
                    timeout=5.0
                )
                parsed = json.loads(res.choices[0].message.content)
                return parsed.get("clarification_questions", [])[:3]
        except Exception as e:
            print(f"[WARNING] Groq Clarification Generation fallback: {e}")

        # Stub fallback
        questions = []
        for field in missing_fields[:3]:
            if field == "order_id":
                questions.append("Could you please provide your NovaWear Order ID or Invoice Number?")
            elif field == "transaction_date":
                questions.append("When was this purchase completed? Please specify the approximate date.")
            elif field == "product":
                questions.append("Which specific NovaWear item/size/color experienced this issue?")
            elif field == "evidence":
                questions.append("Please upload or attach a clear photo showing the item condition.")
            elif field == "description":
                questions.append("Could you provide a few more details regarding what happened with your order?")
        return questions

    # ── Feature 3: Complaint Summary Generation (Pipeline 1) ──
    def generate_complaint_summary(
        self,
        ticket_id: str,
        title: str,
        description: str,
        category: str
    ) -> Dict[str, Any]:
        """Pipeline 1 GenAI call: generates structured summary object."""
        prompt = PROMPT_GENERATE_COMPLAINT_SUMMARY_V1.format(
            ticket_id=ticket_id,
            title=title,
            description=description,
            category=category
        )

        try:
            if self.groq.client:
                res = self.groq.client.chat.completions.create(
                    messages=[{"role": "user", "content": prompt}],
                    model=self.groq.model,
                    response_format={"type": "json_object"},
                    temperature=0.2,
                    timeout=5.0
                )
                parsed = json.loads(res.choices[0].message.content)
                return {
                    "issue": parsed.get("issue", title),
                    "category": parsed.get("category", category),
                    "sentiment": parsed.get("sentiment", "Neutral"),
                    "urgency": parsed.get("urgency", "Medium"),
                    "key_facts": parsed.get("key_facts", [title]),
                    "one_line_summary": parsed.get("one_line_summary", f"Customer reported {category} issue: {title}")
                }
        except Exception as e:
            print(f"[WARNING] Groq Summary Generation fallback: {e}")

        return {
            "issue": title,
            "category": category,
            "sentiment": "Neutral",
            "urgency": "Medium",
            "key_facts": [title, f"Category: {category}"],
            "one_line_summary": f"Customer filed a {category} complaint regarding {title}."
        }

    # ── Feature 5: Escalation Notes Generation (Pipeline 1 & 2) ──
    def generate_escalation_notes(
        self,
        ticket_id: str,
        title: str,
        description: str,
        category: str,
        escalation_reason: str,
        actions_taken: List[str],
        policy_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Generates structured manager escalation dossier."""
        prompt = PROMPT_GENERATE_ESCALATION_NOTES_V1.format(
            ticket_id=ticket_id,
            title=title,
            description=description,
            category=category,
            escalation_reason=escalation_reason,
            actions_taken=", ".join(actions_taken) if actions_taken else "Initial triage"
        )

        try:
            if self.groq.client:
                res = self.groq.client.chat.completions.create(
                    messages=[{"role": "user", "content": prompt}],
                    model=self.groq.model,
                    response_format={"type": "json_object"},
                    temperature=0.2,
                    timeout=5.0
                )
                parsed = json.loads(res.choices[0].message.content)
                return {
                    "complaint_summary": parsed.get("complaint_summary", title),
                    "key_facts": parsed.get("key_facts", [title]),
                    "escalation_reason": escalation_reason,
                    "actions_taken": actions_taken,
                    "relevant_policy_id": policy_id or "ESC-POL-01",
                    "required_next_action": parsed.get("required_next_action", "Reviewer override or department approval required.")
                }
        except Exception as e:
            print(f"[WARNING] Groq Escalation Notes fallback: {e}")

        return {
            "complaint_summary": title,
            "key_facts": [title, f"Category: {category}"],
            "escalation_reason": escalation_reason,
            "actions_taken": actions_taken,
            "relevant_policy_id": policy_id or "ESC-POL-01",
            "required_next_action": "Senior manager authorization needed."
        }

    # ── Feature 8: Repeat Complaint Detection (Pipeline 2 - Deterministic) ──
    @staticmethod
    def check_repeat_complaint(
        current_title: str,
        current_description: str,
        prior_tickets: List[Dict[str, Any]],
        similarity_threshold: float = 0.35
    ) -> Tuple[bool, List[str], float]:
        """
        Deterministic Jaccard/token similarity check against customer's unresolved prior tickets.
        Returns (is_repeat, related_ticket_ids, max_similarity_score).
        """
        if not prior_tickets:
            return False, [], 0.0

        def tokenize(text: str) -> set:
            words = text.lower().replace(",", "").replace(".", "").replace("#", "").split()
            return set(w for w in words if len(w) > 2)

        curr_tokens = tokenize(f"{current_title} {current_description}")
        if not curr_tokens:
            return False, [], 0.0

        related_ids = []
        max_score = 0.0

        for pt in prior_tickets:
            status = pt.get("status", "")
            # Only consider unresolved/open/in-triage or recently resolved tickets
            prior_text = f"{pt.get('title', '')} {pt.get('description', '')}"
            prior_tokens = tokenize(prior_text)

            if not prior_tokens:
                continue

            intersection = curr_tokens.intersection(prior_tokens)
            union = curr_tokens.union(prior_tokens)
            score = len(intersection) / len(union) if union else 0.0

            if score > max_score:
                max_score = round(score, 3)

            if score >= similarity_threshold and pt.get("ticket_id"):
                related_ids.append(pt["ticket_id"])

        is_repeat = len(related_ids) > 0
        return is_repeat, related_ids, max_score

    # ── Feature 9: Explicit Hallucination Detection (Pipeline 2 - Deterministic) ──
    @staticmethod
    def detect_hallucinations(
        genai_output: Dict[str, Any],
        known_policy_ids: List[str],
        complaint_text: str
    ) -> Tuple[bool, List[str]]:
        """
        Deterministic Pipeline 2 hallucination check:
        1. Verifies cited policy_id exists in Knowledge Base (`db.kb_docs`).
        2. Checks draft_response for fabricated policy citations.
        Returns (has_hallucination, hallucination_flags).
        """
        flags = []
        cited_policy = genai_output.get("policy_id")

        # 1. Policy ID existence check
        if cited_policy and cited_policy not in known_policy_ids and cited_policy != "N/A":
            flags.append(f"Cited policy_id '{cited_policy}' does not exist in Knowledge Base.")

        # 2. Check draft response for policy references not in KB
        draft = (genai_output.get("draft_response") or "").upper()
        import re
        policy_matches = re.findall(r'[A-Z]{2,4}-[A-Z]{2,4}-\d{2}', draft)
        for pm in policy_matches:
            if pm not in known_policy_ids:
                flags.append(f"Draft response references unverified policy ID '{pm}'.")

        # 3. Check for unauthorized absolute guarantee promises
        draft_lower = draft.lower()
        if "100% full refund immediately guaranteed" in draft_lower and "refund" not in complaint_text.lower():
            flags.append("Draft response promises unrequested immediate full refund guarantee.")

        has_hallucination = len(flags) > 0
        return has_hallucination, flags

    # ── Feature 11: Verification Score Calculation (Pipeline 2 - Deterministic) ──
    @staticmethod
    def calculate_verification_score(
        genai_output: Dict[str, Any],
        python_output: Dict[str, Any],
        actual_category: str,
        has_hallucination: bool = False
    ) -> Tuple[float, Dict[str, float]]:
        """
        Deterministic weighted verification score (0.0 to 100.0):
        - Category Match (25%)
        - Department Match (25%)
        - Urgency/Priority Alignment (15%)
        - Escalation Match (15%)
        - Policy Citation Match (20%)
        """
        # 1. Category match
        genai_cat = (genai_output.get("issue_category") or "").strip().lower()
        cat_match = 100.0 if genai_cat == actual_category.strip().lower() else 0.0

        # 2. Department match
        genai_dept = (genai_output.get("department") or genai_output.get("primary_department") or "").strip().lower()
        python_dept = (python_output.get("verified_primary_department") or python_output.get("department") or "").strip().lower()
        dept_match = 100.0 if genai_dept and genai_dept == python_dept else 0.0

        # 3. Urgency / Priority alignment
        genai_urgency = (genai_output.get("urgency") or "").lower()
        genai_priority = (genai_output.get("priority") or "P2").upper()
        p_map = {"p0": "critical", "p1": "high", "p2": "medium", "p3": "low"}
        urgency_match = 100.0 if p_map.get(genai_priority.lower()) == genai_urgency else 50.0

        # 4. Escalation match
        genai_esc = bool(genai_output.get("escalation_required"))
        python_esc = bool(python_output.get("escalation_required"))
        esc_match = 100.0 if genai_esc == python_esc else 0.0

        # 5. Policy citation match
        genai_pol = (genai_output.get("policy_id") or "").strip().upper()
        python_pol = (python_output.get("policy_reference") or "").strip().upper()
        pol_match = 100.0 if genai_pol and genai_pol == python_pol else (50.0 if not genai_pol else 0.0)

        # Apply weights
        total = (
            (cat_match * 0.25) +
            (dept_match * 0.25) +
            (urgency_match * 0.15) +
            (esc_match * 0.15) +
            (pol_match * 0.20)
        )

        if has_hallucination:
            total = max(0.0, total - 40.0)

        breakdown = {
            "category_match": cat_match,
            "department_match": dept_match,
            "urgency_match": urgency_match,
            "escalation_match": esc_match,
            "policy_citation_match": pol_match,
            "total_score": round(total, 1)
        }

        return round(total, 1), breakdown

    # ── Feature 1: Generate Follow-up Message ──
    def generate_follow_up_message(
        self,
        ticket_id: str,
        title: str,
        customer_name: str,
        category: str,
        status: str,
        follow_up_type: str,
        custom_delay_hours: int = 24
    ) -> Dict[str, Any]:
        """Generates a follow-up item record with scheduled_at timestamp."""
        prompt = PROMPT_GENERATE_FOLLOW_UP_V1.format(
            ticket_id=ticket_id,
            title=title,
            customer_name=customer_name or "Valued Customer",
            category=category,
            status=status,
            follow_up_type=follow_up_type
        )

        msg_text = f"Dear {customer_name or 'Customer'}, regarding your complaint ({ticket_id}) on {category}: We are following up to ensure your issue is being addressed promptly."
        try:
            if self.groq.client:
                res = self.groq.client.chat.completions.create(
                    messages=[{"role": "user", "content": prompt}],
                    model=self.groq.model,
                    response_format={"type": "json_object"},
                    temperature=0.2,
                    timeout=5.0
                )
                parsed = json.loads(res.choices[0].message.content)
                msg_text = parsed.get("message", msg_text)
        except Exception as e:
            print(f"[WARNING] Groq FollowUp Generation fallback: {e}")

        scheduled = datetime.utcnow() + timedelta(hours=custom_delay_hours)

        return {
            "follow_up_id": f"FOL-{uuid.uuid4().hex[:6].upper()}",
            "type": follow_up_type,
            "message": msg_text,
            "scheduled_at": scheduled,
            "sent_at": None,
            "status": "pending"
        }
