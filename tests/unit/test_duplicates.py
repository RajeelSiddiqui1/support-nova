import pytest
from services.complaint_intelligence import ComplaintIntelligenceService


def test_repeat_complaint_exact_order_match():
    prior_tickets = [
        {
            "ticket_id": "TICK-OLD-01",
            "order_id": "NW-8899",
            "title": "Where is my package?",
            "description": "It has not arrived yet.",
            "status": "In Progress"
        }
    ]
    is_repeat, related_ids, count, sim = ComplaintIntelligenceService.check_repeat_complaint(
        current_title="Status update please",
        current_description="Can someone tell me where my order NW-8899 is?",
        order_id="NW-8899",
        customer_id="CUST-1",
        prior_tickets=prior_tickets
    )
    assert is_repeat is True
    assert "TICK-OLD-01" in related_ids
    assert count == 1
    assert sim == 1.0


def test_repeat_complaint_text_similarity():
    prior_tickets = [
        {
            "ticket_id": "TICK-OLD-02",
            "order_id": "NW-0001",
            "title": "Denim jacket has torn pocket and missing button",
            "description": "The denim jacket arrived with torn stitching on right pocket and missing front button.",
            "status": "In Progress"
        }
    ]
    # Similar complaint text but different order_id query
    is_repeat, related_ids, count, sim = ComplaintIntelligenceService.check_repeat_complaint(
        current_title="Damaged denim jacket button and torn pocket",
        current_description="My denim jacket has a torn right pocket and the front button is missing completely.",
        order_id="NW-9999",
        customer_id="CUST-1",
        prior_tickets=prior_tickets,
        similarity_threshold=0.70
    )
    assert is_repeat is True
    assert "TICK-OLD-02" in related_ids
    assert sim >= 0.70


def test_exact_content_hash_deduplication():
    res1 = ComplaintIntelligenceService.validate_and_preprocess_complaint(
        raw_title="Late Delivery",
        raw_description="My parcel NW-5555 is 5 days late.",
        customer_id="CUST-1",
        order_id="NW-5555"
    )
    res2 = ComplaintIntelligenceService.validate_and_preprocess_complaint(
        raw_title="Late Delivery",
        raw_description="My parcel NW-5555 is 5 days late.",
        customer_id="CUST-1",
        order_id="NW-5555"
    )
    assert res1["content_hash"] == res2["content_hash"]
