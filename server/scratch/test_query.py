import asyncio
import re
from dotenv import load_dotenv
import os
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv()

async def test_tickets():
    client = AsyncIOMotorClient(os.getenv("MONGO_URI"))
    db = client.get_default_database()

    customer_id = "USR-1790265860"
    customer_email = "rajeel20051@gmail.com"

    # Old buggy query from ticket_routes.py:
    query_old = {}
    if customer_email:
        query_old["customer_email"] = customer_email.strip().lower()
    if customer_id:
        if customer_email:
            query_old["$or"] = [
                {"customer_id": customer_id.strip()},
                {"customer_email": customer_email.strip().lower()}
            ]
        else:
            query_old["customer_id"] = customer_id.strip()

    print("OLD QUERY:", query_old)
    res_old = await db.tickets.find(query_old).to_list(100)
    print("OLD Query Count:", len(res_old))

    # New FIXED query:
    query_new = {}
    or_conditions = []
    if customer_id and customer_id.strip():
        or_conditions.append({"customer_id": customer_id.strip()})
    if customer_email and customer_email.strip():
        or_conditions.append({"customer_email": customer_email.strip().lower()})
        or_conditions.append({"customer_email": re.compile(f"^{re.escape(customer_email.strip())}$", re.IGNORECASE)})

    query_new["$or"] = or_conditions

    print("\nNEW QUERY:", query_new)
    res_new = await db.tickets.find(query_new).to_list(100)
    print("NEW Query Count:", len(res_new))
    for t in res_new:
        print("  - Ticket ID:", t.get("ticket_id"), "| Email:", t.get("customer_email"), "| ID:", t.get("customer_id"))

asyncio.run(test_tickets())
