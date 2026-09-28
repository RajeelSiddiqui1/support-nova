import pytest
from services.complaint_intelligence import ComplaintIntelligenceService


def test_multi_department_routing_full_match():
    rule_matrix = [
        {
            "category": "Billing & Payments",
            "department": "Billing & Payments",
            "supporting_departments": ["Returns & Exchanges"],
            "is_active": True
        }
    ]
    result = ComplaintIntelligenceService.validate_multi_department_routing(
        primary_issue={"category": "Billing & Payments"},
        secondary_issues=[{"category": "Returns & Exchanges"}],
        genai_primary_dept="Billing & Payments",
        genai_supporting_depts=["Returns & Exchanges"],
        rule_matrix=rule_matrix
    )
    assert result["routing_match"] == "full"
    assert result["department_mismatch"] is False
    assert result["verified_primary_department"] == "Billing & Payments"


def test_multi_department_routing_detects_mismatch():
    rule_matrix = [
        {
            "category": "Order Inquiry",
            "department": "Logistics & Delivery",
            "supporting_departments": [],
            "is_active": True
        }
    ]
    result = ComplaintIntelligenceService.validate_multi_department_routing(
        primary_issue={"category": "Order Inquiry"},
        secondary_issues=[],
        genai_primary_dept="Returns & Exchanges",  # Mismatched! Expected Logistics
        genai_supporting_depts=[],
        rule_matrix=rule_matrix
    )
    assert result["routing_match"] in ["none", "partial"]
    assert result["department_mismatch"] is True
    assert result["verified_primary_department"] == "Logistics & Delivery"
