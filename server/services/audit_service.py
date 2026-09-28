"""
NovaWear SupportNova — Universal Audit Service (F16).
Records all automated decisions and human reviewer overrides:
- Escalation overrides (Python rule vs GenAI)
- Hallucination detections
- Document supersede events
- Follow-up dispatches
- Clarification question answers
- Reviewer manual queue overrides
Preserves original value, new value, actor, reason, and timestamp.
"""

from datetime import datetime
from typing import Dict, Any, Optional

try:
    from lib.db import get_database
except ImportError:
    from server.lib.db import get_database


class AuditService:
    """Universal audit logger for compliance and operational governance."""

    @staticmethod
    async def log_event(
        event_type: str,
        ticket_id: str,
        actor: str,
        actor_id: str,
        original_value: Any,
        new_value: Any,
        reason: str,
        db: Optional[Any] = None,
        extra_meta: Optional[Dict[str, Any]] = None
    ) -> Optional[str]:
        """
        Logs an automated or manual decision into `system_audit_logs` and `tickets.audit_trail`.
        """
        if db is None:
            try:
                db = get_database()
            except Exception:
                db = None

        log_doc = {
            "event_type": event_type,
            "ticket_id": ticket_id,
            "actor": actor,  # "SYSTEM_PYTHON_RULE", "SYSTEM_PIPELINE", "REVIEWER", "CUSTOMER"
            "actor_id": actor_id,
            "original_value": original_value,
            "new_value": new_value,
            "reason": reason,
            "extra_meta": extra_meta or {},
            "timestamp": datetime.utcnow()
        }

        if db is not None:
            try:
                res = await db.system_audit_logs.insert_one(log_doc)
                log_id = str(res.inserted_id)

                # Also append to ticket's embedded audit trail if ticket exists
                trail_item = {
                    "event_type": event_type,
                    "actor": actor,
                    "actor_id": actor_id,
                    "reason": reason,
                    "timestamp": log_doc["timestamp"].isoformat()
                }
                await db.tickets.update_one(
                    {"ticket_id": ticket_id},
                    {"$push": {"audit_trail": trail_item}}
                )
                return log_id
            except Exception as e:
                print(f"[AUDIT LOG WARNING] Failed to insert audit log for {ticket_id}: {e}")

        return None

    @staticmethod
    async def log_reviewer_override(
        ticket_id: str,
        reviewer_id: str,
        reviewer_name: str,
        action: str,
        original_ai_output: Any,
        reviewer_modified_output: Any,
        override_reason: str,
        conflict_type: Optional[str] = None,
        db: Optional[Any] = None
    ) -> Optional[str]:
        """
        Maintains strict compatibility with existing `reviewer_audit_logs` collection.
        """
        if db is None:
            try:
                db = get_database()
            except Exception:
                db = None

        log_doc = {
            "ticket_id": ticket_id,
            "reviewer_id": reviewer_id,
            "reviewer_name": reviewer_name,
            "action": action,
            "original_ai_output": original_ai_output,
            "reviewer_modified_output": reviewer_modified_output,
            "override_reason": override_reason,
            "conflict_type": conflict_type,
            "timestamp": datetime.utcnow()
        }

        if db is not None:
            try:
                res = await db.reviewer_audit_logs.insert_one(log_doc)
                return str(res.inserted_id)
            except Exception as e:
                print(f"[REVIEWER AUDIT WARNING] Failed to insert reviewer audit log for {ticket_id}: {e}")

        return None
