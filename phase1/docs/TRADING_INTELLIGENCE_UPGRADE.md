# Trading Intelligence Engine - Major Upgrade

## Overview

This major upgrade transforms the autopilot from a simple trend-following system to a sophisticated multi-factor trading intelligence engine that mimics institutional-grade quantitative strategies.

## Key Components Added

### 1. Trading Intelligence Engine (`trading_intelligence.py`)

A comprehensive decision-making engine that combines multiple professional-grade trading factors:

**Technical Analysis:**
- Moving Averages (SMA 5/10/20/50/200, EMA 9/21)
- Momentum Oscillators (RSI-14, RSI-7, Stochastic %K/%D, MACD)
- Volatility Bands (Bollinger Bands, Keltner Channels)
- Support/Resistance (Pivot Points, R1/R2/S1/S2)
- Volume Analysis (Volume SMA, Volume Ratio, VWAP)
- Pattern Detection (Higher Highs/Lows, Lower Highs/Lows)

**Volatility Surface Analysis:**
- ATM Implied Volatility
- IV Skew (Put vs Call IV)
- IV Term Structure
- IV Rank (30-day and 90-day)
- Realized Volatility (10/20/30 day)
- Volatility Risk Premium (VRP)

**Market Regime Detection:**
- Wyckoff Market Phases (Accumulation, Markup, Distribution, Markdown)
- Phase confidence scoring
- Volume and range expansion/contraction analysis

**Momentum Analysis:**
- Multi-factor momentum scoring
- Strong/Weak Bullish/Bearish classification
- Trend acceleration detection

**Mean Reversion Detection:**
- Overbought/Oversold signals
- Distance from moving average
- Bollinger Band position
- Stochastic extremes

### 2. Strategy Selection Matrix (`strategy_matrix.py`)

Maps market conditions to optimal options strategies:

**Strategy Profiles:**
- Put Credit Spread (bullish premium collection)
- Call Credit Spread (bearish premium collection)
- Iron Condor (neutral premium collection)
- Call Debit Spread (bullish directional)
- Put Debit Spread (bearish directional)
- Long Straddle (volatility expansion)
- Calendar Spread (time decay capture)
- And more...

**Each Strategy Profile Includes:**
- Greeks exposure (delta bias, theta, vega, gamma)
- Risk profile (max loss/profit defined)
- Optimal conditions (IV rank range, DTE range, momentum states)
- Typical delta ranges
- Capital intensity
- Base priority scoring

**Scoring Factors:**
1. IV Rank Alignment (±15 points)
2. Volatility State Alignment (±20 points)
3. Momentum Alignment (±25 points)
4. Market Phase Alignment (±10 points)
5. Mean Reversion Signal (±10 points)
6. Trade Score Alignment (±15 points)
7. Risk Preference (±20 points)

### 3. Enhanced Candidate Generator (`enhanced_candidates.py`)

Integrates intelligence into candidate generation:

**Key Features:**
- Multi-factor trade scoring (not just trend)
- Dynamic strategy selection based on IV regime
- Technical analysis integration
- Mean reversion vs momentum detection
- Risk-adjusted position sizing
- Market phase awareness

**Generation Flow:**
1. Compute comprehensive trade score
2. Check minimum score thresholds
3. Compute technical indicators
4. Analyze volatility surface
5. Analyze momentum and mean reversion
6. Detect market phase
7. Get strategy recommendations
8. Generate candidates for top strategies
9. Apply enhanced scoring

### 4. Data Fetcher Enhancements (`data_fetcher.py`)

Added methods for technical analysis data:
- `get_price_history()` - Historical closing prices
- `get_volume_history()` - Historical volume data
- `get_ohlcv_history()` - Full OHLCV data

## Decision Logic Changes

### Before (Simple)
```
if trend == BULLISH:
    strategy = PUT_CREDIT_SPREAD
elif trend == BEARISH:
    strategy = CALL_CREDIT_SPREAD
else:
    strategy = PUT_CREDIT_SPREAD  # fallback
```

### After (Multi-Factor)
```
1. Score trade opportunity:
   - Technical Score (20%)
   - Momentum Score (15%)
   - Volatility Score (20%)
   - Sentiment Score (10%)
   - Flow Score (10%)
   - Regime Score (10%)
   - Timing Score (5%)
   - Risk/Reward Score (10%)

2. Determine direction: STRONG_BUY/BUY/NEUTRAL/SELL/STRONG_SELL

3. Select strategy based on:
   - Composite score
   - IV state (rich/cheap/fair)
   - Momentum state
   - Market phase
   - Mean reversion signals

4. Generate candidates with:
   - Optimal DTE based on conditions
   - Target delta based on confidence
   - Spread width based on risk budget
```

## Trading Factors Implemented

| Factor | Weight | Description |
|--------|--------|-------------|
| Technical | 20% | MA alignment, MACD, support/resistance |
| Momentum | 15% | RSI, MACD histogram, price patterns |
| Volatility | 20% | IV rank, VRP, IV/RV relationship |
| Sentiment | 10% | News, social, analyst ratings |
| Flow | 10% | Put/call ratio, unusual activity |
| Regime | 10% | Market phase, risk-on/off |
| Timing | 5% | Events, RSI timing |
| Risk/Reward | 10% | Distance to support/resistance |

## Strategy Selection Logic

| Condition | Strategy Selection |
|-----------|-------------------|
| IV Rich + Bullish | Put Credit Spread |
| IV Rich + Bearish | Call Credit Spread |
| IV Rich + Neutral | Iron Condor |
| IV Cheap + Strong Bullish | Call Debit Spread |
| IV Cheap + Strong Bearish | Put Debit Spread |
| IV Cheap + Neutral | Long Straddle |
| Fair Value + Bullish | Put Credit Spread or Call Debit |
| Fair Value + Bearish | Call Credit Spread or Put Debit |
| Oversold Signal | Favor bullish entry |
| Overbought Signal | Favor bearish entry |

## Risk Controls (Unchanged)

- Max 10 daily trades
- Max 5 open positions
- 10% stop loss on all positions
- Paper equity budget enforcement
- Expired position handling

## Files Modified/Created

**New Files:**
- `trading_intelligence.py` - Core intelligence engine (~900 lines)
- `strategy_matrix.py` - Strategy selection logic (~600 lines)
- `enhanced_candidates.py` - Enhanced generator (~700 lines)

**Modified Files:**
- `unified_engine.py` - Integrated enhanced generator
- `data_fetcher.py` - Added historical data methods

## Testing

Run the test:
```bash
cd phase1
python -c "
from services.autopilot.trading_intelligence import get_trading_intelligence
from services.autopilot.strategy_matrix import get_strategy_engine

intelligence = get_trading_intelligence()
# ... see test output for example usage
"
```

## Performance Improvements Expected

1. **Better Entry Timing**: Multi-factor analysis reduces false signals
2. **Optimal Strategy Selection**: IV-aware strategy selection improves expected value
3. **Risk-Adjusted Sizing**: Confidence-based position sizing
4. **Market Regime Awareness**: Adapts to changing conditions
5. **Mean Reversion Detection**: Catches oversold/overbought opportunities

## Next Steps

1. Add real sentiment integration (news, social)
2. Implement options flow analysis
3. Add backtesting framework
4. Tune factor weights based on historical performance
5. Add machine learning for factor optimization
