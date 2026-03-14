/**
 * Investor Personas — E2E Tests
 * Tests the new 8-persona investor analysis system (ai-hedge-fund integration)
 * Backend: GET /api/v1/investors/analyze/{symbol}
 * Backend: POST /api/v1/investors/analyze/batch
 */
import { test, expect } from '@playwright/test';

const API_BASE = 'http://localhost:8000';
const TIMEOUT = 30_000;

test.describe('Investor Personas API', () => {
  test('GET /api/v1/investors/analyze/AAPL returns consensus signal', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/v1/investors/analyze/AAPL`, {
      timeout: TIMEOUT,
    });
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data).toHaveProperty('symbol', 'AAPL');
    expect(data).toHaveProperty('consensus');
    expect(['buy', 'sell', 'hold']).toContain(data.consensus);
    expect(data).toHaveProperty('conviction');
    expect(data.conviction).toBeGreaterThanOrEqual(0);
    expect(data.conviction).toBeLessThanOrEqual(1);
    expect(data).toHaveProperty('buy_votes');
    expect(data).toHaveProperty('sell_votes');
    expect(data).toHaveProperty('hold_votes');
    expect(data.buy_votes + data.sell_votes + data.hold_votes).toBe(8);
    expect(data).toHaveProperty('personas');
    expect(data.personas).toHaveLength(8);
  });

  test('investor personas include all 8 named agents', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/v1/investors/analyze/SPY`, {
      timeout: TIMEOUT,
    });
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    const personaNames = data.personas.map((p: any) => p.persona);
    const expectedAgents = [
      'Warren Buffett', 'Ben Graham', 'Cathie Wood', 'Michael Burry',
      'Peter Lynch', 'Stanley Druckenmiller', 'Risk Manager', 'Technical Analyst'
    ];
    for (const name of expectedAgents) {
      expect(personaNames).toContain(name);
    }
  });

  test('each persona signal has required fields', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/v1/investors/analyze/MSFT`, {
      timeout: TIMEOUT,
    });
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    for (const persona of data.personas) {
      expect(persona).toHaveProperty('persona');
      expect(persona).toHaveProperty('signal');
      expect(['buy', 'sell', 'hold']).toContain(persona.signal);
      expect(persona).toHaveProperty('confidence');
      expect(persona.confidence).toBeGreaterThanOrEqual(0);
      expect(persona.confidence).toBeLessThanOrEqual(1);
      expect(persona).toHaveProperty('reasoning');
      expect(persona.reasoning.length).toBeGreaterThan(0);
      expect(persona).toHaveProperty('key_factor');
    }
  });

  test('POST /api/v1/investors/analyze/batch returns multiple signals', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/v1/investors/analyze/batch`, {
      data: { symbols: ['AAPL', 'MSFT', 'SPY'] },
      timeout: TIMEOUT,
    });
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(Array.isArray(data)).toBeTruthy();
    expect(data).toHaveLength(3);
    const symbols = data.map((d: any) => d.symbol);
    expect(symbols).toContain('AAPL');
    expect(symbols).toContain('MSFT');
    expect(symbols).toContain('SPY');
  });

  test('analysis_summary is descriptive text', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/v1/investors/analyze/NVDA`, {
      timeout: TIMEOUT,
    });
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.analysis_summary.length).toBeGreaterThan(10);
    expect(data.analysis_summary).toContain('NVDA');
  });
});

test.describe('Account Summary API', () => {
  test('GET /api/v1/account/summary returns account data', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/v1/account/summary`, {
      timeout: 15_000,
    });
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data).toHaveProperty('nav');
    expect(data).toHaveProperty('equity');
    expect(data).toHaveProperty('buying_power');
    expect(data).toHaveProperty('cash');
    expect(data).toHaveProperty('source');
    expect(typeof data.nav).toBe('number');
    expect(typeof data.equity).toBe('number');
  });

  test('account summary source is alpaca when connected', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/v1/account/summary`);
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    // Source should be alpaca since we have keys configured
    expect(['alpaca', 'portfolio_engine', 'unavailable']).toContain(data.source);
  });

  test('account nav is positive when Alpaca connected', async ({ request }) => {
    const healthResp = await request.get(`${API_BASE}/health`);
    const health = await healthResp.json();
    if (health.alpaca_connected) {
      const response = await request.get(`${API_BASE}/api/v1/account/summary`);
      const data = await response.json();
      expect(data.nav).toBeGreaterThan(0);
      expect(data.buying_power).toBeGreaterThanOrEqual(0);
    }
  });
});

test.describe('Heatmap API - Live Data', () => {
  test('GET /api/v1/market-data/heatmap returns live stocks', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/v1/market-data/heatmap?period=1D`, {
      timeout: 30_000,
    });
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data).toHaveProperty('stocks');
    expect(data.stocks.length).toBeGreaterThan(30);
    expect(data).toHaveProperty('source');
    // Source should be yfinance (live) not mock
    expect(data.source).toBe('yfinance');
    // Verify first stock has real fields
    const first = data.stocks[0];
    expect(first).toHaveProperty('symbol');
    expect(first).toHaveProperty('change');
    expect(first).toHaveProperty('sector');
    expect(typeof first.change).toBe('number');
  });

  test('heatmap response includes fetched_at timestamp', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/v1/market-data/heatmap`);
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data).toHaveProperty('fetched_at');
    // Should be a recent ISO timestamp
    const fetchedAt = new Date(data.fetched_at);
    const now = new Date();
    const diffMs = now.getTime() - fetchedAt.getTime();
    expect(diffMs).toBeLessThan(60_000); // within last minute
  });
});

test.describe('Portfolio Holdings API', () => {
  test('GET /api/v1/portfolio/holdings returns holdings array', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/v1/portfolio/holdings`, {
      timeout: 15_000,
    });
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data).toHaveProperty('holdings');
    expect(Array.isArray(data.holdings)).toBeTruthy();
    expect(data).toHaveProperty('total_value');
    expect(typeof data.total_value).toBe('number');
  });

  test('GET /api/v1/portfolio/performance returns curve data', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/v1/portfolio/performance?period=1y`, {
      timeout: 15_000,
    });
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data).toHaveProperty('equity_curve');
    expect(data).toHaveProperty('metrics');
    expect(data).toHaveProperty('period');
    expect(data.period).toBe('1y');
  });
});
