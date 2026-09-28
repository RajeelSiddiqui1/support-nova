import pytest
from tests.fixtures.scenarios import SCENARIOS
from services.complaint_intelligence import ComplaintIntelligenceService
from services.config_service import ConfigService


def test_scenario_1_angry_but_low_risk():
    scenario = SCENARIOS["angry_but_low_risk"]
    payload = scenario["complaint_payload"]
    expected = scenario["expected_python"]

    # Preprocessing
    prep = ComplaintIntelligenceService.validate_and_preprocess_complaint(
        raw_title=payload["title"],
        raw_description=payload["description"],
        customer_id="CUST-1",
        order_id=payload["order_id"]
    )
    assert prep["is_valid"] is True

    # Adversarial check: despite aggressive tone, no injection
    adv_flags = ComplaintIntelligenceService.detect_adversarial_patterns(
        text=prep["normalized_description"],
        rules=ConfigService.DEFAULT_ADVERSARIAL_RULES
    )
    assert len(adv_flags) == 0

    # Escalation check: no safety / legal triggers
    esc = ComplaintIntelligenceService.evaluate_escalation_rules(
        ticket_data={"title": prep["normalized_title"], "description": prep["normalized_description"]},
        rules=ConfigService.DEFAULT_ESCALATION_RULES
    )
    assert esc["escalation_required"] is expected["escalation_required"]

    # Missing info check: order_id is present
    missing = ComplaintIntelligenceService.detect_missing_info(
        ticket_data=payload,
        category="Order Inquiry"
    )
    assert missing["has_missing_info"] is False


def test_scenario_2_calm_but_safety_critical():
    scenario = SCENARIOS["calm_but_safety_critical"]
    payload = scenario["complaint_payload"]
    genai = scenario["genai_proposal"]
    expected = scenario["expected_python"]

    # Evaluate escalation rules: must trigger safety laceration rule
    esc = ComplaintIntelligenceService.evaluate_escalation_rules(
        ticket_data=payload,
        rules=ConfigService.DEFAULT_ESCALATION_RULES
    )
    assert esc["escalation_required"] is expected["escalation_required"]
    assert any("SAFE" in r for r in esc["triggered_rules"])

    # Conflict check: GenAI said False, Python says True -> Escalation Mismatch -> AI Review
    assert genai["escalation_required"] != esc["escalation_required"]
    mismatch_type = "ESCALATION_MISMATCH"
    assert mismatch_type == expected["mismatch_type"]


def test_scenario_3_prompt_injection():
    scenario = SCENARIOS["prompt_injection"]
    payload = scenario["complaint_payload"]
    expected = scenario["expected_python"]

    adv_flags = ComplaintIntelligenceService.detect_adversarial_patterns(
        text=f"{payload['title']} {payload['description']}",
        rules=ConfigService.DEFAULT_ADVERSARIAL_RULES
    )
    assert len(adv_flags) > 0
    assert any(f["pattern_id"] in ["ADV-001", "ADV-INJ-01"] for f in adv_flags)


def test_scenario_4_unsupported_refund():
    scenario = SCENARIOS["unsupported_refund"]
    payload = scenario["complaint_payload"]
    genai = scenario["genai_proposal"]

    # Matrix rule where 60+ days return is prohibited
    rule_matrix = [
        {
            "category": "Returns & Refunds",
            "prohibited_actions": ["full refund", "unconditional refund"]
        }
    ]
    has_hallucination, flags, promises = ComplaintIntelligenceService.detect_hallucinations(
        genai_output=genai,
        complaint_text=f"{payload['title']} {payload['description']}",
        rule_matrix=rule_matrix
    )
    assert has_hallucination is True
    assert any(f["type"] == "PROHIBITED_ACTION" for f in flags)


def test_scenario_5_missing_order_id():
    scenario = SCENARIOS["missing_order_id"]
    payload = scenario["complaint_payload"]
    expected = scenario["expected_python"]

    res = ComplaintIntelligenceService.detect_missing_info(
        ticket_data=payload,
        category="Order Inquiry"
    )
    assert res["has_missing_info"] is True
    assert expected["missing_fields"][0] in res["missing_fields"]


def test_scenario_6_three_issue_complaint():
    scenario = SCENARIOS["three_issue_complaint"]
    genai = scenario["genai_proposal"]
    expected = scenario["expected_python"]

    rule_matrix = [
        {"category": "Billing & Payments", "department": "Billing & Payments", "is_active": True},
        {"category": "Returns & Refunds", "department": "Returns & Exchanges", "is_active": True},
        {"category": "Order Inquiry", "department": "Logistics & Delivery", "is_active": True}
    ]

    routing_result = ComplaintIntelligenceService.validate_multi_department_routing(
        primary_issue={"category": genai["category"]},
        secondary_issues=genai["secondary_issues"],
        genai_primary_dept=genai["department"],
        genai_supporting_depts=genai["supporting_departments"],
        rule_matrix=rule_matrix
    )

    assert routing_result["verified_primary_department"] == expected["primary_department"]
    assert len(routing_result["secondary_issue_departments"]) == expected["secondary_count"]
    assert "Returns & Exchanges" in routing_result["verified_supporting_departments"]
    assert "Logistics & Delivery" in routing_result["verified_supporting_departments"]


def test_scenario_7_repeat_complaint_different_wording():
    scenario = SCENARIOS["repeat_complaint_different_wording"]
    prior = scenario["prior_ticket"]
    payload = scenario["new_complaint_payload"]
    expected = scenario["expected_python"]

    is_repeat, related_ids, count, score = ComplaintIntelligenceService.check_repeat_complaint(
        current_title=payload["title"],
        current_description=payload["description"],
        order_id=payload["order_id"],
        customer_id="CUST-1",
        prior_tickets=[prior]
    )

    assert is_repeat is expected["is_repeat"]
    assert expected["duplicate_of"] in related_ids


def test_scenario_8_superseded_policy_citation():
    scenario = SCENARIOS["superseded_policy_citation"]
    payload = scenario["complaint_payload"]
    genai = scenario["genai_proposal"]
    active_policies = scenario["active_policies"]

    # Active policy list only contains docs with status == "ACTIVE"
    active_doc_ids = [p["doc_id"] for p in active_policies if p["status"] == "ACTIVE"]

    has_hallucination, flags, promises = ComplaintIntelligenceService.detect_hallucinations(
        genai_output=genai,
        complaint_text=f"{payload['title']} {payload['description']}",
        active_policy_ids=active_doc_ids
    )

    assert has_hallucination is True
    assert any(f["type"] == "INVALID_POLICY_CITATION" for f in flags)
