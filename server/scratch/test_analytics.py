import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dotenv import load_dotenv
load_dotenv()

from lib.db import connect_to_mongo
from routes.admin_routes import get_admin_analytics, list_rules

async def main():
    await connect_to_mongo()
    analytics = await get_admin_analytics()
    print("STATUS:", analytics["status"])
    print("SUMMARY:", analytics["summary"])
    print("VOLUME (first 3):", analytics["volume"][:3])
    print("DEPT WORKLOAD:", analytics["department_workload"])
    print("AI ACCURACY:", analytics["ai_pipeline_accuracy"])
    print("SLA RISK:", analytics["sla_risk"])
    print("WEEKLY TREND (first 3):", analytics["weekly_trend"][:3])
    rules = await list_rules()
    print("RULES COUNT:", len(rules))

if __name__ == "__main__":
    asyncio.run(main())
