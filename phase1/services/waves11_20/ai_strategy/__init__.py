"""
AI Strategy Builder — Wave 16
StrategySpec DSL, AI-powered strategy generation via Groq/Gemini,
guardrails validation, auto-sweep launcher.
"""

import json
import hashlib
import logging
from datetime import datetime, timezone
from typing import Optional, Any
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger(__name__)


class SignalType(str, Enum):
    LONG_ENTRY = "long_entry"
    LONG_EXIT = "long_exit"
    SHORT_ENTRY = "short_entry"
    SHORT_EXIT = "short_exit"


class IndicatorType(str, Enum):
    SMA = "sma"
    EMA = "ema"
    RSI = "rsi"
    MACD = "macd"
    BOLLINGER = "bollinger"
    ATR = "atr"
    VWAP = "vwap"
    VOLUME_RATIO = "volume_ratio"


class GuardrailStatus(str, Enum):
    PASS = "pass"
    FAIL = "fail"
    WARN = "warn"


@dataclass
class IndicatorSpec:
    """Single indicator definition."""
    indicator: IndicatorType
    params: dict

    def to_dict(self) -> dict:
        return {"indicator": self.indicator.value, "params": self.params}

    @classmethod
    def from_dict(cls, d: dict) -> "IndicatorSpec":
        return cls(indicator=IndicatorType(d["indicator"]), params=d.get("params", {}))


@dataclass
class SignalRule:
    """Signal generation rule."""
    signal_type: SignalType
    conditions: list[dict]   # [{indicator, operator, value_or_ref}]
    priority: int = 1

    def to_dict(self) -> dict:
        return {
            "signal_type": self.signal_type.value,
            "conditions": self.conditions,
            "priority": self.priority,
        }


@dataclass
class RiskConstraints:
    """Strategy-level risk limits."""
    max_position_pct: float = 10.0
    stop_loss_pct: float = 5.0
    take_profit_pct: float = 15.0
    max_holding_days: int = 30
    max_daily_trades: int = 5
    max_correlation: float = 0.7

    def to_dict(self) -> dict:
        return {
            "max_position_pct": self.max_position_pct,
            "stop_loss_pct": self.stop_loss_pct,
            "take_profit_pct": self.take_profit_pct,
            "max_holding_days": self.max_holding_days,
            "max_daily_trades": self.max_daily_trades,
            "max_correlation": self.max_correlation,
        }


@dataclass
class StrategySpec:
    """
    Strategy specification DSL - machine-readable strategy definition.
    The canonical way to define trading strategies in Apex Terminal.
    """
    spec_id: str
    name: str
    description: str
    version: str = "1.0"
    asset_class: str = "equity"
    timeframe: str = "daily"
    universe: list[str] = field(default_factory=list)
    indicators: list[IndicatorSpec] = field(default_factory=list)
    signals: list[SignalRule] = field(default_factory=list)
    risk: RiskConstraints = field(default_factory=RiskConstraints)
    metadata: dict = field(default_factory=dict)
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    ai_generated: bool = False
    ai_model: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "spec_id": self.spec_id,
            "name": self.name,
            "description": self.description,
            "version": self.version,
            "asset_class": self.asset_class,
            "timeframe": self.timeframe,
            "universe": self.universe,
            "indicators": [i.to_dict() for i in self.indicators],
            "signals": [s.to_dict() for s in self.signals],
            "risk": self.risk.to_dict(),
            "metadata": self.metadata,
            "created_at": self.created_at,
            "ai_generated": self.ai_generated,
            "ai_model": self.ai_model,
        }

    def to_json(self) -> str:
        return json.dumps(self.to_dict(), indent=2)

    @classmethod
    def from_dict(cls, d: dict) -> "StrategySpec":
        return cls(
            spec_id=d["spec_id"],
            name=d["name"],
            description=d["description"],
            version=d.get("version", "1.0"),
            asset_class=d.get("asset_class", "equity"),
            timeframe=d.get("timeframe", "daily"),
            universe=d.get("universe", []),
            indicators=[IndicatorSpec.from_dict(i) for i in d.get("indicators", [])],
            signals=[SignalRule(
                signal_type=SignalType(s["signal_type"]),
                conditions=s.get("conditions", []),
                priority=s.get("priority", 1),
            ) for s in d.get("signals", [])],
            risk=RiskConstraints(**d.get("risk", {})) if d.get("risk") else RiskConstraints(),
            metadata=d.get("metadata", {}),
            created_at=d.get("created_at", datetime.now(timezone.utc).isoformat()),
            ai_generated=d.get("ai_generated", False),
            ai_model=d.get("ai_model"),
        )


@dataclass
class GuardrailResult:
    """Guardrail validation result."""
    rule_name: str
    status: GuardrailStatus
    message: str
    value: Optional[Any] = None
    limit: Optional[Any] = None

    def to_dict(self) -> dict:
        return {
            "rule_name": self.rule_name,
            "status": self.status.value,
            "message": self.message,
            "value": self.value,
            "limit": self.limit,
        }


@dataclass
class SweepJob:
    """Auto-sweep job for parameter search."""
    job_id: str
    spec_id: str
    param_ranges: list[dict]
    status: str = "pending"
    total_combos: int = 0
    completed: int = 0
    best_sharpe: float = 0
    best_params: dict = field(default_factory=dict)
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def to_dict(self) -> dict:
        return {
            "job_id": self.job_id,
            "spec_id": self.spec_id,
            "param_ranges": self.param_ranges,
            "status": self.status,
            "total_combos": self.total_combos,
            "completed": self.completed,
            "best_sharpe": round(self.best_sharpe, 4),
            "best_params": self.best_params,
            "created_at": self.created_at,
        }


# Guardrail rule definitions
GUARDRAIL_RULES = {
    "max_indicators": {"limit": 10, "message": "Too many indicators (max 10)"},
    "min_indicators": {"limit": 1, "message": "At least 1 indicator required"},
    "max_position_pct": {"limit": 25.0, "message": "Position size too large (max 25%)"},
    "min_stop_loss": {"limit": 1.0, "message": "Stop loss too tight (min 1%)"},
    "max_stop_loss": {"limit": 20.0, "message": "Stop loss too wide (max 20%)"},
    "no_leverage": {"limit": None, "message": "Leverage is not allowed (paper-only broker)"},
    "equity_only": {"limit": None, "message": "Only equity asset class is supported"},
    "max_daily_trades": {"limit": 20, "message": "Too many daily trades (max 20)"},
    "max_holding_days": {"limit": 90, "message": "Holding period too long for swing (max 90 days)"},
}


class AIStrategyBuilder:
    """
    AI-powered strategy generation with DSL, guardrails, and auto-sweep.
    Uses Groq/Gemini for strategy suggestion, never relies on Nova.
    """

    def __init__(self):
        self._specs: dict[str, StrategySpec] = {}
        self._sweep_jobs: dict[str, SweepJob] = {}

    def create_spec(
        self,
        name: str,
        description: str,
        indicators: list[IndicatorSpec],
        signals: list[SignalRule],
        universe: Optional[list[str]] = None,
        risk: Optional[RiskConstraints] = None,
    ) -> StrategySpec:
        """Create a strategy spec from components."""
        spec_id = f"spec-{hashlib.md5(f'{name}{datetime.now(timezone.utc).isoformat()}'.encode()).hexdigest()[:10]}"
        spec = StrategySpec(
            spec_id=spec_id,
            name=name,
            description=description,
            universe=universe or [],
            indicators=indicators,
            signals=signals,
            risk=risk or RiskConstraints(),
        )
        self._specs[spec_id] = spec
        return spec

    def validate_guardrails(self, spec: StrategySpec) -> list[GuardrailResult]:
        """Validate strategy spec against guardrail rules."""
        results = []

        # Indicator count
        n = len(spec.indicators)
        if n > GUARDRAIL_RULES["max_indicators"]["limit"]:
            results.append(GuardrailResult("max_indicators", GuardrailStatus.FAIL,
                           GUARDRAIL_RULES["max_indicators"]["message"], n, 10))
        if n < GUARDRAIL_RULES["min_indicators"]["limit"]:
            results.append(GuardrailResult("min_indicators", GuardrailStatus.FAIL,
                           GUARDRAIL_RULES["min_indicators"]["message"], n, 1))

        # Position size
        if spec.risk.max_position_pct > GUARDRAIL_RULES["max_position_pct"]["limit"]:
            results.append(GuardrailResult("max_position_pct", GuardrailStatus.FAIL,
                           GUARDRAIL_RULES["max_position_pct"]["message"],
                           spec.risk.max_position_pct, 25.0))

        # Stop loss
        if spec.risk.stop_loss_pct < GUARDRAIL_RULES["min_stop_loss"]["limit"]:
            results.append(GuardrailResult("min_stop_loss", GuardrailStatus.FAIL,
                           GUARDRAIL_RULES["min_stop_loss"]["message"],
                           spec.risk.stop_loss_pct, 1.0))
        if spec.risk.stop_loss_pct > GUARDRAIL_RULES["max_stop_loss"]["limit"]:
            results.append(GuardrailResult("max_stop_loss", GuardrailStatus.FAIL,
                           GUARDRAIL_RULES["max_stop_loss"]["message"],
                           spec.risk.stop_loss_pct, 20.0))

        # Equity only
        if spec.asset_class != "equity":
            results.append(GuardrailResult("equity_only", GuardrailStatus.FAIL,
                           GUARDRAIL_RULES["equity_only"]["message"],
                           spec.asset_class, "equity"))

        # Max daily trades
        if spec.risk.max_daily_trades > GUARDRAIL_RULES["max_daily_trades"]["limit"]:
            results.append(GuardrailResult("max_daily_trades", GuardrailStatus.FAIL,
                           GUARDRAIL_RULES["max_daily_trades"]["message"],
                           spec.risk.max_daily_trades, 20))

        # Max holding days for swing
        if spec.risk.max_holding_days > GUARDRAIL_RULES["max_holding_days"]["limit"]:
            results.append(GuardrailResult("max_holding_days", GuardrailStatus.FAIL,
                           GUARDRAIL_RULES["max_holding_days"]["message"],
                           spec.risk.max_holding_days, 90))

        if not results:
            results.append(GuardrailResult("all_passed", GuardrailStatus.PASS,
                           "All guardrail checks passed"))

        return results

    def parse_ai_response(self, ai_json: str) -> Optional[StrategySpec]:
        """Parse AI-generated strategy JSON into StrategySpec."""
        try:
            data = json.loads(ai_json)
            spec = StrategySpec.from_dict(data)
            spec.ai_generated = True
            self._specs[spec.spec_id] = spec
            return spec
        except (json.JSONDecodeError, KeyError, ValueError) as e:
            logger.error(f"Failed to parse AI strategy response: {e}")
            return None

    def build_ai_prompt(self, objective: str, constraints: Optional[dict] = None) -> str:
        """Build prompt for Groq/Gemini strategy generation."""
        base = (
            "Generate a StrategySpec JSON for a swing trading equity strategy.\n"
            f"Objective: {objective}\n"
            "Requirements:\n"
            "- asset_class must be 'equity'\n"
            "- timeframe: 'daily'\n"
            "- max 10 indicators\n"
            "- position size <= 25%\n"
            "- stop loss between 1% and 20%\n"
            "- holding period max 90 days\n"
            "- max 20 trades/day\n"
            "- NO leverage, NO short selling, NO crypto, NO options\n"
            f"- Universe: {constraints.get('universe', ['AAPL','MSFT','GOOGL','AMZN','NVDA','META','TSLA','JPM','V','UNH']) if constraints else 'AAPL,MSFT,GOOGL,AMZN,NVDA,META,TSLA,JPM,V,UNH'}\n"
            "\nReturn ONLY valid JSON matching the StrategySpec schema."
        )
        return base

    def launch_sweep(
        self,
        spec: StrategySpec,
        param_ranges: list[dict],
    ) -> SweepJob:
        """Launch a parameter sweep job."""
        job_id = f"sweep-{hashlib.md5(f'{spec.spec_id}{datetime.now(timezone.utc).isoformat()}'.encode()).hexdigest()[:10]}"

        total = 1
        for pr in param_ranges:
            vals = len(range(int(pr.get("min", 0)), int(pr.get("max", 1)) + 1, int(pr.get("step", 1))))
            total *= max(vals, 1)

        job = SweepJob(
            job_id=job_id,
            spec_id=spec.spec_id,
            param_ranges=param_ranges,
            status="running",
            total_combos=total,
        )
        self._sweep_jobs[job_id] = job
        return job

    def get_spec(self, spec_id: str) -> Optional[StrategySpec]:
        return self._specs.get(spec_id)

    def list_specs(self) -> list[StrategySpec]:
        return list(self._specs.values())

    def get_sweep(self, job_id: str) -> Optional[SweepJob]:
        return self._sweep_jobs.get(job_id)

    def list_sweeps(self) -> list[SweepJob]:
        return list(self._sweep_jobs.values())


_builder: Optional[AIStrategyBuilder] = None


def get_ai_strategy_builder() -> AIStrategyBuilder:
    global _builder
    if _builder is None:
        _builder = AIStrategyBuilder()
    return _builder
