"""
Amazon Nova Provider
Implements the LLMProvider ABC using Amazon Nova via AWS Bedrock.
Supports Nova 2 Lite for fast text ranking + Nova Pro for multimodal analysis.
"""
import json
import logging
import os
import time
from datetime import datetime
from typing import Any, Dict, List, Optional

from ..provider import LLMProvider, LLMResponse

logger = logging.getLogger(__name__)

# Model IDs
NOVA_LITE  = "amazon.nova-lite-v1:0"
NOVA_PRO   = "amazon.nova-pro-v1:0"
NOVA_SONIC = "amazon.nova-sonic-v1:0"
NOVA_EMBED = "amazon.nova-embed-multimodal-v1:0"


class NovaProvider(LLMProvider):
    """
    Amazon Nova LLM provider via AWS Bedrock.

    Falls back to deterministic offline stub when AWS credentials are absent.
    Environment variables (read at import time via the route layer, passed in here):
        AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, NOVA_MODEL_ID
    """

    def __init__(
        self,
        model: str = NOVA_LITE,
        region: str = "us-east-1",
        aws_access_key_id: Optional[str] = None,
        aws_secret_access_key: Optional[str] = None,
        temperature: float = 0.3,
        max_tokens: int = 1024,
        timeout_seconds: float = 30.0,
    ) -> None:
        self._model                = model
        self._region               = region
        self._access_key           = aws_access_key_id  or os.environ.get("AWS_ACCESS_KEY_ID",     "")
        self._secret_key           = aws_secret_access_key or os.environ.get("AWS_SECRET_ACCESS_KEY", "")
        self._temperature          = temperature
        self._max_tokens           = max_tokens
        self._timeout              = timeout_seconds
        self._bedrock              = None  # lazy init

        # Metrics
        self._call_count       = 0
        self._error_count      = 0
        self._total_latency_ms = 0.0

    # ── LLMProvider interface ────────────────────────────────────────────────

    @property
    def name(self) -> str:
        return f"nova/{self._model}"

    @property
    def is_available(self) -> bool:
        return bool(self._access_key and self._secret_key)

    def rank_candidates(self, context: Dict[str, Any]) -> LLMResponse:
        """
        Rank autopilot trade candidates using Nova's reasoning capabilities.
        Mirrors the Gemini/Groq provider interface so the brain can hot-swap.
        """
        if not self.is_available:
            return LLMResponse(
                selected_ids=[],
                explanation="Nova provider not available — set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY.",
                provider=self.name,
                error="Missing AWS credentials",
            )

        start = datetime.utcnow()
        self._call_count += 1

        system_prompt = self._build_system_prompt()
        user_prompt   = self._build_user_prompt(context)

        try:
            client = self._get_client()
            body   = {
                "messages": [{"role": "user", "content": [{"text": user_prompt}]}],
                "inferenceConfig": {
                    "maxTokens":   self._max_tokens,
                    "temperature": self._temperature,
                },
                "system": [{"text": system_prompt}],
            }
            raw      = client.invoke_model(
                modelId=self._model,
                body=json.dumps(body),
                contentType="application/json",
            )
            result   = json.loads(raw["body"].read())
            latency  = (datetime.utcnow() - start).total_seconds() * 1000
            self._total_latency_ms += latency

            text     = result["output"]["message"]["content"][0]["text"]
            parsed   = self._parse_json_response(text)

            selected = parsed.get("selected_ids", [])
            valid_ids = [
                i for i in selected
                if i in {c.get("id") for c in context.get("candidates", [])}
            ]

            if len(valid_ids) < len(selected):
                logger.warning("Nova returned %d invalid candidate IDs", len(selected) - len(valid_ids))

            return LLMResponse(
                selected_ids=valid_ids,
                explanation=parsed.get("explanation", "No explanation provided"),
                confidence=float(parsed.get("confidence", 0.75)),
                provider=self.name,
                latency_ms=latency,
                metadata={
                    "model":  self._model,
                    "usage":  result.get("usage", {}),
                    "region": self._region,
                },
            )

        except json.JSONDecodeError as exc:
            latency = (datetime.utcnow() - start).total_seconds() * 1000
            self._error_count += 1
            logger.error("Failed to parse Nova JSON: %s", exc)
            return LLMResponse(
                selected_ids=[], explanation="", provider=self.name,
                latency_ms=latency, error=f"JSON parse error: {exc}",
            )
        except Exception as exc:  # noqa: BLE001
            latency = (datetime.utcnow() - start).total_seconds() * 1000
            self._error_count += 1
            logger.error("Nova request failed: %s", exc)
            return LLMResponse(
                selected_ids=[], explanation="", provider=self.name,
                latency_ms=latency, error=str(exc),
            )

    # ── Health ───────────────────────────────────────────────────────────────

    def health_check(self) -> Dict[str, Any]:
        health: Dict[str, Any] = {
            "provider":         self.name,
            "available":        self.is_available,
            "model":            self._model,
            "region":           self._region,
            "credentials_set":  self.is_available,
            "call_count":       self._call_count,
            "error_count":      self._error_count,
            "avg_latency_ms":   (
                self._total_latency_ms / self._call_count
                if self._call_count > 0 else 0.0
            ),
            "timestamp":        datetime.utcnow().isoformat(),
        }
        if self.is_available:
            try:
                # Minimal probe: generate a tiny response
                client = self._get_client()
                probe_body = {
                    "messages": [{"role": "user", "content": [{"text": "ping"}]}],
                    "inferenceConfig": {"maxTokens": 5, "temperature": 0.0},
                }
                client.invoke_model(
                    modelId=self._model,
                    body=json.dumps(probe_body),
                    contentType="application/json",
                )
                health["api_reachable"] = True
            except Exception:
                health["api_reachable"] = False
        return health

    # ── Internals ────────────────────────────────────────────────────────────

    def _get_client(self):
        if self._bedrock is None:
            try:
                import boto3
                self._bedrock = boto3.client(
                    "bedrock-runtime",
                    region_name=self._region,
                    aws_access_key_id=self._access_key or None,
                    aws_secret_access_key=self._secret_key or None,
                )
            except ImportError as exc:
                raise RuntimeError("boto3 not installed — run: pip install boto3") from exc
        return self._bedrock

    def _build_system_prompt(self) -> str:
        return (
            "You are an expert algorithmic options trading assistant integrated into Apex Terminal, "
            "a Bloomberg-style AI trading workstation. Your role is to validate and rank trade candidates "
            "for an autonomous paper trading engine powered by Amazon Nova on AWS Bedrock.\n\n"
            "RULES:\n"
            "- Select ONLY from the candidate IDs provided — never invent new trades.\n"
            "- Respect max 2 selections unless instructed otherwise.\n"
            "- Penalise low POP (<50%), extreme IV (>80th pct), and earnings proximity (<7 DTE).\n"
            "- Reward high liquidity scores and balanced portfolio exposure.\n"
            "- Provide specific, data-grounded reasoning.\n\n"
            "Respond in JSON ONLY:\n"
            '{"selected_ids":["id1"],"explanation":"...","confidence":0.0}'
        )

    def _build_user_prompt(self, context: Dict[str, Any]) -> str:
        parts: List[str] = ["# Apex Terminal — Nova Trade Candidate Ranking\n"]

        if "market_regime" in context:
            parts.append(f"## Market Regime\n{context['market_regime']}\n")
        if "vix_level" in context:
            parts.append(f"VIX: {context['vix_level']}\n")

        if "portfolio" in context:
            p = context["portfolio"]
            parts.append(
                f"\n## Portfolio\n"
                f"- Equity: ${p.get('equity', 0):,.0f}\n"
                f"- Open positions: {p.get('position_count', 0)}\n"
                f"- Total risk: ${p.get('total_risk', 0):,.0f}\n"
                f"- Daily P&L: ${p.get('daily_pnl', 0):,.0f}\n"
            )

        parts.append("\n## Candidates\n")
        for i, cand in enumerate(context.get("candidates", []), 1):
            parts.append(
                f"### #{i}  {cand.get('id')} — {cand.get('symbol')} {cand.get('template','')}\n"
                f"- Max loss: ${cand.get('max_loss', 0):,.0f}  "
                f"| Max profit: ${cand.get('max_profit', 0):,.0f}\n"
                f"- POP: {cand.get('pop', 0)*100:.1f}%  "
                f"| DTE: {cand.get('dte', 0)}d  "
                f"| IV rank: {cand.get('iv_rank', 0)*100:.1f}%\n"
                f"- Liquidity: {cand.get('liquidity_score', 0):.2f}  "
                f"| Score: {cand.get('base_score', 0):.2f}\n"
            )

        if "instructions" in context:
            parts.append(f"\n## Instructions\n{context['instructions']}\n")

        return "\n".join(parts)

    @staticmethod
    def _parse_json_response(text: str) -> Dict[str, Any]:
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            i = text.find("{")
            j = text.rfind("}")
            if i != -1 and j != -1 and j > i:
                try:
                    return json.loads(text[i : j + 1])
                except json.JSONDecodeError:
                    pass
        return {}


# ── Factory ──────────────────────────────────────────────────────────────────

def create_nova_provider(
    model: str = "lite",
    region: Optional[str] = None,
    aws_access_key_id: Optional[str] = None,
    aws_secret_access_key: Optional[str] = None,
) -> NovaProvider:
    """
    Create a configured NovaProvider.

    Args:
        model: "lite" | "pro" | full model ID string
        region: AWS region (defaults to AWS_REGION env var or "us-east-1")
        aws_access_key_id: AWS access key (defaults to AWS_ACCESS_KEY_ID env var)
        aws_secret_access_key: AWS secret (defaults to AWS_SECRET_ACCESS_KEY env var)
    """
    model_map = {"lite": NOVA_LITE, "pro": NOVA_PRO, "sonic": NOVA_SONIC}
    model_id  = model_map.get(model, model)
    effective_region = region or os.environ.get("AWS_REGION", "us-east-1")
    return NovaProvider(
        model=model_id,
        region=effective_region,
        aws_access_key_id=aws_access_key_id,
        aws_secret_access_key=aws_secret_access_key,
    )
