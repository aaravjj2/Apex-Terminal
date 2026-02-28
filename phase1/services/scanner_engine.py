"""
scanner_engine.py — Bloomberg-grade Stock Scanner / Screener Engine
===================================================================
Pure computation engine — no FastAPI imports.

Components:
    FilterOperator       — Enum for comparison operators
    ScanFilter           — Individual filter criterion
    ScanResult           — Single matching symbol with scores
    TechnicalScanner     — Price/volume/indicator-based scans
    FundamentalScanner   — P/E, EPS, dividend, market cap filters
    PatternScanner       — Candlestick & chart pattern detection
    VolumeScanner        — Volume anomaly & profile scans
    MomentumScanner      — RSI, MACD, momentum divergence scans
    CompositeScanner     — Combine multiple scan criteria
    PredefinedScans      — Library of 30+ preset scans
    ScannerEngine        — Unified orchestrator
"""

from __future__ import annotations
import math
import numpy as np
from typing import Any, Callable, Dict, List, Optional, Tuple
from dataclasses import dataclass, field
from enum import Enum


# ─── Enums & DataClasses ────────────────────────────────────────────────────

class FilterOperator(Enum):
    GT = ">"
    GTE = ">="
    LT = "<"
    LTE = "<="
    EQ = "=="
    NEQ = "!="
    BETWEEN = "between"
    CROSSES_ABOVE = "crosses_above"
    CROSSES_BELOW = "crosses_below"


class TimeFrame(Enum):
    M1 = "1m"
    M5 = "5m"
    M15 = "15m"
    M30 = "30m"
    H1 = "1h"
    H4 = "4h"
    D1 = "1d"
    W1 = "1w"
    MN1 = "1M"


@dataclass
class ScanFilter:
    field: str
    operator: FilterOperator
    value: Any
    secondary_value: Any = None  # for BETWEEN

    def evaluate(self, data: Dict[str, Any]) -> bool:
        actual = data.get(self.field)
        if actual is None:
            return False
        op = self.operator
        if op == FilterOperator.GT:
            return actual > self.value
        elif op == FilterOperator.GTE:
            return actual >= self.value
        elif op == FilterOperator.LT:
            return actual < self.value
        elif op == FilterOperator.LTE:
            return actual <= self.value
        elif op == FilterOperator.EQ:
            return actual == self.value
        elif op == FilterOperator.NEQ:
            return actual != self.value
        elif op == FilterOperator.BETWEEN:
            if self.secondary_value is None:
                return False
            return self.value <= actual <= self.secondary_value
        return False


@dataclass
class ScanResult:
    symbol: str
    score: float = 0.0
    data: Dict[str, Any] = field(default_factory=dict)
    signals: List[str] = field(default_factory=list)
    rank: int = 0


@dataclass
class SymbolData:
    """Container for all data about a symbol for scanning."""
    symbol: str
    close: np.ndarray         # price history
    high: np.ndarray = field(default_factory=lambda: np.array([]))
    low: np.ndarray = field(default_factory=lambda: np.array([]))
    open: np.ndarray = field(default_factory=lambda: np.array([]))
    volume: np.ndarray = field(default_factory=lambda: np.array([]))
    fundamentals: Dict[str, Any] = field(default_factory=dict)
    metadata: Dict[str, Any] = field(default_factory=dict)


# ═══════════════════════════════════════════════════════════════════════════════
# 1. TechnicalScanner — Price & indicator-based scans
# ═══════════════════════════════════════════════════════════════════════════════

class TechnicalScanner:
    """Technical analysis-based stock scanning."""

    @staticmethod
    def sma(data: np.ndarray, period: int) -> np.ndarray:
        if len(data) < period:
            return np.full(len(data), np.nan)
        result = np.convolve(data, np.ones(period) / period, mode='valid')
        return np.concatenate([np.full(period - 1, np.nan), result])

    @staticmethod
    def ema(data: np.ndarray, period: int) -> np.ndarray:
        if len(data) == 0:
            return np.array([])
        alpha = 2.0 / (period + 1)
        result = np.empty_like(data, dtype=float)
        result[0] = data[0]
        for i in range(1, len(data)):
            result[i] = alpha * data[i] + (1 - alpha) * result[i - 1]
        return result

    @staticmethod
    def rsi(data: np.ndarray, period: int = 14) -> np.ndarray:
        if len(data) < period + 1:
            return np.full(len(data), np.nan)
        deltas = np.diff(data)
        gains = np.where(deltas > 0, deltas, 0.0)
        losses = np.where(deltas < 0, -deltas, 0.0)
        result = np.full(len(data), np.nan)
        avg_gain = np.mean(gains[:period])
        avg_loss = np.mean(losses[:period])
        if avg_loss == 0:
            result[period] = 100.0
        else:
            result[period] = 100.0 - 100.0 / (1.0 + avg_gain / avg_loss)
        for i in range(period, len(deltas)):
            avg_gain = (avg_gain * (period - 1) + gains[i]) / period
            avg_loss = (avg_loss * (period - 1) + losses[i]) / period
            if avg_loss == 0:
                result[i + 1] = 100.0
            else:
                result[i + 1] = 100.0 - 100.0 / (1.0 + avg_gain / avg_loss)
        return result

    @staticmethod
    def macd(data: np.ndarray, fast: int = 12, slow: int = 26, signal: int = 9) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        ema_fast = TechnicalScanner.ema(data, fast)
        ema_slow = TechnicalScanner.ema(data, slow)
        macd_line = ema_fast - ema_slow
        signal_line = TechnicalScanner.ema(macd_line, signal)
        histogram = macd_line - signal_line
        return macd_line, signal_line, histogram

    @staticmethod
    def bollinger_bands(data: np.ndarray, period: int = 20, num_std: float = 2.0) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        sma = TechnicalScanner.sma(data, period)
        std = np.full(len(data), np.nan)
        for i in range(period - 1, len(data)):
            std[i] = np.std(data[i - period + 1:i + 1])
        upper = sma + num_std * std
        lower = sma - num_std * std
        return upper, sma, lower

    @staticmethod
    def atr(high: np.ndarray, low: np.ndarray, close: np.ndarray, period: int = 14) -> np.ndarray:
        if len(high) < 2:
            return np.full(len(high), np.nan)
        tr = np.maximum(
            high[1:] - low[1:],
            np.maximum(np.abs(high[1:] - close[:-1]), np.abs(low[1:] - close[:-1]))
        )
        tr = np.concatenate([[high[0] - low[0]], tr])
        result = np.full(len(tr), np.nan)
        result[period - 1] = np.mean(tr[:period])
        for i in range(period, len(tr)):
            result[i] = (result[i - 1] * (period - 1) + tr[i]) / period
        return result

    @staticmethod
    def scan_golden_cross(symbols: List[SymbolData], fast: int = 50, slow: int = 200) -> List[ScanResult]:
        """Detect 50/200 SMA golden cross."""
        results = []
        for sym in symbols:
            if len(sym.close) < slow + 1:
                continue
            sma_fast = TechnicalScanner.sma(sym.close, fast)
            sma_slow = TechnicalScanner.sma(sym.close, slow)
            # Cross happened when fast crosses above slow
            if (sma_fast[-2] <= sma_slow[-2] and sma_fast[-1] > sma_slow[-1]):
                results.append(ScanResult(
                    symbol=sym.symbol,
                    score=1.0,
                    data={"sma_fast": float(sma_fast[-1]), "sma_slow": float(sma_slow[-1])},
                    signals=["Golden Cross (SMA crossover)"],
                ))
        return results

    @staticmethod
    def scan_death_cross(symbols: List[SymbolData], fast: int = 50, slow: int = 200) -> List[ScanResult]:
        """Detect 50/200 SMA death cross."""
        results = []
        for sym in symbols:
            if len(sym.close) < slow + 1:
                continue
            sma_fast = TechnicalScanner.sma(sym.close, fast)
            sma_slow = TechnicalScanner.sma(sym.close, slow)
            if (sma_fast[-2] >= sma_slow[-2] and sma_fast[-1] < sma_slow[-1]):
                results.append(ScanResult(
                    symbol=sym.symbol, score=-1.0,
                    data={"sma_fast": float(sma_fast[-1]), "sma_slow": float(sma_slow[-1])},
                    signals=["Death Cross (SMA crossover)"],
                ))
        return results

    @staticmethod
    def scan_rsi_oversold(symbols: List[SymbolData], threshold: float = 30.0) -> List[ScanResult]:
        results = []
        for sym in symbols:
            rsi_vals = TechnicalScanner.rsi(sym.close)
            if np.isnan(rsi_vals[-1]):
                continue
            if rsi_vals[-1] < threshold:
                results.append(ScanResult(
                    symbol=sym.symbol, score=threshold - rsi_vals[-1],
                    data={"rsi": float(rsi_vals[-1])},
                    signals=[f"RSI oversold ({rsi_vals[-1]:.1f})"],
                ))
        return results

    @staticmethod
    def scan_rsi_overbought(symbols: List[SymbolData], threshold: float = 70.0) -> List[ScanResult]:
        results = []
        for sym in symbols:
            rsi_vals = TechnicalScanner.rsi(sym.close)
            if np.isnan(rsi_vals[-1]):
                continue
            if rsi_vals[-1] > threshold:
                results.append(ScanResult(
                    symbol=sym.symbol, score=rsi_vals[-1] - threshold,
                    data={"rsi": float(rsi_vals[-1])},
                    signals=[f"RSI overbought ({rsi_vals[-1]:.1f})"],
                ))
        return results

    @staticmethod
    def scan_macd_cross_up(symbols: List[SymbolData]) -> List[ScanResult]:
        results = []
        for sym in symbols:
            if len(sym.close) < 27:
                continue
            macd_line, signal_line, _ = TechnicalScanner.macd(sym.close)
            if macd_line[-2] <= signal_line[-2] and macd_line[-1] > signal_line[-1]:
                results.append(ScanResult(
                    symbol=sym.symbol, score=1.0,
                    data={"macd": float(macd_line[-1]), "signal": float(signal_line[-1])},
                    signals=["MACD bullish crossover"],
                ))
        return results

    @staticmethod
    def scan_macd_cross_down(symbols: List[SymbolData]) -> List[ScanResult]:
        results = []
        for sym in symbols:
            if len(sym.close) < 27:
                continue
            macd_line, signal_line, _ = TechnicalScanner.macd(sym.close)
            if macd_line[-2] >= signal_line[-2] and macd_line[-1] < signal_line[-1]:
                results.append(ScanResult(
                    symbol=sym.symbol, score=-1.0,
                    data={"macd": float(macd_line[-1]), "signal": float(signal_line[-1])},
                    signals=["MACD bearish crossover"],
                ))
        return results

    @staticmethod
    def scan_bollinger_squeeze(symbols: List[SymbolData], squeeze_pct: float = 0.04) -> List[ScanResult]:
        """Bollinger Bands squeeze — bandwidth below threshold."""
        results = []
        for sym in symbols:
            if len(sym.close) < 21:
                continue
            upper, mid, lower = TechnicalScanner.bollinger_bands(sym.close)
            if np.isnan(mid[-1]):
                continue
            bandwidth = (upper[-1] - lower[-1]) / mid[-1]
            if bandwidth < squeeze_pct:
                results.append(ScanResult(
                    symbol=sym.symbol, score=squeeze_pct - bandwidth,
                    data={"bandwidth": float(bandwidth), "upper": float(upper[-1]),
                           "lower": float(lower[-1])},
                    signals=[f"Bollinger squeeze ({bandwidth:.4f})"],
                ))
        return results

    @staticmethod
    def scan_above_sma(symbols: List[SymbolData], period: int = 200) -> List[ScanResult]:
        """Price above N-period SMA."""
        results = []
        for sym in symbols:
            if len(sym.close) < period:
                continue
            sma_val = TechnicalScanner.sma(sym.close, period)
            if np.isnan(sma_val[-1]):
                continue
            if sym.close[-1] > sma_val[-1]:
                pct_above = (sym.close[-1] - sma_val[-1]) / sma_val[-1] * 100
                results.append(ScanResult(
                    symbol=sym.symbol, score=pct_above,
                    data={"price": float(sym.close[-1]), "sma": float(sma_val[-1]),
                           "pct_above": float(pct_above)},
                    signals=[f"Price {pct_above:.1f}% above SMA{period}"],
                ))
        return results

    @staticmethod
    def scan_new_high(symbols: List[SymbolData], lookback: int = 252) -> List[ScanResult]:
        """52-week (or N-period) new high."""
        results = []
        for sym in symbols:
            if len(sym.close) < lookback:
                continue
            window = sym.close[-lookback:]
            if sym.close[-1] >= np.max(window):
                results.append(ScanResult(
                    symbol=sym.symbol, score=1.0,
                    data={"price": float(sym.close[-1]),
                           "prev_high": float(np.max(window[:-1]))},
                    signals=[f"{lookback}-period new high"],
                ))
        return results

    @staticmethod
    def scan_new_low(symbols: List[SymbolData], lookback: int = 252) -> List[ScanResult]:
        results = []
        for sym in symbols:
            if len(sym.close) < lookback:
                continue
            window = sym.close[-lookback:]
            if sym.close[-1] <= np.min(window):
                results.append(ScanResult(
                    symbol=sym.symbol, score=-1.0,
                    data={"price": float(sym.close[-1]),
                           "prev_low": float(np.min(window[:-1]))},
                    signals=[f"{lookback}-period new low"],
                ))
        return results


# ═══════════════════════════════════════════════════════════════════════════════
# 2. FundamentalScanner — Financial metric filters
# ═══════════════════════════════════════════════════════════════════════════════

class FundamentalScanner:
    """Fundamental analysis-based scanning."""

    @staticmethod
    def scan_pe_ratio(symbols: List[SymbolData], min_pe: float = 0.0,
                      max_pe: float = 25.0) -> List[ScanResult]:
        results = []
        for sym in symbols:
            pe = sym.fundamentals.get("pe_ratio")
            if pe is None:
                continue
            if min_pe <= pe <= max_pe:
                results.append(ScanResult(
                    symbol=sym.symbol, score=max_pe - pe,
                    data={"pe_ratio": pe},
                    signals=[f"P/E ratio: {pe:.1f}"],
                ))
        return results

    @staticmethod
    def scan_dividend_yield(symbols: List[SymbolData],
                            min_yield: float = 2.0) -> List[ScanResult]:
        results = []
        for sym in symbols:
            div_yield = sym.fundamentals.get("dividend_yield", 0.0)
            if div_yield >= min_yield:
                results.append(ScanResult(
                    symbol=sym.symbol, score=div_yield,
                    data={"dividend_yield": div_yield},
                    signals=[f"Dividend yield: {div_yield:.2f}%"],
                ))
        return results

    @staticmethod
    def scan_market_cap(symbols: List[SymbolData],
                        min_cap: float = 0, max_cap: float = float("inf")) -> List[ScanResult]:
        results = []
        for sym in symbols:
            cap = sym.fundamentals.get("market_cap", 0)
            if min_cap <= cap <= max_cap:
                results.append(ScanResult(
                    symbol=sym.symbol, score=float(cap),
                    data={"market_cap": cap},
                    signals=[f"Market cap: ${cap:,.0f}"],
                ))
        return results

    @staticmethod
    def scan_revenue_growth(symbols: List[SymbolData],
                            min_growth: float = 10.0) -> List[ScanResult]:
        results = []
        for sym in symbols:
            growth = sym.fundamentals.get("revenue_growth", 0.0)
            if growth >= min_growth:
                results.append(ScanResult(
                    symbol=sym.symbol, score=growth,
                    data={"revenue_growth": growth},
                    signals=[f"Revenue growth: {growth:.1f}%"],
                ))
        return results

    @staticmethod
    def scan_eps_growth(symbols: List[SymbolData], min_growth: float = 15.0) -> List[ScanResult]:
        results = []
        for sym in symbols:
            growth = sym.fundamentals.get("eps_growth", 0.0)
            if growth >= min_growth:
                results.append(ScanResult(
                    symbol=sym.symbol, score=growth,
                    data={"eps_growth": growth},
                    signals=[f"EPS growth: {growth:.1f}%"],
                ))
        return results

    @staticmethod
    def scan_debt_to_equity(symbols: List[SymbolData], max_ratio: float = 0.5) -> List[ScanResult]:
        results = []
        for sym in symbols:
            de = sym.fundamentals.get("debt_to_equity", float("inf"))
            if de <= max_ratio:
                results.append(ScanResult(
                    symbol=sym.symbol, score=max_ratio - de,
                    data={"debt_to_equity": de},
                    signals=[f"D/E ratio: {de:.2f}"],
                ))
        return results

    @staticmethod
    def scan_roe(symbols: List[SymbolData], min_roe: float = 15.0) -> List[ScanResult]:
        results = []
        for sym in symbols:
            roe = sym.fundamentals.get("roe", 0.0)
            if roe >= min_roe:
                results.append(ScanResult(
                    symbol=sym.symbol, score=roe,
                    data={"roe": roe},
                    signals=[f"ROE: {roe:.1f}%"],
                ))
        return results

    @staticmethod
    def scan_price_to_book(symbols: List[SymbolData], max_pb: float = 3.0) -> List[ScanResult]:
        results = []
        for sym in symbols:
            pb = sym.fundamentals.get("price_to_book")
            if pb is not None and pb <= max_pb:
                results.append(ScanResult(
                    symbol=sym.symbol, score=max_pb - pb,
                    data={"price_to_book": pb},
                    signals=[f"P/B ratio: {pb:.2f}"],
                ))
        return results


# ═══════════════════════════════════════════════════════════════════════════════
# 3. VolumeScanner — Volume anomaly detection
# ═══════════════════════════════════════════════════════════════════════════════

class VolumeScanner:
    """Volume analysis-based scanning."""

    @staticmethod
    def scan_volume_spike(symbols: List[SymbolData], threshold: float = 2.0,
                          lookback: int = 20) -> List[ScanResult]:
        """Detect unusual volume — current vs. average."""
        results = []
        for sym in symbols:
            if len(sym.volume) < lookback + 1:
                continue
            avg_vol = np.mean(sym.volume[-lookback - 1:-1])
            if avg_vol <= 0:
                continue
            ratio = sym.volume[-1] / avg_vol
            if ratio >= threshold:
                results.append(ScanResult(
                    symbol=sym.symbol, score=float(ratio),
                    data={"volume": float(sym.volume[-1]), "avg_volume": float(avg_vol),
                           "volume_ratio": float(ratio)},
                    signals=[f"Volume spike: {ratio:.1f}x average"],
                ))
        return results

    @staticmethod
    def scan_volume_dry_up(symbols: List[SymbolData], threshold: float = 0.3,
                           lookback: int = 20) -> List[ScanResult]:
        """Low volume — possible consolidation before breakout."""
        results = []
        for sym in symbols:
            if len(sym.volume) < lookback + 1:
                continue
            avg_vol = np.mean(sym.volume[-lookback - 1:-1])
            if avg_vol <= 0:
                continue
            ratio = sym.volume[-1] / avg_vol
            if ratio <= threshold:
                results.append(ScanResult(
                    symbol=sym.symbol, score=float(1.0 / ratio),
                    data={"volume": float(sym.volume[-1]), "avg_volume": float(avg_vol),
                           "volume_ratio": float(ratio)},
                    signals=[f"Volume dry-up: {ratio:.2f}x average"],
                ))
        return results

    @staticmethod
    def scan_on_balance_volume_divergence(symbols: List[SymbolData],
                                           lookback: int = 20) -> List[ScanResult]:
        """OBV divergence — price vs. volume direction mismatch."""
        results = []
        for sym in symbols:
            if len(sym.close) < lookback or len(sym.volume) < lookback:
                continue
            # OBV calculation
            obv = np.zeros(len(sym.close))
            for i in range(1, len(sym.close)):
                if sym.close[i] > sym.close[i - 1]:
                    obv[i] = obv[i - 1] + sym.volume[i]
                elif sym.close[i] < sym.close[i - 1]:
                    obv[i] = obv[i - 1] - sym.volume[i]
                else:
                    obv[i] = obv[i - 1]

            price_change = sym.close[-1] - sym.close[-lookback]
            obv_change = obv[-1] - obv[-lookback]

            # Bearish divergence: price up, OBV down
            if price_change > 0 and obv_change < 0:
                results.append(ScanResult(
                    symbol=sym.symbol, score=-1.0,
                    data={"price_change": float(price_change), "obv_change": float(obv_change)},
                    signals=["Bearish OBV divergence"],
                ))
            # Bullish divergence: price down, OBV up
            elif price_change < 0 and obv_change > 0:
                results.append(ScanResult(
                    symbol=sym.symbol, score=1.0,
                    data={"price_change": float(price_change), "obv_change": float(obv_change)},
                    signals=["Bullish OBV divergence"],
                ))
        return results

    @staticmethod
    def scan_accumulation_distribution(symbols: List[SymbolData],
                                       lookback: int = 5) -> List[ScanResult]:
        """Detect accumulation (buying pressure) via A/D line."""
        results = []
        for sym in symbols:
            if len(sym.close) < lookback or len(sym.high) < lookback:
                continue
            # CLV = ((C - L) - (H - C)) / (H - L)
            h = sym.high[-lookback:]
            l = sym.low[-lookback:]
            c = sym.close[-lookback:]
            v = sym.volume[-lookback:]
            hl_range = h - l
            hl_range[hl_range == 0] = 1.0
            clv = ((c - l) - (h - c)) / hl_range
            ad = float(np.sum(clv * v))
            if ad > 0:
                results.append(ScanResult(
                    symbol=sym.symbol, score=ad,
                    data={"ad_sum": ad},
                    signals=["Accumulation detected"],
                ))
            elif ad < 0:
                results.append(ScanResult(
                    symbol=sym.symbol, score=ad,
                    data={"ad_sum": ad},
                    signals=["Distribution detected"],
                ))
        return results


# ═══════════════════════════════════════════════════════════════════════════════
# 4. MomentumScanner — Momentum-based scans
# ═══════════════════════════════════════════════════════════════════════════════

class MomentumScanner:
    """Momentum analysis scanning."""

    @staticmethod
    def scan_momentum(symbols: List[SymbolData], lookback: int = 20,
                      min_pct: float = 5.0) -> List[ScanResult]:
        """Simple price momentum — pct change over lookback."""
        results = []
        for sym in symbols:
            if len(sym.close) < lookback + 1:
                continue
            pct = (sym.close[-1] - sym.close[-lookback]) / sym.close[-lookback] * 100
            if abs(pct) >= min_pct:
                direction = "Bullish" if pct > 0 else "Bearish"
                results.append(ScanResult(
                    symbol=sym.symbol, score=float(pct),
                    data={"momentum_pct": float(pct), "lookback": lookback},
                    signals=[f"{direction} momentum: {pct:.1f}%"],
                ))
        return results

    @staticmethod
    def scan_rsi_divergence(symbols: List[SymbolData], lookback: int = 14) -> List[ScanResult]:
        """RSI divergence — price makes new low but RSI doesn't."""
        results = []
        for sym in symbols:
            if len(sym.close) < lookback * 3:
                continue
            rsi_vals = TechnicalScanner.rsi(sym.close, lookback)
            if np.isnan(rsi_vals[-1]) or np.isnan(rsi_vals[-lookback]):
                continue
            price_lower = sym.close[-1] < sym.close[-lookback]
            rsi_higher = rsi_vals[-1] > rsi_vals[-lookback]
            if price_lower and rsi_higher:
                results.append(ScanResult(
                    symbol=sym.symbol, score=1.0,
                    data={"rsi": float(rsi_vals[-1]),
                           "rsi_prev": float(rsi_vals[-lookback])},
                    signals=["Bullish RSI divergence"],
                ))
            price_higher = sym.close[-1] > sym.close[-lookback]
            rsi_lower = rsi_vals[-1] < rsi_vals[-lookback]
            if price_higher and rsi_lower:
                results.append(ScanResult(
                    symbol=sym.symbol, score=-1.0,
                    data={"rsi": float(rsi_vals[-1]),
                           "rsi_prev": float(rsi_vals[-lookback])},
                    signals=["Bearish RSI divergence"],
                ))
        return results

    @staticmethod
    def scan_rate_of_change(symbols: List[SymbolData], period: int = 10,
                            threshold: float = 5.0) -> List[ScanResult]:
        results = []
        for sym in symbols:
            if len(sym.close) < period + 1:
                continue
            roc = (sym.close[-1] - sym.close[-period - 1]) / sym.close[-period - 1] * 100
            if abs(roc) >= threshold:
                results.append(ScanResult(
                    symbol=sym.symbol, score=float(roc),
                    data={"roc": float(roc), "period": period},
                    signals=[f"ROC: {roc:.1f}%"],
                ))
        return results

    @staticmethod
    def scan_relative_strength(symbols: List[SymbolData], benchmark: np.ndarray,
                                lookback: int = 60) -> List[ScanResult]:
        """Relative strength vs. benchmark — outperformers."""
        results = []
        if len(benchmark) < lookback + 1:
            return results
        bench_ret = (benchmark[-1] - benchmark[-lookback]) / benchmark[-lookback]
        for sym in symbols:
            if len(sym.close) < lookback + 1:
                continue
            sym_ret = (sym.close[-1] - sym.close[-lookback]) / sym.close[-lookback]
            rel_strength = sym_ret - bench_ret
            if rel_strength > 0:
                results.append(ScanResult(
                    symbol=sym.symbol, score=float(rel_strength * 100),
                    data={"return": float(sym_ret * 100),
                           "benchmark_return": float(bench_ret * 100),
                           "relative_strength": float(rel_strength * 100)},
                    signals=[f"Outperforming benchmark by {rel_strength * 100:.1f}%"],
                ))
        return results

    @staticmethod
    def scan_mean_reversion(symbols: List[SymbolData], lookback: int = 20,
                            n_std: float = 2.0) -> List[ScanResult]:
        """Price extended beyond N standard deviations from mean."""
        results = []
        for sym in symbols:
            if len(sym.close) < lookback:
                continue
            window = sym.close[-lookback:]
            mean = np.mean(window)
            std = np.std(window)
            if std == 0:
                continue
            z_score = (sym.close[-1] - mean) / std
            if abs(z_score) >= n_std:
                direction = "Overbought" if z_score > 0 else "Oversold"
                results.append(ScanResult(
                    symbol=sym.symbol, score=float(-z_score),  # negative for reversion
                    data={"z_score": float(z_score), "mean": float(mean), "std": float(std)},
                    signals=[f"{direction} (z={z_score:.2f})"],
                ))
        return results


# ═══════════════════════════════════════════════════════════════════════════════
# 5. PatternScanner — Candlestick / chart pattern detection
# ═══════════════════════════════════════════════════════════════════════════════

class PatternScanner:
    """Candlestick and chart pattern scanning."""

    @staticmethod
    def scan_engulfing(symbols: List[SymbolData]) -> List[ScanResult]:
        """Bullish and bearish engulfing patterns."""
        results = []
        for sym in symbols:
            if len(sym.open) < 2 or len(sym.close) < 2:
                continue
            # Bullish engulfing
            prev_bearish = sym.close[-2] < sym.open[-2]
            curr_bullish = sym.close[-1] > sym.open[-1]
            engulfs = sym.open[-1] <= sym.close[-2] and sym.close[-1] >= sym.open[-2]
            if prev_bearish and curr_bullish and engulfs:
                results.append(ScanResult(
                    symbol=sym.symbol, score=1.0,
                    data={"pattern": "bullish_engulfing"},
                    signals=["Bullish Engulfing"],
                ))
            # Bearish engulfing
            prev_bullish = sym.close[-2] > sym.open[-2]
            curr_bearish = sym.close[-1] < sym.open[-1]
            engulfs_bear = sym.open[-1] >= sym.close[-2] and sym.close[-1] <= sym.open[-2]
            if prev_bullish and curr_bearish and engulfs_bear:
                results.append(ScanResult(
                    symbol=sym.symbol, score=-1.0,
                    data={"pattern": "bearish_engulfing"},
                    signals=["Bearish Engulfing"],
                ))
        return results

    @staticmethod
    def scan_doji(symbols: List[SymbolData], threshold: float = 0.1) -> List[ScanResult]:
        """Doji pattern — open ≈ close relative to candle range."""
        results = []
        for sym in symbols:
            if len(sym.open) < 1 or len(sym.close) < 1 or len(sym.high) < 1 or len(sym.low) < 1:
                continue
            body = abs(sym.close[-1] - sym.open[-1])
            total_range = sym.high[-1] - sym.low[-1]
            if total_range > 0 and body / total_range <= threshold:
                results.append(ScanResult(
                    symbol=sym.symbol, score=0.0,
                    data={"pattern": "doji", "body_ratio": float(body / total_range)},
                    signals=["Doji — indecision"],
                ))
        return results

    @staticmethod
    def scan_hammer(symbols: List[SymbolData]) -> List[ScanResult]:
        """Hammer pattern — long lower shadow, small body at top."""
        results = []
        for sym in symbols:
            if len(sym.open) < 1 or len(sym.close) < 1 or len(sym.high) < 1 or len(sym.low) < 1:
                continue
            body = abs(sym.close[-1] - sym.open[-1])
            total_range = sym.high[-1] - sym.low[-1]
            if total_range == 0:
                continue
            body_top = max(sym.open[-1], sym.close[-1])
            body_bottom = min(sym.open[-1], sym.close[-1])
            lower_shadow = body_bottom - sym.low[-1]
            upper_shadow = sym.high[-1] - body_top
            if lower_shadow >= 2 * body and upper_shadow <= body * 0.5:
                results.append(ScanResult(
                    symbol=sym.symbol, score=1.0,
                    data={"pattern": "hammer"},
                    signals=["Hammer — bullish reversal"],
                ))
        return results

    @staticmethod
    def scan_breakout(symbols: List[SymbolData], lookback: int = 20) -> List[ScanResult]:
        """Price breakout above recent resistance."""
        results = []
        for sym in symbols:
            if len(sym.high) < lookback + 1:
                continue
            resistance = np.max(sym.high[-lookback - 1:-1])
            if sym.close[-1] > resistance:
                pct = (sym.close[-1] - resistance) / resistance * 100
                results.append(ScanResult(
                    symbol=sym.symbol, score=float(pct),
                    data={"price": float(sym.close[-1]), "resistance": float(resistance),
                           "breakout_pct": float(pct)},
                    signals=[f"Breakout {pct:.1f}% above {lookback}-day resistance"],
                ))
        return results

    @staticmethod
    def scan_breakdown(symbols: List[SymbolData], lookback: int = 20) -> List[ScanResult]:
        """Price breakdown below recent support."""
        results = []
        for sym in symbols:
            if len(sym.low) < lookback + 1:
                continue
            support = np.min(sym.low[-lookback - 1:-1])
            if sym.close[-1] < support:
                pct = (support - sym.close[-1]) / support * 100
                results.append(ScanResult(
                    symbol=sym.symbol, score=float(-pct),
                    data={"price": float(sym.close[-1]), "support": float(support),
                           "breakdown_pct": float(pct)},
                    signals=[f"Breakdown {pct:.1f}% below {lookback}-day support"],
                ))
        return results

    @staticmethod
    def scan_gap_up(symbols: List[SymbolData], min_gap_pct: float = 2.0) -> List[ScanResult]:
        """Gap up — today's open above yesterday's high."""
        results = []
        for sym in symbols:
            if len(sym.open) < 2 or len(sym.high) < 2:
                continue
            gap = (sym.open[-1] - sym.high[-2]) / sym.high[-2] * 100
            if gap >= min_gap_pct:
                results.append(ScanResult(
                    symbol=sym.symbol, score=float(gap),
                    data={"gap_pct": float(gap)},
                    signals=[f"Gap up: {gap:.1f}%"],
                ))
        return results

    @staticmethod
    def scan_gap_down(symbols: List[SymbolData], min_gap_pct: float = 2.0) -> List[ScanResult]:
        results = []
        for sym in symbols:
            if len(sym.open) < 2 or len(sym.low) < 2:
                continue
            gap = (sym.low[-2] - sym.open[-1]) / sym.low[-2] * 100
            if gap >= min_gap_pct:
                results.append(ScanResult(
                    symbol=sym.symbol, score=float(-gap),
                    data={"gap_pct": float(gap)},
                    signals=[f"Gap down: {gap:.1f}%"],
                ))
        return results


# ═══════════════════════════════════════════════════════════════════════════════
# 6. CompositeScanner — Multi-criteria scanning
# ═══════════════════════════════════════════════════════════════════════════════

class CompositeScanner:
    """Combine multiple scan criteria with AND/OR logic."""

    @staticmethod
    def intersect(result_lists: List[List[ScanResult]]) -> List[ScanResult]:
        """AND — symbols must appear in ALL result lists."""
        if not result_lists:
            return []
        sym_sets = [set(r.symbol for r in results) for results in result_lists]
        common = sym_sets[0]
        for s in sym_sets[1:]:
            common &= s
        # Merge scores
        merged = []
        for symbol in common:
            signals = []
            total_score = 0.0
            data = {}
            for results in result_lists:
                for r in results:
                    if r.symbol == symbol:
                        signals.extend(r.signals)
                        total_score += r.score
                        data.update(r.data)
            merged.append(ScanResult(symbol=symbol, score=total_score,
                                      data=data, signals=signals))
        merged.sort(key=lambda x: x.score, reverse=True)
        return merged

    @staticmethod
    def union(result_lists: List[List[ScanResult]]) -> List[ScanResult]:
        """OR — symbols that appear in ANY result list."""
        combined: Dict[str, ScanResult] = {}
        for results in result_lists:
            for r in results:
                if r.symbol in combined:
                    combined[r.symbol].score += r.score
                    combined[r.symbol].signals.extend(r.signals)
                    combined[r.symbol].data.update(r.data)
                else:
                    combined[r.symbol] = ScanResult(
                        symbol=r.symbol, score=r.score,
                        data=dict(r.data), signals=list(r.signals))
        result = sorted(combined.values(), key=lambda x: x.score, reverse=True)
        return result

    @staticmethod
    def filter_results(results: List[ScanResult], filters: List[ScanFilter]) -> List[ScanResult]:
        """Apply additional filters to scan results."""
        filtered = []
        for r in results:
            passes = True
            for f in filters:
                if not f.evaluate(r.data):
                    passes = False
                    break
            if passes:
                filtered.append(r)
        return filtered

    @staticmethod
    def rank_results(results: List[ScanResult], sort_field: str = "score",
                     descending: bool = True, limit: int = 50) -> List[ScanResult]:
        """Rank and limit scan results."""
        if sort_field == "score":
            results.sort(key=lambda x: x.score, reverse=descending)
        else:
            results.sort(key=lambda x: x.data.get(sort_field, 0), reverse=descending)
        for i, r in enumerate(results[:limit]):
            r.rank = i + 1
        return results[:limit]


# ═══════════════════════════════════════════════════════════════════════════════
# 7. PredefinedScans — 30+ preset scans
# ═══════════════════════════════════════════════════════════════════════════════

class PredefinedScans:
    """Library of predefined scan configurations."""

    SCANS = {
        "golden_cross": {"description": "50/200 SMA Golden Cross", "type": "technical", "sentiment": "bullish"},
        "death_cross": {"description": "50/200 SMA Death Cross", "type": "technical", "sentiment": "bearish"},
        "rsi_oversold": {"description": "RSI below 30", "type": "technical", "sentiment": "oversold"},
        "rsi_overbought": {"description": "RSI above 70", "type": "technical", "sentiment": "overbought"},
        "macd_bullish": {"description": "MACD bullish crossover", "type": "technical", "sentiment": "bullish"},
        "macd_bearish": {"description": "MACD bearish crossover", "type": "technical", "sentiment": "bearish"},
        "bollinger_squeeze": {"description": "Bollinger Bands squeeze", "type": "technical", "sentiment": "neutral"},
        "above_200sma": {"description": "Price above 200 SMA", "type": "technical", "sentiment": "bullish"},
        "52w_high": {"description": "52-week new high", "type": "technical", "sentiment": "bullish"},
        "52w_low": {"description": "52-week new low", "type": "technical", "sentiment": "bearish"},
        "volume_spike": {"description": "Volume 2x+ average", "type": "volume", "sentiment": "alert"},
        "volume_dryup": {"description": "Volume below 30% average", "type": "volume", "sentiment": "consolidation"},
        "obv_divergence": {"description": "OBV divergence from price", "type": "volume", "sentiment": "mixed"},
        "accumulation": {"description": "Accumulation/Distribution signal", "type": "volume", "sentiment": "mixed"},
        "momentum_up": {"description": "Strong upward momentum (>5%)", "type": "momentum", "sentiment": "bullish"},
        "mean_reversion": {"description": "Price >2σ from mean", "type": "momentum", "sentiment": "reversal"},
        "rsi_divergence": {"description": "RSI divergence from price", "type": "momentum", "sentiment": "mixed"},
        "engulfing": {"description": "Engulfing candlestick pattern", "type": "pattern", "sentiment": "mixed"},
        "doji": {"description": "Doji candlestick", "type": "pattern", "sentiment": "indecision"},
        "hammer": {"description": "Hammer pattern", "type": "pattern", "sentiment": "bullish"},
        "breakout": {"description": "Price breakout above resistance", "type": "pattern", "sentiment": "bullish"},
        "breakdown": {"description": "Price breakdown below support", "type": "pattern", "sentiment": "bearish"},
        "gap_up": {"description": "Gap up > 2%", "type": "pattern", "sentiment": "bullish"},
        "gap_down": {"description": "Gap down > 2%", "type": "pattern", "sentiment": "bearish"},
        "low_pe": {"description": "P/E ratio < 15", "type": "fundamental", "sentiment": "value"},
        "high_dividend": {"description": "Dividend yield > 3%", "type": "fundamental", "sentiment": "income"},
        "large_cap": {"description": "Market cap > $10B", "type": "fundamental", "sentiment": "stable"},
        "small_cap": {"description": "Market cap $300M-$2B", "type": "fundamental", "sentiment": "growth"},
        "revenue_growth": {"description": "Revenue growth > 20%", "type": "fundamental", "sentiment": "growth"},
        "eps_growth": {"description": "EPS growth > 25%", "type": "fundamental", "sentiment": "growth"},
        "low_debt": {"description": "D/E ratio < 0.3", "type": "fundamental", "sentiment": "conservative"},
        "high_roe": {"description": "ROE > 20%", "type": "fundamental", "sentiment": "quality"},
    }

    @staticmethod
    def list_scans() -> Dict[str, Any]:
        return PredefinedScans.SCANS

    @staticmethod
    def run_scan(name: str, symbols: List[SymbolData],
                 benchmark: Optional[np.ndarray] = None) -> List[ScanResult]:
        """Execute a predefined scan."""
        dispatch = {
            "golden_cross": lambda: TechnicalScanner.scan_golden_cross(symbols),
            "death_cross": lambda: TechnicalScanner.scan_death_cross(symbols),
            "rsi_oversold": lambda: TechnicalScanner.scan_rsi_oversold(symbols),
            "rsi_overbought": lambda: TechnicalScanner.scan_rsi_overbought(symbols),
            "macd_bullish": lambda: TechnicalScanner.scan_macd_cross_up(symbols),
            "macd_bearish": lambda: TechnicalScanner.scan_macd_cross_down(symbols),
            "bollinger_squeeze": lambda: TechnicalScanner.scan_bollinger_squeeze(symbols),
            "above_200sma": lambda: TechnicalScanner.scan_above_sma(symbols, 200),
            "52w_high": lambda: TechnicalScanner.scan_new_high(symbols, 252),
            "52w_low": lambda: TechnicalScanner.scan_new_low(symbols, 252),
            "volume_spike": lambda: VolumeScanner.scan_volume_spike(symbols),
            "volume_dryup": lambda: VolumeScanner.scan_volume_dry_up(symbols),
            "obv_divergence": lambda: VolumeScanner.scan_on_balance_volume_divergence(symbols),
            "accumulation": lambda: VolumeScanner.scan_accumulation_distribution(symbols),
            "momentum_up": lambda: MomentumScanner.scan_momentum(symbols),
            "mean_reversion": lambda: MomentumScanner.scan_mean_reversion(symbols),
            "rsi_divergence": lambda: MomentumScanner.scan_rsi_divergence(symbols),
            "engulfing": lambda: PatternScanner.scan_engulfing(symbols),
            "doji": lambda: PatternScanner.scan_doji(symbols),
            "hammer": lambda: PatternScanner.scan_hammer(symbols),
            "breakout": lambda: PatternScanner.scan_breakout(symbols),
            "breakdown": lambda: PatternScanner.scan_breakdown(symbols),
            "gap_up": lambda: PatternScanner.scan_gap_up(symbols),
            "gap_down": lambda: PatternScanner.scan_gap_down(symbols),
            "low_pe": lambda: FundamentalScanner.scan_pe_ratio(symbols, 0, 15),
            "high_dividend": lambda: FundamentalScanner.scan_dividend_yield(symbols, 3.0),
            "large_cap": lambda: FundamentalScanner.scan_market_cap(symbols, 10e9),
            "small_cap": lambda: FundamentalScanner.scan_market_cap(symbols, 300e6, 2e9),
            "revenue_growth": lambda: FundamentalScanner.scan_revenue_growth(symbols, 20),
            "eps_growth": lambda: FundamentalScanner.scan_eps_growth(symbols, 25),
            "low_debt": lambda: FundamentalScanner.scan_debt_to_equity(symbols, 0.3),
            "high_roe": lambda: FundamentalScanner.scan_roe(symbols, 20),
        }
        fn = dispatch.get(name)
        if fn is None:
            return []
        return fn()


# ═══════════════════════════════════════════════════════════════════════════════
# 8. ScannerEngine — Unified orchestrator
# ═══════════════════════════════════════════════════════════════════════════════

class ScannerEngine:
    """Unified stock scanner engine."""

    def __init__(self):
        self._symbols: Dict[str, SymbolData] = {}
        self._scan_history: List[Dict[str, Any]] = []

    def add_symbol(self, symbol: str, close: np.ndarray,
                   high: Optional[np.ndarray] = None,
                   low: Optional[np.ndarray] = None,
                   open_: Optional[np.ndarray] = None,
                   volume: Optional[np.ndarray] = None,
                   fundamentals: Optional[Dict[str, Any]] = None,
                   metadata: Optional[Dict[str, Any]] = None) -> None:
        self._symbols[symbol] = SymbolData(
            symbol=symbol, close=close,
            high=high if high is not None else np.array([]),
            low=low if low is not None else np.array([]),
            open=open_ if open_ is not None else np.array([]),
            volume=volume if volume is not None else np.array([]),
            fundamentals=fundamentals or {},
            metadata=metadata or {},
        )

    def remove_symbol(self, symbol: str) -> bool:
        return self._symbols.pop(symbol, None) is not None

    def list_symbols(self) -> List[str]:
        return list(self._symbols.keys())

    def _get_symbol_list(self) -> List[SymbolData]:
        return list(self._symbols.values())

    def run_predefined(self, scan_name: str, limit: int = 50) -> List[Dict[str, Any]]:
        """Run a predefined scan and return ranked results."""
        results = PredefinedScans.run_scan(scan_name, self._get_symbol_list())
        ranked = CompositeScanner.rank_results(results, limit=limit)
        self._scan_history.append({"scan": scan_name, "count": len(ranked)})
        return [{"rank": r.rank, "symbol": r.symbol, "score": r.score,
                 "signals": r.signals, "data": r.data} for r in ranked]

    def run_composite(self, scan_names: List[str], logic: str = "and",
                      limit: int = 50) -> List[Dict[str, Any]]:
        """Run multiple predefined scans with AND/OR logic."""
        symbols_list = self._get_symbol_list()
        result_lists = [PredefinedScans.run_scan(name, symbols_list) for name in scan_names]
        if logic == "and":
            combined = CompositeScanner.intersect(result_lists)
        else:
            combined = CompositeScanner.union(result_lists)
        ranked = CompositeScanner.rank_results(combined, limit=limit)
        return [{"rank": r.rank, "symbol": r.symbol, "score": r.score,
                 "signals": r.signals, "data": r.data} for r in ranked]

    def run_custom(self, filters: List[Dict[str, Any]], limit: int = 50) -> List[Dict[str, Any]]:
        """Run custom scan with arbitrary filters."""
        symbols_list = self._get_symbol_list()
        # Build initial data for each symbol
        results = []
        for sym in symbols_list:
            data: Dict[str, Any] = {}
            data["price"] = float(sym.close[-1]) if len(sym.close) > 0 else 0
            data["volume"] = float(sym.volume[-1]) if len(sym.volume) > 0 else 0

            if len(sym.close) > 1:
                data["change_pct"] = (sym.close[-1] - sym.close[-2]) / sym.close[-2] * 100 if sym.close[-2] != 0 else 0
            if len(sym.close) > 14:
                rsi_vals = TechnicalScanner.rsi(sym.close)
                data["rsi"] = float(rsi_vals[-1]) if not np.isnan(rsi_vals[-1]) else 50.0
            if len(sym.close) > 20:
                sma20 = TechnicalScanner.sma(sym.close, 20)
                data["sma20"] = float(sma20[-1]) if not np.isnan(sma20[-1]) else 0.0
            if len(sym.close) > 50:
                sma50 = TechnicalScanner.sma(sym.close, 50)
                data["sma50"] = float(sma50[-1]) if not np.isnan(sma50[-1]) else 0.0
            if len(sym.close) > 200:
                sma200 = TechnicalScanner.sma(sym.close, 200)
                data["sma200"] = float(sma200[-1]) if not np.isnan(sma200[-1]) else 0.0

            data.update(sym.fundamentals)
            results.append(ScanResult(symbol=sym.symbol, data=data))

        # Apply filters
        scan_filters = []
        for f in filters:
            op = FilterOperator(f.get("operator", ">"))
            scan_filters.append(ScanFilter(
                field=f["field"], operator=op,
                value=f["value"], secondary_value=f.get("secondary_value")))

        filtered = CompositeScanner.filter_results(results, scan_filters)
        ranked = CompositeScanner.rank_results(filtered, limit=limit)
        return [{"rank": r.rank, "symbol": r.symbol, "score": r.score,
                 "data": r.data} for r in ranked]

    def scan_history(self) -> List[Dict[str, Any]]:
        return list(self._scan_history)

    def capabilities(self) -> Dict[str, Any]:
        return {
            "predefined_scans": len(PredefinedScans.SCANS),
            "scan_categories": ["technical", "fundamental", "volume", "momentum", "pattern"],
            "composite_logic": ["and", "or"],
            "custom_filter_operators": [op.value for op in FilterOperator],
            "symbols_loaded": len(self._symbols),
        }
