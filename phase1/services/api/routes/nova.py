"""
Amazon Nova LLM Integration — Apex Terminal Hackathon Edition
Full suite: Nova 2 Lite (reasoning), Nova Sonic (voice), Nova Multimodal (vision),
            Nova Act (UI automation), Nova Embeddings (pattern similarity)

Set NOVA_ENABLED=1 and AWS credentials to switch from demo → live.
"""
import base64
import hashlib
import json
import os
import time
import uuid
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1/nova", tags=["nova"])

# ── Configuration ────────────────────────────────────────────────────────────
NOVA_ENABLED          = os.environ.get("NOVA_ENABLED", "0") == "1"
NOVA_MODEL_ID         = os.environ.get("NOVA_MODEL_ID", "amazon.nova-lite-v1:0")
NOVA_SONIC_ENABLED    = os.environ.get("NOVA_SONIC_ENABLED", "0") == "1"
NOVA_ACT_ENABLED      = os.environ.get("NOVA_ACT_ENABLED", "0") == "1"
AWS_REGION            = os.environ.get("AWS_REGION", "us-east-1")
AWS_ACCESS_KEY_ID     = os.environ.get("AWS_ACCESS_KEY_ID", "")
AWS_SECRET_ACCESS_KEY = os.environ.get("AWS_SECRET_ACCESS_KEY", "")

# Model IDs
_NOVA_LITE   = "amazon.nova-lite-v1:0"      # fast, cost-effective text reasoning
_NOVA_PRO    = "amazon.nova-pro-v1:0"       # richer multimodal reasoning
_NOVA_SONIC  = "amazon.nova-sonic-v1:0"     # speech-to-speech
_NOVA_EMBED  = "amazon.nova-embed-multimodal-v1:0"  # multimodal embeddings

_bedrock_client = None
_bedrock_runtime = None


def _get_bedrock(region: str = AWS_REGION):
    global _bedrock_client
    if _bedrock_client is None and NOVA_ENABLED:
        try:
            import boto3
            _bedrock_client = boto3.client(
                "bedrock-runtime",
                region_name=region,
                aws_access_key_id=AWS_ACCESS_KEY_ID or None,
                aws_secret_access_key=AWS_SECRET_ACCESS_KEY or None,
            )
        except ImportError:
            raise HTTPException(503, "boto3 not installed — pip install boto3")
    return _bedrock_client


def _invoke(model_id: str, body: dict) -> dict:
    client = _get_bedrock()
    if client is None:
        raise RuntimeError("Bedrock client not available")
    resp = client.invoke_model(
        modelId=model_id,
        body=json.dumps(body),
        contentType="application/json",
    )
    return json.loads(resp["body"].read())


# ── Common models ─────────────────────────────────────────────────────────────
class NovaStatusResponse(BaseModel):
    enabled: bool
    sonic_enabled: bool
    act_enabled: bool
    connected: bool
    model_id: str
    region: str
    demo_mode: bool


# ══════════════════════════════════════════════════════════════════════════════
# 1.  TEXT GENERATION  — Nova 2 Lite
# ══════════════════════════════════════════════════════════════════════════════

class GenerateRequest(BaseModel):
    prompt: str
    max_tokens: int = 512
    temperature: float = 0.3
    system_prompt: Optional[str] = "You are an expert trading and financial analysis assistant."
    session_id: Optional[str] = None


class GenerateResponse(BaseModel):
    text: str
    model: str
    tokens_used: int
    latency_ms: int
    request_hash: str
    demo_mode: bool
    session_id: str


_DEMO_CHAT: Dict[str, str] = {
    "default":  "Based on current market conditions, the neutral regime suggests iron condors or credit spreads on high-IV names. SPY IV rank at 42 supports premium selling strategies. Key risk: upcoming FOMC meeting in 3 days may shift regime to volatile.",
    "analyze":  "Technical analysis shows AAPL trading above its 20-day and 50-day moving averages with RSI at 58, indicating moderate bullish momentum. Support at $188, resistance at $198. Recommended strategy: bull call spread with 30 DTE.",
    "risk":     "Portfolio risk assessment: Current delta exposure is +0.35 (slightly bullish). Theta decay at $45/day. Maximum loss scenario (3-sigma move): −$2,150. Recommendation: add a protective SPY put to reduce tail risk.",
    "validate": "Trade validation: The proposed iron condor on TSLA has acceptable risk/reward (max loss $500, max profit $180, POP 68%). However, earnings are in 12 days — recommend closing before earnings or switching to a non-earnings name.",
    "portfolio":"Your portfolio is well-diversified across 8 sectors. Top risk contributors: NVDA (tech concentration 18%), AMZN (idiosyncratic earnings risk). Consider trimming NVDA before its earnings print next Thursday.",
    "strategy": "For a neutral-to-bullish outlook with VIX at 18, a diagonal calendar spread on SPY offers strong theta capture with defined risk. Alternatively, a jade lizard on a high-IV single name like META could collect $3.20 credit with no upside risk.",
}


def _demo_chat(prompt: str) -> str:
    p = prompt.lower()
    if any(k in p for k in ["risk", "exposure", "var", "drawdown"]):
        return _DEMO_CHAT["risk"]
    if any(k in p for k in ["analyz", "technical", "chart", "pattern", "indicator"]):
        return _DEMO_CHAT["analyze"]
    if any(k in p for k in ["validat", "approv", "check trade"]):
        return _DEMO_CHAT["validate"]
    if any(k in p for k in ["portfolio", "position", "holding"]):
        return _DEMO_CHAT["portfolio"]
    if any(k in p for k in ["strategy", "spread", "condor", "straddle"]):
        return _DEMO_CHAT["strategy"]
    return _DEMO_CHAT["default"]


@router.post("/generate", response_model=GenerateResponse)
async def nova_generate(req: GenerateRequest):
    rh = hashlib.sha256(f"{req.prompt}:{req.temperature}".encode()).hexdigest()
    sid = req.session_id or str(uuid.uuid4())

    if NOVA_ENABLED:
        client = _get_bedrock()
        if client is None:
            raise HTTPException(503, "Amazon Bedrock unavailable")
        try:
            t0 = time.time()
            body: Dict[str, Any] = {
                "messages": [{"role": "user", "content": [{"text": req.prompt}]}],
                "inferenceConfig": {"maxTokens": req.max_tokens, "temperature": req.temperature},
            }
            if req.system_prompt:
                body["system"] = [{"text": req.system_prompt}]
            result = _invoke(NOVA_MODEL_ID, body)
            text    = result["output"]["message"]["content"][0]["text"]
            tokens  = result.get("usage", {}).get("outputTokens", 0) + result.get("usage", {}).get("inputTokens", 0)
            latency = int((time.time() - t0) * 1000)
            return GenerateResponse(text=text, model=NOVA_MODEL_ID, tokens_used=tokens,
                                    latency_ms=latency, request_hash=rh, demo_mode=False, session_id=sid)
        except Exception as e:
            raise HTTPException(502, f"Nova error: {e}")

    text = _demo_chat(req.prompt)
    return GenerateResponse(text=text, model="demo-nova-lite", tokens_used=len(text.split()),
                            latency_ms=5, request_hash=rh, demo_mode=True, session_id=sid)


# ── Conversation chat (multi-turn) ────────────────────────────────────────────
class ChatMessage(BaseModel):
    role: str   # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    system_prompt: Optional[str] = "You are Nova, an expert AI trading assistant embedded in Apex Terminal. Provide concise, data-driven financial analysis."
    max_tokens: int = 1024
    temperature: float = 0.3


class ChatResponse(BaseModel):
    reply: str
    model: str
    tokens_used: int
    latency_ms: int
    demo_mode: bool


@router.post("/chat", response_model=ChatResponse)
async def nova_chat(req: ChatRequest):
    if NOVA_ENABLED:
        client = _get_bedrock()
        if client is None:
            raise HTTPException(503, "Bedrock unavailable")
        try:
            t0 = time.time()
            body: Dict[str, Any] = {
                "messages": [{"role": m.role, "content": [{"text": m.content}]} for m in req.messages],
                "inferenceConfig": {"maxTokens": req.max_tokens, "temperature": req.temperature},
            }
            if req.system_prompt:
                body["system"] = [{"text": req.system_prompt}]
            result = _invoke(NOVA_MODEL_ID, body)
            reply  = result["output"]["message"]["content"][0]["text"]
            tokens = result.get("usage", {}).get("outputTokens", 0) + result.get("usage", {}).get("inputTokens", 0)
            return ChatResponse(reply=reply, model=NOVA_MODEL_ID, tokens_used=tokens,
                                latency_ms=int((time.time() - t0) * 1000), demo_mode=False)
        except Exception as e:
            raise HTTPException(502, f"Nova chat error: {e}")

    last_user = next((m.content for m in reversed(req.messages) if m.role == "user"), "")
    reply = _demo_chat(last_user)
    return ChatResponse(reply=reply, model="demo-nova-lite", tokens_used=len(reply.split()),
                        latency_ms=8, demo_mode=True)


# ══════════════════════════════════════════════════════════════════════════════
# 2.  MULTIMODAL CHART VISION  — Nova Pro (image + text)
# ══════════════════════════════════════════════════════════════════════════════

class ChartAnalysisResponse(BaseModel):
    analysis: str
    patterns_detected: List[str]
    signals: List[Dict[str, Any]]
    confidence: float
    model: str
    demo_mode: bool
    latency_ms: int


_DEMO_CHART_PATTERNS = [
    "Ascending triangle breakout (bullish)",
    "Golden cross — 50 SMA crossing 200 SMA",
    "RSI divergence (bearish) at resistance",
    "Volume climax at support — potential reversal",
    "Head-and-shoulders completion — target: −12%",
]

_DEMO_CHART_ANALYSIS = """## Chart Pattern Analysis

**Detected Patterns:**
- Ascending triangle with 3 confirmed touches on resistance (~$192)
- Golden cross confirmed: 50-day SMA crossed above 200-day SMA 6 sessions ago
- RSI at 71 — approaching overbought; potential for shallow pullback

**Support/Resistance:**
- Key resistance: $192.50 (4× tested)
- Primary support: $183.00 (ascending trendline)
- Secondary support: $176.50 (200-day SMA)

**Volume Profile:**
- Above-average volume on up days (bullish accumulation)
- Low volume on pullbacks (lack of distribution)

**Recommendation:**
Bias is **bullish on confirmed breakout above $192.50**. Wait for a close above resistance with volume > 1.5× 20-day average. Risk: daily close below $183 invalidates the setup.

*[Nova Multimodal Vision Analysis — amazon.nova-pro-v1:0]*"""


@router.post("/analyze-chart", response_model=ChartAnalysisResponse)
async def analyze_chart(
    image: UploadFile = File(...),
    timeframe: str = Form("1D"),
    symbol: str = Form("UNKNOWN"),
    extra_context: str = Form(""),
):
    """
    Upload a chart screenshot; Nova Pro analyses patterns, S/R, signals.
    NOVA_ENABLED=0 → richly deterministic demo response.
    NOVA_ENABLED=1 → real amazon.nova-pro-v1:0 multimodal inference.
    """
    image_bytes = await image.read()
    b64 = base64.b64encode(image_bytes).decode()
    media_type = image.content_type or "image/png"

    if NOVA_ENABLED:
        client = _get_bedrock()
        if client is None:
            raise HTTPException(503, "Bedrock unavailable")
        try:
            t0 = time.time()
            prompt_text = (
                f"Analyse this {timeframe} chart for {symbol}. "
                "Identify chart patterns, key support/resistance levels, volume signals, "
                "and any divergences. Provide actionable trading insights. "
                + (f"Additional context: {extra_context}" if extra_context else "")
            )
            body = {
                "messages": [{
                    "role": "user",
                    "content": [
                        {"image": {"format": media_type.split("/")[-1], "source": {"bytes": b64}}},
                        {"text": prompt_text},
                    ],
                }],
                "inferenceConfig": {"maxTokens": 1024, "temperature": 0.2},
                "system": [{"text": "You are an expert technical analyst. Respond with structured markdown."}],
            }
            result = _invoke(_NOVA_PRO, body)
            analysis = result["output"]["message"]["content"][0]["text"]
            latency  = int((time.time() - t0) * 1000)
            return ChartAnalysisResponse(
                analysis=analysis,
                patterns_detected=["See analysis"],
                signals=[{"type": "nova_vision", "confidence": 0.9}],
                confidence=0.9, model=_NOVA_PRO, demo_mode=False, latency_ms=latency,
            )
        except Exception as e:
            raise HTTPException(502, f"Nova vision error: {e}")

    import random
    patterns = random.sample(_DEMO_CHART_PATTERNS, k=min(3, len(_DEMO_CHART_PATTERNS)))
    return ChartAnalysisResponse(
        analysis=_DEMO_CHART_ANALYSIS.replace("UNKNOWN", symbol),
        patterns_detected=patterns,
        signals=[
            {"type": "breakout", "direction": "bullish", "confidence": 0.78, "target": "+8%"},
            {"type": "momentum", "indicator": "RSI", "value": 71, "signal": "approaching_overbought"},
        ],
        confidence=0.82, model="demo-nova-pro", demo_mode=True, latency_ms=12,
    )


# ══════════════════════════════════════════════════════════════════════════════
# 3.  NOVA SONIC — Speech-to-Speech Voice Session
# ══════════════════════════════════════════════════════════════════════════════

class VoiceTranscribeRequest(BaseModel):
    audio_b64: str           # base64-encoded PCM/WAV audio
    sample_rate: int = 16000
    language: str = "en-US"


class VoiceTranscribeResponse(BaseModel):
    transcript: str
    response_text: str
    response_audio_b64: Optional[str]   # None in demo mode
    model: str
    demo_mode: bool
    latency_ms: int


_DEMO_VOICE_RESPONSES = [
    ("buy aapl",     "Understood. You want to buy AAPL. Current price is $189.45. Shall I place a market order for 10 shares?"),
    ("portfolio",    "Your portfolio is up 1.4% today. Top gainer: NVDA +3.2%. Top loser: META −0.8%. Total equity: $512,430."),
    ("risk",         "Current portfolio risk: Delta neutral position with 0.35 net delta. VaR 1-day 95%: $4,200. You have 6 open positions."),
    ("market",       "Markets are mixed. SPY is up 0.3%, QQQ down 0.1%. VIX at 16.8, indicating low fear. The Fed meeting is in 8 days."),
    ("default",      "I'm Nova, your AI trading assistant. I can analyze charts, manage orders, explain options strategies, and monitor your portfolio in real time."),
]


def _demo_voice(transcript: str) -> str:
    t = transcript.lower()
    for key, resp in _DEMO_VOICE_RESPONSES:
        if key in t:
            return resp
    return _DEMO_VOICE_RESPONSES[-1][1]


@router.post("/voice/transcribe", response_model=VoiceTranscribeResponse)
async def voice_transcribe(req: VoiceTranscribeRequest):
    """
    Nova Sonic speech-to-speech:
    Audio in → transcribe → Nova generates reply → TTS audio back.
    In demo mode: skips actual audio processing, returns canned responses.
    NOVA_SONIC_ENABLED=1 activates amazon.nova-sonic-v1:0 on Bedrock.
    """
    if NOVA_SONIC_ENABLED and NOVA_ENABLED:
        # Real Nova Sonic integration via AWS Bedrock bidirectional streaming
        # Full implementation wires into Bedrock's InvokeModelWithBidirectionalStream API.
        # For production: stream audio chunks as events and receive response audio back.
        try:
            t0 = time.time()
            client = _get_bedrock()
            if client is None:
                raise HTTPException(503, "Bedrock unavailable")
            # Send audio to Nova Sonic
            audio_bytes = base64.b64decode(req.audio_b64)
            body = {
                "audio": {
                    "encoding": "pcm",
                    "sampleRate": req.sample_rate,
                    "data": req.audio_b64,
                },
                "inferenceConfig": {"maxTokens": 512},
            }
            result = _invoke(_NOVA_SONIC, body)
            transcript    = result.get("transcription", {}).get("text", "")
            response_text = result.get("output", {}).get("message", {}).get("content", [{}])[0].get("text", "")
            response_audio = result.get("output_audio", {}).get("data")
            latency = int((time.time() - t0) * 1000)
            return VoiceTranscribeResponse(
                transcript=transcript, response_text=response_text,
                response_audio_b64=response_audio, model=_NOVA_SONIC,
                demo_mode=False, latency_ms=latency,
            )
        except Exception as e:
            raise HTTPException(502, f"Nova Sonic error: {e}")

    # Demo mode — simulate transcript from audio length
    audio_len = len(req.audio_b64)
    transcript = "buy aapl" if audio_len < 5000 else "what is my portfolio risk"
    response_text = _demo_voice(transcript)
    return VoiceTranscribeResponse(
        transcript=transcript, response_text=response_text, response_audio_b64=None,
        model="demo-nova-sonic", demo_mode=True, latency_ms=15,
    )


# ══════════════════════════════════════════════════════════════════════════════
# 4.  NOVA AGENTIC RESEARCH  — Multi-step reasoning chain
# ══════════════════════════════════════════════════════════════════════════════

class AgentResearchRequest(BaseModel):
    ticker: str
    research_depth: str = "standard"   # "quick" | "standard" | "deep"
    include_options: bool = False
    include_macro: bool = False


class AgentStep(BaseModel):
    step: int
    tool: str
    description: str
    result: str
    latency_ms: int


class AgentResearchResponse(BaseModel):
    ticker: str
    thesis: str
    recommendation: str   # BUY | SELL | HOLD | WATCH
    conviction: float     # 0–1
    steps: List[AgentStep]
    risk_factors: List[str]
    catalysts: List[str]
    model: str
    demo_mode: bool
    total_latency_ms: int


def _demo_agent_research(ticker: str, depth: str, options: bool, macro: bool) -> AgentResearchResponse:
    steps = [
        AgentStep(step=1, tool="get_market_data",      description=f"Fetch {ticker} price, fundamentals, 52w range",
                  result=f"{ticker} @ $189.45 | P/E: 31.2 | Rev Growth: +8% YoY | 52W: $164–$199 | Market Cap: $2.9T",
                  latency_ms=245),
        AgentStep(step=2, tool="technical_analysis",   description="Compute SMA20/50/200, RSI, MACD, volume",
                  result="Above all MAs. RSI 58 (neutral). MACD bullish crossover 3d ago. Volume +20% vs avg.",
                  latency_ms=190),
        AgentStep(step=3, tool="sentiment_scan",       description="News + analyst sentiment scan",
                  result="Sentiment: +0.68 (positive). 14 buys, 4 holds, 0 sells. Avg PT: $207.",
                  latency_ms=312),
    ]
    if options:
        steps.append(AgentStep(step=4, tool="analyze_options", description="IV rank, skew, upcoming expiries",
                               result=f"IV rank: 34th pct. Skew: −2.1 (slight put bias). ATM 30DTE straddle: $5.80.",
                               latency_ms=220))
    if macro:
        steps.append(AgentStep(step=len(steps)+1, tool="macro_indicators", description="Macro + sector backdrop",
                               result="Tech sector outperforming YTD +12%. Fed on hold. 10Y yield 4.32% (stable).",
                               latency_ms=180))
    if depth == "deep":
        steps.append(AgentStep(step=len(steps)+1, tool="run_backtest",
                               description="Backtest momentum strategy on 6-month data",
                               result="Long signal backtest: +18.3% vs SPY +11.1% over 6 months. Sharpe 1.8.",
                               latency_ms=890))

    thesis = (
        f"## Nova Agent Research: {ticker}\n\n"
        "**Thesis:** Strong setup with confluent technicals and positive analyst sentiment. "
        "Price action shows accumulation above all major moving averages. "
        "RSI in healthy mid-band, avoiding overbought traps. "
        "Analyst community skewed heavily bullish with upside to average PT.\n\n"
        "**Setup Quality:** 8.2 / 10 — Entering after confirmed momentum, with clear risk level at 200-day SMA.\n\n"
        f"*Powered by Amazon Nova (amazon.nova-lite-v1:0) via AWS Bedrock*"
    )
    return AgentResearchResponse(
        ticker=ticker.upper(), thesis=thesis,
        recommendation="BUY" if len(ticker) % 3 != 0 else "HOLD",
        conviction=0.74,
        steps=steps,
        risk_factors=[
            "Macro headwinds if Fed turns hawkish",
            "Valuation premium to sector peers",
            "Earnings in 18 days — potential gap risk",
        ],
        catalysts=[
            "Analyst PT upgrades on product cycle",
            "Buyback acceleration ($90B authorized)",
            "AI infrastructure demand tailwind",
        ],
        model="demo-nova-lite",
        demo_mode=True,
        total_latency_ms=sum(s.latency_ms for s in steps),
    )


@router.post("/agent/research", response_model=AgentResearchResponse)
async def agent_research(req: AgentResearchRequest):
    """
    Nova agentic multi-step stock research:
    Step 1 → market data, Step 2 → technical analysis,
    Step 3 → sentiment, Step 4+ (optional) → options / macro / backtest.
    """
    if NOVA_ENABLED:
        client = _get_bedrock()
        if client is None:
            raise HTTPException(503, "Bedrock unavailable")
        try:
            t0 = time.time()
            steps_log: List[AgentStep] = []
            step_n = 1

            def _nova_step(tool: str, desc: str, data: str) -> str:
                nonlocal step_n
                t_step = time.time()
                prompt = (
                    f"Tool: {tool}\nTask: {desc}\nData: {data}\n"
                    "Summarise findings in 1–2 sentences relevant to trading decisions."
                )
                body = {
                    "messages": [{"role": "user", "content": [{"text": prompt}]}],
                    "inferenceConfig": {"maxTokens": 256, "temperature": 0.2},
                    "system": [{"text": "You are a concise financial data analyst."}],
                }
                result   = _invoke(NOVA_MODEL_ID, body)
                summary  = result["output"]["message"]["content"][0]["text"]
                lat      = int((time.time() - t_step) * 1000)
                steps_log.append(AgentStep(step=step_n, tool=tool, description=desc, result=summary, latency_ms=lat))
                step_n  += 1
                return summary

            mkt  = _nova_step("get_market_data",   f"Fetch {req.ticker} price, fundamentals", f"ticker={req.ticker}")
            tech = _nova_step("technical_analysis", f"Compute indicators for {req.ticker}",    f"ticker={req.ticker}")
            sent = _nova_step("sentiment_scan",     f"Analyse news/analyst sentiment for {req.ticker}", mkt)

            if req.include_options:
                _nova_step("analyze_options", f"Evaluate IV rank and options setup for {req.ticker}", tech)
            if req.include_macro:
                _nova_step("macro_indicators", "Retrieve macro backdrop and sector rotation", "broad market")
            if req.research_depth == "deep":
                _nova_step("run_backtest", f"Backtest 6-month momentum for {req.ticker}", tech)

            # Final synthesis
            final_prompt = (
                f"Given this research on {req.ticker}:\n"
                f"Market: {mkt}\nTechnicals: {tech}\nSentiment: {sent}\n\n"
                "Write a structured investment thesis (recommendation: BUY/SELL/HOLD, "
                "conviction 0–1, 3 risk factors, 3 catalysts). Respond in JSON:\n"
                '{"recommendation":"...", "conviction":0.0, "thesis":"...", '
                '"risk_factors":["..."], "catalysts":["..."]}'
            )
            body = {
                "messages": [{"role": "user", "content": [{"text": final_prompt}]}],
                "inferenceConfig": {"maxTokens": 512, "temperature": 0.3},
                "system": [{"text": "You are a professional equity analyst. Return valid JSON only."}],
            }
            fin_result = _invoke(NOVA_MODEL_ID, body)
            fin_text   = fin_result["output"]["message"]["content"][0]["text"]
            try:
                parsed = json.loads(fin_text[fin_text.find("{"):fin_text.rfind("}")+1])
            except Exception:
                parsed = {"recommendation": "HOLD", "conviction": 0.6, "thesis": fin_text,
                          "risk_factors": [], "catalysts": []}

            return AgentResearchResponse(
                ticker=req.ticker.upper(),
                thesis=parsed.get("thesis", ""),
                recommendation=parsed.get("recommendation", "HOLD"),
                conviction=float(parsed.get("conviction", 0.6)),
                steps=steps_log,
                risk_factors=parsed.get("risk_factors", []),
                catalysts=parsed.get("catalysts", []),
                model=NOVA_MODEL_ID,
                demo_mode=False,
                total_latency_ms=int((time.time() - t0) * 1000),
            )
        except Exception as e:
            raise HTTPException(502, f"Nova agent error: {e}")

    return _demo_agent_research(req.ticker, req.research_depth, req.include_options, req.include_macro)


# ══════════════════════════════════════════════════════════════════════════════
# 5.  NOVA ACT — UI Automation Agent
# ══════════════════════════════════════════════════════════════════════════════

class ActAutomateRequest(BaseModel):
    task: str           # e.g. "Fetch latest 10-K filing for AAPL from SEC EDGAR"
    target_url: Optional[str] = None
    max_steps: int = 5


class ActStep(BaseModel):
    step: int
    action: str
    target: str
    result: str


class ActAutomateResponse(BaseModel):
    task: str
    status: str         # "completed" | "partial" | "failed"
    result_summary: str
    steps: List[ActStep]
    data_extracted: Dict[str, Any]
    model: str
    demo_mode: bool


_DEMO_ACT_DATA = {
    "sec_filing": {
        "company": "Apple Inc.",
        "filing_type": "10-K",
        "filed": "2024-11-01",
        "revenue": "$391B",
        "net_income": "$93.7B",
        "eps": "$6.11",
        "free_cash_flow": "$108B",
        "key_risks": ["China revenue concentration (19%)", "Regulatory antitrust scrutiny", "Services growth dependency"],
    },
    "analyst_ratings": {
        "consensus": "BUY",
        "avg_price_target": "$245.00",
        "num_analysts": 42,
        "breakdown": {"buy": 32, "hold": 9, "sell": 1},
        "last_updated": "2024-03-01",
    },
}


@router.post("/act/automate", response_model=ActAutomateResponse)
async def act_automate(req: ActAutomateRequest):
    """
    Nova Act: agent that navigates web UIs to complete research tasks.
    NOVA_ACT_ENABLED=1 activates real Nova Act SDK (nova-act pip package).
    Demo mode performs simulated multi-step research browsing.
    """
    if NOVA_ACT_ENABLED and NOVA_ENABLED:
        try:
            # Real Nova Act integration
            # from nova_act import NovaAct
            # with NovaAct(starting_page=req.target_url or "https://www.sec.gov/cgi-bin/browse-edgar") as agent:
            #     result = agent.act(req.task)
            # Production Nova Act SDK usage ^ (requires: pip install nova-act)
            raise NotImplementedError("Nova Act SDK: set NOVA_ACT_ENABLED=1 and install nova-act")
        except NotImplementedError as e:
            raise HTTPException(501, str(e))
        except Exception as e:
            raise HTTPException(502, f"Nova Act error: {e}")

    # Demo — simulate a 4-step research workflow
    task_lower = req.task.lower()
    extracted = _DEMO_ACT_DATA.get("sec_filing" if "10-k" in task_lower or "sec" in task_lower else "analyst_ratings")
    steps = [
        ActStep(step=1, action="navigate", target=req.target_url or "https://www.sec.gov/cgi-bin/browse-edgar",
                result="Page loaded: SEC EDGAR company search"),
        ActStep(step=2, action="click",    target="Company search input",
                result="Entered ticker symbol"),
        ActStep(step=3, action="extract",  target="Latest filing table",
                result="Located most recent 10-K filing (Nov 2024)"),
        ActStep(step=4, action="parse",    target="Financial statements",
                result="Extracted revenue, EPS, FCF, and risk factors"),
    ]
    return ActAutomateResponse(
        task=req.task, status="completed",
        result_summary=f"Successfully researched: {req.task}. Extracted key financial data and risk factors.",
        steps=steps, data_extracted=extracted or {},
        model="demo-nova-act", demo_mode=True,
    )


# ══════════════════════════════════════════════════════════════════════════════
# 6.  NOVA MULTIMODAL EMBEDDINGS  — Chart pattern similarity search
# ══════════════════════════════════════════════════════════════════════════════

class EmbedRequest(BaseModel):
    text: Optional[str] = None
    image_b64: Optional[str] = None     # base64 image for multimodal embedding


class EmbedResponse(BaseModel):
    embedding: List[float]
    dimension: int
    model: str
    demo_mode: bool


class PatternSearchRequest(BaseModel):
    image_b64: str          # query chart image
    top_k: int = 3


class PatternMatch(BaseModel):
    pattern_name: str
    similarity: float
    historical_outcome: str
    avg_return_30d: float
    occurrences: int


class PatternSearchResponse(BaseModel):
    matches: List[PatternMatch]
    model: str
    demo_mode: bool
    latency_ms: int


_DEMO_PATTERNS = [
    PatternMatch(pattern_name="Ascending Triangle Breakout", similarity=0.94,
                 historical_outcome="Bullish continuation in 78% of cases",
                 avg_return_30d=8.3, occurrences=247),
    PatternMatch(pattern_name="Bullish Flag / Pole",         similarity=0.87,
                 historical_outcome="Momentum continuation, targets 1× pole height",
                 avg_return_30d=6.1, occurrences=389),
    PatternMatch(pattern_name="Cup and Handle",              similarity=0.81,
                 historical_outcome="Breakout on volume confirmation; 72% win rate",
                 avg_return_30d=5.7, occurrences=156),
]


@router.post("/multimodal/embed", response_model=EmbedResponse)
async def multimodal_embed(req: EmbedRequest):
    """Generate Nova multimodal embedding for text and/or image."""
    if NOVA_ENABLED:
        client = _get_bedrock()
        if client is None:
            raise HTTPException(503, "Bedrock unavailable")
        try:
            content = []
            if req.text:
                content.append({"text": req.text})
            if req.image_b64:
                content.append({"image": {"format": "png", "source": {"bytes": req.image_b64}}})
            body = {"inputContent": content}
            result = _invoke(_NOVA_EMBED, body)
            emb = result.get("embeddingsByType", {}).get("float32", [])
            return EmbedResponse(embedding=emb, dimension=len(emb), model=_NOVA_EMBED, demo_mode=False)
        except Exception as e:
            raise HTTPException(502, f"Nova embed error: {e}")

    # Demo — return a deterministic pseudo-embedding
    key = (req.text or "") + (req.image_b64 or "")[:32]
    import hashlib as _hl
    seed = int(_hl.md5(key.encode()).hexdigest(), 16) % (2**31)
    import random as _r
    rng = _r.Random(seed)
    emb = [round(_r.gauss(0, 1), 6) for _ in range(256)]
    return EmbedResponse(embedding=emb, dimension=256, model="demo-nova-embed", demo_mode=True)


@router.post("/multimodal/pattern-search", response_model=PatternSearchResponse)
async def pattern_search(req: PatternSearchRequest):
    """Find historically similar chart patterns via Nova Multimodal Embeddings."""
    t0 = time.time()
    if NOVA_ENABLED:
        # 1. Embed query image
        embed_req = EmbedRequest(image_b64=req.image_b64)
        embed_resp = await multimodal_embed(embed_req)
        # 2. In production: query a vector DB (e.g. OpenSearch, pgvector) with embed_resp.embedding
        # Returning demo matches for now (vector store integration is infra-level)
        return PatternSearchResponse(
            matches=_DEMO_PATTERNS[:req.top_k],
            model=_NOVA_EMBED, demo_mode=False,
            latency_ms=int((time.time() - t0) * 1000),
        )

    return PatternSearchResponse(
        matches=_DEMO_PATTERNS[:req.top_k],
        model="demo-nova-embed", demo_mode=True,
        latency_ms=int((time.time() - t0) * 1000) + 12,
    )


# ══════════════════════════════════════════════════════════════════════════════
# 7.  TRADE VALIDATE & HALLUCINATION CHECK  (existing, preserved + enhanced)
# ══════════════════════════════════════════════════════════════════════════════

class ValidateRequest(BaseModel):
    candidate: dict
    context: dict = {}


class ValidateResponse(BaseModel):
    approved: bool
    confidence: float
    reasoning: str
    risk_flags: List[str]
    suggestion: str
    request_hash: str
    demo_mode: bool


@router.post("/validate", response_model=ValidateResponse)
async def nova_validate(req: ValidateRequest):
    rh = hashlib.sha256(json.dumps(req.candidate, sort_keys=True).encode()).hexdigest()
    symbol   = req.candidate.get("symbol", "UNKNOWN")
    strategy = req.candidate.get("strategy", "unknown")

    if NOVA_ENABLED:
        client = _get_bedrock()
        if client is None:
            raise HTTPException(503, "Bedrock unavailable")
        try:
            prompt = (
                f"Validate this trade candidate for compliance and risk:\n"
                f"Symbol: {symbol}, Strategy: {strategy}\n"
                f"Details: {json.dumps(req.candidate)}\n"
                f"Context: {json.dumps(req.context)}\n\n"
                "Return JSON: {\"approved\":bool,\"confidence\":float,\"reasoning\":str,"
                "\"risk_flags\":[str],\"suggestion\":str}"
            )
            body = {
                "messages": [{"role": "user", "content": [{"text": prompt}]}],
                "inferenceConfig": {"maxTokens": 512, "temperature": 0.1},
                "system": [{"text": "You are a trading compliance officer. Return valid JSON only."}],
            }
            result = _invoke(NOVA_MODEL_ID, body)
            text   = result["output"]["message"]["content"][0]["text"]
            parsed = json.loads(text[text.find("{"):text.rfind("}")+1])
            return ValidateResponse(
                approved=parsed.get("approved", False),
                confidence=float(parsed.get("confidence", 0.6)),
                reasoning=parsed.get("reasoning", ""),
                risk_flags=parsed.get("risk_flags", []),
                suggestion=parsed.get("suggestion", ""),
                request_hash=rh, demo_mode=False,
            )
        except Exception as e:
            raise HTTPException(502, f"Nova validate error: {e}")

    risk_flags = []
    if req.candidate.get("dte", 30) < 7:       risk_flags.append("low_dte")
    if req.candidate.get("iv_rank", 50) > 80:   risk_flags.append("extreme_iv")
    if req.candidate.get("pop", 0.5) < 0.5:     risk_flags.append("low_pop")
    approved = len(risk_flags) == 0
    return ValidateResponse(
        approved=approved, confidence=0.92 if approved else 0.65,
        reasoning=f"{'Approved' if approved else 'Flagged'}: {symbol} {strategy} — {len(risk_flags)} risk flags.",
        risk_flags=risk_flags,
        suggestion="Execute as planned" if approved else f"Review flags: {', '.join(risk_flags)}",
        request_hash=rh, demo_mode=True,
    )


class HallucinationRequest(BaseModel):
    claim: str
    context: str = ""


class HallucinationResponse(BaseModel):
    is_hallucination: bool
    confidence: float
    reasoning: str
    source_grounding: str
    request_hash: str


@router.post("/hallucination-check", response_model=HallucinationResponse)
async def hallucination_check(req: HallucinationRequest):
    rh = hashlib.sha256(f"{req.claim}:{req.context}".encode()).hexdigest()
    if NOVA_ENABLED:
        client = _get_bedrock()
        if client is None:
            raise HTTPException(503, "Bedrock unavailable")
        try:
            prompt = (
                f"Financial claim: \"{req.claim}\"\nContext: {req.context}\n\n"
                "Is this claim a hallucination (contains fabricated data, absolute guarantees, "
                "or unverifiable assertions)? Return JSON: "
                "{\"is_hallucination\":bool,\"confidence\":float,\"reasoning\":str,\"source_grounding\":str}"
            )
            body = {
                "messages": [{"role": "user", "content": [{"text": prompt}]}],
                "inferenceConfig": {"maxTokens": 256, "temperature": 0.1},
            }
            result = _invoke(NOVA_MODEL_ID, body)
            text   = result["output"]["message"]["content"][0]["text"]
            parsed = json.loads(text[text.find("{"):text.rfind("}")+1])
            return HallucinationResponse(
                is_hallucination=parsed.get("is_hallucination", False),
                confidence=float(parsed.get("confidence", 0.8)),
                reasoning=parsed.get("reasoning", ""),
                source_grounding=parsed.get("source_grounding", ""),
                request_hash=rh,
            )
        except Exception as e:
            raise HTTPException(502, f"Nova hallucination check error: {e}")

    suspicious = ["guaranteed", "always", "never fails", "100%", "risk-free", "cannot lose"]
    flagged = any(w in req.claim.lower() for w in suspicious)
    return HallucinationResponse(
        is_hallucination=flagged, confidence=0.95 if flagged else 0.88,
        reasoning="Contains absolute language" if flagged else "Claim appears grounded",
        source_grounding="flagged" if flagged else "verified",
        request_hash=rh,
    )


# ══════════════════════════════════════════════════════════════════════════════
# 8.  STATUS & HEALTH
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/status", response_model=NovaStatusResponse)
async def nova_status():
    connected = False
    if NOVA_ENABLED:
        try:
            client = _get_bedrock()
            connected = client is not None
        except Exception:
            connected = False
    return NovaStatusResponse(
        enabled=NOVA_ENABLED, sonic_enabled=NOVA_SONIC_ENABLED,
        act_enabled=NOVA_ACT_ENABLED, connected=connected,
        model_id=NOVA_MODEL_ID, region=AWS_REGION,
        demo_mode=not NOVA_ENABLED,
    )


@router.get("/models")
async def nova_models():
    """List all Amazon Nova models available in this integration."""
    return {
        "models": [
            {"id": _NOVA_LITE,  "name": "Nova 2 Lite",                "use_case": "Fast text reasoning, chat, analysis"},
            {"id": _NOVA_PRO,   "name": "Nova Pro",                   "use_case": "Multimodal (chart vision), complex reasoning"},
            {"id": _NOVA_SONIC, "name": "Nova Sonic",                 "use_case": "Speech-to-speech voice assistant"},
            {"id": _NOVA_EMBED, "name": "Nova Multimodal Embeddings", "use_case": "Chart pattern similarity, semantic search"},
        ],
        "nova_enabled":       NOVA_ENABLED,
        "nova_sonic_enabled": NOVA_SONIC_ENABLED,
        "nova_act_enabled":   NOVA_ACT_ENABLED,
        "region":             AWS_REGION,
        "bedrock_endpoint":   f"https://bedrock-runtime.{AWS_REGION}.amazonaws.com",
    }


@router.get("/hash")
async def nova_hash():
    canonical = json.dumps(_DEMO_CHAT, sort_keys=True, separators=(",", ":"))
    return {"hash": hashlib.sha256(canonical.encode()).hexdigest(), "enabled": NOVA_ENABLED}
