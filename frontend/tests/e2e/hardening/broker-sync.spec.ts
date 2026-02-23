/**
 * Hardening Suite  Gate 4: Broker Sync
 *
 * Validates the live Alpaca paper broker via the REAL running server endpoints.
 *
 * Verified endpoints:
 *   GET /api/v1/verification/alpaca/health -> {status,api_reachable,account_number,cash,buying_power,portfolio_value}
 *   GET /api/v2/broker/readiness          -> {broker_mode,kill_switch_active,...}
 *   GET /api/v2/broker/positions          -> {positions:[]}
 *   GET /api/v2/broker/orders             -> {orders:[],total:0}
 */
import { test, expect } from '@playwright/test';

const API = 'http://localhost:8090';

// ---------------------------------------------------------------------------
// Alpaca paper account  live health
// ---------------------------------------------------------------------------
test.describe('Alpaca Paper Account  Live Health', () => {

  test('GET /api/v1/verification/alpaca/health returns 200', async ({ request }) => {
    const resp = await request.get(`${API}/api/v1/verification/alpaca/health`);
    expect(resp.status()).toBe(200);
  });

  test('alpaca status is healthy', async ({ request }) => {
    const json = await (await request.get(`${API}/api/v1/verification/alpaca/health`)).json();
    expect(json.status).toBe('healthy');
  });

  test('api_reachable is true', async ({ request }) => {
    const json = await (await request.get(`${API}/api/v1/verification/alpaca/health`)).json();
    expect(json.api_reachable).toBe(true);
  });

  test('account_status is ACTIVE', async ({ request }) => {
    const json = await (await request.get(`${API}/api/v1/verification/alpaca/health`)).json();
    expect(json.account_status).toBe('ACTIVE');
  });

  test('trading_blocked is false', async ({ request }) => {
    const json = await (await request.get(`${API}/api/v1/verification/alpaca/health`)).json();
    expect(json.trading_blocked).toBe(false);
  });

  test('account_number is a string', async ({ request }) => {
    const json = await (await request.get(`${API}/api/v1/verification/alpaca/health`)).json();
    expect(typeof json.account_number).toBe('string');
    expect(json.account_number.length).toBeGreaterThan(0);
  });

  test('cash is positive', async ({ request }) => {
    const json = await (await request.get(`${API}/api/v1/verification/alpaca/health`)).json();
    expect(typeof json.cash).toBe('number');
    expect(json.cash).toBeGreaterThan(0);
  });

  test('buying_power is positive', async ({ request }) => {
    const json = await (await request.get(`${API}/api/v1/verification/alpaca/health`)).json();
    expect(typeof json.buying_power).toBe('number');
    expect(json.buying_power).toBeGreaterThan(0);
  });

  test('portfolio_value is positive', async ({ request }) => {
    const json = await (await request.get(`${API}/api/v1/verification/alpaca/health`)).json();
    expect(typeof json.portfolio_value).toBe('number');
    expect(json.portfolio_value).toBeGreaterThan(0);
  });

  test('error is null (no API error)', async ({ request }) => {
    const json = await (await request.get(`${API}/api/v1/verification/alpaca/health`)).json();
    expect(json.error).toBeNull();
  });

});

// ---------------------------------------------------------------------------
// Broker readiness
// ---------------------------------------------------------------------------
test.describe('Broker Readiness', () => {

  test('GET /api/v2/broker/readiness returns 200', async ({ request }) => {
    const resp = await request.get(`${API}/api/v2/broker/readiness`);
    expect(resp.status()).toBe(200);
  });

  test('broker_mode is paper', async ({ request }) => {
    const json = await (await request.get(`${API}/api/v2/broker/readiness`)).json();
    expect(json.broker_mode).toBe('paper');
  });

  test('kill_switch_active is false', async ({ request }) => {
    const json = await (await request.get(`${API}/api/v2/broker/readiness`)).json();
    expect(json.kill_switch_active).toBe(false);
  });

  test('kill_switch_reason is null', async ({ request }) => {
    const json = await (await request.get(`${API}/api/v2/broker/readiness`)).json();
    expect(json.kill_switch_reason).toBeNull();
  });

  test('readiness has session object', async ({ request }) => {
    const json = await (await request.get(`${API}/api/v2/broker/readiness`)).json();
    expect(typeof json.session).toBe('object');
    expect(json.session).not.toBeNull();
  });

});

// ---------------------------------------------------------------------------
// Broker positions
// ---------------------------------------------------------------------------
test.describe('Broker Positions', () => {

  test('GET /api/v2/broker/positions returns 200', async ({ request }) => {
    const resp = await request.get(`${API}/api/v2/broker/positions`);
    expect(resp.status()).toBe(200);
  });

  test('positions response has positions key', async ({ request }) => {
    const json = await (await request.get(`${API}/api/v2/broker/positions`)).json();
    expect(Array.isArray(json.positions)).toBe(true);
  });

});

// ---------------------------------------------------------------------------
// Broker orders
// ---------------------------------------------------------------------------
test.describe('Broker Orders', () => {

  test('GET /api/v2/broker/orders returns 200', async ({ request }) => {
    const resp = await request.get(`${API}/api/v2/broker/orders`);
    expect(resp.status()).toBe(200);
  });

  test('orders response has orders array', async ({ request }) => {
    const json = await (await request.get(`${API}/api/v2/broker/orders`)).json();
    expect(Array.isArray(json.orders)).toBe(true);
  });

  test('orders response has total field', async ({ request }) => {
    const json = await (await request.get(`${API}/api/v2/broker/orders`)).json();
    expect(typeof json.total).toBe('number');
  });

});
