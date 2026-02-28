/**
 * Autopilot Options — Order Preview E2E
 *
 * Verifies:
 *  1. /order-preview returns a valid payload schema
 *  2. Preview includes contract_symbol, limit_price, qty, time_in_force
 *  3. Risk checks are present in the response
 *  4. correlation_id is stable format
 *
 * data-testid only — no CSS selectors.
 */

import { test, expect } from '@playwright/test';

test.describe('Autopilot Options — Order Preview', () => {

  test('/order-preview for AAPL returns valid preview schema', async ({ request }) => {
    const resp = await request.get('/api/autopilot-options/order-preview?symbol=AAPL');
    expect(resp.status()).toBe(200);
    const body = await resp.json();

    expect(body).toHaveProperty('correlation_id');
    expect(body.correlation_id).toMatch(/^ap-/);

    if (body.ok) {
      // Successful preview — validate full schema
      const preview = body.preview;
      expect(preview).toBeTruthy();
      expect(preview).toHaveProperty('contract_symbol');
      expect(preview).toHaveProperty('underlying', 'AAPL');
      expect(preview).toHaveProperty('option_type');
      expect(preview).toHaveProperty('strike');
      expect(preview).toHaveProperty('expiration');
      expect(preview).toHaveProperty('dte');
      expect(preview).toHaveProperty('side', 'buy');
      expect(preview).toHaveProperty('qty', 1);
      expect(preview).toHaveProperty('order_type', 'limit');
      expect(preview).toHaveProperty('limit_price');
      expect(preview).toHaveProperty('time_in_force', 'day');
      expect(preview).toHaveProperty('estimated_premium_usd');
      expect(preview).toHaveProperty('dry_run', true);
      expect(typeof preview.limit_price).toBe('number');
      expect(typeof preview.strike).toBe('number');

      // Risk checks
      expect(body).toHaveProperty('risk_checks');
      expect(body.risk_checks).toHaveProperty('premium_within_limit');
      expect(body.risk_checks).toHaveProperty('dte_in_range');
    } else {
      // No contracts available (market closed, etc.) — still valid response
      expect(body).toHaveProperty('error');
      expect(typeof body.error).toBe('string');
    }
  });

  test('/order-preview for SPY returns valid response', async ({ request }) => {
    const resp = await request.get('/api/autopilot-options/order-preview?symbol=SPY');
    expect(resp.status()).toBe(200);
    const body = await resp.json();

    expect(body).toHaveProperty('correlation_id');
    expect(body.correlation_id).toMatch(/^ap-/);

    // Must have either ok:true with preview OR ok:false with error
    if (body.ok) {
      expect(body.preview).toBeTruthy();
      expect(body.preview.underlying).toBe('SPY');
    } else {
      expect(body).toHaveProperty('error');
    }
  });

  test('/debug-bundle returns full state dump', async ({ request }) => {
    const resp = await request.get('/api/autopilot-options/debug-bundle');
    expect(resp.status()).toBe(200);
    const body = await resp.json();

    expect(body).toHaveProperty('health');
    expect(body).toHaveProperty('armed');
    expect(body).toHaveProperty('kill_switch');
    expect(body).toHaveProperty('loop_state');
    expect(body).toHaveProperty('risk_controls');
    expect(body).toHaveProperty('universe');
    expect(body).toHaveProperty('correlation_id');
    expect(body.correlation_id).toMatch(/^ap-/);

    expect(Array.isArray(body.universe)).toBe(true);
    expect(body.universe.length).toBeGreaterThan(0);
  });

  test('/options/connectivity returns provider details', async ({ request }) => {
    const resp = await request.get('/api/autopilot-options/options/connectivity');
    expect(resp.status()).toBe(200);
    const body = await resp.json();

    expect(body).toHaveProperty('paper_base_url');
    expect(body).toHaveProperty('connected');
    expect(body).toHaveProperty('latency_ms');
    expect(body).toHaveProperty('options_enabled');
    expect(body).toHaveProperty('correlation_id');
    expect(body.correlation_id).toMatch(/^ap-/);
  });

  test('kill switch toggle via API', async ({ request }) => {
    // Activate
    const resp1 = await request.post('/api/autopilot-options/kill-switch', {
      data: { active: true, close_all: false },
    });
    expect(resp1.status()).toBe(200);
    const body1 = await resp1.json();
    expect(body1.kill_switch).toBe(true);
    expect(body1.armed).toBe(false); // auto-disarm

    // Verify
    const resp2 = await request.get('/api/autopilot-options/kill-switch');
    const body2 = await resp2.json();
    expect(body2.active).toBe(true);

    // Deactivate
    const resp3 = await request.post('/api/autopilot-options/kill-switch', {
      data: { active: false, close_all: false },
    });
    expect(resp3.status()).toBe(200);
    const body3 = await resp3.json();
    expect(body3.kill_switch).toBe(false);
  });

  test('LLM status endpoint returns provider info', async ({ request }) => {
    const resp = await request.get('/api/autopilot-options/llm/status');
    expect(resp.status()).toBe(200);
    const body = await resp.json();

    expect(body).toHaveProperty('provider');
    expect(body).toHaveProperty('gemini_available');
    expect(body).toHaveProperty('groq_available');
    expect(body).toHaveProperty('cache_size');
    expect(body).toHaveProperty('budget_remaining');
    expect(body).toHaveProperty('budget_max');
  });
});
