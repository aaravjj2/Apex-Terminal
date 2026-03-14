"""
investor_personas.py — Multi-Agent Investor Persona System
===========================================================
Inspired by virattt/ai-hedge-fund. Each "persona" represents a distinct
investment philosophy. All agents analyze the same stock independently,
then their signals are aggregated into a consensus recommendation.

Agents:
  1. Warren Buffett — Quality businesses at fair prices
  2. Ben Graham — Deep value, margin of safety
  3. Cathie Wood — Disruptive innovation / growth
  4. Michael Burry — Contrarian / deep value
  5. Peter Lynch — Growth at reasonable price (GARP)
  6. Stanley Druckenmiller — Macro momentum
  7. Risk Manager — Pure risk assessment
  8. Technical Analyst — Price action / momentum
"""
from __future__ import annotations
import asyncio
import json
import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

_log = logging.getLogger(__name__)

# ── Data contract ─────────────────────────────────────────────────────────────

@dataclass
class StockContext:
    """Everything an agent needs to analyze a stock."""
    symbol: str
    current_price: float
    price_change_pct: float          # 1-day %
    week_change_pct: float           # 5-day %
    month_change_pct: float          # 30-day %
    rsi_14: Optional[float] = None   # RSI(14)
    sma_50: Optional[float] = None
    sma_200: Optional[float] = None
    volume_ratio: Optional[float] = None  # today vol / 20d avg
    pe_ratio: Optional[float] = None
    pb_ratio: Optional[float] = None
    revenue_growth: Optional[float] = None  # YoY %
    earnings_surprise: Optional[float] = None  # latest EPS beat/miss %
    news_sentiment: Optional[float] = None  # -1 to +1
    market_regime: str = "neutral"   # bull / bear / neutral
    sector: str = "unknown"
    extra: Dict[str, Any] = field(default_factory=dict)


@dataclass
class PersonaSignal:
    """Signal from a single investor persona."""
    persona: str
    signal: str           # "buy" | "sell" | "hold"
    confidence: float     # 0.0 – 1.0
    reasoning: str
    key_factor: str       # Most important factor driving the decision


@dataclass
class ConsensusSignal:
    """Aggregated consensus across all personas."""
    symbol: str
    consensus: str            # "buy" | "sell" | "hold"
    conviction: float         # 0.0 – 1.0  (strength of consensus)
    buy_votes: int
    sell_votes: int
    hold_votes: int
    weighted_score: float     # +1 = strong buy, -1 = strong sell
    personas: List[PersonaSignal] = field(default_factory=list)
    analysis_summary: str = ""


# ── Rule-based persona logic (no LLM required, fast + deterministic) ──────────

def _buffett_analysis(ctx: StockContext) -> PersonaSignal:
    """Warren Buffett: quality business at fair price."""
    score = 0.0
    factors = []

    # Quality: prefer established businesses (low volatility proxy)
    if ctx.volume_ratio and ctx.volume_ratio < 2.0:
        score += 0.1; factors.append("stable volume")
    if ctx.pe_ratio and 10 < ctx.pe_ratio < 25:
        score += 0.25; factors.append(f"fair PE={ctx.pe_ratio:.1f}")
    elif ctx.pe_ratio and ctx.pe_ratio > 40:
        score -= 0.2; factors.append(f"expensive PE={ctx.pe_ratio:.1f}")
    if ctx.pb_ratio and ctx.pb_ratio < 3:
        score += 0.15; factors.append(f"good PB={ctx.pb_ratio:.1f}")
    if ctx.revenue_growth and ctx.revenue_growth > 5:
        score += 0.2; factors.append(f"revenue growth {ctx.revenue_growth:.1f}%")
    if ctx.sma_200 and ctx.current_price > ctx.sma_200 * 1.05:
        score += 0.1; factors.append("above 200MA")
    elif ctx.sma_200 and ctx.current_price < ctx.sma_200 * 0.85:
        score -= 0.15; factors.append("far below 200MA")
    if ctx.news_sentiment and ctx.news_sentiment > 0.3:
        score += 0.1; factors.append("positive sentiment")

    signal, confidence = _score_to_signal(score, threshold=0.3)
    return PersonaSignal(
        persona="Warren Buffett",
        signal=signal,
        confidence=confidence,
        reasoning=f"Quality + value screen: {', '.join(factors) or 'no clear edge'}",
        key_factor=factors[0] if factors else "inconclusive",
    )


def _graham_analysis(ctx: StockContext) -> PersonaSignal:
    """Ben Graham: deep value, margin of safety."""
    score = 0.0
    factors = []

    if ctx.pe_ratio and ctx.pe_ratio < 15:
        score += 0.35; factors.append(f"cheap PE={ctx.pe_ratio:.1f}")
    elif ctx.pe_ratio and ctx.pe_ratio < 20:
        score += 0.15; factors.append(f"moderate PE={ctx.pe_ratio:.1f}")
    elif ctx.pe_ratio and ctx.pe_ratio > 30:
        score -= 0.3; factors.append("overvalued")
    if ctx.pb_ratio and ctx.pb_ratio < 1.5:
        score += 0.25; factors.append(f"PB={ctx.pb_ratio:.1f} < 1.5")
    if ctx.month_change_pct < -15:
        score += 0.2; factors.append(f"oversold -{abs(ctx.month_change_pct):.0f}%")
    elif ctx.month_change_pct > 20:
        score -= 0.2; factors.append("dangerous run-up")

    signal, confidence = _score_to_signal(score, threshold=0.3)
    return PersonaSignal(
        persona="Ben Graham",
        signal=signal,
        confidence=confidence,
        reasoning=f"Deep value margin-of-safety screen: {', '.join(factors) or 'no margin of safety found'}",
        key_factor=factors[0] if factors else "inconclusive",
    )


def _cathie_wood_analysis(ctx: StockContext) -> PersonaSignal:
    """Cathie Wood: innovation / disruptive growth."""
    score = 0.0
    factors = []

    if ctx.revenue_growth and ctx.revenue_growth > 20:
        score += 0.4; factors.append(f"hypergrowth {ctx.revenue_growth:.0f}%")
    elif ctx.revenue_growth and ctx.revenue_growth > 10:
        score += 0.15; factors.append(f"strong growth {ctx.revenue_growth:.0f}%")
    elif ctx.revenue_growth and ctx.revenue_growth < 0:
        score -= 0.3; factors.append("shrinking revenue")
    if ctx.week_change_pct > 5:
        score += 0.2; factors.append("momentum building")
    if ctx.market_regime == "bull":
        score += 0.1; factors.append("bull market")
    elif ctx.market_regime == "bear":
        score -= 0.2; factors.append("bear market risk")
    if ctx.pe_ratio and ctx.pe_ratio > 50:
        score += 0.1; factors.append("growth premium accepted")

    signal, confidence = _score_to_signal(score, threshold=0.25)
    return PersonaSignal(
        persona="Cathie Wood",
        signal=signal,
        confidence=confidence,
        reasoning=f"Innovation/growth thesis: {', '.join(factors) or 'insufficient growth signals'}",
        key_factor=factors[0] if factors else "inconclusive",
    )


def _burry_analysis(ctx: StockContext) -> PersonaSignal:
    """Michael Burry: contrarian deep value / hidden catalyst."""
    score = 0.0
    factors = []

    if ctx.month_change_pct < -20:
        score += 0.35; factors.append(f"deeply oversold {ctx.month_change_pct:.0f}%")
    if ctx.news_sentiment and ctx.news_sentiment < -0.3:
        score += 0.2; factors.append("bearish consensus = contrarian buy")
    if ctx.pe_ratio and ctx.pe_ratio < 12:
        score += 0.3; factors.append(f"ultra cheap PE={ctx.pe_ratio:.1f}")
    if ctx.week_change_pct > 10 and ctx.month_change_pct < -10:
        score += 0.15; factors.append("reversal signal")
    if ctx.rsi_14 and ctx.rsi_14 < 30:
        score += 0.2; factors.append(f"RSI oversold ({ctx.rsi_14:.0f})")

    signal, confidence = _score_to_signal(score, threshold=0.35)
    return PersonaSignal(
        persona="Michael Burry",
        signal=signal,
        confidence=confidence,
        reasoning=f"Contrarian value: {', '.join(factors) or 'no contrarian opportunity'}",
        key_factor=factors[0] if factors else "inconclusive",
    )


def _peter_lynch_analysis(ctx: StockContext) -> PersonaSignal:
    """Peter Lynch: GARP — growth at a reasonable price."""
    score = 0.0
    factors = []

    # PEG ratio proxy: PE / revenue_growth
    if ctx.pe_ratio and ctx.revenue_growth and ctx.revenue_growth > 0:
        peg = ctx.pe_ratio / ctx.revenue_growth
        if peg < 1.0:
            score += 0.4; factors.append(f"PEG={peg:.2f} excellent")
        elif peg < 2.0:
            score += 0.2; factors.append(f"PEG={peg:.2f} acceptable")
        else:
            score -= 0.2; factors.append(f"PEG={peg:.2f} expensive")
    if ctx.earnings_surprise and ctx.earnings_surprise > 5:
        score += 0.2; factors.append(f"EPS beat +{ctx.earnings_surprise:.0f}%")
    elif ctx.earnings_surprise and ctx.earnings_surprise < -5:
        score -= 0.2; factors.append(f"EPS miss {ctx.earnings_surprise:.0f}%")
    if ctx.price_change_pct > 0 and ctx.volume_ratio and ctx.volume_ratio > 1.5:
        score += 0.15; factors.append("institutional accumulation signal")

    signal, confidence = _score_to_signal(score, threshold=0.25)
    return PersonaSignal(
        persona="Peter Lynch",
        signal=signal,
        confidence=confidence,
        reasoning=f"GARP screen: {', '.join(factors) or 'no clear GARP opportunity'}",
        key_factor=factors[0] if factors else "inconclusive",
    )


def _druckenmiller_analysis(ctx: StockContext) -> PersonaSignal:
    """Stanley Druckenmiller: macro momentum + asymmetric upside."""
    score = 0.0
    factors = []

    if ctx.sma_50 and ctx.sma_200 and ctx.sma_50 > ctx.sma_200:
        score += 0.25; factors.append("50MA > 200MA golden cross")
    elif ctx.sma_50 and ctx.sma_200 and ctx.sma_50 < ctx.sma_200:
        score -= 0.2; factors.append("death cross")
    if ctx.week_change_pct > 8:
        score += 0.3; factors.append(f"strong weekly momentum +{ctx.week_change_pct:.0f}%")
    elif ctx.week_change_pct < -8:
        score -= 0.3; factors.append(f"sharp weekly decline {ctx.week_change_pct:.0f}%")
    if ctx.market_regime == "bull":
        score += 0.15; factors.append("macro tailwind")
    elif ctx.market_regime == "bear":
        score -= 0.25; factors.append("macro headwind")
    if ctx.volume_ratio and ctx.volume_ratio > 2.0:
        score += 0.1; factors.append("institutional surge")

    signal, confidence = _score_to_signal(score, threshold=0.3)
    return PersonaSignal(
        persona="Stanley Druckenmiller",
        signal=signal,
        confidence=confidence,
        reasoning=f"Macro momentum: {', '.join(factors) or 'no macro edge'}",
        key_factor=factors[0] if factors else "inconclusive",
    )


def _risk_manager_analysis(ctx: StockContext) -> PersonaSignal:
    """Pure risk assessment — will flag sells when risk is too high."""
    score = 0.0
    factors = []

    # Excessive volatility = sell/hold
    if ctx.week_change_pct and abs(ctx.week_change_pct) > 15:
        score -= 0.3; factors.append(f"high weekly vol ±{abs(ctx.week_change_pct):.0f}%")
    if ctx.rsi_14 and ctx.rsi_14 > 80:
        score -= 0.3; factors.append(f"RSI extremely overbought ({ctx.rsi_14:.0f})")
    elif ctx.rsi_14 and ctx.rsi_14 < 25:
        score += 0.15; factors.append(f"RSI oversold ({ctx.rsi_14:.0f})")
    if ctx.volume_ratio and ctx.volume_ratio > 4.0:
        score -= 0.2; factors.append("panic volume — potential exhaustion")
    if ctx.news_sentiment and ctx.news_sentiment < -0.5:
        score -= 0.2; factors.append("very negative news")
    if ctx.market_regime == "bear" and ctx.month_change_pct < -10:
        score -= 0.3; factors.append("double bear signal")

    signal, confidence = _score_to_signal(score, threshold=0.25)
    # Risk manager skews toward hold/sell — never has high buy confidence
    if signal == "buy":
        confidence = min(confidence, 0.55)
    return PersonaSignal(
        persona="Risk Manager",
        signal=signal,
        confidence=confidence,
        reasoning=f"Risk assessment: {', '.join(factors) or 'risk within acceptable range'}",
        key_factor=factors[0] if factors else "risk normal",
    )


def _technical_analyst(ctx: StockContext) -> PersonaSignal:
    """Technical analysis: price action, RSI, moving averages."""
    score = 0.0
    factors = []

    if ctx.rsi_14:
        if ctx.rsi_14 < 30:
            score += 0.35; factors.append(f"RSI oversold ({ctx.rsi_14:.0f})")
        elif ctx.rsi_14 > 70:
            score -= 0.3; factors.append(f"RSI overbought ({ctx.rsi_14:.0f})")
        elif 45 < ctx.rsi_14 < 65:
            score += 0.1; factors.append("RSI neutral-bullish zone")

    if ctx.sma_50 and ctx.current_price > ctx.sma_50 * 1.03:
        score += 0.2; factors.append("above 50MA")
    elif ctx.sma_50 and ctx.current_price < ctx.sma_50 * 0.97:
        score -= 0.2; factors.append("below 50MA")

    if ctx.sma_200 and ctx.current_price > ctx.sma_200:
        score += 0.15; factors.append("above 200MA uptrend")
    elif ctx.sma_200 and ctx.current_price < ctx.sma_200:
        score -= 0.15; factors.append("below 200MA downtrend")

    if ctx.week_change_pct > 3:
        score += 0.1; factors.append("positive momentum")
    elif ctx.week_change_pct < -3:
        score -= 0.1; factors.append("negative momentum")

    signal, confidence = _score_to_signal(score, threshold=0.25)
    return PersonaSignal(
        persona="Technical Analyst",
        signal=signal,
        confidence=confidence,
        reasoning=f"TA signals: {', '.join(factors) or 'no clear pattern'}",
        key_factor=factors[0] if factors else "neutral",
    )


def _score_to_signal(score: float, threshold: float = 0.3) -> tuple[str, float]:
    """Convert a numeric score to (signal, confidence)."""
    if score >= threshold:
        signal = "buy"
        confidence = min(0.95, 0.5 + score * 0.7)
    elif score <= -threshold:
        signal = "sell"
        confidence = min(0.95, 0.5 + abs(score) * 0.7)
    else:
        signal = "hold"
        confidence = 0.5 + abs(score) * 0.3
    return signal, round(confidence, 3)


# ── Main analysis engine ───────────────────────────────────────────────────────

_ANALYSTS = [
    _buffett_analysis,
    _graham_analysis,
    _cathie_wood_analysis,
    _burry_analysis,
    _peter_lynch_analysis,
    _druckenmiller_analysis,
    _risk_manager_analysis,
    _technical_analyst,
]


def analyze_stock(ctx: StockContext) -> ConsensusSignal:
    """
    Run all investor persona agents against a StockContext.
    Returns a consensus recommendation with individual signals.
    """
    signals = [analyst(ctx) for analyst in _ANALYSTS]

    buy_votes  = sum(1 for s in signals if s.signal == "buy")
    sell_votes = sum(1 for s in signals if s.signal == "sell")
    hold_votes = sum(1 for s in signals if s.signal == "hold")

    # Weighted score: +confidence for buy, -confidence for sell, 0 for hold
    weighted = sum(
        s.confidence if s.signal == "buy"
        else -s.confidence if s.signal == "sell"
        else 0
        for s in signals
    ) / len(signals)

    if weighted > 0.15:
        consensus = "buy"
    elif weighted < -0.15:
        consensus = "sell"
    else:
        consensus = "hold"

    conviction = min(0.95, abs(weighted) * 2.5 + 0.2)

    # Summary text
    top_buyer = next((s for s in sorted(signals, key=lambda x: x.confidence, reverse=True) if s.signal == "buy"), None)
    top_seller = next((s for s in sorted(signals, key=lambda x: x.confidence, reverse=True) if s.signal == "sell"), None)
    lines = [f"{ctx.symbol}: {consensus.upper()} ({conviction:.0%} conviction)"]
    if top_buyer:
        lines.append(f"  Bull: {top_buyer.persona} — {top_buyer.key_factor}")
    if top_seller:
        lines.append(f"  Bear: {top_seller.persona} — {top_seller.key_factor}")
    lines.append(f"  Votes: {buy_votes}B / {hold_votes}H / {sell_votes}S")

    return ConsensusSignal(
        symbol=ctx.symbol,
        consensus=consensus,
        conviction=round(conviction, 3),
        buy_votes=buy_votes,
        sell_votes=sell_votes,
        hold_votes=hold_votes,
        weighted_score=round(weighted, 4),
        personas=signals,
        analysis_summary="\n".join(lines),
    )


async def analyze_stocks_batch(contexts: List[StockContext]) -> List[ConsensusSignal]:
    """Analyze multiple stocks concurrently."""
    loop = asyncio.get_event_loop()
    results = await asyncio.gather(*[
        loop.run_in_executor(None, analyze_stock, ctx)
        for ctx in contexts
    ])
    return list(results)
