import asyncio
import sys
sys.path.insert(0, 'server')
from lib.db import get_database, connect_to_mongo

async def check():
    await connect_to_mongo()
    db = get_database()
    
    # Check all collections
    cols = await db.list_collection_names()
    print("COLLECTIONS in DB:", cols)
    
    # Check count of tickets
    count = await db.tickets.count_documents({})
    print(f"Total tickets in 'tickets' collection: {count}")
    
    tickets = await db.tickets.find({}).to_list(length=20)
    for t in tickets:
        print(f"ID: {t.get('ticket_id')}, CustName: {t.get('customer_name')}, CustEmail: {t.get('customer_email')}, CustId: {t.get('customer_id')}")

if __name__ == "__main__":
    asyncio.run(check())
