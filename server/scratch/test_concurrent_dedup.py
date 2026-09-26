import asyncio
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from lib.db import connect_to_mongo, close_mongo_connection, get_database
from email_ingestion import (
    process_single_email_message,
    compute_email_fingerprint,
    ensure_email_indexes
)

class MockEmailMessage:
    def __init__(self, uid, sender, subject, body, msg_id):
        self.uid = uid
        self.from_ = sender
        self.to = ["support@novawearapparel.com"]
        self.subject = subject
        self.text = body
        self.html = ""
        self.date = "2026-09-26 10:00:00"
        self.headers = {"message-id": [f"<{msg_id}>"]}
        self.obj = None

async def run_concurrent_test():
    await connect_to_mongo()
    db = get_database()
    await ensure_email_indexes(db)

    # Clean up test tickets
    test_uid = "99999"
    test_msg_id = "test-concurrent-msg-12345@mail.gmail.com"
    test_subject = "Damaged suit received - Order #ORD-NW-9921"
    test_sender = "test.concurrency@gmail.com"

    await db.tickets.delete_many({"customer_email": test_sender})
    await db.processed_emails.delete_many({"uid": test_uid})

    mock_msg = MockEmailMessage(
        uid=test_uid,
        sender=test_sender,
        subject=test_subject,
        body="Hi NovaWear Team, mera order #ORD-NW-9921 aaj deliver hua hai lekin shirt ki side seam par stitching fati hui hai. Please exchange.",
        msg_id=test_msg_id
    )

    print("Firing 3 simultaneous worker threads for the EXACT SAME incoming email...")

    # Launch 3 simultaneous tasks
    results = await asyncio.gather(
        process_single_email_message(mock_msg, db, "support@novawearapparel.com"),
        process_single_email_message(mock_msg, db, "support@novawearapparel.com"),
        process_single_email_message(mock_msg, db, "support@novawearapparel.com")
    )

    print("\n--- Concurrency Test Results ---")
    created_count = 0
    skipped_count = 0
    for i, r in enumerate(results):
        status = r.get("status")
        print(f"Worker {i+1} status: {status}")
        if status == "ticket_created":
            created_count += 1
        elif status == "already_processed":
            skipped_count += 1

    # Check database tickets count
    db_tickets = await db.tickets.find({"customer_email": test_sender}).to_list(10)
    print(f"\nTotal Tickets Created in Database: {len(db_tickets)}")
    for t in db_tickets:
        print(f"-> Ticket ID: {t.get('ticket_id')} | Title: {t.get('title')}")

    # Assertions
    assert created_count == 1, f"Expected exactly 1 ticket created, but got {created_count}!"
    assert skipped_count == 2, f"Expected 2 duplicate attempts to be blocked, but got {skipped_count}!"
    assert len(db_tickets) == 1, f"Expected 1 ticket in database, but found {len(db_tickets)}!"

    print("\n[VERIFICATION PASS] Concurrency Lock & Deduplication passed with 100% accuracy!")

    # Cleanup
    await db.tickets.delete_many({"customer_email": test_sender})
    await db.processed_emails.delete_many({"uid": test_uid})
    await close_mongo_connection()

if __name__ == "__main__":
    asyncio.run(run_concurrent_test())
