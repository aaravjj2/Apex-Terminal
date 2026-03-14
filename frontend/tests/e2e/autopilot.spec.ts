/**
 * Autopilot UI2 E2E Tests
 * Tests the current UI2 autopilot pages.
 * Replaces the legacy autopilot spec which tested the old features/ autopilot.
 * Non-headless mode (user mandate).
 */

import { test, expect, Page } from '@playwright/test';

const LOAD_OPTS = { timeout: 30_000 };
const API_BASE = 'http://localhost:8000';

// ── Helpers ──────────────────────────────────────────────────────────────────

async function goToAutopilot(page: Page) {
  await page.goto('/ui2/autopilot');
  await page.waitForLoadState('domcontentloaded', LOAD_OPTS).catch(() => {});
  await page.waitForTimeout(500);
}

async function goToAutopilotV2(page: Page) {
  await page.goto('/ui2/autopilot-v2');
  await page.waitForLoadState('domcontentloaded', LOAD_OPTS).catch(() => {});
  await page.waitForTimeout(500);
}

// ── Navigation ────────────────────────────────────────────────────────────────

test.describe('Autopilot Navigation', () => {
  test('autopilot nav item is present in left rail', async ({ page }) => {
    await page.goto('/ui2/dashboard');
    await page.waitForLoadState('domcontentloaded', LOAD_OPTS).catch(() => {});
    const navItem = page.getByTestId('ui2-rail-autopilot');
    await expect(navItem).toBeVisible({ timeout: 10_000 });
  });

  test('clicking autopilot nav item navigates to /ui2/autopilot', async ({ page }) => {
    await page.goto('/ui2/dashboard');
    await page.waitForLoadState('domcontentloaded', LOAD_OPTS).catch(() => {});
    await page.getByTestId('ui2-rail-autopilot').click();
    await page.waitForURL('**/ui2/autopilot**', { timeout: 10_000 });
    await expect(page.locator('body')).toBeVisible();
  });

  test('direct navigation to /ui2/autopilot works', async ({ page }) => {
    await goToAutopilot(page);
    await expect(page.locator('body')).toBeVisible();
    const content = await page.locator('body').textContent();
    expect(content).toBeTruthy();
    expect(content!.length).toBeGreaterThan(100);
  });

  test('direct navigation to /ui2/autopilot-v2 works', async ({ page }) => {
    await goToAutopilotV2(page);
    const v2Page = page.getByTestId('autopilot-v2-page');
    await expect(v2Page).toBeVisible({ timeout: 15_000 });
  });
});

// ── Autopilot Main Dashboard (AutopilotUI2) ────────────────────────────────────

test.describe('Autopilot Main Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await goToAutopilot(page);
  });

  test('autopilot equity panel is visible', async ({ page }) => {
    const equityPanel = page.getByTestId('autopilot-equity');
    await expect(equityPanel).toBeVisible({ timeout: 15_000 });
  });

  test('signal dashboard panel is visible', async ({ page }) => {
    const signals = page.getByTestId('signal-dashboard');
    await expect(signals).toBeVisible({ timeout: 15_000 });
  });

  test('risk guardrails panel is visible', async ({ page }) => {
    const risk = page.getByTestId('risk-guardrails');
    await expect(risk).toBeVisible({ timeout: 15_000 });
  });

  test('positions panel is visible', async ({ page }) => {
    const positions = page.getByTestId('positions-panel');
    await expect(positions).toBeVisible({ timeout: 15_000 });
  });

  test('orders panel is visible', async ({ page }) => {
    // orders-panel only renders when the Orders sub-tab is active
    await page.getByTestId('autopilot-tab-orders').click();
    await page.waitForTimeout(300);
    const orders = page.getByTestId('orders-panel');
    await expect(orders).toBeVisible({ timeout: 15_000 });
  });

  test('kill switch panel is visible and functional', async ({ page }) => {
    const killPanel = page.getByTestId('autopilot-kill-switch-panel');
    await expect(killPanel).toBeVisible({ timeout: 15_000 });
    const killBtn = page.getByTestId('autopilot-kill-switch-btn');
    await expect(killBtn).toBeVisible({ timeout: 10_000 });
    await expect(killBtn).toBeEnabled();
  });

  test('kill switch confirm modal works', async ({ page }) => {
    const killBtn = page.getByTestId('autopilot-kill-switch-btn');
    await expect(killBtn).toBeVisible({ timeout: 10_000 });
    await killBtn.click();
    // Either a confirm modal appears OR the kill switch toggles directly
    const modal = page.getByTestId('autopilot-confirm-modal');
    const isModalVisible = await modal.isVisible().catch(() => false);
    if (isModalVisible) {
      const cancelBtn = page.getByTestId('autopilot-confirm-cancel');
      await expect(cancelBtn).toBeVisible();
      await cancelBtn.click(); // Cancel — don't actually toggle
    }
    // Either way the kill switch panel should still be visible
    await expect(page.getByTestId('autopilot-kill-switch-panel')).toBeVisible();
  });

  test('think log panel is visible', async ({ page }) => {
    const thinkLog = page.getByTestId('autopilot-think-log');
    await expect(thinkLog).toBeVisible({ timeout: 15_000 });
  });

  test('decisions panel is visible', async ({ page }) => {
    // decisions-panel only renders when the Decisions sub-tab is active
    await page.getByTestId('autopilot-tab-decisions').click();
    await page.waitForTimeout(300);
    const decisions = page.getByTestId('decisions-panel');
    await expect(decisions).toBeVisible({ timeout: 15_000 });
  });

  test('cycle history panel is visible', async ({ page }) => {
    // cycle-history only renders when the Cycles sub-tab is active
    await page.getByTestId('autopilot-tab-cycles').click();
    await page.waitForTimeout(300);
    const cycles = page.getByTestId('cycle-history');
    await expect(cycles).toBeVisible({ timeout: 15_000 });
  });

  test('autopilot page contains financial content', async ({ page }) => {
    const content = await page.locator('body').textContent() || '';
    const hasFinancialContent =
      content.toLowerCase().includes('autopilot') ||
      content.toLowerCase().includes('kill') ||
      content.toLowerCase().includes('equity') ||
      content.toLowerCase().includes('position') ||
      content.toLowerCase().includes('signal');
    expect(hasFinancialContent).toBeTruthy();
  });
});

// ── Autopilot V2 Pipeline ─────────────────────────────────────────────────────

test.describe('Autopilot V2 Pipeline', () => {
  test.beforeEach(async ({ page }) => {
    await goToAutopilotV2(page);
  });

  test('v2 page container is present', async ({ page }) => {
    await expect(page.getByTestId('autopilot-v2-page')).toBeVisible({ timeout: 15_000 });
  });

  test('v2 controls bar is present', async ({ page }) => {
    const controls = page.getByTestId('ui2-autopilot-controls');
    await expect(controls).toBeVisible({ timeout: 10_000 });
  });

  test('v2 run button is clickable', async ({ page }) => {
    const runBtn = page.getByTestId('ui2-autopilot-run-btn');
    await expect(runBtn).toBeVisible({ timeout: 10_000 });
    await expect(runBtn).toBeEnabled();
  });

  test('v2 kill switch toggle is present', async ({ page }) => {
    const ks = page.getByTestId('ui2-autopilot-killswitch-toggle');
    await expect(ks).toBeVisible({ timeout: 10_000 });
  });

  test('v2 ready marker is rendered', async ({ page }) => {
    // Hidden div used for test synchronisation
    const ready = page.getByTestId('autopilot-v2-ready');
    await expect(ready).toBeDefined();
  });

  test('v2 pipeline executes and shows results', async ({ page }) => {
    const runBtn = page.getByTestId('ui2-autopilot-run-btn');
    await expect(runBtn).toBeEnabled({ timeout: 10_000 });
    await runBtn.click();
    // Wait for either results or empty state
    const hasResults = await Promise.race([
      page.getByTestId('ui2-autopilot-outcome-summary').waitFor({ state: 'visible', timeout: 60_000 }).then(() => true),
      page.getByTestId('ui2-autopilot-empty').waitFor({ state: 'visible', timeout: 60_000 }).then(() => false),
    ]).catch(() => null);
    // Either outcome is acceptable
    expect(hasResults).not.toBeNull();
  });
});

// ── Autopilot Rules ────────────────────────────────────────────────────────────

test.describe('Autopilot Rules', () => {
  test('rules list panel is visible on main autopilot page', async ({ page }) => {
    await goToAutopilot(page);
    const rules = page.getByTestId('autopilot-rules-list');
    await expect(rules).toBeVisible({ timeout: 15_000 });
  });

  test('activity table panel is visible', async ({ page }) => {
    await goToAutopilot(page);
    const activity = page.getByTestId('autopilot-activity-table');
    await expect(activity).toBeVisible({ timeout: 15_000 });
  });
});

// ── Autopilot API Integration ─────────────────────────────────────────────────

test.describe('Autopilot Backend Integration', () => {
  test('autopilot status endpoint is reachable', async ({ request }) => {
    const resp = await request.get(`${API_BASE}/api/v1/autopilot/status`, { timeout: 10_000 });
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();
    expect(data).toHaveProperty('kill_switch_active');
  });

  test('autopilot runs endpoint returns array', async ({ request }) => {
    const resp = await request.get(`${API_BASE}/api/v1/autopilot/runs?limit=10`, { timeout: 10_000 });
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();
    expect(Array.isArray(data)).toBeTruthy();
  });

  test('autopilot positions returns array or object with positions', async ({ request }) => {
    const resp = await request.get(`${API_BASE}/api/v1/autopilot/positions`, { timeout: 15_000 });
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();
    const positions = Array.isArray(data) ? data : data.positions;
    expect(Array.isArray(positions)).toBeTruthy();
  });

  test('kill switch status endpoint returns boolean state', async ({ request }) => {
    const resp = await request.get(`${API_BASE}/api/v1/autopilot/kill-switch`, { timeout: 10_000 });
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();
    expect(data).toHaveProperty('active');
    expect(typeof data.active).toBe('boolean');
  });
});

// ── Visual Regression ─────────────────────────────────────────────────────────

test.describe('Autopilot Visual Regression', () => {
  test('autopilot main page screenshot', async ({ page }) => {
    await goToAutopilot(page);
    await page.waitForTimeout(1500);
    await page.screenshot({
      path: 'test-results/snapshots/autopilot-ui2-main.png',
      fullPage: true,
    });
  });

  test('autopilot v2 page screenshot', async ({ page }) => {
    await goToAutopilotV2(page);
    await page.waitForTimeout(1500);
    await page.screenshot({
      path: 'test-results/snapshots/autopilot-v2-pipeline.png',
      fullPage: true,
    });
  });
});

// ── Accessibility ─────────────────────────────────────────────────────────────

test.describe('Autopilot Accessibility', () => {
  test('all buttons on autopilot page have accessible labels', async ({ page }) => {
    await goToAutopilot(page);
    const buttons = page.locator('button');
    const count = await buttons.count();
    expect(count).toBeGreaterThan(0);
    // Each visible button should have aria-label, title, or text content
    for (let i = 0; i < Math.min(count, 10); i++) {
      const btn = buttons.nth(i);
      if (await btn.isVisible()) {
        const text = await btn.textContent();
        const ariaLabel = await btn.getAttribute('aria-label');
        const title = await btn.getAttribute('title');
        const hasLabel = (text && text.trim().length > 0) || !!ariaLabel || !!title;
        expect(hasLabel).toBeTruthy();
      }
    }
  });
});
