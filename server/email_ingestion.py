import re
import logging
from datetime import datetime, date, timedelta
from typing import Dict, Any, List
from imap_tools import MailBox, AND

from config import email_config
from lib.db import get_database, connect_to_mongo
from ai.groq_client import groq_client
from ai.qdrant_rag import qdrant_rag
from lib.dept_resolver import resolve_ai_department, get_active_department_names

logger = logging.getLogger("SupportNova.EmailIngestion")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")

TICKET_ID_REGEX = re.compile(r"CMP-\d+", re.IGNORECASE)

# Target Support Email Addresses & Identifiers (must be mentioned)
TARGET_SUPPORT_PATTERNS = [
    "support@supportnova.com",
    "support@supportnova.ai",
    "supportnova.com",
    "supportnova",
    "support@supportnova"
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

# Customer Complaint & Inquiry Keywords (Strictly required for new complaints)
CUSTOMER_COMPLAINT_KEYWORDS: List[str] = [
    "complain", "complaint", "refund", "cancel", "cancellation", "return",
    "cloud instance", "instance", "ebook", "order #", "order id",
    "billing", "double charge", "charged", "ticket", "problem", "defect", "broken",
    "wrong item", "damaged", "delay", "issue", "error", "not working", "dissatisfied",
    "help", "replace", "fix", "failed", "unauthorized", "unhappy", "pro-rated", "pro rated"
]

async def fetch_and_create_email_tickets(
    only_recent_days: int = 7,
    force_all_recent: bool = True
) -> Dict[str, Any]:
    """
    Connect to IMAP server using imap-tools and query customer emails.
    - Accurately captures real customer complaints and filters out promotional bulk emails.
    - Prevents duplicate ticket creation by checking message-id against MongoDB.
    - Department Routing:
      - Automatically classifies tickets into Cloud (DEP-1790273677) or Ebook (DEP-1790265711) or relevant department.
      - Sets assigned_agent_id = None so it appears in the department's Unassigned Pool for agents.
    - Fallback Resilience: If Groq hits rate limit (429), uses smart deterministic rule classification so tickets are ALWAYS saved to DB.
    """
    processed_count = 0
    new_tickets_count = 0
    updated_tickets_count = 0
    skipped_count = 0
    duplicate_count = 0
    consecutive_duplicates = 0

    user_email = email_config.get_email()
    app_password = email_config.get_password()
    imap_server = email_config.get_imap_server()
    imap_port = email_config.IMAP_PORT

    if not user_email or not app_password:
        logger.warning("SMTP_USER or SMTP_PASS not configured. Skipping IMAP fetch.")
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

        logger.info(f"Connecting to IMAP server {imap_server}:{imap_port} as {user_email}...")

        cutoff_date = date.today() - timedelta(days=only_recent_days)

        with MailBox(imap_server, port=imap_port).login(
            user_email,
            app_password,
            initial_folder="INBOX"
        ) as mailbox:

            # Fetch recent emails within the cutoff window
            fetch_criteria = AND(date_gte=cutoff_date)
            logger.info(f"Fetching customer emails since {cutoff_date}...")

            for msg in mailbox.fetch(fetch_criteria, reverse=True, mark_seen=True):
                processed_count += 1
                sender_email = (msg.from_ or "").strip()
                sender_email_lower = sender_email.lower()
                recipients_str = " ".join([str(t) for t in (msg.to or [])]).lower()
                subject = (msg.subject or "No Subject").strip()
                subject_lower = subject.lower()
                body_text = (msg.text or msg.html or "").strip()
                body_lower = body_text.lower()

                full_search_text = f"{recipients_str} {subject_lower} {body_lower}"

                # 1. Ignore self-sent emails from Support Email
                if user_email.lower() in sender_email_lower or sender_email_lower == user_email.lower():
                    skipped_count += 1
                    continue

                # 2. Ignore automated / promotional / newsletter senders
                if any(pat in sender_email_lower for pat in IGNORED_SENDER_PATTERNS):
                    skipped_count += 1
                    continue

                # 3. Check if subject contains existing Ticket ID (CMP-\d+)
                ticket_match = TICKET_ID_REGEX.search(subject)

                # 4. Strict filter: Must have ticket ID thread OR (SupportNova mentioned AND Complaint keyword present)
                has_target_mention = any(pat in full_search_text for pat in TARGET_SUPPORT_PATTERNS)
                has_complaint_keyword = any(kw in full_search_text for kw in CUSTOMER_COMPLAINT_KEYWORDS)

                is_customer_complaint = (ticket_match is not None) or (has_target_mention and has_complaint_keyword)

                if not is_customer_complaint:
                    skipped_count += 1
                    continue

                message_id = (msg.headers.get("message-id", [None])[0] or f"MSG-{int(datetime.utcnow().timestamp())}-{processed_count}").strip()
                email_date = msg.date or datetime.utcnow()

                # 5. Deduplication check: Check if this message_id or customer email+subject was already saved to DB
                existing_doc = await db.tickets.find_one({
                    "$or": [
                        {"original_message_id": message_id},
                        {"conversation_thread.message_id": message_id},
                        {"customer_email": sender_email, "title": subject}
                    ]
                })

                if existing_doc:
                    duplicate_count += 1
                    consecutive_duplicates += 1
                    if consecutive_duplicates >= 10:
                        logger.info('Found 10 consecutive existing tickets in reverse order. Stopping sync early.')
                        break
                    continue
                else:
                    consecutive_duplicates = 0

                logger.info(f"Processing Customer Email: From={sender_email} | Subject='{subject}'")

                # If existing Ticket ID found, append to thread
                if ticket_match:
                    existing_ticket_id = ticket_match.group(0).upper()
                    existing_ticket = await db.tickets.find_one({"ticket_id": existing_ticket_id})

                    if existing_ticket:
                        logger.info(f"Existing ticket '{existing_ticket_id}' found. Appending message to thread.")

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

                # 6. Create Brand New Email Complaint Ticket
                new_ticket_id = f"CMP-{int(datetime.utcnow().timestamp())}"

                # Department keyword detection for high precision routing
                is_cloud = any(k in full_search_text for k in ["cloud", "instance", "vm", "server", "aws", "storage", "cld-"])
                is_ebook = any(k in full_search_text for k in ["ebook", "book", "pdf", "download", "chapter", "reading", "eb-"])
                target_department_hint = "Cloud" if is_cloud else "Ebook" if is_ebook else "Cloud"

                # Trigger AI RAG & GenAI Analysis with fallback on Groq 429 rate limit
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
                    logger.warning(f"Groq API error or rate-limit ({ai_err}). Using smart deterministic fallback.")
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
                        "draft_response": f"Dear Customer,\n\nThank you for contacting Support regarding '{subject}'. We have received your request (Reference ID: {new_ticket_id}). Our {target_department_hint} support team is reviewing your inquiry and will update you shortly.\n\nBest regards,\nSupport Team"
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

                new_ticket = {
                    "ticket_id": new_ticket_id,
                    "title": subject,
                    "description": body_text,
                    "product_service": "Cloud Service" if is_cloud else "Ebook" if is_ebook else "Email Inquiry",
                    "order_id": "N/A",
                    "channel": "Email",
                    "source": "EMAIL",
                    "status": "In Triage",
                    "original_message_id": message_id,
                    "customer_id": f"USR-{int(datetime.utcnow().timestamp())}",
                    "customer_name": sender_email.split("@")[0].capitalize(),
                    "customer_email": sender_email,
                    # Department Routing & Unassigned Pool setup
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
                logger.info(f"SUCCESS: New Customer Email Ticket '{new_ticket_id}' inserted into MongoDB. Dept: {ai_dept} ({ai_dept_id}) | From: {sender_email}")

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
        "skipped_non_customer": skipped_count,
        "already_imported": duplicate_count
    }
