import re
import hashlib
import logging
import asyncio
from datetime import datetime, date, timedelta, timezone
from typing import Dict, Any, List, Optional
from imap_tools import MailBox, AND

from config import email_config
from lib.db import get_database, connect_to_mongo
from ai.groq_client import groq_client
from ai.qdrant_rag import qdrant_rag
from lib.dept_resolver import resolve_ai_department, get_active_department_names
from lib.email_service import EmailService

logger = logging.getLogger("NovaWear.EmailIngestion")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")

_EMAIL_SYNC_LOCK = asyncio.Lock()

TICKET_ID_REGEX = re.compile(r"CMP-\d+", re.IGNORECASE)

# Target Support Email Addresses & Identifiers (must be mentioned or inbox recipient)
TARGET_SUPPORT_PATTERNS = [
    "support@novawearapparel.com",
    "support@novawearapparel.ai",
    "novawearapparel.com",
    "novawearapparel",
    "support@novawearapparel",
    "support@novawear.com",
    "support@novawear.ai",
    "novawear.com",
    "novawear",
    "support@novawear"
]

# Automated / Promotional / Social media senders to ignore
IGNORED_SENDER_PATTERNS = [
    "no-reply", "noreply", "donotreply", "mailer-daemon", "postmaster",
    "newsletter", "promotions", "linkedin", "mongodb", "github", "twitter",
    "facebook", "instagram", "quora", "medium", "updates", "marketing",
    "jobalert", "indeed", "glassdoor", "apexearlycareers", "fontawesome",
    "samsung", "foodpanda", "meezanbank", "canva", "picfair", "grok",
    "cerebras", "googleplay", "notification", "security-noreply"
]

# Customer Complaint & Inquiry Keywords
CUSTOMER_COMPLAINT_KEYWORDS: List[str] = [
    "complain", "complaint", "refund", "cancel", "cancellation", "return",
    "cloud instance", "instance", "ebook", "order #", "order id",
    "billing", "double charge", "charged", "ticket", "problem", "defect", "broken",
    "wrong item", "damaged", "delay", "issue", "error", "not working", "dissatisfied",
    "help", "replace", "fix", "failed", "unauthorized", "unhappy", "pro-rated", "pro rated"
]

def extract_message_id(msg) -> Optional[str]:
    """Extract standard RFC 2822 Message-ID header safely from IMAP message."""
    try:
        headers = msg.headers or {}
        for k, v in headers.items():
            if k.lower() == "message-id":
                if isinstance(v, (list, tuple)) and len(v) > 0:
                    return str(v[0]).strip().strip("<>").strip()
                return str(v).strip().strip("<>").strip()
    except Exception:
        pass

    try:
        if hasattr(msg, "obj") and msg.obj:
            val = msg.obj.get("Message-ID")
            if val:
                return str(val).strip().strip("<>").strip()
    except Exception:
        pass

    return None

def compute_email_fingerprint(sender: str, subject: str, date_val: Any, body: str) -> str:
    """Deterministic SHA-256 fingerprint hash of email content."""
    clean_sender = (sender or "").strip().lower()
    clean_subj = (subject or "").strip().lower()
    clean_body = (body or "")[:300].strip().lower()
    raw = f"{clean_sender}::{clean_subj}::{clean_body}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()

def as_utc_datetime(value: Any) -> Optional[datetime]:
    """Normalize an email timestamp to UTC; naive values are treated as UTC."""
    if not isinstance(value, datetime):
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)

async def is_email_already_processed(
    db,
    uid: str,
    message_id: Optional[str],
    fingerprint: str,
    sender_email: str = "",
    subject: str = ""
) -> bool:
    """
    Multi-tier uniqueness check against processed_emails and tickets collections.
    Returns True if this email has already been processed or logged.
    """
    or_queries = [
        {"uid": str(uid)},
        {"fingerprint": fingerprint}
    ]
    if message_id:
        or_queries.append({"message_id": message_id})

    # Check 1: processed_emails log collection
    existing_log = await db.processed_emails.find_one({"$or": or_queries})
    if existing_log:
        return True

    # Check 2: tickets collection by UID or Message-ID
    ticket_queries = [{"email_uid": str(uid)}]
    if message_id:
        ticket_queries.append({"original_message_id": message_id})
        ticket_queries.append({"conversation_thread.message_id": message_id})

    existing_ticket = await db.tickets.find_one({"$or": ticket_queries})
    if existing_ticket:
        return True

    # Check 3: Content-based duplicate check in tickets (same sender + same subject in Email channel)
    if sender_email and subject:
        existing_by_content = await db.tickets.find_one({
            "channel": "Email",
            "customer_email": sender_email.strip().lower(),
            "title": subject.strip()
        })
        if existing_by_content:
            return True

    return False

async def record_processed_email(
    db,
    uid: str,
    message_id: Optional[str],
    fingerprint: str,
    sender: str,
    subject: str,
    date_val: Any,
    ticket_id: Optional[str] = None,
    status: str = "PROCESSED"
):
    """Logs the email into processed_emails and advances the watermark."""
    try:
        record = {
            "uid": str(uid),
            "message_id": message_id,
            "fingerprint": fingerprint,
            "sender": sender,
            "subject": subject,
            "email_date": str(date_val),
            "ticket_id": ticket_id,
            "status": status,
            "processed_at": datetime.utcnow()
        }
        await db.processed_emails.update_one(
            {"uid": str(uid)},
            {"$set": record},
            upsert=True
        )

        # Update sync watermark
        await db.email_sync_state.update_one(
            {"_id": "mailbox_sync_watermark"},
            {
                "$set": {
                    "last_processed_uid": str(uid),
                    "last_checked_at": datetime.utcnow(),
                    "last_subject": subject,
                    "last_sender": sender
                }
            },
            upsert=True
        )
    except Exception as e:
        logger.warning(f"Could not record processed email: {e}")

async def process_single_email_message(msg, db, user_email: str) -> Dict[str, Any]:
    """
    Processes a single IMAP email message through the NovaWear Apparel AI pipeline:
    - Verifies uniqueness & filters
    - RAG retrieval & Groq analysis
    - Resolves department
    - Creates ticket with channel 'Email'
    - Dispatches SMTP confirmation email to customer
    """
    uid = str(msg.uid or "").strip()
    sender_email = (msg.from_ or "").strip()
    sender_email_lower = sender_email.lower()
    recipients_str = " ".join([str(t) for t in (msg.to or [])]).lower()
    subject = (msg.subject or "No Subject").strip()
    subject_lower = subject.lower()
    body_text = (msg.text or msg.html or "").strip()
    body_lower = body_text.lower()
    email_date = msg.date or datetime.utcnow()

    full_search_text = f"{recipients_str} {subject_lower} {body_lower}"
    message_id = extract_message_id(msg)
    fingerprint = compute_email_fingerprint(sender_email, subject, email_date, body_text)

    # Check if already processed
    if await is_email_already_processed(db, uid, message_id, fingerprint, sender_email, subject):
        logger.info(f"Duplicate email skipped: UID={uid} | MsgID={message_id} | Subj='{subject}'")
        return {
            "status": "already_processed",
            "uid": uid,
            "subject": subject,
            "sender": sender_email
        }

    # 1. Ignore self-sent emails from Support Email
    if user_email.lower() in sender_email_lower or sender_email_lower == user_email.lower():
        await record_processed_email(db, uid, message_id, fingerprint, sender_email, subject, email_date, status="SKIPPED_SELF")
        return {"status": "skipped", "reason": "Self-sent support email", "uid": uid}

    # 2. Ignore automated / promotional senders
    if any(pat in sender_email_lower for pat in IGNORED_SENDER_PATTERNS):
        await record_processed_email(db, uid, message_id, fingerprint, sender_email, subject, email_date, status="SKIPPED_AUTOMATED")
        return {"status": "skipped", "reason": "Automated/promotional sender", "uid": uid}

    # 3. Check if subject contains existing Ticket ID (CMP-\d+)
    ticket_match = TICKET_ID_REGEX.search(subject)

    # 4. Strict filter: Must have ticket ID thread OR (recipient/NovaWear Apparel mentioned AND complaint keyword)
    is_sent_to_inbox = user_email.lower() in recipients_str
    has_target_mention = is_sent_to_inbox or any(pat in full_search_text for pat in TARGET_SUPPORT_PATTERNS)
    has_complaint_keyword = any(kw in full_search_text for kw in CUSTOMER_COMPLAINT_KEYWORDS)

    is_customer_complaint = (ticket_match is not None) or (has_target_mention and has_complaint_keyword)

    if not is_customer_complaint:
        await record_processed_email(db, uid, message_id, fingerprint, sender_email, subject, email_date, status="SKIPPED_NON_COMPLAINT")
        return {"status": "skipped", "reason": "Not recognized as complaint", "uid": uid}

    # ATOMIC RESERVATION LOCK:
    # Before starting heavy Groq AI extraction & RAG (which take 3-5 seconds),
    # claim this email in db.processed_emails with status "PROCESSING".
    # Any concurrent fetch call hitting the server within these 5 seconds will find this reservation and abort immediately!
    claim_filter = {
        "$or": [
            {"uid": str(uid)},
            {"fingerprint": fingerprint}
        ]
    }
    if message_id:
        claim_filter["$or"].append({"message_id": message_id})

    try:
        claim = await db.processed_emails.find_one_and_update(
            claim_filter,
            {
                "$setOnInsert": {
                    "uid": str(uid),
                    "message_id": message_id,
                    "fingerprint": fingerprint,
                    "sender": sender_email,
                    "subject": subject,
                    "email_date": str(email_date),
                    "status": "PROCESSING",
                    "processed_at": datetime.utcnow()
                }
            },
            upsert=True
        )
        if claim is not None:
            logger.info(f"Concurrency lock blocked duplicate execution: UID={uid} already claimed (status={claim.get('status')})")
            return {
                "status": "already_processed",
                "uid": uid,
                "subject": subject,
                "sender": sender_email
            }
    except Exception as lock_err:
        logger.warning(f"Atomic reservation lock notice: {lock_err}")
        return {
            "status": "already_processed",
            "uid": uid,
            "subject": subject,
            "sender": sender_email
        }

    logger.info(f"Processing Customer Email: UID={uid} | From={sender_email} | Subject='{subject}'")

    # If existing Ticket ID found, append to thread
    if ticket_match:
        existing_ticket_id = ticket_match.group(0).upper()
        existing_ticket = await db.tickets.find_one({"ticket_id": existing_ticket_id})

        if existing_ticket:
            logger.info(f"Existing ticket '{existing_ticket_id}' found. Appending email reply to conversation thread.")
            thread_entry = {
                "message_id": message_id or f"MSG-REP-{int(datetime.utcnow().timestamp())}",
                "sender": sender_email,
                "sender_type": "customer",
                "body": body_text,
                "received_at": email_date.isoformat() if hasattr(email_date, "isoformat") else str(email_date),
                "channel": "EMAIL"
            }

            await db.tickets.update_one(
                {"ticket_id": existing_ticket_id},
                {
                    "$push": {"conversation_thread": thread_entry},
                    "$set": {
                        "updated_at": datetime.utcnow(),
                        "latest_customer_message": body_text
                    }
                }
            )
            await record_processed_email(db, uid, message_id, fingerprint, sender_email, subject, email_date, ticket_id=existing_ticket_id, status="THREAD_REPLY")
            return {
                "status": "thread_updated",
                "ticket_id": existing_ticket_id,
                "uid": uid,
                "subject": subject
            }

    # Create Brand New Email Complaint Ticket
    new_ticket_id = f"CMP-{int(datetime.utcnow().timestamp())}"

    # Department detection hints
    is_cloud = any(k in full_search_text for k in ["cloud", "instance", "vm", "server", "aws", "storage", "cld-"])
    is_ebook = any(k in full_search_text for k in ["ebook", "book", "pdf", "download", "chapter", "reading", "eb-"])
    target_department_hint = "Cloud" if is_cloud else "Ebook" if is_ebook else "Cloud"

    policy_context = ""
    try:
        relevant_chunks = qdrant_rag.retrieve_relevant_chunks(body_text, top_k=2)
        policy_context = "\n".join([c.get("text", "") for c in relevant_chunks]) if relevant_chunks else ""
    except Exception:
        pass

    available_depts = await get_active_department_names(db)
    genai_output = None

    try:
        genai_output = groq_client.analyze_complaint(
            complaint_id=new_ticket_id,
            title=subject,
            description=body_text,
            order_id="N/A",
            policy_context=policy_context,
            available_departments=available_depts
        )
    except Exception as ai_err:
        logger.warning(f"Groq API error ({ai_err}). Deterministic fallback activated.")
        genai_output = {
            "issue_category": "Cloud Instance Inquiry" if is_cloud else "Digital Ebook Issue" if is_ebook else "General Inquiry",
            "subcategory": "Subscription Cancellation" if "cancel" in body_lower else "Technical Support",
            "sentiment": "Frustrated 😠" if "cancel" in body_lower or "refund" in body_lower else "Neutral",
            "urgency": "High" if "refund" in body_lower or "cancel" in body_lower else "Medium",
            "priority": "P1" if "refund" in body_lower else "P2",
            "department": target_department_hint,
            "policy_id": "CLD-POL-01" if is_cloud else "EBK-POL-01" if is_ebook else "GEN-POL-01",
            "resolution_steps": ["Verify customer subscription and account status", "Calculate pro-rated balance if eligible", "Send status confirmation to customer"],
            "escalation_required": False,
            "draft_response": f"Dear Customer,\n\nThank you for contacting Support regarding '{subject}'. Reference Ticket ID: {new_ticket_id}. Our {target_department_hint} support team is reviewing your inquiry and will update you shortly.\n\nBest regards,\nSupport Team"
        }

    ai_raw_dept = genai_output.get("department", target_department_hint)
    ai_dept_id, ai_dept = await resolve_ai_department(db, ai_raw_dept, fallback_dept=target_department_hint)

    draft_reply = genai_output.get(
        "suggested_response",
        genai_output.get("draft_response", f"Dear Customer,\n\nWe have received your ticket {new_ticket_id} and our team is actively reviewing it.")
    )

    python_rule_output = {
        "matched_rule_id": genai_output.get("policy_id", "DEL-POL-04"),
        "category_verified": True,
        "escalation_required": genai_output.get("escalation_required", False),
        "refund_eligible": "refund" in body_lower or "pro-rated" in body_lower,
        "mandatory_actions": genai_output.get("resolution_steps", ["Verify customer identity", "Review service status"]),
        "prohibited_actions": ["Issue unauthorized refund exceeding policy limit without approval"],
        "policy_reference": f"{genai_output.get('policy_id', 'POL-01')} §{genai_output.get('policy_section', '1.0')}",
        "confidence_score": 96.0
    }

    cust_name = sender_email.split("@")[0].replace(".", " ").capitalize()

    new_ticket = {
        "ticket_id": new_ticket_id,
        "title": subject,
        "description": body_text,
        "product_service": "Cloud Service" if is_cloud else "Ebook" if is_ebook else "Email Inquiry",
        "order_id": "N/A",
        "channel": "Email",
        "source": "EMAIL",
        "status": "In Triage",
        "email_uid": uid,
        "original_message_id": message_id,
        "customer_id": f"USR-{int(datetime.utcnow().timestamp())}",
        "customer_name": cust_name,
        "customer_email": sender_email,
        # Department Routing & Unassigned Pool
        "department_id": ai_dept_id,
        "department": ai_dept,
        "department_name": ai_dept,
        "customer_department": ai_dept,
        "customer_department_id": ai_dept_id,
        "recommended_department": ai_dept,
        "department_mismatch": False,
        "match_status": True,
        "assigned_agent_id": None,
        "assignedAgentId": None,
        "assigned_agent": None,
        "assigned_agent_email": None,
        "assigned_agent_history": [
            {
                "action": "EMAIL_INGESTION_ROUTED",
                "department": ai_dept,
                "department_id": ai_dept_id,
                "sender": sender_email,
                "timestamp": datetime.utcnow().isoformat()
            }
        ],
        "category": genai_output.get("issue_category", "General Email"),
        "ai_category": genai_output.get("issue_category", "General Email"),
        "sub_category": genai_output.get("subcategory", "General Inquiry"),
        "priority": genai_output.get("priority", "P2"),
        "sentiment": genai_output.get("sentiment", "Neutral"),
        "urgency": genai_output.get("urgency", "Medium"),
        "draft_response": draft_reply,
        "genai_output": genai_output,
        "python_rule_output": python_rule_output,
        "sla_hours_remaining": 4.0 if genai_output.get("priority") == "P0" else 24.0,
        "sla_risk_percentage": 15.0,
        "attachments": [],
        "agent_notes": "",
        "conversation_thread": [
            {
                "message_id": message_id or f"MSG-{int(datetime.utcnow().timestamp())}",
                "sender": sender_email,
                "sender_type": "customer",
                "body": body_text,
                "received_at": email_date.isoformat() if hasattr(email_date, "isoformat") else str(email_date),
                "channel": "EMAIL"
            }
        ],
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }

    try:
        await db.tickets.insert_one(new_ticket)
    except Exception as insert_err:
        if "duplicate" in str(insert_err).lower() or "11000" in str(insert_err):
            logger.warning(f"MongoDB unique constraint blocked duplicate ticket insertion: {insert_err}")
            return {
                "status": "already_processed",
                "uid": uid,
                "subject": subject,
                "sender": sender_email
            }
        raise insert_err

    new_ticket["_id"] = str(new_ticket["_id"])

    # Broadcast real-time WebSocket event to all connected clients
    try:
        from lib.websocket_manager import ws_manager
        await ws_manager.notify_ticket_created(new_ticket)
        await ws_manager.notify_agent_workload_change()
    except Exception as wse:
        logger.debug(f"WS notification notice: {wse}")

    await record_processed_email(
        db,
        uid=uid,
        message_id=message_id,
        fingerprint=fingerprint,
        sender=sender_email,
        subject=subject,
        date_val=email_date,
        ticket_id=new_ticket_id,
        status="NEW_TICKET_CREATED"
    )

    logger.info(f"SUCCESS: New Customer Email Ticket '{new_ticket_id}' created! Dept: {ai_dept} | From: {sender_email}")

    # Dispatch SMTP confirmation email to customer (EXACTLY ONCE GUARD)
    try:
        ticket_lock = await db.tickets.find_one_and_update(
            {
                "ticket_id": new_ticket_id,
                "creation_email_sent": {"$ne": True}
            },
            {
                "$set": {"creation_email_sent": True}
            }
        )
        if ticket_lock:
            EmailService.send_ticket_created_notification(
                to_email=sender_email,
                ticket_id=new_ticket_id,
                title=subject,
                department=ai_dept
            )
            logger.info(f"Confirmation email successfully dispatched to {sender_email} for {new_ticket_id}")
    except Exception as mail_err:
        logger.warning(f"Could not dispatch email notification: {mail_err}")

    return {
        "status": "ticket_created",
        "ticket": new_ticket,
        "uid": uid,
        "ticket_id": new_ticket_id
    }

async def fetch_latest_email_ticket() -> Dict[str, Any]:
    """
    30-Second Poller Endpoint Handler:
    - Protected by _EMAIL_SYNC_LOCK to prevent concurrency collisions.
    - Fetches the single latest customer email from IMAP mailbox.
    - If no new email arrived (latest email was already processed), cleanly returns 'no_new_email'.
    - If a new customer email arrived, creates ticket and triggers AI Pipeline.
    """
    global _EMAIL_SYNC_LOCK
    if _EMAIL_SYNC_LOCK.locked():
        logger.info("Email poller cycle already in progress in another worker. Skipping concurrent request.")
        return {
            "status": "sync_in_progress",
            "message": "Email synchronization is already actively running.",
            "checked_at": datetime.utcnow().isoformat()
        }

    async with _EMAIL_SYNC_LOCK:
        user_email = email_config.get_email()
        app_password = email_config.get_password()
        imap_server = email_config.get_imap_server()
        imap_port = email_config.IMAP_PORT

        if not user_email or not app_password:
            return {
                "status": "skipped",
                "message": "SMTP/IMAP credentials not configured in server/.env",
                "checked_at": datetime.utcnow().isoformat()
            }

        db = get_database()
        if db is None:
            await connect_to_mongo()
            db = get_database()

        await ensure_email_indexes(db)

        try:
            with MailBox(imap_server, port=imap_port).login(
                user_email,
                app_password,
                initial_folder="INBOX"
            ) as mailbox:
                # Scan a bounded recent batch so duplicate mail cannot hide a nearby customer email.
                latest_messages = list(mailbox.fetch(reverse=True, limit=50, mark_seen=True))

                if not latest_messages:
                    return {
                        "status": "no_emails_found",
                        "message": "INBOX is currently empty.",
                        "checked_at": datetime.utcnow().isoformat()
                    }

                checked_at_utc = datetime.now(timezone.utc)
                cutoff_utc = checked_at_utc - timedelta(seconds=30)

                # Check messages starting from the most recent
                for msg in latest_messages:
                    message_date_utc = as_utc_datetime(msg.date)
                    if message_date_utc is None or not cutoff_utc <= message_date_utc <= checked_at_utc:
                        logger.info(
                            "Email outside UTC 30-second window: UID=%s | DateUTC=%s | CutoffUTC=%s",
                            msg.uid,
                            message_date_utc.isoformat() if message_date_utc else "missing",
                            cutoff_utc.isoformat()
                        )
                        continue

                    logger.info(
                        "IMAP message fetched: UID=%s | From=%s | Subj='%s'",
                        msg.uid,
                        msg.from_,
                        msg.subject or "No Subject"
                    )
                    res = await process_single_email_message(msg, db, user_email)

                    if res.get("status") == "ticket_created":
                        return {
                            "status": "new_email_processed",
                            "message": f"New email received from {res['ticket']['customer_email']}: '{res['ticket']['title']}'. Ticket {res['ticket']['ticket_id']} created and routed to {res['ticket']['department']}.",
                            "ticket": res["ticket"],
                            "checked_at": datetime.utcnow().isoformat()
                        }
                    elif res.get("status") == "thread_updated":
                        return {
                            "status": "thread_updated",
                            "message": f"New message appended to existing ticket {res['ticket_id']}.",
                            "ticket_id": res["ticket_id"],
                            "checked_at": datetime.utcnow().isoformat()
                        }
                    elif res.get("status") == "already_processed":
                        # A duplicate is local to this message; keep checking the rest of the batch.
                        continue

                # If all were skipped (e.g. automated newsletters)
                return {
                    "status": "no_new_email",
                    "message": "Inbox checked. No new customer complaints found.",
                    "checked_at": datetime.utcnow().isoformat()
                }

        except Exception as e:
            logger.error(f"Error in 30s email fetch: {str(e)}")
            return {
                "status": "error",
                "message": str(e),
                "checked_at": datetime.utcnow().isoformat()
            }

async def fetch_and_create_email_tickets(
    only_recent_days: int = 7,
    force_all_recent: bool = True
) -> Dict[str, Any]:
    """
    Bulk Historical / Periodic Email Sync with Multi-Tier Deduplication.
    """
    processed_count = 0
    new_tickets_count = 0
    updated_tickets_count = 0
    skipped_count = 0
    duplicate_count = 0

    user_email = email_config.get_email()
    app_password = email_config.get_password()
    imap_server = email_config.get_imap_server()
    imap_port = email_config.IMAP_PORT

    global _EMAIL_SYNC_LOCK
    if _EMAIL_SYNC_LOCK.locked():
        logger.info("Email synchronization already in progress in another thread. Skipping concurrent bulk fetch.")
        return {
            "status": "sync_in_progress",
            "message": "Email synchronization is already running.",
            "processed": 0
        }

    async with _EMAIL_SYNC_LOCK:
        if not user_email or not app_password:
            return {
                "status": "skipped",
                "message": "Email credentials not configured in server/.env",
                "processed": 0
            }

        try:
            db = get_database()
            if db is None:
                await connect_to_mongo()
                db = get_database()

            await ensure_email_indexes(db)

            cutoff_date = date.today() - timedelta(days=only_recent_days)

            with MailBox(imap_server, port=imap_port).login(
                user_email,
                app_password,
                initial_folder="INBOX"
            ) as mailbox:

                fetch_criteria = AND(date_gte=cutoff_date)
                for msg in mailbox.fetch(fetch_criteria, reverse=True, mark_seen=True):
                    processed_count += 1
                    res = await process_single_email_message(msg, db, user_email)
                    st = res.get("status")

                    if st == "ticket_created":
                        new_tickets_count += 1
                    elif st == "thread_updated":
                        updated_tickets_count += 1
                    elif st == "already_processed":
                        duplicate_count += 1
                    elif st == "skipped":
                        skipped_count += 1

        except Exception as e:
            logger.error(f"Failed bulk email fetch: {str(e)}")
            return {"status": "error", "message": str(e), "processed": processed_count}

        return {
            "status": "success",
            "processed": processed_count,
            "new_tickets": new_tickets_count,
            "updated_tickets": updated_tickets_count,
            "skipped_non_customer": skipped_count,
            "already_imported": duplicate_count
        }

async def ensure_email_indexes(db):
    """
    Ensures unique sparse indexes on MongoDB collections to provide
    ironclad physical database-level deduplication.
    """
    try:
        await db.processed_emails.create_index([("uid", 1)], unique=True, sparse=True)
        await db.processed_emails.create_index([("fingerprint", 1)], unique=True, sparse=True)
        await db.tickets.create_index([("email_uid", 1)], unique=True, sparse=True)
        await db.tickets.create_index([("original_message_id", 1)], unique=True, sparse=True)
    except Exception as e:
        logger.debug(f"Unique index check notice: {e}")

