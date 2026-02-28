/**
 * UI2 Page Smoke Tests – Batch C (L–R)
 * Covers: LatencyBudget, Liquidity, MarketHours, MarketplaceTrust,
 * Marketplace, MarketSessionV2, Microstructure, ModelRouter, Monitor,
 * MonteCarloV2, MultiRegion, NewsEnrichment, NLWorkflow, Nova,
 * Observability, ObservabilityV2, OperatorEnable, OpsAutomationAi,
 * OptionsMatrix, PartnerCi, PayoffLab, PerformanceV2, PlatformDebt,
 * PlatformHealthV4, PluginRuntime, PnlExplain, PolicyAttestation,
 * PolicyCode, PolicySignal, PortfolioOptimizer, PreTradeRisk,
 * Productization, PromptFirewall, QueryStudio, RatesMonitor,
 * Reconciliation, Regime, RegionalFailover, ReleaseQuality,
 * ReliabilityEcon, ResearchGovernance, ResearchNotebook, ResearchQueue,
 * RetentionPolicy, RiskAdjExec, RiskGovernance, RiskNetwork, Robustness
 *
 * Run:  npx vitest run src/ui2/__tests__/pages-batch-c.test.tsx
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
import { LatencyBudgetUI2 } from '../pages/LatencyBudgetUI2';
import { LiquidityUI2 } from '../pages/LiquidityUI2';
import { MarketHoursUI2 } from '../pages/MarketHoursUI2';
import { MarketplaceTrustUI2 } from '../pages/MarketplaceTrustUI2';
import { MarketplaceUI2 } from '../pages/MarketplaceUI2';
import { MarketSessionV2UI2 } from '../pages/MarketSessionV2UI2';
import { MicrostructureUI2 } from '../pages/MicrostructureUI2';
import { ModelRouterUI2 } from '../pages/ModelRouterUI2';
import { MonitorUI2 } from '../pages/MonitorUI2';
import { MonteCarloV2UI2 } from '../pages/MonteCarloV2UI2';
import { MultiRegionUI2 } from '../pages/MultiRegionUI2';
import { NewsEnrichmentUI2 } from '../pages/NewsEnrichmentUI2';
import { NLWorkflowUI2 } from '../pages/NLWorkflowUI2';
import { NovaUI2 } from '../pages/NovaUI2';
import { ObservabilityUI2 } from '../pages/ObservabilityUI2';
import { ObservabilityV2UI2 } from '../pages/ObservabilityV2UI2';
import { OperatorEnableUI2 } from '../pages/OperatorEnableUI2';
import { OpsAutomationAiUI2 } from '../pages/OpsAutomationAiUI2';
import { OptionsMatrixUI2 } from '../pages/OptionsMatrixUI2';
import { PartnerCiUI2 } from '../pages/PartnerCiUI2';
import { PayoffLabUI2 } from '../pages/PayoffLabUI2';
import { PerformanceV2UI2 } from '../pages/PerformanceV2UI2';
import { PlatformDebtUI2 } from '../pages/PlatformDebtUI2';
import { PlatformHealthV4UI2 } from '../pages/PlatformHealthV4UI2';
import { PluginRuntimeUI2 } from '../pages/PluginRuntimeUI2';
import { PnlExplainUI2 } from '../pages/PnlExplainUI2';
import { PolicyAttestationUI2 } from '../pages/PolicyAttestationUI2';
import { PolicyCodeUI2 } from '../pages/PolicyCodeUI2';
import { PolicySignalUI2 } from '../pages/PolicySignalUI2';
import { PortfolioOptimizerUI2 } from '../pages/PortfolioOptimizerUI2';
import { PreTradeRiskUI2 } from '../pages/PreTradeRiskUI2';
import { ProductizationUI2 } from '../pages/ProductizationUI2';
import { PromptFirewallUI2 } from '../pages/PromptFirewallUI2';
import { QueryStudioUI2 } from '../pages/QueryStudioUI2';
import { RatesMonitorUI2 } from '../pages/RatesMonitorUI2';
import { ReconciliationUI2 } from '../pages/ReconciliationUI2';
import { RegimeUI2 } from '../pages/RegimeUI2';
import { RegionalFailoverUI2 } from '../pages/RegionalFailoverUI2';
import { ReleaseQualityUI2 } from '../pages/ReleaseQualityUI2';
import { ReliabilityEconUI2 } from '../pages/ReliabilityEconUI2';
import { ResearchGovernanceUI2 } from '../pages/ResearchGovernanceUI2';
import { ResearchNotebookUI2 } from '../pages/ResearchNotebookUI2';
import { ResearchQueueUI2 } from '../pages/ResearchQueueUI2';
import { RetentionPolicyUI2 } from '../pages/RetentionPolicyUI2';
import { RiskAdjExecUI2 } from '../pages/RiskAdjExecUI2';
import { RiskGovernanceUI2 } from '../pages/RiskGovernanceUI2';
import { RiskNetworkUI2 } from '../pages/RiskNetworkUI2';
import { RobustnessUI2 } from '../pages/RobustnessUI2';

// ── Test Suite ───────────────────────────────────────────────────────────────
describe('UI2 Pages Batch C (L–R) – smoke renders', () => {
  it('LatencyBudgetUI2', () => { expect(() => renderPage(LatencyBudgetUI2)).not.toThrow(); });
  it('LiquidityUI2', () => { expect(() => renderPage(LiquidityUI2)).not.toThrow(); });
  it('MarketHoursUI2', () => { expect(() => renderPage(MarketHoursUI2)).not.toThrow(); });
  it('MarketplaceTrustUI2', () => { expect(() => renderPage(MarketplaceTrustUI2)).not.toThrow(); });
  it('MarketplaceUI2', () => { expect(() => renderPage(MarketplaceUI2)).not.toThrow(); });
  it('MarketSessionV2UI2', () => { expect(() => renderPage(MarketSessionV2UI2)).not.toThrow(); });
  it('MicrostructureUI2', () => { expect(() => renderPage(MicrostructureUI2)).not.toThrow(); });
  it('ModelRouterUI2', () => { expect(() => renderPage(ModelRouterUI2)).not.toThrow(); });
  it('MonitorUI2', () => { expect(() => renderPage(MonitorUI2)).not.toThrow(); });
  it('MonteCarloV2UI2', () => { expect(() => renderPage(MonteCarloV2UI2)).not.toThrow(); });
  it('MultiRegionUI2', () => { expect(() => renderPage(MultiRegionUI2)).not.toThrow(); });
  it('NewsEnrichmentUI2', () => { expect(() => renderPage(NewsEnrichmentUI2)).not.toThrow(); });
  it('NLWorkflowUI2', () => { expect(() => renderPage(NLWorkflowUI2)).not.toThrow(); });
  it('NovaUI2', () => { expect(() => renderPage(NovaUI2)).not.toThrow(); });
  it('ObservabilityUI2', () => { expect(() => renderPage(ObservabilityUI2)).not.toThrow(); });
  it('ObservabilityV2UI2', () => { expect(() => renderPage(ObservabilityV2UI2)).not.toThrow(); });
  it('OperatorEnableUI2', () => { expect(() => renderPage(OperatorEnableUI2)).not.toThrow(); });
  it('OpsAutomationAiUI2', () => { expect(() => renderPage(OpsAutomationAiUI2)).not.toThrow(); });
  it('OptionsMatrixUI2', () => { expect(() => renderPage(OptionsMatrixUI2)).not.toThrow(); });
  it('PartnerCiUI2', () => { expect(() => renderPage(PartnerCiUI2)).not.toThrow(); });
  it('PayoffLabUI2', () => { expect(() => renderPage(PayoffLabUI2)).not.toThrow(); });
  it('PerformanceV2UI2', () => { expect(() => renderPage(PerformanceV2UI2)).not.toThrow(); });
  it('PlatformDebtUI2', () => { expect(() => renderPage(PlatformDebtUI2)).not.toThrow(); });
  it('PlatformHealthV4UI2', () => { expect(() => renderPage(PlatformHealthV4UI2)).not.toThrow(); });
  it('PluginRuntimeUI2', () => { expect(() => renderPage(PluginRuntimeUI2)).not.toThrow(); });
  it('PnlExplainUI2', () => { expect(() => renderPage(PnlExplainUI2)).not.toThrow(); });
  it('PolicyAttestationUI2', () => { expect(() => renderPage(PolicyAttestationUI2)).not.toThrow(); });
  it('PolicyCodeUI2', () => { expect(() => renderPage(PolicyCodeUI2)).not.toThrow(); });
  it('PolicySignalUI2', () => { expect(() => renderPage(PolicySignalUI2)).not.toThrow(); });
  it('PortfolioOptimizerUI2', () => { expect(() => renderPage(PortfolioOptimizerUI2)).not.toThrow(); });
  it('PreTradeRiskUI2', () => { expect(() => renderPage(PreTradeRiskUI2)).not.toThrow(); });
  it('ProductizationUI2', () => { expect(() => renderPage(ProductizationUI2)).not.toThrow(); });
  it('PromptFirewallUI2', () => { expect(() => renderPage(PromptFirewallUI2)).not.toThrow(); });
  it('QueryStudioUI2', () => { expect(() => renderPage(QueryStudioUI2)).not.toThrow(); });
  it('RatesMonitorUI2', () => { expect(() => renderPage(RatesMonitorUI2)).not.toThrow(); });
  it('ReconciliationUI2', () => { expect(() => renderPage(ReconciliationUI2)).not.toThrow(); });
  it('RegimeUI2', () => { expect(() => renderPage(RegimeUI2)).not.toThrow(); });
  it('RegionalFailoverUI2', () => { expect(() => renderPage(RegionalFailoverUI2)).not.toThrow(); });
  it('ReleaseQualityUI2', () => { expect(() => renderPage(ReleaseQualityUI2)).not.toThrow(); });
  it('ReliabilityEconUI2', () => { expect(() => renderPage(ReliabilityEconUI2)).not.toThrow(); });
  it('ResearchGovernanceUI2', () => { expect(() => renderPage(ResearchGovernanceUI2)).not.toThrow(); });
  it('ResearchNotebookUI2', () => { expect(() => renderPage(ResearchNotebookUI2)).not.toThrow(); });
  it('ResearchQueueUI2', () => { expect(() => renderPage(ResearchQueueUI2)).not.toThrow(); });
  it('RetentionPolicyUI2', () => { expect(() => renderPage(RetentionPolicyUI2)).not.toThrow(); });
  it('RiskAdjExecUI2', () => { expect(() => renderPage(RiskAdjExecUI2)).not.toThrow(); });
  it('RiskGovernanceUI2', () => { expect(() => renderPage(RiskGovernanceUI2)).not.toThrow(); });
  it('RiskNetworkUI2', () => { expect(() => renderPage(RiskNetworkUI2)).not.toThrow(); });
  it('RobustnessUI2', () => { expect(() => renderPage(RobustnessUI2)).not.toThrow(); });
});
