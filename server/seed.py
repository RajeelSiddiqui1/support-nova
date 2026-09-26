import os
import asyncio
from datetime import datetime, timedelta
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

from lib.auth import hash_password

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/supportnova_db")
DB_NAME = os.getenv("DB_NAME")

async def seed_database():
    """Seeds the initial Admin user and sample Rule Matrix into MongoDB."""
    print("Starting SupportNova Database Seeding...")

    client = AsyncIOMotorClient(MONGO_URI)
    if DB_NAME:
        db = client[DB_NAME]
    else:
        try:
            db = client.get_default_database(default="supportnova_db")
        except Exception:
            db = client["supportnova_db"]


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

    # 1.5. Seed Default Departments
    sample_departments = [
        {"dept_id": "DEP-101", "name": "Logistics", "code": "LOG", "description": "Handles shipping, tracking, delivery delays, and warehouse ops.", "status": "ACTIVE"},
        {"dept_id": "DEP-102", "name": "Finance", "code": "FIN", "description": "Handles refunds, billing disputes, payments, and invoices.", "status": "ACTIVE"},
        {"dept_id": "DEP-103", "name": "Quality", "code": "QUAL", "description": "Audit, quality assurance, compliance, and resolution reviews.", "status": "ACTIVE"},
        {"dept_id": "DEP-104", "name": "Fulfillment", "code": "FUL", "description": "Order packing, wrong item shipments, and inventory control.", "status": "ACTIVE"},
        {"dept_id": "DEP-105", "name": "Operations", "code": "OPS", "description": "Overall service operations and process optimization.", "status": "ACTIVE"},
        {"dept_id": "DEP-106", "name": "Customer Experience", "code": "CX", "description": "Direct customer support and SLA satisfaction team.", "status": "ACTIVE"},
    ]

    # 1.6. Seed Default Categories
    sample_categories = [
        {"cat_id": "CAT-101", "name": "Delivery", "code": "DEL", "description": "Shipping delays, SLA breaches, tracking issues.", "status": "ACTIVE"},
        {"cat_id": "CAT-102", "name": "Refund", "code": "REF", "description": "Duplicate charges, defective returns, gateway refunds.", "status": "ACTIVE"},
        {"cat_id": "CAT-103", "name": "Replacement", "code": "REP", "description": "Wrong item delivered, damaged in transit.", "status": "ACTIVE"},
        {"cat_id": "CAT-104", "name": "Warranty", "code": "WAR", "description": "Manufacturer warranty, extended policy claims.", "status": "ACTIVE"},
        {"cat_id": "CAT-105", "name": "Billing", "code": "BIL", "description": "Invoice discrepancies, payment failures, double billing.", "status": "ACTIVE"},
        {"cat_id": "CAT-106", "name": "Quality", "code": "QUAL", "description": "Product quality audits and customer feedback reviews.", "status": "ACTIVE"},
        {"cat_id": "CAT-107", "name": "General", "code": "GEN", "description": "General customer service SOPs and standard terms.", "status": "ACTIVE"},
    ]

    for cat in sample_categories:
        cat_exists = await db.categories.find_one({"code": cat["code"]})
        if not cat_exists:
            cat["created_at"] = datetime.utcnow()
            cat["updated_at"] = datetime.utcnow()
            await db.categories.insert_one(cat)
            print(f"[+] Category Created: {cat['name']} ({cat['code']})")

    # 2. Seed Sample Staff Members (Agent, Reviewer, Manager)
    sample_staff = [
        {"user_id": "STF-101", "email": "zara@company.com", "name": "Zara Ahmed", "role": "AGENT", "department": "Logistics", "department_id": "DEP-101", "status": "ACTIVE", "hashed_password": hash_password("agent123")},
        {"user_id": "STF-102", "email": "omar@company.com", "name": "Omar Sheikh", "role": "AGENT", "department": "Finance", "department_id": "DEP-102", "status": "ACTIVE", "hashed_password": hash_password("agent123")},
        {"user_id": "STF-103", "email": "sana@company.com", "name": "Sana Malik", "role": "REVIEWER", "department": "Quality", "department_id": "DEP-103", "status": "ACTIVE", "hashed_password": hash_password("reviewer123")},
        {"user_id": "STF-104", "email": "bilal@company.com", "name": "Bilal Rana", "role": "MANAGER", "department": "Operations", "department_id": "DEP-105", "status": "ACTIVE", "hashed_password": hash_password("manager123")},
    ]

    for staff in sample_staff:
        exists = await db.users.find_one({"email": staff["email"]})
        if not exists:
            staff["created_at"] = datetime.utcnow()
            await db.users.insert_one(staff)
            print(f"[+] Staff Created: {staff['email']} ({staff['role']})")
        else:
            await db.users.update_one({"email": staff["email"]}, {"$set": {"department_id": staff["department_id"]}})

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

    # 4. Seed Sample Knowledge Base Policies with Department Foreign Key
    sample_policies = [
        {
            "doc_id": "KB-101",
            "title": "Customer Delivery & Delayed Shipment Policy",
            "category": "Delivery",
            "department_id": "DEP-101",
            "department": "Logistics",
            "file_type": "PDF",
            "file_size_kb": 142.5,
            "version": "v2.1",
            "status": "Active",
            "full_text": "Section 1: Delayed Shipment Guidelines\nPackages delayed beyond 72 hours must be flagged for immediate escalation to Logistics operations manager. Agents must document all carrier tracking notes in the SLA breach log.\n\nSection 2: Discount & Refund Eligibility\nIf delivery delay exceeds 5 business days without carrier update, customer is eligible for a full shipping fee refund or 15% promotional credit on next order.",
            "chunk_count": 2,
            "chunks": [
                {
                    "chunk_id": "KB-101-CHK-001",
                    "doc_id": "KB-101",
                    "section": "Section 1: Delayed Shipment Guidelines",
                    "heading": "Delayed Shipment Guidelines",
                    "page_number": 1,
                    "content": "Packages delayed beyond 72 hours must be flagged for immediate escalation to Logistics operations manager. Agents must document all carrier tracking notes in the SLA breach log.",
                    "version": "v2.1"
                },
                {
                    "chunk_id": "KB-101-CHK-002",
                    "doc_id": "KB-101",
                    "section": "Section 2: Discount & Refund Eligibility",
                    "heading": "Discount & Refund Eligibility",
                    "page_number": 1,
                    "content": "If delivery delay exceeds 5 business days without carrier update, customer is eligible for a full shipping fee refund or 15% promotional credit on next order.",
                    "version": "v2.1"
                }
            ],
            "effective_date": datetime.utcnow(),
            "uploaded_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        },
        {
            "doc_id": "KB-102",
            "title": "Finance & Double Charge Refund Standard SOP",
            "category": "Refund",
            "department_id": "DEP-102",
            "department": "Finance",
            "file_type": "PDF",
            "file_size_kb": 98.2,
            "version": "v3.0",
            "status": "Active",
            "full_text": "Section 1: Refund Processing Protocol\nDefective products or verified duplicate billing charges must be refunded within 24 hours of customer request. Partial refunds require supervisor authorization.\n\nSection 2: Payment Gateway Reversal\nAll gateway refunds will be returned to original payment source (Credit Card / UPI / Wallet) within 3-5 business days.",
            "chunk_count": 2,
            "chunks": [
                {
                    "chunk_id": "KB-102-CHK-001",
                    "doc_id": "KB-102",
                    "section": "Section 1: Refund Processing Protocol",
                    "heading": "Refund Processing Protocol",
                    "page_number": 1,
                    "content": "Defective products or verified duplicate billing charges must be refunded within 24 hours of customer request. Partial refunds require supervisor authorization.",
                    "version": "v3.0"
                },
                {
                    "chunk_id": "KB-102-CHK-002",
                    "doc_id": "KB-102",
                    "section": "Section 2: Payment Gateway Reversal",
                    "heading": "Payment Gateway Reversal",
                    "page_number": 1,
                    "content": "All gateway refunds will be returned to original payment source (Credit Card / UPI / Wallet) within 3-5 business days.",
                    "version": "v3.0"
                }
            ],
            "effective_date": datetime.utcnow(),
            "uploaded_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
    ]

    for pol in sample_policies:
        await db.kb_docs.update_one(
            {"doc_id": pol["doc_id"]},
            {"$set": pol},
            upsert=True
        )

    # 5. Seed Sample Registered Customers
    sample_customers = [
        {"user_id": "CUST-101", "name": "Ayesha Khan", "email": "ayesha@gmail.com", "role": "CUSTOMER", "status": "ACTIVE"},
        {"user_id": "CUST-102", "name": "Hamza Ali", "email": "hamza@gmail.com", "role": "CUSTOMER", "status": "ACTIVE"},
        {"user_id": "CUST-103", "name": "Fatima Noor", "email": "fatima@gmail.com", "role": "CUSTOMER", "status": "ACTIVE"},
        {"user_id": "CUST-104", "name": "Usman Tariq", "email": "usman@gmail.com", "role": "CUSTOMER", "status": "ACTIVE"},
        {"user_id": "CUST-105", "name": "Zainab Bibi", "email": "zainab@gmail.com", "role": "CUSTOMER", "status": "ACTIVE"},
    ]
    for cust in sample_customers:
        await db.users.update_one(
            {"email": cust["email"]},
            {"$set": {**cust, "hashed_password": hash_password("customer123"), "created_at": datetime.utcnow()}},
            upsert=True
        )

    # 6. Seed Sample Realistic Tickets across the past 7 days
    ticket_count = await db.tickets.count_documents({})
    if ticket_count == 0:
        now = datetime.utcnow()
        sample_tickets = [
            {
                "ticket_id": "CMP-9001",
                "title": "Severe delivery delay > 5 days without carrier scan",
                "description": "My apparel shipment has been stuck in sorting hub for 5 days. Urgent assistance requested.",
                "customer_id": "CUST-101",
                "customer_name": "Ayesha Khan",
                "customer_email": "ayesha@gmail.com",
                "order_id": "ORD-8812",
                "channel": "Web Form",
                "category": "Delivery",
                "category_id": "CAT-101",
                "department": "Logistics",
                "department_id": "DEP-101",
                "priority": "P1",
                "status": "In Progress",
                "assigned_agent_id": "STF-101",
                "assigned_agent": "Zara Ahmed",
                "assigned_agent_email": "zara@company.com",
                "match_status": True,
                "sla_hours_remaining": 6.5,
                "created_at": now - timedelta(days=6, hours=2),
                "updated_at": now - timedelta(days=5, hours=1)
            },
            {
                "ticket_id": "CMP-9002",
                "title": "Duplicate charge on credit card during checkout",
                "description": "I was debited twice for order ORD-4491. Please reverse the duplicate charge immediately.",
                "customer_id": "CUST-102",
                "customer_name": "Hamza Ali",
                "customer_email": "hamza@gmail.com",
                "order_id": "ORD-4491",
                "channel": "Email Ingestion",
                "category": "Billing",
                "category_id": "CAT-105",
                "department": "Finance",
                "department_id": "DEP-102",
                "priority": "P0",
                "status": "In Progress",
                "assigned_agent_id": "STF-102",
                "assigned_agent": "Omar Sheikh",
                "assigned_agent_email": "omar@company.com",
                "match_status": True,
                "sla_hours_remaining": -1.2,
                "sla_breach": True,
                "created_at": now - timedelta(days=5, hours=4),
                "updated_at": now - timedelta(days=4, hours=2)
            },
            {
                "ticket_id": "CMP-9003",
                "title": "Wrong size and defective stitching on winter jacket",
                "description": "Received Medium instead of Large and seam is torn. Need immediate replacement.",
                "customer_id": "CUST-103",
                "customer_name": "Fatima Noor",
                "customer_email": "fatima@gmail.com",
                "order_id": "ORD-7719",
                "channel": "Live Chat",
                "category": "Replacement",
                "category_id": "CAT-103",
                "department": "Fulfillment",
                "department_id": "DEP-104",
                "priority": "P2",
                "status": "Resolved",
                "assigned_agent_id": "STF-101",
                "assigned_agent": "Zara Ahmed",
                "match_status": True,
                "sla_hours_remaining": 18.0,
                "created_at": now - timedelta(days=5, hours=6),
                "updated_at": now - timedelta(days=4, hours=1)
            },
            {
                "ticket_id": "CMP-9004",
                "title": "Discrepancy in automated classification: return requested on final-sale item",
                "description": "Customer demanding return on clearance final sale item. GenAI categorized as general refund but policy prohibits return.",
                "customer_id": "CUST-104",
                "customer_name": "Usman Tariq",
                "customer_email": "usman@gmail.com",
                "order_id": "ORD-3321",
                "channel": "Web Form",
                "category": "Refund",
                "category_id": "CAT-102",
                "department": "Quality",
                "department_id": "DEP-103",
                "priority": "P2",
                "status": "AI Review",
                "match_status": False,
                "sla_hours_remaining": 14.0,
                "created_at": now - timedelta(days=4, hours=3),
                "updated_at": now - timedelta(days=4, hours=1)
            },
            {
                "ticket_id": "CMP-9005",
                "title": "Damaged goods replacement expedited by supervisor override",
                "description": "Customer received water-damaged carton. Supervisor approved override for immediate express dispatch.",
                "customer_id": "CUST-105",
                "customer_name": "Zainab Bibi",
                "customer_email": "zainab@gmail.com",
                "order_id": "ORD-9904",
                "channel": "Web Form",
                "category": "Replacement",
                "category_id": "CAT-103",
                "department": "Fulfillment",
                "department_id": "DEP-104",
                "priority": "P1",
                "status": "Resolved",
                "assigned_agent_id": "STF-101",
                "reviewer_override": True,
                "overridden_by": "sana@company.com",
                "created_at": now - timedelta(days=3, hours=5),
                "updated_at": now - timedelta(days=3, hours=1)
            },
            {
                "ticket_id": "CMP-9006",
                "title": "General inquiry regarding exchange period policy",
                "description": "Customer asking how many days they have to exchange an unworn hoodie.",
                "customer_id": "CUST-101",
                "customer_name": "Ayesha Khan",
                "customer_email": "ayesha@gmail.com",
                "order_id": "ORD-1102",
                "channel": "Live Chat",
                "category": "General",
                "category_id": "CAT-107",
                "department": "Customer Experience",
                "department_id": "DEP-106",
                "priority": "P3",
                "status": "Resolved",
                "match_status": True,
                "created_at": now - timedelta(days=3, hours=2),
                "updated_at": now - timedelta(days=2, hours=6)
            },
            {
                "ticket_id": "CMP-9007",
                "title": "Delayed delivery on express courier order",
                "description": "Paid extra for next-day air shipping but package not delivered after 48h.",
                "customer_id": "CUST-102",
                "customer_name": "Hamza Ali",
                "customer_email": "hamza@gmail.com",
                "order_id": "ORD-6671",
                "channel": "Web Form",
                "category": "Delivery",
                "category_id": "CAT-101",
                "department": "Logistics",
                "department_id": "DEP-101",
                "priority": "P1",
                "status": "In Triage",
                "match_status": True,
                "sla_hours_remaining": 8.0,
                "created_at": now - timedelta(days=2, hours=5),
                "updated_at": now - timedelta(days=2, hours=3)
            },
            {
                "ticket_id": "CMP-9008",
                "title": "Defective zipper on winter parka",
                "description": "Zipper got stuck and broke on first wear. Requesting warranty repair or refund.",
                "customer_id": "CUST-103",
                "customer_name": "Fatima Noor",
                "customer_email": "fatima@gmail.com",
                "order_id": "ORD-5544",
                "channel": "Email Ingestion",
                "category": "Warranty",
                "category_id": "CAT-104",
                "department": "Quality",
                "department_id": "DEP-103",
                "priority": "P2",
                "status": "In Progress",
                "assigned_agent_id": "STF-102",
                "match_status": True,
                "sla_hours_remaining": 22.0,
                "created_at": now - timedelta(days=1, hours=8),
                "updated_at": now - timedelta(days=1, hours=2)
            },
            {
                "ticket_id": "CMP-9009",
                "title": "Critical warehouse dispatch error: bulk order missing items",
                "description": "Corporate order of 50 uniforms arrived with only 30 units inside the pallet.",
                "customer_id": "CUST-104",
                "customer_name": "Usman Tariq",
                "customer_email": "usman@gmail.com",
                "order_id": "ORD-2201",
                "channel": "Web Form",
                "category": "Delivery",
                "category_id": "CAT-101",
                "department": "Operations",
                "department_id": "DEP-105",
                "priority": "P0",
                "status": "Escalated",
                "assigned_agent_id": "STF-104",
                "match_status": True,
                "sla_hours_remaining": 3.0,
                "created_at": now - timedelta(days=1, hours=3),
                "updated_at": now - timedelta(hours=5)
            },
            {
                "ticket_id": "CMP-9010",
                "title": "Refund requested for cancelled item",
                "description": "Item was cancelled before dispatch but payment gateway has not credited back to bank.",
                "customer_id": "CUST-105",
                "customer_name": "Zainab Bibi",
                "customer_email": "zainab@gmail.com",
                "order_id": "ORD-9912",
                "channel": "Live Chat",
                "category": "Refund",
                "category_id": "CAT-102",
                "department": "Finance",
                "department_id": "DEP-102",
                "priority": "P2",
                "status": "In Triage",
                "match_status": True,
                "sla_hours_remaining": 19.5,
                "created_at": now - timedelta(hours=6),
                "updated_at": now - timedelta(hours=2)
            },
            {
                "ticket_id": "CMP-9011",
                "title": "Minor color shade difference in cotton shirt",
                "description": "Color looks slightly darker than product photo online. Customer asking for advice.",
                "customer_id": "CUST-101",
                "customer_name": "Ayesha Khan",
                "customer_email": "ayesha@gmail.com",
                "order_id": "ORD-3388",
                "channel": "Portal",
                "category": "Quality",
                "category_id": "CAT-106",
                "department": "Quality",
                "department_id": "DEP-103",
                "priority": "P3",
                "status": "In Triage",
                "match_status": True,
                "sla_hours_remaining": 36.0,
                "created_at": now - timedelta(hours=2),
                "updated_at": now - timedelta(hours=1)
            }
        ]
        await db.tickets.insert_many(sample_tickets)
        print(f"[+] Sample tickets seeded ({len(sample_tickets)} complaints).")

    print("SUCCESS: Database seeding completed successfully!")
    client.close()

if __name__ == "__main__":
    asyncio.run(seed_database())
