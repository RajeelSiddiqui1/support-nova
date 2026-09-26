import re
import json
from datetime import datetime
from typing import Dict, Any, List, Optional

from schemas.reviewer import (
    MismatchTypeEnum,
    ReviewerActionEnum,
    PipelineVerdictEnum,
    CustomerInputPayload,
    Pipeline1GenAIPayload,
    Pipeline2PythonRulePayload,
    ReviewerComparisonPayload,
    ReviewerQueueItem,
    ReviewerActionRequest,
    ReviewerActionResponse,
    AuditReviewerLogResponse
)
from ai.groq_client import GroqAIClient

PROMPT_INJECTION_SIGNALS = [
    "ignore previous instructions", "disregard all previous", "system prompt",
    "developer mode", "jailbreak", "override your instructions", "as an ai",
    "<script>", "curl ", "exec(", "eval("
]

FURIOUS_SENTIMENTS = ["furious", "extremely angry", "angry", "hostile", "rage", "enraged"]

class ReviewerService:
    """
    Business Logic and Audit Engine for Reviewer Workspace & Manual Review Queue.
    100% Powered by MongoDB Atlas Async (Motor) for unified high-throughput persistence.
    Handles queue qualification, side-by-side comparative payload construction,
    deterministic override execution, and transactional audit logging.
    """

    @staticmethod
    def extract_entities(text: str) -> Dict[str, Any]:
        """Deterministic entity extraction from customer complaint message."""
        entities = {
            "order_id": None,
            "delivery_date": None,
            "product_name": None,
            "amount_requested": None,
            "tracking_number": None
        }
        if not text:
            return entities

        # 1. Order ID Detection (e.g. ORD-98124, ORDER #12345, #98213)
        order_match = re.search(r'\b(?:ORD|ORDER|INV|#)[-\s:]*([A-Za-z0-9-]{4,16})\b', text, re.IGNORECASE)
        if order_match:
            entities["order_id"] = order_match.group(1).strip()
        else:
            digits_match = re.search(r'\b(1\d{5,7})\b', text)
            if digits_match:
                entities["order_id"] = digits_match.group(1)

        # 2. Tracking Number Detection (e.g. TRK-8721, TRACKING: 981247)
        trk_match = re.search(r'\b(?:TRK|TRACK|TRACKING)[-\s:]*([A-Za-z0-9-]{6,20})\b', text, re.IGNORECASE)
        if trk_match:
            entities["tracking_number"] = trk_match.group(1).strip()

        # 3. Delivery Date Detection
        date_match = re.search(
            r'\b(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2}(?:st|nd|rd|th)?,? \d{4})\b',
            text,
            re.IGNORECASE
        )
        if date_match:
            entities["delivery_date"] = date_match.group(0).strip()

        # 4. Product Name Detection
        apparel_keywords = ["hoodie", "jacket", "t-shirt", "tee", "shirt", "denim", "jeans", "sweater", "blazer", "dress", "pants", "sneakers"]
        for kw in apparel_keywords:
            if re.search(rf'\b{kw}\b', text, re.IGNORECASE):
                entities["product_name"] = kw.capitalize()
                break

        # 5. Amount Detection (e.g. $140, $49.99)
        amt_match = re.search(r'(?:[\$€£]|USD|PKR|Rs\.?)\s*(\d+(?:\.\d{2})?)', text, re.IGNORECASE)
        if amt_match:
            entities["amount_requested"] = f"${amt_match.group(1)}"

        return entities

    @classmethod
    def evaluate_queue_eligibility(cls, ticket: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Evaluates whether a ticket qualifies for the Manual Review Queue according to the 3 Core Business Criteria:
        1. Pipeline 1 vs Pipeline 2 MISMATCH or CONFLICT.
        2. Policy support is ambiguous, missing, or flagged as an exception (e.g. unauthorized fee waiver or edge-case refund).
        3. Customer sentiment is furious/angry, or prompt injection attempt was detected.
        
        Returns None if not eligible, or a dict with `mismatch_type` and `conflict_reason`.
        """
        title = ticket.get("title", "")
        desc = ticket.get("description", "")
        combined_text = f"{title} {desc}".lower()

        genai = ticket.get("genai_output") or {}
        python_rule = ticket.get("python_rule_output") or {}
        match_status = ticket.get("match_status", True)

        # A. Prompt Injection Check
        for token in PROMPT_INJECTION_SIGNALS:
            if token in combined_text or ticket.get("prompt_injection_flag"):
                return {
                    "mismatch_type": MismatchTypeEnum.PROMPT_INJECTION.value,
                    "conflict_reason": f"Potential adversarial prompt injection detected: '{token}'"
                }

        # B. High Sentiment Risk (Furious / Angry customer)
        sentiment = (genai.get("sentiment") or ticket.get("sentiment") or "").lower()
        if any(s in sentiment for s in FURIOUS_SENTIMENTS):
            return {
                "mismatch_type": MismatchTypeEnum.HIGH_SENTIMENT_RISK.value,
                "conflict_reason": f"High churn/escalation risk: Customer sentiment flagged as '{sentiment.capitalize()}'"
            }

        # C. Unauthorized Fee Waiver / Edge-Case Refund Exception
        draft_resp = (genai.get("draft_response") or ticket.get("draft_response") or "").lower()
        refund_eligible = python_rule.get("refund_eligible", False)
        
        # If AI promised a refund/fee waiver, but Python rule explicitly marks not eligible
        fee_waiver_promised = any(w in draft_resp for w in ["refund processed", "waive the fee", "fee waived", "full refund will be issued", "reimburse"])
        if fee_waiver_promised and not refund_eligible:
            return {
                "mismatch_type": MismatchTypeEnum.UNAUTHORIZED_FEE_WAIVER.value,
                "conflict_reason": "GenAI promised full refund/fee waiver, but Ground-Truth rules marked complaint ineligible for refund."
            }

        # D. Ambiguous or Missing Policy Mapping
        policy_id = genai.get("policy_id") or ticket.get("policy_id")
        if not policy_id or str(policy_id).strip().lower() in ["none", "n/a", "unknown", ""]:
            return {
                "mismatch_type": MismatchTypeEnum.AMBIGUOUS_POLICY.value,
                "conflict_reason": "Policy support is missing or ambiguous. No verified policy could be mapped."
            }

        # E. Pipeline 1 vs Pipeline 2 Mismatch or Conflict
        if match_status is False:
            conflicts = []
            rule_cat = (python_rule.get("category_verified") or True)
            if not rule_cat:
                conflicts.append("Category verification failed")
            
            genai_esc = genai.get("escalation_required", False)
            rule_esc = python_rule.get("escalation_required", False)
            if genai_esc != rule_esc:
                conflicts.append(f"Escalation divergence: GenAI={genai_esc} vs GroundTruth={rule_esc}")

            reason = "; ".join(conflicts) if conflicts else "Pipeline 1 (GenAI) and Pipeline 2 (Python Ground Truth) discrepancy detected"
            return {
                "mismatch_type": MismatchTypeEnum.PIPELINE_CONFLICT.value,
                "conflict_reason": reason
            }

        # If explicitly flagged for review
        if ticket.get("requires_manual_review") or ticket.get("needs_reviewer"):
            return {
                "mismatch_type": MismatchTypeEnum.POLICY_EXCEPTION.value,
                "conflict_reason": ticket.get("manual_review_reason") or "Flagged as policy exception requiring human authorization"
            }

        return None

    @classmethod
    async def get_manual_review_queue(
        cls,
        db,
        urgency: Optional[str] = None,
        category: Optional[str] = None,
        mismatch_type: Optional[str] = None,
        assigned_reviewer_id: Optional[str] = None
    ) -> List[ReviewerQueueItem]:
        """
        Fetches and filters tickets routed to the Reviewer Queue from MongoDB Atlas.
        Scans unclosed/in-triage/escalated tickets and applies deterministic qualification criteria.
        """
        tickets_col = db["tickets"]
        query = {"status": {"$nin": ["Closed", "Resolved"]}}

        if category and category != "ALL":
            query["category"] = category

        cursor = tickets_col.find(query).sort("updated_at", -1)
        all_candidates = await cursor.to_list(length=300)

        queue_items: List[ReviewerQueueItem] = []

        for t in all_candidates:
            eligibility = cls.evaluate_queue_eligibility(t)
            if not eligibility:
                continue

            t_mismatch_type = eligibility["mismatch_type"]
            t_conflict_reason = eligibility["conflict_reason"]

            # Filter by mismatch_type if requested
            if mismatch_type and mismatch_type != "ALL":
                if t_mismatch_type != mismatch_type:
                    continue

            # Urgency / Priority Filter
            t_urgency = (t.get("genai_output", {}).get("urgency") or t.get("urgency") or "Medium").capitalize()
            t_priority = t.get("priority") or "P2"
            if urgency and urgency != "ALL":
                if urgency not in [t_urgency, t_priority]:
                    continue

            # Reviewer Filter
            t_reviewer_id = t.get("assigned_reviewer_id")
            if assigned_reviewer_id and assigned_reviewer_id != "ALL":
                if t_reviewer_id != assigned_reviewer_id:
                    continue

            created_at = t.get("created_at") or datetime.utcnow()
            if isinstance(created_at, str):
                try:
                    created_at = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
                except Exception:
                    created_at = datetime.utcnow()

            updated_at = t.get("updated_at") or created_at
            if isinstance(updated_at, str):
                try:
                    updated_at = datetime.fromisoformat(updated_at.replace("Z", "+00:00"))
                except Exception:
                    updated_at = datetime.utcnow()

            queue_items.append(
                ReviewerQueueItem(
                    ticket_id=t.get("ticket_id") or str(t.get("_id")),
                    title=t.get("title", "Untitled Complaint"),
                    channel=t.get("channel", "Web Form"),
                    customer_name=t.get("customer_name") or t.get("customer") or "Customer",
                    customer_email=t.get("customer_email"),
                    category=t.get("category", "General"),
                    department=t.get("department") or t.get("customer_department") or "Logistics",
                    urgency=t_urgency,
                    priority=t_priority,
                    sentiment=(t.get("genai_output", {}).get("sentiment") or t.get("sentiment") or "Neutral").capitalize(),
                    mismatch_type=t_mismatch_type,
                    conflict_reason=t_conflict_reason,
                    assigned_reviewer_id=t_reviewer_id,
                    assigned_reviewer_name=t.get("assigned_reviewer_name"),
                    created_at=created_at,
                    updated_at=updated_at
                )
            )

        return queue_items

    @classmethod
    async def get_side_by_side_payload(cls, ticket_id: str, db) -> Optional[ReviewerComparisonPayload]:
        """
        Assembles a comprehensive Side-by-Side Comparison payload from MongoDB Atlas between
        Customer Input, Pipeline 1 (GenAI Extraction), and Pipeline 2 (Python Ground Truth Rule Matrix).
        """
        tickets_col = db["tickets"]
        ticket = await tickets_col.find_one({"$or": [{"ticket_id": ticket_id}, {"_id": ticket_id}]})
        if not ticket:
            return None

        # 1. Customer Input & Entity Extraction
        raw_msg = ticket.get("description") or ticket.get("title") or "No raw message body"
        entities = cls.extract_entities(f"{ticket.get('title', '')} {raw_msg}")
        if ticket.get("order_id"):
            entities["order_id"] = ticket.get("order_id")

        customer_input = CustomerInputPayload(
            raw_message=raw_msg,
            channel=ticket.get("channel", "Web Form"),
            customer_name=ticket.get("customer_name") or ticket.get("customer") or "Customer",
            customer_email=ticket.get("customer_email"),
            customer_type=ticket.get("customer_type", "Regular Customer"),
            extracted_entities=entities
        )

        # 2. Pipeline 1 Output (GenAI)
        genai = ticket.get("genai_output") or {}
        p1_payload = Pipeline1GenAIPayload(
            primary_issue=genai.get("issue_category") or ticket.get("category") or "Unclassified Issue",
            secondary_issue=genai.get("subcategory") or ticket.get("sub_category"),
            sentiment=genai.get("sentiment") or ticket.get("sentiment") or "Neutral",
            urgency=genai.get("urgency") or ticket.get("urgency") or "Medium",
            priority=genai.get("priority") or ticket.get("priority") or "P2",
            category=genai.get("issue_category") or ticket.get("category") or "General",
            subcategory=genai.get("subcategory") or ticket.get("sub_category"),
            department=genai.get("department") or ticket.get("department") or "Logistics",
            policy_mapping={
                "policy_id": genai.get("policy_id") or ticket.get("policy_id") or "UNMAPPED",
                "policy_section": genai.get("policy_section") or "Section 4.1",
                "response_type": genai.get("response_type") or "Informative / Actionable"
            },
            drafted_response=genai.get("draft_response") or ticket.get("draft_response") or "Draft response pending.",
            resolution_steps=genai.get("resolution_steps") or ["Review customer claim", "Verify logistics manifest"],
            escalation_required=genai.get("escalation_required", False)
        )

        # 3. Pipeline 2 Output (Python Ground Truth)
        python_rule = ticket.get("python_rule_output") or {}
        eligibility = cls.evaluate_queue_eligibility(ticket)
        mismatch_detected = bool(eligibility)
        mismatch_type = eligibility["mismatch_type"] if eligibility else None
        mismatch_summary = eligibility["conflict_reason"] if eligibility else "Deterministic rules fully align with GenAI proposal."

        # Compute deterministic verdict
        verdict = PipelineVerdictEnum.APPROVE
        if mismatch_type == MismatchTypeEnum.PROMPT_INJECTION.value:
            verdict = PipelineVerdictEnum.BLOCK
        elif mismatch_type in [MismatchTypeEnum.HIGH_SENTIMENT_RISK.value, MismatchTypeEnum.UNAUTHORIZED_FEE_WAIVER.value]:
            verdict = PipelineVerdictEnum.ESCALATE
        elif mismatch_type == MismatchTypeEnum.PIPELINE_CONFLICT.value:
            verdict = PipelineVerdictEnum.BLOCK

        conflict_reasons = []
        if mismatch_detected:
            conflict_reasons.append(mismatch_summary)
        if not python_rule.get("category_verified", True):
            conflict_reasons.append(f"Ground-Truth rejected category '{p1_payload.category}' for this complaint pattern")

        p2_payload = Pipeline2PythonRulePayload(
            evaluated_rule_id=python_rule.get("matched_rule_id") or f"RULE-{p1_payload.category[:3].upper()}-001",
            pipeline_verdict=verdict,
            policy_exception_details=mismatch_summary if mismatch_detected else None,
            conflict_reasons=conflict_reasons,
            mandatory_actions=python_rule.get("mandatory_actions") or [
                "Verify customer identity before dispatching return label",
                "Check warehouse scan timestamp"
            ],
            prohibited_actions=python_rule.get("prohibited_actions") or [
                "Do not authorize instant cash refund without returned tracking scan",
                "Do not promise delivery within 2 hours"
            ],
            refund_eligible=python_rule.get("refund_eligible", False),
            confidence_score=python_rule.get("confidence_score", 100.0)
        )

        return ReviewerComparisonPayload(
            ticket_id=ticket.get("ticket_id") or str(ticket.get("_id")),
            status=ticket.get("status", "In Triage"),
            mismatch_detected=mismatch_detected,
            mismatch_type=mismatch_type,
            mismatch_summary=mismatch_summary,
            customer_input=customer_input,
            pipeline1_genai=p1_payload,
            pipeline2_python_rule=p2_payload,
            audit_history=ticket.get("assigned_agent_history") or []
        )

    @classmethod
    async def log_audit_override(
        cls,
        db,
        ticket_id: str,
        reviewer_id: str,
        reviewer_name: Optional[str],
        action: str,
        original_ai: Any,
        modified_output: Any,
        override_reason: str,
        conflict_type: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Creates an immutable audit record directly in MongoDB Atlas `reviewer_audit_logs` collection.
        """
        audit_doc = {
            "ticket_id": ticket_id,
            "reviewer_id": reviewer_id,
            "reviewer_name": reviewer_name,
            "action": action,
            "original_ai_output": original_ai if isinstance(original_ai, (dict, list)) else {"text": str(original_ai)},
            "reviewer_modified_output": modified_output if isinstance(modified_output, (dict, list)) else {"text": str(modified_output)},
            "override_reason": override_reason,
            "conflict_type": conflict_type,
            "timestamp": datetime.utcnow()
        }
        res = await db["reviewer_audit_logs"].insert_one(audit_doc)
        audit_doc["_id"] = str(res.inserted_id)
        audit_doc["id"] = str(res.inserted_id)
        return audit_doc

    @classmethod
    async def execute_reviewer_action(
        cls,
        ticket_id: str,
        req: ReviewerActionRequest,
        db
    ) -> ReviewerActionResponse:
        """
        Executes Reviewer actions in MongoDB Atlas:
        - APPROVE
        - MODIFY
        - RECLASSIFY
        - REGENERATE
        - ESCALATE_TO_MANAGER
        - ADD_INTERNAL_NOTE
        Logs every action to MongoDB Atlas `reviewer_audit_logs` and synchronizes ticket lifecycle.
        """
        tickets_col = db["tickets"]
        ticket = await tickets_col.find_one({"$or": [{"ticket_id": ticket_id}, {"_id": ticket_id}]})
        if not ticket:
            raise ValueError(f"Ticket with ID '{ticket_id}' not found.")

        t_id = ticket.get("ticket_id") or ticket_id
        original_ai = ticket.get("genai_output") or {
            "draft_response": ticket.get("draft_response"),
            "category": ticket.get("category"),
            "priority": ticket.get("priority")
        }

        now_iso = datetime.utcnow().isoformat()
        update_fields: Dict[str, Any] = {
            "updated_at": datetime.utcnow()
        }

        action_val = req.action.value
        modified_data: Dict[str, Any] = {}
        new_status = ticket.get("status", "In Triage")

        # 1. ACTION: APPROVE
        if req.action == ReviewerActionEnum.APPROVE:
            new_status = "In Triage"
            update_fields["status"] = new_status
            update_fields["match_status"] = True
            update_fields["requires_manual_review"] = False
            update_fields["reviewer_approved"] = True
            update_fields["assigned_reviewer_id"] = req.reviewer_id
            modified_data = {
                "decision": "APPROVED",
                "approved_draft_response": ticket.get("genai_output", {}).get("draft_response") or ticket.get("draft_response")
            }

        # 2. ACTION: MODIFY
        elif req.action == ReviewerActionEnum.MODIFY:
            if not req.modified_draft_response and not req.modified_category:
                raise ValueError("Action MODIFY requires 'modified_draft_response' or 'modified_category'.")

            if req.modified_draft_response:
                update_fields["draft_response"] = req.modified_draft_response
                if "genai_output" in ticket and isinstance(ticket["genai_output"], dict):
                    update_fields["genai_output.draft_response"] = req.modified_draft_response
                modified_data["draft_response"] = req.modified_draft_response

            if req.modified_category:
                update_fields["category"] = req.modified_category
                modified_data["category"] = req.modified_category

            if req.modified_subcategory:
                update_fields["sub_category"] = req.modified_subcategory
                modified_data["sub_category"] = req.modified_subcategory

            new_status = "In Triage"
            update_fields["status"] = new_status
            update_fields["match_status"] = True
            update_fields["requires_manual_review"] = False

        # 3. ACTION: RECLASSIFY
        elif req.action == ReviewerActionEnum.RECLASSIFY:
            if not req.modified_category:
                raise ValueError("Action RECLASSIFY requires 'modified_category'.")

            update_fields["category"] = req.modified_category
            modified_data["reclassified_category"] = req.modified_category

            if req.modified_subcategory:
                update_fields["sub_category"] = req.modified_subcategory
                modified_data["sub_category"] = req.modified_subcategory

            if req.modified_department:
                update_fields["department"] = req.modified_department
                modified_data["department"] = req.modified_department

            update_fields["match_status"] = True
            update_fields["requires_manual_review"] = False

        # 4. ACTION: REGENERATE (Calls Groq AI Engine with Reviewer Feedback)
        elif req.action == ReviewerActionEnum.REGENERATE:
            feedback = req.regenerate_feedback or req.override_reason
            ai_client = GroqAIClient()
            refreshed = ai_client.analyze_complaint(
                complaint_id=t_id,
                title=f"{ticket.get('title', '')} [REVIEWER DIRECTIVE: {feedback}]",
                description=f"{ticket.get('description', '')}\n\n[REVIEWER CRITIQUE & GUIDELINES]: {feedback}"
            )
            update_fields["genai_output"] = refreshed
            update_fields["draft_response"] = refreshed.get("draft_response")
            update_fields["category"] = refreshed.get("issue_category") or ticket.get("category")
            update_fields["priority"] = refreshed.get("priority") or ticket.get("priority")
            modified_data = refreshed

        # 5. ACTION: ESCALATE_TO_MANAGER
        elif req.action == ReviewerActionEnum.ESCALATE_TO_MANAGER:
            new_status = "Escalated"
            update_fields["status"] = new_status
            update_fields["priority"] = "P0"
            update_fields["escalation_flag"] = True
            if req.escalate_to_manager_id:
                update_fields["escalated_to_manager_id"] = req.escalate_to_manager_id
            modified_data = {
                "escalated": True,
                "escalated_to_manager_id": req.escalate_to_manager_id,
                "priority_elevated_to": "P0"
            }

        # 6. ACTION: ADD_INTERNAL_NOTE
        elif req.action == ReviewerActionEnum.ADD_INTERNAL_NOTE:
            if not req.internal_note:
                raise ValueError("Action ADD_INTERNAL_NOTE requires 'internal_note'.")
            modified_data = {"internal_note": req.internal_note}

        # Persist to MongoDB Atlas `reviewer_audit_logs` collection
        log_entry = await cls.log_audit_override(
            db=db,
            ticket_id=t_id,
            reviewer_id=req.reviewer_id,
            reviewer_name=req.reviewer_name,
            action=action_val,
            original_ai=original_ai,
            modified_output=modified_data,
            override_reason=req.override_reason,
            conflict_type=req.action.value
        )

        # Synchronize ticket audit history in MongoDB Atlas
        audit_history_record = {
            "timestamp": now_iso,
            "action": f"REVIEWER_{action_val}",
            "reviewer_id": req.reviewer_id,
            "reviewer_name": req.reviewer_name,
            "reason": req.override_reason,
            "note": req.internal_note or f"Executed {action_val} override.",
            "mongo_log_id": log_entry["id"]
        }

        await tickets_col.update_one(
            {"_id": ticket["_id"]},
            {
                "$set": update_fields,
                "$push": {
                    "assigned_agent_history": audit_history_record,
                    "reviewer_audit_notes": {
                        "reviewer_id": req.reviewer_id,
                        "text": req.internal_note or req.override_reason,
                        "timestamp": now_iso
                    }
                }
            }
        )

        updated_ticket = await tickets_col.find_one({"_id": ticket["_id"]})
        if updated_ticket and "_id" in updated_ticket:
            updated_ticket["_id"] = str(updated_ticket["_id"])

        # Broadcast real-time WebSocket event to all connected clients (Zero Reload)
        try:
            from lib.websocket_manager import ws_manager
            await ws_manager.notify_reviewer_action(
                ticket_id=t_id,
                action=action_val,
                reviewer_name=req.reviewer_name or req.reviewer_id,
                new_status=new_status
            )
            await ws_manager.notify_ticket_updated(t_id, {"status": new_status, "action": action_val})
            await ws_manager.notify_agent_workload_change()
        except Exception as wse:
            print(f"[WS BROADCAST NOTICE] {wse}")

        return ReviewerActionResponse(
            success=True,
            message=f"Reviewer action '{action_val}' successfully executed and committed to MongoDB Atlas audit log.",
            ticket_id=t_id,
            action_executed=action_val,
            new_status=new_status,
            audit_log_id=log_entry["id"],
            updated_ticket=updated_ticket
        )

    @classmethod
    async def get_audit_logs_for_ticket(cls, ticket_id: str, db) -> List[AuditReviewerLogResponse]:
        """Retrieves all immutable audit log records for a ticket from MongoDB Atlas `reviewer_audit_logs`."""
        cursor = db["reviewer_audit_logs"].find({"ticket_id": ticket_id}).sort("timestamp", -1)
        records = await cursor.to_list(length=100)
        
        results = []
        for r in records:
            ts = r.get("timestamp")
            if isinstance(ts, str):
                try:
                    ts = datetime.fromisoformat(ts.replace("Z", "+00:00"))
                except Exception:
                    ts = datetime.utcnow()
            elif not ts:
                ts = datetime.utcnow()

            results.append(
                AuditReviewerLogResponse(
                    id=str(r.get("_id") or r.get("id")),
                    ticket_id=r.get("ticket_id"),
                    reviewer_id=r.get("reviewer_id"),
                    reviewer_name=r.get("reviewer_name"),
                    action=r.get("action"),
                    original_ai_output=r.get("original_ai_output"),
                    reviewer_modified_output=r.get("reviewer_modified_output"),
                    override_reason=r.get("override_reason"),
                    conflict_type=r.get("conflict_type"),
                    timestamp=ts
                )
            )
        return results
