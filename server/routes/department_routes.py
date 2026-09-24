from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from lib.db import get_database
from models.department import DepartmentCreate, DepartmentUpdate

router = APIRouter(prefix="/api/departments", tags=["Department Management"])

@router.get("")
@router.get("/")
async def list_departments():
    """Get all departments with assigned staff/user count."""
    db = get_database()
    cursor = db.departments.find({})
    departments = await cursor.to_list(length=200)

    # Calculate user count for each department
    for d in departments:
        d["_id"] = str(d["_id"])
        dept_id = d.get("dept_id")
        dept_name = d.get("name")
        
        # Count users by department_id or department name
        query = {}
        if dept_id:
            query = {"$or": [{"department_id": dept_id}, {"department": dept_name}]}
        else:
            query = {"department": dept_name}
            
        count = await db.users.count_documents(query)
        d["member_count"] = count

    return departments

@router.post("")
@router.post("/")
async def create_department(dept: DepartmentCreate):
    """Admin creates a new department."""
    db = get_database()
    
    # Check if department with same name or code exists
    existing = await db.departments.find_one({
        "$or": [
            {"name": {"$regex": f"^{dept.name}$", "$options": "i"}},
            {"code": {"$regex": f"^{dept.code}$", "$options": "i"}}
        ]
    })
    
    if existing:
        raise HTTPException(
            status_code=400, 
            detail=f"Department with name '{dept.name}' or code '{dept.code}' already exists."
        )

    dept_id = f"DEP-{int(datetime.utcnow().timestamp())}"
    new_dept = {
        "dept_id": dept_id,
        "name": dept.name.strip(),
        "code": dept.code.strip().upper(),
        "description": dept.description,
        "status": dept.status.upper() if dept.status else "ACTIVE",
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }

    await db.departments.insert_one(new_dept)
    new_dept["_id"] = str(new_dept["_id"])
    new_dept["member_count"] = 0

    return {
        "status": "success",
        "message": f"Department '{dept.name}' created successfully.",
        "department": new_dept
    }

@router.put("/{dept_id}")
async def update_department(dept_id: str, dept_data: DepartmentUpdate):
    """Admin updates an existing department."""
    db = get_database()
    existing = await db.departments.find_one({"dept_id": dept_id})

    if not existing:
        raise HTTPException(status_code=404, detail="Department not found.")

    update_fields = {}
    if dept_data.name is not None:
        update_fields["name"] = dept_data.name.strip()
    if dept_data.code is not None:
        update_fields["code"] = dept_data.code.strip().upper()
    if dept_data.description is not None:
        update_fields["description"] = dept_data.description
    if dept_data.status is not None:
        update_fields["status"] = dept_data.status.upper()

    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields provided to update.")

    update_fields["updated_at"] = datetime.utcnow()

    await db.departments.update_one({"dept_id": dept_id}, {"$set": update_fields})

    # If name changed, update user references
    if dept_data.name and dept_data.name.strip() != existing.get("name"):
        await db.users.update_many(
            {"department_id": dept_id},
            {"$set": {"department": dept_data.name.strip()}}
        )

    updated_dept = await db.departments.find_one({"dept_id": dept_id})
    updated_dept["_id"] = str(updated_dept["_id"])

    return {
        "status": "success",
        "message": f"Department '{dept_id}' updated successfully.",
        "department": updated_dept
    }

@router.delete("/{dept_id}")
async def delete_department(dept_id: str):
    """Admin deletes a department."""
    db = get_database()
    dept = await db.departments.find_one({"dept_id": dept_id})

    if not dept:
        raise HTTPException(status_code=404, detail="Department not found.")

    # Unlink department from users assigned to it
    await db.users.update_many(
        {"department_id": dept_id},
        {"$set": {"department_id": None, "department": "Unassigned"}}
    )

    await db.departments.delete_one({"dept_id": dept_id})

    return {
        "status": "success",
        "message": f"Department '{dept.get('name')}' ({dept_id}) deleted successfully."
    }
