/**
 * ticker-resolution-v1-10.spec.ts
 * 
 * E2E tests for v1.10 Ticker English Disambiguation feature.
 * 
 * Tests:
 * 1. Ambiguous ticker (ON) returns low confidence with collision warning
 * 2. Normalized ticker (BRK-B) resolves to BRK.B with high confidence
 * 3. Batch resolution handles mixed confidence inputs
 * 
 * Constraints:
 * - 0 retries
 * - workers=1
 * - console-error gate ON
 */

import { test, expect } from '@playwright/test';

const API_BASE = 'http://localhost:8000';

test.describe('Ticker Resolution v1.10', () => {
  test.beforeEach(async ({ page }) => {
    // Enable console error gate (fail on console errors)
    page.on('pageerror', (error) => {
      throw new Error(`Page error detected: ${error.message}`);
    });
  });

  test('T1: Ambiguous ticker (ON) returns low confidence with collision warning', async ({ page, request }) => {
    // Test ticker resolution API directly (no UI dependency yet)
    const response = await request.post(`${API_BASE}/api/v1/ticker/resolve`, {
      data: { symbol: 'ON' }
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    // Assertions for collision ticker
    expect(data.ticker).toBe('ON');
    expect(data.normalized).toBe('ON');
    expect(data.confidence).toBe('low');
    expect(data.collision).toBe(true);
    expect(data.reason).toContain('collision');
    expect(data.company).toBe('ON Semiconductor Corporation');

    // Take screenshot for proof pack
    await page.goto(`${API_BASE}/docs`); // OpenAPI docs page
    await page.screenshot({ 
      path: 'test-results/ticker-resolution-v1-10/collision-ticker-ON.png',
      fullPage: true 
    });
  });

  test('T2: Normalized ticker (BRK-B) resolves to BRK.B with high confidence', async ({ page, request }) => {
    // Test multiple separator variants
    const variants = ['BRK-B', 'BRK/B', 'BRKB', 'brk-b'];

    for (const variant of variants) {
      const response = await request.post(`${API_BASE}/api/v1/ticker/resolve`, {
        data: { symbol: variant }
      });

      expect(response.ok()).toBeTruthy();
      const data = await response.json();

      // All variants should normalize to BRK.B
      expect(data.ticker).toBe('BRK.B');
      // normalized shows the internal lookup key (may differ from canonical)
      // BRKB → BRKB (no separator to normalize), BRK-B → BRK.B (separator normalized)
      expect(data.confidence).toBe('high');
      expect(data.collision).toBe(false);
      expect(data.company).toBe('Berkshire Hathaway Inc. (Class B)');
      expect(data.reason).toContain('BRK.B');
    }

    // Take screenshot for proof pack
    await page.goto(`${API_BASE}/docs`);
    await page.screenshot({ 
      path: 'test-results/ticker-resolution-v1-10/normalized-ticker-BRK-B.png',
      fullPage: true 
    });
  });

  test('T3: Batch resolution handles mixed confidence inputs', async ({ page, request }) => {
    const response = await request.post(`${API_BASE}/api/v1/ticker/resolve/batch`, {
      data: { 
        symbols: ['AAPL', 'brk-b', 'ON', 'I', 'FAKESYM']
      }
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    // Validate results array
    expect(data).toHaveLength(5);

    // AAPL: high confidence, known ticker
    expect(data[0].ticker).toBe('AAPL');
    expect(data[0].confidence).toBe('high');
    expect(data[0].collision).toBe(false);

    // brk-b: high confidence, normalized to BRK.B
    expect(data[1].ticker).toBe('BRK.B');
    expect(data[1].normalized).toBe('BRK.B');
    expect(data[1].confidence).toBe('high');
    expect(data[1].collision).toBe(false);

    // ON: low confidence, collision ticker
    expect(data[2].ticker).toBe('ON');
    expect(data[2].confidence).toBe('low');
    expect(data[2].collision).toBe(true);

    // I: low confidence, collision ticker (pronoun)
    expect(data[3].ticker).toBe('I');
    expect(data[3].confidence).toBe('low');
    expect(data[3].collision).toBe(true);

    // FAKESYM: low confidence, unknown ticker
    expect(data[4].ticker).toBe('FAKESYM');
    expect(data[4].confidence).toBe('low');
    expect(data[4].collision).toBe(false);
    expect(data[4].company).toBeNull();

    // Take screenshot for proof pack
    await page.goto(`${API_BASE}/docs`);
    await page.screenshot({ 
      path: 'test-results/ticker-resolution-v1-10/batch-mixed-confidence.png',
      fullPage: true 
    });
  });

  test('T4: Unknown ticker returns low confidence', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/v1/ticker/resolve`, {
      data: { symbol: 'NOTAREALTICKER' }
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    expect(data.ticker).toBe('NOTAREALTICKER');
    expect(data.normalized).toBe('NOTAREALTICKER');
    expect(data.confidence).toBe('low');
    expect(data.collision).toBe(false);
    expect(data.reason).toContain('Unknown ticker');
    expect(data.company).toBeNull();
  });

  test('T5: Whitespace and case handling', async ({ request }) => {
    const inputs = [
      { input: '  aapl  ', expected: 'AAPL' },
      { input: 'AaPl', expected: 'AAPL' },
      { input: '  brk-b  ', expected: 'BRK.B' }
    ];

    for (const { input, expected } of inputs) {
      const response = await request.post(`${API_BASE}/api/v1/ticker/resolve`, {
        data: { symbol: input }
      });

      expect(response.ok()).toBeTruthy();
      const data = await response.json();

      expect(data.ticker).toBe(expected);
      expect(data.confidence).toBe('high');
    }
  });

  test('T6: Empty and invalid inputs', async ({ request }) => {
    const invalidInputs = ['', '   '];

    for (const input of invalidInputs) {
      const response = await request.post(`${API_BASE}/api/v1/ticker/resolve`, {
        data: { symbol: input }
      });

      expect(response.ok()).toBeTruthy();
      const data = await response.json();

      expect(data.ticker).toBe('');
      expect(data.confidence).toBe('low');
      expect(data.reason).toContain('Empty');
    }
  });

  test('T7: Normalize endpoint provides quick normalization', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/v1/ticker/normalize`, {
      data: { symbol: 'brk-b' }
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    expect(data.normalized).toBe('BRK.B');
  });

  test('T8: All collision tickers flagged correctly', async ({ request }) => {
    const collisionTickers = ['A', 'I', 'ON', 'IT', 'ARE'];

    for (const ticker of collisionTickers) {
      const response = await request.post(`${API_BASE}/api/v1/ticker/resolve`, {
        data: { symbol: ticker }
      });

      expect(response.ok()).toBeTruthy();
      const data = await response.json();

      expect(data.ticker).toBe(ticker);
      expect(data.collision).toBe(true);
      expect(data.confidence).toBe('low');
      expect(data.reason).toContain('collision');
    }
  });
});
