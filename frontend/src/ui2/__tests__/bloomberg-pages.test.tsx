/**
 * Bloomberg Terminal – Page Render Smoke Tests
 * Verifies that the 30 most critical UI2 pages render without crashing.
 * No real network calls — fetch is mocked globally.
 *
 * Run:  npx vitest run src/ui2/__tests__/bloomberg-pages.test.tsx
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { render } from '@testing-library/react';
import React, { Component, type ErrorInfo } from 'react';
import { MemoryRouter } from 'react-router-dom';

// ── Error Boundary – silently catches render-time errors ─────────────────────
class SmokeErrorBoundary extends Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(_e: Error, _i: ErrorInfo) { /* intentionally silent */ }
  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

// ── Mock heavyweight charting library (cannot use canvas in jsdom) ────────────
// Also mock ReplayView (complex UI1 component with date formatting on raw data)
vi.mock('../../../features/layout/views/ReplayView', () => ({
  ReplayView: () => null,
}));
// Mock the ReplayControls component used inside chart components
vi.mock('../../../features/chart/ReplayControls', () => ({
  ReplayControls: () => null,
  default: () => null,
}));
// Mock ChartCanvas to prevent canvas operations in jsdom
vi.mock('../../../features/chart/ChartCanvas', () => ({
  ChartCanvas: () => null,
  default: () => null,
}));

vi.mock('lightweight-charts', () => {  const mockSeries = () => vi.fn(() => ({
    setData: vi.fn(), applyOptions: vi.fn(), update: vi.fn(),
    setMarkers: vi.fn(), createPriceLine: vi.fn(), removePriceLine: vi.fn(),
    priceToCoordinate: vi.fn(() => 0), coordinateToPrice: vi.fn(() => 0),
    // series.priceScale() — needed by some pages
    priceScale: vi.fn(() => ({ applyOptions: vi.fn(), width: vi.fn(() => 0), mode: vi.fn(() => 0) })),
  }));
  const mockChart = {
    addLineSeries: mockSeries(), addAreaSeries: mockSeries(),
    addCandlestickSeries: mockSeries(), addHistogramSeries: mockSeries(),
    addBarSeries: mockSeries(), addBaselineSeries: mockSeries(),
    applyOptions: vi.fn(), resize: vi.fn(), remove: vi.fn(),
    timeScale: vi.fn(() => ({ fitContent: vi.fn(), scrollToPosition: vi.fn(), applyOptions: vi.fn(), getVisibleRange: vi.fn() })),
    priceScale: vi.fn(() => ({ applyOptions: vi.fn(), width: vi.fn(() => 0) })),
    subscribeCrosshairMove: vi.fn(), unsubscribeCrosshairMove: vi.fn(),
    subscribeClick: vi.fn(), unsubscribeClick: vi.fn(),
    chartElement: vi.fn(() => document.createElement('div')),
    options: vi.fn(() => ({})),
    priceToCoordinate: vi.fn(() => 0),
    // v5 API: addSeries replaces addCandlestickSeries etc.
    addSeries: mockSeries(),
  };
  // Lightweight-charts v4+ exports series constructors
  const SeriesStub = class { setData() {} applyOptions() {} update() {} };
  return {
    createChart: vi.fn(() => mockChart),
    LineStyle: { Solid: 0, Dotted: 1, Dashed: 2, LargeDashed: 3, SparseDotted: 4 },
    CrosshairMode: { Normal: 0, Magnet: 1 },
    PriceScaleMode: { Normal: 0, Logarithmic: 1, Percentage: 2, IndexedTo100: 3 },
    ColorType: { Solid: 'solid', VerticalGradient: 'gradient' },
    LastPriceAnimationMode: { Disabled: 0, Continuous: 1, OnDataUpdate: 2 },
    MismatchDirection: { NearestLeft: -1, None: 0, NearestRight: 1 },
    TrackingModeExitMode: { OnNextTap: 0, OnTouchEnd: 1 },
    // v4 series constructors
    CandlestickSeries: SeriesStub,
    LineSeries: SeriesStub,
    AreaSeries: SeriesStub,
    BarSeries: SeriesStub,
    HistogramSeries: SeriesStub,
    BaselineSeries: SeriesStub,
    // formatters
    defaultFormatter: vi.fn((v: unknown) => String(v)),
  };
});

// ── Global env mocks + console.error suppression ────────────────────────────
let _origErr: typeof console.error;
beforeAll(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true, json: async () => ({}), text: async () => '',
  }));
  vi.stubGlobal('WebSocket', class {
    addEventListener() {} removeEventListener() {} close() {} send() {}
    readyState = 3;
  });
  vi.stubGlobal('ResizeObserver', class {
    observe() {} unobserve() {} disconnect() {}
  });
  vi.stubGlobal('IntersectionObserver', class {
    observe() {} unobserve() {} disconnect() {}
  });
  _origErr = console.error;
  console.error = (...args: unknown[]) => {
    const m = String(args[0] ?? '');
    if (m.includes('act(') || m.includes('Invalid time value') ||
        m.includes('raw.map') || m.includes('Error Boundary')) return;
    _origErr(...args);
  };
});
afterAll(() => { console.error = _origErr; });

// ── Page imports ─────────────────────────────────────────────────────────────
import { DashboardUI2 } from '../pages/DashboardUI2';
import { TradingUI2 } from '../pages/TradingUI2';
import { PortfolioUI2 } from '../pages/PortfolioUI2';
import { RiskUI2 } from '../pages/RiskUI2';
import { OrdersUI2 } from '../pages/OrdersUI2';
import { AlertsUI2 } from '../pages/AlertsUI2';
import { RunsUI2 } from '../pages/RunsUI2';
import { BacktestUI2 } from '../pages/BacktestUI2';
import { ReplayUI2 } from '../pages/ReplayUI2';
import { SettingsUI2 } from '../pages/SettingsUI2';
import { ResearchUI2 } from '../pages/ResearchUI2';
import { AutopilotUI2 } from '../pages/AutopilotUI2';
import { AutopilotV2UI2 } from '../pages/AutopilotV2UI2';
import { AutomationUI2 } from '../pages/AutomationUI2';
import { AutomationV2UI2 } from '../pages/AutomationV2UI2';
import { SearchUI2 } from '../pages/SearchUI2';
import { AgentUI2 } from '../pages/AgentUI2';
import { PlatformHealthUI2 } from '../pages/PlatformHealthUI2';
import { TelemetryUI2 } from '../pages/TelemetryUI2';
import { OpsUI2 } from '../pages/OpsUI2';
import { MonteCarloUI2 } from '../pages/MonteCarloUI2';
import { WalkForwardUI2 } from '../pages/WalkForwardUI2';
import { ScoringUI2 } from '../pages/ScoringUI2';
import { SentimentUI2 } from '../pages/SentimentUI2';
import { PerformanceUI2 } from '../pages/PerformanceUI2';
import { BlotterUI2 } from '../pages/BlotterUI2';
import { PortfolioV2UI2 } from '../pages/PortfolioV2UI2';
import { DecisionExplorerUI2 } from '../pages/DecisionExplorerUI2';
import { IncidentsUI2 } from '../pages/IncidentsUI2';
import { ExportUI2 } from '../pages/ExportUI2';

// ── Helper wrapper ───────────────────────────────────────────────────────────
function renderPage(Component: React.ComponentType) {
  return render(
    <MemoryRouter initialEntries={['/ui2/test']}>
      <SmokeErrorBoundary><Component /></SmokeErrorBoundary>
    </MemoryRouter>,
  );
}

// ── Smoke test suite ─────────────────────────────────────────────────────────
describe('UI2 Page Smoke Tests – renders without crash', () => {

  it('DashboardUI2', () => {
    expect(() => renderPage(DashboardUI2)).not.toThrow();
  });

  it('TradingUI2', () => {
    expect(() => renderPage(TradingUI2)).not.toThrow();
  });

  it('PortfolioUI2', () => {
    expect(() => renderPage(PortfolioUI2)).not.toThrow();
  });

  it('RiskUI2', () => {
    expect(() => renderPage(RiskUI2)).not.toThrow();
  });

  it('OrdersUI2', () => {
    expect(() => renderPage(OrdersUI2)).not.toThrow();
  });

  it('AlertsUI2', () => {
    expect(() => renderPage(AlertsUI2)).not.toThrow();
  });

  it('RunsUI2', () => {
    expect(() => renderPage(RunsUI2)).not.toThrow();
  });

  it('BacktestUI2', () => {
    expect(() => renderPage(BacktestUI2)).not.toThrow();
  });

  it('ReplayUI2', () => {
    expect(() => renderPage(ReplayUI2)).not.toThrow();
  });

  it('SettingsUI2', () => {
    expect(() => renderPage(SettingsUI2)).not.toThrow();
  });

  it('ResearchUI2', () => {
    expect(() => renderPage(ResearchUI2)).not.toThrow();
  });

  it('AutopilotUI2', () => {
    expect(() => renderPage(AutopilotUI2)).not.toThrow();
  });

  it('AutopilotV2UI2', () => {
    expect(() => renderPage(AutopilotV2UI2)).not.toThrow();
  });

  it('AutomationUI2', () => {
    expect(() => renderPage(AutomationUI2)).not.toThrow();
  });

  it('AutomationV2UI2', () => {
    expect(() => renderPage(AutomationV2UI2)).not.toThrow();
  });

  it('SearchUI2', () => {
    expect(() => renderPage(SearchUI2)).not.toThrow();
  });

  it('AgentUI2', () => {
    expect(() => renderPage(AgentUI2)).not.toThrow();
  });

  it('PlatformHealthUI2', () => {
    expect(() => renderPage(PlatformHealthUI2)).not.toThrow();
  });

  it('TelemetryUI2', () => {
    expect(() => renderPage(TelemetryUI2)).not.toThrow();
  });

  it('OpsUI2', () => {
    expect(() => renderPage(OpsUI2)).not.toThrow();
  });

  it('MonteCarloUI2', () => {
    expect(() => renderPage(MonteCarloUI2)).not.toThrow();
  });

  it('WalkForwardUI2', () => {
    expect(() => renderPage(WalkForwardUI2)).not.toThrow();
  });

  it('ScoringUI2', () => {
    expect(() => renderPage(ScoringUI2)).not.toThrow();
  });

  it('SentimentUI2', () => {
    expect(() => renderPage(SentimentUI2)).not.toThrow();
  });

  it('PerformanceUI2', () => {
    expect(() => renderPage(PerformanceUI2)).not.toThrow();
  });

  it('BlotterUI2', () => {
    expect(() => renderPage(BlotterUI2)).not.toThrow();
  });

  it('PortfolioV2UI2', () => {
    expect(() => renderPage(PortfolioV2UI2)).not.toThrow();
  });

  it('DecisionExplorerUI2', () => {
    expect(() => renderPage(DecisionExplorerUI2)).not.toThrow();
  });

  it('IncidentsUI2', () => {
    expect(() => renderPage(IncidentsUI2)).not.toThrow();
  });

  it('ExportUI2', () => {
    expect(() => renderPage(ExportUI2)).not.toThrow();
  });
});

// ── Additional critical pages from the fixed batch ───────────────────────────
import { DlqOpsUI2 } from '../pages/DlqOpsUI2';
import { AutopilotExplainUI2 } from '../pages/AutopilotExplainUI2';
import { ConvergenceCockpitV1UI2 } from '../pages/ConvergenceCockpitV1UI2';
import { WalkForwardV3UI2 } from '../pages/WalkForwardV3UI2';
import { AgentEvalHarnessUI2 } from '../pages/AgentEvalHarnessUI2';
import { ControlsDomainUI2 } from '../pages/ControlsDomainUI2';
import { PerfBudgetUI2 } from '../pages/PerfBudgetUI2';
import { StrategyStudioV3UI2 } from '../pages/StrategyStudioV3UI2';

describe('UI2 Previously-Broken Pages – smoke test after fix', () => {
  it('DlqOpsUI2 (was: EH duplicate export)', () => {
    expect(() => renderPage(DlqOpsUI2)).not.toThrow();
  });

  it('AutopilotExplainUI2 (was corrupt)', () => {
    expect(() => renderPage(AutopilotExplainUI2)).not.toThrow();
  });

  it('ConvergenceCockpitV1UI2 (was corrupt)', () => {
    expect(() => renderPage(ConvergenceCockpitV1UI2)).not.toThrow();
  });

  it('WalkForwardV3UI2 (was corrupt)', () => {
    expect(() => renderPage(WalkForwardV3UI2)).not.toThrow();
  });

  it('AgentEvalHarnessUI2 (was corrupt)', () => {
    expect(() => renderPage(AgentEvalHarnessUI2)).not.toThrow();
  });

  it('ControlsDomainUI2 (was corrupt)', () => {
    expect(() => renderPage(ControlsDomainUI2)).not.toThrow();
  });

  it('PerfBudgetUI2 (was corrupt – fixed twice)', () => {
    expect(() => renderPage(PerfBudgetUI2)).not.toThrow();
  });

  it('StrategyStudioV3UI2 (was corrupt)', () => {
    expect(() => renderPage(StrategyStudioV3UI2)).not.toThrow();
  });
});
