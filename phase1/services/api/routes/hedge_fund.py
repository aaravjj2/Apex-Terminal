"""Wave 10 — Hedge Fund Mode: institutional allocation model with firm-level AUM breakdown."""
import hashlib, json
from fastapi import APIRouter

router = APIRouter(prefix="/api/v1/hedge-fund", tags=["hedge-fund"])

DEMO_ALLOCATIONS: list = [
    {"bucket": "Long Equity",       "strategy": "momentum",       "aum_pct": 0.28, "aum_usd_m": 280, "sharpe_ytd": 1.34, "beta": 0.89, "gross_exposure": 1.12},
    {"bucket": "Long/Short Equity", "strategy": "stat_arb",       "aum_pct": 0.22, "aum_usd_m": 220, "sharpe_ytd": 1.87, "beta": 0.12, "gross_exposure": 1.94},
    {"bucket": "Global Macro",      "strategy": "macro_trend",    "aum_pct": 0.18, "aum_usd_m": 180, "sharpe_ytd": 0.98, "beta": 0.21, "gross_exposure": 0.85},
    {"bucket": "Fixed Income Arb",  "strategy": "rate_arb",       "aum_pct": 0.15, "aum_usd_m": 150, "sharpe_ytd": 1.21, "beta": 0.04, "gross_exposure": 3.20},
    {"bucket": "Event Driven",      "strategy": "merger_arb",     "aum_pct": 0.12, "aum_usd_m": 120, "sharpe_ytd": 1.09, "beta": 0.33, "gross_exposure": 1.40},
    {"bucket": "Cash / Reserve",    "strategy": "t_bill",         "aum_pct": 0.05, "aum_usd_m": 50,  "sharpe_ytd": 0.51, "beta": 0.00, "gross_exposure": 0.00},
]

DEMO_SUMMARY: dict = {
    "fund_name": "Apex Capital Fund I",
    "total_aum_usd_m": 1000,
    "nav_per_share": 1842.50,
    "ytd_return": 0.147,
    "inception_return": 0.412,
    "sharpe_inception": 1.38,
    "max_drawdown": -0.089,
    "buckets": len(DEMO_ALLOCATIONS),
    "allocations": DEMO_ALLOCATIONS,
}

def _hash():
    return hashlib.sha256(json.dumps(DEMO_SUMMARY, sort_keys=True, separators=(",", ":")).encode()).hexdigest()

DEMO_HASH = _hash()

@router.get("/summary")
async def get_summary():
    return {**DEMO_SUMMARY, "hash": DEMO_HASH}

@router.get("/allocations")
async def list_allocations():
    return {"allocations": DEMO_ALLOCATIONS, "count": len(DEMO_ALLOCATIONS), "hash": DEMO_HASH}

@router.get("/hash")
async def get_hash():
    return {"hash": DEMO_HASH}
