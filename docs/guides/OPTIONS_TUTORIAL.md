# Options Trading Guide

> Analyze options chains, compute Greeks, build multi-leg strategies, and visualize payoff diagrams.

Apex Terminal provides a full options analytics suite powered by Black-Scholes pricing. This tutorial walks you through reading the options chain, understanding Greeks, and constructing strategies.

---

## Table of Contents

1. [Accessing the Options Module](#accessing-the-options-module)
2. [Understanding the Options Chain](#understanding-the-options-chain)
3. [Reading the Greeks](#reading-the-greeks)
4. [Selecting Expiration Dates](#selecting-expiration-dates)
5. [Building Multi-Leg Strategies](#building-multi-leg-strategies)
6. [Analyzing Payoff Diagrams](#analyzing-payoff-diagrams)
7. [Risk Management for Options](#risk-management-for-options)
8. [Tips and Best Practices](#tips-and-best-practices)

---

## Accessing the Options Module

Open the options panel via:

- **Command bar:** `Ctrl+K` → type `options`
- **Sidebar:** Click the options icon (chain-link symbol)
- **Chart context:** Right-click a symbol → **Options Chain**

The module opens as a resizable panel showing the chain, Greeks, and payoff visualizer.

---

## Understanding the Options Chain

The options chain displays calls on the left and puts on the right, centered on strike prices:

| Column | Description |
|--------|-------------|
| Bid / Ask | Current market prices |
| Last | Most recent trade price |
| Volume | Number of contracts traded today |
| Open Interest | Total outstanding contracts |
| IV | Implied volatility for the strike |
| Strike | Exercise price |

In-the-money strikes are highlighted. The at-the-money strike is bold.

![Options Chain](../assets/screenshots/options-chain.png)

> **Tip:** Click any column header to sort. Click the IV column to quickly find volatility skew.

---

## Reading the Greeks

Each option displays five Greeks computed via the Black-Scholes model:

| Greek | Symbol | Measures |
|-------|--------|----------|
| **Delta** | Δ | Price sensitivity to $1 move in the underlying |
| **Gamma** | Γ | Rate of change of Delta |
| **Theta** | Θ | Daily time decay (how much value erodes per day) |
| **Vega** | ν | Sensitivity to 1% change in implied volatility |
| **Rho** | ρ | Sensitivity to 1% change in interest rates |

Toggle Greeks visibility from the chain header. Hover over any Greek value for a tooltip with interpretation guidance.

> **Note:** The platform uses the risk-free rate from the configured data source. Override it in Settings → Options → Risk-Free Rate.

---

## Selecting Expiration Dates

1. The expiration picker is at the top of the options chain.
2. Expirations are grouped by: Weekly, Monthly, Quarterly, LEAPS.
3. Click an expiration to load its chain. The days-to-expiry (DTE) is shown next to each date.
4. Use the **Term Structure** view to compare IV across expirations.

For multi-leg strategies, you can select contracts across different expirations (calendar and diagonal spreads).

---

## Building Multi-Leg Strategies

1. Click **Strategy Builder** at the top of the options panel.
2. Select a preset strategy or build custom:

| Strategy | Legs | Use Case |
|----------|------|----------|
| Vertical Spread | 2 | Directional with limited risk |
| Iron Condor | 4 | Range-bound, collect premium |
| Straddle | 2 | Expect large move, direction unknown |
| Strangle | 2 | Similar to straddle, cheaper |
| Butterfly | 3–4 | Low-cost, pinning a strike |
| Calendar Spread | 2 | Exploit time decay differences |
| Collar | 2 + stock | Hedge existing position |

3. Click contracts in the chain to add legs. Each leg shows direction (buy/sell), quantity, and strike.
4. Adjust ratios if needed (e.g., ratio spreads).
5. The net cost/credit updates in real time.

![Strategy Builder](../assets/screenshots/options-strategy-builder.png)

---

## Analyzing Payoff Diagrams

Once a strategy is built, the payoff diagram appears below:

- **X-axis:** Underlying price at expiration
- **Y-axis:** Profit / loss
- **Breakeven points** are marked on the x-axis
- **Max profit** and **max loss** are labeled
- A slider lets you view projected P&L at different dates before expiration (theta decay effect)

Toggle between **At Expiration** and **Current** views to see how time and IV changes affect the position.

![Payoff Diagram](../assets/screenshots/options-payoff.png)

---

## Risk Management for Options

Key risk controls built into the platform:

- **Position sizing:** The platform calculates maximum loss for any strategy and warns if it exceeds your risk threshold.
- **Greek exposure:** View net portfolio Greeks (Delta, Gamma, Theta, Vega) across all options positions.
- **IV alerts:** Set alerts when implied volatility reaches a threshold (useful before earnings).
- **Margin requirements:** Estimated margin for naked or complex positions is shown before submission.

> **Warning:** Selling naked options carries theoretically unlimited risk. Always understand your maximum loss before entering a trade.

---

## Tips and Best Practices

- **Check IV rank** before entering — high IV favors premium selling, low IV favors buying.
- **Mind the spread** — wide bid-ask spreads on illiquid options erode edge quickly.
- **Use the payoff diagram** — never enter a multi-leg strategy without visualizing the outcome.
- **Monitor Theta** — time decay accelerates in the final 30 days to expiration.
- **Diversify expirations** — don't concentrate all positions on a single expiry date.
- **Start simple** — master verticals before moving to iron condors and butterflies.

---

*Next: [Portfolio Tutorial](PORTFOLIO_TUTORIAL.md) to manage and optimize your holdings.*
