from typing import Optional, Tuple, List
import logging

logger = logging.getLogger("SupportNova.DeptResolver")

async def resolve_ai_department(db, ai_dept_name: str, fallback_dept: Optional[str] = None) -> Tuple[str, str]:
    """
    Resolves the exact department foreign key (dept_id) and official name from db.departments.
    Matches exact name/code or partial substring.
    Returns (dept_id, official_dept_name).
    """
    try:
        depts = await db.departments.find({}).to_list(length=100)
    except Exception as e:
        logger.error(f"Error fetching departments: {e}")
        depts = []

    if not depts:
        return ("DEP-DEFAULT", ai_dept_name or "General")

    ai_clean = (ai_dept_name or "").strip().lower()

    # 1. Exact match on name or code
    for d in depts:
        d_name = d.get("name", "").strip().lower()
        d_code = d.get("code", "").strip().lower()
        if d_name == ai_clean or d_code == ai_clean:
            return (d["dept_id"], d["name"])

    # 2. Substring / partial match (e.g. 'Ebook Support' -> 'Ebook', 'Cloud Architecture' -> 'Cloud')
    for d in depts:
        d_name = d.get("name", "").strip().lower()
        if d_name and (d_name in ai_clean or ai_clean in d_name):
            return (d["dept_id"], d["name"])

    # 3. Fallback match (e.g. customer_department)
    if fallback_dept:
        fb_clean = fallback_dept.strip().lower()
        for d in depts:
            d_name = d.get("name", "").strip().lower()
            if d_name and (d_name in fb_clean or fb_clean in d_name):
                return (d["dept_id"], d["name"])

    # 4. Default to first department in database
    return (depts[0]["dept_id"], depts[0]["name"])

async def get_active_department_names(db) -> List[str]:
    """Returns list of active department names in database."""
    try:
        depts = await db.departments.find({}).to_list(length=100)
        names = [d["name"] for d in depts if d.get("name")]
        return names if names else ["Ebook", "Cloud"]
    except Exception:
        return ["Ebook", "Cloud"]
