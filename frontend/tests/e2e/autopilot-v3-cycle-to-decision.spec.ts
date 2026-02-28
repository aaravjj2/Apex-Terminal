/**
 * Autopilot Brain V3 — Cycle to Decision E2E
 *
 * Phase 6 spec #1
 *
 * Verifies:
 *  1. POST /api/autopilot/run-v3 (disarmed) → cycle created with cycle_id
 *  2. Decisions include risk_checks array and signal.direction field per spec
 *  3. Cycle is persisted → GET /api/autopilot/cycles/latest returns it
 */

import { test, expect } from '@playwright/test';

const V3 = '/api/autopilot';

test.describe('Autopilot V3 — Cycle to Decision', () => {

  test('run-v3 returns cycle_id, correlation_id and correct schema', async ({ request }) => {
    const resp = await request.post(`${V3}/run-v3`, {
      data: { symbols: ['AAPL', 'SPY'], dry_run: false },
    });
    expect(resp.status()).toBe(200);
    const body = await resp.json();

    expect(body).toHaveProperty('ok', true);
    expect(body).toHaveProperty('cycle_id');
    expect(typeof body.cycle_id).toBe('string');
    expect(body.cycle_id.length).toBeGreaterThan(0);

    expect(body).toHaveProperty('correlation_id');
    expect(typeof body.correlation_id).toBe('string');

    expect(body).toHaveProperty('symbols_analyzed');
    expect(body.symbols_analyzed).toBe(2);

    expect(body).toHaveProperty('decisions');
    expect(body).toHaveProperty('rejections');
    expect(Array.isArray(body.decisions)).toBe(true);
    expect(Array.isArray(body.rejections)).toBe(true);
  });

  test('decisions include risk_checks array and signal.direction field', async ({ request }) => {
    const resp = await request.post(`${V3}/run-v3`, {
      data: { symbols: ['AAPL'], dry_run: false },
    });
    expect(resp.status()).toBe(200);
    const body = await resp.json();

    // Every BUY decision must have risk_checks and signal
    const decisions: Array<Record<string, unknown>> = body.decisions ?? [];
    for (const d of decisions) {
      expect(d).toHaveProperty('risk_checks');
      expect(Array.isArray(d.risk_checks)).toBe(true);

      expect(d).toHaveProperty('signal');
      const sig = d.signal as Record<string, unknown>;
      expect(sig).toHaveProperty('direction');
      const validDirections = ['bullish', 'bearish', 'neutral', null];
      expect(validDirections).toContain(sig.direction);
    }

    // Rejections must have explanation or rejection_reason
    const rejections: Array<Record<string, unknown>> = body.rejections ?? [];
    for (const r of rejections) {
      const hasReason = r.rejection_reason != null || r.explanation != null;
      expect(hasReason).toBe(true);
    }
  });

  test('decisions include candidates_count >= 0', async ({ request }) => {
    const resp = await request.post(`${V3}/run-v3`, {
      data: { symbols: ['AAPL', 'SPY', 'MSFT'], dry_run: false },
    });
    expect(resp.status()).toBe(200);
    const body = await resp.json();

    const allEntries = [...(body.decisions ?? []), ...(body.rejections ?? [])];
    for (const entry of allEntries as Array<Record<string, unknown>>) {
      if (entry.candidates_count != null) {
        expect(typeof entry.candidates_count).toBe('number');
        expect(entry.candidates_count as number).toBeGreaterThanOrEqual(0);
      }
    }
  });

  test('cycle is persisted and retrievable via /cycles/latest', async ({ request }) => {
    // Run a cycle
    const runResp = await request.post(`${V3}/run-v3`, {
      data: { symbols: ['SPY'], dry_run: false },
    });
    expect(runResp.status()).toBe(200);
    const runBody = await runResp.json();
    const cycleId = runBody.cycle_id as string;

    // Fetch latest cycles
    const latestResp = await request.get(`${V3}/cycles/latest?n=5`);
    expect(latestResp.status()).toBe(200);
    const latestBody = await latestResp.json();

    expect(latestBody).toHaveProperty('ok', true);
    expect(latestBody).toHaveProperty('cycles');
    expect(Array.isArray(latestBody.cycles)).toBe(true);

    // The cycle we just ran must appear
    const cycleIds = latestBody.cycles.map((c: Record<string, unknown>) => c.cycle_id);
    expect(cycleIds).toContain(cycleId);
  });

  test('cycle detail endpoint returns decisions and orders', async ({ request }) => {
    // Run a cycle first
    const runResp = await request.post(`${V3}/run-v3`, {
      data: { symbols: ['AAPL'], dry_run: false },
    });
    expect(runResp.status()).toBe(200);
    const runBody = await runResp.json();
    const cycleId = runBody.cycle_id as string;

    // Get cycle detail
    const detailResp = await request.get(`${V3}/cycles/${cycleId}`);
    expect(detailResp.status()).toBe(200);
    const detailBody = await detailResp.json();

    expect(detailBody).toHaveProperty('ok', true);
    expect(detailBody).toHaveProperty('cycle');
    expect(detailBody.cycle).toHaveProperty('cycle_id', cycleId);
    expect(detailBody).toHaveProperty('decisions');
    expect(detailBody).toHaveProperty('orders');
    expect(Array.isArray(detailBody.decisions)).toBe(true);
    expect(Array.isArray(detailBody.orders)).toBe(true);
  });
});
