"""
Waves 11-20 — Productization API Routes
Universe management, profiles, backup/restore, runbooks, release info.
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
import logging

from ...waves11_20.productization import (
    get_productization_service, SymbolEntry, BackupType,
)

router = APIRouter(prefix="/api/v2/productization", tags=["productization-v2"])
logger = logging.getLogger(__name__)


class AddSymbolRequest(BaseModel):
    symbol: str
    name: str
    sector: str
    market_cap_b: float
    avg_volume: int


class ToggleSymbolRequest(BaseModel):
    symbol: str
    enabled: bool


class CreateProfileRequest(BaseModel):
    name: str
    settings: dict


class CreateBackupRequest(BaseModel):
    backup_type: str = "full"


# --- Universe ---
@router.get("/universe")
async def get_universe(enabled_only: bool = Query(default=True)):
    """Get the symbol universe."""
    svc = get_productization_service()
    universe = svc.get_universe(enabled_only=enabled_only)
    return {"universe": [s.to_dict() for s in universe], "count": len(universe)}


@router.get("/universe/symbols")
async def get_symbols():
    """Get just the symbol tickers."""
    svc = get_productization_service()
    return {"symbols": svc.get_symbols()}


@router.get("/universe/stats")
async def universe_stats():
    """Get universe statistics."""
    svc = get_productization_service()
    return svc.get_universe_stats()


@router.post("/universe/add")
async def add_symbol(req: AddSymbolRequest):
    """Add a symbol to the universe."""
    svc = get_productization_service()
    entry = SymbolEntry(
        symbol=req.symbol, name=req.name, sector=req.sector,
        market_cap_b=req.market_cap_b, avg_volume=req.avg_volume,
    )
    ok = svc.add_symbol(entry)
    if not ok:
        raise HTTPException(status_code=409, detail=f"{req.symbol} already in universe")
    return {"ok": True, "symbol": req.symbol}


@router.post("/universe/remove/{symbol}")
async def remove_symbol(symbol: str):
    """Remove a symbol from the universe."""
    svc = get_productization_service()
    ok = svc.remove_symbol(symbol)
    if not ok:
        raise HTTPException(status_code=404, detail=f"{symbol} not found")
    return {"ok": True, "symbol": symbol}


@router.post("/universe/toggle")
async def toggle_symbol(req: ToggleSymbolRequest):
    """Enable or disable a symbol."""
    svc = get_productization_service()
    ok = svc.toggle_symbol(req.symbol, req.enabled)
    if not ok:
        raise HTTPException(status_code=404, detail=f"{req.symbol} not found")
    return {"ok": True, "symbol": req.symbol, "enabled": req.enabled}


# --- Profiles ---
@router.get("/profiles")
async def list_profiles():
    """List configuration profiles."""
    svc = get_productization_service()
    profiles = svc.list_profiles()
    return {"profiles": [p.to_dict() for p in profiles]}


@router.post("/profiles/activate/{profile_id}")
async def activate_profile(profile_id: str):
    """Activate a configuration profile."""
    svc = get_productization_service()
    ok = svc.activate_profile(profile_id)
    if not ok:
        raise HTTPException(status_code=404, detail=f"Profile {profile_id} not found")
    return {"ok": True, "profile_id": profile_id}


@router.get("/profiles/active")
async def get_active_profile():
    """Get the currently active profile."""
    svc = get_productization_service()
    profile = svc.get_active_profile()
    if not profile:
        return {"active": False}
    return {"active": True, "profile": profile.to_dict()}


@router.post("/profiles/custom")
async def create_custom_profile(req: CreateProfileRequest):
    """Create a custom configuration profile."""
    svc = get_productization_service()
    profile = svc.create_custom_profile(req.name, req.settings)
    return profile.to_dict()


# --- Backup ---
@router.post("/backup")
async def create_backup(req: CreateBackupRequest):
    """Create a backup."""
    svc = get_productization_service()
    try:
        bt = BackupType(req.backup_type)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid backup type: {req.backup_type}")

    manifest = svc.create_backup(bt)
    return manifest.to_dict()


@router.get("/backups")
async def list_backups():
    """List all backups."""
    svc = get_productization_service()
    backups = svc.list_backups()
    return {"backups": [b.to_dict() for b in backups]}


# --- Runbooks ---
@router.get("/runbooks")
async def list_runbooks(category: Optional[str] = Query(default=None)):
    """List operational runbooks."""
    svc = get_productization_service()
    runbooks = svc.get_runbooks(category=category)
    return {"runbooks": [r.to_dict() for r in runbooks]}


@router.get("/runbooks/{runbook_id}")
async def get_runbook(runbook_id: str):
    """Get a specific runbook."""
    svc = get_productization_service()
    runbook = svc.get_runbook(runbook_id)
    if not runbook:
        raise HTTPException(status_code=404, detail=f"Runbook {runbook_id} not found")
    return runbook.to_dict()


# --- Release Info ---
@router.get("/release")
async def release_info():
    """Get release information."""
    svc = get_productization_service()
    return svc.get_release_info()
