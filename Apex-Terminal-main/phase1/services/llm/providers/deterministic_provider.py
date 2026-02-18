"""
Deterministic Provider
Fully deterministic LLM provider for testing and fallback.
"""

from typing import Dict, Any, List
from datetime import datetime
import logging

from ..provider import LLMProvider, LLMResponse

logger = logging.getLogger(__name__)


class DeterministicProvider(LLMProvider):
    """
    Fully deterministic LLM provider for testing and fallback.
    
    Uses simple, reproducible scoring rules to select candidates
    without any external API calls or randomness.
    """
    
    def __init__(self, max_selections: int = 3):
        """
        Initialize deterministic provider.
        
        Args:
            max_selections: Maximum candidates to select
        """
        self._max_selections = max_selections
        self._call_count = 0
    
    @property
    def name(self) -> str:
        return "deterministic"
    
    @property
    def is_available(self) -> bool:
        return True  # Always available
    
    def rank_candidates(
        self,
        context: Dict[str, Any],
    ) -> LLMResponse:
        """
        Select candidates using deterministic rules.
        
        Selection criteria (in order):
        1. Filter out candidates with liquidity_score < 5.0
        2. Sort by base_score (descending)
        3. Take top N (up to max_selections)
        4. Generate explanation based on selection
        
        Args:
            context: Structured context with candidates
            
        Returns:
            LLMResponse with selected IDs and explanation
        """
        start_time = datetime.utcnow()
        self._call_count += 1
        
        candidates = context.get("candidates", [])
        
        if not candidates:
            return LLMResponse(
                selected_ids=[],
                explanation="No candidates provided",
                provider=self.name,
                latency_ms=0.0,
            )
        
        # Filter by liquidity
        filtered = [
            c for c in candidates
            if c.get("liquidity_score", 0) >= 5.0
        ]
        
        if not filtered:
            # Relax filter if nothing passes
            filtered = candidates
            logger.warning("No candidates met liquidity filter, using all candidates")
        
        # Sort by base_score
        sorted_candidates = sorted(
            filtered,
            key=lambda c: c.get("base_score", 0),
            reverse=True
        )
        
        # Select top N
        selected = sorted_candidates[:self._max_selections]
        selected_ids = [c.get("id") for c in selected]
        
        # Generate explanation
        explanation_parts = [
            f"Selected {len(selected_ids)} candidates using deterministic scoring:",
        ]
        
        for i, c in enumerate(selected, 1):
            symbol = c.get("symbol", "UNKNOWN")
            template = c.get("template", "unknown")
            base_score = c.get("base_score", 0)
            max_loss = c.get("max_loss", 0)
            pop = c.get("pop", 0)
            
            explanation_parts.append(
                f"{i}. {symbol} {template} (score: {base_score:.2f}, "
                f"max loss: ${max_loss:.0f}, POP: {pop*100:.1f}%)"
            )
        
        explanation = "\n".join(explanation_parts)
        
        latency_ms = (datetime.utcnow() - start_time).total_seconds() * 1000
        
        return LLMResponse(
            selected_ids=selected_ids,
            explanation=explanation,
            confidence=1.0,  # Deterministic = full confidence
            provider=self.name,
            latency_ms=latency_ms,
            metadata={
                "filtered_count": len(filtered),
                "total_count": len(candidates),
                "max_selections": self._max_selections,
            },
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


def create_deterministic_provider(max_selections: int = 3) -> DeterministicProvider:
    """
    Factory function to create a deterministic provider.
    
    Args:
        max_selections: Maximum candidates to select
        
    Returns:
        Configured DeterministicProvider instance
    """
    return DeterministicProvider(max_selections=max_selections)
