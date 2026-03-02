# Strategy Development Guide

> From idea to live deployment — a disciplined process for building trading strategies.

This guide walks you through the full strategy development lifecycle: conceiving an idea, selecting indicators, defining rules, backtesting rigorously, avoiding overfitting, and deploying to live markets.

---

## Table of Contents

1. [The Strategy Development Process](#the-strategy-development-process)
2. [Starting with an Idea](#starting-with-an-idea)
3. [Indicator Selection](#indicator-selection)
4. [Defining Entry and Exit Rules](#defining-entry-and-exit-rules)
5. [Backtesting Validation](#backtesting-validation)
6. [Optimization Pitfalls](#optimization-pitfalls)
7. [Walk-Forward Validation](#walk-forward-validation)
8. [Paper Trading Phase](#paper-trading-phase)
9. [Deployment to Live](#deployment-to-live)
10. [Tips](#tips)

---

## The Strategy Development Process

Follow this sequence — skipping steps leads to costly mistakes:

```
Idea → Rules → Backtest → Optimize → Walk-Forward → Paper Trade → Live (small) → Live (full)
```

Each step acts as a filter. Most ideas fail at the backtest stage, and that's good — it means you caught them before risking real money.

---

## Starting with an Idea

Good strategy ideas come from observable market behavior:

- **Trend-following:** Markets trend more than they should under random walk — exploit momentum.
- **Mean-reversion:** Overbought/oversold conditions tend to reverse — exploit extremes.
- **Breakout:** Price consolidation followed by a move — exploit range expansion.
- **Seasonal:** Calendar effects like month-end rebalancing create predictable flows.
- **Event-driven:** Earnings, economic releases, and corporate actions create dislocations.

Write down your thesis before touching any indicator. What market inefficiency are you exploiting?

> **Tip:** The best strategies are simple. If you can't explain your edge in one sentence, it probably doesn't exist.

---

## Indicator Selection

Choose indicators that measure what your thesis requires:

| Thesis | Useful Indicators |
|--------|-------------------|
| Trend | SMA/EMA, ADX, Parabolic SAR, Ichimoku |
| Momentum | RSI, MACD, Stochastic, Rate of Change |
| Volatility | Bollinger Bands, ATR, Keltner Channels |
| Volume | OBV, VWAP, MFI, Volume Profile |
| Mean-reversion | RSI, Bollinger %B, Z-Score, CCI |

**Rules for indicator selection:**

1. Don't use redundant indicators — two momentum indicators say the same thing.
2. Combine indicators from different categories (e.g., trend + volume confirmation).
3. Fewer indicators = more robust strategy. Target 2–3 total.
4. Test each indicator's contribution — if removing it doesn't hurt, remove it.

---

## Defining Entry and Exit Rules

Rules must be unambiguous — a computer (or a disciplined trader) should produce the same result every time.

### Entry Rules

Define precisely:

- **What triggers the entry?** (e.g., RSI crosses below 30)
- **What confirms it?** (e.g., price is above 200 EMA)
- **What filters it?** (e.g., volume > 1.5× average)

### Exit Rules

Every strategy needs three exit types:

| Exit Type | Purpose | Example |
|-----------|---------|---------|
| **Stop-loss** | Limit downside | -2 ATR from entry |
| **Take-profit** | Lock in gains | +4 ATR from entry (2:1 reward/risk) |
| **Time exit** | Avoid stale trades | Close after 10 bars if neither stop nor target hit |

> **Warning:** Never trade a strategy without a stop-loss. "I'll exit when it feels right" is not a rule.

---

## Backtesting Validation

Use Apex Terminal's backtester to validate:

1. **Encode your rules** in the strategy editor.
2. **Run on 3–5 years** of daily data (or 6–12 months of intraday for intraday strategies).
3. **Include realistic costs** — commissions (e.g., $0.005/share) and slippage (e.g., 0.05%).
4. **Evaluate key metrics:**

| Metric | Target |
|--------|--------|
| Sharpe Ratio | > 1.0 (ideally > 1.5) |
| Profit Factor | > 1.5 |
| Max Drawdown | < 20% |
| Win Rate | Depends on reward/risk ratio |
| Number of trades | > 100 for statistical significance |

If the strategy doesn't pass these thresholds, revise or discard it. Don't optimize your way to a pass.

---

## Optimization Pitfalls

Optimization finds the best parameters — but the best *past* parameters rarely are the best *future* parameters.

**Overfitting red flags:**

- Performance is great only on a narrow parameter range
- Sharpe ratio > 3.0 (suspiciously good — likely curve-fitted)
- Very few trades (< 30) — insufficient statistical significance
- Strategy works only on one symbol or time period
- Adding more parameters keeps improving results (each parameter is another degree of freedom for overfitting)

**Defenses against overfitting:**

1. Limit parameters to 2–3 maximum.
2. Prefer parameter ranges over specific values (e.g., "fast MA between 8–15" all work well).
3. Use walk-forward analysis (next section).
4. Test on multiple symbols and time periods.
5. Apply out-of-sample testing — reserve 30% of data for final validation.

---

## Walk-Forward Validation

Walk-forward is the gold standard for strategy validation:

1. Open the **Walk-Forward** tab in the backtester.
2. Configure windows (e.g., 2 years in-sample, 6 months out-of-sample).
3. The engine optimizes on in-sample, then tests on out-of-sample, and slides forward.
4. Compare in-sample vs. out-of-sample performance.

**Interpretation:**

| Result | Conclusion |
|--------|------------|
| Out-of-sample ≈ In-sample | Strategy is robust — proceed to paper trading |
| Out-of-sample << In-sample | Overfitted — reduce parameters, simplify rules |
| Inconsistent across windows | Strategy is regime-dependent — add filters or discard |

---

## Paper Trading Phase

Before committing real capital:

1. Switch to paper trading mode (Settings → Trading → Paper Trading).
2. Run the strategy live for at least 1 month (or 50+ trades).
3. Compare live paper results to backtest expectations.
4. If results diverge significantly, investigate execution differences (slippage, data quality, timing).

Paper trading catches issues that backtesting can't — like execution delays and real-time data quirks.

---

## Deployment to Live

When paper trading confirms the backtest:

1. Start with **1/4 of target position size** for the first month.
2. Scale to 1/2 size if performance matches expectations.
3. Scale to full size after 3 months of consistent performance.
4. **Never scale up during a drawdown.** Wait for recovery to previous equity highs.

Monitor live performance daily and compare to backtest benchmarks. If live performance deviates more than 2 standard deviations from expected, pause and investigate.

---

## Tips

- **Kill bad ideas fast** — most ideas don't work. That's normal. Don't waste months on a losing thesis.
- **Simple strategies degrade slower** — complex strategies break when market conditions change.
- **Document everything** — write down your thesis, rules, and test results. Future you will thank present you.
- **Treat strategy development as science** — hypothesis → test → conclude. Not hope → trade → pray.
- **Re-validate quarterly** — market conditions change. Re-run backtests to confirm strategies still work.

---

*Next: [Advanced Charting](ADVANCED_CHARTING.md) for sophisticated chart analysis techniques.*
