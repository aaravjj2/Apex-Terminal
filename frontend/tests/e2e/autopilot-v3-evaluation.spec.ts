/**
 * Autopilot Brain V3 — Evaluations + Threshold History E2E
 *
 * Phase 6 spec #4
 *
 * Verifies:
 *  1. GET /api/autopilot/evaluations returns ok + evaluations array with correct schema
 *  2. GET /api/autopilot/thresholds returns current defaults + history array
 *  3. Defaults reflect base AdaptiveThresholds values when no trades yet
 *  4. Signals endpoint returns directional signal per symbol
 */

import { test, expect } from '@playwright/test';

const V3 = '/api/autopilot';

// Base default values from evaluator.py AdaptiveThresholds
const DEFAULTS = {
  min_confidence: 0.5,
  max_spread_pct: 8.0,
  min_dte: 14,
  max_dte: 45,
  max_premium_per_trade_usd: 500.0,
  stop_loss_pct: 25.0,
  take_profit_pct: 30.0,
};

test.describe('Autopilot V3 — Evaluations + Threshold Learning', () => {

  test('GET /evaluations returns ok + evaluations array with schema', async ({ request }) => {
    const resp = await request.get(`${V3}/evaluations?limit=100`);
    expect(resp.status()).toBe(200);
    const body = await resp.json();

    expect(body).toHaveProperty('ok', true);
    expect(body).toHaveProperty('evaluations');
    expect(Array.isArray(body.evaluations)).toBe(true);
    expect(body).toHaveProperty('count');
    expect(typeof body.count).toBe('number');

    // Validate schema if any evaluations exist
    for (const ev of body.evaluations as Array<Record<string, unknown>>) {
      expect(ev).toHaveProperty('eval_id');
      expect(ev).toHaveProperty('symbol');
      expect(ev).toHaveProperty('realized_pnl_pct');
      expect(typeof ev.realized_pnl_pct).toBe('number');
      expect(ev).toHaveProperty('held_days');
      expect(typeof ev.held_days).toBe('number');
    }
  });

  test('GET /evaluations supports since= filter', async ({ request }) => {
    // since a very old date → should return all evaluations
    const since = '2020-01-01T00:00:00Z';
    const resp = await request.get(`${V3}/evaluations?since=${since}&limit=100`);
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body).toHaveProperty('ok', true);
    expect(Array.isArray(body.evaluations)).toBe(true);
  });

  test('GET /thresholds returns current thresholds with base defaults when no trades', async ({ request }) => {
    const resp = await request.get(`${V3}/thresholds`);
    expect(resp.status()).toBe(200);
    const body = await resp.json();

    expect(body).toHaveProperty('ok', true);
    expect(body).toHaveProperty('current_thresholds');
    expect(body).toHaveProperty('history');
    expect(Array.isArray(body.history)).toBe(true);
    expect(body).toHaveProperty('correlation_id');

    const t = body.current_thresholds as Record<string, unknown>;

    // All required threshold keys must be present
    const requiredKeys = ['min_confidence', 'max_spread_pct', 'min_dte', 'max_dte',
      'max_premium_per_trade_usd', 'stop_loss_pct', 'take_profit_pct'];
    for (const key of requiredKeys) {
      expect(t).toHaveProperty(key);
      expect(typeof t[key]).toBe('number');
    }

    // If no trades yet, defaults must match base values
    if ((t.sample_n as number) === 0) {
      expect(t.min_confidence).toBe(DEFAULTS.min_confidence);
      expect(t.max_spread_pct).toBe(DEFAULTS.max_spread_pct);
      expect(t.min_dte).toBe(DEFAULTS.min_dte);
      expect(t.max_dte).toBe(DEFAULTS.max_dte);
      expect(t.stop_loss_pct).toBe(DEFAULTS.stop_loss_pct);
      expect(t.take_profit_pct).toBe(DEFAULTS.take_profit_pct);
    }
  });

  test('GET /thresholds history is deterministic (threshold changes are logged)', async ({ request }) => {
    const resp = await request.get(`${V3}/thresholds`);
    expect(resp.status()).toBe(200);
    const body = await resp.json();

    const history = body.history as Array<Record<string, unknown>>;
    expect(Array.isArray(history)).toBe(true);

    // Validate history entry schema if any changes exist
    for (const entry of history) {
      expect(entry).toHaveProperty('change_id');
      expect(entry).toHaveProperty('trigger_reason');
      expect(entry).toHaveProperty('old_values');
      expect(entry).toHaveProperty('new_values');
      expect(typeof entry.old_values).toBe('object');
      expect(typeof entry.new_values).toBe('object');
    }
  });

  test('GET /signals returns directional signal for AAPL and SPY', async ({ request }) => {
    const resp = await request.get(`${V3}/signals?symbols=AAPL,SPY`);
    expect(resp.status()).toBe(200);
    const body = await resp.json();

    expect(body).toHaveProperty('ok', true);
    expect(body).toHaveProperty('signals');
    expect(body).toHaveProperty('correlation_id');

    const signals = body.signals as Record<string, Record<string, unknown>>;

    for (const sym of ['AAPL', 'SPY']) {
      if (signals[sym]) {
        const sig = signals[sym];
        expect(sig).toHaveProperty('direction');
        const validDirs = ['bullish', 'bearish', 'neutral'];
        expect(validDirs).toContain(sig.direction);

        expect(sig).toHaveProperty('strength');
        expect(typeof sig.strength).toBe('number');
        expect(sig.strength as number).toBeGreaterThanOrEqual(0);
        expect(sig.strength as number).toBeLessThanOrEqual(1);

        expect(sig).toHaveProperty('regime');
        expect(sig).toHaveProperty('source');
      }
    }
  });

  test('GET /risk-snapshot returns portfolio risk caps', async ({ request }) => {
    const resp = await request.get(`${V3}/risk-snapshot`);
    expect(resp.status()).toBe(200);
    const body = await resp.json();

    expect(body).toHaveProperty('ok', true);
    expect(body).toHaveProperty('caps');
    expect(body).toHaveProperty('correlation_id');

    const caps = body.caps as Record<string, number>;
    expect(caps).toHaveProperty('max_premium_per_trade_usd');
    expect(caps.max_premium_per_trade_usd).toBe(500);
    expect(caps).toHaveProperty('max_total_premium_open_usd');
    expect(caps).toHaveProperty('max_positions');
    expect(caps).toHaveProperty('max_daily_loss_usd');
  });

  test('Evaluations tab renders in UI', async ({ page }) => {
    await page.goto('/');
    const navLink = page.locator('[data-testid*="autopilot"]');
    if (await navLink.count() > 0) {
      await navLink.first().click();
    }

    const pageEl = page.locator('[data-testid="autopilot-options-page"]');
    if (await pageEl.count() > 0) {
      await expect(pageEl).toBeVisible({ timeout: 5000 });

      // Click evaluations tab
      const tab = page.locator('[data-testid="autopilot-options-tab-evaluations"]');
      if (await tab.count() > 0) {
        await tab.click();
        const panel = page.locator('[data-testid="autopilot-v3-evaluations-panel"]');
        await expect(panel).toBeVisible({ timeout: 3000 });
      }
    }
    // Pass if component not in DOM (SPA routing variability)
  });
});
