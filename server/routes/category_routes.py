from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from lib.db import get_database
from models.category import CategoryCreate, CategoryUpdate

router = APIRouter(prefix="/api/categories", tags=["Category Management"])

@router.get("")
@router.get("/")
async def list_categories():
    """Get all categories with policy document counts."""
    db = get_database()
    cursor = db.categories.find({})
    categories = await cursor.to_list(length=200)

    for c in categories:
        c["_id"] = str(c["_id"])
        cat_id = c.get("cat_id")
        cat_name = c.get("name")

        query = {}
        if cat_id:
            query = {"$or": [{"category_id": cat_id}, {"category": cat_name}]}
        else:
            query = {"category": cat_name}

        count = await db.kb_docs.count_documents(query)
        c["policy_count"] = count

    return categories

@router.post("")
@router.post("/")
async def create_category(cat: CategoryCreate):
    """Admin creates a new category."""
    db = get_database()

    existing = await db.categories.find_one({
        "$or": [
            {"name": {"$regex": f"^{cat.name.strip()}$", "$options": "i"}},
            {"code": {"$regex": f"^{cat.code.strip()}$", "$options": "i"}}
        ]
    })

    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Category with name '{cat.name}' or code '{cat.code}' already exists."
        )

    cat_id = f"CAT-{int(datetime.utcnow().timestamp())}"
    new_cat = {
        "cat_id": cat_id,
        "name": cat.name.strip(),
        "code": cat.code.strip().upper(),
        "description": cat.description,
        "status": cat.status.upper() if cat.status else "ACTIVE",
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }

    await db.categories.insert_one(new_cat)
    new_cat["_id"] = str(new_cat["_id"])
    new_cat["policy_count"] = 0

    return {
        "status": "success",
        "message": f"Category '{cat.name}' created successfully.",
        "category": new_cat
    }

@router.put("/{cat_id}")
async def update_category(cat_id: str, cat_data: CategoryUpdate):
    """Admin updates an existing category."""
    db = get_database()
    existing = await db.categories.find_one({"cat_id": cat_id})

    if not existing:
        raise HTTPException(status_code=404, detail="Category not found.")

    update_fields = {}
    if cat_data.name is not None:
        update_fields["name"] = cat_data.name.strip()
    if cat_data.code is not None:
        update_fields["code"] = cat_data.code.strip().upper()
    if cat_data.description is not None:
        update_fields["description"] = cat_data.description
    if cat_data.status is not None:
        update_fields["status"] = cat_data.status.upper()

    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields provided to update.")

    update_fields["updated_at"] = datetime.utcnow()

    await db.categories.update_one({"cat_id": cat_id}, {"$set": update_fields})

    # If name changed, update policy references
    if cat_data.name and cat_data.name.strip() != existing.get("name"):
        await db.kb_docs.update_many(
            {"category_id": cat_id},
            {"$set": {"category": cat_data.name.strip()}}
        )

    updated_cat = await db.categories.find_one({"cat_id": cat_id})
    updated_cat["_id"] = str(updated_cat["_id"])

    return {
        "status": "success",
        "message": f"Category '{cat_id}' updated successfully.",
        "category": updated_cat
    }

@router.delete("/{cat_id}")
async def delete_category(cat_id: str):
    """Admin deletes a category."""
    db = get_database()
    cat = await db.categories.find_one({"cat_id": cat_id})

    if not cat:
        raise HTTPException(status_code=404, detail="Category not found.")

    # Unlink category from policies assigned to it
    await db.kb_docs.update_many(
        {"category_id": cat_id},
        {"$set": {"category_id": None, "category": "General"}}
    )

    await db.categories.delete_one({"cat_id": cat_id})

    return {
        "status": "success",
        "message": f"Category '{cat.get('name')}' ({cat_id}) deleted successfully."
    }
