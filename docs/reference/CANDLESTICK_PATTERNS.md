# Candlestick Patterns Reference

> Complete catalog of candlestick patterns recognized by Apex Terminal's pattern engine.

## Table of Contents

- [Single-Candle Patterns](#single-candle-patterns)
- [Bullish Reversal Patterns](#bullish-reversal-patterns)
- [Bearish Reversal Patterns](#bearish-reversal-patterns)
- [Continuation Patterns](#continuation-patterns)
- [Pattern Scoring](#pattern-scoring)

---

## Single-Candle Patterns

| Pattern | Body | Shadows | Signal | Strength |
|---------|------|---------|--------|----------|
| Doji | Open ≈ Close (< 5% of range) | Upper & lower present | Indecision | ★☆☆ |
| Long-Legged Doji | Open ≈ Close | Both shadows > 2× body | Strong indecision | ★★☆ |
| Dragonfly Doji | Open ≈ Close ≈ High | Long lower shadow, no upper | Bullish (at support) | ★★☆ |
| Gravestone Doji | Open ≈ Close ≈ Low | Long upper shadow, no lower | Bearish (at resistance) | ★★☆ |
| Spinning Top | Small body (< 30% of range) | Both shadows > body | Indecision | ★☆☆ |
| Marubozu (Bullish) | Large body, close ≫ open | No shadows | Strong bullish momentum | ★★★ |
| Marubozu (Bearish) | Large body, open ≫ close | No shadows | Strong bearish momentum | ★★★ |

---

## Bullish Reversal Patterns

Appear after a downtrend and signal potential upward reversal.

| Pattern | Candles | Definition | Strength | Reliability |
|---------|---------|-----------|----------|-------------|
| Hammer | 1 | Small body at top, lower shadow ≥ 2× body, minimal upper shadow | ★★☆ | 60–65% |
| Inverted Hammer | 1 | Small body at bottom, upper shadow ≥ 2× body, minimal lower shadow | ★☆☆ | 55–60% |
| Bullish Engulfing | 2 | Bearish candle followed by bullish candle whose body fully engulfs the prior body | ★★★ | 63–68% |
| Piercing Line | 2 | Bearish candle, then bullish candle opening below prior low and closing above 50% of prior body | ★★☆ | 60–64% |
| Morning Star | 3 | Long bearish → small body (gap down) → long bullish closing above 50% of first candle | ★★★ | 70–78% |
| Morning Doji Star | 3 | Long bearish → doji (gap down) → long bullish | ★★★ | 72–80% |
| Three White Soldiers | 3 | Three consecutive long bullish candles, each opening within prior body and closing near high | ★★★ | 75–82% |
| Bullish Harami | 2 | Long bearish candle followed by small bullish candle contained within prior body | ★★☆ | 53–60% |
| Tweezer Bottom | 2 | Two candles with matching lows after a downtrend; first bearish, second bullish | ★★☆ | 55–62% |
| Three Inside Up | 3 | Bullish harami confirmed by third bullish candle closing above first candle's open | ★★★ | 65–72% |

### Hammer Detection Rules

```
body_size  = |close − open|
range      = high − low
lower_shadow = min(open, close) − low
upper_shadow = high − max(open, close)

is_hammer = lower_shadow ≥ 2 · body_size
         && upper_shadow ≤ 0.1 · range
         && body_size > 0
         && prior_trend == 'down'
```

---

## Bearish Reversal Patterns

Appear after an uptrend and signal potential downward reversal.

| Pattern | Candles | Definition | Strength | Reliability |
|---------|---------|-----------|----------|-------------|
| Shooting Star | 1 | Small body at bottom, upper shadow ≥ 2× body, minimal lower shadow | ★★☆ | 60–65% |
| Hanging Man | 1 | Same shape as hammer but appears after uptrend | ★★☆ | 55–60% |
| Bearish Engulfing | 2 | Bullish candle followed by bearish candle whose body fully engulfs prior body | ★★★ | 63–68% |
| Dark Cloud Cover | 2 | Bullish candle, then bearish candle opening above prior high and closing below 50% of prior body | ★★☆ | 60–65% |
| Evening Star | 3 | Long bullish → small body (gap up) → long bearish closing below 50% of first candle | ★★★ | 70–78% |
| Evening Doji Star | 3 | Long bullish → doji (gap up) → long bearish | ★★★ | 72–80% |
| Three Black Crows | 3 | Three consecutive long bearish candles, each opening within prior body and closing near low | ★★★ | 75–82% |
| Bearish Harami | 2 | Long bullish candle followed by small bearish candle contained within prior body | ★★☆ | 53–60% |
| Tweezer Top | 2 | Two candles with matching highs after an uptrend; first bullish, second bearish | ★★☆ | 55–62% |
| Three Inside Down | 3 | Bearish harami confirmed by third bearish candle closing below first candle's open | ★★★ | 65–72% |

---

## Continuation Patterns

Signal that the existing trend is likely to persist.

| Pattern | Candles | Context | Definition |
|---------|---------|---------|-----------|
| Rising Three Methods | 5 | Uptrend | Long bullish → 3 small bearish candles within range → long bullish breaking above |
| Falling Three Methods | 5 | Downtrend | Long bearish → 3 small bullish candles within range → long bearish breaking below |
| Upside Tasuki Gap | 3 | Uptrend | Bullish gap up → bullish candle → bearish candle that partially fills gap |
| Downside Tasuki Gap | 3 | Downtrend | Bearish gap down → bearish candle → bullish candle that partially fills gap |
| Side-by-Side White | 2 | Uptrend | Two bullish candles of similar size opening and closing near same levels |
| Mat Hold | 5 | Uptrend | Variant of rising three methods with gap between first and second candle |

---

## Pattern Scoring

Apex Terminal assigns a composite score to each detected pattern.

### Score Components

| Component | Weight | Description |
|-----------|--------|-------------|
| Pattern strength | 40% | Inherent reliability rating (★ to ★★★) |
| Volume confirmation | 25% | Volume on signal candle vs 20-period average |
| Trend alignment | 20% | Pattern direction agrees with higher-timeframe trend |
| Support/Resistance | 15% | Pattern occurs near a key price level |

### Composite Score Formula

```
Score = 0.4 · S_pattern + 0.25 · S_volume + 0.2 · S_trend + 0.15 · S_level
```

Score range: 0 (ignore) to 100 (highest conviction).

### Score Thresholds

| Score | Label | Action |
|-------|-------|--------|
| 80–100 | Strong | High-confidence signal, alert triggered |
| 60–79 | Moderate | Watchlist candidate |
| 40–59 | Weak | Informational only |
| 0–39 | Noise | Suppressed from display |

---

*Source: `lib/indicators/patterns/` — see `candlestickPatterns.ts` for detection logic.*
