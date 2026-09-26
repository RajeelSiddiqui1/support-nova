import smtplib
import logging
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Dict, Any, Optional

from config import email_config
from lib.db import get_database

logger = logging.getLogger("NovaWear.EmailDispatcher")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")

def send_agent_approved_reply(
    ticket_id: str,
    to_email: str,
    original_subject: str,
    reply_body: str,
    original_message_id: str,
    new_status: str = "IN_PROGRESS"
) -> Dict[str, Any]:
    """
    Sends an outbound reply to customer via SMTP with email threading headers (In-Reply-To, References).
    
    Args:
        ticket_id: Ticket ID string (e.g. CMP-00421)
        to_email: Recipient customer email address
        original_subject: Subject line of original complaint
        reply_body: Agent approved reply message text
        original_message_id: Original email Message-ID header for threading
        new_status: Ticket status after sending (default: IN_PROGRESS)
    """
    sender_email = email_config.get_email()
    sender_password = email_config.get_password()
    smtp_server = email_config.get_smtp_server()
    smtp_port = email_config.SMTP_PORT

    if not sender_email or not sender_password:
        logger.error("SMTP_USER / SUPPORT_EMAIL missing in server/.env config.")
        return {"status": "error", "message": "SMTP credentials (SMTP_USER / SMTP_PASS) not configured in server/.env"}

    # Format Subject line ensuring 'Re:' and Ticket ID are present without duplication
    clean_subj = original_subject.strip()
    if not clean_subj.lower().startswith("re:"):
        formatted_subject = f"Re: [{ticket_id}] {clean_subj}"
    else:
        if f"[{ticket_id}]" not in clean_subj:
            formatted_subject = clean_subj.replace("Re:", f"Re: [{ticket_id}]", 1)
        else:
            formatted_subject = clean_subj

    # Construct MIMEMultipart email message
    msg = MIMEMultipart()
    msg["From"] = sender_email
    msg["To"] = to_email
    msg["Subject"] = formatted_subject

    # Threading Headers for Gmail/Outlook threading support
    if original_message_id:
        msg["In-Reply-To"] = original_message_id
        msg["References"] = original_message_id

    # Attach text body
    msg.attach(MIMEText(reply_body, "plain"))

    try:
        logger.info(f"Connecting to SMTP server {smtp_server}:{smtp_port} as {sender_email}...")
        with smtplib.SMTP(smtp_server, smtp_port) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(sender_email, sender_password)
            server.send_message(msg)

        logger.info(f"Outbound reply sent successfully to {to_email} for Ticket '{ticket_id}'.")

        # Async DB Update logger
        db = get_database()

        dispatch_log = {
            "message_id": msg.get("Message-ID", f"SENT-{int(datetime.utcnow().timestamp())}"),
            "sender": sender_email,
            "sender_type": "agent",
            "body": reply_body,
            "sent_at": datetime.utcnow().isoformat(),
            "channel": "EMAIL"
        }

        import asyncio
        try:
            loop = asyncio.get_event_loop()
            if loop and loop.is_running():
                asyncio.create_task(
                    db.tickets.update_one(
                        {"ticket_id": ticket_id},
                        {
                            "$set": {
                                "status": new_status,
                                "updated_at": datetime.utcnow(),
                                "agent_notes": reply_body
                            },
                            "$push": {"conversation_thread": dispatch_log}
                        }
                    )
                )
        except Exception as db_err:
            logger.warning(f"Note: Async DB update skipped in sync context: {db_err}")

        return {
            "status": "success",
            "message": f"Email reply dispatched to {to_email} and status updated to '{new_status}'.",
            "ticket_id": ticket_id
        }

    except Exception as e:
        logger.error(f"Failed to dispatch email reply for ticket {ticket_id}: {str(e)}", exc_info=True)
        return {
            "status": "error",
            "message": f"SMTP error: {str(e)}"
        }
