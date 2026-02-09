"""
OpenRouter Provider
LLM provider using OpenRouter's unified API for multiple models.
"""

from typing import Dict, Any, Optional, List
from datetime import datetime
import logging
import os
import json

try:
    import requests
    REQUESTS_AVAILABLE = True
except ImportError:
    REQUESTS_AVAILABLE = False

from ..provider import LLMProvider, LLMResponse

logger = logging.getLogger(__name__)


class OpenRouterProvider(LLMProvider):
    """
    OpenRouter-based LLM provider for candidate ranking.
    
    OpenRouter provides access to multiple LLM providers through
    a unified API, making it easy to switch models.
    """
    
    # Default model - cost-effective and capable
    DEFAULT_MODEL = "mistralai/mixtral-8x7b-instruct"
    
    # Alternative models
    MODELS = {
        "mixtral": "mistralai/mixtral-8x7b-instruct",
        "llama3-70b": "meta-llama/llama-3-70b-instruct",
        "claude-haiku": "anthropic/claude-3-haiku",
        "gpt-3.5": "openai/gpt-3.5-turbo",
    }
    
    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        temperature: float = 0.3,
        max_tokens: int = 1024,
        timeout_seconds: float = 60.0,
    ):
        """
        Initialize OpenRouter provider.
        
        Args:
            api_key: OpenRouter API key (defaults to OPENROUTER_KEY env var)
            model: Model to use
            temperature: Sampling temperature
            max_tokens: Maximum tokens in response
            timeout_seconds: Request timeout
        """
        self._api_key = api_key or os.environ.get("OPENROUTER_KEY")
        self._model = model or self.DEFAULT_MODEL
        self._temperature = temperature
        self._max_tokens = max_tokens
        self._timeout = timeout_seconds
        self._base_url = "https://openrouter.ai/api/v1"
        
        # Metrics
        self._call_count = 0
        self._error_count = 0
        self._total_latency_ms = 0.0
    
    @property
    def name(self) -> str:
        return f"openrouter/{self._model.split('/')[-1]}"
    
    @property
    def is_available(self) -> bool:
        return bool(self._api_key) and REQUESTS_AVAILABLE
    
    def rank_candidates(
        self,
        context: Dict[str, Any],
    ) -> LLMResponse:
        """Rank candidates using OpenRouter."""
        if not self.is_available:
            return LLMResponse(
                selected_ids=[],
                explanation="OpenRouter provider not available",
                provider=self.name,
                error="Provider not available",
            )
        
        start_time = datetime.utcnow()
        self._call_count += 1
        
        system_prompt = self._build_system_prompt()
        user_prompt = self._build_user_prompt(context)
        
        try:
            response = requests.post(
                f"{self._base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {self._api_key}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://github.com/tradingview-recreation",
                    "X-Title": "TradingView Recreation",
                },
                json={
                    "model": self._model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    "temperature": self._temperature,
                    "max_tokens": self._max_tokens,
                },
                timeout=self._timeout,
            )
            
            latency_ms = (datetime.utcnow() - start_time).total_seconds() * 1000
            self._total_latency_ms += latency_ms
            
            if response.status_code != 200:
                error_msg = f"OpenRouter API error: {response.status_code} - {response.text}"
                logger.error(error_msg)
                self._error_count += 1
                return LLMResponse(
                    selected_ids=[],
                    explanation="",
                    provider=self.name,
                    latency_ms=latency_ms,
                    error=error_msg,
                )
            
            result = response.json()
            content = result["choices"][0]["message"]["content"]
            
            # Try to parse JSON from content
            parsed = self._parse_json_response(content)
            
            selected_ids = parsed.get("selected_ids", [])
            explanation = parsed.get("explanation", "No explanation provided")
            confidence = parsed.get("confidence", 0.7)
            
            # Validate IDs
            candidate_ids = [c.get("id") for c in context.get("candidates", [])]
            valid_ids = [id for id in selected_ids if id in candidate_ids]
            
            return LLMResponse(
                selected_ids=valid_ids,
                explanation=explanation,
                confidence=confidence,
                provider=self.name,
                latency_ms=latency_ms,
                metadata={"model": self._model},
            )
            
        except Exception as e:
            latency_ms = (datetime.utcnow() - start_time).total_seconds() * 1000
            self._error_count += 1
            logger.error(f"OpenRouter request failed: {e}")
            return LLMResponse(
                selected_ids=[],
                explanation="",
                provider=self.name,
                latency_ms=latency_ms,
                error=str(e),
            )
    
    def _parse_json_response(self, content: str) -> Dict[str, Any]:
        """Parse JSON from LLM response, handling markdown blocks."""
        # Try direct parse
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            pass
        
        # Try to find JSON in markdown block
        import re
        json_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', content, re.DOTALL)
        if json_match:
            try:
                return json.loads(json_match.group(1))
            except json.JSONDecodeError:
                pass
        
        # Try to find bare JSON object
        json_match = re.search(r'\{[^{}]*"selected_ids"[^{}]*\}', content, re.DOTALL)
        if json_match:
            try:
                return json.loads(json_match.group(0))
            except json.JSONDecodeError:
                pass
        
        return {"selected_ids": [], "explanation": content}
    
    def _build_system_prompt(self) -> str:
        """Build the system prompt."""
        return """You are an expert options trading assistant selecting trade candidates for a paper trading system.

Analyze candidates based on:
- Risk/reward ratio
- Probability of profit (POP)
- Liquidity score
- IV rank
- Current market conditions

RESPOND ONLY WITH JSON:
{
  "selected_ids": ["id1", "id2"],
  "explanation": "Brief reasoning",
  "confidence": 0.8
}

Select 1-3 best candidates. If none are suitable, return empty array."""

    def _build_user_prompt(self, context: Dict[str, Any]) -> str:
        """Build the user prompt with candidate data."""
        parts = ["Select best options trades:\n"]
        
        if "market_regime" in context:
            parts.append(f"Market: {context['market_regime']}")
        
        if "portfolio" in context:
            p = context["portfolio"]
            parts.append(f"Portfolio: ${p.get('equity', 0):,.0f} equity, "
                        f"${p.get('total_risk', 0):,.0f} risk, "
                        f"{p.get('position_count', 0)} positions")
        
        parts.append("\nCandidates:")
        for c in context.get("candidates", []):
            parts.append(
                f"- {c.get('id')}: {c.get('symbol')} {c.get('template')} | "
                f"Loss ${c.get('max_loss', 0):.0f} | "
                f"Profit ${c.get('max_profit', 0):.0f} | "
                f"POP {c.get('pop', 0)*100:.0f}% | "
                f"Score {c.get('adjusted_score', 0):.1f}"
            )
        
        return "\n".join(parts)


def create_openrouter_provider(
    api_key: Optional[str] = None,
    model: str = "mixtral",
) -> OpenRouterProvider:
    """Factory function to create OpenRouter provider."""
    model_id = OpenRouterProvider.MODELS.get(model, model)
    return OpenRouterProvider(api_key=api_key, model=model_id)
