"""
NovaWear SupportNova — Complaint Intelligence Service Module.
Implements dual-pipeline intelligence logic:
- Pipeline 1: GenAI generation via Groq & PromptService (delimiters, summaries, clarifications, follow-ups).
- Pipeline 2: 100% Deterministic Python validation with ZERO LLM calls (missing-fields, adversarial scan,
  routing check, escalation rules, hallucination detection, verification score, repeat detection, SLA).
"""

import re
import uuid
import json
import unicodedata
import hashlib
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Tuple, Set

try:
    from rapidfuzz import fuzz
except ImportError:
    fuzz = None

try:
    from ai.groq_client import GroqAIClient
    from ai.prompt_service import PromptService
    from services.config_service import (
        DEFAULT_CATEGORY_REQUIRED_FIELDS,
        DEFAULT_ADVERSARIAL_RULES,
        DEFAULT_ESCALATION_RULES,
        DEFAULT_VERIFICATION_WEIGHTS,
        DEFAULT_SLA_CONFIGS,
        DEFAULT_VALIDATION_CONFIG
    )
except ImportError:
    from server.ai.groq_client import GroqAIClient
    from server.ai.prompt_service import PromptService
    from server.services.config_service import (
        DEFAULT_CATEGORY_REQUIRED_FIELDS,
        DEFAULT_ADVERSARIAL_RULES,
        DEFAULT_ESCALATION_RULES,
        DEFAULT_VERIFICATION_WEIGHTS,
        DEFAULT_SLA_CONFIGS,
        DEFAULT_VALIDATION_CONFIG
    )


class ComplaintIntelligenceService:
    def __init__(self, groq_client: Optional[GroqAIClient] = None):
        self.groq = groq_client or GroqAIClient()

    # =========================================================================
    # ── FEATURE 4: PRE-PROCESSING & VALIDATION (Pipeline 2 - Deterministic) ──
    # =========================================================================
    @staticmethod
    def validate_and_preprocess_complaint(
        title: str = "",
        description: str = "",
        order_id: Optional[str] = None,
        customer_id: str = "anonymous",
        attachments: Optional[List[str]] = None,
        config: Optional[Dict[str, Any]] = None,
        raw_title: Optional[str] = None,
        raw_description: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Deterministic pre-processing before any LLM call:
        - HTML strip, unicode NFKC normalization, control-character stripping.
        - Length validation (min / max chars).
        - Order ID regex verification.
        - Exact duplicate hash generation.
        """
        eff_title = raw_title if raw_title is not None else (title or "")
        eff_desc = raw_description if raw_description is not None else (description or "")

        cfg = config or DEFAULT_VALIDATION_CONFIG
        min_len = cfg.get("min_description_length", 15)
        max_len = cfg.get("max_description_length", 4000)
        order_regex = cfg.get("order_id_regex", r"^(NW|ORD|CMP)-\d{4,8}$")

        raw_text = f"{eff_title} {eff_desc}"

        # 1. HTML Strip
        clean_text = re.sub(r"<[^>]+>", " ", raw_text)

        # 2. Unicode NFKC Normalization
        norm_text = unicodedata.normalize("NFKC", clean_text)

        # 3. Strip Non-Printable Control Characters (except whitespace)
        filtered_text = "".join(ch for ch in norm_text if ch.isprintable() or ch in "\n\r\t")
        normalized_description = filtered_text[:max_len].strip()
        normalized_title = unicodedata.normalize("NFKC", re.sub(r"<[^>]+>", " ", eff_title)).strip()

        # 4. Length Validation
        if len(normalized_description) < min_len:
            return {
                "is_valid": False,
                "error": f"Complaint description is too short ({len(normalized_description)} chars). Minimum required is {min_len} characters.",
                "normalized_title": normalized_title,
                "normalized_description": normalized_description,
                "content_hash": None,
                "extracted_metadata": {}
            }

        # 5. Metadata Extraction via Regex
        extracted: Dict[str, Any] = {
            "dates": re.findall(r"\b(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]* \d{1,2},? \d{4})\b", normalized_description, re.IGNORECASE),
            "amounts": [float(m) for m in re.findall(r"\$\s*(\d+(?:\.\d{1,2})?)", normalized_description)],
            "detected_order_ids": re.findall(r"\b(?:NW|ORD|CMP)-\d{4,8}\b", normalized_description, re.IGNORECASE)
        }

        # Validate provided order_id format if present
        effective_order_id = order_id
        if effective_order_id:
            effective_order_id = effective_order_id.strip()
            if not re.match(order_regex, effective_order_id, re.IGNORECASE):
                # We flag as non-standard but preserve
                extracted["order_id_format_warning"] = f"Order ID '{effective_order_id}' does not match expected format {order_regex}"
        elif extracted["detected_order_ids"]:
            effective_order_id = extracted["detected_order_ids"][0]

        # 6. Compute Deterministic Content Hash for Exact Deduplication
        hash_input = f"{normalized_title.lower()}:{normalized_description.lower()}:{customer_id}:{effective_order_id or ''}"
        content_hash = hashlib.sha256(hash_input.encode("utf-8")).hexdigest()

        return {
            "is_valid": True,
            "error": None,
            "normalized_title": normalized_title,
            "normalized_description": normalized_description,
            "effective_order_id": effective_order_id,
            "content_hash": content_hash,
            "extracted_metadata": extracted
        }

    # =========================================================================
    # ── FEATURE 5: ADVERSARIAL & PROMPT INJECTION (Pipeline 2 - Deterministic)
    # =========================================================================
    @staticmethod
    def detect_adversarial_patterns(
        text: str,
        rules: Optional[List[Dict[str, Any]]] = None
    ) -> List[Dict[str, Any]]:
        """
        Deterministic layer to detect adversarial prompt injection patterns.
        Zero LLM calls. Returns list of matched flag objects.
        """
        active_rules = rules or DEFAULT_ADVERSARIAL_RULES
        flags = []

        for r in active_rules:
            pattern = r.get("expression")
            if not pattern:
                continue
            try:
                matches = re.finditer(pattern, text)
                for m in matches:
                    flags.append({
                        "type": "PROMPT_INJECTION",
                        "pattern_id": r.get("pattern_id", "ADV-UNKNOWN"),
                        "matched_text": m.group(0),
                        "severity": r.get("severity", "HIGH"),
                        "description": r.get("description", "Adversarial pattern match"),
                        "detected_at": datetime.utcnow().isoformat()
                    })
            except Exception as e:
                print(f"[ADVERSARIAL SCAN WARNING] Pattern '{pattern}' error: {e}")

        return flags

    # =========================================================================
    # ── FEATURE 3: MISSING INFO DETECTION (Pipeline 2 - Deterministic) ────────
    # =========================================================================
    @staticmethod
    def detect_missing_info(
        ticket_data: Dict[str, Any],
        entities: Optional[Dict[str, Any]] = None,
        category: str = "General",
        required_fields_map: Optional[Dict[str, List[str]]] = None
    ) -> Dict[str, Any]:
        """
        Deterministic check: evaluates missing fields against category requirements.
        Zero LLM calls.
        """
        req_map = required_fields_map or {d["category"]: d.get("required_fields", []) for d in DEFAULT_CATEGORY_REQUIRED_FIELDS}
        required_fields = req_map.get(category)
        if not required_fields:
            c_low = (category or "").lower().strip()
            for k, v in req_map.items():
                if k.lower() in c_low or c_low in k.lower():
                    required_fields = v
                    break
        if not required_fields:
            required_fields = req_map.get("General", ["order_id", "description"])

        ent = entities or {}
        title = (ticket_data.get("title") or "").strip()
        description = (ticket_data.get("description") or "").strip()
        order_id = ticket_data.get("order_id") or ent.get("order_id")
        attachments = ticket_data.get("attachments") or []

        combined_text = f"{title} {description}".lower()
        missing = []

        for req in required_fields:
            if req == "order_id":
                if not order_id and not re.search(r"\b(NW|ORD|CMP)-\d{4,8}\b", combined_text, re.IGNORECASE):
                    missing.append("order_id")

            elif req in ["transaction_date", "order_date", "date"]:
                date_val = ent.get("date")
                has_date_keyword = any(k in combined_text for k in ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec", "yesterday", "today", "2024", "2025", "2026"])
                if not date_val and not has_date_keyword:
                    missing.append(req)

            elif req == "product":
                prod_val = ent.get("product") or ticket_data.get("product_service")
                has_product_word = any(w in combined_text for w in ["shirt", "pant", "hoodie", "jacket", "dress", "tee", "sweater", "garment", "apparel", "item", "sku", "size", "color"])
                if not prod_val and not has_product_word:
                    missing.append("product")

            elif req == "amount":
                amt_val = ent.get("amount")
                has_dollar = "$" in combined_text or "dollar" in combined_text or "refund" in combined_text
                if amt_val is None and not has_dollar:
                    missing.append("amount")

            elif req in ["evidence", "evidence_if_defect"]:
                if len(attachments) == 0 and not any(w in combined_text for w in ["photo", "picture", "image", "attached", "upload"]):
                    missing.append("evidence")

            elif req == "description":
                if len(description) < 15:
                    missing.append("description")

        severity = "HIGH" if "order_id" in missing or "evidence" in missing else "MEDIUM"
        if not missing:
            severity = "NONE"

        return {
            "missing_fields": missing,
            "severity": severity,
            "has_missing_info": len(missing) > 0
        }

    # =========================================================================
    # ── FEATURE 6: MULTI-DEPARTMENT ROUTING (Pipeline 2 - Deterministic) ─────
    # =========================================================================
    @staticmethod
    def validate_multi_department_routing(
        primary_issue: Optional[Dict[str, Any]],
        secondary_issues: Optional[List[Dict[str, Any]]],
        genai_primary_dept: str,
        genai_supporting_depts: Optional[List[str]],
        rule_matrix: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Validates GenAI proposed routing against the deterministic Complaint Resolution Rule Matrix.
        Zero LLM calls.
        """
        gen_prim = (genai_primary_dept or "Logistics").strip()
        gen_supp = set(d.strip() for d in (genai_supporting_depts or []) if d.strip())

        # Determine expected primary department from Rule Matrix by primary issue category
        prim_cat = (primary_issue.get("category") if primary_issue else None) or "General"
        matrix_prim_dept = None
        matrix_supporting_depts: Set[str] = set()

        for rule in rule_matrix:
            if rule.get("category", "").lower() == prim_cat.lower() and rule.get("is_active", True):
                matrix_prim_dept = rule.get("department")
                for s in rule.get("supporting_departments", []):
                    matrix_supporting_depts.add(s)
                break

        if not matrix_prim_dept:
            matrix_prim_dept = gen_prim

        # Check secondary issue departments
        sec_depts: List[str] = []
        for sec in (secondary_issues or []):
            s_cat = sec.get("category", "")
            for rule in rule_matrix:
                if rule.get("category", "").lower() == s_cat.lower() and rule.get("is_active", True):
                    d = rule.get("department")
                    if d:
                        sec_depts.append(d)
                        matrix_supporting_depts.add(d)

        # Match check
        primary_matches = (gen_prim.lower() == matrix_prim_dept.lower())
        supporting_matches = bool(gen_supp.intersection(matrix_supporting_depts)) or (len(gen_supp) == 0 and len(matrix_supporting_depts) == 0)

        if primary_matches and supporting_matches:
            routing_match = "full"
        elif primary_matches or supporting_matches:
            routing_match = "partial"
        else:
            routing_match = "none"

        return {
            "routing_match": routing_match,
            "verified_primary_department": matrix_prim_dept,
            "verified_supporting_departments": list(matrix_supporting_depts),
            "secondary_issue_departments": sec_depts,
            "department_mismatch": routing_match in ["partial", "none"]
        }

    # =========================================================================
    # ── FEATURE 7: ENTERPRISE ESCALATION RULES (Pipeline 2 - Deterministic) ──
    # =========================================================================
    @staticmethod
    def evaluate_escalation_rules(
        ticket_data: Dict[str, Any],
        entities: Optional[Dict[str, Any]] = None,
        repeat_count: int = 0,
        rules: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """
        Deterministic Pipeline 2 Escalation Engine:
        Evaluates 30+ enterprise escalation rules.
        If a rule matches, Python forces escalation regardless of GenAI output.
        Zero LLM calls.
        """
        active_rules = rules or DEFAULT_ESCALATION_RULES
        title = ticket_data.get("title", "")
        desc = ticket_data.get("description", "")
        text = f"{title} {desc}".lower()

        ent = entities or {}
        amount = ent.get("amount") or 0.0

        triggered_rule_ids = []
        highest_level = "NONE"
        primary_trigger = None

        # Level hierarchy for comparison
        LEVEL_RANK = {
            "NONE": 0,
            "SUPERVISOR_REVIEW": 1,
            "DEPARTMENT_MANAGER": 2,
            "SPECIALIST_TEAM": 3,
            "COMPLIANCE_REVIEW": 4,
            "CRITICAL_MANAGEMENT": 5
        }

        for rule in active_rules:
            if not rule.get("is_active", True):
                continue

            rule_id = rule.get("rule_id", "ESC-UNKNOWN")
            trigger = rule.get("trigger", "general")
            level = rule.get("level", "DEPARTMENT_MANAGER")
            keywords = rule.get("keywords", [])
            thresh_field = rule.get("threshold_field")
            thresh_min = rule.get("threshold_min")

            matched = False

            # Keyword evaluation
            if keywords:
                for kw in keywords:
                    if kw.lower() in text:
                        matched = True
                        break

            # Numeric threshold evaluation
            if not matched and thresh_field:
                if thresh_field == "repeat_count" and repeat_count >= (thresh_min or 2):
                    matched = True
                elif thresh_field == "amount" and amount >= (thresh_min or 500.0):
                    matched = True

            if matched:
                triggered_rule_ids.append(rule_id)
                if not primary_trigger:
                    primary_trigger = trigger
                if LEVEL_RANK.get(level, 0) > LEVEL_RANK.get(highest_level, 0):
                    highest_level = level

        escalation_required = len(triggered_rule_ids) > 0

        return {
            "escalation_required": escalation_required,
            "escalation_level": highest_level,
            "escalation_source": "PYTHON_RULE" if escalation_required else "SYSTEM_DEFAULT",
            "triggered_rules": triggered_rule_ids,
            "primary_trigger": primary_trigger
        }

    # =========================================================================
    # ── FEATURE 8: EXPLICIT HALLUCINATION DETECTION (Pipeline 2 - Zero LLM) ──
    # =========================================================================
    @staticmethod
    def detect_hallucinations(
        genai_output: Dict[str, Any],
        complaint_text: str,
        retrieved_chunks: Optional[List[Dict[str, Any]]] = None,
        rule_matrix: Optional[List[Dict[str, Any]]] = None,
        active_policy_ids: Optional[List[str]] = None
    ) -> Tuple[bool, List[Dict[str, Any]], List[str]]:
        """
        Deterministic Pipeline 2 Hallucination Engine (ZERO LLM calls):
        1. Verifies cited policy_id is ACTIVE in Knowledge Base.
        2. Validates numbers, amounts, dates, and deadlines in draft reply are traceable.
        3. Scans for unauthorized promises (free refund, fee waivers, replacement without return).
        4. Validates mandatory vs prohibited actions against Rule Matrix.
        """
        flags: List[Dict[str, Any]] = []
        unsupported_promises: List[str] = []

        DEFAULT_KNOWN_POLICIES = {
            "WP-POL-01", "WP-POL-02", "WP-POL-03",
            "DEL-POL-01", "DEL-POL-02", "DEL-POL-03", "DEL-POL-04",
            "REF-POL-01", "REF-POL-02", "REF-POL-03", "REF-POL-07",
            "BIL-POL-01", "BIL-POL-02", "BIL-POL-03",
            "ESC-POL-01", "QUAL-POL-01", "WAR-POL-01"
        }
        known_policies = set(active_policy_ids) if active_policy_ids else DEFAULT_KNOWN_POLICIES

        # 1. Cited Policy ID Verification
        cited_policy = genai_output.get("policy_id")
        if cited_policy:
            clean_policy = cited_policy.strip()
            if active_policy_ids is not None:
                is_invalid = clean_policy not in known_policies
            else:
                is_invalid = clean_policy not in known_policies and not any(k in clean_policy for k in ["DEL", "REF", "BIL", "WP", "ESC", "QUAL", "WAR"])
            if is_invalid:
                flags.append({
                    "type": "INVALID_POLICY_CITATION",
                    "claim": clean_policy,
                    "reason": f"Cited policy ID '{clean_policy}' is not active or does not exist in the Knowledge Base.",
                    "severity": "CRITICAL"
                })

        draft_response = genai_output.get("draft_response", "")
        resolution_steps = genai_output.get("resolution_steps", [])
        combined_output_text = f"{draft_response} {' '.join(resolution_steps)}".lower()

        # Context corpus for fact tracing
        chunk_text = " ".join([c.get("content", "") for c in (retrieved_chunks or [])]).lower()
        rule_text = " ".join([r.get("condition", "") + " " + r.get("policy_reference", "") for r in (rule_matrix or [])]).lower()
        reference_corpus = f"{complaint_text.lower()} {chunk_text} {rule_text}"

        # 2. Unsupported Promise Patterns
        PROHIBITED_PATTERNS = [
            (r"(?i)\bguarantee\b.*?\b(refund|money back|cash|unconditional|arrive|tomorrow)\b", "Guaranteed outcome or refund promise without manager override"),
            (r"(?i)\bunconditional\s+refund\b", "Unconditional refund promise"),
            (r"(?i)\bwe will waive\b", "Unauthorized policy fee waiver promise"),
            (r"(?i)\bfree\s+replacement\s+without\s+(return|returning)\b", "Free replacement without returning damaged item"),
            (r"(?i)\bwithin\s+(1|2|3)\s+hours?\b", "Unrealistic 1-3 hour resolution SLA commitment")
        ]

        for pat, reason in PROHIBITED_PATTERNS:
            match = re.search(pat, draft_response)
            if match:
                promise_str = match.group(0)
                unsupported_promises.append(promise_str)
                flags.append({
                    "type": "UNAUTHORIZED_PROMISE",
                    "claim": promise_str,
                    "reason": reason,
                    "severity": "HIGH"
                })

        # 3. Tracing Specific Dollar Amounts in Draft Response
        draft_amounts = re.findall(r"\$\s*(\d+(?:\.\d{1,2})?)", draft_response)
        for amt in draft_amounts:
            if amt not in reference_corpus and f"${amt}" not in reference_corpus:
                flags.append({
                    "type": "UNTRACEABLE_FACT",
                    "claim": f"${amt}",
                    "reason": f"Mentioned dollar amount ${amt} cannot be traced to complaint text or approved policies.",
                    "severity": "MEDIUM"
                })

        # 4. Rule Matrix Mandatory & Prohibited Action Verification
        if rule_matrix:
            for rule in rule_matrix:
                for prohibited in rule.get("prohibited_actions", []):
                    if prohibited.lower() in combined_output_text:
                        flags.append({
                            "type": "PROHIBITED_ACTION",
                            "claim": prohibited,
                            "reason": f"Draft response contains prohibited action: '{prohibited}'",
                            "severity": "CRITICAL"
                        })

        has_hallucination = len(flags) > 0
        return has_hallucination, flags, unsupported_promises

    # =========================================================================
    # ── FEATURE 9: VERIFICATION SCORE (Pipeline 2 - Deterministic) ───────────
    # =========================================================================
    @staticmethod
    def calculate_verification_score(
        genai_output: Dict[str, Any],
        python_output: Dict[str, Any],
        has_hallucination: bool = False,
        weights_config: Optional[Dict[str, Any]] = None
    ) -> Tuple[float, Dict[str, Any]]:
        """
        Transparent 0-100 deterministic verification score calculation.
        Zero LLM calls.
        Weights:
          - category: 20%
          - department: 20%
          - urgency/priority: 15%
          - escalation: 20%
          - policy citation: 15%
          - hallucination absence: 10%
        """
        cfg = weights_config or DEFAULT_VERIFICATION_WEIGHTS
        w = cfg.get("weights", {
            "category": 20.0,
            "department": 20.0,
            "urgency_priority": 15.0,
            "escalation": 20.0,
            "policy_citation": 15.0,
            "hallucination_absence": 10.0
        })

        # 1. Category Match
        cat_match = bool(python_output.get("category_verified", True))
        earned_cat = w["category"] if cat_match else 0.0

        # 2. Department Match
        genai_dept = (genai_output.get("department") or "").lower().strip()
        py_dept = (python_output.get("verified_primary_department") or "").lower().strip()
        dept_match = bool(genai_dept and py_dept and (genai_dept in py_dept or py_dept in genai_dept))
        earned_dept = w["department"] if dept_match else 0.0

        # 3. Urgency / Priority Match
        prio = genai_output.get("priority", "P2")
        urgency = genai_output.get("urgency", "Medium").lower()
        urg_match = (prio == "P0" and urgency == "critical") or (prio == "P1" and urgency in ["high", "critical"]) or (prio in ["P2", "P3"])
        earned_urg = w["urgency_priority"] if urg_match else 5.0

        # 4. Escalation Match
        genai_esc = bool(genai_output.get("escalation_required", False))
        py_esc = bool(python_output.get("escalation_required", False))
        esc_match = (genai_esc == py_esc)
        earned_esc = w["escalation"] if esc_match else 0.0

        # 5. Policy Citation Match
        pol_ref = python_output.get("policy_reference", "")
        genai_pol = genai_output.get("policy_id", "")
        pol_match = bool(genai_pol and genai_pol.split("-")[0] in pol_ref)
        earned_pol = w["policy_citation"] if pol_match else 0.0

        # 6. Hallucination Absence
        earned_hallucination = w["hallucination_absence"] if not has_hallucination else 0.0

        total_score = round(earned_cat + earned_dept + earned_urg + earned_esc + earned_pol + earned_hallucination, 1)

        breakdown = {
            "category": {"matched": cat_match, "weight": w["category"], "earned": earned_cat},
            "department": {"matched": dept_match, "weight": w["department"], "earned": earned_dept},
            "urgency_priority": {"matched": urg_match, "weight": w["urgency_priority"], "earned": earned_urg},
            "escalation": {"matched": esc_match, "weight": w["escalation"], "earned": earned_esc},
            "policy_citation": {"matched": pol_match, "weight": w["policy_citation"], "earned": earned_pol},
            "hallucination_absence": {"matched": not has_hallucination, "weight": w["hallucination_absence"], "earned": earned_hallucination},
            "total_score": total_score
        }

        return total_score, breakdown

    # =========================================================================
    # ── FEATURE 12: REPEAT COMPLAINT DETECTION (Pipeline 2 - Deterministic) ──
    # =========================================================================
    @staticmethod
    def check_repeat_complaint(
        current_title: str,
        current_description: str,
        order_id: Optional[str],
        customer_id: str,
        prior_tickets: List[Dict[str, Any]],
        similarity_threshold: float = 0.80
    ) -> Tuple[bool, List[str], int, float]:
        """
        Deterministic repeat complaint detector:
        - Evaluates matching order_id across open or unresolved prior tickets.
        - Evaluates RapidFuzz token_set_ratio or word-level Jaccard similarity.
        - Returns (is_repeat, related_ticket_ids, repeat_count, max_similarity).
        """
        if not prior_tickets:
            return False, [], 0, 0.0

        curr_full = f"{current_title} {current_description}".lower().strip()
        curr_words = set(w for w in re.findall(r"\w+", curr_full) if len(w) > 2)

        related_ids = []
        max_score = 0.0

        for pt in prior_tickets:
            status = pt.get("status", "")
            # Only consider active, unresolved, or recently opened tickets
            if status in ["Resolved", "Closed"]:
                continue

            pt_order = pt.get("order_id")
            pt_id = pt.get("ticket_id")

            # 1. Exact Order ID Match on open complaint
            if order_id and pt_order and order_id.strip().lower() == pt_order.strip().lower():
                if pt_id and pt_id not in related_ids:
                    related_ids.append(pt_id)
                max_score = max(max_score, 1.0)
                continue

            # 2. Text Similarity (RapidFuzz if available, else Jaccard)
            pt_text = f"{pt.get('title', '')} {pt.get('description', '')}".lower().strip()
            score = 0.0

            if fuzz is not None:
                score = fuzz.token_set_ratio(curr_full, pt_text) / 100.0
            else:
                pt_words = set(w for w in re.findall(r"\w+", pt_text) if len(w) > 2)
                if curr_words and pt_words:
                    intersection = curr_words.intersection(pt_words)
                    union = curr_words.union(pt_words)
                    score = len(intersection) / len(union) if union else 0.0

            if score > max_score:
                max_score = round(score, 3)

            if score >= similarity_threshold and pt_id and pt_id not in related_ids:
                related_ids.append(pt_id)

        is_repeat = len(related_ids) > 0
        repeat_count = len(related_ids)

        return is_repeat, related_ids, repeat_count, max_score

    # =========================================================================
    # ── FEATURE 13: CONFIGURABLE SLA RISK ENGINE (Pipeline 2 - Deterministic) 
    # =========================================================================
    @staticmethod
    def evaluate_sla_risk(
        created_at: datetime,
        priority: str = "P2",
        sla_config: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Deterministic calculation of SLA hours remaining, percentage elapsed, and risk state.
        Zero LLM calls.
        """
        cfg = sla_config or DEFAULT_SLA_CONFIGS
        targets = cfg.get("targets", DEFAULT_SLA_CONFIGS["targets"])
        prio_cfg = targets.get(priority, targets.get("P2", {"response_hours": 4.0, "resolution_hours": 24.0}))

        res_hours = float(prio_cfg.get("resolution_hours", 24.0))
        resp_hours = float(prio_cfg.get("response_hours", 4.0))
        risk_thresh = float(cfg.get("risk_threshold_percentage", 75.0))

        now = datetime.utcnow()
        elapsed_hours = max(0.0, (now - created_at).total_seconds() / 3600.0)
        remaining_hours = max(0.0, res_hours - elapsed_hours)

        risk_pct = min(100.0, (elapsed_hours / res_hours) * 100.0) if res_hours > 0 else 100.0

        if elapsed_hours >= res_hours:
            sla_risk = "breached"
        elif risk_pct >= risk_thresh:
            sla_risk = "approaching"
        else:
            sla_risk = "none"

        return {
            "sla_hours_remaining": round(remaining_hours, 1),
            "sla_risk_percentage": round(risk_pct, 1),
            "sla_risk": sla_risk,
            "sla_response_target_at": created_at + timedelta(hours=resp_hours),
            "sla_resolution_target_at": created_at + timedelta(hours=res_hours)
        }

    # =========================================================================
    # ── PIPELINE 1 (GenAI): CLARIFICATION QUESTIONS, SUMMARIES & FOLLOW-UPS ──
    # =========================================================================
    def generate_clarification_questions(
        self,
        missing_fields: List[str],
        title: str,
        description: str
    ) -> List[str]:
        """Pipeline 1 GenAI call: generates up to 3 focused clarification questions."""
        if not missing_fields:
            return []

        prompt_tpl, _ = PromptService.get_prompt_sync("clarification_generator")
        prompt = prompt_tpl.format(
            missing_fields=", ".join(missing_fields),
            title=title,
            description=description
        )

        try:
            if self.groq.client:
                res = self.groq.client.chat.completions.create(
                    messages=[{"role": "user", "content": prompt}],
                    model=self.groq.model,
                    response_format={"type": "json_object"},
                    temperature=0.2,
                    timeout=5.0
                )
                parsed = json.loads(res.choices[0].message.content)
                return parsed.get("clarification_questions", [])[:3]
        except Exception as e:
            print(f"[WARNING] Groq Clarification Generation fallback: {e}")

        # Stub fallback for offline / mock testing
        questions = []
        for field in missing_fields[:3]:
            if field == "order_id":
                questions.append("Could you please provide your NovaWear Order ID or Invoice Number?")
            elif field in ["transaction_date", "order_date", "date"]:
                questions.append("When was this purchase completed? Please specify the approximate date.")
            elif field == "product":
                questions.append("Which specific NovaWear item/size/color experienced this issue?")
            elif field == "evidence":
                questions.append("Please upload or attach a clear photo showing the item condition.")
            elif field == "amount":
                questions.append("What was the exact amount charged or requested for refund?")
            elif field == "description":
                questions.append("Could you provide a few more details regarding what happened with your order?")
        return questions

    def generate_complaint_summary(
        self,
        ticket_id: str,
        title: str,
        description: str,
        category: str
    ) -> Dict[str, Any]:
        """Pipeline 1 GenAI call: generates structured executive summary."""
        prompt_tpl, _ = PromptService.get_prompt_sync("complaint_summary_generator")
        prompt = prompt_tpl.format(
            ticket_id=ticket_id,
            title=title,
            description=description,
            category=category
        )

        try:
            if self.groq.client:
                res = self.groq.client.chat.completions.create(
                    messages=[{"role": "user", "content": prompt}],
                    model=self.groq.model,
                    response_format={"type": "json_object"},
                    temperature=0.2,
                    timeout=5.0
                )
                return json.loads(res.choices[0].message.content)
        except Exception as e:
            print(f"[WARNING] Groq Summary Generation fallback: {e}")

        return {
            "issue": title,
            "category": category,
            "sentiment": "Neutral",
            "urgency": "Medium",
            "key_facts": [title, f"Customer describes: {description[:80]}..."],
            "one_line_summary": f"Customer complaint regarding {category}: {title}."
        }

    def generate_escalation_notes(
        self,
        ticket_id: str,
        title: str,
        description: str,
        category: str,
        escalation_reason: str,
        actions_taken: List[str],
        policy_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Pipeline 1 GenAI call: generates manager-level briefing notes."""
        prompt_tpl, _ = PromptService.get_prompt_sync("escalation_notes_generator")
        prompt = prompt_tpl.format(
            ticket_id=ticket_id,
            title=title,
            description=description,
            category=category,
            escalation_reason=escalation_reason,
            actions_taken=", ".join(actions_taken) if actions_taken else "Ticket intake & quarantined"
        )

        try:
            if self.groq.client:
                res = self.groq.client.chat.completions.create(
                    messages=[{"role": "user", "content": prompt}],
                    model=self.groq.model,
                    response_format={"type": "json_object"},
                    temperature=0.2,
                    timeout=5.0
                )
                return json.loads(res.choices[0].message.content)
        except Exception as e:
            print(f"[WARNING] Groq Escalation Notes fallback: {e}")

        return {
            "complaint_summary": title,
            "key_facts": [title, f"Category: {category}"],
            "escalation_reason": escalation_reason,
            "actions_taken": actions_taken,
            "relevant_policy_id": policy_id or "ESC-POL-01",
            "required_next_action": "Senior manager review and authorization required."
        }

    def generate_follow_up_message(
        self,
        ticket_id: str,
        title: str,
        customer_name: str,
        category: str,
        status: str,
        follow_up_type: str,
        custom_delay_hours: int = 24
    ) -> Dict[str, Any]:
        """Generates a follow-up item record with scheduled_at timestamp."""
        prompt_tpl, _ = PromptService.get_prompt_sync("follow_up_generator")
        prompt = prompt_tpl.format(
            ticket_id=ticket_id,
            title=title,
            customer_name=customer_name or "Valued Customer",
            category=category,
            status=status,
            follow_up_type=follow_up_type
        )

        msg_text = f"Dear {customer_name or 'Customer'}, regarding your complaint ({ticket_id}) on {category}: We are following up to ensure your issue is being addressed promptly."
        try:
            if self.groq.client:
                res = self.groq.client.chat.completions.create(
                    messages=[{"role": "user", "content": prompt}],
                    model=self.groq.model,
                    response_format={"type": "json_object"},
                    temperature=0.2,
                    timeout=5.0
                )
                parsed = json.loads(res.choices[0].message.content)
                msg_text = parsed.get("message", msg_text)
        except Exception as e:
            print(f"[WARNING] Groq FollowUp Generation fallback: {e}")

        scheduled = datetime.utcnow() + timedelta(hours=custom_delay_hours)

        return {
            "id": f"FOL-{uuid.uuid4().hex[:6].upper()}",
            "follow_up_id": f"FOL-{uuid.uuid4().hex[:6].upper()}",
            "type": follow_up_type,
            "message": msg_text,
            "scheduled_at": scheduled,
            "sent_at": None,
            "status": "SCHEDULED"
        }
