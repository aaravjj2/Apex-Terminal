
from quarter_02 import add_day

# ─── MONTH 5: MULTI-BROKER ROUTING (DAYS 121-150) ───────────────────────────

# Week 18: Broker Adapters Implementation
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
