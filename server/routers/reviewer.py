from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from lib.db import get_database
from schemas.reviewer import (
    ReviewerQueueItem,
    ReviewerComparisonPayload,
    ReviewerActionRequest,
    ReviewerActionResponse,
    AuditReviewerLogResponse
)
from services.reviewer_service import ReviewerService

class ClaimReviewerRequest(BaseModel):
    reviewer_id: str
    reviewer_name: Optional[str] = "Reviewer"

class AssignReviewerRequest(BaseModel):
    new_reviewer_id: str
    new_reviewer_name: Optional[str] = None
    assigned_by_id: Optional[str] = None
    assigned_by_name: Optional[str] = None
    reason: Optional[str] = "Reviewer workload rebalancing"

router = APIRouter(
    prefix="/api/reviewer",
    tags=["Reviewer Workspace & Manual Review Queue"]
)

@router.get(
    "/queue",
    response_model=List[ReviewerQueueItem],
    summary="Fetch tickets routed to Manual Review Queue with smart filtering"
)
async def get_reviewer_queue(
    urgency: Optional[str] = Query(None, description="Filter by urgency: Critical, High, Medium, Low, or P0-P3"),
    category: Optional[str] = Query(None, description="Filter by ticket category"),
    mismatch_type: Optional[str] = Query(None, description="Filter by PIPELINE_CONFLICT, POLICY_EXCEPTION, HIGH_SENTIMENT_RISK, PROMPT_INJECTION, UNAUTHORIZED_FEE_WAIVER, AMBIGUOUS_POLICY"),
    assigned_reviewer_id: Optional[str] = Query(None, description="Filter by assigned reviewer ID"),
    db=Depends(get_database)
):
    """
    Returns all tickets requiring human reviewer intervention based on:
    1. Pipeline 1 (GenAI) vs Pipeline 2 (Python Ground Truth) discrepancy / conflict.
    2. Missing, ambiguous policy, or flagged exceptions (unauthorized fee waiver / edge-case refund).
    3. Adversarial prompt injection or high churn/furious customer sentiment.
    Powered directly by MongoDB Atlas.
    """
    try:
        queue = await ReviewerService.get_manual_review_queue(
            db=db,
            urgency=urgency,
            category=category,
            mismatch_type=mismatch_type,
            assigned_reviewer_id=assigned_reviewer_id
        )
        return queue
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch reviewer queue from MongoDB Atlas: {str(e)}"
        )

@router.get(
    "/tickets/{ticket_id}",
    response_model=ReviewerComparisonPayload,
    summary="Get Side-by-Side Comparison Payload for Reviewer Workspace"
)
async def get_ticket_comparison(
    ticket_id: str,
    db=Depends(get_database)
):
    """
    Supplies the 3-Way Side-by-Side Reviewer Comparison payload:
    - Customer Input: Raw complaint message and extracted entities (Order ID, Delivery Date, Product Name).
    - Pipeline 1 Output: GenAI detected issues, sentiment, category, policy mapping, and drafted response.
    - Pipeline 2 Output: Ground-Truth deterministic Rule ID, APPROVE/BLOCK/ESCALATE verdict, exceptions, and conflict reasons.
    Fetched directly from MongoDB Atlas.
    """
    payload = await ReviewerService.get_side_by_side_payload(ticket_id, db)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Ticket '{ticket_id}' not found."
        )
    return payload

@router.post(
    "/tickets/{ticket_id}/action",
    response_model=ReviewerActionResponse,
    summary="Execute Reviewer Decision & Commit Audit Override to MongoDB Atlas"
)
async def execute_action(
    ticket_id: str,
    action_req: ReviewerActionRequest,
    db=Depends(get_database)
):
    """
    Applies Reviewer actions:
    - APPROVE: Accept GenAI draft and dispatch to agent/customer queue.
    - MODIFY: Edit drafted response or classification directly before dispatch.
    - RECLASSIFY: Reassign category/department/subcategory.
    - REGENERATE: Send custom prompt critique back to GenAI pipeline for a fresh draft.
    - ESCALATE_TO_MANAGER: Escalate high-risk P0 ticket directly to the Department Manager.
    - ADD_INTERNAL_NOTE: Record internal reviewer/manager investigation remarks.

    Records every transaction into MongoDB Atlas `reviewer_audit_logs` collection.
    """
    try:
        response = await ReviewerService.execute_reviewer_action(
            ticket_id=ticket_id,
            req=action_req,
            db=db
        )
        return response
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to execute reviewer action: {str(e)}"
        )

@router.get(
    "/tickets/{ticket_id}/audit-logs",
    response_model=List[AuditReviewerLogResponse],
    summary="Retrieve MongoDB Atlas Audit Trail for Ticket"
)
async def get_ticket_audit_logs(
    ticket_id: str,
    db=Depends(get_database)
):
    """
    Returns all immutable audit records from the `reviewer_audit_logs` MongoDB Atlas collection for the specified ticket.
    """
    try:
        logs = await ReviewerService.get_audit_logs_for_ticket(ticket_id, db)
        return logs
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve audit logs from MongoDB Atlas: {str(e)}"
        )

@router.get("/reviewers", summary="List all active Reviewers across all departments")
async def list_active_reviewers(db=Depends(get_database)):
    """Fetches all active users with role REVIEWER or ADMIN for cross-department ticket assignment."""
    cursor = db.users.find(
        {"role": {"$in": ["REVIEWER", "ADMIN"]}, "status": "ACTIVE"},
        {"hashed_password": 0, "otp_code": 0}
    )
    reviewers = await cursor.to_list(length=100)
    for r in reviewers:
        r["_id"] = str(r["_id"])
    return reviewers

@router.post("/tickets/{ticket_id}/claim", summary="Reviewer claims review of ticket")
async def claim_ticket_review(ticket_id: str, req: ClaimReviewerRequest, db=Depends(get_database)):
    """Assigns the ticket review to the requesting Reviewer."""
    ticket = await db.tickets.find_one({"$or": [{"ticket_id": ticket_id}, {"_id": ticket_id}]})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found.")

    t_id = ticket.get("ticket_id") or str(ticket.get("_id"))
    update_doc = {
        "assigned_reviewer_id": req.reviewer_id,
        "assigned_reviewer_name": req.reviewer_name or "Reviewer",
        "assigned_reviewer_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow()
    }
    history_entry = {
        "action": "REVIEWER_CLAIMED_TICKET",
        "reviewer_id": req.reviewer_id,
        "reviewer_name": req.reviewer_name,
        "timestamp": datetime.utcnow().isoformat()
    }

    await db.tickets.update_one(
        {"ticket_id": t_id},
        {
            "$set": update_doc,
            "$push": {"assigned_agent_history": history_entry}
        }
    )

    try:
        from lib.websocket_manager import ws_manager
        await ws_manager.notify_reviewer_action(
            ticket_id=t_id,
            action="CLAIM_REVIEW",
            reviewer_name=req.reviewer_name,
            new_status=ticket.get("status", "In Triage")
        )
    except Exception as wse:
        print(f"[WS ERROR] {wse}")

    return {
        "status": "success",
        "message": f"Ticket {t_id} assigned to Reviewer {req.reviewer_name}.",
        "assigned_reviewer_id": req.reviewer_id,
        "assigned_reviewer_name": req.reviewer_name
    }

@router.post("/tickets/{ticket_id}/assign-reviewer", summary="Reassign review ticket to another Reviewer")
async def reassign_reviewer_ticket(ticket_id: str, req: AssignReviewerRequest, db=Depends(get_database)):
    """Transfers the review ticket to another specified Reviewer."""
    ticket = await db.tickets.find_one({"$or": [{"ticket_id": ticket_id}, {"_id": ticket_id}]})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found.")

    t_id = ticket.get("ticket_id") or str(ticket.get("_id"))
    new_reviewer = await db.users.find_one({"user_id": req.new_reviewer_id, "status": "ACTIVE"})
    new_name = req.new_reviewer_name or (new_reviewer.get("name") if new_reviewer else "Reviewer")

    update_doc = {
        "assigned_reviewer_id": req.new_reviewer_id,
        "assigned_reviewer_name": new_name,
        "assigned_reviewer_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow()
    }
    history_entry = {
        "action": "REVIEWER_REASSIGNED",
        "previous_reviewer_id": ticket.get("assigned_reviewer_id"),
        "previous_reviewer_name": ticket.get("assigned_reviewer_name"),
        "new_reviewer_id": req.new_reviewer_id,
        "new_reviewer_name": new_name,
        "reassigned_by_id": req.assigned_by_id,
        "reassigned_by_name": req.assigned_by_name,
        "reason": req.reason or "Reviewer workload rebalancing",
        "timestamp": datetime.utcnow().isoformat()
    }

    await db.tickets.update_one(
        {"ticket_id": t_id},
        {
            "$set": update_doc,
            "$push": {"assigned_agent_history": history_entry}
        }
    )

    try:
        from lib.websocket_manager import ws_manager
        await ws_manager.notify_reviewer_action(
            ticket_id=t_id,
            action="REASSIGN_REVIEWER",
            reviewer_name=new_name,
            new_status=ticket.get("status", "In Triage")
        )
    except Exception as wse:
        print(f"[WS ERROR] {wse}")

    return {
        "status": "success",
        "message": f"Review ticket {t_id} reassigned to Reviewer {new_name}.",
        "assigned_reviewer_id": req.new_reviewer_id,
        "assigned_reviewer_name": new_name
    }
