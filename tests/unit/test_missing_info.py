import pytest
from services.complaint_intelligence import ComplaintIntelligenceService


def test_missing_info_detects_missing_order_id():
    ticket_data = {
        "title": "Where is my package?",
        "description": "I ordered clothes last week and haven't received them.",
        "order_id": None
    }
    result = ComplaintIntelligenceService.detect_missing_info(
        ticket_data=ticket_data,
        category="Order Inquiry"
    )
    assert result["has_missing_info"] is True
    assert "order_id" in result["missing_fields"]
    assert result["severity"] == "HIGH"


def test_missing_info_passes_when_order_id_in_description():
    ticket_data = {
        "title": "Package delay",
        "description": "Regarding my order NW-88912, it has not arrived yet.",
        "order_id": None
    }
    result = ComplaintIntelligenceService.detect_missing_info(
        ticket_data=ticket_data,
        category="Order Inquiry"
    )
    assert "order_id" not in result["missing_fields"]


def test_missing_info_passes_when_all_required_fields_present():
    ticket_data = {
        "title": "Wrong size received",
        "description": "I received size S instead of M shirt for order NW-12345.",
        "order_id": "NW-12345",
        "attachments": ["https://s3.amazonaws.com/evidence/shirt.jpg"]
    }
    result = ComplaintIntelligenceService.detect_missing_info(
        ticket_data=ticket_data,
        category="Product Quality & Defects"
    )
    assert result["has_missing_info"] is False
    assert result["severity"] == "NONE"


def test_missing_info_detects_missing_evidence_for_defective_goods():
    ticket_data = {
        "title": "Torn jacket",
        "description": "The jacket arrived with a ripped seam on the left sleeve for order NW-9900.",
        "order_id": "NW-9900",
        "attachments": []
    }
    result = ComplaintIntelligenceService.detect_missing_info(
        ticket_data=ticket_data,
        category="Product Quality & Defects"
    )
    assert "evidence" in result["missing_fields"]
    assert result["has_missing_info"] is True


def test_missing_info_short_description_flagged():
    ticket_data = {
        "title": "Bad item",
        "description": "Broken.",  # < 15 characters
        "order_id": "NW-1111"
    }
    result = ComplaintIntelligenceService.detect_missing_info(
        ticket_data=ticket_data,
        category="General"
    )
    assert "description" in result["missing_fields"]
