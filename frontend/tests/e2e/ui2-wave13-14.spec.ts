/**
 * Wave 13-14 E2E Tests (v1.123-v1.142)
 * UI2: Automation Runs, Workflow Builder, Incidents, Decision Explorer, Health V4
 * data-testid selectors ONLY — headed, workers=1, retries=0
 */
import { test, expect } from '@playwright/test';

const BASE = '/ui2';

// ── v1.123: Automation Runs ─────────────────────────────────

test.describe('v1.123 — Automation Runs', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/automation-runs`);
    await page.waitForSelector('[data-testid="ui2-automation-runs-page"][data-ready="true"]', { state: 'attached', timeout: 8000 });
  });

  test('page loads with ready marker', async ({ page }) => {
    await expect(page.locator('[data-testid="ui2-automation-runs-page"]')).toBeVisible();
    await expect(page.locator('[data-testid="ui2-automation-runs-page"]')).toHaveAttribute('data-ready', 'true');
  });

  test('shows header', async ({ page }) => {
    await expect(page.locator('[data-testid="ui2-automation-runs-header"]')).toBeVisible();
  });

  test('shows runs list with demo data', async ({ page }) => {
    await expect(page.locator('[data-testid="ui2-automation-runs-list"]')).toBeVisible();
    const rows = page.locator('[data-testid^="ui2-automation-run-row-"]');
    const count = await rows.count();
    expect(count).toBe(3);
  });

  test('clicking a run opens detail drawer', async ({ page }) => {
    await page.locator('[data-testid="ui2-automation-run-row-run-demo-001"]').click();
    await expect(page.locator('[data-testid="ui2-automation-run-detail"]')).toBeVisible();
    await expect(page.locator('[data-testid="ui2-automation-run-steps"]')).toBeVisible();
    await expect(page.locator('[data-testid="ui2-automation-run-logs"]')).toBeVisible();
  });
});

// ── v1.124-125: Workflow Builder ────────────────────────────

test.describe('v1.124-125 — Workflow Builder', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/workflow-builder`);
    await page.waitForSelector('[data-testid="ui2-workflow-builder-page"][data-ready="true"]', { state: 'attached', timeout: 8000 });
  });

  test('page loads with ready marker', async ({ page }) => {
    await expect(page.locator('[data-testid="ui2-workflow-builder-page"]')).toBeVisible();
    await expect(page.locator('[data-testid="ui2-workflow-builder-page"]')).toHaveAttribute('data-ready', 'true');
  });

  test('shows header and create button', async ({ page }) => {
    await expect(page.locator('[data-testid="ui2-workflow-builder-header"]')).toBeVisible();
    await expect(page.locator('[data-testid="ui2-workflow-create-btn"]')).toBeVisible();
  });

  test('shows demo workflows in list', async ({ page }) => {
    await expect(page.locator('[data-testid="ui2-workflow-list"]')).toBeVisible();
    const items = page.locator('[data-testid^="ui2-workflow-item-"]');
    const count = await items.count();
    expect(count).toBe(2);
  });

  test('clicking new workflow shows form', async ({ page }) => {
    await page.locator('[data-testid="ui2-workflow-create-btn"]').click();
    await expect(page.locator('[data-testid="ui2-workflow-form"]')).toBeVisible();
    await expect(page.locator('[data-testid="ui2-workflow-name-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="ui2-workflow-trigger-select"]')).toBeVisible();
  });

  test('templates tab shows templates', async ({ page }) => {
    await page.locator('[data-testid="ui2-workflow-tab-templates"]').click();
    await expect(page.locator('[data-testid="ui2-workflow-templates-list"]')).toBeVisible();
    const templates = page.locator('[data-testid^="ui2-workflow-template-"]');
    const count = await templates.count();
    expect(count).toBe(3);
  });

  test('import tab shows textarea', async ({ page }) => {
    await page.locator('[data-testid="ui2-workflow-tab-import"]').click();
    await expect(page.locator('[data-testid="ui2-workflow-import-section"]')).toBeVisible();
    await expect(page.locator('[data-testid="ui2-workflow-import-textarea"]')).toBeVisible();
  });
});

// ── v1.128: Incidents ───────────────────────────────────────

test.describe('v1.128 — Incidents', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/incidents`);
    await page.waitForSelector('[data-testid="ui2-incidents-page"][data-ready="true"]', { state: 'attached', timeout: 8000 });
  });

  test('page loads with ready marker', async ({ page }) => {
    await expect(page.locator('[data-testid="ui2-incidents-page"]')).toBeVisible();
    await expect(page.locator('[data-testid="ui2-incidents-page"]')).toHaveAttribute('data-ready', 'true');
  });

  test('shows header and create button', async ({ page }) => {
    await expect(page.locator('[data-testid="ui2-incidents-header"]')).toBeVisible();
    await expect(page.locator('[data-testid="ui2-incidents-create-btn"]')).toBeVisible();
  });

  test('shows demo incidents', async ({ page }) => {
    await expect(page.locator('[data-testid="ui2-incidents-list"]')).toBeVisible();
    const rows = page.locator('[data-testid^="ui2-incident-row-"]');
    const count = await rows.count();
    expect(count).toBe(2);
  });

  test('clicking incident opens detail drawer', async ({ page }) => {
    await page.locator('[data-testid="ui2-incident-row-inc-demo-001"]').click();
    await expect(page.locator('[data-testid="ui2-incident-detail"]')).toBeVisible();
    await expect(page.locator('[data-testid="ui2-incident-detail-title"]')).toBeVisible();
    await expect(page.locator('[data-testid="ui2-incident-detail-description"]')).toBeVisible();
  });

  test('create form opens on button click', async ({ page }) => {
    await page.locator('[data-testid="ui2-incidents-create-btn"]').click();
    await expect(page.locator('[data-testid="ui2-incidents-create-form"]')).toBeVisible();
    await expect(page.locator('[data-testid="ui2-incidents-title-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="ui2-incidents-severity-select"]')).toBeVisible();
  });
});

// ── v1.130+v1.137: Decision Explorer ────────────────────────

test.describe('v1.130+v1.137 — Decision Explorer', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/decisions`);
    await page.waitForSelector('[data-testid="ui2-decision-explorer-page"][data-ready="true"]', { state: 'attached', timeout: 8000 });
  });

  test('page loads with ready marker', async ({ page }) => {
    await expect(page.locator('[data-testid="ui2-decision-explorer-page"]')).toBeVisible();
    await expect(page.locator('[data-testid="ui2-decision-explorer-page"]')).toHaveAttribute('data-ready', 'true');
  });

  test('shows header', async ({ page }) => {
    await expect(page.locator('[data-testid="ui2-decision-explorer-header"]')).toBeVisible();
  });

  test('shows 4 demo decisions', async ({ page }) => {
    await expect(page.locator('[data-testid="ui2-decision-list"]')).toBeVisible();
    const rows = page.locator('[data-testid^="ui2-decision-row-"]');
    const count = await rows.count();
    expect(count).toBe(4);
  });

  test('clicking decision opens detail with features + risk + portfolio impact', async ({ page }) => {
    await page.locator('[data-testid="ui2-decision-row-dec-001"]').click();
    await expect(page.locator('[data-testid="ui2-decision-detail"]')).toBeVisible();
    await expect(page.locator('[data-testid="ui2-decision-detail-symbol"]')).toBeVisible();
    await expect(page.locator('[data-testid="ui2-decision-detail-features"]')).toBeVisible();
    await expect(page.locator('[data-testid="ui2-decision-detail-risk"]')).toBeVisible();
    await expect(page.locator('[data-testid="ui2-decision-detail-portfolio-impact"]')).toBeVisible();
    await expect(page.locator('[data-testid="ui2-decision-detail-explanation"]')).toBeVisible();
  });
});

// ── v1.139: Platform Health V4 ──────────────────────────────

test.describe('v1.139 — Platform Health V4', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/health-v4`);
    await page.waitForSelector('[data-testid="ui2-platform-health-v4-page"][data-ready="true"]', { state: 'attached', timeout: 8000 });
  });

  test('page loads with ready marker', async ({ page }) => {
    await expect(page.locator('[data-testid="ui2-platform-health-v4-page"]')).toBeVisible();
    await expect(page.locator('[data-testid="ui2-platform-health-v4-page"]')).toHaveAttribute('data-ready', 'true');
  });

  test('shows header', async ({ page }) => {
    await expect(page.locator('[data-testid="ui2-platform-health-v4-header"]')).toBeVisible();
  });

  test('shows overall health banner', async ({ page }) => {
    await expect(page.locator('[data-testid="ui2-platform-health-v4-overall"]')).toBeVisible();
  });

  test('shows subsystem grid with 8 subsystems', async ({ page }) => {
    await expect(page.locator('[data-testid="ui2-platform-health-v4-grid"]')).toBeVisible();
    const subsystems = page.locator('[data-testid^="ui2-health-subsystem-"]');
    const count = await subsystems.count();
    expect(count).toBe(8);
  });

  test('shows individual subsystem cards', async ({ page }) => {
    await expect(page.locator('[data-testid="ui2-health-subsystem-websocket"]')).toBeVisible();
    await expect(page.locator('[data-testid="ui2-health-subsystem-trading"]')).toBeVisible();
    await expect(page.locator('[data-testid="ui2-health-subsystem-automation"]')).toBeVisible();
  });
});
