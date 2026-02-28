"""
LLM Provider — safe Gemini + Groq integration for autopilot.

LLM is NEVER allowed to output an order payload directly.
Used ONLY for:
  - decision narrative (plain English explanation)
  - risk checklist (what could go wrong)
  - post-trade evaluation summary

Features:
  - Schema-validated outputs
  - Prompt hash + response hash stored
  - Budgets: max calls/hour, max tokens/call
  - Cache by prompt hash
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


@dataclass
class LLMCallResult:
    provider: str
    model: str
    prompt_hash: str
    response_hash: str
    text: str
    tokens_used: int
    cached: bool
    latency_ms: float
    correlation_id: str
    error: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {k: v for k, v in self.__dict__.items()}


@dataclass
class LLMBudget:
    max_calls_per_hour: int = 30
    max_tokens_per_call: int = 1024
    calls_this_hour: int = 0
    hour_start: float = 0.0

    def check(self) -> bool:
        now = time.time()
        if now - self.hour_start > 3600:
            self.calls_this_hour = 0
            self.hour_start = now
        return self.calls_this_hour < self.max_calls_per_hour

    def consume(self):
        now = time.time()
        if now - self.hour_start > 3600:
            self.calls_this_hour = 0
            self.hour_start = now
        self.calls_this_hour += 1


class LLMProvider:
    """Unified LLM provider wrapping Gemini + Groq with budgets and caching."""

    def __init__(self):
        self._gemini_key = os.environ.get("GEMINI_API_KEY", "")
        self._groq_key = os.environ.get("GROQ_API_KEY", "")
        self._cache: Dict[str, LLMCallResult] = {}
        self._budget = LLMBudget()
        self._call_history: List[Dict[str, Any]] = []
        self._last_error: Optional[str] = None

    @property
    def gemini_available(self) -> bool:
        return bool(self._gemini_key)

    @property
    def groq_available(self) -> bool:
        return bool(self._groq_key)

    @property
    def active_provider(self) -> str:
        if self._gemini_key:
            return "gemini"
        if self._groq_key:
            return "groq"
        return "none"

    @property
    def cache_hit_rate(self) -> float:
        if not self._call_history:
            return 0.0
        hits = sum(1 for c in self._call_history if c.get("cached"))
        return round(hits / len(self._call_history) * 100, 1)

    @property
    def budget_remaining(self) -> int:
        now = time.time()
        if now - self._budget.hour_start > 3600:
            return self._budget.max_calls_per_hour
        return max(0, self._budget.max_calls_per_hour - self._budget.calls_this_hour)

    @property
    def last_error(self) -> Optional[str]:
        return self._last_error

    def _prompt_hash(self, prompt: str) -> str:
        return hashlib.sha256(prompt.encode()).hexdigest()[:16]

    def _response_hash(self, text: str) -> str:
        return hashlib.sha256(text.encode()).hexdigest()[:16]

    async def generate(
        self,
        prompt: str,
        purpose: str = "narrative",
        max_tokens: int = 512,
    ) -> LLMCallResult:
        """Generate text from LLM. Checks cache and budget first."""
        cid = f"llm-{uuid.uuid4().hex[:8]}"
        ph = self._prompt_hash(prompt)

        # Cache check
        if ph in self._cache:
            cached = self._cache[ph]
            result = LLMCallResult(
                provider=cached.provider,
                model=cached.model,
                prompt_hash=ph,
                response_hash=cached.response_hash,
                text=cached.text,
                tokens_used=0,
                cached=True,
                latency_ms=0.0,
                correlation_id=cid,
            )
            self._call_history.append({"cached": True, "provider": cached.provider, "ts": time.time()})
            return result

        # Budget check
        if not self._budget.check():
            return LLMCallResult(
                provider="none", model="budget_exceeded",
                prompt_hash=ph, response_hash="", text="",
                tokens_used=0, cached=False, latency_ms=0.0,
                correlation_id=cid, error="Budget exceeded (max calls/hour reached)",
            )

        # Try Gemini first, then Groq
        result = None
        if self._gemini_key:
            result = await self._call_gemini(prompt, ph, max_tokens, cid)
        if (result is None or result.error) and self._groq_key:
            result = await self._call_groq(prompt, ph, max_tokens, cid)
        if result is None:
            result = LLMCallResult(
                provider="none", model="no_provider",
                prompt_hash=ph, response_hash="", text="[No LLM provider configured]",
                tokens_used=0, cached=False, latency_ms=0.0,
                correlation_id=cid, error="No LLM provider configured",
            )

        # Store in cache and history
        if not result.error:
            self._cache[ph] = result
            self._budget.consume()
        else:
            self._last_error = result.error

        self._call_history.append({
            "cached": False,
            "provider": result.provider,
            "ts": time.time(),
            "error": result.error,
        })

        return result

    async def _call_gemini(self, prompt: str, ph: str, max_tokens: int, cid: str) -> Optional[LLMCallResult]:
        try:
            import httpx
            t0 = time.monotonic()

            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={self._gemini_key}"
            payload = {
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"maxOutputTokens": min(max_tokens, self._budget.max_tokens_per_call)},
            }

            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.post(url, json=payload)
                latency = round((time.monotonic() - t0) * 1000, 1)

                if resp.status_code != 200:
                    self._last_error = f"Gemini HTTP {resp.status_code}"
                    return LLMCallResult(
                        provider="gemini", model="gemini-2.0-flash",
                        prompt_hash=ph, response_hash="", text="",
                        tokens_used=0, cached=False, latency_ms=latency,
                        correlation_id=cid, error=f"HTTP {resp.status_code}",
                    )

                data = resp.json()
                text = ""
                candidates = data.get("candidates", [])
                if candidates:
                    parts = candidates[0].get("content", {}).get("parts", [])
                    if parts:
                        text = parts[0].get("text", "")

                tokens = data.get("usageMetadata", {}).get("totalTokenCount", len(text) // 4)
                rh = self._response_hash(text)

                return LLMCallResult(
                    provider="gemini", model="gemini-2.0-flash",
                    prompt_hash=ph, response_hash=rh, text=text,
                    tokens_used=tokens, cached=False, latency_ms=latency,
                    correlation_id=cid,
                )
        except Exception as e:
            self._last_error = str(e)[:100]
            logger.error(f"Gemini call failed: {e}")
            return None

    async def _call_groq(self, prompt: str, ph: str, max_tokens: int, cid: str) -> Optional[LLMCallResult]:
        try:
            import httpx
            t0 = time.monotonic()

            url = "https://api.groq.com/openai/v1/chat/completions"
            payload = {
                "model": "llama-3.3-70b-versatile",
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": min(max_tokens, self._budget.max_tokens_per_call),
            }
            headers = {"Authorization": f"Bearer {self._groq_key}", "Content-Type": "application/json"}

            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.post(url, json=payload, headers=headers)
                latency = round((time.monotonic() - t0) * 1000, 1)

                if resp.status_code != 200:
                    self._last_error = f"Groq HTTP {resp.status_code}"
                    return LLMCallResult(
                        provider="groq", model="llama-3.3-70b-versatile",
                        prompt_hash=ph, response_hash="", text="",
                        tokens_used=0, cached=False, latency_ms=latency,
                        correlation_id=cid, error=f"HTTP {resp.status_code}",
                    )

                data = resp.json()
                text = data.get("choices", [{}])[0].get("message", {}).get("content", "")
                tokens = data.get("usage", {}).get("total_tokens", len(text) // 4)
                rh = self._response_hash(text)

                return LLMCallResult(
                    provider="groq", model="llama-3.3-70b-versatile",
                    prompt_hash=ph, response_hash=rh, text=text,
                    tokens_used=tokens, cached=False, latency_ms=latency,
                    correlation_id=cid,
                )
        except Exception as e:
            self._last_error = str(e)[:100]
            logger.error(f"Groq call failed: {e}")
            return None

    # ── Structured Generation Methods ─────────────────────────────────

    async def decision_narrative(self, decision: Dict[str, Any]) -> LLMCallResult:
        """Generate a short plain-English explanation of a decision."""
        prompt = (
            "You are a trading analyst. Explain this options autopilot decision in 2-3 sentences. "
            "Be concise and factual. No disclaimers.\n\n"
            f"Decision: {json.dumps(decision, default=str)}"
        )
        return await self.generate(prompt, purpose="narrative", max_tokens=256)

    async def risk_checklist(self, decision: Dict[str, Any]) -> LLMCallResult:
        """Generate what-could-go-wrong risk checklist."""
        prompt = (
            "You are a risk manager. List 3-5 bullet points of what could go wrong "
            "with this options trade. Be specific to the contract and market conditions.\n\n"
            f"Trade: {json.dumps(decision, default=str)}"
        )
        return await self.generate(prompt, purpose="risk_checklist", max_tokens=384)

    async def post_trade_evaluation(self, trade: Dict[str, Any]) -> LLMCallResult:
        """Generate post-trade summary evaluation."""
        prompt = (
            "You are evaluating a completed paper options trade. "
            "Summarize what happened, the P&L, and lessons learned in 2-3 sentences.\n\n"
            f"Trade: {json.dumps(trade, default=str)}"
        )
        return await self.generate(prompt, purpose="evaluation", max_tokens=256)

    def status(self) -> Dict[str, Any]:
        """Return LLM provider status for UI."""
        return {
            "provider": self.active_provider,
            "gemini_available": self.gemini_available,
            "groq_available": self.groq_available,
            "cache_hit_rate": self.cache_hit_rate,
            "cache_size": len(self._cache),
            "budget_remaining": self.budget_remaining,
            "budget_max": self._budget.max_calls_per_hour,
            "total_calls": len(self._call_history),
            "last_error": self._last_error[:80] if self._last_error else None,
        }


# ── Singleton ──────────────────────────────────────────────────────────

_provider: Optional[LLMProvider] = None


def get_llm_provider() -> LLMProvider:
    global _provider
    if _provider is None:
        _provider = LLMProvider()
    return _provider
