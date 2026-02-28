"""
Waves 41-43 — Strategy System v2
StrategySpec v2 with validation, AI assist, and candidate generation.
"""
from __future__ import annotations
import hashlib
import json
import re
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import List, Dict, Optional, Any


class IndicatorType(str, Enum):
    SMA = "sma"
    EMA = "ema"
    RSI = "rsi"
    MACD = "macd"
    BOLLINGER = "bollinger"
    ATR = "atr"
    VWAP = "vwap"
    STOCHASTIC = "stochastic"


class SignalType(str, Enum):
    CROSSOVER = "crossover"
    THRESHOLD = "threshold"
    BREAKOUT = "breakout"
    MEAN_REVERSION = "mean_reversion"
    MOMENTUM = "momentum"


class EntryCondition(str, Enum):
    AND = "and"
    OR = "or"


@dataclass
class IndicatorSpec:
    indicator: IndicatorType
    params: Dict[str, Any] = field(default_factory=dict)

    def validate(self) -> List[str]:
        errors = []
        if self.indicator == IndicatorType.SMA:
            period = self.params.get("period", 0)
            if not isinstance(period, (int, float)) or period < 2:
                errors.append(f"SMA period must be >= 2, got {period}")
        elif self.indicator == IndicatorType.RSI:
            period = self.params.get("period", 14)
            if not isinstance(period, (int, float)) or period < 2:
                errors.append(f"RSI period must be >= 2, got {period}")
        elif self.indicator == IndicatorType.EMA:
            period = self.params.get("period", 0)
            if not isinstance(period, (int, float)) or period < 2:
                errors.append(f"EMA period must be >= 2, got {period}")
        return errors

    def to_dict(self) -> Dict[str, Any]:
        return {"indicator": self.indicator.value, "params": self.params}


@dataclass
class StrategySpecV2:
    """StrategySpec v2 — fully validated, schema-first strategy definition."""
    spec_id: str
    name: str
    description: str = ""
    version: int = 2
    universe: List[str] = field(default_factory=lambda: ["AAPL"])
    indicators: List[IndicatorSpec] = field(default_factory=list)
    signal_type: SignalType = SignalType.CROSSOVER
    entry_condition: EntryCondition = EntryCondition.AND
    position_size_pct: float = 0.10   # % of equity per position
    stop_loss_pct: float = 0.02
    take_profit_pct: float = 0.05
    max_positions: int = 5
    rebalance_days: int = 0  # 0 = no rebalance
    params: Dict[str, Any] = field(default_factory=dict)
    created_at: str = ""
    source: str = "manual"  # manual, ai_assist, mutation
    parent_id: Optional[str] = None

    def __post_init__(self):
        if not self.created_at:
            self.created_at = datetime.utcnow().isoformat() + "Z"

    @property
    def spec_hash(self) -> str:
        payload = json.dumps({
            "name": self.name,
            "indicators": [i.to_dict() for i in self.indicators],
            "signal_type": self.signal_type.value,
            "params": self.params,
        }, sort_keys=True)
        return hashlib.sha256(payload.encode()).hexdigest()[:12]

    def validate(self) -> List[str]:
        """Validate the strategy spec. Returns list of errors."""
        errors = []
        if not self.name or len(self.name) < 2:
            errors.append("Name must be at least 2 characters")
        if not self.universe:
            errors.append("Universe must contain at least one symbol")
        if self.position_size_pct <= 0 or self.position_size_pct > 1:
            errors.append(f"position_size_pct must be in (0, 1], got {self.position_size_pct}")
        if self.stop_loss_pct < 0 or self.stop_loss_pct > 0.5:
            errors.append(f"stop_loss_pct must be in [0, 0.5], got {self.stop_loss_pct}")
        if self.take_profit_pct < 0:
            errors.append(f"take_profit_pct must be >= 0, got {self.take_profit_pct}")
        if self.max_positions < 1 or self.max_positions > 100:
            errors.append(f"max_positions must be in [1, 100], got {self.max_positions}")
        for ind in self.indicators:
            errors.extend(ind.validate())
        return errors

    def lint(self) -> List[str]:
        """Lint rules (warnings, not errors)."""
        warnings = []
        if self.stop_loss_pct == 0:
            warnings.append("No stop-loss configured — high drawdown risk")
        if self.position_size_pct > 0.25:
            warnings.append(f"Large position size ({self.position_size_pct:.0%}) — concentration risk")
        if len(self.indicators) == 0:
            warnings.append("No indicators defined")
        if len(self.universe) > 50:
            warnings.append(f"Large universe ({len(self.universe)} symbols) may slow backtest")
        return warnings

    def to_dict(self) -> Dict[str, Any]:
        return {
            "spec_id": self.spec_id,
            "name": self.name,
            "description": self.description,
            "version": self.version,
            "universe": self.universe,
            "indicators": [i.to_dict() for i in self.indicators],
            "signal_type": self.signal_type.value,
            "entry_condition": self.entry_condition.value,
            "position_size_pct": self.position_size_pct,
            "stop_loss_pct": self.stop_loss_pct,
            "take_profit_pct": self.take_profit_pct,
            "max_positions": self.max_positions,
            "rebalance_days": self.rebalance_days,
            "params": self.params,
            "created_at": self.created_at,
            "source": self.source,
            "parent_id": self.parent_id,
            "spec_hash": self.spec_hash,
        }


# ── Wave 42: AI Assist ──

@dataclass
class AIAssistResult:
    request_text: str
    parsed_spec: Optional[StrategySpecV2]
    validation_errors: List[str]
    lint_warnings: List[str]
    accepted: bool
    refusal_reason: Optional[str] = None
    repair_applied: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return {
            "request_text": self.request_text[:200],
            "parsed_spec": self.parsed_spec.to_dict() if self.parsed_spec else None,
            "validation_errors": self.validation_errors,
            "lint_warnings": self.lint_warnings,
            "accepted": self.accepted,
            "refusal_reason": self.refusal_reason,
            "repair_applied": self.repair_applied,
        }


def ai_assist_parse(request_text: str) -> AIAssistResult:
    """
    Parse natural language strategy description into StrategySpec v2.
    Schema-first: output must conform to StrategySpecV2 or be refused.
    """
    text_lower = request_text.lower()

    # Refusal cases
    refusal_patterns = [
        "live trad", "real money", "production", "margin", "leverage >",
        "guaranteed profit", "risk.?free", "infinite",
    ]
    for pat in refusal_patterns:
        if re.search(pat, text_lower):
            return AIAssistResult(
                request_text=request_text,
                parsed_spec=None,
                validation_errors=[],
                lint_warnings=[],
                accepted=False,
                refusal_reason=f"Refused: request contains '{pat}' — not supported for safety",
            )

    # Parse indicators from text
    indicators: List[IndicatorSpec] = []
    if "sma" in text_lower or "moving average" in text_lower:
        # Extract period
        period_match = re.search(r'(\d+)\s*(?:day|period|bar)', text_lower)
        period = int(period_match.group(1)) if period_match else 20
        indicators.append(IndicatorSpec(IndicatorType.SMA, {"period": period}))
    if "ema" in text_lower:
        period_match = re.search(r'ema\s*(\d+)', text_lower)
        period = int(period_match.group(1)) if period_match else 12
        indicators.append(IndicatorSpec(IndicatorType.EMA, {"period": period}))
    if "rsi" in text_lower:
        period_match = re.search(r'rsi\s*(\d+)', text_lower)
        period = int(period_match.group(1)) if period_match else 14
        indicators.append(IndicatorSpec(IndicatorType.RSI, {"period": period}))
    if "macd" in text_lower:
        indicators.append(IndicatorSpec(IndicatorType.MACD, {"fast": 12, "slow": 26, "signal": 9}))

    if not indicators:
        indicators.append(IndicatorSpec(IndicatorType.SMA, {"period": 20}))

    # Parse signal type
    signal = SignalType.CROSSOVER
    if "momentum" in text_lower:
        signal = SignalType.MOMENTUM
    elif "mean reversion" in text_lower or "reversal" in text_lower:
        signal = SignalType.MEAN_REVERSION
    elif "breakout" in text_lower:
        signal = SignalType.BREAKOUT

    # Parse symbols
    symbols_match = re.findall(r'\b([A-Z]{1,5})\b', request_text)
    universe = list(set(symbols_match)) if symbols_match else ["AAPL", "MSFT"]

    spec_id = f"ai-{hashlib.sha256(request_text.encode()).hexdigest()[:8]}"
    spec = StrategySpecV2(
        spec_id=spec_id,
        name=f"AI: {request_text[:50]}",
        description=request_text[:200],
        universe=universe[:10],
        indicators=indicators,
        signal_type=signal,
        source="ai_assist",
    )

    errors = spec.validate()
    warnings = spec.lint()

    # Auto-repair
    repair_applied = False
    if errors:
        # Try to repair common issues
        for ind in spec.indicators:
            if ind.indicator == IndicatorType.SMA and ind.params.get("period", 0) < 2:
                ind.params["period"] = 20
                repair_applied = True
        errors = spec.validate()

    accepted = len(errors) == 0
    return AIAssistResult(
        request_text=request_text,
        parsed_spec=spec if accepted else None,
        validation_errors=errors,
        lint_warnings=warnings,
        accepted=accepted,
        refusal_reason=None if accepted else "; ".join(errors),
        repair_applied=repair_applied,
    )


# ── Wave 43: Candidate Generator ──

def generate_candidates(base_spec: StrategySpecV2,
                        n_mutations: int = 10,
                        seed: int = 42) -> List[StrategySpecV2]:
    """Generate strategy candidates via mutation operators."""
    import random
    rng = random.Random(seed)
    candidates: List[StrategySpecV2] = [base_spec]

    for i in range(n_mutations):
        # Clone base spec with mutations
        new_indicators = []
        for ind in base_spec.indicators:
            new_params = dict(ind.params)
            for key in new_params:
                if isinstance(new_params[key], (int, float)):
                    factor = rng.uniform(0.5, 2.0)
                    new_val = new_params[key] * factor
                    new_params[key] = int(max(2, new_val)) if isinstance(new_params[key], int) else round(new_val, 2)
            new_indicators.append(IndicatorSpec(ind.indicator, new_params))

        candidate = StrategySpecV2(
            spec_id=f"mut-{base_spec.spec_id[:8]}-{i+1:03d}",
            name=f"{base_spec.name} (mutation {i+1})",
            description=f"Mutation {i+1} of {base_spec.name}",
            universe=base_spec.universe,
            indicators=new_indicators,
            signal_type=base_spec.signal_type,
            position_size_pct=round(base_spec.position_size_pct * rng.uniform(0.8, 1.2), 2),
            stop_loss_pct=round(base_spec.stop_loss_pct * rng.uniform(0.8, 1.2), 4),
            take_profit_pct=round(base_spec.take_profit_pct * rng.uniform(0.8, 1.2), 4),
            max_positions=base_spec.max_positions,
            source="mutation",
            parent_id=base_spec.spec_id,
        )

        errors = candidate.validate()
        if not errors:
            candidates.append(candidate)

    return candidates


# ── Wave 44-45: Job Queue ──

class JobStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class Job:
    job_id: str
    job_type: str  # sweep, walk_forward, robustness, backtest
    status: JobStatus = JobStatus.QUEUED
    progress: float = 0.0
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    created_at: str = ""
    started_at: str = ""
    completed_at: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "job_id": self.job_id,
            "job_type": self.job_type,
            "status": self.status.value,
            "progress": round(self.progress, 2),
            "result": self.result,
            "error": self.error,
            "created_at": self.created_at,
            "started_at": self.started_at,
            "completed_at": self.completed_at,
        }


class JobQueue:
    """Simple synchronous job queue for sweeps/walk-forward."""

    def __init__(self) -> None:
        self._jobs: Dict[str, Job] = {}
        self._counter = 0

    def submit(self, job_type: str) -> Job:
        self._counter += 1
        job_id = f"job-{self._counter:06d}"
        job = Job(
            job_id=job_id,
            job_type=job_type,
            created_at=datetime.utcnow().isoformat() + "Z",
        )
        self._jobs[job_id] = job
        # Auto-complete for now (synchronous)
        job.status = JobStatus.COMPLETED
        job.progress = 1.0
        job.completed_at = datetime.utcnow().isoformat() + "Z"
        return job

    def get(self, job_id: str) -> Optional[Job]:
        return self._jobs.get(job_id)

    def cancel(self, job_id: str) -> bool:
        job = self._jobs.get(job_id)
        if job and job.status in (JobStatus.QUEUED, JobStatus.RUNNING):
            job.status = JobStatus.CANCELLED
            return True
        return False

    def list_jobs(self) -> List[Job]:
        return list(self._jobs.values())

    def clear_completed(self) -> int:
        completed = [jid for jid, j in self._jobs.items() if j.status in (JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED)]
        for jid in completed:
            del self._jobs[jid]
        return len(completed)


# Singletons
_job_queue: Optional[JobQueue] = None

def get_job_queue() -> JobQueue:
    global _job_queue
    if _job_queue is None:
        _job_queue = JobQueue()
    return _job_queue
