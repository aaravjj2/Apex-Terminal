# Risk Metric Formulas Reference

> Mathematical definitions for all risk and performance metrics computed by Apex Terminal.

## Table of Contents

- [Value at Risk](#value-at-risk)
- [Expected Shortfall](#expected-shortfall)
- [Risk-Adjusted Return Ratios](#risk-adjusted-return-ratios)
- [Drawdown Metrics](#drawdown-metrics)
- [Market Risk Factors](#market-risk-factors)
- [Tracking and Attribution](#tracking-and-attribution)

---

## Value at Risk

VaR estimates the maximum expected loss over a given horizon at a given confidence level.

### Historical VaR

```
VaR_α = −Percentile(R, 1 − α)
```

Sort observed returns R₁…Rₙ in ascending order and take the (1−α)-th percentile.

### Parametric (Normal) VaR

```
VaR_α = −(μ + z_α · σ)
```

| Symbol | Meaning |
|--------|---------|
| μ | Mean portfolio return |
| σ | Portfolio standard deviation |
| z_α | Standard normal quantile (e.g. −1.645 for 95%) |

### Monte Carlo VaR

1. Simulate M portfolio return paths using the covariance matrix.
2. Compute portfolio P&L for each path.
3. Take the (1−α) percentile of the resulting distribution.

### Common Confidence Levels

| Confidence | z-score | Use Case |
|------------|---------|----------|
| 90% | −1.282 | Internal monitoring |
| 95% | −1.645 | Industry standard |
| 99% | −2.326 | Regulatory (Basel) |

---

## Expected Shortfall

Also called Conditional VaR (CVaR). Measures the average loss in the tail beyond VaR.

### Historical CVaR

```
CVaR_α = −(1/k) · Σ Rᵢ   for all Rᵢ ≤ −VaR_α
```

where k is the number of observations in the tail.

### Parametric CVaR

```
CVaR_α = −μ + σ · φ(z_α) / (1 − α)
```

φ is the standard normal PDF. CVaR is always ≥ VaR for the same confidence level.

---

## Risk-Adjusted Return Ratios

### Sharpe Ratio

```
Sharpe = (Rₚ − Rᶠ) / σₚ
```

| Symbol | Meaning |
|--------|---------|
| Rₚ | Annualized portfolio return |
| Rᶠ | Risk-free rate |
| σₚ | Annualized portfolio standard deviation |

**Interpretation:** Higher is better. > 1.0 is good; > 2.0 is excellent.

### Sortino Ratio

```
Sortino = (Rₚ − Rᶠ) / σ_d
σ_d = √[(1/n) · Σ min(Rᵢ − T, 0)²]
```

Uses downside deviation instead of total standard deviation. T = target return (typically Rᶠ).

### Treynor Ratio

```
Treynor = (Rₚ − Rᶠ) / βₚ
```

Measures excess return per unit of systematic (market) risk.

### Information Ratio

```
IR = (Rₚ − R_b) / TE
TE = σ(Rₚ − R_b)
```

| Symbol | Meaning |
|--------|---------|
| R_b | Benchmark return |
| TE | Tracking error (std dev of active returns) |

**Interpretation:** > 0.5 is good; > 1.0 is exceptional.

### Calmar Ratio

```
Calmar = Annualized Return / |Max Drawdown|
```

Uses a 36-month lookback by convention.

### Sterling Ratio

```
Sterling = (Rₚ − Rᶠ) / (|Avg Annual Max Drawdown| + 10%)
```

The 10% is an arbitrary cushion (some variants omit it).

### Ratios Comparison

| Ratio | Risk Measure | Best For |
|-------|-------------|----------|
| Sharpe | Total volatility | General performance |
| Sortino | Downside volatility | Asymmetric returns |
| Treynor | Beta | Diversified portfolios |
| Information | Tracking error | Active management |
| Calmar | Max drawdown | Drawdown-sensitive strategies |

---

## Drawdown Metrics

### Maximum Drawdown

```
DD(t) = [Peak(t) − Value(t)] / Peak(t)
Peak(t) = max(Value(0), Value(1), …, Value(t))
MDD = max(DD(t))   for all t
```

### Drawdown Duration

```
Duration = t_recovery − t_peak
```

If the portfolio has not recovered, duration is ongoing (open drawdown).

### Average Drawdown

```
Avg DD = (1/N) · Σ DDₖ
```

where DDₖ are individual drawdown episodes from peak to recovery.

---

## Market Risk Factors

### Beta

```
β = Cov(Rₚ, Rₘ) / Var(Rₘ)
```

| Value | Interpretation |
|-------|---------------|
| β = 1 | Moves with the market |
| β > 1 | More volatile than market |
| β < 1 | Less volatile than market |
| β < 0 | Inversely correlated |

### Jensen's Alpha

```
α = Rₚ − [Rᶠ + β · (Rₘ − Rᶠ)]
```

Measures the portfolio's excess return above what CAPM predicts.

### Correlation

```
ρ(Rₚ, Rₘ) = Cov(Rₚ, Rₘ) / (σₚ · σₘ)
```

### R-squared

```
R² = ρ²
```

Fraction of portfolio variance explained by the benchmark.

---

## Tracking and Attribution

### Tracking Error

```
TE = σ(Rₚ − R_b) = √[(1/(n−1)) · Σ(aᵢ − ā)²]
```

where aᵢ = Rₚ,ᵢ − R_b,ᵢ are active returns.

### Brinson Attribution (single period)

| Effect | Formula |
|--------|---------|
| Allocation | Σ (wₚ,ᵢ − w_b,ᵢ) · (R_b,ᵢ − R_b) |
| Selection | Σ w_b,ᵢ · (Rₚ,ᵢ − R_b,ᵢ) |
| Interaction | Σ (wₚ,ᵢ − w_b,ᵢ) · (Rₚ,ᵢ − R_b,ᵢ) |

Total active return = Allocation + Selection + Interaction.

### Annualization

| Metric | Daily → Annual |
|--------|---------------|
| Return | `(1 + r_daily)^252 − 1` |
| Volatility | `σ_daily · √252` |
| Sharpe | `Sharpe_daily · √252` |

---

*Source: `lib/risk/` — see `var.ts`, `metrics.ts`, `attribution.ts`.*
