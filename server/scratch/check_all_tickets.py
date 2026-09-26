import asyncio
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from lib.db import connect_to_mongo, get_database

async def check():
    await connect_to_mongo()
    db = get_database()
    total = await db.tickets.count_documents({})
    print(f"Total count in tickets collection: {total}")
    all_tickets = await db.tickets.find({}).to_list(100)
    for t in all_tickets:
        print(f"ticket_id: {t.get('ticket_id')} | title: {t.get('title')} | created_at: {t.get('created_at')} ({type(t.get('created_at'))})")

if __name__ == "__main__":
    asyncio.run(check())
