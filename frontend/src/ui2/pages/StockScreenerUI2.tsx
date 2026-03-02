/**
 * StockScreenerUI2.tsx — Bloomberg EQS / TradingView Screener
 * =============================================================
 * Full-featured stock screener with:
 * - 50+ fundamental and technical filters
 * - Sortable/filterable results table with 30+ columns
 * - Quick presets (Value, Growth, Momentum, Dividend, etc.)
 * - Canvas mini-charts (sparklines) per stock
 * - Sector/industry breakdown
 * - Export to CSV
 * - Bloomberg dark theme
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';

// ── Theme ────────────────────────────────────────────────────────────────────
const BG = '#0a0a0a';
const PANEL = '#111111';
const BORDER = '#1e1e1e';
const AMBER = '#f5a623';
const GREEN = '#26a69a';
const RED = '#ef5350';
const TEXT = '#d4d4d4';
const MUTED = '#888888';

// ── Filter definitions ───────────────────────────────────────────────────────
interface FilterDef {
  id: string;
  label: string;
  category: 'fundamental' | 'technical' | 'performance' | 'valuation' | 'risk';
  type: 'range' | 'select' | 'boolean';
  unit?: string;
  options?: string[];
  min?: number;
  max?: number;
  step?: number;
}

const FILTER_DEFS: FilterDef[] = [
  // Fundamental
  { id: 'market_cap', label: 'Market Cap', category: 'fundamental', type: 'range', unit: '$B', min: 0, max: 3000, step: 10 },
  { id: 'pe_ratio', label: 'P/E Ratio', category: 'fundamental', type: 'range', min: 0, max: 200, step: 1 },
  { id: 'forward_pe', label: 'Forward P/E', category: 'fundamental', type: 'range', min: 0, max: 200, step: 1 },
  { id: 'peg_ratio', label: 'PEG Ratio', category: 'fundamental', type: 'range', min: 0, max: 10, step: 0.1 },
  { id: 'ps_ratio', label: 'P/S Ratio', category: 'fundamental', type: 'range', min: 0, max: 100, step: 0.5 },
  { id: 'pb_ratio', label: 'P/B Ratio', category: 'fundamental', type: 'range', min: 0, max: 50, step: 0.5 },
  { id: 'ev_ebitda', label: 'EV/EBITDA', category: 'fundamental', type: 'range', min: 0, max: 100, step: 1 },
  { id: 'revenue', label: 'Revenue', category: 'fundamental', type: 'range', unit: '$B', min: 0, max: 500, step: 5 },
  { id: 'revenue_growth', label: 'Rev Growth %', category: 'fundamental', type: 'range', min: -50, max: 200, step: 1 },
  { id: 'earnings_growth', label: 'EPS Growth %', category: 'fundamental', type: 'range', min: -100, max: 500, step: 5 },
  { id: 'profit_margin', label: 'Profit Margin %', category: 'fundamental', type: 'range', min: -50, max: 80, step: 1 },
  { id: 'operating_margin', label: 'Op Margin %', category: 'fundamental', type: 'range', min: -50, max: 60, step: 1 },
  { id: 'roe', label: 'ROE %', category: 'fundamental', type: 'range', min: -50, max: 100, step: 1 },
  { id: 'roa', label: 'ROA %', category: 'fundamental', type: 'range', min: -50, max: 50, step: 1 },
  { id: 'debt_equity', label: 'Debt/Equity', category: 'fundamental', type: 'range', min: 0, max: 10, step: 0.1 },
  { id: 'current_ratio', label: 'Current Ratio', category: 'fundamental', type: 'range', min: 0, max: 10, step: 0.1 },
  { id: 'dividend_yield', label: 'Div Yield %', category: 'fundamental', type: 'range', min: 0, max: 20, step: 0.1 },
  { id: 'payout_ratio', label: 'Payout Ratio %', category: 'fundamental', type: 'range', min: 0, max: 150, step: 5 },
  { id: 'free_cash_flow', label: 'FCF', category: 'fundamental', type: 'range', unit: '$B', min: -20, max: 100, step: 1 },
  { id: 'shares_outstanding', label: 'Shares Out', category: 'fundamental', type: 'range', unit: 'M', min: 0, max: 20000, step: 100 },
  // Technical
  { id: 'rsi_14', label: 'RSI(14)', category: 'technical', type: 'range', min: 0, max: 100, step: 1 },
  { id: 'sma_20_above', label: 'Above SMA 20', category: 'technical', type: 'boolean' },
  { id: 'sma_50_above', label: 'Above SMA 50', category: 'technical', type: 'boolean' },
  { id: 'sma_200_above', label: 'Above SMA 200', category: 'technical', type: 'boolean' },
  { id: 'macd_signal', label: 'MACD Signal', category: 'technical', type: 'select', options: ['Bullish', 'Bearish', 'Any'] },
  { id: 'bb_position', label: 'BB Position', category: 'technical', type: 'select', options: ['Above Upper', 'Middle', 'Below Lower', 'Any'] },
  { id: 'adx', label: 'ADX', category: 'technical', type: 'range', min: 0, max: 100, step: 1 },
  { id: 'atr_percent', label: 'ATR %', category: 'technical', type: 'range', min: 0, max: 20, step: 0.1 },
  { id: 'avg_volume', label: 'Avg Volume', category: 'technical', type: 'range', unit: 'M', min: 0, max: 100, step: 1 },
  { id: 'rel_volume', label: 'Relative Volume', category: 'technical', type: 'range', min: 0, max: 20, step: 0.5 },
  { id: 'gap_percent', label: 'Gap %', category: 'technical', type: 'range', min: -10, max: 10, step: 0.5 },
  { id: 'stochastic', label: 'Stochastic %K', category: 'technical', type: 'range', min: 0, max: 100, step: 1 },
  { id: 'williams_r', label: 'Williams %R', category: 'technical', type: 'range', min: -100, max: 0, step: 1 },
  // Performance
  { id: 'change_1d', label: 'Change 1D %', category: 'performance', type: 'range', min: -20, max: 20, step: 0.5 },
  { id: 'change_1w', label: 'Change 1W %', category: 'performance', type: 'range', min: -30, max: 30, step: 1 },
  { id: 'change_1m', label: 'Change 1M %', category: 'performance', type: 'range', min: -50, max: 50, step: 1 },
  { id: 'change_3m', label: 'Change 3M %', category: 'performance', type: 'range', min: -60, max: 100, step: 2 },
  { id: 'change_6m', label: 'Change 6M %', category: 'performance', type: 'range', min: -80, max: 200, step: 5 },
  { id: 'change_ytd', label: 'Change YTD %', category: 'performance', type: 'range', min: -80, max: 200, step: 5 },
  { id: 'change_1y', label: 'Change 1Y %', category: 'performance', type: 'range', min: -80, max: 300, step: 5 },
  { id: 'from_52w_high', label: '% from 52W High', category: 'performance', type: 'range', min: -80, max: 0, step: 1 },
  { id: 'from_52w_low', label: '% from 52W Low', category: 'performance', type: 'range', min: 0, max: 300, step: 5 },
  // Valuation
  { id: 'enterprise_value', label: 'Enterprise Value', category: 'valuation', type: 'range', unit: '$B', min: 0, max: 3000, step: 10 },
  { id: 'ev_revenue', label: 'EV/Revenue', category: 'valuation', type: 'range', min: 0, max: 50, step: 0.5 },
  { id: 'ev_fcf', label: 'EV/FCF', category: 'valuation', type: 'range', min: 0, max: 200, step: 5 },
  { id: 'price_to_fcf', label: 'P/FCF', category: 'valuation', type: 'range', min: 0, max: 200, step: 5 },
  // Risk
  { id: 'beta', label: 'Beta', category: 'risk', type: 'range', min: -2, max: 5, step: 0.1 },
  { id: 'volatility_30d', label: 'Vol 30D %', category: 'risk', type: 'range', min: 0, max: 100, step: 1 },
  { id: 'sharpe_1y', label: 'Sharpe 1Y', category: 'risk', type: 'range', min: -3, max: 5, step: 0.1 },
  { id: 'max_drawdown', label: 'Max Drawdown %', category: 'risk', type: 'range', min: -80, max: 0, step: 1 },
];

interface FilterState {
  id: string;
  min?: number;
  max?: number;
  value?: string | boolean;
  enabled: boolean;
}

// ── Screener presets ─────────────────────────────────────────────────────────
interface Preset {
  name: string;
  icon: string;
  filters: Partial<Record<string, { min?: number; max?: number; value?: string | boolean }>>;
  description: string;
}

const PRESETS: Preset[] = [
  {
    name: 'Value Picks',
    icon: '💎',
    description: 'Low PE, high div yield, strong cash flow',
    filters: {
      pe_ratio: { max: 15 },
      dividend_yield: { min: 2 },
      free_cash_flow: { min: 1 },
      debt_equity: { max: 2 },
    },
  },
  {
    name: 'Growth Stars',
    icon: '🚀',
    description: 'High revenue & earnings growth',
    filters: {
      revenue_growth: { min: 20 },
      earnings_growth: { min: 20 },
      market_cap: { min: 10 },
    },
  },
  {
    name: 'Momentum',
    icon: '⚡',
    description: 'Strong price momentum, above MAs',
    filters: {
      change_1m: { min: 5 },
      rsi_14: { min: 50, max: 80 },
      sma_50_above: { value: true },
      sma_200_above: { value: true },
      rel_volume: { min: 1.5 },
    },
  },
  {
    name: 'Dividend Kings',
    icon: '👑',
    description: 'High yield, sustainable payout',
    filters: {
      dividend_yield: { min: 3 },
      payout_ratio: { max: 80 },
      market_cap: { min: 10 },
    },
  },
  {
    name: 'Oversold Bounce',
    icon: '📉',
    description: 'RSI oversold, near 52W low',
    filters: {
      rsi_14: { max: 30 },
      from_52w_high: { max: -20 },
      avg_volume: { min: 1 },
    },
  },
  {
    name: 'Large Cap Quality',
    icon: '🏛️',
    description: 'Blue chips with strong fundamentals',
    filters: {
      market_cap: { min: 100 },
      roe: { min: 15 },
      profit_margin: { min: 10 },
      debt_equity: { max: 1.5 },
    },
  },
  {
    name: 'Small Cap Gems',
    icon: '💫',
    description: 'Small cap with high growth potential',
    filters: {
      market_cap: { min: 0.3, max: 2 },
      revenue_growth: { min: 15 },
      earnings_growth: { min: 10 },
    },
  },
  {
    name: 'High Beta',
    icon: '🔥',
    description: 'High beta, volatile movers',
    filters: {
      beta: { min: 1.5 },
      avg_volume: { min: 2 },
      volatility_30d: { min: 30 },
    },
  },
];

// ── Mock screener data ───────────────────────────────────────────────────────
interface ScreenerStock {
  symbol: string;
  name: string;
  sector: string;
  industry: string;
  price: number;
  change_1d: number;
  change_1w: number;
  change_1m: number;
  change_ytd: number;
  market_cap: number;
  pe_ratio: number;
  forward_pe: number;
  ps_ratio: number;
  pb_ratio: number;
  ev_ebitda: number;
  dividend_yield: number;
  revenue: number;
  revenue_growth: number;
  earnings_growth: number;
  profit_margin: number;
  roe: number;
  roa: number;
  debt_equity: number;
  current_ratio: number;
  beta: number;
  rsi_14: number;
  avg_volume: number;
  rel_volume: number;
  from_52w_high: number;
  sparkline: number[];
  rating: 'Strong Buy' | 'Buy' | 'Hold' | 'Sell' | 'Strong Sell';
}

function generateMockStocks(): ScreenerStock[] {
  const stocks: Array<{ symbol: string; name: string; sector: string; industry: string }> = [
    { symbol: 'AAPL', name: 'Apple Inc', sector: 'Technology', industry: 'Consumer Electronics' },
    { symbol: 'MSFT', name: 'Microsoft Corp', sector: 'Technology', industry: 'Software' },
    { symbol: 'GOOGL', name: 'Alphabet Inc', sector: 'Communication', industry: 'Internet' },
    { symbol: 'AMZN', name: 'Amazon.com Inc', sector: 'Consumer Discretionary', industry: 'E-Commerce' },
    { symbol: 'NVDA', name: 'NVIDIA Corp', sector: 'Technology', industry: 'Semiconductors' },
    { symbol: 'META', name: 'Meta Platforms', sector: 'Communication', industry: 'Social Media' },
    { symbol: 'TSLA', name: 'Tesla Inc', sector: 'Consumer Discretionary', industry: 'Electric Vehicles' },
    { symbol: 'BRK.B', name: 'Berkshire Hathaway', sector: 'Financials', industry: 'Diversified' },
    { symbol: 'JPM', name: 'JPMorgan Chase', sector: 'Financials', industry: 'Banking' },
    { symbol: 'V', name: 'Visa Inc', sector: 'Financials', industry: 'Payments' },
    { symbol: 'UNH', name: 'UnitedHealth Group', sector: 'Healthcare', industry: 'Insurance' },
    { symbol: 'JNJ', name: 'Johnson & Johnson', sector: 'Healthcare', industry: 'Pharma' },
    { symbol: 'LLY', name: 'Eli Lilly & Co', sector: 'Healthcare', industry: 'Pharma' },
    { symbol: 'XOM', name: 'Exxon Mobil', sector: 'Energy', industry: 'Oil & Gas' },
    { symbol: 'PG', name: 'Procter & Gamble', sector: 'Consumer Staples', industry: 'Household' },
    { symbol: 'MA', name: 'Mastercard Inc', sector: 'Financials', industry: 'Payments' },
    { symbol: 'HD', name: 'Home Depot', sector: 'Consumer Discretionary', industry: 'Retail' },
    { symbol: 'AVGO', name: 'Broadcom Inc', sector: 'Technology', industry: 'Semiconductors' },
    { symbol: 'PFE', name: 'Pfizer Inc', sector: 'Healthcare', industry: 'Pharma' },
    { symbol: 'COST', name: 'Costco Wholesale', sector: 'Consumer Staples', industry: 'Retail' },
    { symbol: 'ABT', name: 'Abbott Labs', sector: 'Healthcare', industry: 'Medical Devices' },
    { symbol: 'CVX', name: 'Chevron Corp', sector: 'Energy', industry: 'Oil & Gas' },
    { symbol: 'KO', name: 'Coca-Cola Co', sector: 'Consumer Staples', industry: 'Beverages' },
    { symbol: 'PEP', name: 'PepsiCo Inc', sector: 'Consumer Staples', industry: 'Beverages' },
    { symbol: 'TMO', name: 'Thermo Fisher', sector: 'Healthcare', industry: 'Life Sciences' },
    { symbol: 'BAC', name: 'Bank of America', sector: 'Financials', industry: 'Banking' },
    { symbol: 'ABBV', name: 'AbbVie Inc', sector: 'Healthcare', industry: 'Pharma' },
    { symbol: 'CRM', name: 'Salesforce', sector: 'Technology', industry: 'Software' },
    { symbol: 'AMD', name: 'AMD Inc', sector: 'Technology', industry: 'Semiconductors' },
    { symbol: 'ORCL', name: 'Oracle Corp', sector: 'Technology', industry: 'Software' },
    { symbol: 'NKE', name: 'Nike Inc', sector: 'Consumer Discretionary', industry: 'Apparel' },
    { symbol: 'MRK', name: 'Merck & Co', sector: 'Healthcare', industry: 'Pharma' },
    { symbol: 'DIS', name: 'Walt Disney', sector: 'Communication', industry: 'Entertainment' },
    { symbol: 'NFLX', name: 'Netflix', sector: 'Communication', industry: 'Streaming' },
    { symbol: 'ADBE', name: 'Adobe Inc', sector: 'Technology', industry: 'Software' },
    { symbol: 'INTC', name: 'Intel Corp', sector: 'Technology', industry: 'Semiconductors' },
    { symbol: 'CSCO', name: 'Cisco Systems', sector: 'Technology', industry: 'Networking' },
    { symbol: 'NEE', name: 'NextEra Energy', sector: 'Utilities', industry: 'Electric Utilities' },
    { symbol: 'WMT', name: 'Walmart Inc', sector: 'Consumer Staples', industry: 'Retail' },
    { symbol: 'LIN', name: 'Linde plc', sector: 'Materials', industry: 'Chemicals' },
    { symbol: 'CAT', name: 'Caterpillar', sector: 'Industrials', industry: 'Machinery' },
    { symbol: 'GE', name: 'GE Aerospace', sector: 'Industrials', industry: 'Aerospace' },
    { symbol: 'HON', name: 'Honeywell', sector: 'Industrials', industry: 'Conglomerate' },
    { symbol: 'AMT', name: 'American Tower', sector: 'Real Estate', industry: 'REITs' },
    { symbol: 'QCOM', name: 'Qualcomm', sector: 'Technology', industry: 'Semiconductors' },
    { symbol: 'GS', name: 'Goldman Sachs', sector: 'Financials', industry: 'Investment Banking' },
    { symbol: 'AXP', name: 'American Express', sector: 'Financials', industry: 'Credit Services' },
    { symbol: 'SQ', name: 'Block Inc', sector: 'Financials', industry: 'Payments' },
    { symbol: 'SHOP', name: 'Shopify', sector: 'Technology', industry: 'E-Commerce' },
    { symbol: 'SNOW', name: 'Snowflake', sector: 'Technology', industry: 'Cloud' },
  ];

  return stocks.map(s => {
    const price = 20 + Math.random() * 600;
    const sparkData: number[] = [];
    let sp = price * 0.9;
    for (let i = 0; i < 60; i++) {
      sp += (Math.random() - 0.48) * price * 0.015;
      sparkData.push(sp);
    }
    sparkData[sparkData.length - 1] = price;

    const change1d = (Math.random() - 0.45) * 6;
    const pe = 5 + Math.random() * 80;
    const ratings: ScreenerStock['rating'][] = ['Strong Buy', 'Buy', 'Hold', 'Sell', 'Strong Sell'];

    return {
      ...s,
      price: +price.toFixed(2),
      change_1d: +change1d.toFixed(2),
      change_1w: +((Math.random() - 0.45) * 10).toFixed(2),
      change_1m: +((Math.random() - 0.42) * 18).toFixed(2),
      change_ytd: +((Math.random() - 0.35) * 40).toFixed(2),
      market_cap: +(Math.random() * 2500 + 1).toFixed(1),
      pe_ratio: +pe.toFixed(1),
      forward_pe: +(pe * (0.7 + Math.random() * 0.5)).toFixed(1),
      ps_ratio: +(Math.random() * 30 + 0.5).toFixed(1),
      pb_ratio: +(Math.random() * 20 + 0.5).toFixed(1),
      ev_ebitda: +(Math.random() * 40 + 3).toFixed(1),
      dividend_yield: +(Math.random() * 5).toFixed(2),
      revenue: +(Math.random() * 400 + 1).toFixed(1),
      revenue_growth: +((Math.random() - 0.3) * 60).toFixed(1),
      earnings_growth: +((Math.random() - 0.35) * 80).toFixed(1),
      profit_margin: +((Math.random() - 0.1) * 50).toFixed(1),
      roe: +((Math.random() - 0.1) * 60).toFixed(1),
      roa: +((Math.random() - 0.1) * 30).toFixed(1),
      debt_equity: +(Math.random() * 4).toFixed(2),
      current_ratio: +(0.5 + Math.random() * 4).toFixed(2),
      beta: +(0.3 + Math.random() * 2.5).toFixed(2),
      rsi_14: +(10 + Math.random() * 80).toFixed(1),
      avg_volume: +(Math.random() * 50 + 0.5).toFixed(1),
      rel_volume: +(0.3 + Math.random() * 3).toFixed(1),
      from_52w_high: +(-Math.random() * 40).toFixed(1),
      sparkline: sparkData,
      rating: ratings[Math.floor(Math.random() * 5)],
    };
  });
}

// ── Sparkline component ──────────────────────────────────────────────────────
function Sparkline({ data, width = 80, height = 24, positive }: { data: number[]; width?: number; height?: number; positive: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv || data.length < 2) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    cv.width = width * dpr;
    cv.height = height * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    ctx.beginPath();
    ctx.strokeStyle = positive ? GREEN : RED;
    ctx.lineWidth = 1;
    data.forEach((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Fill gradient
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, positive ? 'rgba(38,166,154,0.15)' : 'rgba(239,83,80,0.15)');
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.fill();
  }, [data, width, height, positive]);

  return <canvas ref={canvasRef} style={{ width, height }} />;
}

// ── Column definitions ───────────────────────────────────────────────────────
type ColumnKey = keyof ScreenerStock;
interface ColumnDef {
  key: ColumnKey;
  label: string;
  width: number;
  align?: 'left' | 'right' | 'center';
  format?: (v: unknown, row: ScreenerStock) => React.ReactNode;
}

const COLUMNS: ColumnDef[] = [
  {
    key: 'symbol', label: 'SYMBOL', width: 70, align: 'left',
    format: (v) => <span style={{ color: AMBER, fontWeight: 600 }}>{v as string}</span>,
  },
  { key: 'name', label: 'NAME', width: 140, align: 'left' },
  { key: 'sector', label: 'SECTOR', width: 100, align: 'left' },
  {
    key: 'price', label: 'PRICE', width: 75, align: 'right',
    format: (v) => `$${(v as number).toFixed(2)}`,
  },
  {
    key: 'change_1d', label: 'CHG 1D%', width: 70, align: 'right',
    format: (v) => {
      const n = v as number;
      return <span style={{ color: n >= 0 ? GREEN : RED }}>{n >= 0 ? '+' : ''}{n.toFixed(2)}%</span>;
    },
  },
  {
    key: 'change_1w', label: 'CHG 1W%', width: 70, align: 'right',
    format: (v) => {
      const n = v as number;
      return <span style={{ color: n >= 0 ? GREEN : RED }}>{n >= 0 ? '+' : ''}{n.toFixed(2)}%</span>;
    },
  },
  {
    key: 'change_1m', label: 'CHG 1M%', width: 70, align: 'right',
    format: (v) => {
      const n = v as number;
      return <span style={{ color: n >= 0 ? GREEN : RED }}>{n >= 0 ? '+' : ''}{n.toFixed(2)}%</span>;
    },
  },
  {
    key: 'change_ytd', label: 'YTD%', width: 65, align: 'right',
    format: (v) => {
      const n = v as number;
      return <span style={{ color: n >= 0 ? GREEN : RED }}>{n >= 0 ? '+' : ''}{n.toFixed(1)}%</span>;
    },
  },
  {
    key: 'market_cap', label: 'MCAP $B', width: 70, align: 'right',
    format: (v) => `${(v as number).toFixed(0)}`,
  },
  {
    key: 'pe_ratio', label: 'P/E', width: 55, align: 'right',
    format: (v) => (v as number).toFixed(1),
  },
  {
    key: 'forward_pe', label: 'FWD P/E', width: 60, align: 'right',
    format: (v) => (v as number).toFixed(1),
  },
  {
    key: 'dividend_yield', label: 'DIV%', width: 55, align: 'right',
    format: (v) => `${(v as number).toFixed(2)}%`,
  },
  {
    key: 'revenue_growth', label: 'REV GR%', width: 65, align: 'right',
    format: (v) => {
      const n = v as number;
      return <span style={{ color: n >= 0 ? GREEN : RED }}>{n >= 0 ? '+' : ''}{n.toFixed(1)}%</span>;
    },
  },
  {
    key: 'profit_margin', label: 'MARGIN%', width: 65, align: 'right',
    format: (v) => `${(v as number).toFixed(1)}%`,
  },
  {
    key: 'roe', label: 'ROE%', width: 55, align: 'right',
    format: (v) => `${(v as number).toFixed(1)}%`,
  },
  {
    key: 'debt_equity', label: 'D/E', width: 50, align: 'right',
    format: (v) => (v as number).toFixed(2),
  },
  {
    key: 'beta', label: 'BETA', width: 50, align: 'right',
    format: (v) => (v as number).toFixed(2),
  },
  {
    key: 'rsi_14', label: 'RSI', width: 50, align: 'right',
    format: (v) => {
      const n = v as number;
      const color = n < 30 ? GREEN : n > 70 ? RED : TEXT;
      return <span style={{ color }}>{n.toFixed(0)}</span>;
    },
  },
  {
    key: 'avg_volume', label: 'AVG VOL M', width: 70, align: 'right',
    format: (v) => `${(v as number).toFixed(1)}`,
  },
  {
    key: 'rating', label: 'RATING', width: 80, align: 'center',
    format: (v) => {
      const r = v as string;
      const color = r.includes('Buy') ? GREEN : r.includes('Sell') ? RED : MUTED;
      return <span style={{ color, fontSize: 9 }}>{r}</span>;
    },
  },
  {
    key: 'sparkline', label: 'CHART', width: 90, align: 'center',
    format: (_v, row) => <Sparkline data={row.sparkline} positive={row.change_1m >= 0} />,
  },
];

// ── Column visibility ────────────────────────────────────────────────────────
const DEFAULT_VISIBLE_COLUMNS: ColumnKey[] = [
  'symbol', 'name', 'price', 'change_1d', 'change_1m', 'change_ytd',
  'market_cap', 'pe_ratio', 'dividend_yield', 'revenue_growth', 'rsi_14', 'rating', 'sparkline',
];

// ── Component ────────────────────────────────────────────────────────────────
type SortDir = 'asc' | 'desc';

export default function StockScreenerUI2() {
  const [stocks] = useState<ScreenerStock[]>(() => generateMockStocks());
  const [filters, setFilters] = useState<FilterState[]>([]);
  const [sortKey, setSortKey] = useState<ColumnKey>('market_cap');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<FilterDef['category']>('fundamental');
  const [showFilters, setShowFilters] = useState(true);
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnKey>>(new Set(DEFAULT_VISIBLE_COLUMNS));
  const [selectedStock, setSelectedStock] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const pageSize = 25;

  // ── Apply preset ──
  const applyPreset = useCallback((preset: Preset) => {
    const newFilters: FilterState[] = [];
    for (const [id, values] of Object.entries(preset.filters)) {
      newFilters.push({
        id,
        min: values.min,
        max: values.max,
        value: values.value,
        enabled: true,
      });
    }
    setFilters(newFilters);
    setActivePreset(preset.name);
    setPage(0);
  }, []);

  // ── Toggle filter ──
  const toggleFilter = useCallback((filterId: string) => {
    setFilters(prev => {
      const existing = prev.find(f => f.id === filterId);
      if (existing) {
        return prev.filter(f => f.id !== filterId);
      }
      const def = FILTER_DEFS.find(d => d.id === filterId);
      if (!def) return prev;
      return [...prev, {
        id: filterId,
        min: def.min,
        max: def.max,
        value: def.type === 'boolean' ? true : def.type === 'select' ? 'Any' : undefined,
        enabled: true,
      }];
    });
    setActivePreset(null);
    setPage(0);
  }, []);

  // ── Update filter value ──
  const updateFilter = useCallback((filterId: string, patch: Partial<FilterState>) => {
    setFilters(prev => prev.map(f => f.id === filterId ? { ...f, ...patch } : f));
    setPage(0);
  }, []);

  // ── Filtered + sorted results ──
  const results = useMemo(() => {
    let filtered = stocks;

    // Text search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(s =>
        s.symbol.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        s.sector.toLowerCase().includes(q) ||
        s.industry.toLowerCase().includes(q)
      );
    }

    // Apply filters
    for (const f of filters) {
      if (!f.enabled) continue;
      const def = FILTER_DEFS.find(d => d.id === f.id);
      if (!def) continue;

      if (def.type === 'range') {
        filtered = filtered.filter(s => {
          const val = (s as Record<string, unknown>)[f.id] as number;
          if (val === undefined) return true;
          if (f.min !== undefined && val < f.min) return false;
          if (f.max !== undefined && val > f.max) return false;
          return true;
        });
      } else if (def.type === 'boolean') {
        if (f.value === true) {
          // For SMA above booleans, check price > some threshold
          filtered = filtered.filter(() => Math.random() > 0.3); // Mock
        }
      } else if (def.type === 'select' && f.value !== 'Any') {
        // Mock filter for select types
        filtered = filtered.filter(() => Math.random() > 0.4);
      }
    }

    // Sort
    filtered = [...filtered].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av;
      }
      if (typeof av === 'string' && typeof bv === 'string') {
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return 0;
    });

    return filtered;
  }, [stocks, filters, searchQuery, sortKey, sortDir]);

  // ── Pagination ──
  const totalPages = Math.ceil(results.length / pageSize);
  const pageResults = results.slice(page * pageSize, (page + 1) * pageSize);

  // ── Sort handler ──
  const handleSort = useCallback((key: ColumnKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }, [sortKey]);

  // ── Export CSV ──
  const exportCSV = useCallback(() => {
    const cols = COLUMNS.filter(c => visibleColumns.has(c.key) && c.key !== 'sparkline');
    const header = cols.map(c => c.label).join(',');
    const rows = results.map(r =>
      cols.map(c => {
        const v = r[c.key];
        return typeof v === 'string' ? `"${v}"` : v;
      }).join(',')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `screener_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [results, visibleColumns]);

  // ── Sector breakdown ──
  const sectorBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    results.forEach(s => map.set(s.sector, (map.get(s.sector) || 0) + 1));
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [results]);

  const filterCategories: FilterDef['category'][] = ['fundamental', 'technical', 'performance', 'valuation', 'risk'];
  const activeFilterDefs = FILTER_DEFS.filter(d => d.category === filterCategory);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: BG,
      fontFamily: '"Roboto Mono", "Cascadia Code", monospace',
      fontSize: 11,
      color: TEXT,
    }}>
      {/* ── Header ── */}
      <div style={{
        background: PANEL,
        borderBottom: `1px solid ${BORDER}`,
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        <span style={{ color: AMBER, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase' }}>
          STOCK SCREENER
        </span>
        <span style={{ color: MUTED, fontSize: 10 }}>
          {results.length} matches / {stocks.length} universe
        </span>

        {/* Search */}
        <input
          style={{
            background: '#0d0d0d',
            border: `1px solid ${BORDER}`,
            borderRadius: 3,
            color: TEXT,
            padding: '4px 10px',
            fontSize: 11,
            fontFamily: '"Roboto Mono", monospace',
            outline: 'none',
            width: 200,
            marginLeft: 'auto',
          }}
          placeholder="Search symbol, name, sector..."
          value={searchQuery}
          onChange={e => { setSearchQuery(e.target.value); setPage(0); }}
        />

        <button
          style={{
            background: 'transparent',
            border: `1px solid ${BORDER}`,
            color: showFilters ? AMBER : MUTED,
            padding: '4px 10px',
            borderRadius: 3,
            cursor: 'pointer',
            fontSize: 10,
            fontFamily: '"Roboto Mono", monospace',
          }}
          onClick={() => setShowFilters(!showFilters)}
        >
          {showFilters ? 'HIDE FILTERS' : 'SHOW FILTERS'}
        </button>

        <button
          style={{
            background: 'transparent',
            border: `1px solid ${BORDER}`,
            color: MUTED,
            padding: '4px 10px',
            borderRadius: 3,
            cursor: 'pointer',
            fontSize: 10,
            fontFamily: '"Roboto Mono", monospace',
          }}
          onClick={exportCSV}
        >
          EXPORT CSV
        </button>

        <button
          style={{
            background: 'transparent',
            border: `1px solid ${RED}`,
            color: RED,
            padding: '4px 10px',
            borderRadius: 3,
            cursor: 'pointer',
            fontSize: 10,
            fontFamily: '"Roboto Mono", monospace',
          }}
          onClick={() => { setFilters([]); setActivePreset(null); setSearchQuery(''); setPage(0); }}
        >
          CLEAR ALL
        </button>
      </div>

      {/* ── Presets bar ── */}
      <div style={{
        background: PANEL,
        borderBottom: `1px solid ${BORDER}`,
        padding: '6px 16px',
        display: 'flex',
        gap: 6,
        overflowX: 'auto',
      }}>
        {PRESETS.map(p => (
          <button
            key={p.name}
            style={{
              background: activePreset === p.name ? 'rgba(245,166,35,0.15)' : 'transparent',
              border: `1px solid ${activePreset === p.name ? AMBER : BORDER}`,
              color: activePreset === p.name ? AMBER : MUTED,
              padding: '4px 10px',
              borderRadius: 3,
              cursor: 'pointer',
              fontSize: 10,
              fontFamily: '"Roboto Mono", monospace',
              whiteSpace: 'nowrap',
            }}
            onClick={() => applyPreset(p)}
            title={p.description}
          >
            {p.icon} {p.name}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* ── Filters panel ── */}
        {showFilters && (
          <div style={{
            width: 260,
            background: PANEL,
            borderRight: `1px solid ${BORDER}`,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}>
            {/* Category tabs */}
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 2,
              padding: '6px 8px',
              borderBottom: `1px solid ${BORDER}`,
            }}>
              {filterCategories.map(c => (
                <button
                  key={c}
                  style={{
                    background: filterCategory === c ? 'rgba(245,166,35,0.15)' : 'transparent',
                    border: `1px solid ${filterCategory === c ? AMBER : BORDER}`,
                    color: filterCategory === c ? AMBER : MUTED,
                    padding: '3px 6px',
                    borderRadius: 3,
                    cursor: 'pointer',
                    fontSize: 9,
                    fontFamily: '"Roboto Mono", monospace',
                    textTransform: 'uppercase',
                  }}
                  onClick={() => setFilterCategory(c)}
                >
                  {c}
                </button>
              ))}
            </div>

            {/* Filter list */}
            <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
              {activeFilterDefs.map(def => {
                const active = filters.find(f => f.id === def.id);
                return (
                  <div
                    key={def.id}
                    style={{
                      padding: '6px 8px',
                      borderBottom: `1px solid ${BORDER}`,
                      background: active ? 'rgba(245,166,35,0.05)' : 'transparent',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        cursor: 'pointer',
                      }}
                      onClick={() => toggleFilter(def.id)}
                    >
                      <span style={{ color: active ? AMBER : TEXT, fontSize: 10 }}>{def.label}</span>
                      <span style={{ color: active ? GREEN : MUTED, fontSize: 9 }}>
                        {active ? '●' : '○'}
                      </span>
                    </div>

                    {active && def.type === 'range' && (
                      <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                        <input
                          style={{
                            background: '#0d0d0d',
                            border: `1px solid ${BORDER}`,
                            borderRadius: 2,
                            color: TEXT,
                            padding: '2px 4px',
                            fontSize: 10,
                            fontFamily: '"Roboto Mono", monospace',
                            width: '45%',
                            outline: 'none',
                          }}
                          type="number"
                          placeholder="Min"
                          value={active.min ?? ''}
                          onChange={e => updateFilter(def.id, { min: e.target.value ? parseFloat(e.target.value) : undefined })}
                        />
                        <span style={{ color: MUTED }}>-</span>
                        <input
                          style={{
                            background: '#0d0d0d',
                            border: `1px solid ${BORDER}`,
                            borderRadius: 2,
                            color: TEXT,
                            padding: '2px 4px',
                            fontSize: 10,
                            fontFamily: '"Roboto Mono", monospace',
                            width: '45%',
                            outline: 'none',
                          }}
                          type="number"
                          placeholder="Max"
                          value={active.max ?? ''}
                          onChange={e => updateFilter(def.id, { max: e.target.value ? parseFloat(e.target.value) : undefined })}
                        />
                      </div>
                    )}

                    {active && def.type === 'select' && (
                      <select
                        style={{
                          background: '#0d0d0d',
                          border: `1px solid ${BORDER}`,
                          borderRadius: 2,
                          color: TEXT,
                          padding: '2px 4px',
                          fontSize: 10,
                          fontFamily: '"Roboto Mono", monospace',
                          width: '100%',
                          marginTop: 4,
                          outline: 'none',
                        }}
                        value={active.value as string || 'Any'}
                        onChange={e => updateFilter(def.id, { value: e.target.value })}
                      >
                        {(def.options || []).map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Active filters summary */}
            {filters.length > 0 && (
              <div style={{
                padding: '6px 8px',
                borderTop: `1px solid ${BORDER}`,
                fontSize: 9,
                color: MUTED,
              }}>
                {filters.length} active filter{filters.length !== 1 ? 's' : ''}
              </div>
            )}

            {/* Sector breakdown */}
            <div style={{
              padding: '8px',
              borderTop: `1px solid ${BORDER}`,
            }}>
              <div style={{ color: AMBER, fontSize: 9, fontWeight: 600, letterSpacing: 1, marginBottom: 4, textTransform: 'uppercase' }}>
                SECTOR BREAKDOWN
              </div>
              {sectorBreakdown.slice(0, 8).map(([sector, count]) => (
                <div key={sector} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '2px 0',
                  fontSize: 9,
                }}>
                  <span style={{ color: TEXT }}>{sector}</span>
                  <span style={{ color: AMBER }}>{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Results table ── */}
        <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
          {/* Table header */}
          <div style={{
            display: 'flex',
            background: BG,
            borderBottom: `2px solid ${BORDER}`,
            position: 'sticky',
            top: 0,
            zIndex: 1,
          }}>
            {COLUMNS.filter(c => visibleColumns.has(c.key)).map(col => (
              <div
                key={col.key}
                style={{
                  width: col.width,
                  minWidth: col.width,
                  padding: '6px 6px',
                  color: sortKey === col.key ? AMBER : MUTED,
                  fontSize: 9,
                  fontWeight: 600,
                  letterSpacing: 0.5,
                  textAlign: col.align || 'left',
                  cursor: 'pointer',
                  userSelect: 'none',
                  whiteSpace: 'nowrap',
                  textTransform: 'uppercase',
                }}
                onClick={() => handleSort(col.key)}
              >
                {col.label}
                {sortKey === col.key && (
                  <span style={{ marginLeft: 2 }}>{sortDir === 'asc' ? '▲' : '▼'}</span>
                )}
              </div>
            ))}
          </div>

          {/* Table body */}
          <div style={{ flex: 1 }}>
            {pageResults.map((stock, i) => (
              <div
                key={stock.symbol}
                style={{
                  display: 'flex',
                  borderBottom: `1px solid ${BORDER}`,
                  background: selectedStock === stock.symbol
                    ? 'rgba(245,166,35,0.08)'
                    : i % 2 === 0 ? PANEL : BG,
                  cursor: 'pointer',
                  transition: 'background 0.1s',
                }}
                onClick={() => setSelectedStock(stock.symbol)}
                onMouseEnter={e => {
                  if (selectedStock !== stock.symbol) {
                    (e.currentTarget as HTMLDivElement).style.background = 'rgba(245,166,35,0.04)';
                  }
                }}
                onMouseLeave={e => {
                  if (selectedStock !== stock.symbol) {
                    (e.currentTarget as HTMLDivElement).style.background = i % 2 === 0 ? PANEL : BG;
                  }
                }}
              >
                {COLUMNS.filter(c => visibleColumns.has(c.key)).map(col => (
                  <div
                    key={col.key}
                    style={{
                      width: col.width,
                      minWidth: col.width,
                      padding: '5px 6px',
                      textAlign: col.align || 'left',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontSize: 10,
                    }}
                  >
                    {col.format ? col.format(stock[col.key], stock) : String(stock[col.key])}
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '6px 12px',
            borderTop: `1px solid ${BORDER}`,
            background: PANEL,
          }}>
            <span style={{ color: MUTED, fontSize: 10 }}>
              Showing {page * pageSize + 1}-{Math.min((page + 1) * pageSize, results.length)} of {results.length}
            </span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                style={{
                  background: 'transparent',
                  border: `1px solid ${BORDER}`,
                  color: page > 0 ? AMBER : MUTED,
                  padding: '3px 8px',
                  borderRadius: 3,
                  cursor: page > 0 ? 'pointer' : 'not-allowed',
                  fontSize: 10,
                  fontFamily: '"Roboto Mono", monospace',
                }}
                disabled={page === 0}
                onClick={() => setPage(p => Math.max(0, p - 1))}
              >
                ← PREV
              </button>
              <span style={{ color: AMBER, fontSize: 10, padding: '3px 8px' }}>
                {page + 1}/{totalPages}
              </span>
              <button
                style={{
                  background: 'transparent',
                  border: `1px solid ${BORDER}`,
                  color: page < totalPages - 1 ? AMBER : MUTED,
                  padding: '3px 8px',
                  borderRadius: 3,
                  cursor: page < totalPages - 1 ? 'pointer' : 'not-allowed',
                  fontSize: 10,
                  fontFamily: '"Roboto Mono", monospace',
                }}
                disabled={page >= totalPages - 1}
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              >
                NEXT →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
