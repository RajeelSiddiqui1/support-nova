import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from lib.db import connect_to_mongo, close_mongo_connection
from routes.auth_routes import router as auth_router
from routes.admin_routes import router as admin_router
from routes.department_routes import router as department_router
from routes.policy_routes import router as policy_router
from routes.category_routes import router as category_router
from routes.ticket_routes import router as ticket_router

import asyncio

async def periodic_email_fetch():
    """Background task to fetch unseen customer emails every 30 seconds."""
    while True:
        try:
            await asyncio.sleep(30)
            from email_ingestion import fetch_and_create_email_tickets
            await fetch_and_create_email_tickets()
        except asyncio.CancelledError:
            break
        except Exception as e:
            print(f"[IMAP WORKER WARNING] Periodic fetch error: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Connect to MongoDB
    await connect_to_mongo()
    fetch_task = asyncio.create_task(periodic_email_fetch())
    yield
    # Shutdown: Cancel background task & Close MongoDB Connection
    fetch_task.cancel()
    await close_mongo_connection()

app = FastAPI(
    title="SupportNova API Backend",
    description="Generative AI & Ground-Truth Complaint Intelligence Platform API",
    version="1.0.0",
    lifespan=lifespan
)

# CORS Configuration for Next.js Client
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Routers
app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(department_router)
app.include_router(policy_router)
app.include_router(category_router)
app.include_router(ticket_router)

@app.get("/")
async def root():
    return {
        "status": "online",
        "platform": "SupportNova AI Complaint Intelligence API",
        "version": "1.0.0",
        "docs": "/docs"
    }

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "database": "MongoDB Async Motor Connected",
        "ai_engine": "Groq LLM Pipeline Ready"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
