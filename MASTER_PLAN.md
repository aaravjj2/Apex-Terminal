# Master Plan: Industrial-Grade Autonomous Options Autopilot

**Complete Strategic & Technical Reference**  
**Date**: 2026-01-16  
**End Goal**: User clicks "Start" → System trades options 100% autonomously, profitably

---

## Table of Contents
1. [Vision & End Goal](#1-vision--end-goal)
2. [Autonomous Lifecycle](#2-autonomous-lifecycle)
3. [AI Decision Engine](#3-ai-decision-engine)
4. [Entry Scoring Algorithm](#4-entry-scoring-algorithm)
5. [Exit Decision Logic](#5-exit-decision-logic)
6. [News & Sentiment Integration](#6-news--sentiment-integration)
7. [Model Quality Assurance](#7-model-quality-assurance)
8. [Backtesting & Simulation](#8-backtesting--simulation)
9. [Portfolio Greeks Management](#9-portfolio-greeks-management)
10. [Data Pipeline](#10-data-pipeline)
11. [Backend Infrastructure](#11-backend-infrastructure)
12. [Edge Case Handling](#12-edge-case-handling)
13. [n8n Orchestration](#13-n8n-orchestration)
14. [Implementation Roadmap](#14-implementation-roadmap)

---

## 1. Vision & End Goal

### The One-Click Experience
```
┌─────────────────────────────────────────────────────────────┐
│                   USER DASHBOARD                            │
│                                                             │
│         [ 🚀 START AUTOPILOT ]                              │
│                                                             │
│   Status: ● Running                                         │
│   Mode: Paper Trading                                       │
│   Today's P&L: +$1,247.50                                  │
│   Open Positions: 4                                         │
│   Win Rate (30d): 68%                                      │
│                                                             │
│   Last Action: "Opened AAPL 180/175P - 45 DTE"             │
│   Next Scan: in 12 minutes                                  │
│                                                             │
│   That's it. User does NOTHING else.                        │
└─────────────────────────────────────────────────────────────┘
```

### Division of Responsibilities
| User Does (Once) | System Does (24/7) |
|------------------|-------------------|
| Configure broker API keys | Monitor market hours |
| Set risk level (conservative/balanced/aggressive) | Scan for opportunities |
| Set account size | Make AI-validated decisions |
| Click "Start Autopilot" | Execute trades via broker |
| (Optionally) View dashboard | Manage positions |
| | Handle exits (profit/loss/time) |
| | Handle errors and edge cases |
| | Generate daily/weekly reports |
| | Learn and improve continuously |

### Success Metrics
| Metric | Target | Measurement |
|--------|--------|-------------|
| Autonomous Runtime | 99%+ | Hours without manual intervention |
| Win Rate | >50% | Profitable trades / total trades |
| Sharpe Ratio | >1.0 | Risk-adjusted returns |
| Max Drawdown | <20% | Worst peak-to-trough |
| Error Recovery | <5 min | Time to recover from failures |

---

## 2. Autonomous Lifecycle

### Daily Schedule (Eastern Time)
```
4:00 AM   ┌─ WAKE UP
          │  • Start data feeds
          │  • Verify broker connectivity
          │  • Load configuration
          │
8:00 AM   ├─ PRE-MARKET PREP
          │  • Fetch overnight news
          │  • Load earnings calendar
          │  • Compute IV ranks
          │  • Pre-build candidate universe
          │
9:00 AM   ├─ WARM-UP
          │  • Start WebSocket streams
          │  • Warm Redis cache
          │  • Verify all systems green
          │
9:30 AM   ├─ MARKET OPEN ═══════════════════
          │  • Wait 30 min (avoid open chaos)
          │
10:00 AM  ├─ FIRST SCAN
          │  → Scan universe for opportunities
          │  → Run AI decision engine
          │  → Execute top 1-2 trades
          │
10:30 AM  ├─ POSITION MONITORING
11:00 AM  │  • Check exits every 5 min
11:30 AM  ├─ INTRADAY SCAN
12:00 PM  │  • Full scan every 30 min
12:30 PM  ├─ POSITION MONITORING
 ...      │
3:30 PM   ├─ LAST CALL
          │  • No new positions after 3:30 PM
          │  • Close any 0-DTE positions
          │
4:00 PM   ├─ MARKET CLOSE ═══════════════════
          │
4:05 PM   ├─ END-OF-DAY REPORT
          │  • Calculate daily P&L
          │  • Send Slack/Email summary
          │  • Archive logs
          │
5:00 PM   └─ SLEEP MODE
               • Keep minimal monitoring
               • Ready for next day
```

### Options Strategy Library
| Strategy | Allocation | Conditions | Parameters |
|----------|------------|------------|------------|
| **Put Credit Spread** | 50% | IV Rank >50%, Bullish/Neutral | 30-45 DTE, 0.20-0.30 delta |
| **Call Credit Spread** | 20% | IV Rank >50%, Bearish/Neutral | 30-45 DTE, 0.20-0.30 delta |
| **Iron Condor** | 20% | IV Rank >70%, Neutral | 45-60 DTE, 0.15-0.25 delta |
| **Debit Spread** | 10% | IV Rank <30%, Strong trend | 21-30 DTE, 0.50-0.70 delta |

### Position Sizing (Kelly-Based)
```python
def calculate_position_size(candidate, account, config):
    """
    Kelly Criterion with conservative adjustment.
    
    Kelly = (p * b - q) / b
    Where:
        p = probability of profit (PoP)
        q = 1 - p (probability of loss)
        b = win/loss ratio
    """
    p = candidate.pop  # e.g., 0.70
    b = candidate.max_profit / candidate.max_loss  # e.g., 0.5
    q = 1 - p
    
    kelly = (p * b - q) / b if b > 0 else 0
    
    # Conservative: Use 25% of full Kelly
    adjusted_kelly = kelly * 0.25
    
    # Maximum position size
    max_risk = config.max_risk_per_trade  # e.g., $50
    
    # Calculate contracts
    risk_per_contract = candidate.max_loss
    contracts = min(
        int(adjusted_kelly * account.equity / risk_per_contract),
        max_risk / risk_per_contract
    )
    
    return max(1, contracts)
```

---

## 3. AI Decision Engine

### Hallucination Prevention (4 Layers)

**Layer 1: Input Validation**
```python
def validate_market_data(data):
    """All data verified before LLM sees it."""
    
    # Multi-source verification
    tradier_price = tradier.get_quote(symbol)
    alpaca_price = alpaca.get_quote(symbol)
    
    if abs(tradier_price - alpaca_price) / tradier_price > 0.01:
        raise DataMismatchError("Price sources disagree")
    
    # Freshness check
    if data.timestamp < now() - timedelta(seconds=5):
        raise StaleDataError("Data older than 5 seconds")
    
    # Sanity bounds
    if data.price <= 0 or data.price > 100000:
        raise InvalidPriceError("Price out of bounds")
    
    # Greeks math verification
    computed_delta = black_scholes_delta(...)
    if abs(data.delta - computed_delta) > 0.1:
        raise GreeksMismatchError("Delta calculation mismatch")
```

**Layer 2: LLM Output Constraints**
```python
from pydantic import BaseModel, validator
from enum import Enum

class StrategyType(str, Enum):
    PUT_CREDIT_SPREAD = "put_credit_spread"
    CALL_CREDIT_SPREAD = "call_credit_spread"
    IRON_CONDOR = "iron_condor"
    DEBIT_SPREAD = "debit_spread"

class LLMResponse(BaseModel):
    selected_ids: List[str]
    confidence: float
    explanation: str
    
    @validator('selected_ids')
    def validate_ids(cls, v, values):
        # IDs must exist in candidate list
        for id in v:
            if id not in known_candidate_ids:
                raise ValueError(f"Unknown candidate ID: {id}")
        return v
    
    @validator('confidence')
    def validate_confidence(cls, v):
        if v < 0.7:
            raise ValueError("Confidence below threshold")
        return v
```

**Layer 3: Cross-Validation (Dual LLM)**
```python
def cross_validate(candidates, context):
    """Both LLMs must agree."""
    
    groq_result = groq.rank(candidates, context)
    gemini_result = gemini.rank(candidates, context)
    
    # Must agree on at least 1 top pick
    groq_top = set(groq_result.selected_ids[:3])
    gemini_top = set(gemini_result.selected_ids[:3])
    
    agreement = groq_top.intersection(gemini_top)
    
    if len(agreement) == 0:
        # LLMs disagree - use deterministic fallback
        return deterministic_fallback.select(candidates)
    
    return agreement
```

**Layer 4: Post-Decision Audit**
```python
def audit_decision(artifact: RunArtifact):
    """Log everything for replay and review."""
    
    # Store full LLM input/output
    llm_log = LLMLog(
        run_id=artifact.run_id,
        groq_input=artifact.groq_context,
        groq_output=artifact.groq_response,
        gemini_input=artifact.gemini_context,
        gemini_output=artifact.gemini_response,
        final_selection=artifact.selected_candidates,
    )
    db.save(llm_log)
    
    # Weekly audit: Review random 10% of decisions
    if is_audit_sample():
        queue_for_human_review(artifact.run_id)
```

### Decision Pipeline Flow
```
    ┌─────────────┐
    │ 500 Symbols │
    └──────┬──────┘
           │ Universe Filter (liquid options)
           ▼
    ┌─────────────┐
    │ 150 Symbols │
    └──────┬──────┘
           │ Options Chain Fetch + Greeks
           ▼
    ┌─────────────┐
    │ 2000 Strikes│
    └──────┬──────┘
           │ Strategy Template Matching
           ▼
    ┌─────────────┐
    │ 50 Spreads  │
    └──────┬──────┘
           │ Deterministic Filters (liquidity, IV, PoP)
           ▼
    ┌─────────────┐
    │ 20 Candidates│
    └──────┬──────┘
           │ Groq Ranking (fast)
           ▼
    ┌─────────────┐
    │ 8 Top Picks │
    └──────┬──────┘
           │ Gemini Validation (deep)
           ▼
    ┌─────────────┐
    │ 3 Validated │
    └──────┬──────┘
           │ Risk Limit Validation
           ▼
    ┌─────────────┐
    │ 1-2 Trades  │
    └─────────────┘
```

---

## 4. Entry Scoring Algorithm

### Composite Score (0-100 Points)
```
ENTRY_SCORE = Σ (Factor × Weight)

Factor 1: IV RANK                  (25 points max)
├── 0-30%:   0-5 pts    (avoid for credit)
├── 30-50%:  10-15 pts  (okay)
├── 50-70%:  20-23 pts  (sweet spot)
└── 70-100%: 23-25 pts  (premium rich)

Factor 2: PROBABILITY OF PROFIT    (20 points max)
├── <50%:    0 pts      (reject)
├── 50-60%:  10 pts
├── 60-70%:  15 pts
├── 70-80%:  18 pts
└── >80%:    20 pts

Factor 3: NEWS SENTIMENT           (15 points max)
├── Strongly negative: -5 pts (penalty)
├── Slightly negative: 0 pts
├── Neutral:          8 pts
├── Slightly positive: 12 pts
└── Strongly positive: 15 pts
   (Flip scoring for bearish strategies)

Factor 4: TECHNICAL ALIGNMENT      (15 points max)
├── RSI oversold/overbought: +5 pts
├── MACD signal crossover:   +5 pts
└── Near support/resistance: +5 pts

Factor 5: LIQUIDITY                (10 points max)
├── Spread <2%:  10 pts
├── Spread 2-5%: 6 pts
├── Spread 5-10%: 2 pts
└── Spread >10%: 0 pts (reject)

Factor 6: RISK/REWARD              (10 points max)
├── R:R >1:3:    2 pts (too much risk)
├── R:R 1:2-1:3: 6 pts
└── R:R <1:2:    10 pts (ideal for credit)

Factor 7: LLM CONFIDENCE           (5 points max)
├── Both LLMs agree strongly: 5 pts
├── One LLM uncertain:        2 pts
└── LLMs disagree:           0 pts (reject)

─────────────────────────────────────────────
MINIMUM SCORE TO TRADE:    65/100
IDEAL SCORE:               80+/100
```

### Implementation
```python
def calculate_entry_score(candidate, sentiment, technicals, llm_confidence):
    score = 0
    
    # Factor 1: IV Rank (25 pts)
    iv = candidate.iv_rank
    if iv >= 0.7:
        score += 25
    elif iv >= 0.5:
        score += 20 + (iv - 0.5) * 15
    elif iv >= 0.3:
        score += 10 + (iv - 0.3) * 25
    else:
        score += iv * 16.67
    
    # Factor 2: PoP (20 pts)
    pop = candidate.pop
    if pop < 0.5:
        return 0  # Reject
    elif pop >= 0.8:
        score += 20
    elif pop >= 0.7:
        score += 18
    elif pop >= 0.6:
        score += 15
    else:
        score += 10
    
    # Factor 3: Sentiment (15 pts)
    sent = sentiment.get(candidate.symbol, 0)
    if candidate.is_bullish:
        score += max(-5, min(15, 8 + sent * 7))
    else:
        score += max(-5, min(15, 8 - sent * 7))
    
    # Factor 4: Technicals (15 pts)
    tech = technicals.get(candidate.symbol, {})
    if tech.get('rsi_signal'):
        score += 5
    if tech.get('macd_signal'):
        score += 5
    if tech.get('support_nearby'):
        score += 5
    
    # Factor 5: Liquidity (10 pts)
    spread_pct = candidate.spread_pct
    if spread_pct > 0.10:
        return 0  # Reject
    elif spread_pct < 0.02:
        score += 10
    elif spread_pct < 0.05:
        score += 6
    else:
        score += 2
    
    # Factor 6: Risk/Reward (10 pts)
    rr = candidate.max_loss / candidate.max_profit
    if rr < 2:
        score += 10
    elif rr < 3:
        score += 6
    else:
        score += 2
    
    # Factor 7: LLM Confidence (5 pts)
    if llm_confidence == 'both_agree':
        score += 5
    elif llm_confidence == 'partial':
        score += 2
    
    return score
```

---

## 5. Exit Decision Logic

### Exit Triggers (Checked Every 5 Minutes)
```
PRIORITY ORDER:

1. STOP LOSS (Urgent)
   ├── Trigger: Loss ≥ 2x original credit
   ├── Example: Sold for $1.20 credit
   │            Now costs $3.60 to close
   │            Loss = $2.40 = 2x credit → CLOSE NOW
   └── Rationale: Limit tail risk

2. NEWS/EVENT EXIT (Time-Sensitive)
   ├── Earnings within 2 trading days → CLOSE
   ├── FDA decision pending → CLOSE
   ├── Major macro event (FOMC) → REDUCE SIZE 50%
   └── Sudden negative news spike → EVALUATE, close if bad

3. STRIKE DEFENSE (Active Management)
   ├── Trigger: Underlying within 2% of short strike
   ├── Options:
   │   a) Close entire position
   │   b) Roll out in time (same strike, later expiry)
   │   c) Roll out and down/up (better strike + later expiry)
   ├── AI Decision Factors:
   │   • Is the move temporary? (news sentiment)
   │   • Technical support nearby?
   │   • Enough time value to roll profitably?
   └── Default: Close if uncertain (preserve capital)

4. TIME EXIT (Proactive)
   ├── Trigger: DTE < 7 days
   ├── Regardless of P&L (unless already deep profit)
   └── Rationale: Avoid gamma risk near expiration

5. PROFIT TARGET (Optimal, Not Urgent)
   ├── Trigger: P&L ≥ 50% of max profit
   ├── Example: Sold for $1.20 credit
   │            Can close for $0.60 → $0.60 profit
   │            That's 50% of max ($1.20) → CLOSE
   └── Rationale: Bank profits, free up capital for new trades
```

### Implementation
```python
def evaluate_exit(position, current_price, news, calendar):
    """
    Check all exit triggers in priority order.
    Returns (should_exit, reason, urgency).
    """
    
    # 1. Stop Loss
    loss = (current_price - position.entry_price) * position.quantity
    if loss >= 2 * position.entry_credit:
        return True, ExitReason.STOP_LOSS, "urgent"
    
    # 2. News/Event
    days_to_earnings = calendar.days_until_earnings(position.symbol)
    if days_to_earnings <= 2:
        return True, ExitReason.EARNINGS_SHOCK, "urgent"
    
    if news.has_major_negative(position.symbol, hours=4):
        return True, ExitReason.NEWS_SHOCK, "urgent"
    
    # 3. Strike Defense
    underlying_price = get_price(position.underlying)
    short_strike = position.short_strike
    distance_pct = abs(underlying_price - short_strike) / short_strike
    
    if distance_pct < 0.02:  # Within 2%
        # AI decides: close or roll?
        decision = ai_strike_defense(position, news, technicals)
        if decision == "close":
            return True, ExitReason.STRIKE_DEFENSE, "normal"
        elif decision == "roll":
            return "roll", ExitReason.STRIKE_DEFENSE, "normal"
    
    # 4. Time Exit
    if position.dte < 7:
        return True, ExitReason.DTE_THRESHOLD, "normal"
    
    # 5. Profit Target
    profit = (position.entry_credit - current_price) * position.quantity
    if profit >= 0.5 * position.max_profit:
        return True, ExitReason.PROFIT_TARGET, "optimal"
    
    return False, None, None
```

---

## 6. News & Sentiment Integration

### Data Sources
| Source | Type | Update Frequency | Use Case |
|--------|------|------------------|----------|
| Finnhub | News API | Real-time | Headlines |
| Benzinga | Premium | 15 min | Analysis |
| SEC 8-K | Filings | On filing | Material events |
| Twitter/X | Social | 5 min | Retail sentiment |
| Reddit (WSB) | Social | 15 min | Momentum |

### Sentiment Scoring Formula
```
COMPOSITE_SENTIMENT (-1 to +1) =
    0.30 × Headline_Sentiment (FinBERT)
  + 0.20 × Source_Credibility
  + 0.20 × News_Recency
  + 0.15 × Volume_Spike
  + 0.15 × Social_Momentum

Where:
  Headline_Sentiment: FinBERT model output (-1 to +1)
  Source_Credibility: WSJ=1.0, Reuters=0.9, Blog=0.3
  News_Recency: Exponential decay over 24 hours
  Volume_Spike: Current volume / 7-day average
  Social_Momentum: Twitter/Reddit mention velocity
```

### Event Classification & Response
| Impact | Events | Autopilot Response |
|--------|--------|-------------------|
| 🔴 HIGH | Earnings, FDA decision, M&A, CEO departure | Block all new trades for symbol, close existing |
| 🟡 MEDIUM | Analyst upgrade/downgrade, product launch | Reduce position size 50% |
| 🟢 LOW | Industry news, macro commentary | Factor into sentiment score only |

### Implementation
```python
class SentimentEngine:
    def __init__(self):
        self.finbert = load_model("ProsusAI/finbert")
        self.sources = {
            "wsj": 1.0, "reuters": 0.9, "bloomberg": 0.85,
            "cnbc": 0.7, "benzinga": 0.6, "blog": 0.3
        }
    
    def score_headline(self, headline, source, published_at):
        # FinBERT sentiment
        sentiment = self.finbert.predict(headline)  # -1 to +1
        
        # Source credibility
        credibility = self.sources.get(source.lower(), 0.3)
        
        # Recency decay (half-life = 6 hours)
        age_hours = (now() - published_at).total_seconds() / 3600
        recency = math.exp(-0.693 * age_hours / 6)
        
        return sentiment * credibility * recency
    
    def aggregate_sentiment(self, symbol, hours=24):
        headlines = self.fetch_headlines(symbol, hours)
        
        if not headlines:
            return 0.0  # Neutral
        
        scores = [self.score_headline(h) for h in headlines]
        
        # Weighted average (more recent = higher weight)
        return sum(scores) / len(scores)
```

---

## 7. Model Quality Assurance

### Validation Framework (5 Gates)
```
GATE 1: STATISTICAL VALIDITY
├── Minimum 500+ backtested trades
├── p-value < 0.05 (statistically significant)
├── 30% out-of-sample holdout
└── PASS CRITERIA: Edge is not random luck

GATE 2: TIME STABILITY
├── Works across 2018 (bull), 2020 (crash), 2022 (bear)
├── Consistent win rate ±10% across periods
└── PASS CRITERIA: Not curve-fitted to one regime

GATE 3: PARAMETER ROBUSTNESS
├── ±20% parameter sensitivity test
├── Edge survives parameter drift
└── PASS CRITERIA: Not overfitted to exact parameters

GATE 4: RISK-ADJUSTED RETURNS
├── Sharpe Ratio > 1.0
├── Sortino Ratio > 1.5
├── Max Drawdown < 20%
├── Risk of Ruin < 1%
└── PASS CRITERIA: Returns justify the risk

GATE 5: ECONOMIC VALIDITY
├── Strategy makes intuitive sense
├── Edge source is explainable
├── Not exploiting data artifacts
└── PASS CRITERIA: Human expert would agree
```

### Key Metrics to Track
| Metric | Formula | Target | Why |
|--------|---------|--------|-----|
| Win Rate | Wins / Total | >50% | Baseline profitability |
| Profit Factor | Gross Profit / Gross Loss | >1.5 | Edge magnitude |
| Expectancy | (Win% × Avg Win) - (Loss% × Avg Loss) | >$0 | Expected value per trade |
| Sharpe Ratio | (Return - Rf) / StdDev | >1.0 | Risk-adjusted return |
| Sortino Ratio | (Return - Rf) / Downside StdDev | >1.5 | Downside-adjusted return |
| Max Drawdown | Peak to Trough | <20% | Worst historical decline |
| Recovery Time | Days to recover from DD | <60 days | Resilience |
| Kelly Fraction | Edge / Odds | <50% | Optimal bet sizing |
| OOS/IS Ratio | Out-of-Sample / In-Sample | >70% | Not overfit |

### Continuous Improvement Cycle
```
MONTHLY CYCLE:

Week 1: DATA COLLECTION
├── Collect all trade data with full context
├── Market regime at entry/exit
├── News events during hold
└── Technical state at entry

Week 2: PERFORMANCE ATTRIBUTION
├── What worked? What didn't?
├── Which strategies outperformed?
├── Regime-specific performance
└── Generate insights

Week 3: HYPOTHESIS & TESTING
├── Form improvement hypothesis
├── Backtest on historical data
├── Monte Carlo simulation
└── Walk-forward validation

Week 4: DEPLOYMENT & MONITORING
├── If validated: Deploy new parameters
├── A/B test (10% allocation)
├── Monitor for 30 days
└── Full rollout if confident
```

---

## 8. Backtesting & Simulation

### Walk-Forward Analysis
```
TRAINING/TESTING WINDOWS:

Year:  2018    2019    2020    2021    2022    2023
       ├───────┼───────┼───────┼───────┼───────┤
Step 1 │ Train │ Train │ TEST  │       │       │
Step 2 │       │ Train │ Train │ TEST  │       │
Step 3 │       │       │ Train │ Train │ TEST  │

Each step:
1. Train model on 2-year in-sample period
2. Test on next 1-year out-of-sample
3. Record OOS performance
4. Roll forward

FINAL METRIC = Aggregate of ALL OOS periods
└── This is TRUE expected performance, not curve-fitted
```

### Monte Carlo Simulation (1M+ Runs)
```python
def monte_carlo_simulation(trades, n_sims=1_000_000):
    """
    Simulate 1M possible outcomes from historical trades.
    """
    results = []
    
    for _ in range(n_sims):
        # Method 1: Trade Shuffling
        shuffled = random.shuffle(trades)
        equity_curve = simulate_equity(shuffled)
        
        # Method 2: Return Sampling (with replacement)
        sampled_returns = np.random.choice(
            [t.pnl_pct for t in trades],
            size=len(trades),
            replace=True
        )
        
        results.append({
            'final_equity': equity_curve[-1],
            'max_drawdown': calculate_max_dd(equity_curve),
            'sharpe': calculate_sharpe(equity_curve),
        })
    
    return {
        'expected_return': np.median([r['final_equity'] for r in results]),
        'return_5th_pctl': np.percentile([r['final_equity'] for r in results], 5),
        'return_95th_pctl': np.percentile([r['final_equity'] for r in results], 95),
        'max_dd_95th_pctl': np.percentile([r['max_drawdown'] for r in results], 95),
        'risk_of_ruin': sum(1 for r in results if r['final_equity'] < 0) / n_sims,
    }
```

### Stress Scenarios
| Scenario | Parameters | Survival Criteria |
|----------|------------|-------------------|
| Flash Crash | -10% in 30 min, IV +200% | <15% drawdown |
| COVID 2020 | -35% over 4 weeks, VIX 80 | <25% drawdown |
| Black Monday | -22% single day | <30% drawdown |
| VIXpocalypse | VIX +100% overnight | <20% drawdown |
| IV Crush | -50% IV overnight | <10% drawdown |
| Liquidity Crisis | 10x spreads | No forced exits |
| Rate Shock | +100bps surprise | <15% drawdown |

### Common Pitfalls to Avoid
| Pitfall | Description | Prevention |
|---------|-------------|------------|
| Look-Ahead Bias | Using future data | Strict train/test separation |
| Survivorship Bias | Missing delisted stocks | Include all historical symbols |
| Overfitting | Too many parameters | Walk-forward validation |
| Curve Fitting | Optimizing to past | Out-of-sample testing |
| Ignoring Costs | No transaction costs | $0.65/contract + slippage |
| Selection Bias | Cherry-picking period | Test across all regimes |

---

## 9. Portfolio Greeks Management

### Portfolio Limits (Auto-Enforced)
| Greek | Limit | Action if Exceeded |
|-------|-------|-------------------|
| Delta | -0.20 to +0.20 | Prefer opposite-direction trades |
| Theta | Must be positive | STOP all new trades until fixed |
| Vega | -$500 to +$500 | Balance long/short vol |
| Gamma | <$100 per 1% move | Limit near-term positions |

### Real-Time Greeks Dashboard
```
┌─────────────────────────────────────────────────────────────┐
│  PORTFOLIO GREEKS (Real-time)                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Position          Delta    Theta     Vega     Gamma       │
│  ─────────────────────────────────────────────────────────  │
│  AAPL 180/175P    -0.05    +$15.20   -$42     -$12         │
│  MSFT 420/415P    -0.03    +$12.80   -$38     -$10         │
│  TSLA 240/235P    -0.08    +$18.50   -$55     -$15         │
│  SPY 480/475P     -0.02    +$10.00   -$30     -$8          │
│  ─────────────────────────────────────────────────────────  │
│  PORTFOLIO TOTAL  -0.18    +$56.50   -$165    -$45         │
│                                                             │
│  STATUS: ✓ All within limits                                │
│  CAPACITY: Can add 0.02 more delta exposure                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Auto-Balancing Logic
```python
def check_portfolio_balance(portfolio, new_candidate):
    """
    Ensure portfolio stays balanced after adding new position.
    """
    current_delta = portfolio.total_delta
    new_delta = new_candidate.delta
    
    # If we're too bullish, prefer bearish trades
    if current_delta > 0.15 and new_delta > 0:
        return "skip", "Portfolio too bullish, skipping bullish trade"
    
    # If we're too bearish, prefer bullish trades
    if current_delta < -0.15 and new_delta < 0:
        return "skip", "Portfolio too bearish, skipping bearish trade"
    
    # Theta must always be positive for credit spreads
    if portfolio.total_theta + new_candidate.theta < 0:
        return "reject", "Would result in negative theta"
    
    return "accept", None
```

---

## 10. Data Pipeline

### Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                     DATA SOURCES                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │  Tradier    │    │  Alpaca     │    │  Finnhub    │     │
│  │  WebSocket  │    │  WebSocket  │    │  REST/WS    │     │
│  │  (Options)  │    │  (Equities) │    │  (News)     │     │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘     │
│         │                  │                  │             │
│         └──────────────────┼──────────────────┘             │
│                            ▼                                │
├─────────────────────────────────────────────────────────────┤
│                     NORMALIZER                              │
│  • Unified format across all sources                       │
│  • UTC timestamp normalization                             │
│  • Staleness detection (>5s = stale)                       │
│  • Deduplication                                            │
│  • Price sanity checks                                      │
├─────────────────────────────────────────────────────────────┤
│                     REDIS CACHE                             │
│  quotes:{symbol}          → TTL 1s   (hot)                 │
│  chains:{symbol}:{expiry} → TTL 30s  (warm)                │
│  sentiment:{symbol}       → TTL 60s  (warm)                │
│  greeks:{contract}        → TTL 5s   (hot)                 │
│  fundamentals:{symbol}    → TTL 5min (cold)                │
├─────────────────────────────────────────────────────────────┤
│                     AUTOPILOT ENGINE                        │
│  (Consumes normalized, cached, validated data)             │
└─────────────────────────────────────────────────────────────┘
```

### Refresh Rates
| Data Type | Rate | Method |
|-----------|------|--------|
| Quotes | Real-time | WebSocket streaming |
| Options chains | Every 30 seconds | REST polling + cache |
| Greeks | On-demand | Computed from chain |
| IV Rank | Every 5 minutes | Historical comparison |
| News sentiment | Every 1 minute | Aggregated scoring |
| Technicals | Every 1 minute | Indicator calculation |
| Fundamentals | Every 5 minutes | API fetch |

---

## 11. Backend Infrastructure

### Database Migration: SQLite → PostgreSQL + TimescaleDB
```sql
-- TimescaleDB Hypertables (time-series data)
CREATE TABLE bars (
    time        TIMESTAMPTZ NOT NULL,
    symbol      TEXT NOT NULL,
    open        DECIMAL(12,4),
    high        DECIMAL(12,4),
    low         DECIMAL(12,4),
    close       DECIMAL(12,4),
    volume      BIGINT
);
SELECT create_hypertable('bars', 'time', chunk_time_interval => INTERVAL '1 month');

CREATE TABLE options_chains (
    time        TIMESTAMPTZ NOT NULL,
    symbol      TEXT NOT NULL,
    expiration  DATE,
    strike      DECIMAL(12,2),
    option_type TEXT,
    bid         DECIMAL(12,4),
    ask         DECIMAL(12,4),
    delta       DECIMAL(8,6),
    gamma       DECIMAL(8,6),
    theta       DECIMAL(8,6),
    vega        DECIMAL(8,6),
    iv          DECIMAL(8,6)
);
SELECT create_hypertable('options_chains', 'time', chunk_time_interval => INTERVAL '1 day');

-- Enable compression for old data
ALTER TABLE bars SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'symbol'
);
SELECT add_compression_policy('bars', INTERVAL '7 days');
```

### Redis Caching Strategy
```python
CACHE_CONFIG = {
    # L1: Hot data (sub-second access)
    "quotes": {"ttl": 1, "prefix": "q:"},
    "greeks": {"ttl": 5, "prefix": "g:"},
    
    # L2: Warm data (second-level access)
    "chains": {"ttl": 30, "prefix": "c:"},
    "sentiment": {"ttl": 60, "prefix": "s:"},
    
    # L3: Cold data (minute-level access)
    "fundamentals": {"ttl": 300, "prefix": "f:"},
    "forecasts": {"ttl": 300, "prefix": "fc:"},
}

# Cache-aside pattern
def get_quote(symbol):
    cached = redis.get(f"q:{symbol}")
    if cached:
        return json.loads(cached)
    
    quote = tradier.get_quote(symbol)
    redis.setex(f"q:{symbol}", 1, json.dumps(quote))
    return quote
```

### Observability Stack
```
METRICS (Prometheus + Grafana)
├── System: CPU, Memory, Disk, Network
├── Application: Request rate, latency, errors
├── Trading: P&L, positions, win rate
└── Dependencies: Broker latency, LLM latency

LOGGING (Structured JSON → Loki)
├── Format: {"timestamp", "level", "service", "message", "context"}
├── Levels: DEBUG, INFO, WARNING, ERROR, CRITICAL
└── Retention: 30 days

TRACING (OpenTelemetry → Jaeger)
├── Trace entire autopilot cycle
├── Identify slow phases
└── Debug cross-service calls

ALERTING (Grafana → Slack)
├── P0: Broker disconnected, Kill switch activated
├── P1: LLM errors, Position sync failures
├── P2: High latency, Cache misses
└── Daily: P&L summary, Trade count
```

---

## 12. Edge Case Handling

### Playbook
| Case | Detection | Response |
|------|-----------|----------|
| **Early Assignment** | Position shows unexpected stock | Exercise long leg OR sell stock at market |
| **Earnings Surprise** | 10%+ overnight gap | Close immediately, add to blacklist |
| **Flash Crash** | 5%+ intraday drop | Pause entries, wait 30 min, don't panic-sell |
| **Broker API Outage** | 3+ consecutive failures | Switch to backup broker OR monitoring-only mode |
| **LLM Degradation** | Nonsensical or slow responses | Fall back to deterministic scoring |
| **Market Holiday** | Calendar check | Sleep mode, skip all trading |
| **Half-Day Trading** | Calendar check | Close scans at 1 PM, no new positions after 12:30 |
| **Position Mismatch** | Broker vs. internal discrepancy | Sync from broker (truth), alert user |

---

## 13. n8n Orchestration

### Workflow Definitions
```
WORKFLOW 1: MARKET OPEN AUTOPILOT
Trigger: CRON "30 9 * * 1-5" (9:30 AM ET, weekdays)
Steps:
1. Check if today is holiday → Skip if yes
2. POST /api/v1/autopilot/wake
3. Wait 5 minutes (system warm-up)
4. POST /api/v1/autopilot/scan
5. POST /api/v1/autopilot/decide
6. GET /api/v1/autopilot/status
7. If trades made → POST to Slack

─────────────────────────────────────────────────────────────

WORKFLOW 2: INTRADAY SCANS
Trigger: CRON every 30 min, 10:00-15:30
Steps:
1. POST /api/v1/autopilot/scan
2. POST /api/v1/autopilot/decide
3. GET /api/v1/positions/check-exits
4. If any action taken → Log

─────────────────────────────────────────────────────────────

WORKFLOW 3: POSITION MONITORING
Trigger: CRON every 5 min, 9:30-16:00
Steps:
1. GET /api/v1/positions
2. For each: check exit triggers
3. If exit needed → POST /api/v1/orders/close
4. Update portfolio Greeks

─────────────────────────────────────────────────────────────

WORKFLOW 4: END OF DAY
Trigger: CRON "5 16 * * 1-5" (4:05 PM ET)
Steps:
1. GET /api/v1/reports/daily
2. Generate daily summary
3. POST to Slack/Email
4. Archive trade logs
5. POST /api/v1/autopilot/sleep

─────────────────────────────────────────────────────────────

WORKFLOW 5: WEEKLY REVIEW
Trigger: CRON "0 10 * * 0" (10 AM Sunday)
Steps:
1. GET /api/v1/reports/weekly
2. Run performance attribution
3. Generate insights
4. POST report to user
```

---

## 14. Implementation Roadmap

### Priority Matrix
```
                   QUICK WINS                    BIG BETS
                        │                             │
                        │   Hallucination         Monte Carlo
         HIGH           │   Detection             Simulation
         VALUE          │                             │
                        │   News Sentiment        PostgreSQL +
                        │   Integration           TimescaleDB
                        ├─────────────────────────────┼──────────────
                        │                             │
         LOW            │   Redis Caching         Full Learning
         VALUE          │   Parallel LLM          Loop
                        │                             │
                        └─────────────────────────────┴──────────────
                              LOW EFFORT          HIGH EFFORT
```

### Phased Implementation
| Phase | Focus | Duration | Deliverables |
|-------|-------|----------|--------------|
| **1** | Hallucination Prevention | 2 weeks | Input validation, output constraints, cross-validation |
| **2** | Entry/Exit Scoring | 2 weeks | Scoring algorithm, exit trigger automation |
| **3** | News Sentiment | 2 weeks | FinBERT integration, event classification |
| **4** | Monte Carlo Backtesting | 3 weeks | Simulation engine, walk-forward framework |
| **5** | Database Migration | 2 weeks | PostgreSQL, TimescaleDB, data migration |
| **6** | Redis Caching | 1 week | 3-tier cache, warm-up scripts |
| **7** | Observability | 1 week | Prometheus, Grafana dashboards |
| **8** | Autonomous Mode | 2 weeks | n8n workflows, market hours, self-healing |
| **9** | Continuous Learning | Ongoing | Monthly improvement cycle |

### Total Timeline: ~15 weeks to full autonomous operation

---

## Summary

**The Vision**: User clicks "Start" → System handles everything else.

**The System**:
1. Wakes up before market open
2. Scans for high-probability options opportunities
3. Validates decisions with dual LLM + deterministic fallback
4. Executes trades with smart sizing
5. Monitors positions every 5 minutes
6. Exits at profit/loss/time targets
7. Handles all errors autonomously
8. Generates daily/weekly reports
9. Learns and improves continuously

**Industrial Grade Means**:
- Hallucination prevention on all AI decisions
- 1M+ Monte Carlo simulations before any strategy goes live
- Walk-forward validation across all market regimes
- Stress-tested against worst-case scenarios
- Full observability and alerting
- Self-healing error recovery

---

*This is strategic planning. Implementation follows this blueprint.*
