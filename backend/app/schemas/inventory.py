# backend/app/schemas/inventory.py
from pydantic import BaseModel
from typing import Optional
from datetime import date


class InventoryItemCreate(BaseModel):
    item_raw: str
    item_norm: str
    category: str
    storage: str
    qty: Optional[float] = None
    unit: Optional[str] = None
    unit_price: Optional[float] = None
    line_total: Optional[float] = None
    purchase_date: Optional[date] = None
    expiry_date: Optional[date] = None


class InventoryItemOut(InventoryItemCreate):
    id: int
    status: str

    class Config:
        orm_mode = True
