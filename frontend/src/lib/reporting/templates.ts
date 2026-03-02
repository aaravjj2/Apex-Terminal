import type {
  ReportTemplate,
  ReportSection,
  ReportBranding,
  TemplateParameter,
  MetricData,
  TableData,
  ChartData,
  TextData,
} from './types';
import { ExportFormat, SectionType, ChartType } from './types';

const DEFAULT_BRANDING: ReportBranding = {
  companyName: 'TradingView Pro',
  logoUrl: '',
  primaryColor: '#2962ff',
  secondaryColor: '#1e88e5',
  fontFamily: 'Inter',
  headerText: 'CONFIDENTIAL',
  footerText: 'TradingView Pro Analytics',
  confidentiality: 'This report is confidential and intended for the recipient only.',
};

function section(id: string, type: SectionType, title: string, data: MetricData | TableData | ChartData | TextData | null, opts: Record<string, unknown> = {}): ReportSection {
  return { id, type, title, data, options: opts };
}

// --- Daily P&L Report ---

export const DAILY_PNL_TEMPLATE: ReportTemplate = {
  id: 'daily_pnl',
  name: 'Daily P&L Report',
  description: 'End-of-day profit and loss summary with position breakdown',
  category: 'daily',
  defaultFormat: ExportFormat.PDF,
  defaultBranding: DEFAULT_BRANDING,
  version: 1,
  parameters: [
    { key: 'date', label: 'Report Date', type: 'date', required: true },
    { key: 'accountId', label: 'Account', type: 'string', required: true },
    { key: 'includeClosed', label: 'Include Closed Positions', type: 'boolean', required: false, defaultValue: true },
  ],
  sections: [
    section('s1', SectionType.ExecutiveSummary, 'Daily Summary', {
      content: 'End-of-day P&L report summarizing realized and unrealized gains/losses across all positions.',
      format: 'plain',
    } as TextData),
    section('s2', SectionType.MetricGrid, 'P&L Overview', {
      metrics: [
        { label: 'Realized P&L', value: 0, format: 'currency', color: '#16a34a' },
        { label: 'Unrealized P&L', value: 0, format: 'currency' },
        { label: 'Total P&L', value: 0, format: 'currency' },
        { label: 'Trades Executed', value: 0, format: 'number' },
        { label: 'Win Rate', value: 0, format: 'percent' },
        { label: 'Largest Win', value: 0, format: 'currency' },
        { label: 'Largest Loss', value: 0, format: 'currency' },
        { label: 'Fees', value: 0, format: 'currency' },
      ],
      columns: 4,
    } as MetricData),
    section('s3', SectionType.Table, 'Trade Details', {
      headers: [
        { key: 'time', label: 'Time', align: 'left' },
        { key: 'symbol', label: 'Symbol', align: 'left' },
        { key: 'side', label: 'Side', align: 'center' },
        { key: 'quantity', label: 'Qty', align: 'right' },
        { key: 'price', label: 'Price', align: 'right', format: 'currency' },
        { key: 'pnl', label: 'P&L', align: 'right', format: 'currency' },
      ],
      rows: [],
      striped: true,
    } as TableData),
    section('s4', SectionType.Table, 'Position Summary', {
      headers: [
        { key: 'symbol', label: 'Symbol', align: 'left' },
        { key: 'quantity', label: 'Position', align: 'right' },
        { key: 'avgPrice', label: 'Avg Price', align: 'right', format: 'currency' },
        { key: 'marketPrice', label: 'Mkt Price', align: 'right', format: 'currency' },
        { key: 'unrealizedPnl', label: 'Unrealized', align: 'right', format: 'currency' },
        { key: 'dayPnl', label: 'Day P&L', align: 'right', format: 'currency' },
      ],
      rows: [],
      striped: true,
    } as TableData),
  ],
};

// --- Weekly Portfolio Review ---

export const WEEKLY_PORTFOLIO_TEMPLATE: ReportTemplate = {
  id: 'weekly_portfolio',
  name: 'Weekly Portfolio Review',
  description: 'Weekly performance review with sector analysis and risk metrics',
  category: 'weekly',
  defaultFormat: ExportFormat.PDF,
  defaultBranding: DEFAULT_BRANDING,
  version: 1,
  parameters: [
    { key: 'weekEnding', label: 'Week Ending', type: 'date', required: true },
    { key: 'benchmark', label: 'Benchmark', type: 'select', required: false, defaultValue: 'SPY', options: [{ label: 'S&P 500', value: 'SPY' }, { label: 'Nasdaq', value: 'QQQ' }, { label: 'Russell 2000', value: 'IWM' }] },
  ],
  sections: [
    section('s1', SectionType.ExecutiveSummary, 'Weekly Review', {
      content: 'Portfolio performance summary for the trading week, including benchmark comparison and sector analysis.',
      format: 'plain',
    } as TextData),
    section('s2', SectionType.MetricGrid, 'Weekly Performance', {
      metrics: [
        { label: 'Weekly Return', value: 0, format: 'percent' },
        { label: 'MTD Return', value: 0, format: 'percent' },
        { label: 'YTD Return', value: 0, format: 'percent' },
        { label: 'vs Benchmark', value: 0, format: 'percent' },
        { label: 'Sharpe (Rolling)', value: 0, format: 'number' },
        { label: 'Max Drawdown', value: 0, format: 'percent' },
      ],
      columns: 3,
    } as MetricData),
    section('s3', SectionType.Chart, 'Equity Curve (Weekly)', {
      type: ChartType.Area,
      series: [{ name: 'Portfolio', data: [] }, { name: 'Benchmark', data: [] }],
      xAxis: { label: 'Date', format: 'date' },
      yAxis: { label: 'Return %', format: 'percent' },
      width: 600, height: 280, legend: true,
    } as ChartData),
    section('s4', SectionType.Chart, 'Sector Allocation', {
      type: ChartType.Pie,
      series: [{ name: 'Sectors', data: [] }],
      xAxis: { label: '' },
      yAxis: { label: '' },
      width: 400, height: 300,
    } as ChartData),
    section('s5', SectionType.Table, 'Top/Bottom Performers', {
      headers: [
        { key: 'symbol', label: 'Symbol', align: 'left' },
        { key: 'weekReturn', label: 'Week Return', align: 'right', format: 'percent' },
        { key: 'weight', label: 'Weight', align: 'right', format: 'percent' },
        { key: 'contribution', label: 'Contribution', align: 'right', format: 'percent' },
      ],
      rows: [],
      striped: true,
    } as TableData),
  ],
};

// --- Monthly Performance Attribution ---

export const MONTHLY_ATTRIBUTION_TEMPLATE: ReportTemplate = {
  id: 'monthly_attribution',
  name: 'Monthly Performance Attribution',
  description: 'Brinson-Fachler attribution analysis with factor decomposition',
  category: 'monthly',
  defaultFormat: ExportFormat.PDF,
  defaultBranding: DEFAULT_BRANDING,
  version: 1,
  parameters: [
    { key: 'month', label: 'Month', type: 'date', required: true },
    { key: 'benchmark', label: 'Benchmark', type: 'string', required: true, defaultValue: 'SPY' },
  ],
  sections: [
    section('s1', SectionType.ExecutiveSummary, 'Attribution Summary', {
      content: 'Monthly return attribution decomposing excess return into allocation, selection, and interaction effects.',
      format: 'plain',
    } as TextData),
    section('s2', SectionType.MetricGrid, 'Return Decomposition', {
      metrics: [
        { label: 'Portfolio Return', value: 0, format: 'percent' },
        { label: 'Benchmark Return', value: 0, format: 'percent' },
        { label: 'Excess Return', value: 0, format: 'percent' },
        { label: 'Allocation Effect', value: 0, format: 'percent' },
        { label: 'Selection Effect', value: 0, format: 'percent' },
        { label: 'Interaction Effect', value: 0, format: 'percent' },
      ],
      columns: 3,
    } as MetricData),
    section('s3', SectionType.Table, 'Sector Attribution', {
      headers: [
        { key: 'sector', label: 'Sector', align: 'left' },
        { key: 'portWeight', label: 'Port Weight', align: 'right', format: 'percent' },
        { key: 'benchWeight', label: 'Bench Weight', align: 'right', format: 'percent' },
        { key: 'portReturn', label: 'Port Return', align: 'right', format: 'percent' },
        { key: 'benchReturn', label: 'Bench Return', align: 'right', format: 'percent' },
        { key: 'allocation', label: 'Allocation', align: 'right', format: 'percent' },
        { key: 'selection', label: 'Selection', align: 'right', format: 'percent' },
        { key: 'total', label: 'Total', align: 'right', format: 'percent' },
      ],
      rows: [],
      striped: true, bordered: true,
    } as TableData),
    section('s4', SectionType.Chart, 'Attribution Waterfall', {
      type: ChartType.Bar,
      series: [{ name: 'Effect', data: [] }],
      xAxis: { label: 'Factor' },
      yAxis: { label: 'Return %', format: 'percent' },
      width: 600, height: 280,
    } as ChartData),
  ],
};

// --- Quarterly Risk Report ---

export const QUARTERLY_RISK_TEMPLATE: ReportTemplate = {
  id: 'quarterly_risk',
  name: 'Quarterly Risk Report',
  description: 'Comprehensive risk analysis including VaR, stress testing, and factor exposure',
  category: 'quarterly',
  defaultFormat: ExportFormat.PDF,
  defaultBranding: DEFAULT_BRANDING,
  version: 1,
  parameters: [
    { key: 'quarter', label: 'Quarter', type: 'select', required: true, options: [{ label: 'Q1', value: 'Q1' }, { label: 'Q2', value: 'Q2' }, { label: 'Q3', value: 'Q3' }, { label: 'Q4', value: 'Q4' }] },
    { key: 'year', label: 'Year', type: 'number', required: true },
    { key: 'confidenceLevel', label: 'VaR Confidence', type: 'select', required: false, defaultValue: '95', options: [{ label: '95%', value: '95' }, { label: '99%', value: '99' }] },
  ],
  sections: [
    section('s1', SectionType.ExecutiveSummary, 'Risk Overview', {
      content: 'Quarterly risk assessment covering market risk, concentration risk, and stress test results.',
      format: 'plain',
    } as TextData),
    section('s2', SectionType.MetricGrid, 'Risk Metrics', {
      metrics: [
        { label: 'VaR (95%)', value: 0, format: 'currency', color: '#dc2626' },
        { label: 'CVaR (95%)', value: 0, format: 'currency', color: '#dc2626' },
        { label: 'Volatility (Ann.)', value: 0, format: 'percent' },
        { label: 'Beta', value: 0, format: 'number' },
        { label: 'Max Drawdown', value: 0, format: 'percent', color: '#dc2626' },
        { label: 'Sharpe Ratio', value: 0, format: 'number' },
        { label: 'Sortino Ratio', value: 0, format: 'number' },
        { label: 'Calmar Ratio', value: 0, format: 'number' },
      ],
      columns: 4,
    } as MetricData),
    section('s3', SectionType.Table, 'Stress Test Results', {
      headers: [
        { key: 'scenario', label: 'Scenario', align: 'left' },
        { key: 'portfolioImpact', label: 'Portfolio Impact', align: 'right', format: 'percent' },
        { key: 'dollarImpact', label: '$ Impact', align: 'right', format: 'currency' },
        { key: 'worstPosition', label: 'Worst Position', align: 'left' },
      ],
      rows: [],
      striped: true,
    } as TableData),
    section('s4', SectionType.Chart, 'Rolling Volatility', {
      type: ChartType.Line,
      series: [{ name: '30-day Vol', data: [] }, { name: '90-day Vol', data: [] }],
      xAxis: { label: 'Date', format: 'date' },
      yAxis: { label: 'Volatility %', format: 'percent' },
      width: 600, height: 250, legend: true,
    } as ChartData),
    section('s5', SectionType.Table, 'Concentration Risk', {
      headers: [
        { key: 'symbol', label: 'Position', align: 'left' },
        { key: 'weight', label: 'Weight', align: 'right', format: 'percent' },
        { key: 'marginalVaR', label: 'Marginal VaR', align: 'right', format: 'currency' },
        { key: 'componentVaR', label: 'Component VaR', align: 'right', format: 'currency' },
        { key: 'pctContribution', label: '% of VaR', align: 'right', format: 'percent' },
      ],
      rows: [],
      striped: true,
    } as TableData),
  ],
};

// --- Annual Tax Report ---

export const ANNUAL_TAX_TEMPLATE: ReportTemplate = {
  id: 'annual_tax',
  name: 'Annual Tax Report',
  description: 'Tax lot analysis with realized gains/losses and wash sale tracking',
  category: 'annual',
  defaultFormat: ExportFormat.PDF,
  defaultBranding: DEFAULT_BRANDING,
  version: 1,
  parameters: [
    { key: 'taxYear', label: 'Tax Year', type: 'number', required: true },
    { key: 'costBasisMethod', label: 'Cost Basis Method', type: 'select', required: false, defaultValue: 'fifo', options: [{ label: 'FIFO', value: 'fifo' }, { label: 'LIFO', value: 'lifo' }, { label: 'Specific ID', value: 'specific' }] },
  ],
  sections: [
    section('s1', SectionType.ExecutiveSummary, 'Tax Summary', {
      content: 'Annual tax report summarizing realized capital gains and losses for the tax year.',
      format: 'plain',
    } as TextData),
    section('s2', SectionType.MetricGrid, 'Tax Overview', {
      metrics: [
        { label: 'Short-Term Gains', value: 0, format: 'currency' },
        { label: 'Short-Term Losses', value: 0, format: 'currency' },
        { label: 'Long-Term Gains', value: 0, format: 'currency' },
        { label: 'Long-Term Losses', value: 0, format: 'currency' },
        { label: 'Net Realized', value: 0, format: 'currency' },
        { label: 'Wash Sale Adj.', value: 0, format: 'currency' },
        { label: 'Dividends', value: 0, format: 'currency' },
        { label: 'Est. Tax Liability', value: 0, format: 'currency' },
      ],
      columns: 4,
    } as MetricData),
    section('s3', SectionType.Table, 'Realized Transactions', {
      headers: [
        { key: 'symbol', label: 'Symbol', align: 'left' },
        { key: 'purchaseDate', label: 'Acquired', align: 'left' },
        { key: 'saleDate', label: 'Sold', align: 'left' },
        { key: 'quantity', label: 'Qty', align: 'right' },
        { key: 'costBasis', label: 'Cost Basis', align: 'right', format: 'currency' },
        { key: 'proceeds', label: 'Proceeds', align: 'right', format: 'currency' },
        { key: 'gainLoss', label: 'Gain/Loss', align: 'right', format: 'currency' },
        { key: 'term', label: 'Term', align: 'center' },
        { key: 'washSale', label: 'Wash Sale', align: 'center' },
      ],
      rows: [],
      striped: true, bordered: true,
    } as TableData),
  ],
};

// --- Backtest Summary ---

export const BACKTEST_SUMMARY_TEMPLATE: ReportTemplate = {
  id: 'backtest_summary',
  name: 'Backtest Summary',
  description: 'Strategy backtest results with equity curve and trade analysis',
  category: 'backtest',
  defaultFormat: ExportFormat.PDF,
  defaultBranding: DEFAULT_BRANDING,
  version: 1,
  parameters: [
    { key: 'strategyName', label: 'Strategy Name', type: 'string', required: true },
    { key: 'startDate', label: 'Start Date', type: 'date', required: true },
    { key: 'endDate', label: 'End Date', type: 'date', required: true },
  ],
  sections: [
    section('s1', SectionType.ExecutiveSummary, 'Backtest Overview', {
      content: 'Strategy backtest summary showing key performance metrics and statistical significance.',
      format: 'plain',
    } as TextData),
    section('s2', SectionType.MetricGrid, 'Performance Metrics', {
      metrics: [
        { label: 'Total Return', value: 0, format: 'percent' },
        { label: 'CAGR', value: 0, format: 'percent' },
        { label: 'Sharpe Ratio', value: 0, format: 'number' },
        { label: 'Sortino Ratio', value: 0, format: 'number' },
        { label: 'Max Drawdown', value: 0, format: 'percent' },
        { label: 'Win Rate', value: 0, format: 'percent' },
        { label: 'Profit Factor', value: 0, format: 'number' },
        { label: 'Total Trades', value: 0, format: 'number' },
      ],
      columns: 4,
    } as MetricData),
    section('s3', SectionType.Chart, 'Equity Curve', {
      type: ChartType.Area,
      series: [{ name: 'Strategy', data: [] }, { name: 'Buy & Hold', data: [] }],
      xAxis: { label: 'Date', format: 'date' },
      yAxis: { label: 'Equity', format: 'currency' },
      width: 600, height: 280, legend: true,
    } as ChartData),
    section('s4', SectionType.Chart, 'Drawdown', {
      type: ChartType.Area,
      series: [{ name: 'Drawdown', data: [] }],
      xAxis: { label: 'Date', format: 'date' },
      yAxis: { label: 'Drawdown %', format: 'percent' },
      width: 600, height: 200, colors: ['#dc2626'],
    } as ChartData),
    section('s5', SectionType.Chart, 'P&L Distribution', {
      type: ChartType.Histogram,
      series: [{ name: 'Frequency', data: [] }],
      xAxis: { label: 'P&L ($)' },
      yAxis: { label: 'Count' },
      width: 500, height: 220,
    } as ChartData),
  ],
};

// --- Options Strategy Summary ---

export const OPTIONS_STRATEGY_TEMPLATE: ReportTemplate = {
  id: 'options_strategy',
  name: 'Options Strategy Summary',
  description: 'Options position analysis with Greeks, payoff diagram, and scenario analysis',
  category: 'options',
  defaultFormat: ExportFormat.PDF,
  defaultBranding: DEFAULT_BRANDING,
  version: 1,
  parameters: [
    { key: 'underlying', label: 'Underlying', type: 'string', required: true },
    { key: 'expirationDate', label: 'Expiration', type: 'date', required: true },
  ],
  sections: [
    section('s1', SectionType.MetricGrid, 'Portfolio Greeks', {
      metrics: [
        { label: 'Net Delta', value: 0, format: 'number' },
        { label: 'Net Gamma', value: 0, format: 'number' },
        { label: 'Net Theta', value: 0, format: 'currency' },
        { label: 'Net Vega', value: 0, format: 'number' },
        { label: 'Net Rho', value: 0, format: 'number' },
      ],
      columns: 5,
    } as MetricData),
    section('s2', SectionType.Table, 'Leg Details', {
      headers: [
        { key: 'type', label: 'Type', align: 'center' },
        { key: 'strike', label: 'Strike', align: 'right', format: 'currency' },
        { key: 'expiry', label: 'Expiry', align: 'center' },
        { key: 'quantity', label: 'Qty', align: 'right' },
        { key: 'premium', label: 'Premium', align: 'right', format: 'currency' },
        { key: 'iv', label: 'IV', align: 'right', format: 'percent' },
        { key: 'delta', label: 'Delta', align: 'right' },
      ],
      rows: [],
      striped: true,
    } as TableData),
    section('s3', SectionType.Chart, 'Payoff Diagram', {
      type: ChartType.Line,
      series: [{ name: 'At Expiry', data: [] }, { name: 'Current', data: [] }],
      xAxis: { label: 'Underlying Price', format: 'currency' },
      yAxis: { label: 'P&L', format: 'currency' },
      width: 600, height: 280, legend: true,
    } as ChartData),
    section('s4', SectionType.MetricGrid, 'Strategy Metrics', {
      metrics: [
        { label: 'Max Profit', value: 0, format: 'currency' },
        { label: 'Max Loss', value: 0, format: 'currency' },
        { label: 'Breakeven', value: 0, format: 'currency' },
        { label: 'Prob. Profit', value: 0, format: 'percent' },
      ],
      columns: 4,
    } as MetricData),
  ],
};

// --- Market Overview ---

export const MARKET_OVERVIEW_TEMPLATE: ReportTemplate = {
  id: 'market_overview',
  name: 'Market Overview',
  description: 'Daily market summary with index performance, sector rotation, and key events',
  category: 'market',
  defaultFormat: ExportFormat.PDF,
  defaultBranding: DEFAULT_BRANDING,
  version: 1,
  parameters: [
    { key: 'date', label: 'Date', type: 'date', required: true },
  ],
  sections: [
    section('s1', SectionType.ExecutiveSummary, 'Market Summary', {
      content: 'Daily market overview covering major indices, sector performance, and notable market events.',
      format: 'plain',
    } as TextData),
    section('s2', SectionType.MetricGrid, 'Major Indices', {
      metrics: [
        { label: 'S&P 500', value: 0, format: 'percent' },
        { label: 'Nasdaq', value: 0, format: 'percent' },
        { label: 'Dow Jones', value: 0, format: 'percent' },
        { label: 'Russell 2000', value: 0, format: 'percent' },
        { label: 'VIX', value: 0, format: 'number' },
        { label: '10Y Yield', value: 0, format: 'percent' },
      ],
      columns: 3,
    } as MetricData),
    section('s3', SectionType.Chart, 'Sector Performance', {
      type: ChartType.Bar,
      series: [{ name: 'Return %', data: [] }],
      xAxis: { label: 'Sector' },
      yAxis: { label: 'Return %', format: 'percent' },
      width: 600, height: 280,
    } as ChartData),
    section('s4', SectionType.Table, 'Economic Calendar', {
      headers: [
        { key: 'time', label: 'Time', align: 'left' },
        { key: 'event', label: 'Event', align: 'left' },
        { key: 'actual', label: 'Actual', align: 'right' },
        { key: 'forecast', label: 'Forecast', align: 'right' },
        { key: 'previous', label: 'Previous', align: 'right' },
        { key: 'impact', label: 'Impact', align: 'center' },
      ],
      rows: [],
      striped: true,
    } as TableData),
  ],
};

// --- Sector Analysis ---

export const SECTOR_ANALYSIS_TEMPLATE: ReportTemplate = {
  id: 'sector_analysis',
  name: 'Sector Analysis',
  description: 'In-depth sector rotation analysis with relative strength and momentum',
  category: 'analysis',
  defaultFormat: ExportFormat.PDF,
  defaultBranding: DEFAULT_BRANDING,
  version: 1,
  parameters: [
    { key: 'period', label: 'Analysis Period', type: 'select', required: false, defaultValue: '3m', options: [{ label: '1 Month', value: '1m' }, { label: '3 Months', value: '3m' }, { label: '6 Months', value: '6m' }, { label: '1 Year', value: '1y' }] },
  ],
  sections: [
    section('s1', SectionType.ExecutiveSummary, 'Sector Rotation', {
      content: 'Sector analysis report examining relative strength, momentum, and rotation patterns across market sectors.',
      format: 'plain',
    } as TextData),
    section('s2', SectionType.Table, 'Sector Scorecard', {
      headers: [
        { key: 'sector', label: 'Sector', align: 'left' },
        { key: 'return1m', label: '1M Return', align: 'right', format: 'percent' },
        { key: 'return3m', label: '3M Return', align: 'right', format: 'percent' },
        { key: 'return6m', label: '6M Return', align: 'right', format: 'percent' },
        { key: 'relStrength', label: 'Rel Strength', align: 'right' },
        { key: 'momentum', label: 'Momentum', align: 'center' },
      ],
      rows: [],
      striped: true,
    } as TableData),
    section('s3', SectionType.Chart, 'Relative Performance', {
      type: ChartType.Line,
      series: [],
      xAxis: { label: 'Date', format: 'date' },
      yAxis: { label: 'Relative Return %', format: 'percent' },
      width: 600, height: 300, legend: true,
    } as ChartData),
    section('s4', SectionType.Chart, 'Sector Weights', {
      type: ChartType.Pie,
      series: [{ name: 'Weight', data: [] }],
      xAxis: { label: '' },
      yAxis: { label: '' },
      width: 400, height: 300,
    } as ChartData),
  ],
};

// --- Template Registry ---

const TEMPLATE_REGISTRY = new Map<string, ReportTemplate>();

function registerDefaults(): void {
  const templates = [
    DAILY_PNL_TEMPLATE,
    WEEKLY_PORTFOLIO_TEMPLATE,
    MONTHLY_ATTRIBUTION_TEMPLATE,
    QUARTERLY_RISK_TEMPLATE,
    ANNUAL_TAX_TEMPLATE,
    BACKTEST_SUMMARY_TEMPLATE,
    OPTIONS_STRATEGY_TEMPLATE,
    MARKET_OVERVIEW_TEMPLATE,
    SECTOR_ANALYSIS_TEMPLATE,
  ];
  for (const t of templates) TEMPLATE_REGISTRY.set(t.id, t);
}

registerDefaults();

export function getTemplate(id: string): ReportTemplate | null {
  return TEMPLATE_REGISTRY.get(id) ?? null;
}

export function listTemplates(category?: string): ReportTemplate[] {
  let templates = Array.from(TEMPLATE_REGISTRY.values());
  if (category) templates = templates.filter(t => t.category === category);
  return templates;
}

export function registerTemplate(template: ReportTemplate): void {
  TEMPLATE_REGISTRY.set(template.id, template);
}

export function getTemplateCategories(): string[] {
  return [...new Set(Array.from(TEMPLATE_REGISTRY.values()).map(t => t.category))].sort();
}

export function cloneTemplate(templateId: string, newName: string): ReportTemplate {
  const original = TEMPLATE_REGISTRY.get(templateId);
  if (!original) throw new Error('Template not found: ' + templateId);
  const cloned: ReportTemplate = {
    ...original,
    id: 'custom_' + Date.now(),
    name: newName,
    sections: original.sections.map(s => ({ ...s, data: s.data ? { ...s.data } : null, options: { ...s.options } })),
    parameters: original.parameters.map(p => ({ ...p })),
  };
  TEMPLATE_REGISTRY.set(cloned.id, cloned);
  return cloned;
}
