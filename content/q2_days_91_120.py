
from quarter_02 import add_day

# ─── MONTH 4: EXECUTION ALGORITHMS (DAYS 91-120) ────────────────────────────

# Week 14: Execution Engine Foundations (OMS/EMS Separation)
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
