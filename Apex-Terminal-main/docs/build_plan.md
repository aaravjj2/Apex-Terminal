# Build Plan: Vol & Positioning Workstation

> Generated: 2026-01-12
> Target: Complete implementation with E2E verification
> **Last Update: 2026-01-13 - Phase 1 & 2 Complete**

## Implementation Milestones

### Phase 1: Options Analytics Core ✅ COMPLETE

#### 1.1 Options Data Adapters ✅
- [x] `phase1/services/options/adapter.py` - YFinance options chain adapter
- [x] `phase1/services/options/models.py` - OptionContract, OptionChain, Greeks dataclasses
- [x] `phase1/services/options/greeks.py` - Black-Scholes Greeks calculator (42 tests pass)
- [x] `phase1/services/options/iv_analytics.py` - IV Rank, Percentile, Skew, Term Structure (28 tests pass)
- [x] `phase1/services/api/routes/options.py` - REST endpoints for options data
- [x] Unit tests: `phase1/tests/unit/test_options_greeks.py` - **42 passed**
- [x] Unit tests: `phase1/tests/unit/test_iv_analytics.py` - **28 passed**

#### 1.2 Frontend Options Components ✅
- [x] `frontend/src/features/options/types.ts` - TypeScript types
- [x] `frontend/src/features/options/api.ts` - API client
- [x] `frontend/src/features/options/store.ts` - Zustand store
- [x] `frontend/src/features/options/components/IVAnalyticsPanel.tsx` - IV Rank/Percentile display
- [x] `frontend/src/features/options/components/GreeksPanel.tsx` - Greeks display
- [x] `frontend/src/features/options/components/PutCallRatioPanel.tsx` - PCR display
- [x] `frontend/src/features/options/components/PayoffChart.tsx` - Strategy payoff visualization
- [x] `frontend/src/features/options/OptionsDashboard.tsx` - Main dashboard

### Phase 2: Strategy Factory ✅ COMPLETE

#### 2.1 Strategy Engine ✅
- [x] `phase1/services/options/strategy_factory.py` - Strategy template factory
  - 10 strategy templates (covered call, CSP, protective put, collar, verticals, iron condor, calendar, straddle, strangle)
  - Payoff curve generation (expiration + theoretical T+0)
  - Greeks aggregation
  - Breakeven calculation
  - Max profit/loss analysis
- [x] Unit tests: `phase1/tests/unit/test_strategy_factory.py` - **46 passed**

#### 2.2 Strategy API Endpoints ✅
- [x] GET `/api/v1/options/strategies/templates` - List strategy templates
- [x] POST `/api/v1/options/strategies/analyze` - Analyze custom strategy
- [x] POST `/api/v1/options/strategies/covered-call` - Build covered call
- [x] POST `/api/v1/options/strategies/iron-condor` - Build iron condor
- [x] POST `/api/v1/options/strategies/straddle` - Build straddle
- [x] POST `/api/v1/options/strategies/vertical-spread` - Build vertical spread

## Test Summary (Phase 1+2)
- **116 backend unit tests passing**
- **21 frontend unit tests passing**
- **Frontend builds successfully**

### Phase 3: Stock Indicators (Regime + Risk)

#### 3.1 VWAP + Anchored VWAP
- [ ] Update `frontend/src/features/indicators/calculators/profile.ts` - AVWAP with anchor points
- [ ] `frontend/src/features/indicators/calculators/vwap_bands.ts` - VWAP standard deviation bands
- [ ] Anchor point UI in IndicatorDock

#### 3.2 Volume Profile
- [ ] `frontend/src/features/indicators/calculators/volume_profile.ts` - POC, VAH, VAL, HVN/LVN
- [ ] `frontend/src/features/indicators/renderers/ProfileRenderer.tsx` - Profile visualization
- [ ] Visible Range + Fixed Range modes

#### 3.3 EMA Regime Filter
- [ ] `frontend/src/features/indicators/calculators/regime.ts` - EMA 20/50/200 with slope detection
- [ ] Crossover state tracking

#### 3.4 Indicator Manager UI
- [ ] `frontend/src/features/indicators/IndicatorManager.tsx` - Docked manager with favorites/presets
- [ ] Parameter editor with schema validation

### Phase 4: Profiles / Auction Tools

#### 4.1 Profile Engine
- [ ] `phase1/services/charting/profiles.py` - Profile computation engine
- [ ] Session Profile, Fixed Range, Visible Range modes
- [ ] Developing POC tracking

#### 4.2 Frontend Profile Overlays
- [ ] `frontend/src/features/profiles/VolumeProfile.tsx` - Profile overlay component
- [ ] `frontend/src/features/profiles/SessionProfile.tsx` - Session-based profiles
- [ ] Zone rendering (VAH/VAL as acceptance zones)

### Phase 5: Pattern Detection

#### 5.1 Pattern Engine
- [ ] `phase1/services/charting/patterns/detector.py` - Pattern detection engine
- [ ] `phase1/services/charting/patterns/classics.py` - Classic patterns:
  - Flags, Pennants, Triangles, Rectangles, Wedges
  - Double top/bottom, Head & shoulders
- [ ] `phase1/services/charting/patterns/gaps.py` - Gap classification
- [ ] Context filters (ATR regime, level references)
- [ ] Unit tests: `phase1/tests/unit/test_pattern_detection.py`

#### 5.2 Frontend Pattern Annotations
- [ ] `frontend/src/features/patterns/PatternOverlay.tsx` - Pattern markers on chart
- [ ] `frontend/src/features/patterns/PatternPanel.tsx` - Pattern explanations

### Phase 6: Fundamentals Panel

#### 6.1 Fundamentals Data
- [ ] `phase1/services/fundamentals/adapter.py` - YFinance fundamentals adapter
- [ ] `phase1/services/fundamentals/metrics.py` - Metric calculations:
  - ROIC, Gross/Operating Profitability
  - FCF, FCF Yield, Shareholder Yield
  - Leverage metrics, Margin stability
  - EV/FCF valuation
- [ ] `phase1/services/persistence/fundamentals_store.py` - Cache fundamentals with timestamps
- [ ] `phase1/services/api/routes/fundamentals.py` - REST endpoints

#### 6.2 Frontend Fundamentals
- [ ] `frontend/src/features/fundamentals/FundamentalsPanel.tsx` - Panel component
- [ ] Metric tiles with "Data unavailable" states

### Phase 7: Dashboard Workspace

#### 7.1 Dashboard Infrastructure
- [ ] `frontend/src/features/dashboard/DashboardWorkspace.tsx` - Tile grid workspace
- [ ] `frontend/src/features/dashboard/TileRegistry.ts` - Tile type registry
- [ ] `frontend/src/features/dashboard/tiles/` - Dashboard tiles:
  - OptionsChainTile.tsx
  - IVAnalyticsTile.tsx
  - GreeksTile.tsx
  - FundamentalsTile.tsx
  - MiniChartTile.tsx

### Phase 8: Trust UX + Integration

#### 8.1 Trust UX Components
- [ ] Mode chip (LIVE/REPLAY/BACKTEST/PAPER) always visible
- [ ] Provider health indicators
- [ ] Last tick time display
- [ ] Data provenance tooltips

#### 8.2 Workspace Integration
- [ ] Workspace switcher (Chart | Dashboard)
- [ ] Options suite in main nav
- [ ] All "Data unavailable" states implemented

---

## Testing Strategy

### Unit Tests
- All calculators have comprehensive unit tests
- Greek calculations verified against known values
- Strategy payoffs validated

### Integration Tests
- API endpoints tested with real data
- Frontend components tested with mock stores

### E2E Tests (Playwright via ag:run)
- App loads in LIVE mode
- Symbol/timeframe switching
- Indicator add/edit flow
- Options chain population
- Strategy builder flow
- Dashboard workspace
- Trust UX visibility

---

## File Size Limits

Monitor these files for chunking:
- Any file > 500 lines: split into modules
- IndicatorRegistry.ts (705 lines) - already at limit
- Options logic files - keep < 400 lines each

---

## API Contracts (New Endpoints)

### Options Endpoints
```
GET  /api/v1/options/chain/{symbol}
     Query: expiration (optional)
     Response: { chain: OptionContract[], expirations: string[] }

GET  /api/v1/options/iv/{symbol}
     Response: { iv_rank: number, iv_percentile: number, current_iv: number, historical_iv: number[] }

GET  /api/v1/options/skew/{symbol}/{expiration}
     Response: { strikes: number[], ivs: number[], skew_slope: number, delta25_put_iv: number, delta25_call_iv: number }

GET  /api/v1/options/term-structure/{symbol}
     Response: { expirations: string[], ivs: number[], structure_type: "contango"|"backwardation"|"flat"|"inverted" }
```

### Strategy Endpoints
```
POST /api/v1/strategy/build
     Body: { symbol: string, legs: StrategyLeg[] }
     Response: { payoff_curve: Point[], greeks: Greeks, max_gain: number, max_loss: number, breakevens: number[] }

GET  /api/v1/strategy/templates
     Response: { templates: StrategyTemplate[] }
```

### Fundamentals Endpoints
```
GET  /api/v1/fundamentals/{symbol}
     Response: { metrics: FundamentalMetrics, timestamp: string, provider: string, unavailable: string[] }
```
