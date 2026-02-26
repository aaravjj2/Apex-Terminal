/**
 * legacy-ui-parity.spec.ts
 *
 * LEGACY PARITY CONTRACT §2 — All required UI screens present.
 * LEGACY PARITY CONTRACT §8 — UI parity checklist: all data-testids present.
 * CONTRACT: All 8 tabs render without error and key controls are reachable.
 *
 * Rules:
 *  - data-testid selectors ONLY
 *  - no waitForTimeout
 */

import { test, expect } from '@playwright/test';

const PAGE = 'http://localhost:5100/ui2/autopilot-command-center';

// All tabs defined in TABS array of AutopilotCommandCenterUI2.tsx
const ALL_TABS = [
  'status',
  'cycles',
  'decisions',
  'rejections',
  'orders',
  'positions',
  'pnl',
  'llm',
] as const;

// Tab-level container data-testid for each tab
const TAB_CONTAINERS: Record<string, string> = {
  status:     'tab-status',
  cycles:     'tab-cycles',
  decisions:  'tab-decisions',
  rejections: 'tab-rejections',
  orders:     'tab-orders',
  positions:  'tab-positions',
  pnl:        'tab-pnl',
  llm:        'tab-llm',
};

test.describe('Legacy Parity — Full UI Parity Checklist', () => {

  // ── Page-level structure ────────────────────────────────────────────────────

  test('autopilot-command-center root is present', async ({ page }) => {
    await page.goto(PAGE, { waitUntil: 'networkidle' });
    await expect(page.getByTestId('autopilot-command-center')).toBeVisible();
  });

  test('page-title is visible', async ({ page }) => {
    await page.goto(PAGE, { waitUntil: 'networkidle' });
    await expect(page.getByTestId('page-title')).toBeVisible();
  });

  test('tab-bar is visible', async ({ page }) => {
    await page.goto(PAGE, { waitUntil: 'networkidle' });
    await expect(page.getByTestId('tab-bar')).toBeVisible();
  });

  test('tab-content is visible', async ({ page }) => {
    await page.goto(PAGE, { waitUntil: 'networkidle' });
    await expect(page.getByTestId('tab-content')).toBeVisible();
  });

  // ── All 8 tab buttons ──────────────────────────────────────────────────────

  for (const tabId of ALL_TABS) {
    test(`tab-btn-${tabId} is visible`, async ({ page }) => {
      await page.goto(PAGE, { waitUntil: 'networkidle' });
      await expect(page.getByTestId(`tab-btn-${tabId}`)).toBeVisible();
    });
  }

  // ── All 8 tab containers render when clicked ───────────────────────────────

  for (const tabId of ALL_TABS) {
    test(`clicking tab-btn-${tabId} renders ${TAB_CONTAINERS[tabId]}`, async ({ page }) => {
      await page.goto(PAGE, { waitUntil: 'networkidle' });
      await page.getByTestId(`tab-btn-${tabId}`).click();
      await expect(page.getByTestId(TAB_CONTAINERS[tabId])).toBeVisible();
    });
  }

  // ── Parity contract §8: key control data-testids ──────────────────────────

  test('btn-refresh is visible and clickable', async ({ page }) => {
    await page.goto(PAGE, { waitUntil: 'networkidle' });
    const btn = page.getByTestId('btn-refresh');
    await expect(btn).toBeVisible();
    await btn.click();
    await expect(page.getByTestId('tab-content')).toBeVisible();
  });

  test('btn-run-now is visible', async ({ page }) => {
    await page.goto(PAGE, { waitUntil: 'networkidle' });
    await expect(page.getByTestId('btn-run-now')).toBeVisible();
  });

  test('btn-kill-switch is visible', async ({ page }) => {
    await page.goto(PAGE, { waitUntil: 'networkidle' });
    await expect(page.getByTestId('btn-kill-switch')).toBeVisible();
  });

  test('btn-arm or btn-disarm is visible (reflects live armed state)', async ({ page }) => {
    await page.goto(PAGE, { waitUntil: 'networkidle' });
    const arm   = await page.getByTestId('btn-arm').isVisible().catch(() => false);
    const disarm = await page.getByTestId('btn-disarm').isVisible().catch(() => false);
    expect(arm || disarm).toBe(true);
  });

  // ── Parity contract §8: status strip badges ───────────────────────────────

  test('status-strip and badge-alpaca-connected are visible', async ({ page }) => {
    await page.goto(PAGE, { waitUntil: 'networkidle' });
    await expect(page.getByTestId('status-strip')).toBeVisible();
    await expect(page.getByTestId('badge-alpaca-connected')).toBeVisible();
  });

  test('badge-market-open and badge-armed are visible', async ({ page }) => {
    await page.goto(PAGE, { waitUntil: 'networkidle' });
    await expect(page.getByTestId('badge-market-open')).toBeVisible();
    await expect(page.getByTestId('badge-armed')).toBeVisible();
  });

  // ── Parity contract §2: panel data-testids from contract ─────────────────

  test('decisions-list or decisions-empty present in Decisions tab', async ({ page }) => {
    await page.goto(PAGE, { waitUntil: 'networkidle' });
    await page.getByTestId('tab-btn-decisions').click();
    const list  = page.getByTestId('decisions-list');
    const empty = page.getByTestId('decisions-empty');
    const anyVisible = (await list.isVisible().catch(() => false)) ||
                       (await empty.isVisible().catch(() => false));
    expect(anyVisible).toBe(true);
  });

  test('rejections-list or rejections-empty present in Rejections tab', async ({ page }) => {
    await page.goto(PAGE, { waitUntil: 'networkidle' });
    await page.getByTestId('tab-btn-rejections').click();
    const list  = page.getByTestId('rejections-list');
    const empty = page.getByTestId('rejections-empty');
    const anyVisible = (await list.isVisible().catch(() => false)) ||
                       (await empty.isVisible().catch(() => false));
    expect(anyVisible).toBe(true);
  });

  test('positions-list or positions-empty present in Positions tab', async ({ page }) => {
    await page.goto(PAGE, { waitUntil: 'networkidle' });
    await page.getByTestId('tab-btn-positions').click();
    const list  = page.getByTestId('positions-list');
    const empty = page.getByTestId('positions-empty');
    const anyVisible = (await list.isVisible().catch(() => false)) ||
                       (await empty.isVisible().catch(() => false));
    expect(anyVisible).toBe(true);
  });

  test('universe-list is visible in Status tab', async ({ page }) => {
    await page.goto(PAGE, { waitUntil: 'networkidle' });
    await expect(page.getByTestId('universe-list')).toBeVisible();
  });

  test('risk-controls-grid is visible in Status tab', async ({ page }) => {
    await page.goto(PAGE, { waitUntil: 'networkidle' });
    await expect(page.getByTestId('risk-controls-grid')).toBeVisible();
  });
});
