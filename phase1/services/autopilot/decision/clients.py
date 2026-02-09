"""
LLM Clients (Phase 1, Layer 3)

Wrappers/Subclasses of base providers to enforce V2 strict outputs.
These clients return strict Pydantic models (autopilot.decision.models) 
instead of generic dataclasses.
"""

import logging
import json
from typing import Dict, Any, List
from datetime import datetime

from ...llm.providers.groq_provider import GroqProvider
from ...llm.providers.gemini_provider import GeminiProvider
from .models import LLMResponse, CandidateSelection, DecisionAction, TradeJustification

logger = logging.getLogger(__name__)

class GroqClientV2(GroqProvider):
    """Groq Client enforcing V2 output schema."""
    
    def get_decision(self, context: Dict[str, Any]) -> LLMResponse:
        """
        Get trade decision from Groq with strict validation.
        Overrides rank_candidates behavior but keeps connection logic.
        """
        if not self.is_available:
            raise RuntimeError("Groq provider not available")
            
        # Use the base class's request logic but we need to intercept the result parsing
        # Since _build_system_prompt is called internally, we need to override it OR
        # duplicate the request logic. Duplicating is safer to avoid breaking legacy options.
        # However, to be DRY, we'll try to reuse where possible, but GroqProvider is monolithic.
        # Let's override the ONE method structure: rank_candidates
        
        # ACTUALLY, checking GroqProvider source, it uses _build_system_prompt inside rank_candidates.
        # So we can just call super().rank_candidates if we monkeypatch or override _build_system_prompt.
        # But that's messy.
        
        # Cleanest way: Re-implement the HTTP call using the same config.
        # We'll call strict_rank_candidates.
        return self._strict_rank_candidates(context)

    def _strict_rank_candidates(self, context: Dict[str, Any]) -> LLMResponse:
        import requests 
        
        start_time = datetime.utcnow()
        
        system_prompt = self._build_v2_system_prompt()
        user_prompt = self._build_user_prompt(context) # Reuse base user prompt builder
        
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
            
            if response.status_code != 200:
                raise RuntimeError(f"Groq API error: {response.status_code} - {response.text}")
                
            result = response.json()
            content = result["choices"][0]["message"]["content"]
            
            # Parse JSON
            try:
                parsed = json.loads(content)
            except json.JSONDecodeError:
                # Try substring extraction
                 s = content
                 i = s.find('{')
                 j = s.rfind('}')
                 if i != -1 and j != -1:
                     parsed = json.loads(s[i:j+1])
                 else:
                     raise
                     
            # Convert to Pydantic Model
            # Expected JSON structure matches Pydantic model
            selections = []
            for sel in parsed.get("selections", []):
                selections.append(CandidateSelection(
                    candidate_id=sel["candidate_id"],
                    action=DecisionAction(sel["action"].lower()),
                    confidence=float(sel["confidence"]),
                    justification=TradeJustification(**sel["justification"])
                ))
            
            return LLMResponse(
                model_used=self.name,
                selections=selections,
                overall_sentiment=parsed.get("overall_sentiment")
            )
            
        except Exception as e:
            logger.error(f"Groq V2 decision failed: {e}")
            # Identify hallucinations or schema errors here?
            # For now re-raise to let consensus handle it
            raise e

    def _build_v2_system_prompt(self) -> str:
        return """You are an expert options trading AI (Phase 1 Validation Layer).
Your goal is to strictly select the best trade candidates from the provided list.

OUTPUT SCHEMA (JSON):
{
  "selections": [
    {
      "candidate_id": "string (must match input ID exactly)",
      "action": "accept" | "reject",
      "confidence": 0.0-1.0,
      "justification": {
        "technical_analysis": "string",
        "risk_assessment": "string",
        "market_context": "string",
        "final_verdict": "string"
      }
    }
  ],
  "overall_sentiment": "bullish" | "bearish" | "neutral"
}

RULES:
1. ONLY select candidates that have a high probability of success (>70%).
2. If a candidate is risky, mark action as "reject" but still explain why.
3. If no candidates are good, return empty selections or reject all.
4. Hallucinating a candidate_id is a CRITICAL ERROR.
"""

class GeminiClientV2(GeminiProvider):
    """Gemini Client enforcing V2 output schema."""
    
    def get_decision(self, context: Dict[str, Any]) -> LLMResponse:
        if not self.is_available:
             raise RuntimeError("Gemini provider not available")
        return self._strict_rank_candidates(context)
        
    def _strict_rank_candidates(self, context: Dict[str, Any]) -> LLMResponse:
        import requests
        
        system_instruction = self._build_v2_system_instruction()
        user_prompt = self._build_user_prompt(context)
        
        url = f"{self._base_url}/models/{self._model}:generateContent"
        
        try:
            response = requests.post(
                url,
                headers={"Content-Type": "application/json", "x-goog-api-key": self._api_key},
                json={
                    "contents": [{"parts": [{"text": f"{system_instruction}\n\n{user_prompt}"}]}],
                    "generationConfig": {
                        "temperature": self._temperature,
                        "maxOutputTokens": self._max_tokens,
                        "responseMimeType": "application/json",
                    },
                },
                timeout=self._timeout,
            )
            
            if response.status_code != 200:
                 raise RuntimeError(f"Gemini API error: {response.text}")

            result = response.json()
            if "candidates" not in result or not result["candidates"]:
                raise RuntimeError("No content from Gemini")
                
            content = result["candidates"][0]["content"]["parts"][0]["text"]
            parsed = json.loads(content)
            
            selections = []
            for sel in parsed.get("selections", []):
                selections.append(CandidateSelection(
                    candidate_id=sel["candidate_id"],
                    action=DecisionAction(sel["action"].lower()),
                    confidence=float(sel["confidence"]),
                    justification=TradeJustification(**sel["justification"])
                ))
                
            return LLMResponse(
                model_used=self.name,
                selections=selections,
                overall_sentiment=parsed.get("overall_sentiment")
            )
            
        except Exception as e:
            logger.error(f"Gemini V2 decision failed: {e}")
            raise e

    def _build_v2_system_instruction(self) -> str:
        return """You are an expert options trading AI (Phase 1 Validation Layer).
Analyze the candidates and return a strict JSON response.

OUTPUT SCHEMA (JSON):
{
  "selections": [
    {
      "candidate_id": "string",
      "action": "accept" | "reject",
      "confidence": float,
      "justification": {
        "technical_analysis": "string",
        "risk_assessment": "string",
        "market_context": "string",
        "final_verdict": "string"
      }
    }
  ],
  "overall_sentiment": "string"
}

Ensure strict adherence to the schema. Do not output markdown code blocks.
"""
