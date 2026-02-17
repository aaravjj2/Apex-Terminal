/**
 * UI2 Routes Configuration
 * React Router routes for UI v2 — full feature parity with UI1
 */
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppShellUI2 } from './AppShellUI2';
import {
  DashboardUI2,
  TradingUI2,
  ResearchUI2,
  RiskUI2,
  PortfolioUI2,
  OpsUI2,
  AutopilotUI2,
  OrdersUI2,
  AlertsUI2,
  RunsUI2,
  BacktestUI2,
  ReplayUI2,
  SettingsUI2,
  AutomationUI2,
  SearchUI2,
  AgentUI2,
  AutopilotV2UI2,
  AutomationV2UI2,
  ExportUI2,
  PlatformHealthUI2,
  TelemetryUI2,
  AutopilotExplainUI2,
  AutomationRunsUI2,
  WorkflowBuilderUI2,
  IncidentsUI2,
  DecisionExplorerUI2,
  PlatformHealthV4UI2,
  AIProviderStatusUI2,
  DecisionExplainerV2UI2,
  NLWorkflowUI2,
} from './pages';

export function UI2Routes() {
  return (
    <Routes>
      <Route path="/" element={<AppShellUI2 />}>
        <Route index element={<Navigate to="/ui2/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardUI2 />} />
        <Route path="trading" element={<TradingUI2 />} />
        <Route path="research" element={<ResearchUI2 />} />
        <Route path="risk" element={<RiskUI2 />} />
        <Route path="portfolio" element={<PortfolioUI2 />} />
        <Route path="orders" element={<OrdersUI2 />} />
        <Route path="backtest" element={<BacktestUI2 />} />
        <Route path="autopilot" element={<AutopilotUI2 />} />
        <Route path="alerts" element={<AlertsUI2 />} />
        <Route path="runs" element={<RunsUI2 />} />
        <Route path="replay" element={<ReplayUI2 />} />
        <Route path="ops" element={<OpsUI2 />} />
        <Route path="settings" element={<SettingsUI2 />} />
        <Route path="automation" element={<AutomationUI2 />} />
        <Route path="search" element={<SearchUI2 />} />
        <Route path="agent" element={<AgentUI2 />} />
        <Route path="autopilot-v2" element={<AutopilotV2UI2 />} />
        <Route path="automation-v2" element={<AutomationV2UI2 />} />
        <Route path="export" element={<ExportUI2 />} />
        <Route path="health" element={<PlatformHealthUI2 />} />
        <Route path="telemetry" element={<TelemetryUI2 />} />
        <Route path="autopilot-explain" element={<AutopilotExplainUI2 />} />
        {/* Wave 13-14 */}
        <Route path="automation-runs" element={<AutomationRunsUI2 />} />
        <Route path="workflow-builder" element={<WorkflowBuilderUI2 />} />
        <Route path="incidents" element={<IncidentsUI2 />} />
        <Route path="decisions" element={<DecisionExplorerUI2 />} />
        <Route path="health-v4" element={<PlatformHealthV4UI2 />} />
        {/* Wave 17-18 */}
        <Route path="ai-provider" element={<AIProviderStatusUI2 />} />
        <Route path="decision-explainer" element={<DecisionExplainerV2UI2 />} />
        <Route path="nl-workflow" element={<NLWorkflowUI2 />} />
      </Route>
    </Routes>
  );
}
