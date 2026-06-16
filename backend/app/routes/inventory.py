# backend/app/routes/inventory.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.schemas.inventory import InventoryItemCreate, InventoryItemOut
from app.models.inventory import InventoryItem
from app.database import get_db  # adjust import path to match your project

router = APIRouter(prefix="/inventory", tags=["inventory"])


@router.post("/", response_model=List[InventoryItemOut])
def create_inventory_items(
    items: List[InventoryItemCreate],
    db: Session = Depends(get_db),
):
    """Bulk-create inventory records from parsed receipt items."""
    db_items = []
    for it in items:
        db_item = InventoryItem(
            item_raw=it.item_raw,
            item_norm=it.item_norm,
            category=it.category,
            storage=it.storage,
            qty=it.qty,
            unit=it.unit,
            unit_price=it.unit_price,
            line_total=it.line_total,
            purchase_date=it.purchase_date,
            expiry_date=it.expiry_date,
            status="active",
        )
        db.add(db_item)
        db_items.append(db_item)

    db.commit()
    for db_item in db_items:
        db.refresh(db_item)
    return db_items


@router.get("/", response_model=List[InventoryItemOut])
def list_inventory_items(
    db: Session = Depends(get_db),
    status: str | None = None,
    storage: str | None = None,
):
    """List inventory items, optionally filtered by status or storage."""
    q = db.query(InventoryItem)
    if status:
        q = q.filter(InventoryItem.status == status)
    if storage:
        q = q.filter(InventoryItem.storage == storage)
    return q.all()


@router.post("/{item_id}/mark-used", response_model=InventoryItemOut)
def mark_item_used(item_id: int, db: Session = Depends(get_db)):
    item = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    item.status = "used"
    db.commit()
    db.refresh(item)
    return item


@router.post("/{item_id}/mark-discarded", response_model=InventoryItemOut)
def mark_item_discarded(item_id: int, db: Session = Depends(get_db)):
    item = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    item.status = "discarded"
    db.commit()
    db.refresh(item)
    return item
