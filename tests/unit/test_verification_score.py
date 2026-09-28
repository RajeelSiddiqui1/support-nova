import pytest
from services.complaint_intelligence import ComplaintIntelligenceService
from services.config_service import ConfigService


def test_verification_score_perfect_match():
    genai_output = {
        "category": "Order Inquiry",
        "department": "Logistics & Delivery",
        "priority": "P2",
        "urgency": "Medium",
        "escalation_required": False,
        "policy_id": "DEL-POL-01"
    }
    python_output = {
        "category_verified": True,
        "verified_primary_department": "Logistics & Delivery",
        "escalation_required": False,
        "policy_reference": "DEL-POL-01"
    }

    score, breakdown = ComplaintIntelligenceService.calculate_verification_score(
        genai_output=genai_output,
        python_output=python_output,
        has_hallucination=False,
        weights_config=ConfigService.DEFAULT_VERIFICATION_WEIGHTS
    )

    assert score == 100.0
    assert breakdown["category"]["earned"] == 20.0
    assert breakdown["department"]["earned"] == 20.0
    assert breakdown["escalation"]["earned"] == 20.0
    assert breakdown["policy_citation"]["earned"] == 15.0
    assert breakdown["hallucination_absence"]["earned"] == 10.0


def test_verification_score_degrades_on_mismatch_and_hallucination():
    genai_output = {
        "category": "Billing & Payments",
        "department": "Billing & Payments",
        "priority": "P0",
        "urgency": "Low",  # Mismatch: P0 with Low urgency
        "escalation_required": False,  # Mismatch: GenAI False vs Python True
        "policy_id": "FAKE-01"
    }
    python_output = {
        "category_verified": True,
        "verified_primary_department": "Legal & Compliance",  # Dept mismatch
        "escalation_required": True,  # Escalation mismatch
        "policy_reference": "POL-LEG-01"
    }

    score, breakdown = ComplaintIntelligenceService.calculate_verification_score(
        genai_output=genai_output,
        python_output=python_output,
        has_hallucination=True,  # Hallucination present
        weights_config=ConfigService.DEFAULT_VERIFICATION_WEIGHTS
    )

    assert score < 50.0
    assert breakdown["department"]["earned"] == 0.0
    assert breakdown["escalation"]["earned"] == 0.0
    assert breakdown["hallucination_absence"]["earned"] == 0.0
