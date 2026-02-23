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
  MonteCarloUI2,
  WalkForwardUI2,
  ScoringUI2,
  SentimentUI2,
  RegimeUI2,
  ElasticsearchUI2,
  NovaUI2,
  MarketHoursUI2,
  KillSwitchRecoveryUI2,
  SystemHealthUI2,
  ObservabilityUI2,
  ComplianceUI2,
  PerformanceUI2,
  StrategyOptimizerUI2,
  AnomaliesUI2,
  PortfolioOptimizerUI2,
  SandboxRunnerUI2,
  ScenarioSimUI2,
  AltDataUI2,
  SignalMarketUI2,
  MicrostructureUI2,
  LiquidityUI2,
  PolicySignalUI2,
  RiskNetworkUI2,
  HedgeFundUI2,
  MarketSessionV2UI2,
  DataSpineUI2,
  BrokerV2UI2,
  PortfolioV2UI2,
  PerformanceV2UI2,
  BacktesterV3UI2,
  DiscoveryUI2,
  AIStrategyUI2,
  SentimentV2UI2,
  WorkflowsV3UI2,
  ObservabilityV2UI2,
  ProductizationUI2,
  DataHealthUI2,
  BacktestV4UI2,
  SweepV2UI2,
  WalkForwardV2UI2,
  RobustnessUI2,
  MonteCarloV2UI2,
  StrategyBuilderV2UI2,
  ResearchQueueUI2,
  SearchV2UI2,
  EsOpsUI2,
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
        {/* Wave 6 — Market Intelligence */}
        <Route path="monte-carlo" element={<MonteCarloUI2 />} />
        <Route path="walk-forward" element={<WalkForwardUI2 />} />
        <Route path="scoring" element={<ScoringUI2 />} />
        <Route path="sentiment" element={<SentimentUI2 />} />
        <Route path="regime" element={<RegimeUI2 />} />
        {/* Wave 7 — Elasticsearch */}
        <Route path="elasticsearch" element={<ElasticsearchUI2 />} />
        {/* Wave 8 — Nova LLM */}
        <Route path="nova" element={<NovaUI2 />} />
        {/* Wave 9 — System Operations */}
        <Route path="market-hours" element={<MarketHoursUI2 />} />
        <Route path="kill-switch-recovery" element={<KillSwitchRecoveryUI2 />} />
        <Route path="system-health" element={<SystemHealthUI2 />} />
        {/* Wave 10 — Observability */}
        <Route path="observability" element={<ObservabilityUI2 />} />
        <Route path="compliance" element={<ComplianceUI2 />} />
        <Route path="performance" element={<PerformanceUI2 />} />
        {/* New Wave 6 — Strategy Optimizer */}
        <Route path="strategy-optimizer" element={<StrategyOptimizerUI2 />} />
        {/* New Wave 7 — Anomalies / Portfolio / Sandbox */}
        <Route path="anomalies" element={<AnomaliesUI2 />} />
        <Route path="portfolio-optimizer" element={<PortfolioOptimizerUI2 />} />
        <Route path="sandbox-runner" element={<SandboxRunnerUI2 />} />
        {/* New Wave 8 — Scenarios / Alt Data / Signal Market */}
        <Route path="scenario-sim" element={<ScenarioSimUI2 />} />
        <Route path="alt-data" element={<AltDataUI2 />} />
        <Route path="signal-market" element={<SignalMarketUI2 />} />
        {/* New Wave 9 — Microstructure / Liquidity */}
        <Route path="microstructure" element={<MicrostructureUI2 />} />
        <Route path="liquidity" element={<LiquidityUI2 />} />
        {/* New Wave 10 — Policy Signal / Risk Network / Hedge Fund */}
        <Route path="policy-signal" element={<PolicySignalUI2 />} />
        <Route path="risk-network" element={<RiskNetworkUI2 />} />
        <Route path="hedge-fund" element={<HedgeFundUI2 />} />
        {/* Waves 11-20 — Online-Only Swing Equities v1 */}
        <Route path="market-session-v2" element={<MarketSessionV2UI2 />} />
        <Route path="data-spine" element={<DataSpineUI2 />} />
        <Route path="broker-v2" element={<BrokerV2UI2 />} />
        <Route path="portfolio-v2" element={<PortfolioV2UI2 />} />
        <Route path="performance-v2" element={<PerformanceV2UI2 />} />
        <Route path="backtester-v3" element={<BacktesterV3UI2 />} />
        <Route path="discovery" element={<DiscoveryUI2 />} />
        <Route path="ai-strategy" element={<AIStrategyUI2 />} />
        <Route path="sentiment-v2" element={<SentimentV2UI2 />} />
        <Route path="workflows-v3" element={<WorkflowsV3UI2 />} />
        <Route path="observability-v2" element={<ObservabilityV2UI2 />} />
        <Route path="productization" element={<ProductizationUI2 />} />
        {/* Waves 21-50 — Backtest Engine v4 + Elasticsearch v3 */}
        <Route path="data-health" element={<DataHealthUI2 />} />
        <Route path="backtest-v4" element={<BacktestV4UI2 />} />
        <Route path="sweep-v2" element={<SweepV2UI2 />} />
        <Route path="walk-forward-v2" element={<WalkForwardV2UI2 />} />
        <Route path="robustness" element={<RobustnessUI2 />} />
        <Route path="monte-carlo-v2" element={<MonteCarloV2UI2 />} />
        <Route path="strategy-builder-v2" element={<StrategyBuilderV2UI2 />} />
        <Route path="research-queue" element={<ResearchQueueUI2 />} />
        <Route path="search-v2" element={<SearchV2UI2 />} />
        <Route path="es-ops" element={<EsOpsUI2 />} />
      </Route>
    </Routes>
  );
}
