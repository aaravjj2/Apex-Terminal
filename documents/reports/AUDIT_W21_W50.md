# Waves 21–50 Audit Report

## Date: 2026-02-22

## Scope: Backtesting Engine + Elasticsearch (Only)

---

## Current Backtest Engine Gaps

### Data Integrity
- No canonical OHLCV schema with provenance tracking
- No corporate-actions adjustment pipeline (splits, dividends)
- No survivorship-bias guardrails or symbol lifecycle tracking
- No multi-timeframe alignment / resampling controls
- No data-quality scoring or refusal rules for bad data
- 7-year historical depth not enforced; relies on ad-hoc yfinance calls

### Execution Realism
- FillSimulator covers Market/Limit/Stop/StopLimit but no partial fills
- No unified portfolio accounting shared between backtest + evaluation
- Cost model is basic (per-share or per-trade); no multi-tier library
- No risk controls in simulation (max position, drawdown breaker, sector limits)
- No portfolio-level multi-symbol backtesting
- No event-driven engine architecture
- No trace DAG or explain view for decision audit

### Performance
- No vectorized bar processing; pure Python loop
- No caching layer for repeated runs
- No job queue for sweep parallelism
- No benchmark artifacts for engine speed regression tracking

### Evaluation
- Walk-forward is hardcoded 5 folds, not configurable
- No robustness stress suite (fee/slippage/delay perturbation)
- No overfit penalty scoring
- No benchmark comparison / alpha proxy calculations
- Monte Carlo is GBM-only, no trade-sequence bootstrapping
- No portfolio selection artifact with recommended set

### Strategy System
- StrategySpec v1 only (no schema validation, no lint rules)
- No AI-assisted strategy generation with refusal/repair
- No candidate generator or mutation operators

## Current Elasticsearch Gaps

### Index Architecture
- Single flat index prefix `apex` with basic mappings
- No index templates, aliases, or lifecycle management
- No reindex tooling

### Ingestion Pipeline
- No bulk ingestion with backpressure
- No dead-letter queue (DLQ)
- No lag metrics or ingestion health observability

### Query UX
- Basic keyword search only
- No query builder language
- No faceted navigation
- No saved queries or pinned filters
- No query explain view

### Semantic Search
- Not implemented (optional, behind flag)

### Reproducibility
- No export/import artifact tools
- No reproduce-run capability

## Demo/Mock/Synthetic Traces to Address

| File | Issue | Plan |
|------|-------|------|
| backtest_engine/fixtures.py | Demo bars | Keep for unit tests only, not runtime |
| elasticsearch_gateway.py | DEMO_HITS fallback | Replace with fail-fast when ES down |
| data_quality.py | DEMO_FEEDS hardcoded | Replace with real feed status |
| search.py | In-memory demo index | Replace with ES-backed search |
| backtestDepthStore.ts | Client-side demo generation | Connect to real API |

## Baseline Status (Pre-Implementation)
- tsc: 0 errors ✅
- vitest: 325/325 ✅
- pytest (root): 488/488 ✅
- pytest (phase1): 1394/1394 ✅
- Playwright E2E: 95/95 ✅
