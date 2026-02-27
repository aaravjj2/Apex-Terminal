"""
screener_engine.py — Bloomberg EQS-Style Multi-Criteria Stock Screener
=======================================================================
Comprehensive stock screening engine with:

  Technical Criteria:
    - Price level filters (above/below MA, price range)
    - Momentum filters (RSI, MACD signal, Stochastic)
    - Volume filters (relative volume, average volume, OBV trend)
    - Volatility filters (ATR %, BB squeeze, historical vol)
    - Pattern filters (golden cross, death cross, breakout, pullback)
    - Trend strength (ADX threshold, trend direction)

  Fundamental Criteria (from data annotations):
    - Valuation: P/E, P/B, P/S, EV/EBITDA, PEG
    - Profitability: ROE, ROA, ROIC, Net Margin, Gross Margin
    - Growth: Revenue growth, EPS growth (YoY, QoQ)
    - Quality: Debt/Equity, Current Ratio, Interest Coverage
    - Dividend: Yield, Payout Ratio, Dividend growth
    - Size: Market Cap categories, Sector/Industry

  Composite Scoring:
    - Multi-factor scoring with user-defined weights
    - Momentum score (1M, 3M, 6M, 12M return ranks)
    - Quality score (fundamentals composite)
    - Value score (valuation composites)
    - Technical score (indicator composites)

  Output:
    - Ranked DataFrame sorted by composite score
    - Per-criterion pass/fail flags
    - Sector/industry breakdown of results
    - Export-ready format (CSV / JSON)
"""

from __future__ import annotations
import math
import numpy as np
import pandas as pd
from typing import Any, Callable, Dict, List, Optional, Tuple, Union
from dataclasses import dataclass, field
from enum import Enum


# ─── CRITERION TYPES ─────────────────────────────────────────────────────────

class CriterionType(str, Enum):
    NUMERIC_RANGE   = "numeric_range"    # value between low and high
    NUMERIC_MIN     = "numeric_min"      # value >= min
    NUMERIC_MAX     = "numeric_max"      # value <= max
    BOOLEAN         = "boolean"          # True/False flag column
    STRING_MATCH    = "string_match"     # column matches one of a list
    PERCENTILE_MIN  = "percentile_min"   # within top X% of universe
    PERCENTILE_MAX  = "percentile_max"   # within bottom X% of universe
    CUSTOM          = "custom"           # user-supplied callable


@dataclass
class Criterion:
    """A single screening criterion."""
    name:           str
    column:         str                             # Column in the screener DataFrame
    criterion_type: CriterionType
    min_val:        Optional[float] = None
    max_val:        Optional[float] = None
    bool_value:     bool = True
    str_values:     Optional[List[str]] = None
    percentile:     Optional[float] = None         # 0-100
    custom_func:    Optional[Callable] = None
    weight:         float = 1.0                    # For composite scoring
    display_name:   Optional[str] = None

    def __post_init__(self):
        if self.display_name is None:
            self.display_name = self.name

    def apply(self, series: pd.Series, universe_series: Optional[pd.Series] = None) -> pd.Series:
        """Apply criterion to a Series, returning boolean mask."""
        if self.criterion_type == CriterionType.NUMERIC_RANGE:
            mask = pd.Series(True, index=series.index)
            if self.min_val is not None:
                mask &= series >= self.min_val
            if self.max_val is not None:
                mask &= series <= self.max_val
            return mask & series.notna()

        elif self.criterion_type == CriterionType.NUMERIC_MIN:
            return (series >= self.min_val) & series.notna()

        elif self.criterion_type == CriterionType.NUMERIC_MAX:
            return (series <= self.max_val) & series.notna()

        elif self.criterion_type == CriterionType.BOOLEAN:
            return series == self.bool_value

        elif self.criterion_type == CriterionType.STRING_MATCH:
            vals = self.str_values or []
            return series.isin(vals)

        elif self.criterion_type == CriterionType.PERCENTILE_MIN:
            p = self.percentile or 75
            threshold = np.nanpercentile(series.dropna().values, p)
            return (series >= threshold) & series.notna()

        elif self.criterion_type == CriterionType.PERCENTILE_MAX:
            p = self.percentile or 25
            threshold = np.nanpercentile(series.dropna().values, p)
            return (series <= threshold) & series.notna()

        elif self.criterion_type == CriterionType.CUSTOM:
            if self.custom_func:
                return series.apply(self.custom_func).astype(bool)
            return pd.Series(True, index=series.index)

        return pd.Series(True, index=series.index)


# ─── PRESET SCREENERS ────────────────────────────────────────────────────────

def momentum_screener() -> List[Criterion]:
    """Screen for strong momentum stocks (trend following)."""
    return [
        Criterion("rsi_above_50",    "rsi_14",       CriterionType.NUMERIC_MIN,  min_val=50),
        Criterion("rsi_below_70",    "rsi_14",       CriterionType.NUMERIC_MAX,  max_val=70),
        Criterion("above_50sma",     "distance_50sma", CriterionType.NUMERIC_MIN, min_val=0),
        Criterion("above_200sma",    "distance_200sma", CriterionType.NUMERIC_MIN, min_val=0),
        Criterion("adx_trending",    "adx_14",       CriterionType.NUMERIC_MIN,  min_val=25),
        Criterion("rel_vol_high",    "relative_volume", CriterionType.NUMERIC_MIN, min_val=1.0),
        Criterion("1m_return_pos",   "return_1m",    CriterionType.NUMERIC_MIN,  min_val=0),
        Criterion("3m_return_pos",   "return_3m",    CriterionType.NUMERIC_MIN,  min_val=0),
    ]


def value_screener() -> List[Criterion]:
    """Screen for undervalued stocks (value investing)."""
    return [
        Criterion("low_pe",          "pe_ratio",       CriterionType.NUMERIC_MAX,  max_val=15),
        Criterion("low_pb",          "pb_ratio",       CriterionType.NUMERIC_MAX,  max_val=1.5),
        Criterion("low_ev_ebitda",   "ev_ebitda",      CriterionType.NUMERIC_MAX,  max_val=10),
        Criterion("high_roe",        "roe",            CriterionType.NUMERIC_MIN,  min_val=15),
        Criterion("low_debt",        "debt_equity",    CriterionType.NUMERIC_MAX,  max_val=1.0),
        Criterion("div_yield",       "dividend_yield", CriterionType.NUMERIC_MIN,  min_val=2.0),
        Criterion("pos_fcf",         "fcf_yield",      CriterionType.NUMERIC_MIN,  min_val=0),
    ]


def growth_screener() -> List[Criterion]:
    """Screen for high-growth companies (GARP)."""
    return [
        Criterion("rev_growth",      "revenue_growth_yoy", CriterionType.NUMERIC_MIN, min_val=15),
        Criterion("eps_growth",      "eps_growth_yoy",     CriterionType.NUMERIC_MIN, min_val=20),
        Criterion("high_margins",    "gross_margin",       CriterionType.NUMERIC_MIN, min_val=40),
        Criterion("high_roic",       "roic",               CriterionType.NUMERIC_MIN, min_val=15),
        Criterion("low_peg",         "peg_ratio",          CriterionType.NUMERIC_MAX, max_val=2.0),
        Criterion("rs_rank",         "rs_rank",            CriterionType.NUMERIC_MIN, min_val=80),
    ]


def mean_reversion_screener() -> List[Criterion]:
    """Screen for oversold / mean-reversion setups."""
    return [
        Criterion("rsi_oversold",    "rsi_14",           CriterionType.NUMERIC_MAX,  max_val=35),
        Criterion("bb_lower_touch",  "bb_percentb",      CriterionType.NUMERIC_MAX,  max_val=0.1),
        Criterion("above_200sma",    "distance_200sma",  CriterionType.NUMERIC_MIN,  min_val=-5.0),
        Criterion("high_vol_stock",  "avg_volume_30d",   CriterionType.NUMERIC_MIN,  min_val=500_000),
        Criterion("no_earnings",     "days_to_earnings", CriterionType.NUMERIC_MIN,  min_val=10),
    ]


def quality_screener() -> List[Criterion]:
    """Screen for high-quality businesses."""
    return [
        Criterion("high_roe",        "roe",               CriterionType.NUMERIC_MIN, min_val=20),
        Criterion("high_roa",        "roa",               CriterionType.NUMERIC_MIN, min_val=10),
        Criterion("high_gross_margin","gross_margin",     CriterionType.NUMERIC_MIN, min_val=50),
        Criterion("low_debt",        "debt_equity",       CriterionType.NUMERIC_MAX, max_val=0.5),
        Criterion("strong_coverage", "interest_coverage", CriterionType.NUMERIC_MIN, min_val=5),
        Criterion("pos_rev_growth",  "revenue_growth_yoy",CriterionType.NUMERIC_MIN, min_val=5),
        Criterion("high_current_ratio","current_ratio",   CriterionType.NUMERIC_MIN, min_val=2.0),
    ]


def earnings_quality_screener() -> List[Criterion]:
    """Screen for companies with high earnings quality (accruals filter)."""
    return [
        Criterion("low_accruals",    "accruals_ratio",    CriterionType.NUMERIC_MAX, max_val=-0.05),
        Criterion("high_fcf_conv",   "fcf_conversion",    CriterionType.NUMERIC_MIN, min_val=80),
        Criterion("rev_beat",        "revenue_surprise_pct", CriterionType.NUMERIC_MIN, min_val=0),
        Criterion("eps_beat",        "eps_surprise_pct",  CriterionType.NUMERIC_MIN, min_val=0),
        Criterion("guidance_raised", "guidance_change",   CriterionType.NUMERIC_MIN, min_val=0),
    ]


# ─── TECHNICAL INDICATOR CALCULATOR ─────────────────────────────────────────

def compute_technical_columns(df: pd.DataFrame) -> pd.DataFrame:
    """
    Given a DataFrame with OHLCV data (per-symbol or multi-symbol),
    compute all technical screening columns in-place.

    Expected input columns: open, high, low, close, volume
    """
    df = df.copy()
    close  = df["close"].astype(float)
    high   = df["high"].astype(float)
    low    = df["low"].astype(float)
    volume = df["volume"].astype(float)

    n = len(df)

    # ── Moving Averages ───────────────────────────────────────────────────────
    for period in [5, 10, 20, 50, 100, 200]:
        col = f"sma_{period}"
        if col not in df.columns:
            df[col] = close.rolling(period, min_periods=period).mean()
        dist_col = f"distance_{period}sma"
        sma_vals = df[col]
        df[dist_col] = (close - sma_vals) / sma_vals * 100

    # ── EMA ────────────────────────────────────────────────────────────────────
    for period in [9, 12, 26, 50, 200]:
        col = f"ema_{period}"
        if col not in df.columns:
            df[col] = close.ewm(span=period, adjust=False).mean()

    # ── RSI ────────────────────────────────────────────────────────────────────
    for period in [7, 14, 21]:
        delta = close.diff()
        gain  = delta.clip(lower=0)
        loss  = (-delta).clip(lower=0)
        avg_g = gain.ewm(alpha=1/period, adjust=False).mean()
        avg_l = loss.ewm(alpha=1/period, adjust=False).mean()
        rs    = avg_g / avg_l.replace(0, float("nan"))
        df[f"rsi_{period}"] = 100 - 100 / (1 + rs)

    # ── MACD ───────────────────────────────────────────────────────────────────
    macd_line  = close.ewm(span=12, adjust=False).mean() - close.ewm(span=26, adjust=False).mean()
    signal     = macd_line.ewm(span=9, adjust=False).mean()
    df["macd"] = macd_line
    df["macd_signal"] = signal
    df["macd_hist"]   = macd_line - signal
    df["macd_above_signal"] = (macd_line > signal).astype(int)

    # ── Stochastic ────────────────────────────────────────────────────────────
    low14  = low.rolling(14).min()
    high14 = high.rolling(14).max()
    df["stoch_k"] = (close - low14) / (high14 - low14 + 1e-10) * 100
    df["stoch_d"] = df["stoch_k"].rolling(3).mean()

    # ── Bollinger Bands ───────────────────────────────────────────────────────
    for (period, std_mult) in [(20, 2.0)]:
        sma_bb = close.rolling(period).mean()
        std_bb = close.rolling(period).std(ddof=0)
        upper  = sma_bb + std_mult * std_bb
        lower  = sma_bb - std_mult * std_bb
        df[f"bb_upper_{period}"] = upper
        df[f"bb_lower_{period}"] = lower
        df[f"bb_middle_{period}"] = sma_bb
        df["bb_percentb"] = (close - lower) / (upper - lower + 1e-10)
        df["bb_width"]    = (upper - lower) / sma_bb

    # ── ATR ────────────────────────────────────────────────────────────────────
    tr1 = high - low
    tr2 = (high - close.shift()).abs()
    tr3 = (low  - close.shift()).abs()
    tr  = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
    for period in [14, 21]:
        df[f"atr_{period}"] = tr.ewm(alpha=1/period, adjust=False).mean()
    df["atr_pct"] = df["atr_14"] / close * 100

    # ── ADX ────────────────────────────────────────────────────────────────────
    plus_dm  = (high.diff().clip(lower=0)).where(high.diff() > (-low.diff()).clip(lower=0), 0.0)
    minus_dm = ((-low.diff()).clip(lower=0)).where((-low.diff()) > high.diff().clip(lower=0), 0.0)
    atr14    = df["atr_14"]
    pdi = 100 * plus_dm.ewm(alpha=1/14, adjust=False).mean() / atr14.replace(0, float("nan"))
    mdi = 100 * minus_dm.ewm(alpha=1/14, adjust=False).mean() / atr14.replace(0, float("nan"))
    dx  = 100 * (pdi - mdi).abs() / (pdi + mdi + 1e-10)
    df["adx_14"]   = dx.ewm(alpha=1/14, adjust=False).mean()
    df["adx_above_25"] = (df["adx_14"] >= 25).astype(int)
    df["plus_di"]  = pdi
    df["minus_di"] = mdi
    df["bullish_adx"] = ((pdi > mdi) & (df["adx_14"] >= 25)).astype(int)

    # ── Volume ────────────────────────────────────────────────────────────────
    df["avg_volume_10d"]  = volume.rolling(10).mean()
    df["avg_volume_30d"]  = volume.rolling(30).mean()
    df["avg_volume_90d"]  = volume.rolling(90).mean()
    df["relative_volume"] = volume / df["avg_volume_30d"].replace(0, float("nan"))

    # OBV
    obv = (volume * np.sign(close.diff())).cumsum()
    df["obv"] = obv
    df["obv_sma20"] = obv.rolling(20).mean()
    df["obv_trend"] = (obv > df["obv_sma20"]).astype(int)  # 1=bullish, 0=bearish

    # ── Historical Volatility ─────────────────────────────────────────────────
    log_returns = np.log(close / close.shift(1))
    df["hv_21"]  = log_returns.rolling(21).std(ddof=1) * math.sqrt(252) * 100
    df["hv_63"]  = log_returns.rolling(63).std(ddof=1) * math.sqrt(252) * 100

    # ── Momentum / Rate of Change ──────────────────────────────────────────────
    for days in [5, 10, 21, 63, 126, 252]:
        period_name = {5: "1w", 10: "2w", 21: "1m", 63: "3m", 126: "6m", 252: "12m"}.get(days, f"{days}d")
        df[f"return_{period_name}"] = close.pct_change(days) * 100

    # ── Trend Signals ─────────────────────────────────────────────────────────
    df["golden_cross"]   = ((df["sma_50"] > df["sma_200"]) & (df["sma_50"].shift(1) <= df["sma_200"].shift(1))).astype(int)
    df["death_cross"]    = ((df["sma_50"] < df["sma_200"]) & (df["sma_50"].shift(1) >= df["sma_200"].shift(1))).astype(int)
    df["above_50_200"]   = ((close > df["sma_50"]) & (close > df["sma_200"])).astype(int)
    df["price_52w_high"] = close / close.rolling(252).max() * 100
    df["price_52w_low"]  = close / close.rolling(252).min() * 100

    # ── Squeeze (Bollinger inside Keltner) ────────────────────────────────────
    atr_kelt = df["atr_14"] * 1.5
    kelt_up  = df["ema_20"] + atr_kelt if "ema_20" in df.columns else close + atr_kelt
    kelt_lo  = df["ema_20"] - atr_kelt if "ema_20" in df.columns else close - atr_kelt
    df["bb_squeeze"] = ((df["bb_upper_20"] < kelt_up) & (df["bb_lower_20"] > kelt_lo)).astype(int)

    # ── Relative Strength Rank (price performance vs universe) ────────────────
    # Placeholder — populated during universe computation
    df["rs_rank"] = 50.0

    return df


def compute_rs_ranks(universe_df: pd.DataFrame, return_col: str = "return_3m") -> pd.Series:
    """
    Compute Relative Strength rank (0-100 percentile) for each symbol
    in the universe based on a return column.
    """
    rets = universe_df[return_col].dropna()
    if len(rets) == 0:
        return pd.Series(50.0, index=universe_df.index)
    ranks = rets.rank(pct=True) * 100
    return ranks.reindex(universe_df.index).fillna(50.0)


# ─── COMPOSITE SCORING ───────────────────────────────────────────────────────

def compute_technical_score(df: pd.DataFrame) -> pd.Series:
    """
    Compute a 0-100 technical score per row.
    Combines RSI position, trend alignment, momentum, volume confirmation.
    """
    score = pd.Series(0.0, index=df.index)
    count = 0

    def add_component(col: str, weight: float, func: Callable) -> None:
        nonlocal score, count
        if col in df.columns:
            val = func(df[col])
            score += val * weight
            count += weight

    # RSI 40-60 range gets higher weight (trending but not overbought)
    if "rsi_14" in df.columns:
        rsi = df["rsi_14"]
        s = pd.Series(0.0, index=df.index)
        s[rsi.between(50, 70)] = 1.0
        s[rsi.between(40, 50)] = 0.5
        s[rsi.between(70, 80)] = 0.5
        score += s * 20
        count += 20

    # MACD above signal line
    if "macd_above_signal" in df.columns:
        score += df["macd_above_signal"].fillna(0) * 15
        count += 15

    # Price above 50 SMA and 200 SMA
    if "above_50_200" in df.columns:
        score += df["above_50_200"].fillna(0) * 20
        count += 20

    # ADX trending
    if "adx_14" in df.columns:
        adx_score = (df["adx_14"].clip(0, 50) / 50).fillna(0)
        score += adx_score * 15
        count += 15

    # Relative volume
    if "relative_volume" in df.columns:
        rvol_score = (df["relative_volume"].clip(0, 3) / 3).fillna(0)
        score += rvol_score * 10
        count += 10

    # 3-month momentum
    if "return_3m" in df.columns:
        ret_score = ((df["return_3m"].clip(-30, 30) + 30) / 60).fillna(0.5)
        score += ret_score * 15
        count += 15

    # OBV trend
    if "obv_trend" in df.columns:
        score += df["obv_trend"].fillna(0) * 5
        count += 5

    return (score / count * 100).clip(0, 100) if count > 0 else pd.Series(50.0, index=df.index)


def compute_momentum_score(df: pd.DataFrame) -> pd.Series:
    """
    Compute a 0-100 momentum score using 1M, 3M, 6M, 12M return ranks.
    """
    weights      = {"return_1m": 0.10, "return_3m": 0.20, "return_6m": 0.30, "return_12m": 0.40}
    score        = pd.Series(0.0, index=df.index)
    total_weight = 0.0

    for col, w in weights.items():
        if col in df.columns:
            ranked = df[col].rank(pct=True, ascending=True) * 100
            score += ranked.fillna(50) * w
            total_weight += w

    return (score / total_weight).clip(0, 100) if total_weight > 0 else pd.Series(50.0, index=df.index)


def compute_fundamental_score(df: pd.DataFrame) -> pd.Series:
    """
    Weighted fundamental quality score (0-100).
    Needs fundamental columns in df (pe_ratio, roe, etc.)
    """
    score        = pd.Series(0.0, index=df.index)
    total_weight = 0.0

    components = [
        # (column, weight, prefer_low: True=lower is better, bounds)
        ("roe",               20, False, (0, 50)),    # Higher ROE better
        ("roa",               15, False, (0, 30)),
        ("gross_margin",      15, False, (0, 100)),
        ("pe_ratio",          15, True,  (0, 60)),    # Lower P/E better
        ("debt_equity",       10, True,  (0, 3)),     # Lower D/E better
        ("revenue_growth_yoy",15, False, (-20, 40)),
        ("current_ratio",     10, False, (0, 5)),
    ]

    for col, weight, prefer_low, (lo, hi) in components:
        if col not in df.columns:
            continue
        vals = df[col].clip(lo, hi)
        normalized = (vals - lo) / (hi - lo + 1e-10)
        if prefer_low:
            normalized = 1 - normalized
        score += normalized.fillna(0.5) * weight
        total_weight += weight

    return (score / total_weight * 100).clip(0, 100) if total_weight > 0 else pd.Series(50.0, index=df.index)


def compute_composite_score(
    df: pd.DataFrame,
    tech_weight:     float = 0.40,
    momentum_weight: float = 0.30,
    fundamental_weight: float = 0.30,
) -> pd.Series:
    """
    Compute a final composite score (0-100) from sub-scores.
    """
    tech_score  = compute_technical_score(df)
    mom_score   = compute_momentum_score(df)
    fund_score  = compute_fundamental_score(df)

    composite = (
        tech_score  * tech_weight +
        mom_score   * momentum_weight +
        fund_score  * fundamental_weight
    )
    return composite.clip(0, 100)


# ─── SCREENER ENGINE ─────────────────────────────────────────────────────────

class ScreenerEngine:
    """
    Main screening engine.
    
    Usage:
        # For a single symbol with OHLCV DataFrame:
        engine = ScreenerEngine()
        
        # For a universe:
        engine = ScreenerEngine()
        result = engine.screen(universe_data_df, criteria_list)
    """

    def __init__(
        self,
        compute_indicators: bool = True,
        tech_weight:        float = 0.40,
        momentum_weight:    float = 0.30,
        fundamental_weight: float = 0.30,
    ):
        self.compute_indicators  = compute_indicators
        self.tech_weight         = tech_weight
        self.momentum_weight     = momentum_weight
        self.fundamental_weight  = fundamental_weight

    def screen(
        self,
        df: pd.DataFrame,
        criteria: List[Criterion],
        sort_by:  str = "composite_score",
        ascending: bool = False,
        max_results: int = 100,
    ) -> pd.DataFrame:
        """
        Screen the universe DataFrame against all criteria.

        Args:
            df:          Universe DataFrame (one row per symbol, with indicator columns)
            criteria:    List of Criterion objects
            sort_by:     Column to sort results by
            ascending:   Sort direction
            max_results: Maximum number of results to return

        Returns:
            Filtered, scored, and sorted DataFrame
        """
        result = df.copy()

        # Compute composite scores
        result["tech_score"]        = compute_technical_score(result)
        result["momentum_score"]    = compute_momentum_score(result)
        result["fundamental_score"] = compute_fundamental_score(result)
        result["composite_score"]   = compute_composite_score(
            result, self.tech_weight, self.momentum_weight, self.fundamental_weight
        )
        result["rs_rank"] = compute_rs_ranks(result, "return_3m")

        # Apply each criterion and track pass/fail
        combined_mask = pd.Series(True, index=result.index)
        for criterion in criteria:
            col = criterion.column
            if col not in result.columns:
                continue  # Skip missing columns gracefully
            mask = criterion.apply(result[col])
            result[f"pass_{criterion.name}"] = mask.astype(int)
            combined_mask &= mask

        # Flag passed criteria count
        pass_cols = [c for c in result.columns if c.startswith("pass_")]
        result["criteria_passed"] = result[pass_cols].sum(axis=1)
        result["criteria_total"]  = len(criteria)

        # Apply combined filter
        filtered = result[combined_mask].copy()

        # Sort
        if sort_by in filtered.columns:
            filtered = filtered.sort_values(sort_by, ascending=ascending)

        return filtered.head(max_results)

    def screen_snapshot(
        self,
        symbol_data: Dict[str, pd.DataFrame],
        criteria: List[Criterion],
        sort_by: str = "composite_score",
        ascending: bool = False,
        max_results: int = 100,
    ) -> pd.DataFrame:
        """
        Screen from per-symbol OHLCV DataFrames.
        Computes technical indicators for each symbol and takes the last row snapshot.

        Args:
            symbol_data: Dict mapping symbol -> OHLCV DataFrame (sorted by date ascending)
            criteria:    List of Criterion objects

        Returns:
            Screener results DataFrame (one row per symbol)
        """
        rows = []
        for symbol, ohlcv in symbol_data.items():
            if len(ohlcv) < 30:
                continue
            try:
                enriched = compute_technical_columns(ohlcv)
                last_row = enriched.iloc[-1].copy()
                last_row["symbol"] = symbol
                rows.append(last_row)
            except Exception:
                continue

        if not rows:
            return pd.DataFrame()

        universe_df = pd.DataFrame(rows).set_index("symbol")
        return self.screen(universe_df, criteria, sort_by, ascending, max_results)


# ─── FILTER BUILDERS (convenience wrappers) ──────────────────────────────────

def rsi_filter(low: float = 0, high: float = 100, period: int = 14) -> Criterion:
    return Criterion(f"rsi_{low}_{high}", f"rsi_{period}",
                     CriterionType.NUMERIC_RANGE, min_val=low, max_val=high)


def sma_cross_up_filter(fast: int = 50, slow: int = 200) -> Criterion:
    """Price above fast SMA which is above slow SMA."""
    return Criterion(f"sma_{fast}_{slow}_cross",  f"distance_{fast}sma",
                     CriterionType.NUMERIC_MIN, min_val=0)


def adx_filter(min_adx: float = 25) -> Criterion:
    return Criterion(f"adx_min_{min_adx}", "adx_14",
                     CriterionType.NUMERIC_MIN, min_val=min_adx)


def volume_filter(min_avg_volume: int = 500_000) -> Criterion:
    return Criterion(f"avg_vol_min", "avg_volume_30d",
                     CriterionType.NUMERIC_MIN, min_val=float(min_avg_volume))


def relative_volume_filter(min_rvol: float = 1.5) -> Criterion:
    return Criterion(f"rvol_min_{min_rvol}", "relative_volume",
                     CriterionType.NUMERIC_MIN, min_val=min_rvol)


def market_cap_filter(min_cap: float = 1e9, max_cap: float = float("inf")) -> Criterion:
    return Criterion("market_cap", "market_cap",
                     CriterionType.NUMERIC_RANGE, min_val=min_cap,
                     max_val=max_cap if max_cap != float("inf") else None)


def sector_filter(sectors: List[str]) -> Criterion:
    return Criterion("sector", "sector",
                     CriterionType.STRING_MATCH, str_values=sectors)


def pe_filter(max_pe: float = 25) -> Criterion:
    return Criterion(f"pe_max_{max_pe}", "pe_ratio",
                     CriterionType.NUMERIC_MAX, max_val=max_pe)


def roe_filter(min_roe: float = 15) -> Criterion:
    return Criterion(f"roe_min_{min_roe}", "roe",
                     CriterionType.NUMERIC_MIN, min_val=min_roe)


def momentum_filter(min_return_3m: float = 5.0) -> Criterion:
    return Criterion("3m_return", "return_3m",
                     CriterionType.NUMERIC_MIN, min_val=min_return_3m)


def near_52w_high_filter(min_pct: float = 90.0) -> Criterion:
    """Price at least X% of its 52-week high."""
    return Criterion("near_52w_high", "price_52w_high",
                     CriterionType.NUMERIC_MIN, min_val=min_pct)


def above_200sma_filter() -> Criterion:
    return Criterion("above_200sma", "distance_200sma",
                     CriterionType.NUMERIC_MIN, min_val=0.0)


def golden_cross_filter() -> Criterion:
    return Criterion("golden_cross", "golden_cross",
                     CriterionType.BOOLEAN, bool_value=True)


def bb_squeeze_filter() -> Criterion:
    return Criterion("bb_squeeze", "bb_squeeze",
                     CriterionType.BOOLEAN, bool_value=True)


# ─── UNIVERSE DEFINITIONS ────────────────────────────────────────────────────

SP500_SECTORS = [
    "Technology", "Healthcare", "Financials", "Consumer Discretionary",
    "Industrials", "Communication Services", "Consumer Staples",
    "Energy", "Utilities", "Real Estate", "Materials"
]


def build_screening_result_summary(result: pd.DataFrame) -> Dict:
    """
    Build a summary dict from screener results for API response or display.
    """
    if result.empty:
        return {"total": 0, "symbols": [], "sector_breakdown": {}}

    numeric_cols = result.select_dtypes(include=[np.number]).columns
    sector_col   = "sector" if "sector" in result.columns else None

    summary = {
        "total": len(result),
        "symbols": result.index.tolist() if result.index.name == "symbol" else [],
        "top_10": result.head(10).to_dict(orient="index"),
        "score_stats": {
            "composite_mean": float(result["composite_score"].mean()) if "composite_score" in result.columns else 0,
            "composite_max":  float(result["composite_score"].max())  if "composite_score" in result.columns else 0,
            "composite_min":  float(result["composite_score"].min())  if "composite_score" in result.columns else 0,
        }
    }

    if sector_col:
        summary["sector_breakdown"] = result[sector_col].value_counts().to_dict()

    return summary


# ─── ALERT ENGINE (real-time screening triggers) ─────────────────────────────

@dataclass
class Alert:
    """A price or indicator alert condition."""
    symbol:       str
    name:         str
    column:       str
    condition:    str   # "above", "below", "crosses_above", "crosses_below"
    threshold:    float
    active:       bool = True
    triggered_at: Optional[pd.Timestamp] = None
    notify_once:  bool = True
    prev_value:   Optional[float] = None


class AlertEngine:
    """
    Real-time alert system for screening conditions.
    Pass new bar data to check() to see which alerts trigger.
    """

    def __init__(self):
        self.alerts: Dict[str, Alert] = {}

    def add_alert(self, alert: Alert) -> None:
        key = f"{alert.symbol}_{alert.name}"
        self.alerts[key] = alert

    def remove_alert(self, symbol: str, name: str) -> None:
        key = f"{symbol}_{name}"
        self.alerts.pop(key, None)

    def check(self, symbol: str, bar: pd.Series) -> List[Alert]:
        """Check all alerts for a symbol against the latest bar. Returns triggered alerts."""
        triggered = []
        for key, alert in list(self.alerts.items()):
            if not alert.active or alert.symbol != symbol:
                continue
            if alert.column not in bar.index:
                continue

            current = bar[alert.column]
            if pd.isna(current):
                continue

            fired = False
            if alert.condition == "above" and current > alert.threshold:
                fired = True
            elif alert.condition == "below" and current < alert.threshold:
                fired = True
            elif alert.condition == "crosses_above":
                if alert.prev_value is not None and alert.prev_value <= alert.threshold < current:
                    fired = True
            elif alert.condition == "crosses_below":
                if alert.prev_value is not None and alert.prev_value >= alert.threshold > current:
                    fired = True

            if fired:
                alert.triggered_at = bar.name if isinstance(bar.name, pd.Timestamp) else pd.Timestamp.now()
                triggered.append(alert)
                if alert.notify_once:
                    alert.active = False

            alert.prev_value = float(current)

        return triggered

    def check_universe(self, universe_df: pd.DataFrame) -> List[Alert]:
        """Check all alerts against a universe snapshot DataFrame."""
        triggered = []
        for symbol in universe_df.index:
            row = universe_df.loc[symbol]
            triggered.extend(self.check(symbol, row))
        return triggered


# ─── RANKING SYSTEMS ─────────────────────────────────────────────────────────

def rank_universe(
    df: pd.DataFrame,
    factors: Optional[Dict[str, Dict]] = None
) -> pd.DataFrame:
    """
    Multi-factor ranking system.
    
    Args:
        df: Universe DataFrame with factor columns
        factors: Dict of {column: {"weight": float, "ascending": bool}}
                 ascending=True means lower value = better rank
    
    Returns:
        DataFrame with added rank columns and composite_rank
    """
    if factors is None:
        factors = {
            "return_3m":      {"weight": 0.20, "ascending": False},
            "return_6m":      {"weight": 0.20, "ascending": False},
            "rsi_14":         {"weight": 0.10, "ascending": False},
            "adx_14":         {"weight": 0.10, "ascending": False},
            "relative_volume":{"weight": 0.10, "ascending": False},
            "roe":            {"weight": 0.15, "ascending": False},
            "pe_ratio":       {"weight": 0.15, "ascending": True},
        }

    df = df.copy()
    total_weight = 0.0
    composite_rank = pd.Series(0.0, index=df.index)

    for col, spec in factors.items():
        if col not in df.columns:
            continue
        weight    = spec.get("weight", 1.0)
        ascending = spec.get("ascending", False)
        rank      = df[col].rank(pct=True, ascending=ascending, na_option="bottom") * 100
        df[f"rank_{col}"] = rank
        composite_rank += rank * weight
        total_weight   += weight

    if total_weight > 0:
        df["composite_rank"] = (composite_rank / total_weight).clip(0, 100)
    else:
        df["composite_rank"] = 50.0

    return df.sort_values("composite_rank", ascending=False)


def piotroski_f_score(df: pd.DataFrame) -> pd.Series:
    """
    Piotroski F-Score (0-9) for financial health.
    Requires fundamental columns.
    """
    score = pd.Series(0, index=df.index)

    # Profitability criteria
    if "roa" in df.columns:
        score += (df["roa"] > 0).astype(int)
    if "operating_cash_flow" in df.columns:
        score += (df["operating_cash_flow"] > 0).astype(int)
    if "roa_change" in df.columns:
        score += (df["roa_change"] > 0).astype(int)
    if "accruals" in df.columns:  # CFO/Assets > ROA
        score += (df["accruals"] > 0).astype(int)

    # Leverage criteria
    if "debt_equity_change" in df.columns:
        score += (df["debt_equity_change"] < 0).astype(int)  # Leverage decreased
    if "current_ratio_change" in df.columns:
        score += (df["current_ratio_change"] > 0).astype(int)
    if "shares_issued" in df.columns:
        score += (df["shares_issued"] <= 0).astype(int)  # No new shares

    # Operating efficiency
    if "gross_margin_change" in df.columns:
        score += (df["gross_margin_change"] > 0).astype(int)
    if "asset_turnover_change" in df.columns:
        score += (df["asset_turnover_change"] > 0).astype(int)

    return score.clip(0, 9)


def altman_z_score(df: pd.DataFrame) -> pd.Series:
    """
    Altman Z-Score (bankruptcy risk indicator).
    Z > 2.99: Safe Zone
    1.81 < Z < 2.99: Grey Zone
    Z < 1.81: Distress Zone
    
    Requires: working_capital, total_assets, retained_earnings,
              ebit, market_cap, total_liabilities, revenue
    """
    score = pd.Series(float("nan"), index=df.index)
    required = ["working_capital", "total_assets", "retained_earnings",
                "ebit", "market_cap", "total_liabilities", "revenue"]

    missing = [c for c in required if c not in df.columns]
    if missing:
        return score  # Cannot compute without required columns

    ta = df["total_assets"].replace(0, float("nan"))
    tl = df["total_liabilities"].replace(0, float("nan"))

    x1 = df["working_capital"] / ta
    x2 = df["retained_earnings"] / ta
    x3 = df["ebit"] / ta
    x4 = df["market_cap"] / tl
    x5 = df["revenue"] / ta

    score = 1.2 * x1 + 1.4 * x2 + 3.3 * x3 + 0.6 * x4 + 1.0 * x5
    return score


# ─── EXPORT UTILITIES ────────────────────────────────────────────────────────

def screener_to_dict(result: pd.DataFrame, max_rows: int = 200) -> List[Dict]:
    """
    Convert screener results to list of dicts for JSON serialisation.
    Replaces NaN with None for JSON compatibility.
    """
    subset = result.head(max_rows).copy()
    # Flatten the index if it's the symbol
    if subset.index.name == "symbol":
        subset = subset.reset_index()

    records = subset.to_dict(orient="records")
    # Replace NaN/inf with None
    for rec in records:
        for k, v in rec.items():
            if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
                rec[k] = None
    return records


def screener_to_csv(result: pd.DataFrame, filepath: str) -> None:
    """Export screener results to CSV."""
    result.to_csv(filepath, index=True)


# ─── QUICK-SCREEN API ─────────────────────────────────────────────────────────

def quick_screen(
    symbol_data: Dict[str, pd.DataFrame],
    preset: str = "momentum",
    max_results: int = 50,
) -> pd.DataFrame:
    """
    Quick-screening API with preset strategies.

    Args:
        symbol_data: Dict[str, pd.DataFrame] — maps symbol to OHLCV df
        preset: "momentum" | "value" | "growth" | "mean_reversion" | "quality"
        max_results: Max number of results

    Returns:
        Screener results DataFrame
    """
    preset_map = {
        "momentum":    momentum_screener,
        "value":       value_screener,
        "growth":      growth_screener,
        "mean_reversion": mean_reversion_screener,
        "quality":     quality_screener,
    }

    criteria_fn = preset_map.get(preset, momentum_screener)
    criteria    = criteria_fn()
    engine      = ScreenerEngine()

    return engine.screen_snapshot(symbol_data, criteria, max_results=max_results)
