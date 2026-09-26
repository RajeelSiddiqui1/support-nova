import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/supportnova_db")
DB_NAME = os.getenv("DB_NAME")

class Database:
    client: AsyncIOMotorClient = None
    db = None

db_instance = Database()

async def connect_to_mongo():
    """Establish async connection to MongoDB via Motor"""
    try:
        db_instance.client = AsyncIOMotorClient(MONGO_URI)
        if DB_NAME:
            db_instance.db = db_instance.client[DB_NAME]
        else:
            try:
                db_instance.db = db_instance.client.get_default_database(default="supportnova_db")
            except Exception:
                db_instance.db = db_instance.client["supportnova_db"]
        print(f"[OK] Connected to MongoDB database '{db_instance.db.name}' via Atlas/URI")
    except Exception as e:
        print(f"[ERROR] Failed to connect to MongoDB: {e}")
        raise e

async def close_mongo_connection():
    """Close MongoDB connection gracefully"""
    if db_instance.client:
        db_instance.client.close()
        print("[INFO] MongoDB connection closed.")

def get_database():
    """Retrieve database instance"""
    return db_instance.db
