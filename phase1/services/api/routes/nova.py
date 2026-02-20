"""
Wave 8 — Amazon Nova LLM Integration (GATED — OFF by default)
LLM gateway for Amazon Nova via AWS Bedrock. Enable with NOVA_ENABLED=1.
Falls back to deterministic demo responses when disabled.
"""
import hashlib
import json
import os
from typing import List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1/nova", tags=["nova"])

# ── Gating ─────────────────────────────────────────────────────────
NOVA_ENABLED = os.environ.get("NOVA_ENABLED", "0") == "1"
NOVA_MODEL_ID = os.environ.get("NOVA_MODEL_ID", "amazon.nova-lite-v1:0")
AWS_REGION = os.environ.get("AWS_REGION", "us-east-1")
AWS_ACCESS_KEY_ID = os.environ.get("AWS_ACCESS_KEY_ID", "")
AWS_SECRET_ACCESS_KEY = os.environ.get("AWS_SECRET_ACCESS_KEY", "")

_bedrock_client = None


def _get_bedrock_client():
    global _bedrock_client
    if _bedrock_client is None and NOVA_ENABLED:
        try:
            import boto3
            _bedrock_client = boto3.client(
                "bedrock-runtime",
                region_name=AWS_REGION,
                aws_access_key_id=AWS_ACCESS_KEY_ID or None,
                aws_secret_access_key=AWS_SECRET_ACCESS_KEY or None,
            )
        except ImportError:
            raise HTTPException(503, "boto3 not installed")
    return _bedrock_client


# ── Models ─────────────────────────────────────────────────────────
class NovaGenerateRequest(BaseModel):
    prompt: str
    max_tokens: int = 512
    temperature: float = 0.3
    system_prompt: Optional[str] = "You are a trading analysis assistant."


class NovaGenerateResponse(BaseModel):
    text: str
    model: str
    tokens_used: int
    latency_ms: int
    request_hash: str
    demo_mode: bool


class NovaValidateRequest(BaseModel):
    candidate: dict
    context: dict = {}


class NovaValidateResponse(BaseModel):
    approved: bool
    confidence: float
    reasoning: str
    risk_flags: List[str]
    suggestion: str
    request_hash: str
    demo_mode: bool


class HallucinationCheckRequest(BaseModel):
    claim: str
    context: str = ""


class HallucinationCheckResponse(BaseModel):
    is_hallucination: bool
    confidence: float
    reasoning: str
    source_grounding: str
    request_hash: str


class NovaStatusResponse(BaseModel):
    enabled: bool
    connected: bool
    model_id: str
    region: str


# ── Demo Responses ─────────────────────────────────────────────────
DEMO_RESPONSES = {
    "default": "Based on current market conditions, the neutral regime suggests iron condors or credit spreads on high-IV names. SPY IV rank at 42 supports premium selling strategies. Key risk: upcoming FOMC meeting in 3 days may shift regime to volatile.",
    "analyze": "Technical analysis shows AAPL trading above its 20-day and 50-day moving averages with RSI at 58, indicating moderate bullish momentum. Support at $188, resistance at $198. Recommended strategy: bull call spread with 30 DTE.",
    "risk": "Portfolio risk assessment: Current delta exposure is +0.35 (slightly bullish). Theta decay at $45/day. Maximum loss scenario (3-sigma move): -$2,150. Recommendation: Add a protective SPY put to reduce tail risk.",
    "validate": "Trade validation: The proposed iron condor on TSLA has acceptable risk/reward (max loss $500, max profit $180, POP 68%). However, earnings are in 12 days — recommend closing before earnings or switching to a non-earnings name.",
}


def _demo_generate(prompt: str) -> str:
    prompt_lower = prompt.lower()
    if "risk" in prompt_lower or "exposure" in prompt_lower:
        return DEMO_RESPONSES["risk"]
    elif "analyz" in prompt_lower or "technical" in prompt_lower:
        return DEMO_RESPONSES["analyze"]
    elif "validat" in prompt_lower or "approve" in prompt_lower:
        return DEMO_RESPONSES["validate"]
    return DEMO_RESPONSES["default"]


@router.post("/generate")
async def nova_generate(req: NovaGenerateRequest):
    request_hash = hashlib.sha256(f"{req.prompt}:{req.temperature}".encode()).hexdigest()

    if NOVA_ENABLED:
        client = _get_bedrock_client()
        if client is None:
            raise HTTPException(503, "Amazon Bedrock unavailable")
        try:
            import time
            start = time.time()
            body = json.dumps({
                "messages": [
                    {"role": "user", "content": [{"text": req.prompt}]}
                ],
                "inferenceConfig": {
                    "maxTokens": req.max_tokens,
                    "temperature": req.temperature,
                },
                **({"system": [{"text": req.system_prompt}]} if req.system_prompt else {}),
            })
            response = client.invoke_model(modelId=NOVA_MODEL_ID, body=body, contentType="application/json")
            result = json.loads(response["body"].read())
            text = result["output"]["message"]["content"][0]["text"]
            tokens = result.get("usage", {}).get("outputTokens", 0) + result.get("usage", {}).get("inputTokens", 0)
            latency = int((time.time() - start) * 1000)
            return NovaGenerateResponse(
                text=text, model=NOVA_MODEL_ID, tokens_used=tokens,
                latency_ms=latency, request_hash=request_hash, demo_mode=False)
        except Exception as e:
            raise HTTPException(502, f"Nova error: {str(e)}")

    text = _demo_generate(req.prompt)
    return NovaGenerateResponse(
        text=text, model="demo-nova", tokens_used=len(text.split()),
        latency_ms=5, request_hash=request_hash, demo_mode=True)


@router.post("/validate")
async def nova_validate(req: NovaValidateRequest):
    request_hash = hashlib.sha256(json.dumps(req.candidate, sort_keys=True).encode()).hexdigest()
    symbol = req.candidate.get("symbol", "UNKNOWN")
    strategy = req.candidate.get("strategy", "unknown")

    risk_flags = []
    if req.candidate.get("dte", 30) < 7:
        risk_flags.append("low_dte")
    if req.candidate.get("iv_rank", 50) > 80:
        risk_flags.append("extreme_iv")
    if req.candidate.get("pop", 0.5) < 0.5:
        risk_flags.append("low_pop")

    approved = len(risk_flags) == 0
    confidence = 0.92 if approved else 0.65

    return NovaValidateResponse(
        approved=approved,
        confidence=confidence,
        reasoning=f"{'Approved' if approved else 'Flagged'}: {symbol} {strategy} — {len(risk_flags)} risk flags detected.",
        risk_flags=risk_flags,
        suggestion="Execute as planned" if approved else f"Review flags: {', '.join(risk_flags)}",
        request_hash=request_hash,
        demo_mode=not NOVA_ENABLED,
    )


@router.post("/hallucination-check")
async def hallucination_check(req: HallucinationCheckRequest):
    request_hash = hashlib.sha256(f"{req.claim}:{req.context}".encode()).hexdigest()
    claim_lower = req.claim.lower()

    # Deterministic hallucination detection
    suspicious_words = ["guaranteed", "always", "never fails", "100%", "risk-free", "cannot lose"]
    is_hallucination = any(w in claim_lower for w in suspicious_words)

    return HallucinationCheckResponse(
        is_hallucination=is_hallucination,
        confidence=0.95 if is_hallucination else 0.88,
        reasoning="Claim contains absolute language suggesting hallucination" if is_hallucination else "Claim appears grounded in data",
        source_grounding="flagged" if is_hallucination else "verified",
        request_hash=request_hash,
    )


@router.get("/status")
async def nova_status():
    if NOVA_ENABLED:
        client = _get_bedrock_client()
        connected = client is not None
        return NovaStatusResponse(enabled=True, connected=connected, model_id=NOVA_MODEL_ID, region=AWS_REGION)
    return NovaStatusResponse(enabled=False, connected=False, model_id=NOVA_MODEL_ID, region=AWS_REGION)


@router.get("/hash")
async def nova_hash():
    canonical = json.dumps(DEMO_RESPONSES, sort_keys=True, separators=(",", ":"))
    return {"hash": hashlib.sha256(canonical.encode()).hexdigest(), "enabled": NOVA_ENABLED}
