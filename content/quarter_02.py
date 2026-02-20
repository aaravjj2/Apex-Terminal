
# ══════════════════════════════════════════════════════════════════════════════
# V4 CONTENT: QUARTER 2 (DAYS 91-180)
# Theme: HARDENING, EXECUTION & MULTI-BROKER
# ══════════════════════════════════════════════════════════════════════════════

DAYS = {}

# ─── HELPER FUNCTIONS ────────────────────────────────────────────────────────
def add_day(day_num, title, outcome, commands, files, arch, autopilot, risk, metrics):
    week_num = (day_num - 1) // 7 + 1
    weekday_idx = (day_num - 1) % 7
    weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    
    if weekday_idx >= 5: # Weekend Work
        title = f"[WEEKEND] {title}"
        outcome = f"Research & Cleanup: {outcome}"
    
    DAYS[day_num] = {
        'day_global': day_num,
        'weekday': weekdays[weekday_idx],
        'title': title,
        'outcome': outcome,
        'commands': commands,
        'files': files,
        'arch': arch,
        'autopilot': autopilot,
        'risk': risk,
        'metrics': metrics
    }

def _d(day_num, title, outcome, commands, files, arch, autopilot, risk, metrics):
    add_day(day_num, title, outcome, commands, files, arch, autopilot, risk, metrics)

# ─── POPULATE CONTENT ────────────────────────────────────────────────────────

# Source: q2_days_91_120.py
add_day(91, "OMS vs EMS Architecture",
    "Decouple Strategy (Signal) from Execution (Order). Create specialized EMS for different venues.",
    ["mkdir -p apps/api/execution/ems apps/api/execution/oms",
     "touch apps/api/execution/ems/base.py apps/api/execution/ems/alpaca.py",
     "touch apps/api/execution/oms/order_manager.py"],
    ["apps/api/execution/ems/base.py (new: AbstractBaseEMS with submit/cancel/replace)",
     "apps/api/execution/oms/order_manager.py (new: lifecycle management, state transitions)",
     "apps/api/models/order.py (update: add parent_id, child_ids, algo_params field)",
     "apps/api/execution/factory.py (new: get_ems_for_symbol(symbol) -> EMS instance)"],
    ["Inversion of Control: Strategy doesn't know about broker API",
     "Factory Pattern: Route orders to correct EMS based on asset class/broker",
     "State Machine: NEW -> SUBMITTED -> PARTIAL -> FILLED (or REJECTED/CANCELED)"],
    ["Prompt: 'Create AbstractBaseEMS class with async methods submit_order, cancel_order, replace_order.'",
     "Prompt: 'Implement OrderManager state machine using Transitions library.'",
     "Prompt: 'Write factory function to return AlpacaEMS for equities and TradierEMS for options.'"],
    "Race conditions in state updates.", "Order state strictly monotonic"
)

add_day(92, "FIX Protocol Adapter (Mock)",
    "Implement initial FIX protocol handler (QuickFIX) for institutional connectivity simulation.",
    ["pip install quickfix"],
    ["libs/fix/initiator.py", "libs/fix/config.cfg"],
    ["Adapter Pattern", "Event-Driven Architecture"],
    ["Configure QuickFIX initiator", "Map FIX tags (35=D, 55=Sym) to internal Order model"],
    "Message parsing overhead.", "Round-trip time < 5ms"
)

add_day(93, "Smart Order Router (SOR) - Level 1",
    "Basic routing logic: separate crypto vs equity vs options.",
    ["python scripts/test_router.py"],
    ["apps/api/execution/sor.py"],
    ["Strategy Pattern", "Rule Engine"],
    ["Route BTC* to CryptoEMS", "Route SPY to AlpacaEMS", "Route SPY options to TradierEMS"],
    "Routing loops.", "100% Correct Routing"
)

add_day(94, "Execution Algo: TWAP Logic",
    "Implement Time-Weighted Average Price algorithm core logic.",
    ["mkdir apps/api/execution/algos"],
    ["apps/api/execution/algos/twap.py"],
    ["Time Slicing", "Schedule Generation"],
    ["Divide total qty by duration", "Generate schedule of child orders"],
    "Signaling intent (too regular).", "Schedule deviations within limits"
)

add_day(95, "Execution Algo: TWAP Scheduler",
    "Integrate TWAP with APScheduler to submit child orders.",
    ["pip install apscheduler"],
    ["apps/api/execution/algos/scheduler.py"],
    ["Task Scheduling", "Async Execution"],
    ["Schedule child order submissions", "Handle partial fills of children"],
    "Drift.", "Complete filling by end time"
)

add_day(96, "Execution Algo: VWAP Volatility Profile",
    "Calculate historical volume profiles for VWAP targets.",
    ["python scripts/calc_vol_profile.py"],
    ["libs/math/volume_profile.py"],
    ["Data Analysis", "Curve Fitting"],
    ["Bin intraday volume by 1-min buckets", "Normalize to % of daily volume"],
    "Data gaps.", "Profile correlation > 0.9"
)

add_day(97, "Execution Algo: VWAP Engine",
    "Implement Volume-Weighted Average Price execution logic.",
    ["touch apps/api/execution/algos/vwap.py"],
    ["apps/api/execution/algos/vwap.py"],
    ["Participation Rate", "Feedback Loop"],
    ["Compare current vol to profile", "Adjust participation rate aggression"],
    "Chasing price.", "Execution vs VWAP < 5bps"
)

# Week 15: Advanced Order Types & Safety
add_day(98, "Iceberg Orders",
    "Implement hidden order logic to minimize market impact.",
    ["touch apps/api/execution/algos/iceberg.py"],
    ["apps/api/execution/algos/iceberg.py"],
    ["Order Management", "Visibility Hiding"],
    ["Display size vs Total size", "Reload logic when tip is filled"],
    "Reload latency.", "Tip size randomized"
)

add_day(99, "Stop-Limit & Trailing Stop Server-Side",
    "Implement synthetic stops management in OMS (not broker-side).",
    ["touch apps/api/execution/algos/stops.py"],
    ["apps/api/execution/algos/stops.py"],
    ["Event Monitoring", "Trigger Logic"],
    ["Monitor tick stream", "Trigger limit order submission on price event"],
    "Slippage on gap.", "Trigger reliability 100%"
)

add_day(100, "Bracket Orders (OSO/OTO)",
    "One-Triggers-Other / One-Cancels-Other complex order types.",
    ["python tests/test_bracket.py"],
    ["apps/api/execution/oms/bracket_manager.py"],
    ["DAG Execution", "Parent-Child Links"],
    ["Entry fill triggers Stop & Target", "Stop fill cancels Target"],
    "Orphaned legs.", "Atomic state updates"
)

add_day(101, "Fat Finger Protection",
    "Middleware to reject orders exceeding size/value limits.",
    ["touch apps/api/middleware/validation.py"],
    ["apps/api/middleware/validation.py"],
    ["Validation Decoration", "Policy Enforcement"],
    ["Max notional check ($50k)", "Max qty check (1000 shares)"],
    "Latency in checks.", "Rejected orders < 10ms"
)

add_day(102, "Rate Limiting (Order Submission)",
    "Strict leaky bucket rate limiter per broker.",
    ["python scripts/test_rate_limit.py"],
    ["apps/api/execution/limiter.py"],
    ["Token Bucket", "Redis Counter"],
    ["Alpaca: 200/min", "Tradier: 120/min"],
    "429 Errors.", "Zero 429s from brokers"
)

add_day(103, "Duplicate Order Detection",
    "Prevent accidental double execution of identical signals.",
    ["touch apps/api/execution/dedup.py"],
    ["apps/api/execution/dedup.py"],
    ["Hashing", "Idempotency"],
    ["Hash(symbol, side, qty, strategy, timestamp bucket)", "Check Redis for recent execution"],
    "False positives.", "No duplicate fills"
)

add_day(104, "Execution Reports & Fill Reconciliation",
    "Reconcile broker execution reports with internal order state.",
    ["touch apps/api/execution/recon.py"],
    ["apps/api/execution/recon.py"],
    ["Data Reconciliation", "Event Sourcing"],
    ["Match fills to orders", "Detect execution breaks"],
    "Missing fills.", "100% State Match"
)

# Week 16: Position & Portfolio Management
add_day(105, "Real-Time Position Tracker",
    "Aggregate fills into absolute positions in real-time.",
    ["touch apps/api/portfolio/positions.py"],
    ["apps/api/portfolio/positions.py"],
    ["Aggregation", "Stream Processing"],
    ["Update avg_entry_price", "Update realized/unrealized P&L"],
    "Calculation drift.", "Matches broker daily statement"
)

add_day(106, "Mark-to-Market Engine",
    "Calculate portfolio NAV continuously based on live quotes.",
    ["touch apps/api/portfolio/mtm.py"],
    ["apps/api/portfolio/mtm.py"],
    ["Valuation", "Pricing Engine"],
    ["Stream prices", "Recompute Equity = Cash + Positions"],
    "Stale prices.", "NAV latency < 100ms"
)

add_day(107, "Cash Management & buying_power",
    "Track cash balances, settlements, and available buying power.",
    ["touch apps/api/portfolio/cash.py"],
    ["apps/api/portfolio/cash.py"],
    ["Accounting", "Ledger"],
    ["T+1 Settlement logic", "Margin requirement calc"],
    "Over-leveraging.", "Zero margin calls"
)

add_day(108, "Portfolio Greeks Aggregation",
    "Sum individual option greeks to portfolio level.",
    ["python scripts/calc_portfolio_greeks.py"],
    ["apps/api/portfolio/greeks.py"],
    ["Matrix Math", "Risk Aggregation"],
    ["Weighted sum of Delta/Gamma/Vega", "Beta-weighted Delta"],
    "Computation load.", "Update frequency < 1s"
)

add_day(109, "Sector Exposure Monitor",
    "Track exposure concentration by GICS sector.",
    ["touch apps/api/portfolio/risk_exposure.py"],
    ["apps/api/portfolio/risk_exposure.py"],
    ["Categorization", "Aggregation"],
    ["Map symbol -> sector", "Sum exposure per sector"],
    "Mapping gaps.", "Unclassified < 1%"
)

add_day(110, "Wash Sale Prevention",
    "Track recent trades to avoid washing losses (30-day rule).",
    ["touch apps/api/compliance/wash_sale.py"],
    ["apps/api/compliance/wash_sale.py"],
    ["Compliance", "Lookback"],
    ["Check 30-day window before closing loss", "Alert trader"],
    "Tax complexity.", "Zero wash sales"
)

# Week 17: Backtesting Infrastructure
add_day(111, "Backtest Engine Core",
    "Event-driven backtester handling historical data replay.",
    ["mkdir apps/backtest"],
    ["apps/backtest/engine.py"],
    ["Event Loop", "Simulation"],
    ["Process market events", "Simulate order execution"],
    "Lookahead bias.", "Matches live execution"
)

add_day(112, "Data Feed Interface for Backtest",
    "Abstract data source to switch between live and historical.",
    ["touch apps/backtest/feeds.py"],
    ["apps/backtest/feeds.py"],
    ["Interface Segregation", "Generator Pattern"],
    ["Yield ticks/bars from Parquet", "Simulate live stream delays"],
    "IO Bottleneck.", "1M bars/sec throughput"
)

add_day(113, "Execution Simulator (Fill Models)",
    "Simulate fills based on historical OHLCV data.",
    ["touch apps/backtest/fills.py"],
    ["apps/backtest/fills.py"],
    ["Modeling", "Probabilistic Simulation"],
    ["Fill at Open/Close/Next Tick", "Slippage Model based on Volatility"],
    "Unrealistic fills.", "Conservative estimation"
)

add_day(114, "Performance Metrics Library",
    "Calculate Sharpe, Sortino, Max Drawdown, CAGR.",
    ["touch libs/math/stats.py"],
    ["libs/math/stats.py"],
    ["Statistical Analysis", "Numpy/Pandas"],
    ["Rolling metrics", "Annualized returns"],
    "Calculation errors.", "Verified against PyFolio"
)

add_day(115, "Parameter Optimization Grid",
    "Grid search framework for strategy parameters.",
    ["touch apps/backtest/optimizer.py"],
    ["apps/backtest/optimizer.py"],
    ["Parallel Processing", "Combinatorics"],
    ["Generate param interactions", "Run backtests in parallel"],
    "Combinatorial explosion.", "Smart pruning"
)

add_day(116, "Walk-Forward Analysis",
    "Implement rolling window training/testing.",
    ["touch apps/backtest/walk_forward.py"],
    ["apps/backtest/walk_forward.py"],
    ["Cross-Validation", " robustness testing"],
    ["Train window -> Test window -> Slide", "Aggregate OOS results"],
    "Overfitting.", "OOS consistency"
)

add_day(117, "Backtest Reporting & Visualization",
    "Generate tear sheets from backtest results.",
    ["touch apps/backtest/report.py"],
    ["apps/backtest/report.py"],
    ["Reporting", "Visualization"],
    ["Equity curve plot", "Drawdown underwater plot"],
    "Ugly charts.", "Professional PDF report"
)

add_day(118, "Strategy Laboratory UI",
    "Frontend interface to run and visualize backtests.",
    ["npm install chartjs"],
    ["apps/web/src/pages/StrategyLab.tsx"],
    ["Dashboard", "Interactive Charts"],
    ["Param input form", "Result visualization"],
    "Slow UI.", "Instant render"
)

add_day(119, "Historical Data Manager",
    "Tool to manage, clean, and adjust massive historical datasets.",
    ["touch apps/data/manager.py"],
    ["apps/data/manager.py"],
    ["Data Engineering", "ETL"],
    ["Split/Dividend adjustment", "Outlier detection"],
    "Bad data.", "Clean reliable history"
)

add_day(120, "Q2 Month 1 Review & Refactor",
    "Review execution performance and backtest infrastructure.",
    ["pytest tests/execution", "pytest tests/backtest"],
    ["REFACTOR_Q2_M1.md"],
    ["Code Quality", "Tech Debt Payment"],
    ["Optimize fill models", "Hardening EMS error handling"],
    "Regression.", "All tests pass"
)


# Source: q2_days_121_150.py
add_day(121, "Unified Broker Factory",
    "Implement AbstractBaseBroker and BrokerFactory to switch providers dynamically.",
    ["mkdir apps/api/brokers"],
    ["apps/api/brokers/base.py", "apps/api/brokers/factory.py"],
    ["Factory Pattern", "Abstract Base Class"],
    ["Define interface: get_bars, submit_order, get_account", "Register Alpaca, Tradier, IB adapters"],
    "Inconsistent APIs.", "Polymorphic calls work"
)

add_day(122, "Interactive Brokers (IBKR) Adapter",
    "Integrate IBKR TWS API via ib_insync for global asset access.",
    ["pip install ib_insync"],
    ["apps/api/brokers/ib.py"],
    ["Sychronization", "Event Loop Bridge"],
    ["Map IB Contract objects", "Handle TWS asynchronous callbacks"],
    "Gateway disconnects.", "Auto-reconnect logic"
)

add_day(123, "Alpaca Adapter V2",
    "Upgrade Alpaca integration to support margin, shorting, and crypto.",
    ["pip install alpaca-trade-api"],
    ["apps/api/brokers/alpaca.py"],
    ["Defensive Coding", "API Versioning"],
    ["Handle fractional shares", "Support crypto wallets"],
    "Rate limits.", "Retry with exponential backoff"
)

add_day(124, "Tradier Adapter V2 (Options Specialist)",
    "Hardening Tradier adapter for complex multi-leg option orders.",
    ["pip install requests"],
    ["apps/api/brokers/tradier.py"],
    ["Complex Ordering", "Chain Management"],
    ["Submit equity/option combos", "Stream real-time option chain"],
    "Stale quotes.", "Stream latency < 200ms"
)

add_day(125, "Crypto Exchange Adapter (Coinbase/Binance)",
    "Add crypto-native exchange support via CCXT.",
    ["pip install ccxt"],
    ["apps/api/brokers/crypto.py"],
    ["Unified Interface", "Library Wrapper"],
    ["Wrap CCXT methods", "Normalize symbol formats (BTC/USD)"],
    "Exchange downtime.", "Failover to backup exchange"
)

add_day(126, "Mock Broker for Simulation",
    "High-fidelity paper trading engine for forward testing.",
    ["touch apps/api/brokers/mock_broker.py"],
    ["apps/api/brokers/mock_broker.py"],
    ["Simulation", "State Management"],
    ["Simulate latency, partial fills, rejections", "Track synthetic cash balance"],
    "Unrealistic fills.", "Fill probability model"
)

add_day(127, "Broker Config & Credentials Vault",
    "Securely manage API keys for multiple brokers using HashiCorp Vault.",
    ["pip install hvac"],
    ["apps/security/vault.py"],
    ["Secrets Management", "Security"],
    ["Read secrets from Vault", "Inject into broker instances"],
    "Key leakage.", "Zero plain text keys"
)

# Week 19: Normalization Layer
add_day(128, "Symbol Normalization Service",
    "Map disparate symbol formats (BTCUSD, BTC/USD, BTC-USD) to internal ISIN/Ticker.",
    ["touch apps/data/symbology.py"],
    ["apps/data/symbology.py"],
    ["Data Normalization", "Mapping Registry"],
    ["Registry: internal_id -> {broker: symbol}", "Resolve collisions"],
    "Mapping errors.", "100% Symbol Match"
)

add_day(129, "Order Status Normalization",
    "Map broker-specific statuses (pending_new, open, working) to internal Enum.",
    ["touch apps/api/models/enums.py"],
    ["apps/api/models/enums.py"],
    ["Enum Mapping", "Standardization"],
    ["Map IB 'PreSubmitted' -> SUBMITTED", "Map Alpaca 'accepted' -> SUBMITTED"],
    "Unhandled states.", "All states covered"
)

add_day(130, "Account Balance Aggregation",
    "View total equity across all connected brokerage accounts.",
    ["touch apps/api/portfolio/aggregator.py"],
    ["apps/api/portfolio/aggregator.py"],
    ["Data Aggregation", "Dashboard"],
    ["Sum cash across brokers", "Sum buying power"],
    "Currency conversion.", "Unified USD view"
)

add_day(131, "Unified Market Data Stream",
    "Merge quote streams from all brokers into single 'Best Bid/Offer'.",
    ["touch apps/data/nbbo.py"],
    ["apps/data/nbbo.py"],
    ["Data Fusion", "Stream Processing"],
    ["Compare prices from Alpaca/IB/Tradier", "Publish internal NBBO"],
    "Latency arbitration.", "Best price always visible"
)

add_day(132, "Broker Health Monitor",
    "Real-time heartbeat checks for all broker connections.",
    ["touch apps/monitoring/broker_health.py"],
    ["apps/monitoring/broker_health.py"],
    ["Health Check", "Watchdog"],
    ["Ping APIs every 10s", "Alert on latency spike or error"],
    "Silent failure.", "Immediate alert"
)

add_day(133, "Emergency Liquidation switch",
    "panic button to close all positions across all brokers.",
    ["touch apps/api/execution/panic.py"],
    ["apps/api/execution/panic.py"],
    ["Risk Management", "Broadcast"],
    ["Async gather cancel_all", "Async gather close_all"],
    "API timeouts.", "Force close retry loop"
)

add_day(134, "Broker Reconciliation Engine",
    "Compare internal trade log with broker EOD reports.",
    ["touch apps/compliance/broker_recon.py"],
    ["apps/compliance/broker_recon.py"],
    ["Reconciliation", "Audit"],
    ["Download trade blotters", "Diff against local DB"],
    "Missing trades.", "Zero discrepancies"
)

# Week 20: Cost-Based Routing (SOR L2)
add_day(135, "Fee Structure Modeling",
    "Model commission and rebate schedules for each venue.",
    ["touch apps/api/execution/fees.py"],
    ["apps/api/execution/fees.py"],
    ["Data Modeling", "Calculation"],
    ["Maker/Taker fees", "Tiered volume discounts"],
    "Inaccurate estimates.", "Fee prediction < 1% error"
)

add_day(136, "Cost-Based Routing Logic",
    "Route orders to venue with lowest total cost (Price + Fee).",
    ["touch apps/api/execution/sor_cost.py"],
    ["apps/api/execution/sor_cost.py"],
    ["Optimization", "Greedy Algorithm"],
    ["Est. slippage + Commission + Exchange Fee", "Select min()"],
    "Ignoring rebates.", "Maximize rebates"
)

add_day(137, "Latency-Based Routing Logic",
    "Route to fastest venue for time-sensitive signals.",
    ["touch apps/api/execution/sor_speed.py"],
    ["apps/api/execution/sor_speed.py"],
    ["Latency Monitoring", "Dynamic Routing"],
    ["Track RTT per broker", "Route to min(RTT)"],
    "Jitter.", "Fastest path selected"
)

add_day(138, "Liquidity-Aware Routing",
    "Route size to venue with deepest book.",
    ["touch apps/api/execution/sor_liquidity.py"],
    ["apps/api/execution/sor_liquidity.py"],
    ["Order Book Analysis", "Smart Routing"],
    ["Check Level 2 depth", "Split order proportional to liquidity"],
    "Information leakage.", "Min market impact"
)

add_day(139, "Dark Pool & hidden Liquidity",
    "Attempt implementation of dark pool routing (if supported).",
    ["touch apps/api/execution/dark.py"],
    ["apps/api/execution/dark.py"],
    ["Venue Analysis", "Conditional Routing"],
    ["Ping dark venues with IOC", "Fallback to lit exchanges"],
    "Opportunity cost.", "Price improvement"
)

add_day(140, "Routing Rule Engine Configuration",
    "JSON/YAML config to control routing logic dynamically.",
    ["touch apps/api/config/routing_rules.yaml"],
    ["apps/api/config/routing_loader.py"],
    ["Configuration Management", "Hot Reload"],
    ["Define Rules: IF symbol=SPY THEN Algo=Dark", "Reload without restart"],
    "Bad config.", "Schema validation"
)

add_day(141, "Meta-Router Implementation",
    "Top-level orchestrator deciding which SOR strategy to use.",
    ["touch apps/api/execution/meta_router.py"],
    ["apps/api/execution/meta_router.py"],
    ["Orchestration", "Decision Tree"],
    ["Classify order intent (Alpha vs Hedge)", "Select Cost vs Speed vs Liquidity"],
    "Wrong strategy.", "Optimal execution"
)

# Week 21: Integration & Testing
add_day(142, "Multi-Broker Integration Test Suite",
    "End-to-end tests validating routing across mocked brokers.",
    ["pytest tests/integration/test_multibroker.py"],
    ["tests/integration/test_multibroker.py"],
    ["Integration Testing", "Mocking"],
    ["Simulate all brokers", "Verify correct routing decisions"],
    "Flaky tests.", "Deterministic pass"
)

add_day(143, "Chaos Monkey for Brokers",
    "Randomly disconnect/fail broker adapters to test resilience.",
    ["pip install chaospy"],
    ["tests/chaos/broker_chaos.py"],
    ["Chaos Engineering", "Resilience Testing"],
    ["Inject high latency", "Inject HTTP 500s"],
    "System crash.", "Graceful degradation"
)

add_day(144, "Paper Trading Championship",
    "Run stratgies across all paper accounts to compare execution.",
    ["python scripts/run_paper_comp.py"],
    ["reports/paper_trading_results.md"],
    ["Benchmarking", "Analysis"],
    ["Compare fill prices", "Compare slippage"],
    "Bias.", "Winner identified"
)

add_day(145, "Latency Optimization Sprint",
    "Profile and optimize the critical routing path.",
    ["python -m cProfile scripts/profile_router.py"],
    ["reports/optimization.prof"],
    ["Profiling", "Optimization"],
    ["Remove unnecessary allocations", "Asyncio loop optimization"],
    "Premature optimization.", "Path latency < 2ms"
)

add_day(146, "Failover Handling",
    "Automatic failover if primary broker is down.",
    ["touch apps/api/execution/failover.py"],
    ["apps/api/execution/failover.py"],
    ["Reliability", "Fallback Strategy"],
    ["If IBKR timeouts > 3", "Switch routing to Alpaca"],
    "Flapping.", "Stable switch"
)

add_day(147, "Manual Override Dashboard",
    "Admin panel to manually force routing destinations.",
    ["touch apps/web/src/pages/RouterControl.tsx"],
    ["apps/api/routes/router_control.py"],
    ["Admin UI", "Control Plane"],
    ["Toggle broker status", "Force specific route"],
    "Ops error.", "Operator confirms action"
)

add_day(148, "Compliance Logging (CAT/OATS)",
    "Log every routing decision for audit trail.",
    ["touch apps/compliance/audit_log.py"],
    ["apps/compliance/audit_log.py"],
    ["Compliance", "Structured Logging"],
    ["Log Inputs, Decision, Output", "Timestamp precision ns"],
    "Disk fill.", "Log rotation"
)

add_day(149, "Deployment to Staging",
    "Deploy multi-broker system to staging environment.",
    ["kubectl apply -f k8s/staging/"],
    ["k8s/staging/deployment.yaml"],
    ["DevOps", "CI/CD"],
    ["Connect to paper APIs", "Verify connectivity"],
    "Config drift.", "Staging matches Prod"
)

add_day(150, "Q2 Month 2 Review",
    "Synthesize learnings from multi-broker implementation.",
    ["touch reports/q2_m2_review.md"],
    ["reports/q2_m2_review.md"],
    ["Review", "Documentation"],
    ["Assess execution quality", "Plan for production"],
    "Missed reqs.", "Ready for Hardening"
)


# Source: q2_days_151_180.py
add_day(151, "Global Circuit Breaker (P&L Based)",
    "Implement system-wide kill switch triggered by excessive drawdown.",
    ["touch apps/risk/circuit_breaker.py"],
    ["apps/risk/circuit_breaker.py"],
    ["State Pattern", "Observer"],
    ["Monitor total P&L stream", "Trigger HALT if DD > 5%"],
    "False trip.", "Auto-halt under crash conditions"
)

add_day(152, "Symbol-Level Circuit Breakers (LULD)",
    "Halt trading on individual symbols if price moves too fast (Limit Up/Limit Down).",
    ["touch apps/risk/luld.py"],
    ["apps/risk/luld.py"],
    ["Stream Processing", "Volatility Monitoring"],
    ["Calc rolling volatility", "Trigger symbol halt if > 2σ move in 5m"],
    "Laggy data.", "Instant protection"
)

add_day(153, "Order Velocity Limiter",
    "Prevent high-frequency runaways (algo gone wild).",
    ["touch apps/risk/velocity.py"],
    ["apps/risk/velocity.py"],
    ["Rate Limiting", "Counting"],
    ["Limit 100 orders/minute per algo", "Hard stop on violation"],
    "Legitimate volume blocked.", "Zero runaway algos"
)

add_day(154, "Max Notional Limits Service",
    "Centralized service to enforce position size limits.",
    ["touch apps/risk/limits_service.py"],
    ["apps/risk/limits_service.py"],
    ["Microservice", "Validation"],
    ["Reject orders > $50k", "Reject total exposure > $500k"],
    "Latency.", "Pre-trade check < 2ms"
)

add_day(155, "Kill Switch UI Button",
    "Physical/Digital 'Big Red Button' to flatten everything immediately.",
    ["npm install @heroicons/react"],
    ["apps/web/src/features/Risk/KillSwitch.tsx"],
    ["Emergency UI", "Websocket Command"],
    ["Send 'FLATTEN_ALL' command", "Require 2-factor confirmation"],
    "Accidental press.", "Immediate risk reduction"
)

add_day(156, "Risk Dashboard & Alerts",
    "Real-time visualization of risk metrics (VaR, Greeks, Exposure).",
    ["touch apps/risk/dashboard_feed.py"],
    ["apps/risk/dashboard_feed.py"],
    ["Aggregator", "Push Notification"],
    ["Stream exposures to frontend", "Alert on limits approaching"],
    "Information overload.", "Clear RYG indicators"
)

add_day(157, "Incident Response Playbook",
    "Documentation and automated scripts for recovery scenarios.",
    ["mkdir docs/playbooks"],
    ["docs/playbooks/incident_response.md", "scripts/emergency/flatten.py"],
    ["Disaster Recovery", "Runbooks"],
    ["Define escalation path", "Automate recovery scripts"],
    "Panic during outage.", "Calm execution"
)

# Week 23: Infrastructure Resilience
add_day(158, "HAProxy Load Balancer",
    "Deploy HAProxy to distribute traffic across API instances.",
    ["sudo apt-get install haproxy"],
    ["docker/haproxy/haproxy.cfg"],
    ["Load Balancing", "High Availability"],
    ["Round-robin strategies", "Health-check endpoints"],
    "Single point of failure.", "Zero downtime upgrades"
)

add_day(159, "PostgreSQL High Availability (Patroni)",
    "Setup PostgreSQL replication with auto-failover using Patroni.",
    ["pip install patroni[etcd]"],
    ["docker/postgres/patroni.yml"],
    ["Database Replication", "Consensus"],
    ["Configure Primary/Replica", "Test failover"],
    "Split brain.", "Automatic leader election"
)

add_day(160, "Redis Sentinel Cluster",
    "Deploy Redis Sentinel for high-availability caching.",
    ["touch docker/redis/sentinel.conf"],
    ["docker-compose.ha.yml"],
    ["Distributed Caching", "Failover"],
    ["Configure Quorum", "Client-side sentinel support"],
    "Cache loss.", "Seamless failover"
)

add_day(161, "Kubernetes Deployment Manifests",
    "Prepare Helm charts for production Kubernetes deployment.",
    ["mkdir k8s/charts"],
    ["k8s/charts/values.yaml"],
    ["Infrastructure as Code", "Orchestration"],
    ["Define Resources (CPU/RAM)", "Configure Probes"],
    "Resource starvation.", "Auto-scaling"
)

add_day(162, "Database Backup & Wal-G",
    "Continuous archiving of WAL logs for Point-in-Time Recovery.",
    ["pip install wal-g"],
    ["scripts/db/backup_wal.sh"],
    ["Data Durability", "Backup"],
    ["Push WAL to S3", "Test restore procedure"],
    "Data corruption.", "Recover to any second"
)

add_day(163, "Secret Rotation Policy",
    "Automate rotation of database passwords and API keys.",
    ["touch scripts/security/rotate_secrets.py"],
    ["scripts/security/rotate_secrets.py"],
    ["Security Operations", "Automation"],
    ["Rotate Vault secrets", "Restart services safely"],
    "Downtime during rotation.", "Zero-downtime rotation"
)

add_day(164, "Chaos Engineering: Network Partition",
    "Simulate network failures between microservices.",
    ["pip install toxiproxy"],
    ["tests/chaos/network_partition.py"],
    ["Resilience Testing", "Fault Injection"],
    ["Cut link between API and DB", "Verify graceful handling"],
    "Cascading failures.", "System survival"
)

# Week 24: Performance Optimization
add_day(165, "Cython Compilation of Hot Paths",
    "Compile critical math loops to C extensions for speed.",
    ["pip install cython"],
    ["libs/math/setup.py"],
    ["Compilation", "Performance"],
    ["Annotate types in inner loops", "Build .so modules"],
    "Build complexity.", "10x speedup"
)

add_day(166, "AsyncIO Event Loop Optimization",
    "Refine asyncio policy (uvloop) for max throughput.",
    ["pip install uvloop"],
    ["apps/api/main.py"],
    ["Concurrency", "Low Latency"],
    ["Replace default loop with uvloop", "Tune thread pool executors"],
    "Blocking calls.", "Throughput check"
)

add_day(167, "Database Query Optimization (EXPLAIN ANALYZE)",
    "Identify and fix slow queries.",
    ["python scripts/db/analyze_queries.py"],
    ["reports/slow_query_log.md"],
    ["Database Tuning", "Indexing"],
    ["Add missing indexes", "Rewrite complex joins"],
    "Table scans.", "Index only scans"
)

add_day(168, "Frontend Bundle Optimization",
    "Reduce JS bundle size for faster load times.",
    ["npm run build -- --report"],
    ["apps/web/vite.config.ts"],
    ["Tree Shaking", "Code Splitting"],
    ["Lazy load heavy charts", "Compress assets (Brotli)"],
    "Megabyte bundles.", "Load < 1s"
)

add_day(169, "Memory Leak Hunt",
    "Profile memory usage to find leaks in long-running services.",
    ["pip install memray"],
    ["scripts/profile_memory.py"],
    ["Profiling", "Resource Management"],
    ["Run under load", "Analyze heap dump"],
    "OOM Kills.", "Stable heap"
)

add_day(170, "Latency Histogram Analysis",
    "Detailed analysis of p99 latency across the stack.",
    ["python scripts/analyze_latency.py"],
    ["reports/latency_p99.png"],
    ["Observability", "Performance Tuning"],
    ["Identify outliers", "Smooth out GC pauses"],
    "Jitter.", "p99 < 50ms"
)

# Week 25: Documentation & Knowledge Transfer
add_day(171, "API Documentation (OpenAPI/Swagger)",
    "Finalize API specs for internal and external consumers.",
    ["pip install fastapi-code-generator"],
    ["docs/api/openapi.json"],
    ["Documentation", "Contract Testing"],
    ["Generate client SDKs", "Validate schema adherence"],
    "Outdated docs.", "Live documentation"
)

add_day(172, "System Architecture Diagram Update",
    "Update C4 context/container diagrams to reflect current state.",
    ["pip install diagrams"],
    ["docs/arch/c4_diagrams.py"],
    ["Visualization", "Architecture"],
    ["Render system components", "Document data flows"],
    "Stale diagrams.", "Accurate map"
)

add_day(173, "Developer Onboarding Guide",
    "Write 'How to Contribute' guide for new team members.",
    ["touch docs/CONTRIBUTING.md"],
    ["docs/CONTRIBUTING.md"],
    ["DevEx", "Documentation"],
    ["Setup instructions", "Coding standards"],
    "Confusing setup.", "Setup in 15 mins"
)

add_day(174, "Operational Runbooks",
    "Standard Operating Procedures for day-to-day ops.",
    ["touch docs/ops/runbooks.md"],
    ["docs/ops/runbooks.md"],
    ["Operations", "Knowledge Base"],
    ["Deployment steps", "Debugging guide"],
    "Tribal knowledge.", "Written procedures"
)

add_day(175, "Post-Mortem Templates",
    "Template for analyzing incidents properly.",
    ["touch docs/ops/post_mortem_template.md"],
    ["docs/ops/post_mortem_template.md"],
    ["Incident Management", "Learning"],
    ["Timeline, Root Cause, Remediation", "5 Whys"],
    "Blame game.", "Systemic improvement"
)

add_day(176, "Code Coverage Report",
    "Ensure test coverage meets 90% standard.",
    ["pytest --cov=apps --cov-report=html"],
    ["htmlcov/index.html"],
    ["Quality Assurance", "Metrics"],
    ["Identify untested paths", "Add tests for edge cases"],
    "False confidence.", ">90% Coverage"
)

add_day(177, "Dependency Audit",
    "Check for security vulnerabilities in dependencies.",
    ["pip install safety bandit"],
    ["scripts/security/audit_deps.sh"],
    ["Security", "Supply Chain"],
    ["Upgrade vulnerable packages", "Pin dependencies"],
    "CVE exposure.", "Zero Critical CVEs"
)

# Week 26: Quarter 2 Retrospective
add_day(178, "Q2 Performance Review",
    "Review trading performance (Sharpe, Drawdown) for the Quarter.",
    ["python scripts/reporting/q2_performance.py"],
    ["reports/q2_performance.md"],
    ["Analytics", "Review"],
    ["Analyze P&L attribution", "Review error logs"],
    "Negative Alpha.", "Positive Expectancy"
)

add_day(179, "Tech Debt Grooming",
    "Identify and prioritize tech debt for Q3.",
    ["touch docs/planning/tech_debt_backlog.md"],
    ["docs/planning/tech_debt_backlog.md"],
    ["Planning", "Maintenance"],
    ["List shortcuts taken", "Estimate repayment effort"],
    "Unmanageable debt.", "Clear plan"
)

add_day(180, "Quarter 3 Planning Session",
    "Detailed roadmap planning for ML and Portfolio Optimization.",
    ["touch docs/planning/q3_roadmap.md"],
    ["docs/planning/q3_roadmap.md"],
    ["Strategy", "Roadmap"],
    ["Define Q3 constraints", "Set milestones"],
    "Aimless dev.", "Aligned objectives"
)

