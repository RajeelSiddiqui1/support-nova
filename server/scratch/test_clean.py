import asyncio
from dotenv import load_dotenv
import os
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv()

async def test():
    client = AsyncIOMotorClient(os.getenv("MONGO_URI"))
    db = client.get_default_database()

    # Raw value with quotes from cookie in screenshot: '"rajeel20051@gmail.com"'
    raw_email_from_cookie = '"rajeel20051@gmail.com"'
    raw_id_from_cookie = 'USR-1790265860'

    clean_email = raw_email_from_cookie.strip().strip('"').strip("'")
    clean_id = raw_id_from_cookie.strip().strip('"').strip("'")

    print("Raw Email:", repr(raw_email_from_cookie))
    print("Clean Email:", repr(clean_email))
    print("Clean ID:", repr(clean_id))

    query = {"$or": [{"customer_id": clean_id}, {"customer_email": clean_email.lower()}]}
    res = await db.tickets.find(query).to_list(100)
    print("\nMatched Tickets Count:", len(res))
    for t in res:
        print("  - Ticket ID:", t.get("ticket_id"), "| Email:", t.get("customer_email"), "| Name:", t.get("customer_name"))

asyncio.run(test())
