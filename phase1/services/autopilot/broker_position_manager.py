"""
Broker Position Manager

Continuous monitoring for positions using Alpaca as source of truth.
Evaluates exit triggers (profit target, stop loss, time stops, DTE thresholds).

Key principles:
1. Alpaca is canonical - internal metadata is enrichment only
2. Every bot-opened position MUST have exit rules
3. User-opened positions are tracked but NOT auto-managed
4. Separates "what Alpaca says" from "what we track internally"
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta, date
from typing import List, Dict, Any, Optional, Callable, Tuple
from enum import Enum
import asyncio
import logging
import json
import os

logger = logging.getLogger(__name__)


# ============================================================================
# MODELS
# ============================================================================

@dataclass
class BrokerExitRule:
    """
    Exit rule attached to a managed position.
    
    HIGH WIN RATE LOGIC:
    - Hard stop loss at 8% loss (tighter = less damage per loss)
    - When profit reaches 5%, move stop to break-even (protect gains!)
    - When profit reaches 15%, set trailing stop at 10% profit
    - Profit target at 25% (take profits faster, don't give back gains)
    
    The key insight: In options, it's better to take many small wins
    than to wait for big wins that often reverse.
    """
    profit_target_pct: float = 25.0  # Take profit at 25% (faster profit taking)
    stop_loss_pct: float = 8.0       # Hard stop at 8% LOSS (tighter risk control)
    time_stop_dte: int = 1           # Close if DTE <= 1 day
    dte_threshold: int = 0           # Hard close at DTE=0
    trailing_stop_pct: Optional[float] = None  # Dynamic trailing stop
    trailing_step: float = 5.0       # Trailing follows profit - 5%
    break_even_trigger_pct: float = 5.0  # Move stop to break-even at 5% profit
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "profit_target_pct": self.profit_target_pct,
            "stop_loss_pct": self.stop_loss_pct,
            "time_stop_dte": self.time_stop_dte,
            "dte_threshold": self.dte_threshold,
            "trailing_stop_pct": self.trailing_stop_pct,
            "trailing_step": self.trailing_step,
            "break_even_trigger_pct": self.break_even_trigger_pct,
        }
    
    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "BrokerExitRule":
        return cls(
            profit_target_pct=d.get("profit_target_pct", 25.0),  # Faster profit taking
            stop_loss_pct=d.get("stop_loss_pct", 8.0),  # 8% hard stop (tighter)
            time_stop_dte=d.get("time_stop_dte", 1),
            dte_threshold=d.get("dte_threshold", 0),
            trailing_stop_pct=d.get("trailing_stop_pct"),
            trailing_step=d.get("trailing_step", 5.0),
            break_even_trigger_pct=d.get("break_even_trigger_pct", 5.0),
        )


@dataclass
class BrokerPositionMeta:
    """
    Internal metadata for a position (enrichment data).
    NOT the source of truth - links to Alpaca by symbol.
    """
    symbol: str
    run_id: str
    strategy_id: Optional[str] = None
    strategy_template: str = "unknown"
    entry_price: float = 0.0
    entry_credit: float = 0.0
    max_loss: float = 0.0
    exit_rules: BrokerExitRule = field(default_factory=BrokerExitRule)
    opened_at: datetime = field(default_factory=datetime.utcnow)
    highest_profit_pct: float = 0.0
    managed: bool = True
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "symbol": self.symbol,
            "run_id": self.run_id,
            "strategy_id": self.strategy_id,
            "strategy_template": self.strategy_template,
            "entry_price": self.entry_price,
            "entry_credit": self.entry_credit,
            "max_loss": self.max_loss,
            "exit_rules": self.exit_rules.to_dict(),
            "opened_at": self.opened_at.isoformat(),
            "highest_profit_pct": self.highest_profit_pct,
            "managed": self.managed,
        }
    
    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "BrokerPositionMeta":
        return cls(
            symbol=d["symbol"],
            run_id=d["run_id"],
            strategy_id=d.get("strategy_id"),
            strategy_template=d.get("strategy_template", "unknown"),
            entry_price=d.get("entry_price", 0.0),
            entry_credit=d.get("entry_credit", 0.0),
            max_loss=d.get("max_loss", 0.0),
            exit_rules=BrokerExitRule.from_dict(d.get("exit_rules", {})),
            opened_at=datetime.fromisoformat(d["opened_at"]) if d.get("opened_at") else datetime.utcnow(),
            highest_profit_pct=d.get("highest_profit_pct", 0.0),
            managed=d.get("managed", True),
        )


class ExitTrigger(str, Enum):
    """Types of exit triggers."""
    PROFIT_TARGET = "profit_target"
    STOP_LOSS = "stop_loss"
    TIME_STOP = "time_stop"
    DTE_THRESHOLD = "dte_threshold"
    TRAILING_STOP = "trailing_stop"
    NEWS_SHOCK = "news_shock"
    EARNINGS_SHOCK = "earnings_shock"
    EOD_FLATTEN = "eod_flatten"  # v1: Flatten 0DTE at end of day
    MANUAL = "manual"
    KILL_SWITCH = "kill_switch"


@dataclass
class BrokerExitSignal:
    """Signal to exit a position."""
    symbol: str
    trigger: ExitTrigger
    trigger_value: float
    threshold: float
    urgency: str = "normal"  # immediate/normal/low
    metadata: Optional[BrokerPositionMeta] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "symbol": self.symbol,
            "trigger": self.trigger.value,
            "trigger_value": self.trigger_value,
            "threshold": self.threshold,
            "urgency": self.urgency,
        }


@dataclass
class EnrichedBrokerPosition:
    """Position from Alpaca enriched with internal metadata."""
    # Alpaca fields (source of truth)
    symbol: str
    qty: int
    side: str
    avg_entry_price: float
    current_price: float
    market_value: float
    unrealized_pnl: float
    unrealized_pnl_pct: float
    asset_class: str
    
    # Option fields
    underlying: Optional[str] = None
    expiration: Optional[str] = None
    strike: Optional[float] = None
    option_type: Optional[str] = None
    dte: Optional[int] = None
    
    # Internal enrichment
    managed: bool = False
    run_id: Optional[str] = None
    strategy_template: Optional[str] = None
    exit_rules: Optional[BrokerExitRule] = None
    entry_credit: float = 0.0
    highest_profit_pct: float = 0.0
    current_profit_pct: float = 0.0
    exit_signals: List[BrokerExitSignal] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "symbol": self.symbol,
            "qty": self.qty,
            "side": self.side,
            "avg_entry_price": self.avg_entry_price,
            "current_price": self.current_price,
            "market_value": self.market_value,
            "unrealized_pnl": self.unrealized_pnl,
            "unrealized_pnl_pct": self.unrealized_pnl_pct,
            "asset_class": self.asset_class,
            "underlying": self.underlying,
            "expiration": self.expiration,
            "strike": self.strike,
            "option_type": self.option_type,
            "dte": self.dte,
            "managed": self.managed,
            "run_id": self.run_id,
            "strategy_template": self.strategy_template,
            "exit_rules": self.exit_rules.to_dict() if self.exit_rules else None,
            "current_profit_pct": self.current_profit_pct,
            "exit_signals": [s.to_dict() for s in self.exit_signals],
        }


# ============================================================================
# METADATA STORE
# ============================================================================

class BrokerMetaStore:
    """
    Persistent storage for position metadata (enrichment only).
    Also tracks highest profit for ALL positions (managed and unmanaged).
    """
    
    def __init__(self, storage_path: Optional[str] = None):
        self._data: Dict[str, BrokerPositionMeta] = {}
        self._highest_profits: Dict[str, float] = {}  # Track highest profit for ALL positions
        self._path = storage_path or "/tmp/broker_position_meta.json"
        self._highest_path = "/tmp/broker_highest_profits.json"
        self._load()
    
    def _load(self):
        try:
            if os.path.exists(self._path):
                with open(self._path, "r") as f:
                    raw = json.load(f)
                    for sym, d in raw.items():
                        self._data[sym] = BrokerPositionMeta.from_dict(d)
                logger.info(f"Loaded {len(self._data)} position metadata records")
        except Exception as e:
            logger.warning(f"Failed to load metadata: {e}")
        
        # Load highest profits separately
        try:
            if os.path.exists(self._highest_path):
                with open(self._highest_path, "r") as f:
                    self._highest_profits = json.load(f)
                logger.info(f"Loaded highest profits for {len(self._highest_profits)} symbols")
        except Exception as e:
            logger.warning(f"Failed to load highest profits: {e}")
    
    def _save(self):
        try:
            raw = {sym: m.to_dict() for sym, m in self._data.items()}
            with open(self._path, "w") as f:
                json.dump(raw, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save metadata: {e}")
    
    def _save_highest_profits(self):
        try:
            with open(self._highest_path, "w") as f:
                json.dump(self._highest_profits, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save highest profits: {e}")
    
    def get(self, symbol: str) -> Optional[BrokerPositionMeta]:
        return self._data.get(symbol)
    
    def set(self, meta: BrokerPositionMeta):
        self._data[meta.symbol] = meta
        self._save()
    
    def remove(self, symbol: str):
        if symbol in self._data:
            del self._data[symbol]
            self._save()
        # Also clean up highest profit tracking
        if symbol in self._highest_profits:
            del self._highest_profits[symbol]
            self._save_highest_profits()
    
    def all(self) -> List[BrokerPositionMeta]:
        return list(self._data.values())
    
    def update_highest_profit(self, symbol: str, pct: float):
        """Track highest profit for ANY position (managed or unmanaged)."""
        # Update managed position metadata if exists
        meta = self._data.get(symbol)
        if meta and pct > meta.highest_profit_pct:
            meta.highest_profit_pct = pct
            self._save()
        
        # Also track in separate store for ALL positions (including unmanaged)
        current_highest = self._highest_profits.get(symbol, 0.0)
        if pct > current_highest:
            self._highest_profits[symbol] = pct
            self._save_highest_profits()
            logger.debug(f"Updated highest profit for {symbol}: {current_highest:.1f}% -> {pct:.1f}%")
    
    def get_highest_profit(self, symbol: str) -> float:
        """Get highest profit seen for a symbol (works for all positions)."""
        # Check managed position first
        meta = self._data.get(symbol)
        if meta:
            return meta.highest_profit_pct
        # Fall back to separate tracker
        return self._highest_profits.get(symbol, 0.0)


# ============================================================================
# BROKER POSITION MANAGER
# ============================================================================

class BrokerPositionManager:
    """
    Manages positions with Alpaca as source of truth.
    
    Responsibilities:
    1. Pull positions from Alpaca
    2. Enrich with internal metadata
    3. Evaluate exit triggers
    4. Generate exit signals
    """
    
    def __init__(self, broker_client=None, store: Optional[BrokerMetaStore] = None):
        self._broker = broker_client
        self._store = store or BrokerMetaStore()
        self._on_exit_signal: Optional[Callable[[BrokerExitSignal], None]] = None
        logger.info("BrokerPositionManager initialized")
    
    def set_broker_client(self, client):
        """Inject broker client."""
        self._broker = client
    
    async def get_positions(self) -> List[EnrichedBrokerPosition]:
        """Get all positions from Alpaca, enriched."""
        alpaca_positions = await self._fetch_positions()
        return [self._enrich(p) for p in alpaca_positions]
    
    def enrich_positions(self, positions: List[Any]) -> List[EnrichedBrokerPosition]:
        """Enrich a list of Alpaca positions (objects or dicts)."""
        result = []
        for p in positions:
            d = p.to_dict() if hasattr(p, 'to_dict') else p
            result.append(self._enrich(d))
        return result
    
    async def evaluate_exits(
        self,
        positions: Optional[List[EnrichedBrokerPosition]] = None,
        news_shocks: Optional[List[str]] = None,
        earnings_shocks: Optional[List[str]] = None,
    ) -> List[BrokerExitSignal]:
        """Evaluate all positions for exits - ALL positions are monitored by default."""
        if positions is None:
            positions = await self.get_positions()
        
        signals = []
        news_shocks = news_shocks or []
        earnings_shocks = earnings_shocks or []
        
        print(f"EVALUATE EXITS: Checking {len(positions)} positions")
        
        for pos in positions:
            # IMPORTANT: Check ALL positions, not just "managed" ones
            # Every position needs stop loss protection
            print(f"EVALUATE EXITS [{pos.symbol}]: managed={pos.managed}, profit_pct={pos.current_profit_pct:.1f}%")
            
            pos_signals = self._check_triggers(pos, news_shocks, earnings_shocks)
            signals.extend(pos_signals)
            
            if pos.current_profit_pct > 0:
                self._store.update_highest_profit(pos.symbol, pos.current_profit_pct)
        
        return signals
    
    def register_position(
        self,
        symbol: str,
        run_id: str,
        strategy_template: str,
        entry_credit: float,
        max_loss: float,
        exit_rules: Optional[BrokerExitRule] = None,
    ) -> BrokerPositionMeta:
        """Register a new bot-opened position."""
        meta = BrokerPositionMeta(
            symbol=symbol,
            run_id=run_id,
            strategy_template=strategy_template,
            entry_credit=entry_credit,
            max_loss=max_loss,
            exit_rules=exit_rules or BrokerExitRule(),
            opened_at=datetime.utcnow(),
            managed=True,
        )
        self._store.set(meta)
        logger.info(f"Registered position: {symbol} from run {run_id}")
        return meta
    
    def unregister_position(self, symbol: str):
        """Unregister a closed position."""
        self._store.remove(symbol)
        logger.info(f"Unregistered position: {symbol}")
    
    # -------------------------------------------------------------------------
    # Alpaca Integration
    # -------------------------------------------------------------------------
    
    async def _fetch_positions(self) -> List[Dict]:
        """Fetch positions from Alpaca."""
        # Auto-connect broker if not set
        if not self._broker:
            try:
                from .alpaca_client import get_alpaca_client
                self._broker = get_alpaca_client()
                logger.info("Auto-connected AlpacaBrokerClient to BrokerPositionManager")
            except Exception as e:
                logger.warning(f"Could not auto-connect broker: {e}")
                return []
        
        try:
            # Fetch real positions from Alpaca
            alpaca_positions = await self._broker.list_positions()
            result = []
            for pos in alpaca_positions:
                result.append(pos.to_dict() if hasattr(pos, 'to_dict') else {
                    "symbol": pos.symbol,
                    "qty": pos.qty,
                    "side": pos.side,
                    "avg_entry_price": pos.avg_entry_price,
                    "current_price": pos.current_price,
                    "market_value": pos.market_value,
                    "unrealized_pl": pos.unrealized_pl,
                    "unrealized_plpc": pos.unrealized_plpc,
                    "asset_class": pos.asset_class,
                })
            logger.info(f"Fetched {len(result)} positions from Alpaca")
            return result
        except Exception as e:
            logger.error(f"Failed to fetch positions: {e}")
            return []
    
    def _enrich(self, alpaca_pos: Dict) -> EnrichedBrokerPosition:
        """Enrich Alpaca position with metadata."""
        symbol = alpaca_pos.get("symbol", "")
        meta = self._store.get(symbol)
        asset_class = alpaca_pos.get("asset_class", "us_equity")
        
        # Parse option fields
        underlying = expiration = strike = option_type = dte = None
        if asset_class == "us_option":
            underlying = self._parse_underlying(symbol)
            expiration = self._parse_expiration(symbol)
            strike = self._parse_strike(symbol)
            option_type = self._parse_option_type(symbol)
            dte = self._calc_dte(expiration)
        
        # Calculate profit %
        profit_pct = 0.0
        if meta and meta.entry_credit > 0:
            curr_val = float(alpaca_pos.get("market_value", 0))
            profit = meta.entry_credit - curr_val
            profit_pct = (profit / meta.entry_credit) * 100
        else:
            # For unmanaged positions, use Alpaca's unrealized P&L %
            profit_pct = float(alpaca_pos.get("unrealized_plpc", 0)) * 100
        
        return EnrichedBrokerPosition(
            symbol=symbol,
            qty=int(alpaca_pos.get("qty", 0)),
            side=alpaca_pos.get("side", "long"),
            avg_entry_price=float(alpaca_pos.get("avg_entry_price", 0)),
            current_price=float(alpaca_pos.get("current_price", 0)),
            market_value=float(alpaca_pos.get("market_value", 0)),
            unrealized_pnl=float(alpaca_pos.get("unrealized_pl", 0)),
            unrealized_pnl_pct=float(alpaca_pos.get("unrealized_plpc", 0)) * 100,
            asset_class=asset_class,
            underlying=underlying,
            expiration=expiration,
            strike=strike,
            option_type=option_type,
            dte=dte,
            managed=meta.managed if meta else False,
            run_id=meta.run_id if meta else None,
            strategy_template=meta.strategy_template if meta else None,
            exit_rules=meta.exit_rules if meta else None,
            entry_credit=meta.entry_credit if meta else 0.0,
            highest_profit_pct=self._store.get_highest_profit(symbol),  # Track for ALL positions
            current_profit_pct=profit_pct,
        )
    
    def _check_triggers(
        self,
        pos: EnrichedBrokerPosition,
        news_shocks: List[str],
        earnings_shocks: List[str],
    ) -> List[BrokerExitSignal]:
        """
        Check exit triggers for a position.
        
        HIGH WIN RATE LOGIC:
        - Hard stop at 8% LOSS (tighter = less damage)
        - Break-even stop: Once 5%+ profit, stop moves to 0% (protect capital!)
        - Trailing stop kicks in at 15%+ profit: trail = highest - 5%
        - Profit target at 25% (take wins quickly)
        """
        signals = []
        
        # Default exit rules with tighter risk control
        rules = pos.exit_rules or BrokerExitRule(
            stop_loss_pct=8.0,       # 8% hard stop (tighter)
            profit_target_pct=25.0,  # 25% profit target (faster)
            time_stop_dte=1,
            trailing_step=5.0,
            break_even_trigger_pct=5.0,  # Move to break-even at 5%
        )
        
        underlying = pos.underlying or pos.symbol
        current_pct = pos.current_profit_pct
        highest_pct = pos.highest_profit_pct
        
        print(f"MONITOR DEBUG [{pos.symbol}]: current_profit={current_pct:.1f}%, highest={highest_pct:.1f}%, stop_loss={rules.stop_loss_pct}%")
        
        # 1. HARD STOP LOSS (8% loss = immediate exit)
        if rules.stop_loss_pct > 0 and current_pct <= -rules.stop_loss_pct:
            print(f"MONITOR DEBUG [{pos.symbol}]: 🛑 HARD STOP TRIGGERED! Loss={current_pct:.1f}% exceeds {rules.stop_loss_pct}%")
            signals.append(BrokerExitSignal(
                symbol=pos.symbol,
                trigger=ExitTrigger.STOP_LOSS,
                trigger_value=current_pct,
                threshold=-rules.stop_loss_pct,
                urgency="immediate",
                metadata=pos.exit_rules,
            ))
            return signals  # Hard stop - exit immediately
        
        # 2. BREAK-EVEN STOP (activates once position was 5%+ profitable)
        break_even_trigger = getattr(rules, 'break_even_trigger_pct', 5.0)
        if highest_pct >= break_even_trigger and highest_pct < 15.0:
            # Once we've been 5%+ profitable, don't let it become a loser
            if current_pct <= 0:
                print(f"MONITOR DEBUG [{pos.symbol}]: 🔄 BREAK-EVEN STOP! Position was {highest_pct:.1f}% up, now at {current_pct:.1f}%")
                signals.append(BrokerExitSignal(
                    symbol=pos.symbol,
                    trigger=ExitTrigger.TRAILING_STOP,
                    trigger_value=current_pct,
                    threshold=0.0,  # Break-even level
                    urgency="immediate",
                    metadata=pos.exit_rules,
                ))
        
        # 3. TRAILING STOP (activates at 15%+ profit for bigger gains)
        trailing_step = getattr(rules, 'trailing_step', 5.0)
        if highest_pct >= 15.0:
            # Calculate dynamic trailing stop level
            # At 15% profit → trail at 10%, at 25% → trail at 20%, etc.
            trailing_stop_level = highest_pct - trailing_step
            
            if current_pct <= trailing_stop_level:
                print(f"MONITOR DEBUG [{pos.symbol}]: 📉 TRAILING STOP TRIGGERED! Current={current_pct:.1f}% fell below trail={trailing_stop_level:.1f}% (high was {highest_pct:.1f}%)")
                signals.append(BrokerExitSignal(
                    symbol=pos.symbol,
                    trigger=ExitTrigger.TRAILING_STOP,
                    trigger_value=current_pct,
                    threshold=trailing_stop_level,
                    urgency="immediate",
                    metadata=pos.exit_rules,
                ))
        
        # 4. Profit target (25% profit = take the win!) - V1: Execute immediately
        if rules.profit_target_pct > 0 and current_pct >= rules.profit_target_pct:
            print(f"MONITOR DEBUG [{pos.symbol}]: 🎯 PROFIT TARGET! {current_pct:.1f}% >= {rules.profit_target_pct}%")
            signals.append(BrokerExitSignal(
                symbol=pos.symbol,
                trigger=ExitTrigger.PROFIT_TARGET,
                trigger_value=current_pct,
                threshold=rules.profit_target_pct,
                urgency="immediate",  # V1: Auto-execute profit targets
            ))
        
        # 4. Time stop (DTE threshold) - V1: Execute immediately when approaching expiry
        if pos.dte is not None and rules.time_stop_dte > 0 and pos.dte <= rules.time_stop_dte:
            print(f"MONITOR DEBUG [{pos.symbol}]: ⏰ TIME STOP! DTE={pos.dte} <= {rules.time_stop_dte}")
            signals.append(BrokerExitSignal(
                symbol=pos.symbol,
                trigger=ExitTrigger.TIME_STOP,
                trigger_value=pos.dte,
                threshold=rules.time_stop_dte,
                urgency="immediate",  # V1: Auto-execute time stops
            ))
        
        # 5. DTE threshold (hard close at expiration)
        if pos.dte is not None and pos.dte <= rules.dte_threshold:
            print(f"MONITOR DEBUG [{pos.symbol}]: 🔚 DTE THRESHOLD! DTE={pos.dte} <= {rules.dte_threshold}")
            signals.append(BrokerExitSignal(
                symbol=pos.symbol,
                trigger=ExitTrigger.DTE_THRESHOLD,
                trigger_value=pos.dte,
                threshold=rules.dte_threshold,
                urgency="immediate",
            ))
        
        # 6. News/earnings shocks
        if underlying in news_shocks:
            signals.append(BrokerExitSignal(
                symbol=pos.symbol,
                trigger=ExitTrigger.NEWS_SHOCK,
                trigger_value=0,
                threshold=0,
                urgency="immediate",
            ))
        
        if underlying in earnings_shocks:
            signals.append(BrokerExitSignal(
                symbol=pos.symbol,
                trigger=ExitTrigger.EARNINGS_SHOCK,
                trigger_value=0,
                threshold=0,
                urgency="immediate",
            ))
        
        # 7. EOD Flatten for 0DTE positions
        if pos.dte is not None and pos.dte == 0:
            try:
                from ..market_calendar import get_market_calendar
                calendar = get_market_calendar()
                time_to_close = calendar.time_to_close()
                
                if time_to_close is not None:
                    minutes_to_close = time_to_close.total_seconds() / 60
                    if minutes_to_close <= 30:  # 30 mins before close
                        signals.append(BrokerExitSignal(
                            symbol=pos.symbol,
                            trigger=ExitTrigger.EOD_FLATTEN,
                            trigger_value=minutes_to_close,
                            threshold=30.0,
                            urgency="immediate",
                        ))
            except Exception as e:
                logger.warning(f"Failed to check EOD flatten: {e}")
        
        return signals
    
    # -------------------------------------------------------------------------
    # OCC Symbol Parsing
    # -------------------------------------------------------------------------
    
    def _parse_underlying(self, occ: str) -> Optional[str]:
        if len(occ) < 15:
            return None
        for i, c in enumerate(occ):
            if c.isdigit():
                return occ[:i].rstrip()
        return None
    
    def _parse_expiration(self, occ: str) -> Optional[str]:
        if len(occ) < 15:
            return None
        try:
            underlying = self._parse_underlying(occ)
            if underlying:
                dt = occ[len(underlying):len(underlying)+6]
                return f"20{dt[:2]}-{dt[2:4]}-{dt[4:6]}"
        except:
            pass
        return None
    
    def _parse_strike(self, occ: str) -> Optional[float]:
        if len(occ) < 15:
            return None
        try:
            return float(occ[-8:]) / 1000
        except:
            return None
    
    def _parse_option_type(self, occ: str) -> Optional[str]:
        if len(occ) < 15:
            return None
        c = occ[-9]
        return "call" if c == "C" else "put" if c == "P" else None
    
    def _calc_dte(self, exp: Optional[str]) -> Optional[int]:
        if not exp:
            return None
        try:
            return (datetime.strptime(exp, "%Y-%m-%d").date() - date.today()).days
        except:
            return None


# ============================================================================
# Singleton
# ============================================================================

_broker_manager: Optional[BrokerPositionManager] = None


def get_broker_position_manager() -> BrokerPositionManager:
    global _broker_manager
    if _broker_manager is None:
        _broker_manager = BrokerPositionManager()
    return _broker_manager
