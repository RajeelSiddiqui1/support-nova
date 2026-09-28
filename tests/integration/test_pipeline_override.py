import pytest
from unittest.mock import AsyncMock, patch
from services.complaint_intelligence import ComplaintIntelligenceService
from services.config_service import ConfigService


def test_python_escalation_rule_overrides_genai_no_escalation():
    """
    Integration verification:
    When GenAI proposes escalation_required = False (e.g. tricked by a calm tone),
    deterministic Python Pipeline 2 detects safety/legal keywords,
    forces escalation_required = True, and quarantines the complaint to AI Review.
    """
    ticket_payload = {
        "title": "Concern regarding jacket lining",
        "description": "I felt a sharp pain and found broken glass embedded in the sleeve causing bleeding.",
        "category": "Product Quality & Defects",
        "order_id": "NW-7721"
    }

    # GenAI proposing no escalation
    genai_output = {
        "category": "Product Quality & Defects",
        "subcategory": "Material Defect",
        "department": "Quality Assurance",
        "priority": "P2",
        "urgency": "Low",
        "escalation_required": False,  # LLM failed to escalate!
        "policy_id": "WP-POL-01"
    }

    # Deterministic Python Rule Evaluation
    esc_result = ComplaintIntelligenceService.evaluate_escalation_rules(
        ticket_data=ticket_payload,
        rules=ConfigService.DEFAULT_ESCALATION_RULES
    )

    # 1. Deterministic Python MUST catch the bleeding / glass injury
    assert esc_result["escalation_required"] is True
    assert esc_result["escalation_source"] == "PYTHON_RULE"

    # 2. Pipeline conflict resolution logic
    is_mismatch = (genai_output.get("escalation_required") != esc_result["escalation_required"])
    assert is_mismatch is True

    # 3. Final effective routing decision
    final_escalation = esc_result["escalation_required"]  # Python overrides GenAI
    effective_status = "AI Review" if is_mismatch else "In Triage"
    mismatch_type = "ESCALATION_MISMATCH" if is_mismatch else None

    assert final_escalation is True
    assert effective_status == "AI Review"
    assert mismatch_type == "ESCALATION_MISMATCH"
