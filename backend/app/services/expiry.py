# backend/app/services/expiry.py
import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

# ai-fridge/backend/app/services/expiry.py
# parents[0]=services, [1]=app, [2]=backend, [3]=ai-fridge
PROJECT_ROOT = Path(__file__).resolve().parents[3]
RULE_PATH = PROJECT_ROOT / "ai" / "expiry_rules" / "shelf_life.json"

with open(RULE_PATH, "r", encoding="utf-8") as f:
    SHELF_RULES = json.load(f)


def _normalize_key(name: str) -> str:
    """Simple normalisation: lowercase + strip + remove extra spaces."""
    return " ".join(name.lower().strip().split())


def _find_rule_key(item_norm: str) -> Optional[str]:
    """
    Try to match item_norm to a key in SHELF_RULES.
    Start simple: exact or singular.
    """
    if not item_norm:
        return None

    name = _normalize_key(item_norm)

    # exact match
    if name in SHELF_RULES:
        return name

    # try singular (bananas -> banana)
    if name.endswith("s") and name[:-1] in SHELF_RULES:
        return name[:-1]

    return None


def estimate_expiry_date(
    item_norm: str,
    storage: str,
    purchase_date_str: str,
) -> Optional[str]:
    """
    Returns ISO date string 'YYYY-MM-DD' or None if no rule.
    storage: 'fridge' | 'freezer' | 'pantry'
    """
    key = _find_rule_key(item_norm)
    if key is None:
        return None

    rule = SHELF_RULES.get(key, {})
    days_field = f"{storage}_days"
    days = rule.get(days_field, 0)

    if not days or days <= 0:
        return None

    # parse purchase_date, fall back to today
    try:
        purchase_dt = datetime.fromisoformat(purchase_date_str)
    except Exception:
        purchase_dt = datetime.today()

    expiry_dt = purchase_dt + timedelta(days=int(days))
    return expiry_dt.date().isoformat()
