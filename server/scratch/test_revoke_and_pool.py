import asyncio
from datetime import datetime
from lib.db import get_database, connect_to_mongo, close_mongo_connection
from routes.ticket_routes import (
    reassign_ticket,
    release_ticket_to_pool,
    update_ticket_status,
    dispatch_email_reply,
    evaluate_policy_compliance,
    ReassignTicketRequest,
    ReleaseToPoolRequest,
    StatusUpdateRequest,
    EmailReplyRequest
)
from fastapi import HTTPException

async def run_audit():
    print("=" * 60)
    print("STARTING MANAGER SMART AUDIT & REVOCATION TO POOL TEST")
    print("=" * 60)

    await connect_to_mongo()
    db = get_database()

    # Step 0: Create test agents and manager in Cloud / Ebook department
    agent_a = {
        "user_id": "TEST-AGT-01",
        "name": "Underperforming Agent A",
        "email": "agent_a@novawearapparel.com",
        "role": "AGENT",
        "department": "Cloud",
        "department_id": "DEP-002",
        "status": "ACTIVE"
    }
    agent_b = {
        "user_id": "TEST-AGT-02",
        "name": "Parallel Star Agent B",
        "email": "agent_b@novawearapparel.com",
        "role": "AGENT",
        "department": "Cloud",
        "department_id": "DEP-002",
        "status": "ACTIVE"
    }
    manager_doc = {
        "user_id": "TEST-MGR-01",
        "name": "Audit Manager Nova",
        "email": "manager@novawearapparel.com",
        "role": "MANAGER",
        "department": "Cloud",
        "department_id": "DEP-002",
        "status": "ACTIVE"
    }

    await db.users.update_one({"user_id": agent_a["user_id"]}, {"$set": agent_a}, upsert=True)
    await db.users.update_one({"user_id": agent_b["user_id"]}, {"$set": agent_b}, upsert=True)
    await db.users.update_one({"user_id": manager_doc["user_id"]}, {"$set": manager_doc}, upsert=True)

    # Step 1: Create a test ticket assigned to Agent A with an intentional policy breach
    test_ticket_id = f"TICK-TEST-{int(datetime.utcnow().timestamp())}"
    sample_ticket = {
        "ticket_id": test_ticket_id,
        "title": "Severe Server Downtime & Unauthorized Refund Claim",
        "description": "Cloud service was down for 2 hours during deployment.",
        "customer_name": "Test Customer",
        "customer_email": "customer@example.com",
        "customer_department": "Cloud",
        "department": "Cloud",
        "department_id": "DEP-002",
        "priority": "P0",
        "status": "In Progress",
        "assigned_agent_id": agent_a["user_id"],
        "assigned_agent": agent_a["name"],
        "assigned_agent_email": agent_a["email"],
        "agent_notes": "I issued refund of 100% without manager sign-off.",
        "python_rule_output": {
            "matched_rule_id": "CLD-POL-02: Cloud Service Level Guarantee",
            "refund_eligible": False,
            "escalation_required": True,
            "prohibited_actions": ["No full refund permitted without Tier 3 audit"],
            "mandatory_actions": ["Collect server error logs as evidence"]
        },
        "created_at": datetime.utcnow()
    }
    await db.tickets.insert_one(sample_ticket)
    print(f"1. Created test ticket {test_ticket_id} assigned to Agent A.")

    # Step 2: Manager Smart Policy Compliance Evaluation
    ticket_in_db = await db.tickets.find_one({"ticket_id": test_ticket_id})
    comp = evaluate_policy_compliance(ticket_in_db)
    print("2. Evaluated Policy Compliance:")
    print(f"   Status: {comp['status']}")
    print(f"   Violations detected: {comp['violations']}")
    assert comp["status"] == "VIOLATION", f"Expected VIOLATION, got {comp['status']}"
    assert len(comp["violations"]) > 0, "Expected at least 1 violation"
    print("   [PASS] Manager Smart Policy Check correctly flagged non-compliant refund!")

    # Step 3: Manager revokes Agent A and releases ticket to OPEN POOL
    print("3. Manager releases ticket to Open Department Pool...")
    release_req = ReleaseToPoolRequest(
        manager_id=manager_doc["user_id"],
        manager_name=manager_doc["name"],
        manager_role="MANAGER",
        reason="Agent issued 100% refund violating CLD-POL-02. Removed and reopened for pool."
    )
    release_res = await release_ticket_to_pool(test_ticket_id, release_req)
    print(f"   Response status: {release_res['status']}")
    assert release_res["ticket"]["status"] == "In Triage", "Ticket should be reset to 'In Triage'"
    assert release_res["ticket"]["assigned_agent_id"] is None, "Assigned agent should be cleared"
    assert agent_a["user_id"] in release_res["ticket"]["revoked_agent_ids"], "Agent A should be in revoked_agent_ids"
    print("   [PASS] Ticket successfully released to Open Pool & Agent A added to revoked list!")

    # Step 4: Revoked Agent A attempts to re-claim ticket via Status Update -> MUST BE 403 FORBIDDEN
    print("4. Testing Revoked Agent A attempting to re-claim via status update...")
    agent_a_attempt = StatusUpdateRequest(
        status="In Progress",
        agent_id=agent_a["user_id"],
        agent_name=agent_a["name"],
        agent_email=agent_a["email"],
        agent_notes="Trying to reclaim this ticket"
    )
    blocked = False
    try:
        await update_ticket_status(test_ticket_id, agent_a_attempt)
    except HTTPException as e:
        if e.status_code == 403:
            blocked = True
            print(f"   [PASS] Agent A successfully blocked with HTTP 403: {e.detail}")
    assert blocked, "Agent A should have been blocked with HTTP 403!"

    # Step 5: Revoked Agent A attempts to send Email Reply -> MUST BE 403 FORBIDDEN
    print("5. Testing Revoked Agent A attempting to send email reply...")
    email_attempt = EmailReplyRequest(
        reply_body="Apologies for the inconvenience.",
        agent_id=agent_a["user_id"],
        agent_name=agent_a["name"],
        agent_email=agent_a["email"]
    )
    email_blocked = False
    try:
        await dispatch_email_reply(test_ticket_id, email_attempt)
    except HTTPException as e:
        if e.status_code == 403:
            email_blocked = True
            print(f"   [PASS] Agent A email reply successfully blocked with HTTP 403: {e.detail}")
    assert email_blocked, "Agent A email reply should have been blocked with HTTP 403!"

    # Step 6: Parallel Star Agent B claims the ticket from the open pool
    print("6. Testing Parallel Star Agent B claiming the unassigned ticket...")
    agent_b_claim = StatusUpdateRequest(
        status="In Progress",
        agent_id=agent_b["user_id"],
        agent_name=agent_b["name"],
        agent_email=agent_b["email"],
        agent_notes="Claiming open pool ticket to resolve per SLA."
    )
    claim_res = await update_ticket_status(test_ticket_id, agent_b_claim)
    assert claim_res["ticket"]["assigned_agent_id"] == agent_b["user_id"], "Ticket should be assigned to Agent B"
    assert claim_res["ticket"]["status"] == "In Progress", "Ticket status should be In Progress"
    print(f"   [PASS] Agent B successfully claimed ticket: Assigned to {claim_res['ticket']['assigned_agent']}")

    # Clean up test records
    await db.tickets.delete_one({"ticket_id": test_ticket_id})
    await db.users.delete_many({"user_id": {"$in": ["TEST-AGT-01", "TEST-AGT-02", "TEST-MGR-01"]}})
    print("=" * 60)
    print("ALL 6 AUDIT & COMPLIANCE CHECKS PASSED WITH 100% ACCURACY!")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(run_audit())
