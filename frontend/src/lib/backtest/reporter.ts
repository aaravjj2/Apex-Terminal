import type {
  BacktestResult,
  BacktestMetrics,
  Trade,
  EquityPoint,
  DrawdownPeriod,
  MonthlyReturn,
} from './types';
import { Side } from './types';
import {
  computeMetrics,
  computeMonthlyReturns,
  rollingMetric,
  maeMfeAnalysis,
  dayOfWeekAnalysis,
  hourOfDayAnalysis,
  tradeDurationDistribution,
  profitDistribution,
  regimeAnalysis,
  compareToBenchmark,
  tTestReturns,
  analyzeExposure,
  type MAEMFEPoint,
  type TemporalAnalysis,
  type DistributionBucket,
  type RegimePerformance,
  type BenchmarkComparison,
  type SignificanceTest,
  type ExposureAnalysis,
} from './analytics';

// ─── Report Data Structures ─────────────────────────────────────────────────

export interface SummaryStats {
  strategyName: string;
  symbol: string;
  period: string;
  initialCapital: number;
  finalEquity: number;
  netProfit: number;
  totalReturn: string;
  cagr: string;
  sharpe: string;
  sortino: string;
  calmar: string;
  maxDrawdown: string;
  maxDrawdownPercent: string;
  totalTrades: number;
  winRate: string;
  profitFactor: string;
  expectancy: string;
  avgTradeDuration: string;
  timeInMarket: string;
}

export interface TradeDetail {
  id: string;
  symbol: string;
  side: string;
  entryDate: string;
  exitDate: string;
  entryPrice: string;
  exitPrice: string;
  quantity: number;
  pnl: string;
  pnlPercent: string;
  duration: string;
  mae: string;
  mfe: string;
  entryReason: string;
  exitReason: string;
  tags: string[];
}

export interface MonthlyPerformanceCell {
  year: number;
  month: number;
  value: number;
  formatted: string;
}

export interface MonthlyPerformanceTable {
  years: number[];
  months: string[];
  cells: MonthlyPerformanceCell[];
  yearlyTotals: { year: number; value: number; formatted: string }[];
}

export interface ChartDataPoint {
  x: number;
  y: number;
  label?: string;
}

export interface RiskMetricsSummary {
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  treynorRatio: number;
  informationRatio: number;
  beta: number;
  alpha: number;
  var95: number;
  cvar95: number;
  ulcerIndex: number;
  tailRatio: number;
  kellyPercent: number;
  skewness: number;
  kurtosis: number;
}

export interface KeyTradeAnalysis {
  bestTrade: TradeDetail | null;
  worstTrade: TradeDetail | null;
  longestTrade: TradeDetail | null;
  shortestWinningTrade: TradeDetail | null;
  largestMFETrade: TradeDetail | null;
  largestMAETrade: TradeDetail | null;
}

export interface BacktestReport {
  summary: SummaryStats;
  metrics: BacktestMetrics;
  riskMetrics: RiskMetricsSummary;
  tradeList: TradeDetail[];
  monthlyPerformance: MonthlyPerformanceTable;
  equityCurveData: ChartDataPoint[];
  drawdownChartData: ChartDataPoint[];
  rollingSharpData: ChartDataPoint[];
  rollingSortinoData: ChartDataPoint[];
  rollingVolatilityData: ChartDataPoint[];
  profitDistributionData: DistributionBucket[];
  durationDistributionData: DistributionBucket[];
  maeMfeData: MAEMFEPoint[];
  dayOfWeekData: TemporalAnalysis[];
  hourOfDayData: TemporalAnalysis[];
  regimeData: RegimePerformance[];
  benchmarkComparison: BenchmarkComparison | null;
  significance: SignificanceTest;
  exposure: ExposureAnalysis;
  keyTrades: KeyTradeAnalysis;
  buyAndHoldComparison: {
    strategyReturn: number;
    buyAndHoldReturn: number;
    excessReturn: number;
  };
  generatedAt: string;
}

// ─── Formatters ─────────────────────────────────────────────────────────────

function formatDate(ts: number): string {
  return new Date(ts).toISOString().split('T')[0];
}

function formatDateTime(ts: number): string {
  return new Date(ts).toISOString().replace('T', ' ').slice(0, 19);
}

function formatCurrency(val: number): string {
  return val.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
}

function formatPercent(val: number, decimals = 2): string {
  return `${val >= 0 ? '+' : ''}${val.toFixed(decimals)}%`;
}

function formatDuration(ms: number): string {
  const days = ms / 86_400_000;
  if (days < 1) {
    const hours = ms / 3_600_000;
    return `${hours.toFixed(1)}h`;
  }
  if (days < 30) return `${days.toFixed(1)}d`;
  const months = days / 30.44;
  if (months < 12) return `${months.toFixed(1)}mo`;
  return `${(days / 365.25).toFixed(1)}y`;
}

function formatNumber(val: number, decimals = 2): string {
  return val.toFixed(decimals);
}

// ─── Trade Detail Converter ─────────────────────────────────────────────────

function tradeToDetail(t: Trade): TradeDetail {
  return {
    id: t.id,
    symbol: t.symbol,
    side: t.side === Side.LONG ? 'LONG' : 'SHORT',
    entryDate: formatDateTime(t.entryTime),
    exitDate: formatDateTime(t.exitTime),
    entryPrice: formatNumber(t.entryPrice),
    exitPrice: formatNumber(t.exitPrice),
    quantity: t.quantity,
    pnl: formatCurrency(t.pnl),
    pnlPercent: formatPercent(t.pnlPercent),
    duration: formatDuration(t.duration),
    mae: formatCurrency(t.mae),
    mfe: formatCurrency(t.mfe),
    entryReason: t.entryReason ?? '',
    exitReason: t.exitReason ?? '',
    tags: t.tags ?? [],
  };
}

// ─── Monthly Performance Table Builder ──────────────────────────────────────

function buildMonthlyTable(monthlyReturns: MonthlyReturn[]): MonthlyPerformanceTable {
  const years = [...new Set(monthlyReturns.map(m => m.year))].sort((a, b) => a - b);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const cells: MonthlyPerformanceCell[] = [];
  for (const mr of monthlyReturns) {
    cells.push({
      year: mr.year,
      month: mr.month,
      value: mr.returnPercent,
      formatted: formatPercent(mr.returnPercent),
    });
  }

  const yearlyTotals = years.map(y => {
    const yearReturns = monthlyReturns.filter(m => m.year === y);
    const compounded = yearReturns.reduce((acc, m) => acc * (1 + m.returnPercent / 100), 1) - 1;
    return { year: y, value: compounded * 100, formatted: formatPercent(compounded * 100) };
  });

  return { years, months, cells, yearlyTotals };
}

// ─── Buy-and-Hold Comparison ────────────────────────────────────────────────

function computeBuyAndHold(equityCurve: EquityPoint[], initialCapital: number): number {
  if (equityCurve.length < 2) return 0;
  const firstPrice = equityCurve[0].equity;
  const lastPrice = equityCurve[equityCurve.length - 1].equity;
  return ((lastPrice - firstPrice) / firstPrice) * 100;
}

// ─── Report Generator ───────────────────────────────────────────────────────

export function generateReport(
  result: BacktestResult,
  benchmarkPrices?: { time: number; close: number }[],
): BacktestReport {
  const { config, trades, equityCurve, metrics } = result;

  const finalEquity = equityCurve.length > 0 ? equityCurve[equityCurve.length - 1].equity : config.initialCapital;
  const periodStr = `${formatDate(config.startDate)} to ${formatDate(config.endDate)}`;

  const summary: SummaryStats = {
    strategyName: result.strategyName,
    symbol: config.symbols.join(', '),
    period: periodStr,
    initialCapital: config.initialCapital,
    finalEquity,
    netProfit: metrics.netProfit,
    totalReturn: formatPercent(metrics.totalReturnPercent),
    cagr: formatPercent(metrics.cagr),
    sharpe: formatNumber(metrics.sharpeRatio),
    sortino: formatNumber(metrics.sortinoRatio),
    calmar: formatNumber(metrics.calmarRatio),
    maxDrawdown: formatCurrency(metrics.maxDrawdown),
    maxDrawdownPercent: formatPercent(-metrics.maxDrawdownPercent),
    totalTrades: metrics.totalTrades,
    winRate: formatPercent(metrics.winRate, 1),
    profitFactor: formatNumber(metrics.profitFactor),
    expectancy: formatCurrency(metrics.expectancy),
    avgTradeDuration: formatDuration(metrics.avgTradeDuration),
    timeInMarket: formatPercent(metrics.timeInMarket, 1),
  };

  const riskMetrics: RiskMetricsSummary = {
    sharpeRatio: metrics.sharpeRatio,
    sortinoRatio: metrics.sortinoRatio,
    calmarRatio: metrics.calmarRatio,
    treynorRatio: metrics.treynorRatio,
    informationRatio: metrics.informationRatio,
    beta: metrics.beta,
    alpha: metrics.alpha,
    var95: metrics.var95,
    cvar95: metrics.cvar95,
    ulcerIndex: metrics.ulcerIndex,
    tailRatio: metrics.tailRatio,
    kellyPercent: metrics.kellyPercent,
    skewness: metrics.skewness,
    kurtosis: metrics.kurtosis,
  };

  const tradeList = trades.map(tradeToDetail);

  const monthlyPerformance = buildMonthlyTable(result.monthlyReturns);

  const equityCurveData: ChartDataPoint[] = equityCurve.map(ep => ({
    x: ep.time,
    y: ep.equity,
    label: formatDate(ep.time),
  }));

  const drawdownChartData: ChartDataPoint[] = equityCurve.map(ep => ({
    x: ep.time,
    y: -ep.drawdownPercent,
    label: formatDate(ep.time),
  }));

  const sharpeRolling = rollingMetric(result.dailyReturns, 30, 'sharpe', config.riskFreeRate);
  const rollingSharpData: ChartDataPoint[] = sharpeRolling.map(r => ({
    x: r.index,
    y: r.value,
  }));

  const sortinoRolling = rollingMetric(result.dailyReturns, 30, 'sortino', config.riskFreeRate);
  const rollingSortinoData: ChartDataPoint[] = sortinoRolling.map(r => ({
    x: r.index,
    y: r.value,
  }));

  const volRolling = rollingMetric(result.dailyReturns, 30, 'volatility', config.riskFreeRate);
  const rollingVolatilityData: ChartDataPoint[] = volRolling.map(r => ({
    x: r.index,
    y: r.value,
  }));

  const profitDistributionData = profitDistribution(trades);
  const durationDistributionData = tradeDurationDistribution(trades);
  const maeMfeData = maeMfeAnalysis(trades);
  const dayOfWeekData = dayOfWeekAnalysis(trades);
  const hourOfDayData = hourOfDayAnalysis(trades);

  const regimeData = benchmarkPrices ? regimeAnalysis(trades, benchmarkPrices) : [];

  const benchmarkComparison = result.benchmarkReturns
    ? compareToBenchmark(result.dailyReturns, result.benchmarkReturns, config.riskFreeRate)
    : null;

  const significance = tTestReturns(result.dailyReturns);
  const exposure = analyzeExposure(equityCurve);

  const keyTrades = computeKeyTrades(trades);

  const stratReturn = metrics.totalReturnPercent;
  const bnh = computeBuyAndHold(equityCurve, config.initialCapital);

  return {
    summary,
    metrics,
    riskMetrics,
    tradeList,
    monthlyPerformance,
    equityCurveData,
    drawdownChartData,
    rollingSharpData,
    rollingSortinoData,
    rollingVolatilityData,
    profitDistributionData,
    durationDistributionData,
    maeMfeData,
    dayOfWeekData,
    hourOfDayData,
    regimeData,
    benchmarkComparison,
    significance,
    exposure,
    keyTrades,
    buyAndHoldComparison: {
      strategyReturn: stratReturn,
      buyAndHoldReturn: bnh,
      excessReturn: stratReturn - bnh,
    },
    generatedAt: new Date().toISOString(),
  };
}

// ─── Key Trade Analysis ─────────────────────────────────────────────────────

function computeKeyTrades(trades: Trade[]): KeyTradeAnalysis {
  if (!trades.length) {
    return {
      bestTrade: null,
      worstTrade: null,
      longestTrade: null,
      shortestWinningTrade: null,
      largestMFETrade: null,
      largestMAETrade: null,
    };
  }

  const sorted = [...trades];
  const byPnl = [...sorted].sort((a, b) => b.pnl - a.pnl);
  const byDuration = [...sorted].sort((a, b) => b.duration - a.duration);
  const winners = sorted.filter(t => t.pnl > 0).sort((a, b) => a.duration - b.duration);
  const byMFE = [...sorted].sort((a, b) => b.mfe - a.mfe);
  const byMAE = [...sorted].sort((a, b) => b.mae - a.mae);

  return {
    bestTrade: tradeToDetail(byPnl[0]),
    worstTrade: tradeToDetail(byPnl[byPnl.length - 1]),
    longestTrade: tradeToDetail(byDuration[0]),
    shortestWinningTrade: winners.length > 0 ? tradeToDetail(winners[0]) : null,
    largestMFETrade: tradeToDetail(byMFE[0]),
    largestMAETrade: tradeToDetail(byMAE[0]),
  };
}

// ─── HTML Report Template ───────────────────────────────────────────────────

export function generateHTMLReport(report: BacktestReport): string {
  const { summary: s, metrics: m, monthlyPerformance: mp, tradeList } = report;

  const monthlyRows = mp.years.map(year => {
    const cells = Array.from({ length: 12 }, (_, month) => {
      const cell = mp.cells.find(c => c.year === year && c.month === month + 1);
      if (!cell) return '<td class="empty">-</td>';
      const cls = cell.value >= 0 ? 'positive' : 'negative';
      return `<td class="${cls}">${cell.formatted}</td>`;
    }).join('');
    const yearTotal = mp.yearlyTotals.find(yt => yt.year === year);
    return `<tr><td class="year">${year}</td>${cells}<td class="total">${yearTotal?.formatted ?? '-'}</td></tr>`;
  }).join('\n');

  const tradeRows = tradeList.slice(0, 100).map(t =>
    `<tr><td>${t.id}</td><td>${t.symbol}</td><td>${t.side}</td><td>${t.entryDate}</td><td>${t.exitDate}</td><td>${t.entryPrice}</td><td>${t.exitPrice}</td><td>${t.quantity}</td><td class="${t.pnl.startsWith('-') ? 'negative' : 'positive'}">${t.pnl}</td><td>${t.pnlPercent}</td><td>${t.duration}</td><td>${t.entryReason}</td></tr>`
  ).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Backtest Report: ${s.strategyName}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 2rem; background: #0f0f0f; color: #e0e0e0; }
  h1 { color: #fff; border-bottom: 2px solid #333; padding-bottom: 0.5rem; }
  h2 { color: #aaa; margin-top: 2rem; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1rem; margin: 1rem 0; }
  .stat { background: #1a1a1a; padding: 1rem; border-radius: 8px; border: 1px solid #333; }
  .stat .label { color: #888; font-size: 0.85rem; }
  .stat .value { font-size: 1.3rem; font-weight: 600; margin-top: 0.3rem; }
  .positive { color: #22c55e; }
  .negative { color: #ef4444; }
  table { width: 100%; border-collapse: collapse; margin: 1rem 0; font-size: 0.85rem; }
  th, td { padding: 0.4rem 0.6rem; border: 1px solid #333; text-align: right; }
  th { background: #1a1a1a; color: #aaa; }
  td.year, td.total { font-weight: 600; }
  td.empty { color: #555; }
  .footer { margin-top: 2rem; color: #666; font-size: 0.8rem; }
</style>
</head>
<body>
<h1>Backtest Report: ${s.strategyName}</h1>
<p>${s.symbol} | ${s.period}</p>

<h2>Summary</h2>
<div class="grid">
  <div class="stat"><div class="label">Initial Capital</div><div class="value">${formatCurrency(s.initialCapital)}</div></div>
  <div class="stat"><div class="label">Final Equity</div><div class="value">${formatCurrency(s.finalEquity)}</div></div>
  <div class="stat"><div class="label">Net Profit</div><div class="value ${s.netProfit >= 0 ? 'positive' : 'negative'}">${formatCurrency(s.netProfit)}</div></div>
  <div class="stat"><div class="label">Total Return</div><div class="value ${m.totalReturnPercent >= 0 ? 'positive' : 'negative'}">${s.totalReturn}</div></div>
  <div class="stat"><div class="label">CAGR</div><div class="value">${s.cagr}</div></div>
  <div class="stat"><div class="label">Sharpe</div><div class="value">${s.sharpe}</div></div>
  <div class="stat"><div class="label">Sortino</div><div class="value">${s.sortino}</div></div>
  <div class="stat"><div class="label">Max Drawdown</div><div class="value negative">${s.maxDrawdownPercent}</div></div>
  <div class="stat"><div class="label">Win Rate</div><div class="value">${s.winRate}</div></div>
  <div class="stat"><div class="label">Profit Factor</div><div class="value">${s.profitFactor}</div></div>
  <div class="stat"><div class="label">Total Trades</div><div class="value">${s.totalTrades}</div></div>
  <div class="stat"><div class="label">Expectancy</div><div class="value">${s.expectancy}</div></div>
</div>

<h2>Risk Metrics</h2>
<div class="grid">
  <div class="stat"><div class="label">VaR (95%)</div><div class="value">${formatCurrency(m.var95)}</div></div>
  <div class="stat"><div class="label">CVaR (95%)</div><div class="value">${formatCurrency(m.cvar95)}</div></div>
  <div class="stat"><div class="label">Ulcer Index</div><div class="value">${formatNumber(m.ulcerIndex)}</div></div>
  <div class="stat"><div class="label">Tail Ratio</div><div class="value">${formatNumber(m.tailRatio)}</div></div>
  <div class="stat"><div class="label">Beta</div><div class="value">${formatNumber(m.beta)}</div></div>
  <div class="stat"><div class="label">Alpha</div><div class="value">${formatPercent(m.alpha)}</div></div>
  <div class="stat"><div class="label">Kelly %</div><div class="value">${formatPercent(m.kellyPercent)}</div></div>
  <div class="stat"><div class="label">Skewness</div><div class="value">${formatNumber(m.skewness)}</div></div>
  <div class="stat"><div class="label">Kurtosis</div><div class="value">${formatNumber(m.kurtosis)}</div></div>
</div>

<h2>Monthly Returns</h2>
<table>
<thead><tr><th>Year</th><th>Jan</th><th>Feb</th><th>Mar</th><th>Apr</th><th>May</th><th>Jun</th><th>Jul</th><th>Aug</th><th>Sep</th><th>Oct</th><th>Nov</th><th>Dec</th><th>Total</th></tr></thead>
<tbody>${monthlyRows}</tbody>
</table>

<h2>Trade List (Top 100)</h2>
<table>
<thead><tr><th>ID</th><th>Symbol</th><th>Side</th><th>Entry</th><th>Exit</th><th>Entry $</th><th>Exit $</th><th>Qty</th><th>P&L</th><th>P&L %</th><th>Duration</th><th>Reason</th></tr></thead>
<tbody>${tradeRows}</tbody>
</table>

<div class="footer">
  <p>Generated: ${report.generatedAt} | Statistical significance p-value: ${report.significance.pValue.toFixed(4)}</p>
</div>
</body>
</html>`;
}

// ─── JSON Export ─────────────────────────────────────────────────────────────

export function exportReportJSON(report: BacktestReport): string {
  return JSON.stringify(report, null, 2);
}

// ─── PDF-Ready Structure ────────────────────────────────────────────────────

export interface PDFReportSection {
  title: string;
  type: 'text' | 'table' | 'chart' | 'grid';
  content: any;
}

export function generatePDFData(report: BacktestReport): PDFReportSection[] {
  const sections: PDFReportSection[] = [];

  sections.push({
    title: 'Summary',
    type: 'grid',
    content: Object.entries(report.summary).map(([key, val]) => ({
      label: key.replace(/([A-Z])/g, ' $1').trim(),
      value: typeof val === 'number' ? formatNumber(val) : String(val),
    })),
  });

  sections.push({
    title: 'Performance Metrics',
    type: 'grid',
    content: Object.entries(report.metrics).map(([key, val]) => ({
      label: key.replace(/([A-Z])/g, ' $1').trim(),
      value: typeof val === 'number' ? formatNumber(val, 4) : String(val),
    })),
  });

  sections.push({
    title: 'Equity Curve',
    type: 'chart',
    content: {
      type: 'line',
      data: report.equityCurveData,
      xLabel: 'Date',
      yLabel: 'Equity ($)',
    },
  });

  sections.push({
    title: 'Drawdown',
    type: 'chart',
    content: {
      type: 'area',
      data: report.drawdownChartData,
      xLabel: 'Date',
      yLabel: 'Drawdown (%)',
    },
  });

  sections.push({
    title: 'Monthly Returns',
    type: 'table',
    content: {
      headers: ['Year', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Total'],
      rows: report.monthlyPerformance.years.map(year => {
        const cells = Array.from({ length: 12 }, (_, m) => {
          const cell = report.monthlyPerformance.cells.find(c => c.year === year && c.month === m + 1);
          return cell ? cell.formatted : '-';
        });
        const total = report.monthlyPerformance.yearlyTotals.find(yt => yt.year === year);
        return [year.toString(), ...cells, total?.formatted ?? '-'];
      }),
    },
  });

  sections.push({
    title: 'P&L Distribution',
    type: 'chart',
    content: {
      type: 'histogram',
      data: report.profitDistributionData,
      xLabel: 'P&L ($)',
      yLabel: 'Frequency',
    },
  });

  sections.push({
    title: 'Trade Duration Distribution',
    type: 'chart',
    content: {
      type: 'histogram',
      data: report.durationDistributionData,
      xLabel: 'Duration (days)',
      yLabel: 'Frequency',
    },
  });

  sections.push({
    title: 'Day of Week Performance',
    type: 'table',
    content: {
      headers: ['Day', 'Trades', 'Win Rate', 'Avg P&L', 'Total P&L'],
      rows: report.dayOfWeekData.map(d => [
        d.label,
        d.trades.toString(),
        formatPercent(d.winRate, 1),
        formatCurrency(d.avgPnl),
        formatCurrency(d.totalPnl),
      ]),
    },
  });

  sections.push({
    title: 'Exposure Analysis',
    type: 'grid',
    content: [
      { label: 'Long Exposure', value: formatPercent(report.exposure.longExposurePercent) },
      { label: 'Short Exposure', value: formatPercent(report.exposure.shortExposurePercent) },
      { label: 'Net Exposure', value: formatPercent(report.exposure.netExposurePercent) },
      { label: 'Gross Exposure', value: formatPercent(report.exposure.grossExposurePercent) },
    ],
  });

  if (report.benchmarkComparison) {
    sections.push({
      title: 'Benchmark Comparison',
      type: 'grid',
      content: [
        { label: 'Strategy Return', value: formatPercent(report.benchmarkComparison.strategyReturn) },
        { label: 'Benchmark Return', value: formatPercent(report.benchmarkComparison.benchmarkReturn) },
        { label: 'Excess Return', value: formatPercent(report.benchmarkComparison.excessReturn) },
        { label: 'Beta', value: formatNumber(report.benchmarkComparison.beta) },
        { label: 'Alpha', value: formatPercent(report.benchmarkComparison.alpha) },
        { label: 'Correlation', value: formatNumber(report.benchmarkComparison.correlation) },
        { label: 'Tracking Error', value: formatPercent(report.benchmarkComparison.trackingError) },
        { label: 'Information Ratio', value: formatNumber(report.benchmarkComparison.informationRatio) },
      ],
    });
  }

  sections.push({
    title: 'Key Trades',
    type: 'table',
    content: {
      headers: ['Category', 'Symbol', 'Side', 'Entry', 'Exit', 'P&L', 'Duration'],
      rows: [
        report.keyTrades.bestTrade ? ['Best', report.keyTrades.bestTrade.symbol, report.keyTrades.bestTrade.side, report.keyTrades.bestTrade.entryDate, report.keyTrades.bestTrade.exitDate, report.keyTrades.bestTrade.pnl, report.keyTrades.bestTrade.duration] : null,
        report.keyTrades.worstTrade ? ['Worst', report.keyTrades.worstTrade.symbol, report.keyTrades.worstTrade.side, report.keyTrades.worstTrade.entryDate, report.keyTrades.worstTrade.exitDate, report.keyTrades.worstTrade.pnl, report.keyTrades.worstTrade.duration] : null,
        report.keyTrades.longestTrade ? ['Longest', report.keyTrades.longestTrade.symbol, report.keyTrades.longestTrade.side, report.keyTrades.longestTrade.entryDate, report.keyTrades.longestTrade.exitDate, report.keyTrades.longestTrade.pnl, report.keyTrades.longestTrade.duration] : null,
      ].filter(Boolean),
    },
  });

  sections.push({
    title: 'Statistical Significance',
    type: 'text',
    content: `Mean daily return: ${formatPercent(report.significance.meanReturn * 100, 4)}\nt-statistic: ${formatNumber(report.significance.tStatistic, 4)}\np-value: ${report.significance.pValue.toFixed(6)}\nSignificant at ${(report.significance.confidenceLevel * 100).toFixed(0)}%: ${report.significance.isSignificant ? 'YES' : 'NO'}`,
  });

  return sections;
}

// ─── Comparison Report ──────────────────────────────────────────────────────

export interface StrategyComparisonRow {
  strategyName: string;
  totalReturn: string;
  cagr: string;
  sharpe: string;
  sortino: string;
  maxDrawdown: string;
  winRate: string;
  profitFactor: string;
  totalTrades: number;
  calmar: string;
}

export function compareStrategies(results: BacktestResult[]): StrategyComparisonRow[] {
  return results.map(r => ({
    strategyName: r.strategyName,
    totalReturn: formatPercent(r.metrics.totalReturnPercent),
    cagr: formatPercent(r.metrics.cagr),
    sharpe: formatNumber(r.metrics.sharpeRatio),
    sortino: formatNumber(r.metrics.sortinoRatio),
    maxDrawdown: formatPercent(-r.metrics.maxDrawdownPercent),
    winRate: formatPercent(r.metrics.winRate, 1),
    profitFactor: formatNumber(r.metrics.profitFactor),
    totalTrades: r.metrics.totalTrades,
    calmar: formatNumber(r.metrics.calmarRatio),
  }));
}
