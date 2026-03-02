/**
 * api-bridge.js — Demo API bridge for Tradingview recreation
 * Works with Vite proxy: API_BASE='/api' proxies to backend
 * Each function tries real API first, falls back to mock data on fetch failure (offline/404)
 * Pure async/await, no dependencies
 */
const API_BASE = '/api';

const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));

async function safeFetch(url, opts = {}) {
  try {
    const res = await fetch(url, { ...opts, credentials: 'same-origin' });
    if (res.ok) return res;
    throw new Error(`HTTP ${res.status}`);
  } catch (e) {
    return null;
  }
}

function genOHLCVMock(n, start, volBase, drift = 0.0002) {
  const bars = [];
  let price = start;
  for (let i = 0; i < n; i++) {
    const o = price;
    const move = (Math.random() - 0.48) * volBase + drift * price;
    const c = price + move;
    const h = Math.max(o, c) + rand(0, volBase * 0.5);
    const l = Math.min(o, c) - rand(0, volBase * 0.5);
    const v = rand(20e6, 80e6);
    bars.push({ o, h, l, c, v, time: Date.now() - (n - i) * 3600000 });
    price = c;
  }
  return bars;
}

const SYMBOL_BASE = { AAPL: 182.43, TSLA: 215.8, SPY: 521.4, BTC: 98420, ETH: 3420 };
const SYMBOL_VOL = { AAPL: 2.1, TSLA: 8.2, SPY: 3.8, BTC: 1800, ETH: 120 };

/**
 * @param {string} symbol
 * @param {string} tf - timeframe: 1m, 5m, 15m, 1h, 1D, etc.
 * @returns {Promise<Array<{o,h,l,c,v,time}>>}
 */
async function fetchBars(symbol, tf) {
  const tfParam = tf || '1h';
  const res = await safeFetch(
    `${API_BASE}/v1/bars?symbol=${encodeURIComponent(symbol)}&timeframe=${tfParam}&limit=500`
  );
  if (res) {
    const data = await res.json();
    const raw = Array.isArray(data) ? data : data.bars ?? data.data ?? [];
    const base = SYMBOL_BASE[symbol] ?? 100;
    const vol = SYMBOL_VOL[symbol] ?? 2;
    return raw.map((b) => ({
      o: Number(b.o ?? b.open),
      h: Number(b.h ?? b.high),
      l: Number(b.l ?? b.low),
      c: Number(b.c ?? b.close),
      v: Number(b.v ?? b.volume ?? 0),
      time: b.time ?? b.t ?? (b.timestamp ? new Date(b.timestamp).getTime() : Date.now()),
    }));
  }
  return genOHLCVMock(180, base, vol);
}

/**
 * @param {string} symbol
 * @returns {Promise<{last:number, bid:number, ask:number, change:number, changePct:number}>}
 */
async function fetchQuote(symbol) {
  const res = await safeFetch(`${API_BASE}/v1/market/quote?symbol=${encodeURIComponent(symbol)}`);
  if (res) {
    const data = await res.json();
    const last = data.last ?? data.price ?? data.c ?? 0;
    const prev = data.prevClose ?? data.previous_close ?? last * 0.99;
    const change = last - prev;
    const changePct = (change / prev) * 100;
    return {
      last,
      bid: data.bid ?? last - 0.01,
      ask: data.ask ?? last + 0.01,
      change,
      changePct,
    };
  }
  const base = SYMBOL_BASE[symbol] ?? 100;
  const noise = (Math.random() - 0.5) * 2;
  return {
    last: base + noise,
    bid: base + noise - 0.01,
    ask: base + noise + 0.01,
    change: noise,
    changePct: (noise / base) * 100,
  };
}

/**
 * @returns {Promise<{holdings:Array, totalValue:number, cash:number}>}
 */
async function fetchPortfolio() {
  const res = await safeFetch(`${API_BASE}/v1/portfolio`) ||
    await safeFetch(`${API_BASE}/v1/positions`) ||
    await safeFetch(`${API_BASE}/v1/portfolio/analytics`);
  if (res) {
    const data = await res.json();
    const holdings = data.holdings ?? data.positions ?? (Array.isArray(data) ? data : []);
    const totalValue = data.totalValue ?? data.equity ?? data.total_value ?? 382450;
    const cash = data.cash ?? 45000;
    return { holdings, totalValue, cash };
  }
  return {
    holdings: [
      { sym: 'AAPL', side: 'Long', qty: 200, entry: 168.2, last: 182.43, mkt: 36486, upnl: 2846, rpnl: 4200, pct: 8.42, beta: 1.12, wt: 9.5 },
      { sym: 'TSLA', side: 'Long', qty: 50, entry: 232.8, last: 215.8, mkt: 10790, upnl: -850, rpnl: 1200, pct: -7.3, beta: 1.85, wt: 2.8 },
    ],
    totalValue: 382450,
    cash: 45000,
  };
}

/**
 * @returns {Promise<Array>}
 */
async function fetchOrders() {
  const res = await safeFetch(`${API_BASE}/v1/orders`) ||
    await safeFetch(`${API_BASE}/v1/execution/orders`);
  if (res) {
    const data = await res.json();
    return Array.isArray(data) ? data : data.orders ?? data.results ?? [];
  }
  return [
    { sym: 'AAPL', side: 'Buy', qty: 100, fill: 180.22, comm: 1.0, slip: 0.08, time: '09:14:02', pnl: 221 },
    { sym: 'MSFT', side: 'Buy', qty: 50, fill: 408.1, comm: 1.0, slip: 0.12, time: '09:08:32', pnl: 185 },
  ];
}

/**
 * @param {string} symbol
 * @returns {Promise<{chain:Array, spot:number}>}
 */
async function fetchOptions(symbol) {
  const res = await safeFetch(
    `${API_BASE}/v4/options/chain?symbol=${encodeURIComponent(symbol)}`,
    { method: 'GET' }
  ) || await safeFetch(`${API_BASE}/v4/options/chain`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbol: symbol || 'AAPL' }),
  });
  if (res) {
    const data = await res.json();
    return {
      chain: data.chain ?? data.options ?? data.calls ?? [],
      spot: data.spot ?? data.underlying ?? 182.43,
    };
  }
  const spot = SYMBOL_BASE[symbol] ?? 182.43;
  const strikes = [170, 172.5, 175, 177.5, 180, 182.5, 185, 187.5, 190, 192.5, 195];
  const chain = strikes.map((k) => ({
    strike: k,
    callBid: Math.max(0.01, spot - k + rand(0.5, 2)),
    callAsk: 0,
    putBid: Math.max(0.01, k - spot + rand(0.5, 2)),
    putAsk: 0,
  }));
  chain.forEach((r) => { r.callAsk = r.callBid + rand(0.1, 0.5); r.putAsk = r.putBid + rand(0.1, 0.5); });
  return { chain, spot };
}

/**
 * @param {Object} params - { symbol, startDate, endDate, strategyId, ... }
 * @returns {Promise<{equity:[], trades:[], sharpe:number, totalReturn:number}>}
 */
async function fetchBacktest(params) {
  const res = await safeFetch(`${API_BASE}/backtest/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params || { symbol: 'AAPL', startDate: '2023-01-01', endDate: '2024-12-31' }),
  });
  if (res) {
    const data = await res.json();
    return {
      equity: data.equity ?? data.equity_curve ?? [],
      trades: data.trades ?? [],
      sharpe: data.sharpeRatio ?? data.sharpe ?? 2.14,
      totalReturn: data.totalReturnPct ?? data.total_return_pct ?? 184.3,
    };
  }
  const eq = [100000];
  for (let i = 1; i < 200; i++) eq.push(eq[i - 1] * (1 + (Math.random() - 0.46) * 0.015));
  return {
    equity: eq,
    trades: [
      ['2024-12-15', 'AAPL', 'Long', 168.2, 182.43, 100, '+$1,423', '+8.5%'],
      ['2024-11-28', 'TSLA', 'Short', 232.8, 215.8, 50, '+$850', '+7.3%'],
    ],
    sharpe: 2.14,
    totalReturn: 184.3,
  };
}

/**
 * @returns {Promise<Array>}
 */
async function fetchAlerts() {
  const res = await safeFetch(`${API_BASE}/v1/alerts`) ||
    await safeFetch(`${API_BASE}/alerts`);
  if (res) {
    const data = await res.json();
    return Array.isArray(data) ? data : data.alerts ?? data.results ?? [];
  }
  return [
    { id: 'a1', symbol: 'AAPL', type: 'price', condition: 'crosses_above', value: 190, triggered: false },
    { id: 'a2', symbol: 'TSLA', type: 'rsi', condition: 'greater_than', value: 70, triggered: true },
  ];
}

/**
 * @returns {Promise<Array>}
 */
async function fetchScreener() {
  const res = await safeFetch(`${API_BASE}/screener`) ||
    await safeFetch(`${API_BASE}/screening/results`);
  if (res) {
    const data = await res.json();
    return Array.isArray(data) ? data : data.results ?? data.rows ?? [];
  }
  return [
    ['NVDA', 'NVIDIA Corp', 924.7, 5.82, 82e6, '$2.3T', 45.2, 42, 3.8, 12.4, 'A+'],
    ['AMD', 'Advanced Micro', 184.2, 4.14, 48e6, '$298B', 38.1, 38, 4.2, 8.1, 'A'],
    ['AAPL', 'Apple Inc.', 182.43, 1.21, 58e6, '$2.8T', 28.4, 48, 1.8, 4.2, 'B+'],
  ];
}

/**
 * Check if API is reachable
 * @returns {Promise<boolean>}
 */
async function pingApi() {
  const res = await safeFetch(`${API_BASE}/v1/health`) ||
    await safeFetch(`${API_BASE}/health`) ||
    await safeFetch(`${API_BASE}/v1/market/quote?symbol=AAPL`);
  return res !== null;
}

// Expose to global scope for demo usage
window.API_BASE = API_BASE;
window.fetchBars = fetchBars;
window.fetchQuote = fetchQuote;
window.fetchPortfolio = fetchPortfolio;
window.fetchOrders = fetchOrders;
window.fetchOptions = fetchOptions;
window.fetchBacktest = fetchBacktest;
window.fetchAlerts = fetchAlerts;
window.fetchScreener = fetchScreener;
window.pingApi = pingApi;
window.genOHLCVMock = genOHLCVMock;
