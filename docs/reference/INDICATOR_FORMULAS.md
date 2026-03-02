# Indicator Formulas Reference

> Mathematical definitions for every technical indicator in Apex Terminal.

## Table of Contents

- [Moving Averages](#moving-averages)
- [Momentum Oscillators](#momentum-oscillators)
- [Volatility Indicators](#volatility-indicators)
- [Volume Indicators](#volume-indicators)
- [Trend Indicators](#trend-indicators)

---

## Moving Averages

| Indicator | Formula | Default Period | Range |
|-----------|---------|---------------|-------|
| SMA | `SMA(n) = (Σ Cᵢ) / n` for i = 0…n−1 | 20 | 0 – ∞ |
| EMA | `EMA(t) = α·C(t) + (1−α)·EMA(t−1)`, α = 2/(n+1) | 20 | 0 – ∞ |
| WMA | `WMA(n) = Σ(wᵢ·Cᵢ) / Σwᵢ`, wᵢ = n−i | 20 | 0 – ∞ |
| DEMA | `DEMA = 2·EMA(n) − EMA(EMA(n))` | 20 | 0 – ∞ |
| TEMA | `TEMA = 3·EMA − 3·EMA(EMA) + EMA(EMA(EMA))` | 20 | 0 – ∞ |
| HMA | `HMA(n) = WMA(√n, 2·WMA(n/2) − WMA(n))` | 9 | 0 – ∞ |
| VWAP | `VWAP = Σ(Pᵢ·Vᵢ) / ΣVᵢ`, P = typical price | session | 0 – ∞ |

### Typical Price

Used by VWAP and several other indicators:

```
TP = (High + Low + Close) / 3
```

---

## Momentum Oscillators

### RSI – Relative Strength Index

```
RS  = EMA(gains, n) / EMA(losses, n)
RSI = 100 − 100 / (1 + RS)
```

| Parameter | Default | Description |
|-----------|---------|-------------|
| Period (n) | 14 | Lookback window |

**Interpretation:** RSI > 70 → overbought; RSI < 30 → oversold.

### MACD – Moving Average Convergence Divergence

```
MACD Line   = EMA(12) − EMA(26)
Signal Line = EMA(MACD Line, 9)
Histogram   = MACD Line − Signal Line
```

| Parameter | Default | Description |
|-----------|---------|-------------|
| Fast EMA | 12 | Short-term period |
| Slow EMA | 26 | Long-term period |
| Signal | 9 | Signal smoothing |

**Interpretation:** Histogram crossing zero signals momentum shift.

### Stochastic Oscillator

```
%K = 100 · (C − L₁₄) / (H₁₄ − L₁₄)
%D = SMA(%K, 3)
```

| Parameter | Default | Description |
|-----------|---------|-------------|
| %K period | 14 | Lookback for high/low |
| %D period | 3 | Signal smoothing |

**Interpretation:** %K > 80 → overbought; %K < 20 → oversold.

### CCI – Commodity Channel Index

```
CCI = (TP − SMA(TP, n)) / (0.015 · MD)
MD  = (1/n) · Σ|TPᵢ − SMA(TP, n)|
```

| Parameter | Default | Range |
|-----------|---------|-------|
| Period | 20 | −∞ to +∞ |

### Williams %R

```
%R = −100 · (H₁₄ − C) / (H₁₄ − L₁₄)
```

**Interpretation:** %R > −20 → overbought; %R < −80 → oversold.

### ROC – Rate of Change

```
ROC = 100 · (C − C₋ₙ) / C₋ₙ
```

---

## Volatility Indicators

### Bollinger Bands

```
Middle = SMA(C, n)
Upper  = Middle + k · σ(C, n)
Lower  = Middle − k · σ(C, n)
```

| Parameter | Default | Description |
|-----------|---------|-------------|
| Period (n) | 20 | SMA lookback |
| Multiplier (k) | 2.0 | Standard deviation factor |

### ATR – Average True Range

```
TR  = max(H−L, |H−C₋₁|, |L−C₋₁|)
ATR = EMA(TR, n)   /* Wilder smoothing: α = 1/n */
```

### Keltner Channel

```
Middle = EMA(C, 20)
Upper  = Middle + k · ATR(10)
Lower  = Middle − k · ATR(10)
```

### Donchian Channel

```
Upper = max(H, n periods)
Lower = min(L, n periods)
Mid   = (Upper + Lower) / 2
```

### Standard Deviation

```
σ = √[(1/n) · Σ(Cᵢ − C̄)²]
```

---

## Volume Indicators

### OBV – On-Balance Volume

```
OBV(t) = OBV(t−1) + V(t)   if C(t) > C(t−1)
OBV(t) = OBV(t−1) − V(t)   if C(t) < C(t−1)
OBV(t) = OBV(t−1)           if C(t) = C(t−1)
```

### MFI – Money Flow Index

```
MF    = TP · Volume
Ratio = Σ(positive MF, n) / Σ(negative MF, n)
MFI   = 100 − 100 / (1 + Ratio)
```

### AD – Accumulation/Distribution

```
CLV  = [(C − L) − (H − C)] / (H − L)
AD(t) = AD(t−1) + CLV · Volume
```

### CMF – Chaikin Money Flow

```
CMF = Σ(CLV · V, n) / Σ(V, n)
```

---

## Trend Indicators

### ADX – Average Directional Index

```
+DM = H(t) − H(t−1)   (if positive and > −DM, else 0)
−DM = L(t−1) − L(t)    (if positive and > +DM, else 0)
+DI = 100 · EMA(+DM, n) / ATR(n)
−DI = 100 · EMA(−DM, n) / ATR(n)
DX  = 100 · |+DI − −DI| / (+DI + −DI)
ADX = EMA(DX, n)
```

**Interpretation:** ADX > 25 → strong trend; ADX < 20 → range-bound.

### Aroon

```
Aroon Up   = 100 · (n − periods since n-period high) / n
Aroon Down = 100 · (n − periods since n-period low) / n
Oscillator = Aroon Up − Aroon Down
```

### Ichimoku Cloud

| Component | Formula | Period |
|-----------|---------|--------|
| Tenkan-sen | (highest high + lowest low) / 2 | 9 |
| Kijun-sen | (highest high + lowest low) / 2 | 26 |
| Senkou Span A | (Tenkan + Kijun) / 2, plotted 26 ahead | 26 |
| Senkou Span B | (highest high + lowest low) / 2, plotted 26 ahead | 52 |
| Chikou Span | Close, plotted 26 behind | 26 |

### Parabolic SAR

```
SAR(t+1) = SAR(t) + AF · (EP − SAR(t))
AF starts at 0.02, increments by 0.02, max 0.20
EP = extreme point (highest high or lowest low in trend)
```

### Supertrend

```
Basic Upper = (H + L) / 2 + multiplier · ATR(n)
Basic Lower = (H + L) / 2 − multiplier · ATR(n)
```

Supertrend flips when price crosses the band. Default: period 10, multiplier 3.

---

*Source: `lib/indicators/` — see individual module files for implementation details.*
