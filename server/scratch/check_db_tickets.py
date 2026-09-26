import asyncio
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from lib.db import connect_to_mongo, get_database, close_mongo_connection

async def check():
    await connect_to_mongo()
    db = get_database()
    tickets = await db.tickets.find({}).sort("created_at", -1).to_list(15)
    print(f"Total tickets in DB: {len(tickets)}")
    for t in tickets:
        print(f"ID: {t.get('ticket_id')} | Title: {t.get('title')} | UID: {t.get('email_uid')} | MsgID: {t.get('original_message_id')} | Created: {t.get('created_at')}")
    
    logs = await db.processed_emails.find().sort("processed_at", -1).to_list(10)
    print(f"\nTotal processed_emails logs: {len(logs)}")
    for l in logs:
        print(f"UID: {l.get('uid')} | MsgID: {l.get('message_id')} | TicketID: {l.get('ticket_id')} | Status: {l.get('status')} | Subj: {l.get('subject')}")

if __name__ == "__main__":
    asyncio.run(check())
