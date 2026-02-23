/**
 * Hardening Suite  Gate 1: Health Gates
 *
 * Hits the REAL endpoints on the RUNNING Apex Terminal server (localhost:8090).
 * Zero mocks. Fails fast on infra down.
 *
 * Key endpoints (verified live):
 *   GET /health                             -> {status:"healthy",alpaca_connected:true,...}
 *   GET /api/v1/health                      -> {overall_status,components}
 *   GET /api/v1/verification/alpaca/health  -> {status,api_reachable,account_number,cash,...}
 *   GET /api/v1/autopilot/ws_status         -> {connections,subscriptions,heartbeat_running}
 *   GET /api/v2/broker/readiness            -> {broker_mode,kill_switch_active,...}
 *   GET /api/v1/platform-health/summary     -> {overall_status,total_components,...}
 */
import { test, expect } from '@playwright/test';

const API = 'http://localhost:8090';

test.describe('Liveness  /health', () => {
  test('GET /health returns 200', async ({ request }) => {
    const resp = await request.get(`${API}/health`);
    expect(resp.status()).toBe(200);
  });
  test('/health reports status=healthy', async ({ request }) => {
    const json = await (await request.get(`${API}/health`)).json();
    expect(json.status).toBe('healthy');
  });
  test('/health confirms alpaca_connected', async ({ request }) => {
    const json = await (await request.get(`${API}/health`)).json();
    expect(json.alpaca_connected).toBe(true);
  });
  test('/health has alpaca_configured=true', async ({ request }) => {
    const json = await (await request.get(`${API}/health`)).json();
    expect(json.alpaca_configured).toBe(true);
  });
});

test.describe('Broker Health  Alpaca verification', () => {
  test('GET /api/v1/verification/alpaca/health returns 200', async ({ request }) => {
    const resp = await request.get(`${API}/api/v1/verification/alpaca/health`);
    expect(resp.status()).toBe(200);
  });
  test('alpaca health status=healthy', async ({ request }) => {
    const json = await (await request.get(`${API}/api/v1/verification/alpaca/health`)).json();
    expect(json.status).toBe('healthy');
  });
  test('alpaca health api_reachable=true', async ({ request }) => {
    const json = await (await request.get(`${API}/api/v1/verification/alpaca/health`)).json();
    expect(json.api_reachable).toBe(true);
  });
  test('alpaca health has account_number', async ({ request }) => {
    const json = await (await request.get(`${API}/api/v1/verification/alpaca/health`)).json();
    expect(typeof json.account_number).toBe('string');
    expect(json.account_number.length).toBeGreaterThan(0);
  });
  test('alpaca health cash is positive number', async ({ request }) => {
    const json = await (await request.get(`${API}/api/v1/verification/alpaca/health`)).json();
    expect(typeof json.cash).toBe('number');
    expect(json.cash).toBeGreaterThan(0);
  });
  test('alpaca health has portfolio_value', async ({ request }) => {
    const json = await (await request.get(`${API}/api/v1/verification/alpaca/health`)).json();
    expect(typeof json.portfolio_value).toBe('number');
    expect(json.portfolio_value).toBeGreaterThan(0);
  });
});

test.describe('WebSocket Status', () => {
  test('GET /api/v1/autopilot/ws_status returns 200', async ({ request }) => {
    const resp = await request.get(`${API}/api/v1/autopilot/ws_status`);
    expect(resp.status()).toBe(200);
  });
  test('ws_status has heartbeat_running=true', async ({ request }) => {
    const json = await (await request.get(`${API}/api/v1/autopilot/ws_status`)).json();
    expect(json.heartbeat_running).toBe(true);
  });
  test('ws_status connections is a number', async ({ request }) => {
    const json = await (await request.get(`${API}/api/v1/autopilot/ws_status`)).json();
    expect(typeof json.connections).toBe('number');
  });
  test('ws_status subscriptions is a number', async ({ request }) => {
    const json = await (await request.get(`${API}/api/v1/autopilot/ws_status`)).json();
    expect(typeof json.subscriptions).toBe('number');
  });
});

test.describe('Broker Readiness', () => {
  test('GET /api/v2/broker/readiness returns 200', async ({ request }) => {
    const resp = await request.get(`${API}/api/v2/broker/readiness`);
    expect(resp.status()).toBe(200);
  });
  test('readiness broker_mode is paper', async ({ request }) => {
    const json = await (await request.get(`${API}/api/v2/broker/readiness`)).json();
    expect(json.broker_mode).toBe('paper');
  });
  test('readiness kill_switch_active is boolean', async ({ request }) => {
    const json = await (await request.get(`${API}/api/v2/broker/readiness`)).json();
    expect(typeof json.kill_switch_active).toBe('boolean');
  });
  test('readiness kill_switch not active', async ({ request }) => {
    const json = await (await request.get(`${API}/api/v2/broker/readiness`)).json();
    expect(json.kill_switch_active).toBe(false);
  });
});

test.describe('Platform Health Summary', () => {
  test('GET /api/v1/platform-health/summary returns 200', async ({ request }) => {
    const resp = await request.get(`${API}/api/v1/platform-health/summary`);
    expect(resp.status()).toBe(200);
  });
  test('platform health has overall_status', async ({ request }) => {
    const json = await (await request.get(`${API}/api/v1/platform-health/summary`)).json();
    expect(typeof json.overall_status).toBe('string');
  });
  test('platform health has total_components', async ({ request }) => {
    const json = await (await request.get(`${API}/api/v1/platform-health/summary`)).json();
    expect(typeof json.total_components).toBe('number');
  });
});

test.describe('v1 Health Components', () => {
  test('GET /api/v1/health returns 200', async ({ request }) => {
    const resp = await request.get(`${API}/api/v1/health`);
    expect(resp.status()).toBe(200);
  });
  test('v1 health has components', async ({ request }) => {
    const json = await (await request.get(`${API}/api/v1/health`)).json();
    expect(json.components).toBeDefined();
  });
  test('v1 health has overall_status', async ({ request }) => {
    const json = await (await request.get(`${API}/api/v1/health`)).json();
    expect(typeof json.overall_status).toBe('string');
  });
});
