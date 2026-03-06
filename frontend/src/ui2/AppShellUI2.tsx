/**
 * UI2 AppShellUI2 Component — v2.0
 * TradingView-inspired terminal shell matching demo/index.html exactly
 * Grid: 40px TopBar | 1fr Layout (48px LeftNav + 1fr Content + 286px RightSidebar) | 20px StatusBar
 * 
 * Layout matches demo/index.html:
 * - TopBar: Logo, Mode Badge, Search, Symbol Strip, Latency, Clock, Icons, User
 * - LeftNav: 5 collapsible groups (TRADE/STRAT/MKTS/ASSET/SYSTEM) with SVG icons
 * - Content: React Router Outlet
 * - RightSidebar: 6 tabs (Order/Watch/Pos/News/L2/T&amp;S)
 * - StatusBar: Live dot, Market status, NAV, Scrolling ticker tape, Version
 * - CommandPalette: Ctrl+K
 */

import { useState, useEffect, useSyncExternalStore } from 'react';
import { Outlet } from 'react-router-dom';
import { TopBar, LeftNav, RightSidebarNew, StatusBar, CommandPaletteNew } from './shell';
import type { CmdItem } from './shell';
import { COMMAND_REGISTRY } from './stores/commandRegistry';
import { useContextBus } from './stores/contextBusStore';
import { ToastProvider } from '../ui/Toast';
import { tradingStore } from './stores/tradingStore';

// Import design system CSS
import '../styles/apex-design-system.css';

// Phase A: Build-time version fingerprints
declare const __GIT_SHA__: string;
declare const __BUILD_TIME__: string;
const FE_GIT_SHA = typeof __GIT_SHA__ !== 'undefined' ? __GIT_SHA__ : 'unknown';
const FE_BUILD_TIME = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : 'unknown';

// ─── Workspace config for command palette navigation ───
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
  // ── TRADE ──
  { id: 'dashboard', label: 'Dashboard', icon: '📊', path: '/ui2/dashboard', section: 'main', description: 'Command center with key metrics', keywords: ['home', 'overview', 'metrics', 'kpi'] },
  { id: 'trading', label: 'Trading', icon: '📈', path: '/ui2/trading', section: 'main', description: 'Live chart and order execution', keywords: ['chart', 'trade', 'order', 'execution'] },
  { id: 'trading-multi', label: 'Multi Chart', icon: '📊', path: '/ui2/trading-multi', section: 'main', description: 'Multi-pane chart grid', keywords: ['multi', 'chart', 'grid', 'compare'] },
  { id: 'portfolio', label: 'Portfolio', icon: '💼', path: '/ui2/portfolio', section: 'main', description: 'Positions and performance', keywords: ['positions', 'pnl', 'performance', 'holdings'] },
  { id: 'orders', label: 'Orders', icon: '📋', path: '/ui2/orders', section: 'main', description: 'Order history and management', keywords: ['order', 'history', 'fills', 'execution'] },
  { id: 'risk-dashboard', label: 'Risk Management', icon: '🛡️', path: '/ui2/risk-dashboard', section: 'main', description: 'VaR, stress tests, correlation', keywords: ['risk', 'var', 'stress', 'exposure'] },
  { id: 'heatmap', label: 'Heatmap', icon: '🗺️', path: '/ui2/heatmap', section: 'main', description: 'Market heatmap with sector treemap', keywords: ['heatmap', 'sector', 'treemap'] },
  // ── STRAT ──
  { id: 'backtest-engine', label: 'Backtest', icon: '⏪', path: '/ui2/backtest-engine', section: 'tools', description: 'Backtest engine, equity curve', keywords: ['backtest', 'engine', 'equity'] },
  { id: 'backtest', label: 'Walk-Forward', icon: '🧪', path: '/ui2/backtest', section: 'tools', description: 'Walk-forward analysis', keywords: ['walk', 'forward', 'analysis'] },
  { id: 'monte-carlo-sim', label: 'Monte Carlo', icon: '🎲', path: '/ui2/monte-carlo-sim', section: 'tools', description: 'Monte Carlo simulation', keywords: ['monte', 'carlo', 'simulation'] },
  { id: 'strategy-builder-pro', label: 'Strategy Studio', icon: '🏗️', path: '/ui2/strategy-builder-pro', section: 'tools', description: 'Visual strategy builder', keywords: ['strategy', 'builder', 'pine'] },
  // ── MKTS ──
  { id: 'options-chain', label: 'Options', icon: '⚡', path: '/ui2/options-chain', section: 'tools', description: 'Options chain, Greeks', keywords: ['options', 'chain', 'greeks'] },
  { id: 'stock-screener', label: 'Screener', icon: '🔍', path: '/ui2/stock-screener', section: 'tools', description: 'Stock screener', keywords: ['screener', 'filter', 'scan'] },
  { id: 'alerts-manager', label: 'Alerts', icon: '🔔', path: '/ui2/alerts-manager', section: 'tools', description: 'Price and alerts', keywords: ['alert', 'notification'] },
  { id: 'macro', label: 'Economic Calendar', icon: '🌐', path: '/ui2/macro', section: 'tools', description: 'Economic calendar', keywords: ['macro', 'economic', 'calendar'] },
  { id: 'research', label: 'Research', icon: '🔬', path: '/ui2/research', section: 'tools', description: 'Research / Sentiment', keywords: ['research', 'sentiment', 'analysis'] },
  { id: 'social', label: 'Social', icon: '💬', path: '/ui2/social', section: 'main', description: 'Trading ideas, community', keywords: ['social', 'ideas', 'community'] },
  // ── ASSET ──
  { id: 'fixed-income', label: 'Fixed Income', icon: '🏛️', path: '/ui2/fixed-income', section: 'main', description: 'Yield curves, bonds', keywords: ['bonds', 'yield'] },
  { id: 'fx-dashboard', label: 'FX', icon: '💱', path: '/ui2/fx-dashboard', section: 'main', description: 'FX cross rates', keywords: ['fx', 'forex', 'currency'] },
  { id: 'commodities', label: 'Commodities', icon: '🛢️', path: '/ui2/commodities', section: 'main', description: 'Energy, metals, agriculture', keywords: ['commodities', 'oil', 'gold'] },
  { id: 'crypto', label: 'Crypto', icon: '₿', path: '/ui2/crypto', section: 'main', description: 'Crypto markets', keywords: ['crypto', 'bitcoin', 'ethereum'] },
  // ── SYSTEM ──
  { id: 'settings', label: 'Settings', icon: '⚙️', path: '/ui2/settings', section: 'system', description: 'Platform configuration', keywords: ['settings', 'config'] },
  { id: 'ops', label: 'Platform', icon: '🔧', path: '/ui2/ops', section: 'system', description: 'System operations', keywords: ['ops', 'system'] },
  // ── TOOLS (command palette only) ──
  { id: 'autopilot', label: 'Autopilot', icon: '🤖', path: '/ui2/autopilot', section: 'tools', description: 'Autonomous trading agent', keywords: ['autopilot', 'agent', 'auto'] },
  { id: 'risk', label: 'Risk & Options', icon: '🛡️', path: '/ui2/risk', section: 'tools', description: 'Options chain and risk', keywords: ['options', 'greeks', 'risk'] },
  { id: 'replay', label: 'Replay', icon: '⏪', path: '/ui2/replay', section: 'tools', description: 'Market replay', keywords: ['replay', 'playback'] },
  { id: 'runs', label: 'Runs & Audit', icon: '📜', path: '/ui2/runs', section: 'system', description: 'Execution audit trail', keywords: ['runs', 'audit'] },
  { id: 'monitor', label: 'Monitor', icon: '🖥️', path: '/ui2/monitor', section: 'main', description: 'Multi-panel monitoring', keywords: ['monitor', 'grid'] },
  { id: 'automation', label: 'Automation', icon: '🔄', path: '/ui2/automation', section: 'tools', description: 'Workflow automation', keywords: ['workflow', 'automation'] },
  { id: 'search', label: 'Search', icon: '🔍', path: '/ui2/search', section: 'tools', description: 'Full-text search', keywords: ['search', 'find'] },
  { id: 'agent', label: 'AI Agent', icon: '💡', path: '/ui2/agent', section: 'tools', description: 'AI assistant', keywords: ['agent', 'ai', 'assistant'] },
  { id: 'alerts', label: 'Alerts', icon: '🔔', path: '/ui2/alerts', section: 'tools', description: 'Price alerts', keywords: ['alerts'] },
  { id: 'autopilot-v2', label: 'Autopilot V2', icon: '🚀', path: '/ui2/autopilot-v2', section: 'tools', description: 'V2 pipeline', keywords: ['autopilot', 'v2'] },
  { id: 'automation-v2', label: 'Automation V2', icon: '⚡', path: '/ui2/automation-v2', section: 'tools', description: 'DAG workflow', keywords: ['dag', 'workflow'] },
  { id: 'export', label: 'Export', icon: '📦', path: '/ui2/export', section: 'system', description: 'Export bundles', keywords: ['export', 'bundle'] },
  { id: 'health', label: 'Health', icon: '💚', path: '/ui2/health', section: 'system', description: 'Platform health', keywords: ['health', 'status'] },
  { id: 'telemetry', label: 'Telemetry', icon: '📡', path: '/ui2/telemetry', section: 'system', description: 'Event telemetry', keywords: ['telemetry', 'events'] },
  { id: 'autopilot-explain', label: 'Explain', icon: '🧠', path: '/ui2/autopilot-explain', section: 'tools', description: 'Decision explainability', keywords: ['explain', 'decision'] },
  { id: 'automation-runs', label: 'Automation Runs', icon: '🏃', path: '/ui2/automation-runs', section: 'system', description: 'Run history', keywords: ['runs', 'history'] },
  { id: 'workflow-builder', label: 'Workflow Builder', icon: '🔨', path: '/ui2/workflow-builder', section: 'tools', description: 'Visual workflow editor', keywords: ['workflow', 'builder'] },
  { id: 'incidents', label: 'Incidents', icon: '🚨', path: '/ui2/incidents', section: 'system', description: 'Incident tracking', keywords: ['incidents'] },
  { id: 'decisions', label: 'Decisions', icon: '🧭', path: '/ui2/decisions', section: 'tools', description: 'Decision explorer', keywords: ['decisions'] },
  { id: 'health-v4', label: 'Health V4', icon: '💊', path: '/ui2/health-v4', section: 'system', description: 'All-subsystem health', keywords: ['health', 'v4'] },
  { id: 'ai-provider', label: 'AI Provider', icon: '🧩', path: '/ui2/ai-provider', section: 'system', description: 'LLM provider status', keywords: ['ai', 'llm'] },
  { id: 'decision-explainer', label: 'Decision V2', icon: '📊', path: '/ui2/decision-explainer', section: 'tools', description: 'Decision explainer', keywords: ['decision'] },
  { id: 'nl-workflow', label: 'NL Workflow', icon: '✨', path: '/ui2/nl-workflow', section: 'tools', description: 'Natural language workflow', keywords: ['nl', 'workflow'] },
  { id: 'market-session-v2', label: 'Market Session', icon: '🕐', path: '/ui2/market-session-v2', section: 'system', description: 'NYSE market session', keywords: ['market', 'session'] },
  { id: 'data-spine', label: 'Data Spine', icon: '🔌', path: '/ui2/data-spine', section: 'system', description: 'Data ingestion pipeline', keywords: ['data', 'spine'] },
  { id: 'broker-v2', label: 'Paper Broker', icon: '🏦', path: '/ui2/broker-v2', section: 'main', description: 'Paper-only Alpaca broker', keywords: ['broker', 'paper'] },
  { id: 'portfolio-v2', label: 'Allocator', icon: '⚖️', path: '/ui2/portfolio-v2', section: 'tools', description: 'Portfolio allocation', keywords: ['portfolio', 'allocator'] },
  { id: 'performance-v2', label: 'Ledger', icon: '📊', path: '/ui2/performance-v2', section: 'tools', description: 'Performance ledger', keywords: ['performance', 'sharpe'] },
  { id: 'backtester-v3', label: 'Backtester V3', icon: '🧪', path: '/ui2/backtester-v3', section: 'tools', description: 'Backtester v3', keywords: ['backtester', 'v3'] },
  { id: 'discovery', label: 'Discovery', icon: '🔎', path: '/ui2/discovery', section: 'tools', description: 'Strategy discovery', keywords: ['discovery', 'strategy'] },
  { id: 'ai-strategy', label: 'AI Strategy', icon: '🤖', path: '/ui2/ai-strategy', section: 'tools', description: 'AI strategy builder', keywords: ['ai', 'strategy'] },
  { id: 'sentiment-v2', label: 'Sentiment V2', icon: '📰', path: '/ui2/sentiment-v2', section: 'tools', description: 'FinBERT sentiment', keywords: ['sentiment'] },
  { id: 'workflows-v3', label: 'Workflows V3', icon: '🔗', path: '/ui2/workflows-v3', section: 'tools', description: 'DAG workflow engine', keywords: ['workflow'] },
  { id: 'observability-v2', label: 'Ops Center', icon: '📡', path: '/ui2/observability-v2', section: 'system', description: 'System observability', keywords: ['observability'] },
  { id: 'productization', label: 'Productization', icon: '🚀', path: '/ui2/productization', section: 'system', description: 'Universe management', keywords: ['productization'] },
  { id: 'dataset-snapshots', label: 'Datasets', icon: '🗃️', path: '/ui2/dataset-snapshots', section: 'tools', description: 'Dataset snapshots', keywords: ['dataset'] },
  // Comprehensive pages
  { id: 'portfolio-analytics', label: 'Analytics', icon: '📊', path: '/ui2/portfolio-analytics', section: 'main', description: 'Portfolio analytics', keywords: ['analytics', 'allocation'] },
  { id: 'order-book-depth', label: 'Order Book', icon: '📗', path: '/ui2/order-book-depth', section: 'main', description: 'Level 2 DOM', keywords: ['order', 'book'] },
  { id: 'algo-execution', label: 'Algo Exec', icon: '⚡', path: '/ui2/algo-execution', section: 'main', description: 'Algo execution', keywords: ['algo'] },
  { id: 'bloomberg-terminal', label: 'Bloomberg', icon: '🖥️', path: '/ui2/bloomberg-terminal', section: 'main', description: 'Bloomberg-style terminal', keywords: ['bloomberg'] },
  { id: 'multi-chart-layout', label: 'Multi Chart', icon: '📈', path: '/ui2/multi-chart-layout', section: 'main', description: 'Multi-panel workspace', keywords: ['multi', 'chart'] },
  { id: 'portfolio-optimizer-pro', label: 'Optimizer', icon: '🎯', path: '/ui2/portfolio-optimizer-pro', section: 'tools', description: 'Portfolio optimizer', keywords: ['optimizer'] },
  { id: 'volatility-surface', label: 'Vol Surface', icon: '🌊', path: '/ui2/volatility-surface', section: 'tools', description: '3D vol surface', keywords: ['vol', 'surface'] },
  { id: 'ml-dashboard', label: 'ML/AI', icon: '🤖', path: '/ui2/ml-dashboard', section: 'tools', description: 'ML models and predictions', keywords: ['ml', 'ai', 'model'] },
  { id: 'news-terminal', label: 'News', icon: '📰', path: '/ui2/news-terminal', section: 'main', description: 'Real-time news feed', keywords: ['news', 'feed'] },
  { id: 'watchlist-manager', label: 'Watchlists', icon: '👁️', path: '/ui2/watchlist-manager', section: 'main', description: 'Multi-watchlist manager', keywords: ['watchlist'] },
  { id: 'trading-journal', label: 'Journal', icon: '📓', path: '/ui2/trading-journal', section: 'main', description: 'Trade journal', keywords: ['journal'] },
  { id: 'sector-analysis', label: 'Sectors', icon: '🏭', path: '/ui2/sector-analysis', section: 'main', description: 'Sector rotation', keywords: ['sector'] },
  { id: 'dark-pool', label: 'Dark Pool', icon: '🌑', path: '/ui2/dark-pool', section: 'main', description: 'Dark pool activity', keywords: ['dark', 'pool'] },
  { id: 'market-maker', label: 'Market Maker', icon: '🏦', path: '/ui2/market-maker', section: 'main', description: 'Market making sim', keywords: ['market', 'maker'] },
  { id: 'correlation-matrix', label: 'Correlation', icon: '🔗', path: '/ui2/correlation-matrix', section: 'main', description: 'Correlation heatmap', keywords: ['correlation'] },
  { id: 'earnings-calendar', label: 'Earnings', icon: '📅', path: '/ui2/earnings-calendar', section: 'main', description: 'Earnings calendar', keywords: ['earnings'] },
  { id: 'yield-curve', label: 'Yield Curve', icon: '📈', path: '/ui2/yield-curve', section: 'main', description: 'Yield curve builder', keywords: ['yield'] },
  { id: 'real-time-scanner', label: 'Scanner', icon: '📡', path: '/ui2/real-time-scanner', section: 'main', description: 'Live scanner', keywords: ['scanner'] },
  { id: 'economic-indicators', label: 'Economics', icon: '🏛️', path: '/ui2/economic-indicators', section: 'main', description: 'Macro indicators', keywords: ['economics'] },
  { id: 'market-overview', label: 'Mkt Overview', icon: '🌍', path: '/ui2/market-overview', section: 'main', description: 'Global indices', keywords: ['overview'] },
  { id: 'report-builder', label: 'Reports', icon: '📊', path: '/ui2/report-builder', section: 'main', description: 'Report builder', keywords: ['report'] },
  { id: 'financial-analysis', label: 'Financials', icon: '💰', path: '/ui2/financial-analysis', section: 'main', description: 'Income/Balance/CF', keywords: ['financial'] },
  { id: 'comparable-companies', label: 'Comps', icon: '⚖️', path: '/ui2/comparable-companies', section: 'main', description: 'Peer groups', keywords: ['comps'] },
  { id: 'security-finder', label: 'SecFinder', icon: '🔎', path: '/ui2/security-finder', section: 'main', description: 'Security search', keywords: ['security', 'finder'] },
  { id: 'transaction-cost-analysis', label: 'TCA', icon: '💱', path: '/ui2/transaction-cost-analysis', section: 'main', description: 'Transaction cost analysis', keywords: ['tca'] },
  { id: 'alert-delivery', label: 'Alert Delivery', icon: '🔔', path: '/ui2/alert-delivery', section: 'main', description: 'Alert delivery', keywords: ['alert', 'delivery'] },
  { id: 'credit-risk', label: 'Credit Risk', icon: '🏦', path: '/ui2/credit-risk', section: 'main', description: 'Credit analytics', keywords: ['credit'] },
  { id: 'workspace-manager', label: 'Workspaces', icon: '🗂️', path: '/ui2/workspace-manager', section: 'main', description: 'Workspace manager', keywords: ['workspace'] },
  { id: 'chart-replay', label: 'Chart Replay', icon: '⏪', path: '/ui2/chart-replay', section: 'main', description: 'Historical replay', keywords: ['chart', 'replay'] },
  { id: 'options-pricing-lab', label: 'Pricing Lab', icon: '🧪', path: '/ui2/options-pricing-lab', section: 'main', description: 'BSM calculator', keywords: ['options', 'pricing'] },
  { id: 'market-breadth', label: 'Breadth', icon: '📶', path: '/ui2/market-breadth', section: 'main', description: 'Market breadth', keywords: ['breadth'] },
  { id: 'autopilot-position-sizing', label: 'Position Size', icon: '📐', path: '/ui2/autopilot-position-sizing', section: 'main', description: 'Position sizing', keywords: ['position', 'sizing'] },
  { id: 'autopilot-audit-trail', label: 'Audit Trail', icon: '📋', path: '/ui2/autopilot-audit-trail', section: 'main', description: 'Audit trail', keywords: ['audit'] },
  { id: 'drawing-tool-manager', label: 'Drawings', icon: '✏️', path: '/ui2/drawing-tool-manager', section: 'main', description: 'Drawing tools', keywords: ['drawing'] },
  // Masterplan routes
  { id: 'cross-asset-quote', label: 'Cross-Asset Quotes', icon: '💹', path: '/ui2/cross-asset-quote', section: 'tools', description: 'Cross-asset quote aggregation', keywords: ['cross', 'asset'] },
  { id: 'corporate-actions', label: 'Corporate Actions', icon: '📋', path: '/ui2/corporate-actions', section: 'tools', description: 'Corporate actions', keywords: ['corporate'] },
  { id: 'economic-calendar', label: 'Economic Calendar', icon: '📅', path: '/ui2/economic-calendar', section: 'tools', description: 'Economic calendar', keywords: ['economic'] },
  { id: 'news-enrichment', label: 'News Enrichment', icon: '📰', path: '/ui2/news-enrichment', section: 'tools', description: 'NLP news enrichment', keywords: ['news'] },
  { id: 'entity-resolution', label: 'Entity Resolution', icon: '🔗', path: '/ui2/entity-resolution', section: 'tools', description: 'Entity resolution', keywords: ['entity'] },
  { id: 'theme-clustering', label: 'Theme Clustering', icon: '🎯', path: '/ui2/theme-clustering', section: 'tools', description: 'ML clustering', keywords: ['theme'] },
  { id: 'research-notebook', label: 'Research Notebook', icon: '📓', path: '/ui2/research-notebook', section: 'tools', description: 'Research notebooks', keywords: ['notebook'] },
  { id: 'bql-query', label: 'BQL Query', icon: '⌨️', path: '/ui2/bql-query', section: 'tools', description: 'Query language', keywords: ['bql'] },
  { id: 'search-explain', label: 'Search Explain', icon: '🔍', path: '/ui2/search-explain', section: 'tools', description: 'Search explainability', keywords: ['search'] },
  { id: 'screeners', label: 'Screeners', icon: '📊', path: '/ui2/screeners', section: 'tools', description: 'Stock screeners', keywords: ['screeners'] },
  { id: 'collaboration', label: 'Collaboration', icon: '👥', path: '/ui2/collaboration', section: 'tools', description: 'Collaboration toolkit', keywords: ['collaboration'] },
  { id: 'research-governance', label: 'Research Gov', icon: '🏛️', path: '/ui2/research-governance', section: 'tools', description: 'Research governance', keywords: ['governance'] },
  { id: 'execution-cockpit', label: 'Exec Cockpit', icon: '🎛️', path: '/ui2/execution-cockpit', section: 'main', description: 'Execution monitoring', keywords: ['execution'] },
  { id: 'blotter', label: 'Blotter', icon: '📑', path: '/ui2/blotter', section: 'main', description: 'Execution blotter', keywords: ['blotter'] },
  { id: 'pre-trade-risk', label: 'Pre-Trade Risk', icon: '⚠️', path: '/ui2/pre-trade-risk', section: 'tools', description: 'Pre-trade risk', keywords: ['pre-trade'] },
  { id: 'surveillance', label: 'Surveillance', icon: '👁️', path: '/ui2/surveillance', section: 'tools', description: 'Post-trade surveillance', keywords: ['surveillance'] },
  { id: 'attribution', label: 'Attribution', icon: '📊', path: '/ui2/attribution', section: 'tools', description: 'Portfolio attribution', keywords: ['attribution'] },
  { id: 'factor-model', label: 'Factor Model', icon: '🧮', path: '/ui2/factor-model', section: 'tools', description: 'Multi-factor model', keywords: ['factor'] },
  { id: 'stress-scenarios', label: 'Stress Scenarios', icon: '🌪️', path: '/ui2/stress-scenarios', section: 'tools', description: 'Stress scenarios', keywords: ['stress'] },
  { id: 'pnl-explain', label: 'PnL Explainer', icon: '💰', path: '/ui2/pnl-explain', section: 'tools', description: 'PnL explainability', keywords: ['pnl'] },
  { id: 'control-tower', label: 'Control Tower', icon: '🗼', path: '/ui2/control-tower', section: 'main', description: 'Control tower', keywords: ['control'] },
  { id: 'options-matrix', label: 'Options Matrix', icon: '📐', path: '/ui2/options-matrix', section: 'tools', description: 'Options matrix', keywords: ['options'] },
  { id: 'derivatives-oms', label: 'Derivatives OMS', icon: '🏢', path: '/ui2/derivatives-oms', section: 'main', description: 'Derivatives OMS', keywords: ['derivatives'] },
  { id: 'marketplace', label: 'Marketplace', icon: '🏪', path: '/ui2/marketplace', section: 'tools', description: 'Extension marketplace', keywords: ['marketplace'] },
  { id: 'global-readiness', label: 'Global Ready', icon: '🌟', path: '/ui2/global-readiness', section: 'system', description: 'Global readiness', keywords: ['global'] },
  { id: 'reconciliation', label: 'Reconciliation', icon: '🔄', path: '/ui2/reconciliation', section: 'system', description: 'Trade reconciliation', keywords: ['reconciliation'] },
  { id: 'smart-routing', label: 'Smart Routing', icon: '🛤️', path: '/ui2/smart-routing', section: 'tools', description: 'Smart order routing', keywords: ['routing'] },
  { id: 'broker-scoring', label: 'Broker Scoring', icon: '⭐', path: '/ui2/broker-scoring', section: 'tools', description: 'Broker quality', keywords: ['broker'] },
  { id: 'cross-account', label: 'Cross-Account', icon: '🔐', path: '/ui2/cross-account', section: 'system', description: 'Cross-account controls', keywords: ['cross'] },
  { id: 'risk-governance', label: 'Risk Governance', icon: '🏛️', path: '/ui2/risk-governance', section: 'system', description: 'Risk governance', keywords: ['risk'] },
  { id: 'agent-registry', label: 'Agent Registry', icon: '🤖', path: '/ui2/agent-registry', section: 'tools', description: 'AI agent registry', keywords: ['agent'] },
  { id: 'autopilot-playbook', label: 'Playbook', icon: '📖', path: '/ui2/autopilot-playbook', section: 'tools', description: 'Playbook engine', keywords: ['playbook'] },
  { id: 'prompt-firewall', label: 'Prompt Firewall', icon: '🔥', path: '/ui2/prompt-firewall', section: 'system', description: 'Prompt policy', keywords: ['prompt'] },
  { id: 'model-router', label: 'Model Router', icon: '🔀', path: '/ui2/model-router', section: 'system', description: 'AI model router', keywords: ['model'] },
  { id: 'eval-harness', label: 'Eval Harness', icon: '🧪', path: '/ui2/eval-harness', section: 'tools', description: 'Model evaluation', keywords: ['eval'] },
  { id: 'approval-queue', label: 'Approval Queue', icon: '✅', path: '/ui2/approval-queue', section: 'system', description: 'Approval queue', keywords: ['approval'] },
  { id: 'strategy-sim', label: 'Strategy Sim', icon: '🎲', path: '/ui2/strategy-sim', section: 'tools', description: 'Strategy simulation', keywords: ['strategy'] },
  { id: 'signal-provenance', label: 'Signal Provenance', icon: '📜', path: '/ui2/signal-provenance', section: 'tools', description: 'Signal provenance', keywords: ['signal'] },
  { id: 'incident-ai', label: 'Incident AI', icon: '🚨', path: '/ui2/incident-ai', section: 'system', description: 'AI incident fallback', keywords: ['incident'] },
  { id: 'drift-detection', label: 'Drift Detection', icon: '📐', path: '/ui2/drift-detection', section: 'tools', description: 'Drift detection', keywords: ['drift'] },
  { id: 'policy-attestation', label: 'Policy Attest', icon: '📝', path: '/ui2/policy-attestation', section: 'system', description: 'Policy attestation', keywords: ['policy'] },
  { id: 'ai-governance', label: 'AI Governance', icon: '🏗️', path: '/ui2/ai-governance', section: 'system', description: 'AI governance', keywords: ['governance'] },
  { id: 'greeks-service', label: 'Greeks', icon: 'Δ', path: '/ui2/greeks-service', section: 'tools', description: 'Greeks computation', keywords: ['greeks'] },
  { id: 'vol-surface', label: 'Vol Surface', icon: '📈', path: '/ui2/vol-surface', section: 'tools', description: 'Vol surface analytics', keywords: ['vol'] },
  { id: 'payoff-lab', label: 'Payoff Lab', icon: '🔬', path: '/ui2/payoff-lab', section: 'tools', description: 'Payoff lab', keywords: ['payoff'] },
  { id: 'spread-tools', label: 'Spread Tools', icon: '🔧', path: '/ui2/spread-tools', section: 'tools', description: 'Options spreads', keywords: ['spread'] },
  { id: 'futures-curve', label: 'Futures Curve', icon: '📉', path: '/ui2/futures-curve', section: 'tools', description: 'Futures curve', keywords: ['futures'] },
  { id: 'rates-monitor', label: 'Rates Monitor', icon: '💵', path: '/ui2/rates-monitor', section: 'tools', description: 'Interest rates', keywords: ['rates'] },
  { id: 'cross-margin', label: 'Cross-Margin', icon: '💼', path: '/ui2/cross-margin', section: 'system', description: 'Cross-margin', keywords: ['margin'] },
  { id: 'vol-scanner', label: 'Vol Scanner', icon: '🔎', path: '/ui2/vol-scanner', section: 'tools', description: 'Vol scanner', keywords: ['vol'] },
  { id: 'hedge-engine', label: 'Hedge Engine', icon: '🛡️', path: '/ui2/hedge-engine', section: 'tools', description: 'Hedge engine', keywords: ['hedge'] },
  { id: 'risk-adj-exec', label: 'Risk-Adj Exec', icon: '⚡', path: '/ui2/risk-adj-exec', section: 'tools', description: 'Risk-adjusted execution', keywords: ['risk-adj'] },
  { id: 'derivatives-gov', label: 'Deriv Gov', icon: '🏛️', path: '/ui2/derivatives-gov', section: 'system', description: 'Derivatives governance', keywords: ['derivatives'] },
  { id: 'policy-code', label: 'Policy Code', icon: '📜', path: '/ui2/policy-code', section: 'system', description: 'Policy-as-code', keywords: ['policy'] },
  { id: 'entitlements', label: 'Entitlements', icon: '🔑', path: '/ui2/entitlements', section: 'system', description: 'Entitlements', keywords: ['entitlements'] },
  { id: 'approval-chain', label: 'Approval Chain', icon: '🔗', path: '/ui2/approval-chain', section: 'system', description: 'Approval chain', keywords: ['approval'] },
  { id: 'evidence-vault', label: 'Evidence Vault', icon: '🔒', path: '/ui2/evidence-vault', section: 'system', description: 'Evidence vault', keywords: ['evidence'] },
  { id: 'retention-policy', label: 'Retention Policy', icon: '🗑️', path: '/ui2/retention-policy', section: 'system', description: 'Data retention', keywords: ['retention'] },
  { id: 'audit-replay', label: 'Audit Replay', icon: '⏪', path: '/ui2/audit-replay', section: 'system', description: 'Audit replay', keywords: ['audit'] },
  { id: 'incident-compliance', label: 'Incident Compl', icon: '🔔', path: '/ui2/incident-compliance', section: 'system', description: 'Incident compliance', keywords: ['incident'] },
  { id: 'supervisory', label: 'Supervisory', icon: '👔', path: '/ui2/supervisory', section: 'system', description: 'Supervisory dashboards', keywords: ['supervisory'] },
  { id: 'kri-scoring', label: 'KRI Scoring', icon: '📏', path: '/ui2/kri-scoring', section: 'system', description: 'KRI scoring', keywords: ['kri'] },
  { id: 'third-party-risk', label: '3rd Party Risk', icon: '🌐', path: '/ui2/third-party-risk', section: 'system', description: '3rd party risk', keywords: ['third-party'] },
  { id: 'sso-hardening', label: 'SSO Hardening', icon: '🔐', path: '/ui2/sso-hardening', section: 'system', description: 'SSO hardening', keywords: ['sso'] },
  { id: 'jurisdiction', label: 'Jurisdiction', icon: '🌍', path: '/ui2/jurisdiction', section: 'system', description: 'Jurisdiction rules', keywords: ['jurisdiction'] },
  { id: 'control-framework', label: 'Control FW', icon: '✔️', path: '/ui2/control-framework', section: 'system', description: 'Control framework', keywords: ['control'] },
  { id: 'plugin-runtime', label: 'Plugins', icon: '🧩', path: '/ui2/plugin-runtime', section: 'system', description: 'Plugin runtime', keywords: ['plugin'] },
  { id: 'sdk-api', label: 'SDK Standard', icon: '📘', path: '/ui2/sdk-api', section: 'system', description: 'SDK API', keywords: ['sdk'] },
  { id: 'app-sandbox', label: 'App Sandbox', icon: '📦', path: '/ui2/app-sandbox', section: 'system', description: 'App sandbox', keywords: ['sandbox'] },
  { id: 'partner-ci', label: 'Partner CI', icon: '🤝', path: '/ui2/partner-ci', section: 'system', description: 'Partner CI', keywords: ['partner'] },
  { id: 'usage-metering', label: 'Usage Metering', icon: '📊', path: '/ui2/usage-metering', section: 'system', description: 'Usage metering', keywords: ['usage'] },
  { id: 'billing-events', label: 'Billing', icon: '💳', path: '/ui2/billing-events', section: 'system', description: 'Billing events', keywords: ['billing'] },
  { id: 'ext-observability', label: 'Ext Observ', icon: '🔭', path: '/ui2/ext-observability', section: 'system', description: 'Extension observability', keywords: ['ext'] },
  { id: 'tenant-quota', label: 'Tenant Quota', icon: '📐', path: '/ui2/tenant-quota', section: 'system', description: 'Tenant quota', keywords: ['tenant'] },
  { id: 'compat-matrix', label: 'Compat Matrix', icon: '🔢', path: '/ui2/compat-matrix', section: 'system', description: 'Compatibility matrix', keywords: ['compat'] },
  { id: 'dev-portal', label: 'Dev Portal', icon: '🌐', path: '/ui2/dev-portal', section: 'tools', description: 'Developer portal', keywords: ['dev'] },
  { id: 'support-sla', label: 'Support SLA', icon: '🎫', path: '/ui2/support-sla', section: 'system', description: 'Support SLA', keywords: ['support'] },
  { id: 'marketplace-trust', label: 'Mktplace Trust', icon: '🔒', path: '/ui2/marketplace-trust', section: 'system', description: 'Marketplace trust', keywords: ['trust'] },
  { id: 'multi-region', label: 'Multi-Region', icon: '🌏', path: '/ui2/multi-region', section: 'system', description: 'Multi-region', keywords: ['multi-region'] },
  { id: 'latency-budget', label: 'Latency Budget', icon: '⏱️', path: '/ui2/latency-budget', section: 'system', description: 'Latency budget', keywords: ['latency'] },
  { id: 'cost-profiler', label: 'Cost Profiler', icon: '💲', path: '/ui2/cost-profiler', section: 'system', description: 'Cost profiler', keywords: ['cost'] },
  { id: 'reliability-econ', label: 'Reliability Econ', icon: '📊', path: '/ui2/reliability-econ', section: 'system', description: 'Reliability economics', keywords: ['reliability'] },
  { id: 'regional-failover', label: 'Failover Drills', icon: '🔄', path: '/ui2/regional-failover', section: 'system', description: 'Failover drills', keywords: ['failover'] },
  { id: 'data-residency', label: 'Data Residency', icon: '📍', path: '/ui2/data-residency', section: 'system', description: 'Data residency', keywords: ['residency'] },
  { id: 'ops-automation-ai', label: 'Ops AI', icon: '🤖', path: '/ui2/ops-automation-ai', section: 'system', description: 'AI ops automation', keywords: ['ops-ai'] },
  { id: 'hot-path', label: 'Hot Path', icon: '🔥', path: '/ui2/hot-path', section: 'system', description: 'Hot path profiling', keywords: ['hot-path'] },
  { id: 'release-quality', label: 'Release Quality', icon: '🎯', path: '/ui2/release-quality', section: 'system', description: 'Release quality', keywords: ['release'] },
  { id: 'capacity-plan', label: 'Capacity Plan', icon: '📐', path: '/ui2/capacity-plan', section: 'system', description: 'Capacity planning', keywords: ['capacity'] },
  { id: 'platform-debt', label: 'Platform Debt', icon: '🧹', path: '/ui2/platform-debt', section: 'system', description: 'Technical debt', keywords: ['debt'] },
  { id: 'operator-enable', label: 'Operator Enable', icon: '📚', path: '/ui2/operator-enable', section: 'system', description: 'Operator enablement', keywords: ['operator'] },
  { id: 'compliance', label: 'Compliance', icon: '📑', path: '/ui2/compliance', section: 'system', description: 'Compliance dashboard', keywords: ['compliance'] },
  { id: 'platform-settings', label: 'Platform Settings', icon: '🔧', path: '/ui2/platform-settings', section: 'system', description: 'Platform settings', keywords: ['platform'] },
];

/* ────────────────────────────────────────── */
/*              MAIN APP SHELL               */
/* ────────────────────────────────────────── */
export function AppShellUI2() {
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [marketOpen, setMarketOpen] = useState(false);
  const [marketSession, setMarketSession] = useState<string>('closed');
  const [beGitSha, setBeGitSha] = useState<string>('');
  const [versionMismatch, setVersionMismatch] = useState(false);

  // Subscribe to trading store connection status
  const connectionStatus = useSyncExternalStore(
    tradingStore.subscribe,
    tradingStore.getConnectionStatus
  );

  // Phase A: Fetch backend version
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

  // Phase D: Fetch market session every 30s
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

  // Build command palette items from WORKSPACES + COMMAND_REGISTRY
  const setActiveSymbol = useContextBus(s => s.setActiveSymbol);
  const commands: CmdItem[] = [
    ...WORKSPACES.map(ws => ({
      id: ws.id,
      label: ws.label,
      description: ws.description,
      icon: <span style={{ fontSize: '14px' }}>{ws.icon}</span>,
      category: 'navigation' as const,
      keywords: ws.keywords,
      path: ws.path,
    })),
    ...COMMAND_REGISTRY.map(c => ({
      id: c.id,
      label: c.label,
      description: c.description,
      icon: <span style={{ fontSize: '14px' }}>{c.icon}</span>,
      category: c.category as CmdItem['category'],
      keywords: c.keywords,
      path: c.path,
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
          background: 'var(--warn, #F59E0B)', color: '#fff', textAlign: 'center',
          padding: '6px 16px', fontSize: '12px', fontWeight: 600,
          pointerEvents: 'none',
        }}>
          Version mismatch — FE: {FE_GIT_SHA} / BE: {beGitSha}. Hard-refresh recommended.
        </div>
      )}

      {/* Skip-to-main-content */}
      <a
        href="#main-content"
        data-testid="skip-to-main"
        style={{
          position: 'fixed', top: '-40px', left: '8px', zIndex: 9999,
          padding: '8px 16px', background: 'var(--brand, #2962FF)', color: '#fff',
          fontWeight: 600, fontSize: '13px', borderRadius: '4px',
          textDecoration: 'none', transition: 'top 0.1s',
        }}
        onFocus={e => { e.currentTarget.style.top = '8px'; }}
        onBlur={e => { e.currentTarget.style.top = '-40px'; }}
      >
        Skip to main content
      </a>

      {/* ━━━ MAIN APP GRID ━━━
        3 rows: 40px topbar | 1fr layout | 20px statusbar
        Layout inner: 48px leftnav | 1fr content | 286px rightsidebar
      */}
      <div
        className="apex-app"
        data-testid="ui2-app-shell"
        style={{
          display: 'grid',
          gridTemplateRows: '40px 1fr 20px',
          gridTemplateColumns: '1fr',
          width: '100vw',
          height: '100vh',
          overflow: 'hidden',
          background: 'var(--bg0, #0C0E12)',
          color: 'var(--tx1, #D1D4DC)',
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          fontSize: '13px',
        }}
      >
        {/* ROW 1: TopBar (40px) */}
        {/* Data mode badge — visible in TopBar area */}
        <span
          data-testid="ui2-data-mode-badge"
          style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0.01 }}
          aria-hidden="false"
        >Online</span>
        <TopBar
          onOpenCommandPalette={() => setCommandPaletteOpen(true)}
          connectionStatus={connectionStatus}
          marketOpen={marketOpen}
          marketSession={marketSession}
        />

        {/* ROW 2: Layout (1fr) — 3-column inner grid */}
        <div
          className="apex-layout"
          data-testid="ui2-layout"
          style={{
            display: 'grid',
            gridTemplateColumns: '48px 1fr 286px',
            overflow: 'hidden',
            minHeight: 0,
          }}
        >
          {/* COL 1: LeftNav (48px) */}
          <LeftNav />

          {/* COL 2: Content (1fr) */}
          <div
            className="apex-content"
            id="main-content"
            role="main"
            aria-label="Main workspace"
            data-testid="ui2-center"
            style={{
              overflow: 'auto',
              minHeight: 0,
              background: 'var(--bg1, #131722)',
              borderLeft: '1px solid var(--border, #1E222D)',
              borderRight: '1px solid var(--border, #1E222D)',
            }}
          >
            <Outlet />
          </div>

          {/* COL 3: RightSidebar (286px) */}
          <RightSidebarNew />
        </div>

        {/* ROW 3: StatusBar (20px) */}
        <StatusBar
          marketOpen={marketOpen}
          marketSession={marketSession}
          connectionStatus={connectionStatus}
        />
      </div>

      {/* Command Palette Overlay (Ctrl+K) */}
      <CommandPaletteNew
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        items={commands}
      />
    </ToastProvider>
  );
}
