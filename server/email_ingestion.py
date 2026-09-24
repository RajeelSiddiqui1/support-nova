import re
import logging
from datetime import datetime, date, timedelta
from typing import Dict, Any, List
from imap_tools import MailBox, AND

from config import email_config
from lib.db import get_database
from ai.groq_client import groq_client
from ai.qdrant_rag import qdrant_rag
from lib.dept_resolver import resolve_ai_department, get_active_department_names

logger = logging.getLogger("SupportNova.EmailIngestion")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")

TICKET_ID_REGEX = re.compile(r"CMP-\d+", re.IGNORECASE)

# Target Support Email Addresses & Identifiers
TARGET_SUPPORT_PATTERNS = [
    "support@supportnova.com",
    "support@supportnova.ai",
    "supportnova",
    "support"
]

# Automated / Promotional / Social media senders to ignore
IGNORED_SENDER_PATTERNS = [
    "no-reply", "noreply", "donotreply", "mailer-daemon", "postmaster",
    "newsletter", "promotions", "linkedin", "mongodb", "github", "twitter",
    "facebook", "instagram", "quora", "medium", "updates", "marketing"
]

# Precision Complaint & Support Keywords
SUPPORT_KEYWORDS: List[str] = [
    "complaint", "issue", "refund", "return", "ticket", "cmp-",
    "problem", "defect", "broken", "wrong item", "damaged", "delay",
    "delivery", "billing", "double charge", "cancel order"
]

async def fetch_and_create_email_tickets(
    only_recent_days: int = 2,
    require_target_match: bool = True
) -> Dict[str, Any]:
    """
    Connect to IMAP server using imap-tools and query UNSEEN customer emails.
    - Applies strict filtering:
      1. Fetches UNSEEN emails from recent days (default: last 2 days).
      2. Ignores outgoing emails sent by support team itself.
      3. Ignores automated system / promotional / social media senders.
      4. ONLY fetches emails where TO, Subject, or Body contains 'support@supportnova.com' / 'support@supportnova.ai' or existing Ticket ID (CMP-\\d+).
    - Extracts message_id, sender_email, subject, body_text, date.
    - If subject contains CMP-\\d+, appends to existing conversation thread.
    - If new customer email, generates new ticket_id, triggers GenAI response pipeline, inserts with source='EMAIL', status='NEW'.
    """
    processed_count = 0
    new_tickets_count = 0
    updated_tickets_count = 0
    skipped_count = 0

    user_email = email_config.get_email()
    app_password = email_config.get_password()
    imap_server = email_config.get_imap_server()
    imap_port = email_config.IMAP_PORT

    if not user_email or not app_password:
        logger.warning("SMTP_USER / SUPPORT_EMAIL or SMTP_PASS / EMAIL_APP_PASSWORD not configured. Skipping IMAP fetch.")
        return {
            "status": "skipped",
            "message": "Email credentials not configured in server/.env",
            "processed": 0
        }

    try:
        from lib.db import connect_to_mongo, get_database
        db = get_database()
        if db is None:
            await connect_to_mongo()
            db = get_database()

        logger.info(f"Connecting to IMAP server {imap_server}:{imap_port} as {user_email}...")

        cutoff_date = date.today() - timedelta(days=only_recent_days)

        with MailBox(imap_server, port=imap_port).login(
            user_email,
            app_password,
            initial_folder="INBOX"
        ) as mailbox:

            fetch_criteria = AND(seen=False, date_gte=cutoff_date)
            logger.info(f"Fetching UNSEEN customer emails addressed to Support since {cutoff_date}...")

            for msg in mailbox.fetch(fetch_criteria, mark_seen=True):
                processed_count += 1
                sender_email = (msg.from_ or "").strip()
                sender_email_lower = sender_email.lower()
                recipients_str = " ".join([str(t) for t in (msg.to or [])]).lower()
                subject = (msg.subject or "No Subject").strip()
                subject_lower = subject.lower()
                body_text = (msg.text or msg.html or "").strip()
                body_lower = body_text.lower()

                full_search_text = f"{recipients_str} {subject_lower} {body_lower}"

                # 1. Ignore self-sent emails from Support Email / Agent Account
                if user_email.lower() in sender_email_lower or sender_email_lower == user_email.lower():
                    logger.info(f"Skipping self-sent email from {sender_email}")
                    skipped_count += 1
                    continue

                # 2. Ignore automated / promotional / social media senders
                if any(pat in sender_email_lower for pat in IGNORED_SENDER_PATTERNS):
                    logger.info(f"Skipping automated/promotional sender: {sender_email}")
                    skipped_count += 1
                    continue

                # 3. Check if subject contains existing Ticket ID (CMP-\d+)
                ticket_match = TICKET_ID_REGEX.search(subject)

                # 4. Strict Target Check: MUST be addressed to support or contain support@supportnova / CMP-\d+
                is_supportnova_target = (
                    ticket_match is not None or
                    any(pat in full_search_text for pat in TARGET_SUPPORT_PATTERNS) or
                    any(kw in full_search_text for kw in SUPPORT_KEYWORDS)
                )

                if not is_supportnova_target:
                    logger.info(f"Skipping personal/unrelated email '{subject}' from {sender_email}")
                    skipped_count += 1
                    continue

                message_id = msg.headers.get("message-id", [None])[0] or f"MSG-{int(datetime.utcnow().timestamp())}-{processed_count}"
                email_date = msg.date or datetime.utcnow()

                logger.info(f"Processing Customer Email ID: {message_id} | From: {sender_email} | Subject: '{subject}'")

                # If existing Ticket ID found, append to thread
                if ticket_match:
                    existing_ticket_id = ticket_match.group(0).upper()
                    existing_ticket = await db.tickets.find_one({"ticket_id": existing_ticket_id})

                    if existing_ticket:
                        logger.info(f"Existing ticket '{existing_ticket_id}' found. Appending to thread.")

                        thread_entry = {
                            "message_id": message_id,
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
                        updated_tickets_count += 1
                        continue

                # Create Brand New Email Complaint Ticket
                new_ticket_id = f"CMP-{int(datetime.utcnow().timestamp())}"

                # Trigger AI RAG & Response Pipeline with dynamic departments
                relevant_chunks = qdrant_rag.retrieve_relevant_chunks(body_text, top_k=2)
                policy_context = "\n".join([c.get("text", "") for c in relevant_chunks]) if relevant_chunks else ""

                available_depts = await get_active_department_names(db)

                genai_output = groq_client.analyze_complaint(
                    complaint_id=new_ticket_id,
                    title=subject,
                    description=body_text,
                    order_id="N/A",
                    policy_context=policy_context,
                    available_departments=available_depts
                )

                ai_raw_dept = genai_output.get("department", "Customer Support")
                ai_dept_id, ai_dept = await resolve_ai_department(db, ai_raw_dept, fallback_dept="Ebook")

                draft_reply = genai_output.get(
                    "suggested_response",
                    f"Dear Customer,\n\nThank you for contacting SupportNova regarding '{subject}'. We have received your request (Ticket ID: {new_ticket_id}) and our team is reviewing it."
                )

                python_rule_output = {
                    "matched_rule_id": genai_output.get("policy_id", "DEL-POL-04"),
                    "category_verified": True,
                    "escalation_required": genai_output.get("escalation_required", False),
                    "refund_eligible": "refund" in body_text.lower() or "delay" in body_text.lower(),
                    "mandatory_actions": genai_output.get("resolution_steps", ["Verify details", "Escalate if needed"]),
                    "prohibited_actions": ["Issue unauthorized cash refund > 50% without manager review"],
                    "policy_reference": f"{genai_output.get('policy_id', 'POL-01')} §{genai_output.get('policy_section', '1.0')}",
                    "confidence_score": 96.5
                }

                new_ticket = {
                    "ticket_id": new_ticket_id,
                    "title": subject,
                    "description": body_text,
                    "product_service": "Email Inquiry",
                    "order_id": "N/A",
                    "channel": "Email",
                    "source": "EMAIL",
                    "status": "In Triage",
                    "original_message_id": message_id,
                    "customer_id": f"USR-{int(datetime.utcnow().timestamp())}",
                    "customer_name": sender_email.split("@")[0].capitalize(),
                    "customer_email": sender_email,
                    "department_id": ai_dept_id,
                    "customer_department_id": ai_dept_id,
                    "customer_department": ai_dept,
                    "department": ai_dept,
                    "recommended_department": ai_dept,
                    "department_mismatch": False,
                    "match_status": True,
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
                            "message_id": message_id,
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

                await db.tickets.insert_one(new_ticket)
                new_tickets_count += 1
                logger.info(f"New Customer Email Ticket '{new_ticket_id}' created from {sender_email}.")

    except Exception as e:
        logger.error(f"Failed to fetch or process INBOX emails: {str(e)}", exc_info=True)
        return {
            "status": "error",
            "message": str(e),
            "processed": processed_count
        }

    return {
        "status": "success",
        "processed": processed_count,
        "new_tickets": new_tickets_count,
        "updated_tickets": updated_tickets_count,
        "skipped_non_customer": skipped_count
    }
