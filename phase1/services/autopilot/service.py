
import asyncio
import logging
from typing import Optional, Dict, TYPE_CHECKING
from datetime import datetime

# Use UnifiedAutopilotEngine instead of legacy runloop
from .unified_engine import get_unified_engine, UnifiedAutopilotEngine
from .config import AutopilotConfig
from .trading_window import (
    check_trading_window,
    TradingGateState,
    TradingWindowStatus,
)

if TYPE_CHECKING:
    from .position_agent import PositionAgent

logger = logging.getLogger(__name__)

class AutopilotService:
    """
    Singleton service to manage the Autopilot lifecycle.
    Now uses UnifiedAutopilotEngine as the ONLY execution path.
    
    Runs two background loops:
    1. Main cycle loop (60s) - full autopilot cycle
    2. Monitoring loop (15s) - continuous exit trigger checking
    """
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(AutopilotService, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
            
        self.engine: Optional[UnifiedAutopilotEngine] = None
        self.is_running = False
        self._loop_task: Optional[asyncio.Task] = None
        self._monitoring_task: Optional[asyncio.Task] = None
        self._initialized = True
        
        # Registry of active agents: symbol -> PositionAgent
        # Initialized here so it's always accessible via API
        self.active_agents: Dict[str, "PositionAgent"] = {}
        
    def initialize(self):
        """Initialize the unified autopilot engine if not already done."""
        if self.engine:
            return

        logger.info("Initializing Autopilot Service (Unified Engine)...")
        
        # Get the singleton unified engine
        self.engine = get_unified_engine()
        logger.info("Unified Autopilot Engine initialized")
            
    async def start_background_loop(self, interval_seconds: int = 60):
        """
        Start the background cycle loop.
        
        CRITICAL: Performs restart-safety check - if starting after trading cutoff,
        immediately flatten all positions.
        """
        from .alpaca_client import get_alpaca_client
        from .trading_window import get_trading_gate
        
        if self.is_running:
            logger.warning("Autopilot loop already running")
            return
            
        self.initialize()
        
        # RESTART SAFETY CHECK: If we're starting after cutoff, flatten immediately
        try:
            client = get_alpaca_client()
            alpaca_clock = await client.get_clock() if client.is_connected else None
            
            gate = get_trading_gate()
            should_flatten, reason = gate.check_restart_safety(alpaca_clock)
            
            if should_flatten:
                logger.warning(f"🚨 RESTART SAFETY: {reason}")
                await self._execute_flatten(alpaca_clock, reason)
        except Exception as e:
            logger.error(f"Error in restart safety check: {e}")
        
        self.is_running = True
        self._loop_task = asyncio.create_task(self._run_loop(interval_seconds))
        logger.info(f"Started Autopilot background loop (interval: {interval_seconds}s)")
    
    async def start_monitoring_loop(self, interval_seconds: int = 15):
        """Start the continuous position monitoring loop."""
        if self._monitoring_task and not self._monitoring_task.done():
            logger.warning("Monitoring loop already running")
            return
        
        self.initialize()
        self._monitoring_task = asyncio.create_task(self._run_monitoring_loop(interval_seconds))
        logger.info(f"Started continuous monitoring loop (interval: {interval_seconds}s)")
        
    async def stop_background_loop(self):
        """Stop both background loops."""
        self.is_running = False
        
        # Stop main loop
        if self._loop_task:
            self._loop_task.cancel()
            try:
                await self._loop_task
            except asyncio.CancelledError:
                pass
            self._loop_task = None
        
        # Stop monitoring loop
        if self._monitoring_task:
            self._monitoring_task.cancel()
            try:
                await self._monitoring_task
            except asyncio.CancelledError:
                pass
            self._monitoring_task = None
            
        logger.info("Stopped all Autopilot background loops")
        
    async def _run_loop(self, interval: int):
        """
        The main background loop using UnifiedAutopilotEngine.
        
        CRITICAL: Enforces trading window (9:30am - 2:15pm ET).
        At/after 2:15pm ET, triggers flatten and stays locked.
        """
        from .alpaca_client import get_alpaca_client
        
        while self.is_running:
            try:
                # Check trading window gate FIRST
                client = get_alpaca_client()
                alpaca_clock = await client.get_clock() if client.is_connected else None
                
                window_status = check_trading_window(alpaca_clock)
                
                # Log current state
                if window_status.state == TradingGateState.TRADING_ALLOWED:
                    logger.debug(f"Trading window OPEN - {window_status.reason}")
                else:
                    logger.info(f"Trading BLOCKED: {window_status.state.value} - {window_status.reason}")
                
                # If flatten is required, do it
                if window_status.trigger_flatten:
                    logger.warning(f"⚠️ FLATTEN triggered by trading window: {window_status.reason}")
                    await self._execute_flatten(alpaca_clock, window_status.reason)
                
                # If trading not allowed, skip the cycle
                if not window_status.allow_trading:
                    await asyncio.sleep(interval)
                    continue
                
                # Normal cycle execution (within trading window)
                if self.engine:
                    from .config import get_autopilot_config
                    config = get_autopilot_config()
                    if not config.continuous_run:
                        await asyncio.sleep(interval)
                        continue
                    logger.info("Running scheduled autopilot cycle (Unified Engine)...")
                    # Use the unified engine's run_cycle method (async)
                    result = await self.engine.run_cycle()
                    logger.debug(f"Cycle result: {result}")
                    
            except Exception as e:
                logger.error(f"Error in autopilot background loop: {e}", exc_info=True)
                
            await asyncio.sleep(interval)
    
    async def _execute_flatten(self, alpaca_clock, reason: str):
        """
        Execute flatten-all: cancel orders, close positions.
        Also stops all position agents.
        """
        from .alpaca_client import get_alpaca_client
        
        logger.warning(f"🔴 Executing FLATTEN ALL: {reason}")
        
        # 1. Stop all position agents first
        for symbol, agent in list(self.active_agents.items()):
            try:
                logger.info(f"Stopping agent for {symbol} due to flatten")
                await agent.stop()
                del self.active_agents[symbol]
            except Exception as e:
                logger.error(f"Error stopping agent {symbol}: {e}")
        
        # 2. Execute flatten via Alpaca client
        client = get_alpaca_client()
        if client.is_connected:
            result = await client.flatten_all(reason)
            logger.warning(f"Flatten result: {result}")
            
            # Broadcast flatten event
            try:
                from ..api.autopilot_websocket import get_autopilot_ws_manager
                ws = get_autopilot_ws_manager()
                await ws.broadcast("FLATTEN_ALL", {
                    "reason": reason,
                    "result": result,
                    "timestamp": datetime.utcnow().isoformat()
                })
            except Exception:
                pass
        else:
            logger.error("Cannot flatten - Alpaca client not connected")
    
    async def _run_monitoring_loop(self, interval: int):
        """
        Continuous monitoring loop - SPAWNS dedicated agents for new positions.
        Does NOT execute exits itself anymore.
        
        CRITICAL: Respects trading window - stops agents during flatten.
        """
        from .broker_position_manager import get_broker_position_manager
        from .alpaca_client import get_alpaca_client
        from .position_agent import PositionAgent
        
        logger.info(f"Agent Dispatcher started (checking for new positions every {interval}s)")
        
        # active_agents is now managed at instance level (self.active_agents)
        
        # Start Global Stream Manager
        try:
            from .agent_stream import get_agent_stream
            await get_agent_stream().start()
        except Exception as e:
            logger.error(f"Failed to start AgentStreamManager: {e}")
            
        while self.is_running:
            try:
                # Check trading window for monitoring
                client = get_alpaca_client()
                alpaca_clock = await client.get_clock() if client.is_connected else None
                window_status = check_trading_window(alpaca_clock)
                
                # If in flatten state, don't spawn new agents
                if window_status.state == TradingGateState.FLATTEN_REQUIRED:
                    # Clean up any remaining agents (shouldn't happen, but safety)
                    if self.active_agents:
                        logger.info(f"Cleaning up {len(self.active_agents)} agents during flatten")
                        for symbol, agent in list(self.active_agents.items()):
                            try:
                                await agent.stop()
                                del self.active_agents[symbol]
                            except Exception as e:
                                logger.error(f"Error stopping agent {symbol}: {e}")
                    await asyncio.sleep(interval)
                    continue
                
                if self.engine and not self.engine.kill_switch_active:
                    
                    if client.is_connected:
                        # 1. Get current real positions
                        positions = await client.list_positions()
                        current_symbols = {p.symbol for p in positions}
                        
                        # Only spawn agents during trading window
                        if window_status.allow_trading:
                            # 2. Spawn agents for new positions
                            for p in positions:
                                if p.symbol not in self.active_agents:
                                    logger.info(f"🆕 New position detected: {p.symbol} - Spawning Agent")
                                    agent = PositionAgent(p.symbol)
                                    agent.start()
                                    self.active_agents[p.symbol] = agent
                        
                        # 3. Cleanup stopped/dead agents
                        for symbol, agent in list(self.active_agents.items()):
                            if not agent._is_running:
                                logger.info(f"♻️ Cleaning up stopped agent for {symbol}")
                                del self.active_agents[symbol]
                            elif symbol not in current_symbols:
                                logger.info(f"⚠️ Position {symbol} gone but agent running - Stopping agent")
                                await agent.stop()
                                del self.active_agents[symbol]
                                
            except Exception as e:
                logger.error(f"Error in Agent Dispatcher: {e}", exc_info=True)
                
            await asyncio.sleep(interval)
    
    async def _execute_urgent_exits(self, signals):
        """Execute urgent exit orders immediately."""
        from .alpaca_client import get_alpaca_client
        
        client = get_alpaca_client()
        
        for signal in signals:
            try:
                logger.info(f"Executing urgent exit for {signal.symbol}: {signal.trigger.value}")
                # Close position via Alpaca
                await client.close_position(signal.symbol)
                
                # Broadcast exit event
                try:
                    from ..api.autopilot_websocket import get_autopilot_ws_manager
                    ws = get_autopilot_ws_manager()
                    await ws.broadcast("EXIT_EXECUTED", {
                        "symbol": signal.symbol,
                        "trigger": signal.trigger.value,
                        "timestamp": datetime.utcnow().isoformat()
                    })
                except Exception:
                    pass
                    
            except Exception as e:
                logger.error(f"Failed to execute exit for {signal.symbol}: {e}")
    
    def get_status(self) -> dict:
        """Get current autopilot status from unified engine."""
        if not self.engine:
            return {"status": "not_initialized", "running": False}
        
        # Get trading window status (sync version for status endpoint)
        try:
            window_status = check_trading_window()
            trading_window = {
                "state": window_status.state.value,
                "allow_trading": window_status.allow_trading,
                "reason": window_status.reason,
                "current_time_et": window_status.current_time_et.isoformat() if window_status.current_time_et else None,
            }
        except Exception as e:
            trading_window = {"error": str(e)}
        
        return {
            "status": "running" if self.is_running else "stopped",
            "running": self.is_running,
            "engine": "unified",
            "kill_switch": self.engine.kill_switch_active,
            "monitoring_active": self._monitoring_task is not None and not self._monitoring_task.done(),
            "active_agents": list(self.active_agents.keys()),
            "trading_window": trading_window,
        }

# Global singleton accessor
_service = None

def get_autopilot_service() -> AutopilotService:
    global _service
    if _service is None:
        _service = AutopilotService()
    return _service

