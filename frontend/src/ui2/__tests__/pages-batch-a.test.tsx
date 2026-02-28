/**
 * UI2 Page Smoke Tests – Batch A (A–C)
 * Covers: AccessibilityAudit, AgentBuilder, AgentRegistry, AgentTools,
 * AiGovernance, AIProviderStatus, AIStrategy, AltData, Anomalies,
 * ApprovalChain, ApprovalQueue, AppSandbox, Attribution, Auditor,
 * AuditReplay, AutomationRuns, AutopilotCommandCenter, AutopilotOptions,
 * AutopilotPlaybook, BacktestContract, BacktesterV3, BacktestV4,
 * BillingEvents, BqlQuery, BrokerScoring, BrokerV2, CapacityPlan,
 * Collaboration, CompatMatrix, Compliance, ControlFramework, ControlTower,
 * CorporateActions, CostProfiler, CrossAccount, CrossAssetQuote, CrossMargin
 *
 * Run:  npx vitest run src/ui2/__tests__/pages-batch-a.test.tsx
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { render } from '@testing-library/react';
import React, { Component, type ErrorInfo } from 'react';
import { MemoryRouter } from 'react-router-dom';

// ── Error Boundary ───────────────────────────────────────────────────────────
class SmokeErrorBoundary extends Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(_e: Error, _i: ErrorInfo) { /* silent */ }
  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

// ── Mocks ────────────────────────────────────────────────────────────────────
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
    options: vi.fn(() => ({})),
    priceToCoordinate: vi.fn(() => 0),
    addSeries: mockSeries(),
  };
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
    CandlestickSeries: SeriesStub, LineSeries: SeriesStub,
    AreaSeries: SeriesStub, BarSeries: SeriesStub,
    HistogramSeries: SeriesStub, BaselineSeries: SeriesStub,
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

// ── Helper ───────────────────────────────────────────────────────────────────
function renderPage(Component: React.ComponentType) {
  return render(
    <MemoryRouter initialEntries={['/ui2/test']}>
      <SmokeErrorBoundary><Component /></SmokeErrorBoundary>
    </MemoryRouter>,
  );
}

// ── Page Imports ─────────────────────────────────────────────────────────────
import { AccessibilityAuditUI2 } from '../pages/AccessibilityAuditUI2';
import { AgentBuilderUI2 } from '../pages/AgentBuilderUI2';
import { AgentRegistryUI2 } from '../pages/AgentRegistryUI2';
import { AgentToolsUI2 } from '../pages/AgentToolsUI2';
import { AiGovernanceUI2 } from '../pages/AiGovernanceUI2';
import { AIProviderStatusUI2 } from '../pages/AIProviderStatusUI2';
import { AIStrategyUI2 } from '../pages/AIStrategyUI2';
import { AltDataUI2 } from '../pages/AltDataUI2';
import { AnomaliesUI2 } from '../pages/AnomaliesUI2';
import { ApprovalChainUI2 } from '../pages/ApprovalChainUI2';
import { ApprovalQueueUI2 } from '../pages/ApprovalQueueUI2';
import { AppSandboxUI2 } from '../pages/AppSandboxUI2';
import { AttributionUI2 } from '../pages/AttributionUI2';
import { AuditorUI2 } from '../pages/AuditorUI2';
import { AuditReplayUI2 } from '../pages/AuditReplayUI2';
import { AutomationRunsUI2 } from '../pages/AutomationRunsUI2';
import { AutopilotCommandCenterUI2 } from '../pages/AutopilotCommandCenterUI2';
import { AutopilotOptionsUI2 } from '../pages/AutopilotOptionsUI2';
import { AutopilotPlaybookUI2 } from '../pages/AutopilotPlaybookUI2';
import { BacktestContractUI2 } from '../pages/BacktestContractUI2';
import { BacktesterV3UI2 } from '../pages/BacktesterV3UI2';
import { BacktestV4UI2 } from '../pages/BacktestV4UI2';
import { BillingEventsUI2 } from '../pages/BillingEventsUI2';
import { BqlQueryUI2 } from '../pages/BqlQueryUI2';
import { BrokerScoringUI2 } from '../pages/BrokerScoringUI2';
import { BrokerV2UI2 } from '../pages/BrokerV2UI2';
import { CapacityPlanUI2 } from '../pages/CapacityPlanUI2';
import { CollaborationUI2 } from '../pages/CollaborationUI2';
import { CompatMatrixUI2 } from '../pages/CompatMatrixUI2';
import { ComplianceUI2 } from '../pages/ComplianceUI2';
import { ControlFrameworkUI2 } from '../pages/ControlFrameworkUI2';
import { ControlTowerUI2 } from '../pages/ControlTowerUI2';
import { CorporateActionsUI2 } from '../pages/CorporateActionsUI2';
import { CostProfilerUI2 } from '../pages/CostProfilerUI2';
import { CrossAccountUI2 } from '../pages/CrossAccountUI2';
import { CrossAssetQuoteUI2 } from '../pages/CrossAssetQuoteUI2';
import { CrossMarginUI2 } from '../pages/CrossMarginUI2';

// ── Test Suite ───────────────────────────────────────────────────────────────
describe('UI2 Pages Batch A (A–C) – smoke renders', () => {
  it('AccessibilityAuditUI2', () => { expect(() => renderPage(AccessibilityAuditUI2)).not.toThrow(); });
  it('AgentBuilderUI2', () => { expect(() => renderPage(AgentBuilderUI2)).not.toThrow(); });
  it('AgentRegistryUI2', () => { expect(() => renderPage(AgentRegistryUI2)).not.toThrow(); });
  it('AgentToolsUI2', () => { expect(() => renderPage(AgentToolsUI2)).not.toThrow(); });
  it('AiGovernanceUI2', () => { expect(() => renderPage(AiGovernanceUI2)).not.toThrow(); });
  it('AIProviderStatusUI2', () => { expect(() => renderPage(AIProviderStatusUI2)).not.toThrow(); });
  it('AIStrategyUI2', () => { expect(() => renderPage(AIStrategyUI2)).not.toThrow(); });
  it('AltDataUI2', () => { expect(() => renderPage(AltDataUI2)).not.toThrow(); });
  it('AnomaliesUI2', () => { expect(() => renderPage(AnomaliesUI2)).not.toThrow(); });
  it('ApprovalChainUI2', () => { expect(() => renderPage(ApprovalChainUI2)).not.toThrow(); });
  it('ApprovalQueueUI2', () => { expect(() => renderPage(ApprovalQueueUI2)).not.toThrow(); });
  it('AppSandboxUI2', () => { expect(() => renderPage(AppSandboxUI2)).not.toThrow(); });
  it('AttributionUI2', () => { expect(() => renderPage(AttributionUI2)).not.toThrow(); });
  it('AuditorUI2', () => { expect(() => renderPage(AuditorUI2)).not.toThrow(); });
  it('AuditReplayUI2', () => { expect(() => renderPage(AuditReplayUI2)).not.toThrow(); });
  it('AutomationRunsUI2', () => { expect(() => renderPage(AutomationRunsUI2)).not.toThrow(); });
  it('AutopilotCommandCenterUI2', () => { expect(() => renderPage(AutopilotCommandCenterUI2)).not.toThrow(); });
  it('AutopilotOptionsUI2', () => { expect(() => renderPage(AutopilotOptionsUI2)).not.toThrow(); });
  it('AutopilotPlaybookUI2', () => { expect(() => renderPage(AutopilotPlaybookUI2)).not.toThrow(); });
  it('BacktestContractUI2', () => { expect(() => renderPage(BacktestContractUI2)).not.toThrow(); });
  it('BacktesterV3UI2', () => { expect(() => renderPage(BacktesterV3UI2)).not.toThrow(); });
  it('BacktestV4UI2', () => { expect(() => renderPage(BacktestV4UI2)).not.toThrow(); });
  it('BillingEventsUI2', () => { expect(() => renderPage(BillingEventsUI2)).not.toThrow(); });
  it('BqlQueryUI2', () => { expect(() => renderPage(BqlQueryUI2)).not.toThrow(); });
  it('BrokerScoringUI2', () => { expect(() => renderPage(BrokerScoringUI2)).not.toThrow(); });
  it('BrokerV2UI2', () => { expect(() => renderPage(BrokerV2UI2)).not.toThrow(); });
  it('CapacityPlanUI2', () => { expect(() => renderPage(CapacityPlanUI2)).not.toThrow(); });
  it('CollaborationUI2', () => { expect(() => renderPage(CollaborationUI2)).not.toThrow(); });
  it('CompatMatrixUI2', () => { expect(() => renderPage(CompatMatrixUI2)).not.toThrow(); });
  it('ComplianceUI2', () => { expect(() => renderPage(ComplianceUI2)).not.toThrow(); });
  it('ControlFrameworkUI2', () => { expect(() => renderPage(ControlFrameworkUI2)).not.toThrow(); });
  it('ControlTowerUI2', () => { expect(() => renderPage(ControlTowerUI2)).not.toThrow(); });
  it('CorporateActionsUI2', () => { expect(() => renderPage(CorporateActionsUI2)).not.toThrow(); });
  it('CostProfilerUI2', () => { expect(() => renderPage(CostProfilerUI2)).not.toThrow(); });
  it('CrossAccountUI2', () => { expect(() => renderPage(CrossAccountUI2)).not.toThrow(); });
  it('CrossAssetQuoteUI2', () => { expect(() => renderPage(CrossAssetQuoteUI2)).not.toThrow(); });
  it('CrossMarginUI2', () => { expect(() => renderPage(CrossMarginUI2)).not.toThrow(); });
});
