"""
Health Check and Monitoring Module

Provides comprehensive health checks for all system components.
"""

from datetime import datetime
from typing import Dict, Any, Optional
import asyncio
import logging
from sqlalchemy import text

logger = logging.getLogger(__name__)


class HealthMonitor:
    """Centralized health monitoring for all system components."""
    
    def __init__(self):
        self._last_checks: Dict[str, Dict[str, Any]] = {}
        self._check_interval = 60  # seconds
        self._monitoring_task: Optional[asyncio.Task] = None
    
    async def check_all(self) -> Dict[str, Any]:
        """Run all health checks and return results."""
        checks = await asyncio.gather(
            self._check_alpaca(),
            self._check_websocket(),
            self._check_database(),
            self._check_news_providers(),
            self._check_autopilot(),
            return_exceptions=True
        )
        
        results = {
            "timestamp": datetime.utcnow().isoformat(),
            "overall_status": "healthy",
            "components": {
                "alpaca": checks[0] if not isinstance(checks[0], Exception) else {"status": "error", "error": str(checks[0])},
                "websocket": checks[1] if not isinstance(checks[1], Exception) else {"status": "error", "error": str(checks[1])},
                "database": checks[2] if not isinstance(checks[2], Exception) else {"status": "error", "error": str(checks[2])},
                "news_providers": checks[3] if not isinstance(checks[3], Exception) else {"status": "error", "error": str(checks[3])},
                "autopilot": checks[4] if not isinstance(checks[4], Exception) else {"status": "error", "error": str(checks[4])},
            }
        }
        
        # Determine overall status
        component_statuses = [comp.get("status") for comp in results["components"].values()]
        if any(s == "error" for s in component_statuses):
            results["overall_status"] = "degraded"
        if all(s == "error" for s in component_statuses):
            results["overall_status"] = "down"
        
        self._last_checks = results
        return results
    
    async def _check_alpaca(self) -> Dict[str, Any]:
        """Check Alpaca connectivity and latency."""
        try:
            from ..autopilot.alpaca_client import get_alpaca_client
            
            start = datetime.utcnow()
            client = get_alpaca_client()
            account = await client.get_account()
            latency_ms = (datetime.utcnow() - start).total_seconds() * 1000
            
            return {
                "status": "healthy",
                "latency_ms": round(latency_ms, 2),
                "account_status": account.status,
                "trading_blocked": account.trading_blocked,
            }
        except Exception as e:
            logger.error(f"Alpaca health check failed: {e}")
            return {
                "status": "error",
                "error": str(e),
            }
    
    async def _check_websocket(self) -> Dict[str, Any]:
        """Check WebSocket manager status."""
        try:
            from ..api.websocket import get_manager
            
            ws_manager = get_manager()
            active_connections = len(ws_manager._connections)
            
            return {
                "status": "healthy" if active_connections >= 0 else "degraded",
                "active_connections": active_connections,
                "subscriptions": sum(len(subs) for subs in ws_manager._subscriptions.values()),
            }
        except Exception as e:
            logger.error(f"WebSocket health check failed: {e}")
            return {
                "status": "error",
                "error": str(e),
            }
    
    async def _check_database(self) -> Dict[str, Any]:
        """Check database connectivity."""
        try:
            from ..persistence import get_database

            db = get_database()
            async with db.engine.begin() as conn:
                await conn.execute(text("SELECT 1"))
            
            return {
                "status": "healthy",
            }
        except Exception as e:
            logger.error(f"Database health check failed: {e}")
            return {
                "status": "error",
                "error": str(e),
            }
    
    async def _check_news_providers(self) -> Dict[str, Any]:
        """Check news provider status."""
        try:
            from ..autopilot.news_provider import get_news_provider
            
            provider = get_news_provider()
            # Providers don't have a standard health check, so just verify it exists
            
            return {
                "status": "healthy",
                "provider": provider.__class__.__name__,
            }
        except Exception as e:
            logger.error(f"News provider health check failed: {e}")
            return {
                "status": "error",
                "error": str(e),
            }
    
    async def _check_autopilot(self) -> Dict[str, Any]:
        """Check autopilot engine status."""
        try:
            from ..autopilot.unified_engine import get_unified_engine
            
            engine = get_unified_engine()
            
            return {
                "status": "healthy",
                "is_running": engine.is_running,
                "kill_switch_active": engine.kill_switch_active,
                "cycle_count": engine._cycle_counter,
                "last_run": engine.last_run.run_id if engine.last_run else None,
            }
        except Exception as e:
            logger.error(f"Autopilot health check failed: {e}")
            return {
                "status": "error",
                "error": str(e),
            }
    
    async def start_monitoring(self):
        """Start background health monitoring."""
        if self._monitoring_task:
            logger.warning("Health monitoring already running")
            return
        
        async def monitor_loop():
            while True:
                try:
                    results = await self.check_all()
                    
                    # Log degraded components
                    for name, component in results["components"].items():
                        if component.get("status") != "healthy":
                            logger.warning(f"Component {name} is {component.get('status')}: {component.get('error', 'N/A')}")
                    
                except Exception as e:
                    logger.error(f"Health monitoring error: {e}")
                
                await asyncio.sleep(self._check_interval)
        
        self._monitoring_task = asyncio.create_task(monitor_loop())
        logger.info("Health monitoring started")
    
    async def stop_monitoring(self):
        """Stop background health monitoring."""
        if self._monitoring_task:
            self._monitoring_task.cancel()
            try:
                await self._monitoring_task
            except asyncio.CancelledError:
                pass
            self._monitoring_task = None
            logger.info("Health monitoring stopped")
    
    def get_last_results(self) -> Dict[str, Any]:
        """Get results from last health check."""
        return self._last_checks if self._last_checks else {"error": "No health checks run yet"}


# Singleton instance
_health_monitor: Optional[HealthMonitor] = None


def get_health_monitor() -> HealthMonitor:
    """Get or create the global health monitor instance."""
    global _health_monitor
    if _health_monitor is None:
        _health_monitor = HealthMonitor()
    return _health_monitor
