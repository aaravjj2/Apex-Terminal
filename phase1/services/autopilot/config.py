"""
Autopilot Configuration

Manages all settings for the paper-only AI options autopilot including:
- Budget and risk limits
- Universe and strategy whitelists
- Forecast influence settings
- LLM enablement

V1 CONTRACT (Non-negotiable):
- Max open positions: 10
- Max total exposure: $1,000
- Per-position stop loss: 10%
- Allowed templates: LONG_CALL, LONG_PUT only
"""

from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any
from enum import Enum
from functools import lru_cache
import json
import os
import logging

logger = logging.getLogger(__name__)


# ============================================================================
# V1 CONTRACT CONSTANTS (Non-negotiable)
# ============================================================================
V1_MAX_OPEN_POSITIONS = 10          # Max 10 positions at a time
V1_MAX_TOTAL_EXPOSURE_USD = 1000.0  # Max $1,000 total exposure
V1_PER_POSITION_STOP_PCT = 0.10     # 10% hard stop per position
V1_PAPER_EQUITY = 1000.0            # $1,000 paper account


class AutopilotMode(str, Enum):
    """Autopilot operating mode."""
    PAUSED = "paused"
    PAPER = "paper"  # Only paper mode supported


class StrategyTemplate(str, Enum):
    """Available strategy templates."""
    # V1 Single-leg templates (primary)
    LONG_CALL = "long_call"
    LONG_PUT = "long_put"
    
    # V2+ Spread templates (gated off in v1)
    PUT_CREDIT_SPREAD = "put_credit_spread"
    CALL_CREDIT_SPREAD = "call_credit_spread"
    IRON_CONDOR = "iron_condor"
    CALL_DEBIT_SPREAD = "call_debit_spread"
    PUT_DEBIT_SPREAD = "put_debit_spread"


# V1 Mode: only single-leg templates allowed
V1_TEMPLATES = [StrategyTemplate.LONG_CALL, StrategyTemplate.LONG_PUT]


# ============================================================================
# V1 UNIVERSE WHITELIST - STRICTLY ENFORCED
# ============================================================================
# Only these symbols are allowed for trading. Any symbol not in this list
# will be REJECTED even if added to autopilot_config.json
# This prevents accidental trading of illiquid or unwanted symbols.
# ============================================================================
DEFAULT_UNIVERSE = [
    "SPY",   # S&P 500 ETF - most liquid
    "GLD",   # Gold ETF - hedging
    "GOOGL", # Google - large cap tech
    "NVDA",  # NVIDIA - high volatility tech
    "AAPL",  # Apple - high liquidity
]

# Symbols that are NEVER allowed (explicitly blocked)
BLOCKED_SYMBOLS = ["SLV", "PPLT", "USO", "TLT"]  # Low liquidity or problematic

# Universe clusters for concentration limits
UNIVERSE_CLUSTERS = {
    "mega_tech": ["AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "META", "TSLA", "AMD", "INTC", "PLTR"],
    "broad_etfs": ["SPY", "QQQ"],
    "sector_tech": ["XLK", "SMH"],
    "sector_fin": ["XLF"],
    "sector_energy": ["XLE"],
    "hedges": ["GLD", "PPLT"],
}


@dataclass
class RiskLimits:
    """
    V1 Risk management limits for paper trading.
    
    V1 CONTRACT (Non-negotiable):
    - Max 10 open positions
    - Max $1,000 total exposure (HARD LIMIT)
    - 15% hard stop per position
    - Percentage-based limits for scalability
    
    HIGH WIN RATE OPTIMIZATIONS:
    - Smaller position sizes (10% per trade)
    - Tighter daily loss cap (10%)
    - Concentration limits to force diversification
    """
    # V1 CONTRACT LIMITS
    max_open_positions: int = V1_MAX_OPEN_POSITIONS        # 10 positions max
    max_total_exposure_usd: float = V1_MAX_TOTAL_EXPOSURE_USD  # $1,000 max (HARD)
    per_position_stop_pct: float = V1_PER_POSITION_STOP_PCT  # 10% stop loss per position (V1 CONTRACT)
    
    # V1 PERCENTAGE-BASED LIMITS (OPTIMIZED for $1000 micro-account)
    max_risk_per_trade_pct: float = 0.10  # 10% of equity per trade ($100 for $1000)
    max_buying_power_pct: float = 0.50    # 50% max buying power utilization
    max_daily_loss_pct: float = 0.10      # 10% daily loss cap ($100 for $1000)
    
    # Additional position limits (stricter)
    max_daily_trades: int = 6             # Max 6 trades per day (quality over quantity)
    max_positions_per_underlying: int = 1  # Only 1 position per ticker
    max_positions_per_cluster: int = 2
    max_cluster_risk_pct: float = 0.40    # 40% max in any cluster
    
    # HARD DOLLAR LIMITS (absolute caps)
    max_single_position_usd: float = 150.0  # Max $150 per position (absolute)
    max_total_cost_usd: float = 500.0       # Max $500 total deployed (50% of $1000)
    
    # Legacy dollar amounts (computed from percentages in validate())
    max_risk_per_trade: float = 100.0     # $100 for $1000 account (10%)
    max_total_risk: float = 500.0         # $500 for $1000 account (50%)
    max_daily_loss: float = 100.0         # $100 for $1000 account (10%)
    
    def validate_for_equity(self, equity: float) -> 'RiskLimits':
        """
        Compute dollar amounts from percentage limits.
        
        V1 COMPLIANCE: All risk calculations are percentage-based.
        """
        # Compute dollar values from percentages
        self.max_risk_per_trade = equity * self.max_risk_per_trade_pct
        self.max_total_risk = equity * self.max_buying_power_pct
        self.max_daily_loss = equity * self.max_daily_loss_pct
        
        logger.info(
            f"V1 Risk Limits for ${equity:.0f} equity: "
            f"per-trade=${self.max_risk_per_trade:.0f} ({self.max_risk_per_trade_pct*100:.0f}%), "
            f"buying power=${self.max_total_risk:.0f} ({self.max_buying_power_pct*100:.0f}%)"
        )
        
        return self


@dataclass
class StrategyConstraints:
    """Constraints for strategy templates (spreads)."""
    min_dte: int = 1
    max_dte: int = 60
    min_short_delta: float = 0.15
    max_short_delta: float = 0.35
    min_spread_width: float = 1.0
    max_spread_width: float = 10.0
    max_slippage_pct: float = 0.05
    # Exit rules
    take_profit_pct: float = 0.50  # 50% of max profit
    time_stop_dte: int = 1  # Close when DTE <= 1
    loss_stop_multiplier: float = 2.0  # 2x credit received


@dataclass
class AntiThrashControls:
    """
    V1 Anti-thrash controls to prevent excessive trading after losses.
    
    These controls protect against:
    1. Rapid re-entry after a stop-out (per-ticker cooldown)
    2. Consecutive stop-outs triggering a circuit breaker
    3. Daily loss limit to prevent catastrophic drawdown
    """
    # Per-ticker cooldown after stop-out
    ticker_cooldown_seconds: int = 1800  # 30 minutes after stop-out
    
    # Consecutive stop-out circuit breaker
    max_consecutive_stopouts: int = 3  # After 3 consecutive stops, pause
    circuit_breaker_duration_seconds: int = 3600  # 1 hour pause
    
    # Daily loss limit (conservative)
    daily_loss_limit_pct: float = 0.05  # 5% of equity (more conservative than 10%)
    
    # Trade frequency limits
    min_seconds_between_entries: int = 60  # 1 minute minimum between entries


@dataclass
class SingleLegConstraints:
    """
    Constraints for single-leg options (v1).
    
    HIGH WIN RATE SETTINGS (OPTIMIZED):
    - Prefer ATM-ITM options (0.40-0.60 delta) for higher probability
    - Tight stop loss at 15% to preserve capital
    - Take profits at 20% to lock in wins quickly
    - Scale out: partial exit at 10%, rest at 20%
    - Prefer 7-21 DTE sweet spot for theta vs movement
    - Require minimum IV percentile for edge
    """
    # Delta targeting - ATM-focused for higher probability
    target_delta_min: float = 0.40  # Slightly ITM
    target_delta_max: float = 0.60  # ATM to slightly ITM
    # Risk parameters - OPTIMIZED for high win rate
    stop_loss_pct: float = -0.15  # Exit at -15% premium loss
    profit_target_pct: float = 0.20  # Exit at +20% premium gain (faster)
    partial_profit_pct: float = 0.10  # Take partial at +10%
    partial_exit_ratio: float = 0.50  # Exit 50% at partial target
    break_even_trigger_pct: float = 0.08  # Move stop to break-even at +8%
    # Time management
    time_stop_eod: bool = True  # Flatten at end of day for 0DTE
    max_dte: int = 21  # Max 21 days to expiration
    min_dte: int = 5   # Min 5 DTE (avoid gamma risk)
    optimal_dte_min: int = 7   # Optimal range start
    optimal_dte_max: int = 14  # Optimal range end
    # Liquidity requirements (stricter)
    min_bid: float = 0.15  # Minimum bid price (higher = more liquid)
    max_spread_pct: float = 0.10  # Max bid-ask spread as % of mid (tighter)
    min_open_interest: int = 100  # Minimum open interest
    min_volume: int = 10  # Minimum daily volume
    # IV requirements
    min_iv_percentile: float = 0.20  # Min IV percentile (edge exists)
    max_iv_percentile: float = 0.70  # Max IV percentile (not overpaying)


@dataclass
class EarningsPolicy:
    """Earnings event handling policy."""
    blackout_days_before: int = 7  # No new short premium 7 days before
    auto_close_before_earnings: bool = True  # Close short premium before event
    close_days_before: int = 1  # Days before earnings to close


@dataclass
class ForecastSettings:
    """Settings for forecast influence on decisions."""
    enabled: bool = True
    influence_weight: float = 0.5  # 0-1, how much forecast affects scoring
    min_confidence: float = 0.4  # Minimum confidence to use forecast
    auto_downweight_on_miscalibration: bool = True


class LLMMode(str, Enum):
    """LLM selection mode."""
    OFF = "off"
    GROQ = "groq"
    GEMINI = "gemini"
    HYBRID = "hybrid"  # Groq for ranking, Gemini for validation
    DETERMINISTIC = "deterministic"  # Fallback only


@dataclass
class LLMSettings:
    """Settings for optional LLM ranking."""
    enabled: bool = True
    mode: LLMMode = LLMMode.HYBRID
    groq_model: Optional[str] = None  # Defaults to groq/compound
    gemini_model: Optional[str] = None  # Defaults to gemini-1.5-flash
    endpoint_url: Optional[str] = None  # For custom HTTP endpoints
    timeout_seconds: float = 30.0
    fallback_to_deterministic: bool = True


@dataclass
class AutopilotConfig:
    """Complete autopilot configuration."""
    # Mode
    mode: AutopilotMode = AutopilotMode.PAPER
    auto_execute: bool = True  # Auto-execute paper trades
    enable_alpaca: bool = True  # Enable mirroring trades to Alpaca

    # Continuous run control
    continuous_run: bool = True  # Keep running cycles until stopped

    # Focus controls (single underlying)
    focus_symbol: Optional[str] = None  # If set, only trade this underlying
    max_symbols_per_cycle: int = 5  # Evaluate top 5 symbols per cycle
    contracts_per_trade: int = 1  # 1 contract per trade for $1000 budget
    weekly_expiry_only: bool = True  # Prefer weekly expiry options
    
    # Budget (paper equity) - $1000 limit
    paper_equity: float = 1000.0
    
    # Feature Flags
    enable_finbert: bool = False
    
    # Risk limits
    risk_limits: RiskLimits = field(default_factory=RiskLimits)
    
    # Anti-thrash controls (V1)
    anti_thrash: AntiThrashControls = field(default_factory=AntiThrashControls)
    
    # Universe
    universe: List[str] = field(default_factory=lambda: DEFAULT_UNIVERSE.copy())
    
    # Strategy whitelist - V1: LONG_CALL and LONG_PUT only
    # Credit spreads/iron condors require V2+
    allowed_strategies: List[StrategyTemplate] = field(
        default_factory=lambda: V1_TEMPLATES.copy()
    )
    
    # Feature flag for Phase 1.5 debit verticals
    enable_debit_verticals: bool = False
    
    # Strategy constraints
    strategy_constraints: StrategyConstraints = field(
        default_factory=StrategyConstraints
    )
    
    # Earnings policy
    earnings_policy: EarningsPolicy = field(default_factory=EarningsPolicy)
    
    # Forecast settings
    forecast_settings: ForecastSettings = field(default_factory=ForecastSettings)
    
    # LLM settings
    llm_settings: LLMSettings = field(default_factory=LLMSettings)
    
    # Schedule (times in HH:MM format, America/New_York)
    scan_times: List[str] = field(default_factory=lambda: ["09:35", "12:00", "15:30"])
    
    def validate(self) -> None:
        """
        Validate config against V1 contract rules.
        
        V1 CONTRACT ENFORCEMENT:
        - Only LONG_CALL and LONG_PUT templates allowed
        - Risk limits must respect V1 constraints
        
        Raises:
            ValueError: If config violates V1 contract
        """
        # V1 CONTRACT: Only long premium templates allowed
        for template in self.allowed_strategies:
            if template not in V1_TEMPLATES:
                raise ValueError(
                    f"V1 Contract Violation: Template '{template.value}' is not allowed in V1. "
                    f"Only LONG_CALL and LONG_PUT are permitted. Short premium (spreads) "
                    f"require V2+."
                )
        
        # V1 CONTRACT: Validate risk limits
        if self.risk_limits.max_open_positions > V1_MAX_OPEN_POSITIONS:
            raise ValueError(
                f"V1 Contract Violation: max_open_positions ({self.risk_limits.max_open_positions}) "
                f"exceeds V1 limit ({V1_MAX_OPEN_POSITIONS})."
            )
        
        logger.info("V1 Config validation passed")
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert config to dictionary for API/storage."""
        return {
            "mode": self.mode.value,
            "auto_execute": self.auto_execute,
            "paper_equity": self.paper_equity,
            "continuous_run": self.continuous_run,
            "focus_symbol": self.focus_symbol,
            "max_symbols_per_cycle": self.max_symbols_per_cycle,
            "contracts_per_trade": self.contracts_per_trade,
            "weekly_expiry_only": self.weekly_expiry_only,
            "risk_limits": {
                "max_risk_per_trade": self.risk_limits.max_risk_per_trade,
                "max_total_risk": self.risk_limits.max_total_risk,
                "max_daily_loss": self.risk_limits.max_daily_loss,
                "max_open_positions": self.risk_limits.max_open_positions,
                "max_positions_per_underlying": self.risk_limits.max_positions_per_underlying,
                "max_positions_per_cluster": self.risk_limits.max_positions_per_cluster,
                "max_cluster_risk_pct": self.risk_limits.max_cluster_risk_pct,
            },
            "universe": self.universe,
            "allowed_strategies": [s.value for s in self.allowed_strategies],
            "strategy_constraints": {
                "min_dte": self.strategy_constraints.min_dte,
                "max_dte": self.strategy_constraints.max_dte,
                "min_short_delta": self.strategy_constraints.min_short_delta,
                "max_short_delta": self.strategy_constraints.max_short_delta,
                "min_spread_width": self.strategy_constraints.min_spread_width,
                "max_spread_width": self.strategy_constraints.max_spread_width,
                "take_profit_pct": self.strategy_constraints.take_profit_pct,
                "time_stop_dte": self.strategy_constraints.time_stop_dte,
                "loss_stop_multiplier": self.strategy_constraints.loss_stop_multiplier,
            },
            "earnings_policy": {
                "blackout_days_before": self.earnings_policy.blackout_days_before,
                "auto_close_before_earnings": self.earnings_policy.auto_close_before_earnings,
                "close_days_before": self.earnings_policy.close_days_before,
            },
            "forecast_settings": {
                "enabled": self.forecast_settings.enabled,
                "influence_weight": self.forecast_settings.influence_weight,
                "min_confidence": self.forecast_settings.min_confidence,
            },
            "llm_settings": {
                "enabled": self.llm_settings.enabled,
                "endpoint_url": self.llm_settings.endpoint_url,
                "fallback_to_deterministic": self.llm_settings.fallback_to_deterministic,
            },
            "scan_times": self.scan_times,
            "enable_debit_verticals": self.enable_debit_verticals,
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'AutopilotConfig':
        """Create config from dictionary."""
        config = cls()
        
        if "mode" in data:
            config.mode = AutopilotMode(data["mode"])
        if "auto_execute" in data:
            config.auto_execute = data["auto_execute"]
        if "paper_equity" in data:
            config.paper_equity = float(data["paper_equity"])

        if "continuous_run" in data:
            config.continuous_run = bool(data["continuous_run"])
        if "focus_symbol" in data:
            focus = data["focus_symbol"]
            config.focus_symbol = focus.upper() if isinstance(focus, str) and focus.strip() else None
        if "max_symbols_per_cycle" in data:
            config.max_symbols_per_cycle = int(data["max_symbols_per_cycle"])
        if "contracts_per_trade" in data:
            config.contracts_per_trade = int(data["contracts_per_trade"])
        if "weekly_expiry_only" in data:
            config.weekly_expiry_only = bool(data["weekly_expiry_only"])
        
        if "risk_limits" in data:
            rl = data["risk_limits"]
            config.risk_limits = RiskLimits(
                max_risk_per_trade=rl.get("max_risk_per_trade", 50.0),
                max_total_risk=rl.get("max_total_risk", 400.0),
                max_daily_loss=rl.get("max_daily_loss", 30.0),
                max_open_positions=rl.get("max_open_positions", 10),
                max_positions_per_underlying=rl.get("max_positions_per_underlying", 2),
                max_positions_per_cluster=rl.get("max_positions_per_cluster", 2),
                max_cluster_risk_pct=rl.get("max_cluster_risk_pct", 0.6),
                max_daily_trades=rl.get("max_daily_trades", 20),  # Load from config!
                max_risk_per_trade_pct=rl.get("max_risk_per_trade_pct", 0.20),
                max_buying_power_pct=rl.get("max_buying_power_pct", 0.50),
            )
        
        if "universe" in data:
            # V1 UNIVERSE ENFORCEMENT: Only allow symbols from DEFAULT_UNIVERSE
            # This prevents misconfiguration that could trade unintended symbols
            requested_universe = data["universe"]
            validated_universe = [s for s in requested_universe if s in DEFAULT_UNIVERSE]
            invalid_symbols = [s for s in requested_universe if s not in DEFAULT_UNIVERSE]
            
            if invalid_symbols:
                logger.warning(
                    f"V1 UNIVERSE ENFORCEMENT: Removed invalid symbols: {invalid_symbols}. "
                    f"Only these are allowed: {DEFAULT_UNIVERSE}"
                )
            
            # Use validated universe, or default if empty
            config.universe = validated_universe if validated_universe else DEFAULT_UNIVERSE.copy()
            logger.info(f"V1 Universe set to: {config.universe}")
        
        if "allowed_strategies" in data:
            requested = [StrategyTemplate(s) for s in data["allowed_strategies"]]
            # V1 enforcement: filter to only V1-allowed templates
            config.allowed_strategies = [
                s for s in requested if s in V1_TEMPLATES
            ]
            # Warn if any were filtered out
            filtered_out = [s for s in requested if s not in V1_TEMPLATES]
            if filtered_out:
                logger.warning(
                    f"V1 compliance: Filtered out non-V1 templates: {[s.value for s in filtered_out]}"
                )
        
        if "enable_debit_verticals" in data:
            config.enable_debit_verticals = bool(data["enable_debit_verticals"])
        
        if "strategy_constraints" in data:
            sc = data["strategy_constraints"]
            config.strategy_constraints = StrategyConstraints(
                min_dte=sc.get("min_dte", 14),
                max_dte=sc.get("max_dte", 45),
                min_short_delta=sc.get("min_short_delta", 0.15),
                max_short_delta=sc.get("max_short_delta", 0.35),
                min_spread_width=sc.get("min_spread_width", 1.0),
                max_spread_width=sc.get("max_spread_width", 10.0),
                take_profit_pct=sc.get("take_profit_pct", 0.50),
                time_stop_dte=sc.get("time_stop_dte", 7),
                loss_stop_multiplier=sc.get("loss_stop_multiplier", 2.0),
            )
        
        if "earnings_policy" in data:
            ep = data["earnings_policy"]
            config.earnings_policy = EarningsPolicy(
                blackout_days_before=ep.get("blackout_days_before", 7),
                auto_close_before_earnings=ep.get("auto_close_before_earnings", True),
                close_days_before=ep.get("close_days_before", 1),
            )
        
        if "forecast_settings" in data:
            fs = data["forecast_settings"]
            config.forecast_settings = ForecastSettings(
                enabled=fs.get("enabled", True),
                influence_weight=fs.get("influence_weight", 0.3),
                min_confidence=fs.get("min_confidence", 0.4),
            )
        
        if "llm_settings" in data:
            ls = data["llm_settings"]
            config.llm_settings = LLMSettings(
                enabled=ls.get("enabled", False),
                endpoint_url=ls.get("endpoint_url"),
                fallback_to_deterministic=ls.get("fallback_to_deterministic", True),
            )
        
        if "scan_times" in data:
            config.scan_times = data["scan_times"]
        
        return config
    
    def get_cluster_for_symbol(self, symbol: str) -> Optional[str]:
        """Get the cluster name for a symbol."""
        for cluster_name, symbols in UNIVERSE_CLUSTERS.items():
            if symbol in symbols:
                return cluster_name
        return None

    def validate_v1_compliance(self) -> List[str]:
        """
        Validate configuration is V1 compliant.
        Returns list of violations (empty = compliant).
        """
        violations = []
        
        # Check allowed strategies
        for strategy in self.allowed_strategies:
            if strategy not in V1_TEMPLATES:
                violations.append(
                    f"Strategy {strategy.value} not allowed in V1 (only LONG_CALL, LONG_PUT)"
                )
        
        # Check debit verticals flag
        if self.enable_debit_verticals:
            violations.append(
                "Debit verticals enabled but require Phase 1.5+ (set enable_debit_verticals=False)"
            )
        
        return violations

    def enforce_v1_templates(self) -> None:
        """Enforce V1-only templates by filtering allowed_strategies."""
        self.allowed_strategies = [
            s for s in self.allowed_strategies if s in V1_TEMPLATES
        ]
        if not self.allowed_strategies:
            self.allowed_strategies = V1_TEMPLATES.copy()

    def is_strategy_allowed(self, strategy: StrategyTemplate) -> bool:
        """Check if a strategy is allowed under current config."""
        # V1 hard gate: only V1 templates allowed
        if strategy not in V1_TEMPLATES:
            return False
        # Additional debit vertical gate for Phase 1.5
        if strategy in [StrategyTemplate.CALL_DEBIT_SPREAD, StrategyTemplate.PUT_DEBIT_SPREAD]:
            return self.enable_debit_verticals
        return strategy in self.allowed_strategies

    def is_symbol_allowed(self, symbol: str) -> bool:
        """
        Check if a symbol is allowed for trading.
        
        V1 ENFORCEMENT:
        1. Symbol must be in DEFAULT_UNIVERSE whitelist
        2. Symbol must NOT be in BLOCKED_SYMBOLS
        3. Symbol must be in current config.universe
        """
        # Check blocked list first
        if symbol in BLOCKED_SYMBOLS:
            logger.warning(f"V1 SYMBOL GATE: {symbol} is in BLOCKED_SYMBOLS list")
            return False
        
        # Check whitelist
        if symbol not in DEFAULT_UNIVERSE:
            logger.warning(f"V1 SYMBOL GATE: {symbol} not in DEFAULT_UNIVERSE whitelist")
            return False
        
        # Check current config
        if symbol not in self.universe:
            logger.debug(f"Symbol {symbol} not in current universe config")
            return False
        
        return True


# Config storage path
_CONFIG_PATH = os.path.join(
    os.path.dirname(__file__), "..", "..", "autopilot_config.json"
)

_cached_config: Optional[AutopilotConfig] = None


def get_autopilot_config() -> AutopilotConfig:
    """Get the current autopilot configuration."""
    global _cached_config
    
    if _cached_config is not None:
        return _cached_config
    
    if os.path.exists(_CONFIG_PATH):
        try:
            with open(_CONFIG_PATH, "r") as f:
                data = json.load(f)
            _cached_config = AutopilotConfig.from_dict(data)
        except Exception:
            _cached_config = AutopilotConfig()
    else:
        _cached_config = AutopilotConfig()
    
    return _cached_config


def save_autopilot_config(config: AutopilotConfig) -> None:
    """Save autopilot configuration."""
    global _cached_config
    
    with open(_CONFIG_PATH, "w") as f:
        json.dump(config.to_dict(), f, indent=2)
    
    _cached_config = config


def reset_config_cache() -> None:
    """Reset the config cache (for testing)."""
    global _cached_config
    _cached_config = None


def load_llm_config_from_env() -> LLMSettings:
    """
    Load LLM configuration from environment variables.
    
    Environment variables:
    - LLM_MODE: off|groq|gemini|hybrid|deterministic (default: deterministic)
    - GROQ_MODEL: Model name for Groq (default: groq/compound)
    - GEMINI_MODEL: Model name for Gemini (default: gemini-1.5-flash)
    - GROQ_API_KEY: API key for Groq
    - GEMINI_API_KEY: API key for Gemini
    """
    mode_str = os.environ.get("LLM_MODE", "deterministic").lower()
    
    # Map string to enum
    mode_map = {
        "off": LLMMode.OFF,
        "groq": LLMMode.GROQ,
        "gemini": LLMMode.GEMINI,
        "hybrid": LLMMode.HYBRID,
        "deterministic": LLMMode.DETERMINISTIC,
    }
    mode = mode_map.get(mode_str, LLMMode.DETERMINISTIC)
    
    # Check if keys are present
    groq_key = os.environ.get("GROQ_API_KEY")
    gemini_key = os.environ.get("GEMINI_API_KEY")
    
    # Auto-downgrade if keys missing
    if mode == LLMMode.GROQ and not groq_key:
        mode = LLMMode.DETERMINISTIC
        logger.warning("GROQ mode selected but GROQ_API_KEY not set, falling back to DETERMINISTIC")
    elif mode == LLMMode.GEMINI and not gemini_key:
        mode = LLMMode.DETERMINISTIC
        logger.warning("GEMINI mode selected but GEMINI_API_KEY not set, falling back to DETERMINISTIC")
    elif mode == LLMMode.HYBRID and (not groq_key or not gemini_key):
        if groq_key and not gemini_key:
            mode = LLMMode.GROQ
            logger.warning("HYBRID mode selected but GEMINI_API_KEY not set, using GROQ only")
        elif gemini_key and not groq_key:
            mode = LLMMode.GEMINI
            logger.warning("HYBRID mode selected but GROQ_API_KEY not set, using GEMINI only")
        else:
            mode = LLMMode.DETERMINISTIC
            logger.warning("HYBRID mode selected but no API keys set, falling back to DETERMINISTIC")
    
    enabled = mode != LLMMode.OFF and mode != LLMMode.DETERMINISTIC
    
    return LLMSettings(
        enabled=enabled,
        mode=mode,
        groq_model=os.environ.get("GROQ_MODEL"),
        gemini_model=os.environ.get("GEMINI_MODEL"),
        timeout_seconds=float(os.environ.get("LLM_TIMEOUT", "30")),
        fallback_to_deterministic=True,
    )
