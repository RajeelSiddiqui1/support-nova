import asyncio
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from fastapi import HTTPException
from pydantic import EmailStr
from routes.auth_routes import check_email, login, CheckEmailRequest, LoginRequest
from lib.db import connect_to_mongo, close_mongo_connection, get_database

async def main():
    await connect_to_mongo()
    db = get_database()

    # 1. Setup mock customer and mock agent in DB
    await db.users.update_one(
        {"email": "test.customer@gmail.com"},
        {
            "$set": {
                "name": "Test Customer",
                "email": "test.customer@gmail.com",
                "role": "CUSTOMER",
                "status": "ACTIVE"
            }
        },
        upsert=True
    )

    await db.users.update_one(
        {"email": "test.agent@novawearapparel.com"},
        {
            "$set": {
                "name": "Test Agent",
                "email": "test.agent@novawearapparel.com",
                "role": "AGENT",
                "status": "ACTIVE"
            }
        },
        upsert=True
    )

    print("--- Test 1: Customer attempts check-email (Password login path) ---")
    try:
        await check_email(CheckEmailRequest(email="test.customer@gmail.com"))
        print("[FAIL] Customer was allowed to enter check-email!")
    except HTTPException as e:
        print(f"[PASS] Correctly blocked with Status: {e.status_code}, Detail: {e.detail}")

    print("\n--- Test 2: Staff Agent attempts check-email (Password login path) ---")
    try:
        res = await check_email(CheckEmailRequest(email="test.agent@novawearapparel.com"))
        print(f"[PASS] Staff allowed to proceed: role={res.get('role')}, email={res.get('email')}")
    except HTTPException as e:
        print(f"[FAIL] Staff was unexpectedly blocked: {e.detail}")

    # Cleanup test accounts
    await db.users.delete_many({"email": {"$in": ["test.customer@gmail.com", "test.agent@novawearapparel.com"]}})
    await close_mongo_connection()

if __name__ == "__main__":
    asyncio.run(main())
