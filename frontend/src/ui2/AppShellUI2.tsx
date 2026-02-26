/**
 * UI2 AppShellUI2 Component
 * Professional trading terminal shell with Bloomberg-grade polish
 * TopBar + LeftRail + LeftDrawer + Center + RightSidebar + BottomDock + CommandPalette
 * v1.94: Real connection status from tradingStore
 */

import { useState, useEffect, useSyncExternalStore } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { BottomDock, RightSidebar, CommandPalette, MarketTape, type CommandItem } from './components';
import { DATA_MODE_LABEL, MARKET_PROVIDER } from './dataMode/config';
// Online-only identity
const APEX_USER = { name: 'Apex Trader' };
// Phase A: Build-time version fingerprints
declare const __GIT_SHA__: string;
declare const __BUILD_TIME__: string;
const FE_GIT_SHA = typeof __GIT_SHA__ !== 'undefined' ? __GIT_SHA__ : 'unknown';
const FE_BUILD_TIME = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : 'unknown';
import { COMMAND_REGISTRY } from './stores/commandRegistry';
import { useContextBus } from './stores/contextBusStore';
import { ToastProvider } from '../ui/Toast';
import { OrdersBlotter } from '../features/orders/OrdersBlotter';
import { TradesLedger } from '../features/trades/TradesLedger';
import { tradingStore } from './stores/tradingStore';

interface WorkspaceConfig {
  id: string;
  label: string;
  icon: string;
  path: string;
  section?: 'main' | 'tools' | 'system';
  description?: string;
  keywords?: string[];
}

const WORKSPACES: WorkspaceConfig[] = [
  // Main section
  { 
    id: 'dashboard', 
    label: 'Dashboard', 
    icon: '🏠', 
    path: '/ui2/dashboard', 
    section: 'main',
    description: 'Command center with key metrics',
    keywords: ['home', 'overview', 'metrics', 'kpi']
  },
  { 
    id: 'trading', 
    label: 'Trading', 
    icon: '📈', 
    path: '/ui2/trading', 
    section: 'main',
    description: 'Live chart and order execution',
    keywords: ['chart', 'trade', 'order', 'execution']
  },
  { 
    id: 'portfolio', 
    label: 'Portfolio', 
    icon: '💼', 
    path: '/ui2/portfolio', 
    section: 'main',
    description: 'Positions and performance',
    keywords: ['positions', 'pnl', 'performance', 'holdings']
  },
  { 
    id: 'orders', 
    label: 'Orders', 
    icon: '📋', 
    path: '/ui2/orders', 
    section: 'main',
    description: 'Order history and management',
    keywords: ['order', 'history', 'fills', 'execution']
  },
  // Tools section
  { 
    id: 'risk', 
    label: 'Risk & Options', 
    icon: '🛡️', 
    path: '/ui2/risk', 
    section: 'tools',
    description: 'Options chain and risk analysis',
    keywords: ['options', 'greeks', 'risk', 'strategy']
  },
  { 
    id: 'research', 
    label: 'Research', 
    icon: '🔬', 
    path: '/ui2/research', 
    section: 'tools',
    description: 'Strategy lab and analysis',
    keywords: ['strategies', 'backtest', 'research', 'analysis']
  },
  { 
    id: 'backtest', 
    label: 'Backtest', 
    icon: '🧪', 
    path: '/ui2/backtest', 
    section: 'tools',
    description: 'Historical strategy testing',
    keywords: ['backtest', 'historical', 'test', 'simulation']
  },
  { 
    id: 'autopilot', 
    label: 'Autopilot', 
    icon: '🤖', 
    path: '/ui2/autopilot', 
    section: 'tools',
    description: 'Autonomous trading agent',
    keywords: ['autopilot', 'agent', 'autonomous', 'auto']
  },
  { 
    id: 'alerts', 
    label: 'Alerts', 
    icon: '🔔', 
    path: '/ui2/alerts', 
    section: 'tools',
    description: 'Price and technical alerts',
    keywords: ['alerts', 'notifications', 'triggers']
  },
  { 
    id: 'replay', 
    label: 'Replay', 
    icon: '⏪', 
    path: '/ui2/replay', 
    section: 'tools',
    description: 'Market replay and analysis',
    keywords: ['replay', 'historical', 'playback']
  },
  // System section
  { 
    id: 'runs', 
    label: 'Runs & Audit', 
    icon: '📜', 
    path: '/ui2/runs', 
    section: 'system',
    description: 'Execution audit trail',
    keywords: ['runs', 'audit', 'history', 'log']
  },
  {
    id: 'ops',
    label: 'Ops',
    icon: '⚙️',
    path: '/ui2/ops',
    section: 'system',
    description: 'System operations and monitoring',
    keywords: ['ops', 'operations', 'system', 'monitoring']
  },
  // W01 — Monitor Grid
  {
    id: 'monitor',
    label: 'Monitor',
    icon: '🖥️',
    path: '/ui2/monitor',
    section: 'main',
    description: 'Multi-panel trading monitor',
    keywords: ['monitor', 'grid', 'panels', 'multi', 'chart', 'watchlist']
  },
  {
    id: 'settings', 
    label: 'Settings', 
    icon: '🔧', 
    path: '/ui2/settings', 
    section: 'system',
    description: 'Platform configuration',
    keywords: ['settings', 'config', 'preferences']
  },
  // Wave 7 — v1.63+
  {
    id: 'automation',
    label: 'Automation',
    icon: '🔄',
    path: '/ui2/automation',
    section: 'tools',
    description: 'Workflow automation studio',
    keywords: ['workflow', 'automation', 'pipeline', 'trigger']
  },
  {
    id: 'search',
    label: 'Search',
    icon: '🔍',
    path: '/ui2/search',
    section: 'tools',
    description: 'Full-text entity search',
    keywords: ['search', 'find', 'query', 'elasticsearch']
  },
  {
    id: 'agent',
    label: 'AI Agent',
    icon: '💡',
    path: '/ui2/agent',
    section: 'tools',
    description: 'AI assistant with tool execution',
    keywords: ['agent', 'ai', 'assistant', 'nova', 'llm']
  },
  // Wave 8 — v1.73+
  {
    id: 'autopilot-v2',
    label: 'Autopilot V2',
    icon: '🚀',
    path: '/ui2/autopilot-v2',
    section: 'tools',
    description: 'V2 pipeline: scoring, risk, sizing, execution sim',
    keywords: ['autopilot', 'v2', 'pipeline', 'scoring', 'risk', 'execution']
  },
  {
    id: 'automation-v2',
    label: 'Automation V2',
    icon: '⚡',
    path: '/ui2/automation-v2',
    section: 'tools',
    description: 'DAG-based workflow automation engine',
    keywords: ['automation', 'dag', 'workflow', 'trigger']
  },
  {
    id: 'export',
    label: 'Export',
    icon: '📦',
    path: '/ui2/export',
    section: 'system',
    description: 'Export bundles and compliance reports',
    keywords: ['export', 'bundle', 'report', 'audit', 'compliance']
  },
  {
    id: 'health',
    label: 'Health',
    icon: '💚',
    path: '/ui2/health',
    section: 'system',
    description: 'Platform health and observability',
    keywords: ['health', 'status', 'metrics', 'observability']
  },
  // Wave 12 — v1.115+
  {
    id: 'telemetry',
    label: 'Telemetry',
    icon: '📡',
    path: '/ui2/telemetry',
    section: 'system',
    description: 'Event telemetry and observability',
    keywords: ['telemetry', 'events', 'observability', 'tracing']
  },
  {
    id: 'autopilot-explain',
    label: 'Explain',
    icon: '🧠',
    path: '/ui2/autopilot-explain',
    section: 'tools',
    description: 'Autopilot decision explainability',
    keywords: ['explain', 'autopilot', 'decision', 'reasoning']
  },
  // Wave 13-14 — v1.123+
  {
    id: 'automation-runs',
    label: 'Automation Runs',
    icon: '🏃',
    path: '/ui2/automation-runs',
    section: 'system',
    description: 'Automation run history and logs',
    keywords: ['runs', 'automation', 'execution', 'history', 'logs']
  },
  {
    id: 'workflow-builder',
    label: 'Workflow Builder',
    icon: '🔨',
    path: '/ui2/workflow-builder',
    section: 'tools',
    description: 'Visual workflow editor with templates',
    keywords: ['workflow', 'builder', 'create', 'template', 'editor']
  },
  {
    id: 'incidents',
    label: 'Incidents',
    icon: '🚨',
    path: '/ui2/incidents',
    section: 'system',
    description: 'Incident tracking and response',
    keywords: ['incidents', 'alert', 'outage', 'response']
  },
  {
    id: 'decisions',
    label: 'Decisions',
    icon: '🧭',
    path: '/ui2/decisions',
    section: 'tools',
    description: 'Autopilot decision explorer with portfolio impact',
    keywords: ['decisions', 'autopilot', 'impact', 'portfolio']
  },
  {
    id: 'health-v4',
    label: 'Health V4',
    icon: '💊',
    path: '/ui2/health-v4',
    section: 'system',
    description: 'All-subsystem health with search, LLM, replay status',
    keywords: ['health', 'v4', 'subsystem', 'status']
  },
  // Wave 17 — v1.150+
  {
    id: 'ai-provider',
    label: 'AI Provider',
    icon: '🧩',
    path: '/ui2/ai-provider',
    section: 'system',
    description: 'LLM provider status, budget, cache, rate limits',
    keywords: ['ai', 'llm', 'provider', 'budget', 'cache', 'nova']
  },
  // Wave 18 — v1.155+
  {
    id: 'decision-explainer',
    label: 'Decision V2',
    icon: '📊',
    path: '/ui2/decision-explainer',
    section: 'tools',
    description: 'Decision explainer with feature attribution and confidence',
    keywords: ['decision', 'explainer', 'attribution', 'confidence', 'post-trade']
  },
  {
    id: 'nl-workflow',
    label: 'NL Workflow',
    icon: '✨',
    path: '/ui2/nl-workflow',
    section: 'tools',
    description: 'Natural language workflow generator with validation',
    keywords: ['nl', 'workflow', 'generate', 'natural', 'language', 'simulation']
  },
  // Waves 11-20 — Online-Only Swing Equities v1
  {
    id: 'market-session-v2',
    label: 'Market Session',
    icon: '🕐',
    path: '/ui2/market-session-v2',
    section: 'system',
    description: 'NYSE market session engine with holidays',
    keywords: ['market', 'session', 'holidays', 'hours', 'nyse']
  },
  {
    id: 'data-spine',
    label: 'Data Spine',
    icon: '🔌',
    path: '/ui2/data-spine',
    section: 'system',
    description: 'Online-only data ingestion pipeline',
    keywords: ['data', 'spine', 'ingest', 'yfinance', 'universe']
  },
  {
    id: 'broker-v2',
    label: 'Paper Broker',
    icon: '🏦',
    path: '/ui2/broker-v2',
    section: 'main',
    description: 'Paper-only Alpaca broker with kill switch',
    keywords: ['broker', 'paper', 'alpaca', 'orders', 'kill switch']
  },
  {
    id: 'portfolio-v2',
    label: 'Allocator',
    icon: '⚖️',
    path: '/ui2/portfolio-v2',
    section: 'tools',
    description: 'Portfolio allocation with equal-weight and inverse-vol',
    keywords: ['portfolio', 'allocator', 'weight', 'exposure']
  },
  {
    id: 'performance-v2',
    label: 'Ledger',
    icon: '📊',
    path: '/ui2/performance-v2',
    section: 'tools',
    description: 'Performance ledger with Sharpe, drawdown, auto-disable',
    keywords: ['performance', 'sharpe', 'drawdown', 'leaderboard']
  },
  {
    id: 'backtester-v3',
    label: 'Backtester V3',
    icon: '🧪',
    path: '/ui2/backtester-v3',
    section: 'tools',
    description: 'Backtester v3 with calibration and corporate actions',
    keywords: ['backtester', 'v3', 'calibration', 'sma']
  },
  {
    id: 'discovery',
    label: 'Discovery',
    icon: '🔎',
    path: '/ui2/discovery',
    section: 'tools',
    description: 'Strategy discovery with walk-forward and robustness',
    keywords: ['discovery', 'strategy', 'walk-forward', 'robustness']
  },
  {
    id: 'ai-strategy',
    label: 'AI Strategy',
    icon: '🤖',
    path: '/ui2/ai-strategy',
    section: 'tools',
    description: 'AI strategy builder with guardrails and sweeps',
    keywords: ['ai', 'strategy', 'guardrail', 'sweep', 'groq']
  },
  {
    id: 'sentiment-v2',
    label: 'Sentiment V2',
    icon: '📰',
    path: '/ui2/sentiment-v2',
    section: 'tools',
    description: 'FinBERT sentiment with time-decay and signal overlay',
    keywords: ['sentiment', 'finbert', 'news', 'articles']
  },
  {
    id: 'workflows-v3',
    label: 'Workflows V3',
    icon: '🔗',
    path: '/ui2/workflows-v3',
    section: 'tools',
    description: 'DAG-based workflow engine with schedule triggers',
    keywords: ['workflow', 'dag', 'schedule', 'trigger']
  },
  {
    id: 'observability-v2',
    label: 'Ops Center',
    icon: '📡',
    path: '/ui2/observability-v2',
    section: 'system',
    description: 'System observability with query perf and ILM',
    keywords: ['observability', 'health', 'metrics', 'alerts', 'ilm']
  },
  {
    id: 'productization',
    label: 'Productization',
    icon: '🚀',
    path: '/ui2/productization',
    section: 'system',
    description: 'Universe management, config profiles, runbooks',
    keywords: ['productization', 'universe', 'profiles', 'runbooks', 'backup']
  },
  {
    id: 'dataset-snapshots',
    label: 'Datasets',
    icon: '🗃️',
    path: '/ui2/dataset-snapshots',
    section: 'tools',
    description: 'Immutable dataset snapshots with SHA-256 integrity',
    keywords: ['dataset', 'snapshot', 'sha256', 'integrity', 'immutable', 'data']
  },
  // ── Masterplan W15-W104: 2-Year Feature Set ──
  {
    id: 'cross-asset-quote',
    label: 'Cross-Asset Quotes',
    icon: '💹',
    path: '/ui2/cross-asset-quote',
    section: 'tools',
    description: 'Real-time cross-asset quote aggregation',
    keywords: ['cross', 'asset', 'quote']
  },
  {
    id: 'corporate-actions',
    label: 'Corporate Actions',
    icon: '📋',
    path: '/ui2/corporate-actions',
    section: 'tools',
    description: 'Corporate actions ingestion and audit trail',
    keywords: ['corporate', 'actions']
  },
  {
    id: 'economic-calendar',
    label: 'Economic Calendar',
    icon: '📅',
    path: '/ui2/economic-calendar',
    section: 'tools',
    description: 'Global economic event calendar',
    keywords: ['economic', 'calendar']
  },
  {
    id: 'news-enrichment',
    label: 'News Enrichment',
    icon: '📰',
    path: '/ui2/news-enrichment',
    section: 'tools',
    description: 'NLP-enriched news with sentiment scoring',
    keywords: ['news', 'enrichment']
  },
  {
    id: 'entity-resolution',
    label: 'Entity Resolution',
    icon: '🔗',
    path: '/ui2/entity-resolution',
    section: 'tools',
    description: 'Entity resolution and deduplication',
    keywords: ['entity', 'resolution']
  },
  {
    id: 'theme-clustering',
    label: 'Theme Clustering',
    icon: '🎯',
    path: '/ui2/theme-clustering',
    section: 'tools',
    description: 'ML-powered thematic clustering',
    keywords: ['theme', 'clustering']
  },
  {
    id: 'research-notebook',
    label: 'Research Notebook',
    icon: '📓',
    path: '/ui2/research-notebook',
    section: 'tools',
    description: 'Collaborative research notebooks',
    keywords: ['research', 'notebook']
  },
  {
    id: 'bql-query',
    label: 'BQL Query',
    icon: '⌨️',
    path: '/ui2/bql-query',
    section: 'tools',
    description: 'Bloomberg-style query language',
    keywords: ['bql', 'query']
  },
  {
    id: 'search-explain',
    label: 'Search Explain',
    icon: '🔍',
    path: '/ui2/search-explain',
    section: 'tools',
    description: 'Search ranking explainability',
    keywords: ['search', 'explain']
  },
  {
    id: 'screeners',
    label: 'Screeners',
    icon: '📊',
    path: '/ui2/screeners',
    section: 'tools',
    description: 'Stock screeners with monitoring',
    keywords: ['screeners']
  },
  {
    id: 'collaboration',
    label: 'Collaboration',
    icon: '👥',
    path: '/ui2/collaboration',
    section: 'tools',
    description: 'Analyst collaboration toolkit',
    keywords: ['collaboration']
  },
  {
    id: 'research-governance',
    label: 'Research Gov',
    icon: '🏛️',
    path: '/ui2/research-governance',
    section: 'tools',
    description: 'Research QA and governance',
    keywords: ['research', 'governance']
  },
  {
    id: 'execution-cockpit',
    label: 'Exec Cockpit',
    icon: '🎛️',
    path: '/ui2/execution-cockpit',
    section: 'main',
    description: 'Real-time execution monitoring',
    keywords: ['execution', 'cockpit']
  },
  {
    id: 'blotter',
    label: 'Blotter',
    icon: '📑',
    path: '/ui2/blotter',
    section: 'main',
    description: 'Execution blotter with audit trail',
    keywords: ['blotter']
  },
  {
    id: 'pre-trade-risk',
    label: 'Pre-Trade Risk',
    icon: '⚠️',
    path: '/ui2/pre-trade-risk',
    section: 'tools',
    description: 'Pre-trade risk checks',
    keywords: ['pre', 'trade', 'risk']
  },
  {
    id: 'surveillance',
    label: 'Surveillance',
    icon: '👁️',
    path: '/ui2/surveillance',
    section: 'tools',
    description: 'Post-trade surveillance',
    keywords: ['surveillance']
  },
  {
    id: 'attribution',
    label: 'Attribution',
    icon: '📊',
    path: '/ui2/attribution',
    section: 'tools',
    description: 'Portfolio attribution engine',
    keywords: ['attribution']
  },
  {
    id: 'factor-model',
    label: 'Factor Model',
    icon: '🧮',
    path: '/ui2/factor-model',
    section: 'tools',
    description: 'Multi-factor risk model',
    keywords: ['factor', 'model']
  },
  {
    id: 'stress-scenarios',
    label: 'Stress Scenarios',
    icon: '🌪️',
    path: '/ui2/stress-scenarios',
    section: 'tools',
    description: 'Stress scenario composer',
    keywords: ['stress', 'scenarios']
  },
  {
    id: 'pnl-explain',
    label: 'PnL Explainer',
    icon: '💰',
    path: '/ui2/pnl-explain',
    section: 'tools',
    description: 'PnL explainability service',
    keywords: ['pnl', 'explain']
  },
  {
    id: 'reconciliation',
    label: 'Reconciliation',
    icon: '🔄',
    path: '/ui2/reconciliation',
    section: 'system',
    description: 'Trade reconciliation automation',
    keywords: ['reconciliation']
  },
  {
    id: 'smart-routing',
    label: 'Smart Routing',
    icon: '🛤️',
    path: '/ui2/smart-routing',
    section: 'tools',
    description: 'Smart order routing',
    keywords: ['smart', 'routing']
  },
  {
    id: 'broker-scoring',
    label: 'Broker Scoring',
    icon: '⭐',
    path: '/ui2/broker-scoring',
    section: 'tools',
    description: 'Broker quality scoring',
    keywords: ['broker', 'scoring']
  },
  {
    id: 'cross-account',
    label: 'Cross-Account',
    icon: '🔐',
    path: '/ui2/cross-account',
    section: 'system',
    description: 'Cross-account controls',
    keywords: ['cross', 'account']
  },
  {
    id: 'risk-governance',
    label: 'Risk Governance',
    icon: '🏛️',
    path: '/ui2/risk-governance',
    section: 'system',
    description: 'Risk governance framework',
    keywords: ['risk', 'governance']
  },
  {
    id: 'agent-registry',
    label: 'Agent Registry',
    icon: '🤖',
    path: '/ui2/agent-registry',
    section: 'tools',
    description: 'AI agent registry',
    keywords: ['agent', 'registry']
  },
  {
    id: 'autopilot-playbook',
    label: 'Playbook',
    icon: '📖',
    path: '/ui2/autopilot-playbook',
    section: 'tools',
    description: 'Autopilot playbook engine',
    keywords: ['autopilot', 'playbook']
  },
  {
    id: 'prompt-firewall',
    label: 'Prompt Firewall',
    icon: '🔥',
    path: '/ui2/prompt-firewall',
    section: 'system',
    description: 'Prompt policy firewall',
    keywords: ['prompt', 'firewall']
  },
  {
    id: 'model-router',
    label: 'Model Router',
    icon: '🔀',
    path: '/ui2/model-router',
    section: 'system',
    description: 'AI model router',
    keywords: ['model', 'router']
  },
  {
    id: 'eval-harness',
    label: 'Eval Harness',
    icon: '🧪',
    path: '/ui2/eval-harness',
    section: 'tools',
    description: 'Model evaluation harness',
    keywords: ['eval', 'harness']
  },
  {
    id: 'approval-queue',
    label: 'Approval Queue',
    icon: '✅',
    path: '/ui2/approval-queue',
    section: 'system',
    description: 'Human approval queue',
    keywords: ['approval', 'queue']
  },
  {
    id: 'strategy-sim',
    label: 'Strategy Sim',
    icon: '🎲',
    path: '/ui2/strategy-sim',
    section: 'tools',
    description: 'Strategy simulation',
    keywords: ['strategy', 'sim']
  },
  {
    id: 'signal-provenance',
    label: 'Signal Provenance',
    icon: '📜',
    path: '/ui2/signal-provenance',
    section: 'tools',
    description: 'Signal provenance ledger',
    keywords: ['signal', 'provenance']
  },
  {
    id: 'incident-ai',
    label: 'Incident AI',
    icon: '🚨',
    path: '/ui2/incident-ai',
    section: 'system',
    description: 'Incident-aware AI fallback',
    keywords: ['incident', 'ai']
  },
  {
    id: 'drift-detection',
    label: 'Drift Detection',
    icon: '📐',
    path: '/ui2/drift-detection',
    section: 'tools',
    description: 'Drift detection pipeline',
    keywords: ['drift', 'detection']
  },
  {
    id: 'control-tower',
    label: 'Control Tower',
    icon: '🗼',
    path: '/ui2/control-tower',
    section: 'main',
    description: 'Autopilot control tower',
    keywords: ['control', 'tower']
  },
  {
    id: 'policy-attestation',
    label: 'Policy Attest',
    icon: '📝',
    path: '/ui2/policy-attestation',
    section: 'system',
    description: 'Policy attestation packs',
    keywords: ['policy', 'attestation']
  },
  {
    id: 'ai-governance',
    label: 'AI Governance',
    icon: '🏗️',
    path: '/ui2/ai-governance',
    section: 'system',
    description: 'AI release governance',
    keywords: ['ai', 'governance']
  },
  {
    id: 'options-matrix',
    label: 'Options Matrix',
    icon: '📐',
    path: '/ui2/options-matrix',
    section: 'tools',
    description: 'Options chain matrix',
    keywords: ['options', 'matrix']
  },
  {
    id: 'greeks-service',
    label: 'Greeks',
    icon: 'Δ',
    path: '/ui2/greeks-service',
    section: 'tools',
    description: 'Greeks computation service',
    keywords: ['greeks', 'service']
  },
  {
    id: 'vol-surface',
    label: 'Vol Surface',
    icon: '📈',
    path: '/ui2/vol-surface',
    section: 'tools',
    description: 'Volatility surface analytics',
    keywords: ['vol', 'surface']
  },
  {
    id: 'payoff-lab',
    label: 'Payoff Lab',
    icon: '🔬',
    path: '/ui2/payoff-lab',
    section: 'tools',
    description: 'Strategy payoff lab',
    keywords: ['payoff', 'lab']
  },
  {
    id: 'spread-tools',
    label: 'Spread Tools',
    icon: '🔧',
    path: '/ui2/spread-tools',
    section: 'tools',
    description: 'Options spread execution',
    keywords: ['spread', 'tools']
  },
  {
    id: 'futures-curve',
    label: 'Futures Curve',
    icon: '📉',
    path: '/ui2/futures-curve',
    section: 'tools',
    description: 'Futures curve analytics',
    keywords: ['futures', 'curve']
  },
  {
    id: 'rates-monitor',
    label: 'Rates Monitor',
    icon: '💵',
    path: '/ui2/rates-monitor',
    section: 'tools',
    description: 'Interest rates monitor',
    keywords: ['rates', 'monitor']
  },
  {
    id: 'cross-margin',
    label: 'Cross-Margin',
    icon: '💼',
    path: '/ui2/cross-margin',
    section: 'system',
    description: 'Cross-margin controls',
    keywords: ['cross', 'margin']
  },
  {
    id: 'derivatives-oms',
    label: 'Derivatives OMS',
    icon: '🏢',
    path: '/ui2/derivatives-oms',
    section: 'main',
    description: 'Derivatives order management',
    keywords: ['derivatives', 'oms']
  },
  {
    id: 'vol-scanner',
    label: 'Vol Scanner',
    icon: '🔎',
    path: '/ui2/vol-scanner',
    section: 'tools',
    description: 'Volatility scanner',
    keywords: ['vol', 'scanner']
  },
  {
    id: 'hedge-engine',
    label: 'Hedge Engine',
    icon: '🛡️',
    path: '/ui2/hedge-engine',
    section: 'tools',
    description: 'Hedge recommendation engine',
    keywords: ['hedge', 'engine']
  },
  {
    id: 'risk-adj-exec',
    label: 'Risk-Adj Exec',
    icon: '⚡',
    path: '/ui2/risk-adj-exec',
    section: 'tools',
    description: 'Risk-adjusted execution',
    keywords: ['risk', 'adj', 'exec']
  },
  {
    id: 'derivatives-gov',
    label: 'Deriv Gov',
    icon: '🏛️',
    path: '/ui2/derivatives-gov',
    section: 'system',
    description: 'Derivatives governance',
    keywords: ['derivatives', 'gov']
  },
  {
    id: 'policy-code',
    label: 'Policy Code',
    icon: '📜',
    path: '/ui2/policy-code',
    section: 'system',
    description: 'Policy-as-code engine',
    keywords: ['policy', 'code']
  },
  {
    id: 'entitlements',
    label: 'Entitlements',
    icon: '🔑',
    path: '/ui2/entitlements',
    section: 'system',
    description: 'Entitlements matrix',
    keywords: ['entitlements']
  },
  {
    id: 'approval-chain',
    label: 'Approval Chain',
    icon: '🔗',
    path: '/ui2/approval-chain',
    section: 'system',
    description: 'Approval chain engine',
    keywords: ['approval', 'chain']
  },
  {
    id: 'evidence-vault',
    label: 'Evidence Vault',
    icon: '🔒',
    path: '/ui2/evidence-vault',
    section: 'system',
    description: 'Regulatory evidence vault',
    keywords: ['evidence', 'vault']
  },
  {
    id: 'retention-policy',
    label: 'Retention Policy',
    icon: '🗑️',
    path: '/ui2/retention-policy',
    section: 'system',
    description: 'Data retention automation',
    keywords: ['retention', 'policy']
  },
  {
    id: 'audit-replay',
    label: 'Audit Replay',
    icon: '⏪',
    path: '/ui2/audit-replay',
    section: 'system',
    description: 'Audit event replay',
    keywords: ['audit', 'replay']
  },
  {
    id: 'incident-compliance',
    label: 'Incident Compl',
    icon: '🔔',
    path: '/ui2/incident-compliance',
    section: 'system',
    description: 'Incident compliance bridge',
    keywords: ['incident', 'compliance']
  },
  {
    id: 'supervisory',
    label: 'Supervisory',
    icon: '👔',
    path: '/ui2/supervisory',
    section: 'system',
    description: 'Supervisory dashboards',
    keywords: ['supervisory']
  },
  {
    id: 'kri-scoring',
    label: 'KRI Scoring',
    icon: '📏',
    path: '/ui2/kri-scoring',
    section: 'system',
    description: 'Key Risk Indicator scoring',
    keywords: ['kri', 'scoring']
  },
  {
    id: 'third-party-risk',
    label: '3rd Party Risk',
    icon: '🌐',
    path: '/ui2/third-party-risk',
    section: 'system',
    description: 'Third-party risk connectors',
    keywords: ['third', 'party', 'risk']
  },
  {
    id: 'sso-hardening',
    label: 'SSO Hardening',
    icon: '🔐',
    path: '/ui2/sso-hardening',
    section: 'system',
    description: 'Enterprise SSO hardening',
    keywords: ['sso', 'hardening']
  },
  {
    id: 'jurisdiction',
    label: 'Jurisdiction',
    icon: '🌍',
    path: '/ui2/jurisdiction',
    section: 'system',
    description: 'Jurisdiction rulesets',
    keywords: ['jurisdiction']
  },
  {
    id: 'control-framework',
    label: 'Control FW',
    icon: '✔️',
    path: '/ui2/control-framework',
    section: 'system',
    description: 'Control framework signoff',
    keywords: ['control', 'framework']
  },
  {
    id: 'plugin-runtime',
    label: 'Plugins',
    icon: '🧩',
    path: '/ui2/plugin-runtime',
    section: 'system',
    description: 'Plugin sandbox runtime',
    keywords: ['plugin', 'runtime']
  },
  {
    id: 'sdk-api',
    label: 'SDK Standard',
    icon: '📘',
    path: '/ui2/sdk-api',
    section: 'system',
    description: 'SDK API standard',
    keywords: ['sdk', 'api']
  },
  {
    id: 'app-sandbox',
    label: 'App Sandbox',
    icon: '📦',
    path: '/ui2/app-sandbox',
    section: 'system',
    description: 'App sandbox controls',
    keywords: ['app', 'sandbox']
  },
  {
    id: 'marketplace',
    label: 'Marketplace',
    icon: '🏪',
    path: '/ui2/marketplace',
    section: 'tools',
    description: 'Extension marketplace',
    keywords: ['marketplace']
  },
  {
    id: 'partner-ci',
    label: 'Partner CI',
    icon: '🤝',
    path: '/ui2/partner-ci',
    section: 'system',
    description: 'Partner CI certification',
    keywords: ['partner', 'ci']
  },
  {
    id: 'usage-metering',
    label: 'Usage Metering',
    icon: '📊',
    path: '/ui2/usage-metering',
    section: 'system',
    description: 'Usage metering pipeline',
    keywords: ['usage', 'metering']
  },
  {
    id: 'billing-events',
    label: 'Billing',
    icon: '💳',
    path: '/ui2/billing-events',
    section: 'system',
    description: 'Billing event processing',
    keywords: ['billing', 'events']
  },
  {
    id: 'ext-observability',
    label: 'Ext Observ',
    icon: '🔭',
    path: '/ui2/ext-observability',
    section: 'system',
    description: 'Extension observability',
    keywords: ['ext', 'observability']
  },
  {
    id: 'tenant-quota',
    label: 'Tenant Quota',
    icon: '📐',
    path: '/ui2/tenant-quota',
    section: 'system',
    description: 'Tenant quota controls',
    keywords: ['tenant', 'quota']
  },
  {
    id: 'compat-matrix',
    label: 'Compat Matrix',
    icon: '🔢',
    path: '/ui2/compat-matrix',
    section: 'system',
    description: 'Compatibility matrix',
    keywords: ['compat', 'matrix']
  },
  {
    id: 'dev-portal',
    label: 'Dev Portal',
    icon: '🌐',
    path: '/ui2/dev-portal',
    section: 'tools',
    description: 'Developer portal',
    keywords: ['dev', 'portal']
  },
  {
    id: 'support-sla',
    label: 'Support SLA',
    icon: '🎫',
    path: '/ui2/support-sla',
    section: 'system',
    description: 'Support SLA management',
    keywords: ['support', 'sla']
  },
  {
    id: 'marketplace-trust',
    label: 'Mktplace Trust',
    icon: '🔒',
    path: '/ui2/marketplace-trust',
    section: 'system',
    description: 'Marketplace trust security',
    keywords: ['marketplace', 'trust']
  },
  {
    id: 'multi-region',
    label: 'Multi-Region',
    icon: '🌏',
    path: '/ui2/multi-region',
    section: 'system',
    description: 'Multi-region traffic steering',
    keywords: ['multi', 'region']
  },
  {
    id: 'latency-budget',
    label: 'Latency Budget',
    icon: '⏱️',
    path: '/ui2/latency-budget',
    section: 'system',
    description: 'Latency budget engine',
    keywords: ['latency', 'budget']
  },
  {
    id: 'cost-profiler',
    label: 'Cost Profiler',
    icon: '💲',
    path: '/ui2/cost-profiler',
    section: 'system',
    description: 'Infrastructure cost profiler',
    keywords: ['cost', 'profiler']
  },
  {
    id: 'reliability-econ',
    label: 'Reliability Econ',
    icon: '📊',
    path: '/ui2/reliability-econ',
    section: 'system',
    description: 'Reliability economics dashboard',
    keywords: ['reliability', 'econ']
  },
  {
    id: 'regional-failover',
    label: 'Failover Drills',
    icon: '🔄',
    path: '/ui2/regional-failover',
    section: 'system',
    description: 'Regional failover drills',
    keywords: ['regional', 'failover']
  },
  {
    id: 'data-residency',
    label: 'Data Residency',
    icon: '📍',
    path: '/ui2/data-residency',
    section: 'system',
    description: 'Data residency controls',
    keywords: ['data', 'residency']
  },
  {
    id: 'ops-automation-ai',
    label: 'Ops AI',
    icon: '🤖',
    path: '/ui2/ops-automation-ai',
    section: 'system',
    description: 'AI ops automation',
    keywords: ['ops', 'automation', 'ai']
  },
  {
    id: 'hot-path',
    label: 'Hot Path',
    icon: '🔥',
    path: '/ui2/hot-path',
    section: 'system',
    description: 'Hot path profiling',
    keywords: ['hot', 'path']
  },
  {
    id: 'release-quality',
    label: 'Release Quality',
    icon: '🎯',
    path: '/ui2/release-quality',
    section: 'system',
    description: 'Release quality predictor',
    keywords: ['release', 'quality']
  },
  {
    id: 'capacity-plan',
    label: 'Capacity Plan',
    icon: '📐',
    path: '/ui2/capacity-plan',
    section: 'system',
    description: 'Capacity planning model',
    keywords: ['capacity', 'plan']
  },
  {
    id: 'platform-debt',
    label: 'Platform Debt',
    icon: '🧹',
    path: '/ui2/platform-debt',
    section: 'system',
    description: 'Technical debt retirement',
    keywords: ['platform', 'debt']
  },
  {
    id: 'operator-enable',
    label: 'Operator Enable',
    icon: '📚',
    path: '/ui2/operator-enable',
    section: 'system',
    description: 'Operator enablement',
    keywords: ['operator', 'enable']
  },
  {
    id: 'global-readiness',
    label: 'Global Ready',
    icon: '🌟',
    path: '/ui2/global-readiness',
    section: 'system',
    description: 'Global readiness certification',
    keywords: ['global', 'readiness']
  },
];

// Core Correctness Track — Autopilot, Strategies/Backtester, Workflows/Agents, Search, Ops/Settings
// All other workspaces are still routable but hidden from the left rail.
const CORE_NAV_IDS = new Set(['autopilot', 'search', 'workflow-builder', 'backtester-v3', 'broker-v2', 'runs', 'settings', 'observability-v2', 'productization', 'dataset-snapshots', 'execution-cockpit', 'control-tower', 'options-matrix', 'derivatives-oms', 'marketplace', 'global-readiness']);
const VISIBLE_WORKSPACES = WORKSPACES.filter(w => CORE_NAV_IDS.has(w.id));

export function AppShellUI2() {
  const navigate = useNavigate();
  const location = useLocation();
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [marketOpen, setMarketOpen] = useState(false);
  const [marketSession, setMarketSession] = useState<string>('closed');
  const [beGitSha, setBeGitSha] = useState<string>('');
  const [versionMismatch, setVersionMismatch] = useState(false);
  const isE2EMode = typeof window !== 'undefined' && (
    window.location.search.includes('e2e=1') || 
    window.location.search.includes('PLAYWRIGHT_TEST_BASE_URL')
  );

  // Subscribe to trading store connection status (v1.94)
  const connectionStatus = useSyncExternalStore(
    tradingStore.subscribe, 
    tradingStore.getConnectionStatus
  );

  // Phase A: Fetch backend version and check for mismatch
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/ops/version');
        if (r.ok) {
          const data = await r.json();
          if (!cancelled && data.git_sha) {
            setBeGitSha(data.git_sha);
            if (FE_GIT_SHA !== 'unknown' && data.git_sha !== FE_GIT_SHA) {
              setVersionMismatch(true);
            }
          }
        }
      } catch { /* backend unreachable */ }
    })();
    return () => { cancelled = true; };
  }, []);

  // Phase D: Fetch market session status every 30s
  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const r = await fetch('/api/ops/market_session');
        if (r.ok) {
          const data = await r.json();
          if (!cancelled) {
            setMarketOpen(data.is_open_now ?? false);
            setMarketSession(data.session ?? 'closed');
          }
        }
      } catch { /* backend unreachable */ }
    };
    poll();
    const iv = setInterval(poll, 30_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, []);

  const drawerVisible = true;
  const rightSidebarContent = (
    <div style={{ color: 'var(--ui2-text-muted)', fontSize: '13px' }}>
      Select an item to inspect
    </div>
  );
  const [bottomDockTabs] = useState([
    {
      id: 'orders',
      label: 'Orders',
      content: <OrdersBlotter embedded />,
    },
    {
      id: 'trades',
      label: 'Trades',
      content: <TradesLedger embedded />,
    },
    {
      id: 'logs',
      label: 'Logs',
      content: <div style={{ color: 'var(--ui2-text-muted)', padding: '12px', fontFamily: 'monospace', fontSize: '12px' }}>System logs stream...</div>,
    },
  ]);

  const activeWorkspace =
    WORKSPACES.find((w) => location.pathname.startsWith(w.path))?.id || 'dashboard';

  // Ctrl+K command palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Build command palette items from COMMAND_REGISTRY + workspace navigation
  // W01: Wire ticker commands to ContextBus
  const setActiveSymbol = useContextBus((s) => s.setActiveSymbol);
  const commands: CommandItem[] = [
    ...WORKSPACES.map((ws) => ({
      id: ws.id,
      label: ws.label,
      description: ws.description,
      icon: ws.icon,
      category: 'navigation' as const,
      keywords: ws.keywords,
      path: ws.path,
    })),
    ...COMMAND_REGISTRY.map(c => ({
      id: c.id,
      label: c.label,
      description: c.description,
      icon: c.icon,
      category: c.category,
      keywords: c.keywords,
      path: c.path,
      // W01: Ticker commands set the active symbol via ContextBus
      ...(c.action?.startsWith('select-ticker-') ? {
        onSelect: () => setActiveSymbol(c.action!.replace('select-ticker-', '')),
      } : {}),
    })),
  ];

  return (
    <ToastProvider>
    {/* Phase A: Version mismatch banner */}
    {versionMismatch && (
      <div data-testid="version-mismatch-banner" style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 10000,
        background: '#d97706', color: '#fff', textAlign: 'center',
        padding: '6px 16px', fontSize: '12px', fontWeight: 600
      }}>
        Version mismatch — FE: {FE_GIT_SHA} / BE: {beGitSha}. Hard-refresh recommended.
      </div>
    )}
    {/* W104 — Skip-to-main-content link (visible on keyboard focus) */}
    <a
      href="#main-content"
      data-testid="skip-to-main"
      style={{
        position: 'fixed',
        top: '-40px',
        left: '8px',
        zIndex: 9999,
        padding: '8px 16px',
        background: 'var(--ui2-brand-primary, #4f8ef7)',
        color: '#fff',
        fontWeight: 600,
        fontSize: '13px',
        borderRadius: '4px',
        textDecoration: 'none',
        transition: 'top 0.1s',
      }}
      onFocus={(e) => { e.currentTarget.style.top = '8px'; }}
      onBlur={(e) => { e.currentTarget.style.top = '-40px'; }}
    >
      Skip to main content
    </a>
    <div
      className="ui2-root"
      data-testid="ui2-app-shell"
      data-e2e-mode={isE2EMode ? 'true' : 'false'}
      style={{
        width: '100vw',
        height: '100vh',
        display: 'grid',
        gridTemplateRows: '48px 32px 1fr 240px',
        gridTemplateColumns: '56px auto 1fr auto',
        gridTemplateAreas: `
          "topbar topbar topbar topbar"
          "tape tape tape tape"
          "rail drawer center sidebar"
          "rail dock dock dock"
        `,
        background: 'var(--ui2-bg-base)',
        overflow: 'hidden',
      }}
    >
      {/* TopBar */}
      <div
        data-testid="ui2-topbar"
        style={{
          gridArea: 'topbar',
          background: 'var(--ui2-bg-elevated)',
          borderBottom: '1px solid var(--ui2-border)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          gap: '16px',
        }}
      >
        {/* Brand */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: 'var(--ui2-radius-md)',
              background: 'linear-gradient(135deg, var(--ui2-brand-primary) 0%, var(--ui2-brand-hover) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
              fontWeight: 700,
              color: 'white',
            }}
          >
            A
          </div>
          <div>
            <div
              style={{
                fontSize: '14px',
                fontWeight: 700,
                color: 'var(--ui2-text-primary)',
                lineHeight: 1,
              }}
            >
              Apex Terminal
            </div>
            <div
              style={{
                fontSize: '10px',
                color: 'var(--ui2-text-tertiary)',
                lineHeight: 1,
                marginTop: '2px',
              }}
            >
              Professional Edition
            </div>
          </div>
        </div>

        {/* Command Search Input (triggers palette) */}
        <button
          onClick={() => setCommandPaletteOpen(true)}
          data-testid="ui2-command-trigger"
          aria-label="Open command palette (Ctrl+K)"
          style={{
            flex: 1,
            maxWidth: '600px',
            padding: '6px 12px',
            fontSize: '13px',
            background: 'var(--ui2-bg-input)',
            border: '1px solid var(--ui2-border)',
            borderRadius: 'var(--ui2-radius-md)',
            color: 'var(--ui2-text-tertiary)',
            textAlign: 'left',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            transition: 'border-color var(--ui2-transition-fast)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--ui2-border-strong)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--ui2-border)';
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>🔍</span>
            <span>Search or run command...</span>
          </div>
          <div
            style={{
              fontSize: '11px',
              padding: '2px 6px',
              background: 'var(--ui2-bg-elevated)',
              borderRadius: 'var(--ui2-radius-sm)',
              color: 'var(--ui2-text-secondary)',
            }}
          >
            Ctrl+K
          </div>
        </button>

        <div style={{ flex: 1 }} />

        {/* W01: Active Symbol Indicator from ContextBus */}
        <div
          data-testid="ui2-active-symbol"
          style={{
            padding: '4px 10px',
            background: 'var(--ui2-bg-panel)',
            border: '1px solid var(--ui2-brand-primary, #6366f1)',
            borderRadius: 'var(--ui2-radius-md)',
            fontSize: '13px',
            fontWeight: 700,
            color: 'var(--ui2-brand-primary, #6366f1)',
            fontFamily: 'monospace',
            letterSpacing: '0.5px',
          }}
        >
          {useContextBus((s) => s.activeSymbol)}
        </div>

        {/* Status Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
          {/* Data Mode Badge */}
          <div className="ui2-badge ui2-badge-info" data-testid="ui2-mode-badge">
            <span>🌐</span>
            <span data-testid="ui2-data-mode-badge">Online</span>
          </div>

          {/* Market Status — fetched from backend */}
          <div
            className={`ui2-badge ${marketOpen ? 'ui2-badge-success' : 'ui2-badge-neutral'}`}
            data-testid="ui2-market-status"
            data-market-session={marketSession}
          >
            <span>{marketOpen ? '●' : '○'}</span>
            <span>{marketOpen ? 'Market Open' : marketSession === 'pre' ? 'Pre-Market' : marketSession === 'post' ? 'After Hours' : 'Market Closed'}</span>
          </div>

          {/* Connectivity (v1.94: Real status from tradingStore) */}
          <div 
            className={`ui2-badge ${
              connectionStatus === 'connected' ? 'ui2-badge-success' :
              connectionStatus === 'connecting' ? 'ui2-badge-warning' :
              connectionStatus === 'fallback' ? 'ui2-badge-warning' :
              'ui2-badge-neutral'
            }`} 
            data-testid="ui2-conn-status"
            title={`Connection: ${connectionStatus}`}
          >
            <span>{connectionStatus === 'connected' ? '⚡' : connectionStatus === 'connecting' ? '⏳' : connectionStatus === 'fallback' ? '📡' : '○'}</span>
            <span>
              {connectionStatus === 'connected' ? 'WS' :
               connectionStatus === 'connecting' ? 'Connecting' :
               connectionStatus === 'fallback' ? 'Polling' :
               'Offline'}
            </span>
          </div>

          {/* User Profile */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '4px 10px',
              background: 'var(--ui2-bg-panel)',
              borderRadius: 'var(--ui2-radius-md)',
              border: '1px solid var(--ui2-border)',
            }}
          >
            <div
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--ui2-brand-primary) 0%, var(--ui2-brand-hover) 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '10px',
                color: 'white',
                fontWeight: 600,
              }}
            >
              {APEX_USER.name.slice(0, 2).toUpperCase()}
            </div>
            <span style={{ color: 'var(--ui2-text-primary)', fontSize: '13px', fontWeight: 500 }}>
              {APEX_USER.name}
            </span>
          </div>
        </div>
      </div>

      {/* MarketTape */}
      <div style={{ gridArea: 'tape' }}>
        <MarketTape />
      </div>

      {/* LeftRail */}
      <div
        data-testid="ui2-left-rail"
        style={{
          gridArea: 'rail',
          background: 'var(--ui2-bg-elevated)',
          borderRight: '1px solid var(--ui2-border)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingTop: '8px',
          gap: '4px',
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
      >
        {VISIBLE_WORKSPACES.map((workspace, i) => {
          const isActive = activeWorkspace === workspace.id;
          const prevSection = i > 0 ? VISIBLE_WORKSPACES[i - 1].section : undefined;
          const showDivider = prevSection && workspace.section !== prevSection;
          return (
            <div key={workspace.id} style={{ display: 'contents' }}>
              {showDivider && (
                <div style={{ width: '32px', height: '1px', background: 'var(--ui2-border)', margin: '4px 0' }} />
              )}
              <button
                data-testid={`ui2-rail-${workspace.id}`}
                onClick={() => navigate(workspace.path)}
                title={workspace.label}
                aria-label={workspace.label}
                style={{
                  width: '36px',
                  height: '36px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                  background: isActive ? 'var(--ui2-bg-selected)' : 'transparent',
                  border: 'none',
                  borderRadius: 'var(--ui2-radius-md)',
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                  borderLeft: isActive ? '3px solid var(--ui2-brand)' : '3px solid transparent',
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'var(--ui2-bg-hover)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                {workspace.icon}
              </button>
            </div>
          );
        })}
      </div>

      {/* LeftDrawer */}
      {drawerVisible && (
        <div
          data-testid="ui2-left-drawer"
          style={{
            gridArea: 'drawer',
            width: '240px',
            background: 'var(--ui2-bg-panel)',
            borderRight: '1px solid var(--ui2-border)',
            overflow: 'auto',
            padding: '12px',
          }}
        >
          <div
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--ui2-text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '8px',
            }}
          >
            {WORKSPACES.find((w) => w.id === activeWorkspace)?.label || 'Workspace'}
          </div>
          <div style={{ color: 'var(--ui2-text-muted)', fontSize: '12px' }}>
            Context-sensitive list (watchlist, strategies, portfolios, etc.)
          </div>
        </div>
      )}

      {/* Center Workspace */}
      <div
        id="main-content"
        role="main"
        aria-label="Main workspace"
        data-testid="ui2-center"
        style={{
          gridArea: 'center',
          background: 'var(--ui2-bg-base)',
          overflow: 'auto',
          position: 'relative',
        }}
      >
        <Outlet />
      </div>

      {/* RightSidebar */}
      <div style={{ gridArea: 'sidebar' }}>
        <RightSidebar testId="ui2-right-sidebar">{rightSidebarContent}</RightSidebar>
      </div>

      {/* BottomDock */}
      <div style={{ gridArea: 'dock' }}>
        <BottomDock
          tabs={bottomDockTabs}
          defaultTab="orders"
          testId="ui2-bottom-dock"
        />
      </div>

      {/* Command Palette (Ctrl+K) */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        commands={commands}
        testId="command-palette"
      />
    </div>
    </ToastProvider>
  );
}
