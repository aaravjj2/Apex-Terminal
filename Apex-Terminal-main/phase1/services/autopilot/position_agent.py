
import asyncio
import logging
from datetime import datetime
from typing import Optional, Dict

from .broker_position_manager import (
    get_broker_position_manager, 
    EnrichedBrokerPosition, 
    BrokerExitSignal
)
from .alpaca_client import get_alpaca_client

logger = logging.getLogger(__name__)

class PositionAgent:
    """
    Dedicated agent that monitors a SINGLE position.
    Runs in its own asyncio task loop.
    """
    
    def __init__(self, symbol: str, interval_seconds: int = 30):
        self.symbol = symbol
        self.interval = interval_seconds # Slow heartbeat (fallback)
        self._is_running = False
        self._task: Optional[asyncio.Task] = None
        self.logger = logging.getLogger(f"agent.{symbol}")
        
        # Event-driven implementation
        self._update_event = asyncio.Event()
        self._latest_stream_update = None
        
    def start(self):
        """Start the monitoring agent."""
        if self._is_running:
            return
            
        self._is_running = True
        
        # Subscribe to Real-Time Stream
        from .agent_stream import get_agent_stream
        get_agent_stream().subscribe_agent(self.symbol, self._handle_stream_update)
        
        self._task = asyncio.create_task(self._monitor_loop())
        self.logger.info(f"🛡️ Agent activated for {self.symbol} (Real-time Stream + {self.interval}s Heartbeat)")
        
    async def stop(self):
        """Stop the monitoring agent."""
        self._is_running = False
        
        # Unsubscribe
        try:
            from .agent_stream import get_agent_stream
            get_agent_stream().unsubscribe_agent(self.symbol, self._handle_stream_update)
        except Exception:
            pass
            
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        self.logger.info(f"🛑 Agent deactivated for {self.symbol}")

    async def _handle_stream_update(self, update):
        """Callback from AgentStreamManager."""
        self.logger.info(f"⚡ Received Stream Update for {self.symbol}: {update.event}")
        self._latest_stream_update = update
        self._update_event.set() # Wake up monitor loop immediately!

    async def _monitor_loop(self):
        """Main monitoring loop (Event-Driven + Heartbeat)."""
        manager = get_broker_position_manager()
        client = get_alpaca_client()
        
        await asyncio.sleep(1) # Warmup
        
        while self._is_running:
            try:
                # Clear event at start of cycle
                self._update_event.clear()
                
                # --- LOGIC START ---
                # 1. Fetch Latest State (API is authoritative source)
                # We fetch regardless of trigger to ensure we see the result of the stream event
                try:
                    raw_pos = await client.get_position(self.symbol)
                except Exception as e:
                    # If 404, it might be closed already (e.g. Stop Loss hit via Stream)
                    self.logger.warning(f"Position lookup failed: {e}")
                    # Verify via list
                    all_pos = await client.list_positions()
                    if self.symbol not in [p.symbol for p in all_pos]:
                        self.logger.info("Position no longer exists (Closed). Shutting down agent.")
                        self._is_running = False
                        break
                    raw_pos = next(p for p in all_pos if p.symbol == self.symbol)

                # 2. Enrich
                pos_dict = raw_pos
                if hasattr(raw_pos, "to_dict"):
                    pos_dict = raw_pos.to_dict()
                elif hasattr(raw_pos, "dict"):
                    pos_dict = raw_pos.dict()
                
                enriched_pos = manager._enrich(pos_dict)
                
                # 3. Check Triggers
                signals = await manager.evaluate_exits(positions=[enriched_pos])
                
                # 4. Act on Signals
                for signal in signals:
                    self.logger.info(f"🔔 SIGNAL received: {signal.trigger} ({signal.urgency})")
                    if signal.urgency in ["immediate", "critical"]:
                        await self._execute_exit(client, signal)
                        self._is_running = False 
                        break 
                
                if not self._is_running:
                    break

                # 5. Heartbeat Log
                self.logger.debug(f"Tick. PnL: {enriched_pos.unrealized_pnl_pct:.2f}%")

            except Exception as e:
                self.logger.error(f"Error in monitor loop: {e}")
                
            # WAIT FOR EVENT OR TIMEOUT (Heartbeat)
            # This makes it event-driven!
            try:
                await asyncio.wait_for(self._update_event.wait(), timeout=self.interval)
                self.logger.info("⚡ Waking up due to Stream Event!")
            except asyncio.TimeoutError:
                # Heartbeat timeout, just loop again
                pass

    async def _execute_exit(self, client, signal: BrokerExitSignal):
        """Execute the exit order."""
        self.logger.info(f"🚀 EXECUTING EXIT for {self.symbol}: {signal.trigger}")
        try:
            await client.close_position(self.symbol)
            self.logger.info(f"✅ Exit order submitted successfully")
            
            # Broadcast event
            try:
                from .unified_router import broadcast_ui_event # Assuming router has helper or we allow direct access
                # For now, just log, as UI updates will come via next poll or stream
                pass
            except:
                pass
                
        except Exception as e:
            self.logger.error(f"❌ Exit execution failed: {e}")

    def _check_should_log(self):
        # Log every ~1 minute (every 12th tick of 5s)
        # Using simple counter or time check
        return datetime.now().second < 5 # Log at top of minute roughly
