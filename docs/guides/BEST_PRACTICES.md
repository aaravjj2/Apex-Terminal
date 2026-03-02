# Trading Best Practices

> Disciplined workflows and risk management principles to trade consistently.

This guide isn't about specific strategies — it's about the habits, processes, and guardrails that separate consistent traders from gamblers. Use Apex Terminal's tools to enforce these principles.

---

## Table of Contents

1. [Risk Management Rules](#risk-management-rules)
2. [Position Sizing](#position-sizing)
3. [Journal Keeping](#journal-keeping)
4. [Screening Workflow](#screening-workflow)
5. [Alert-Driven Trading](#alert-driven-trading)
6. [Portfolio Diversification](#portfolio-diversification)
7. [Daily Routine](#daily-routine)
8. [Common Mistakes to Avoid](#common-mistakes-to-avoid)

---

## Risk Management Rules

Risk management is the single most important skill in trading. Follow these rules:

1. **Never risk more than 1–2% of your account on a single trade.** A string of losses is inevitable — small risk per trade ensures survival.
2. **Always use a stop-loss.** Every trade should have a predefined exit if it goes wrong. Bracket orders automate this.
3. **Set a daily loss limit.** If you lose 3–5% in a day, stop trading. Emotional decisions compound losses.
4. **Know your maximum drawdown tolerance.** If your portfolio drops 15%, reassess your approach before it gets worse.
5. **Risk/reward minimum of 1:2.** Only take trades where the potential reward is at least twice the risk.

Use Apex Terminal's risk limits (Settings → Risk Limits) to enforce these automatically.

> **Tip:** Configure the platform to block order submission when your daily loss limit is reached.

---

## Position Sizing

Calculate position size before every trade:

**Formula:** `Position Size = (Account × Risk%) / Stop Distance`

| Account Size | Risk (1%) | Stop Distance | Position Size |
|-------------|-----------|---------------|---------------|
| $50,000 | $500 | $5.00 | 100 shares |
| $50,000 | $500 | $2.50 | 200 shares |
| $100,000 | $1,000 | $10.00 | 100 shares |

Use the built-in Position Sizer (Tools → Position Sizer) to calculate this automatically.

- **Never size based on how much you want to make** — size based on how much you're willing to lose.
- **Reduce size during drawdowns** — if you're in a losing streak, cut position sizes in half.
- **Scale into winners** — add to profitable positions cautiously, never to losers.

---

## Journal Keeping

The Trade Journal in Apex Terminal records every trade. Use it to:

1. **Log the reason for every trade.** What setup did you see? What was your thesis?
2. **Record emotions.** Were you anxious, confident, FOMO-driven? Emotional patterns predict mistakes.
3. **Review weekly.** Look for patterns in your winners and losers. Are you better with certain setups, times, or market conditions?
4. **Tag trades.** Use tags like "breakout", "mean-reversion", "earnings" to filter and analyze by strategy.
5. **Track metrics over time.** Win rate, average P&L, expectancy, and Sharpe ratio — are they improving?

Access the journal via `Ctrl+K` → `journal` or the sidebar.

![Trade Journal](../assets/screenshots/trade-journal.png)

> **Tip:** Spend 10 minutes every Friday reviewing your journal. Traders who journal improve faster than those who don't.

---

## Screening Workflow

A disciplined screening process prevents impulsive trades:

1. **Define your universe.** Use the screener to filter for your target market cap, sector, and liquidity.
2. **Apply fundamental filters.** Narrow to stocks with the financial characteristics you seek.
3. **Apply technical filters.** Overlay technical conditions (e.g., RSI, moving average position).
4. **Create a watchlist.** Add screener results to a focused watchlist of 10–20 candidates.
5. **Set alerts.** Configure price and indicator alerts on watchlist symbols.
6. **Wait for the alert.** Don't force entries — let the market come to you.

This process transforms trading from reactive to systematic.

---

## Alert-Driven Trading

Replace screen-watching with alert-based execution:

1. **Screen for candidates** using the screener (weekly or daily).
2. **Set technical alerts** at your entry levels (support/resistance, indicator thresholds).
3. **When an alert triggers**, evaluate the setup in context — don't blindly trade the alert.
4. **Execute with a plan.** Entry, stop-loss, and target should all be predefined.
5. **Set exit alerts** if you prefer manual exits over bracket orders.

Benefits:
- Reduces screen time and emotional fatigue
- Eliminates FOMO — you only trade setups you've pre-planned
- Works across multiple symbols simultaneously

---

## Portfolio Diversification

Diversification reduces risk without necessarily reducing returns:

- **Across sectors:** Don't put everything in tech. Spread across 4–6 sectors.
- **Across asset classes:** Combine equities, bonds (or bond proxies), and alternatives.
- **Across time horizons:** Mix short-term trades with longer-term positions.
- **Across strategies:** Run multiple uncorrelated strategies (e.g., momentum + mean-reversion).
- **Position limits:** No single position should exceed 10% of your portfolio.

Use the Portfolio module's allocation view and correlation matrix to verify diversification.

> **Tip:** If all your positions are correlated > 0.7, you effectively have one big bet. Diversify.

---

## Daily Routine

A structured routine prevents reactive, emotional decisions:

| Time | Activity | Apex Terminal Tool |
|------|----------|-------------------|
| Pre-market | Review overnight news, check futures | News panel, Economic Calendar |
| Market open | Check watchlist alerts, review positions | Alerts, Watchlist |
| Mid-session | Monitor active trades, adjust stops | Order Blotter, Charts |
| End of day | Review closed trades, journal entries | Trade Journal |
| Weekly | Review journal, run screener, rebalance | Journal, Screener, Portfolio |

---

## Common Mistakes to Avoid

| Mistake | Why It Hurts | Fix |
|---------|-------------|-----|
| No stop-loss | Single trade can wipe out weeks of gains | Always use bracket orders |
| Overtrading | Commissions and slippage erode edge | Set maximum trades per day |
| Averaging down | Adding to losers increases risk | Cut losers, ride winners |
| Ignoring the journal | Can't improve what you don't measure | Review weekly |
| Oversizing | One bad trade creates a painful drawdown | Use the position sizer |
| Revenge trading | Trying to "get back" losses leads to bigger losses | Set daily loss limit |
| Ignoring correlation | Perceived diversification is actually concentration | Check correlation matrix |
| Trading without a plan | Impulsive entries with no exit strategy | Pre-define entry, stop, target |

---

*Next: [Strategy Guide](STRATEGY_GUIDE.md) for developing and validating trading strategies.*
