import os
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from typing import Optional

from lib.db import connect_to_mongo, close_mongo_connection, get_database, DatabaseConfigurationError, ensure_db_connected
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
    """Background task to fetch unseen customer emails every 30 seconds (Standalone servers only)."""
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
    try:
        await connect_to_mongo()
        db = get_database()
        if db is not None:
            try:
                from ai.prompt_service import PromptService
                from services.config_service import ConfigService
                await PromptService.seed_default_prompts(db)
                await ConfigService.seed_all_configs(db)
            except Exception as se:
                print(f"[LIFESPAN SEED NOTICE] {se}")
    except Exception as e:
        print(f"[LIFESPAN DB NOTICE] {e}")

    fetch_task = None
    index_task = None
    # Only run background polling on standalone environments (not Vercel Serverless)
    if not (os.getenv("VERCEL") or os.getenv("VERCEL_ENV")):
        try:
            db = get_database()
            if db is not None:
                from email_ingestion import ensure_email_indexes
                index_task = asyncio.create_task(ensure_email_indexes(db))
        except Exception as ie:
            print(f"[INDEX NOTICE] {ie}")
        fetch_task = asyncio.create_task(periodic_email_fetch())

    yield

    # Shutdown: Cancel background task & Close MongoDB Connection
    if fetch_task:
        fetch_task.cancel()
    if index_task and not index_task.done():
        index_task.cancel()
    await close_mongo_connection()

app = FastAPI(
    title="NovaWear Apparel API Backend",
    description="Generative AI & Ground-Truth Complaint Intelligence Platform API",
    version="1.0.0",
    lifespan=lifespan
)

# ── GLOBAL EXCEPTION HANDLERS FOR VERCEL DIAGNOSTICS ──
@app.exception_handler(DatabaseConfigurationError)
async def db_config_exception_handler(request, exc: DatabaseConfigurationError):
    is_vercel = bool(os.getenv("VERCEL") or os.getenv("VERCEL_ENV"))
    return JSONResponse(
        status_code=503,
        content={
            "error": "Database Connection Unavailable",
            "detail": str(exc),
            "is_vercel": is_vercel,
            "instruction": "Please set MONGO_URI in Vercel Dashboard -> Settings -> Environment Variables." if is_vercel else "Ensure local MongoDB or Atlas is running.",
            "path": str(request.url.path)
        }
    )

@app.exception_handler(Exception)
async def global_exception_handler(request, exc: Exception):
    err_msg = str(exc)
    is_vercel = bool(os.getenv("VERCEL") or os.getenv("VERCEL_ENV"))
    print(f"[UNHANDLED EXCEPTION] {request.url.path}: {err_msg}")
    
    if "Database connection unavailable" in err_msg or "NoneType" in err_msg or "ServerSelectionTimeoutError" in err_msg:
        return JSONResponse(
            status_code=503,
            content={
                "error": "Database Service Unavailable",
                "detail": err_msg,
                "is_vercel": is_vercel,
                "instruction": "Ensure MONGO_URI is set correctly in environment variables.",
                "path": str(request.url.path)
            }
        )
    
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal Server Error",
            "detail": err_msg,
            "path": str(request.url.path)
        }
    )

# CORS Configuration for Next.js Client & Vercel Deployments
allowed_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
frontend_env = os.getenv("FRONTEND_URL")
if frontend_env:
    allowed_origins.append(frontend_env.strip().rstrip("/"))

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"^https?://.*\.vercel\.app$",
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
        "health": "/api/health",
        "docs": "/docs"
    }

@app.get("/health")
@app.get("/api/health")
async def health_check():
    is_vercel = bool(os.getenv("VERCEL") or os.getenv("VERCEL_ENV"))
    mongo_uri = os.getenv("MONGO_URI", "")
    has_mongo_env = bool(mongo_uri and "localhost" not in mongo_uri and "127.0.0.1" not in mongo_uri)
    
    db = None
    db_status = "disconnected"
    db_name = None
    error_detail = None

    try:
        db = await ensure_db_connected()
    except Exception as e:
        error_detail = str(e)

    if db is not None:
        try:
            await asyncio.wait_for(db.command("ping"), timeout=2.0)
            db_status = "connected"
            db_name = db.name
        except Exception as pe:
            db_status = "unreachable"
            error_detail = str(pe)
    else:
        if is_vercel and not has_mongo_env:
            db_status = "misconfigured_vercel_missing_mongo_uri"
            error_detail = "MONGO_URI environment variable is not configured in Vercel Settings."

    is_healthy = db_status == "connected"
    response_code = 200 if is_healthy else 503

    return JSONResponse(
        status_code=response_code,
        content={
            "status": "healthy" if is_healthy else "unhealthy",
            "database": {
                "status": db_status,
                "name": db_name,
                "error": error_detail
            },
            "environment": {
                "is_vercel": is_vercel,
                "mongo_uri_configured": has_mongo_env
            },
            "websocket_active": len(ws_manager.active_connections)
        }
    )

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
