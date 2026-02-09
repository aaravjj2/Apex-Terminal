"""
Position Monitoring Service

Continuous monitoring and automatic exit management integrated with Alpaca.
Handles the "trade lifecycle" problem - ensuring no position sits forever.
"""

from dataclasses import dataclass, field
from datetime import datetime, date, timedelta
from enum import Enum
from typing import List, Dict, Any, Optional, Callable
import asyncio
import logging
import os
import json

try:
    import httpx
    HTTPX_AVAILABLE = True
except ImportError:
    HTTPX_AVAILABLE = False

from .position_manager import PositionManager, OptionsPosition, PositionStatus
from .config import AutopilotConfig, StrategyTemplate

logger = logging.getLogger(__name__)


class ExitReason(str, Enum):
    """Reason for exit trigger."""
    PROFIT_TARGET = "profit_target"
    STOP_LOSS = "stop_loss"
    TIME_STOP = "time_stop"
    DTE_THRESHOLD = "dte_threshold"
    EARNINGS_CLOSE = "earnings_close"
    MANUAL = "manual"
    RISK_LIMIT = "risk_limit"
    NEWS_SHOCK = "news_shock"
    MAX_HOLD_TIME = "max_hold_time"


@dataclass
class ExitSignal:
    """Signal to exit a position."""
    position_id: str
    symbol: str
    reason: ExitReason
    urgency: str  # "immediate", "eod", "next_cycle"
    target_quantity: float
    limit_price: Optional[float] = None
    rationale: str = ""
    features_snapshot: Dict[str, Any] = field(default_factory=dict)
    triggered_at: datetime = field(default_factory=datetime.utcnow)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "position_id": self.position_id,
            "symbol": self.symbol,
            "reason": self.reason.value,
            "urgency": self.urgency,
            "target_quantity": self.target_quantity,
            "limit_price": self.limit_price,
            "rationale": self.rationale,
            "features_snapshot": self.features_snapshot,
            "triggered_at": self.triggered_at.isoformat(),
        }


@dataclass
class MonitoringEvent:
    """A single monitoring event."""
    event_id: str
    event_type: str
    position_id: Optional[str]
    symbol: Optional[str]
    timestamp: datetime
    details: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "event_id": self.event_id,
            "event_type": self.event_type,
            "position_id": self.position_id,
            "symbol": self.symbol,
            "timestamp": self.timestamp.isoformat(),
            "details": self.details,
        }


@dataclass
class MonitoringReport:
    """Report from a monitoring pass."""
    report_id: str
    timestamp: datetime
    positions_checked: int = 0
    exits_triggered: int = 0
    orders_placed: int = 0
    orders_filled: int = 0
    orders_rejected: int = 0
    total_pnl_realized: float = 0.0
    events: List[MonitoringEvent] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)
    duration_ms: float = 0.0
    trigger: str = "scheduled"  # "scheduled", "on_demand", "trade_update"
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "report_id": self.report_id,
            "timestamp": self.timestamp.isoformat(),
            "positions_checked": self.positions_checked,
            "exits_triggered": self.exits_triggered,
            "orders_placed": self.orders_placed,
            "orders_filled": self.orders_filled,
            "orders_rejected": self.orders_rejected,
            "total_pnl_realized": self.total_pnl_realized,
            "events": [e.to_dict() for e in self.events],
            "errors": self.errors,
            "duration_ms": self.duration_ms,
            "trigger": self.trigger,
        }


@dataclass
class UnifiedAlpacaPosition:
    """Unified position from Alpaca (equity or option)."""
    asset_id: str
    symbol: str
    underlying: str
    position_type: str  # "equity" or "option"
    quantity: float
    avg_entry_price: float
    current_price: float
    market_value: float
    unrealized_pnl: float
    unrealized_pnl_pct: float
    
    # Options-specific
    dte: Optional[int] = None
    expiration: Optional[date] = None
    strike: Optional[float] = None
    option_type: Optional[str] = None
    
    # Metadata
    client_order_id: Optional[str] = None
    run_id: Optional[str] = None
    strategy_template: Optional[str] = None
    managed_by_autopilot: bool = False
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "asset_id": self.asset_id,
            "symbol": self.symbol,
            "underlying": self.underlying,
            "position_type": self.position_type,
            "quantity": self.quantity,
            "avg_entry_price": self.avg_entry_price,
            "current_price": self.current_price,
            "market_value": self.market_value,
            "unrealized_pnl": self.unrealized_pnl,
            "unrealized_pnl_pct": self.unrealized_pnl_pct,
            "dte": self.dte,
            "expiration": self.expiration.isoformat() if self.expiration else None,
            "strike": self.strike,
            "option_type": self.option_type,
            "client_order_id": self.client_order_id,
            "run_id": self.run_id,
            "strategy_template": self.strategy_template,
            "managed_by_autopilot": self.managed_by_autopilot,
        }


class PositionMonitor:
    """
    Continuous position monitoring with Alpaca integration.
    
    Responsibilities:
    1. Load positions from Alpaca (equities + options)
    2. Cross-reference with internal position ledger
    3. Evaluate exit rules per strategy template
    4. Place exit orders via Alpaca paper
    5. Generate monitoring reports
    """
    
    # Exit rules per strategy template
    EXIT_RULES = {
        "put_credit_spread": {
            "profit_target_pct": 0.50,
            "stop_loss_multiplier": 2.0,
            "time_stop_dte": 7,
            "max_hold_days": 45,
        },
        "call_credit_spread": {
            "profit_target_pct": 0.50,
            "stop_loss_multiplier": 2.0,
            "time_stop_dte": 7,
            "max_hold_days": 45,
        },
        "iron_condor": {
            "profit_target_pct": 0.50,
            "stop_loss_multiplier": 1.5,
            "time_stop_dte": 10,
            "max_hold_days": 45,
        },
        "call_debit_spread": {
            "profit_target_pct": 1.0,
            "stop_loss_pct": 0.50,
            "time_stop_dte": 14,
            "max_hold_days": 60,
        },
        "put_debit_spread": {
            "profit_target_pct": 1.0,
            "stop_loss_pct": 0.50,
            "time_stop_dte": 14,
            "max_hold_days": 60,
        },
        "equity_long": {
            "profit_target_pct": 0.10,
            "stop_loss_pct": 0.05,
            "max_hold_days": 30,
        },
    }
    
    def __init__(
        self,
        position_manager: Optional[PositionManager] = None,
        alpaca_key: Optional[str] = None,
        alpaca_secret: Optional[str] = None,
        base_url: Optional[str] = None,
    ):
        self._position_manager = position_manager
        self._alpaca_key = alpaca_key or os.environ.get("APCA_API_KEY_ID", "")
        self._alpaca_secret = alpaca_secret or os.environ.get("APCA_API_SECRET_KEY", "")
        self._base_url = base_url or os.environ.get(
            "APCA_API_BASE_URL", "https://paper-api.alpaca.markets"
        )
        
        # State
        self._alpaca_positions: Dict[str, UnifiedAlpacaPosition] = {}
        self._pending_exits: Dict[str, ExitSignal] = {}
        self._reports: List[MonitoringReport] = []
        self._last_run: Optional[datetime] = None
        self._event_counter = 0
        
        # Callbacks
        self._on_exit_signal: Optional[Callable[[ExitSignal], None]] = None
        self._on_report: Optional[Callable[[MonitoringReport], None]] = None
    
    def _get_headers(self) -> Dict[str, str]:
        """Get Alpaca API headers."""
        return {
            "APCA-API-KEY-ID": self._alpaca_key,
            "APCA-API-SECRET-KEY": self._alpaca_secret,
        }
    
    def _generate_event_id(self) -> str:
        """Generate unique event ID."""
        self._event_counter += 1
        return f"EVT_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}_{self._event_counter:04d}"
    
    async def load_alpaca_positions(self) -> List[UnifiedAlpacaPosition]:
        """Load all positions from Alpaca."""
        if not HTTPX_AVAILABLE:
            logger.error("httpx not available")
            return []
        
        if not self._alpaca_key or not self._alpaca_secret:
            logger.warning("Alpaca credentials not configured")
            return []
        
        positions = []
        
        try:
            async with httpx.AsyncClient() as client:
                # Load equity positions
                equity_response = await client.get(
                    f"{self._base_url}/v2/positions",
                    headers=self._get_headers(),
                    timeout=10.0,
                )
                
                if equity_response.status_code == 200:
                    for pos in equity_response.json():
                        unified = self._normalize_equity_position(pos)
                        if unified:
                            positions.append(unified)
                            self._alpaca_positions[unified.asset_id] = unified
                
                # Load options positions
                try:
                    options_response = await client.get(
                        f"{self._base_url}/v2/options/positions",
                        headers=self._get_headers(),
                        timeout=10.0,
                    )
                    
                    if options_response.status_code == 200:
                        for pos in options_response.json():
                            unified = self._normalize_option_position(pos)
                            if unified:
                                positions.append(unified)
                                self._alpaca_positions[unified.asset_id] = unified
                except Exception as e:
                    logger.debug(f"Options positions not available: {e}")
                
                logger.info(f"Loaded {len(positions)} positions from Alpaca")
                
        except Exception as e:
            logger.error(f"Error loading positions from Alpaca: {e}")
        
        return positions
    
    def _normalize_equity_position(self, pos: Dict[str, Any]) -> Optional[UnifiedAlpacaPosition]:
        """Normalize an equity position from Alpaca."""
        try:
            symbol = pos.get("symbol", "")
            asset_id = pos.get("asset_id", f"eq_{symbol}")
            qty = float(pos.get("qty", 0))
            avg_entry = float(pos.get("avg_entry_price", 0))
            current = float(pos.get("current_price", avg_entry))
            market_value = float(pos.get("market_value", qty * current))
            unrealized = float(pos.get("unrealized_pl", 0))
            unrealized_pct = float(pos.get("unrealized_plpc", 0)) * 100
            
            # Parse client_order_id for metadata
            client_order_id = None
            run_id = None
            strategy = "equity_long"
            managed = False
            
            return UnifiedAlpacaPosition(
                asset_id=asset_id,
                symbol=symbol,
                underlying=symbol,
                position_type="equity",
                quantity=qty,
                avg_entry_price=avg_entry,
                current_price=current,
                market_value=market_value,
                unrealized_pnl=unrealized,
                unrealized_pnl_pct=unrealized_pct,
                client_order_id=client_order_id,
                run_id=run_id,
                strategy_template=strategy,
                managed_by_autopilot=managed,
            )
        except Exception as e:
            logger.error(f"Error normalizing equity position: {e}")
            return None
    
    def _normalize_option_position(self, pos: Dict[str, Any]) -> Optional[UnifiedAlpacaPosition]:
        """Normalize an option position from Alpaca."""
        try:
            symbol = pos.get("symbol", "")
            asset_id = pos.get("asset_id", f"opt_{symbol}")
            underlying = pos.get("underlying_symbol", symbol[:4] if len(symbol) > 4 else symbol)
            qty = float(pos.get("qty", 0))
            avg_entry = float(pos.get("avg_entry_price", 0))
            current = float(pos.get("current_price", avg_entry))
            market_value = float(pos.get("market_value", qty * current * 100))
            unrealized = float(pos.get("unrealized_pl", 0))
            
            # Parse OCC symbol for option details
            expiration = None
            strike = None
            option_type = None
            dte = None
            
            if len(symbol) > 10:
                try:
                    exp_str = symbol[-15:-9]
                    expiration = datetime.strptime(f"20{exp_str}", "%Y%m%d").date()
                    option_type = "call" if symbol[-9] == "C" else "put"
                    strike = float(symbol[-8:]) / 1000
                    dte = (expiration - date.today()).days
                except:
                    pass
            
            unrealized_pct = (unrealized / (avg_entry * abs(qty) * 100)) * 100 if avg_entry * qty else 0
            
            return UnifiedAlpacaPosition(
                asset_id=asset_id,
                symbol=symbol,
                underlying=underlying,
                position_type="option",
                quantity=qty,
                avg_entry_price=avg_entry,
                current_price=current,
                market_value=market_value,
                unrealized_pnl=unrealized,
                unrealized_pnl_pct=unrealized_pct,
                dte=dte,
                expiration=expiration,
                strike=strike,
                option_type=option_type,
            )
        except Exception as e:
            logger.error(f"Error normalizing option position: {e}")
            return None
    
    def evaluate_exit_rules(
        self,
        position: UnifiedAlpacaPosition,
        internal_position: Optional[OptionsPosition] = None,
        market_context: Optional[Dict[str, Any]] = None,
    ) -> Optional[ExitSignal]:
        """
        Evaluate exit rules for a position.
        
        Uses both Alpaca position data and internal position metadata.
        """
        # Get strategy from internal position or default
        strategy = "equity_long"
        if internal_position:
            strategy = internal_position.template
        elif position.strategy_template:
            strategy = position.strategy_template
        
        rules = self.EXIT_RULES.get(strategy, self.EXIT_RULES["equity_long"])
        
        # Calculate P&L metrics
        unrealized_pnl = position.unrealized_pnl
        unrealized_pct = position.unrealized_pnl_pct / 100
        
        # For internal positions with known max profit
        max_profit = 0
        credit_received = 0
        if internal_position:
            max_profit = internal_position.max_profit
            credit_received = internal_position.entry_price if internal_position.entry_price > 0 else 0
        
        profit_pct = unrealized_pnl / max_profit if max_profit > 0 else unrealized_pct
        
        # Check profit target
        profit_target = rules.get("profit_target_pct", 0.50)
        if profit_pct >= profit_target:
            return ExitSignal(
                position_id=position.asset_id,
                symbol=position.symbol,
                reason=ExitReason.PROFIT_TARGET,
                urgency="immediate",
                target_quantity=position.quantity,
                rationale=f"Profit target reached: {profit_pct:.1%} >= {profit_target:.1%}",
                features_snapshot={
                    "unrealized_pnl": unrealized_pnl,
                    "profit_pct": profit_pct,
                    "target_pct": profit_target,
                    "strategy": strategy,
                },
            )
        
        # Check stop loss for credit spreads
        if "stop_loss_multiplier" in rules and credit_received > 0:
            max_loss_threshold = credit_received * rules["stop_loss_multiplier"] * 100
            if unrealized_pnl < -max_loss_threshold:
                return ExitSignal(
                    position_id=position.asset_id,
                    symbol=position.symbol,
                    reason=ExitReason.STOP_LOSS,
                    urgency="immediate",
                    target_quantity=position.quantity,
                    rationale=f"Stop loss: loss ${abs(unrealized_pnl):.2f} > ${max_loss_threshold:.2f}",
                    features_snapshot={
                        "unrealized_pnl": unrealized_pnl,
                        "credit_received": credit_received,
                        "multiplier": rules["stop_loss_multiplier"],
                    },
                )
        
        # Check stop loss percentage
        if "stop_loss_pct" in rules:
            stop_pct = rules["stop_loss_pct"]
            if unrealized_pct < -stop_pct:
                return ExitSignal(
                    position_id=position.asset_id,
                    symbol=position.symbol,
                    reason=ExitReason.STOP_LOSS,
                    urgency="immediate",
                    target_quantity=position.quantity,
                    rationale=f"Stop loss: {unrealized_pct:.1%} < -{stop_pct:.1%}",
                    features_snapshot={
                        "unrealized_pct": unrealized_pct,
                        "stop_pct": stop_pct,
                    },
                )
        
        # Check time stop (DTE for options)
        if position.dte is not None:
            time_stop_dte = rules.get("time_stop_dte", 7)
            if position.dte <= time_stop_dte:
                return ExitSignal(
                    position_id=position.asset_id,
                    symbol=position.symbol,
                    reason=ExitReason.TIME_STOP,
                    urgency="eod",
                    target_quantity=position.quantity,
                    rationale=f"Time stop: DTE {position.dte} <= {time_stop_dte}",
                    features_snapshot={
                        "dte": position.dte,
                        "time_stop_dte": time_stop_dte,
                    },
                )
        
        # Check news shock
        if market_context:
            sentiment = market_context.get("sentiment", {}).get(position.underlying, {})
            if sentiment.get("shock_headline", False):
                return ExitSignal(
                    position_id=position.asset_id,
                    symbol=position.symbol,
                    reason=ExitReason.NEWS_SHOCK,
                    urgency="immediate",
                    target_quantity=position.quantity,
                    rationale=f"News shock detected for {position.underlying}",
                    features_snapshot={"sentiment": sentiment},
                )
        
        return None
    
    async def execute_exit(
        self,
        signal: ExitSignal,
        dry_run: bool = False,
    ) -> Dict[str, Any]:
        """Execute an exit order via Alpaca."""
        result = {
            "success": False,
            "order_id": None,
            "error": None,
            "signal": signal.to_dict(),
            "dry_run": dry_run,
        }
        
        if dry_run:
            result["success"] = True
            result["order_id"] = f"DRY_{signal.position_id}_{datetime.utcnow().strftime('%H%M%S')}"
            return result
        
        if not HTTPX_AVAILABLE:
            result["error"] = "httpx not available"
            return result
        
        position = self._alpaca_positions.get(signal.position_id)
        if not position:
            result["error"] = f"Position {signal.position_id} not found in Alpaca"
            return result
        
        try:
            # Build client_order_id
            timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
            client_order_id = f"EXIT_{signal.reason.value}_{position.symbol}_{timestamp}"
            
            async with httpx.AsyncClient() as client:
                if position.position_type == "equity":
                    # Close equity via DELETE
                    response = await client.delete(
                        f"{self._base_url}/v2/positions/{position.symbol}",
                        headers=self._get_headers(),
                        timeout=10.0,
                    )
                else:
                    # Close option via order
                    side = "sell" if position.quantity > 0 else "buy"
                    order_data = {
                        "symbol": position.symbol,
                        "qty": str(abs(signal.target_quantity)),
                        "side": side,
                        "type": "market",
                        "time_in_force": "day",
                        "client_order_id": client_order_id,
                    }
                    
                    response = await client.post(
                        f"{self._base_url}/v2/orders",
                        headers=self._get_headers(),
                        json=order_data,
                        timeout=10.0,
                    )
                
                if response.status_code in [200, 201, 204]:
                    try:
                        order_data = response.json()
                        result["order_id"] = order_data.get("id", client_order_id)
                    except:
                        result["order_id"] = client_order_id
                    result["success"] = True
                    logger.info(f"Exit order placed: {result['order_id']}")
                else:
                    result["error"] = f"Alpaca API error: {response.status_code} - {response.text}"
                    logger.error(result["error"])
                    
        except Exception as e:
            result["error"] = str(e)
            logger.error(f"Error executing exit: {e}")
        
        return result
    
    async def run_monitoring_pass(
        self,
        market_context: Optional[Dict[str, Any]] = None,
        dry_run: bool = False,
        trigger: str = "scheduled",
    ) -> MonitoringReport:
        """
        Run a complete monitoring pass.
        
        1. Load positions from Alpaca
        2. Cross-reference with internal ledger
        3. Evaluate exit rules
        4. Execute exits
        5. Generate report
        """
        start_time = datetime.utcnow()
        report_id = f"MON_{start_time.strftime('%Y%m%d%H%M%S')}"
        
        report = MonitoringReport(
            report_id=report_id,
            timestamp=start_time,
            trigger=trigger,
        )
        
        try:
            # Load Alpaca positions
            alpaca_positions = await self.load_alpaca_positions()
            report.positions_checked = len(alpaca_positions)
            
            # Get internal positions for cross-reference
            internal_positions = {}
            if self._position_manager:
                for p in self._position_manager.get_open_positions():
                    internal_positions[p.symbol] = p
            
            # Evaluate each position
            exit_signals = []
            for alp_pos in alpaca_positions:
                internal = internal_positions.get(alp_pos.symbol)
                
                signal = self.evaluate_exit_rules(alp_pos, internal, market_context)
                if signal:
                    exit_signals.append(signal)
                    self._pending_exits[signal.position_id] = signal
                    
                    event = MonitoringEvent(
                        event_id=self._generate_event_id(),
                        event_type="exit_signal",
                        position_id=signal.position_id,
                        symbol=signal.symbol,
                        timestamp=datetime.utcnow(),
                        details={
                            "reason": signal.reason.value,
                            "rationale": signal.rationale,
                            "urgency": signal.urgency,
                        },
                    )
                    report.events.append(event)
                    
                    if self._on_exit_signal:
                        self._on_exit_signal(signal)
            
            report.exits_triggered = len(exit_signals)
            
            # Execute exits
            for signal in exit_signals:
                if signal.urgency == "immediate" or not dry_run:
                    result = await self.execute_exit(signal, dry_run=dry_run)
                    
                    if result["success"]:
                        report.orders_placed += 1
                        event = MonitoringEvent(
                            event_id=self._generate_event_id(),
                            event_type="exit_order_placed",
                            position_id=signal.position_id,
                            symbol=signal.symbol,
                            timestamp=datetime.utcnow(),
                            details={
                                "order_id": result["order_id"],
                                "reason": signal.reason.value,
                                "dry_run": result.get("dry_run", False),
                            },
                        )
                        report.events.append(event)
                    else:
                        report.orders_rejected += 1
                        report.errors.append(result.get("error", "Unknown error"))
            
        except Exception as e:
            report.errors.append(str(e))
            logger.error(f"Error in monitoring pass: {e}")
        
        end_time = datetime.utcnow()
        report.duration_ms = (end_time - start_time).total_seconds() * 1000
        
        self._reports.append(report)
        self._last_run = end_time
        
        if self._on_report:
            self._on_report(report)
        
        logger.info(
            f"Monitoring pass complete ({trigger}): "
            f"{report.positions_checked} checked, "
            f"{report.exits_triggered} exits, "
            f"{report.orders_placed} orders"
        )
        
        return report
    
    def get_alpaca_positions(self) -> List[UnifiedAlpacaPosition]:
        """Get cached Alpaca positions."""
        return list(self._alpaca_positions.values())
    
    def get_pending_exits(self) -> List[ExitSignal]:
        """Get pending exit signals."""
        return list(self._pending_exits.values())
    
    def get_last_report(self) -> Optional[MonitoringReport]:
        """Get the most recent monitoring report."""
        return self._reports[-1] if self._reports else None
    
    def get_reports(self, limit: int = 10) -> List[MonitoringReport]:
        """Get recent monitoring reports."""
        return self._reports[-limit:]
    
    def set_callbacks(
        self,
        on_exit_signal: Optional[Callable[[ExitSignal], None]] = None,
        on_report: Optional[Callable[[MonitoringReport], None]] = None,
    ):
        """Set callback functions for events."""
        self._on_exit_signal = on_exit_signal
        self._on_report = on_report


# Global instance
_position_monitor: Optional[PositionMonitor] = None


def get_position_monitor() -> PositionMonitor:
    """Get or create the global position monitor."""
    global _position_monitor
    if _position_monitor is None:
        from .position_manager import PositionManager
        _position_monitor = PositionMonitor(position_manager=PositionManager())
    return _position_monitor
