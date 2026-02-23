"""
Provider Registry — REAL provider status from the ProviderRouter.
No demo/mock providers. All status reflects actual key availability.
"""
import hashlib
import json
from typing import List, Optional
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1/provider-registry", tags=["provider-registry"])


class ProviderCapability(BaseModel):
    name: str
    mode: str   # "live" only — no demo/mock
    enabled: bool
    subsystem: str
    replay_status: Optional[str] = None
    metadata: dict = {}


def _get_real_providers() -> List[dict]:
    """Build provider list from ProviderRouter (live providers only)."""
    try:
        from ...market_data.provider_router import get_router
        router_inst = get_router()
        providers = []
        for pinfo in router_inst.list_providers():
            providers.append({
                "name": pinfo.name.value,
                "mode": "live",
                "enabled": pinfo.enabled,
                "subsystem": "market_data",
                "replay_status": None,
                "metadata": {
                    "requires_auth": pinfo.requires_auth,
                    "supports_realtime": pinfo.supports_realtime,
                },
            })
        return providers
    except Exception as e:
        return [{
            "name": "router-error",
            "mode": "error",
            "enabled": False,
            "subsystem": "market_data",
            "metadata": {"error": str(e)},
        }]


def _canonical_json(obj) -> str:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"))


@router.get("/providers")
async def list_providers():
    """Return list of all REAL registered providers."""
    return _get_real_providers()


@router.get("/providers/hash")
async def providers_hash():
    """Return SHA-256 hash of the canonical provider list for determinism proof."""
    providers = _get_real_providers()
    canonical = _canonical_json(providers)
    h = hashlib.sha256(canonical.encode()).hexdigest()
    return {"hash": h, "count": len(providers), "canonical_bytes": len(canonical)}


@router.get("/providers/{subsystem}")
async def providers_by_subsystem(subsystem: str):
    """Return providers filtered by subsystem."""
    return [p for p in _get_real_providers() if p["subsystem"] == subsystem]
