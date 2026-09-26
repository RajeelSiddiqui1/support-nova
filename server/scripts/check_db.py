import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from lib.db import connect_to_mongo, get_database

async def main():
    await connect_to_mongo()
    db = get_database()
    cats = await db.categories.find({}).to_list(100)
    depts = await db.departments.find({}).to_list(100)
    policies = await db.kb_docs.find({}).to_list(100)
    print("CATEGORIES:", [(c.get("name"), c.get("code")) for c in cats])
    print("DEPARTMENTS:", [(d.get("name"), d.get("dept_id")) for d in depts])
    print("POLICIES:", [p.get("title") or p.get("name") or p.get("policy_id") for p in policies])

if __name__ == "__main__":
    asyncio.run(main())
