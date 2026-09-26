import os
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from typing import Optional

from lib.db import connect_to_mongo, close_mongo_connection, get_database
from lib.websocket_manager import ws_manager
from routes.auth_routes import router as auth_router
from routes.admin_routes import router as admin_router
from routes.department_routes import router as department_router
from routes.policy_routes import router as policy_router
from routes.category_routes import router as category_router
from routes.ticket_routes import router as ticket_router
from routers.reviewer import router as reviewer_router

import asyncio

async def periodic_email_fetch():
    """Background task to fetch unseen customer emails every 30 seconds."""
    while True:
        try:
            await asyncio.sleep(30)
            from email_ingestion import fetch_latest_email_ticket
            await fetch_latest_email_ticket()
        except asyncio.CancelledError:
            break
        except Exception as e:
            print(f"[IMAP WORKER WARNING] Periodic fetch error: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Connect to MongoDB Atlas (Unified Primary Database)
    await connect_to_mongo()
    db = get_database()
    try:
        from email_ingestion import ensure_email_indexes
        await ensure_email_indexes(db)
    except Exception as ie:
        print(f"[INDEX NOTICE] {ie}")
    fetch_task = asyncio.create_task(periodic_email_fetch())
    yield
    # Shutdown: Cancel background task & Close MongoDB Connection
    fetch_task.cancel()
    await close_mongo_connection()

app = FastAPI(
    title="NovaWear Apparel API Backend",
    description="Generative AI & Ground-Truth Complaint Intelligence Platform API",
    version="1.0.0",
    lifespan=lifespan
)

# CORS Configuration for Next.js Client & Vercel Deployments
allowed_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
frontend_env = os.getenv("FRONTEND_URL")
if frontend_env:
    allowed_origins.append(frontend_env)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"^https://.*\.vercel\.app$",
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
app.include_router(reviewer_router)

@app.get("/")
async def root():
    return {
        "status": "online",
        "platform": "NovaWear Apparel AI Complaint Intelligence API",
        "version": "1.0.0",
        "docs": "/docs"
    }

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "database": "MongoDB Async Motor Connected",
        "ai_engine": "Groq LLM Pipeline Ready",
        "websocket": f"Active connections: {len(ws_manager.active_connections)}"
    }

# ── CENTRAL REAL-TIME WEBSOCKET ROUTE ──
@app.websocket("/ws")
@app.websocket("/ws/{client_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    client_id: Optional[str] = "guest",
    role: Optional[str] = "GUEST"
):
    """
    Real-Time WebSocket Gateway for live, zero-reload synchronization.
    Supports Manager, Admin, Reviewer, and Agent live updates.
    """
    await ws_manager.connect(websocket, client_id=client_id, role=role)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        await ws_manager.disconnect(websocket)
    except Exception:
        await ws_manager.disconnect(websocket)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
