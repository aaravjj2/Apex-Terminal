"""
Gemini Provider
LLM provider using Google's Gemini API for final decision and explanation.
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


class GeminiProvider(LLMProvider):
    """
    Gemini-based LLM provider for final decision and detailed explanations.
    
    Uses Google's Gemini API to validate/rerank top candidates
    and provide detailed reasoning.
    """
    
    # Default model - Gemini 1.5 Flash is fast and capable
    DEFAULT_MODEL = "gemini-1.5-flash"
    
    # Alternative models
    MODELS = {
        "flash": "gemini-1.5-flash",
        "flash-8b": "gemini-1.5-flash-8b",
        "pro": "gemini-1.5-pro",
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
        Initialize Gemini provider.
        
        Args:
            api_key: Gemini API key (defaults to GEMINI_API_KEY env var)
            model: Model to use (defaults to gemini-1.5-flash)
            temperature: Sampling temperature (lower = more deterministic)
            max_tokens: Maximum tokens in response
            timeout_seconds: Request timeout
        """
        self._api_key = api_key or os.environ.get("GEMINI_API_KEY")
        self._model = model or self.DEFAULT_MODEL
        self._temperature = temperature
        self._max_tokens = max_tokens
        self._timeout = timeout_seconds
        self._base_url = "https://generativelanguage.googleapis.com/v1beta"
        
        # Metrics
        self._call_count = 0
        self._error_count = 0
        self._total_latency_ms = 0.0
    
    @property
    def name(self) -> str:
        return f"gemini/{self._model}"
    
    @property
    def is_available(self) -> bool:
        return bool(self._api_key) and REQUESTS_AVAILABLE
    
    def rank_candidates(
        self,
        context: Dict[str, Any],
    ) -> LLMResponse:
        """
        Rank and select candidates using Gemini LLM.
        
        Args:
            context: Structured context with candidates and market data
            
        Returns:
            LLMResponse with selected IDs and explanation
        """
        if not self.is_available:
            return LLMResponse(
                selected_ids=[],
                explanation="Gemini provider not available (missing API key or requests library)",
                provider=self.name,
                error="Provider not available",
            )
        
        start_time = datetime.utcnow()
        self._call_count += 1
        
        # Build the prompt
        system_instruction = self._build_system_instruction()
        user_prompt = self._build_user_prompt(context)
        
        try:
            # Gemini API endpoint
            url = f"{self._base_url}/models/{self._model}:generateContent"
            
            response = requests.post(
                url,
                headers={
                    "Content-Type": "application/json",
                    "x-goog-api-key": self._api_key,
                },
                json={
                    "contents": [{
                        "parts": [{
                            "text": f"{system_instruction}\n\n{user_prompt}"
                        }]
                    }],
                    "generationConfig": {
                        "temperature": self._temperature,
                        "maxOutputTokens": self._max_tokens,
                        "responseMimeType": "application/json",
                    },
                },
                timeout=self._timeout,
            )
            
            latency_ms = (datetime.utcnow() - start_time).total_seconds() * 1000
            self._total_latency_ms += latency_ms
            
            if response.status_code != 200:
                error_msg = f"Gemini API error: {response.status_code} - {response.text}"
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
            
            # Extract content from Gemini response structure
            if "candidates" not in result or len(result["candidates"]) == 0:
                error_msg = "Gemini returned no candidates in response"
                logger.error(error_msg)
                self._error_count += 1
                return LLMResponse(
                    selected_ids=[],
                    explanation="",
                    provider=self.name,
                    latency_ms=latency_ms,
                    error=error_msg,
                )
            
            content = result["candidates"][0]["content"]["parts"][0]["text"]
            
            # Parse the JSON response with fallback extraction
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
                            logger.debug("Parsed JSON from substring of Gemini response")
                        except Exception as e:
                            logger.error(f"Failed to parse JSON substring from Gemini response: {e}")
                    if parsed is None:
                        # Re-raise as JSONDecodeError to be handled by outer except
                        raise json.JSONDecodeError("Could not parse Gemini response as JSON", content, 0)
            
            selected_ids = parsed.get("selected_ids", [])
            explanation = parsed.get("explanation", "No explanation provided")
            confidence = parsed.get("confidence", 0.7)
            
            # Validate selected IDs against candidate list
            candidate_ids = [c.get("id") for c in context.get("candidates", [])]
            valid_ids = [id for id in selected_ids if id in candidate_ids]
            
            if len(valid_ids) != len(selected_ids):
                logger.warning(
                    f"Gemini returned {len(selected_ids) - len(valid_ids)} invalid candidate IDs"
                )
            
            return LLMResponse(
                selected_ids=valid_ids,
                explanation=explanation,
                confidence=confidence,
                provider=self.name,
                latency_ms=latency_ms,
                metadata={
                    "model": self._model,
                    "usage": result.get("usageMetadata", {}),
                },
            )
            
        except json.JSONDecodeError as e:
            latency_ms = (datetime.utcnow() - start_time).total_seconds() * 1000
            self._error_count += 1
            logger.error(f"Failed to parse Gemini response as JSON: {e}")
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
            logger.error(f"Gemini request failed: {e}")
            return LLMResponse(
                selected_ids=[],
                explanation="",
                provider=self.name,
                latency_ms=latency_ms,
                error=str(e),
            )
    
    def _build_system_instruction(self) -> str:
        """Build the system instruction for Gemini."""
        return """You are an expert options trading assistant helping to validate and rank trade candidates for a paper trading autopilot system.

Your role is to:
1. Analyze the provided trade candidates based on their risk/reward profiles
2. Consider the current market regime and portfolio state
3. Select and rank the best candidates that fit the risk constraints
4. Provide clear, detailed reasoning for your selections

IMPORTANT RULES:
- You can ONLY select from the provided candidate IDs
- You CANNOT invent new trades or modify parameters
- Respect the maximum number of selections if specified
- Consider position concentration and portfolio balance
- Provide specific, actionable reasoning

You must respond in JSON format with:
{
  "selected_ids": ["id1", "id2", ...],
  "explanation": "Detailed explanation of your selections, including:\n- Why each trade was chosen\n- Key risk factors considered\n- How selections fit the portfolio\n- Market regime considerations",
  "confidence": 0.0-1.0 (your confidence in these selections)
}"""

    def _build_user_prompt(self, context: Dict[str, Any]) -> str:
        """Build the user prompt with context."""
        parts = ["# Trade Candidate Validation Request\n"]
        
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
        parts.append("\n## Trade Candidates (pre-ranked by Groq)\n")
        for i, candidate in enumerate(context.get("candidates", []), 1):
            parts.append(f"### #{i} - {candidate.get('id')} - {candidate.get('symbol')} {candidate.get('template')}")
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
            parts.append(f"\n## Validation Instructions\n{context['instructions']}")
        else:
            parts.append("\n## Validation Instructions")
            parts.append("Validate and re-rank the top candidates from Groq's initial ranking.")
            parts.append("Select the final 1-2 candidates that offer the best risk/reward")
            parts.append("while fitting within portfolio constraints.")
            parts.append("Provide detailed reasoning for your final selections.")
        
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
                # Simple model list query
                url = f"{self._base_url}/models"
                response = requests.get(
                    url,
                    headers={"x-goog-api-key": self._api_key},
                    timeout=5,
                )
                health["api_reachable"] = response.status_code == 200
            except Exception:
                health["api_reachable"] = False
        
        return health


def create_gemini_provider(
    api_key: Optional[str] = None,
    model: str = "flash",
) -> GeminiProvider:
    """
    Factory function to create a Gemini provider.
    
    Args:
        api_key: Gemini API key (optional, uses env var if not provided)
        model: Model shortname (flash, flash-8b, pro)
        
    Returns:
        Configured GeminiProvider instance
    """
    model_id = GeminiProvider.MODELS.get(model, model)
    return GeminiProvider(api_key=api_key, model=model_id)
