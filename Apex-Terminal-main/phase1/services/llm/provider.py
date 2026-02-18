"""
LLM Provider Interface
Abstract base class for LLM providers.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any
from datetime import datetime


@dataclass
class LLMResponse:
    """Response from an LLM provider"""
    selected_ids: List[str]
    explanation: str
    confidence: float = 0.8
    metadata: Dict[str, Any] = field(default_factory=dict)
    latency_ms: float = 0.0
    provider: str = "unknown"
    timestamp: datetime = field(default_factory=datetime.utcnow)
    error: Optional[str] = None
    
    @property
    def success(self) -> bool:
        return self.error is None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "selected_ids": self.selected_ids,
            "explanation": self.explanation,
            "confidence": self.confidence,
            "metadata": self.metadata,
            "latency_ms": self.latency_ms,
            "provider": self.provider,
            "timestamp": self.timestamp.isoformat(),
            "error": self.error,
            "success": self.success,
        }


class LLMProvider(ABC):
    """
    Abstract base class for LLM providers.
    
    Providers must implement the rank_candidates method which takes
    a structured context and returns selected candidate IDs with rationale.
    """
    
    @property
    @abstractmethod
    def name(self) -> str:
        """Provider name for logging/metrics."""
        pass
    
    @property
    @abstractmethod
    def is_available(self) -> bool:
        """Check if provider is currently available."""
        pass
    
    @abstractmethod
    def rank_candidates(
        self,
        context: Dict[str, Any],
    ) -> LLMResponse:
        """
        Rank and select candidates based on context.
        
        Args:
            context: Structured context including:
                - timestamp: ISO timestamp
                - market_regime: Current market regime
                - vix_level: Current VIX
                - portfolio: Portfolio state summary
                - candidates: List of candidate details
                - instructions: Selection instructions
                
        Returns:
            LLMResponse with selected IDs and explanation
        """
        pass
    
    def health_check(self) -> Dict[str, Any]:
        """
        Check provider health.
        
        Returns:
            Dict with health status
        """
        return {
            "provider": self.name,
            "available": self.is_available,
            "timestamp": datetime.utcnow().isoformat(),
        }
