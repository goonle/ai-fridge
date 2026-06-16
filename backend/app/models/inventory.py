# backend/app/models/inventory.py
from sqlalchemy import Column, Integer, String, Float, Date, Enum
from sqlalchemy.sql import func
from sqlalchemy.orm import declarative_base
from datetime import date
from app.database import Base  # <-- import Base from database.py
# Base = declarative_base()  # if you already have Base somewhere, import that instead

class InventoryItem(Base):
    __tablename__ = "inventory_items"

    id = Column(Integer, primary_key=True, index=True)

    # For now, assume single user system
    user_id = Column(Integer, nullable=True)

    item_raw = Column(String, nullable=False)
    item_norm = Column(String, nullable=False)
    category = Column(String, nullable=False)
    storage = Column(String, nullable=False)  # 'fridge' | 'freezer' | 'pantry'

    qty = Column(Float, nullable=True)
    unit = Column(String, nullable=True)       # 'kg', 'ea', etc.

    unit_price = Column(Float, nullable=True)
    line_total = Column(Float, nullable=True)

    purchase_date = Column(Date, nullable=True)
    expiry_date = Column(Date, nullable=True)

    status = Column(String, nullable=False, default="active")  
    # 'active' | 'used' | 'discarded' | 'expired'

    created_at = Column(Date, nullable=False, default=func.current_date())
