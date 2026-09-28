import pytest
from models.kb_doc import DocStatus, PolicyApplicabilityEnum, PolicyImpactCheckResponse


def test_doc_status_enum_values():
    assert DocStatus.ACTIVE.value.upper() == "ACTIVE"
    assert DocStatus.SUPERSEDED.value == "SUPERSEDED"
    assert DocStatus.DRAFT.value == "DRAFT"
    assert DocStatus.EXPIRED.value == "EXPIRED"


def test_policy_precedence_ordering():
    policies = [
        {"doc_id": "POL-GEN-01", "precedence_level": 3, "category": "General"},
        {"doc_id": "POL-VIP-01", "precedence_level": 1, "category": "VIP"},
        {"doc_id": "POL-DEPT-01", "precedence_level": 2, "category": "Department"}
    ]
    # Lower number = higher priority
    sorted_policies = sorted(policies, key=lambda x: x["precedence_level"])
    assert sorted_policies[0]["doc_id"] == "POL-VIP-01"
    assert sorted_policies[1]["doc_id"] == "POL-DEPT-01"
    assert sorted_policies[2]["doc_id"] == "POL-GEN-01"


def test_policy_impact_check_response_model():
    res = PolicyImpactCheckResponse(
        document_id="POL-RET-2023",
        new_version="v2.0",
        affected_open_tickets=["TICK-001", "TICK-002"],
        affected_count=2,
        message="2 open tickets affected."
    )
    assert res.affected_count == 2
    assert "TICK-001" in res.affected_open_tickets
