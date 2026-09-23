import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "supportnova_db")

class Database:
    client: AsyncIOMotorClient = None
    db = None

db_instance = Database()

async def connect_to_mongo():
    """Establish async connection to MongoDB via Motor"""
    try:
        db_instance.client = AsyncIOMotorClient(MONGO_URI)
        db_instance.db = db_instance.client[DB_NAME]
        print(f"✅ Connected to MongoDB: {DB_NAME} at {MONGO_URI}")
    except Exception as e:
        print(f"❌ Failed to connect to MongoDB: {e}")
        raise e

async def close_mongo_connection():
    """Close MongoDB connection gracefully"""
    if db_instance.client:
        db_instance.client.close()
        print("🔌 MongoDB connection closed.")

def get_database():
    """Retrieve database instance"""
    return db_instance.db
