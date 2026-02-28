# Objective G: Selector Policy Fix Plan

**Total Violations**: 65 across 22 files

## Category 1: "Load Demo" Button (16 violations)
**Status**: Component already has `data-testid="load-demo-btn"`
**Action**: Replace all `getByText('Load Demo')` with `getByTestId('load-demo-btn')`
**Files**:
- packaging-v1-9.spec.ts (1)
- stability-coverage-v1-3.spec.ts (4)
- ui-e2e-reconcile-v1-2.spec.ts (4)
- unified-runs-v1-5.spec.ts (2)
- visual-regression-v1-11.spec.ts (3)
- visual-regression-v1-4.spec.ts (1)
- visual-regression-v1-6.spec.ts (1)
- visual-regression-v1-8.spec.ts (1)
- premium-charts-v1-9.spec.ts (1)

## Category 2: Autopilot Components (8 violations)
**Status**: Testids added: paper-mode-banner, autopilot-stats-grid, stat-positions, position-ledger-heading, activity-log-heading, autopilot-settings-heading
**Action**: Update autopilot-mcp.spec.ts to use new testids
**File**: autopilot-mcp.spec.ts

## Category 3: Indicators Modal & Search (8 violations)
**Action**: Add testids to modal, search input, "Add to Chart" button
**Component**: Indicators modal (need to find component)
**File**: indicators.spec.ts

## Category 4: Strategy Lab Navigation (7 violations)
**Action**: Add testids to tab navigation elements
**File**: strategy-lab-backtest-v2.spec.ts

## Category 5: Options Chain Text (3 violations)
**Action**: Find component and add testid
**Files**: comprehensive_tour.spec.ts, ui-e2e-reconcile-v1-2.spec.ts

## Category 6: TTS Voice Toggle (3 violations)
**Action**: Add testid to voice toggle button
**File**: tts.spec.ts

## Category 7: Recharts Containers (4 violations)
**Action**: Wrap Recharts in divs with testids or use existing chart testids
**File**: premium-charts-v1-9.spec.ts

## Category 8: CSS Class Selectors (7 violations)
**Actions**:
- Chart containers: Add data-testid wrapping
- Status badge: Add testid
- PnL elements: Add testid
- Metrics cards: Use testid (already exists)
**Files**: interactions.spec.ts, snapshots.spec.ts, v1-terminal.spec.ts, websocket-status.spec.ts, industrial-uiux-analytics-reporting.spec.ts

## Category 9: Helper Function (1 violation)
**Action**: Replace waitForText helper with testid-based alternative
**File**: helpers.ts

## Category 10: Forecast Sees Tab (1 violation)
**Action**: Add testid to Sees tab button
**File**: forecast.spec.ts

## Category 11: Alerts Navigation (1 violation)
**Action**: Add testid to Alerts nav/button
**File**: websocket-status.spec.ts
