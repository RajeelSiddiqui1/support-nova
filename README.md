# 🚀 SupportNova — Generative AI & Ground-Truth Complaint Intelligence System

> **Project:** SupportNova — Dual-Pipeline Customer Complaint Resolution Intelligence  
> **Framework Target:** Next.js 14+ (App Router, JavaScript / JSX — No TypeScript, No `<style jsx>`)  
> **UI Aesthetic:** **White Frosted Glassmorphism** (Modern Light Mode, Slate Background, Frosted Glass Cards, Indigo & Emerald Accents)  

---

## 📌 1. Executive Summary & Architecture

SupportNova is an enterprise customer complaint resolution platform powered by **Two Independent Processing Pipelines**:

1. **Pipeline 1 (Generative AI Pipeline):** Uses LLM (Gemini / Claude / OpenAI) to extract primary & secondary issues, detect customer sentiment, assign urgency (P0-P3), suggest responsible department, retrieve policy references, and generate a draft response.
2. **Pipeline 2 (Python Ground-Truth Rule Engine):** Deterministic validation engine comparing complaints against a **100+ Complaint Resolution Rule Matrix**. Enforces mandatory escalations, checks refund eligibility, flags prohibited actions, and verifies policy precedence.
3. **Comparison Engine:** Compares Pipeline 1 vs Pipeline 2. Auto-approves on `[VERIFIED MATCH]`; routes conflicts to the **Manager / Reviewer Queue** on `[MISMATCH DETECTED]`.

```
                              ┌─────────────────────────────┐
                              │   Customer Complaint Intake │
                              │ (Web Form / File Upload)    │
                              └──────────────┬──────────────┘
                                             │
                             ┌───────────────┴───────────────┐
                             ▼                               ▼
         ┌───────────────────────────────────────┐ ┌───────────────────────────────────────┐
         │  Pipeline 1: GenAI Intelligence       │ │ Pipeline 2: Python Ground-Truth Engine│
         │  (Gemini / OpenAI / Anthropic API)    │ │ (Deterministic Business Rule Matrix)  │
         ├───────────────────────────────────────┤ ├───────────────────────────────────────┤
         │ • Issue & Category Extraction         │ │ • Ground-Truth Category & Routing     │
         │ • Sentiment & Urgency (P0-P3)         │ │ • Mandatory Escalation Check          │
         │ • Draft Response & Resolution Steps   │ │ • Policy Precedence & Refund Rules    │
         └───────────────────┬───────────────────┘ └───────────────────┬───────────────────┘
                             │                                         │
                             └───────────────────┬─────────────────────┘
                                                 ▼
                              ┌─────────────────────────────────────┐
                              │     Python Comparison Engine        │
                              │  [ Match ] ──► Auto-Approve         │
                              │  [ Mismatch ] ──► Reviewer Queue    │
                              └──────────────────┬──────────────────┘
                                                 ▼
                              ┌─────────────────────────────────────┐
                              │      Role-Based Dashboards          │
                              │  Customer | Agent | Reviewer | Admin│
                              └─────────────────────────────────────┘
```

---

## 👥 2. Role-Based Access Control (RBAC) & Page Routes

| Role | Access Mode | Route | Key Functionalities |
| :--- | :--- | :--- | :--- |
| 👤 **Customer** | Google OAuth Login + Direct Access | `/customer/dashboard`<br>`/customer/submit` | Submit complaints, drag-and-drop file uploader, real-time AI pre-validation, live status timeline |
| 🎧 **Support Agent** | Staff Switcher | `/agent/workspace` | 3-panel workbench: Ticket Queue, Dual-Pipeline Comparison (GenAI vs Python Rule Engine), Response Copilot |
| ⚖️ **Manager / Reviewer** | Staff Switcher | `/reviewer/queue` | Audit queue for AI mismatches, prompt injection flags, hallucination warnings, override decision modal with audit logger |
| ⚙️ **Administrator** | Staff Switcher | `/admin/dashboard` | Analytics command center, Knowledge Base (PDF/DOCX) uploader, Rule Matrix editor, **Staff Management (Create/Edit Manager, Reviewer, Agent)** |

---

## 🤖 3. Master Prompt for AI Code Generator (Claude Sonnet / Gemini)

Below is the complete, self-contained prompt to give an AI coding assistant to generate the entire Next.js frontend:

```markdown
### SYSTEM PROMPT: Next.js Frontend Construction for SupportNova

You are tasked with building the frontend for "SupportNova" — a Generative AI & Ground-Truth Complaint Intelligence platform.

#### KEY REQUIREMENTS & CONSTRAINTS:
1. Framework: Next.js 14+ (App Router), JavaScript (JSX - DO NOT use TypeScript).
2. NO `<style jsx>` TAGS: Do NOT use `<style jsx>` anywhere to prevent compiler panics. Use standard Tailwind CSS classes or inline JS style objects.
3. Theme: White Frosted Glassmorphism UI (Light mode).
   - Base Background: `bg-slate-50` or `bg-gradient-to-br from-slate-50 via-indigo-50/20 to-slate-100` (`#F8FAFC`).
   - Cards: `bg-white/75 backdrop-blur-md border border-white/80 shadow-sm shadow-slate-200/50 hover:shadow-md transition-all rounded-2xl`.
   - Text: Dark Slate `#0F172A`, Muted Gray `#64748B`.
   - Accents: Royal Violet (`#7C3AED`) for GenAI, Emerald (`#059669`) for Python Rule Engine, Amber (`#D97706`) for SLA/Mismatch, Rose (`#E11D48`) for Escalations.
4. Access Control:
   - Customer role has Google OAuth Sign-In ("Continue with Google") on `/login`.
   - All dashboards (Customer, Agent, Manager/Reviewer, Admin) must also be directly accessible via quick role switcher without login barriers.
5. Component Architecture:
   - `/login` — Login page with Google OAuth button for Customer & quick direct role access buttons.
   - `/customer/dashboard` — Customer history, active ticket timeline step-by-step progress, complaint volume area chart.
   - `/customer/submit` — Intelligent complaint submission form with real-time text pre-validation indicator (detects short text, missing Order ID), drag-and-drop PDF/Image file uploader.
   - `/agent/workspace` — 3-Panel Agent Workbench:
     - Left: Filterable Ticket Queue (P0-P3 priority, SLA countdown timer).
     - Center: Dual-Pipeline Inspection comparing GenAI JSON output vs Python Ground-Truth Rule Matrix with `[VERIFIED MATCH]` / `[MISMATCH DETECTED]` banner.
     - Right: Response Copilot with Tone Adjustment buttons (Empathetic, Professional, Formal), 1-click Policy Citation inserts, and 1-click Approval.
   - `/reviewer/queue` — Manager/Reviewer Queue with filter tabs (Mismatch, Security Injection Attempt, Hallucination Warning, SLA Risk), side-by-side comparison modal, mandatory override reason input logging.
   - `/admin/dashboard` — Administrator Command Center:
     - Analytics Tab (Volume chart, Department workload bar chart, AI match rate pie chart, SLA risk meter).
     - Knowledge Base Tab (PDF/DOCX uploader, chunk inspector, version control tags).
     - Rule Matrix Tab (100+ complaint rules table with search & pagination).
     - Staff Management Tab (Create & Edit Manager, Reviewer, and Agent profiles with department assignments & detail drawers).
```

---

## 🎨 4. Design System Tokens (White Glassmorphism)

- **Container Background:** `bg-slate-50` (`#F8FAFC`)
- **Card Background:** `bg-white/80 backdrop-blur-xl border border-white shadow-sm shadow-slate-200/50`
- **Primary Text:** `text-slate-900` (`#0F172A`)
- **Secondary Text:** `text-slate-500` (`#64748B`)
- **Indigo Accent:** `bg-indigo-600` / `text-indigo-600` (`#4F46E5`)
- **Violet Accent:** `bg-violet-600` / `text-violet-600` (`#7C3AED`)
- **Emerald Accent:** `bg-emerald-600` / `text-emerald-600` (`#059669`)
- **Amber Accent:** `bg-amber-600` / `text-amber-600` (`#D97706`)
- **Rose Accent:** `bg-rose-600` / `text-rose-600` (`#E11D48`)

---

## 🚀 5. Quick Setup Guide

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Development Server
```bash
npm run dev
```

### 3. Open Application
Navigate to **`http://localhost:3000`** in your browser to view the White Glassmorphism interface.
