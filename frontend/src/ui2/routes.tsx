/**
 * UI2 Routes Configuration
 * React Router routes for UI v2 — full feature parity with UI1
 */
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppShellUI2 } from './AppShellUI2';
import {
  DashboardUI2,
  TradingUI2,
  TradingMultiUI2,
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
  EvidenceGraphUI2,
  AgentToolsUI2,
  AgentBuilderUI2,
  SearchUXV3UI2,
  BacktestContractUI2,
  WalkForwardV3UI2,
  StrategyStudioV3UI2,
  JobQueueV2UI2,
  ConvergenceCockpitV1UI2,
  AgentEvalHarnessUI2,
  AuditorUI2,
  AccessibilityAuditUI2,
  PerfBudgetUI2,
  ControlsDomainUI2,
  SafeActionsUI2,
  ExportBundleUI2,
  AutopilotOptionsUI2,
  AutopilotCommandCenterUI2,
  ElastiHackUI2,
  QueryStudioUI2,
  DlqOpsUI2,
  MonitorUI2,
  DatasetSnapshotUI2,

  // Masterplan W15-W104
  CrossAssetQuoteUI2,
  CorporateActionsUI2,
  EconomicCalendarUI2,
  NewsEnrichmentUI2,
  EntityResolutionUI2,
  ThemeClusteringUI2,
  ResearchNotebookUI2,
  BqlQueryUI2,
  SearchExplainUI2,
  ScreenersUI2,
  CollaborationUI2,
  ResearchGovernanceUI2,
  ExecutionCockpitUI2,
  BlotterUI2,
  PreTradeRiskUI2,
  SurveillanceUI2,
  AttributionUI2,
  FactorModelUI2,
  StressScenariosUI2,
  PnlExplainUI2,
  ReconciliationUI2,
  SmartRoutingUI2,
  BrokerScoringUI2,
  CrossAccountUI2,
  RiskGovernanceUI2,
  AgentRegistryUI2,
  AutopilotPlaybookUI2,
  PromptFirewallUI2,
  ModelRouterUI2,
  EvalHarnessUI2,
  ApprovalQueueUI2,
  StrategySimUI2,
  SignalProvenanceUI2,
  IncidentAiUI2,
  DriftDetectionUI2,
  ControlTowerUI2,
  PolicyAttestationUI2,
  AiGovernanceUI2,
  OptionsMatrixUI2,
  GreeksServiceUI2,
  VolSurfaceUI2,
  PayoffLabUI2,
  SpreadToolsUI2,
  FuturesCurveUI2,
  RatesMonitorUI2,
  CrossMarginUI2,
  DerivativesOmsUI2,
  VolScannerUI2,
  HedgeEngineUI2,
  RiskAdjExecUI2,
  DerivativesGovUI2,
  PolicyCodeUI2,
  EntitlementsUI2,
  ApprovalChainUI2,
  EvidenceVaultUI2,
  RetentionPolicyUI2,
  AuditReplayUI2,
  IncidentComplianceUI2,
  SupervisoryUI2,
  KriScoringUI2,
  ThirdPartyRiskUI2,
  SsoHardeningUI2,
  JurisdictionUI2,
  ControlFrameworkUI2,
  PluginRuntimeUI2,
  SdkApiUI2,
  AppSandboxUI2,
  MarketplaceUI2,
  PartnerCiUI2,
  UsageMeteringUI2,
  BillingEventsUI2,
  ExtObservabilityUI2,
  TenantQuotaUI2,
  CompatMatrixUI2,
  DevPortalUI2,
  SupportSlaUI2,
  MarketplaceTrustUI2,
  MultiRegionUI2,
  LatencyBudgetUI2,
  CostProfilerUI2,
  ReliabilityEconUI2,
  RegionalFailoverUI2,
  DataResidencyUI2,
  OpsAutomationAiUI2,
  HotPathUI2,
  ReleaseQualityUI2,
  CapacityPlanUI2,
  PlatformDebtUI2,
  OperatorEnableUI2,
  GlobalReadinessUI2,
  // New UI2 Pages — demo/index.html parity
  HeatmapUI2,
  FixedIncomeUI2,
  FXDashboardUI2,
  CommoditiesUI2,
  CryptoUI2,
  SocialUI2,
  MacroUI2,
  StockScreenerUI2,
  WatchlistManagerUI2,
  NewsTerminalUI2,
  AlertsManagerUI2,
  OptionsChainUI2,
  MLDashboardUI2,
  PortfolioAnalyticsUI2,
  RiskDashboardUI2,
  OrderBookDepthUI2,
  AlgoExecutionUI2,
  BloombergTerminalUI2,
  MonteCarloSimUI2,
  StrategyBuilderProUI2,
  MultiChartLayoutUI2,
  PortfolioOptimizerProUI2,
  VolatilitySurfaceUI2,
  BacktestEngineUI2,
  TradingJournalUI2,
  SectorAnalysisUI2,
  DarkPoolUI2,
  MarketMakerUI2,
  CorrelationMatrixUI2,
  EarningsCalendarUI2,
  YieldCurveUI2,
  RealTimeScannerUI2,
  EconomicIndicatorsUI2,
  MarketOverviewUI2,
  ReportBuilderUI2,
  FinancialAnalysisUI2,
  ComparableCompaniesUI2,
  SecurityFinderUI2,
  TransactionCostAnalysisUI2,
  AlertDeliveryUI2,
  CreditRiskUI2,
  WorkspaceManagerUI2,
  ChartReplayUI2,
  OptionsPricingLabUI2,
  MarketBreadthUI2,
  AutopilotPositionSizingUI2,
  AutopilotAuditTrailUI2,
  DrawingToolManagerUI2,
  // Husk preview components
  TradingUI2Husk,
  PortfolioUI2Husk,
  DashboardUI2Husk,
} from './pages';
import TerraCodeJudge from './pages/TerraCodeJudge';

export function UI2Routes() {
  return (
    <Routes>
      <Route path="/" element={<AppShellUI2 />}>
        <Route index element={<Navigate to="/ui2/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardUI2 />} />
        {/* Husk preview routes */}
        <Route path="husk/dashboard" element={<DashboardUI2Husk />} />
        <Route path="husk/trading" element={<TradingUI2Husk />} />
        <Route path="husk/portfolio" element={<PortfolioUI2Husk />} />
        <Route path="trading" element={<TradingUI2 />} />
        <Route path="trading-multi" element={<TradingMultiUI2 />} />
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
        {/* Wave 93 — Evidence Graph */}
        <Route path="evidence" element={<EvidenceGraphUI2 />} />
        {/* Wave 94 — Agent Tools v1 */}
        <Route path="agent-tools" element={<AgentToolsUI2 />} />
        {/* Wave 95 — Elastic Agent Builder */}
        <Route path="agent-builder" element={<AgentBuilderUI2 />} />
        {/* Wave 96 — Search UX v3 */}
        <Route path="search-v3" element={<SearchUXV3UI2 />} />
        {/* Wave 97 — Backtesting Correctness Contract */}
        <Route path="backtest-contract" element={<BacktestContractUI2 />} />
        {/* Wave 98 — Walk-Forward + Robustness v3 */}
        <Route path="walkforward-v3" element={<WalkForwardV3UI2 />} />
        {/* Wave 99 — Strategy Studio v3 */}
        <Route path="strategy-studio" element={<StrategyStudioV3UI2 />} />
        {/* Wave 100 — Job Queue v2 + WS progress */}
        <Route path="job-queue" element={<JobQueueV2UI2 />} />
        {/* Wave 101 — Convergence Cockpit v1 */}
        <Route path="convergence" element={<ConvergenceCockpitV1UI2 />} />
        {/* Wave 102 — Agent Eval Harness */}
        <Route path="agent-eval" element={<AgentEvalHarnessUI2 />} />
        {/* Wave 103 — UI2 Standardization */}
        <Route path="auditor" element={<AuditorUI2 />} />
        {/* Wave 104 — Accessibility Audit */}
        <Route path="accessibility" element={<AccessibilityAuditUI2 />} />
        {/* Wave 105 — Performance Budget */}
        <Route path="perf-budget" element={<PerfBudgetUI2 />} />
        {/* Wave 106 — Controls Domain */}
        <Route path="controls-domain" element={<ControlsDomainUI2 />} />
        <Route path="safe-actions" element={<SafeActionsUI2 />} />
        <Route path="export-bundle" element={<ExportBundleUI2 />} />
        {/* Autopilot Options — Real options autopilot */}
        <Route path="autopilot-options" element={<AutopilotOptionsUI2 />} />
        {/* Autopilot Command Center — Revolution cockpit */}
        <Route path="autopilot-command-center" element={<AutopilotCommandCenterUI2 />} />
        {/* ElastiHack — Hackathon Pages */}
        <Route path="elastihack" element={<ElastiHackUI2 />} />
        <Route path="query-studio" element={<QueryStudioUI2 />} />
        <Route path="dlq-ops" element={<DlqOpsUI2 />} />
        {/* W01 — Monitor Grid */}
        <Route path="monitor" element={<MonitorUI2 />} />
        {/* W14 — Dataset Snapshot Management */}
        <Route path="dataset-snapshots" element={<DatasetSnapshotUI2 />} />

        {/* ── Masterplan W15-W104: 2-Year Feature Set ── */}
        <Route path="cross-asset-quote" element={<CrossAssetQuoteUI2 />} />
        <Route path="corporate-actions" element={<CorporateActionsUI2 />} />
        <Route path="economic-calendar" element={<EconomicCalendarUI2 />} />
        <Route path="news-enrichment" element={<NewsEnrichmentUI2 />} />
        <Route path="entity-resolution" element={<EntityResolutionUI2 />} />
        <Route path="theme-clustering" element={<ThemeClusteringUI2 />} />
        <Route path="research-notebook" element={<ResearchNotebookUI2 />} />
        <Route path="bql-query" element={<BqlQueryUI2 />} />
        <Route path="search-explain" element={<SearchExplainUI2 />} />
        <Route path="screeners" element={<ScreenersUI2 />} />
        <Route path="collaboration" element={<CollaborationUI2 />} />
        <Route path="research-governance" element={<ResearchGovernanceUI2 />} />
        <Route path="execution-cockpit" element={<ExecutionCockpitUI2 />} />
        <Route path="blotter" element={<BlotterUI2 />} />
        <Route path="pre-trade-risk" element={<PreTradeRiskUI2 />} />
        <Route path="surveillance" element={<SurveillanceUI2 />} />
        <Route path="attribution" element={<AttributionUI2 />} />
        <Route path="factor-model" element={<FactorModelUI2 />} />
        <Route path="stress-scenarios" element={<StressScenariosUI2 />} />
        <Route path="pnl-explain" element={<PnlExplainUI2 />} />
        <Route path="reconciliation" element={<ReconciliationUI2 />} />
        <Route path="smart-routing" element={<SmartRoutingUI2 />} />
        <Route path="broker-scoring" element={<BrokerScoringUI2 />} />
        <Route path="cross-account" element={<CrossAccountUI2 />} />
        <Route path="risk-governance" element={<RiskGovernanceUI2 />} />
        <Route path="agent-registry" element={<AgentRegistryUI2 />} />
        <Route path="autopilot-playbook" element={<AutopilotPlaybookUI2 />} />
        <Route path="prompt-firewall" element={<PromptFirewallUI2 />} />
        <Route path="model-router" element={<ModelRouterUI2 />} />
        <Route path="eval-harness" element={<EvalHarnessUI2 />} />
        <Route path="approval-queue" element={<ApprovalQueueUI2 />} />
        <Route path="strategy-sim" element={<StrategySimUI2 />} />
        <Route path="signal-provenance" element={<SignalProvenanceUI2 />} />
        <Route path="incident-ai" element={<IncidentAiUI2 />} />
        <Route path="drift-detection" element={<DriftDetectionUI2 />} />
        <Route path="control-tower" element={<ControlTowerUI2 />} />
        <Route path="policy-attestation" element={<PolicyAttestationUI2 />} />
        <Route path="ai-governance" element={<AiGovernanceUI2 />} />
        <Route path="options-matrix" element={<OptionsMatrixUI2 />} />
        <Route path="greeks-service" element={<GreeksServiceUI2 />} />
        <Route path="vol-surface" element={<VolSurfaceUI2 />} />
        <Route path="payoff-lab" element={<PayoffLabUI2 />} />
        <Route path="spread-tools" element={<SpreadToolsUI2 />} />
        <Route path="futures-curve" element={<FuturesCurveUI2 />} />
        <Route path="rates-monitor" element={<RatesMonitorUI2 />} />
        <Route path="cross-margin" element={<CrossMarginUI2 />} />
        <Route path="derivatives-oms" element={<DerivativesOmsUI2 />} />
        <Route path="vol-scanner" element={<VolScannerUI2 />} />
        <Route path="hedge-engine" element={<HedgeEngineUI2 />} />
        <Route path="risk-adj-exec" element={<RiskAdjExecUI2 />} />
        <Route path="derivatives-gov" element={<DerivativesGovUI2 />} />
        <Route path="policy-code" element={<PolicyCodeUI2 />} />
        <Route path="entitlements" element={<EntitlementsUI2 />} />
        <Route path="approval-chain" element={<ApprovalChainUI2 />} />
        <Route path="evidence-vault" element={<EvidenceVaultUI2 />} />
        <Route path="retention-policy" element={<RetentionPolicyUI2 />} />
        <Route path="audit-replay" element={<AuditReplayUI2 />} />
        <Route path="incident-compliance" element={<IncidentComplianceUI2 />} />
        <Route path="supervisory" element={<SupervisoryUI2 />} />
        <Route path="kri-scoring" element={<KriScoringUI2 />} />
        <Route path="third-party-risk" element={<ThirdPartyRiskUI2 />} />
        <Route path="sso-hardening" element={<SsoHardeningUI2 />} />
        <Route path="jurisdiction" element={<JurisdictionUI2 />} />
        <Route path="control-framework" element={<ControlFrameworkUI2 />} />
        <Route path="plugin-runtime" element={<PluginRuntimeUI2 />} />
        <Route path="sdk-api" element={<SdkApiUI2 />} />
        <Route path="app-sandbox" element={<AppSandboxUI2 />} />
        <Route path="marketplace" element={<MarketplaceUI2 />} />
        <Route path="partner-ci" element={<PartnerCiUI2 />} />
        <Route path="usage-metering" element={<UsageMeteringUI2 />} />
        <Route path="billing-events" element={<BillingEventsUI2 />} />
        <Route path="ext-observability" element={<ExtObservabilityUI2 />} />
        <Route path="tenant-quota" element={<TenantQuotaUI2 />} />
        <Route path="compat-matrix" element={<CompatMatrixUI2 />} />
        <Route path="dev-portal" element={<DevPortalUI2 />} />
        <Route path="support-sla" element={<SupportSlaUI2 />} />
        <Route path="marketplace-trust" element={<MarketplaceTrustUI2 />} />
        <Route path="multi-region" element={<MultiRegionUI2 />} />
        <Route path="latency-budget" element={<LatencyBudgetUI2 />} />
        <Route path="cost-profiler" element={<CostProfilerUI2 />} />
        <Route path="reliability-econ" element={<ReliabilityEconUI2 />} />
        <Route path="regional-failover" element={<RegionalFailoverUI2 />} />
        <Route path="data-residency" element={<DataResidencyUI2 />} />
        <Route path="ops-automation-ai" element={<OpsAutomationAiUI2 />} />
        <Route path="hot-path" element={<HotPathUI2 />} />
        <Route path="release-quality" element={<ReleaseQualityUI2 />} />
        <Route path="capacity-plan" element={<CapacityPlanUI2 />} />
        <Route path="platform-debt" element={<PlatformDebtUI2 />} />
        <Route path="operator-enable" element={<OperatorEnableUI2 />} />
        <Route path="global-readiness" element={<GlobalReadinessUI2 />} />
        {/* New UI2 Pages — demo/index.html parity */}
        <Route path="heatmap" element={<HeatmapUI2 />} />
        <Route path="fixed-income" element={<FixedIncomeUI2 />} />
        <Route path="fx-dashboard" element={<FXDashboardUI2 />} />
        <Route path="commodities" element={<CommoditiesUI2 />} />
        <Route path="crypto" element={<CryptoUI2 />} />
        <Route path="social" element={<SocialUI2 />} />
        <Route path="macro" element={<MacroUI2 />} />
        <Route path="stock-screener" element={<StockScreenerUI2 />} />
        <Route path="watchlist-manager" element={<WatchlistManagerUI2 />} />
        <Route path="news-terminal" element={<NewsTerminalUI2 />} />
        <Route path="alerts-manager" element={<AlertsManagerUI2 />} />
        <Route path="options-chain" element={<OptionsChainUI2 />} />
        <Route path="ml-dashboard" element={<MLDashboardUI2 />} />
        <Route path="portfolio-analytics" element={<PortfolioAnalyticsUI2 />} />
        <Route path="risk-dashboard" element={<RiskDashboardUI2 />} />
        <Route path="order-book-depth" element={<OrderBookDepthUI2 />} />
        <Route path="algo-execution" element={<AlgoExecutionUI2 />} />
        <Route path="bloomberg-terminal" element={<BloombergTerminalUI2 />} />
        <Route path="monte-carlo-sim" element={<MonteCarloSimUI2 />} />
        <Route path="strategy-builder-pro" element={<StrategyBuilderProUI2 />} />
        <Route path="multi-chart-layout" element={<MultiChartLayoutUI2 />} />
        <Route path="portfolio-optimizer-pro" element={<PortfolioOptimizerProUI2 />} />
        <Route path="volatility-surface" element={<VolatilitySurfaceUI2 />} />
        <Route path="backtest-engine" element={<BacktestEngineUI2 />} />
        <Route path="trading-journal" element={<TradingJournalUI2 />} />
        <Route path="sector-analysis" element={<SectorAnalysisUI2 />} />
        <Route path="dark-pool" element={<DarkPoolUI2 />} />
        <Route path="market-maker" element={<MarketMakerUI2 />} />
        <Route path="correlation-matrix" element={<CorrelationMatrixUI2 />} />
        <Route path="earnings-calendar" element={<EarningsCalendarUI2 />} />
        <Route path="yield-curve" element={<YieldCurveUI2 />} />
        <Route path="real-time-scanner" element={<RealTimeScannerUI2 />} />
        <Route path="economic-indicators" element={<EconomicIndicatorsUI2 />} />
        <Route path="market-overview" element={<MarketOverviewUI2 />} />
        <Route path="report-builder" element={<ReportBuilderUI2 />} />
        <Route path="financial-analysis" element={<FinancialAnalysisUI2 />} />
        <Route path="comparable-companies" element={<ComparableCompaniesUI2 />} />
        <Route path="security-finder" element={<SecurityFinderUI2 />} />
        <Route path="transaction-cost-analysis" element={<TransactionCostAnalysisUI2 />} />
        <Route path="alert-delivery" element={<AlertDeliveryUI2 />} />
        <Route path="credit-risk" element={<CreditRiskUI2 />} />
        <Route path="workspace-manager" element={<WorkspaceManagerUI2 />} />
        <Route path="chart-replay" element={<ChartReplayUI2 />} />
        <Route path="options-pricing-lab" element={<OptionsPricingLabUI2 />} />
        <Route path="market-breadth" element={<MarketBreadthUI2 />} />
        <Route path="autopilot-position-sizing" element={<AutopilotPositionSizingUI2 />} />
        <Route path="autopilot-audit-trail" element={<AutopilotAuditTrailUI2 />} />
        <Route path="drawing-tool-manager" element={<DrawingToolManagerUI2 />} />
        <Route path="judge" element={<TerraCodeJudge />} />

      </Route>
    </Routes>
  );
}
