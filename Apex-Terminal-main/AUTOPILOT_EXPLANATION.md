# Autopilot System - Complete Explanation

This document explains the entire Autopilot trading system in detail, covering all components, strategies, data flows, and decision-making processes.

---

## Table of Contents
1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Data Sources](#data-sources)
4. [Sentiment Analysis Pipeline](#sentiment-analysis-pipeline)
5. [Candidate Generation](#candidate-generation)
6. [Selection Process](#selection-process)
7. [Order Execution](#order-execution)
8. [Monitoring & Exit Management](#monitoring--exit-management)
9. [Risk Management](#risk-management)
10. [WebSocket Real-Time Updates](#websocket-real-time-updates)

---

## System Overview

The Autopilot is an autonomous trading system that:
- Analyzes market conditions using multiple data sources
- Generates trade candidates based on technical and sentiment factors
- Uses AI (Groq + Gemini) to rank and select the best opportunities
- Executes trades through Alpaca (paper or live trading)
- Monitors positions and exits based on configurable rules

**Key Principle**: The system is designed to think like a human trader but operate faster and more consistently, combining quantitative factors with AI reasoning.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                │
│   React Dashboard → WebSocket → Real-time Updates              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      BACKEND API (FastAPI)                      │
│   /health → /api/v1/autopilot/* → WebSocket /ws/autopilot      │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐   ┌─────────────────┐   ┌─────────────────┐
│   AUTOPILOT   │   │   UNIFIED       │   │   BROKER        │
│   SERVICE     │   │   ENGINE        │   │   ADAPTER       │
│   (Scheduler) │   │   (Brain)       │   │   (Alpaca)      │
└───────────────┘   └─────────────────┘   └─────────────────┘
```

### Components

1. **Autopilot Service**: Manages the main loop, scheduling, and background monitoring
2. **Unified Engine**: The "brain" that orchestrates each trading cycle
3. **Broker Adapter**: Connects to Alpaca for account info, order submission, position tracking

---

## Data Sources

The system aggregates data from multiple providers for comprehensive market analysis:

| Provider | Data Type | Purpose |
|----------|-----------|---------|
| **Alpaca** | Real-time quotes, positions, orders | Trading execution and account state |
| **yfinance** | Historical prices, fundamentals | Volatility calculation, price data |
| **Finnhub** | News articles, sentiment scores | Market and company sentiment |
| **Tradier** | Options chains, streaming quotes | Options data (when trading options) |

### Data Flow
```
Market Data → Data Fetcher → Feature Calculator → Candidates
                   ↓
            News Provider → Sentiment Engine → Sentiment Score
```

---

## Sentiment Analysis Pipeline

The system uses an **Ensemble Sentiment Engine** combining three sources:

### 1. Finnhub API (Weight: 30%)
- Fetches company-specific news
- Returns pre-calculated sentiment (bullish %, bearish %)
- Provides article count and buzz metrics

### 2. FinBERT (Weight: 40%)
- Local ML model: `ProsusAI/finbert`
- BERT fine-tuned on 10,000+ financial phrases
- Analyzes headlines word-by-word for financial sentiment
- Returns: positive/negative/neutral with confidence score

### 3. FinGPT (Weight: 30%)
- Local ML model or Groq API fallback
- Specialized for financial text understanding
- Provides contextual sentiment analysis

### Ensemble Scoring
```
Final Score = (Finnhub × 0.30 × conf) + (FinBERT × 0.40 × conf) + (FinGPT × 0.30 × conf)
                                    ────────────────────────────────────────────────────
                                                    Total Weighted Confidence
```

### Sentiment Buckets
| Score Range | Bucket |
|-------------|--------|
| ≥ 0.40 | Very Bullish |
| 0.10 to 0.39 | Bullish |
| -0.09 to 0.09 | Neutral |
| -0.39 to -0.10 | Bearish |
| ≤ -0.40 | Very Bearish |

---

## Candidate Generation

Each trading cycle generates candidates through a multi-step process:

### Step 1: Universe Selection
- Start with a watchlist of symbols (configurable)
- Default universe: SPY, QQQ, AAPL, MSFT, GOOGL, AMZN, etc.

### Step 2: Feature Calculation
For each symbol, calculate:

| Feature | Description | How Calculated |
|---------|-------------|----------------|
| **ADX** | Trend strength | Average Directional Index (14-period) |
| **ATR Ratio** | Volatility measure | Current ATR / Average ATR |
| **MA Alignment** | Trend direction | Relationship of 20/50/200 moving averages |
| **RSI** | Momentum | Relative Strength Index (14-period) |
| **Volume Ratio** | Activity | Current volume / 20-day average |
| **Liquidity Score** | Tradability | Bid-ask spread + volume analysis |

### Step 3: Regime Classification
The market is classified into one of:
- **TREND**: Strong directional movement (ADX > 25)
- **RANGE**: Sideways, mean-reverting (ADX < 20)
- **VOLATILE**: High uncertainty (ATR expanding)

### Step 4: Candidate Scoring
```
Base Score = (Trend Score × Regime Weight) + (Momentum Score) + (Volatility Adjustment)
Risk Score = Position Size / Max Risk per Trade
Final Score = Base Score × Sentiment Multiplier × Liquidity Factor
```

---

## Selection Process

### Hybrid LLM Selection (Groq + Gemini)

The system uses two AI models in sequence:

#### Phase 1: Groq (Fast Ranking)
- Model: Mixtral 8x7B (32K context)
- Task: Quickly rank all candidates by probability of success
- Output: Top K candidates with preliminary scores

#### Phase 2: Gemini (Validation & Explanation)
- Model: Gemini 1.5 Flash
- Task: Deep analysis of top candidates
- Validates Groq's recommendations
- Provides human-readable explanations for each selection
- May reject candidates that don't meet criteria

### Selection Criteria
The AI considers:
1. Technical setup quality
2. Risk/reward ratio
3. Market regime alignment
4. Sentiment confirmation
5. Position sizing constraints
6. Correlation with existing positions

---

## Order Execution

### Order Types
- **Market Orders**: For immediate entry (default for equities)
- **Limit Orders**: For precise entry (configurable)

### Position Sizing
```
Position Size = (Max Risk per Trade) / (Entry Price × Stop Distance %)
```

Constraints:
- Maximum dollar value per trade
- Maximum percentage of buying power
- No more than X trades per day

### Order Flow
```
Selected Candidate → Position Sizer → Order Builder → Broker Submit
                                                           ↓
                                              Order Status Tracking
                                                           ↓
                                              WebSocket Broadcast
```

---

## Monitoring & Exit Management

### Continuous Monitoring Loop
A background task runs every 30 seconds to:
1. Check all open positions
2. Evaluate exit conditions
3. Execute exits when triggered

### Exit Conditions

| Exit Type | Trigger | Priority |
|-----------|---------|----------|
| **Stop Loss** | Price hits stop level | High |
| **Take Profit** | Price hits target | High |
| **Time Stop** | Position held > max duration | Medium |
| **Trailing Stop** | Price retraces from peak | Medium |
| **Sentiment Shift** | Sentiment turns against position | Low |
| **Kill Switch** | Manual emergency exit | Immediate |

### Exit Signal Sources
- Price-based: Comparing current price to entry + strategy rules
- Time-based: Trading hours, session end
- Manual: Dashboard kill switch button

---

## Risk Management

### Position-Level Controls
- Maximum risk per trade (e.g., $50)
- Stop loss required for every position
- Position size calculated from risk budget

### Portfolio-Level Controls
| Control | Description | Default |
|---------|-------------|---------|
| Max Open Risk | Total $ at risk across all positions | $400 |
| Max Trades/Day | Limit on new positions opened | 10 |
| Max Daily Loss | Stop trading after this loss | $30 |
| Max Correlation | Avoid similar positions | 0.7 |

### Circuit Breakers
1. **Daily Loss Limit**: Stops all trading if daily P&L exceeds threshold
2. **Kill Switch**: Manual button to close all positions immediately
3. **Market Hours Gate**: Only trades during regular market hours (9:30 AM - 4:00 PM ET)

---

## WebSocket Real-Time Updates

### Connection Management
- Heartbeat every 15 seconds
- Auto-reconnect with exponential backoff (1s → 30s max)
- Maximum 50 reconnection attempts
- Visibility change detection (reconnects when tab becomes active)

### Event Types Broadcast

| Event | When | Data |
|-------|------|------|
| `CONNECTED` | Initial connection | Confirmation message |
| `HEARTBEAT` | Every 15s | Timestamp, connection count |
| `STATUS_UPDATE` | Phase changes | Current phase, progress |
| `THINK_LOG` | AI reasoning | Decision explanations |
| `CYCLE_COMPLETE` | Cycle ends | Summary, orders, stats |
| `POSITIONS_UPDATE` | Position changes | Updated positions list |
| `EXIT_EXECUTED` | Exit triggers | Exit details, P&L |

### Dashboard Integration
The frontend subscribes to these events and updates:
- Connection status indicator (green/yellow/red)
- Live think log panel
- Positions table
- Orders table
- Event log

---

## Cycle Phases

A complete autopilot cycle goes through these phases:

```
1. INIT        → Load configuration, check credentials
2. MONITORING  → Check existing positions for exits (isolated, won't block)
3. FETCHING    → Get market data, news, prices
4. ANALYZING   → Calculate features, regime, sentiment
5. GENERATING  → Create trade candidates
6. SELECTING   → AI ranks and selects best candidates
7. EXECUTING   → Submit orders to broker
8. REPORTING   → Log results, broadcast completion
```

### Phase Resilience
- Each phase has error handling
- MONITORING phase is isolated (errors don't stop cycle)
- Failed phases are logged but cycle continues when possible

---

## Configuration Options

The system is highly configurable via the dashboard settings:

### Trading Parameters
- Max risk per trade
- Max open positions
- Allowed symbols/sectors
- Trading schedule

### Strategy Parameters
- Regime thresholds
- Indicator periods
- Entry/exit rules
- Position sizing method

### AI Parameters
- LLM provider (Groq/Gemini/both)
- Temperature (creativity vs consistency)
- Maximum candidates to analyze

---

## Summary

The Autopilot system is a sophisticated trading engine that:

1. **Gathers** multi-source data (prices, news, sentiment)
2. **Analyzes** using technical indicators and ML sentiment
3. **Selects** using AI with human-like reasoning
4. **Executes** through regulated brokers
5. **Monitors** continuously for exit signals
6. **Reports** via real-time WebSocket updates

The system is designed to be:
- **Transparent**: Every decision is logged and explained
- **Safe**: Multiple risk controls at every level
- **Flexible**: Highly configurable to match trading style
- **Reliable**: Robust error handling and reconnection logic
