import React, { useState, useEffect, useCallback, useRef } from 'react';

/**
 * HeatmapUI2 — Bloomberg Terminal-Grade Market Heatmap
 * Squarified treemap via Canvas, sector breakdown, real-time data polling,
 * TradingView-style interactive heatmap with full KPI strip & stats panel.
 * All inline Bloomberg styling, zero external dependencies.
 */

// ─── Bloomberg APEX palette ─────────────────────────────────────────────────
const BG = '#0a0a0a';
const PANEL = '#111111';
const BORDER = '#1e1e1e';
const AMBER = '#f5a623';
const GREEN = '#26a69a';
const RED = '#ef5350';
const BLUE = '#42a5f5';
const SUBTLE = '#555';
const TEXT = '#d1d4dc';
const MONO = "'IBM Plex Mono','Roboto Mono','Courier New',monospace";

// ─── Shared micro-styles ────────────────────────────────────────────────────
const _panelStyle: React.CSSProperties = {
  background: PANEL, border: `1px solid ${BORDER}`, borderTop: `2px solid ${AMBER}`,
  overflow: 'hidden', display: 'flex', flexDirection: 'column', borderRadius: 0,
};
void _panelStyle;
const panelHdr: React.CSSProperties = {
  padding: '4px 10px', background: 'rgba(245,166,35,0.06)', borderBottom: `1px solid ${BORDER}`,
  fontSize: 9, color: AMBER, fontWeight: 700, letterSpacing: '0.12em',
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  textTransform: 'uppercase', fontFamily: MONO,
};
const btnBase: React.CSSProperties = {
  background: 'transparent', border: `1px solid ${BORDER}`, color: SUBTLE,
  fontFamily: MONO, fontSize: 10, padding: '3px 10px', cursor: 'pointer',
  letterSpacing: '0.08em', transition: 'all 0.15s',
};
const btnActive: React.CSSProperties = {
  ...btnBase, background: 'rgba(245,166,35,0.12)', color: AMBER,
  borderColor: AMBER,
};

// ─── Types ──────────────────────────────────────────────────────────────────
interface StockData {
  symbol: string;
  name: string;
  sector: string;
  marketCap: number;
  change: number;
  volume: number;
  price: number;
}

interface TreemapRect {
  x: number; y: number; w: number; h: number;
  stock: StockData;
}

interface TooltipInfo {
  x: number; y: number;
  stock: StockData;
}

type TabKey = 'SECTOR MAP' | 'S&P 500' | 'CRYPTO' | 'WORLD MARKETS' | 'CUSTOM';
type Period = '1D' | '1W' | '1M' | '3M' | '6M' | 'YTD' | '1Y';

// ─── Comprehensive mock data (60+ stocks across 11 GICS sectors) ────────────
const MOCK_STOCKS: StockData[] = [
  // Technology
  { symbol: 'AAPL', name: 'Apple Inc.', sector: 'Technology', marketCap: 3050e9, change: 1.24, volume: 54.3e6, price: 198.11 },
  { symbol: 'MSFT', name: 'Microsoft Corp.', sector: 'Technology', marketCap: 2890e9, change: 0.87, volume: 28.1e6, price: 415.60 },
  { symbol: 'NVDA', name: 'NVIDIA Corp.', sector: 'Technology', marketCap: 2750e9, change: 3.41, volume: 62.5e6, price: 875.30 },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', sector: 'Technology', marketCap: 2100e9, change: -0.32, volume: 22.6e6, price: 171.84 },
  { symbol: 'META', name: 'Meta Platforms', sector: 'Technology', marketCap: 1350e9, change: 1.56, volume: 18.4e6, price: 525.42 },
  { symbol: 'AVGO', name: 'Broadcom Inc.', sector: 'Technology', marketCap: 790e9, change: 2.13, volume: 5.2e6, price: 186.20 },
  { symbol: 'ORCL', name: 'Oracle Corp.', sector: 'Technology', marketCap: 380e9, change: -0.45, volume: 8.9e6, price: 138.90 },
  { symbol: 'CRM', name: 'Salesforce Inc.', sector: 'Technology', marketCap: 305e9, change: 0.92, volume: 6.1e6, price: 312.50 },
  { symbol: 'AMD', name: 'Advanced Micro Devices', sector: 'Technology', marketCap: 280e9, change: -1.88, volume: 44.8e6, price: 173.25 },
  { symbol: 'INTC', name: 'Intel Corp.', sector: 'Technology', marketCap: 185e9, change: -2.34, volume: 38.6e6, price: 43.80 },
  // Healthcare
  { symbol: 'UNH', name: 'UnitedHealth Group', sector: 'Healthcare', marketCap: 520e9, change: 0.65, volume: 3.8e6, price: 565.30 },
  { symbol: 'LLY', name: 'Eli Lilly & Co.', sector: 'Healthcare', marketCap: 710e9, change: 2.11, volume: 4.5e6, price: 748.90 },
  { symbol: 'JNJ', name: 'Johnson & Johnson', sector: 'Healthcare', marketCap: 390e9, change: -0.28, volume: 7.2e6, price: 161.40 },
  { symbol: 'ABBV', name: 'AbbVie Inc.', sector: 'Healthcare', marketCap: 310e9, change: 0.44, volume: 5.9e6, price: 175.80 },
  { symbol: 'MRK', name: 'Merck & Co.', sector: 'Healthcare', marketCap: 305e9, change: -0.91, volume: 9.3e6, price: 121.55 },
  { symbol: 'PFE', name: 'Pfizer Inc.', sector: 'Healthcare', marketCap: 155e9, change: -1.52, volume: 25.1e6, price: 27.60 },
  // Financials
  { symbol: 'BRK.B', name: 'Berkshire Hathaway', sector: 'Financials', marketCap: 890e9, change: 0.33, volume: 3.1e6, price: 412.70 },
  { symbol: 'JPM', name: 'JPMorgan Chase', sector: 'Financials', marketCap: 580e9, change: 1.02, volume: 9.7e6, price: 200.40 },
  { symbol: 'V', name: 'Visa Inc.', sector: 'Financials', marketCap: 560e9, change: 0.74, volume: 6.2e6, price: 281.90 },
  { symbol: 'MA', name: 'Mastercard Inc.', sector: 'Financials', marketCap: 430e9, change: 0.58, volume: 3.4e6, price: 461.30 },
  { symbol: 'BAC', name: 'Bank of America', sector: 'Financials', marketCap: 290e9, change: -0.67, volume: 32.5e6, price: 36.80 },
  { symbol: 'GS', name: 'Goldman Sachs', sector: 'Financials', marketCap: 150e9, change: 1.44, volume: 2.8e6, price: 453.60 },
  // Consumer Discretionary
  { symbol: 'AMZN', name: 'Amazon.com Inc.', sector: 'Consumer Discretionary', marketCap: 1920e9, change: 0.95, volume: 42.3e6, price: 185.60 },
  { symbol: 'TSLA', name: 'Tesla Inc.', sector: 'Consumer Discretionary', marketCap: 780e9, change: -2.75, volume: 98.4e6, price: 245.20 },
  { symbol: 'HD', name: 'Home Depot', sector: 'Consumer Discretionary', marketCap: 370e9, change: 0.38, volume: 4.1e6, price: 371.50 },
  { symbol: 'NKE', name: 'Nike Inc.', sector: 'Consumer Discretionary', marketCap: 155e9, change: -1.12, volume: 8.9e6, price: 100.30 },
  { symbol: 'MCD', name: "McDonald's Corp.", sector: 'Consumer Discretionary', marketCap: 205e9, change: 0.22, volume: 3.5e6, price: 284.60 },
  { symbol: 'SBUX', name: 'Starbucks Corp.', sector: 'Consumer Discretionary', marketCap: 105e9, change: -0.83, volume: 7.6e6, price: 92.10 },
  // Energy
  { symbol: 'XOM', name: 'Exxon Mobil', sector: 'Energy', marketCap: 460e9, change: -0.55, volume: 15.3e6, price: 109.40 },
  { symbol: 'CVX', name: 'Chevron Corp.', sector: 'Energy', marketCap: 290e9, change: -0.82, volume: 8.4e6, price: 155.70 },
  { symbol: 'COP', name: 'ConocoPhillips', sector: 'Energy', marketCap: 140e9, change: -1.15, volume: 6.2e6, price: 115.30 },
  { symbol: 'SLB', name: 'Schlumberger', sector: 'Energy', marketCap: 80e9, change: 0.67, volume: 10.1e6, price: 56.20 },
  { symbol: 'EOG', name: 'EOG Resources', sector: 'Energy', marketCap: 72e9, change: -0.44, volume: 3.9e6, price: 123.40 },
  // Industrials
  { symbol: 'CAT', name: 'Caterpillar Inc.', sector: 'Industrials', marketCap: 170e9, change: 1.33, volume: 2.8e6, price: 340.20 },
  { symbol: 'GE', name: 'GE Aerospace', sector: 'Industrials', marketCap: 195e9, change: 0.89, volume: 5.4e6, price: 178.50 },
  { symbol: 'RTX', name: 'RTX Corp.', sector: 'Industrials', marketCap: 145e9, change: 0.41, volume: 4.1e6, price: 107.80 },
  { symbol: 'UNP', name: 'Union Pacific', sector: 'Industrials', marketCap: 150e9, change: -0.23, volume: 2.9e6, price: 245.60 },
  { symbol: 'HON', name: 'Honeywell Intl.', sector: 'Industrials', marketCap: 135e9, change: 0.55, volume: 3.2e6, price: 207.30 },
  { symbol: 'BA', name: 'Boeing Co.', sector: 'Industrials', marketCap: 125e9, change: -1.67, volume: 12.3e6, price: 205.80 },
  // Materials
  { symbol: 'LIN', name: 'Linde plc', sector: 'Materials', marketCap: 210e9, change: 0.72, volume: 2.1e6, price: 438.90 },
  { symbol: 'APD', name: 'Air Products', sector: 'Materials', marketCap: 65e9, change: 0.34, volume: 1.4e6, price: 292.30 },
  { symbol: 'SHW', name: 'Sherwin-Williams', sector: 'Materials', marketCap: 85e9, change: 0.56, volume: 1.1e6, price: 335.70 },
  { symbol: 'FCX', name: 'Freeport-McMoRan', sector: 'Materials', marketCap: 62e9, change: -1.88, volume: 14.2e6, price: 43.10 },
  { symbol: 'NEM', name: 'Newmont Corp.', sector: 'Materials', marketCap: 50e9, change: 1.95, volume: 8.5e6, price: 43.50 },
  // Utilities
  { symbol: 'NEE', name: 'NextEra Energy', sector: 'Utilities', marketCap: 150e9, change: 0.33, volume: 7.8e6, price: 73.20 },
  { symbol: 'DUK', name: 'Duke Energy', sector: 'Utilities', marketCap: 80e9, change: -0.15, volume: 3.1e6, price: 103.40 },
  { symbol: 'SO', name: 'Southern Co.', sector: 'Utilities', marketCap: 85e9, change: 0.28, volume: 4.2e6, price: 78.60 },
  { symbol: 'D', name: 'Dominion Energy', sector: 'Utilities', marketCap: 42e9, change: -0.52, volume: 3.8e6, price: 50.80 },
  { symbol: 'AEP', name: 'American Electric', sector: 'Utilities', marketCap: 48e9, change: 0.19, volume: 2.6e6, price: 92.30 },
  // Real Estate
  { symbol: 'PLD', name: 'Prologis Inc.', sector: 'Real Estate', marketCap: 115e9, change: 0.88, volume: 4.5e6, price: 124.70 },
  { symbol: 'AMT', name: 'American Tower', sector: 'Real Estate', marketCap: 95e9, change: -0.42, volume: 2.3e6, price: 204.10 },
  { symbol: 'EQIX', name: 'Equinix Inc.', sector: 'Real Estate', marketCap: 78e9, change: 1.15, volume: 1.2e6, price: 818.40 },
  { symbol: 'CCI', name: 'Crown Castle', sector: 'Real Estate', marketCap: 45e9, change: -0.73, volume: 3.1e6, price: 103.80 },
  { symbol: 'SPG', name: 'Simon Property', sector: 'Real Estate', marketCap: 52e9, change: 0.41, volume: 2.8e6, price: 155.20 },
  // Communication Services
  { symbol: 'GOOG', name: 'Alphabet (C)', sector: 'Communication', marketCap: 2080e9, change: -0.28, volume: 18.9e6, price: 169.50 },
  { symbol: 'NFLX', name: 'Netflix Inc.', sector: 'Communication', marketCap: 290e9, change: 1.78, volume: 6.7e6, price: 672.40 },
  { symbol: 'DIS', name: 'Walt Disney Co.', sector: 'Communication', marketCap: 205e9, change: 0.45, volume: 9.3e6, price: 112.30 },
  { symbol: 'CMCSA', name: 'Comcast Corp.', sector: 'Communication', marketCap: 170e9, change: -0.62, volume: 14.5e6, price: 43.20 },
  { symbol: 'T', name: 'AT&T Inc.', sector: 'Communication', marketCap: 125e9, change: 0.31, volume: 28.4e6, price: 17.40 },
  // Consumer Staples
  { symbol: 'PG', name: 'Procter & Gamble', sector: 'Consumer Staples', marketCap: 370e9, change: 0.18, volume: 6.1e6, price: 157.80 },
  { symbol: 'KO', name: 'Coca-Cola Co.', sector: 'Consumer Staples', marketCap: 265e9, change: 0.42, volume: 10.3e6, price: 61.20 },
  { symbol: 'PEP', name: 'PepsiCo Inc.', sector: 'Consumer Staples', marketCap: 230e9, change: -0.35, volume: 5.4e6, price: 167.40 },
  { symbol: 'COST', name: 'Costco Wholesale', sector: 'Consumer Staples', marketCap: 310e9, change: 0.77, volume: 2.8e6, price: 700.50 },
  { symbol: 'WMT', name: 'Walmart Inc.', sector: 'Consumer Staples', marketCap: 430e9, change: 0.55, volume: 7.2e6, price: 160.30 },
  { symbol: 'PM', name: 'Philip Morris Intl.', sector: 'Consumer Staples', marketCap: 150e9, change: -0.19, volume: 4.1e6, price: 96.70 },
];

const SECTORS = [
  'Technology', 'Healthcare', 'Financials', 'Consumer Discretionary',
  'Energy', 'Industrials', 'Materials', 'Utilities', 'Real Estate',
  'Communication', 'Consumer Staples',
];

const TABS: TabKey[] = ['SECTOR MAP', 'S&P 500', 'CRYPTO', 'WORLD MARKETS', 'CUSTOM'];
const PERIODS: Period[] = ['1D', '1W', '1M', '3M', '6M', 'YTD', '1Y'];

// ─── Helpers ────────────────────────────────────────────────────────────────
const fmtPct = (n: number): string => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
const fmtCap = (n: number): string =>
  n >= 1e12 ? `$${(n / 1e12).toFixed(2)}T` :
  n >= 1e9 ? `$${(n / 1e9).toFixed(1)}B` :
  n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : `$${n.toFixed(0)}`;
const fmtVol = (n: number): string =>
  n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` :
  n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : `${n.toFixed(0)}`;
const clr = (n: number): string => n >= 0 ? GREEN : RED;

/** Map a change % to a color on the red-green spectrum */
// @ts-expect-error reserved utility
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _perfColor = (change: number): string => {
  const clamped = Math.max(-5, Math.min(5, change));
  const t = (clamped + 5) / 10; // 0..1
  if (t < 0.5) {
    // red to neutral
    const r = 239;
    const g = Math.round(83 + (120 - 83) * (t / 0.5));
    const b = Math.round(80 + (80 - 80) * (t / 0.5));
    return `rgb(${r},${g},${b})`;
  } else {
    // neutral to green
    const p = (t - 0.5) / 0.5;
    const r = Math.round(120 - (120 - 38) * p);
    const g = Math.round(120 + (166 - 120) * p);
    const b = Math.round(80 + (154 - 80) * p);
    return `rgb(${r},${g},${b})`;
  }
};

/** Darker version for tile background with alpha feel */
const perfBg = (change: number): string => {
  const clamped = Math.max(-5, Math.min(5, change));
  const t = (clamped + 5) / 10;
  if (t < 0.5) {
    const intensity = 0.3 + 0.4 * (1 - t / 0.5);
    return `rgba(239,83,80,${intensity})`;
  } else {
    const intensity = 0.3 + 0.4 * ((t - 0.5) / 0.5);
    return `rgba(38,166,154,${intensity})`;
  }
};

// ─── Squarified Treemap Algorithm ───────────────────────────────────────────
interface LayoutRect {
  x: number; y: number; w: number; h: number;
}

interface TreeNode {
  value: number;
  stock: StockData;
}

function squarify(
  items: TreeNode[],
  bounds: LayoutRect,
): TreemapRect[] {
  if (items.length === 0) return [];
  const totalValue = items.reduce((s, i) => s + i.value, 0);
  if (totalValue <= 0) return [];

  const sorted = [...items].sort((a, b) => b.value - a.value);
  const results: TreemapRect[] = [];
  layoutStrip(sorted, bounds, totalValue, results);
  return results;
}

function layoutStrip(
  items: TreeNode[],
  bounds: LayoutRect,
  totalValue: number,
  results: TreemapRect[],
): void {
  if (items.length === 0) return;
  if (items.length === 1) {
    results.push({ x: bounds.x, y: bounds.y, w: bounds.w, h: bounds.h, stock: items[0].stock });
    return;
  }

  const { x, y, w, h } = bounds;
  const isHorizontal = w >= h;
  const side = isHorizontal ? h : w;
  if (side <= 0) return;

  let row: TreeNode[] = [];
  let rowValue = 0;
  let bestAspect = Infinity;

  for (let i = 0; i < items.length; i++) {
    const candidate = [...row, items[i]];
    const candidateValue = rowValue + items[i].value;
    const rowFraction = candidateValue / totalValue;
    const rowSize = isHorizontal ? w * rowFraction : h * rowFraction;

    const worst = worstAspect(candidate, candidateValue, side, rowSize);
    if (worst <= bestAspect) {
      row = candidate;
      rowValue = candidateValue;
      bestAspect = worst;
    } else {
      // lay out the current row
      const rowFrac = rowValue / totalValue;
      const rowDim = isHorizontal ? w * rowFrac : h * rowFrac;
      layRow(row, rowValue, bounds, isHorizontal, rowDim, results);

      const remaining = items.slice(i);
      const remValue = totalValue - rowValue;
      const newBounds: LayoutRect = isHorizontal
        ? { x: x + rowDim, y, w: w - rowDim, h }
        : { x, y: y + rowDim, w, h: h - rowDim };
      layoutStrip(remaining, newBounds, remValue, results);
      return;
    }
  }

  // final row
  const rowFrac = rowValue / totalValue;
  const rowDim = isHorizontal ? w * rowFrac : h * rowFrac;
  layRow(row, rowValue, bounds, isHorizontal, rowDim, results);
}

function layRow(
  row: TreeNode[],
  rowValue: number,
  bounds: LayoutRect,
  isHorizontal: boolean,
  rowDim: number,
  results: TreemapRect[],
): void {
  let offset = 0;
  const side = isHorizontal ? bounds.h : bounds.w;

  for (const item of row) {
    const fraction = item.value / rowValue;
    const itemDim = side * fraction;

    if (isHorizontal) {
      results.push({
        x: bounds.x, y: bounds.y + offset,
        w: rowDim, h: itemDim,
        stock: item.stock,
      });
    } else {
      results.push({
        x: bounds.x + offset, y: bounds.y,
        w: itemDim, h: rowDim,
        stock: item.stock,
      });
    }
    offset += itemDim;
  }
}

function worstAspect(
  row: TreeNode[],
  rowValue: number,
  side: number,
  rowSize: number,
): number {
  if (rowSize <= 0) return Infinity;
  let worst = 0;
  for (const item of row) {
    const frac = item.value / rowValue;
    const itemDim = side * frac;
    const aspect = Math.max(rowSize / itemDim, itemDim / rowSize);
    if (aspect > worst) worst = aspect;
  }
  return worst;
}

// ─── Sector grouping treemap: layout sectors first, then stocks within ──────
function buildSectorTreemap(
  stocks: StockData[],
  width: number,
  height: number,
): TreemapRect[] {
  const sectorMap = new Map<string, StockData[]>();
  for (const s of stocks) {
    const arr = sectorMap.get(s.sector) || [];
    arr.push(s);
    sectorMap.set(s.sector, arr);
  }

  const sectorNodes: { sector: string; value: number; stocks: StockData[] }[] = [];
  for (const [sector, list] of sectorMap) {
    const total = list.reduce((s, st) => s + st.marketCap, 0);
    sectorNodes.push({ sector, value: total, stocks: list });
  }
  sectorNodes.sort((a, b) => b.value - a.value);

  // First pass: lay out sector rectangles
  // total value computed implicitly in squarify via sectorItems
  const sectorItems: TreeNode[] = sectorNodes.map(n => ({
    value: n.value,
    stock: { symbol: n.sector, name: n.sector, sector: n.sector, marketCap: n.value, change: 0, volume: 0, price: 0 },
  }));

  const sectorRects = squarify(sectorItems, { x: 0, y: 0, w: width, h: height });

  // Second pass: within each sector rect, lay out individual stocks
  const allRects: TreemapRect[] = [];
  for (let i = 0; i < sectorRects.length; i++) {
    const sr = sectorRects[i];
    const sn = sectorNodes[i];
    if (!sn) continue;

    const padding = 2;
    const headerH = 16;
    const innerBounds: LayoutRect = {
      x: sr.x + padding,
      y: sr.y + headerH + padding,
      w: Math.max(0, sr.w - padding * 2),
      h: Math.max(0, sr.h - headerH - padding * 2),
    };

    const stockNodes: TreeNode[] = sn.stocks.map(st => ({
      value: st.marketCap,
      stock: st,
    }));

    const stockRects = squarify(stockNodes, innerBounds);
    allRects.push(...stockRects);

    // Add a special "header" rect for the sector label
    allRects.push({
      x: sr.x, y: sr.y, w: sr.w, h: headerH,
      stock: {
        symbol: `__SECTOR__${sn.sector}`,
        name: sn.sector,
        sector: sn.sector,
        marketCap: sn.value,
        change: sn.stocks.reduce((s, st) => s + st.change, 0) / sn.stocks.length,
        volume: 0, price: 0,
      },
    });
  }

  return allRects;
}

// ─── Canvas draw ────────────────────────────────────────────────────────────
function drawTreemap(
  ctx: CanvasRenderingContext2D,
  rects: TreemapRect[],
  width: number,
  height: number,
  hoveredSymbol: string | null,
  dpr: number,
): void {
  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);

  // Background
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, width, height);

  // Draw sector headers
  const sectorHeaders = rects.filter(r => r.stock.symbol.startsWith('__SECTOR__'));
  const stockTiles = rects.filter(r => !r.stock.symbol.startsWith('__SECTOR__'));

  for (const r of sectorHeaders) {
    ctx.fillStyle = 'rgba(245,166,35,0.08)';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = BORDER;
    ctx.lineWidth = 1;
    ctx.strokeRect(r.x, r.y, r.w, r.h);

    if (r.w > 40) {
      ctx.fillStyle = AMBER;
      ctx.font = `bold 9px ${MONO.replace(/'/g, '')}`;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      const label = r.stock.name.toUpperCase();
      ctx.fillText(label, r.x + 4, r.y + r.h / 2, r.w - 8);
    }
  }

  // Draw stock tiles
  for (const r of stockTiles) {
    if (r.w < 1 || r.h < 1) continue;

    const isHovered = hoveredSymbol === r.stock.symbol;
    const gap = 1;

    // Fill
    ctx.fillStyle = perfBg(r.stock.change);
    ctx.fillRect(r.x + gap, r.y + gap, r.w - gap * 2, r.h - gap * 2);

    // Hover highlight
    if (isHovered) {
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(r.x + gap, r.y + gap, r.w - gap * 2, r.h - gap * 2);
      ctx.strokeStyle = AMBER;
      ctx.lineWidth = 2;
      ctx.strokeRect(r.x + gap, r.y + gap, r.w - gap * 2, r.h - gap * 2);
    } else {
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(r.x + gap, r.y + gap, r.w - gap * 2, r.h - gap * 2);
    }

    // Labels — only if tile is large enough
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;

    if (r.w > 50 && r.h > 30) {
      // Symbol
      const fontSize = Math.min(14, Math.max(9, Math.min(r.w, r.h) / 5));
      ctx.font = `bold ${fontSize}px ${MONO.replace(/'/g, '')}`;
      ctx.fillStyle = '#ffffff';
      ctx.fillText(r.stock.symbol, cx, cy - fontSize * 0.5, r.w - 8);

      // Change %
      const pctSize = Math.max(8, fontSize - 2);
      ctx.font = `${pctSize}px ${MONO.replace(/'/g, '')}`;
      ctx.fillStyle = r.stock.change >= 0 ? '#b2dfdb' : '#ffcdd2';
      ctx.fillText(fmtPct(r.stock.change), cx, cy + fontSize * 0.6, r.w - 8);
    } else if (r.w > 28 && r.h > 18) {
      // Symbol only, small
      const fontSize = Math.max(7, Math.min(10, Math.min(r.w, r.h) / 4));
      ctx.font = `bold ${fontSize}px ${MONO.replace(/'/g, '')}`;
      ctx.fillStyle = '#ffffff';
      ctx.fillText(r.stock.symbol, cx, cy, r.w - 4);
    }
  }

  ctx.restore();
}

// ─── Main Component ─────────────────────────────────────────────────────────
const HeatmapUI2: React.FC = () => {
  const [tab, setTab] = useState<TabKey>('SECTOR MAP');
  const [period, setPeriod] = useState<Period>('1D');
  const [stocks, setStocks] = useState<StockData[]>(MOCK_STOCKS);
  const [sectorFilter, setSectorFilter] = useState<string>('ALL');
  const [minCap, setMinCap] = useState<number>(0);
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null);
  const [hoveredSymbol, setHoveredSymbol] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState<{ w: number; h: number }>({ w: 900, h: 500 });

  // ── Fetch data ────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/v1/market-data/heatmap?period=${period}&tab=${tab}`);
        if (res.ok) {
          const data = await res.json();
          if (!cancelled && Array.isArray(data.stocks) && data.stocks.length > 0) {
            setStocks(data.stocks);
            return;
          }
        }
      } catch { /* fallback */ }
      // Apply random jitter to mock data based on period for variety
      if (!cancelled) {
        const jittered = MOCK_STOCKS.map(s => {
          const periodMultiplier: Record<Period, number> = {
            '1D': 1, '1W': 1.5, '1M': 2, '3M': 3, '6M': 4, 'YTD': 3.5, '1Y': 5,
          };
          const mult = periodMultiplier[period];
          const jitter = (Math.random() - 0.5) * 0.6 * mult;
          return { ...s, change: +(s.change * mult + jitter).toFixed(2) };
        });
        setStocks(jittered);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [period, tab]);

  // ── Filtered stocks ───────────────────────────────────────────────────────
  const filtered = React.useMemo(() => stocks.filter(s => {
    if (sectorFilter !== 'ALL' && s.sector !== sectorFilter) return false;
    if (s.marketCap < minCap * 1e9) return false;
    return true;
  }), [stocks, sectorFilter, minCap]);

  // ── Resize observer ───────────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setCanvasSize({ w: Math.floor(width), h: Math.floor(height) });
        }
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── Build treemap rects ─────────────────────────────────────────────────
  const rects = React.useMemo(() => {
    if (filtered.length === 0 || canvasSize.w <= 0 || canvasSize.h <= 0) return [];
    return buildSectorTreemap(filtered, canvasSize.w, canvasSize.h);
  }, [filtered, canvasSize]);

  // ── Draw canvas ───────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasSize.w * dpr;
    canvas.height = canvasSize.h * dpr;
    canvas.style.width = `${canvasSize.w}px`;
    canvas.style.height = `${canvasSize.h}px`;

    drawTreemap(ctx, rects, canvasSize.w, canvasSize.h, hoveredSymbol, dpr);
  }, [rects, canvasSize, hoveredSymbol]);

  // ── Mouse handlers ────────────────────────────────────────────────────────
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const stockTiles = rects.filter(r => !r.stock.symbol.startsWith('__SECTOR__'));
    let found: TreemapRect | null = null;
    for (const r of stockTiles) {
      if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) {
        found = r;
        break;
      }
    }

    if (found) {
      setHoveredSymbol(found.stock.symbol);
      setTooltip({ x: e.clientX, y: e.clientY, stock: found.stock });
    } else {
      setHoveredSymbol(null);
      setTooltip(null);
    }
  }, [rects]);

  const handleMouseLeave = useCallback(() => {
    setHoveredSymbol(null);
    setTooltip(null);
  }, []);

  // ── KPI computations ─────────────────────────────────────────────────────
  const advancers = filtered.filter(s => s.change > 0).length;
  const decliners = filtered.filter(s => s.change < 0).length;
  const unchanged = filtered.filter(s => s.change === 0).length;
  const adRatio = decliners > 0 ? (advancers / decliners).toFixed(2) : '∞';
  const topGainer = [...filtered].sort((a, b) => b.change - a.change)[0];
  const topLoser = [...filtered].sort((a, b) => a.change - b.change)[0];
  const breadth = filtered.length > 0
    ? ((advancers / filtered.length) * 100).toFixed(1) + '%'
    : '0%';

  // ── Sector performance for stats panel ────────────────────────────────────
  const sectorPerf = SECTORS.map(sector => {
    const inSector = filtered.filter(s => s.sector === sector);
    if (inSector.length === 0) return { sector, avgChange: 0, count: 0 };
    const avg = inSector.reduce((s, st) => s + st.change, 0) / inSector.length;
    return { sector, avgChange: +avg.toFixed(2), count: inSector.length };
  }).filter(sp => sp.count > 0).sort((a, b) => b.avgChange - a.avgChange);

  const maxAbsChange = Math.max(1, ...sectorPerf.map(s => Math.abs(s.avgChange)));

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{
      width: '100%', height: '100vh', background: BG, display: 'flex',
      flexDirection: 'column', fontFamily: MONO, color: TEXT, overflow: 'hidden',
    }}>
      {/* ── Top bar: tabs + period selector ─────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 12px', height: 36, borderBottom: `1px solid ${BORDER}`,
        background: PANEL, flexShrink: 0,
      }}>
        <div style={{ display: 'flex', gap: 0 }}>
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={tab === t ? btnActive : btnBase}
              onMouseEnter={e => { if (tab !== t) Object.assign(e.currentTarget.style, { color: TEXT }); }}
              onMouseLeave={e => { if (tab !== t) Object.assign(e.currentTarget.style, { color: SUBTLE }); }}
            >{t}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 2 }}>
          {PERIODS.map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              style={{
                ...(period === p ? btnActive : btnBase),
                padding: '3px 7px', fontSize: 9,
              }}
            >{p}</button>
          ))}
        </div>
      </div>

      {/* ── KPI strip ───────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', gap: 0, borderBottom: `1px solid ${BORDER}`,
        background: 'rgba(245,166,35,0.03)', flexShrink: 0,
      }}>
        {[
          { label: 'ADVANCERS', value: String(advancers), color: GREEN },
          { label: 'DECLINERS', value: String(decliners), color: RED },
          { label: 'UNCHANGED', value: String(unchanged), color: SUBTLE },
          { label: 'A/D RATIO', value: adRatio, color: Number(adRatio) >= 1 ? GREEN : RED },
          { label: 'TOP GAINER', value: topGainer ? `${topGainer.symbol} ${fmtPct(topGainer.change)}` : '—', color: GREEN },
          { label: 'TOP LOSER', value: topLoser ? `${topLoser.symbol} ${fmtPct(topLoser.change)}` : '—', color: RED },
          { label: 'BREADTH', value: breadth, color: BLUE },
          { label: 'STOCKS', value: String(filtered.length), color: AMBER },
        ].map((kpi, i) => (
          <div key={i} style={{
            flex: 1, padding: '5px 10px', borderRight: `1px solid ${BORDER}`,
            minWidth: 0,
          }}>
            <div style={{ fontSize: 8, color: SUBTLE, letterSpacing: '0.12em', marginBottom: 1, textTransform: 'uppercase' }}>
              {kpi.label}
            </div>
            <div style={{
              fontSize: 12, fontWeight: 700, color: kpi.color,
              fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
              overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {kpi.value}
            </div>
          </div>
        ))}
      </div>

      {/* ── Filter bar ──────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '4px 12px',
        borderBottom: `1px solid ${BORDER}`, background: PANEL, flexShrink: 0,
      }}>
        <span style={{ fontSize: 9, color: SUBTLE, letterSpacing: '0.1em' }}>SECTOR:</span>
        <select
          value={sectorFilter}
          onChange={e => setSectorFilter(e.target.value)}
          style={{
            background: '#0d0d0d', border: `1px solid ${BORDER}`, color: TEXT,
            fontFamily: MONO, fontSize: 10, padding: '2px 6px', outline: 'none',
            cursor: 'pointer',
          }}
        >
          <option value="ALL">ALL SECTORS</option>
          {SECTORS.map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
        </select>

        <span style={{ fontSize: 9, color: SUBTLE, letterSpacing: '0.1em' }}>MIN CAP ($B):</span>
        <input
          type="number" min={0} step={10}
          value={minCap}
          onChange={e => setMinCap(Number(e.target.value) || 0)}
          style={{
            background: '#0d0d0d', border: `1px solid ${BORDER}`, color: TEXT,
            fontFamily: MONO, fontSize: 10, padding: '2px 6px', width: 60, outline: 'none',
          }}
        />

        {/* Color scale legend */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 8, color: RED }}>-5%</span>
          <div style={{
            width: 180, height: 10,
            background: `linear-gradient(to right,
              rgba(239,83,80,0.7) 0%,
              rgba(239,83,80,0.4) 20%,
              rgba(120,120,80,0.3) 50%,
              rgba(38,166,154,0.4) 80%,
              rgba(38,166,154,0.7) 100%
            )`,
            border: `1px solid ${BORDER}`,
          }} />
          <span style={{ fontSize: 8, color: GREEN }}>+5%</span>
        </div>
      </div>

      {/* ── Main content: treemap + stats sidebar ───────────────────────────── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Treemap canvas area */}
        <div ref={containerRef} style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <canvas
            ref={canvasRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={{
              display: 'block', cursor: hoveredSymbol ? 'pointer' : 'default',
            }}
          />

          {/* Empty state */}
          {filtered.length === 0 && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
              justifyContent: 'center', flexDirection: 'column', gap: 8,
            }}>
              <span style={{ fontSize: 14, color: SUBTLE }}>NO DATA MATCHES CURRENT FILTERS</span>
              <button
                onClick={() => { setSectorFilter('ALL'); setMinCap(0); }}
                style={{ ...btnBase, color: AMBER, borderColor: AMBER }}
              >RESET FILTERS</button>
            </div>
          )}

          {/* Tooltip */}
          {tooltip && (
            <div style={{
              position: 'fixed',
              left: tooltip.x + 14, top: tooltip.y - 10,
              background: '#1a1a1a', border: `1px solid ${AMBER}`,
              padding: '8px 12px', zIndex: 9999,
              pointerEvents: 'none', minWidth: 200,
              boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: TEXT, marginBottom: 4 }}>
                {tooltip.stock.symbol}
                <span style={{ fontWeight: 400, color: SUBTLE, marginLeft: 6, fontSize: 10 }}>
                  {tooltip.stock.name}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto auto', gap: '2px 12px', fontSize: 10 }}>
                <span style={{ color: SUBTLE }}>Change:</span>
                <span style={{ color: clr(tooltip.stock.change), fontWeight: 700, textAlign: 'right' }}>
                  {fmtPct(tooltip.stock.change)}
                </span>
                <span style={{ color: SUBTLE }}>Price:</span>
                <span style={{ color: TEXT, textAlign: 'right' }}>${tooltip.stock.price.toFixed(2)}</span>
                <span style={{ color: SUBTLE }}>Mkt Cap:</span>
                <span style={{ color: BLUE, textAlign: 'right' }}>{fmtCap(tooltip.stock.marketCap)}</span>
                <span style={{ color: SUBTLE }}>Volume:</span>
                <span style={{ color: TEXT, textAlign: 'right' }}>{fmtVol(tooltip.stock.volume)}</span>
                <span style={{ color: SUBTLE }}>Sector:</span>
                <span style={{ color: AMBER, textAlign: 'right' }}>{tooltip.stock.sector}</span>
              </div>
            </div>
          )}
        </div>

        {/* ── Stats sidebar ─────────────────────────────────────────────────── */}
        <div style={{
          width: 240, borderLeft: `1px solid ${BORDER}`, background: PANEL,
          display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0,
        }}>
          <div style={panelHdr}>
            <span>SECTOR PERFORMANCE</span>
            <span style={{ fontSize: 8, color: SUBTLE }}>{period}</span>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
            {sectorPerf.map((sp, i) => (
              <div key={i} style={{
                padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 6,
                borderBottom: `1px solid rgba(30,30,30,0.5)`,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 9, color: TEXT, whiteSpace: 'nowrap',
                    overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {sp.sector.toUpperCase()}
                  </div>
                  <div style={{
                    marginTop: 2, height: 6, background: 'rgba(255,255,255,0.05)',
                    position: 'relative', overflow: 'hidden',
                  }}>
                    <div style={{
                      position: 'absolute',
                      left: sp.avgChange >= 0 ? '50%' : undefined,
                      right: sp.avgChange < 0 ? '50%' : undefined,
                      top: 0, bottom: 0,
                      width: `${(Math.abs(sp.avgChange) / maxAbsChange) * 50}%`,
                      background: sp.avgChange >= 0 ? GREEN : RED,
                      opacity: 0.7,
                    }} />
                  </div>
                </div>
                <div style={{
                  fontSize: 10, fontWeight: 700, color: clr(sp.avgChange),
                  fontVariantNumeric: 'tabular-nums', minWidth: 48, textAlign: 'right',
                }}>
                  {fmtPct(sp.avgChange)}
                </div>
              </div>
            ))}
          </div>

          {/* Market summary box */}
          <div style={{ borderTop: `1px solid ${BORDER}` }}>
            <div style={{ ...panelHdr, borderTop: `2px solid ${BLUE}` }}>
              <span>MARKET SUMMARY</span>
            </div>
            <div style={{ padding: '6px 10px' }}>
              {[
                { label: 'Total Stocks', val: String(filtered.length), c: TEXT },
                { label: 'Total Mkt Cap', val: fmtCap(filtered.reduce((s, st) => s + st.marketCap, 0)), c: BLUE },
                { label: 'Avg Change', val: fmtPct(filtered.length > 0 ? filtered.reduce((s, st) => s + st.change, 0) / filtered.length : 0), c: clr(filtered.reduce((s, st) => s + st.change, 0) / (filtered.length || 1)) },
                { label: 'Total Volume', val: fmtVol(filtered.reduce((s, st) => s + st.volume, 0)), c: TEXT },
                { label: 'Sectors Active', val: String(new Set(filtered.map(s => s.sector)).size), c: AMBER },
              ].map((row, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', padding: '2px 0',
                  fontSize: 9, borderBottom: `1px solid rgba(30,30,30,0.3)`,
                }}>
                  <span style={{ color: SUBTLE }}>{row.label}</span>
                  <span style={{ color: row.c, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{row.val}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Top movers mini-list */}
          <div style={{ borderTop: `1px solid ${BORDER}` }}>
            <div style={{ ...panelHdr, borderTop: `2px solid ${GREEN}` }}>
              <span>TOP MOVERS</span>
            </div>
            <div style={{ padding: '4px 0', maxHeight: 200, overflowY: 'auto' }}>
              {[...filtered]
                .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
                .slice(0, 8)
                .map((s, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '2px 10px', fontSize: 9,
                    borderBottom: `1px solid rgba(30,30,30,0.3)`,
                  }}>
                    <span style={{ color: TEXT, fontWeight: 600 }}>{s.symbol}</span>
                    <span style={{
                      color: clr(s.change), fontWeight: 700,
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      {fmtPct(s.change)}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom status bar ───────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '2px 12px', borderTop: `1px solid ${BORDER}`,
        background: PANEL, fontSize: 8, color: SUBTLE, flexShrink: 0,
        letterSpacing: '0.08em',
      }}>
        <span>APEX HEATMAP v2.0 &bull; SQUARIFIED TREEMAP &bull; CANVAS RENDERER</span>
        <span>{filtered.length} INSTRUMENTS &bull; {new Set(filtered.map(s => s.sector)).size} SECTORS</span>
        <span>LAST UPDATE: {new Date().toLocaleTimeString()}</span>
      </div>
    </div>
  );
};

export default HeatmapUI2;
