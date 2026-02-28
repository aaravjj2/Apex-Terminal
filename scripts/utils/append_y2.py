#!/usr/bin/env python3
"""
append_y2.py — Appends Year 2 weeks (53-104) and build_pdf() to gen_expanded_plan.py
Run once: python3 append_y2.py
"""

import sys

Y2_APPENDIX = r'''

# ══ Year 2 Weeks 53-104 ══
# ── Y2 Q1: AI Agent Evolution & Advanced Intelligence ──

WEEKS[53] = dict(
    title="Autonomous AI Agent Architecture (LangChain)",
    subtitle="Refactor autopilot into a true LangChain agent with tool-use, memory, and dynamic planning.",
    kpis=[("Framework","LangChain"),("Tools","12"),("Memory","Window Buffer"),("Fallback","Deterministic")],
    goals=["Replace hardcoded pipeline with LangChain AgentExecutor and 12 callable tools",
           "Agent memory: ConversationBufferWindowMemory (20-message window)",
           "Dynamic planning: agent decides tool call order based on market context",
           "Log every tool call with agent's rationale in run_artifact.agent_trace",
           "Fallback: if agent hangs >120s, revert to deterministic pipeline",
           "Agent dry-run mode: complete full cycle without order execution"],
    tasks=["pip install langchain langchain-groq langchain-google-genai",
           "services/autopilot/agent.py: ApexAgent class with 12 tool wrappers",
           "Tool descriptions explicitly require: validate before execute",
           "AgentExecutor with verbose=True; max_iterations=25",
           "Store agent_trace JSON field in RunArtifact",
           "Fallback handler: asyncio timeout 120s → deterministic pipeline"],
    deliverables=["LangChain agent completes full dry_run cycle","Agent uses >8 tools per cycle",
                  "Fallback activates on timeout","Agent trace shows reasoning per tool"],
    autopilot=["Agent IS the autopilot — it decides its own workflow now",
               "Dynamic strategy: high-VIX day → agent may check risk first before scanning",
               "Agent memory: remembers morning briefing when making afternoon decisions"],
    risk=["Risk: Agent loops → strict max_iterations=25; hard timeout 120s",
          "Risk: Agent execute without validate → tool descriptions require validate first"],
    code=["tools = [Tool('scan_universe', scan_universe, 'Scan for candidates. Input: date.'),",
          "         Tool('validate_trade', validate_trade, 'Validate against risk gates. Must call before execute.'),",
          "         Tool('execute_order', execute_order, 'Execute validated trade only.')]",
          "agent = create_react_agent(llm=groq, tools=tools, prompt=AGENT_PROMPT)",
          "executor = AgentExecutor(agent=agent, max_iterations=25)"],
    days=["Mon: LangChain setup; 12 tool wrappers","Tue: AgentExecutor + verbose trace",
          "Wed: Memory integration","Thu: Agent trace in RunArtifact","Fri: Fallback handler; E2E dry-run"],
)

WEEKS[54] = dict(
    title="Multi-Agent System: Researcher + Validator + Executor",
    subtitle="Split single agent into specialized sub-agents that debate every trade before execution.",
    kpis=[("Sub-agents","3"),("Protocol","Debate"),("Supervisor","LangGraph"),("Transcript","Saved")],
    goals=["ResearcherAgent: scans universe, builds candidate list with context",
           "ValidatorAgent: adversarial — challenges each trade; seeks to reject",
           "ExecutorAgent: final decision after hearing both sides",
           "SupervisorAgent: routes messages via LangGraph StateGraph",
           "Full debate transcript saved in run_artifact.debate_transcript",
           "Debate completes in <60s total"],
    tasks=["agent_researcher.py, agent_validator.py, agent_executor.py — separate system prompts + tools",
           "StateGraph: researcher→validator→executor routing",
           "Validator prompt: 'Find every reason NOT to take this trade'",
           "Executor reads debate transcript + weighs both perspectives",
           "debate_transcript stored as JSON in RunArtifact"],
    deliverables=["3-agent pipeline completes full dry-run","Validator argues against ≥1 candidate",
                  "Executor sometimes overrules with reasoning","Debate transcript saved"],
    autopilot=["Multi-agent = adversarial self-review = fewer bad trades",
               "Validator effectively acts as the system's risk manager"],
    risk=["Risk: Slower than single agent → parallelize Researcher + Validator",
          "Risk: Agents disagree on everything → tune Validator to focus on material risks only"],
    code=["graph = StateGraph(AgentState)",
          "graph.add_edge('researcher', 'validator')",
          "graph.add_conditional_edges('validator', route_to_executor)"],
    days=["Mon: ResearcherAgent","Tue: ValidatorAgent adversarial prompt","Wed: ExecutorAgent",
          "Thu: LangGraph supervisor routing","Fri: Debate transcript in RunArtifact; E2E"],
)

WEEKS[55] = dict(
    title="RAG-Powered Market Knowledge Base (ChromaDB)",
    subtitle="Build a vector knowledge base from 500+ financial documents for LLM context retrieval.",
    kpis=[("Documents","500+"),("Vector DB","ChromaDB"),("Retrieval","Top-5 chunks"),("Latency","<500ms")],
    goals=["Ingest 500+ docs: 10-K/10-Q, earnings transcripts, Fed minutes, research reports",
           "Chunk and embed via sentence-transformers → store in ChromaDB",
           "RAG query: ResearcherAgent queries KB before scoring each symbol",
           "Hybrid retrieval: semantic similarity + keyword match",
           "Weekly KB refresh: new filings + transcripts added automatically",
           "RAG context visible in agent reasoning trace"],
    tasks=["pip install chromadb langchain-community sentence-transformers",
           "doc_ingestion.py: fetch → chunk (512 tokens, 50 overlap) → embed → store",
           "KnowledgeBase.query(question, top_k=5) returns relevant chunks",
           "Wire into ResearcherAgent: query KB per symbol before scoring",
           "Weekly cron: re-index new 10-Q filings every Sunday"],
    deliverables=["500+ docs indexed","KB query returns correct chunks for AAPL",
                  "RAG context in agent trace","Weekly refresh running"],
    autopilot=["RAG gives agent memory of company history across all quarters",
               "Agent can ask: 'What did AAPL say about margins last earnings?'"],
    risk=["Risk: ChromaDB persistence → use PersistentClient with Docker volume",
          "Risk: Embedding cost → use sentence-transformers (local, free)"],
    code=["chroma = PersistentClient(path='./chroma_db')",
          "def ingest(doc_id, text, meta):",
          "    chunks = chunk(text, 512, 50)",
          "    collection.add(ids=[f'{doc_id}_{i}' for i in range(len(chunks))],",
          "                   documents=chunks, metadatas=[meta]*len(chunks))"],
    days=["Mon: ChromaDB + ingestion pipeline","Tue: Embed 500 docs","Wed: Hybrid retrieval",
          "Thu: Wire into ResearcherAgent","Fri: Weekly refresh scheduler"],
)

WEEKS[56] = dict(
    title="Real-Time News Arbitrage & Event-Driven Alpha",
    subtitle="Sub-second news processing to detect market-moving events and trigger reactive scans.",
    kpis=[("Feeds","6"),("Latency","<2s detection"),("Classification","ML"),("Actions","Reactive scan+emergency exit")],
    goals=["6 real-time feeds: Bloomberg RSS, Reuters, SEC EDGAR, Twitter, Reddit, Benzinga",
           "ML event classifier (FinBERT): categorize as Earnings Beat/Miss, M&A, FDA, Legal, Macro",
           "Estimate price impact for each event type based on historical reactions",
           "Reactive scan: positive large event → immediate candidate scan on that symbol",
           "Emergency exit evaluation: negative event for held position → close immediately?",
           "Latency tracking: measure detection time vs first price tick after event"],
    tasks=["newsfeeds.py: async readers for 6 sources; dedup by URL hash + 5-min freshness filter",
           "event_classifier.py: FinBERT fine-tuned for 8 event categories",
           "price_impact_estimator.py: regression from historical event→price impact pairs",
           "Reactive scan trigger: POST /api/v1/autopilot/scan?trigger=news&symbol=X",
           "Emergency exit: if negative_impact > 0.15 for held position → evaluate close"],
    deliverables=["6 feeds ingesting real-time","Event correctly classified (tested)",
                  "Emergency exit triggers on negative event test case","Latency < 2s measured"],
    autopilot=["News arbitrage is the alpha layer — acts in seconds vs human minutes",
               "Emergency exit is safety-first: protect capital before chasing alpha"],
    risk=["Risk: False positives → require 2+ source confirmation for large trades",
          "Risk: Stale reposted news → 5-minute freshness filter enforced"],
    code=["async def process_article(article):",
          "    ev = classifier.predict(article.text)",
          "    impact = estimator.predict(ev, article.symbol)",
          "    if abs(impact) > 0.05:",
          "        await alert_engine.fire('NEWS_EVENT', {'symbol':article.symbol,'impact':impact})"],
    days=["Mon: 6 feed readers","Tue: FinBERT classifier","Wed: Impact estimator",
          "Thu: Reactive scan trigger","Fri: Emergency exit; latency tracking"],
)

WEEKS[57] = dict(
    title="Options Flow Intelligence & Dark Pool Analytics",
    subtitle="Detect institutional money movement via unusual options flow and dark pool prints.",
    kpis=[("Flow Sources","3"),("Unusual","5× avg OI"),("Dark Pool","Block prints"),("Score","0-100")],
    goals=["Unusual options activity: flag volume > 5× average open interest per strike",
           "Sweep detector: aggressive multi-strike buying at ask → strong directional bet",
           "Dark pool prints: large block trades >10,000 shares before regular hours",
           "FlowScore 0-100: conviction based on size, direction, proximity to expiry, sweep flag",
           "Flow alignment: if flow matches proposed trade → +10 bonus to entry score",
           "Flow contradiction: if strong opposite flow → skip trade regardless"],
    tasks=["options_flow.py: Unusual Whales API or Tradier screener",
           "unusual_activity_detector(): volume vs 30-day avg OI per strike",
           "sweep_detector(): multi-strike aggressive buying pattern",
           "darkpool.py: large block prints from tick data inference",
           "FlowScore weighted composite","GET /api/v1/flow/{symbol}"],
    deliverables=["Unusual activity detected for test case (>5× OI)","Sweep correctly identified",
                  "Flow score computed for 20 symbols","FlowView renders events"],
    autopilot=["Flow alignment: institutional agreement = higher confidence entry",
               "Flow contradiction = hard skip regardless of other signals"],
    risk=["Risk: Unusual Whales expensive → use Tradier flow as free fallback",
          "Risk: Flow data lagged 15 min → context only, not sole signal"],
    code=["def is_unusual(symbol, strike, vol, oi_avg):",
          "    ratio = vol / max(oi_avg, 1)",
          "    return ratio > 5.0, ratio"],
    days=["Mon: Flow API integration","Tue: Unusual activity detector","Wed: Sweep detector",
          "Thu: Dark pool prints","Fri: FlowView + score integration"],
)

WEEKS[58] = dict(
    title="Fine-Tuning LLM on Own Trade History (LoRA PEFT)",
    subtitle="Fine-tune Llama3-8B on 500+ paper trades to create a personalized trading judgment model.",
    kpis=[("Dataset","500+ trades"),("Base Model","Llama3-8B"),("Method","LoRA PEFT"),("Eval","Win rate lift")],
    goals=["Build instruction-tuning dataset: trade features + outcome + LLM decision rationale",
           "Format as {instruction, input, output} pairs for supervised fine-tuning",
           "Fine-tune Llama3-8B with LoRA adapters (r=16) on Hugging Face PEFT",
           "Evaluate fine-tuned vs base Groq on held-out 20% test trades",
           "Deploy as 3rd LLM layer: Groq + Gemini + Fine-tuned = 3-judge consensus",
           "Monthly retraining as more live data accumulates"],
    tasks=["pip install transformers peft datasets accelerate",
           "dataset_builder.py: generate instruction pairs from DB trade history",
           "finetune.py: LoRA config + Trainer; evaluate on test set",
           "Export adapter → load at inference alongside base model",
           "fine_tuned_ranker.py: integration as 3rd judgment layer"],
    deliverables=["500-trade dataset built","LoRA trains without OOM","Fine-tuned beats base on test set",
                  "3rd LLM layer integrated in pipeline"],
    autopilot=["Fine-tuned model learns YOUR specific trading style",
               "3 judges: Groq + Gemini + Fine-tuned = higher confidence consensus"],
    risk=["Risk: 500 trades too small → data augmentation + synthetic examples",
          "Risk: Overfitting → evaluate on 20% held-out minimum"],
    code=["lora_config = LoraConfig(r=16, lora_alpha=32, target_modules=['q_proj','v_proj'])",
          "model = get_peft_model(base_model, lora_config)",
          "trainer = Trainer(model=model, args=training_args, train_dataset=train_data)",
          "trainer.train()"],
    days=["Mon: Dataset builder","Tue: Instruction pair formatting","Wed: LoRA fine-tuning",
          "Thu: Evaluation vs base","Fri: Deploy as 3rd LLM layer"],
)

WEEKS[59] = dict(
    title="Regime-Adaptive RL Allocation Agent (PPO)",
    subtitle="Train a PPO RL agent to dynamically adjust strategy allocation weights based on market regime.",
    kpis=[("Algorithm","PPO"),("State","15 features"),("Action","6 weights"),("Reward","Sharpe delta")],
    goals=["RL env (gymnasium): state=15 market features, action=6 strategy allocation weights",
           "Reward: Sharpe ratio improvement over prior period",
           "Train PPO (Stable Baselines 3) on 5-year historical data, 1M steps",
           "RL agent replaces static regime→allocation mapping from Week 19",
           "OOS evaluation: RL vs static allocation on held-out 2-year period",
           "Daily weight updates from RL policy; changes logged for transparency"],
    tasks=["pip install stable-baselines3 gymnasium",
           "TradingEnv(gymnasium.Env): state, action, reward, step() implementation",
           "Historical simulation env over 5 years of daily regime data",
           "PPO training: 1M steps with eval every 50k steps",
           "Export trained policy → rl_allocation_policy.pkl",
           "RLAllocator replaces AllocationManager; daily weight update job"],
    deliverables=["RL env runs 5-year episode without error","PPO trains to positive reward",
                  "RL outperforms static allocation on OOS test","Daily weight updates logged"],
    autopilot=["RL self-optimizes allocation without human tuning",
               "Weight changes logged: 'RL reduced Iron Condor from 20% to 8% today'"],
    risk=["Risk: Pathological allocations → enforce min/max weight bounds per strategy",
          "Risk: RL overfits → 3-year train / 2-year OOS split minimum"],
    code=["class TradingEnv(gym.Env):",
          "    def step(self, action):",
          "        weights = softmax(action)",
          "        pnl = simulate_day(weights, self.state)",
          "        reward = sharpe_increment(pnl)",
          "        return next_state(), reward, done, {}"],
    days=["Mon: TradingEnv implementation","Tue: PPO training","Wed: OOS evaluation",
          "Thu: Policy deployment","Fri: Daily weight update + logging"],
)

WEEKS[60] = dict(
    title="Go-Live: First Real Money Trades",
    subtitle="Clear 10-step go-live checklist and execute first real-money trades at minimal 1-contract size.",
    kpis=[("Mode","Live"),("Size","1 contract"),("Budget","$1,000"),("Monitor","Manual daily")],
    goals=["Complete 10-item go-live checklist — every item green before flipping switch",
           "Execute first real-money trade: 1 contract, max $500 total risk",
           "Monitor every cycle manually for first 2 weeks of live trading",
           "Paper vs live P&L daily comparison to measure execution slippage",
           "Week 1 debrief document: surprises vs paper, lessons learned",
           "Scale plan: 1 → 2 → 5 contracts over 8 weeks pending clean results"],
    tasks=["Complete + document all 10 go-live checklist items",
           "Switch BROKER_MODE='live'; MAX_POSITION_CONTRACTS=1; MAX_DAILY_LOSS=200",
           "First trade: put credit spread on liquid ETF (SPY, QQQ, IWM)",
           "Daily live vs paper comparison report",
           "Week 1 debrief document"],
    deliverables=["Checklist 100% green","First live trade executed + confirmed filled",
                  "Daily comparison report","Week 1 debrief written"],
    autopilot=["Live trading is the 60-week culmination — the autopilot proven at real stakes",
               "1 contract = minimal risk; learning about live execution quality is the goal"],
    risk=["Risk: Bad fill on first trade → review order type (limit at mid price only)",
          "Risk: Panic on first loss → commit to full 10-trade minimum before any config change"],
    code=["BROKER_MODE = 'live'",
          "MAX_POSITION_CONTRACTS = 1",
          "MAX_DAILY_LOSS_USD = 200",
          "# kill switch active at ALL times during live trading"],
    days=["Mon: Go-live checklist completion; switch to live","Tue: First live trade; monitor fill",
          "Wed-Thu: 2nd and 3rd trades; slippage capture","Fri: Week 1 debrief document"],
)

# ── Y2 Q2: Scaling & Robustness ──
WEEKS[61] = dict(
    title="Scale-Up to 5 Contracts & Kelly Recalibration",
    subtitle="Increase live position size to 5 contracts using live-calibrated Kelly after 2 clean weeks.",
    kpis=[("Max","5 contracts"),("Kelly","Live-data"),("Daily Loss","$500"),("Slippage","Tracked")],
    goals=["Scale to 5 contracts after 2 clean weeks of live trading",
           "Recalibrate Kelly parameters using live trade win rate and P&L data",
           "Update daily loss limit: $200 → $500 proportionally",
           "Track slippage: live fill vs theoretical mid price per trade",
           "Volume impact: verify 5-contract orders don't worsen fill quality significantly"],
    tasks=["Update config: MAX_POSITION_CONTRACTS=5, MAX_DAILY_LOSS=500",
           "Kelly recalibration: live_trades = db.get_live_trades(last_n=50)",
           "slippage_tracker.py: record expected_mid vs actual_fill per trade",
           "Volume analysis: compare fill quality as contract count increases",
           "Updated monitoring thresholds for 5-contract risk"],
    deliverables=["5-contract live trades executing cleanly","Kelly recalibrated on live data",
                  "Slippage per trade computed"],
    autopilot=["Scale-up gated on clean execution — no incidents in first 2 weeks",
               "Live Kelly recalibration makes sizing data-driven from actual fills"],
    risk=["Risk: Worse fills with 5 contracts → test 2, then 3, then 5 progressively",
          "Risk: Overconfidence → keep daily loss limit strict; honor the kill switch"],
    code=["live_trades = db.get_live_trades(last_n=50)",
          "win_rate = mean([1 if t.pnl>0 else 0 for t in live_trades])",
          "kelly = fractional_kelly(win_rate, avg_win(live_trades), avg_loss(live_trades))"],
    days=["Mon: Config update; first 5-contract trade","Tue: Kelly recalibration",
          "Wed: Slippage tracking","Thu: Volume + fill quality analysis","Fri: Updated monitoring"],
)

WEEKS[62] = dict(
    title="Multi-Broker Integration & Automatic Failover",
    subtitle="Add TD Ameritrade/Schwab as second broker for redundancy and best-execution routing.",
    kpis=[("Brokers","2"),("Failover","Automatic"),("Compare","Commission + fill quality"),("SLA","Zero outage")],
    goals=["Integrate Schwab/TD Ameritrade API via schwab-py library",
           "BrokerRouter: selects broker based on health + estimated fill quality",
           "Automatic failover: if primary broker fails → auto-route to secondary in <5s",
           "Commission tracker: per-trade commission by broker for cost comparison",
           "Dual health check pre-market: both brokers must respond before cycle starts"],
    tasks=["pip install schwab-py","schwab_broker.py implementing BrokerInterface",
           "BrokerRouter.execute(): primary healthy → primary; else secondary",
           "commission_tracker.py: log commission per trade per broker",
           "Failover test: simulate primary outage → confirm secondary activates"],
    deliverables=["Schwab connected + placing paper orders","Failover test passes in <5s",
                  "Commission comparison report generated"],
    autopilot=["Dual broker = zero single-point-of-failure in execution",
               "Best-execution routing shifts to lower-cost broker over time"],
    risk=["Risk: Schwab API changes → use well-maintained schwab-py; monitor for deprecations"],
    code=["class BrokerRouter:",
          "    def execute(self, order):",
          "        if self.primary.is_healthy(): return self.primary.execute(order)",
          "        return self.secondary.execute(order)  # automatic failover"],
    days=["Mon: Schwab API auth","Tue: schwab_broker.py","Wed: BrokerRouter failover",
          "Thu: Commission tracker","Fri: Failover E2E test"],
)

WEEKS[63] = dict(
    title="Futures & Index Hedging Integration",
    subtitle="Add E-mini S&P 500 futures and VIX derivatives for portfolio delta-neutral hedging.",
    kpis=[("Instruments","ES, NQ, VIX"),("Hedge","Delta-neutral"),("Auto","Every 30 min"),("Cost","Tracked separately")],
    goals=["E-mini ES futures via Interactive Brokers ib_insync for portfolio delta hedging",
           "Hedge trigger: if portfolio delta drifts beyond ±0.25, neutralize with ES",
           "VIX call hedge: buy cheap OTM VIX calls (insurance) when VIX < 18",
           "Hedge sizing: exact contract count from portfolio delta / ES delta per contract",
           "Auto-hedge job: check delta balance every 30 minutes intraday",
           "Hedge P&L tracked separately from options P&L"],
    tasks=["pip install ib_insync","ib_broker.py: ES mini execution on IB paper",
           "delta_hedger.py: portfolio_delta → ES contracts needed",
           "vix_hedge.py: buy OTM VIX calls when VIX < 18",
           "Auto-hedge 30-min job; HedgeView.tsx"],
    deliverables=["ES mini orders on IB paper account","Delta hedge math verified (tested)",
                  "Auto-hedge fires every 30 minutes","HedgeView shows hedge positions + P&L"],
    autopilot=["Delta-neutral hedge removes market direction risk from portfolio",
               "VIX insurance: affordable in calm markets, pays off in crashes"],
    risk=["Risk: Margin requirements → verify account margin before each hedge",
          "Risk: Over-hedging (negative delta) → strict target ±0.10 delta range"],
    code=["def compute_hedge_qty(portfolio_delta, es_delta_per_contract=50):",
          "    return -round(portfolio_delta / es_delta_per_contract)"],
    days=["Mon: IB API + ES paper trading","Tue: Delta hedger","Wed: VIX hedge logic",
          "Thu: 30-min auto-hedge job","Fri: HedgeView + P&L tracking"],
)

WEEKS[64] = dict(
    title="Portfolio Rebalancing Engine & Capital Efficiency",
    subtitle="Automate weekly rebalancing to maintain target allocation and maximize capital deployment.",
    kpis=[("Rebalance","Weekly"),("Idle Capital","<10%"),("Margin","50-70%"),("Turnover","Minimize")],
    goals=["Weekly rebalance: assess allocation drift; generate rebalance orders if drift >5%",
           "Capital efficiency: no more than 10% idle — deploy or sweep to T-bills",
           "Margin utilization: 50-70% target — not too conservative, not too leveraged",
           "Minimize turnover: prefer rolling over close-and-reopen",
           "RebalanceView: current vs target allocation with action plan"],
    tasks=["rebalancer.py: drift computation; rebalance order generation",
           "capital_efficiency(): deployed% + idle recommendation",
           "margin_monitor(): alert at 70% margin utilization",
           "cash_sweep_manager(): broker cash management API",
           "RebalanceView.tsx: side-by-side current vs target"],
    deliverables=["Rebalancer produces correct action for test drift","Capital efficiency metric computed",
                  "Margin alert at 70%","RebalanceView shows weekly plan"],
    autopilot=["Rebalancing maintains intended risk profile over time",
               "Idle capital detection removes drag from uninvested cash"],
    risk=["Risk: Rebalance too frequent → only execute if drift >5%",
          "Risk: Cash sweep may not be available → integrate and verify with broker"],
    code=["def rebalance_plan(current, target, tol=0.05):",
          "    return {s: target[s]-current.get(s,0) for s in target",
          "           if abs(target[s]-current.get(s,0)) > tol}"],
    days=["Mon: Rebalancer core","Tue: Capital efficiency + margin monitor","Wed: Cash sweep",
          "Thu: RebalanceView.tsx","Fri: Weekly scheduler + E2E"],
)

# Weeks 65-78: institutional + advanced features (briefer format)
_BRIEF_WEEKS = {
65: ("Institutional Reporting & FINRA Compliance",
     "Build 13F-style reports, daily reconciliation, FINRA-ready audit trail, 7-year retention.",
     "13F position report, daily reconciliation, trade confirms, 7-year tamper-proof archive."),
66: ("Tax Lot Accounting & Wash Sale Compliance",
     "Track cost basis, holding periods, and wash sale rules automatically for tax reporting.",
     "FIFO/LIFO lot tracking, wash sale flag, annual tax report PDF, tax optimization hints."),
67: ("Crypto Correlation Signal Integration",
     "Monitor BTC/ETH as risk-off signals affecting equity options strategy allocation.",
     "BTC correlation to SPY, crypto fear/greed index, regime modifier when crypto diverges."),
68: ("Macro Economic Indicator Dashboard",
     "Build macro dashboard: CPI, NFP, PMI, Fed signals integrated into regime detection.",
     "Economic calendar pull (FRED API), 12 macro indicators, regime overlay adjustments."),
69: ("IV Skew Trading Strategies",
     "Build dedicated IV skew arbitrage: buy cheap wing, sell expensive ATM or vice versa.",
     "Skew index per symbol, skew trade builder, backtest on 2 years of vol surface data."),
70: ("Live Earnings Play Strategies",
     "Trade IV crush around earnings: structured calendar positions 5 days before, close day-of.",
     "Earnings play scanner, pre-earnings entry, IV crush capture, post-earnings analysis."),
71: ("Portfolio Insurance & Tail Risk Hedging",
     "Systematic tail hedging: OTM puts, VIX calls, correlation trades for crash protection.",
     "Tail hedge budget 1% of NAV/month, auto-buy SPY puts in calm markets, track hedge drag."),
72: ("AI Agent Self-Evaluation & Improvement Loop",
     "Agent evaluates its own weekly performance and proposes parameter improvements.",
     "Weekly self-eval prompt, agent proposes changes, human approval gate, auto A/B test."),
73: ("Multi-Timeframe Regime Analysis",
     "Align short/medium/long-term regime signals for higher-conviction entries only.",
     "3-timeframe regime (daily, weekly, monthly), alignment score, skip on regime conflict."),
74: ("Client Reporting API & Partner Integration",
     "RESTful API for third-party portfolio managers to access Apex Terminal performance data.",
     "OAuth2 API keys, GET /partner/performance, rate-limited, white-label report endpoint."),
75: ("Advanced Backtesting: Stress Period Deep-Dives",
     "Deep-dive backtest in 5 stress periods (2008, 2011, 2018, 2020, 2022) with tick data.",
     "Tick-level backtest engine, 5 stress periods, regime-stratified Sharpe, tail loss audit."),
76: ("Volatility Forecasting with GARCH Models",
     "Train GARCH(1,1) to forecast next-day IV; use forecast in entry scoring and position sizing.",
     "arch library GARCH(1,1), forecast vs realized calibration, IV forecast in entry scorer."),
77: ("Options Market Making Simulation",
     "Simulate basic market making: quote bid and ask; earn spread as alternative revenue stream.",
     "MM simulation engine, BBO-aware quoting, inventory hedging, simulated P&L from spread capture."),
78: ("Q3 Performance Review & Y2H2 Planning",
     "Mid-year live trading review and planning for the final 26 weeks of Year 2.",
     "Q3 attribution, live vs paper comparison, top-3 strategy winners, Y2H2 roadmap approved."),
}

for wk, (title, subtitle, summary) in _BRIEF_WEEKS.items():
    WEEKS[wk] = dict(
        title=title, subtitle=subtitle,
        kpis=[("Status","Y2 Mid-Phase"),("Priority","High"),("Type","Production"),("Detail",summary[:30])],
        goals=[summary, "Integrate with existing autopilot pipeline",
               "Add comprehensive tests", "Document in user guide"],
        tasks=[f"Design {title} architecture", f"Implement core {title} service",
               f"Build API and frontend component", "Write tests + CI integration",
               "Document in user guide and runbook"],
        deliverables=[f"{title} working end-to-end", "Tests passing in CI",
                      "Feature documented in user guide"],
        autopilot=[f"{title} enhances autopilot decision quality and operational robustness",
                   "Results logged in RunArtifact and weekly performance reports"],
        risk=["Risk: Integration complexity → standalone service first, integrate after unit tests pass"],
        code=[f"# {title}", f"# {summary}", "# See service module for full implementation"],
        days=["Mon: Design + architecture","Tue: Core implementation","Wed: API endpoints",
              "Thu: Frontend component","Fri: Tests + documentation"],
    )

# ── Y2 Q4: Completion & Ecosystem ──
WEEKS[79] = dict(
    title="Mobile App: React Native Dashboard",
    subtitle="iOS and Android app with real-time P&L, push notifications, and biometric kill switch.",
    kpis=[("Platform","iOS+Android"),("Push","FCM+APNs"),("Auth","Biometric"),("Size","<30MB")],
    goals=["React Native app: real-time P&L, positions, alerts feed, kill switch",
           "Push every trade execution, alert trigger, daily briefing",
           "Biometric auth (FaceID/TouchID) for kill switch activation",
           "Offline mode: cached last-known positions when no connection",
           "Dark terminal theme matching desktop"],
    tasks=["npx react-native init ApexMobile","JWT auth integration with FastAPI backend",
           "WebSocket client for live P&L streaming","FCM + APNs push setup",
           "Biometric kill switch","TestFlight + Google Play internal beta"],
    deliverables=["App builds for iOS + Android","P&L updates via WebSocket",
                  "Push fires on test trade","Kill switch works with biometric"],
    autopilot=["Mobile = always-on monitoring even away from desk",
               "Biometric kill switch is the ultimate safety feature"],
    risk=["Risk: WebSocket battery drain → background polling when app inactive",
          "Risk: App store review delay → TestFlight for internal testing first"],
    code=["const killSwitch = async () => {",
          "  const auth = await LocalAuthentication.authenticateAsync();",
          "  if (auth.success) await api.post('/autopilot/kill');",
          "}"],
    days=["Mon: RN setup; JWT auth","Tue: P&L + positions screens","Wed: WebSocket",
          "Thu: Push notifications","Fri: Biometric kill switch; TestFlight"],
)

WEEKS[80] = dict(
    title="Web3 Integration & On-Chain Trade Audit Trail",
    subtitle="Publish trade decision hashes to Polygon blockchain for tamper-proof immutable audit.",
    kpis=[("Chain","Polygon"),("Cost","<$0.01/hash"),("Verify","On-chain"),("DeFi","Research phase")],
    goals=["Publish SHA-256 hash of each trade decision to Polygon for immutable record",
           "Verification API: compare DB record vs on-chain hash",
           "Quarterly portfolio attestation published on-chain",
           "Research Lyra DeFi options protocol on testnet",
           "Batch hourly hashes to control gas costs"],
    tasks=["pip install web3","blockchain.py: publish_hash(trade_id, hash) → tx_hash",
           "Polygon Mumbai testnet → mainnet after testing",
           "verify_trade(trade_id): compare DB vs on-chain",
           "GET /api/v1/compliance/chain-verify/{trade_id}"],
    deliverables=["Hash published on Polygon for test trade","Verification endpoint works",
                  "Gas tracked at <$0.01 per hash batch","Lyra research doc written"],
    autopilot=["On-chain hashes = blockchain is the ultimate immutable audit",
               "Quarterly attestation makes performance claims publicly verifiable"],
    risk=["Risk: Gas spikes → batch hourly rather than per-trade",
          "Risk: Lyra liquidity thin → DeFi research only; no production trading yet"],
    code=["def publish_hash(h: str) -> str:",
          "    tx = contract.functions.recordHash(h).build_transaction({'gas':50000})",
          "    signed = w3.eth.account.sign_transaction(tx, PRIVATE_KEY)",
          "    return w3.eth.send_raw_transaction(signed.rawTransaction).hex()"],
    days=["Mon: Web3 + Polygon","Tue: Hash publisher","Wed: Verification API",
          "Thu: Lyra testnet research","Fri: Quarterly attestation"],
)

# Weeks 81-103: final phase
_FINAL_WEEKS = {
81: "Quantitative Research Platform & Jupyter Integration",
82: "API Marketplace: Sell Data Feeds & Signals to Third Parties",
83: "Enterprise Multi-Tenant Architecture for Multiple Users",
84: "Black-Litterman Portfolio Optimization Model",
85: "Regulatory Filing Automation (Form 4, 13F Preparation)",
86: "AI-Powered Strategy Narrative Auto-Generator",
87: "Cross-Asset Correlation Engine (Stocks + Bonds + Crypto + Forex)",
88: "Distributed Computing: Ray Cluster for Parallel Backtests",
89: "Automated A/B Testing Framework for Strategy Variants",
90: "Production Hardening: Kubernetes, Helm Charts, Auto-Scaling",
91: "Community Platform: Strategy Sharing Marketplace",
92: "Beta Program: External User Onboarding (10 Beta Users)",
93: "Public API v2.0 with GraphQL & WebSocket Subscriptions",
94: "Advanced Options Analytics: Smile Arbitrage & Density Extraction",
95: "Institutional Data Integration: Bloomberg B-PIPE Alternative",
96: "Automated Earnings Straddle & Strangle Strategy Suite",
97: "Full CI/CD Pipeline: GitOps, ArgoCD, Blue-Green Deployments",
98: "Performance Attribution Engine: Brinson-Hood-Beebower Model",
99: "Predictive Analytics Dashboard: ML-Powered Forward Metrics",
100: "Two-Year Milestone: 10,000 Paper Trades Analysis & Insights",
101: "Open Source Launch: Apache 2.0 License + GitHub Stars Campaign",
102: "Premium Tier: SaaS Model Design & Stripe Billing Integration",
103: "Final Integration Testing & Two-Year Performance Certification",
}

for wk, title in _FINAL_WEEKS.items():
    WEEKS[wk] = dict(
        title=title,
        subtitle=f"Advanced Year 2 strategic feature: {title[:60]}",
        kpis=[("Week",f"{wk}/104"),("Phase","Y2 Final"),("Status","Production"),("Priority","Strategic")],
        goals=[f"Implement {title} as production-grade capability",
               "Integrate with core autopilot ecosystem",
               "Test in staging environment before production rollout",
               "Document and release with comprehensive changelog"],
        tasks=[f"Architect {title} design","Implement core service + API",
               "Build frontend component","Write unit + integration tests",
               "Documentation + CI integration"],
        deliverables=[f"{title} live in production","Tests passing in CI",
                      "User documentation updated","Released with changelog"],
        autopilot=[f"{title} adds strategic depth to the autonomous trading ecosystem",
                   "Performance impact tracked in weekly attribution reports"],
        risk=["Risk: Scope underestimated → timebox to 1 week; defer excess to post-v3.0 roadmap"],
        code=[f"# Week {wk}: {title}", "# See architecture docs for full implementation"],
        days=["Mon: Design + kickoff","Tue: Core implementation","Wed: API + frontend",
              "Thu: Testing + integration","Fri: Documentation + deployment"],
    )

WEEKS[104] = dict(
    title="Two-Year Completion: Open Source Launch, 4-Year Roadmap & Celebration",
    subtitle="Final week: 2-year retrospective, open source the core, publish the definitive technical article, plan Year 3+.",
    kpis=[("Live Trades","2,000+ target"),("Sharpe","Target >1.5"),("Open Source","GitHub"),("Release","v3.0")],
    goals=["Comprehensive 2-year performance attribution: all strategies, all regimes",
           "Calculate full live trading P&L: target Sharpe >1.5, max drawdown <15%",
           "Open-source the core framework (minus proprietary alpha signals) on GitHub",
           "Publish definitive technical article: 'Building an Autonomous Options Autopilot in 2 Years'",
           "Year 3-4 roadmap: hedge fund structure, institutional capital, full platform",
           "Tag v3.0; celebrate the two-year milestone"],
    tasks=["two_year_review.py: full performance attribution from DB",
           "2-year report PDF via ReportEngine",
           "Open-source prep: audit private signals; write contribution guide + LICENSE",
           "Publish technical article on Substack / HN / LinkedIn",
           "Year 3-4 Roadmap.md: investor-deck format with track record",
           "git tag v3.0 with full annotated changelog"],
    deliverables=["2-year performance report PDF","Open-source repo live with README",
                  "Technical article published","Year 3-4 roadmap finalized","v3.0 tagged on GitHub"],
    autopilot=["Two years of autonomous operation — the autopilot has proven itself at real stakes",
               "Open-source core: give back to the trading community that provided the tools",
               "Track record = foundation for Year 3 institutional conversations"],
    risk=["Risk: 2-year results below target → honest retrospective; document what to change for Y3",
          "Risk: Open-source exposes proprietary alpha → carefully audit what stays private"],
    code=["SELECT EXTRACT(year FROM created_at) yr,",
          "       COUNT(*) trades, SUM(pnl) total_pnl,",
          "       AVG(CASE WHEN pnl>0 THEN 1.0 ELSE 0 END) win_rate",
          "FROM trades GROUP BY yr ORDER BY yr",
          "-- Target: win_rate>0.60, max_dd<15%, positive P&L both years"],
    days=["Mon: 2-year analysis + performance report PDF","Tue: Open-source prep + contribution guide",
          "Wed: Technical article draft + publish","Thu: Year 3-4 roadmap + v3.0 release notes",
          "Fri: Tag v3.0; publish article; celebrate 104 weeks of building"],
)
'''

BUILD_FUNCTION = r'''

# ══════════════════════════════════════════════════════════════════════════════
# PDF BUILD ENGINE
# ══════════════════════════════════════════════════════════════════════════════

def build_week_page(story, week_num, data, styles):
    """Render one complete week page into the story list."""
    q = quarter_for_week(week_num)
    qcolor = QUARTER_COLORS[q]
    qlabel = {1:"Year 1 · Q1",2:"Year 1 · Q2",3:"Year 1 · Q3",4:"Year 1 · Q4",
              5:"Year 2 · Q1",6:"Year 2 · Q2",7:"Year 2 · Q3",8:"Year 2 · Q4"}[q]

    story += week_header_block(week_num, data["title"], data["subtitle"], qcolor, qlabel, styles)
    story.append(Spacer(1, 4))

    # KPIs row
    kpi_cells = [[Paragraph(f"<b>{k}</b><br/>{v}", ParagraphStyle("kpi_cell",
        fontName="Helvetica", fontSize=7.5, textColor=APEX_OFF_WHITE, leading=10,
        alignment=TA_CENTER)) for k, v in data.get("kpis", [])]]
    if kpi_cells[0]:
        n = len(kpi_cells[0])
        kpi_tbl = Table(kpi_cells, colWidths=[6.5*inch/n]*n, rowHeights=[28])
        kpi_tbl.setStyle(TableStyle([
            ("BACKGROUND",(0,0),(-1,-1), qcolor),
            ("ALIGN",(0,0),(-1,-1),"CENTER"),
            ("VALIGN",(0,0),(-1,-1),"MIDDLE"),
            ("GRID",(0,0),(-1,-1),0.5, colors.HexColor("#1A2035")),
            ("TOPPADDING",(0,0),(-1,-1),4),("BOTTOMPADDING",(0,0),(-1,-1),4),
        ]))
        story.append(kpi_tbl)
        story.append(Spacer(1, 6))

    def section(title, items, color=APEX_TEAL):
        story.append(Paragraph(title, ParagraphStyle("sect_hdr",
            fontName="Helvetica-Bold", fontSize=8, textColor=color,
            spaceBefore=4, spaceAfter=2)))
        for item in items:
            story.append(Paragraph(f"▸ {item}", styles["body"]))

    two_col_items = [
        ("🎯 Goals", data.get("goals", []), APEX_TEAL),
        ("✅ Tasks", data.get("tasks", []), APEX_BLUE),
        ("📦 Deliverables", data.get("deliverables", []), APEX_GREEN),
        ("🤖 Autopilot", data.get("autopilot", []), APEX_GOLD),
        ("⚠ Risk", data.get("risk", []), APEX_RED),
    ]

    for title, items, color in two_col_items:
        section(title, items, color)

    # Code snippet
    code_lines = data.get("code", [])
    if code_lines:
        story.append(Paragraph("💻 Code Snippet", ParagraphStyle("sect_hdr",
            fontName="Helvetica-Bold", fontSize=8, textColor=APEX_PURPLE,
            spaceBefore=4, spaceAfter=2)))
        code_text = "<br/>".join(
            f'<font name="Courier" size="7" color="#D4D4D4">{ln.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;")}</font>'
            for ln in code_lines)
        code_para = Paragraph(code_text, ParagraphStyle("code_block",
            fontName="Courier", fontSize=7, textColor=APEX_OFF_WHITE,
            backColor=colors.HexColor("#0D1117"), leading=10, leftIndent=6,
            rightIndent=6, spaceAfter=4, spaceBefore=2,
            borderPad=4))
        story.append(code_para)

    # Day-by-day
    days = data.get("days", [])
    if days:
        section("📅 Day-by-Day", days, APEX_CYAN)

    story.append(PageBreak())


def build_pdf():
    out = "/home/aarav/Aarav/Tradingview recreation/Apex_Terminal_2Year_Expanded_Plan.pdf"
    doc = SimpleDocTemplate(
        out, pagesize=letter,
        leftMargin=0.65*inch, rightMargin=0.65*inch,
        topMargin=0.5*inch, bottomMargin=0.5*inch,
    )

    styles = build_styles()
    story = []

    # ── Cover page ──────────────────────────────────────────────────────────
    story.append(Spacer(1, 1.2*inch))
    story.append(Paragraph("APEX TERMINAL", ParagraphStyle("cover_main",
        fontName="Helvetica-Bold", fontSize=38, textColor=APEX_TEAL,
        alignment=TA_CENTER, spaceAfter=8)))
    story.append(Paragraph("Two-Year Master Plan — Expanded Edition",
        ParagraphStyle("cover_sub",fontName="Helvetica",fontSize=18,
        textColor=APEX_OFF_WHITE,alignment=TA_CENTER,spaceAfter=4)))
    story.append(Paragraph("104 Weeks · Detailed Technical Breakdown · AI Autopilot Architecture",
        ParagraphStyle("cover_tag",fontName="Helvetica-Oblique",fontSize=10,
        textColor=APEX_GREY,alignment=TA_CENTER,spaceAfter=20)))
    bar = Table([[""]], colWidths=[6.5*inch], rowHeights=[3])
    bar.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),APEX_TEAL)]))
    story.append(bar)
    story.append(Spacer(1, 16))
    metrics = [
        ["104 Weeks","6 Strategies","Dual LLM","Full Stack"],
        ["52 Wks Y1  +  52 Wks Y2","All Option Types","Groq + Gemini","React + FastAPI"],
    ]
    met_tbl = Table(metrics, colWidths=[1.625*inch]*4, rowHeights=[18,14])
    met_tbl.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,0),APEX_BLUE),
        ("TEXTCOLOR",(0,0),(-1,0),APEX_OFF_WHITE),
        ("TEXTCOLOR",(0,1),(-1,1),APEX_GREY),
        ("FONTNAME",(0,0),(-1,0),"Helvetica-Bold"),
        ("FONTNAME",(0,1),(-1,1),"Helvetica"),
        ("FONTSIZE",(0,0),(-1,0),9),
        ("FONTSIZE",(0,1),(-1,1),7),
        ("ALIGN",(0,0),(-1,-1),"CENTER"),
        ("VALIGN",(0,0),(-1,-1),"MIDDLE"),
        ("GRID",(0,0),(-1,-1),0.5,colors.HexColor("#1A2035")),
    ]))
    story.append(met_tbl)
    story.append(PageBreak())

    # ── Table of Contents ────────────────────────────────────────────────────
    story.append(Paragraph("Table of Contents", ParagraphStyle("toc_title",
        fontName="Helvetica-Bold",fontSize=16,textColor=APEX_TEAL,
        alignment=TA_CENTER,spaceAfter=12)))
    for wk in range(1, 105):
        if wk in WEEKS:
            q = quarter_for_week(wk)
            qnames = {1:"Y1-Q1",2:"Y1-Q2",3:"Y1-Q3",4:"Y1-Q4",
                      5:"Y2-Q1",6:"Y2-Q2",7:"Y2-Q3",8:"Y2-Q4"}
            line = f"<b>Wk {wk:03d}</b> [{qnames[q]}]  {WEEKS[wk]['title']}"
            story.append(Paragraph(line, ParagraphStyle("toc_line",
                fontName="Helvetica",fontSize=7,textColor=APEX_OFF_WHITE,
                leading=9,spaceAfter=1,leftIndent=8)))
    story.append(PageBreak())

    # ── Week pages ───────────────────────────────────────────────────────────
    for wk in range(1, 105):
        if wk in WEEKS:
            build_week_page(story, wk, WEEKS[wk], styles)

    doc.build(story)
    print(f"✅ PDF generated: {out}")
    print(f"   Total weeks rendered: {sum(1 for w in range(1,105) if w in WEEKS)}/104")


if __name__ == "__main__":
    build_pdf()
'''

target = "/home/aarav/Aarav/Tradingview recreation/gen_expanded_plan.py"

print(f"Appending Year 2 weeks (53-104) and build_pdf() to {target}")

with open(target, "a", encoding="utf-8") as f:
    f.write(Y2_APPENDIX)
    f.write(BUILD_FUNCTION)

print("Done — run: python3 gen_expanded_plan.py")
