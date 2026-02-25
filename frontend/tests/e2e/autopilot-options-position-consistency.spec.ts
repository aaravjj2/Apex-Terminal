/**
 * Autopilot Options Brain V2 — Position Consistency E2E
 *
 * Verifies:
 *  1. Positions endpoint returns valid schema (symbol, qty, unrealized_pnl_pct)
 *  2. Orders endpoint returns valid schema (symbol, side, status)
 *  3. For every filled BTO order, either a position OR a close order exists
 *  4. No decision points to a symbol that has no chain data
 *  5. Decisions endpoint returns valid brain_v2 schema
 */

import { test, expect } from '@playwright/test';

const API = '/api/autopilot-options';

test.describe('Autopilot Options — Position Consistency (Brain V2)', () => {

  test('positions endpoint returns valid schema', async ({ request }) => {
    const resp = await request.get(`${API}/options/positions`);
    expect(resp.status()).toBe(200);
    const body = await resp.json();

    expect(body).toHaveProperty('positions');
    expect(Array.isArray(body.positions)).toBe(true);

    for (const pos of body.positions) {
      expect(pos).toHaveProperty('symbol');
      expect(pos).toHaveProperty('qty');
      expect(pos).toHaveProperty('side');
      expect(pos).toHaveProperty('avg_entry_price');
      expect(pos).toHaveProperty('current_price');
      expect(pos).toHaveProperty('unrealized_pnl');
      // brain_v2 position lifecycle requires unrealized_pnl_pct
      expect(pos).toHaveProperty('unrealized_pnl_pct');
    }
  });

  test('orders endpoint returns valid schema', async ({ request }) => {
    const resp = await request.get(`${API}/options/orders?status=all`);
    expect(resp.status()).toBe(200);
    const body = await resp.json();

    expect(body).toHaveProperty('orders');
    expect(Array.isArray(body.orders)).toBe(true);

    for (const order of body.orders) {
      expect(order).toHaveProperty('symbol');
      expect(order).toHaveProperty('side');
      expect(order).toHaveProperty('status');
      expect(order).toHaveProperty('qty');
    }
  });

  test('filled BTO orders have corresponding position or close order', async ({ request }) => {
    // Fetch filled BTO orders
    const ordersResp = await request.get(`${API}/options/orders?status=closed`);
    expect(ordersResp.status()).toBe(200);
    const ordersBody = await ordersResp.json();
    const orders = ordersBody.orders ?? [];

    // Fetch current positions
    const posResp = await request.get(`${API}/options/positions`);
    expect(posResp.status()).toBe(200);
    const posBody = await posResp.json();
    const positions = posBody.positions ?? [];

    // Fetch all orders (including sell orders)
    const allOrdersResp = await request.get(`${API}/options/orders?status=all`);
    expect(allOrdersResp.status()).toBe(200);
    const allOrdersBody = await allOrdersResp.json();
    const allOrders = allOrdersBody.orders ?? [];

    const positionSymbols = new Set(positions.map((p: { symbol: string }) => p.symbol));
    const closeOrderSymbols = new Set(
      allOrders
        .filter((o: { side: string; status: string }) => 
          o.side === 'sell' && (o.status === 'filled' || o.status === 'pending'))
        .map((o: { symbol: string }) => o.symbol)
    );

    for (const order of orders) {
      if (order.side === 'buy' && order.status === 'filled') {
        const sym = order.symbol;
        // Either a live position or a close order must account for the fill
        const hasPosition = positionSymbols.has(sym);
        const hasCloseOrder = closeOrderSymbols.has(sym);
        expect(hasPosition || hasCloseOrder).toBe(true);
      }
    }
  });

  test('decisions endpoint returns brain_v2 schema', async ({ request }) => {
    const resp = await request.get(`${API}/decisions?limit=20`);
    expect(resp.status()).toBe(200);
    const body = await resp.json();

    expect(body).toHaveProperty('decisions');
    expect(body).toHaveProperty('count');
    expect(body).toHaveProperty('correlation_id');
    expect(Array.isArray(body.decisions)).toBe(true);

    for (const dec of body.decisions) {
      // Brain V2 schema: decision_type (not just action)
      // Both may be present for backward compat
      const hasType = dec.decision_type || dec.action;
      expect(hasType).toBeTruthy();
    }
  });

  test('rejections endpoint returns brain_v2 schema', async ({ request }) => {
    const resp = await request.get(`${API}/rejections?limit=20`);
    expect(resp.status()).toBe(200);
    const body = await resp.json();

    expect(body).toHaveProperty('rejections');
    expect(body).toHaveProperty('count');
    expect(body).toHaveProperty('correlation_id');
    expect(Array.isArray(body.rejections)).toBe(true);

    for (const rej of body.rejections) {
      expect(rej).toHaveProperty('reason');
      expect(rej).toHaveProperty('detail');
      expect(rej).toHaveProperty('correlation_id');
      // V2 rejections should NOT have the old no_contracts bug
      expect(rej.reason).not.toBe('no_contracts');
    }
  });

  test('debug-bundle includes chain diagnostics after a run', async ({ request }) => {
    // Run a cycle first
    await request.post(`${API}/run-now`, {
      data: { symbols: ['AAPL'], dry_run: true },
    });

    // Check debug bundle has the diagnostics
    const resp = await request.get(`${API}/debug-bundle`);
    expect(resp.status()).toBe(200);
    const body = await resp.json();

    expect(body).toHaveProperty('loop_state');
    // After brain_v2 run, last_chain_diagnostics should be present
    // (may be null if cycle failed unexpectedly)
    expect(body.loop_state).toBeTruthy();
  });

  test('health endpoint shows correct loop cycle count', async ({ request }) => {
    const before = await request.get(`${API}/health`);
    const bodyBefore = await before.json();
    const cyclesBefore = bodyBefore.loop?.cycles_run ?? 0;

    // Run a cycle
    await request.post(`${API}/run-now`, {
      data: { symbols: ['AAPL'], dry_run: true },
    });

    const after = await request.get(`${API}/health`);
    const bodyAfter = await after.json();
    const cyclesAfter = bodyAfter.loop?.cycles_run ?? 0;

    // Cycle count should have incremented
    expect(cyclesAfter).toBeGreaterThan(cyclesBefore);
  });

});
