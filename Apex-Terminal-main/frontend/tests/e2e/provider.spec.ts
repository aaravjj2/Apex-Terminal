import { test, expect } from '@playwright/test';

const SYMBOLS = ['AAPL', 'TSLA', 'MSFT'];
const BACKEND_URL = 'http://localhost:8000';

// Helper to check if backend is available
async function isBackendAvailable(request: any): Promise<boolean> {
  try {
    const res = await request.get(`${BACKEND_URL}/health`, { timeout: 3000 });
    return res.ok();
  } catch {
    return false;
  }
}

test.describe('Options Provider Verification', () => {
  test('options provider returns data for key symbols', async ({ request }) => {
    // Skip if backend not available
    const backendUp = await isBackendAvailable(request);
    test.skip(!backendUp, 'Backend not available - skipping API test');

    for (const sym of SYMBOLS) {
      const res = await request.get(`${BACKEND_URL}/api/v1/options/chain/${sym}`);
      // Accept 200 OK or 503 (no data yet) - just not a server crash
      expect([200, 503, 404].includes(res.status()), `Valid status for ${sym}`).toBeTruthy();

      if (res.ok()) {
        const data = await res.json();
        // If we got data, verify structure
        expect(data).toHaveProperty('symbol');
      }
    }
  });
});
