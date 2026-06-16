from fastapi import FastAPI
from app.database import Base, engine  # <---
from app.models import inventory       # <--- ensure models are imported

from app.routes import receipt, inventory as inventory_routes

Base.metadata.create_all(bind=engine)   # <--- creates tables

app = FastAPI()

app.include_router(receipt.router)
app.include_router(inventory_routes.router)
