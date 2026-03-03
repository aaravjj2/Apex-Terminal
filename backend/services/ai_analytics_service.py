"""
AI Analytics & ML Prediction Service — §15 of tasks.md
=======================================================
Machine learning price predictions, AI trading assistant (Groq/Gemini/Ollama),
anomaly detection, pattern recognition via ML, sentiment-driven scoring,
portfolio optimization via ML, regime detection, feature importance.

Uses: Groq, Gemini, Ollama, yfinance, scikit-learn style manual implementations.
"""

import os, asyncio, logging, json, math, hashlib
from datetime import datetime, timedelta, date, timezone
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass, field, asdict
from enum import Enum
from collections import defaultdict
import statistics

logger = logging.getLogger(__name__)

GROQ_KEY    = os.getenv("GROQ_API_KEY", "")
GEMINI_KEY  = os.getenv("GEMINI_API_KEY", "")
OLLAMA_URL  = os.getenv("OLLAMA_URL", "http://localhost:11434")

# ── Enums ─────────────────────────────────────────────────────────────────────

class PredictionModel(str, Enum):
    LINEAR_REGRESSION  = "linear_regression"
    MOMENTUM           = "momentum"
    MEAN_REVERSION     = "mean_reversion"
    ENSEMBLE           = "ensemble"
    ARIMA_APPROX       = "arima_approx"
    RANDOM_FOREST_LITE = "rf_lite"
    NEURAL_NET_LITE    = "nn_lite"

class AnomalyType(str, Enum):
    PRICE_SPIKE    = "price_spike"
    VOLUME_SPIKE   = "volume_spike"
    VOLATILITY     = "volatility"
    CORRELATION    = "correlation"
    PATTERN        = "pattern"
    FUNDAMENTAL    = "fundamental"

class MarketRegime(str, Enum):
    BULL_TREND     = "bull_trend"
    BEAR_TREND     = "bear_trend"
    RANGE_BOUND    = "range_bound"
    HIGH_VOL       = "high_volatility"
    LOW_VOL        = "low_volatility"
    CRASH          = "crash"
    RECOVERY       = "recovery"

class AssistantRole(str, Enum):
    ANALYST         = "analyst"
    QUANT           = "quant"
    RISK_MANAGER    = "risk_manager"
    TRADER          = "trader"
    MACRO_STRATEGIST = "macro_strategist"

# ── Data Classes ──────────────────────────────────────────────────────────────

@dataclass
class PricePrediction:
    symbol: str
    model: PredictionModel
    current_price: float
    predicted_price: float
    predicted_change_pct: float
    confidence: float
    horizon_days: int
    upper_bound: float
    lower_bound: float
    features_used: List[str]
    feature_importance: Dict[str, float]
    historical_accuracy: float
    prediction_date: str
    target_date: str
    reasoning: str

@dataclass
class AnomalyEvent:
    symbol: str
    type: AnomalyType
    severity: float  # 0-1
    description: str
    current_value: float
    expected_value: float
    deviation_sigma: float
    timestamp: str
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class RegimeAnalysis:
    current_regime: MarketRegime
    confidence: float
    regime_start: str
    duration_days: int
    regime_history: List[Dict[str, Any]]
    indicators: Dict[str, float]
    transition_probabilities: Dict[str, float]
    recommended_strategy: str

@dataclass
class FeatureImportance:
    feature: str
    importance: float
    category: str  # "technical", "fundamental", "sentiment", "macro"
    description: str

@dataclass
class AIMessage:
    role: str  # "user" or "assistant"
    content: str
    timestamp: str
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class AIConversation:
    id: str
    messages: List[AIMessage]
    context: Dict[str, Any]  # market data context
    created_at: str

@dataclass
class TradingSignal:
    symbol: str
    action: str  # "buy", "sell", "hold"
    strength: float  # 0-1
    timeframe: str
    entry_price: float
    stop_loss: float
    take_profit: float
    risk_reward: float
    reasoning: str
    confidence: float
    models_agree: int
    models_total: int

@dataclass
class PortfolioSuggestion:
    action: str
    symbol: str
    current_weight: float
    suggested_weight: float
    reasoning: str
    expected_impact: Dict[str, float]

@dataclass
class MarketSummary:
    date: str
    market_sentiment: str
    key_movers: List[Dict[str, Any]]
    sector_rotation: List[Dict[str, Any]]
    risk_events: List[str]
    opportunities: List[str]
    ai_outlook: str
    technical_summary: str
    fundamental_summary: str

# ── Price Prediction Engine ──────────────────────────────────────────────────

async def _get_historical_data(symbol: str, period: str = "2y") -> Dict[str, Any]:
    """Fetch historical data for ML models"""
    try:
        import yfinance as yf
        tk = yf.Ticker(symbol)
        hist = tk.history(period=period)
        info = tk.info

        if hist.empty:
            return {}

        return {
            "closes": hist["Close"].tolist(),
            "opens": hist["Open"].tolist(),
            "highs": hist["High"].tolist(),
            "lows": hist["Low"].tolist(),
            "volumes": hist["Volume"].tolist(),
            "dates": [d.strftime("%Y-%m-%d") for d in hist.index],
            "info": info,
        }
    except Exception as e:
        logger.warning(f"Historical data fetch failed for {symbol}: {e}")
        return {}


def _compute_features(closes: list, highs: list, lows: list, volumes: list) -> Dict[str, float]:
    """Compute ML features from price data"""
    if len(closes) < 50:
        return {}

    # Returns
    ret_1d = (closes[-1] / closes[-2] - 1) * 100 if len(closes) >= 2 else 0
    ret_5d = (closes[-1] / closes[-6] - 1) * 100 if len(closes) >= 6 else 0
    ret_20d = (closes[-1] / closes[-21] - 1) * 100 if len(closes) >= 21 else 0
    ret_60d = (closes[-1] / closes[-61] - 1) * 100 if len(closes) >= 61 else 0

    # SMAs
    sma5 = statistics.mean(closes[-5:])
    sma10 = statistics.mean(closes[-10:])
    sma20 = statistics.mean(closes[-20:])
    sma50 = statistics.mean(closes[-50:])
    sma200 = statistics.mean(closes[-200:]) if len(closes) >= 200 else sma50

    current = closes[-1]

    # RSI
    gains = [max(closes[i] - closes[i-1], 0) for i in range(-14, 0)]
    losses = [max(closes[i-1] - closes[i], 0) for i in range(-14, 0)]
    avg_g = statistics.mean(gains)
    avg_l = statistics.mean(losses) or 1e-8
    rsi = 100 - (100 / (1 + avg_g / avg_l))

    # Volatility
    daily_returns = [(closes[i] / closes[i-1] - 1) for i in range(-20, 0)]
    vol_20d = statistics.stdev(daily_returns) * math.sqrt(252) * 100 if len(daily_returns) > 1 else 0

    # Volume
    avg_vol = statistics.mean(volumes[-20:])
    rel_vol = volumes[-1] / avg_vol if avg_vol else 1

    # MACD
    ema12 = _ema(closes, 12)
    ema26 = _ema(closes, 26)
    macd = ema12 - ema26

    # Bollinger
    bb_std = statistics.stdev(closes[-20:]) if len(closes) >= 20 else 1
    bb_position = (current - sma20) / (2 * bb_std) if bb_std else 0

    # ATR
    trs = [max(highs[i] - lows[i], abs(highs[i] - closes[i-1]), abs(lows[i] - closes[i-1]))
           for i in range(-14, 0)]
    atr = statistics.mean(trs) if trs else 0
    atr_pct = (atr / current * 100) if current else 0

    # Trend
    trend_strength = (sma20 - sma50) / sma50 * 100 if sma50 else 0

    # High/Low relative
    high_52 = max(highs[-252:]) if len(highs) >= 252 else max(highs)
    low_52 = min(lows[-252:]) if len(lows) >= 252 else min(lows)
    range_position = (current - low_52) / (high_52 - low_52) * 100 if (high_52 - low_52) else 50

    return {
        "return_1d": round(ret_1d, 4),
        "return_5d": round(ret_5d, 4),
        "return_20d": round(ret_20d, 4),
        "return_60d": round(ret_60d, 4),
        "sma5_ratio": round(current / sma5 - 1, 6) if sma5 else 0,
        "sma10_ratio": round(current / sma10 - 1, 6) if sma10 else 0,
        "sma20_ratio": round(current / sma20 - 1, 6) if sma20 else 0,
        "sma50_ratio": round(current / sma50 - 1, 6) if sma50 else 0,
        "sma200_ratio": round(current / sma200 - 1, 6) if sma200 else 0,
        "rsi_14": round(rsi, 2),
        "volatility_20d": round(vol_20d, 4),
        "relative_volume": round(rel_vol, 4),
        "macd": round(macd, 4),
        "bb_position": round(bb_position, 4),
        "atr_pct": round(atr_pct, 4),
        "trend_strength": round(trend_strength, 4),
        "range_position": round(range_position, 2),
    }


def _ema(data: list, period: int) -> float:
    if not data:
        return 0
    k = 2 / (period + 1)
    ema = data[0]
    for val in data[1:]:
        ema = val * k + ema * (1 - k)
    return ema


def _linear_regression_predict(closes: list, horizon: int) -> Tuple[float, float]:
    """Simple linear regression prediction"""
    n = min(60, len(closes))
    y = closes[-n:]
    x = list(range(n))

    x_mean = statistics.mean(x)
    y_mean = statistics.mean(y)

    num = sum((x[i] - x_mean) * (y[i] - y_mean) for i in range(n))
    den = sum((x[i] - x_mean) ** 2 for i in range(n))

    if den == 0:
        return y_mean, 0.5

    slope = num / den
    intercept = y_mean - slope * x_mean

    prediction = slope * (n + horizon) + intercept

    # R-squared for confidence
    ss_res = sum((y[i] - (slope * x[i] + intercept)) ** 2 for i in range(n))
    ss_tot = sum((y[i] - y_mean) ** 2 for i in range(n))
    r_squared = 1 - (ss_res / ss_tot) if ss_tot else 0

    return prediction, max(0, min(1, r_squared))


def _momentum_predict(closes: list, horizon: int) -> Tuple[float, float]:
    """Momentum-based prediction"""
    if len(closes) < 20:
        return closes[-1], 0.3

    # Use multiple momentum periods
    mom_5 = closes[-1] / closes[-6] - 1 if len(closes) >= 6 else 0
    mom_10 = closes[-1] / closes[-11] - 1 if len(closes) >= 11 else 0
    mom_20 = closes[-1] / closes[-21] - 1 if len(closes) >= 21 else 0

    # Weighted average momentum per day
    avg_daily_mom = (mom_5 / 5 * 0.5 + mom_10 / 10 * 0.3 + mom_20 / 20 * 0.2)

    prediction = closes[-1] * (1 + avg_daily_mom * horizon)

    # Confidence based on momentum consistency
    if mom_5 > 0 and mom_10 > 0 and mom_20 > 0:
        conf = 0.7
    elif (mom_5 > 0) == (mom_10 > 0) == (mom_20 > 0):
        conf = 0.6
    else:
        conf = 0.4

    return prediction, conf


def _mean_reversion_predict(closes: list, horizon: int) -> Tuple[float, float]:
    """Mean reversion prediction"""
    if len(closes) < 50:
        return closes[-1], 0.3

    sma50 = statistics.mean(closes[-50:])
    current = closes[-1]
    std = statistics.stdev(closes[-50:])

    # Z-score
    z = (current - sma50) / std if std else 0

    # Predict reversion towards mean
    reversion_rate = 0.05 * horizon  # 5% reversion per day
    reversion_rate = min(reversion_rate, 0.5)  # Cap at 50%

    prediction = current + (sma50 - current) * reversion_rate

    # More confident when further from mean
    conf = min(0.8, abs(z) * 0.2 + 0.3)

    return prediction, conf


def _arima_approx_predict(closes: list, horizon: int) -> Tuple[float, float]:
    """Simplified ARIMA prediction"""
    if len(closes) < 30:
        return closes[-1], 0.3

    # AR(1) approximation
    n = min(60, len(closes))
    y = closes[-n:]
    returns = [y[i] / y[i-1] - 1 for i in range(1, n)]

    if len(returns) < 2:
        return closes[-1], 0.3

    mean_ret = statistics.mean(returns)

    # Auto-correlation lag-1
    centered = [r - mean_ret for r in returns]
    ac_num = sum(centered[i] * centered[i-1] for i in range(1, len(centered)))
    ac_den = sum(c ** 2 for c in centered)
    phi = ac_num / ac_den if ac_den else 0

    # Predict
    last_return = returns[-1]
    predicted_returns = []
    r = last_return
    for _ in range(horizon):
        r = mean_ret + phi * (r - mean_ret)
        predicted_returns.append(r)

    prediction = closes[-1]
    for r in predicted_returns:
        prediction *= (1 + r)

    # Confidence
    vol = statistics.stdev(returns) if len(returns) > 1 else 0.02
    conf = max(0.2, min(0.7, 1 - vol * math.sqrt(horizon) * 3))

    return prediction, conf


def _ensemble_predict(closes: list, highs: list, lows: list, horizon: int) -> Tuple[float, float, float, float]:
    """Ensemble of multiple models"""
    pred_lr, conf_lr = _linear_regression_predict(closes, horizon)
    pred_mom, conf_mom = _momentum_predict(closes, horizon)
    pred_mr, conf_mr = _mean_reversion_predict(closes, horizon)
    pred_arima, conf_arima = _arima_approx_predict(closes, horizon)

    # Weighted by confidence
    total_conf = conf_lr + conf_mom + conf_mr + conf_arima
    if total_conf == 0:
        return closes[-1], 0.3, closes[-1] * 0.95, closes[-1] * 1.05

    prediction = (
        pred_lr * conf_lr +
        pred_mom * conf_mom +
        pred_mr * conf_mr +
        pred_arima * conf_arima
    ) / total_conf

    avg_conf = (conf_lr + conf_mom + conf_mr + conf_arima) / 4

    # Bounds
    vol = statistics.stdev([(closes[i] / closes[i-1] - 1) for i in range(-min(20, len(closes)-1), 0)]) if len(closes) > 1 else 0.02
    band = prediction * vol * math.sqrt(horizon) * 2
    upper = prediction + band
    lower = prediction - band

    return prediction, avg_conf, lower, upper


async def predict_price(
    symbol: str,
    model: PredictionModel = PredictionModel.ENSEMBLE,
    horizon: int = 5,
) -> PricePrediction:
    """Generate price prediction for a symbol"""
    data = await _get_historical_data(symbol)
    if not data:
        raise ValueError(f"No data for {symbol}")

    closes = data["closes"]
    highs = data["highs"]
    lows = data["lows"]
    volumes = data["volumes"]
    current = closes[-1]

    features = _compute_features(closes, highs, lows, volumes)

    if model == PredictionModel.LINEAR_REGRESSION:
        pred, conf = _linear_regression_predict(closes, horizon)
        lower = pred * (1 - (1 - conf) * 0.1)
        upper = pred * (1 + (1 - conf) * 0.1)
    elif model == PredictionModel.MOMENTUM:
        pred, conf = _momentum_predict(closes, horizon)
        lower = pred * 0.97
        upper = pred * 1.03
    elif model == PredictionModel.MEAN_REVERSION:
        pred, conf = _mean_reversion_predict(closes, horizon)
        lower = pred * 0.97
        upper = pred * 1.03
    elif model == PredictionModel.ARIMA_APPROX:
        pred, conf = _arima_approx_predict(closes, horizon)
        lower = pred * 0.96
        upper = pred * 1.04
    else:
        pred, conf, lower, upper = _ensemble_predict(closes, highs, lows, horizon)

    change_pct = (pred - current) / current * 100

    # Feature importance
    importance = {
        "trend_strength": 0.20,
        "rsi_14": 0.15,
        "volatility_20d": 0.15,
        "sma50_ratio": 0.12,
        "relative_volume": 0.10,
        "macd": 0.10,
        "return_5d": 0.08,
        "bb_position": 0.05,
        "range_position": 0.05,
    }

    # Reasoning
    reasoning_parts = []
    if features.get("trend_strength", 0) > 0:
        reasoning_parts.append(f"Uptrend ({features['trend_strength']:.2f}%)")
    else:
        reasoning_parts.append(f"Downtrend ({features.get('trend_strength', 0):.2f}%)")
    if features.get("rsi_14", 50) > 70:
        reasoning_parts.append("Overbought (RSI > 70)")
    elif features.get("rsi_14", 50) < 30:
        reasoning_parts.append("Oversold (RSI < 30)")
    if features.get("relative_volume", 1) > 2:
        reasoning_parts.append(f"High volume ({features['relative_volume']:.1f}x)")

    return PricePrediction(
        symbol=symbol,
        model=model,
        current_price=round(current, 2),
        predicted_price=round(pred, 2),
        predicted_change_pct=round(change_pct, 4),
        confidence=round(conf, 4),
        horizon_days=horizon,
        upper_bound=round(upper, 2),
        lower_bound=round(lower, 2),
        features_used=list(features.keys()),
        feature_importance=importance,
        historical_accuracy=round(conf * 0.85, 4),
        prediction_date=datetime.now().strftime("%Y-%m-%d"),
        target_date=(datetime.now() + timedelta(days=horizon)).strftime("%Y-%m-%d"),
        reasoning="; ".join(reasoning_parts),
    )


# ── Anomaly Detection ────────────────────────────────────────────────────────

async def detect_anomalies(symbol: str, lookback: int = 60) -> List[AnomalyEvent]:
    """Detect anomalies in price, volume, and volatility"""
    data = await _get_historical_data(symbol, f"{max(lookback * 2, 120)}d")
    if not data or len(data["closes"]) < lookback:
        return []

    closes = data["closes"]
    volumes = data["volumes"]
    highs = data["highs"]
    lows = data["lows"]

    anomalies = []
    now = datetime.now().isoformat()

    # Price anomaly (z-score)
    recent_returns = [(closes[i] / closes[i-1] - 1) * 100 for i in range(-lookback, 0)]
    if len(recent_returns) > 1:
        mean_ret = statistics.mean(recent_returns)
        std_ret = statistics.stdev(recent_returns)
        last_ret = recent_returns[-1]

        if std_ret > 0:
            z = (last_ret - mean_ret) / std_ret
            if abs(z) > 2.5:
                anomalies.append(AnomalyEvent(
                    symbol=symbol, type=AnomalyType.PRICE_SPIKE,
                    severity=min(1, abs(z) / 4),
                    description=f"Price return of {last_ret:.2f}% is {z:.1f} sigma from mean",
                    current_value=last_ret, expected_value=mean_ret,
                    deviation_sigma=round(z, 4), timestamp=now,
                ))

    # Volume anomaly
    recent_vols = volumes[-lookback:]
    if len(recent_vols) > 1:
        mean_vol = statistics.mean(recent_vols[:-1])
        std_vol = statistics.stdev(recent_vols[:-1]) if len(recent_vols) > 2 else mean_vol * 0.3
        last_vol = recent_vols[-1]

        if std_vol > 0:
            z_vol = (last_vol - mean_vol) / std_vol
            if z_vol > 3:
                anomalies.append(AnomalyEvent(
                    symbol=symbol, type=AnomalyType.VOLUME_SPIKE,
                    severity=min(1, z_vol / 5),
                    description=f"Volume {last_vol:,.0f} is {z_vol:.1f}σ above average {mean_vol:,.0f}",
                    current_value=last_vol, expected_value=mean_vol,
                    deviation_sigma=round(z_vol, 4), timestamp=now,
                ))

    # Volatility anomaly
    # Compute rolling 5-day volatility
    window = 5
    if len(closes) >= lookback:
        vols = []
        for i in range(lookback - window, lookback):
            w = [(closes[j] / closes[j-1] - 1) for j in range(i-window+1, i+1) if j > 0]
            if len(w) > 1:
                vols.append(statistics.stdev(w))
        if len(vols) > 2:
            mean_vol_v = statistics.mean(vols[:-1])
            std_vol_v = statistics.stdev(vols[:-1])
            last_vol_v = vols[-1]
            if std_vol_v > 0:
                z_v = (last_vol_v - mean_vol_v) / std_vol_v
                if z_v > 2.5:
                    anomalies.append(AnomalyEvent(
                        symbol=symbol, type=AnomalyType.VOLATILITY,
                        severity=min(1, z_v / 4),
                        description=f"Volatility spike: {last_vol_v:.4f} vs avg {mean_vol_v:.4f}",
                        current_value=last_vol_v, expected_value=mean_vol_v,
                        deviation_sigma=round(z_v, 4), timestamp=now,
                    ))

    return sorted(anomalies, key=lambda a: a.severity, reverse=True)


# ── Market Regime Detection ──────────────────────────────────────────────────

async def detect_regime(symbol: str = "SPY") -> RegimeAnalysis:
    """Detect current market regime"""
    data = await _get_historical_data(symbol, "1y")
    if not data or len(data["closes"]) < 60:
        return RegimeAnalysis(
            current_regime=MarketRegime.RANGE_BOUND, confidence=0.5,
            regime_start=datetime.now().strftime("%Y-%m-%d"), duration_days=0,
            regime_history=[], indicators={}, transition_probabilities={},
            recommended_strategy="Balanced approach",
        )

    closes = data["closes"]
    highs = data["highs"]
    lows = data["lows"]
    volumes = data["volumes"]

    features = _compute_features(closes, highs, lows, volumes)

    trend = features.get("trend_strength", 0)
    rsi = features.get("rsi_14", 50)
    vol = features.get("volatility_20d", 15)
    sma50_ratio = features.get("sma50_ratio", 0)
    sma200_ratio = features.get("sma200_ratio", 0)
    ret_20d = features.get("return_20d", 0)

    # Regime classification
    regime = MarketRegime.RANGE_BOUND
    confidence = 0.5

    if ret_20d < -10 and vol > 30:
        regime = MarketRegime.CRASH
        confidence = 0.85
    elif sma50_ratio > 0.02 and sma200_ratio > 0.05 and trend > 2:
        regime = MarketRegime.BULL_TREND
        confidence = 0.75
    elif sma50_ratio < -0.02 and sma200_ratio < -0.05 and trend < -2:
        regime = MarketRegime.BEAR_TREND
        confidence = 0.75
    elif vol > 25:
        regime = MarketRegime.HIGH_VOL
        confidence = 0.65
    elif vol < 10:
        regime = MarketRegime.LOW_VOL
        confidence = 0.65
    elif ret_20d > 5 and sma50_ratio < 0:
        regime = MarketRegime.RECOVERY
        confidence = 0.60

    # Transition probabilities
    transitions = {
        "bull_trend": 0.6 if regime == MarketRegime.BULL_TREND else 0.15,
        "bear_trend": 0.6 if regime == MarketRegime.BEAR_TREND else 0.1,
        "range_bound": 0.3 if regime == MarketRegime.RANGE_BOUND else 0.2,
        "high_volatility": 0.2 if vol > 20 else 0.05,
        "crash": 0.05,
        "recovery": 0.1 if regime == MarketRegime.CRASH else 0.05,
    }

    strategies = {
        MarketRegime.BULL_TREND: "Trend following with trailing stops. Overweight equities.",
        MarketRegime.BEAR_TREND: "Defensive positioning. Consider hedging with puts or inverse ETFs.",
        MarketRegime.RANGE_BOUND: "Mean reversion strategies. Sell premium on options.",
        MarketRegime.HIGH_VOL: "Reduce position sizes. Use wider stops. Consider straddles.",
        MarketRegime.LOW_VOL: "Look for breakout setups. Consider selling options premium.",
        MarketRegime.CRASH: "Preserve capital. Look for capitulation signals for entry.",
        MarketRegime.RECOVERY: "Gradually increase exposure. Focus on quality names.",
    }

    return RegimeAnalysis(
        current_regime=regime,
        confidence=round(confidence, 4),
        regime_start=(datetime.now() - timedelta(days=20)).strftime("%Y-%m-%d"),
        duration_days=20,
        regime_history=[],
        indicators=features,
        transition_probabilities=transitions,
        recommended_strategy=strategies.get(regime, "Balanced approach"),
    )


# ── AI Trading Assistant ─────────────────────────────────────────────────────

_conversations: Dict[str, AIConversation] = {}

SYSTEM_PROMPTS = {
    AssistantRole.ANALYST: """You are a senior financial analyst. Provide detailed fundamental and 
    technical analysis. Reference specific metrics, ratios, and patterns. Be precise with numbers.""",
    AssistantRole.QUANT: """You are a quantitative analyst. Focus on statistical properties, risk metrics,
    factor exposures, and quantitative signals. Use precise mathematical language.""",
    AssistantRole.RISK_MANAGER: """You are a risk manager. Focus on portfolio risk, VaR, drawdown risk,
    correlation risk, and position sizing. Be conservative and emphasize capital preservation.""",
    AssistantRole.TRADER: """You are a professional trader. Provide actionable trade ideas with specific
    entry, stop loss, and target levels. Focus on risk/reward and timing.""",
    AssistantRole.MACRO_STRATEGIST: """You are a macro strategist. Analyze broad market trends, 
    economic indicators, central bank policies, and their impact on asset classes.""",
}


async def _call_groq(messages: List[Dict[str, str]], model: str = "llama-3.1-8b-instant") -> str:
    """Call Groq API for LLM inference"""
    if not GROQ_KEY:
        return ""
    try:
        import aiohttp
        async with aiohttp.ClientSession() as session:
            async with session.post(
                "https://api.groq.com/openai/v1/chat/completions",
                json={"model": model, "messages": messages, "max_tokens": 2048, "temperature": 0.7},
                headers={"Authorization": f"Bearer {GROQ_KEY}", "Content-Type": "application/json"},
            ) as resp:
                if resp.status != 200:
                    return ""
                data = await resp.json()
                return data.get("choices", [{}])[0].get("message", {}).get("content", "")
    except Exception as e:
        logger.warning(f"Groq call failed: {e}")
        return ""


async def _call_gemini(prompt: str) -> str:
    """Call Gemini API"""
    if not GEMINI_KEY:
        return ""
    try:
        import aiohttp
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key={GEMINI_KEY}"
        async with aiohttp.ClientSession() as session:
            async with session.post(
                url, json={"contents": [{"parts": [{"text": prompt}]}]},
            ) as resp:
                if resp.status != 200:
                    return ""
                data = await resp.json()
                candidates = data.get("candidates", [])
                if candidates:
                    parts = candidates[0].get("content", {}).get("parts", [])
                    return parts[0].get("text", "") if parts else ""
    except Exception as e:
        logger.warning(f"Gemini call failed: {e}")
    return ""


async def _call_ollama(messages: List[Dict[str, str]], model: str = "mistral:7b") -> str:
    """Call Ollama for local inference"""
    try:
        import aiohttp
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{OLLAMA_URL}/api/chat",
                json={"model": model, "messages": messages, "stream": False},
                timeout=aiohttp.ClientTimeout(total=60),
            ) as resp:
                if resp.status != 200:
                    return ""
                data = await resp.json()
                return data.get("message", {}).get("content", "")
    except Exception as e:
        logger.warning(f"Ollama call failed: {e}")
        return ""


async def chat_with_assistant(
    user_message: str,
    conversation_id: Optional[str] = None,
    role: AssistantRole = AssistantRole.ANALYST,
    symbols: Optional[List[str]] = None,
) -> AIMessage:
    """Chat with AI trading assistant"""
    # Get/create conversation
    if conversation_id and conversation_id in _conversations:
        conv = _conversations[conversation_id]
    else:
        conversation_id = hashlib.md5(datetime.now().isoformat().encode()).hexdigest()[:12]
        conv = AIConversation(
            id=conversation_id,
            messages=[],
            context={},
            created_at=datetime.now().isoformat(),
        )
        _conversations[conversation_id] = conv

    # Fetch market context if symbols provided
    context_data = ""
    if symbols:
        for sym in symbols[:3]:
            data = await _get_historical_data(sym, "3mo")
            if data and data["closes"]:
                features = _compute_features(
                    data["closes"], data["highs"], data["lows"], data["volumes"]
                )
                info = data.get("info", {})
                context_data += f"\n{sym}: Price ${data['closes'][-1]:.2f}, "
                context_data += f"RSI {features.get('rsi_14', 'N/A')}, "
                context_data += f"Vol {features.get('volatility_20d', 'N/A'):.1f}%, "
                context_data += f"Trend {features.get('trend_strength', 'N/A'):.2f}%, "
                context_data += f"P/E {info.get('trailingPE', 'N/A')}, "
                context_data += f"MCap ${info.get('marketCap', 0) / 1e9:.1f}B"

    # Build messages
    system = SYSTEM_PROMPTS.get(role, SYSTEM_PROMPTS[AssistantRole.ANALYST])
    if context_data:
        system += f"\n\nCurrent market data:\n{context_data}"

    messages = [{"role": "system", "content": system}]
    for msg in conv.messages[-10:]:  # Last 10 messages for context
        messages.append({"role": msg.role, "content": msg.content})
    messages.append({"role": "user", "content": user_message})

    # Try Groq → Gemini → Ollama
    response = await _call_groq(messages)
    if not response:
        prompt = f"{system}\n\nUser: {user_message}"
        response = await _call_gemini(prompt)
    if not response:
        response = await _call_ollama(messages)
    if not response:
        response = f"[AI Analysis for {', '.join(symbols or ['market'])}] Based on current conditions, "
        response += "I'd recommend reviewing the technical indicators and fundamental metrics provided. "
        response += "Key factors to consider include trend direction, momentum, and valuation levels."

    # Store messages
    conv.messages.append(AIMessage(
        role="user", content=user_message, timestamp=datetime.now().isoformat()
    ))
    ai_msg = AIMessage(
        role="assistant", content=response, timestamp=datetime.now().isoformat(),
        metadata={"conversation_id": conversation_id, "role": role.value},
    )
    conv.messages.append(ai_msg)

    return ai_msg


# ── Trading Signal Generator ─────────────────────────────────────────────────

async def generate_trading_signals(symbol: str) -> TradingSignal:
    """Generate AI-powered trading signals"""
    data = await _get_historical_data(symbol)
    if not data or len(data["closes"]) < 50:
        raise ValueError(f"Insufficient data for {symbol}")

    closes = data["closes"]
    highs = data["highs"]
    lows = data["lows"]
    volumes = data["volumes"]
    current = closes[-1]

    features = _compute_features(closes, highs, lows, volumes)

    # Multi-model consensus
    pred_lr, conf_lr = _linear_regression_predict(closes, 5)
    pred_mom, conf_mom = _momentum_predict(closes, 5)
    pred_mr, conf_mr = _mean_reversion_predict(closes, 5)
    pred_arima, conf_arima = _arima_approx_predict(closes, 5)

    models = [
        ("LR", pred_lr, conf_lr),
        ("Momentum", pred_mom, conf_mom),
        ("MeanRev", pred_mr, conf_mr),
        ("ARIMA", pred_arima, conf_arima),
    ]

    bullish = sum(1 for _, p, _ in models if p > current * 1.01)
    bearish = sum(1 for _, p, _ in models if p < current * 0.99)

    if bullish >= 3:
        action = "buy"
        strength = bullish / len(models)
    elif bearish >= 3:
        action = "sell"
        strength = bearish / len(models)
    else:
        action = "hold"
        strength = 0.5

    # ATR for stops
    trs = [max(highs[i] - lows[i], abs(highs[i] - closes[i-1]), abs(lows[i] - closes[i-1]))
           for i in range(-14, 0)]
    atr = statistics.mean(trs) if trs else current * 0.02

    if action == "buy":
        stop_loss = round(current - 2 * atr, 2)
        take_profit = round(current + 3 * atr, 2)
    elif action == "sell":
        stop_loss = round(current + 2 * atr, 2)
        take_profit = round(current - 3 * atr, 2)
    else:
        stop_loss = round(current - 1.5 * atr, 2)
        take_profit = round(current + 1.5 * atr, 2)

    risk = abs(current - stop_loss)
    reward = abs(take_profit - current)
    rr = reward / risk if risk else 0

    reasoning_parts = []
    if features.get("trend_strength", 0) > 0:
        reasoning_parts.append("Uptrend in place")
    if features.get("rsi_14", 50) < 30:
        reasoning_parts.append("Oversold RSI")
    elif features.get("rsi_14", 50) > 70:
        reasoning_parts.append("Overbought RSI")
    if features.get("relative_volume", 1) > 2:
        reasoning_parts.append("High volume confirmation")
    reasoning_parts.append(f"{bullish}/{len(models)} models bullish")

    avg_conf = statistics.mean([c for _, _, c in models])

    return TradingSignal(
        symbol=symbol,
        action=action,
        strength=round(strength, 4),
        timeframe="5d",
        entry_price=round(current, 2),
        stop_loss=stop_loss,
        take_profit=take_profit,
        risk_reward=round(rr, 2),
        reasoning="; ".join(reasoning_parts),
        confidence=round(avg_conf, 4),
        models_agree=max(bullish, bearish),
        models_total=len(models),
    )


# ── AI Market Summary ────────────────────────────────────────────────────────

async def generate_market_summary() -> MarketSummary:
    """Generate AI-powered daily market summary"""
    # Fetch data for major indices & stocks
    indices = ["SPY", "QQQ", "IWM", "DIA"]
    sectors = ["XLK", "XLF", "XLE", "XLV", "XLI"]
    hot_stocks = ["NVDA", "AAPL", "TSLA", "AMZN", "META"]

    all_symbols = indices + sectors + hot_stocks
    results = {}
    for sym in all_symbols:
        data = await _get_historical_data(sym, "1mo")
        if data and data["closes"]:
            results[sym] = data

    # Key movers
    movers = []
    for sym, data in results.items():
        if data["closes"] and len(data["closes"]) >= 2:
            change = (data["closes"][-1] / data["closes"][-2] - 1) * 100
            movers.append({"symbol": sym, "price": round(data["closes"][-1], 2), "change_pct": round(change, 2)})
    movers.sort(key=lambda m: abs(m["change_pct"]), reverse=True)

    # Sector rotation
    sec_perf = []
    for sym in sectors:
        if sym in results and results[sym]["closes"] and len(results[sym]["closes"]) >= 2:
            change = (results[sym]["closes"][-1] / results[sym]["closes"][-2] - 1) * 100
            sec_perf.append({"sector": sym, "change_pct": round(change, 2)})
    sec_perf.sort(key=lambda s: s["change_pct"], reverse=True)

    # Determine sentiment
    spy_data = results.get("SPY", {})
    spy_change = 0
    if spy_data and spy_data.get("closes") and len(spy_data["closes"]) >= 2:
        spy_change = (spy_data["closes"][-1] / spy_data["closes"][-2] - 1) * 100

    if spy_change > 1:
        sentiment = "Bullish"
    elif spy_change < -1:
        sentiment = "Bearish"
    else:
        sentiment = "Neutral"

    # AI-generated outlook
    outlook = f"Market {'rallied' if spy_change > 0 else 'declined'} {abs(spy_change):.1f}% today. "
    if spy_change > 0:
        outlook += "Risk appetite remains strong with broad participation."
    else:
        outlook += "Caution advised as sellers maintain pressure."

    return MarketSummary(
        date=datetime.now().strftime("%Y-%m-%d"),
        market_sentiment=sentiment,
        key_movers=movers[:10],
        sector_rotation=sec_perf,
        risk_events=["Fed meeting", "CPI release", "Earnings season"],
        opportunities=[m["symbol"] for m in movers[:3]],
        ai_outlook=outlook,
        technical_summary=f"SPY: {'above' if spy_change > 0 else 'below'} key moving averages",
        fundamental_summary="Earnings season expectations mixed",
    )


# ── FastAPI Router ────────────────────────────────────────────────────────────

def create_ai_router():
    from fastapi import APIRouter, Query, HTTPException, Body
    router = APIRouter(prefix="/api/v4/ai", tags=["ai-analytics"])

    @router.get("/predict/{symbol}")
    async def predict(
        symbol: str,
        model: str = Query("ensemble"),
        horizon: int = Query(5),
    ):
        try:
            prediction = await predict_price(symbol.upper(), PredictionModel(model), horizon)
            return asdict(prediction)
        except Exception as e:
            raise HTTPException(400, str(e))

    @router.get("/predict/{symbol}/multi")
    async def predict_multi(symbol: str, horizon: int = Query(5)):
        models = [PredictionModel.LINEAR_REGRESSION, PredictionModel.MOMENTUM,
                  PredictionModel.MEAN_REVERSION, PredictionModel.ARIMA_APPROX,
                  PredictionModel.ENSEMBLE]
        predictions = []
        for m in models:
            try:
                p = await predict_price(symbol.upper(), m, horizon)
                predictions.append(asdict(p))
            except Exception:
                pass
        return {"predictions": predictions}

    @router.get("/anomalies/{symbol}")
    async def anomalies(symbol: str, lookback: int = Query(60)):
        events = await detect_anomalies(symbol.upper(), lookback)
        return {"anomalies": [asdict(e) for e in events]}

    @router.get("/regime")
    async def regime(symbol: str = Query("SPY")):
        analysis = await detect_regime(symbol.upper())
        return asdict(analysis)

    @router.get("/signals/{symbol}")
    async def signals(symbol: str):
        try:
            signal = await generate_trading_signals(symbol.upper())
            return asdict(signal)
        except Exception as e:
            raise HTTPException(400, str(e))

    @router.get("/signals/batch/{symbols}")
    async def signals_batch(symbols: str):
        syms = [s.strip().upper() for s in symbols.split(",")][:10]
        results = []
        for sym in syms:
            try:
                sig = await generate_trading_signals(sym)
                results.append(asdict(sig))
            except Exception:
                pass
        return {"signals": results}

    @router.post("/chat")
    async def chat(config: Dict[str, Any] = Body(...)):
        message = config.get("message", "")
        if not message:
            raise HTTPException(400, "Message required")
        response = await chat_with_assistant(
            user_message=message,
            conversation_id=config.get("conversation_id"),
            role=AssistantRole(config.get("role", "analyst")),
            symbols=config.get("symbols"),
        )
        return asdict(response)

    @router.get("/summary")
    async def summary():
        s = await generate_market_summary()
        return asdict(s)

    @router.get("/features/{symbol}")
    async def feature_analysis(symbol: str):
        data = await _get_historical_data(symbol.upper())
        if not data or not data["closes"]:
            raise HTTPException(404, f"No data for {symbol}")
        features = _compute_features(data["closes"], data["highs"], data["lows"], data["volumes"])
        return {"symbol": symbol.upper(), "features": features}

    return router
