/**
 * Autopilot Brain V3 — Invariant Checker E2E
 *
 * Phase 6 spec #3
 *
 * Verifies:
 *  1. GET /api/autopilot/invariants returns ok=true during clean test suite
 *  2. violations is an empty array when no anomalies
 *  3. GET /api/autopilot/incidents returns correct schema
 *  4. ops-summary includes invariant section
 */

import { test, expect } from '@playwright/test';

const V3 = '/api/autopilot';

test.describe('Autopilot V3 — Invariant Checker', () => {

  test('GET /invariants returns ok=true + violations array during clean suite', async ({ request }) => {
    const resp = await request.get(`${V3}/invariants`);
    expect(resp.status()).toBe(200);
    const body = await resp.json();

    expect(body).toHaveProperty('ok');
    expect(typeof body.ok).toBe('boolean');

    // During a clean test suite with no positions or anomalies, ok must be true
    expect(body.ok).toBe(true);

    expect(body).toHaveProperty('violations');
    expect(Array.isArray(body.violations)).toBe(true);

    // No violations in a clean run
    expect(body.violations).toHaveLength(0);

    expect(body).toHaveProperty('correlation_id');
    expect(typeof body.correlation_id).toBe('string');
  });

  test('GET /invariants schema is correct and stable', async ({ request }) => {
    // Call twice and verify consistency
    const r1 = await request.get(`${V3}/invariants`);
    const r2 = await request.get(`${V3}/invariants`);

    expect(r1.status()).toBe(200);
    expect(r2.status()).toBe(200);

    const b1 = await r1.json();
    const b2 = await r2.json();

    // Both must agree on ok=true
    expect(b1.ok).toBe(true);
    expect(b2.ok).toBe(true);

    // Violations array must be consistent (same count)
    expect(b1.violations.length).toBe(b2.violations.length);
  });

  test('GET /incidents returns schema with incidents array', async ({ request }) => {
    const resp = await request.get(`${V3}/incidents?limit=50`);
    expect(resp.status()).toBe(200);
    const body = await resp.json();

    expect(body).toHaveProperty('ok', true);
    expect(body).toHaveProperty('incidents');
    expect(Array.isArray(body.incidents)).toBe(true);

    // Validate incident schema if any incidents exist
    for (const incident of body.incidents as Array<Record<string, unknown>>) {
      expect(incident).toHaveProperty('incident_id');
      expect(incident).toHaveProperty('title');
      expect(incident).toHaveProperty('level');

      const validLevels = ['info', 'warning', 'critical'];
      expect(validLevels).toContain(incident.level);
    }
  });

  test('GET /incidents?unresolved_only=true returns only unresolved', async ({ request }) => {
    const resp = await request.get(`${V3}/incidents?unresolved_only=true&limit=50`);
    expect(resp.status()).toBe(200);
    const body = await resp.json();

    expect(body).toHaveProperty('ok', true);
    expect(body).toHaveProperty('incidents');

    // In a clean test environment, unresolved incidents should be empty
    for (const inc of body.incidents as Array<Record<string, unknown>>) {
      expect(inc.resolved).toBeFalsy();
    }
  });

  test('ops-summary.invariants section is present and correct', async ({ request }) => {
    const resp = await request.get(`${V3}/ops-summary`);
    expect(resp.status()).toBe(200);
    const body = await resp.json();

    expect(body).toHaveProperty('ok', true);
    expect(body).toHaveProperty('invariants');

    const inv = body.invariants as Record<string, unknown>;
    expect(inv).toHaveProperty('ok');
    expect(typeof inv.ok).toBe('boolean');
    expect(inv).toHaveProperty('violations');
    expect(Array.isArray(inv.violations)).toBe(true);

    // Clean test suite should show no violations
    expect(inv.ok).toBe(true);

    // Correlation ID required
    expect(body).toHaveProperty('correlation_id');
  });
});
