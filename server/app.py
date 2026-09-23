import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from lib.db import connect_to_mongo, close_mongo_connection
from routes.auth_routes import router as auth_router
from routes.admin_routes import router as admin_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Connect to MongoDB
    await connect_to_mongo()
    yield
    # Shutdown: Close MongoDB Connection
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
