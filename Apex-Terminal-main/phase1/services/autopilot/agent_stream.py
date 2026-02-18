
import asyncio
import logging
from typing import Dict, Optional, Callable, List
from alpaca.trading.stream import TradingStream
from alpaca.common.exceptions import APIError
from .config import get_autopilot_config

logger = logging.getLogger(__name__)

class AgentStreamManager:
    """
    Centralized Stream Manager for Real-Time Agent Updates.
    Multiplexes Alpaca trade updates to specific PositionAgents.
    """
    
    def __init__(self):
        self._stream: Optional[TradingStream] = None
        self._running = False
        self._subscribers: Dict[str, List[Callable]] = {} # symbol -> [callback]
        self._global_callbacks: List[Callable] = []
        
    async def start(self):
        """Start the TradingStream."""
        if self._running:
            return

        config = get_autopilot_config()

        try:
            import os
            api_key = os.environ.get("APCA_API_KEY_ID")
            secret_key = os.environ.get("APCA_API_SECRET_KEY")
            
            if not api_key or not secret_key:
                logger.error("AgentStreamManager: Missing Alpaca API keys in env")
                return

            self._stream = TradingStream(
                api_key=api_key,
                secret_key=secret_key,
                paper=config.mode == "paper" or True # Default to paper for now per safety
            )
            
            # Register handler
            self._stream.subscribe_trade_updates(self._handle_trade_update)
            
            self._running = True
            logger.info("AgentStreamManager: Connected to Alpaca Trading Stream")
            
            # Run stream in background task (it's blocking/infinite loop usually)
            asyncio.create_task(self._run_stream())
            
        except Exception as e:
            logger.error(f"AgentStreamManager Init Failed: {e}")
            self._running = False

    async def _run_stream(self):
        """Run the stream loop."""
        try:
            await self._stream._run_forever()
        except Exception as e:
            logger.error(f"AgentStreamManager Stream Crash: {e}")
            self._running = False
            # Simple retry logic could go here
            
    async def _handle_trade_update(self, update):
        """
        Dispatch update to relevant agents.
        Update is an alpaca-py TradeUpdate object.
        """
        try:
            # Extract symbol (sometimes in order object)
            order = update.order
            symbol = order.symbol
            event = update.event
            
            logger.info(f"⚡ Stream Event: {event} for {symbol} ({order.status})")
            
            # Notify global listeners (e.g. Dashboard Stream)
            for cb in self._global_callbacks:
                try:
                    if asyncio.iscoroutinefunction(cb):
                        await cb(update)
                    else:
                        cb(update)
                except Exception as e:
                    logger.error(f"Global callback error: {e}")
            
            # Notify symbol subscribers (PositionAgents)
            if symbol in self._subscribers:
                for cb in self._subscribers[symbol]:
                    try:
                        if asyncio.iscoroutinefunction(cb):
                            await cb(update)
                        else:
                            cb(update)
                    except Exception as e:
                        logger.error(f"Agent callback error for {symbol}: {e}")
                        
        except Exception as e:
            logger.error(f"Error handling stream update: {e}", exc_info=True)

    def subscribe_agent(self, symbol: str, callback: Callable):
        """Register a callback for a specific symbol."""
        if symbol not in self._subscribers:
            self._subscribers[symbol] = []
        self._subscribers[symbol].append(callback)
        logger.info(f"AgentStreamManager: Subscribed agent for {symbol}")

    def unsubscribe_agent(self, symbol: str, callback: Callable):
        """Unregister a callback."""
        if symbol in self._subscribers:
            if callback in self._subscribers[symbol]:
                self._subscribers[symbol].remove(callback)
                if not self._subscribers[symbol]:
                    del self._subscribers[symbol]

    async def stop(self):
        """Stop the stream."""
        self._running = False
        if self._stream:
            await self._stream.stop_ws()

# Global Singleton
_agent_stream = None

def get_agent_stream() -> AgentStreamManager:
    global _agent_stream
    if _agent_stream is None:
        _agent_stream = AgentStreamManager()
    return _agent_stream
