import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/supportnova_db")
DB_NAME = os.getenv("DB_NAME")

class DatabaseConfigurationError(Exception):
    """Raised when MongoDB is not connected or MONGO_URI is missing on Vercel"""
    pass

class Database:
    client: AsyncIOMotorClient = None
    db = None
    last_error: str = None

db_instance = Database()

async def connect_to_mongo():
    """Establish async connection to MongoDB via Motor"""
    mongo_uri = os.getenv("MONGO_URI", MONGO_URI)
    is_vercel = bool(os.getenv("VERCEL") or os.getenv("VERCEL_ENV"))
    
    # Check if MONGO_URI is default localhost while running on Vercel
    if is_vercel and ("localhost" in mongo_uri or "127.0.0.1" in mongo_uri):
        err_msg = "MONGO_URI is set to localhost or missing in Vercel settings. Please configure MONGO_URI in Vercel Dashboard -> Settings -> Environment Variables."
        print(f"[CRITICAL VERCEL ERROR] {err_msg}")
        db_instance.last_error = err_msg
        db_instance.db = None
        return None

    try:
        timeout_ms = int(os.getenv("MONGO_SERVER_SELECTION_TIMEOUT_MS", "3000" if is_vercel else "5000"))
        db_instance.client = AsyncIOMotorClient(
            mongo_uri,
            serverSelectionTimeoutMS=timeout_ms,
        )
        db_name = os.getenv("DB_NAME")
        if db_name:
            db_instance.db = db_instance.client[db_name]
        else:
            try:
                db_instance.db = db_instance.client.get_default_database(default="supportnova_db")
            except Exception:
                db_instance.db = db_instance.client["supportnova_db"]
        
        db_instance.last_error = None
        print(f"[OK] Connected to MongoDB database '{db_instance.db.name}' via Atlas/URI")
        return db_instance.db
    except Exception as e:
        err_str = str(e)
        db_instance.last_error = err_str
        db_instance.db = None
        print(f"[ERROR] Failed to connect to MongoDB: {err_str}")
        if not is_vercel:
            raise e
        return None

async def close_mongo_connection():
    """Close MongoDB connection gracefully"""
    if db_instance.client:
        db_instance.client.close()
        db_instance.client = None
        db_instance.db = None
        print("[INFO] MongoDB connection closed.")

def get_database():
    """Retrieve database instance. Throws DatabaseConfigurationError if unavailable."""
    if db_instance.db is None:
        is_vercel = bool(os.getenv("VERCEL") or os.getenv("VERCEL_ENV"))
        detail = db_instance.last_error or ("MONGO_URI is missing or unreachable." if is_vercel else "MongoDB database is not connected.")
        raise DatabaseConfigurationError(f"Database connection unavailable: {detail}")
    return db_instance.db

async def ensure_db_connected():
    """Ensure MongoDB is connected (useful for serverless cold starts)"""
    if db_instance.db is None:
        await connect_to_mongo()
    return db_instance.db
