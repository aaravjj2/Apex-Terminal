"""
Decision Engine (Milestone 2)

Orchestrates the full decision cycle:
1. Classify regime (TREND/RANGE/CHAOS)
2. Check sentiment gates
3. Select appropriate template
4. Generate candidates
5. Score and rank
6. Apply validation gates
7. Return selected trade or token fallback
"""

import logging
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any
from datetime import datetime, timezone

from .regime_classifier import RegimeClassifier, MarketRegime, RegimeResult
from .strategy_templates import (
    TemplateSelector, CandidateGenerator, TemplateConfig, 
    CandidateSpec, TemplateType
)
from .sentiment_gate import SentimentGate, SentimentResult
from .state_machine import AgentStateMachine, AgentState, AgentAction
from .exit_monitor import ExitMonitor

logger = logging.getLogger(__name__)

@dataclass
class DecisionContext:
    """Context for a decision cycle."""
    timestamp: datetime
    
    # Symbol being evaluated
    symbol: str
    current_price: float
    
    # Market data
    bars: List[Dict[str, Any]] = field(default_factory=list)
    
    # Options data
    expiry: str = ""
    chain_data: Optional[Dict[str, Any]] = None
    
    # States
    regime_result: Optional[RegimeResult] = None
    sentiment_result: Optional[SentimentResult] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "timestamp": self.timestamp.isoformat(),
            "symbol": self.symbol,
            "current_price": self.current_price,
            "regime": self.regime_result.regime.value if self.regime_result else "unknown",
            "sentiment_score": self.sentiment_result.sentiment_score if self.sentiment_result else 0,
        }

@dataclass
class DecisionResult:
    """Result of decision cycle."""
    timestamp: datetime
    symbol: str
    
    # Decision
    action: AgentAction
    selected_candidate: Optional[CandidateSpec] = None
    template_used: Optional[TemplateType] = None
    
    # Context
    regime: MarketRegime = MarketRegime.UNKNOWN
    shock_flag: bool = False
    
    # Scoring
    candidates_evaluated: int = 0
    candidates_passed: int = 0
    
    # Reasons
    selection_reason: str = ""
    rejection_reasons: List[str] = field(default_factory=list)
    
    # Audit trail
    features: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "timestamp": self.timestamp.isoformat(),
            "symbol": self.symbol,
            "action": self.action.value,
            "template_used": self.template_used.value if self.template_used else None,
            "regime": self.regime.value,
            "shock_flag": self.shock_flag,
            "candidates_evaluated": self.candidates_evaluated,
            "candidates_passed": self.candidates_passed,
            "selection_reason": self.selection_reason,
            "rejection_reasons": self.rejection_reasons,
            "candidate": self.selected_candidate.to_dict() if self.selected_candidate else None,
        }

class DecisionEngine:
    """
    Main decision engine for the autopilot.
    
    Fully deterministic - all decisions reproducible from inputs.
    """
    
    # Universe per spec
    UNIVERSE = ["SPY", "GLD", "AAPL", "MSFT", "NVDA", "AMZN", "META", "GOOGL", "TSLA"]
    
    def __init__(
        self,
        min_score_threshold: float = 50.0,
        spy_baseline: bool = True,
    ):
        self.min_score = min_score_threshold
        self.spy_baseline = spy_baseline
        
        # Components
        self.regime_classifier = RegimeClassifier()
        self.template_selector = TemplateSelector()
        self.candidate_generator = CandidateGenerator(self.template_selector)
        self.sentiment_gate = SentimentGate()
        
    async def decide(
        self,
        symbol: str,
        current_price: float,
        bars: List[Dict[str, Any]],
        expiry: str,
        state_machine: AgentStateMachine,
        chain_data: Optional[Dict[str, Any]] = None,
    ) -> DecisionResult:
        """
        Make a trading decision for a symbol.
        
        This is the main entry point for the decision logic.
        """
        timestamp = datetime.now(timezone.utc)
        
        # Check if we can trade
        allowed_actions = state_machine.get_allowed_actions()
        
        if AgentAction.OPEN_POSITION not in allowed_actions and AgentAction.PLACE_TOKEN_TRADE not in allowed_actions:
            return DecisionResult(
                timestamp=timestamp,
                symbol=symbol,
                action=AgentAction.DO_NOTHING,
                selection_reason="Not in tradeable state",
            )
        
        # Step 1: Classify regime
        regime_result = self.regime_classifier.classify(symbol, bars, timestamp)
        
        # Also get SPY baseline if not SPY
        spy_regime = None
        if self.spy_baseline and symbol != "SPY":
            spy_regime = self.regime_classifier.get_cached("SPY")
        
        # Step 2: Check sentiment
        sentiment_result = await self.sentiment_gate.analyze(symbol)
        shock_flag = sentiment_result.shock_flag
        
        # Step 3: Select template
        force_token = False
        if regime_result.confidence < 0.4:
            force_token = True  # Low confidence = token trade
        
        template = self.template_selector.select_template(
            regime=regime_result.regime,
            shock_flag=shock_flag,
            force_token=force_token,
        )
        
        # Step 4: Generate candidates
        candidates = self.candidate_generator.generate(
            symbol=symbol,
            template=template,
            current_price=current_price,
            expiry=expiry,
            regime=regime_result.regime,
            chain_data=chain_data,
        )
        
        # Step 5: Apply gates and filter
        passed_candidates = []
        rejection_reasons = []
        
        for candidate in candidates:
            # Check sentiment gate
            direction = candidate.direction
            gate_result = self.sentiment_gate.check_gate(sentiment_result, direction)
            
            if not gate_result["passed"]:
                rejection_reasons.extend(gate_result["reasons"])
                continue
            
            # Check score threshold
            if candidate.total_score < self.min_score:
                rejection_reasons.append(f"Score {candidate.total_score:.1f} below threshold {self.min_score}")
                continue
            
            passed_candidates.append(candidate)
        
        # Step 6: Select best candidate
        if passed_candidates:
            # Sort by score
            passed_candidates.sort(key=lambda c: c.total_score, reverse=True)
            selected = passed_candidates[0]
            
            is_token = template.template_type == TemplateType.TOKEN_TRADE
            action = AgentAction.PLACE_TOKEN_TRADE if is_token else AgentAction.OPEN_POSITION
            
            return DecisionResult(
                timestamp=timestamp,
                symbol=symbol,
                action=action,
                selected_candidate=selected,
                template_used=template.template_type,
                regime=regime_result.regime,
                shock_flag=shock_flag,
                candidates_evaluated=len(candidates),
                candidates_passed=len(passed_candidates),
                selection_reason=f"Top score: {selected.total_score:.1f}",
                features=regime_result.features.to_dict(),
            )
        
        # No candidates passed - check if token trade needed
        if not state_machine.token_trade_done and AgentAction.PLACE_TOKEN_TRADE in allowed_actions:
            # Generate token trade fallback
            token_template = self.template_selector.get_template(TemplateType.TOKEN_TRADE)
            token_candidates = self.candidate_generator.generate(
                symbol=symbol,
                template=token_template,
                current_price=current_price,
                expiry=expiry,
                regime=regime_result.regime,
            )
            
            if token_candidates:
                return DecisionResult(
                    timestamp=timestamp,
                    symbol=symbol,
                    action=AgentAction.PLACE_TOKEN_TRADE,
                    selected_candidate=token_candidates[0],
                    template_used=TemplateType.TOKEN_TRADE,
                    regime=regime_result.regime,
                    shock_flag=shock_flag,
                    candidates_evaluated=len(candidates),
                    candidates_passed=0,
                    selection_reason="Fallback token trade - all candidates rejected",
                    rejection_reasons=rejection_reasons,
                )
        
        return DecisionResult(
            timestamp=timestamp,
            symbol=symbol,
            action=AgentAction.DO_NOTHING,
            regime=regime_result.regime,
            shock_flag=shock_flag,
            candidates_evaluated=len(candidates),
            candidates_passed=0,
            selection_reason="No valid trades",
            rejection_reasons=rejection_reasons,
        )
    
    async def scan_universe(
        self,
        bars_by_symbol: Dict[str, List[Dict[str, Any]]],
        prices_by_symbol: Dict[str, float],
        expiry: str,
        state_machine: AgentStateMachine,
    ) -> List[DecisionResult]:
        """
        Scan full universe and return decision results.
        """
        results = []
        
        # Classify SPY first for baseline
        if "SPY" in bars_by_symbol:
            self.regime_classifier.classify("SPY", bars_by_symbol["SPY"])
        
        for symbol in self.UNIVERSE:
            if symbol not in bars_by_symbol or symbol not in prices_by_symbol:
                continue
            
            result = await self.decide(
                symbol=symbol,
                current_price=prices_by_symbol[symbol],
                bars=bars_by_symbol[symbol],
                expiry=expiry,
                state_machine=state_machine,
            )
            
            results.append(result)
            
            # If we found a good trade, stop scanning
            if result.action in [AgentAction.OPEN_POSITION, AgentAction.PLACE_TOKEN_TRADE]:
                break
        
        return results
