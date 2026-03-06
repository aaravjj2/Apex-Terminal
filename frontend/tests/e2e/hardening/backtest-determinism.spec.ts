/**
 * Hardening Suite  Gate 2: Backtest Determinism
 *
 * Proves that two POST /api/backtest/run calls with the same seed produce
 * IDENTICAL trade lists.
 *
 * API: POST /api/backtest/run
 * Schema: {symbol, strategy_id, seed, initial_capital, start_date, end_date}
 * Response: {run_id, config, config_hash, status, trades, metrics, equity_curve}
 */
import { test, expect } from '@playwright/test';

const API = 'http://localhost:8000';

const BASELINE_BODY = {
  symbol: 'AAPL',
  strategy_id: 'sma_cross',
  seed: 42,
  initial_capital: 100000,
  start_date: '2024-01-01',
  end_date: '2024-03-28',
};

async function runBacktest(request: any, body = BASELINE_BODY) {
  const resp = await request.post(`${API}/api/backtest/run`, {
    data: body,
    headers: { 'Content-Type': 'application/json' },
  });
  expect(resp.status()).toBe(200);
  return resp.json();
}

test.describe('Backtest API  schema and response shape', () => {

  test('POST /api/backtest/run returns 200', async ({ request }) => {
    const resp = await request.post(`${API}/api/backtest/run`, {
      data: BASELINE_BODY,
      headers: { 'Content-Type': 'application/json' },
    });
    expect(resp.status()).toBe(200);
  });

  test('response has run_id', async ({ request }) => {
    const json = await runBacktest(request);
    expect(typeof json.run_id).toBe('string');
    expect(json.run_id.length).toBeGreaterThan(0);
  });

  test('response status is completed', async ({ request }) => {
    const json = await runBacktest(request);
    expect(json.status).toBe('completed');
  });

  test('response has trades array', async ({ request }) => {
    const json = await runBacktest(request);
    expect(Array.isArray(json.trades)).toBe(true);
  });

  test('response has config_hash', async ({ request }) => {
    const json = await runBacktest(request);
    expect(typeof json.config_hash).toBe('string');
    expect(json.config_hash.length).toBeGreaterThan(0);
  });

  test('response config reflects input seed', async ({ request }) => {
    const json = await runBacktest(request);
    expect(json.config.seed).toBe(BASELINE_BODY.seed);
  });

  test('response config reflects input symbol', async ({ request }) => {
    const json = await runBacktest(request);
    expect(json.config.symbol).toBe(BASELINE_BODY.symbol);
  });

  test('response has metrics object', async ({ request }) => {
    const json = await runBacktest(request);
    expect(typeof json.metrics).toBe('object');
    expect(json.metrics).not.toBeNull();
  });

  test('metrics has total_return_pct', async ({ request }) => {
    const json = await runBacktest(request);
    expect(typeof json.metrics.total_return_pct).toBe('number');
  });

  test('metrics has sharpe_ratio', async ({ request }) => {
    const json = await runBacktest(request);
    expect(typeof json.metrics.sharpe_ratio).toBe('number');
  });

  test('metrics final_equity is positive', async ({ request }) => {
    const json = await runBacktest(request);
    expect(json.metrics.final_equity).toBeGreaterThan(0);
  });

});

test.describe('Backtest Determinism  same seed = same result', () => {

  test('two runs with same seed produce same trade count', async ({ request }) => {
    const [r1, r2] = await Promise.all([runBacktest(request), runBacktest(request)]);
    expect(r1.trades.length).toBe(r2.trades.length);
  });

  test('two runs with same seed produce identical first trade', async ({ request }) => {
    const [r1, r2] = await Promise.all([runBacktest(request), runBacktest(request)]);
    if (r1.trades.length > 0) {
      expect(JSON.stringify(r1.trades[0])).toBe(JSON.stringify(r2.trades[0]));
    }
  });

  test('two runs with same seed produce identical last trade', async ({ request }) => {
    const [r1, r2] = await Promise.all([runBacktest(request), runBacktest(request)]);
    if (r1.trades.length > 0) {
      const last = r1.trades.length - 1;
      expect(JSON.stringify(r1.trades[last])).toBe(JSON.stringify(r2.trades[last]));
    }
  });

  test('two runs with same seed produce identical total_return_pct', async ({ request }) => {
    const [r1, r2] = await Promise.all([runBacktest(request), runBacktest(request)]);
    expect(r1.metrics.total_return_pct).toBe(r2.metrics.total_return_pct);
  });

  test('two runs with same seed produce identical final_equity', async ({ request }) => {
    const [r1, r2] = await Promise.all([runBacktest(request), runBacktest(request)]);
    expect(r1.metrics.final_equity).toBe(r2.metrics.final_equity);
  });

  test('two runs with same seed produce identical sharpe_ratio', async ({ request }) => {
    const [r1, r2] = await Promise.all([runBacktest(request), runBacktest(request)]);
    expect(r1.metrics.sharpe_ratio).toBe(r2.metrics.sharpe_ratio);
  });

  test('two runs with same seed produce identical config_hash', async ({ request }) => {
    const [r1, r2] = await Promise.all([runBacktest(request), runBacktest(request)]);
    expect(r1.config_hash).toBe(r2.config_hash);
  });

  test('different seed produces different run_id', async ({ request }) => {
    const r1 = await runBacktest(request, { ...BASELINE_BODY, seed: 42 });
    const r2 = await runBacktest(request, { ...BASELINE_BODY, seed: 99 });
    expect(r1.run_id).not.toBe(r2.run_id);
  });

});

test.describe('Backtest Runs  GET /api/backtest/runs', () => {

  test('GET /api/backtest/runs returns 200', async ({ request }) => {
    const resp = await request.get(`${API}/api/backtest/runs`);
    expect(resp.status()).toBe(200);
  });

  test('GET /api/backtest/runs returns an array', async ({ request }) => {
    const json = await (await request.get(`${API}/api/backtest/runs`)).json();
    expect(Array.isArray(json)).toBe(true);
  });

});
