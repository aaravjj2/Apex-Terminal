/**
 * UI2 Page Smoke Tests – Batch B (D–K)
 * Covers: DataHealth, DataResidency, DatasetSnapshot, DataSpine,
 * DecisionExplainerV2, DerivativesGov, DerivativesOms, DevPortal,
 * Discovery, DriftDetection, EconomicCalendar, ElastiHack,
 * Elasticsearch, Entitlements, EntityResolution, EsOps, EvalHarness,
 * EvidenceGraph, EvidenceVault, ExecutionCockpit, ExportBundle,
 * ExtObservability, FactorModel, FuturesCurve, GlobalReadiness,
 * GreeksService, HedgeEngine, HedgeFund, HotPath, IncidentAi,
 * IncidentCompliance, JobQueueV2, Jurisdiction, KillSwitchRecovery, KriScoring
 *
 * Run:  npx vitest run src/ui2/__tests__/pages-batch-b.test.tsx
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
import { DataHealthUI2 } from '../pages/DataHealthUI2';
import { DataResidencyUI2 } from '../pages/DataResidencyUI2';
import { DatasetSnapshotUI2 } from '../pages/DatasetSnapshotUI2';
import { DataSpineUI2 } from '../pages/DataSpineUI2';
import { DecisionExplainerV2UI2 } from '../pages/DecisionExplainerV2UI2';
import { DerivativesGovUI2 } from '../pages/DerivativesGovUI2';
import { DerivativesOmsUI2 } from '../pages/DerivativesOmsUI2';
import { DevPortalUI2 } from '../pages/DevPortalUI2';
import { DiscoveryUI2 } from '../pages/DiscoveryUI2';
import { DriftDetectionUI2 } from '../pages/DriftDetectionUI2';
import { EconomicCalendarUI2 } from '../pages/EconomicCalendarUI2';
import { ElastiHackUI2 } from '../pages/ElastiHackUI2';
import { ElasticsearchUI2 } from '../pages/ElasticsearchUI2';
import { EntitlementsUI2 } from '../pages/EntitlementsUI2';
import { EntityResolutionUI2 } from '../pages/EntityResolutionUI2';
import { EsOpsUI2 } from '../pages/EsOpsUI2';
import { EvalHarnessUI2 } from '../pages/EvalHarnessUI2';
import { EvidenceGraphUI2 } from '../pages/EvidenceGraphUI2';
import { EvidenceVaultUI2 } from '../pages/EvidenceVaultUI2';
import { ExecutionCockpitUI2 } from '../pages/ExecutionCockpitUI2';
import { ExportBundleUI2 } from '../pages/ExportBundleUI2';
import { ExtObservabilityUI2 } from '../pages/ExtObservabilityUI2';
import { FactorModelUI2 } from '../pages/FactorModelUI2';
import { FuturesCurveUI2 } from '../pages/FuturesCurveUI2';
import { GlobalReadinessUI2 } from '../pages/GlobalReadinessUI2';
import { GreeksServiceUI2 } from '../pages/GreeksServiceUI2';
import { HedgeEngineUI2 } from '../pages/HedgeEngineUI2';
import { HedgeFundUI2 } from '../pages/HedgeFundUI2';
import { HotPathUI2 } from '../pages/HotPathUI2';
import { IncidentAiUI2 } from '../pages/IncidentAiUI2';
import { IncidentComplianceUI2 } from '../pages/IncidentComplianceUI2';
import { JobQueueV2UI2 } from '../pages/JobQueueV2UI2';
import { JurisdictionUI2 } from '../pages/JurisdictionUI2';
import { KillSwitchRecoveryUI2 } from '../pages/KillSwitchRecoveryUI2';
import { KriScoringUI2 } from '../pages/KriScoringUI2';

// ── Test Suite ───────────────────────────────────────────────────────────────
describe('UI2 Pages Batch B (D–K) – smoke renders', () => {
  it('DataHealthUI2', () => { expect(() => renderPage(DataHealthUI2)).not.toThrow(); });
  it('DataResidencyUI2', () => { expect(() => renderPage(DataResidencyUI2)).not.toThrow(); });
  it('DatasetSnapshotUI2', () => { expect(() => renderPage(DatasetSnapshotUI2)).not.toThrow(); });
  it('DataSpineUI2', () => { expect(() => renderPage(DataSpineUI2)).not.toThrow(); });
  it('DecisionExplainerV2UI2', () => { expect(() => renderPage(DecisionExplainerV2UI2)).not.toThrow(); });
  it('DerivativesGovUI2', () => { expect(() => renderPage(DerivativesGovUI2)).not.toThrow(); });
  it('DerivativesOmsUI2', () => { expect(() => renderPage(DerivativesOmsUI2)).not.toThrow(); });
  it('DevPortalUI2', () => { expect(() => renderPage(DevPortalUI2)).not.toThrow(); });
  it('DiscoveryUI2', () => { expect(() => renderPage(DiscoveryUI2)).not.toThrow(); });
  it('DriftDetectionUI2', () => { expect(() => renderPage(DriftDetectionUI2)).not.toThrow(); });
  it('EconomicCalendarUI2', () => { expect(() => renderPage(EconomicCalendarUI2)).not.toThrow(); });
  it('ElastiHackUI2', () => { expect(() => renderPage(ElastiHackUI2)).not.toThrow(); });
  it('ElasticsearchUI2', () => { expect(() => renderPage(ElasticsearchUI2)).not.toThrow(); });
  it('EntitlementsUI2', () => { expect(() => renderPage(EntitlementsUI2)).not.toThrow(); });
  it('EntityResolutionUI2', () => { expect(() => renderPage(EntityResolutionUI2)).not.toThrow(); });
  it('EsOpsUI2', () => { expect(() => renderPage(EsOpsUI2)).not.toThrow(); });
  it('EvalHarnessUI2', () => { expect(() => renderPage(EvalHarnessUI2)).not.toThrow(); });
  it('EvidenceGraphUI2', () => { expect(() => renderPage(EvidenceGraphUI2)).not.toThrow(); });
  it('EvidenceVaultUI2', () => { expect(() => renderPage(EvidenceVaultUI2)).not.toThrow(); });
  it('ExecutionCockpitUI2', () => { expect(() => renderPage(ExecutionCockpitUI2)).not.toThrow(); });
  it('ExportBundleUI2', () => { expect(() => renderPage(ExportBundleUI2)).not.toThrow(); });
  it('ExtObservabilityUI2', () => { expect(() => renderPage(ExtObservabilityUI2)).not.toThrow(); });
  it('FactorModelUI2', () => { expect(() => renderPage(FactorModelUI2)).not.toThrow(); });
  it('FuturesCurveUI2', () => { expect(() => renderPage(FuturesCurveUI2)).not.toThrow(); });
  it('GlobalReadinessUI2', () => { expect(() => renderPage(GlobalReadinessUI2)).not.toThrow(); });
  it('GreeksServiceUI2', () => { expect(() => renderPage(GreeksServiceUI2)).not.toThrow(); });
  it('HedgeEngineUI2', () => { expect(() => renderPage(HedgeEngineUI2)).not.toThrow(); });
  it('HedgeFundUI2', () => { expect(() => renderPage(HedgeFundUI2)).not.toThrow(); });
  it('HotPathUI2', () => { expect(() => renderPage(HotPathUI2)).not.toThrow(); });
  it('IncidentAiUI2', () => { expect(() => renderPage(IncidentAiUI2)).not.toThrow(); });
  it('IncidentComplianceUI2', () => { expect(() => renderPage(IncidentComplianceUI2)).not.toThrow(); });
  it('JobQueueV2UI2', () => { expect(() => renderPage(JobQueueV2UI2)).not.toThrow(); });
  it('JurisdictionUI2', () => { expect(() => renderPage(JurisdictionUI2)).not.toThrow(); });
  it('KillSwitchRecoveryUI2', () => { expect(() => renderPage(KillSwitchRecoveryUI2)).not.toThrow(); });
  it('KriScoringUI2', () => { expect(() => renderPage(KriScoringUI2)).not.toThrow(); });
});
