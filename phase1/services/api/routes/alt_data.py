"""Wave 8 — Alternative Data Catalog: datasets, ingestion status, search."""
import hashlib, json
from fastapi import APIRouter, Query

router = APIRouter(prefix="/api/v1/alt-data", tags=["alt-data"])

DEMO_CATALOG: list = [
    {"id": "ad-001", "name": "Satellite Imagery — Retail Parking",  "vendor": "SpaceView",  "category": "satellite",    "frequency": "daily",   "coverage": "US",     "lag_days": 1, "price_tier": "premium", "active": True},
    {"id": "ad-002", "name": "Credit Card Spend Aggregates",        "vendor": "CardSense",  "category": "consumer",     "frequency": "weekly",  "coverage": "US",     "lag_days": 5, "price_tier": "standard","active": True},
    {"id": "ad-003", "name": "Job Postings Index",                  "vendor": "TalentFlow", "category": "labor",        "frequency": "weekly",  "coverage": "Global", "lag_days": 2, "price_tier": "free",    "active": True},
    {"id": "ad-004", "name": "Supply Chain Shipping Rates",         "vendor": "FreightIQ",  "category": "logistics",    "frequency": "daily",   "coverage": "Global", "lag_days": 1, "price_tier": "premium", "active": True},
    {"id": "ad-005", "name": "Social Media Sentiment (Twitter/X)",  "vendor": "PulseAI",    "category": "sentiment",    "frequency": "hourly",  "coverage": "Global", "lag_days": 0, "price_tier": "standard","active": True},
    {"id": "ad-006", "name": "Patent Filings Database",             "vendor": "IPTrack",    "category": "innovation",   "frequency": "monthly", "coverage": "US+EU",  "lag_days": 30,"price_tier": "free",    "active": False},
    {"id": "ad-007", "name": "Web Traffic by Domain",               "vendor": "NetScope",   "category": "web",          "frequency": "weekly",  "coverage": "Global", "lag_days": 7, "price_tier": "standard","active": True},
    {"id": "ad-008", "name": "Dark Pool Flow Summary",              "vendor": "DarkFlow",   "category": "market",       "frequency": "daily",   "coverage": "US",     "lag_days": 1, "price_tier": "premium", "active": True},
]

def _hash():
    return hashlib.sha256(json.dumps(DEMO_CATALOG, sort_keys=True, separators=(",", ":")).encode()).hexdigest()

DEMO_HASH = _hash()

@router.get("/catalog")
async def list_catalog(category: str | None = Query(None), active_only: bool = False):
    items = DEMO_CATALOG
    if category:
        items = [i for i in items if i["category"] == category]
    if active_only:
        items = [i for i in items if i["active"]]
    return {"datasets": items, "count": len(items), "hash": DEMO_HASH}

@router.get("/hash")
async def get_hash():
    return {"hash": DEMO_HASH}

@router.get("/catalog/{dataset_id}")
async def get_dataset(dataset_id: str):
    ds = next((d for d in DEMO_CATALOG if d["id"] == dataset_id), None)
    if ds is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Dataset not found")
    return ds
