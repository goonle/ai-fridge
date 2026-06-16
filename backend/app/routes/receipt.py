# backend/app/routes/receipt.py
from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
import tempfile, subprocess, sys, json, re, math, datetime
from pathlib import Path
import requests
from typing import List, Dict, Any, Tuple
from app.services.expiry import estimate_expiry_date

router = APIRouter(prefix="/receipt", tags=["receipt"])

class OCRBody(BaseModel):
    text: str

# --------------------------
# Deterministic line parsing
# --------------------------

# --- replace these constants ---
HEADER_FOOTER_PATTERNS = [
    r"\bSUB ?TOTAL\b", r"\bTOTAL\b", r"\bGST\b", r"\bBALANCE\b",
    r"\bEFTPOS\b", r"\bVISA\b", r"\bMASTERCARD\b", r"\bCHANGE\b",
    r"\bTHANK YOU\b", r"\bLOYALTY\b", r"\bREWARDS?\b", r"\bCARD\b",
    r"\bAPPROVED\b", r"\bAUTH\b", r"\bRECEIPT\b", r"\bINVOICE\b",
    r"\bROUND(ING)?\b", r"\bCASH\b", r"\bTAX\s+INVOICE\b", r"\bINCL(UDING)?\s+GST\b",
    r"\bLOTTO\b", r"\bKIOSK\b", r"\bSHOPPING HOURS\b", r"\bMON-?SUN\b",
    r"\bPHONE\b|\bPH\b|\(\d{2,3}\)\s*\d{3,}", r"\bRICCARTON\b", r"\bPAK'?NSAVE\b",
]

# Lines that look like promos/slogans/ads etc.
NON_ITEM_PATTERNS = [
    r"^use\s+less\s+plastic", r"^proof\s+of\s+purchase", r"^all\s+refunds",
    r"^except\s+where\s+indicated", r"^our\s+shopping\s+hours", r"^mon-?sun",
    r"^thank\s+you", r"^lo(y|t)to", r"^total", r"^\$?\s*\d+(?:\.\d{2})?\s*$",  # price-only lines
]
LOOKALIKE_MAP = {"O": "0", "o": "0", "I": "1", "l": "1", "S": "5"}

MONEY = r"\$?\d{1,4}\.\d{2}"
KG_TOKEN = r"(?:KG|K6|K9)"
EA_TOKEN = r"(?:EA|FA|EACH)"
UNIT_TOKEN = rf"(?:{KG_TOKEN}|G|ML|L|{EA_TOKEN}|PACK|PK)"

PATTERNS = [
    # NAME 0.8800 KG @ $2.79 KG (= $2.46 | -$2.46)?
    ("w_kg", re.compile(
        rf"^(?P<name>[\w ().,'&/-]{{3,}}?)\s+(?P<qty>\d+(?:[.,]\d+)*)\s*{KG_TOKEN}\b.*?@\s*(?P<unit_price>{MONEY}).*?(?:{KG_TOKEN})?.*?(?:=|->|-)?\s*(?P<line_total>{MONEY})?",
        re.IGNORECASE)),

    # NAME 1 @ $3.89 EA (= $3.89 | -$3.89)?
    ("qty_ea", re.compile(
        rf"^(?P<name>[\w ().,'&/-]{{3,}}?)\s+(?P<qty>\d{{1,2}})\s*@\s*(?P<unit_price>{MONEY})\s*(?:{EA_TOKEN})?\s*(?:=|->|-)?\s*(?P<line_total>{MONEY})?",
        re.IGNORECASE)),

    # NAME  $3.89 EA = $3.89  (this one usually appears clean)
    ("ea_equals", re.compile(
        rf"^(?P<name>[\w ().,'&/-]{{3,}}?)\s+(?P<unit_price>{MONEY})\s*{EA_TOKEN}\s*(?:=|->|-)\s*(?P<line_total>{MONEY})",
        re.IGNORECASE)),

    # fallback stays the same
    ("two_prices", re.compile(
        rf"^(?P<name>[\w ().,'&/-]{{3,}}?)\s+(?P<p1>{MONEY}).+?(?P<p2>{MONEY})",
        re.IGNORECASE)),
]

def _looks_like_item(line: str) -> bool:
    L = line.strip()
    if not L:
        return False
    U = L.upper()
    if any(re.search(p, U) for p in HEADER_FOOTER_PATTERNS):
        return False
    if any(re.search(p, U) for p in NON_ITEM_PATTERNS):
        return False
    # Must contain letters (product name) and at least one money token
    if not re.search(r"[A-Z]", U):
        return False
    if not re.search(MONEY, U):
        return False
    # Reject lines that start with price
    if re.match(rf"^\s*{MONEY}\b", U):
        return False
    return True

def normalize_money_token(tok: str) -> float | None:
    if tok is None:
        return None
    t = tok.strip().replace("$", "")
    t = "".join(LOOKALIKE_MAP.get(c, c) for c in t)
    t = t.replace(",", ".")
    try:
        return round(float(t), 2)
    except ValueError:
        return None

def normalize_qty_token(tok: str) -> float | None:
    if tok is None:
        return None
    t = tok.strip()
    t = "".join(LOOKALIKE_MAP.get(c, c) for c in t)
    t = t.replace(",", ".")
    try:
        return float(t)
    except ValueError:
        return None

def guess_unit_token(line: str) -> str:
    U = line.upper()
    if re.search(KG_TOKEN, U): return "kg"
    if re.search(r"\bG\b", U): return "g"
    if re.search(r"\bML\b", U): return "ml"
    if re.search(r"\bL\b", U): return "l"
    if re.search(rf"\b{EA_TOKEN}\b|\bEA\.\b|\bEACH\b", U): return "ea"
    if re.search(r"\bPACK\b|\bPK\b", U): return "pack"
    return "unknown"

# --- replace extract_candidates with this stricter version ---
def extract_candidates(raw_text: str):
    items, ignored = [], []
    for raw in raw_text.splitlines():
        line = raw.strip()
        if not line:
            continue
        if not _looks_like_item(line):
            ignored.append(line)
            continue

        matched = False
        for name, pat in PATTERNS:
            m = pat.search(line)
            if not m:
                continue

            desc = m.group("name").strip()
            if name == "w_kg":
                qty = normalize_qty_token(m.group("qty"))
                unit_price = normalize_money_token(m.group("unit_price"))
                line_total = normalize_money_token(m.group("line_total"))
                unit = "kg"
            elif name == "qty_ea":
                qty = normalize_qty_token(m.group("qty")) or 1.0
                unit_price = normalize_money_token(m.group("unit_price"))
                line_total = normalize_money_token(m.group("line_total"))
                unit = "ea"
            elif name == "ea_equals":
                qty = 1.0
                unit_price = normalize_money_token(m.group("unit_price"))
                line_total = normalize_money_token(m.group("line_total"))
                unit = "ea"
            else:  # two_prices
                unit = guess_unit_token(line)
                qty = 1.0 if unit in ("ea", "pack", "unknown") else None
                unit_price = normalize_money_token(m.group("p1"))
                line_total = normalize_money_token(m.group("p2"))

            # Infer total if missing and qty*unit_price is sensible
            if qty and unit_price and line_total is None:
                line_total = round(qty * unit_price, 2)
            if unit == "ea" and qty and qty > 10:
                qty = 1.0

            items.append({
                "item_raw": desc,              # pass only the description to the LLM
                "qty": qty,
                "unit": unit,
                "unit_price": unit_price,
                "line_total": line_total,
                "__src": line,                 # keep original for debugging (not returned)
            })
            matched = True
            break

        if not matched:
            # If our strict patterns fail, drop the line (avoid false positives)
            ignored.append(line)

    return items, ignored

import re

def clean_ocr_text(raw_text: str) -> list[str]:
    """
    Turn the raw OCR string into a cleaner, line-based structure.
    Adjust the rules if needed.
    """
    # If Tesseract already returns newlines, this will keep them
    lines = [line.strip() for line in raw_text.splitlines() if line.strip()]

    # If your raw_text has almost no newlines, you can add extra splitting rules here.
    # Example: split where there is a price pattern like ' = $2.99'
    if len(lines) <= 3:  # heuristic: looks like it's one giant line
        temp = re.sub(r'\s{2,}', ' ', raw_text)              # collapse big spaces
        temp = temp.replace(' = ', ' =\n')                   # break after ' = '
        lines = [line.strip() for line in temp.splitlines() if line.strip()]

    return lines

# --------------------------
# LLM normalization
# --------------------------

LLM_NORMALIZE_PROMPT = """
You are a receipt-normalization assistant for New Zealand groceries.

Your job:
1) Normalise dirty receipt item lines into simple FOOD NAMES (item_norm).
2) Classify each item into category + storage.
3) Estimate an expiry_date for perishable foods.

ITEM_NORM RULES (VERY IMPORTANT):
- item_norm must be a short, human-readable FOOD NAME in English.
- Remove store/operator codes, random letters and size codes:
  - "PANSLENTILS500GSPL"      → "Lentils"
  - "BREADSPECIALTY400G"      → "Bread"
  - "JEDSCOFFEEC0.200G4"      → "Coffee"
  - "PUMPKINBUTTERNUTEA"      → "Butternut Pumpkin"
- Remove brand names unless they are essential:
  - "PAMS LENTILS 500G"       → "Lentils"
  - "CAMPBELLS REAL STOCK"    → "Stock"
  - "EXOTIC FOODS SAUCE 72"   → "Sauce"
- You may keep size if it helps (e.g., "Lentils 500g"), but the name must be clear food words.
- Do NOT leave item_norm equal to the raw code string.

Respond with JSON ONLY, in this format:

[
  {
    "item_raw": "...",               // original noisy line
    "item_norm": "Lentils",          // cleaned food name
    "category": "protein_raw|produce|dairy|bakery|dry_goods|canned|frozen|beverage|household|other",
    "storage": "fridge|freezer|pantry",
    "purchase_date": "YYYY-MM-DD",
    "expiry_date": "YYYY-MM-DD" | null,
    "confidence": number,
    "reason": "short rationale"
  }
]

--------------------
CATEGORY & STORAGE (NZ groceries)
--------------------
- "chicken breast", "beef mince", "pork chops", "lamb", "sausages" → category="protein_raw", storage="fridge"
- "milk", "yogurt", "cheese", "cream", "butter" → category="dairy", storage="fridge"
- "bananas", "apples", "carrots", "lettuce", "pumpkin" → category="produce", storage="fridge" (bananas optional)
- "bread", "buns", "wraps" → category="bakery", storage="pantry"
- "lentils", "rice", "pasta", "flour", "sugar", "coffee" → category="dry_goods", storage="pantry"
- "canned tomatoes", "baked beans", "soups" → category="canned", storage="pantry"
- "frozen peas", "frozen mixed veg", "ice cream" → category="frozen", storage="freezer"
- "instant coffee", "tea", "soft drinks" → category="beverage"
- "plastic bags", "detergent", "cleaning wipes" → category="household"

If item_raw contains “CHICKEN BREAST” in any format:
- item_norm must be "Chicken Breast"
- category must be "protein_raw"
- storage must be "fridge"

--------------------
RULES
--------------------

1. Category & storage (NZ groceries)
- "chicken breast", "beef mince", "pork chops", "lamb", "sausages" → category="protein_raw", storage="fridge"
- "milk", "yogurt", "cheese", "cream", "butter" → category="dairy", storage="fridge"
- "bananas", "apples", "carrots", "lettuce", "pumpkin" → category="produce", storage="fridge" (bananas optional)
- "bread", "buns", "wraps" → category="bakery", storage="pantry"
- "lentils", "rice", "pasta", "flour", "sugar", "coffee" → category="dry_goods", storage="pantry"
- "canned tomatoes", "baked beans", "soups" → category="canned", storage="pantry"
- "frozen peas", "frozen mixed veg", "ice cream" → category="frozen", storage="freezer"
- "instant coffee", "tea", "soft drinks" → category="beverage"
- "plastic bags", "detergent", "cleaning wipes" → category="household"

If item_raw contains “CHICKEN BREAST” in any format:
- item_norm must be "Chicken Breast"
- category must be "protein_raw"
- storage must be "fridge"

2. Expiry dates
- If an explicit expiry / best-before date is present in the text for an item, copy it exactly.
- Otherwise ESTIMATE expiry_date from purchase_date using these rules:
  - protein_raw         → purchase_date + 2 days
  - dairy               → purchase_date + 5 days
  - produce             → purchase_date + 4 days
  - bakery              → purchase_date + 2 days
  - frozen              → purchase_date + 30 days
  - dry_goods  → purchase_date + 180 days
- canned     → purchase_date + 365 days
- beverage   → purchase_date + 365 days
- household  → purchase_date + 365 days
- other      → purchase_date + 30 days

VERY IMPORTANT:
- For protein_raw, dairy, produce, bakery and frozen you MUST NOT return null.
  Always estimate an expiry_date using the rules above.

3. Unknown items
- Use best guess based on item_raw, but still apply the expiry rules according to the chosen category.

4. Output
- Always include purchase_date exactly as provided in the input for each item.
- Output VALID JSON ONLY. No extra text, comments or explanations.
"""


RECIPE_PROMPT = """
You are a cooking assistant helping a New Zealand household reduce food waste.

Your job:
Given a list of grocery items with expiry dates and categories,
suggest simple recipes that use items CLOSE TO EXPIRY first.

Respond with JSON ONLY in this format:

[
  {
    "title": "short recipe name",
    "priority": "high|medium|low",             // high = uses items expiring soon
    "items_used": [
      {"name": "Chicken Breast", "qty": 1, "unit": "ea"},
      {"name": "Broccoli", "qty": 0.5, "unit": "head"}
    ],
    "instructions": [
      "Step 1 ...",
      "Step 2 ...",
      "Step 3 ..."
    ],
    "time_minutes": 15,
    "reason": "Explain briefly why this recipe is good for reducing waste."
  }
]

--------------------
IMPORTANT:
--------------------
- Focus on HIGH PRIORITY ingredients: items with earliest expiry_date or no date but perishable categories (protein_raw, dairy, produce).
- Keep recipes SIMPLE: 3–6 steps, common home cooking methods (stir-fry, bake, salad, soup, pasta).
- Assume a typical NZ household kitchen (stovetop, oven, microwave, basic seasonings).
- It is OK to assume a few basic pantry items (oil, salt, pepper, garlic, onion, dried herbs).
- DO NOT invent new ingredients that are not obviously pantry staples.
- Prefer recipes that can use multiple near-expiry ingredients together.
- Avoid unsafe advice (no undercooked chicken, no raw mince, etc.).
- Output JSON ONLY. No extra commentary.
"""

def call_ollama_json(model: str, prompt: str) -> Any:
    r = requests.post(
        "http://127.0.0.1:11434/api/generate",
        json={
            "model": model,
            "prompt": prompt,
            "stream": False,
            "format": "json",
            "options": {
                "temperature": 0,
                "num_predict": 2048,
                "num_ctx": 4096
            }
        },
        timeout=300
    )
    r.raise_for_status()
    return json.loads(r.json()["response"])

def llm_normalize_items(lines: List[Dict[str, Any]], model: str = "phi3:mini") -> List[Dict[str, Any]]:
    today = datetime.date.today().isoformat()
    payload = [
        {
            "item_raw": it["item_raw"],
            "qty": it.get("qty"),
            "unit": it.get("unit"),
            "unit_price": it.get("unit_price"),
            "line_total": it.get("line_total"),
        }
        for it in lines
    ]
    prompt = f"{LLM_NORMALIZE_PROMPT}\nINPUT_LINES_JSON=\n{json.dumps(payload, ensure_ascii=False)}"
    result = call_ollama_json(model, prompt)

    by_raw = {r.get("item_raw", ""): r for r in result if isinstance(r, dict)}
    normalized: List[Dict[str, Any]] = []
    for it in lines:
        raw_name = it["item_raw"]
        norm = by_raw.get(raw_name, {})

        # Clean food name
        llm_name = norm.get("item_norm")
        clean_name = smart_food_name(raw_name, llm_name)

        # ✅ NEW: infer category + storage from the cleaned name
        llm_cat = norm.get("category")
        llm_storage = norm.get("storage")
        cat, storage = infer_category_and_storage(clean_name, llm_cat, llm_storage)

        normalized.append({
            "item_raw": raw_name,
            "item_norm": clean_name,
            "category": cat,
            "storage": storage,
            "purchase_date": norm.get("purchase_date") or today,
            "expiry_date": norm.get("expiry_date"),
            "confidence": float(norm.get("confidence") or 0.6),
            "reason": norm.get("reason") or "Heuristic default",
        })
    return normalized



def normalize_inline_tokens(raw_text: str) -> str:
    """
    Fix common OCR glitches in grocery receipts so our regex patterns can match.
    - '1Q$2.99EA'  -> '1 @ $2.99 EA'
    - '0.8800$2.79KG' -> '0.8800 KG @ $2.79 KG'
    - '-$2.99' stays '-$2.99' but we ensure a space when needed
    """
    fixed_lines = []
    for line in raw_text.splitlines():
        L = line

        # 1) Misread '@' as 'Q' before a price: 1Q$2.99EA -> 1 @ $2.99EA
        L = re.sub(r"(\d)\s*Q\$", r"\1 @ $", L)

        # 2) Weight + unit price squashed: 0.8800$2.79KG -> 0.8800 KG @ $2.79 KG
        #    This matches typical fruit/veg by weight.
        L = re.sub(
            r"(\d+\.\d{3,4})\s*\$([0-9]{1,4}\.[0-9]{2})KG",
            r"\1 KG @ $\2 KG",
            L
        )

        # 3) Ensure there's a space before '-$' to help our patterns
        L = re.sub(r"-\$", " -$", L)

        fixed_lines.append(L)
    return "\n".join(fixed_lines)

# --------------------------
# Final assembly helper
# --------------------------
PRICE = r"\$?\d{1,4}\.\d{2}"  # $x.xx or x.xx

def _has_price(s: str) -> bool:
    return re.search(PRICE, s) is not None

def _is_namey(s: str) -> bool:
    U = s.strip().upper()
    # must contain letters, not start with price, not be obvious header
    if not re.search(r"[A-Z]", U): return False
    if re.match(rf"^\s*{PRICE}\b", U): return False
    if any(re.search(p, U) for p in HEADER_FOOTER_PATTERNS): return False
    if any(re.search(p, U) for p in NON_ITEM_PATTERNS): return False
    return True

def precombine_lines(raw_text: str) -> str:
    """
    Merge OCR-broken rows like:
      BANANAS KG
      0.8800 KG @ $2.79 KG
      $2.46
    → 'BANANAS KG 0.8800 KG @ $2.79 KG = $2.46'
    """
    lines = [ln.strip() for ln in raw_text.splitlines() if ln.strip()]
    out = []
    i = 0
    while i < len(lines):
        cur = lines[i]
        # If current line already has a price or looks non-item, keep as-is
        if _has_price(cur) or not _is_namey(cur):
            out.append(cur)
            i += 1
            continue

        # Try to merge with up to next two lines if they carry price/@ tokens
        merged = cur
        j = i + 1
        took = 0
        while j < len(lines) and took < 2:
            nxt = lines[j]
            if any(tok in nxt.upper() for tok in ["@", " EA", " KG"]) or _has_price(nxt):
                merged += " " + nxt
                took += 1
                j += 1
            else:
                break

        # If the 3rd line is a naked price, append as '= $x.xx'
        if j < len(lines) and re.fullmatch(rf"{PRICE}", lines[j].replace("$","$").strip()):
            merged += " = " + lines[j]
            j += 1
            took += 1

        out.append(merged if took else cur)
        i = j if took else i + 1

    return "\n".join(out)

def build_response(raw_text: str, model: str = "phi3:mini") -> Dict[str, Any]:

    raw_text = normalize_inline_tokens(raw_text)  # << NEW
    raw_text = precombine_lines(raw_text)         # (already there in your version)
    candidates, ignored = extract_candidates(raw_text)
    normalized = llm_normalize_items(candidates, model=model)

    items: List[Dict[str, Any]] = []
    for base, extra in zip(candidates, normalized):
        unit = base.get("unit") or "unknown"
        qty = base.get("qty")

        # If unit implies count but qty missing, default to 1
        if unit in ("ea", "pack") and (qty is None or qty == 0):
            qty = 1.0

        # Coerce numeric fields
        unit_price = base.get("unit_price")
        line_total = base.get("line_total")
        # 1) start with whatever LLM gave
        expiry_date = extra["expiry_date"]

        # 2) if LLM didn't have explicit date, use rule engine OR simple fallback
        if not expiry_date:
            purchase_str = extra["purchase_date"]
            try:
                purchase_dt = datetime.date.fromisoformat(purchase_str)
            except Exception:
                purchase_dt = datetime.date.today()

            # try your JSON-based rules first
            expiry_date = estimate_expiry_date(
                item_norm=extra["item_norm"],
                storage=extra["storage"],
                purchase_date_str=purchase_str,
            )

            # if still nothing, apply simple category-based defaults
            if not expiry_date:
                cat = extra["category"]
                storage = extra["storage"]

                if cat == "protein_raw":
                    days = 2
                elif cat == "dairy":
                    days = 5
                elif cat == "produce":
                    days = 4
                elif cat == "bakery":
                    days = 2
                elif cat == "frozen":
                    days = 30
                elif cat in ("dry_goods", "canned", "beverage"):
                    days = 365
                elif cat == "household":
                    days = 365
                else:
                    days = 30  # safe generic fallback

                expiry_dt = purchase_dt + datetime.timedelta(days=days)
                expiry_date = expiry_dt.isoformat()

        items.append({
            "item_raw": base["item_raw"],
            "item_norm": extra["item_norm"],
            "category": extra["category"],
            "storage": extra["storage"],
            "qty": qty if qty is None else (round(qty, 3) if unit == "kg" else qty),
            "unit": unit,
            "unit_price": unit_price,
            "line_total": line_total,
            "purchase_date": extra["purchase_date"],
            "expiry_date": expiry_date,
            "confidence": extra["confidence"],
            "reason": extra["reason"],
        })

    estimated_total = round(sum(i["line_total"] for i in items if isinstance(i.get("line_total"), (int, float))), 2) if items else None

    return {
        "currency": "NZD",
        "items": items,
        "estimated_total": estimated_total,
        "ignored_lines": ignored
    }


def suggest_recipes_from_items(items: List[Dict[str, Any]], model: str = "phi3:mini") -> Any:
    """
    Take parsed items (with expiry_date, category, storage) and ask the LLM
    for recipe suggestions. Items closer to expiry are marked explicitly.
    """
    today = datetime.date.today()

    payload = []
    for it in items:
        expiry_str = it.get("expiry_date")
        days_left: int | None = None
        if expiry_str:
            try:
                d = datetime.date.fromisoformat(expiry_str)
                days_left = (d - today).days
            except Exception:
                days_left = None

        payload.append({
            "name": it.get("item_norm") or it.get("item_raw"),
            "category": it.get("category"),
            "storage": it.get("storage"),
            "qty": it.get("qty"),
            "unit": it.get("unit"),
            "expiry_date": expiry_str,
            "days_left": days_left,
        })

    prompt = f"{RECIPE_PROMPT}\n\nITEMS_JSON=\n{json.dumps(payload, ensure_ascii=False)}"
    result = call_ollama_json(model, prompt)

    # result should already be a JSON list; just return as-is
    return result


BRAND_TOKENS = {
    "PAMS", "PAM", "CAMPBELLS", "EXOTIC", "JEDS",
    "PAMSTONATO", "PAMS", "PAM'S"
}

def smart_food_name(raw_name: str, llm_name: str | None = None) -> str:
    """
    Take item_raw and item_norm from the LLM and try to produce a clean food name.
    Examples:
      "OperatorSunitaLane19 PANSLENTILS500GSPL" -> "Lentils"
      "BREADSPECIALTY400G"                     -> "Bread"
      "JEDSCOFFEEC0.200G4"                     -> "Coffee"
      "PUMPKINBUTTERNUTEA"                     -> "Butternut Pumpkin"
    """
    # Prefer LLM suggestion if it already looks clean
    if llm_name:
        n = llm_name.strip()
        # if it already looks like 1–3 words without crazy digits, accept it
        if not any(c.isdigit() for c in n) and len(n.split()) <= 4:
            return n

    # Fallback: work from raw_name
    s = raw_name.upper()

    # Replace digits with spaces to break codes like 500G, 0.200G4 etc.
    s = re.sub(r"\d+", " ", s)

    # Break up weird glued words a bit (VERY rough)
    s = s.replace("BUTTERNUT", "BUTTERNUT ").replace("PUMPKIN", "PUMPKIN ")

    # Remove obvious non-product words
    for bad in ["OPERATOR", "LANE", "SUNITA"]:
        s = s.replace(bad, " ")

    # Remove brand tokens
    for brand in BRAND_TOKENS:
        s = re.sub(rf"\b{brand}\b", " ", s)

    # Remove EA, SPL etc.
    s = re.sub(r"\b(SPL|EA|PKT|PK|KG|G|ML|L)\b", " ", s)

    # Collapse whitespace
    tokens = [t for t in s.split() if t]

    if not tokens:
        return raw_name  # give up

    # special case: BUTTERNUT + PUMPKIN
    if "BUTTERNUT" in tokens and "PUMPKIN" in tokens:
        return "Butternut Pumpkin"

    # pick the last 1–2 tokens as the food name
    main_tokens = tokens[-2:] if len(tokens) >= 2 else tokens
    name = " ".join(main_tokens).title()

    # Tiny cleanups
    # e.g. "Bananas Kg" -> "Bananas"
    name = re.sub(r"\b(Kg|G|Ml|L)\b", "", name).strip()

    return name or raw_name

# Put near the top of receipt.py
FOOD_KEYWORDS = [
    ("LENTIL", "Lentils"),
    ("BREAD", "Bread"),
    ("COFFEE", "Coffee"),
    ("PUMPKIN", "Butternut Pumpkin"),
    ("STOCK", "Stock"),
    ("TOMATO", "Tomato"),
    ("SAUCE", "Sauce"),
    ("BANANAS", "Bananas"),
    ("BANANA", "Bananas"),
    ("CUBE", "Stock Cubes"),
]

def smart_food_name(raw_name: str, llm_name: str | None = None) -> str:
    """
    Turn ugly receipt codes into human food names using simple rules.
    Examples:
      "PANSLENTILS500GSPL"      -> "Lentils"
      "BREADSPECIALTY4006"      -> "Bread"
      "OX0-CUBE12SVEGETABL"     -> "Stock Cubes"
      "JEDSCOFFEEC0.200G4"      -> "Coffee"
      "PUMPKINBUTTERNUTEA"      -> "Butternut Pumpkin"
    """

    # 1) Try keyword matches on the RAW string
    U = raw_name.upper()

    for key, pretty in FOOD_KEYWORDS:
        if key in U:
            return pretty

    # 2) If LLM already gave a nice simple name, keep it
    if llm_name:
        n = llm_name.strip()
        # accept if it has no digits and is not obviously code-ish
        if n and not any(c.isdigit() for c in n) and len(n.split()) <= 4:
            return n

    # 3) Fallback: strip digits/units/garbage from the raw string
    s = re.sub(r"\d+", " ", U)                      # remove numbers
    s = re.sub(r"(EA|KG|G|ML|L|PKT|PK|SPL)", " ", s) # remove units/codes
    s = re.sub(r"OPERATOR|LANE|SUNITA", " ", s)      # remove obvious non-food
    tokens = [t for t in s.split() if t]

    if not tokens:
        return raw_name

    # use last 1–2 tokens as the food name
    main = tokens[-2:] if len(tokens) >= 2 else tokens
    name = " ".join(main).title()
    return name or raw_name


# Put near FOOD_KEYWORDS / smart_food_name
def infer_category_and_storage(item_norm: str, current_category: str | None, current_storage: str | None):
    """
    Infer a sensible category + storage from the cleaned food name.
    Falls back to existing values if no match.
    """
    name = (item_norm or "").lower()
    cat = (current_category or "other")
    storage = (current_storage or "pantry")

    # Meat
    if any(w in name for w in ["chicken", "beef", "pork", "sausage", "mince", "lamb"]):
        return "protein_raw", "fridge"

    # Dairy
    if any(w in name for w in ["milk", "yoghurt", "yogurt", "cheese", "cream", "butter"]):
        return "dairy", "fridge"

    # Produce
    if any(w in name for w in ["banana", "bananas", "apple", "carrot", "lettuce", "pumpkin", "broccoli", "spinach"]):
        return "produce", "fridge"

    # Bakery
    if any(w in name for w in ["bread", "bun", "buns", "roll", "wrap"]):
        return "bakery", "pantry"

    # Dry goods (lentils, rice, pasta, coffee, stock etc.)
    if any(w in name for w in ["lentil", "lentils", "rice", "pasta", "flour", "sugar", "coffee", "stock", "cubes"]):
        return "dry_goods", "pantry"

    # Canned
    if any(w in name for w in ["canned", "baked beans", "tinned", "tomato", "soup"]):
        return "canned", "pantry"

    # Frozen
    if any(w in name for w in ["frozen", "ice cream", "icecream", "frozen veg"]):
        return "frozen", "freezer"

    # Household
    if any(w in name for w in ["bag", "bags", "detergent", "wipes", "cleaner"]):
        return "household", storage

    return cat, storage


# --------------------------
# OCR + endpoints
# --------------------------

@router.post("/ocr")
async def ocr_receipt(file: UploadFile = File(...), model: str = "phi3:mini"):
    # Save upload to a temp file
    with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as tmp:
        tmp.write(await file.read())
        tmp.flush()
        image_path = tmp.name

    # Path to ai-fridge/ocr/pipeline/extract.py
    PROJECT_ROOT = Path(__file__).resolve().parents[3]  # .../ai-fridge
    script = PROJECT_ROOT / "ocr" / "pipeline" / "extract.py"
    if not script.exists():
        raise HTTPException(status_code=500, detail=f"OCR script not found at {script}")

    try:
        out = subprocess.check_output([sys.executable, str(script), image_path], text=True)
        ocr_obj = json.loads(out)
        raw_text = ocr_obj["raw_text"]

        print("DEBUG RAW OCR =====================")
        print(raw_text)
        print("====================================")

        if not raw_text:
            raise ValueError("OCR output missing 'raw_text' or 'raw_lines'.")

        parsed = build_response(raw_text, model=model)
        return {"ok": True, "parsed": parsed}

    except subprocess.CalledProcessError as e:
        raise HTTPException(status_code=500, detail=f"OCR script error: {e.output}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/ocr/raw")
async def ocr_raw_receipt(file: UploadFile = File(...)):
    with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as tmp:
        tmp.write(await file.read())
        tmp.flush()
        image_path = tmp.name

    # Path to ai-fridge/ocr/pipeline/extract.py
    PROJECT_ROOT = Path(__file__).resolve().parents[3]  # .../ai-fridge
    script = PROJECT_ROOT / "ocr" / "pipeline" / "extract.py"
    if not script.exists():
        raise HTTPException(status_code=500, detail=f"OCR script not found at {script}")

    try:
        out = subprocess.check_output([sys.executable, str(script), image_path], text=True)
        ocr_obj = json.loads(out)
        raw_text = ocr_obj["raw_text"]

        print("DEBUG RAW OCR =====================")
        print(raw_text)
        print("====================================")

        if not raw_text:
            raise ValueError("OCR output missing 'raw_text' or 'raw_lines'.")

        return {"ok": True, "raw_text": raw_text}

    except subprocess.CalledProcessError as e:
        raise HTTPException(status_code=500, detail=f"OCR script error: {e.output}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/list")
async def list_item(body: OCRBody, model: str = "phi3:mini"):
    """Send arbitrary OCR text directly; always returns a single JSON object with items[]."""
    parsed = build_response(body.text, model=model)
    return {"ok": True, "parsed": parsed}


class RecipeBody(BaseModel):
    items: List[Dict[str, Any]]

@router.post("/recipes")
async def generate_recipes(body: RecipeBody, model: str = "phi3:mini"):
    """
    Accepts a list of parsed items (the same structure returned by /receipt/ocr)
    and returns AI-generated recipe suggestions.
    """
    try:
        recipes = suggest_recipes_from_items(body.items, model=model)
        return {"ok": True, "recipes": recipes}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ocr/clean")
async def ocr_clean_receipt(file: UploadFile = File(...)):
    with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as tmp:
        tmp.write(await file.read())
        tmp.flush()
        image_path = tmp.name

    PROJECT_ROOT = Path(__file__).resolve().parents[3]
    script = PROJECT_ROOT / "ocr" / "pipeline" / "extract.py"
    if not script.exists():
        raise HTTPException(status_code=500, detail=f"OCR script not found at {script}")

    try:
        out = subprocess.check_output([sys.executable, str(script), image_path], text=True)
        ocr_obj = json.loads(out)
        raw_text = ocr_obj["raw_text"]

        if not raw_text:
            raise ValueError("OCR output missing 'raw_text'.")

        cleaned_lines = clean_ocr_text(raw_text)

        return {
            "ok": True,
            "raw_text": raw_text,
            "clean_lines": cleaned_lines,
        }

    except subprocess.CalledProcessError as e:
        raise HTTPException(status_code=500, detail=f"OCR script error: {e.output}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))