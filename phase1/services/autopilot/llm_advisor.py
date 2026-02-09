"""
Bounded LLM Advisor (Milestone 4)

Implements LLM as a bounded advisor with strict guardrails:
- CAN: Tie-break top-K candidates, generate explanations, summarize news
- CANNOT: Invent strategies, override caps, place orders, change exits

Must be OFF by default for backtests.
"""

import logging
import os
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any
from datetime import datetime
from enum import Enum

logger = logging.getLogger(__name__)

class AdvisorMode(str, Enum):
    """Advisor operating mode."""
    OFF = "off"                # Completely disabled (for backtests)
    TIE_BREAK_ONLY = "tie_break"  # Only tie-break, no explanations
    FULL = "full"              # Full advisory with explanations

@dataclass
class AdvisorRequest:
    """Request to the LLM advisor."""
    request_id: str
    timestamp: datetime
    
    # Context
    candidates: List[Dict[str, Any]]  # Top-K candidates to evaluate
    regime: str
    sentiment_score: float
    shock_flag: bool
    
    # Constraints
    max_candidates_to_return: int = 1
    
    def to_prompt_context(self) -> str:
        """Convert to prompt context string."""
        lines = [
            f"Market Regime: {self.regime}",
            f"Sentiment Score: {self.sentiment_score:.2f}",
            f"Shock Flag: {self.shock_flag}",
            "",
            "Candidates to evaluate:",
        ]
        
        for i, c in enumerate(self.candidates, 1):
            lines.append(f"\n{i}. {c.get('symbol', 'N/A')} - {c.get('template', 'N/A')}")
            lines.append(f"   Direction: {c.get('direction', 'N/A')}")
            lines.append(f"   Score: {c.get('total_score', 0):.1f}")
            lines.append(f"   Max Loss: ${c.get('max_loss', 0):.0f}")
        
        return "\n".join(lines)

@dataclass
class AdvisorResponse:
    """Response from the LLM advisor."""
    request_id: str
    timestamp: datetime
    
    # Selection
    selected_candidate_index: int  # 0-indexed
    confidence: float
    
    # Explanation
    reasoning: str = ""
    risk_assessment: str = ""
    
    # For audit
    raw_response: str = ""
    latency_ms: float = 0.0
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "request_id": self.request_id,
            "timestamp": self.timestamp.isoformat(),
            "selected_index": self.selected_candidate_index,
            "confidence": self.confidence,
            "reasoning": self.reasoning,
            "latency_ms": self.latency_ms,
        }

# System prompt that defines LLM boundaries
ADVISOR_SYSTEM_PROMPT = """You are a trading advisor for a 0DTE options autopilot.

YOUR ROLE:
- Evaluate the provided candidates and select the BEST one
- Provide brief reasoning for your selection
- Assess risk factors

YOUR BOUNDARIES (CRITICAL - DO NOT VIOLATE):
✅ ALLOWED:
- Select from provided candidates only
- Explain why you prefer one candidate
- Point out risk factors
- Use market context to inform selection

❌ FORBIDDEN:
- Invent new strategies or candidates
- Override risk limits or stops
- Suggest taking no trade when candidates are provided
- Change position sizing
- Modify exit rules

OUTPUT FORMAT:
Return JSON with:
{
  "selected_index": 0,  // 0-indexed, which candidate from the list
  "confidence": 0.85,   // 0.0 to 1.0
  "reasoning": "Brief explanation",
  "risk_assessment": "Brief risk note"
}

If you cannot decide, select index 0 with lower confidence."""

class BoundedLLMAdvisor:
    """
    LLM advisor with strict boundaries.
    
    Key constraints:
    1. Can only select from provided candidates
    2. Cannot invent new strategies
    3. Cannot override risk rules
    4. Must be disableable for backtests
    """
    
    def __init__(
        self,
        mode: AdvisorMode = AdvisorMode.OFF,
        provider: str = "groq",
    ):
        self.mode = mode
        self.provider = provider
        self._client = None
        
        # Track for replay in backtests
        self._request_log: List[Dict[str, Any]] = []
        self._response_log: List[Dict[str, Any]] = []
    
    @property
    def is_enabled(self) -> bool:
        return self.mode != AdvisorMode.OFF
    
    def set_mode(self, mode: AdvisorMode):
        """Set advisor mode."""
        self.mode = mode
        logger.info(f"LLM Advisor mode set to: {mode.value}")
    
    async def advise(
        self,
        request: AdvisorRequest,
    ) -> Optional[AdvisorResponse]:
        """
        Get advice on candidate selection.
        
        Returns None if advisor is OFF.
        """
        if self.mode == AdvisorMode.OFF:
            return None
        
        # Log request for replay
        self._request_log.append({
            "request_id": request.request_id,
            "timestamp": request.timestamp.isoformat(),
            "candidates": request.candidates,
        })
        
        start_time = datetime.utcnow()
        
        try:
            # Build prompt
            prompt = request.to_prompt_context()
            
            # Call LLM
            raw_response = await self._call_llm(prompt)
            
            # Parse response
            response = self._parse_response(request, raw_response)
            
            # Calculate latency
            response.latency_ms = (datetime.utcnow() - start_time).total_seconds() * 1000
            
            # Log response
            self._response_log.append(response.to_dict())
            
            return response
            
        except Exception as e:
            logger.error(f"Advisor error: {e}")
            
            # Fallback: return first candidate with low confidence
            return AdvisorResponse(
                request_id=request.request_id,
                timestamp=datetime.utcnow(),
                selected_candidate_index=0,
                confidence=0.3,
                reasoning=f"Fallback due to error: {str(e)}",
            )
    
    async def _call_llm(self, prompt: str) -> str:
        """Call the LLM provider."""
        if self.provider == "groq":
            return await self._call_groq(prompt)
        elif self.provider == "gemini":
            return await self._call_gemini(prompt)
        else:
            raise ValueError(f"Unknown provider: {self.provider}")
    
    async def _call_groq(self, prompt: str) -> str:
        """Call Groq API."""
        import aiohttp
        
        api_key = os.environ.get("GROQ_API_KEY")
        if not api_key:
            raise ValueError("GROQ_API_KEY not set")
        
        url = "https://api.groq.com/openai/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        
        payload = {
            "model": "llama3-70b-8192",
            "messages": [
                {"role": "system", "content": ADVISOR_SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.1,  # Low temp for consistency
            "max_tokens": 500,
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.post(url, headers=headers, json=payload) as resp:
                if resp.status != 200:
                    text = await resp.text()
                    raise Exception(f"Groq API error: {resp.status} - {text}")
                
                data = await resp.json()
                return data["choices"][0]["message"]["content"]
    
    async def _call_gemini(self, prompt: str) -> str:
        """Call Gemini API."""
        import aiohttp
        
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY not set")
        
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
        
        payload = {
            "contents": [{
                "parts": [
                    {"text": ADVISOR_SYSTEM_PROMPT},
                    {"text": prompt},
                ]
            }],
            "generationConfig": {
                "temperature": 0.1,
                "maxOutputTokens": 500,
            }
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload) as resp:
                if resp.status != 200:
                    text = await resp.text()
                    raise Exception(f"Gemini API error: {resp.status} - {text}")
                
                data = await resp.json()
                return data["candidates"][0]["content"]["parts"][0]["text"]
    
    def _parse_response(
        self,
        request: AdvisorRequest,
        raw_response: str,
    ) -> AdvisorResponse:
        """Parse LLM response into structured format."""
        import json
        
        # Try to extract JSON from response
        try:
            # Find JSON in response
            start = raw_response.find("{")
            end = raw_response.rfind("}") + 1
            
            if start >= 0 and end > start:
                json_str = raw_response[start:end]
                data = json.loads(json_str)
                
                # Validate selected index is in bounds
                selected = data.get("selected_index", 0)
                if selected < 0 or selected >= len(request.candidates):
                    selected = 0
                
                return AdvisorResponse(
                    request_id=request.request_id,
                    timestamp=datetime.utcnow(),
                    selected_candidate_index=selected,
                    confidence=min(1.0, max(0.0, data.get("confidence", 0.5))),
                    reasoning=data.get("reasoning", ""),
                    risk_assessment=data.get("risk_assessment", ""),
                    raw_response=raw_response,
                )
        except json.JSONDecodeError:
            pass
        
        # Fallback: couldn't parse
        return AdvisorResponse(
            request_id=request.request_id,
            timestamp=datetime.utcnow(),
            selected_candidate_index=0,
            confidence=0.5,
            reasoning="Could not parse LLM response",
            raw_response=raw_response,
        )
    
    def get_replay_data(self) -> Dict[str, Any]:
        """Get data for exact replay in backtests."""
        return {
            "requests": self._request_log,
            "responses": self._response_log,
        }
    
    def load_replay_data(self, data: Dict[str, Any]):
        """Load replay data for backtest reproducibility."""
        self._request_log = data.get("requests", [])
        self._response_log = data.get("responses", [])
