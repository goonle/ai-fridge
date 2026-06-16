# backend/app/database.py
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
import os
from dotenv import load_dotenv

load_dotenv()  # optional if you use .env locally

# ------------------------------------------
# 1. Load Neon/Vercel PostgreSQL connection
# ------------------------------------------

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise ValueError("❌ DATABASE_URL is not set in environment variables")

# IMPORTANT: For async Neon URLs like:
# postgresql://...
# You MUST replace ?sslmode=require manually if not included
if "sslmode" not in DATABASE_URL:
    DATABASE_URL += "?sslmode=require"

# ------------------------------------------
# 2. Create SQLAlchemy Engine
# ------------------------------------------

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,     # reconnect if connection drops
    pool_recycle=300,       # avoid stale connections
)

# ------------------------------------------
# 3. Create SessionLocal
# ------------------------------------------

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

# ------------------------------------------
# 4. Base class for all models
# ------------------------------------------

Base = declarative_base()

# ------------------------------------------
# 5. Dependency for FastAPI
# ------------------------------------------

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
