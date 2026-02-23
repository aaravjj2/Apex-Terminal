# AUDIT_W11_W20.md — Waves 11–20 Online-Only Swing Equities v1
## Full Re-evaluation Audit + Baseline

### Date: 2026-02-22
### Scope: Waves 11–20 integrated release

---

## 1. EXISTING FEATURES INVENTORY

### KEEP (Core Surfaces)
| Feature | Location | Status |
|---------|----------|--------|
| Autopilot | `/ui2/autopilot` | Keep, enhance with W11-13 |
| Strategies/Backtester | `/ui2/backtest` | Keep, enhance with W14-15 |
| Workflows/Agents | `/ui2/workflow-builder` | Keep, enhance with W18 |
| Search | `/ui2/search` | Keep, enhance with W19 |
| Ops/Settings | `/ui2/ops`, `/ui2/settings` | Keep, enhance with W19-20 |

### HIDE (Behind feature flags, not in core nav)
| Feature | Location | Reason |
|---------|----------|--------|
| Dashboard | `/ui2/dashboard` | Not core surface |
| Trading | `/ui2/trading` | Not core surface |
| Portfolio | `/ui2/portfolio` | Subsumed by Autopilot exposure view |
| Orders | `/ui2/orders` | Subsumed by Autopilot/Bottom dock |
| Risk & Options | `/ui2/risk` | Not equities-only scope |
| Research | `/ui2/research` | Subsumed by Backtester |
| Alerts | `/ui2/alerts` | Not core |
| Replay | `/ui2/replay` | Not core |
| Runs & Audit | `/ui2/runs` | Folded into Ops |
| Automation | `/ui2/automation` | Replaced by Workflow Builder |
| Agent | `/ui2/agent` | Folded into AI Strategy Builder |
| Autopilot V2 | `/ui2/autopilot-v2` | Merged into Autopilot |
| Automation V2 | `/ui2/automation-v2` | Replaced by Workflow Builder |
| Export | `/ui2/export` | Folded into Ops |
| Health | `/ui2/health` | Folded into Ops |
| Telemetry | `/ui2/telemetry` | Folded into Ops |
| Incidents | `/ui2/incidents` | Folded into Ops |
| All Wave 6-10 specialty pages | Various | Not core nav |

---

## 2. DEMO/MOCK/SYNTHETIC RUNTIME — DELETE PLAN

### Files with mock/demo runtime paths:
| File | Issue | Fix |
|------|-------|-----|
| `services/api/main.py` lifespan | Falls back to mock CSV ingestion | Remove mock fallback, require real providers |
| `services/config.py` | `ingestion_mode` default "live" but allows "mock" | Remove mock option |
| `services/ingestion/main.py` | `IngestionService(mode="mock")` | Delete mock mode |
| `services/autopilot/paper_broker.py` | Standalone paper broker (OK for paper) | Keep for paper trading |
| `phase1/data/sample_ticks.csv` | Demo data file | Keep for test fixtures only, not runtime |
| `frontend/src/ui2/dataMode/config.ts` | Data mode config | Ensure online-only |
| Various route files | Return demo data when provider unavailable | Fail fast instead |

### Action: All runtime code paths must require real providers. Mock/demo codepaths deleted from runtime. Test fixtures remain for unit tests only.

---

## 3. WEAK/NO-OP TESTS — REPLACE PLAN

### Current test counts:
- **Frontend vitest**: 22 files, 325 tests — ALL PASS
- **Backend pytest**: Needs dependency installation, ~86 test files
- **Playwright**: Not yet running

### Tests to add for W11-W20:
- Market session correctness (open/closed/holiday/pre-market/after-hours)
- Ingestion completeness (7y daily history)
- Autopilot idempotency + kill switch + stop-out
- Portfolio allocator correctness
- Performance ledger + auto-disable
- Backtester corporate actions + execution calibration
- Sweeps/walk-forward/robustness
- FinBERT pipeline + indexing
- AI strategy generator schema compliance
- Workflow scheduling + run records
- Elasticsearch mappings + doc counts + queries

---

## 4. PROVIDER TOUCHPOINTS & FAILURE MODES

| Provider | Purpose | Failure Mode | Mitigation |
|----------|---------|-------------|------------|
| Alpaca Paper | Broker execution | API unavailable | Fail fast, disable autopilot |
| Alpaca Data | Intraday quotes | Rate limit/outage | Retry with backoff, fallback to last known |
| yfinance | 7y daily history | Throttling | Batch with delays, cache results |
| Finnhub | News ingestion | Rate limit | Queue with backoff |
| Elasticsearch | Search/observability | Unavailable | HARD FAIL — refuse to start |
| Postgres | Canonical store | Unavailable | HARD FAIL — refuse to start |
| Groq/Gemini | AI strategy gen | Rate limit/error | Retry, graceful degradation |

---

## 5. BASELINE RESULTS

| Gate | Result | Notes |
|------|--------|-------|
| `tsc --noEmit` | 0 errors | PASS |
| `vitest run` | 325 passed, 0 failed | PASS |
| `pytest` | Pending install | TBD |
| `Playwright MCP` | Not configured yet | TBD |

---

## 6. WAVE IMPLEMENTATION PLAN

### Phase 1 — Foundations (W11 prereq)
- [x] Market calendar module (exists, enhance)
- [ ] Market session engine with pre/after/weekend classification
- [ ] Elasticsearch mandatory boot check + index templates
- [ ] Real data spine: yfinance 7y, Alpaca intraday, Finnhub news
- [ ] Ops health UI2 page

### Waves 11–13 — Market-Open Reliability + Portfolio + Performance
- [ ] Idempotent broker orders + reconciliation
- [ ] Kill switch + daily loss stop-out
- [ ] Portfolio allocator (exposure caps)
- [ ] Performance ledger + champion/challenger + auto-disable

### Waves 14–15 — Backtester Calibration + Strategy Discovery
- [ ] Corporate actions correctness
- [ ] Execution calibration (fee/slippage)
- [ ] Strategy candidate generator + evaluation ladder
- [ ] Walk-forward + robustness + overfit penalty

### Waves 16–17 — AI Strategy Builder + FinBERT Sentiment
- [ ] StrategySpec DSL
- [ ] AI generator with guardrails
- [ ] FinBERT sentiment pipeline
- [ ] Sentiment fusion in scoring

### Wave 18 — Workflows v3
- [ ] WorkflowV3 schema + templates
- [ ] Market-session aware scheduling
- [ ] Built-in templates
- [ ] Audit trail

### Wave 19 — Elastic + Observability v4
- [ ] ILM + rollover
- [ ] Query performance
- [ ] Observability dashboards

### Wave 20 — Productization
- [ ] UX polish pass
- [ ] Symbol universe manager
- [ ] Backup/restore
- [ ] Runbooks
- [ ] README update
