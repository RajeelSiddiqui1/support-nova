"""
NovaWear SupportNova — Configuration & Ground-Truth Rules Service.
Persists and loads enterprise configurations from MongoDB:
- `category_required_fields`
- `adversarial_rules`
- `escalation_rules` (30+ rules covering safety, legal, privacy, fraud, etc.)
- `verification_weights_config`
- `sla_configs`
- `system_configs` (length, regex, duplicate thresholds)
Provides deterministic zero-LLM evaluators and fallback defaults.
"""

from datetime import datetime
from typing import Dict, Any, List, Optional

try:
    from lib.db import get_database
except ImportError:
    from server.lib.db import get_database

# ── 1. CATEGORY REQUIRED FIELDS DEFAULTS (F3) ──
DEFAULT_CATEGORY_REQUIRED_FIELDS: List[Dict[str, Any]] = [
    {
        "category": "Delivery",
        "subcategory": None,
        "required_fields": ["order_id", "product", "order_date"],
        "description": "Standard delivery complaints require order ID, item name, and date."
    },
    {
        "category": "Order Inquiry",
        "subcategory": None,
        "required_fields": ["order_id", "description"],
        "description": "Order inquiries and delivery tracking require order ID."
    },
    {
        "category": "Refund",
        "subcategory": None,
        "required_fields": ["order_id", "transaction_date", "product", "amount"],
        "description": "Refund requests require purchase details, date, product, and amount."
    },
    {
        "category": "Returns & Refunds",
        "subcategory": None,
        "required_fields": ["order_id", "transaction_date", "product", "amount"],
        "description": "Returns and refund requests require order ID and product details."
    },
    {
        "category": "Product Defect",
        "subcategory": None,
        "required_fields": ["order_id", "product", "evidence", "description"],
        "description": "Defect complaints require product identification and photo evidence."
    },
    {
        "category": "Product Quality & Defects",
        "subcategory": None,
        "required_fields": ["order_id", "product", "evidence", "description"],
        "description": "Defect and garment quality complaints require order ID, item, and evidence."
    },
    {
        "category": "Wrong Product",
        "subcategory": None,
        "required_fields": ["order_id", "product", "evidence", "description"],
        "description": "Incorrect item received requires photos of package and SKU received."
    },
    {
        "category": "Billing",
        "subcategory": None,
        "required_fields": ["order_id", "transaction_date", "amount", "description"],
        "description": "Billing inquiries require transaction reference, charge date, and amount."
    },
    {
        "category": "Billing & Payments",
        "subcategory": None,
        "required_fields": ["order_id", "transaction_date", "amount", "description"],
        "description": "Billing inquiries require transaction reference and amount."
    },
    {
        "category": "Safety",
        "subcategory": None,
        "required_fields": ["product", "description"],
        "description": "Safety incidents require product description and condition report."
    },
    {
        "category": "General",
        "subcategory": None,
        "required_fields": ["order_id", "description"],
        "description": "General customer service inquiries."
    }
]

# ── 2. ADVERSARIAL & PROMPT INJECTION RULES (F5) ──
DEFAULT_ADVERSARIAL_RULES: List[Dict[str, Any]] = [
    {
        "pattern_id": "ADV-001",
        "pattern_type": "regex",
        "expression": r"(?i)(ignore\s+(all\s+)?(previous|prior|system)?\s*(system\s+)?instructions|system\s+prompt|disregard\s+(the\s+)?above)",
        "severity": "CRITICAL",
        "description": "Directive to wipe or override agent system instructions"
    },
    {
        "pattern_id": "ADV-002",
        "pattern_type": "regex",
        "expression": r"(?i)(you\s+are\s+now\s+(a|an|in)|roleplay\s+as\s+admin|dan\s+mode)",
        "severity": "CRITICAL",
        "description": "Role hijacking or persona override attempt"
    },
    {
        "pattern_id": "ADV-003",
        "pattern_type": "regex",
        "expression": r"(?i)(approve\s+my\s+refund\s+immediately|override\s+policy|grant\s+full\s+waiver)",
        "severity": "HIGH",
        "description": "Direct coercive command trying to bypass human validation"
    },
    {
        "pattern_id": "ADV-004",
        "pattern_type": "regex",
        "expression": r"(?i)(admin\s+override\s+code|sudo\s+approve|bypass\s+matrix)",
        "severity": "CRITICAL",
        "description": "Fake administrative bypass code injection"
    },
    {
        "pattern_id": "ADV-005",
        "pattern_type": "regex",
        "expression": r"(?i)(\bPOL-[0-9]{5,}\b|\bFAKE-POL\b|\bBYPASS-POL\b)",
        "severity": "HIGH",
        "description": "Fabricated policy citation injection"
    },
    {
        "pattern_id": "ADV-006",
        "pattern_type": "regex",
        "expression": r"(?i)(===.*?===|```system|\[system\s+prompt\]|admin\s+override)",
        "severity": "HIGH",
        "description": "Delimiter collision or pseudo system prompt markup"
    }
]

# ── 3. 30+ ENTERPRISE ESCALATION RULES (F7) ──
DEFAULT_ESCALATION_RULES: List[Dict[str, Any]] = [
    # Group A: Safety & Physical Harm (CRITICAL_MANAGEMENT)
    {
        "rule_id": "ESC-SAFE-01",
        "trigger": "safety",
        "keywords": ["rash", "allergic reaction", "hives", "chemical burn", "skin burn", "laceration", "bleeding", "blood", "cut", "injury", "broken glass", "staple"],
        "level": "CRITICAL_MANAGEMENT",
        "department": "Quality Assurance",
        "description": "Chemical residue, physical laceration, or severe skin reaction from garment"
    },
    {
        "rule_id": "ESC-SAFE-02",
        "trigger": "safety",
        "keywords": ["needle", "pin", "sharp wire", "razor", "blade in package", "staple in collar", "sharp metal"],
        "level": "CRITICAL_MANAGEMENT",
        "department": "Quality Assurance",
        "description": "Foreign sharp object or needle discovered in fabric"
    },
    {
        "rule_id": "ESC-SAFE-03",
        "trigger": "safety",
        "keywords": ["choking", "choking hazard", "detached button swallowed", "infant"],
        "level": "CRITICAL_MANAGEMENT",
        "department": "Quality Assurance",
        "description": "Choking hazard or loose small parts on children's apparel"
    },
    {
        "rule_id": "ESC-SAFE-04",
        "trigger": "safety",
        "keywords": ["flammable", "caught fire", "burn injury", "toxic smell", "fumes"],
        "level": "CRITICAL_MANAGEMENT",
        "department": "Quality Assurance",
        "description": "Flammability issue or hazardous toxic fumes"
    },
    {
        "rule_id": "ESC-SAFE-05",
        "trigger": "safety_emergency",
        "keywords": ["smoke", "spark", "sparks", "fire", "burning", "short circuit", "electrical failure", "explosion", "warehouse fire", "chemical leak", "hazardous smoke", "smell of burning", "blaze", "dhuan", "aag"],
        "level": "CRITICAL_MANAGEMENT",
        "department": "Safety & Legal Escalations",
        "description": "Critical physical safety hazard, electrical sparks, smoke, or fire emergency in facility/warehouse"
    },
    
    # Group B: Legal Threat & Compliance (COMPLIANCE_REVIEW)
    {
        "rule_id": "ESC-LEG-01",
        "trigger": "legal_threat",
        "keywords": ["attorney", "lawyer", "retained counsel", "legal counsel"],
        "level": "COMPLIANCE_REVIEW",
        "department": "Legal & Compliance",
        "description": "Customer has retained legal representation"
    },
    {
        "rule_id": "ESC-LEG-02",
        "trigger": "legal_threat",
        "keywords": ["lawsuit", "sue you", "court", "small claims", "filing a suit"],
        "level": "COMPLIANCE_REVIEW",
        "department": "Legal & Compliance",
        "description": "Direct threat of litigation or small claims filing"
    },
    {
        "rule_id": "ESC-LEG-03",
        "trigger": "legal_threat",
        "keywords": ["ftc", "consumer protection bureau", "better business bureau", "bbb", "attorney general"],
        "level": "COMPLIANCE_REVIEW",
        "department": "Legal & Compliance",
        "description": "Regulatory body or consumer protection complaint"
    },
    {
        "rule_id": "ESC-LEG-04",
        "trigger": "legal_threat",
        "keywords": ["fraud", "class action", "subpoena", "deceptive trade practices"],
        "level": "COMPLIANCE_REVIEW",
        "department": "Legal & Compliance",
        "description": "Allegations of institutional fraud or class action threat"
    },

    # Group C: Security Breach & Unauthorized Access (SPECIALIST_TEAM)
    {
        "rule_id": "ESC-SEC-01",
        "trigger": "security_breach",
        "keywords": ["account hacked", "unauthorized access", "compromised password", "someone logged into my"],
        "level": "SPECIALIST_TEAM",
        "department": "IT Security",
        "description": "Customer account credential compromise"
    },
    {
        "rule_id": "ESC-SEC-02",
        "trigger": "security_breach",
        "keywords": ["credit card stolen", "unauthorized transaction", "card charged without permission"],
        "level": "SPECIALIST_TEAM",
        "department": "Billing & Finance",
        "description": "Suspected payment card theft or fraudulent order"
    },
    {
        "rule_id": "ESC-SEC-03",
        "trigger": "security_breach",
        "keywords": ["data breach", "leak", "personal info exposed", "ssn", "identity theft"],
        "level": "CRITICAL_MANAGEMENT",
        "department": "IT Security",
        "description": "Allegation of sensitive data exposure or identity theft"
    },

    # Group D: Privacy & GDPR Rights (COMPLIANCE_REVIEW)
    {
        "rule_id": "ESC-PRIV-01",
        "trigger": "privacy",
        "keywords": ["gdpr", "right to be forgotten", "delete my data", "ccpa", "data removal"],
        "level": "COMPLIANCE_REVIEW",
        "department": "Legal & Compliance",
        "description": "Formal statutory privacy deletion or access request"
    },
    {
        "rule_id": "ESC-PRIV-02",
        "trigger": "privacy",
        "keywords": ["wrong address", "package sent to stranger with my details", "privacy breach"],
        "level": "DEPARTMENT_MANAGER",
        "department": "Logistics",
        "description": "Customer PII misdirected to another recipient"
    },

    # Group E: Repeat & Unresolved Frustration (DEPARTMENT_MANAGER)
    {
        "rule_id": "ESC-REP-01",
        "trigger": "repeat_unresolved",
        "threshold_field": "repeat_count",
        "threshold_min": 2,
        "level": "DEPARTMENT_MANAGER",
        "department": "Customer Support",
        "description": "Customer has filed 2 or more unresolved complaints"
    },
    {
        "rule_id": "ESC-REP-02",
        "trigger": "repeat_unresolved",
        "keywords": ["fifth time contacting", "fourth email", "contacted you 4 times", "still no response after weeks"],
        "level": "DEPARTMENT_MANAGER",
        "department": "Customer Support",
        "description": "Prolonged unresolved customer contact loop"
    },
    {
        "rule_id": "ESC-REP-03",
        "trigger": "repeat_unresolved",
        "keywords": ["reopened ticket", "closed without resolving", "marked resolved incorrectly"],
        "level": "SUPERVISOR_REVIEW",
        "department": "Customer Support",
        "description": "Premature ticket closure complaint"
    },

    # Group F: High-Value Financial Disputes (DEPARTMENT_MANAGER)
    {
        "rule_id": "ESC-VAL-01",
        "trigger": "high_value_dispute",
        "threshold_field": "amount",
        "threshold_min": 500.0,
        "level": "DEPARTMENT_MANAGER",
        "department": "Billing & Finance",
        "description": "Complaint financial value exceeds $500 threshold"
    },
    {
        "rule_id": "ESC-VAL-02",
        "trigger": "high_value_dispute",
        "keywords": ["bulk order", "wholesale", "corporate uniform", "50 pieces", "100 pieces"],
        "level": "DEPARTMENT_MANAGER",
        "department": "Billing & Finance",
        "description": "Large corporate or wholesale order dispute"
    },
    {
        "rule_id": "ESC-VAL-03",
        "trigger": "high_value_dispute",
        "keywords": ["chargeback", "bank dispute", "disputed with amex", "disputed with visa"],
        "level": "DEPARTMENT_MANAGER",
        "department": "Billing & Finance",
        "description": "Formal banking chargeback dispute pending"
    },

    # Group G: Severe Service & Delivery Failure (SUPERVISOR_REVIEW / DEPARTMENT_MANAGER)
    {
        "rule_id": "ESC-SRV-01",
        "trigger": "severe_service_failure",
        "keywords": ["wedding dress", "bridesmaid", "groomsman", "wedding ruined", "tomorrow is the wedding"],
        "level": "DEPARTMENT_MANAGER",
        "department": "Logistics",
        "description": "Time-critical bridal/wedding attire delivery failure"
    },
    {
        "rule_id": "ESC-SRV-02",
        "trigger": "severe_service_failure",
        "keywords": ["funeral", "memorial service", "attire for funeral"],
        "level": "DEPARTMENT_MANAGER",
        "department": "Logistics",
        "description": "Time-sensitive bereavement delivery failure"
    },
    {
        "rule_id": "ESC-SRV-03",
        "trigger": "severe_service_failure",
        "keywords": ["courier stole", "driver forged signature", "delivered to bush", "courier threw"],
        "level": "SUPERVISOR_REVIEW",
        "department": "Logistics",
        "description": "Courier misconduct or delivery theft allegation"
    },
    {
        "rule_id": "ESC-SRV-04",
        "trigger": "severe_service_failure",
        "keywords": ["support agent yelled", "agent hung up", "rude representative", "harassment by agent"],
        "level": "SUPERVISOR_REVIEW",
        "department": "Customer Support",
        "description": "Internal staff misconduct or harassment allegation"
    },

    # Group H: Critical Brand & Media Impact (CRITICAL_MANAGEMENT)
    {
        "rule_id": "ESC-IMP-01",
        "trigger": "critical_customer_impact",
        "keywords": ["tiktok video", "viral", "100k followers", "influencer", "posting this to my followers"],
        "level": "DEPARTMENT_MANAGER",
        "department": "Customer Support",
        "description": "Social media viral exposure threat by influencer"
    },
    {
        "rule_id": "ESC-IMP-02",
        "trigger": "critical_customer_impact",
        "keywords": ["journalist", "reporter", "press", "media inquiry", "news article"],
        "level": "CRITICAL_MANAGEMENT",
        "department": "Customer Support",
        "description": "Press, investigative media, or journalist inquiry"
    },
    {
        "rule_id": "ESC-IMP-03",
        "trigger": "critical_customer_impact",
        "keywords": ["vip customer", "platinum tier", "spent over 10000", "top customer"],
        "level": "SUPERVISOR_REVIEW",
        "department": "Customer Support",
        "description": "VIP / Tier-1 account retention risk"
    },

    # Group I: Policy Exceptions & Special Circumstances (DEPARTMENT_MANAGER)
    {
        "rule_id": "ESC-POL-01",
        "trigger": "policy_exception",
        "keywords": ["hospitalized", "medical emergency", "surgery", "icu", "extenuating circumstance"],
        "level": "DEPARTMENT_MANAGER",
        "department": "Returns & Exchanges",
        "description": "Medical emergency late return exception"
    },
    {
        "rule_id": "ESC-POL-02",
        "trigger": "policy_exception",
        "keywords": ["deceased", "passed away", "estate of", "death certificate"],
        "level": "DEPARTMENT_MANAGER",
        "department": "Billing & Finance",
        "description": "Deceased customer account resolution & refund"
    },
    {
        "rule_id": "ESC-POL-03",
        "trigger": "policy_exception",
        "keywords": ["customs seized", "international duty fee", "held at border"],
        "level": "SUPERVISOR_REVIEW",
        "department": "Logistics",
        "description": "Cross-border customs seizure or tariff dispute"
    },
    {
        "rule_id": "ESC-POL-04",
        "trigger": "policy_exception",
        "keywords": ["military deployment", "deployed overseas", "apo address delay"],
        "level": "SUPERVISOR_REVIEW",
        "department": "Logistics",
        "description": "Active military deployment delivery exception"
    }
]

# ── 4. VERIFICATION WEIGHTS & THRESHOLDS (F9) ──
DEFAULT_VERIFICATION_WEIGHTS: Dict[str, Any] = {
    "weights": {
        "category": 20.0,
        "department": 20.0,
        "urgency_priority": 15.0,
        "escalation": 20.0,
        "policy_citation": 15.0,
        "hallucination_absence": 10.0
    },
    "thresholds": {
        "verified_min": 85.0,
        "review_min": 60.0
    }
}

# ── 5. SLA CONFIGS (F13) ──
DEFAULT_SLA_CONFIGS: Dict[str, Any] = {
    "targets": {
        "P0": {"response_hours": 1.0, "resolution_hours": 4.0},
        "P1": {"response_hours": 2.0, "resolution_hours": 8.0},
        "P2": {"response_hours": 4.0, "resolution_hours": 24.0},
        "P3": {"response_hours": 8.0, "resolution_hours": 48.0}
    },
    "risk_threshold_percentage": 75.0
}

# ── 6. SYSTEM VALIDATION CONFIGS (F4) ──
DEFAULT_VALIDATION_CONFIG: Dict[str, Any] = {
    "min_description_length": 15,
    "max_description_length": 4000,
    "order_id_regex": r"^(NW|ORD|CMP)-\d{4,8}$",
    "allowed_attachment_mime_types": ["image/jpeg", "image/png", "application/pdf"],
    "max_attachment_size_bytes": 10485760,  # 10 MB
    "near_duplicate_similarity_threshold": 0.80
}


class ConfigService:
    """Manages system configurations and rule seeds."""
    DEFAULT_REQUIRED_FIELDS = DEFAULT_CATEGORY_REQUIRED_FIELDS
    DEFAULT_ADVERSARIAL_RULES = DEFAULT_ADVERSARIAL_RULES
    DEFAULT_ESCALATION_RULES = DEFAULT_ESCALATION_RULES
    DEFAULT_VERIFICATION_WEIGHTS = DEFAULT_VERIFICATION_WEIGHTS
    DEFAULT_SLA_CONFIGS = DEFAULT_SLA_CONFIGS

    @staticmethod
    async def seed_all_configs(db) -> Dict[str, int]:
        """Seeds all required configurations into MongoDB Atlas if not already present."""
        if db is None:
            return {}

        results = {}

        # 1. category_required_fields
        try:
            cat_count = 0
            for item in DEFAULT_CATEGORY_REQUIRED_FIELDS:
                existing = await db.category_required_fields.find_one({"category": item["category"]})
                if not existing:
                    await db.category_required_fields.insert_one(dict(item))
                    cat_count += 1
            results["category_required_fields"] = cat_count
        except Exception as e:
            print(f"[CONFIG SEED WARNING] category_required_fields: {e}")

        # 2. adversarial_rules
        try:
            adv_count = 0
            for item in DEFAULT_ADVERSARIAL_RULES:
                existing = await db.adversarial_rules.find_one({"pattern_id": item["pattern_id"]})
                if not existing:
                    await db.adversarial_rules.insert_one(dict(item))
                    adv_count += 1
            results["adversarial_rules"] = adv_count
        except Exception as e:
            print(f"[CONFIG SEED WARNING] adversarial_rules: {e}")

        # 3. escalation_rules (30+ rules)
        try:
            esc_count = 0
            for item in DEFAULT_ESCALATION_RULES:
                existing = await db.escalation_rules.find_one({"rule_id": item["rule_id"]})
                if not existing:
                    doc = dict(item)
                    doc["created_at"] = datetime.utcnow()
                    await db.escalation_rules.insert_one(doc)
                    esc_count += 1
            results["escalation_rules"] = esc_count
        except Exception as e:
            print(f"[CONFIG SEED WARNING] escalation_rules: {e}")

        # 4. verification_weights_config
        try:
            existing = await db.system_configs.find_one({"_id": "verification_weights"})
            if not existing:
                doc = dict(DEFAULT_VERIFICATION_WEIGHTS)
                doc["_id"] = "verification_weights"
                await db.system_configs.insert_one(doc)
                results["verification_weights"] = 1
        except Exception as e:
            print(f"[CONFIG SEED WARNING] verification_weights: {e}")

        # 5. sla_configs
        try:
            existing = await db.system_configs.find_one({"_id": "sla_targets"})
            if not existing:
                doc = dict(DEFAULT_SLA_CONFIGS)
                doc["_id"] = "sla_targets"
                await db.system_configs.insert_one(doc)
                results["sla_targets"] = 1
        except Exception as e:
            print(f"[CONFIG SEED WARNING] sla_targets: {e}")

        # 6. validation_config
        try:
            existing = await db.system_configs.find_one({"_id": "validation_config"})
            if not existing:
                doc = dict(DEFAULT_VALIDATION_CONFIG)
                doc["_id"] = "validation_config"
                await db.system_configs.insert_one(doc)
                results["validation_config"] = 1
        except Exception as e:
            print(f"[CONFIG SEED WARNING] validation_config: {e}")

        return results

    @staticmethod
    async def get_required_fields_map(db) -> Dict[str, List[str]]:
        """Returns map of category name -> required fields list."""
        if db is not None:
            try:
                cursor = db.category_required_fields.find({})
                docs = await cursor.to_list(length=100)
                if docs:
                    return {d["category"]: d.get("required_fields", []) for d in docs}
            except Exception:
                pass
        return {d["category"]: d.get("required_fields", []) for d in DEFAULT_CATEGORY_REQUIRED_FIELDS}

    @staticmethod
    async def get_escalation_rules(db) -> List[Dict[str, Any]]:
        """Returns list of active escalation rules."""
        if db is not None:
            try:
                cursor = db.escalation_rules.find({"is_active": {"$ne": False}})
                docs = await cursor.to_list(length=100)
                if docs:
                    return docs
            except Exception:
                pass
        return DEFAULT_ESCALATION_RULES

    @staticmethod
    async def get_adversarial_rules(db) -> List[Dict[str, Any]]:
        """Returns list of active adversarial injection patterns."""
        if db is not None:
            try:
                cursor = db.adversarial_rules.find({})
                docs = await cursor.to_list(length=100)
                if docs:
                    return docs
            except Exception:
                pass
        return DEFAULT_ADVERSARIAL_RULES
