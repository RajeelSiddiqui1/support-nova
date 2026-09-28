import pytest
from services.complaint_intelligence import ComplaintIntelligenceService
from services.config_service import ConfigService


def test_escalation_triggers_on_safety_hazard():
    ticket = {
        "title": "Severe injury from defective garment",
        "description": "A metal wire poked through the zipper causing bleeding and laceration."
    }
    result = ComplaintIntelligenceService.evaluate_escalation_rules(
        ticket_data=ticket,
        rules=ConfigService.DEFAULT_ESCALATION_RULES
    )
    assert result["escalation_required"] is True
    assert any("SAFE" in r for r in result["triggered_rules"])
    assert result["escalation_source"] == "PYTHON_RULE"


def test_escalation_triggers_on_legal_threat():
    ticket = {
        "title": "Contacting my attorney",
        "description": "If this refund is not processed today, my lawyer will file a lawsuit in small claims court."
    }
    result = ComplaintIntelligenceService.evaluate_escalation_rules(
        ticket_data=ticket,
        rules=ConfigService.DEFAULT_ESCALATION_RULES
    )
    assert result["escalation_required"] is True
    assert any("LEG" in r for r in result["triggered_rules"])


def test_escalation_triggers_on_high_monetary_value():
    ticket = {
        "title": "Bulk order issue",
        "description": "Our corporate order was damaged in transit."
    }
    entities = {"amount": 1250.0}
    result = ComplaintIntelligenceService.evaluate_escalation_rules(
        ticket_data=ticket,
        entities=entities,
        rules=ConfigService.DEFAULT_ESCALATION_RULES
    )
    assert result["escalation_required"] is True
    assert "ESC-VAL-01" in result["triggered_rules"]


def test_escalation_triggers_on_repeat_count():
    ticket = {
        "title": "Still waiting for help",
        "description": "This is my third time contacting support about my missing shirt."
    }
    result = ComplaintIntelligenceService.evaluate_escalation_rules(
        ticket_data=ticket,
        repeat_count=3,
        rules=ConfigService.DEFAULT_ESCALATION_RULES
    )
    assert result["escalation_required"] is True
    assert "ESC-REP-01" in result["triggered_rules"]


def test_no_escalation_for_standard_polite_inquiry():
    ticket = {
        "title": "Where is my sweater?",
        "description": "Hi there, could you let me know if order NW-1234 has shipped yet? Thank you!"
    }
    result = ComplaintIntelligenceService.evaluate_escalation_rules(
        ticket_data=ticket,
        rules=ConfigService.DEFAULT_ESCALATION_RULES
    )
    assert result["escalation_required"] is False
    assert len(result["triggered_rules"]) == 0
