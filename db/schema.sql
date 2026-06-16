-- db/schema.sql
CREATE TABLE IF NOT EXISTS item(
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  storage_type TEXT CHECK (storage_type IN ('fridge','freezer','pantry')),
  purchase_date DATE,
  expiry_date DATE,
  used_status BOOLEAN DEFAULT FALSE
);
CREATE TABLE IF NOT EXISTS recipe(
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  source TEXT,
  ingredients TEXT,
  relevance_score NUMERIC
);