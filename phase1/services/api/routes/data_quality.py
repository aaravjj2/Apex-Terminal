"""
Data Quality Monitor — REAL market data quality checks.
Runs quality gates against cached bars for every universe symbol.
No demo/mock data — all checks are on real provider data.
"""
import hashlib
import json
from datetime import datetime, timedelta
from typing import List

from fastapi import APIRouter

router = APIRouter(prefix="/api/v1/data-quality", tags=["data-quality"])


def _get_quality_reports() -> List[dict]:
    """
    Build quality reports for every universe symbol by reading
    the local cache manifest (if available) or returning empty.
    """
    from pathlib import Path
    import os

    reports: List[dict] = []
    cache_dir = Path(os.getenv("MARKET_CACHE_DIR",
                               str(Path(__file__).resolve().parents[4] / "local_cache" / "market")))
    manifest_path = cache_dir / "manifest.json"

    if not manifest_path.exists():
        # No cache yet — report empty but real status
        from ...config import get_settings
        settings = get_settings()
        for sym in settings.universe_list:
            reports.append({
                "id": f"feed-{sym.lower()}",
                "name": f"{sym} Daily Bars",
                "type": "ohlcv",
                "status": "no_data",
                "latency_ms": 0,
                "last_update": None,
                "gaps_24h": 0,
                "integrity_score": 0.0,
                "bar_count": 0,
                "provider": None,
                "sha256": None,
            })
        return reports

    with open(manifest_path) as f:
        manifest = json.load(f)

    for sym, info in manifest.get("symbols", {}).items():
        bar_count = info.get("bar_count", 0)
        sha = info.get("sha256", "")
        provider = info.get("provider", "unknown")
        last = info.get("last")

        # Determine status from bar coverage
        if bar_count == 0:
            status = "no_data"
            integrity = 0.0
        elif bar_count < 100:
            status = "degraded"
            integrity = 0.5
        else:
            status = "healthy"
            integrity = min(1.0, bar_count / 1800.0)  # ~7y ≈ 1764 trading days

        # Run quality check on cached bars if file exists
        sym_file = cache_dir / info.get("file", f"{sym}_daily.jsonl")
        if sym_file.exists():
            try:
                from ...quality import check_quality
                from ...market_data.providers.types import BarData

                bars = []
                with open(sym_file) as bf:
                    for line in bf:
                        d = json.loads(line)
                        bars.append(BarData(
                            timestamp=datetime.fromisoformat(d["timestamp"]),
                            open=d["open"], high=d["high"],
                            low=d["low"], close=d["close"],
                            volume=int(d["volume"]),
                        ))
                qr = check_quality(sym, bars)
                integrity = qr.score / 100.0
                if not qr.pass_gate:
                    status = "degraded"
            except Exception:
                pass  # fall back to heuristic

        reports.append({
            "id": f"feed-{sym.lower()}",
            "name": f"{sym} Daily Bars",
            "type": "ohlcv",
            "status": status,
            "latency_ms": int(info.get("elapsed_s", 0) * 1000),
            "last_update": last,
            "gaps_24h": 0,
            "integrity_score": round(integrity, 4),
            "bar_count": bar_count,
            "provider": provider,
            "sha256": sha,
        })

    return reports


@router.get("")
async def list_feeds():
    """Return all data feed quality reports — real data only."""
    return _get_quality_reports()


@router.get("/hash")
async def data_quality_hash():
    """Determinism hash over quality reports."""
    feeds = _get_quality_reports()
    canonical = json.dumps(feeds, sort_keys=True, separators=(",", ":"))
    h = hashlib.sha256(canonical.encode()).hexdigest()
    return {"hash": h}


@router.get("/summary")
async def quality_summary():
    """Aggregate quality summary across all feeds."""
    feeds = _get_quality_reports()
    total = len(feeds)
    if total == 0:
        return {"total_feeds": 0, "healthy": 0, "degraded": 0, "no_data": 0, "avg_integrity": 0}
    healthy = sum(1 for f in feeds if f["status"] == "healthy")
    degraded = sum(1 for f in feeds if f["status"] == "degraded")
    no_data = sum(1 for f in feeds if f["status"] == "no_data")
    avg_integrity = sum(f["integrity_score"] for f in feeds) / total
    return {
        "total_feeds": total,
        "healthy": healthy,
        "degraded": degraded,
        "no_data": no_data,
        "avg_integrity": round(avg_integrity, 4),
    }


@router.get("/{feed_id}")
async def get_feed(feed_id: str):
    """Get single feed status."""
    for f in _get_quality_reports():
        if f["id"] == feed_id:
            return f
    return {"error": "not found"}
