"""
┌───────────────────────────────────────────────────────────────────────┐
│  APEX TERMINAL — ML Pipeline Service                                 │
│  Feature engineering, model training, prediction pipelines,          │
│  walk-forward validation, and ensemble methods                       │
└───────────────────────────────────────────────────────────────────────┘
"""

import math
import random
import statistics
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, List, Any, Tuple, Callable
from dataclasses import dataclass, field, asdict
from enum import Enum

logger = logging.getLogger(__name__)


# ══════════════════════════════════════════════════════════════════════
# SECTION 1: TYPES & ENUMS
# ══════════════════════════════════════════════════════════════════════

class ModelType(str, Enum):
    LINEAR_REGRESSION = "linear_regression"
    RIDGE = "ridge"
    LASSO = "lasso"
    ELASTIC_NET = "elastic_net"
    RANDOM_FOREST = "random_forest"
    GRADIENT_BOOST = "gradient_boost"
    SVM = "svm"
    KNN = "knn"
    NEURAL_NET = "neural_net"
    ENSEMBLE = "ensemble"


class FeatureType(str, Enum):
    PRICE = "price"
    VOLUME = "volume"
    MOMENTUM = "momentum"
    VOLATILITY = "volatility"
    MEAN_REVERSION = "mean_reversion"
    TREND = "trend"
    MICROSTRUCTURE = "microstructure"
    SENTIMENT = "sentiment"
    CALENDAR = "calendar"
    CROSS_ASSET = "cross_asset"


class PredictionTarget(str, Enum):
    RETURN_1D = "return_1d"
    RETURN_5D = "return_5d"
    RETURN_21D = "return_21d"
    DIRECTION = "direction"
    VOLATILITY = "volatility"
    REGIME = "regime"
    DRAWDOWN = "drawdown"


@dataclass
class Feature:
    name: str
    category: FeatureType
    lookback: int
    importance: float = 0.0
    description: str = ""


@dataclass
class FeatureVector:
    timestamp: float
    features: Dict[str, float]
    target: Optional[float] = None


@dataclass
class ModelConfig:
    model_type: ModelType
    target: PredictionTarget
    features: List[str]
    lookback_window: int = 252
    train_ratio: float = 0.7
    validation_ratio: float = 0.15
    test_ratio: float = 0.15
    hyperparams: Dict[str, Any] = field(default_factory=dict)
    walk_forward_windows: int = 5
    retrain_frequency: int = 21  # trading days


@dataclass
class TrainingResult:
    model_id: str
    model_type: str
    target: str
    train_metrics: Dict[str, float]
    validation_metrics: Dict[str, float]
    test_metrics: Dict[str, float]
    feature_importance: List[Dict[str, Any]]
    training_time_ms: float
    n_train: int
    n_validation: int
    n_test: int
    hyperparams: Dict[str, Any]
    created_at: str


@dataclass
class Prediction:
    timestamp: float
    target: str
    value: float
    confidence: float
    model_id: str
    features_used: Dict[str, float]
    explanation: str


@dataclass
class WalkForwardResult:
    window: int
    train_start: int
    train_end: int
    test_start: int
    test_end: int
    train_metrics: Dict[str, float]
    test_metrics: Dict[str, float]
    predictions: List[float]
    actuals: List[float]


@dataclass
class EnsembleResult:
    model_ids: List[str]
    weights: List[float]
    combined_metrics: Dict[str, float]
    individual_metrics: List[Dict[str, float]]
    combination_method: str  # simple_avg, weighted, stacking


@dataclass
class BacktestSignal:
    timestamp: float
    signal: float  # -1 to 1
    confidence: float
    model_id: str
    features: Dict[str, float]


@dataclass
class MLBacktestResult:
    total_return: float
    annualized_return: float
    sharpe_ratio: float
    max_drawdown: float
    hit_rate: float
    total_trades: int
    avg_holding_period: float
    signals: List[Dict[str, Any]]
    equity_curve: List[Dict[str, float]]
    monthly_returns: List[Dict[str, float]]


# ══════════════════════════════════════════════════════════════════════
# SECTION 2: STATISTICAL UTILITIES
# ══════════════════════════════════════════════════════════════════════

def _mean(values: List[float]) -> float:
    return sum(values) / len(values) if values else 0.0

def _std(values: List[float], ddof: int = 1) -> float:
    if len(values) < 2: return 0.0
    mu = _mean(values)
    return math.sqrt(sum((x - mu) ** 2 for x in values) / (len(values) - ddof))

def _correlation(x: List[float], y: List[float]) -> float:
    n = min(len(x), len(y))
    if n < 2: return 0.0
    mx, my = _mean(x[:n]), _mean(y[:n])
    sx, sy = _std(x[:n]), _std(y[:n])
    if sx == 0 or sy == 0: return 0.0
    return sum((x[i] - mx) * (y[i] - my) for i in range(n)) / ((n - 1) * sx * sy)

def _percentile(values: List[float], pct: float) -> float:
    if not values: return 0.0
    s = sorted(values)
    idx = pct * (len(s) - 1)
    lo, hi = int(math.floor(idx)), int(math.ceil(idx))
    if lo == hi: return s[lo]
    return s[lo] + (s[hi] - s[lo]) * (idx - lo)

def _mse(predicted: List[float], actual: List[float]) -> float:
    n = min(len(predicted), len(actual))
    return sum((predicted[i] - actual[i]) ** 2 for i in range(n)) / n if n > 0 else 0

def _mae(predicted: List[float], actual: List[float]) -> float:
    n = min(len(predicted), len(actual))
    return sum(abs(predicted[i] - actual[i]) for i in range(n)) / n if n > 0 else 0

def _r_squared(predicted: List[float], actual: List[float]) -> float:
    n = min(len(predicted), len(actual))
    if n < 2: return 0.0
    ma = _mean(actual[:n])
    ss_res = sum((actual[i] - predicted[i]) ** 2 for i in range(n))
    ss_tot = sum((actual[i] - ma) ** 2 for i in range(n))
    return 1 - ss_res / ss_tot if ss_tot > 0 else 0

def _accuracy(predicted: List[float], actual: List[float], threshold: float = 0.0) -> float:
    n = min(len(predicted), len(actual))
    if n == 0: return 0.0
    correct = sum(1 for i in range(n) if (predicted[i] > threshold) == (actual[i] > threshold))
    return correct / n

def _precision_recall(predicted: List[float], actual: List[float]) -> Dict[str, float]:
    n = min(len(predicted), len(actual))
    tp = sum(1 for i in range(n) if predicted[i] > 0 and actual[i] > 0)
    fp = sum(1 for i in range(n) if predicted[i] > 0 and actual[i] <= 0)
    fn = sum(1 for i in range(n) if predicted[i] <= 0 and actual[i] > 0)
    precision = tp / (tp + fp) if (tp + fp) > 0 else 0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0
    return {"precision": round(precision, 4), "recall": round(recall, 4), "f1": round(f1, 4)}


# ══════════════════════════════════════════════════════════════════════
# SECTION 3: FEATURE ENGINEERING
# ══════════════════════════════════════════════════════════════════════

class FeatureEngine:
    """Generate ML features from OHLCV data"""

    FEATURE_REGISTRY: List[Feature] = [
        # Price features
        Feature("return_1d", FeatureType.PRICE, 1, 0, "1-day return"),
        Feature("return_5d", FeatureType.PRICE, 5, 0, "5-day return"),
        Feature("return_21d", FeatureType.PRICE, 21, 0, "21-day return"),
        Feature("return_63d", FeatureType.PRICE, 63, 0, "63-day return"),
        Feature("log_return_1d", FeatureType.PRICE, 1, 0, "1-day log return"),
        Feature("gap_pct", FeatureType.PRICE, 1, 0, "Overnight gap %"),
        Feature("intraday_range", FeatureType.PRICE, 1, 0, "High-Low / Close"),
        Feature("body_ratio", FeatureType.PRICE, 1, 0, "abs(Close-Open) / (High-Low)"),

        # Momentum features
        Feature("rsi_14", FeatureType.MOMENTUM, 14, 0, "RSI 14-period"),
        Feature("rsi_7", FeatureType.MOMENTUM, 7, 0, "RSI 7-period"),
        Feature("macd", FeatureType.MOMENTUM, 26, 0, "MACD line"),
        Feature("macd_signal", FeatureType.MOMENTUM, 35, 0, "MACD signal line"),
        Feature("macd_hist", FeatureType.MOMENTUM, 35, 0, "MACD histogram"),
        Feature("roc_10", FeatureType.MOMENTUM, 10, 0, "Rate of change 10d"),
        Feature("roc_20", FeatureType.MOMENTUM, 20, 0, "Rate of change 20d"),
        Feature("williams_r", FeatureType.MOMENTUM, 14, 0, "Williams %R"),
        Feature("stoch_k", FeatureType.MOMENTUM, 14, 0, "Stochastic %K"),
        Feature("stoch_d", FeatureType.MOMENTUM, 14, 0, "Stochastic %D"),
        Feature("cci_14", FeatureType.MOMENTUM, 14, 0, "CCI 14-period"),
        Feature("adx_14", FeatureType.MOMENTUM, 14, 0, "ADX 14-period"),

        # Volatility features
        Feature("vol_5d", FeatureType.VOLATILITY, 5, 0, "5-day realized vol"),
        Feature("vol_21d", FeatureType.VOLATILITY, 21, 0, "21-day realized vol"),
        Feature("vol_63d", FeatureType.VOLATILITY, 63, 0, "63-day realized vol"),
        Feature("vol_ratio_5_21", FeatureType.VOLATILITY, 21, 0, "Vol ratio 5d/21d"),
        Feature("atr_14", FeatureType.VOLATILITY, 14, 0, "ATR 14-period"),
        Feature("bb_width", FeatureType.VOLATILITY, 20, 0, "Bollinger Band width"),
        Feature("bb_position", FeatureType.VOLATILITY, 20, 0, "Price position in BB"),
        Feature("parkinson_vol", FeatureType.VOLATILITY, 21, 0, "Parkinson volatility"),
        Feature("garman_klass_vol", FeatureType.VOLATILITY, 21, 0, "Garman-Klass vol"),

        # Mean reversion features
        Feature("z_score_20", FeatureType.MEAN_REVERSION, 20, 0, "Z-score vs 20d MA"),
        Feature("z_score_50", FeatureType.MEAN_REVERSION, 50, 0, "Z-score vs 50d MA"),
        Feature("dist_from_high_52w", FeatureType.MEAN_REVERSION, 252, 0, "Distance from 52w high"),
        Feature("dist_from_low_52w", FeatureType.MEAN_REVERSION, 252, 0, "Distance from 52w low"),
        Feature("mean_rev_score", FeatureType.MEAN_REVERSION, 20, 0, "Mean reversion composite"),

        # Trend features
        Feature("sma_cross_5_20", FeatureType.TREND, 20, 0, "SMA 5/20 crossover"),
        Feature("sma_cross_20_50", FeatureType.TREND, 50, 0, "SMA 20/50 crossover"),
        Feature("ema_cross_12_26", FeatureType.TREND, 26, 0, "EMA 12/26 crossover"),
        Feature("trend_strength", FeatureType.TREND, 50, 0, "Trend strength (slope R²)"),
        Feature("price_vs_sma20", FeatureType.TREND, 20, 0, "Price / SMA20 - 1"),
        Feature("price_vs_sma50", FeatureType.TREND, 50, 0, "Price / SMA50 - 1"),
        Feature("price_vs_sma200", FeatureType.TREND, 200, 0, "Price / SMA200 - 1"),

        # Volume features
        Feature("volume_ratio_20", FeatureType.VOLUME, 20, 0, "Volume / 20d avg"),
        Feature("volume_trend", FeatureType.VOLUME, 10, 0, "Volume trend (slope)"),
        Feature("obv_slope", FeatureType.VOLUME, 20, 0, "OBV slope"),
        Feature("vwap_distance", FeatureType.VOLUME, 1, 0, "Price distance from VWAP"),
        Feature("accumulation_dist", FeatureType.VOLUME, 20, 0, "Accumulation/Distribution"),

        # Calendar features
        Feature("day_of_week", FeatureType.CALENDAR, 0, 0, "Day of week (0-4)"),
        Feature("month_of_year", FeatureType.CALENDAR, 0, 0, "Month (1-12)"),
        Feature("is_month_end", FeatureType.CALENDAR, 0, 0, "Is month end week"),
        Feature("is_quarter_end", FeatureType.CALENDAR, 0, 0, "Is quarter end"),
        Feature("days_since_high", FeatureType.CALENDAR, 252, 0, "Days since 52w high"),
    ]

    def __init__(self, feature_names: Optional[List[str]] = None):
        if feature_names:
            self.features = [f for f in self.FEATURE_REGISTRY if f.name in feature_names]
        else:
            self.features = self.FEATURE_REGISTRY[:]

    def compute_features(
        self,
        opens: List[float],
        highs: List[float],
        lows: List[float],
        closes: List[float],
        volumes: List[float],
        timestamps: Optional[List[float]] = None,
    ) -> List[FeatureVector]:
        """Compute all features for the given OHLCV data"""
        n = len(closes)
        if n < 252:
            logger.warning(f"Insufficient data for feature computation: {n} < 252")

        vectors: List[FeatureVector] = []
        for i in range(max(252, 0), n):
            features: Dict[str, float] = {}

            # === PRICE FEATURES ===
            if i >= 1:
                features["return_1d"] = (closes[i] - closes[i-1]) / closes[i-1] if closes[i-1] != 0 else 0
                features["log_return_1d"] = math.log(closes[i] / closes[i-1]) if closes[i-1] > 0 else 0
                features["gap_pct"] = (opens[i] - closes[i-1]) / closes[i-1] if closes[i-1] != 0 else 0
                rng = highs[i] - lows[i]
                features["intraday_range"] = rng / closes[i] if closes[i] != 0 else 0
                features["body_ratio"] = abs(closes[i] - opens[i]) / rng if rng > 0 else 0
            if i >= 5:
                features["return_5d"] = (closes[i] - closes[i-5]) / closes[i-5] if closes[i-5] != 0 else 0
            if i >= 21:
                features["return_21d"] = (closes[i] - closes[i-21]) / closes[i-21] if closes[i-21] != 0 else 0
            if i >= 63:
                features["return_63d"] = (closes[i] - closes[i-63]) / closes[i-63] if closes[i-63] != 0 else 0

            # === MOMENTUM FEATURES ===
            features["rsi_14"] = self._rsi(closes, i, 14)
            features["rsi_7"] = self._rsi(closes, i, 7)

            if i >= 35:
                ema12 = self._ema(closes, i, 12)
                ema26 = self._ema(closes, i, 26)
                features["macd"] = ema12 - ema26
                features["macd_signal"] = self._ema_from_values(
                    [self._ema(closes, j, 12) - self._ema(closes, j, 26) for j in range(max(26,i-9), i+1)],
                    len([self._ema(closes, j, 12) - self._ema(closes, j, 26) for j in range(max(26,i-9), i+1)]) - 1,
                    9,
                )
                features["macd_hist"] = features["macd"] - features["macd_signal"]

            if i >= 10:
                features["roc_10"] = (closes[i] - closes[i-10]) / closes[i-10] * 100 if closes[i-10] != 0 else 0
            if i >= 20:
                features["roc_20"] = (closes[i] - closes[i-20]) / closes[i-20] * 100 if closes[i-20] != 0 else 0

            if i >= 14:
                hh = max(highs[i-13:i+1])
                ll = min(lows[i-13:i+1])
                features["williams_r"] = ((hh - closes[i]) / (hh - ll) * -100) if (hh - ll) > 0 else -50
                features["stoch_k"] = ((closes[i] - ll) / (hh - ll) * 100) if (hh - ll) > 0 else 50
                features["stoch_d"] = _mean([
                    ((closes[j] - min(lows[j-13:j+1])) / (max(highs[j-13:j+1]) - min(lows[j-13:j+1])) * 100)
                    if (max(highs[j-13:j+1]) - min(lows[j-13:j+1])) > 0 else 50
                    for j in range(max(14, i-2), i+1)
                ])

                # CCI
                tp_vals = [(highs[j] + lows[j] + closes[j]) / 3 for j in range(i-13, i+1)]
                tp_mean = _mean(tp_vals)
                tp_mad = _mean([abs(v - tp_mean) for v in tp_vals])
                features["cci_14"] = (tp_vals[-1] - tp_mean) / (0.015 * tp_mad) if tp_mad > 0 else 0

            # === VOLATILITY FEATURES ===
            if i >= 5:
                rets_5 = [(closes[j] - closes[j-1]) / closes[j-1] for j in range(i-4, i+1) if closes[j-1] != 0]
                features["vol_5d"] = _std(rets_5) * math.sqrt(252) if len(rets_5) > 1 else 0
            if i >= 21:
                rets_21 = [(closes[j] - closes[j-1]) / closes[j-1] for j in range(i-20, i+1) if closes[j-1] != 0]
                features["vol_21d"] = _std(rets_21) * math.sqrt(252) if len(rets_21) > 1 else 0
            if i >= 63:
                rets_63 = [(closes[j] - closes[j-1]) / closes[j-1] for j in range(i-62, i+1) if closes[j-1] != 0]
                features["vol_63d"] = _std(rets_63) * math.sqrt(252) if len(rets_63) > 1 else 0
            if "vol_5d" in features and "vol_21d" in features and features["vol_21d"] > 0:
                features["vol_ratio_5_21"] = features["vol_5d"] / features["vol_21d"]

            if i >= 14:
                tr_vals = [max(highs[j] - lows[j], abs(highs[j] - closes[j-1]), abs(lows[j] - closes[j-1]))
                           for j in range(i-13, i+1)]
                features["atr_14"] = _mean(tr_vals)

            if i >= 20:
                sma20 = _mean(closes[i-19:i+1])
                std20 = _std(closes[i-19:i+1])
                if std20 > 0:
                    upper_bb = sma20 + 2 * std20
                    lower_bb = sma20 - 2 * std20
                    features["bb_width"] = (upper_bb - lower_bb) / sma20
                    features["bb_position"] = (closes[i] - lower_bb) / (upper_bb - lower_bb) if (upper_bb - lower_bb) > 0 else 0.5
                else:
                    features["bb_width"] = 0
                    features["bb_position"] = 0.5

            if i >= 21:
                pk_vals = [math.log(highs[j] / lows[j]) ** 2 for j in range(i-20, i+1) if lows[j] > 0]
                features["parkinson_vol"] = math.sqrt(_mean(pk_vals) / (4 * math.log(2))) * math.sqrt(252) if pk_vals else 0

                gk_vals = []
                for j in range(i-20, i+1):
                    if lows[j] > 0 and opens[j] > 0 and closes[j-1] > 0:
                        u = math.log(highs[j] / opens[j])
                        d = math.log(lows[j] / opens[j])
                        c = math.log(closes[j] / opens[j])
                        gk_vals.append(0.5 * (u - d) ** 2 - (2 * math.log(2) - 1) * c ** 2)
                features["garman_klass_vol"] = math.sqrt(_mean(gk_vals) * 252) if gk_vals else 0

            # === MEAN REVERSION FEATURES ===
            if i >= 20:
                sma20 = _mean(closes[i-19:i+1])
                std20 = _std(closes[i-19:i+1])
                features["z_score_20"] = (closes[i] - sma20) / std20 if std20 > 0 else 0
            if i >= 50:
                sma50 = _mean(closes[i-49:i+1])
                std50 = _std(closes[i-49:i+1])
                features["z_score_50"] = (closes[i] - sma50) / std50 if std50 > 0 else 0
            if i >= 252:
                high_52w = max(highs[i-251:i+1])
                low_52w = min(lows[i-251:i+1])
                features["dist_from_high_52w"] = (closes[i] - high_52w) / high_52w if high_52w > 0 else 0
                features["dist_from_low_52w"] = (closes[i] - low_52w) / low_52w if low_52w > 0 else 0
                features["mean_rev_score"] = features.get("z_score_20", 0) * 0.5 + features.get("z_score_50", 0) * 0.3 + features["dist_from_high_52w"] * 0.2

            # === TREND FEATURES ===
            if i >= 20:
                sma5 = _mean(closes[i-4:i+1])
                sma20 = _mean(closes[i-19:i+1])
                features["sma_cross_5_20"] = 1.0 if sma5 > sma20 else -1.0
                features["price_vs_sma20"] = (closes[i] / sma20 - 1) if sma20 > 0 else 0
            if i >= 50:
                sma50 = _mean(closes[i-49:i+1])
                sma20 = _mean(closes[i-19:i+1])
                features["sma_cross_20_50"] = 1.0 if sma20 > sma50 else -1.0
                features["price_vs_sma50"] = (closes[i] / sma50 - 1) if sma50 > 0 else 0
            if i >= 200:
                sma200 = _mean(closes[i-199:i+1])
                features["price_vs_sma200"] = (closes[i] / sma200 - 1) if sma200 > 0 else 0
            if i >= 26:
                ema12 = self._ema(closes, i, 12)
                ema26 = self._ema(closes, i, 26)
                features["ema_cross_12_26"] = 1.0 if ema12 > ema26 else -1.0
            if i >= 50:
                x_vals = list(range(50))
                y_vals = closes[i-49:i+1]
                mx = _mean(x_vals)
                my = _mean(y_vals)
                num = sum((x_vals[j] - mx) * (y_vals[j] - my) for j in range(50))
                den = sum((x_vals[j] - mx) ** 2 for j in range(50))
                slope = num / den if den > 0 else 0
                intercept = my - slope * mx
                predicted = [intercept + slope * x for x in x_vals]
                ss_res = sum((y_vals[j] - predicted[j]) ** 2 for j in range(50))
                ss_tot = sum((y_vals[j] - my) ** 2 for j in range(50))
                features["trend_strength"] = (1 - ss_res / ss_tot) if ss_tot > 0 else 0

            # === VOLUME FEATURES ===
            if i >= 20:
                avg_vol = _mean(volumes[i-19:i+1])
                features["volume_ratio_20"] = volumes[i] / avg_vol if avg_vol > 0 else 1
            if i >= 10:
                vol_slice = volumes[i-9:i+1]
                x_v = list(range(10))
                mx_v = _mean(x_v)
                my_v = _mean(vol_slice)
                num_v = sum((x_v[j] - mx_v) * (vol_slice[j] - my_v) for j in range(10))
                den_v = sum((x_v[j] - mx_v) ** 2 for j in range(10))
                features["volume_trend"] = num_v / den_v if den_v > 0 else 0

            # === CALENDAR FEATURES ===
            features["day_of_week"] = i % 5
            features["month_of_year"] = ((i // 21) % 12) + 1
            features["is_month_end"] = 1.0 if (i % 21) >= 18 else 0.0
            features["is_quarter_end"] = 1.0 if ((i // 21) % 3 == 2 and (i % 21) >= 18) else 0.0
            if i >= 252:
                high_idx = max(range(i-251, i+1), key=lambda j: highs[j])
                features["days_since_high"] = i - high_idx

            vectors.append(FeatureVector(
                timestamp=timestamps[i] if timestamps and i < len(timestamps) else float(i),
                features=features,
            ))

        return vectors

    def _rsi(self, closes: List[float], idx: int, period: int) -> float:
        if idx < period: return 50.0
        gains, losses = [], []
        for j in range(idx - period + 1, idx + 1):
            change = closes[j] - closes[j-1]
            gains.append(max(0, change))
            losses.append(max(0, -change))
        avg_gain = _mean(gains) if gains else 0
        avg_loss = _mean(losses) if losses else 0
        if avg_loss == 0: return 100.0
        rs = avg_gain / avg_loss
        return 100 - 100 / (1 + rs)

    def _ema(self, closes: List[float], idx: int, period: int) -> float:
        if idx < period: return _mean(closes[:idx+1])
        k = 2 / (period + 1)
        ema = _mean(closes[idx-period:idx-period+period])
        for j in range(idx - period + period, idx + 1):
            ema = closes[j] * k + ema * (1 - k)
        return ema

    def _ema_from_values(self, values: List[float], idx: int, period: int) -> float:
        if not values or idx >= len(values): return 0
        k = 2 / (period + 1)
        ema = values[0]
        for j in range(1, min(idx + 1, len(values))):
            ema = values[j] * k + ema * (1 - k)
        return ema

    def get_feature_names(self) -> List[str]:
        return [f.name for f in self.features]

    def get_feature_descriptions(self) -> Dict[str, str]:
        return {f.name: f.description for f in self.features}


# ══════════════════════════════════════════════════════════════════════
# SECTION 4: MODEL IMPLEMENTATIONS (Pure Python, no sklearn)
# ══════════════════════════════════════════════════════════════════════

class LinearRegressionModel:
    """OLS linear regression"""

    def __init__(self, regularization: float = 0.0, reg_type: str = "ridge"):
        self.betas: List[float] = []
        self.regularization = regularization
        self.reg_type = reg_type

    def fit(self, X: List[List[float]], y: List[float]) -> None:
        n = len(X)
        k = len(X[0]) if X else 0
        if n == 0 or k == 0:
            self.betas = []
            return

        # Add intercept
        X_aug = [[1.0] + row for row in X]
        k_aug = k + 1

        # X'X + lambda * I
        XtX = [[0.0] * k_aug for _ in range(k_aug)]
        for i in range(k_aug):
            for j in range(k_aug):
                XtX[i][j] = sum(X_aug[t][i] * X_aug[t][j] for t in range(n))
                if i == j and i > 0:  # Don't regularize intercept
                    XtX[i][j] += self.regularization

        Xty = [sum(X_aug[t][i] * y[t] for t in range(n)) for i in range(k_aug)]

        try:
            # Gaussian elimination
            mat = [XtX[i][:] + [Xty[i]] for i in range(k_aug)]
            for col in range(k_aug):
                max_row = max(range(col, k_aug), key=lambda r: abs(mat[r][col]))
                mat[col], mat[max_row] = mat[max_row], mat[col]
                if abs(mat[col][col]) < 1e-12:
                    continue
                for row in range(col + 1, k_aug):
                    factor = mat[row][col] / mat[col][col]
                    for j in range(col, k_aug + 1):
                        mat[row][j] -= factor * mat[col][j]

            betas = [0.0] * k_aug
            for i in range(k_aug - 1, -1, -1):
                if abs(mat[i][i]) < 1e-12:
                    continue
                betas[i] = (mat[i][k_aug] - sum(mat[i][j] * betas[j] for j in range(i + 1, k_aug))) / mat[i][i]
            self.betas = betas
        except Exception:
            self.betas = [0.0] * k_aug

    def predict(self, X: List[List[float]]) -> List[float]:
        if not self.betas:
            return [0.0] * len(X)
        return [self.betas[0] + sum(self.betas[j + 1] * X[i][j] for j in range(len(X[i]))) for i in range(len(X))]


class KNNModel:
    """K-Nearest Neighbors regression/classification"""

    def __init__(self, k: int = 5, task: str = "regression"):
        self.k = k
        self.task = task
        self.X_train: List[List[float]] = []
        self.y_train: List[float] = []

    def fit(self, X: List[List[float]], y: List[float]) -> None:
        self.X_train = X[:]
        self.y_train = y[:]

    def predict(self, X: List[List[float]]) -> List[float]:
        predictions = []
        for xi in X:
            distances = []
            for j, xj in enumerate(self.X_train):
                dist = math.sqrt(sum((xi[f] - xj[f]) ** 2 for f in range(min(len(xi), len(xj)))))
                distances.append((dist, self.y_train[j]))
            distances.sort(key=lambda x: x[0])
            neighbors = distances[:self.k]

            if self.task == "classification":
                votes: Dict[int, int] = {}
                for _, label in neighbors:
                    key = 1 if label > 0 else -1
                    votes[key] = votes.get(key, 0) + 1
                predictions.append(float(max(votes, key=votes.get)))
            else:
                predictions.append(_mean([v for _, v in neighbors]))
        return predictions


class DecisionStumpEnsemble:
    """Simple gradient boosting via decision stumps"""

    def __init__(self, n_estimators: int = 50, learning_rate: float = 0.1, max_depth: int = 1):
        self.n_estimators = n_estimators
        self.learning_rate = learning_rate
        self.stumps: List[Dict[str, Any]] = []
        self.base_prediction = 0.0

    def fit(self, X: List[List[float]], y: List[float]) -> None:
        n = len(X)
        k = len(X[0]) if X else 0
        if n == 0 or k == 0:
            return

        self.base_prediction = _mean(y)
        residuals = [y[i] - self.base_prediction for i in range(n)]

        for _ in range(self.n_estimators):
            best_stump = self._find_best_stump(X, residuals, k, n)
            if best_stump is None:
                break
            self.stumps.append(best_stump)

            # Update residuals
            for i in range(n):
                pred = best_stump["left_val"] if X[i][best_stump["feature"]] <= best_stump["threshold"] else best_stump["right_val"]
                residuals[i] -= self.learning_rate * pred

    def _find_best_stump(self, X, residuals, k, n) -> Optional[Dict[str, Any]]:
        best_loss = float('inf')
        best_stump = None

        for feature in range(k):
            # Try a few thresholds
            values = sorted(set(X[i][feature] for i in range(n)))
            if len(values) < 2:
                continue
            thresholds = [values[i] for i in range(0, len(values), max(1, len(values) // 10))]

            for threshold in thresholds:
                left_idx = [i for i in range(n) if X[i][feature] <= threshold]
                right_idx = [i for i in range(n) if X[i][feature] > threshold]

                if not left_idx or not right_idx:
                    continue

                left_val = _mean([residuals[i] for i in left_idx])
                right_val = _mean([residuals[i] for i in right_idx])

                loss = sum((residuals[i] - left_val) ** 2 for i in left_idx) + \
                       sum((residuals[i] - right_val) ** 2 for i in right_idx)

                if loss < best_loss:
                    best_loss = loss
                    best_stump = {
                        "feature": feature,
                        "threshold": threshold,
                        "left_val": left_val,
                        "right_val": right_val,
                    }

        return best_stump

    def predict(self, X: List[List[float]]) -> List[float]:
        predictions = [self.base_prediction] * len(X)
        for stump in self.stumps:
            for i in range(len(X)):
                val = stump["left_val"] if X[i][stump["feature"]] <= stump["threshold"] else stump["right_val"]
                predictions[i] += self.learning_rate * val
        return predictions


# ══════════════════════════════════════════════════════════════════════
# SECTION 5: TRAINING PIPELINE
# ══════════════════════════════════════════════════════════════════════

class MLTrainingPipeline:
    """End-to-end ML training pipeline"""

    def __init__(self):
        self.models: Dict[str, Any] = {}
        self.feature_engine = FeatureEngine()
        self.training_history: List[TrainingResult] = []
        self._counter = 0

    def _uid(self) -> str:
        self._counter += 1
        return f"model_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}_{self._counter}"

    def train(
        self,
        config: ModelConfig,
        feature_vectors: List[FeatureVector],
        target_values: List[float],
    ) -> TrainingResult:
        """Train a model with the given configuration"""
        import time
        start_time = time.time()

        model_id = self._uid()
        n = len(feature_vectors)

        # Feature matrix
        feature_names = config.features or [f for f in feature_vectors[0].features.keys()] if feature_vectors else []
        X = []
        for fv in feature_vectors:
            row = [fv.features.get(f, 0.0) for f in feature_names]
            X.append(row)

        y = target_values[:n]

        # Normalize features
        means = [_mean([X[i][j] for i in range(n)]) for j in range(len(feature_names))]
        stds = [_std([X[i][j] for i in range(n)]) for j in range(len(feature_names))]
        X_norm = [[(X[i][j] - means[j]) / stds[j] if stds[j] > 0 else 0 for j in range(len(feature_names))] for i in range(n)]

        # Split
        n_train = int(n * config.train_ratio)
        n_val = int(n * config.validation_ratio)
        X_train, y_train = X_norm[:n_train], y[:n_train]
        X_val, y_val = X_norm[n_train:n_train + n_val], y[n_train:n_train + n_val]
        X_test, y_test = X_norm[n_train + n_val:], y[n_train + n_val:]

        # Train model
        model = self._create_model(config)
        model.fit(X_train, y_train)
        self.models[model_id] = {"model": model, "config": config, "means": means, "stds": stds, "features": feature_names}

        # Evaluate
        train_pred = model.predict(X_train)
        val_pred = model.predict(X_val) if X_val else []
        test_pred = model.predict(X_test) if X_test else []

        train_metrics = self._compute_metrics(train_pred, y_train, config.target)
        val_metrics = self._compute_metrics(val_pred, y_val, config.target) if y_val else {}
        test_metrics = self._compute_metrics(test_pred, y_test, config.target) if y_test else {}

        # Feature importance (correlation-based)
        importance = []
        for j, fname in enumerate(feature_names):
            feat_vals = [X_train[i][j] for i in range(len(X_train))]
            corr = abs(_correlation(feat_vals, y_train[:len(X_train)])) if len(feat_vals) > 2 else 0
            importance.append({"feature": fname, "importance": round(corr, 4)})
        importance.sort(key=lambda x: -x["importance"])

        elapsed = (time.time() - start_time) * 1000

        result = TrainingResult(
            model_id=model_id,
            model_type=config.model_type.value,
            target=config.target.value,
            train_metrics=train_metrics,
            validation_metrics=val_metrics,
            test_metrics=test_metrics,
            feature_importance=importance[:20],
            training_time_ms=round(elapsed, 2),
            n_train=len(X_train),
            n_validation=len(X_val),
            n_test=len(X_test),
            hyperparams=config.hyperparams,
            created_at=datetime.utcnow().isoformat(),
        )
        self.training_history.append(result)
        return result

    def _create_model(self, config: ModelConfig) -> Any:
        if config.model_type == ModelType.LINEAR_REGRESSION:
            return LinearRegressionModel()
        elif config.model_type == ModelType.RIDGE:
            return LinearRegressionModel(regularization=config.hyperparams.get("alpha", 1.0), reg_type="ridge")
        elif config.model_type == ModelType.KNN:
            return KNNModel(k=config.hyperparams.get("k", 5))
        elif config.model_type == ModelType.GRADIENT_BOOST:
            return DecisionStumpEnsemble(
                n_estimators=config.hyperparams.get("n_estimators", 50),
                learning_rate=config.hyperparams.get("learning_rate", 0.1),
            )
        else:
            return LinearRegressionModel()

    def _compute_metrics(self, predicted: List[float], actual: List[float], target: PredictionTarget) -> Dict[str, float]:
        if not predicted or not actual:
            return {}
        n = min(len(predicted), len(actual))
        p, a = predicted[:n], actual[:n]

        metrics = {
            "mse": round(_mse(p, a), 8),
            "mae": round(_mae(p, a), 8),
            "r_squared": round(_r_squared(p, a), 4),
            "correlation": round(_correlation(p, a), 4),
        }

        if target == PredictionTarget.DIRECTION:
            metrics["accuracy"] = round(_accuracy(p, a), 4)
            pr = _precision_recall(p, a)
            metrics.update(pr)

        # Direction accuracy even for regression targets
        metrics["direction_accuracy"] = round(_accuracy(p, a, 0), 4)

        # Information coefficient
        metrics["ic"] = round(_correlation(p, a), 4)
        # Risk-adjusted IC
        ic_std = _std([p[i] * a[i] for i in range(n)])
        metrics["icir"] = round(metrics["ic"] / ic_std * math.sqrt(252), 4) if ic_std > 0 else 0

        return metrics

    def predict(self, model_id: str, features: Dict[str, float]) -> Optional[Prediction]:
        """Make a prediction with a trained model"""
        entry = self.models.get(model_id)
        if not entry:
            return None

        model = entry["model"]
        config = entry["config"]
        means = entry["means"]
        stds = entry["stds"]
        feature_names = entry["features"]

        # Normalize
        x = [(features.get(f, 0) - means[i]) / stds[i] if stds[i] > 0 else 0 for i, f in enumerate(feature_names)]
        pred = model.predict([x])[0]

        # Confidence (based on distance from mean prediction)
        confidence = min(0.95, max(0.1, 0.5 + abs(pred) * 10))

        return Prediction(
            timestamp=datetime.utcnow().timestamp(),
            target=config.target.value,
            value=round(pred, 6),
            confidence=round(confidence, 4),
            model_id=model_id,
            features_used=features,
            explanation=f"{config.model_type.value} prediction: {pred:.6f}",
        )

    def walk_forward(
        self,
        config: ModelConfig,
        feature_vectors: List[FeatureVector],
        target_values: List[float],
        n_windows: int = 5,
    ) -> List[WalkForwardResult]:
        """Walk-forward validation"""
        n = len(feature_vectors)
        feature_names = config.features or [f for f in feature_vectors[0].features.keys()] if feature_vectors else []
        X = [[fv.features.get(f, 0) for f in feature_names] for fv in feature_vectors]
        y = target_values[:n]

        window_size = n // (n_windows + 1)
        results = []

        for w in range(n_windows):
            train_end = (w + 1) * window_size
            test_end = min(train_end + window_size, n)
            if test_end <= train_end:
                break

            X_train, y_train = X[:train_end], y[:train_end]
            X_test, y_test = X[train_end:test_end], y[train_end:test_end]

            # Normalize
            means = [_mean([X_train[i][j] for i in range(len(X_train))]) for j in range(len(feature_names))]
            stds = [_std([X_train[i][j] for i in range(len(X_train))]) for j in range(len(feature_names))]
            X_train_n = [[(X_train[i][j] - means[j]) / stds[j] if stds[j] > 0 else 0 for j in range(len(feature_names))] for i in range(len(X_train))]
            X_test_n = [[(X_test[i][j] - means[j]) / stds[j] if stds[j] > 0 else 0 for j in range(len(feature_names))] for i in range(len(X_test))]

            model = self._create_model(config)
            model.fit(X_train_n, y_train)

            train_pred = model.predict(X_train_n)
            test_pred = model.predict(X_test_n)

            results.append(WalkForwardResult(
                window=w,
                train_start=0, train_end=train_end,
                test_start=train_end, test_end=test_end,
                train_metrics=self._compute_metrics(train_pred, y_train, config.target),
                test_metrics=self._compute_metrics(test_pred, y_test, config.target),
                predictions=test_pred,
                actuals=y_test,
            ))

        return results


# ══════════════════════════════════════════════════════════════════════
# SECTION 6: ML BACKTEST ENGINE
# ══════════════════════════════════════════════════════════════════════

class MLBacktester:
    """Backtest ML model predictions as trading signals"""

    def __init__(self, initial_capital: float = 1_000_000, commission: float = 0.001):
        self.initial_capital = initial_capital
        self.commission = commission

    def backtest(
        self,
        predictions: List[float],
        actual_returns: List[float],
        threshold: float = 0.0,
        position_size: float = 1.0,
    ) -> MLBacktestResult:
        n = min(len(predictions), len(actual_returns))
        equity = self.initial_capital
        peak = equity
        max_dd = 0
        signals = []
        equity_curve = [{"index": 0, "equity": equity}]
        total_trades = 0
        winning_trades = 0
        holding_periods = []
        in_position = False
        entry_idx = 0

        for i in range(n):
            signal = 1.0 if predictions[i] > threshold else (-1.0 if predictions[i] < -threshold else 0.0)
            signal *= position_size

            # Track trades
            if signal != 0 and not in_position:
                in_position = True
                entry_idx = i
                total_trades += 1
            elif signal == 0 and in_position:
                in_position = False
                holding_periods.append(i - entry_idx)

            # Apply return
            if signal != 0:
                ret = signal * actual_returns[i] - abs(signal) * self.commission
            else:
                ret = 0

            equity *= (1 + ret)
            peak = max(peak, equity)
            dd = (peak - equity) / peak
            max_dd = max(max_dd, dd)

            if actual_returns[i] * signal > 0:
                winning_trades += 1

            signals.append({
                "index": i,
                "prediction": round(predictions[i], 6),
                "signal": signal,
                "actual_return": round(actual_returns[i], 6),
                "pnl": round(ret * equity, 2),
            })
            equity_curve.append({"index": i + 1, "equity": round(equity, 2)})

        total_return = (equity / self.initial_capital) - 1
        ann_factor = 252 / n if n > 0 else 1
        ann_return = (1 + total_return) ** ann_factor - 1

        daily_returns = [(equity_curve[i+1]["equity"] - equity_curve[i]["equity"]) / equity_curve[i]["equity"]
                        for i in range(len(equity_curve) - 1)]
        ann_vol = _std(daily_returns) * math.sqrt(252) if daily_returns else 0
        sharpe = (ann_return - 0.04) / ann_vol if ann_vol > 0 else 0

        hit_rate = winning_trades / total_trades if total_trades > 0 else 0
        avg_hold = _mean(holding_periods) if holding_periods else 0

        # Monthly returns
        monthly = []
        for m in range(0, n, 21):
            chunk = daily_returns[m:m+21]
            if chunk:
                cum = 1.0
                for r in chunk:
                    cum *= (1 + r)
                monthly.append({"month": m // 21, "return": round(cum - 1, 6)})

        return MLBacktestResult(
            total_return=round(total_return, 6),
            annualized_return=round(ann_return, 6),
            sharpe_ratio=round(sharpe, 4),
            max_drawdown=round(max_dd, 6),
            hit_rate=round(hit_rate, 4),
            total_trades=total_trades,
            avg_holding_period=round(avg_hold, 1),
            signals=signals[:50],  # Limit for response size
            equity_curve=equity_curve[::max(1, len(equity_curve) // 100)],
            monthly_returns=monthly,
        )


# ══════════════════════════════════════════════════════════════════════
# SECTION 7: SERVICE FACADE
# ══════════════════════════════════════════════════════════════════════

class MLPipelineService:
    """Unified ML pipeline service"""

    def __init__(self):
        self.feature_engine = FeatureEngine()
        self.pipeline = MLTrainingPipeline()
        self.backtester = MLBacktester()
        logger.info("MLPipelineService initialized")

    def generate_demo_data(self, n_days: int = 504, seed: int = 42) -> Dict[str, List[float]]:
        """Generate synthetic OHLCV data"""
        rng = random.Random(seed)
        price = 450.0
        opens, highs, lows, closes, volumes = [], [], [], [], []

        for _ in range(n_days):
            change = rng.gauss(0.0003, 0.012)
            o = price
            c = o * (1 + change)
            h = max(o, c) * (1 + abs(rng.gauss(0, 0.003)))
            l = min(o, c) * (1 - abs(rng.gauss(0, 0.003)))
            v = int(5e6 + rng.gauss(0, 2e6) + abs(change) * 1e8)
            opens.append(round(o, 2))
            highs.append(round(h, 2))
            lows.append(round(l, 2))
            closes.append(round(c, 2))
            volumes.append(max(1000, v))
            price = c

        return {"opens": opens, "highs": highs, "lows": lows, "closes": closes, "volumes": volumes}

    def run_full_pipeline(
        self,
        model_type: str = "gradient_boost",
        target: str = "return_5d",
        n_days: int = 504,
    ) -> Dict[str, Any]:
        """Run complete ML pipeline: feature engineering → training → backtest"""
        # Generate data
        data = self.generate_demo_data(n_days)

        # Feature engineering
        vectors = self.feature_engine.compute_features(
            data["opens"], data["highs"], data["lows"], data["closes"], data["volumes"],
        )

        if not vectors:
            return {"error": "Insufficient data for feature computation"}

        # Target: forward returns
        target_enum = PredictionTarget(target)
        closes = data["closes"]
        targets = []
        for i, fv in enumerate(vectors):
            actual_idx = int(fv.timestamp) if fv.timestamp < 10000 else 252 + len(targets)
            if target_enum == PredictionTarget.RETURN_1D and actual_idx + 1 < len(closes):
                targets.append((closes[actual_idx + 1] - closes[actual_idx]) / closes[actual_idx])
            elif target_enum == PredictionTarget.RETURN_5D and actual_idx + 5 < len(closes):
                targets.append((closes[actual_idx + 5] - closes[actual_idx]) / closes[actual_idx])
            elif target_enum == PredictionTarget.RETURN_21D and actual_idx + 21 < len(closes):
                targets.append((closes[actual_idx + 21] - closes[actual_idx]) / closes[actual_idx])
            elif target_enum == PredictionTarget.DIRECTION and actual_idx + 1 < len(closes):
                targets.append(1.0 if closes[actual_idx + 1] > closes[actual_idx] else -1.0)
            elif target_enum == PredictionTarget.VOLATILITY and actual_idx + 21 < len(closes):
                rets = [(closes[actual_idx + j + 1] - closes[actual_idx + j]) / closes[actual_idx + j]
                        for j in range(21) if actual_idx + j + 1 < len(closes)]
                targets.append(_std(rets) * math.sqrt(252) if len(rets) > 1 else 0)
            else:
                break

        vectors = vectors[:len(targets)]
        feature_names = list(vectors[0].features.keys()) if vectors else []

        # Config
        config = ModelConfig(
            model_type=ModelType(model_type),
            target=target_enum,
            features=feature_names[:30],  # Top 30 features
        )

        # Train
        training_result = self.pipeline.train(config, vectors, targets)

        # Walk-forward
        wf_results = self.pipeline.walk_forward(config, vectors, targets, n_windows=5)

        # Backtest
        all_preds = []
        for fv in vectors:
            pred = self.pipeline.predict(training_result.model_id, fv.features)
            all_preds.append(pred.value if pred else 0)

        actual_rets = [(closes[252 + i + 1] - closes[252 + i]) / closes[252 + i]
                       for i in range(len(all_preds)) if 252 + i + 1 < len(closes)]
        all_preds = all_preds[:len(actual_rets)]

        backtest_result = self.backtester.backtest(all_preds, actual_rets)

        return {
            "training": asdict(training_result),
            "walk_forward": [asdict(wf) for wf in wf_results],
            "backtest": asdict(backtest_result),
            "feature_count": len(feature_names),
            "data_points": len(vectors),
            "pipeline_run_at": datetime.utcnow().isoformat(),
        }
