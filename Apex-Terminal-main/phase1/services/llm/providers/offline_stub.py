"""
Offline Stub Provider
Deterministic LLM stub for testing without external dependencies.
"""

from typing import Dict, Any, List
from datetime import datetime
import logging

from ..provider import LLMProvider, LLMResponse

logger = logging.getLogger(__name__)


class OfflineStubProvider(LLMProvider):
    """
    Deterministic stub LLM provider for testing.
    
    Uses simple scoring rules to select candidates without
    any external API calls. Fully reproducible and fast.
    """
    
    def __init__(self, max_selections: int = 5):
        """
        Initialize offline stub.
        
        Args:
            max_selections: Maximum candidates to select
        """
        self._max_selections = max_selections
        self._call_count = 0
    
    @property
    def name(self) -> str:
        return "offline_stub"
    
    @property
    def is_available(self) -> bool:
        return True  # Always available
    
    def rank_candidates(
        self,
        context: Dict[str, Any],
    ) -> LLMResponse:
        """
        Select candidates using deterministic rules.
        
        Selection criteria:
        1. Sort by base_score (descending)
        2. Filter out low liquidity
        3. Prefer diversity across symbols
        4. Take top N
        """
        start_time = datetime.utcnow()
        self._call_count += 1
        
        candidates = context.get("candidates", [])
        portfolio = context.get("portfolio", {})
        
        if not candidates:
            return LLMResponse(
                selected_ids=[],
                explanation="No candidates provided",
                confidence=1.0,
                provider=self.name,
                latency_ms=0,
            )
        
        # Score and rank candidates
        scored = self._score_candidates(candidates, portfolio)
        
        # Select top candidates with diversity
        selected = self._select_with_diversity(scored)
        
        # Generate explanation
        explanation = self._generate_explanation(selected, candidates)
        
        end_time = datetime.utcnow()
        latency_ms = (end_time - start_time).total_seconds() * 1000
        
        return LLMResponse(
            selected_ids=[c["id"] for c in selected],
            explanation=explanation,
            confidence=0.85,
            metadata={
                "selection_count": len(selected),
                "total_candidates": len(candidates),
                "call_count": self._call_count,
            },
            latency_ms=latency_ms,
            provider=self.name,
        )
    
    def _score_candidates(
        self,
        candidates: List[Dict[str, Any]],
        portfolio: Dict[str, Any],
    ) -> List[Dict[str, Any]]:
        """Score candidates for ranking."""
        scored = []
        
        max_risk = portfolio.get("max_risk_per_trade", 50)
        
        for c in candidates:
            # Start with base score
            score = c.get("base_score", 0)
            
            # Boost high POP candidates
            pop = c.get("pop", 0.5)
            score += pop * 20
            
            # Boost good risk/reward
            max_profit = c.get("max_profit", 0)
            max_loss = c.get("max_loss", 1)
            if max_loss > 0:
                rr = max_profit / max_loss
                score += min(rr, 3) * 10
            
            # Penalize high risk relative to budget
            if max_loss > max_risk * 0.8:
                score *= 0.8
            
            # Boost high liquidity
            liquidity = c.get("liquidity_score", 50)
            score += liquidity * 0.2
            
            # Penalize low IV for credit strategies
            iv_rank = c.get("iv_rank", 50)
            template = c.get("template", "")
            if "credit" in template or "condor" in template:
                if iv_rank < 30:
                    score *= 0.7
            
            scored.append({**c, "computed_score": score})
        
        return sorted(scored, key=lambda x: x["computed_score"], reverse=True)
    
    def _select_with_diversity(
        self,
        scored: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """Select top candidates ensuring symbol diversity."""
        selected = []
        symbols_selected: Dict[str, int] = {}
        templates_selected: Dict[str, int] = {}
        
        for c in scored:
            if len(selected) >= self._max_selections:
                break
            
            symbol = c.get("symbol", "")
            template = c.get("template", "")
            
            # Enforce diversity limits
            if symbols_selected.get(symbol, 0) >= 2:
                continue
            
            if templates_selected.get(template, 0) >= 2:
                continue
            
            selected.append(c)
            symbols_selected[symbol] = symbols_selected.get(symbol, 0) + 1
            templates_selected[template] = templates_selected.get(template, 0) + 1
        
        return selected
    
    def _generate_explanation(
        self,
        selected: List[Dict[str, Any]],
        all_candidates: List[Dict[str, Any]],
    ) -> str:
        """Generate selection explanation."""
        if not selected:
            return "No candidates met selection criteria (risk/liquidity filters)"
        
        # Group by template
        by_template: Dict[str, List[str]] = {}
        for c in selected:
            t = c.get("template", "unknown")
            by_template.setdefault(t, []).append(c.get("symbol", "?"))
        
        parts = []
        for template, symbols in by_template.items():
            parts.append(f"{template}: {', '.join(symbols)}")
        
        total_risk = sum(c.get("max_loss", 0) for c in selected)
        avg_pop = sum(c.get("pop", 0) for c in selected) / len(selected) if selected else 0
        
        return (
            f"Selected {len(selected)}/{len(all_candidates)} candidates. "
            f"Trades: {'; '.join(parts)}. "
            f"Total risk: ${total_risk:.0f}, avg POP: {avg_pop:.0%}. "
            f"[Deterministic selection]"
        )
    
    def health_check(self) -> Dict[str, Any]:
        """Check provider health."""
        return {
            "provider": self.name,
            "available": True,
            "call_count": self._call_count,
            "max_selections": self._max_selections,
            "timestamp": datetime.utcnow().isoformat(),
        }
