"""
Groq Provider
LLM provider using Groq's fast inference API.
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


class GroqProvider(LLMProvider):
    """
    Groq-based LLM provider for fast candidate ranking.
    
    Uses Groq's API to rank and select trade candidates
    with explanations.
    """
    
    # Default model - use a current Groq model
    DEFAULT_MODEL = "groq/compound"
    
    # Alternative models (friendly shortnames -> model ids)
    MODELS = {
        "mixtral": "groq/compound",  # remap deprecated alias to a supported model
        "groq/compound": "groq/compound",
        "llama3-70b": "llama3-70b-8192",
        "llama3-8b": "llama3-8b-8192",
        "gemma2": "gemma2-9b-it",
    }
    
    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        temperature: float = 0.3,
        max_tokens: int = 1024,
        timeout_seconds: float = 30.0,
    ):
        """
        Initialize Groq provider.
        
        Args:
            api_key: Groq API key (defaults to GROQ_API_KEY env var)
            model: Model to use (defaults to mixtral-8x7b-32768)
            temperature: Sampling temperature (lower = more deterministic)
            max_tokens: Maximum tokens in response
            timeout_seconds: Request timeout
        """
        self._api_key = api_key or os.environ.get("GROQ_API_KEY")
        self._model = model or self.DEFAULT_MODEL
        self._temperature = temperature
        self._max_tokens = max_tokens
        self._timeout = timeout_seconds
        self._base_url = "https://api.groq.com/openai/v1"
        
        # Metrics
        self._call_count = 0
        self._error_count = 0
        self._total_latency_ms = 0.0
    
    @property
    def name(self) -> str:
        return f"groq/{self._model}"
    
    @property
    def is_available(self) -> bool:
        return bool(self._api_key) and REQUESTS_AVAILABLE
    
    def rank_candidates(
        self,
        context: Dict[str, Any],
    ) -> LLMResponse:
        """
        Rank and select candidates using Groq LLM.
        
        Args:
            context: Structured context with candidates and market data
            
        Returns:
            LLMResponse with selected IDs and explanation
        """
        if not self.is_available:
            return LLMResponse(
                selected_ids=[],
                explanation="Groq provider not available (missing API key or requests library)",
                provider=self.name,
                error="Provider not available",
            )
        
        start_time = datetime.utcnow()
        self._call_count += 1
        
        # Build the prompt
        system_prompt = self._build_system_prompt()
        user_prompt = self._build_user_prompt(context)
        
        try:
            response = requests.post(
                f"{self._base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {self._api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": self._model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    "temperature": self._temperature,
                    "max_tokens": self._max_tokens,
                    "response_format": {"type": "json_object"},
                },
                timeout=self._timeout,
            )
            
            latency_ms = (datetime.utcnow() - start_time).total_seconds() * 1000
            self._total_latency_ms += latency_ms
            
            if response.status_code != 200:
                error_msg = f"Groq API error: {response.status_code} - {response.text}"
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
            
            # Parse the JSON response. Groq may include extra explanatory text,
            # so try direct JSON parse first, then fall back to extracting a JSON
            # substring enclosed in braces.
            parsed = None
            if isinstance(content, dict):
                parsed = content
            else:
                try:
                    parsed = json.loads(content)
                except Exception:
                    # Try extracting JSON substring between the first { and last }
                    s = content
                    i = s.find('{')
                    j = s.rfind('}')
                    if i != -1 and j != -1 and j > i:
                        sub = s[i:j+1]
                        try:
                            parsed = json.loads(sub)
                            logger.debug("Parsed JSON from substring of Groq response")
                        except Exception as e:
                            logger.error(f"Failed to parse JSON substring from Groq response: {e}")
                    if parsed is None:
                        # Re-raise as JSONDecodeError to be handled by outer except
                        raise json.JSONDecodeError("Could not parse Groq response as JSON", content, 0)

            selected_ids = parsed.get("selected_ids", [])
            explanation = parsed.get("explanation", "No explanation provided")
            confidence = parsed.get("confidence", 0.7)
            
            # Validate selected IDs against candidate list
            candidate_ids = [c.get("id") for c in context.get("candidates", [])]
            valid_ids = [id for id in selected_ids if id in candidate_ids]
            
            if len(valid_ids) != len(selected_ids):
                logger.warning(
                    f"Groq returned {len(selected_ids) - len(valid_ids)} invalid candidate IDs"
                )
            
            return LLMResponse(
                selected_ids=valid_ids,
                explanation=explanation,
                confidence=confidence,
                provider=self.name,
                latency_ms=latency_ms,
                metadata={
                    "model": self._model,
                    "tokens_used": result.get("usage", {}),
                },
            )
            
        except json.JSONDecodeError as e:
            latency_ms = (datetime.utcnow() - start_time).total_seconds() * 1000
            self._error_count += 1
            logger.error(f"Failed to parse Groq response as JSON: {e}")
            return LLMResponse(
                selected_ids=[],
                explanation="",
                provider=self.name,
                latency_ms=latency_ms,
                error=f"JSON parse error: {e}",
            )
        except requests.RequestException as e:
            latency_ms = (datetime.utcnow() - start_time).total_seconds() * 1000
            self._error_count += 1
            logger.error(f"Groq request failed: {e}")
            return LLMResponse(
                selected_ids=[],
                explanation="",
                provider=self.name,
                latency_ms=latency_ms,
                error=str(e),
            )
    
    def _build_system_prompt(self) -> str:
        """Build the system prompt for candidate ranking."""
        return """You are an expert options trading assistant helping to rank and select trade candidates for a paper trading autopilot system.

Your role is to:
1. Analyze the provided trade candidates based on their risk/reward profiles
2. Consider the current market regime and portfolio state
3. Select the best candidates that fit the risk constraints
4. Provide clear reasoning for your selections

IMPORTANT RULES:
- You can ONLY select from the provided candidate IDs
- You CANNOT invent new trades or modify parameters
- Respect the maximum number of selections if specified
- Consider position concentration and portfolio balance

You must respond in JSON format with:
{
  "selected_ids": ["id1", "id2", ...],
  "explanation": "Brief explanation of your selections and reasoning",
  "confidence": 0.0-1.0 (your confidence in these selections)
}"""

    def _build_user_prompt(self, context: Dict[str, Any]) -> str:
        """Build the user prompt with context."""
        parts = ["# Trade Candidate Selection Request\n"]
        
        # Market context
        if "market_regime" in context:
            parts.append(f"## Market Regime\n{context['market_regime']}\n")
        
        if "vix_level" in context:
            parts.append(f"VIX Level: {context['vix_level']}\n")
        
        # Portfolio state
        if "portfolio" in context:
            portfolio = context["portfolio"]
            parts.append("\n## Current Portfolio State")
            parts.append(f"- Equity: ${portfolio.get('equity', 0):,.2f}")
            parts.append(f"- Total Risk: ${portfolio.get('total_risk', 0):,.2f}")
            parts.append(f"- Open Positions: {portfolio.get('position_count', 0)}")
            parts.append(f"- Daily P&L: ${portfolio.get('daily_pnl', 0):,.2f}\n")
        
        # Candidates
        parts.append("\n## Trade Candidates\n")
        for candidate in context.get("candidates", []):
            parts.append(f"### {candidate.get('id')} - {candidate.get('symbol')} {candidate.get('template')}")
            parts.append(f"- Max Loss: ${candidate.get('max_loss', 0):,.2f}")
            parts.append(f"- Max Profit: ${candidate.get('max_profit', 0):,.2f}")
            parts.append(f"- POP: {candidate.get('pop', 0) * 100:.1f}%")
            parts.append(f"- DTE: {candidate.get('dte', 0)} days")
            parts.append(f"- IV Rank: {candidate.get('iv_rank', 0) * 100:.1f}%")
            parts.append(f"- Liquidity Score: {candidate.get('liquidity_score', 0):.2f}")
            parts.append(f"- Base Score: {candidate.get('base_score', 0):.2f}")
            if candidate.get("legs"):
                parts.append("- Legs:")
                for leg in candidate["legs"]:
                    parts.append(f"  - {leg.get('side', '').upper()} {leg.get('option_type', '').upper()} ${leg.get('strike', 0)}")
            parts.append("")
        
        # Instructions
        if "instructions" in context:
            parts.append(f"\n## Selection Instructions\n{context['instructions']}")
        else:
            parts.append("\n## Selection Instructions")
            parts.append("Select the best 1-3 candidates that offer good risk/reward")
            parts.append("and fit within the portfolio constraints.")
        
        return "\n".join(parts)
    
    def health_check(self) -> Dict[str, Any]:
        """Check provider health."""
        health = {
            "provider": self.name,
            "available": self.is_available,
            "api_key_set": bool(self._api_key),
            "model": self._model,
            "call_count": self._call_count,
            "error_count": self._error_count,
            "avg_latency_ms": (
                self._total_latency_ms / self._call_count
                if self._call_count > 0
                else 0
            ),
            "timestamp": datetime.utcnow().isoformat(),
        }
        
        # Quick API test if available
        if self.is_available:
            try:
                response = requests.get(
                    f"{self._base_url}/models",
                    headers={"Authorization": f"Bearer {self._api_key}"},
                    timeout=5,
                )
                health["api_reachable"] = response.status_code == 200
            except Exception:
                health["api_reachable"] = False
        
        return health


def create_groq_provider(
    api_key: Optional[str] = None,
    model: str = "mixtral",
) -> GroqProvider:
    """
    Factory function to create a Groq provider.
    
    Args:
        api_key: Groq API key (optional, uses env var if not provided)
        model: Model shortname (mixtral, llama3-70b, llama3-8b, gemma2)
        
    Returns:
        Configured GroqProvider instance
    """
    model_id = GroqProvider.MODELS.get(model, model)
    return GroqProvider(api_key=api_key, model=model_id)
