/**
 * v1.55 — Command Registry
 * Deterministic command registry with stable ordering and action execution
 */

export interface RegistryCommand {
  id: string;
  label: string;
  description: string;
  icon: string;
  category: 'navigation' | 'action' | 'ticker' | 'setting';
  keywords: string[];
  path?: string;
  action?: string; // action identifier for programmatic execution
}

// Deterministic list sorted by category then id
export const COMMAND_REGISTRY: RegistryCommand[] = [
  // Navigation commands (workspaces)
  { id: 'nav-dashboard', label: 'Dashboard', description: 'Command center with key metrics', icon: 'H', category: 'navigation', keywords: ['home', 'overview', 'metrics', 'kpi'], path: '/ui2/dashboard' },
  { id: 'nav-trading', label: 'Trading', description: 'Live chart and order execution', icon: 'T', category: 'navigation', keywords: ['chart', 'trade', 'order', 'execution'], path: '/ui2/trading' },
  { id: 'nav-portfolio', label: 'Portfolio', description: 'Positions and performance', icon: 'P', category: 'navigation', keywords: ['positions', 'pnl', 'performance', 'holdings'], path: '/ui2/portfolio' },
  { id: 'nav-orders', label: 'Orders', description: 'Order history and management', icon: 'O', category: 'navigation', keywords: ['order', 'history', 'fills', 'execution'], path: '/ui2/orders' },
  { id: 'nav-risk', label: 'Risk & Options', description: 'Options chain and risk analysis', icon: 'R', category: 'navigation', keywords: ['options', 'greeks', 'risk', 'strategy'], path: '/ui2/risk' },
  { id: 'nav-research', label: 'Research', description: 'Strategy lab and analysis', icon: 'S', category: 'navigation', keywords: ['strategies', 'backtest', 'research', 'analysis'], path: '/ui2/research' },
  { id: 'nav-backtest', label: 'Backtest', description: 'Historical strategy testing', icon: 'B', category: 'navigation', keywords: ['backtest', 'historical', 'test', 'simulation'], path: '/ui2/backtest' },
  { id: 'nav-autopilot', label: 'Autopilot', description: 'Autonomous trading agent', icon: 'A', category: 'navigation', keywords: ['autopilot', 'agent', 'autonomous', 'auto'], path: '/ui2/autopilot' },
  { id: 'nav-alerts', label: 'Alerts', description: 'Price and technical alerts', icon: 'L', category: 'navigation', keywords: ['alerts', 'notifications', 'triggers'], path: '/ui2/alerts' },
  { id: 'nav-replay', label: 'Replay', description: 'Market replay and analysis', icon: 'Y', category: 'navigation', keywords: ['replay', 'historical', 'playback'], path: '/ui2/replay' },
  { id: 'nav-runs', label: 'Runs & Audit', description: 'Execution audit trail', icon: 'U', category: 'navigation', keywords: ['runs', 'audit', 'history', 'log'], path: '/ui2/runs' },
  { id: 'nav-ops', label: 'Ops', description: 'System operations and monitoring', icon: 'G', category: 'navigation', keywords: ['ops', 'operations', 'system', 'monitoring'], path: '/ui2/ops' },
  { id: 'nav-settings', label: 'Settings', description: 'Platform configuration', icon: 'X', category: 'navigation', keywords: ['settings', 'config', 'preferences'], path: '/ui2/settings' },

  // Action commands
  { id: 'action-run-backtest', label: 'Run Backtest', description: 'Execute a strategy backtest', icon: '>', category: 'action', keywords: ['run', 'backtest', 'execute', 'test'], action: 'run-backtest' },
  { id: 'action-run-validation', label: 'Run Validation', description: 'Validate a strategy', icon: '>', category: 'action', keywords: ['validate', 'check', 'verify'], action: 'run-validation' },
  { id: 'action-export-report', label: 'Export Report', description: 'Export audit/risk report bundle', icon: '>', category: 'action', keywords: ['export', 'report', 'download', 'audit'], action: 'export-report' },
  { id: 'action-toggle-demo', label: 'Toggle Demo Mode Banner', description: 'Show/hide the demo mode indicator', icon: '>', category: 'action', keywords: ['demo', 'toggle', 'mode', 'banner'], action: 'toggle-demo' },
  { id: 'action-kill-switch', label: 'Kill Switch', description: 'Emergency stop all autopilot activity', icon: '!', category: 'action', keywords: ['kill', 'stop', 'emergency', 'halt', 'switch'], action: 'kill-switch' },

  // Ticker search  
  { id: 'ticker-spy', label: 'SPY', description: 'SPDR S&P 500 ETF', icon: '$', category: 'ticker', keywords: ['spy', 'sp500', 'etf', 'index'], action: 'select-ticker-SPY' },
  { id: 'ticker-aapl', label: 'AAPL', description: 'Apple Inc.', icon: '$', category: 'ticker', keywords: ['aapl', 'apple', 'tech'], action: 'select-ticker-AAPL' },
  { id: 'ticker-tsla', label: 'TSLA', description: 'Tesla Inc.', icon: '$', category: 'ticker', keywords: ['tsla', 'tesla', 'ev'], action: 'select-ticker-TSLA' },
  { id: 'ticker-nvda', label: 'NVDA', description: 'NVIDIA Corporation', icon: '$', category: 'ticker', keywords: ['nvda', 'nvidia', 'gpu', 'ai'], action: 'select-ticker-NVDA' },
  { id: 'ticker-msft', label: 'MSFT', description: 'Microsoft Corporation', icon: '$', category: 'ticker', keywords: ['msft', 'microsoft', 'cloud'], action: 'select-ticker-MSFT' },
];
