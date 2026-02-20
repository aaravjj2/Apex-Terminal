# Quarter 2: Execution & Resilience (Days 91-180)

> **Theme**: Execution Algorithms, Multi-Broker Routing, System Hardening

[TOC]

## Week 13

### Day 91: [WEEKEND] OMS vs EMS Architecture
**Sunday** | *Outcome: Research & Cleanup: Decouple Strategy (Signal) from Execution (Order). Create specialized EMS for different venues.*

#### 1. Tech & Commands
```bash
mkdir -p apps/api/execution/ems apps/api/execution/oms
touch apps/api/execution/ems/base.py apps/api/execution/ems/alpaca.py
touch apps/api/execution/oms/order_manager.py
```

#### 2. Files
- `apps/api/execution/ems/base.py (new: AbstractBaseEMS with submit/cancel/replace)`
- `apps/api/execution/oms/order_manager.py (new: lifecycle management, state transitions)`
- `apps/api/models/order.py (update: add parent_id, child_ids, algo_params field)`
- `apps/api/execution/factory.py (new: get_ems_for_symbol(symbol) -> EMS instance)`

#### 3. Architecture
- Inversion of Control: Strategy doesn't know about broker API
- Factory Pattern: Route orders to correct EMS based on asset class/broker
- State Machine: NEW -> SUBMITTED -> PARTIAL -> FILLED (or REJECTED/CANCELED)

#### 4. Autopilot Prompts
- Prompt: 'Create AbstractBaseEMS class with async methods submit_order, cancel_order, replace_order.'
- Prompt: 'Implement OrderManager state machine using Transitions library.'
- Prompt: 'Write factory function to return AlpacaEMS for equities and TradierEMS for options.'

#### 5. Risk & Metrics
- **Risk**: Race conditions in state updates.
- **Metric**: Order state strictly monotonic

---

## Week 14

### Day 92: FIX Protocol Adapter (Mock)
**Monday** | *Outcome: Implement initial FIX protocol handler (QuickFIX) for institutional connectivity simulation.*

#### 1. Tech & Commands
```bash
pip install quickfix
```

#### 2. Files
- `libs/fix/initiator.py`
- `libs/fix/config.cfg`

#### 3. Architecture
- Adapter Pattern
- Event-Driven Architecture

#### 4. Autopilot Prompts
- Configure QuickFIX initiator
- Map FIX tags (35=D, 55=Sym) to internal Order model

#### 5. Risk & Metrics
- **Risk**: Message parsing overhead.
- **Metric**: Round-trip time < 5ms

---

### Day 93: Smart Order Router (SOR) - Level 1
**Tuesday** | *Outcome: Basic routing logic: separate crypto vs equity vs options.*

#### 1. Tech & Commands
```bash
python scripts/test_router.py
```

#### 2. Files
- `apps/api/execution/sor.py`

#### 3. Architecture
- Strategy Pattern
- Rule Engine

#### 4. Autopilot Prompts
- Route BTC* to CryptoEMS
- Route SPY to AlpacaEMS
- Route SPY options to TradierEMS

#### 5. Risk & Metrics
- **Risk**: Routing loops.
- **Metric**: 100% Correct Routing

---

### Day 94: Execution Algo: TWAP Logic
**Wednesday** | *Outcome: Implement Time-Weighted Average Price algorithm core logic.*

#### 1. Tech & Commands
```bash
mkdir apps/api/execution/algos
```

#### 2. Files
- `apps/api/execution/algos/twap.py`

#### 3. Architecture
- Time Slicing
- Schedule Generation

#### 4. Autopilot Prompts
- Divide total qty by duration
- Generate schedule of child orders

#### 5. Risk & Metrics
- **Risk**: Signaling intent (too regular).
- **Metric**: Schedule deviations within limits

---

### Day 95: Execution Algo: TWAP Scheduler
**Thursday** | *Outcome: Integrate TWAP with APScheduler to submit child orders.*

#### 1. Tech & Commands
```bash
pip install apscheduler
```

#### 2. Files
- `apps/api/execution/algos/scheduler.py`

#### 3. Architecture
- Task Scheduling
- Async Execution

#### 4. Autopilot Prompts
- Schedule child order submissions
- Handle partial fills of children

#### 5. Risk & Metrics
- **Risk**: Drift.
- **Metric**: Complete filling by end time

---

### Day 96: Execution Algo: VWAP Volatility Profile
**Friday** | *Outcome: Calculate historical volume profiles for VWAP targets.*

#### 1. Tech & Commands
```bash
python scripts/calc_vol_profile.py
```

#### 2. Files
- `libs/math/volume_profile.py`

#### 3. Architecture
- Data Analysis
- Curve Fitting

#### 4. Autopilot Prompts
- Bin intraday volume by 1-min buckets
- Normalize to % of daily volume

#### 5. Risk & Metrics
- **Risk**: Data gaps.
- **Metric**: Profile correlation > 0.9

---

### Day 97: [WEEKEND] Execution Algo: VWAP Engine
**Saturday** | *Outcome: Research & Cleanup: Implement Volume-Weighted Average Price execution logic.*

#### 1. Tech & Commands
```bash
touch apps/api/execution/algos/vwap.py
```

#### 2. Files
- `apps/api/execution/algos/vwap.py`

#### 3. Architecture
- Participation Rate
- Feedback Loop

#### 4. Autopilot Prompts
- Compare current vol to profile
- Adjust participation rate aggression

#### 5. Risk & Metrics
- **Risk**: Chasing price.
- **Metric**: Execution vs VWAP < 5bps

---

### Day 98: [WEEKEND] Iceberg Orders
**Sunday** | *Outcome: Research & Cleanup: Implement hidden order logic to minimize market impact.*

#### 1. Tech & Commands
```bash
touch apps/api/execution/algos/iceberg.py
```

#### 2. Files
- `apps/api/execution/algos/iceberg.py`

#### 3. Architecture
- Order Management
- Visibility Hiding

#### 4. Autopilot Prompts
- Display size vs Total size
- Reload logic when tip is filled

#### 5. Risk & Metrics
- **Risk**: Reload latency.
- **Metric**: Tip size randomized

---

## Week 15

### Day 99: Stop-Limit & Trailing Stop Server-Side
**Monday** | *Outcome: Implement synthetic stops management in OMS (not broker-side).*

#### 1. Tech & Commands
```bash
touch apps/api/execution/algos/stops.py
```

#### 2. Files
- `apps/api/execution/algos/stops.py`

#### 3. Architecture
- Event Monitoring
- Trigger Logic

#### 4. Autopilot Prompts
- Monitor tick stream
- Trigger limit order submission on price event

#### 5. Risk & Metrics
- **Risk**: Slippage on gap.
- **Metric**: Trigger reliability 100%

---

### Day 100: Bracket Orders (OSO/OTO)
**Tuesday** | *Outcome: One-Triggers-Other / One-Cancels-Other complex order types.*

#### 1. Tech & Commands
```bash
python tests/test_bracket.py
```

#### 2. Files
- `apps/api/execution/oms/bracket_manager.py`

#### 3. Architecture
- DAG Execution
- Parent-Child Links

#### 4. Autopilot Prompts
- Entry fill triggers Stop & Target
- Stop fill cancels Target

#### 5. Risk & Metrics
- **Risk**: Orphaned legs.
- **Metric**: Atomic state updates

---

### Day 101: Fat Finger Protection
**Wednesday** | *Outcome: Middleware to reject orders exceeding size/value limits.*

#### 1. Tech & Commands
```bash
touch apps/api/middleware/validation.py
```

#### 2. Files
- `apps/api/middleware/validation.py`

#### 3. Architecture
- Validation Decoration
- Policy Enforcement

#### 4. Autopilot Prompts
- Max notional check ($50k)
- Max qty check (1000 shares)

#### 5. Risk & Metrics
- **Risk**: Latency in checks.
- **Metric**: Rejected orders < 10ms

---

### Day 102: Rate Limiting (Order Submission)
**Thursday** | *Outcome: Strict leaky bucket rate limiter per broker.*

#### 1. Tech & Commands
```bash
python scripts/test_rate_limit.py
```

#### 2. Files
- `apps/api/execution/limiter.py`

#### 3. Architecture
- Token Bucket
- Redis Counter

#### 4. Autopilot Prompts
- Alpaca: 200/min
- Tradier: 120/min

#### 5. Risk & Metrics
- **Risk**: 429 Errors.
- **Metric**: Zero 429s from brokers

---

### Day 103: Duplicate Order Detection
**Friday** | *Outcome: Prevent accidental double execution of identical signals.*

#### 1. Tech & Commands
```bash
touch apps/api/execution/dedup.py
```

#### 2. Files
- `apps/api/execution/dedup.py`

#### 3. Architecture
- Hashing
- Idempotency

#### 4. Autopilot Prompts
- Hash(symbol, side, qty, strategy, timestamp bucket)
- Check Redis for recent execution

#### 5. Risk & Metrics
- **Risk**: False positives.
- **Metric**: No duplicate fills

---

### Day 104: [WEEKEND] Execution Reports & Fill Reconciliation
**Saturday** | *Outcome: Research & Cleanup: Reconcile broker execution reports with internal order state.*

#### 1. Tech & Commands
```bash
touch apps/api/execution/recon.py
```

#### 2. Files
- `apps/api/execution/recon.py`

#### 3. Architecture
- Data Reconciliation
- Event Sourcing

#### 4. Autopilot Prompts
- Match fills to orders
- Detect execution breaks

#### 5. Risk & Metrics
- **Risk**: Missing fills.
- **Metric**: 100% State Match

---

### Day 105: [WEEKEND] Real-Time Position Tracker
**Sunday** | *Outcome: Research & Cleanup: Aggregate fills into absolute positions in real-time.*

#### 1. Tech & Commands
```bash
touch apps/api/portfolio/positions.py
```

#### 2. Files
- `apps/api/portfolio/positions.py`

#### 3. Architecture
- Aggregation
- Stream Processing

#### 4. Autopilot Prompts
- Update avg_entry_price
- Update realized/unrealized P&L

#### 5. Risk & Metrics
- **Risk**: Calculation drift.
- **Metric**: Matches broker daily statement

---

## Week 16

### Day 106: Mark-to-Market Engine
**Monday** | *Outcome: Calculate portfolio NAV continuously based on live quotes.*

#### 1. Tech & Commands
```bash
touch apps/api/portfolio/mtm.py
```

#### 2. Files
- `apps/api/portfolio/mtm.py`

#### 3. Architecture
- Valuation
- Pricing Engine

#### 4. Autopilot Prompts
- Stream prices
- Recompute Equity = Cash + Positions

#### 5. Risk & Metrics
- **Risk**: Stale prices.
- **Metric**: NAV latency < 100ms

---

### Day 107: Cash Management & buying_power
**Tuesday** | *Outcome: Track cash balances, settlements, and available buying power.*

#### 1. Tech & Commands
```bash
touch apps/api/portfolio/cash.py
```

#### 2. Files
- `apps/api/portfolio/cash.py`

#### 3. Architecture
- Accounting
- Ledger

#### 4. Autopilot Prompts
- T+1 Settlement logic
- Margin requirement calc

#### 5. Risk & Metrics
- **Risk**: Over-leveraging.
- **Metric**: Zero margin calls

---

### Day 108: Portfolio Greeks Aggregation
**Wednesday** | *Outcome: Sum individual option greeks to portfolio level.*

#### 1. Tech & Commands
```bash
python scripts/calc_portfolio_greeks.py
```

#### 2. Files
- `apps/api/portfolio/greeks.py`

#### 3. Architecture
- Matrix Math
- Risk Aggregation

#### 4. Autopilot Prompts
- Weighted sum of Delta/Gamma/Vega
- Beta-weighted Delta

#### 5. Risk & Metrics
- **Risk**: Computation load.
- **Metric**: Update frequency < 1s

---

### Day 109: Sector Exposure Monitor
**Thursday** | *Outcome: Track exposure concentration by GICS sector.*

#### 1. Tech & Commands
```bash
touch apps/api/portfolio/risk_exposure.py
```

#### 2. Files
- `apps/api/portfolio/risk_exposure.py`

#### 3. Architecture
- Categorization
- Aggregation

#### 4. Autopilot Prompts
- Map symbol -> sector
- Sum exposure per sector

#### 5. Risk & Metrics
- **Risk**: Mapping gaps.
- **Metric**: Unclassified < 1%

---

### Day 110: Wash Sale Prevention
**Friday** | *Outcome: Track recent trades to avoid washing losses (30-day rule).*

#### 1. Tech & Commands
```bash
touch apps/api/compliance/wash_sale.py
```

#### 2. Files
- `apps/api/compliance/wash_sale.py`

#### 3. Architecture
- Compliance
- Lookback

#### 4. Autopilot Prompts
- Check 30-day window before closing loss
- Alert trader

#### 5. Risk & Metrics
- **Risk**: Tax complexity.
- **Metric**: Zero wash sales

---

### Day 111: [WEEKEND] Backtest Engine Core
**Saturday** | *Outcome: Research & Cleanup: Event-driven backtester handling historical data replay.*

#### 1. Tech & Commands
```bash
mkdir apps/backtest
```

#### 2. Files
- `apps/backtest/engine.py`

#### 3. Architecture
- Event Loop
- Simulation

#### 4. Autopilot Prompts
- Process market events
- Simulate order execution

#### 5. Risk & Metrics
- **Risk**: Lookahead bias.
- **Metric**: Matches live execution

---

### Day 112: [WEEKEND] Data Feed Interface for Backtest
**Sunday** | *Outcome: Research & Cleanup: Abstract data source to switch between live and historical.*

#### 1. Tech & Commands
```bash
touch apps/backtest/feeds.py
```

#### 2. Files
- `apps/backtest/feeds.py`

#### 3. Architecture
- Interface Segregation
- Generator Pattern

#### 4. Autopilot Prompts
- Yield ticks/bars from Parquet
- Simulate live stream delays

#### 5. Risk & Metrics
- **Risk**: IO Bottleneck.
- **Metric**: 1M bars/sec throughput

---

## Week 17

### Day 113: Execution Simulator (Fill Models)
**Monday** | *Outcome: Simulate fills based on historical OHLCV data.*

#### 1. Tech & Commands
```bash
touch apps/backtest/fills.py
```

#### 2. Files
- `apps/backtest/fills.py`

#### 3. Architecture
- Modeling
- Probabilistic Simulation

#### 4. Autopilot Prompts
- Fill at Open/Close/Next Tick
- Slippage Model based on Volatility

#### 5. Risk & Metrics
- **Risk**: Unrealistic fills.
- **Metric**: Conservative estimation

---

### Day 114: Performance Metrics Library
**Tuesday** | *Outcome: Calculate Sharpe, Sortino, Max Drawdown, CAGR.*

#### 1. Tech & Commands
```bash
touch libs/math/stats.py
```

#### 2. Files
- `libs/math/stats.py`

#### 3. Architecture
- Statistical Analysis
- Numpy/Pandas

#### 4. Autopilot Prompts
- Rolling metrics
- Annualized returns

#### 5. Risk & Metrics
- **Risk**: Calculation errors.
- **Metric**: Verified against PyFolio

---

### Day 115: Parameter Optimization Grid
**Wednesday** | *Outcome: Grid search framework for strategy parameters.*

#### 1. Tech & Commands
```bash
touch apps/backtest/optimizer.py
```

#### 2. Files
- `apps/backtest/optimizer.py`

#### 3. Architecture
- Parallel Processing
- Combinatorics

#### 4. Autopilot Prompts
- Generate param interactions
- Run backtests in parallel

#### 5. Risk & Metrics
- **Risk**: Combinatorial explosion.
- **Metric**: Smart pruning

---

### Day 116: Walk-Forward Analysis
**Thursday** | *Outcome: Implement rolling window training/testing.*

#### 1. Tech & Commands
```bash
touch apps/backtest/walk_forward.py
```

#### 2. Files
- `apps/backtest/walk_forward.py`

#### 3. Architecture
- Cross-Validation
-  robustness testing

#### 4. Autopilot Prompts
- Train window -> Test window -> Slide
- Aggregate OOS results

#### 5. Risk & Metrics
- **Risk**: Overfitting.
- **Metric**: OOS consistency

---

### Day 117: Backtest Reporting & Visualization
**Friday** | *Outcome: Generate tear sheets from backtest results.*

#### 1. Tech & Commands
```bash
touch apps/backtest/report.py
```

#### 2. Files
- `apps/backtest/report.py`

#### 3. Architecture
- Reporting
- Visualization

#### 4. Autopilot Prompts
- Equity curve plot
- Drawdown underwater plot

#### 5. Risk & Metrics
- **Risk**: Ugly charts.
- **Metric**: Professional PDF report

---

### Day 118: [WEEKEND] Strategy Laboratory UI
**Saturday** | *Outcome: Research & Cleanup: Frontend interface to run and visualize backtests.*

#### 1. Tech & Commands
```bash
npm install chartjs
```

#### 2. Files
- `apps/web/src/pages/StrategyLab.tsx`

#### 3. Architecture
- Dashboard
- Interactive Charts

#### 4. Autopilot Prompts
- Param input form
- Result visualization

#### 5. Risk & Metrics
- **Risk**: Slow UI.
- **Metric**: Instant render

---

### Day 119: [WEEKEND] Historical Data Manager
**Sunday** | *Outcome: Research & Cleanup: Tool to manage, clean, and adjust massive historical datasets.*

#### 1. Tech & Commands
```bash
touch apps/data/manager.py
```

#### 2. Files
- `apps/data/manager.py`

#### 3. Architecture
- Data Engineering
- ETL

#### 4. Autopilot Prompts
- Split/Dividend adjustment
- Outlier detection

#### 5. Risk & Metrics
- **Risk**: Bad data.
- **Metric**: Clean reliable history

---

## Week 18

### Day 120: Q2 Month 1 Review & Refactor
**Monday** | *Outcome: Review execution performance and backtest infrastructure.*

#### 1. Tech & Commands
```bash
pytest tests/execution
pytest tests/backtest
```

#### 2. Files
- `REFACTOR_Q2_M1.md`

#### 3. Architecture
- Code Quality
- Tech Debt Payment

#### 4. Autopilot Prompts
- Optimize fill models
- Hardening EMS error handling

#### 5. Risk & Metrics
- **Risk**: Regression.
- **Metric**: All tests pass

---

### Day 121: Unified Broker Factory
**Tuesday** | *Outcome: Implement AbstractBaseBroker and BrokerFactory to switch providers dynamically.*

#### 1. Tech & Commands
```bash
mkdir apps/api/brokers
```

#### 2. Files
- `apps/api/brokers/base.py`
- `apps/api/brokers/factory.py`

#### 3. Architecture
- Factory Pattern
- Abstract Base Class

#### 4. Autopilot Prompts
- Define interface: get_bars, submit_order, get_account
- Register Alpaca, Tradier, IB adapters

#### 5. Risk & Metrics
- **Risk**: Inconsistent APIs.
- **Metric**: Polymorphic calls work

---

### Day 122: Interactive Brokers (IBKR) Adapter
**Wednesday** | *Outcome: Integrate IBKR TWS API via ib_insync for global asset access.*

#### 1. Tech & Commands
```bash
pip install ib_insync
```

#### 2. Files
- `apps/api/brokers/ib.py`

#### 3. Architecture
- Sychronization
- Event Loop Bridge

#### 4. Autopilot Prompts
- Map IB Contract objects
- Handle TWS asynchronous callbacks

#### 5. Risk & Metrics
- **Risk**: Gateway disconnects.
- **Metric**: Auto-reconnect logic

---

### Day 123: Alpaca Adapter V2
**Thursday** | *Outcome: Upgrade Alpaca integration to support margin, shorting, and crypto.*

#### 1. Tech & Commands
```bash
pip install alpaca-trade-api
```

#### 2. Files
- `apps/api/brokers/alpaca.py`

#### 3. Architecture
- Defensive Coding
- API Versioning

#### 4. Autopilot Prompts
- Handle fractional shares
- Support crypto wallets

#### 5. Risk & Metrics
- **Risk**: Rate limits.
- **Metric**: Retry with exponential backoff

---

### Day 124: Tradier Adapter V2 (Options Specialist)
**Friday** | *Outcome: Hardening Tradier adapter for complex multi-leg option orders.*

#### 1. Tech & Commands
```bash
pip install requests
```

#### 2. Files
- `apps/api/brokers/tradier.py`

#### 3. Architecture
- Complex Ordering
- Chain Management

#### 4. Autopilot Prompts
- Submit equity/option combos
- Stream real-time option chain

#### 5. Risk & Metrics
- **Risk**: Stale quotes.
- **Metric**: Stream latency < 200ms

---

### Day 125: [WEEKEND] Crypto Exchange Adapter (Coinbase/Binance)
**Saturday** | *Outcome: Research & Cleanup: Add crypto-native exchange support via CCXT.*

#### 1. Tech & Commands
```bash
pip install ccxt
```

#### 2. Files
- `apps/api/brokers/crypto.py`

#### 3. Architecture
- Unified Interface
- Library Wrapper

#### 4. Autopilot Prompts
- Wrap CCXT methods
- Normalize symbol formats (BTC/USD)

#### 5. Risk & Metrics
- **Risk**: Exchange downtime.
- **Metric**: Failover to backup exchange

---

### Day 126: [WEEKEND] Mock Broker for Simulation
**Sunday** | *Outcome: Research & Cleanup: High-fidelity paper trading engine for forward testing.*

#### 1. Tech & Commands
```bash
touch apps/api/brokers/mock_broker.py
```

#### 2. Files
- `apps/api/brokers/mock_broker.py`

#### 3. Architecture
- Simulation
- State Management

#### 4. Autopilot Prompts
- Simulate latency, partial fills, rejections
- Track synthetic cash balance

#### 5. Risk & Metrics
- **Risk**: Unrealistic fills.
- **Metric**: Fill probability model

---

## Week 19

### Day 127: Broker Config & Credentials Vault
**Monday** | *Outcome: Securely manage API keys for multiple brokers using HashiCorp Vault.*

#### 1. Tech & Commands
```bash
pip install hvac
```

#### 2. Files
- `apps/security/vault.py`

#### 3. Architecture
- Secrets Management
- Security

#### 4. Autopilot Prompts
- Read secrets from Vault
- Inject into broker instances

#### 5. Risk & Metrics
- **Risk**: Key leakage.
- **Metric**: Zero plain text keys

---

### Day 128: Symbol Normalization Service
**Tuesday** | *Outcome: Map disparate symbol formats (BTCUSD, BTC/USD, BTC-USD) to internal ISIN/Ticker.*

#### 1. Tech & Commands
```bash
touch apps/data/symbology.py
```

#### 2. Files
- `apps/data/symbology.py`

#### 3. Architecture
- Data Normalization
- Mapping Registry

#### 4. Autopilot Prompts
- Registry: internal_id -> {broker: symbol}
- Resolve collisions

#### 5. Risk & Metrics
- **Risk**: Mapping errors.
- **Metric**: 100% Symbol Match

---

### Day 129: Order Status Normalization
**Wednesday** | *Outcome: Map broker-specific statuses (pending_new, open, working) to internal Enum.*

#### 1. Tech & Commands
```bash
touch apps/api/models/enums.py
```

#### 2. Files
- `apps/api/models/enums.py`

#### 3. Architecture
- Enum Mapping
- Standardization

#### 4. Autopilot Prompts
- Map IB 'PreSubmitted' -> SUBMITTED
- Map Alpaca 'accepted' -> SUBMITTED

#### 5. Risk & Metrics
- **Risk**: Unhandled states.
- **Metric**: All states covered

---

### Day 130: Account Balance Aggregation
**Thursday** | *Outcome: View total equity across all connected brokerage accounts.*

#### 1. Tech & Commands
```bash
touch apps/api/portfolio/aggregator.py
```

#### 2. Files
- `apps/api/portfolio/aggregator.py`

#### 3. Architecture
- Data Aggregation
- Dashboard

#### 4. Autopilot Prompts
- Sum cash across brokers
- Sum buying power

#### 5. Risk & Metrics
- **Risk**: Currency conversion.
- **Metric**: Unified USD view

---

### Day 131: Unified Market Data Stream
**Friday** | *Outcome: Merge quote streams from all brokers into single 'Best Bid/Offer'.*

#### 1. Tech & Commands
```bash
touch apps/data/nbbo.py
```

#### 2. Files
- `apps/data/nbbo.py`

#### 3. Architecture
- Data Fusion
- Stream Processing

#### 4. Autopilot Prompts
- Compare prices from Alpaca/IB/Tradier
- Publish internal NBBO

#### 5. Risk & Metrics
- **Risk**: Latency arbitration.
- **Metric**: Best price always visible

---

### Day 132: [WEEKEND] Broker Health Monitor
**Saturday** | *Outcome: Research & Cleanup: Real-time heartbeat checks for all broker connections.*

#### 1. Tech & Commands
```bash
touch apps/monitoring/broker_health.py
```

#### 2. Files
- `apps/monitoring/broker_health.py`

#### 3. Architecture
- Health Check
- Watchdog

#### 4. Autopilot Prompts
- Ping APIs every 10s
- Alert on latency spike or error

#### 5. Risk & Metrics
- **Risk**: Silent failure.
- **Metric**: Immediate alert

---

### Day 133: [WEEKEND] Emergency Liquidation switch
**Sunday** | *Outcome: Research & Cleanup: panic button to close all positions across all brokers.*

#### 1. Tech & Commands
```bash
touch apps/api/execution/panic.py
```

#### 2. Files
- `apps/api/execution/panic.py`

#### 3. Architecture
- Risk Management
- Broadcast

#### 4. Autopilot Prompts
- Async gather cancel_all
- Async gather close_all

#### 5. Risk & Metrics
- **Risk**: API timeouts.
- **Metric**: Force close retry loop

---

## Week 20

### Day 134: Broker Reconciliation Engine
**Monday** | *Outcome: Compare internal trade log with broker EOD reports.*

#### 1. Tech & Commands
```bash
touch apps/compliance/broker_recon.py
```

#### 2. Files
- `apps/compliance/broker_recon.py`

#### 3. Architecture
- Reconciliation
- Audit

#### 4. Autopilot Prompts
- Download trade blotters
- Diff against local DB

#### 5. Risk & Metrics
- **Risk**: Missing trades.
- **Metric**: Zero discrepancies

---

### Day 135: Fee Structure Modeling
**Tuesday** | *Outcome: Model commission and rebate schedules for each venue.*

#### 1. Tech & Commands
```bash
touch apps/api/execution/fees.py
```

#### 2. Files
- `apps/api/execution/fees.py`

#### 3. Architecture
- Data Modeling
- Calculation

#### 4. Autopilot Prompts
- Maker/Taker fees
- Tiered volume discounts

#### 5. Risk & Metrics
- **Risk**: Inaccurate estimates.
- **Metric**: Fee prediction < 1% error

---

### Day 136: Cost-Based Routing Logic
**Wednesday** | *Outcome: Route orders to venue with lowest total cost (Price + Fee).*

#### 1. Tech & Commands
```bash
touch apps/api/execution/sor_cost.py
```

#### 2. Files
- `apps/api/execution/sor_cost.py`

#### 3. Architecture
- Optimization
- Greedy Algorithm

#### 4. Autopilot Prompts
- Est. slippage + Commission + Exchange Fee
- Select min()

#### 5. Risk & Metrics
- **Risk**: Ignoring rebates.
- **Metric**: Maximize rebates

---

### Day 137: Latency-Based Routing Logic
**Thursday** | *Outcome: Route to fastest venue for time-sensitive signals.*

#### 1. Tech & Commands
```bash
touch apps/api/execution/sor_speed.py
```

#### 2. Files
- `apps/api/execution/sor_speed.py`

#### 3. Architecture
- Latency Monitoring
- Dynamic Routing

#### 4. Autopilot Prompts
- Track RTT per broker
- Route to min(RTT)

#### 5. Risk & Metrics
- **Risk**: Jitter.
- **Metric**: Fastest path selected

---

### Day 138: Liquidity-Aware Routing
**Friday** | *Outcome: Route size to venue with deepest book.*

#### 1. Tech & Commands
```bash
touch apps/api/execution/sor_liquidity.py
```

#### 2. Files
- `apps/api/execution/sor_liquidity.py`

#### 3. Architecture
- Order Book Analysis
- Smart Routing

#### 4. Autopilot Prompts
- Check Level 2 depth
- Split order proportional to liquidity

#### 5. Risk & Metrics
- **Risk**: Information leakage.
- **Metric**: Min market impact

---

### Day 139: [WEEKEND] Dark Pool & hidden Liquidity
**Saturday** | *Outcome: Research & Cleanup: Attempt implementation of dark pool routing (if supported).*

#### 1. Tech & Commands
```bash
touch apps/api/execution/dark.py
```

#### 2. Files
- `apps/api/execution/dark.py`

#### 3. Architecture
- Venue Analysis
- Conditional Routing

#### 4. Autopilot Prompts
- Ping dark venues with IOC
- Fallback to lit exchanges

#### 5. Risk & Metrics
- **Risk**: Opportunity cost.
- **Metric**: Price improvement

---

### Day 140: [WEEKEND] Routing Rule Engine Configuration
**Sunday** | *Outcome: Research & Cleanup: JSON/YAML config to control routing logic dynamically.*

#### 1. Tech & Commands
```bash
touch apps/api/config/routing_rules.yaml
```

#### 2. Files
- `apps/api/config/routing_loader.py`

#### 3. Architecture
- Configuration Management
- Hot Reload

#### 4. Autopilot Prompts
- Define Rules: IF symbol=SPY THEN Algo=Dark
- Reload without restart

#### 5. Risk & Metrics
- **Risk**: Bad config.
- **Metric**: Schema validation

---

## Week 21

### Day 141: Meta-Router Implementation
**Monday** | *Outcome: Top-level orchestrator deciding which SOR strategy to use.*

#### 1. Tech & Commands
```bash
touch apps/api/execution/meta_router.py
```

#### 2. Files
- `apps/api/execution/meta_router.py`

#### 3. Architecture
- Orchestration
- Decision Tree

#### 4. Autopilot Prompts
- Classify order intent (Alpha vs Hedge)
- Select Cost vs Speed vs Liquidity

#### 5. Risk & Metrics
- **Risk**: Wrong strategy.
- **Metric**: Optimal execution

---

### Day 142: Multi-Broker Integration Test Suite
**Tuesday** | *Outcome: End-to-end tests validating routing across mocked brokers.*

#### 1. Tech & Commands
```bash
pytest tests/integration/test_multibroker.py
```

#### 2. Files
- `tests/integration/test_multibroker.py`

#### 3. Architecture
- Integration Testing
- Mocking

#### 4. Autopilot Prompts
- Simulate all brokers
- Verify correct routing decisions

#### 5. Risk & Metrics
- **Risk**: Flaky tests.
- **Metric**: Deterministic pass

---

### Day 143: Chaos Monkey for Brokers
**Wednesday** | *Outcome: Randomly disconnect/fail broker adapters to test resilience.*

#### 1. Tech & Commands
```bash
pip install chaospy
```

#### 2. Files
- `tests/chaos/broker_chaos.py`

#### 3. Architecture
- Chaos Engineering
- Resilience Testing

#### 4. Autopilot Prompts
- Inject high latency
- Inject HTTP 500s

#### 5. Risk & Metrics
- **Risk**: System crash.
- **Metric**: Graceful degradation

---

### Day 144: Paper Trading Championship
**Thursday** | *Outcome: Run stratgies across all paper accounts to compare execution.*

#### 1. Tech & Commands
```bash
python scripts/run_paper_comp.py
```

#### 2. Files
- `reports/paper_trading_results.md`

#### 3. Architecture
- Benchmarking
- Analysis

#### 4. Autopilot Prompts
- Compare fill prices
- Compare slippage

#### 5. Risk & Metrics
- **Risk**: Bias.
- **Metric**: Winner identified

---

### Day 145: Latency Optimization Sprint
**Friday** | *Outcome: Profile and optimize the critical routing path.*

#### 1. Tech & Commands
```bash
python -m cProfile scripts/profile_router.py
```

#### 2. Files
- `reports/optimization.prof`

#### 3. Architecture
- Profiling
- Optimization

#### 4. Autopilot Prompts
- Remove unnecessary allocations
- Asyncio loop optimization

#### 5. Risk & Metrics
- **Risk**: Premature optimization.
- **Metric**: Path latency < 2ms

---

### Day 146: [WEEKEND] Failover Handling
**Saturday** | *Outcome: Research & Cleanup: Automatic failover if primary broker is down.*

#### 1. Tech & Commands
```bash
touch apps/api/execution/failover.py
```

#### 2. Files
- `apps/api/execution/failover.py`

#### 3. Architecture
- Reliability
- Fallback Strategy

#### 4. Autopilot Prompts
- If IBKR timeouts > 3
- Switch routing to Alpaca

#### 5. Risk & Metrics
- **Risk**: Flapping.
- **Metric**: Stable switch

---

### Day 147: [WEEKEND] Manual Override Dashboard
**Sunday** | *Outcome: Research & Cleanup: Admin panel to manually force routing destinations.*

#### 1. Tech & Commands
```bash
touch apps/web/src/pages/RouterControl.tsx
```

#### 2. Files
- `apps/api/routes/router_control.py`

#### 3. Architecture
- Admin UI
- Control Plane

#### 4. Autopilot Prompts
- Toggle broker status
- Force specific route

#### 5. Risk & Metrics
- **Risk**: Ops error.
- **Metric**: Operator confirms action

---

## Week 22

### Day 148: Compliance Logging (CAT/OATS)
**Monday** | *Outcome: Log every routing decision for audit trail.*

#### 1. Tech & Commands
```bash
touch apps/compliance/audit_log.py
```

#### 2. Files
- `apps/compliance/audit_log.py`

#### 3. Architecture
- Compliance
- Structured Logging

#### 4. Autopilot Prompts
- Log Inputs, Decision, Output
- Timestamp precision ns

#### 5. Risk & Metrics
- **Risk**: Disk fill.
- **Metric**: Log rotation

---

### Day 149: Deployment to Staging
**Tuesday** | *Outcome: Deploy multi-broker system to staging environment.*

#### 1. Tech & Commands
```bash
kubectl apply -f k8s/staging/
```

#### 2. Files
- `k8s/staging/deployment.yaml`

#### 3. Architecture
- DevOps
- CI/CD

#### 4. Autopilot Prompts
- Connect to paper APIs
- Verify connectivity

#### 5. Risk & Metrics
- **Risk**: Config drift.
- **Metric**: Staging matches Prod

---

### Day 150: Q2 Month 2 Review
**Wednesday** | *Outcome: Synthesize learnings from multi-broker implementation.*

#### 1. Tech & Commands
```bash
touch reports/q2_m2_review.md
```

#### 2. Files
- `reports/q2_m2_review.md`

#### 3. Architecture
- Review
- Documentation

#### 4. Autopilot Prompts
- Assess execution quality
- Plan for production

#### 5. Risk & Metrics
- **Risk**: Missed reqs.
- **Metric**: Ready for Hardening

---

### Day 151: Global Circuit Breaker (P&L Based)
**Thursday** | *Outcome: Implement system-wide kill switch triggered by excessive drawdown.*

#### 1. Tech & Commands
```bash
touch apps/risk/circuit_breaker.py
```

#### 2. Files
- `apps/risk/circuit_breaker.py`

#### 3. Architecture
- State Pattern
- Observer

#### 4. Autopilot Prompts
- Monitor total P&L stream
- Trigger HALT if DD > 5%

#### 5. Risk & Metrics
- **Risk**: False trip.
- **Metric**: Auto-halt under crash conditions

---

### Day 152: Symbol-Level Circuit Breakers (LULD)
**Friday** | *Outcome: Halt trading on individual symbols if price moves too fast (Limit Up/Limit Down).*

#### 1. Tech & Commands
```bash
touch apps/risk/luld.py
```

#### 2. Files
- `apps/risk/luld.py`

#### 3. Architecture
- Stream Processing
- Volatility Monitoring

#### 4. Autopilot Prompts
- Calc rolling volatility
- Trigger symbol halt if > 2σ move in 5m

#### 5. Risk & Metrics
- **Risk**: Laggy data.
- **Metric**: Instant protection

---

### Day 153: [WEEKEND] Order Velocity Limiter
**Saturday** | *Outcome: Research & Cleanup: Prevent high-frequency runaways (algo gone wild).*

#### 1. Tech & Commands
```bash
touch apps/risk/velocity.py
```

#### 2. Files
- `apps/risk/velocity.py`

#### 3. Architecture
- Rate Limiting
- Counting

#### 4. Autopilot Prompts
- Limit 100 orders/minute per algo
- Hard stop on violation

#### 5. Risk & Metrics
- **Risk**: Legitimate volume blocked.
- **Metric**: Zero runaway algos

---

### Day 154: [WEEKEND] Max Notional Limits Service
**Sunday** | *Outcome: Research & Cleanup: Centralized service to enforce position size limits.*

#### 1. Tech & Commands
```bash
touch apps/risk/limits_service.py
```

#### 2. Files
- `apps/risk/limits_service.py`

#### 3. Architecture
- Microservice
- Validation

#### 4. Autopilot Prompts
- Reject orders > $50k
- Reject total exposure > $500k

#### 5. Risk & Metrics
- **Risk**: Latency.
- **Metric**: Pre-trade check < 2ms

---

## Week 23

### Day 155: Kill Switch UI Button
**Monday** | *Outcome: Physical/Digital 'Big Red Button' to flatten everything immediately.*

#### 1. Tech & Commands
```bash
npm install @heroicons/react
```

#### 2. Files
- `apps/web/src/features/Risk/KillSwitch.tsx`

#### 3. Architecture
- Emergency UI
- Websocket Command

#### 4. Autopilot Prompts
- Send 'FLATTEN_ALL' command
- Require 2-factor confirmation

#### 5. Risk & Metrics
- **Risk**: Accidental press.
- **Metric**: Immediate risk reduction

---

### Day 156: Risk Dashboard & Alerts
**Tuesday** | *Outcome: Real-time visualization of risk metrics (VaR, Greeks, Exposure).*

#### 1. Tech & Commands
```bash
touch apps/risk/dashboard_feed.py
```

#### 2. Files
- `apps/risk/dashboard_feed.py`

#### 3. Architecture
- Aggregator
- Push Notification

#### 4. Autopilot Prompts
- Stream exposures to frontend
- Alert on limits approaching

#### 5. Risk & Metrics
- **Risk**: Information overload.
- **Metric**: Clear RYG indicators

---

### Day 157: Incident Response Playbook
**Wednesday** | *Outcome: Documentation and automated scripts for recovery scenarios.*

#### 1. Tech & Commands
```bash
mkdir docs/playbooks
```

#### 2. Files
- `docs/playbooks/incident_response.md`
- `scripts/emergency/flatten.py`

#### 3. Architecture
- Disaster Recovery
- Runbooks

#### 4. Autopilot Prompts
- Define escalation path
- Automate recovery scripts

#### 5. Risk & Metrics
- **Risk**: Panic during outage.
- **Metric**: Calm execution

---

### Day 158: HAProxy Load Balancer
**Thursday** | *Outcome: Deploy HAProxy to distribute traffic across API instances.*

#### 1. Tech & Commands
```bash
sudo apt-get install haproxy
```

#### 2. Files
- `docker/haproxy/haproxy.cfg`

#### 3. Architecture
- Load Balancing
- High Availability

#### 4. Autopilot Prompts
- Round-robin strategies
- Health-check endpoints

#### 5. Risk & Metrics
- **Risk**: Single point of failure.
- **Metric**: Zero downtime upgrades

---

### Day 159: PostgreSQL High Availability (Patroni)
**Friday** | *Outcome: Setup PostgreSQL replication with auto-failover using Patroni.*

#### 1. Tech & Commands
```bash
pip install patroni[etcd]
```

#### 2. Files
- `docker/postgres/patroni.yml`

#### 3. Architecture
- Database Replication
- Consensus

#### 4. Autopilot Prompts
- Configure Primary/Replica
- Test failover

#### 5. Risk & Metrics
- **Risk**: Split brain.
- **Metric**: Automatic leader election

---

### Day 160: [WEEKEND] Redis Sentinel Cluster
**Saturday** | *Outcome: Research & Cleanup: Deploy Redis Sentinel for high-availability caching.*

#### 1. Tech & Commands
```bash
touch docker/redis/sentinel.conf
```

#### 2. Files
- `docker-compose.ha.yml`

#### 3. Architecture
- Distributed Caching
- Failover

#### 4. Autopilot Prompts
- Configure Quorum
- Client-side sentinel support

#### 5. Risk & Metrics
- **Risk**: Cache loss.
- **Metric**: Seamless failover

---

### Day 161: [WEEKEND] Kubernetes Deployment Manifests
**Sunday** | *Outcome: Research & Cleanup: Prepare Helm charts for production Kubernetes deployment.*

#### 1. Tech & Commands
```bash
mkdir k8s/charts
```

#### 2. Files
- `k8s/charts/values.yaml`

#### 3. Architecture
- Infrastructure as Code
- Orchestration

#### 4. Autopilot Prompts
- Define Resources (CPU/RAM)
- Configure Probes

#### 5. Risk & Metrics
- **Risk**: Resource starvation.
- **Metric**: Auto-scaling

---

## Week 24

### Day 162: Database Backup & Wal-G
**Monday** | *Outcome: Continuous archiving of WAL logs for Point-in-Time Recovery.*

#### 1. Tech & Commands
```bash
pip install wal-g
```

#### 2. Files
- `scripts/db/backup_wal.sh`

#### 3. Architecture
- Data Durability
- Backup

#### 4. Autopilot Prompts
- Push WAL to S3
- Test restore procedure

#### 5. Risk & Metrics
- **Risk**: Data corruption.
- **Metric**: Recover to any second

---

### Day 163: Secret Rotation Policy
**Tuesday** | *Outcome: Automate rotation of database passwords and API keys.*

#### 1. Tech & Commands
```bash
touch scripts/security/rotate_secrets.py
```

#### 2. Files
- `scripts/security/rotate_secrets.py`

#### 3. Architecture
- Security Operations
- Automation

#### 4. Autopilot Prompts
- Rotate Vault secrets
- Restart services safely

#### 5. Risk & Metrics
- **Risk**: Downtime during rotation.
- **Metric**: Zero-downtime rotation

---

### Day 164: Chaos Engineering: Network Partition
**Wednesday** | *Outcome: Simulate network failures between microservices.*

#### 1. Tech & Commands
```bash
pip install toxiproxy
```

#### 2. Files
- `tests/chaos/network_partition.py`

#### 3. Architecture
- Resilience Testing
- Fault Injection

#### 4. Autopilot Prompts
- Cut link between API and DB
- Verify graceful handling

#### 5. Risk & Metrics
- **Risk**: Cascading failures.
- **Metric**: System survival

---

### Day 165: Cython Compilation of Hot Paths
**Thursday** | *Outcome: Compile critical math loops to C extensions for speed.*

#### 1. Tech & Commands
```bash
pip install cython
```

#### 2. Files
- `libs/math/setup.py`

#### 3. Architecture
- Compilation
- Performance

#### 4. Autopilot Prompts
- Annotate types in inner loops
- Build .so modules

#### 5. Risk & Metrics
- **Risk**: Build complexity.
- **Metric**: 10x speedup

---

### Day 166: AsyncIO Event Loop Optimization
**Friday** | *Outcome: Refine asyncio policy (uvloop) for max throughput.*

#### 1. Tech & Commands
```bash
pip install uvloop
```

#### 2. Files
- `apps/api/main.py`

#### 3. Architecture
- Concurrency
- Low Latency

#### 4. Autopilot Prompts
- Replace default loop with uvloop
- Tune thread pool executors

#### 5. Risk & Metrics
- **Risk**: Blocking calls.
- **Metric**: Throughput check

---

### Day 167: [WEEKEND] Database Query Optimization (EXPLAIN ANALYZE)
**Saturday** | *Outcome: Research & Cleanup: Identify and fix slow queries.*

#### 1. Tech & Commands
```bash
python scripts/db/analyze_queries.py
```

#### 2. Files
- `reports/slow_query_log.md`

#### 3. Architecture
- Database Tuning
- Indexing

#### 4. Autopilot Prompts
- Add missing indexes
- Rewrite complex joins

#### 5. Risk & Metrics
- **Risk**: Table scans.
- **Metric**: Index only scans

---

### Day 168: [WEEKEND] Frontend Bundle Optimization
**Sunday** | *Outcome: Research & Cleanup: Reduce JS bundle size for faster load times.*

#### 1. Tech & Commands
```bash
npm run build -- --report
```

#### 2. Files
- `apps/web/vite.config.ts`

#### 3. Architecture
- Tree Shaking
- Code Splitting

#### 4. Autopilot Prompts
- Lazy load heavy charts
- Compress assets (Brotli)

#### 5. Risk & Metrics
- **Risk**: Megabyte bundles.
- **Metric**: Load < 1s

---

## Week 25

### Day 169: Memory Leak Hunt
**Monday** | *Outcome: Profile memory usage to find leaks in long-running services.*

#### 1. Tech & Commands
```bash
pip install memray
```

#### 2. Files
- `scripts/profile_memory.py`

#### 3. Architecture
- Profiling
- Resource Management

#### 4. Autopilot Prompts
- Run under load
- Analyze heap dump

#### 5. Risk & Metrics
- **Risk**: OOM Kills.
- **Metric**: Stable heap

---

### Day 170: Latency Histogram Analysis
**Tuesday** | *Outcome: Detailed analysis of p99 latency across the stack.*

#### 1. Tech & Commands
```bash
python scripts/analyze_latency.py
```

#### 2. Files
- `reports/latency_p99.png`

#### 3. Architecture
- Observability
- Performance Tuning

#### 4. Autopilot Prompts
- Identify outliers
- Smooth out GC pauses

#### 5. Risk & Metrics
- **Risk**: Jitter.
- **Metric**: p99 < 50ms

---

### Day 171: API Documentation (OpenAPI/Swagger)
**Wednesday** | *Outcome: Finalize API specs for internal and external consumers.*

#### 1. Tech & Commands
```bash
pip install fastapi-code-generator
```

#### 2. Files
- `docs/api/openapi.json`

#### 3. Architecture
- Documentation
- Contract Testing

#### 4. Autopilot Prompts
- Generate client SDKs
- Validate schema adherence

#### 5. Risk & Metrics
- **Risk**: Outdated docs.
- **Metric**: Live documentation

---

### Day 172: System Architecture Diagram Update
**Thursday** | *Outcome: Update C4 context/container diagrams to reflect current state.*

#### 1. Tech & Commands
```bash
pip install diagrams
```

#### 2. Files
- `docs/arch/c4_diagrams.py`

#### 3. Architecture
- Visualization
- Architecture

#### 4. Autopilot Prompts
- Render system components
- Document data flows

#### 5. Risk & Metrics
- **Risk**: Stale diagrams.
- **Metric**: Accurate map

---

### Day 173: Developer Onboarding Guide
**Friday** | *Outcome: Write 'How to Contribute' guide for new team members.*

#### 1. Tech & Commands
```bash
touch docs/CONTRIBUTING.md
```

#### 2. Files
- `docs/CONTRIBUTING.md`

#### 3. Architecture
- DevEx
- Documentation

#### 4. Autopilot Prompts
- Setup instructions
- Coding standards

#### 5. Risk & Metrics
- **Risk**: Confusing setup.
- **Metric**: Setup in 15 mins

---

### Day 174: [WEEKEND] Operational Runbooks
**Saturday** | *Outcome: Research & Cleanup: Standard Operating Procedures for day-to-day ops.*

#### 1. Tech & Commands
```bash
touch docs/ops/runbooks.md
```

#### 2. Files
- `docs/ops/runbooks.md`

#### 3. Architecture
- Operations
- Knowledge Base

#### 4. Autopilot Prompts
- Deployment steps
- Debugging guide

#### 5. Risk & Metrics
- **Risk**: Tribal knowledge.
- **Metric**: Written procedures

---

### Day 175: [WEEKEND] Post-Mortem Templates
**Sunday** | *Outcome: Research & Cleanup: Template for analyzing incidents properly.*

#### 1. Tech & Commands
```bash
touch docs/ops/post_mortem_template.md
```

#### 2. Files
- `docs/ops/post_mortem_template.md`

#### 3. Architecture
- Incident Management
- Learning

#### 4. Autopilot Prompts
- Timeline, Root Cause, Remediation
- 5 Whys

#### 5. Risk & Metrics
- **Risk**: Blame game.
- **Metric**: Systemic improvement

---

## Week 26

### Day 176: Code Coverage Report
**Monday** | *Outcome: Ensure test coverage meets 90% standard.*

#### 1. Tech & Commands
```bash
pytest --cov=apps --cov-report=html
```

#### 2. Files
- `htmlcov/index.html`

#### 3. Architecture
- Quality Assurance
- Metrics

#### 4. Autopilot Prompts
- Identify untested paths
- Add tests for edge cases

#### 5. Risk & Metrics
- **Risk**: False confidence.
- **Metric**: >90% Coverage

---

### Day 177: Dependency Audit
**Tuesday** | *Outcome: Check for security vulnerabilities in dependencies.*

#### 1. Tech & Commands
```bash
pip install safety bandit
```

#### 2. Files
- `scripts/security/audit_deps.sh`

#### 3. Architecture
- Security
- Supply Chain

#### 4. Autopilot Prompts
- Upgrade vulnerable packages
- Pin dependencies

#### 5. Risk & Metrics
- **Risk**: CVE exposure.
- **Metric**: Zero Critical CVEs

---

### Day 178: Q2 Performance Review
**Wednesday** | *Outcome: Review trading performance (Sharpe, Drawdown) for the Quarter.*

#### 1. Tech & Commands
```bash
python scripts/reporting/q2_performance.py
```

#### 2. Files
- `reports/q2_performance.md`

#### 3. Architecture
- Analytics
- Review

#### 4. Autopilot Prompts
- Analyze P&L attribution
- Review error logs

#### 5. Risk & Metrics
- **Risk**: Negative Alpha.
- **Metric**: Positive Expectancy

---

### Day 179: Tech Debt Grooming
**Thursday** | *Outcome: Identify and prioritize tech debt for Q3.*

#### 1. Tech & Commands
```bash
touch docs/planning/tech_debt_backlog.md
```

#### 2. Files
- `docs/planning/tech_debt_backlog.md`

#### 3. Architecture
- Planning
- Maintenance

#### 4. Autopilot Prompts
- List shortcuts taken
- Estimate repayment effort

#### 5. Risk & Metrics
- **Risk**: Unmanageable debt.
- **Metric**: Clear plan

---

### Day 180: Quarter 3 Planning Session
**Friday** | *Outcome: Detailed roadmap planning for ML and Portfolio Optimization.*

#### 1. Tech & Commands
```bash
touch docs/planning/q3_roadmap.md
```

#### 2. Files
- `docs/planning/q3_roadmap.md`

#### 3. Architecture
- Strategy
- Roadmap

#### 4. Autopilot Prompts
- Define Q3 constraints
- Set milestones

#### 5. Risk & Metrics
- **Risk**: Aimless dev.
- **Metric**: Aligned objectives

---
