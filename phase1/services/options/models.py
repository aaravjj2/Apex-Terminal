"""
Options Data Models
Dataclasses for options contracts, chains, and analytics
"""

from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Optional, List, Dict, Literal
from enum import Enum
import math


def _safe_round(val, ndigits):
    if val is None:
        return None
    try:
        if not math.isfinite(val):
            return None
        return round(val, ndigits)
    except Exception:
        return None


def _safe_float(val):
    if val is None:
        return None
    try:
        f = float(val)
        return f if math.isfinite(f) else None
    except Exception:
        return None


def _sanitize_list(vals, ndigits=None):
    if vals is None:
        return None
    sanitized = []
    for v in vals:
        if v is None:
            sanitized.append(None)
        else:
            try:
                fv = float(v)
                if not math.isfinite(fv):
                    sanitized.append(None)
                else:
                    sanitized.append(round(fv, ndigits) if ndigits is not None else fv)
            except Exception:
                sanitized.append(None)
    return sanitized


class OptionType(str, Enum):
    CALL = "call"
    PUT = "put"


class PositionType(str, Enum):
    LONG = "long"
    SHORT = "short"


@dataclass
class Greeks:
    """Option Greeks"""
    delta: float = 0.0
    gamma: float = 0.0
    theta: float = 0.0  # Daily theta
    vega: float = 0.0   # Per 1% IV change
    rho: float = 0.0    # Per 1% rate change
    
    def to_dict(self) -> Dict[str, float]:
        return {
            "delta": _safe_round(self.delta, 4),
            "gamma": _safe_round(self.gamma, 6),
            "theta": _safe_round(self.theta, 4),
            "vega": _safe_round(self.vega, 4),
            "rho": _safe_round(self.rho, 4),
        }


@dataclass
class OptionContract:
    """Single option contract"""
    symbol: str                      # Underlying symbol
    contract_symbol: str             # Full contract symbol (e.g., AAPL240119C00150000)
    option_type: OptionType
    strike: float
    expiration: date
    
    # Market data
    bid: Optional[float] = None
    ask: Optional[float] = None
    last: Optional[float] = None
    mark: Optional[float] = None     # Mid price
    volume: int = 0
    open_interest: int = 0
    
    # Calculated values
    implied_volatility: Optional[float] = None
    greeks: Optional[Greeks] = None
    
    # Metadata
    in_the_money: bool = False
    days_to_expiration: int = 0
    
    @property
    def mid_price(self) -> Optional[float]:
        # Compute mid only for finite bid/ask values
        if self.bid is not None and self.ask is not None:
            if math.isfinite(self.bid) and math.isfinite(self.ask):
                return (self.bid + self.ask) / 2
        if self.mark is not None and math.isfinite(self.mark):
            return self.mark
        if self.last is not None and math.isfinite(self.last):
            return self.last
        return None
    
    def to_dict(self) -> Dict:
        return {
            "symbol": self.symbol,
            "contract_symbol": self.contract_symbol,
            "option_type": self.option_type.value,
            "strike": _safe_float(self.strike),
            "expiration": self.expiration.isoformat(),
            "bid": _safe_float(self.bid),
            "ask": _safe_float(self.ask),
            "last": _safe_float(self.last),
            "mark": _safe_float(self.mark),
            "mid_price": _safe_float(self.mid_price),
            "volume": self.volume,
            "open_interest": self.open_interest,
            "implied_volatility": _safe_round(self.implied_volatility, 4),
            "greeks": self.greeks.to_dict() if self.greeks else None,
            "in_the_money": self.in_the_money,
            "days_to_expiration": self.days_to_expiration,
        }


@dataclass
class OptionChain:
    """Full option chain for a symbol"""
    symbol: str
    underlying_price: float
    expirations: List[date]
    contracts: List[OptionContract]
    timestamp: datetime = field(default_factory=datetime.utcnow)
    provider: str = "unknown"
    
    def calls(self, expiration: Optional[date] = None) -> List[OptionContract]:
        contracts = [c for c in self.contracts if c.option_type == OptionType.CALL]
        if expiration:
            contracts = [c for c in contracts if c.expiration == expiration]
        return sorted(contracts, key=lambda c: c.strike)
    
    def puts(self, expiration: Optional[date] = None) -> List[OptionContract]:
        contracts = [c for c in self.contracts if c.option_type == OptionType.PUT]
        if expiration:
            contracts = [c for c in contracts if c.expiration == expiration]
        return sorted(contracts, key=lambda c: c.strike)
    
    def by_expiration(self, expiration: date) -> List[OptionContract]:
        return [c for c in self.contracts if c.expiration == expiration]
    
    def to_dict(self) -> Dict:
        return {
            "symbol": self.symbol,
            "underlying_price": _safe_float(self.underlying_price),
            "expirations": [e.isoformat() for e in self.expirations],
            "contracts": [c.to_dict() for c in self.contracts],
            "timestamp": self.timestamp.isoformat(),
            "provider": self.provider,
        }


@dataclass
class IVAnalytics:
    """Implied Volatility analytics for a symbol"""
    symbol: str
    current_iv: float                    # Current ATM IV
    iv_rank: float                       # 0-100 rank in lookback period
    iv_percentile: float                 # 0-100 percentile in lookback period
    iv_high: float                       # High in lookback
    iv_low: float                        # Low in lookback
    lookback_days: int = 252             # Trading days
    timestamp: datetime = field(default_factory=datetime.utcnow)
    
    def to_dict(self) -> Dict:
        return {
            "symbol": self.symbol,
            "current_iv": round(self.current_iv, 4),
            "iv_rank": round(self.iv_rank, 2),
            "iv_percentile": round(self.iv_percentile, 2),
            "iv_high": round(self.iv_high, 4),
            "iv_low": round(self.iv_low, 4),
            "lookback_days": self.lookback_days,
            "timestamp": self.timestamp.isoformat(),
        }


@dataclass
class VolatilitySkew:
    """Volatility skew for a single expiration"""
    symbol: str
    expiration: date
    strikes: List[float]
    ivs: List[float]
    atm_strike: float
    atm_iv: float
    
    # Key metrics
    skew_slope: float                    # Slope of IV vs strike
    delta25_put_iv: Optional[float] = None
    delta25_call_iv: Optional[float] = None
    skew_ratio: Optional[float] = None   # 25Δ put IV / 25Δ call IV
    
    def to_dict(self) -> Dict:
        return {
            "symbol": self.symbol,
            "expiration": self.expiration.isoformat(),
            "strikes": _sanitize_list(self.strikes),
            "ivs": _sanitize_list(self.ivs, 4),
            "atm_strike": _safe_float(self.atm_strike),
            "atm_iv": _safe_round(self.atm_iv, 4),
            "skew_slope": _safe_round(self.skew_slope, 6),
            "delta25_put_iv": _safe_round(self.delta25_put_iv, 4) if self.delta25_put_iv else None,
            "delta25_call_iv": _safe_round(self.delta25_call_iv, 4) if self.delta25_call_iv else None,
            "skew_ratio": _safe_round(self.skew_ratio, 4) if self.skew_ratio else None,
        }


@dataclass
class TermStructure:
    """IV term structure across expirations"""
    symbol: str
    expirations: List[date]
    days_to_expiration: List[int]
    ivs: List[float]
    
    # Structure classification
    structure_type: Literal["contango", "backwardation", "flat", "inverted"]
    
    def to_dict(self) -> Dict:
        return {
            "symbol": self.symbol,
            "expirations": [e.isoformat() for e in self.expirations],
            "days_to_expiration": self.days_to_expiration,
            "ivs": _sanitize_list(self.ivs, 4),
            "structure_type": self.structure_type,
        }


@dataclass
class StrategyLeg:
    """Single leg of an options strategy"""
    option_type: Literal["call", "put", "stock"]
    position: PositionType
    strike: float
    premium: float
    quantity: int = 1
    expiration_days: int = 30
    iv: float = 0.30
    
    @property
    def sign(self) -> int:
        return 1 if self.position == PositionType.LONG else -1
    
    def to_dict(self) -> Dict:
        return {
            "option_type": self.option_type,
            "position": self.position.value,
            "strike": self.strike,
            "premium": self.premium,
            "quantity": self.quantity,
            "expiration_days": self.expiration_days,
            "iv": self.iv,
        }


@dataclass
class StrategyAnalysis:
    """Analysis results for an options strategy"""
    name: str
    legs: List[StrategyLeg]
    underlying_price: float
    
    # Payoff data
    price_range: List[float]
    expiration_payoff: List[float]
    theoretical_payoff: List[float]
    
    # Risk metrics
    max_profit: float
    max_loss: float
    breakevens: List[float]
    
    # Greeks
    net_delta: float
    net_gamma: float
    net_theta: float
    net_vega: float
    
    # Probabilities (if calculable)
    probability_of_profit: Optional[float] = None
    
    def to_dict(self) -> Dict:
        return {
            "name": self.name,
            "legs": [leg.to_dict() for leg in self.legs],
            "underlying_price": self.underlying_price,
            "price_range": self.price_range,
            "expiration_payoff": self.expiration_payoff,
            "theoretical_payoff": self.theoretical_payoff,
            "max_profit": self.max_profit,
            "max_loss": self.max_loss,
            "breakevens": self.breakevens,
            "net_delta": round(self.net_delta, 4),
            "net_gamma": round(self.net_gamma, 6),
            "net_theta": round(self.net_theta, 4),
            "net_vega": round(self.net_vega, 4),
            "probability_of_profit": round(self.probability_of_profit, 4) if self.probability_of_profit else None,
        }


@dataclass
class PutCallRatio:
    """Put/Call ratio analytics"""
    symbol: str
    volume_pcr: float                    # Put volume / Call volume
    oi_pcr: float                        # Put OI / Call OI
    total_put_volume: int
    total_call_volume: int
    total_put_oi: int
    total_call_oi: int
    timestamp: datetime = field(default_factory=datetime.utcnow)
    
    def to_dict(self) -> Dict:
        return {
            "symbol": self.symbol,
            "volume_pcr": round(self.volume_pcr, 4),
            "oi_pcr": round(self.oi_pcr, 4),
            "total_put_volume": self.total_put_volume,
            "total_call_volume": self.total_call_volume,
            "total_put_oi": self.total_put_oi,
            "total_call_oi": self.total_call_oi,
            "timestamp": self.timestamp.isoformat(),
        }
