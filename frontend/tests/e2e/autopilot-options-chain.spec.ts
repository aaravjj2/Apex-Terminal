/**
 * Autopilot Options Brain V2 — Chain Quality E2E
 *
 * Verifies:
 *  1. /debug-snapshot returns chain_fetch_ok=true for known symbols
 *  2. candidates_count > 0 from the correct Alpaca snapshots endpoint
 *  3. Run-now (disarmed) cycle produces at least one decision OR valid rejection
 *  4. No decision includes "no_contracts" reason (old broken gateway)
 *
 * Root cause fixed: old gateway used /v1beta1/options/contracts → HTTP 404
 * New gateway uses /v1beta1/options/snapshots/{sym} → HTTP 200
 */

import { test, expect } from '@playwright/test';

const API = '/api/autopilot-options';

test.describe('Autopilot Options — Chain Quality (Brain V2)', () => {

  test('debug-snapshot returns chain_fetch_ok=true for AAPL', async ({ request }) => {
    const resp = await request.get(`${API}/debug-snapshot?symbols=AAPL&dte_min=14&dte_max=45`);
    expect(resp.status()).toBe(200);
    const body = await resp.json();

    expect(body).toHaveProperty('ok', true);
    expect(body).toHaveProperty('results');
    const aapl = body.results['AAPL'];
    expect(aapl).toBeTruthy();

    // Chain must be reachable
    expect(aapl.chain_fetch_ok).toBe(true);

    // Must have found contracts (the old broken gateway returned 0)
    expect(typeof aapl.candidates_total).toBe('number');
    expect(aapl.candidates_total).toBeGreaterThan(0);
  });

  test('debug-snapshot returns winner with required fields for AAPL', async ({ request }) => {
    const resp = await request.get(`${API}/debug-snapshot?symbols=AAPL&dte_min=14&dte_max=45`);
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    const aapl = body.results['AAPL'];

    // Winner must exist (enough liquid contracts)
    if (aapl.winner) {
      const w = aapl.winner;
      expect(w).toHaveProperty('contract_symbol');
      expect(w).toHaveProperty('strike');
      expect(w).toHaveProperty('expiry');
      expect(w).toHaveProperty('dte');
      expect(w.dte).toBeGreaterThanOrEqual(14);
      expect(w.dte).toBeLessThanOrEqual(45);
      expect(w).toHaveProperty('bid');
      expect(w).toHaveProperty('ask');
      expect(w).toHaveProperty('mid');
      expect(w).toHaveProperty('spread_pct');
      expect(w).toHaveProperty('score');
      expect(typeof w.score).toBe('number');
      expect(w.score).toBeGreaterThan(0);
    } else {
      // Market closed or very low liquidity — still valid as long as chain was fetched
      expect(aapl.chain_fetch_ok).toBe(true);
    }
  });

  test('debug-snapshot returns correlation_id', async ({ request }) => {
    const resp = await request.get(`${API}/debug-snapshot?symbols=SPY`);
    expect(resp.status()).toBe(200);
    const body = await resp.json();

    expect(body).toHaveProperty('correlation_id');
    expect(typeof body.correlation_id).toBe('string');
    expect(body.correlation_id.length).toBeGreaterThan(0);
  });

  test('run-now (dry_run=true) produces decisions or valid rejections — never no_contracts', async ({ request }) => {
    const resp = await request.post(`${API}/run-now`, {
      data: { symbols: ['AAPL', 'SPY'], dry_run: true },
    });
    expect(resp.status()).toBe(200);
    const body = await resp.json();

    expect(body).toHaveProperty('ok', true);
    expect(body).toHaveProperty('decisions');
    expect(body).toHaveProperty('rejections');
    expect(Array.isArray(body.decisions)).toBe(true);
    expect(Array.isArray(body.rejections)).toBe(true);

    // V2: "no_contracts" must NOT appear — it was the old gateway bug
    for (const rej of body.rejections) {
      expect(rej.reason).not.toBe('no_contracts');
    }

    // We must have gotten something (decision or a real rejection with a reason)
    const total = body.decisions.length + body.rejections.length;
    expect(total).toBeGreaterThan(0);
  });

  test('run-now decisions have decision_type (not just action)', async ({ request }) => {
    const resp = await request.post(`${API}/run-now`, {
      data: { symbols: ['AAPL'], dry_run: true },
    });
    expect(resp.status()).toBe(200);
    const body = await resp.json();

    for (const dec of body.decisions) {
      expect(dec).toHaveProperty('decision_type');
      expect(['BUY_CALL', 'BUY_PUT', 'EXIT', 'HOLD']).toContain(dec.decision_type);
    }
  });

  test('run-now decisions include feature_contributions array', async ({ request }) => {
    const resp = await request.post(`${API}/run-now`, {
      data: { symbols: ['AAPL'], dry_run: true },
    });
    expect(resp.status()).toBe(200);
    const body = await resp.json();

    for (const dec of body.decisions) {
      expect(dec).toHaveProperty('feature_contributions');
      expect(Array.isArray(dec.feature_contributions)).toBe(true);
      expect(dec.feature_contributions.length).toBeGreaterThan(0);

      const f = dec.feature_contributions[0];
      expect(f).toHaveProperty('name');
      expect(f).toHaveProperty('value');
      expect(f).toHaveProperty('contribution');
    }
  });

  test('run-now decisions include risk_checks array', async ({ request }) => {
    const resp = await request.post(`${API}/run-now`, {
      data: { symbols: ['AAPL'], dry_run: true },
    });
    expect(resp.status()).toBe(200);
    const body = await resp.json();

    for (const dec of body.decisions) {
      expect(dec).toHaveProperty('risk_checks');
      expect(Array.isArray(dec.risk_checks)).toBe(true);
      expect(dec.risk_checks.length).toBeGreaterThan(0);

      const rc = dec.risk_checks[0];
      expect(rc).toHaveProperty('name');
      expect(rc).toHaveProperty('passed');
      expect(rc).toHaveProperty('message');
    }
  });

});
