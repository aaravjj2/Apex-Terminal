# System Architecture Audit (Phase 1)
**Generated:** 2026-01-25
**Scope:** `phase1` repository analysis

## A. Current Codebase Shape
The system is monolithic within `phase1/services/autopilot/`, organized by function.

**Top-Level Modules (`phase1/services/autopilot/`):**

| File | Function | Responsibilities |
| :--- | :--- | :--- |
| **`unified_engine.py`** | **Main Loop** | Orchestrator, Cycle Management, State Transitions |
| `alpaca_client.py` | Broker | Direct API wrapper for Alpaca (Orders, Positions, Account) |
| `data_fetcher.py` | Market Data | Fetches OHLC/Volume/Option Chains (via generic provider) |
| `broker_position_manager.py` | State/Risk | Tracks managed positions, exit rules, PnL reconciliation |
| `candidates.py` | Decision | Generates trade ideas based on features and universe |
| `enhanced_candidates.py` | Decision | V2 intelligence (Technical Analysis, Multi-factor scoring) |
| `features.py` | Decision | Computes trends, volatility regimes, liquidity scores |
| `validator.py` | Risk | "Gates" for trade acceptance (Earnings, Spreads, etc.) |
| `sentiment_engine.py` | Input | News/Sentiment aggregation (FinBERT/FinGpt integration) |
| `config.py` | Config | **V1 Contracts** (Risk limits, Allowed templates) |
| `universe.py` | Input | Defines tradeable symbol list and clusters |
| `audit.py` | Observability | Persistence of RunArtifacts |

**Main Loop:**
*   **Name:** `UnifiedAutopilotEngine.run_cycle()`
*   **Location:** `services/autopilot/unified_engine.py` (Line 770)
*   **Trigger:** Externally scheduled (method exists `start()`, but `run_cycle` is the unit of work).

---

## B. Decision Cadence & Scope

1.  **Frequency:**
    *   **Discrete Cycles:** The brain runs one complete `run_cycle()` at a time.
    *   **Schedule:** Configured in `config.py` as `scan_times` (e.g., "09:35", "12:00", "15:30"). It is **Time-Based**, not continuous-loop or tick-driven.
2.  **Scope per Cycle:**
    *   **Batched:** Evaluates the entire target universe (top N ranked symbols) in one pass.
    *   **Selection:** Generates `M` candidates, validatates them, and executes top picks.
3.  **Action Limits:**
    *   **Multiple Actions:** Can emit multiple trades in one cycle (`lines 991-992` in `unified_engine.py`).
    *   **Limits:** Constrained by `risk_limits.max_daily_trades` (default 10) and `max_open_positions`.

---

## C. Strategy Constraints (V1 Frozen)

*   **Allowed Structures:**
    *   **`LONG_CALL`** and **`LONG_PUT`** **ONLY**.
    *   Spreads (Verticals, Condors) are explicitly gated off (`config.py` line 301).
*   **Max Positions:**
    *   **10** simultaneous open positions (Hard limit).
*   **Max Exposure:**
    *   **$1,000** Total Paper Equity (Hard limit).
    *   **50%** ($500) Max Buying Power Utilization.
    *   **2%** ($20) Risk per trade.
*   **Exit Rules (Mandatory):**
    *   **Profit Target:** Defaults to **+50%**.
    *   **Stop Loss:** Defaults to **-10%** (Hard stop).
    *   **Time Stop:** 7 days max DTE.
    *   **EOD Flatten:** **Yes**, for 0DTE logic (though v1 prefers weekly expiry > 7 days by default).

---

## D. Inputs (Snapshot Design)

*   **Price Data:**
    *   **History:** 60-day lookback for Trend/Vol (`enhanced_candidates.py`).
    *   **Current:** Real-time Last Price + Monthly/Weekly Option Chains.
*   **Indicators:**
    *   **Computed Internally:** RSI, Trend Slope, IV Rank, Realized Volatility (`features.py`).
    *   **External:** News Sentiment Score (`SentimentEngine`).
*   **Greeks:**
    *   **Yes:** Uses `Delta` for strike selection (Target: 0.35 - 0.65). Uses `IV` for regime classification.
*   **Context:**
    *   **Deep History:** Rolling 20-day Realized Vol, 52-week IV Rank.
    *   **Regime:** Explicit `MarketContext.regime` (Bullish/Bearish/Neutral/Chaos).

---

## E. Risk & Gating Logic

*   **Daily Guards:**
    *   **Max Trades/Day:** 10.
    *   **Daily Loss Cap:** 10% (stops trading if hit).
    *   **Buying Power:** 50% Cap.
*   **Enforcement:**
    *   **Internal:** The "Brain" (`UnifiedAutopilotEngine`) enforces these *before* sending orders.
    *   **Broker:** Alpaca has its own checks, but the bot is the primary gatekeeper.
*   **Randomness:**
    *   **Deterministic:** `_select_candidates` logic is deterministic based on score (config `LLMMode.DETERMINISTIC` default). Tie-breaking is score-based.

---

## F. State Persistence

*   **What is Remembered:**
    *   **Positions:** `BrokerPositionManager` tracks managed status, strategy ID, and entry credit.
    *   **Cycles:** `RunArtifact` saves full decision trace (ThinkLog) to disk/DB.
    *   **Performance:** `trade_ledger.json` tracks closed trade history.
*   **Storage:**
    *   **Primary:** Alpaca (Source of Truth for "What do I own?").
    *   **Metadata:** `phase1.db` (SQLite) / `trade_ledger.json` (File).

---

## G. Execution Assumptions

*   **Method:**
    *   **Direct Placement:** Places Market/Limit orders via Alpaca API immediately validation passes.
    *   **Monitoring:** Checks order status (Filled/Rejected) in-cycle.
*   **Assumptions:**
    *   **Slippage:** Not explicitly modeled in `dry_run=False` (relies on real/paper execution).
    *   **Fills:** Assumes "If Alpaca accepts, it's working." Does not currently implement complex retry/replace logic if an order hangs pending.

---

## H. Cboe Dataset Usage (Planned Integration)

*   **Current State:** Not used in `features.py`.
*   **Plan:**
    *   **Integration:** Inject `CboeAggregateVolumeSource` into `FeatureEngine`.
    *   **Usage:**
        1.  **Liquidity Gate:** Hard reject if Daily Volume < N (e.g., < 50k).
        2.  **Ranking Signal:** `RelativeVolume` feature (Current Vol / 30-day Avg Cboe Vol). High relative vol = higher rank.
        3.  **Regime Input:** Use Aggregate Market Volume (SPY+QQQ+IWM) to confirm trend strength.
*   **Lookback:** 30-day rolling average for baseline.
*   **Universe:** Static list defined in `config.py`, but filtered dynamically by data availability.

---

## I. Debugging & Observability

*   **ThinkLog:** A detailed, human-readable trace of every step ("thoughts", "observations", "decisions") is generated every cycle.
*   **Artifacts:** JSON/Markdown saved per run containing:
    *   Market Snapshot.
    *   Candidate Scores.
    *   Rejection Reasons (Why *didn't* we trade X?).
    *   Validation Errors.

---

## J. Non-Negotiables (Hard Constraints)

1.  **Paper Only:** Engine explicitly refuses to run if it detects a Live broker endpoint.
2.  **Exit Rules:** No position is opened without attached metadata defining Stop Loss/Profit Target.
3.  **V1 Templates:** No spreads, no naked sells. Long options only.
4.  **Kill Switch:** immediate "Stop All" functionality available and respected.
