"""
Health Check Router

Exposes system health endpoints.
"""

from fastapi import APIRouter
from ..monitoring.health import get_health_monitor

router = APIRouter(prefix="/health", tags=["health"])


@router.get("")
async def health_check():
    """Quick health check endpoint."""
    monitor = get_health_monitor()
    results = await monitor.check_all()
    return results


@router.get("/last")
async def last_health_check():
    """Get results from last health check."""
    monitor = get_health_monitor()
    return monitor.get_last_results()
