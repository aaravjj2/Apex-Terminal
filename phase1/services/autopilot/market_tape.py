"""
MarketTape: Event-Sourced Record/Replay System
==============================================
Phase 3: Deterministic backtesting via event replay.

V1 MarketTape Rules:
1. Record ALL market events with timestamps
2. Replay produces IDENTICAL results given same tape
3. No nondeterministic operations during replay
4. Event types: quotes, fills, news, signals, decisions

This enables "record once, replay many" backtesting.
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Optional, Dict, List, Any, Iterator, Callable
from enum import Enum
import json
import gzip
import hashlib
import logging
from pathlib import Path

logger = logging.getLogger(__name__)


# =============================================================================
# EVENT TYPES
# =============================================================================

class TapeEventType(str, Enum):
    """Types of events that can be recorded on the tape."""
    # Market Data Events
    QUOTE = "quote"              # Bid/ask update
    TRADE = "trade"              # Market trade (for price discovery)
    BAR = "bar"                  # OHLCV bar
    
    # Autopilot Events
    SIGNAL = "signal"            # Strategy signal generated
    CANDIDATE = "candidate"       # Trade candidate generated
    DECISION = "decision"        # Autopilot decision (enter/exit/hold)
    EXECUTION = "execution"      # Order execution attempt
    FILL = "fill"               # Order fill confirmation
    EXIT = "exit"               # Position exit
    
    # External Events
    NEWS = "news"               # News headline
    SENTIMENT = "sentiment"      # Sentiment score update
    EARNINGS = "earnings"        # Earnings event
    
    # System Events
    CYCLE_START = "cycle_start"  # Autopilot cycle begins
    CYCLE_END = "cycle_end"      # Autopilot cycle ends
    ERROR = "error"             # Error occurred
    
    # Replay Control
    CHECKPOINT = "checkpoint"    # State checkpoint for fast-forward


@dataclass
class TapeEvent:
    """A single event on the market tape."""
    event_id: int
    timestamp: datetime
    event_type: TapeEventType
    symbol: Optional[str]
    payload: Dict[str, Any]
    sequence: int = 0  # For ordering within same timestamp
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "event_id": self.event_id,
            "timestamp": self.timestamp.isoformat(),
            "event_type": self.event_type.value,
            "symbol": self.symbol,
            "payload": self.payload,
            "sequence": self.sequence,
        }
    
    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "TapeEvent":
        return cls(
            event_id=d["event_id"],
            timestamp=datetime.fromisoformat(d["timestamp"]),
            event_type=TapeEventType(d["event_type"]),
            symbol=d.get("symbol"),
            payload=d["payload"],
            sequence=d.get("sequence", 0),
        )
    
    def __lt__(self, other: "TapeEvent") -> bool:
        """For sorting: by timestamp, then sequence."""
        if self.timestamp != other.timestamp:
            return self.timestamp < other.timestamp
        return self.sequence < other.sequence


# =============================================================================
# MARKET TAPE - RECORDING
# =============================================================================

class MarketTapeRecorder:
    """
    Records market events to create a reproducible tape.
    
    Usage:
        recorder = MarketTapeRecorder("session_2026_01_26")
        recorder.record_quote("AAPL", bid=150.0, ask=150.05)
        recorder.record_decision("AAPL", "long_call", "enter")
        recorder.save("tapes/2026_01_26.tape.gz")
    """
    
    def __init__(self, session_id: str):
        self.session_id = session_id
        self.start_time = datetime.utcnow()
        self._events: List[TapeEvent] = []
        self._event_counter = 0
        self._sequence_counter = 0
        self._last_timestamp: Optional[datetime] = None
        
        # Record session start
        self._record(TapeEventType.CYCLE_START, None, {
            "session_id": session_id,
            "start_time": self.start_time.isoformat(),
        })
    
    def _record(
        self, 
        event_type: TapeEventType, 
        symbol: Optional[str], 
        payload: Dict[str, Any]
    ) -> TapeEvent:
        """Internal method to record an event."""
        self._event_counter += 1
        now = datetime.utcnow()
        
        # Handle sequence within same timestamp
        if self._last_timestamp == now:
            self._sequence_counter += 1
        else:
            self._sequence_counter = 0
            self._last_timestamp = now
        
        event = TapeEvent(
            event_id=self._event_counter,
            timestamp=now,
            event_type=event_type,
            symbol=symbol,
            payload=payload,
            sequence=self._sequence_counter,
        )
        
        self._events.append(event)
        return event
    
    # -------------------------------------------------------------------------
    # Market Data Recording
    # -------------------------------------------------------------------------
    
    def record_quote(
        self, symbol: str, bid: float, ask: float, 
        bid_size: int = 0, ask_size: int = 0
    ) -> TapeEvent:
        """Record a quote update."""
        return self._record(TapeEventType.QUOTE, symbol, {
            "bid": bid,
            "ask": ask,
            "bid_size": bid_size,
            "ask_size": ask_size,
            "mid": (bid + ask) / 2,
            "spread": ask - bid,
        })
    
    def record_bar(
        self, symbol: str, 
        o: float, h: float, l: float, c: float, v: int,
        timeframe: str = "1m"
    ) -> TapeEvent:
        """Record an OHLCV bar."""
        return self._record(TapeEventType.BAR, symbol, {
            "open": o,
            "high": h,
            "low": l,
            "close": c,
            "volume": v,
            "timeframe": timeframe,
        })
    
    # -------------------------------------------------------------------------
    # Autopilot Recording
    # -------------------------------------------------------------------------
    
    def record_signal(
        self, symbol: str, signal_type: str, strength: float,
        indicators: Optional[Dict[str, float]] = None
    ) -> TapeEvent:
        """Record a strategy signal."""
        return self._record(TapeEventType.SIGNAL, symbol, {
            "signal_type": signal_type,
            "strength": strength,
            "indicators": indicators or {},
        })
    
    def record_candidate(
        self, symbol: str, template: str, score: float,
        details: Optional[Dict[str, Any]] = None
    ) -> TapeEvent:
        """Record a trade candidate."""
        return self._record(TapeEventType.CANDIDATE, symbol, {
            "template": template,
            "score": score,
            "details": details or {},
        })
    
    def record_decision(
        self, symbol: str, template: str, action: str,
        reason: str = "", metadata: Optional[Dict[str, Any]] = None
    ) -> TapeEvent:
        """Record an autopilot decision."""
        return self._record(TapeEventType.DECISION, symbol, {
            "template": template,
            "action": action,  # "enter", "exit", "hold", "reject"
            "reason": reason,
            "metadata": metadata or {},
        })
    
    def record_execution(
        self, symbol: str, order_id: str, 
        limit_price: float, qty: int, attempt: int
    ) -> TapeEvent:
        """Record an execution attempt."""
        return self._record(TapeEventType.EXECUTION, symbol, {
            "order_id": order_id,
            "limit_price": limit_price,
            "qty": qty,
            "attempt": attempt,
        })
    
    def record_fill(
        self, symbol: str, order_id: str,
        fill_price: float, qty: int, commission: float = 0.0
    ) -> TapeEvent:
        """Record an order fill."""
        return self._record(TapeEventType.FILL, symbol, {
            "order_id": order_id,
            "fill_price": fill_price,
            "qty": qty,
            "commission": commission,
        })
    
    def record_exit(
        self, symbol: str, exit_reason: str,
        pnl: float, hold_time_minutes: float
    ) -> TapeEvent:
        """Record a position exit."""
        return self._record(TapeEventType.EXIT, symbol, {
            "exit_reason": exit_reason,
            "pnl": pnl,
            "hold_time_minutes": hold_time_minutes,
        })
    
    # -------------------------------------------------------------------------
    # External Events
    # -------------------------------------------------------------------------
    
    def record_news(
        self, symbol: str, headline: str, 
        sentiment: float, source: str
    ) -> TapeEvent:
        """Record a news event."""
        return self._record(TapeEventType.NEWS, symbol, {
            "headline": headline,
            "sentiment": sentiment,
            "source": source,
        })
    
    def record_sentiment(
        self, symbol: str, score: float, 
        provider: str, components: Optional[Dict[str, float]] = None
    ) -> TapeEvent:
        """Record a sentiment update."""
        return self._record(TapeEventType.SENTIMENT, symbol, {
            "score": score,
            "provider": provider,
            "components": components or {},
        })
    
    # -------------------------------------------------------------------------
    # System Events
    # -------------------------------------------------------------------------
    
    def record_cycle_start(self, cycle_id: str) -> TapeEvent:
        """Record start of autopilot cycle."""
        return self._record(TapeEventType.CYCLE_START, None, {
            "cycle_id": cycle_id,
        })
    
    def record_cycle_end(
        self, cycle_id: str, 
        candidates: int, fills: int, exits: int
    ) -> TapeEvent:
        """Record end of autopilot cycle."""
        return self._record(TapeEventType.CYCLE_END, None, {
            "cycle_id": cycle_id,
            "candidates": candidates,
            "fills": fills,
            "exits": exits,
        })
    
    def record_error(self, error: str, context: Optional[Dict] = None) -> TapeEvent:
        """Record an error."""
        return self._record(TapeEventType.ERROR, None, {
            "error": error,
            "context": context or {},
        })
    
    def record_checkpoint(self, state: Dict[str, Any]) -> TapeEvent:
        """Record a state checkpoint for fast-forward."""
        return self._record(TapeEventType.CHECKPOINT, None, {
            "state": state,
        })
    
    # -------------------------------------------------------------------------
    # Persistence
    # -------------------------------------------------------------------------
    
    @property
    def events(self) -> List[TapeEvent]:
        """Get all recorded events."""
        return self._events.copy()
    
    @property
    def event_count(self) -> int:
        """Get number of events."""
        return len(self._events)
    
    def to_json(self) -> str:
        """Serialize tape to JSON."""
        return json.dumps({
            "session_id": self.session_id,
            "start_time": self.start_time.isoformat(),
            "event_count": len(self._events),
            "events": [e.to_dict() for e in self._events],
        }, indent=2)
    
    def save(self, filepath: str, compress: bool = True) -> str:
        """
        Save tape to file.
        
        Returns:
            SHA256 hash of the tape content (for verification)
        """
        content = self.to_json()
        content_hash = hashlib.sha256(content.encode()).hexdigest()
        
        path = Path(filepath)
        path.parent.mkdir(parents=True, exist_ok=True)
        
        if compress:
            if not filepath.endswith('.gz'):
                filepath += '.gz'
            with gzip.open(filepath, 'wt', encoding='utf-8') as f:
                f.write(content)
        else:
            with open(filepath, 'w') as f:
                f.write(content)
        
        logger.info(f"Tape saved: {filepath} ({len(self._events)} events, hash={content_hash[:12]})")
        return content_hash


# =============================================================================
# MARKET TAPE - REPLAY
# =============================================================================

class MarketTapePlayer:
    """
    Replays recorded market tape for backtesting.
    
    V1 Replay Rules:
    - Events are replayed in exact recorded order
    - Timestamps can be simulated or fast-forwarded
    - Handlers are called synchronously for determinism
    - Checkpoints allow fast-forward to specific points
    
    Usage:
        player = MarketTapePlayer.load("tapes/2026_01_26.tape.gz")
        player.on_quote(handle_quote)
        player.on_decision(handle_decision)
        results = player.replay()
    """
    
    def __init__(self, events: List[TapeEvent], session_id: str):
        self._events = sorted(events)  # Ensure sorted
        self.session_id = session_id
        self._position = 0
        self._handlers: Dict[TapeEventType, List[Callable]] = {}
        self._checkpoints: Dict[int, Dict[str, Any]] = {}
        
        # Build checkpoint index
        for i, event in enumerate(self._events):
            if event.event_type == TapeEventType.CHECKPOINT:
                self._checkpoints[i] = event.payload.get("state", {})
    
    @classmethod
    def load(cls, filepath: str) -> "MarketTapePlayer":
        """Load tape from file."""
        if filepath.endswith('.gz'):
            with gzip.open(filepath, 'rt', encoding='utf-8') as f:
                content = f.read()
        else:
            with open(filepath, 'r') as f:
                content = f.read()
        
        data = json.loads(content)
        events = [TapeEvent.from_dict(e) for e in data["events"]]
        
        logger.info(f"Tape loaded: {filepath} ({len(events)} events)")
        return cls(events, data["session_id"])
    
    @classmethod
    def from_recorder(cls, recorder: MarketTapeRecorder) -> "MarketTapePlayer":
        """Create player from recorder (for testing)."""
        return cls(recorder.events, recorder.session_id)
    
    def on(self, event_type: TapeEventType, handler: Callable[[TapeEvent], None]) -> None:
        """Register a handler for an event type."""
        if event_type not in self._handlers:
            self._handlers[event_type] = []
        self._handlers[event_type].append(handler)
    
    def on_quote(self, handler: Callable[[TapeEvent], None]) -> None:
        """Register quote handler."""
        self.on(TapeEventType.QUOTE, handler)
    
    def on_decision(self, handler: Callable[[TapeEvent], None]) -> None:
        """Register decision handler."""
        self.on(TapeEventType.DECISION, handler)
    
    def on_fill(self, handler: Callable[[TapeEvent], None]) -> None:
        """Register fill handler."""
        self.on(TapeEventType.FILL, handler)
    
    def on_any(self, handler: Callable[[TapeEvent], None]) -> None:
        """Register handler for all events."""
        for event_type in TapeEventType:
            self.on(event_type, handler)
    
    def replay(
        self,
        start_event: int = 0,
        end_event: Optional[int] = None,
        speed: float = 0.0,  # 0 = instant, 1 = realtime
    ) -> Dict[str, Any]:
        """
        Replay the tape.
        
        Args:
            start_event: Event index to start from
            end_event: Event index to stop at (None = end)
            speed: Replay speed (0 = instant)
        
        Returns:
            Replay statistics
        """
        import time
        
        start_time = datetime.utcnow()
        self._position = start_event
        end_idx = end_event or len(self._events)
        
        events_processed = 0
        errors = 0
        last_event_time: Optional[datetime] = None
        
        for i in range(start_event, min(end_idx, len(self._events))):
            event = self._events[i]
            self._position = i
            
            # Simulate time delay if speed > 0
            if speed > 0 and last_event_time:
                delta = (event.timestamp - last_event_time).total_seconds()
                if delta > 0:
                    time.sleep(delta / speed)
            
            last_event_time = event.timestamp
            
            # Dispatch to handlers
            handlers = self._handlers.get(event.event_type, [])
            for handler in handlers:
                try:
                    handler(event)
                except Exception as e:
                    logger.error(f"Handler error for {event.event_type}: {e}")
                    errors += 1
            
            events_processed += 1
        
        duration = (datetime.utcnow() - start_time).total_seconds()
        
        return {
            "session_id": self.session_id,
            "events_processed": events_processed,
            "errors": errors,
            "duration_seconds": duration,
            "events_per_second": events_processed / duration if duration > 0 else 0,
        }
    
    def seek_to_checkpoint(self, checkpoint_index: int) -> Optional[Dict[str, Any]]:
        """Seek to a checkpoint and return its state."""
        if checkpoint_index in self._checkpoints:
            # Find the event index for this checkpoint
            for i, event in enumerate(self._events):
                if event.event_type == TapeEventType.CHECKPOINT:
                    if event.payload.get("state") == self._checkpoints[checkpoint_index]:
                        self._position = i
                        return self._checkpoints[checkpoint_index]
        return None
    
    def get_events_by_type(self, event_type: TapeEventType) -> List[TapeEvent]:
        """Get all events of a specific type."""
        return [e for e in self._events if e.event_type == event_type]
    
    def get_events_by_symbol(self, symbol: str) -> List[TapeEvent]:
        """Get all events for a specific symbol."""
        return [e for e in self._events if e.symbol == symbol]
    
    @property
    def total_events(self) -> int:
        """Total number of events."""
        return len(self._events)
    
    @property
    def current_position(self) -> int:
        """Current replay position."""
        return self._position


# =============================================================================
# BACKTEST RUNNER
# =============================================================================

@dataclass
class BacktestResult:
    """Result of a tape backtest."""
    session_id: str
    tape_hash: str
    start_time: datetime
    end_time: datetime
    
    # Trade metrics
    total_trades: int = 0
    winning_trades: int = 0
    losing_trades: int = 0
    total_pnl: float = 0.0
    max_drawdown: float = 0.0
    
    # Execution metrics
    total_fills: int = 0
    fill_rate: float = 0.0
    avg_slippage_bps: float = 0.0
    
    # Determinism verification
    result_hash: str = ""  # Hash of all decisions/fills for verification
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "session_id": self.session_id,
            "tape_hash": self.tape_hash,
            "start_time": self.start_time.isoformat(),
            "end_time": self.end_time.isoformat(),
            "total_trades": self.total_trades,
            "winning_trades": self.winning_trades,
            "losing_trades": self.losing_trades,
            "total_pnl": self.total_pnl,
            "max_drawdown": self.max_drawdown,
            "win_rate": self.winning_trades / self.total_trades if self.total_trades > 0 else 0.0,
            "total_fills": self.total_fills,
            "fill_rate": self.fill_rate,
            "avg_slippage_bps": self.avg_slippage_bps,
            "result_hash": self.result_hash,
        }


class TapeBacktester:
    """
    Run backtests on recorded tapes.
    
    V1 Backtest Rules:
    - Same tape + same strategy = same results (deterministic)
    - Results are hashed for verification
    - No random operations allowed
    """
    
    def __init__(self, tape: MarketTapePlayer):
        self.tape = tape
        self._decisions: List[Dict] = []
        self._fills: List[Dict] = []
        self._exits: List[Dict] = []
    
    def run(self) -> BacktestResult:
        """Run backtest and return results."""
        start_time = datetime.utcnow()
        
        # Register handlers
        self.tape.on_decision(self._handle_decision)
        self.tape.on_fill(self._handle_fill)
        self.tape.on(TapeEventType.EXIT, self._handle_exit)
        
        # Replay
        stats = self.tape.replay()
        
        # Calculate results
        total_pnl = sum(e["pnl"] for e in self._exits)
        winning = sum(1 for e in self._exits if e["pnl"] > 0)
        losing = sum(1 for e in self._exits if e["pnl"] <= 0)
        
        # Generate result hash for determinism verification
        result_data = json.dumps({
            "decisions": self._decisions,
            "fills": self._fills,
            "exits": self._exits,
        }, sort_keys=True)
        result_hash = hashlib.sha256(result_data.encode()).hexdigest()
        
        return BacktestResult(
            session_id=self.tape.session_id,
            tape_hash="",  # Would be from tape file
            start_time=start_time,
            end_time=datetime.utcnow(),
            total_trades=len(self._exits),
            winning_trades=winning,
            losing_trades=losing,
            total_pnl=total_pnl,
            total_fills=len(self._fills),
            result_hash=result_hash,
        )
    
    def _handle_decision(self, event: TapeEvent) -> None:
        """Handle decision event."""
        self._decisions.append({
            "timestamp": event.timestamp.isoformat(),
            "symbol": event.symbol,
            "action": event.payload.get("action"),
            "template": event.payload.get("template"),
        })
    
    def _handle_fill(self, event: TapeEvent) -> None:
        """Handle fill event."""
        self._fills.append({
            "timestamp": event.timestamp.isoformat(),
            "symbol": event.symbol,
            "price": event.payload.get("fill_price"),
            "qty": event.payload.get("qty"),
        })
    
    def _handle_exit(self, event: TapeEvent) -> None:
        """Handle exit event."""
        self._exits.append({
            "timestamp": event.timestamp.isoformat(),
            "symbol": event.symbol,
            "pnl": event.payload.get("pnl", 0.0),
            "reason": event.payload.get("exit_reason"),
        })


# =============================================================================
# SINGLETON ACCESS
# =============================================================================

_active_recorder: Optional[MarketTapeRecorder] = None


def get_tape_recorder(session_id: Optional[str] = None) -> MarketTapeRecorder:
    """Get or create the active tape recorder."""
    global _active_recorder
    if _active_recorder is None:
        session_id = session_id or datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        _active_recorder = MarketTapeRecorder(session_id)
    return _active_recorder


def reset_tape_recorder() -> None:
    """Reset the active tape recorder."""
    global _active_recorder
    _active_recorder = None
