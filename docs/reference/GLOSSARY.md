# Financial Terms Glossary

> Definitions for terminology used throughout the Apex Terminal platform.

## Table of Contents

- [Trading & Execution](#trading--execution)
- [Options](#options)
- [Risk & Performance](#risk--performance)
- [Portfolio Management](#portfolio-management)
- [Technical Analysis](#technical-analysis)
- [Market Structure](#market-structure)
- [Data & Pricing](#data--pricing)

---

## Trading & Execution

| Term | Definition |
|------|-----------|
| **Ask** (Offer) | Lowest price a seller will accept for a security. |
| **Bid** | Highest price a buyer will pay for a security. |
| **Spread** | Difference between bid and ask prices. Tighter spreads indicate higher liquidity. |
| **Slippage** | Difference between the expected execution price and the actual fill price, caused by market movement or low liquidity. |
| **Fill** | Completion of an order at a specific price and quantity. |
| **Partial Fill** | Order executed for less than the requested quantity. |
| **Market Order** | Order to buy/sell immediately at the best available price. |
| **Limit Order** | Order to buy/sell at a specified price or better. |
| **Stop Order** | Order that becomes a market order when the stop price is reached. |
| **Stop-Limit Order** | Becomes a limit order (not market) when the stop price is reached. |
| **GTC** (Good Till Cancelled) | Order remains active until filled or manually cancelled. |
| **DAY** | Order expires at end of trading day if not filled. |
| **IOC** (Immediate or Cancel) | Fill as much as possible immediately; cancel any unfilled portion. |
| **FOK** (Fill or Kill) | Fill the entire quantity immediately or cancel the whole order. |
| **VWAP Order** | Algorithm that executes to match the Volume Weighted Average Price over a period. |
| **TWAP Order** | Algorithm that spreads execution evenly over a time window. |
| **Liquidity** | Ease with which a security can be bought or sold without impacting its price. |
| **Depth of Market** | Volume of buy and sell orders at each price level in the order book. |

---

## Options

| Term | Definition |
|------|-----------|
| **Call** | Contract giving the holder the right to buy the underlying at the strike price. |
| **Put** | Contract giving the holder the right to sell the underlying at the strike price. |
| **Strike Price** | Predetermined price at which the option can be exercised. |
| **Expiration** | Date on which the option contract ceases to exist. |
| **Premium** | Price paid to purchase an option contract. |
| **Intrinsic Value** | Amount by which an option is in-the-money: `max(S − K, 0)` for calls. |
| **Extrinsic Value** | Option premium minus intrinsic value, reflecting time and volatility. |
| **In-the-Money (ITM)** | Call: S > K. Put: S < K. Option has intrinsic value. |
| **At-the-Money (ATM)** | Strike price ≈ current underlying price. |
| **Out-of-the-Money (OTM)** | Call: S < K. Put: S > K. No intrinsic value. |
| **Implied Volatility (IV)** | Market's forecast of the underlying's future volatility, derived from option prices. |
| **Historical Volatility** | Realized standard deviation of returns over a past period. |
| **Delta** | Rate of change of option price per $1 move in the underlying. |
| **Gamma** | Rate of change of delta per $1 move in the underlying. |
| **Theta** | Rate of option value decay per day, all else equal. |
| **Vega** | Sensitivity of option price to a 1% change in implied volatility. |
| **Rho** | Sensitivity of option price to a 1% change in the risk-free rate. |
| **IV Crush** | Sharp drop in implied volatility after an anticipated event (e.g., earnings). |
| **Volatility Smile/Skew** | Pattern where OTM puts and calls have higher IV than ATM options. |
| **Options Chain** | Table displaying all available options for a security, organized by expiry and strike. |

---

## Risk & Performance

| Term | Definition |
|------|-----------|
| **Value at Risk (VaR)** | Maximum expected loss at a given confidence level over a specified period. |
| **CVaR / Expected Shortfall** | Average loss in scenarios exceeding the VaR threshold. |
| **Sharpe Ratio** | Excess return per unit of total risk: `(Rₚ − Rᶠ) / σₚ`. |
| **Sortino Ratio** | Excess return per unit of downside risk. |
| **Treynor Ratio** | Excess return per unit of systematic risk (beta). |
| **Information Ratio** | Active return relative to tracking error vs a benchmark. |
| **Alpha** | Portfolio return exceeding what CAPM predicts, given its beta. |
| **Beta** | Sensitivity of portfolio returns to market returns. |
| **Maximum Drawdown** | Largest peak-to-trough decline in portfolio value. |
| **Drawdown Duration** | Time from peak to recovery back to previous high. |
| **Calmar Ratio** | Annualized return divided by maximum drawdown. |
| **Standard Deviation** | Statistical measure of return dispersion around the mean. |
| **Correlation** | Degree to which two assets move together (−1 to +1). |
| **R-squared** | Proportion of portfolio variance explained by the benchmark. |
| **Tracking Error** | Standard deviation of the difference between portfolio and benchmark returns. |

---

## Portfolio Management

| Term | Definition |
|------|-----------|
| **Allocation** | Distribution of capital across asset classes, sectors, or securities. |
| **Rebalancing** | Adjusting holdings to restore target allocation weights. |
| **Diversification** | Spreading risk by holding uncorrelated assets. |
| **Attribution** | Decomposing portfolio return into allocation, selection, and interaction effects. |
| **Benchmark** | Reference index used to evaluate portfolio performance (e.g., S&P 500). |
| **NAV** (Net Asset Value) | Total value of portfolio assets minus liabilities. |
| **Turnover** | Proportion of the portfolio that changes over a period. |
| **Concentration** | Degree to which portfolio weight is focused on few holdings. |
| **Yield** | Income return (dividends + interest) as a percentage of portfolio value. |
| **Total Return** | Price appreciation plus income, expressed as a percentage. |

---

## Technical Analysis

| Term | Definition |
|------|-----------|
| **Support** | Price level where buying interest is strong enough to prevent further decline. |
| **Resistance** | Price level where selling pressure prevents further advance. |
| **Breakout** | Price moving above resistance or below support with increased volume. |
| **Breakdown** | Bearish breakout below a support level. |
| **Trend** | General direction of price movement: uptrend, downtrend, or sideways. |
| **Consolidation** | Period of sideways trading within a defined range after a move. |
| **Divergence** | When price makes a new high/low but an indicator does not confirm it. |
| **Overbought** | Condition where price has risen too quickly and may be due for a pullback. |
| **Oversold** | Condition where price has dropped too quickly and may be due for a bounce. |
| **Moving Average Crossover** | Signal when a shorter MA crosses above/below a longer MA. |
| **Volume Confirmation** | Validating a price move with above-average trading volume. |
| **Gap** | Price region where no trading occurs between consecutive sessions. |
| **Candlestick** | Chart element showing open, high, low, close for a time period. |

---

## Market Structure

| Term | Definition |
|------|-----------|
| **Exchange** | Organized marketplace for trading securities (NYSE, NASDAQ, etc.). |
| **Market Maker** | Firm that continuously quotes bid/ask prices to provide liquidity. |
| **Dark Pool** | Private trading venue where orders are not publicly displayed. |
| **Circuit Breaker** | Mechanism that halts trading when an index falls by a threshold percentage. |
| **Settlement** | Process of delivering securities and payment after a trade (T+1 for US equities). |
| **Clearing** | Intermediary process ensuring both sides of a trade fulfill obligations. |
| **Regulation** | Government rules governing market participants (SEC, FINRA in the US). |

---

## Data & Pricing

| Term | Definition |
|------|-----------|
| **OHLCV** | Open, High, Low, Close, Volume — standard bar data fields. |
| **Tick** | Smallest possible price movement for a security. |
| **Typical Price** | `(High + Low + Close) / 3`, used in many indicator calculations. |
| **Adjusted Close** | Closing price modified for splits and dividends to maintain continuity. |
| **Mark Price** | Theoretical fair value used for margin and P&L calculations. |
| **Last Price** | Most recent trade price. |
| **Pre-Market / After-Hours** | Trading sessions outside regular market hours with reduced liquidity. |

---

*This glossary is referenced throughout Apex Terminal's documentation and tooltip system.*
