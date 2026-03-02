// Page-level components for enhanced UI2 dashboards
// Each exports both a named export and a default export

export { AdvancedScreener } from './AdvancedScreener';
export { OptionsChain } from './OptionsChain';
export { PortfolioDashboard } from './PortfolioDashboard';
export { BacktestWorkspace } from './BacktestWorkspace';
export { ResearchWorkspace } from './ResearchWorkspace';
export { RiskDashboard } from './RiskDashboard';
export { EconomicDashboard } from './EconomicDashboard';
export { CryptoAnalytics } from './CryptoAnalytics';
export { FixedIncomeDashboard } from './FixedIncomeDashboard';
export { FXDashboard } from './FXDashboard';

// Lazy-loadable imports for code splitting
export const LazyAdvancedScreener = () => import('./AdvancedScreener');
export const LazyOptionsChain = () => import('./OptionsChain');
export const LazyPortfolioDashboard = () => import('./PortfolioDashboard');
export const LazyBacktestWorkspace = () => import('./BacktestWorkspace');
export const LazyResearchWorkspace = () => import('./ResearchWorkspace');
export const LazyRiskDashboard = () => import('./RiskDashboard');
export const LazyEconomicDashboard = () => import('./EconomicDashboard');
export const LazyCryptoAnalytics = () => import('./CryptoAnalytics');
export const LazyFixedIncomeDashboard = () => import('./FixedIncomeDashboard');
export const LazyFXDashboard = () => import('./FXDashboard');

// Component metadata for workspace/layout systems
export const PAGE_COMPONENTS = {
  advancedScreener: { name: 'Advanced Screener', component: 'AdvancedScreener', category: 'equity' },
  optionsChain: { name: 'Options Chain', component: 'OptionsChain', category: 'derivatives' },
  portfolioDashboard: { name: 'Portfolio Dashboard', component: 'PortfolioDashboard', category: 'portfolio' },
  backtestWorkspace: { name: 'Backtest Workspace', component: 'BacktestWorkspace', category: 'analytics' },
  researchWorkspace: { name: 'Research Workspace', component: 'ResearchWorkspace', category: 'research' },
  riskDashboard: { name: 'Risk Dashboard', component: 'RiskDashboard', category: 'risk' },
  economicDashboard: { name: 'Economic Dashboard', component: 'EconomicDashboard', category: 'macro' },
  cryptoAnalytics: { name: 'Crypto Analytics', component: 'CryptoAnalytics', category: 'crypto' },
  fixedIncomeDashboard: { name: 'Fixed Income', component: 'FixedIncomeDashboard', category: 'fixed-income' },
  fxDashboard: { name: 'FX Dashboard', component: 'FXDashboard', category: 'fx' },
} as const;
