/**
 * Autopilot 2.0 Store (v1.69-v1.70)
 * Pipeline stages, decision ledger, explainability.
 * Deterministic — no network required.
 */

// Deterministic — no external deps

// ── Types ──────────────────────────────────────────────────────

export interface AP2Candidate {
  symbol: string;
  signal: string;
  confidence: number;
  source: string;
  reason: string;
}

export interface AP2Decision {
  symbol: string;
  action: string;
  quantity: number;
  price: number;
  reason_code: string;
  reason_text: string;
  risk_score: number;
  stage: string;
}

export interface AP2Rejection {
  symbol: string;
  reason_code: string;
  reason_text: string;
  stage: string;
}

export interface AP2Order {
  order_id: string;
  symbol: string;
  side: string;
  quantity: number;
  price: number;
  order_type: string;
  status: string;
}

export interface AP2Stage {
  stage_name: string;
  stage_number: number;
  status: string;
  duration_ms: number;
  input_count: number;
  output_count: number;
}

export interface AP2Run {
  run_id: string;
  status: string;
  started_at: string;
  completed_at: string;
  inputs: Record<string, unknown>;
  stages: AP2Stage[];
  candidates: AP2Candidate[];
  decisions: AP2Decision[];
  rejections: AP2Rejection[];
  orders: AP2Order[];
  postmortem: string;
  deterministic_hash: string;
}

// ── Deterministic hash ────────────────────────────────────────

function stableHash(data: unknown): string {
  const raw = JSON.stringify(data);
  let h = 0x811c9dc5;
  for (let i = 0; i < raw.length; i++) {
    h ^= raw.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

// ── Demo Prices ───────────────────────────────────────────────

const REF_PRICES: Record<string, number> = {
  SPY: 547.23, AAPL: 182.41, TSLA: 218.77, NVDA: 789.55,
  MSFT: 412.33, AMZN: 178.92,
};

const REF_SIGNALS: { symbol: string; signal: string; confidence: number; source: string; reason: string }[] = [
  { symbol: 'AAPL', signal: 'hold', confidence: 0.55, source: 'fundamental', reason: 'Earnings neutral, awaiting guidance' },
  { symbol: 'AMZN', signal: 'hold', confidence: 0.48, source: 'sentiment', reason: 'Mixed sentiment, insufficient conviction' },
  { symbol: 'MSFT', signal: 'buy', confidence: 0.72, source: 'fundamental', reason: 'Azure revenue beat, positive outlook' },
  { symbol: 'NVDA', signal: 'sell', confidence: 0.65, source: 'technical', reason: 'MACD bearish crossover, momentum fading' },
  { symbol: 'SPY',  signal: 'buy', confidence: 0.82, source: 'technical', reason: 'RSI oversold (28.5), momentum turning' },
  { symbol: 'TSLA', signal: 'buy', confidence: 0.78, source: 'sentiment', reason: 'Social sentiment strongly positive (0.78)' },
];

const CONFIDENCE_THRESHOLD = 0.70;
const MAX_POSITION_SIZE = 100;
const MAX_BUDGET_PER_TRADE = 50000;
const MAX_PORTFOLIO_EXPOSURE = 0.45;
const RUN_TS = new Date().toISOString();

function runPipeline(symbols: string[], budget: number): AP2Run {
  const runId = `ap2-run-${stableHash({ symbols, budget, t: RUN_TS })}`;

  // Stage 1: Candidates
  const candidates: AP2Candidate[] = REF_SIGNALS
    .filter(s => symbols.includes(s.symbol))
    .map(s => ({ ...s }));

  // Stage 2: Validation
  const validated: AP2Candidate[] = [];
  const rejections: AP2Rejection[] = [];
  for (const c of candidates) {
    if (c.signal === 'hold') {
      rejections.push({ symbol: c.symbol, reason_code: 'HOLD_SIGNAL', reason_text: 'Signal is hold, not actionable', stage: 'validation' });
    } else if (c.confidence < CONFIDENCE_THRESHOLD) {
      rejections.push({ symbol: c.symbol, reason_code: 'LOW_CONFIDENCE', reason_text: `Confidence ${c.confidence} < threshold ${CONFIDENCE_THRESHOLD}`, stage: 'validation' });
    } else {
      validated.push(c);
    }
  }

  // Stage 3: Sizing
  let remaining = budget;
  const sized: AP2Decision[] = [];
  for (const c of validated) {
    const price = REF_PRICES[c.symbol] ?? 100;
    const maxQty = Math.min(MAX_POSITION_SIZE, Math.floor(MAX_BUDGET_PER_TRADE / price));
    let qty = Math.max(1, Math.floor(maxQty * c.confidence));
    const cost = qty * price;
    if (cost > remaining) {
      qty = Math.max(1, Math.floor(remaining / price));
    }
    remaining -= qty * price;
    sized.push({
      symbol: c.symbol, action: c.signal, quantity: qty, price,
      reason_code: 'SIZED_OK', reason_text: `Sized ${qty} @ $${price.toFixed(2)} (conf=${c.confidence})`,
      risk_score: Math.round((1 - c.confidence) * 100) / 100, stage: 'sizing',
    });
  }

  // Stage 4: Simulation
  const simulated: AP2Decision[] = [];
  for (const d of sized) {
    const exposure = (d.quantity * d.price) / budget;
    if (exposure > MAX_PORTFOLIO_EXPOSURE) {
      rejections.push({ symbol: d.symbol, reason_code: 'EXPOSURE_LIMIT', reason_text: `Exposure ${(exposure * 100).toFixed(1)}% > limit ${MAX_PORTFOLIO_EXPOSURE * 100}%`, stage: 'simulation' });
    } else {
      d.stage = 'simulation';
      d.reason_code = 'SIM_PASSED';
      d.reason_text += ` | exposure=${(exposure * 100).toFixed(1)}%`;
      simulated.push(d);
    }
  }

  // Stage 5: Execution
  const orders: AP2Order[] = simulated.map((d, i) => ({
    order_id: `ORD-AP2-${stableHash({ sym: d.symbol, i }).slice(0, 8)}`,
    symbol: d.symbol, side: d.action, quantity: d.quantity, price: d.price,
    order_type: 'limit', status: 'filled',
  }));

  // Stage 6: Postmortem
  const totalCost = orders.reduce((s, o) => s + o.quantity * o.price, 0);
  const postmortem = [
    '# Autopilot 2.0 Post-Trade Summary',
    '',
    `**Run ID**: ${runId}`,
    `**Timestamp**: ${RUN_TS}`,
    '',
    '## Results',
    `- Candidates screened: ${candidates.length}`,
    `- Decisions accepted: ${simulated.length}`,
    `- Rejections: ${rejections.length}`,
    `- Orders placed: ${orders.length}`,
    `- Total capital deployed: $${totalCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
    '',
    '## Accepted Trades',
    ...simulated.map(d => `- ${d.action.toUpperCase()} ${d.quantity} ${d.symbol} @ $${d.price.toFixed(2)} [${d.reason_code}]`),
    '',
    '## Rejected',
    ...rejections.map(r => `- ${r.symbol}: ${r.reason_code} — ${r.reason_text}`),
  ].join('\n');

  const stages: AP2Stage[] = [
    { stage_name: 'Candidate Generation', stage_number: 1, status: 'completed', duration_ms: 42, input_count: symbols.length, output_count: candidates.length },
    { stage_name: 'Validation', stage_number: 2, status: 'completed', duration_ms: 42, input_count: candidates.length, output_count: validated.length },
    { stage_name: 'Sizing', stage_number: 3, status: 'completed', duration_ms: 42, input_count: validated.length, output_count: sized.length },
    { stage_name: 'Impact Simulation', stage_number: 4, status: 'completed', duration_ms: 42, input_count: sized.length, output_count: simulated.length },
    { stage_name: 'Execution', stage_number: 5, status: 'completed', duration_ms: 42, input_count: simulated.length, output_count: orders.length },
    { stage_name: 'Post-Trade Monitor', stage_number: 6, status: 'completed', duration_ms: 42, input_count: orders.length, output_count: 1 },
  ];

  const hash = stableHash({ candidates, decisions: simulated, rejections, orders });

  return {
    run_id: runId, status: 'completed', started_at: RUN_TS, completed_at: RUN_TS,
    inputs: { symbols, budget, timestamp: RUN_TS },
    stages, candidates, decisions: simulated, rejections, orders, postmortem,
    deterministic_hash: hash,
  };
}

// ── Store ──────────────────────────────────────────────────────

type Listener = () => void;
const listeners = new Set<Listener>();
function notify() { listeners.forEach(fn => fn()); }

let runs: AP2Run[] = [];
let selectedRun: string | null = null;
let ledgerTab: string = 'decisions';

export const autopilot2Store = {
  subscribe(fn: Listener) { listeners.add(fn); return () => { listeners.delete(fn); }; },
  getRuns: () => runs,
  getSelectedRun: () => selectedRun,
  getLedgerTab: () => ledgerTab,

  execute(symbols?: string[], budget?: number) {
    const run = runPipeline(symbols ?? ['SPY', 'AAPL', 'TSLA', 'NVDA', 'MSFT', 'AMZN'], budget ?? 100000);
    runs = [...runs, run];
    selectedRun = run.run_id;
    notify();
    return run;
  },

  selectRun(id: string | null) { selectedRun = id; notify(); },
  setLedgerTab(tab: string) { ledgerTab = tab; notify(); },

  reset() { runs = []; selectedRun = null; ledgerTab = 'decisions'; notify(); },
};
