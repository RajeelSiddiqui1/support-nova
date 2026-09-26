# 🌟 NovaWear Apparel — Complaint Intelligence & Resolution Platform
## 📋 Comprehensive System Architecture, Completed Modules & Operational Workflow Guide (`WORKFLOW.md`)

> **Date:** September 2026  
> **Platform Version:** 1.0.0 Enterprise Production  
> **Primary Domain / Rebrand:** NovaWear Apparel (`support@novawearapparel.com` / `support@novawearapparel.ai`)  
> **Stack:** Next.js 14 (App Router) + Tailwind CSS | FastAPI (Python 3.10+) | MongoDB Atlas (Motor Async — Unified Core DB) | Qdrant Cloud RAG | Groq LLM (Llama-3/Mixtral) | AWS S3 | Vercel Ready

---

## 📌 Executive Summary

**NovaWear Apparel Complaint Intelligence Platform** is a dual-pipeline, audit-first enterprise complaints management system. It bridges the gap between probabilistic generative AI (Pipeline 1) and deterministic ground-truth compliance rules (Pipeline 2) to eliminate hallucinations, enforce enterprise policy compliance, and give managers and administrators full 360° operational visibility over tickets and agents.

The entire persistence and transactional audit tier is **100% unified on MongoDB Atlas (Motor Async)**, eliminating SQL/relational overhead and enabling seamless zero-config serverless deployments on **Vercel** (`https://*.vercel.app`).

---

## 🏗️ High-Level System Architecture

```mermaid
flowchart TD
    subgraph Intake["1. MULTI-CHANNEL INTAKE"]
        W["📄 Web Form (/customer/submit)"]
        C["💬 Live Chat (/customer/chat)"]
        E["📧 IMAP Email Ingestion (support@novawearapparel.com)"]
    end

    subgraph DualPipeline["2. DUAL INTELLIGENCE ENGINE"]
        P1["🤖 Pipeline 1: GenAI Extraction (Groq LLM)\n- Structured JSON Schema\n- Sentiment & Urgency\n- Policy Mapping & Draft Reply"]
        P2["⚖️ Pipeline 2: Python Ground-Truth Rule Matrix\n- 100% Deterministic (Zero LLM)\n- Fee Waiver & Refund Validation\n- SLA & Category Verification"]
    end

    subgraph Verification["3. TRIAGE & COMPLIANCE GATEWAY"]
        Match{"Conflict / Exception Detected?"}
        RevQueue["🛡️ Reviewer Queue (/reviewer/queue)\n- Prompt Injection Alert\n- Furious Sentiment Risk\n- Unauthorized Fee Waiver"]
        AgentPool["👤 Active Agent Queue (/agent/workspace)"]
    end

    subgraph Execution["4. RESOLUTION & GOVERNANCE"]
        AgentAction["Agent Outbound Communication\n- Send Verified Reply\n- Resolve Complaint"]
        MgrOversight["👔 Manager Governance\n- Reassign Non-Performing Agents\n- Policy Exception Overrides"]
        Admin360["👑 Admin Command Hub (/admin/tickets)\n- 360° Audit Trail\n- Live Agent Oversight & Workload"]
    end

    subgraph Storage["5. PERSISTENCE & AUDIT (100% MONGODB ATLAS)"]
        Mongo[("🍃 MongoDB Atlas: Unified Cluster\n- tickets (Complaints & Metadata)\n- reviewer_audit_logs (Immutable Overrides)\n- users & staff (RBAC)\n- departments & categories")]
        Qdrant[("🔍 Qdrant Cloud: Vector Policy RAG")]
        S3[("🪣 AWS S3: Policy Documents & PDFs")]
    end

    W --> P1 & P2
    C --> P1 & P2
    E --> P1 & P2

    P1 & P2 --> Match
    Match -- "Yes (Mismatch/Exception)" --> RevQueue
    Match -- "No (Verified Match)" --> AgentPool

    RevQueue -->|Approve / Modify / Reclassify| AgentPool
    AgentPool --> AgentAction
    AgentAction --> MgrOversight
    MgrOversight --> Admin360

    DualPipeline -.-> Qdrant & S3
    RevQueue -.-> Mongo
    AgentAction & Admin360 -.-> Mongo
```

---

## 🔄 End-to-End Workflow Stages

### Stage 1: Multi-Channel Intake & Ingestion
1. **Web Form (`/customer/submit`):**
   - Clean, validated intake without arbitrary dropdown clutter.
   - Automatically binds authenticated customer session data without quotes or serialization artifacts.
2. **Interactive Live Chat (`/customer/chat`):**
   - Real-time conversational interface with AI assistance.
   - Automatically extracts complaint context, order IDs, and logs tickets when unresolved.
3. **Automated IMAP Email Ingestion Engine (`email_ingestion.py`):**
   - Scans mailbox every 30 seconds for incoming complaints sent to `support@novawearapparel.com`.
   - **Strict Deduplication:** Uses unique `Message-ID` MongoDB indexing and in-memory locks so identical emails are never processed or duplicated.
   - Automatically dispatches an immediate branded auto-acknowledgement with ticket tracking ID via SMTP (`email_dispatcher.py`).

---

### Stage 2: Dual-Pipeline Evaluation (AI + Deterministic Rules)
* **Pipeline 1 (GenAI Extraction — Groq LLM):**
  - Converts unstructured complaint text into strict structured JSON.
  - Generates: `complaint_id`, `issue_category`, `subcategory`, `sentiment`, `urgency`, `priority`, `department`, `policy_id`, `resolution_steps`, `draft_response`.
  - Free-form plain text is strictly barred.
* **Pipeline 2 (Python Ground-Truth Rule Matrix):**
  - **Zero LLM dependency** — pure deterministic Python business rules.
  - Validates complaint validity against published corporate policies.
  - Enforces mandatory actions, checks refund eligibility windows (e.g. 30-day limits), and blocks prohibited promises.
  - Flags mismatches if GenAI promises unauthorized fee waivers, incorrect departments, or hallucinates policy citations.

---

### Stage 3: Verification & Reviewer Workspace (`/reviewer/queue`)
* **Independent Reviewer Governance (Cross-Department Architecture):**
  - **No Manager Hierarchy Binding:** Reviewers are decoupled from department managers (autonomous role, neither department-bound nor manager-subordinated). In Admin User Management, creating a Reviewer does not require selecting a manager.
  - **Company-Wide Global Access:** Reviewers possess global oversight across **all departments** (`DEP-ALL`), with an intuitive Department Scope filter to switch between `🌐 All Departments (Global Review)` or isolate specific departmental queues.
  - **Ticket Claiming & Inter-Reviewer Transfer:**
    - Any Reviewer can claim an unassigned review ticket for themselves with a single click (`POST /api/reviewer/tickets/{id}/claim`).
    - Tickets can be seamlessly transferred/reassigned between reviewers (`POST /api/reviewer/tickets/{id}/assign-reviewer`) with complete reason tracking and audit trail.
    - Status badges in the queue immediately show `🧑‍⚖️ Reviewer: {Name}` or `⚠️ Unclaimed Review`.
* **Automatic Routing Criteria:**
  - Pipeline 1 and Pipeline 2 have a discrepancy or conflict.
  - Policy citation is missing, ambiguous, or flags an unauthorized fee waiver.
  - Customer sentiment is furious/angry, or prompt injection indicators are detected.
* **Side-by-Side Comparative Dossier (`/api/reviewer/tickets/{id}`):**
  - **Customer Input:** Raw text + extracted entities (`order_id`, `delivery_date`, `product_name`, `amount`).
  - **Pipeline 1 Output:** GenAI detected intent, mapped policy, and drafted customer reply.
  - **Pipeline 2 Output:** Ground-Truth Rule ID, deterministic verdict (`APPROVE` / `BLOCK` / `ESCALATE`), and conflict diffs.
* **Reviewer Actions (`POST /api/reviewer/tickets/{id}/action`):**
  - `APPROVE`: Authorize AI response, finalize policy compliance, and dispatch resolution to agent workspace.
  - `MODIFY`: Edit drafted reply text or category before dispatch.
  - `RECLASSIFY`: Correct category/department routing.
  - `REGENERATE`: Re-prompt Groq GenAI with specific human reviewer critiques.
  - `ESCALATE_TO_MANAGER`: Route high-risk/P0 cases directly to the Department Manager.
  - `ADD_INTERNAL_NOTE`: Attach confidential investigation notes.
* **MongoDB Atlas Audit Logger (`reviewer_audit_logs` collection):**
  - Every override is committed to the MongoDB Atlas `reviewer_audit_logs` collection (`ticket_id`, `reviewer_id`, `original_ai_output`, `reviewer_modified_output`, `override_reason`, `timestamp`).

---

### Stage 3.1: Dynamic AI Customer Chat & Zero-Reload WebSocket Sync
* **E-Commerce / Apparel Grounding (`/api/tickets/chat-options`):**
  - All obsolete "Cloud" options have been completely expunged.
  - Guided chips and prompt suggestions are generated dynamically from MongoDB Atlas collections (`categories`, `departments`, `kb_docs`), focusing purely on NovaWear Apparel needs (`Delivery`, `Refund`, `Replacement`, `Warranty`, `Quality`, `Billing`, `Cancellation`).
* **Full-Stack Zero-Reload WebSocket Sync (`useWebSocket.js` / `/ws`):**
  - Every ticket status update, agent reassignment, reviewer claim, and draft reply broadcasts a WebSocket event (`TICKET_CREATED`, `TICKET_UPDATED`, `AGENT_REASSIGNED`, `REVIEWER_CLAIMED`, `REFRESH_DATA`).
  - Dashboards update live instantaneously without requiring manual browser reloads.

---

### Stage 4: Agent Workspace & Live Resolution (`/agent/workspace`)
1. Agents receive verified tickets filtered by department and priority (`P0` to `P3`).
2. Display SLA countdown timers and risk indicators.
3. Agents utilize policy-grounded guidance and approved draft templates to email or chat directly with the customer.
4. Tickets can be resolved or escalated with a full audit log.

---

### Stage 5: Manager Governance & Workload Rebalancing (`/reviewer/queue`)
1. **Department Audit:** Managers view real-time departmental ticket velocity, violation counts, and warnings.
2. **Reassignment with Accountability:** If an agent is underperforming, the manager can revoke the ticket and reassign it to a peer agent or return it to the open pool.
3. **Revoked Agent Archive:** The system records who flailed the ticket and why, preventing duplicate assignments to failing agents.

---

### Stage 6: Admin Command Hub & 360° System Oversight (`/admin/tickets`)
1. **All Tickets Master View:**
   - Unified real-time filter across all channels (Web Form, Email, Chat), departments, and statuses.
   - Quick "Peek" slide-out drawer for fast scanning without leaving the list.
   - Direct button link to the dedicated 360° detail page.
2. **Agent Live Oversight & Workload Monitor (Live Roster & Task Visibility):**
   - **Real-Time KPI Cards:** Total Agents, Actively Engaged, Idle / Available, Active Workload, Total Resolved.
   - **Agent Detail Cards:**
     - Live presence (🟢 Actively Handling vs ⚪ Idle / Available).
     - Department badge, reporting lead, and contact info.
     - Lifetime reassignments / violations tally.
     - **Active Ticket Pills:** Direct clickable links (`/admin/tickets/{ticket_id}`) to inspect the exact tickets each agent is working on.
     - Latest activity note snippet.
3. **Dedicated 360° Ticket Investigation Page (`/admin/tickets/[id]`):**
   - Comprehensive customer dossier and original intake message.
   - Visual comparison: Pipeline 1 (GenAI) vs Pipeline 2 (Python Ground Truth).
   - Real-time policy compliance check and warning alerts.
   - Chronological audit timeline detailing creation, AI analysis, agent actions, manager reassignments, and customer replies.
   - Admin command bar: Reassign Agent, Release to Open Pool, Override Department, Force Status Change.

---

## 🔒 Security & Targeted Actor Rate Limiting (5-Minute Lockout)

* **Zero Collateral Damage Anti-Bruteforce (`lib/rate_limiter.py`):**
  - Compound Key: `(Client IP + Attempted Email)`.
  - If 5 consecutive failed credential attempts occur for an email from a specific IP:
    - **Only that specific `(IP, Email)` pair is locked for 5 minutes (300 seconds).**
    - Other staff and test accounts (e.g. Admin, Agent, Manager) sharing the same IP / localhost can continue logging in without any interruption.
  - Returns `429 Too Many Requests` with remaining seconds and `Retry-After: 300` header.
  - Successful authentication resets the failure counter immediately.

---

## ☁️ Vercel Deployment Architecture (`*.vercel.app`)

1. **Monorepo Setup ([`vercel.json`](file:///c:/rajeel/support-nova/vercel.json)):**
   - Seamlessly serves Next.js 14 frontend and FastAPI Python serverless endpoints.
   - Enforces enterprise HTTP security headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `X-XSS-Protection: 1; mode=block`).
2. **Serverless Python Entrypoint ([`api/index.py`](file:///c:/rajeel/support-nova/api/index.py)):**
   - Maps `/api/*` requests directly to FastAPI without external servers.
3. **Dynamic CORS & Redirects ([`server/app.py`](file:///c:/rajeel/support-nova/server/app.py)):**
   - Uses `allow_origin_regex=r"^https://.*\.vercel\.app$"` so any deployed Vercel preview or production domain has full authenticated API access.
   - Dynamic Google OAuth and auth redirects via `FRONTEND_BASE`.
4. **Clean Root Requirements ([`requirements.txt`](file:///c:/rajeel/support-nova/requirements.txt)):**
   - 100% pure MongoDB Atlas async stack with zero SQL dependencies.

### 🔑 Vercel Environment Variables Checklist
When deploying the application to Vercel, configure the following environment variables in Vercel Dashboard -> **Settings** -> **Environment Variables** (no SQL server required):

| Variable Name | Description / Example Value |
|---|---|
| `MONGO_URI` | `mongodb+srv://<user>:<password>@cluster0.1cdmxhf.mongodb.net/supportnova_db?retryWrites=true&w=majority` |
| `FRONTEND_URL` | `https://your-app-name.vercel.app` (Your production live Vercel URL) |
| `NEXT_PUBLIC_API_URL` | `https://your-app-name.vercel.app` (Or leave empty for monorepo same-origin) |
| `JWT_SECRET` | `supportnova_super_secret_jwt_key_2026` |
| `GROQ_API_KEY` | Your Groq LLM API Key |
| `GROQ_MODEL` | `openai/gpt-oss-20b` |
| `QDRANT_API_KEY` | Your Qdrant Cloud API Key |
| `QDRANT_END_POINT` | `https://4e155431-0900-497b-831d-bcf6a9efc89e.us-east-1-1.aws.cloud.qdrant.io` |
| `AWS_ACCESS_KEY_ID` | `AKIAT7HJZSB7YXZB6UEM` (For S3 Policy PDF Bucket) |
| `AWS_SECRET_ACCESS_KEY` | AWS Secret Access Key |
| `AWS_S3_BUCKET_NAME` | `support-nova` |
| `SMTP_USER` & `SMTP_PASS` | Gmail / SMTP Credentials for automated email notifications |

---

## 📊 Completed Modules & Implementation Status

| # | Module / Feature | Technologies | Status | Verification Detail |
|---|---|---|---|---|
| **1** | **Multi-Channel Intake** | Next.js, FastAPI, IMAP | ✅ **Complete** | Web form, live chat, and IMAP background email polling with deduplication. |
| **2** | **Rebranding to NovaWear** | Full Stack | ✅ **Complete** | Updated across all UI headers, metadata, policy templates, and email dispatchers. |
| **3** | **Pipeline 1 (GenAI Extraction)** | Groq LLM, Pydantic | ✅ **Complete** | Strict structured JSON schema extraction; zero unstructured hallucination leakage. |
| **4** | **Pipeline 2 (Ground-Truth Rules)** | Pure Python, Deterministic | ✅ **Complete** | Rule matrix enforces SLA, refund window, and mandatory/prohibited actions without LLM. |
| **5** | **RAG Knowledge Base & S3** | Qdrant Cloud, AWS S3 | ✅ **Complete** | PDF policy upload, vector chunking, semantic similarity retrieval, and S3 sync. |
| **6** | **Authentication & RBAC** | NextAuth, JWT, Bcrypt | ✅ **Complete** | Social/Google login for Customers; secure credentials for Staff with role protection. |
| **7** | **Reviewer Workspace & Queue** | FastAPI, MongoDB Atlas | ✅ **Complete** | Auto-routes pipeline conflicts, prompt injection, and unauthorized fee waivers. |
| **8** | **Reviewer Audit Override Logs** | MongoDB Atlas Motor | ✅ **Complete** | `reviewer_audit_logs` collection stores immutable diffs, reviewer ID, action, and rationale. |
| **9** | **Agent Workspace & Chat** | Next.js, FastAPI | ✅ **Complete** | SLA countdowns, priority sorting, draft customer replies, and email dispatch. |
| **10** | **Admin Tickets & 360° Dossier** | Next.js App Router | ✅ **Complete** | `/admin/tickets` list, `/admin/tickets/[id]` full dossier, and Agent Live Oversight. |
| **11** | **Targeted Rate Limiter (5m)** | FastAPI, Python | ✅ **Complete** | 5-minute lockout targeted to `(IP, Email)` with zero collateral damage for other users. |
| **12** | **Vercel Serverless Deployment** | Vercel, Next.js, FastAPI | ✅ **Complete** | Root `vercel.json`, `api/index.py`, dynamic CORS regex, and production build tested. |
| **13** | **Decoupled Reviewer Architecture** | Next.js, FastAPI, Atlas | ✅ **Complete** | Reviewers are decoupled from managers/departments with company-wide access, claim buttons & transfers. |
| **14** | **Dynamic AI E-Commerce Chat** | Next.js, FastAPI, Atlas | ✅ **Complete** | Removed "Cloud", dynamic prompt chips derived from active categories (`Delivery`, `Refund`, etc.). |
| **15** | **Zero-Reload WebSocket Sync** | WebSockets, FastAPI, Next.js | ✅ **Complete** | Instant real-time UI synchronization across all manager/agent/reviewer dashboards without browser reloads. |

---

## 🗺️ Key API Endpoints Reference

### Reviewer Workspace & Audit Endpoints (MongoDB Atlas)
* `GET /api/reviewer/queue` — Fetch tickets requiring manual review with filtering (`urgency`, `category`, `mismatch_type`, `assigned_reviewer_id`).
* `GET /api/reviewer/tickets/{ticket_id}` — 3-way Side-by-Side comparison payload (Customer Input, Pipeline 1 GenAI, Pipeline 2 Python Ground Truth).
* `POST /api/reviewer/tickets/{ticket_id}/claim` — Self-assign / claim review ticket for current active reviewer.
* `POST /api/reviewer/tickets/{ticket_id}/assign-reviewer` — Transfer / assign review ticket to another active reviewer with audit reason.
* `GET /api/reviewer/reviewers` — List all registered active reviewers across the organization.
* `POST /api/reviewer/tickets/{ticket_id}/action` — Execute reviewer decision (`APPROVE`, `MODIFY`, `RECLASSIFY`, `REGENERATE`, `ESCALATE_TO_MANAGER`, `ADD_INTERNAL_NOTE`).
* `GET /api/reviewer/tickets/{ticket_id}/audit-logs` — Retrieve immutable audit logs from MongoDB Atlas `reviewer_audit_logs` collection.

### Customer & Chat Dynamic Endpoints
* `GET /api/tickets/chat-options` — Returns active categories, department topics, and dynamic apparel prompt chips directly from MongoDB Atlas.

### Admin Command Endpoints
* `GET /api/admin/agents-overview` — Real-time roster metrics, agent active ticket workloads, and violation tallies.
* `GET /api/tickets/{ticket_id}` — Full ticket payload with dynamic policy compliance evaluation.
* `POST /api/tickets/{ticket_id}/reassign` — Reassign ticket with audit reason and revoked agent logging.
* `POST /api/tickets/{ticket_id}/release-pool` — Release ticket back to unassigned open queue.
* `POST /api/tickets/{ticket_id}/override-department` — Admin department override with audit tracking.

---

## 🚀 How to Run the Entire Platform Locally

### 1. Backend Server (FastAPI + MongoDB Atlas)
```bash
cd server
.\.venv\Scripts\activate
# Start FastAPI server on port 8000
python -m uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```
* **API Documentation:** [http://localhost:8000/docs](http://localhost:8000/docs)
* **Health Check:** [http://localhost:8000/health](http://localhost:8000/health)

### 2. Frontend Client (Next.js)
```bash
cd client
npm run dev
```
* **Client URL:** [http://localhost:3000](http://localhost:3000)
* **Admin Tickets Queue:** [http://localhost:3000/admin/tickets](http://localhost:3000/admin/tickets)
* **Reviewer Queue:** [http://localhost:3000/reviewer/queue](http://localhost:3000/reviewer/queue)
* **Agent Workspace:** [http://localhost:3000/agent/workspace](http://localhost:3000/agent/workspace)
* **Customer Intake:** [http://localhost:3000/customer/submit](http://localhost:3000/customer/submit)

---

## 🎯 Handover & Stakeholder Demonstration Summary
 
1. **100% MongoDB Atlas Cloud Stack:** All data modules—including tickets, reviewer overrides, staff authentication, audit trails, and policy rules—are fully unified on MongoDB Atlas Cloud. No relational or local SQL databases are required.
2. **Vercel Serverless Ready (`https://*.vercel.app`):** Both client and server architectures feature native root configuration (`vercel.json` and `api/index.py`), enabling instantaneous zero-downtime deployment to Vercel preview and production environments.
3. **Autonomous Reviewer Governance:** Reviewers operate independently of individual departments or managers with company-wide oversight, one-click ticket claiming, inter-reviewer reassignment, and policy validation.
4. **Targeted Security & Non-Blocking Testing:** The compound-key rate limiter strictly locks only the specific `(IP, Email)` offending pair for 5 minutes during invalid login attempts, ensuring quality assurance teams and other users remain completely unhindered.
5. **Real-Time WebSocket Synchronization:** Real-time bi-directional events guarantee that ticket state transitions, claims, and approvals propagate immediately across all dashboards without manual page reloads.
