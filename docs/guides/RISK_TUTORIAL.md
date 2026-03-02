# Understanding Risk Metrics

> Measure, monitor, and manage portfolio risk with VaR, stress testing, and drawdown analysis.

Risk management is the foundation of sustainable trading. Apex Terminal provides institutional-grade risk analytics so you can quantify exposure, set limits, and avoid catastrophic losses.

---

## Table of Contents

1. [Accessing Risk Analytics](#accessing-risk-analytics)
2. [Value at Risk (VaR)](#value-at-risk-var)
3. [Stress Testing](#stress-testing)
4. [Drawdown Analysis](#drawdown-analysis)
5. [Position Sizing](#position-sizing)
6. [Correlation Analysis](#correlation-analysis)
7. [Setting Risk Limits](#setting-risk-limits)
8. [Tips](#tips)

---

## Accessing Risk Analytics

- **Command bar:** `Ctrl+K` → type `risk`
- **Sidebar:** Click the shield icon
- **Portfolio view:** Switch to the **Risk** tab within the portfolio panel

![Risk Dashboard](../assets/screenshots/risk-dashboard.png)

---

## Value at Risk (VaR)

VaR answers: *"What is the maximum I could lose over a given period at a given confidence level?"*

### How It Works

Apex Terminal computes VaR using three methods:

| Method | Approach |
|--------|----------|
| **Historical** | Uses actual past return distribution |
| **Parametric** | Assumes normal distribution with estimated mean and volatility |
| **Monte Carlo** | Simulates thousands of price paths from fitted distributions |

### Reading the VaR Panel

- **1-day VaR (95%)** — "There is a 95% chance that the portfolio won't lose more than $X in a single day."
- **10-day VaR** — Same concept scaled to a 10-day holding period.
- **CVaR (Conditional VaR)** — The expected loss in the worst 5% of scenarios. Always larger than VaR.

Configure the confidence level (90%, 95%, 99%) and holding period from the settings gear in the panel header.

![VaR Chart](../assets/screenshots/var-chart.png)

> **Note:** VaR underestimates risk during extreme events (fat tails). Use CVaR and stress tests as complements.

---

## Stress Testing

Simulate portfolio performance under extreme scenarios:

1. Open the **Stress Test** tab in the risk panel.
2. Choose from preset scenarios or define custom ones:

| Preset Scenario | What It Simulates |
|----------------|-------------------|
| 2008 Financial Crisis | Credit collapse, equity -50% |
| 2020 COVID Crash | Rapid sell-off, VIX spike |
| Rate Shock +200bps | Sharp interest rate increase |
| Oil Crisis | Energy sector collapse |
| Custom | Define your own asset shocks |

3. For custom scenarios, enter percentage shocks for each asset class or factor.
4. Click **Run Stress Test**. Results show projected portfolio P&L under each scenario.

![Stress Test Results](../assets/screenshots/stress-test.png)

> **Tip:** Run stress tests after every major allocation change to ensure you can withstand worst-case events.

---

## Drawdown Analysis

The drawdown chart shows peak-to-trough declines over time:

- **Current drawdown** — how far the portfolio is below its all-time high
- **Maximum drawdown** — the largest historical decline
- **Average drawdown** — typical decline depth
- **Drawdown duration** — how long it takes to recover to a new high

Hover over the drawdown chart to see exact values at any point in time.

| Metric | Interpretation |
|--------|---------------|
| Max DD < 10% | Conservative risk profile |
| Max DD 10–20% | Moderate risk profile |
| Max DD > 20% | Aggressive risk profile |

---

## Position Sizing

The position sizer calculates how much to allocate based on your risk tolerance:

1. Open **Tools → Position Sizer** or use the risk panel.
2. Enter your risk parameters:
   - **Account size** — total portfolio value
   - **Risk per trade** — percentage of account you're willing to lose (typically 1–2%)
   - **Stop-loss distance** — how far your stop is from entry price
3. The calculator outputs the maximum position size in shares and dollar value.

**Formula:** Position Size = (Account × Risk%) / Stop Distance

> **Warning:** Never risk more than 2% of your portfolio on a single trade. Consecutive losses are inevitable.

---

## Correlation Analysis

The correlation matrix shows how your holdings move relative to each other:

- **+1.0** — perfect positive correlation (move together)
- **0.0** — no correlation (independent)
- **−1.0** — perfect negative correlation (move opposite)

The heatmap uses color intensity to highlight strong correlations. Click any cell to see the rolling correlation chart over time.

![Correlation Matrix](../assets/screenshots/correlation-matrix.png)

> **Tip:** Aim for a portfolio where most pairs have correlations below 0.5. High correlation = concentrated risk.

---

## Setting Risk Limits

Configure automated risk guardrails:

1. Go to **Settings → Risk Limits**.
2. Set thresholds:

| Limit | Example |
|-------|---------|
| Max position size | 10% of portfolio |
| Max sector exposure | 25% of portfolio |
| Daily loss limit | -3% of portfolio |
| Max open positions | 15 |
| Max single-trade risk | 2% of account |

3. When a limit is breached, the platform displays a warning and can optionally block order submission.

---

## Tips

- **VaR is a minimum expectation of loss** — actual losses in a crisis will exceed VaR.
- **Stress test regularly** — market conditions change, and yesterday's safe portfolio may not be today's.
- **Diversify based on correlation** — not just by counting positions, but by ensuring low correlations.
- **Size positions before entry** — calculate your position size before opening the order ticket.
- **Review drawdowns weekly** — if current drawdown approaches your maximum tolerance, reduce exposure.

---

*Next: [Screener Tutorial](SCREENER_TUTORIAL.md) to find trading opportunities.*
