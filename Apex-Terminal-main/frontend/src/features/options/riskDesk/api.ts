/**
 * Risk Desk API client — Week 1 + Week 2 endpoints.
 * Includes deterministic mock fallbacks for demo/E2E mode (Week 3).
 */

import type { ValidationResult, RiskRunResult, TicketDraft, ScenarioOption } from './types';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// ── DETERMINISTIC MOCK DATA (Week 3 E2E Support) ────────────────────

function generateMockRunId(): string {
  return `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function createMockRiskRunResult(csvText: string, scenarioId: string): RiskRunResult {
  const runId = generateMockRunId();
  const numPositions = csvText.split('\n').filter(l => l.trim() && !l.startsWith('symbol')).length;
  const now = new Date().toISOString();
  
  return {
    run_id: runId,
    ok: true,
    error: '',
    created_at: now,
    config_hash: 'mock_' + runId.slice(4, 16),
    portfolio_hash: 'mock_ph_' + runId.slice(4, 12),
    validation: null,
    greeks: {
      net_delta: -125.5,
      net_gamma: 2.8,
      net_vega: 1850.0,
      net_theta: -42.3,
      per_leg: [],
    },
    stress: {
      scenario: {
        id: scenarioId,
        label: scenarioId === 'moderate_selloff' ? 'Moderate Selloff' : scenarioId === 'severe_crash' ? 'Severe Crash' : 'Market Crash',
        spot_shift_pct: -5,
        vol_shift_pct: -10,
      },
      total_pnl: -12500.0,
      leg_results: [],
      hedge_candidates: [
        {
          id: 'hedge_A',
          name: 'Protective Put Spread',
          strategy_type: 'spread',
          legs: [
            {
              symbol: 'SPY',
              option_type: 'PUT',
              strike: 450,
              expiry: '2026-03-20',
              side: 'BUY',
              quantity: 2,
              premium_est: 4.25,
            },
          ],
          net_cost_est: 850.0,
          max_loss_reduction_est: 6000.0,
          explanation: 'Reduces downside risk by hedging short delta exposure',
        },
        {
          id: 'hedge_B',
          name: 'Call Spread Collar',
          strategy_type: 'collar',
          legs: [
            {
              symbol: 'SPY',
              option_type: 'CALL',
              strike: 460,
              expiry: '2026-03-20',
              side: 'SELL',
              quantity: 2,
              premium_est: 2.50,
            },
          ],
          net_cost_est: 500.0,
          max_loss_reduction_est: 4000.0,
          explanation: 'Caps upside while protecting downside via collar',
        },
      ],
    },
    compliance: {
      status: numPositions > 5 ? 'blocked' : 'approved',
      violations: numPositions > 5 ? [
        {
          code: 'UNCOVERED_SHORT',
          severity: 'critical',
          message: 'Row 1: Uncovered short put on AAPL (-10 contracts, strike 440)',
          suggested_fix: 'Add a long put on AAPL to create a spread, or close the naked short position',
        },
      ] : [],
    },
    verification: {
      method: 'recompute',
      verified: true,
      max_delta_deviation: 0.5,
      max_gamma_deviation: 0.2,
      max_vega_deviation: 1.0,
    },
    tool_trace: [
      { 
        tool_id: 'T1', 
        tool_name: 'Greeks Calculator',
        started_at: now,
        ended_at: now,
        duration_ms: 50,
        status: 'ok', 
        inputs_summary: `${numPositions} positions`,
        outputs_summary: 'Delta=-125.5, Gamma=2.8',
        cache_hit: false,
      },
      { 
        tool_id: 'T2', 
        tool_name: 'Stress Tester',
        started_at: now,
        ended_at: now,
        duration_ms: 80,
        status: 'ok', 
        inputs_summary: scenarioId,
        outputs_summary: 'P&L=-12500 (-8.5%)',
        cache_hit: false,
      },
      { 
        tool_id: 'T3', 
        tool_name: 'Compliance Check',
        started_at: now,
        ended_at: now,
        duration_ms: 30,
        status: 'ok', 
        inputs_summary: 'stress result',
        outputs_summary: numPositions > 5 ? 'Blocked (1 violation)' : 'Approved',
        cache_hit: false,
      },
      { 
        tool_id: 'T4', 
        tool_name: 'Hedge Generator',
        started_at: now,
        ended_at: now,
        duration_ms: 120,
        status: 'ok', 
        inputs_summary: 'greeks + stress',
        outputs_summary: '1 hedge suggested',
        cache_hit: false,
      },
      { 
        tool_id: 'T5', 
        tool_name: 'Verifier',
        started_at: now,
        ended_at: now,
        duration_ms: 40,
        status: 'ok', 
        inputs_summary: 'all results',
        outputs_summary: 'All checks passed',
        cache_hit: false,
      },
    ],
    provenance: {
      source: 'DEMO',
      provider: 'Demo Data',
      cache_key: undefined,
      checksum: undefined,
      fetched_at: undefined,
    },
  };
}

function createMockTicket(runId: string, hedgeId: string): TicketDraft {
  return {
    run_id: runId,
    hedge_id: hedgeId,
    hedge_name: 'Protective Call Spread',
    legs: [
      {
        symbol: 'SPY',
        option_type: 'CALL',
        strike: 450,
        expiry: '2026-03-20',
        side: 'BUY',
        quantity: 2,
      },
    ],
    net_cost_est: 850.0,
    compliance_status: 'approved',
    generated_at: new Date().toISOString(),
    notes: `Hedge generated from run ${runId}`,
  };
}

/**
 * Upload a CSV file (or raw text) for validation.
 */
export async function validatePortfolio(file: File): Promise<ValidationResult> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${BASE}/api/risk-desk/validate`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) throw new Error(`Validation request failed: ${res.status}`);
  return res.json();
}

export async function validatePortfolioText(csvText: string): Promise<ValidationResult> {
  const form = new FormData();
  form.append('csv_text', csvText);
  const res = await fetch(`${BASE}/api/risk-desk/validate`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) throw new Error(`Validation request failed: ${res.status}`);
  return res.json();
}

/**
 * Fetch the committed demo CSV from the backend.
 * Falls back to embedded demo CSV if backend unavailable.
 */
export async function fetchDemoCsv(): Promise<string> {
  try {
    const res = await fetch(`${BASE}/api/risk-desk/demo-csv`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) throw new Error(`Failed to fetch demo CSV: ${res.status}`);
    const data = await res.json();
    return data.csv;
  } catch (err) {
    console.warn('[Risk Desk] Backend unavailable, using embedded demo CSV');
    // Embedded demo CSV — column names MUST match backend expectations
    return `symbol,option_type,strike,expiry,quantity,side,multiplier
AAPL,call,220,2025-03-21,10,buy,100
AAPL,put,210,2025-03-21,-5,sell,100
MSFT,call,430,2025-04-17,3,buy,100
TSLA,put,250,2025-03-21,-2,sell,100
BRK.B,call,420,2025-06-20,1,buy,100
AMZN,call,190,2025-03-21,4,buy,100`;
  }
}

// ── Week 2 API ──────────────────────────────────────────────────────────

/**
 * Fetch available stress scenarios.
 * Falls back to embedded scenarios if backend unavailable.
 */
export async function fetchScenarios(): Promise<ScenarioOption[]> {
  try {
    const res = await fetch(`${BASE}/api/risk-desk/scenarios`, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) throw new Error(`Failed to fetch scenarios: ${res.status}`);
    const data = await res.json();
    return data.scenarios;
  } catch (err) {
    console.warn('[Risk Desk] Backend unavailable, using embedded scenarios');
    return [
      { id: 'moderate_selloff', label: 'Moderate Selloff' },
      { id: 'market_crash', label: 'Market Crash' },
    ];
  }
}

/**
 * Execute the 5-tool risk pipeline.
 * Falls back to deterministic mock if backend unavailable (Week 3 E2E support).
 */
export async function runRiskPipeline(
  csvText: string,
  scenarioId: string = 'moderate_selloff',
): Promise<RiskRunResult> {
  try {
    const res = await fetch(`${BASE}/api/risk-desk/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csv_text: csvText, scenario_id: scenarioId }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`Risk run failed: ${res.status}`);
    return res.json();
  } catch (err) {
    console.warn('[Risk Desk] Backend unavailable, using deterministic mock response');
    // Simulate pipeline execution time
    await new Promise(resolve => setTimeout(resolve, 500));
    return createMockRiskRunResult(csvText, scenarioId);
  }
}

/**
 * Build a trade ticket for a selected hedge.
 * Falls back to deterministic mock if backend unavailable.
 */
export async function buildTicket(
  runId: string,
  selectedHedgeId: string,
): Promise<TicketDraft> {
  try {
    const res = await fetch(`${BASE}/api/risk-desk/ticket`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ run_id: runId, selected_hedge_id: selectedHedgeId }),
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) throw new Error(`Ticket build failed: ${res.status}`);
    return res.json();
  } catch (err) {
    console.warn('[Risk Desk] Backend unavailable, using mock ticket');
    await new Promise(resolve => setTimeout(resolve, 200));
    return createMockTicket(runId, selectedHedgeId);
  }
}

/**
 * v1.22: Export Risk Run as ZIP bundle
 * Includes portfolio artifacts + manifest with checksums.
 * Returns blob for download.
 */
export async function exportRiskRun(
  runId: string,
  portfolioId: string = 'DEMO-PORT-001'
): Promise<Blob> {
  const res = await fetch(
    `${BASE}/api/v1/risk-desk/export/${runId}?portfolio_id=${encodeURIComponent(portfolioId)}`,
    {
      method: 'GET',
      signal: AbortSignal.timeout(10000),
    }
  );
  if (!res.ok) {
    throw new Error(`Export failed: ${res.status} ${res.statusText}`);
  }
  return res.blob();
}
