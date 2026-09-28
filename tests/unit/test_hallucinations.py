import pytest
from services.complaint_intelligence import ComplaintIntelligenceService


def test_hallucination_detects_untraceable_dollar_amount():
    genai_output = {
        "policy_id": "WP-POL-01",
        "draft_response": "We have credited your account with a $250.00 compensation payment.",
        "resolution_steps": ["Credit account"]
    }
    complaint_text = "My jacket arrived with a loose button on order NW-1122."

    has_hallucination, flags, promises = ComplaintIntelligenceService.detect_hallucinations(
        genai_output=genai_output,
        complaint_text=complaint_text
    )
    assert has_hallucination is True
    assert any(f["type"] == "UNTRACEABLE_FACT" for f in flags)


def test_hallucination_detects_prohibited_action():
    rule_matrix = [
        {
            "category": "Returns & Refunds",
            "prohibited_actions": ["30% discount", "waive restocking fee"]
        }
    ]
    genai_output = {
        "policy_id": "REF-POL-01",
        "draft_response": "As a courtesy, we will provide a 30% discount on your next purchase.",
        "resolution_steps": ["Provide 30% discount"]
    }
    complaint_text = "I ordered wrong size boots."

    has_hallucination, flags, promises = ComplaintIntelligenceService.detect_hallucinations(
        genai_output=genai_output,
        complaint_text=complaint_text,
        rule_matrix=rule_matrix
    )
    assert has_hallucination is True
    assert any(f["type"] == "PROHIBITED_ACTION" for f in flags)


def test_hallucination_detects_unauthorized_guarantee():
    genai_output = {
        "policy_id": "DEL-POL-01",
        "draft_response": "We guarantee your package will arrive tomorrow or we offer an unconditional refund.",
        "resolution_steps": ["Promise arrival"]
    }
    complaint_text = "Where is my package NW-1234?"

    has_hallucination, flags, promises = ComplaintIntelligenceService.detect_hallucinations(
        genai_output=genai_output,
        complaint_text=complaint_text
    )
    assert has_hallucination is True
    assert any(f["type"] == "UNAUTHORIZED_PROMISE" for f in flags)


def test_hallucination_detects_invalid_policy_citation():
    genai_output = {
        "policy_id": "FAKE-POLICY-999",
        "draft_response": "Per company guidelines, we have received your request.",
        "resolution_steps": ["Check request"]
    }
    complaint_text = "My package arrived late."

    has_hallucination, flags, promises = ComplaintIntelligenceService.detect_hallucinations(
        genai_output=genai_output,
        complaint_text=complaint_text,
        active_policy_ids=["DEL-POL-01", "REF-POL-01"]
    )
    assert has_hallucination is True
    assert any(f["type"] == "INVALID_POLICY_CITATION" for f in flags)


def test_valid_draft_passes_without_hallucinations():
    genai_output = {
        "policy_id": "DEL-POL-01",
        "draft_response": "We apologize for the delivery delay on order NW-5566. Our team has contacted the courier.",
        "resolution_steps": ["Contact courier", "Provide tracking update"]
    }
    complaint_text = "My order NW-5566 has been delayed for 3 days."

    has_hallucination, flags, promises = ComplaintIntelligenceService.detect_hallucinations(
        genai_output=genai_output,
        complaint_text=complaint_text,
        active_policy_ids=["DEL-POL-01"]
    )
    assert has_hallucination is False
    assert len(flags) == 0
