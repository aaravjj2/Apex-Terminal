/**
 * Tour recording script for the Authentic Data Migration.
 * Records a ≥3 min walkthrough showing all key features.
 *
 * Run from frontend/ with:
 *   DISPLAY=:0 npx playwright test tests/e2e/tour/record-tour.spec.ts --workers=1 --retries=0
 */
import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:5100/ui2';

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

test('Authentic Data Tour — ≥3 min walkthrough', async ({ page }) => {
  // ── 0. Home (15s) ──────────────────────────────────────────────────────────
  await page.goto(BASE);
  await page.waitForSelector('[data-testid="ui2-mode-badge"]', { timeout: 15000 });
  await sleep(15000);

  // ── 1. Data Mode badge confirmation (10s) ─────────────────────────────────
  await expect(page.getByTestId('ui2-mode-badge')).toBeVisible();
  await expect(page.getByTestId('ui2-data-mode-badge')).toContainText('Recorded');
  await sleep(10000);

  // ── 2. Autopilot (25s × 3) ────────────────────────────────────────────────
  await page.goto(`${BASE}/autopilot`);
  await page.waitForSelector('[data-testid="autopilot-ui2-page"]', { timeout: 10000 });
  await sleep(20000);

  // Risk Controls
  await page.getByTestId('autopilot-tab-risk').click();
  await sleep(20000);

  // Evaluation + Attribution
  await page.getByTestId('autopilot-tab-evaluation').click();
  await sleep(20000);

  // ── 3. Backtest (20s × 4) ──────────────────────────────────────────────────
  await page.goto(`${BASE}/backtest`);
  await page.waitForSelector('[data-testid="backtest-ui2-page"]', { timeout: 10000 });
  await sleep(15000);

  await page.getByTestId('backtest-tabs-tab-sweeps').click();
  await sleep(15000);

  await page.getByTestId('backtest-tabs-tab-walkforward').click();
  await sleep(15000);

  await page.getByTestId('backtest-tabs-tab-robustness').click();
  await sleep(15000);

  // ── 4. Workflow Builder (15s × 3) ──────────────────────────────────────────
  await page.goto(`${BASE}/workflow-builder`);
  await page.waitForSelector('[data-testid="ui2-workflow-builder-page"]', { timeout: 10000 });
  await sleep(15000);

  await page.getByTestId('ui2-workflow-tab-runs').click();
  await sleep(15000);

  await page.getByTestId('ui2-workflow-tab-scheduling').click();
  await sleep(15000);

  // ── 5. Search (15s × 2) ────────────────────────────────────────────────────
  await page.goto(`${BASE}/search`);
  await page.waitForSelector('[data-testid="search-ui2-page"]', { timeout: 10000 });
  await sleep(15000);

  await expect(page.getByTestId('search-provider-status')).toBeVisible();
  await sleep(15000);

  // ── 6. Return to home — final badge check (10s) ────────────────────────────
  await page.goto(BASE);
  await page.waitForSelector('[data-testid="ui2-mode-badge"]', { timeout: 10000 });
  await sleep(10000);

  await expect(page.getByTestId('ui2-data-mode-badge')).toContainText('Recorded');
  await sleep(5000);
});
