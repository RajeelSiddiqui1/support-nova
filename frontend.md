# SupportNova — Next.js Frontend Specification & Prompt Guide

> **Project Name:** SupportNova — Generative AI & Ground-Truth Complaint Intelligence System  
> **Framework Target:** Next.js 14+ (App Router, JavaScript / JSX — No TypeScript, No `<style jsx>`)  
> **Design Theme:** *White Frosted Glassmorphism UI* (Light Mode, Soft Slate Base, Frosted Glass Cards, Indigo & Emerald Accents)  

---

## 🎨 Design Theme: White Glassmorphism

- **Base Background:** `#F8FAFC` (Slate 50 with subtle indigo gradient overlay)
- **Glass Cards:** `bg-white/80 backdrop-blur-xl border border-white shadow-sm shadow-slate-200/50 hover:shadow-md transition-all rounded-2xl`
- **Text:** Dark Slate `#0F172A`, Muted Gray `#64748B`
- **Accents:**
  - 🤖 **GenAI Intelligence:** Royal Violet (`#7C3AED`) & Indigo (`#4F46E5`)
  - 🛡️ **Python Ground-Truth Engine:** Emerald (`#059669`) & Cyan (`#0891B2`)
  - ⚠️ **SLA Warning / Mismatch:** Warm Amber (`#D97706`)
  - 🚨 **Critical Escalation / Security:** Rose Red (`#E11D48`)

---

## 👥 Role Architecture & Features

### 👤 Customer Module (`/customer/*`)
- **Google OAuth Login:** "Continue with Google" sign-in button via NextAuth.js.
- **Complaint Submission:** Intelligent form with real-time text pre-validation indicator (checks min text length & Order ID), drag-and-drop PDF/Image file uploader.
- **Ticket Dashboard:** Complaint history table, active ticket timeline step-by-step progress, complaint volume trend chart.

### 🎧 Support Agent Workbench (`/agent/workspace`)
- **3-Panel Workbench:**
  - Left Panel: Filterable Ticket Queue (P0-P3 priority, SLA countdown timer).
  - Center Panel: Dual-Pipeline Inspection comparing GenAI JSON output vs Python Ground-Truth Rule Matrix with `[VERIFIED MATCH]` / `[MISMATCH DETECTED]` banner.
  - Right Panel: Response Copilot with Tone Adjustment buttons (Empathetic, Professional, Formal), 1-click Policy Citation inserts (`DEL-POL-04 §4.3`), 1-click Approval.

### ⚖️ Manager / Reviewer Queue (`/reviewer/queue`)
- **Conflict Review Feed:** Mismatch, Security Injection Attempt, Hallucination Warning, SLA Risk.
- **Override & Audit Modal:** Side-by-side comparison with mandatory reason logger.

### ⚙️ Administrator Command Center (`/admin/dashboard`)
- **Analytics:** Volume area chart, department workload bar chart, AI match rate pie chart, SLA risk meter.
- **Knowledge Base:** PDF/DOCX uploader, parsing status, chunk inspector.
- **Rule Matrix Editor:** Searchable data table of 100+ rules.
- **Staff Management:** Create & Edit Manager, Reviewer, and Agent profiles with department assignments & detail drawers.

---

## 🤖 Master Prompt for Claude Sonnet

```markdown
Build a Next.js 14+ App Router application in JSX (no TypeScript, no <style jsx> tags).

Theme: White Glassmorphism UI (Light mode, soft slate background #F8FAFC, frosted white cards with border border-white shadow-sm).

Pages:
1. /login - Customer Google OAuth Sign-In button + direct quick-access role cards for Customer, Agent, Manager/Reviewer, Admin.
2. /customer/dashboard - Ticket history, active timeline, complaint volume chart.
3. /customer/submit - Complaint form with drag-drop uploader & real-time text pre-validator.
4. /agent/workspace - 3-panel workbench: queue, dual-pipeline visualizer (GenAI vs Python Rule Engine), response copilot with tone selector.
5. /reviewer/queue - Manager review queue for AI mismatches and prompt injection flags with override audit logger.
6. /admin/dashboard - Analytics charts, Knowledge Base PDF/DOCX uploader, Rule Matrix editor, Staff Management for Manager/Reviewer/Agent creation and editing.
```
