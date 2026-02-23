"""
Strategy Discovery Engine — Wave 15
Candidate generator, walk-forward evaluation, robustness testing,
overfit penalty, portfolio strategy selection, best strategy report.
"""

import math
import hashlib
import logging
from datetime import datetime, timezone
from typing import Optional
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger(__name__)


class StrategyTemplate(str, Enum):
    SMA_CROSSOVER = "sma_crossover"
    RSI_MEAN_REVERSION = "rsi_mean_reversion"
    BREAKOUT = "breakout"
    MOMENTUM = "momentum"
    PAIRS_TRADING = "pairs_trading"


@dataclass
class ParameterRange:
    name: str
    min_val: float
    max_val: float
    step: float
    default: float

    def values(self) -> list[float]:
        vals = []
        v = self.min_val
        while v <= self.max_val:
            vals.append(round(v, 4))
            v += self.step
        return vals

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "min": self.min_val,
            "max": self.max_val,
            "step": self.step,
            "default": self.default,
        }


@dataclass
class StrategyCandidate:
    candidate_id: str
    template: StrategyTemplate
    params: dict
    mutation_source: Optional[str] = None  # Parent candidate ID

    def to_dict(self) -> dict:
        return {
            "candidate_id": self.candidate_id,
            "template": self.template.value,
            "params": self.params,
            "mutation_source": self.mutation_source,
        }


@dataclass
class WalkForwardResult:
    candidate_id: str
    in_sample_sharpe: float
    out_sample_sharpe: float
    in_sample_return: float
    out_sample_return: float
    degradation_ratio: float  # out/in Sharpe ratio
    passed: bool
    folds: int

    def to_dict(self) -> dict:
        return {
            "candidate_id": self.candidate_id,
            "in_sample_sharpe": round(self.in_sample_sharpe, 4),
            "out_sample_sharpe": round(self.out_sample_sharpe, 4),
            "in_sample_return": round(self.in_sample_return, 4),
            "out_sample_return": round(self.out_sample_return, 4),
            "degradation_ratio": round(self.degradation_ratio, 4),
            "passed": self.passed,
            "folds": self.folds,
        }


@dataclass
class RobustnessResult:
    candidate_id: str
    param_sensitivity: float  # 0-1, lower is more robust
    market_regime_stability: float  # 0-1, higher is more stable
    overfit_penalty: float  # 0-1, lower is less overfit
    robustness_score: float  # Combined 0-1

    def to_dict(self) -> dict:
        return {
            "candidate_id": self.candidate_id,
            "param_sensitivity": round(self.param_sensitivity, 4),
            "market_regime_stability": round(self.market_regime_stability, 4),
            "overfit_penalty": round(self.overfit_penalty, 4),
            "robustness_score": round(self.robustness_score, 4),
        }


@dataclass
class DiscoveryReport:
    report_id: str
    timestamp: str
    candidates_evaluated: int
    candidates_passed_wf: int
    candidates_passed_robustness: int
    best_candidate_id: Optional[str]
    best_sharpe: float
    best_return: float
    best_robustness: float
    walk_forward_pass: bool
    selected_portfolio: list[dict]  # Low-correlation set
    report_data: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "report_id": self.report_id,
            "timestamp": self.timestamp,
            "candidates_evaluated": self.candidates_evaluated,
            "candidates_passed_wf": self.candidates_passed_wf,
            "candidates_passed_robustness": self.candidates_passed_robustness,
            "best_candidate_id": self.best_candidate_id,
            "best_sharpe": round(self.best_sharpe, 4),
            "best_return": round(self.best_return, 4),
            "best_robustness": round(self.best_robustness, 4),
            "walk_forward_pass": self.walk_forward_pass,
            "selected_portfolio": self.selected_portfolio,
        }


# Template parameter ranges
TEMPLATE_PARAMS: dict[StrategyTemplate, list[ParameterRange]] = {
    StrategyTemplate.SMA_CROSSOVER: [
        ParameterRange("fast_period", 5, 30, 5, 10),
        ParameterRange("slow_period", 20, 100, 10, 50),
        ParameterRange("position_size_pct", 3, 10, 1, 5),
    ],
    StrategyTemplate.RSI_MEAN_REVERSION: [
        ParameterRange("rsi_period", 7, 21, 2, 14),
        ParameterRange("oversold", 20, 35, 5, 30),
        ParameterRange("overbought", 65, 80, 5, 70),
        ParameterRange("position_size_pct", 3, 10, 1, 5),
    ],
    StrategyTemplate.BREAKOUT: [
        ParameterRange("lookback", 10, 50, 5, 20),
        ParameterRange("atr_multiplier", 1.0, 3.0, 0.5, 2.0),
        ParameterRange("position_size_pct", 3, 10, 1, 5),
    ],
    StrategyTemplate.MOMENTUM: [
        ParameterRange("lookback", 20, 120, 10, 60),
        ParameterRange("holding_period", 5, 30, 5, 10),
        ParameterRange("position_size_pct", 3, 10, 1, 5),
    ],
    StrategyTemplate.PAIRS_TRADING: [
        ParameterRange("lookback", 20, 60, 10, 30),
        ParameterRange("z_entry", 1.5, 3.0, 0.5, 2.0),
        ParameterRange("z_exit", 0.0, 1.0, 0.25, 0.5),
    ],
}


class StrategyDiscoveryEngine:
    """
    Strategy discovery with candidate generation, walk-forward,
    robustness testing, and portfolio selection.
    """

    def __init__(self):
        self._candidates: list[StrategyCandidate] = []
        self._wf_results: list[WalkForwardResult] = []
        self._robustness_results: list[RobustnessResult] = []
        self._reports: list[DiscoveryReport] = []

    def generate_candidates(
        self,
        template: StrategyTemplate,
        max_candidates: int = 20,
    ) -> list[StrategyCandidate]:
        """Generate strategy candidates from template + parameter mutations."""
        params_list = TEMPLATE_PARAMS.get(template, [])
        candidates = []

        # Generate grid of parameter combinations
        from itertools import product
        param_values = [p.values() for p in params_list]
        param_names = [p.name for p in params_list]

        for combo in list(product(*param_values))[:max_candidates]:
            params = dict(zip(param_names, combo))
            cid = f"cand-{hashlib.md5(f'{template.value}{str(params)}'.encode()).hexdigest()[:10]}"
            candidate = StrategyCandidate(
                candidate_id=cid,
                template=template,
                params=params,
            )
            candidates.append(candidate)

        self._candidates.extend(candidates)
        return candidates

    def evaluate_walk_forward(
        self,
        candidate: StrategyCandidate,
        sharpe_values: list[tuple[float, float]],  # (in_sample, out_sample) per fold
        min_degradation: float = 0.5,
    ) -> WalkForwardResult:
        """Evaluate walk-forward stability."""
        folds = len(sharpe_values)
        if folds == 0:
            return WalkForwardResult(
                candidate_id=candidate.candidate_id,
                in_sample_sharpe=0, out_sample_sharpe=0,
                in_sample_return=0, out_sample_return=0,
                degradation_ratio=0, passed=False, folds=0,
            )

        in_sharps = [s[0] for s in sharpe_values]
        out_sharps = [s[1] for s in sharpe_values]
        avg_in = sum(in_sharps) / folds
        avg_out = sum(out_sharps) / folds
        degradation = avg_out / avg_in if avg_in > 0 else 0

        result = WalkForwardResult(
            candidate_id=candidate.candidate_id,
            in_sample_sharpe=avg_in,
            out_sample_sharpe=avg_out,
            in_sample_return=avg_in * 0.1,  # Proxy
            out_sample_return=avg_out * 0.1,
            degradation_ratio=degradation,
            passed=degradation >= min_degradation and avg_out > 0,
            folds=folds,
        )
        self._wf_results.append(result)
        return result

    def evaluate_robustness(
        self,
        candidate: StrategyCandidate,
        neighbor_sharpes: list[float],  # Sharpe values for parameter neighbors
        regime_sharpes: list[float],    # Sharpe values for different regimes
        base_sharpe: float,
    ) -> RobustnessResult:
        """Evaluate strategy robustness."""
        # Parameter sensitivity: std of neighbor sharpes / mean
        if neighbor_sharpes and base_sharpe > 0:
            mean_n = sum(neighbor_sharpes) / len(neighbor_sharpes)
            var_n = sum((s - mean_n) ** 2 for s in neighbor_sharpes) / max(len(neighbor_sharpes) - 1, 1)
            param_sens = math.sqrt(var_n) / max(abs(base_sharpe), 0.01)
            param_sens = min(param_sens, 1.0)
        else:
            param_sens = 0.5

        # Regime stability
        if regime_sharpes:
            positive_regimes = sum(1 for s in regime_sharpes if s > 0)
            regime_stability = positive_regimes / len(regime_sharpes)
        else:
            regime_stability = 0.5

        # Overfit penalty (higher in-sample vs out-sample gap = more overfit)
        wf = next((w for w in self._wf_results if w.candidate_id == candidate.candidate_id), None)
        if wf and wf.in_sample_sharpe > 0:
            overfit = 1 - min(wf.degradation_ratio, 1.0)
        else:
            overfit = 0.5

        robustness = (1 - param_sens) * 0.3 + regime_stability * 0.4 + (1 - overfit) * 0.3

        result = RobustnessResult(
            candidate_id=candidate.candidate_id,
            param_sensitivity=param_sens,
            market_regime_stability=regime_stability,
            overfit_penalty=overfit,
            robustness_score=robustness,
        )
        self._robustness_results.append(result)
        return result

    def select_portfolio(
        self,
        candidates: list[StrategyCandidate],
        max_strategies: int = 3,
        min_robustness: float = 0.5,
    ) -> list[dict]:
        """Select low-correlation portfolio of strategies."""
        # Filter by robustness
        robust_ids = {r.candidate_id for r in self._robustness_results if r.robustness_score >= min_robustness}
        filtered = [c for c in candidates if c.candidate_id in robust_ids]

        # Sort by walk-forward out-of-sample Sharpe
        wf_map = {w.candidate_id: w for w in self._wf_results}
        scored = [(c, wf_map.get(c.candidate_id)) for c in filtered if c.candidate_id in wf_map]
        scored.sort(key=lambda x: x[1].out_sample_sharpe if x[1] else 0, reverse=True)

        # Pick diverse strategies (different templates)
        selected = []
        templates_used: set[str] = set()
        for cand, wf in scored:
            if len(selected) >= max_strategies:
                break
            if cand.template.value not in templates_used or len(scored) <= max_strategies:
                selected.append({
                    "candidate_id": cand.candidate_id,
                    "template": cand.template.value,
                    "params": cand.params,
                    "out_sample_sharpe": wf.out_sample_sharpe if wf else 0,
                    "robustness": next(
                        (r.robustness_score for r in self._robustness_results if r.candidate_id == cand.candidate_id),
                        0
                    ),
                })
                templates_used.add(cand.template.value)

        return selected

    def generate_report(self) -> DiscoveryReport:
        """Generate a comprehensive discovery report."""
        report_id = f"disc-{hashlib.md5(datetime.now(timezone.utc).isoformat().encode()).hexdigest()[:10]}"

        passed_wf = [w for w in self._wf_results if w.passed]
        passed_robust = [r for r in self._robustness_results if r.robustness_score >= 0.5]

        best_wf = max(self._wf_results, key=lambda w: w.out_sample_sharpe) if self._wf_results else None
        best_robust = max(self._robustness_results, key=lambda r: r.robustness_score) if self._robustness_results else None

        selected = self.select_portfolio(self._candidates)

        report = DiscoveryReport(
            report_id=report_id,
            timestamp=datetime.now(timezone.utc).isoformat(),
            candidates_evaluated=len(self._candidates),
            candidates_passed_wf=len(passed_wf),
            candidates_passed_robustness=len(passed_robust),
            best_candidate_id=best_wf.candidate_id if best_wf else None,
            best_sharpe=best_wf.out_sample_sharpe if best_wf else 0,
            best_return=best_wf.out_sample_return if best_wf else 0,
            best_robustness=best_robust.robustness_score if best_robust else 0,
            walk_forward_pass=bool(passed_wf),
            selected_portfolio=selected,
        )
        self._reports.append(report)
        return report

    def get_reports(self) -> list[DiscoveryReport]:
        return self._reports.copy()


_engine: Optional[StrategyDiscoveryEngine] = None


def get_discovery_engine() -> StrategyDiscoveryEngine:
    global _engine
    if _engine is None:
        _engine = StrategyDiscoveryEngine()
    return _engine
