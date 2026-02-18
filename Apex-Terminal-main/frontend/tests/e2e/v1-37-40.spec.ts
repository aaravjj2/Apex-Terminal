/**
 * v1.37–v1.40 E2E suite
 *
 * v1.37: Provider Registry — visible in Backtest / Risk Desk panels
 * v1.38: Citations — reusable citation display
 * v1.39: Search — search panel with query/results
 * v1.40: Agents — multi-step agent runner panel
 */

import { test, expect } from '@playwright/test';
import {
  enableDeterministicMode,
  waitForAppReady,
  waitForTestId,
  clickTestId,
  fillTestId,
} from './helpers';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5100';

/* ------------------------------------------------------------------ */
/* v1.37: Provider Registry                                           */
/* ------------------------------------------------------------------ */

test.describe('v1.37 — Provider Registry', () => {
  test('PR01: Provider registry visible in Backtest panel', async ({ page }) => {
    await enableDeterministicMode(page);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);

    // Navigate to backtest
    await clickTestId(page, 'nav-item-backtest');
    await waitForTestId(page, 'backtest-panel');

    // Provider registry should load
    await waitForTestId(page, 'provider-registry', { timeout: 10000 });
    const registry = page.getByTestId('provider-registry');
    await expect(registry).toBeVisible();

    await page.screenshot({ path: 'e2e-results/v37-01-provider-registry-backtest.png' });
  });

  test('PR02: Provider registry shows provider rows', async ({ page }) => {
    await enableDeterministicMode(page);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);

    await clickTestId(page, 'nav-item-backtest');
    await waitForTestId(page, 'backtest-panel');
    await waitForTestId(page, 'provider-registry', { timeout: 10000 });

    // Should have provider rows
    const rows = page.locator('[data-testid^="provider-row-"]');
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(1);

    await page.screenshot({ path: 'e2e-results/v37-02-provider-rows.png' });
  });
});

/* ------------------------------------------------------------------ */
/* v1.38: Citations                                                   */
/* ------------------------------------------------------------------ */

test.describe('v1.38 — Citations', () => {
  test('CT01: Citations panel visible in Backtest', async ({ page }) => {
    await enableDeterministicMode(page);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);

    await clickTestId(page, 'nav-item-backtest');
    await waitForTestId(page, 'backtest-panel');

    // Citations panel should render
    await waitForTestId(page, 'citations-panel', { timeout: 10000 });
    await expect(page.getByTestId('citations-panel')).toBeVisible();

    await page.screenshot({ path: 'e2e-results/v38-01-citations-backtest.png' });
  });

  test('CT02: Citation items render with source badges', async ({ page }) => {
    await enableDeterministicMode(page);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);

    await clickTestId(page, 'nav-item-backtest');
    await waitForTestId(page, 'backtest-panel');
    await waitForTestId(page, 'citations-panel', { timeout: 10000 });

    // At least one citation item
    await waitForTestId(page, 'citation-item-0', { timeout: 10000 });
    await expect(page.getByTestId('citation-source-0')).toBeVisible();

    await page.screenshot({ path: 'e2e-results/v38-02-citation-items.png' });
  });
});

/* ------------------------------------------------------------------ */
/* v1.39: Search Panel                                                */
/* ------------------------------------------------------------------ */

test.describe('v1.39 — Search Panel', () => {
  test('SP01: Navigate to search panel', async ({ page }) => {
    await enableDeterministicMode(page);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);

    await clickTestId(page, 'nav-item-search');
    await waitForTestId(page, 'search-panel');

    await expect(page.getByTestId('search-query')).toBeVisible();
    await expect(page.getByTestId('search-submit')).toBeVisible();

    await page.screenshot({ path: 'e2e-results/v39-01-search-panel.png' });
  });

  test('SP02: Search returns results', async ({ page }) => {
    await enableDeterministicMode(page);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);

    await clickTestId(page, 'nav-item-search');
    await waitForTestId(page, 'search-panel');

    // Type query and submit
    await fillTestId(page, 'search-query', 'SMA');
    await clickTestId(page, 'search-submit');

    // Should show results
    await waitForTestId(page, 'search-result-0', { timeout: 10000 });
    await expect(page.getByTestId('search-result-0')).toBeVisible();

    await page.screenshot({ path: 'e2e-results/v39-02-search-results.png' });
  });

  test('SP03: Search shows empty for nonsense query', async ({ page }) => {
    await enableDeterministicMode(page);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);

    await clickTestId(page, 'nav-item-search');
    await waitForTestId(page, 'search-panel');

    await fillTestId(page, 'search-query', 'zzzznotfound');
    await clickTestId(page, 'search-submit');

    // Should show empty state
    await waitForTestId(page, 'search-empty', { timeout: 10000 });
    await expect(page.getByTestId('search-empty')).toBeVisible();

    await page.screenshot({ path: 'e2e-results/v39-03-search-empty.png' });
  });
});

/* ------------------------------------------------------------------ */
/* v1.40: Agent Runner                                                */
/* ------------------------------------------------------------------ */

test.describe('v1.40 — Agent Runner', () => {
  test('AG01: Navigate to agents panel', async ({ page }) => {
    await enableDeterministicMode(page);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);

    await clickTestId(page, 'nav-item-agents');
    await waitForTestId(page, 'agents-panel');
    await waitForTestId(page, 'agents-panel');

    await expect(page.getByTestId('agent-run-btn')).toBeVisible();

    await page.screenshot({ path: 'e2e-results/v40-01-agents-panel.png' });
  });

  test('AG02: Run agent and verify steps', async ({ page }) => {
    await enableDeterministicMode(page);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);

    await clickTestId(page, 'nav-item-agents');
    await waitForTestId(page, 'agents-panel');

    // Run agent
    await clickTestId(page, 'agent-run-btn');

    // Wait for steps to appear
    await waitForTestId(page, 'agent-step-0', { timeout: 15000 });
    await waitForTestId(page, 'agent-step-4', { timeout: 15000 });

    // Verify final output
    await waitForTestId(page, 'agent-final-output', { timeout: 15000 });
    const output = page.getByTestId('agent-final-output');
    await expect(output).toBeVisible();

    await page.screenshot({ path: 'e2e-results/v40-02-agent-steps.png' });
  });

  test('AG03: Agent tools are listed in steps', async ({ page }) => {
    await enableDeterministicMode(page);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);

    await clickTestId(page, 'nav-item-agents');
    await waitForTestId(page, 'agents-panel');

    await clickTestId(page, 'agent-run-btn');
    await waitForTestId(page, 'agent-step-0', { timeout: 15000 });

    // Check tool badges
    await expect(page.getByTestId('agent-tool-0')).toBeVisible();
    const toolText = await page.getByTestId('agent-tool-0').textContent();
    expect(toolText).toBe('search');

    await page.screenshot({ path: 'e2e-results/v40-03-agent-tools.png' });
  });
});
