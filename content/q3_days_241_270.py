
from quarter_03 import add_day

# ─── MONTH 9: PORTFOLIO OPTIMIZATION (DAYS 241-270) ─────────────────────────

# Week 35: Mathematical Foundations (Convex Optimization)
add_day(241, "Portfolio Theory Library (CVXPY)",
    "Implement core Markowitz Mean-Variance Optimization engine.",
    ["pip install cvxpy ecos scs"],
    ["libs/math/mvo.py"],
    ["Convex Optimization", "Quadratic Programming"],
    ["Minimize Variance subject to Return > Target", "Subject to sum(weights) = 1"],
    "Unsolvable matrix.", "Optimal weights"
)

add_day(242, "Covariance Matrix Estimation",
    "Robust estimation of asset covariance (Ledoit-Wolf shrinkage).",
    ["pip install scikit-learn"],
    ["libs/math/covariance.py"],
    ["Statistics", "Risk Modeling"],
    ["Calculate sample covariance", "Apply shrinkage to reduce noise"],
    "Singular matrix.", "Invertible matrix"
)

add_day(243, "Black-Litterman Implementation",
    "Combine market equilibrium with investor views (ML signals).",
    ["touch libs/math/black_litterman.py"],
    ["libs/math/black_litterman.py"],
    ["Bayesian Stats", "Portfolio Construction"],
    ["Prior: Market Cap Weights", "Likelihood: ML Alpha Scores"],
    "Confidence levels.", "Posterior weights"
)

add_day(244, "Hierarchical Risk Parity (HRP)",
    "Machine Learning based allocation using clustering.",
    ["pip install scipy cluster"],
    ["libs/math/hrp.py"],
    ["Clustering", "Risk Parity"],
    ["Tree clustering of correlation matrix", "Recursive bisection allocation"],
    "Correlation instability.", "Robust diversification"
)

add_day(245, "Constraints Engine",
    "Add real-world constraints to optimizer (Turnover, Leverage, Sector).",
    ["touch libs/math/constraints.py"],
    ["libs/math/constraints.py"],
    ["Linear Constraints", "Regulation"],
    ["Max Turnover < 20%", "Max Sector Exposure < 30%", "Long Only (w >= 0)"],
    "Infeasible problem.", "Feasible solution"
)

add_day(246, "Transaction Cost Analysis (TCA) in Optimization",
    "Incorporate trading costs directly into the objective function.",
    ["touch libs/math/tca_model.py"],
    ["libs/math/tca_model.py"],
    ["Cost Modeling", "Slippage"],
    ["Penalty = w_delta * cost_matrix", "Dampens turnover"],
    "Over-trading.", "Efficient frontier"
)

add_day(247, "Performance Attribution (Brinson)",
    "Decompose returns into Allocation vs Selection effects.",
    ["touch reports/attribution.py"],
    ["reports/attribution.md"],
    ["Reporting", "Analytics"],
    ["Sector Allocation Effect", "Stock Selection Effect"],
    "Unexplained alpha.", "Clarity"
)

# Week 36: Strategy Integration
add_day(248, "Alpha Combination Layer",
    "Combine signals from multiple strategies (Trend, MeanDev, ML).",
    ["touch apps/portfolio/alpha_combiner.py"],
    ["apps/portfolio/alpha_combiner.py"],
    ["Signal Processing", "Ensemble"],
    ["Normalize signals to Z-scores", "Weighted Average based on trailing Sharpe"],
    "Signal decay.", "Strong aggregate signal"
)

add_day(249, "Risk Model Integration (Barra-style)",
    "Factor Risk Model to target specific factor exposures.",
    ["touch apps/risk/factor_model.py"],
    ["apps/risk/factor_model.py"],
    ["Risk Management", "Factors"],
    ["Exposure target: Momentum", "Neutralize: Beta, Size"],
    "Factor timing.", "Controlled risk"
)

add_day(250, "Volatility Targeting",
    "Scale portfolio leverage to maintain constant volatility daily.",
    ["touch apps/portfolio/vol_target.py"],
    ["apps/portfolio/vol_target.py"],
    ["Leverage Control", "Risk parity"],
    ["Target Vol = 15%", "Leverage = Target / Realized Vol"],
    "De-leveraging loop.", "Stable risk profile"
)

add_day(251, "Drawdown Control Logic",
    "Reduce exposure as drawdown deepens (CPPI-like logic).",
    ["touch apps/portfolio/drawdown_control.py"],
    ["apps/portfolio/drawdown_control.py"],
    ["Capital Protection", "Dynamic Allocation"],
    ["Floor = 90% of High Water Mark", "Exposure = Multiplier * (Equity - Floor)"],
    "Whipsaw.", "Survival"
)

add_day(252, "Liquidity Constraint Logic",
    "Ensure position sizes do not exceed % of daily volume.",
    ["touch apps/portfolio/liquidity.py"],
    ["apps/portfolio/liquidity.py"],
    ["Market Impact", "Constraints"],
    ["Max Position < 2% ADV", "Penalty in optimizer for illiquid stocks"],
    "Stuck positions.", "Liquid portfolio"
)

add_day(253, "Turnover Constraint Logic",
    "Limit daily trading volume to reduce costs.",
    ["touch apps/portfolio/turnover.py"],
    ["apps/portfolio/turnover.py"],
    ["Cost Efficiency", "rebalancing"],
    ["Soft constraint in optimization", "Hard cap on generated orders"],
    "Stale portfolio.", "Cost-efficient updates"
)

add_day(254, "Rebalance Scheduler",
    "Define when to trigger rebalancing (Time vs Threshold).",
    ["touch apps/portfolio/scheduler.py"],
    ["apps/portfolio/scheduler.py"],
    ["Scheduling", "Event Driven"],
    ["Cron: Daily at 9:15 AM", "Event: Drift > 5%"],
    "Excessive trading.", "Timely updates"
)

# Week 37: Advanced Optimization Research
add_day(255, "Cluster-based Optimization",
    "Use clustering to enforce diversification constraints.",
    ["touch research/notebooks/cluster_opt.ipynb"],
    ["research/notebooks/cluster_opt.ipynb"],
    ["Unsupervised", "Diversification"],
    ["Group correlated assets", "Constraint: max 20% per cluster"],
    "Concentration risk.", "Broad verification"
)

add_day(256, "Nested Clustering Optimization (NCO)",
    "Advanced de-noising technique for covariance matrices.",
    ["touch research/notebooks/nco_research.ipynb"],
    ["research/notebooks/nco_research.ipynb"],
    ["Matrix Theory", "Stability"],
    ["Cluster-level weights * Asset-level weights", "Compare vs Standard MVO"],
    "Complexity.", "Higher Sharpe"
)

add_day(257, "Genetic Algorithms for Portfolio",
    "Evolve portfolio weights using evolutionary strategies.",
    ["pip install deap"],
    ["libs/math/genetic_opt.py"],
    ["Evolutionary Computation", "Non-convex"],
    ["Optimize non-convex objectives (e.g. Sortino)", "Population evolution"],
    "Slow convergence.", "Global optimum"
)

add_day(258, "Kelly Criterion Optimization",
    "Maximize log-growth utility (aggressive).",
    ["touch libs/math/kelly.py"],
    ["libs/math/kelly.py"],
    ["Bet Sizing", "Log Utility"],
    ["Full Kelly (too risky)", "Fractional Kelly (Half-Kelly)"],
    "Ruin.", "Growth maximization"
)

add_day(259, "Universal Portfolio (Cover's Algo)",
    "Online portfolio selection algorithm benchmarking.",
    ["touch research/notebooks/universal_portfolio.ipynb"],
    ["research/notebooks/universal_portfolio.ipynb"],
    ["Information Theory", "Online Learning"],
    ["Constant Rebalanced Portfolios", "Asymptotic optimality"],
    "Transaction costs.", "Theoretical benchmark"
)

add_day(260, "Reinforcement Learning Portfolio Agent",
    "Train RL agent to allocate weights dynamically.",
    ["touch research/rl/portfolio_agent.py"],
    ["research/rl/portfolio_agent.py"],
    ["Deep RL", "PPO"],
    ["State: Market Regime", "Action: Sector Weights"],
    "Sample inefficiency.", "Adaptive allocation"
)

add_day(261, "Tail Risk Hedging Strategy",
    "Dedicate small % of capital to OTM puts (VIX calls).",
    ["touch apps/strategies/hedging.py"],
    ["apps/strategies/hedging.py"],
    ["Insurance", "Options"],
    ["Buy 10% OTM Puts monthy", "Roll strategy"],
    "Drag on returns.", "Crash protection"
)

# Week 38: Quarter 3 Retrospective & Final Integration
add_day(262, "Full System Integration Test",
    "End-to-End test of Data -> ML -> Optimizer -> Execution.",
    ["pytest tests/e2e/full_loop.py"],
    ["tests/e2e/full_loop.py"],
    ["Integration", "Verification"],
    ["Mock market data feed", "Verify orders match target portfolio"],
    "Drift.", "Perfect replication"
)

add_day(263, "Latency Profiling (End-to-End)",
    "Measure time from 'Tick' to 'Order Submitted'.",
    ["python scripts/profile_full_loop.py"],
    ["reports/e2e_latency.png"],
    ["Performance", "Optimization"],
    ["Identify bottlenecks (Model inference? Convex Solver?)", "Optimize critical path"],
    "Slow loop.", "<100ms total tick-to-trade"
)

add_day(264, "Backtest: ML + Optimization Strategy",
    "Run 5-year backtest of the complete integrated system.",
    ["python apps/backtest/run_super_strat.py"],
    ["reports/super_strat_results.pdf"],
    ["Backtesting", "Validation"],
    ["Compare vs SPY Buy-Hold", "Check annual turnover"],
    "Overfitting.", "Realistic Alpha"
)

add_day(265, "Paper Trading Launch (Alpha)",
    "Deploy full system to paper trading environment.",
    ["kubectl apply -f k8s/paper-trading/"],
    ["k8s/paper-trading/deployment.yaml"],
    ["Deployment", "UAT"],
    ["Monitor live dashboard", "Wait for trades"],
    "Config errors.", "Live execution"
)

add_day(266, "Documentation Update: ML & Portfolio",
    "Document the mathematical models and signals used.",
    ["touch docs/models/math_spec.md"],
    ["docs/models/math_spec.md"],
    ["Documentation", "Knowledge Base"],
    ["Formula for HRP", "Formula for Black-Litterman"],
    "Obscure code.", "Clear math specs"
)

add_day(267, "Disaster Recovery Testing (Portfolio)",
    "Simulate data corruption and portfolio state recovery.",
    ["python scripts/dr/corrupt_positions.py"],
    ["scripts/dr/restore_positions.py"],
    ["Resilience", "Recovery"],
    ["Rebuild state from broker API", "Re-run optimizer"],
    "Lost state.", "Fast recovery"
)

add_day(268, "Q3 Performance Review",
    "Review paper trading results and backtest metrics.",
    ["python scripts/reporting/q3_review.py"],
    ["reports/q3_review.md"],
    ["Analytics", "Milestone"],
    ["Sharpe Ratio vs Target", "Max Drawdown vs Limit"],
    "Missed targets.", "Plan adjustment"
)

add_day(269, "Tech Debt Clean Up Sprint",
    "Freeze new features, clean up code and tests.",
    ["flake8 apps/ libs/", "mypy apps/ libs/"],
    ["refactor_q3.md"],
    ["Maintenance", "Quality"],
    ["Fix Type hints", "Refactor monster functions"],
    "Spaghetti.", "Clean architecture"
)

add_day(270, "Quarter 4 Planning Session",
    "Plan for White Labeling, Fund Admin, and IPO.",
    ["touch docs/planning/q4_roadmap.md"],
    ["docs/planning/q4_roadmap.md"],
    ["Strategy", "Roadmap"],
    ["Define Multi-tenancy regs", "Plan Scale-out"],
    "Scope creep.", "Final push"
)
