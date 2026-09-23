import os
import asyncio
from datetime import datetime
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

from lib.auth import hash_password

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "supportnova_db")

async def seed_database():
    """Seeds the initial Admin user and sample Rule Matrix into MongoDB."""
    print("Starting SupportNova Database Seeding...")

    client = AsyncIOMotorClient(MONGO_URI)
    db = client[DB_NAME]

    # 1. Seed Default Admin User
    admin_email = "admin@gmail.com"
    existing_admin = await db.users.find_one({"email": admin_email})

    if not existing_admin:
        admin_user = {
            "user_id": "ADM-001",
            "email": admin_email,
            "name": "Admin Nova",
            "hashed_password": hash_password("admin123"),
            "role": "ADMIN",
            "department": "Management",
            "status": "ACTIVE",
            "is_temp_password": False,
            "deactivation_reason": None,
            "created_at": datetime.utcnow()
        }
        await db.users.insert_one(admin_user)
        print(f"[+] Admin Created: {admin_email} | Password: admin123")
    else:
        # Ensure password hash is updated to admin123
        await db.users.update_one(
            {"email": admin_email},
            {"$set": {
                "hashed_password": hash_password("admin123"),
                "status": "ACTIVE",
                "role": "ADMIN"
            }}
        )
        print(f"[*] Admin already exists ({admin_email}). Password reset to admin123.")

    # 2. Seed Sample Staff Members (Agent, Reviewer, Manager)
    sample_staff = [
        {"user_id": "STF-101", "email": "zara@company.com", "name": "Zara Ahmed", "role": "AGENT", "department": "Logistics", "status": "ACTIVE", "hashed_password": hash_password("agent123")},
        {"user_id": "STF-102", "email": "omar@company.com", "name": "Omar Sheikh", "role": "AGENT", "department": "Finance", "status": "ACTIVE", "hashed_password": hash_password("agent123")},
        {"user_id": "STF-103", "email": "sana@company.com", "name": "Sana Malik", "role": "REVIEWER", "department": "Quality", "status": "ACTIVE", "hashed_password": hash_password("reviewer123")},
        {"user_id": "STF-104", "email": "bilal@company.com", "name": "Bilal Rana", "role": "MANAGER", "department": "Operations", "status": "ACTIVE", "hashed_password": hash_password("manager123")},
    ]

    for staff in sample_staff:
        exists = await db.users.find_one({"email": staff["email"]})
        if not exists:
            staff["created_at"] = datetime.utcnow()
            await db.users.insert_one(staff)
            print(f"[+] Staff Created: {staff['email']} ({staff['role']})")

    # 3. Seed Complaint Resolution Rule Matrix (SRS Step 8)
    sample_rules = [
        {
            "rule_id": "DEL-POL-04",
            "category": "Delivery",
            "condition": "Delay > 72h",
            "department": "Logistics",
            "mandatory_actions": ["Escalate within 2h", "Document in SLA breach log"],
            "prohibited_actions": ["Promise date without confirmation", "Offer discount > 20%"],
            "refund_eligible": True,
            "escalation_required": True,
            "policy_reference": "Customer Delivery Policy v2.1 §4.3",
            "is_active": True
        },
        {
            "rule_id": "REF-POL-07",
            "category": "Refund",
            "condition": "Defective product confirmed",
            "department": "Finance",
            "mandatory_actions": ["Full refund within 24h", "Issue prepaid return label"],
            "prohibited_actions": ["Partial refund without manager approval"],
            "refund_eligible": True,
            "escalation_required": False,
            "policy_reference": "Refund Policy v3.0 §2.1",
            "is_active": True
        },
        {
            "rule_id": "WP-POL-02",
            "category": "Wrong Product",
            "condition": "Wrong item delivered",
            "department": "Fulfillment",
            "mandatory_actions": ["Photo evidence required", "Priority re-shipment"],
            "prohibited_actions": ["Issue replacement without photo proof"],
            "refund_eligible": True,
            "escalation_required": True,
            "policy_reference": "Wrong Product Policy v1.2 §2.1",
            "is_active": True
        },
        {
            "rule_id": "BIL-POL-03",
            "category": "Billing",
            "condition": "Double charge detected",
            "department": "Finance",
            "mandatory_actions": ["Full refund within 24h", "Send billing apology email"],
            "prohibited_actions": ["Offer loyalty points only"],
            "refund_eligible": True,
            "escalation_required": False,
            "policy_reference": "Billing Policy v1.5 §3.0",
            "is_active": True
        }
    ]

    for rule in sample_rules:
        await db.rule_matrix.update_one(
            {"rule_id": rule["rule_id"]},
            {"$set": rule},
            upsert=True
        )

    print("SUCCESS: Database seeding completed successfully!")
    client.close()

if __name__ == "__main__":
    asyncio.run(seed_database())
