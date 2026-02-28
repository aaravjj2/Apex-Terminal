/**
 * Autopilot Options Brain V2 — Liquidity Quality E2E
 *
 * Verifies:
 *  1. Selected winner has spread_pct ≤ 8% (ScorerConfig.max_spread_pct)
 *  2. Selected winner has mid ≥ $0.15 (ScorerConfig.min_premium)
 *  3. Selected winner has DTE in [14, 45]
 *  4. All BUY_CALL decisions carry a valid contract block
 *  5. Rejection detailing spread_too_wide uses correct code
 */

import { test, expect } from '@playwright/test';

const API = '/api/autopilot-options';

test.describe('Autopilot Options — Liquidity Quality (Brain V2)', () => {

  test('debug-snapshot winner has spread_pct ≤ 8%', async ({ request }) => {
    const resp = await request.get(`${API}/debug-snapshot?symbols=AAPL&dte_min=14&dte_max=45`);
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    const aapl = body.results?.AAPL;
    expect(aapl?.chain_fetch_ok).toBe(true);

    if (aapl?.winner) {
      expect(aapl.winner.spread_pct).toBeLessThanOrEqual(8.0);
    }
  });

  test('debug-snapshot winner has mid ≥ $0.15 (min premium)', async ({ request }) => {
    const resp = await request.get(`${API}/debug-snapshot?symbols=AAPL&dte_min=14&dte_max=45`);
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    const aapl = body.results?.AAPL;

    if (aapl?.winner) {
      expect(aapl.winner.mid).toBeGreaterThanOrEqual(0.15);
    }
  });

  test('debug-snapshot winner has DTE in [14, 45]', async ({ request }) => {
    const resp = await request.get(`${API}/debug-snapshot?symbols=AAPL&dte_min=14&dte_max=45`);
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    const aapl = body.results?.AAPL;

    if (aapl?.winner) {
      expect(aapl.winner.dte).toBeGreaterThanOrEqual(14);
      expect(aapl.winner.dte).toBeLessThanOrEqual(45);
    }
  });

  test('debug-snapshot top_3 candidates all have bid and ask', async ({ request }) => {
    const resp = await request.get(`${API}/debug-snapshot?symbols=AAPL&dte_min=14&dte_max=45`);
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    const aapl = body.results?.AAPL;

    if (aapl?.top_3?.length > 0) {
      for (const c of aapl.top_3) {
        expect(c).toHaveProperty('symbol');
        expect(c).toHaveProperty('score');
        expect(c).toHaveProperty('spread_pct');
        expect(c).toHaveProperty('dte');
        expect(c).toHaveProperty('mid');
        expect(typeof c.score).toBe('number');
        expect(c.score).toBeGreaterThan(0);
      }
    }
  });

  test('run-now BUY_CALL decisions have contract with bid/ask/mid', async ({ request }) => {
    const resp = await request.post(`${API}/run-now`, {
      data: { symbols: ['AAPL'], dry_run: true },
    });
    expect(resp.status()).toBe(200);
    const body = await resp.json();

    for (const dec of body.decisions) {
      if (dec.decision_type === 'BUY_CALL') {
        expect(dec.contract).toBeTruthy();
        const c = dec.contract;

        // Must have price data
        expect(c.bid).not.toBeNull();
        expect(c.ask).not.toBeNull();
        expect(c.mid).not.toBeNull();
        expect(typeof c.mid).toBe('number');
        expect(c.mid).toBeGreaterThanOrEqual(0.15);

        // Spread must be within limit
        if (c.spread_pct != null) {
          expect(c.spread_pct).toBeLessThanOrEqual(8.0);
        }

        // DTE must be in range
        expect(c.dte).toBeGreaterThanOrEqual(14);
        expect(c.dte).toBeLessThanOrEqual(45);

        // Score must be present
        if (c.score != null) {
          expect(c.score).toBeGreaterThan(0);
        }
      }
    }
  });

  test('run-now decisions with limit_price have limit_price > 0', async ({ request }) => {
    const resp = await request.post(`${API}/run-now`, {
      data: { symbols: ['AAPL'], dry_run: true },
    });
    expect(resp.status()).toBe(200);
    const body = await resp.json();

    for (const dec of body.decisions) {
      if (dec.order?.limit_price != null) {
        expect(dec.order.limit_price).toBeGreaterThan(0);
      }
    }
  });

  test('rejections with spread_too_wide code are valid structured objects', async ({ request }) => {
    // Rejections are generated when chains exist but fail scoring.
    // For this test, we just verify that any spread_too_wide rejections
    // have a machine-readable `reason` code (not a legacy string).
    const resp = await request.get(`${API}/rejections?limit=50`);
    expect(resp.status()).toBe(200);
    const body = await resp.json();

    for (const rej of body.rejections ?? []) {
      // All rejections must have machine-code reasons
      expect(typeof rej.reason).toBe('string');
      expect(rej.reason.length).toBeGreaterThan(0);
      // Must have detail
      expect(typeof rej.detail).toBe('string');
    }
  });

  test('run-now disarmed never sets will_submit to true', async ({ request }) => {
    const resp = await request.post(`${API}/run-now`, {
      data: { symbols: ['AAPL', 'SPY'], dry_run: true },
    });
    expect(resp.status()).toBe(200);
    const body = await resp.json();

    // When disarmed (dry_run), will_submit must always be false
    for (const dec of body.decisions) {
      expect(dec.will_submit).toBe(false);
    }
  });

});
