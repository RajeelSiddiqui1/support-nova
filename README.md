# 🚀 SupportNova — Generative AI & Ground-Truth Complaint Intelligence System

> **Project:** SupportNova — Dual-Pipeline Customer Complaint Resolution Intelligence  
> **Frontend Stack:** Next.js 14+ (App Router, JavaScript / JSX — White Frosted Glassmorphism UI)  
> **Backend Stack:** Python FastAPI, Motor Async MongoDB Client, Groq LLM API, PyPDF & DOCX Extractor  

---

## 📌 1. Project Overview & Architecture

SupportNova is an enterprise customer complaint resolution platform powered by **Two Independent Processing Pipelines**:

1. **Pipeline 1 (Generative AI Pipeline):** Uses Groq LLM (Llama 3.3 70B) to extract primary & secondary issues, detect customer sentiment, assign urgency (P0-P3), suggest responsible department, retrieve policy references, and generate a draft response.
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
         │  (Groq Llama-3.3 70B API)             │ │ (Deterministic Business Rule Matrix)  │
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

## 📁 2. Project Directory Structure

```
supportnova/
├── client/                      # 🎨 Next.js 14 Frontend (JSX)
│   ├── app/                     # App Router pages (/login, /customer, /agent, /reviewer, /admin)
│   ├── components/              # Sidebar, Navbar, StatCard
│   ├── middleware.js            # RBAC & Authentication Route Guard Middleware
│   ├── .env.local               # Frontend Environment Variables (API URL, OAuth)
│   └── package.json
│
├── server/                      # ⚡ Python / FastAPI Backend
│   ├── app.py                   # FastAPI main app with CORS & lifespan events
│   ├── seed.py                  # Database Seeding script (Admin & Rules)
│   ├── pyproject.toml           # Backend dependencies configuration
│   ├── .env                     # Backend Environment Variables (MongoDB, Groq, SMTP, JWT)
│   ├── lib/
│   │   ├── db.py                # Async Motor MongoDB Connection
│   │   ├── auth.py              # Password Hashing, Temp Password & OTP Generator
│   │   └── email_service.py     # Email Notification & OTP Service
│   ├── models/                  # Pydantic MongoDB Schemas (User, Ticket, KB Doc, Rule Matrix)
│   ├── routes/                  # API Endpoint Routers (auth_routes.py, admin_routes.py)
│   └── ai/                      # AI Intelligence Modules (PDF Extractor, RAG, Groq Client)
│
└── .gitignore                   # Unified Git Ignore (ignores node_modules, .venv, .env files)
```

---

## ⚙️ 3. How to Setup and Run Backend (`server/`)

### Step 1: Navigate to `server/` Directory
```bash
cd server
```

### Step 2: Configure Environment Variables (`server/.env`)
Ensure `server/.env` contains your MongoDB, Groq API Key, and SMTP credentials:
```env
MONGO_URI=mongodb://localhost:27017
DB_NAME=supportnova_db
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=llama-3.3-70b-versatile
JWT_SECRET=supportnova_secret_key_2026

# Email SMTP for Staff Passwords & OTPs (e.g. Gmail App Password)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_gmail_app_password
```

### Step 3: Install Python Dependencies
```bash
pip install -r pyproject.toml
# or using uv:
uv pip install -e .
```

### Step 4: Seed Initial Admin & Rule Matrix Data
Run `seed.py` to create default Administrator account and sample business rules in MongoDB:
```bash
python seed.py
```
> **Default Admin Account:** Email: `admin@gmail.com` | Password: `admin123`

### Step 5: Start FastAPI Backend Server
```bash
python -m uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```
FastAPI server will start at **`http://localhost:8000`** (API Docs available at `http://localhost:8000/docs`).

---

## 🎨 4. How to Setup and Run Frontend (`client/`)

### Step 1: Open New Terminal & Navigate to `client/` Directory
```bash
cd client
```

### Step 2: Configure Environment Variables (`client/.env.local`)
Ensure `client/.env.local` contains the Backend API URL:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=supportnova_nextauth_secret_key_2026
```

### Step 3: Install Node Dependencies
```bash
npm install
```

### Step 4: Start Next.js Development Server
```bash
npm run dev
```
Frontend will start at **`http://localhost:3000`**.

---

## 🔐 5. Authentication & Security Workflows

1. **AWS-Style Dual-Step Auth (`/login`):**
   - **Step 1:** User enters Email. Backend checks account status.
   - If user is `INACTIVE` -> Access blocked with Admin's Deactivation Reason.
   - If user status is `MUST_CHANGE_PASSWORD` (temporary password) -> Redirected immediately to `/auth/change-password`.
   - **Step 2:** User enters Password to complete sign-in.
2. **Pure Backend Google OAuth 2.0:**
   - "Continue with Google" redirects directly to `http://localhost:8000/api/auth/google`.
   - Backend performs token exchange with `GOOGLE_CLIENT_SECRET`, registers customer in MongoDB, and sets HTTP-only session cookies.
3. **Staff Creation & Auto Credentials:**
   - Admin creates staff (`/admin/users` or `/admin/dashboard`).
   - System auto-generates temporary password, sets status to `MUST_CHANGE_PASSWORD`, and emails credentials.
   - Staff must set permanent password on first login.
4. **Forgot Password via 6-Digit OTP (`/auth/forgot-password`):**
   - 6-digit OTP emailed to user with a 60-second resend countdown timer.
