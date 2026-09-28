"""
NovaWear SupportNova — Enterprise v2 Idempotent Database Migration Script.
Creates new MongoDB collections, performance compound indexes, and seeds baseline
prompt templates, configuration rules, adversarial patterns, and verification weights.
Safe to run repeatedly (idempotent).
"""

import asyncio
import os
import sys
from pathlib import Path

# Add server root to sys.path
SERVER_ROOT = Path(__file__).resolve().parent.parent
if str(SERVER_ROOT) not in sys.path:
    sys.path.insert(0, str(SERVER_ROOT))

from lib.db import connect_to_mongo, close_mongo_connection, get_database
from ai.prompt_service import PromptService
from services.config_service import ConfigService


async def run_migration():
    print("==================================================")
    print("SupportNova Enterprise v2 MongoDB Migration")
    print("==================================================")

    await connect_to_mongo()
    db = get_database()

    if db is None:
        print("[ERROR] Could not establish MongoDB Atlas connection. Check MONGO_URI.")
        sys.exit(1)

    print(f"Connected to database: {db.name}")

    # ── 1. Create Collections & Performance Indexes ──
    print("\n[Step 1/3] Ensuring Collections & Performance Indexes...")

    # prompt_templates
    await db.prompt_templates.create_index([("name", 1), ("version", 1)], unique=True, name="idx_prompts_name_version")
    await db.prompt_templates.create_index([("name", 1), ("status", 1)], name="idx_prompts_name_status")
    print("  [OK] prompt_templates indexes created.")

    # tickets
    await db.tickets.create_index([("ticket_id", 1)], unique=True, sparse=True, name="idx_tickets_id_unique")
    await db.tickets.create_index([("content_hash", 1)], sparse=True, name="idx_tickets_content_hash")
    await db.tickets.create_index([("duplicate_of", 1)], sparse=True, name="idx_tickets_duplicate_of")
    await db.tickets.create_index([("is_repeat", 1)], name="idx_tickets_is_repeat")
    await db.tickets.create_index([("department_mismatch", 1)], name="idx_tickets_dept_mismatch")
    await db.tickets.create_index([("mismatch_type", 1)], sparse=True, name="idx_tickets_mismatch_type")
    await db.tickets.create_index([("escalation_required", 1)], name="idx_tickets_escalation_required")
    await db.tickets.create_index([("verification_score", 1)], sparse=True, name="idx_tickets_verif_score")
    await db.tickets.create_index([("sla_status", 1)], name="idx_tickets_sla_status")
    await db.tickets.create_index([("clarification_needed", 1)], name="idx_tickets_clarif_needed")
    await db.tickets.create_index([("created_at", -1)], name="idx_tickets_created_at")
    await db.tickets.create_index([("department", 1), ("status", 1)], name="idx_tickets_dept_status")
    print("  [OK] tickets extended enterprise indexes created.")

    # system_audit_logs
    await db.system_audit_logs.create_index([("ticket_id", 1), ("timestamp", -1)], name="idx_audit_ticket_time")
    await db.system_audit_logs.create_index([("event_type", 1), ("timestamp", -1)], name="idx_audit_event_time")
    await db.system_audit_logs.create_index([("actor.user_id", 1), ("timestamp", -1)], sparse=True, name="idx_audit_actor_time")
    await db.system_audit_logs.create_index([("timestamp", -1)], name="idx_audit_timestamp")
    print("  [OK] system_audit_logs indexes created.")

    # genai_failures
    await db.genai_failures.create_index([("ticket_id", 1)], sparse=True, name="idx_genai_fail_ticket")
    await db.genai_failures.create_index([("failure_type", 1)], name="idx_genai_fail_type")
    await db.genai_failures.create_index([("timestamp", -1)], name="idx_genai_fail_time")
    print("  [OK] genai_failures indexes created.")

    # kb_docs
    await db.kb_docs.create_index([("doc_id", 1)], unique=True, name="idx_kb_doc_id_unique")
    await db.kb_docs.create_index([("sha256_hash", 1)], sparse=True, name="idx_kb_sha256")
    await db.kb_docs.create_index([("status", 1)], name="idx_kb_status")
    await db.kb_docs.create_index([("category", 1)], name="idx_kb_category")
    await db.kb_docs.create_index([("precedence_level", 1)], name="idx_kb_precedence")
    print("  [OK] kb_docs indexes created.")

    # adversarial_rules
    await db.adversarial_rules.create_index([("pattern_id", 1)], unique=True, name="idx_adv_pattern_unique")
    print("  [OK] adversarial_rules indexes created.")

    # escalation_rules
    await db.escalation_rules.create_index([("rule_id", 1)], unique=True, name="idx_esc_rule_unique")
    print("  [OK] escalation_rules indexes created.")

    # category_required_fields
    await db.category_required_fields.create_index([("category", 1)], unique=True, name="idx_cat_req_unique")
    print("  [OK] category_required_fields indexes created.")

    # ── 2. Seed Baseline Prompt Templates (F1) ──
    print("\n[Step 2/3] Seeding Baseline Versioned Prompts...")
    prompt_seed_res = await PromptService.seed_default_prompts(db)
    print(f"  [OK] Prompts seeded: {prompt_seed_res}")

    # ── 3. Seed Enterprise Configuration & Rules (F3, F5, F7, F9, F13) ──
    print("\n[Step 3/3] Seeding Enterprise Configuration & Rule Matrices...")
    config_seed_res = await ConfigService.seed_all_configs(db)
    print(f"  [OK] Configurations seeded: {config_seed_res}")

    print("\n==================================================")
    print("Enterprise v2 Migration Completed Successfully!")
    print("==================================================")

    await close_mongo_connection()


if __name__ == "__main__":
    asyncio.run(run_migration())
