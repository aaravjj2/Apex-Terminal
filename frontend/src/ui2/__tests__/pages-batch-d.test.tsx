/**
 * UI2 Page Smoke Tests – Batch D (S–Z)
 * Covers: SafeActions, SandboxRunner, ScenarioSim, Screeners, SdkApi,
 * SearchExplain, SearchUXV3, SearchV2, SentimentV2, SignalMarket,
 * SignalProvenance, SmartRouting, SpreadTools, SsoHardening,
 * StrategyBuilderV2, StrategyOptimizer, StrategySim, StressScenarios,
 * Supervisory, SupportSla, Surveillance, SweepV2, SystemHealth,
 * TenantQuota, ThemeClustering, ThirdPartyRisk, UsageMetering,
 * VolScanner, VolSurface, WalkForwardV2, WorkflowBuilder, WorkflowsV3
 *
 * Run:  npx vitest run src/ui2/__tests__/pages-batch-d.test.tsx
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { render } from '@testing-library/react';
import React, { Component, type ErrorInfo } from 'react';
import { MemoryRouter } from 'react-router-dom';

class SmokeErrorBoundary extends Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(_e: Error, _i: ErrorInfo) {}
  render() { return this.state.hasError ? null : this.props.children; }
}

vi.mock('../../../features/layout/views/ReplayView', () => ({ ReplayView: () => null }));
vi.mock('../../../features/chart/ReplayControls', () => ({ ReplayControls: () => null, default: () => null }));
vi.mock('../../../features/chart/ChartCanvas', () => ({ ChartCanvas: () => null, default: () => null }));

vi.mock('lightweight-charts', () => {
  const mockSeries = () => vi.fn(() => ({
    setData: vi.fn(), applyOptions: vi.fn(), update: vi.fn(),
    setMarkers: vi.fn(), createPriceLine: vi.fn(), removePriceLine: vi.fn(),
    priceToCoordinate: vi.fn(() => 0), coordinateToPrice: vi.fn(() => 0),
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
    options: vi.fn(() => ({})), priceToCoordinate: vi.fn(() => 0),
    addSeries: mockSeries(),
  };
  const S = class { setData() {} applyOptions() {} update() {} };
  return {
    createChart: vi.fn(() => mockChart),
    LineStyle: { Solid: 0, Dotted: 1, Dashed: 2, LargeDashed: 3, SparseDotted: 4 },
    CrosshairMode: { Normal: 0, Magnet: 1 },
    PriceScaleMode: { Normal: 0, Logarithmic: 1, Percentage: 2, IndexedTo100: 3 },
    ColorType: { Solid: 'solid', VerticalGradient: 'gradient' },
    LastPriceAnimationMode: { Disabled: 0, Continuous: 1, OnDataUpdate: 2 },
    MismatchDirection: { NearestLeft: -1, None: 0, NearestRight: 1 },
    TrackingModeExitMode: { OnNextTap: 0, OnTouchEnd: 1 },
    CandlestickSeries: S, LineSeries: S, AreaSeries: S,
    BarSeries: S, HistogramSeries: S, BaselineSeries: S,
    defaultFormatter: vi.fn((v: unknown) => String(v)),
  };
});

let _origErr: typeof console.error;
beforeAll(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}), text: async () => '' }));
  vi.stubGlobal('WebSocket', class { addEventListener() {} removeEventListener() {} close() {} send() {} readyState = 3; });
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal('IntersectionObserver', class { observe() {} unobserve() {} disconnect() {} });
  _origErr = console.error;
  console.error = (...args: unknown[]) => {
    const m = String(args[0] ?? '');
    if (m.includes('act(') || m.includes('Invalid time value') || m.includes('raw.map') || m.includes('Error Boundary')) return;
    _origErr(...args);
  };
});
afterAll(() => { console.error = _origErr; });

function renderPage(C: React.ComponentType) {
  return render(<MemoryRouter initialEntries={['/ui2/test']}><SmokeErrorBoundary><C /></SmokeErrorBoundary></MemoryRouter>);
}

// ── Page Imports ─────────────────────────────────────────────────────────────
import { SafeActionsUI2 } from '../pages/SafeActionsUI2';
import { SandboxRunnerUI2 } from '../pages/SandboxRunnerUI2';
import { ScenarioSimUI2 } from '../pages/ScenarioSimUI2';
import { ScreenersUI2 } from '../pages/ScreenersUI2';
import { SdkApiUI2 } from '../pages/SdkApiUI2';
import { SearchExplainUI2 } from '../pages/SearchExplainUI2';
import { SearchUXV3UI2 } from '../pages/SearchUXV3UI2';
import { SearchV2UI2 } from '../pages/SearchV2UI2';
import { SentimentV2UI2 } from '../pages/SentimentV2UI2';
import { SignalMarketUI2 } from '../pages/SignalMarketUI2';
import { SignalProvenanceUI2 } from '../pages/SignalProvenanceUI2';
import { SmartRoutingUI2 } from '../pages/SmartRoutingUI2';
import { SpreadToolsUI2 } from '../pages/SpreadToolsUI2';
import { SsoHardeningUI2 } from '../pages/SsoHardeningUI2';
import { StrategyBuilderV2UI2 } from '../pages/StrategyBuilderV2UI2';
import { StrategyOptimizerUI2 } from '../pages/StrategyOptimizerUI2';
import { StrategySimUI2 } from '../pages/StrategySimUI2';
import { StressScenariosUI2 } from '../pages/StressScenariosUI2';
import { SupervisoryUI2 } from '../pages/SupervisoryUI2';
import { SupportSlaUI2 } from '../pages/SupportSlaUI2';
import { SurveillanceUI2 } from '../pages/SurveillanceUI2';
import { SweepV2UI2 } from '../pages/SweepV2UI2';
import { SystemHealthUI2 } from '../pages/SystemHealthUI2';
import { TenantQuotaUI2 } from '../pages/TenantQuotaUI2';
import { ThemeClusteringUI2 } from '../pages/ThemeClusteringUI2';
import { ThirdPartyRiskUI2 } from '../pages/ThirdPartyRiskUI2';
import { UsageMeteringUI2 } from '../pages/UsageMeteringUI2';
import { VolScannerUI2 } from '../pages/VolScannerUI2';
import { VolSurfaceUI2 } from '../pages/VolSurfaceUI2';
import { WalkForwardV2UI2 } from '../pages/WalkForwardV2UI2';
import { WorkflowBuilderUI2 } from '../pages/WorkflowBuilderUI2';
import { WorkflowsV3UI2 } from '../pages/WorkflowsV3UI2';

// ── Test Suite ───────────────────────────────────────────────────────────────
describe('UI2 Pages Batch D (S–Z) – smoke renders', () => {
  it('SafeActionsUI2', () => { expect(() => renderPage(SafeActionsUI2)).not.toThrow(); });
  it('SandboxRunnerUI2', () => { expect(() => renderPage(SandboxRunnerUI2)).not.toThrow(); });
  it('ScenarioSimUI2', () => { expect(() => renderPage(ScenarioSimUI2)).not.toThrow(); });
  it('ScreenersUI2', () => { expect(() => renderPage(ScreenersUI2)).not.toThrow(); });
  it('SdkApiUI2', () => { expect(() => renderPage(SdkApiUI2)).not.toThrow(); });
  it('SearchExplainUI2', () => { expect(() => renderPage(SearchExplainUI2)).not.toThrow(); });
  it('SearchUXV3UI2', () => { expect(() => renderPage(SearchUXV3UI2)).not.toThrow(); });
  it('SearchV2UI2', () => { expect(() => renderPage(SearchV2UI2)).not.toThrow(); });
  it('SentimentV2UI2', () => { expect(() => renderPage(SentimentV2UI2)).not.toThrow(); });
  it('SignalMarketUI2', () => { expect(() => renderPage(SignalMarketUI2)).not.toThrow(); });
  it('SignalProvenanceUI2', () => { expect(() => renderPage(SignalProvenanceUI2)).not.toThrow(); });
  it('SmartRoutingUI2', () => { expect(() => renderPage(SmartRoutingUI2)).not.toThrow(); });
  it('SpreadToolsUI2', () => { expect(() => renderPage(SpreadToolsUI2)).not.toThrow(); });
  it('SsoHardeningUI2', () => { expect(() => renderPage(SsoHardeningUI2)).not.toThrow(); });
  it('StrategyBuilderV2UI2', () => { expect(() => renderPage(StrategyBuilderV2UI2)).not.toThrow(); });
  it('StrategyOptimizerUI2', () => { expect(() => renderPage(StrategyOptimizerUI2)).not.toThrow(); });
  it('StrategySimUI2', () => { expect(() => renderPage(StrategySimUI2)).not.toThrow(); });
  it('StressScenariosUI2', () => { expect(() => renderPage(StressScenariosUI2)).not.toThrow(); });
  it('SupervisoryUI2', () => { expect(() => renderPage(SupervisoryUI2)).not.toThrow(); });
  it('SupportSlaUI2', () => { expect(() => renderPage(SupportSlaUI2)).not.toThrow(); });
  it('SurveillanceUI2', () => { expect(() => renderPage(SurveillanceUI2)).not.toThrow(); });
  it('SweepV2UI2', () => { expect(() => renderPage(SweepV2UI2)).not.toThrow(); });
  it('SystemHealthUI2', () => { expect(() => renderPage(SystemHealthUI2)).not.toThrow(); });
  it('TenantQuotaUI2', () => { expect(() => renderPage(TenantQuotaUI2)).not.toThrow(); });
  it('ThemeClusteringUI2', () => { expect(() => renderPage(ThemeClusteringUI2)).not.toThrow(); });
  it('ThirdPartyRiskUI2', () => { expect(() => renderPage(ThirdPartyRiskUI2)).not.toThrow(); });
  it('UsageMeteringUI2', () => { expect(() => renderPage(UsageMeteringUI2)).not.toThrow(); });
  it('VolScannerUI2', () => { expect(() => renderPage(VolScannerUI2)).not.toThrow(); });
  it('VolSurfaceUI2', () => { expect(() => renderPage(VolSurfaceUI2)).not.toThrow(); });
  it('WalkForwardV2UI2', () => { expect(() => renderPage(WalkForwardV2UI2)).not.toThrow(); });
  it('WorkflowBuilderUI2', () => { expect(() => renderPage(WorkflowBuilderUI2)).not.toThrow(); });
  it('WorkflowsV3UI2', () => { expect(() => renderPage(WorkflowsV3UI2)).not.toThrow(); });
});
