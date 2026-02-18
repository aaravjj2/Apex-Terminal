/**
 * Wave 8 E2E Tests (v1.73-v1.82)
 * Autopilot V2, Automation V2, Export, Platform Health
 * data-testid selectors ONLY — headed, workers=1, retries=0
 */
import { test, expect } from '@playwright/test';

const BASE = '/ui2';

// ── v1.73-75: Autopilot V2 ──────────────────────────────────

test.describe('v1.73-75 — Autopilot V2', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/autopilot-v2`);
    await page.waitForSelector('[data-testid="autopilot-v2-ready"]', { state: 'attached', timeout: 8000 });
  });

  test('page loads with ready marker', async ({ page }) => {
    await expect(page.locator('[data-testid="autopilot-v2-page"]')).toBeVisible();
    await expect(page.locator('[data-testid="autopilot-v2-ready"]')).toBeAttached();
  });

  test('shows header and controls', async ({ page }) => {
    await expect(page.locator('[data-testid="ui2-autopilot-v2-header"]')).toBeVisible();
    await expect(page.locator('[data-testid="ui2-autopilot-run-btn"]')).toBeVisible();
    await expect(page.locator('[data-testid="ui2-autopilot-seed-select"]')).toBeVisible();
    await expect(page.locator('[data-testid="ui2-autopilot-killswitch-toggle"]')).toBeVisible();
  });

  test('shows empty state before run', async ({ page }) => {
    await expect(page.locator('[data-testid="ui2-autopilot-empty"]')).toBeVisible();
  });

  test('run pipeline fills candidates table', async ({ page }) => {
    await page.click('[data-testid="ui2-autopilot-run-btn"]');
    await expect(page.locator('[data-testid="ui2-autopilot-candidates-table"]')).toBeVisible();
    const rows = page.locator('[data-testid="ui2-autopilot-candidates-dt"] tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
  });

  test('tabs switch to explain panel', async ({ page }) => {
    await page.click('[data-testid="ui2-autopilot-run-btn"]');
    await page.click('[data-testid="ui2-autopilot-tabs-tab-explain"]');
    await expect(page.locator('[data-testid="ui2-autopilot-explain-panel"]')).toBeVisible();
  });

  test('tabs switch to orders table', async ({ page }) => {
    await page.click('[data-testid="ui2-autopilot-run-btn"]');
    await page.click('[data-testid="ui2-autopilot-tabs-tab-orders"]');
    await expect(page.locator('[data-testid="ui2-autopilot-orders-table"]')).toBeVisible();
    const rows = page.locator('[data-testid="ui2-autopilot-orders-dt"] tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
  });

  test('tabs switch to positions table', async ({ page }) => {
    await page.click('[data-testid="ui2-autopilot-run-btn"]');
    await page.click('[data-testid="ui2-autopilot-tabs-tab-positions"]');
    await expect(page.locator('[data-testid="ui2-autopilot-positions-table"]')).toBeVisible();
  });

  test('tabs switch to rejections', async ({ page }) => {
    await page.click('[data-testid="ui2-autopilot-run-btn"]');
    await page.click('[data-testid="ui2-autopilot-tabs-tab-rejections"]');
    await expect(page.locator('[data-testid="ui2-autopilot-rejections-table"]')).toBeVisible();
  });

  test('tabs switch to timeline', async ({ page }) => {
    await page.click('[data-testid="ui2-autopilot-run-btn"]');
    await page.click('[data-testid="ui2-autopilot-tabs-tab-timeline"]');
    await expect(page.locator('[data-testid="ui2-autopilot-timeline"]')).toBeVisible();
  });

  test('seed selector changes value', async ({ page }) => {
    await page.selectOption('[data-testid="ui2-autopilot-seed-select"]', '123');
    const val = await page.locator('[data-testid="ui2-autopilot-seed-select"]').inputValue();
    expect(val).toBe('123');
  });

  test('kill switch toggle works', async ({ page }) => {
    await page.click('[data-testid="ui2-autopilot-killswitch-toggle"]');
    await expect(page.locator('[data-testid="ui2-autopilot-killswitch-toggle"]')).toContainText('Kill Switch ON');
    // Run button should be disabled
    await expect(page.locator('[data-testid="ui2-autopilot-run-btn"]')).toBeDisabled();
    // Disarm
    await page.click('[data-testid="ui2-autopilot-killswitch-toggle"]');
    await expect(page.locator('[data-testid="ui2-autopilot-run-btn"]')).toBeEnabled();
  });

  test('run count badge appears', async ({ page }) => {
    await page.click('[data-testid="ui2-autopilot-run-btn"]');
    await expect(page.locator('[data-testid="ui2-autopilot-run-count"]')).toContainText('1 run');
  });
});

// ── v1.76: Automation V2 ────────────────────────────────────

test.describe('v1.76 — Automation V2', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/automation-v2`);
    await page.waitForSelector('[data-testid="automation-v2-ready"]', { state: 'attached', timeout: 8000 });
  });

  test('page loads with ready marker', async ({ page }) => {
    await expect(page.locator('[data-testid="automation-v2-page"]')).toBeVisible();
    await expect(page.locator('[data-testid="automation-v2-ready"]')).toBeAttached();
  });

  test('shows header and controls', async ({ page }) => {
    await expect(page.locator('[data-testid="ui2-automation-v2-header"]')).toBeVisible();
    await expect(page.locator('[data-testid="ui2-automation-create-btn"]')).toBeVisible();
  });

  test('workflow list shows demo data', async ({ page }) => {
    await expect(page.locator('[data-testid="ui2-automation-workflow-list"]')).toBeVisible();
    const rows = page.locator('[data-testid="ui2-automation-wf-dt"] tbody tr');
    await expect(rows).toHaveCount(3);
  });

  test('clicking workflow shows run button', async ({ page }) => {
    // Click first workflow row
    await page.locator('[data-testid="ui2-automation-wf-dt"] tbody tr').first().click();
    await expect(page.locator('[data-testid="ui2-automation-run-btn"]')).toBeVisible();
  });

  test('run workflow shows run log', async ({ page }) => {
    await page.locator('[data-testid="ui2-automation-wf-dt"] tbody tr').first().click();
    await page.click('[data-testid="ui2-automation-run-btn"]');
    await expect(page.locator('[data-testid="ui2-automation-runlog"]')).toBeVisible();
  });

  test('create workflow adds a row', async ({ page }) => {
    await page.click('[data-testid="ui2-automation-create-btn"]');
    const rows = page.locator('[data-testid="ui2-automation-wf-dt"] tbody tr');
    await expect(rows).toHaveCount(4);
  });
});

// ── v1.79: Export ───────────────────────────────────────────

test.describe('v1.79 — Export', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/export`);
    await page.waitForSelector('[data-testid="export-ready"]', { state: 'attached', timeout: 8000 });
  });

  test('page loads with ready marker', async ({ page }) => {
    await expect(page.locator('[data-testid="export-page"]')).toBeVisible();
    await expect(page.locator('[data-testid="export-ready"]')).toBeAttached();
  });

  test('shows export manifest table', async ({ page }) => {
    await expect(page.locator('[data-testid="ui2-export-autopilot-section"]')).toBeVisible();
    const rows = page.locator('[data-testid="ui2-export-manifest-dt"] tbody tr');
    await expect(rows).toHaveCount(3);
  });

  test('generate bundle creates output', async ({ page }) => {
    await page.click('[data-testid="ui2-export-generate-btn"]');
    await expect(page.locator('[data-testid="ui2-export-automation-section"]')).toBeVisible();
  });
});

// ── v1.80: Platform Health ──────────────────────────────────

test.describe('v1.80 — Platform Health', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/health`);
    await page.waitForSelector('[data-testid="platform-health-ready"]', { state: 'attached', timeout: 8000 });
  });

  test('page loads with ready marker', async ({ page }) => {
    await expect(page.locator('[data-testid="platform-health-page"]')).toBeVisible();
    await expect(page.locator('[data-testid="platform-health-ready"]')).toBeAttached();
  });

  test('shows health badge as healthy', async ({ page }) => {
    await expect(page.locator('[data-testid="ui2-health-badge"]')).toContainText('HEALTHY');
  });

  test('shows services grid', async ({ page }) => {
    await expect(page.locator('[data-testid="ui2-health-services"]')).toBeVisible();
    await expect(page.locator('[data-testid="ui2-health-service-autopilot_v2"]')).toBeVisible();
  });

  test('shows metrics section', async ({ page }) => {
    await expect(page.locator('[data-testid="ui2-health-metrics"]')).toBeVisible();
  });

  test('refresh button works', async ({ page }) => {
    await page.click('[data-testid="ui2-health-refresh-btn"]');
    await expect(page.locator('[data-testid="ui2-health-badge"]')).toContainText('HEALTHY');
  });

  test('shows platform info', async ({ page }) => {
    await expect(page.locator('[data-testid="ui2-health-info"]')).toBeVisible();
  });
});

// ── Navigation: Wave 8 workspaces appear in rail ────────────

test.describe('Wave 8 — Navigation', () => {
  test('autopilot-v2 workspace in left rail', async ({ page }) => {
    await page.goto(`${BASE}/dashboard`);
    await page.waitForSelector('[data-testid="ui2-center"]', { state: 'attached', timeout: 8000 });
    await expect(page.locator('[data-testid="ui2-rail-autopilot-v2"]')).toBeAttached();
  });

  test('automation-v2 workspace in left rail', async ({ page }) => {
    await page.goto(`${BASE}/dashboard`);
    await page.waitForSelector('[data-testid="ui2-center"]', { state: 'attached', timeout: 8000 });
    await expect(page.locator('[data-testid="ui2-rail-automation-v2"]')).toBeAttached();
  });

  test('export workspace in left rail', async ({ page }) => {
    await page.goto(`${BASE}/dashboard`);
    await page.waitForSelector('[data-testid="ui2-center"]', { state: 'attached', timeout: 8000 });
    await expect(page.locator('[data-testid="ui2-rail-export"]')).toBeAttached();
  });

  test('health workspace in left rail', async ({ page }) => {
    await page.goto(`${BASE}/dashboard`);
    await page.waitForSelector('[data-testid="ui2-center"]', { state: 'attached', timeout: 8000 });
    await expect(page.locator('[data-testid="ui2-rail-health"]')).toBeAttached();
  });

  test('click autopilot-v2 navigates to page', async ({ page }) => {
    await page.goto(`${BASE}/dashboard`);
    await page.waitForSelector('[data-testid="ui2-center"]', { state: 'attached', timeout: 8000 });
    await page.click('[data-testid="ui2-rail-autopilot-v2"]');
    await page.waitForSelector('[data-testid="autopilot-v2-ready"]', { state: 'attached', timeout: 8000 });
    await expect(page.locator('[data-testid="autopilot-v2-page"]')).toBeVisible();
  });
});
