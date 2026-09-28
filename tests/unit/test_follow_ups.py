from datetime import datetime
import pytest
from services.complaint_intelligence import ComplaintIntelligenceService


def test_generate_follow_up_schedules_future_timestamp():
    service = ComplaintIntelligenceService()
    now = datetime.utcnow()
    item = service.generate_follow_up_message(
        ticket_id="TICK-1234",
        title="Delayed shipping",
        customer_name="Alice Smith",
        category="Order Inquiry",
        status="In Progress",
        follow_up_type="RESOLUTION_CHECK",
        custom_delay_hours=48
    )
    assert item["status"] == "SCHEDULED"
    assert item["type"] == "RESOLUTION_CHECK"
    assert item["scheduled_at"] > now
    assert "TICK-1234" in item["message"]
    assert item["id"].startswith("FOL-")
