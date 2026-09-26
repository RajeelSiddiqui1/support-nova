import asyncio
import sys
sys.path.insert(0, 'server')
from lib.db import get_database, connect_to_mongo

async def check():
    await connect_to_mongo()
    db = get_database()
    
    users = await db.users.find({'email': {'$regex': 'rajeel20051', '$options': 'i'}}).to_list(length=10)
    print("USERS FOUND:")
    for u in users:
        print(f"  _id: {u.get('_id')}, user_id: {u.get('user_id')}, name: {u.get('name')}, email: {u.get('email')}, role: {u.get('role')}")
        
    tickets = await db.tickets.find({'customer_email': {'$regex': 'rajeel20051', '$options': 'i'}}).to_list(length=20)
    print(f"\nTICKETS FOUND ({len(tickets)}):")
    for t in tickets:
        print(f"  ticket_id: {t.get('ticket_id')}, customer_id: {t.get('customer_id')}, email: {t.get('customer_email')}, channel: {t.get('channel')}, title: {t.get('title')}")

if __name__ == "__main__":
    asyncio.run(check())
