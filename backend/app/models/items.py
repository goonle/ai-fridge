from sqlalchemy import Column, Integer, String, Date, Boolean
from datetime import date
from .database import Base

class Item(Base):
    __tablename__ = "items"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    category = Column(String)
    storage_type = Column(String)
    purchase_date = Column(Date)
    expiry_date = Column(Date)
    used_status = Column(Boolean, default=False)
    @property
    def days_left(self) -> int | None:
        """Convenience property for API layer (not stored in DB)."""
        if not self.expiry_date:
            return None
        return (self.expiry_date - date.today()).days