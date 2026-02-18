"""
Hybrid Selector
Combines Groq for fast ranking with Gemini for validation and detailed explanation.
"""

from typing import List, Dict, Any
from datetime import datetime
import logging

from .candidates import TradeCandidate, CandidateStatus
from .config import AutopilotConfig
from .selector import CandidateSelector, SelectionResult, DeterministicRanker

logger = logging.getLogger(__name__)


class HybridSelector(CandidateSelector):
    """
    Hybrid LLM selector: Groq ranks quickly, Gemini validates and explains.
    
    Workflow:
    1. Groq ranks all candidates and selects top-K (fast, less detailed)
    2. Gemini validates top-K and provides detailed rationale (slower, more thorough)
    3. Falls back to deterministic if either LLM fails
    """
    
    def __init__(self, groq_provider=None, gemini_provider=None):
        self.name = "hybrid"
        self.groq_provider = groq_provider
        self.gemini_provider = gemini_provider
        self.deterministic_fallback = DeterministicRanker()
    
    def select(
        self,
        candidates: List[TradeCandidate],
        config: AutopilotConfig,
        portfolio_state: Dict[str, Any],
        market_context: Dict[str, Any],
    ) -> SelectionResult:
        """
        Select candidates using hybrid Groq+Gemini approach.
        """
        # Check if both providers available
        groq_available = self.groq_provider and self.groq_provider.is_available
        gemini_available = self.gemini_provider and self.gemini_provider.is_available
        
        if not groq_available and not gemini_available:
            logger.info("No LLM providers available, using deterministic fallback")
            result = self.deterministic_fallback.select(
                candidates, config, portfolio_state, market_context
            )
            result.method = f"{self.name} (fallback: deterministic)"
            result.llm_available = False
            result.fallback_used = True
            return result
        
        try:
            # Stage 1: Groq fast ranking
            if groq_available:
                groq_context = self._prepare_groq_context(
                    candidates, config, portfolio_state, market_context
                )
                groq_response = self.groq_provider.rank_candidates(groq_context)
                
                if groq_response.error:
                    raise ValueError(f"Groq error: {groq_response.error}")
                
                # Filter to Groq's top selections
                groq_selected_ids = set(groq_response.selected_ids)
                top_candidates = [c for c in candidates if c.id in groq_selected_ids]
                
                logger.info(f"Groq selected {len(top_candidates)} candidates from {len(candidates)}")
            else:
                # If Groq unavailable, use top-scoring candidates
                sorted_candidates = sorted(candidates, key=lambda c: c.base_score, reverse=True)
                top_candidates = sorted_candidates[:10]
                logger.info("Groq unavailable, using top 10 by score")
            
            # Stage 2: Gemini validation and detailed explanation
            if gemini_available and top_candidates:
                gemini_context = self._prepare_gemini_context(
                    top_candidates, config, portfolio_state, market_context, groq_response if groq_available else None
                )
                gemini_response = self.gemini_provider.rank_candidates(gemini_context)
                
                if gemini_response.error:
                    raise ValueError(f"Gemini error: {gemini_response.error}")
                
                # Apply Gemini's final selections
                return self._apply_selections(
                    candidates, gemini_response, config, portfolio_state, "hybrid (Groq→Gemini)"
                )
            elif groq_available:
                # Gemini unavailable, use Groq result
                return self._apply_selections(
                    candidates, groq_response, config, portfolio_state, "hybrid (Groq only)"
                )
            else:
                raise ValueError("No viable LLM path")
                
        except Exception as e:
            logger.warning(f"Hybrid selection failed: {e}, using fallback")
            result = self.deterministic_fallback.select(
                candidates, config, portfolio_state, market_context
            )
            result.method = f"{self.name} (fallback: deterministic)"
            result.llm_available = False
            result.fallback_used = True
            result.rationale = f"Hybrid LLM failed ({str(e)[:50]}), {result.rationale}"
            return result
    
    def _prepare_groq_context(
        self,
        candidates: List[TradeCandidate],
        config: AutopilotConfig,
        portfolio_state: Dict[str, Any],
        market_context: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Prepare context for Groq's fast ranking."""
        return {
            "timestamp": datetime.utcnow().isoformat(),
            "market_regime": market_context.get("regime", "unknown"),
            "vix_level": market_context.get("vix", 20),
            "portfolio": {
                "equity": config.paper_equity,
                "total_risk": portfolio_state.get("total_risk", 0),
                "position_count": portfolio_state.get("position_count", 0),
            },
            "candidates": [
                {
                    "id": c.id,
                    "symbol": c.symbol,
                    "template": c.template.value,
                    "max_loss": c.max_loss,
                    "max_profit": c.max_profit,
                    "pop": c.pop,
                    "dte": c.dte,
                    "iv_rank": c.iv_rank,
                    "liquidity_score": c.liquidity_score,
                    "base_score": c.base_score,
                }
                for c in candidates[:30]  # Limit for token efficiency
            ],
            "instructions": (
                "Quickly rank and select the top 5-8 candidates based on: "
                "high POP, good risk/reward ratio, high liquidity score. "
                "Focus on quantitative metrics."
            ),
        }
    
    def _prepare_gemini_context(
        self,
        candidates: List[TradeCandidate],
        config: AutopilotConfig,
        portfolio_state: Dict[str, Any],
        market_context: Dict[str, Any],
        groq_response=None,
    ) -> Dict[str, Any]:
        """Prepare context for Gemini's validation and explanation."""
        context = {
            "timestamp": datetime.utcnow().isoformat(),
            "market_regime": market_context.get("regime", "unknown"),
            "vix_level": market_context.get("vix", 20),
            "portfolio": {
                "equity": config.paper_equity,
                "total_risk": portfolio_state.get("total_risk", 0),
                "position_count": portfolio_state.get("position_count", 0),
                "daily_pnl": portfolio_state.get("daily_pnl", 0),
            },
            "candidates": [
                {
                    "id": c.id,
                    "symbol": c.symbol,
                    "template": c.template.value,
                    "max_loss": c.max_loss,
                    "max_profit": c.max_profit,
                    "pop": c.pop,
                    "dte": c.dte,
                    "iv_rank": c.iv_rank,
                    "liquidity_score": c.liquidity_score,
                    "trend": c.trend,
                    "regime": c.regime,
                    "base_score": c.base_score,
                    "legs": [
                        {
                            "side": leg.side.value,
                            "option_type": leg.option_type.value,
                            "strike": leg.strike,
                            "quantity": leg.quantity,
                        }
                        for leg in c.legs
                    ],
                }
                for c in candidates
            ],
            "instructions": (
                "These are the top candidates pre-selected by Groq. "
                "Validate and select the final 2-3 candidates. "
                "Provide detailed explanation including:\n"
                "- Why each trade was chosen\n"
                "- Key risk factors\n"
                "- How selections fit the current market regime\n"
                "- Portfolio balance considerations"
            ),
        }
        
        if groq_response:
            context["groq_explanation"] = groq_response.explanation
        
        return context
    
    def _apply_selections(
        self,
        all_candidates: List[TradeCandidate],
        llm_response,
        config: AutopilotConfig,
        portfolio_state: Dict[str, Any],
        method_name: str,
    ) -> SelectionResult:
        """Apply LLM selections with risk limit validation."""
        selected_ids = set(llm_response.selected_ids)
        explanation = llm_response.explanation
        
        selected = []
        rejected = []
        
        # Respect risk limits
        remaining_risk = config.risk_limits.max_total_risk - portfolio_state.get("total_risk", 0)
        remaining_positions = config.risk_limits.max_open_positions - portfolio_state.get("position_count", 0)
        
        for candidate in all_candidates:
            if candidate.id in selected_ids:
                if remaining_positions > 0 and candidate.max_loss <= remaining_risk:
                    candidate.status = CandidateStatus.SELECTED
                    candidate.selection_reason = "Hybrid LLM selected"
                    selected.append(candidate)
                    remaining_risk -= candidate.max_loss
                    remaining_positions -= 1
                else:
                    candidate.status = CandidateStatus.REJECTED
                    candidate.rejection_reasons.append("LLM selected but exceeded risk limits")
                    rejected.append(candidate)
            else:
                candidate.status = CandidateStatus.REJECTED
                candidate.rejection_reasons.append("Not in LLM final selection")
                rejected.append(candidate)
        
        return SelectionResult(
            selected=selected,
            rejected=rejected,
            method=method_name,
            rationale=explanation,
            timestamp=datetime.utcnow(),
            llm_available=True,
            fallback_used=False,
        )


def create_hybrid_selector(groq_provider=None, gemini_provider=None) -> HybridSelector:
    """
    Factory to create hybrid selector with optional provider instances.
    
    If providers not passed, will attempt to create them from environment.
    """
    if not groq_provider:
        try:
            from ..llm.providers import create_groq_provider
            groq_provider = create_groq_provider()
        except Exception as e:
            logger.debug(f"Could not create Groq provider: {e}")
    
    if not gemini_provider:
        try:
            from ..llm.providers import create_gemini_provider
            gemini_provider = create_gemini_provider()
        except Exception as e:
            logger.debug(f"Could not create Gemini provider: {e}")
    
    return HybridSelector(groq_provider=groq_provider, gemini_provider=gemini_provider)
