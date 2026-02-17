/**
 * Wave 15/17/18 E2E Tests
 * UI2: Search V2, AI Provider Status, Decision Explainer V2, NL Workflow
 * data-testid selectors ONLY — headed, workers=1, retries=0
 */
import { test, expect } from '@playwright/test';

const BASE = '/ui2';

// ── Wave 15: Search V2 ─────────────────────────────────────

test.describe('v1.148 — Search V2', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/search`);
    await page.waitForSelector('[data-testid="search-ui2-page"][data-ready="true"]', { state: 'attached', timeout: 8000 });
  });

  test('page loads with ready marker', async ({ page }) => {
    await expect(page.locator('[data-testid="search-ui2-page"]')).toBeVisible();
    await expect(page.locator('[data-testid="search-ui2-page"]')).toHaveAttribute('data-ready', 'true');
  });

  test('shows search input', async ({ page }) => {
    await expect(page.locator('[data-testid="search-input"]')).toBeVisible();
  });

  test('shows filter chips', async ({ page }) => {
    const chips = page.locator('[data-testid^="search-filter-"]');
    const count = await chips.count();
    expect(count).toBeGreaterThanOrEqual(5);
  });

  test('search button triggers search', async ({ page }) => {
    await page.locator('[data-testid="search-input"]').fill('AAPL');
    await page.locator('[data-testid="search-button"]').click();
    // Results panel should appear
    const panel = page.locator('[data-testid="search-results-panel"]');
    await expect(panel).toBeVisible();
  });

  test('recent searches dropdown opens', async ({ page }) => {
    // Focus the empty input to trigger recent searches dropdown
    await page.locator('[data-testid="search-input"]').focus();
    // dropdown appears when input is focused with empty query
    await expect(page.locator('[data-testid="search-recent-dropdown"]')).toBeVisible({ timeout: 5000 });
    const items = page.locator('[data-testid^="search-recent-item-"]');
    const count = await items.count();
    expect(count).toBeGreaterThan(0);
  });

  test('symbol filter input exists', async ({ page }) => {
    await expect(page.locator('[data-testid="search-symbol-filter"]')).toBeVisible();
  });
});

// ── Wave 17: AI Provider Status ─────────────────────────────

test.describe('v1.150 — AI Provider Status', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/ai-provider`);
    await page.waitForSelector('[data-testid="ui2-ai-provider-page"][data-ready="true"]', { state: 'attached', timeout: 8000 });
  });

  test('page loads with ready marker', async ({ page }) => {
    await expect(page.locator('[data-testid="ui2-ai-provider-page"]')).toBeVisible();
    await expect(page.locator('[data-testid="ui2-ai-provider-page"]')).toHaveAttribute('data-ready', 'true');
  });

  test('shows header', async ({ page }) => {
    await expect(page.locator('[data-testid="ui2-ai-provider-header"]')).toBeVisible();
  });

  test('shows provider info', async ({ page }) => {
    await expect(page.locator('[data-testid="ui2-ai-provider-info"]')).toBeVisible();
    await expect(page.locator('[data-testid="ui2-ai-provider-active"]')).toBeVisible();
    await expect(page.locator('[data-testid="ui2-ai-provider-nova"]')).toBeVisible();
  });

  test('shows budget panel with bar', async ({ page }) => {
    await expect(page.locator('[data-testid="ui2-ai-budget-panel"]')).toBeVisible();
    await expect(page.locator('[data-testid="ui2-ai-budget-remaining"]')).toBeVisible();
    await expect(page.locator('[data-testid="ui2-ai-budget-bar"]')).toBeVisible();
  });

  test('shows cache panel', async ({ page }) => {
    await expect(page.locator('[data-testid="ui2-ai-cache-panel"]')).toBeVisible();
    await expect(page.locator('[data-testid="ui2-ai-cache-entries"]')).toBeVisible();
  });

  test('shows rate limit panel', async ({ page }) => {
    await expect(page.locator('[data-testid="ui2-ai-rate-panel"]')).toBeVisible();
    await expect(page.locator('[data-testid="ui2-ai-rate-remaining"]')).toBeVisible();
  });

  test('shows replay panel with entries', async ({ page }) => {
    await expect(page.locator('[data-testid="ui2-ai-replay-panel"]')).toBeVisible();
    const entries = page.locator('[data-testid^="ui2-ai-replay-entry-"]');
    const count = await entries.count();
    expect(count).toBeGreaterThan(0);
  });

  test('budget reset button exists', async ({ page }) => {
    await expect(page.locator('[data-testid="ui2-ai-budget-reset-btn"]')).toBeVisible();
  });

  test('cache clear button exists', async ({ page }) => {
    await expect(page.locator('[data-testid="ui2-ai-cache-clear-btn"]')).toBeVisible();
  });
});

// ── Wave 18: Decision Explainer V2 ──────────────────────────

test.describe('v1.155 — Decision Explainer V2', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/decision-explainer`);
    await page.waitForSelector('[data-testid="ui2-decision-explainer-v2-page"][data-ready="true"]', { state: 'attached', timeout: 8000 });
  });

  test('page loads with ready marker', async ({ page }) => {
    await expect(page.locator('[data-testid="ui2-decision-explainer-v2-page"]')).toBeVisible();
    await expect(page.locator('[data-testid="ui2-decision-explainer-v2-page"]')).toHaveAttribute('data-ready', 'true');
  });

  test('shows header', async ({ page }) => {
    await expect(page.locator('[data-testid="ui2-decision-explainer-v2-header"]')).toBeVisible();
  });

  test('shows 4 decision rows', async ({ page }) => {
    const rows = page.locator('[data-testid^="ui2-dec-v2-row-"]');
    const count = await rows.count();
    expect(count).toBe(4);
  });

  test('clicking a decision opens detail panel', async ({ page }) => {
    await page.locator('[data-testid^="ui2-dec-v2-row-"]').first().click();
    await expect(page.locator('[data-testid="ui2-decision-v2-detail"]')).toBeVisible();
  });

  test('detail panel shows confidence and explanation', async ({ page }) => {
    await page.locator('[data-testid^="ui2-dec-v2-row-"]').first().click();
    await expect(page.locator('[data-testid="ui2-dec-v2-confidence"]')).toBeVisible();
    await expect(page.locator('[data-testid="ui2-dec-v2-explanation"]')).toBeVisible();
  });

  test('detail panel shows attribution tab by default', async ({ page }) => {
    await page.locator('[data-testid^="ui2-dec-v2-row-"]').first().click();
    await expect(page.locator('[data-testid="ui2-dec-v2-attribution-panel"]')).toBeVisible();
  });

  test('switching to confidence tab shows confidence panel', async ({ page }) => {
    await page.locator('[data-testid^="ui2-dec-v2-row-"]').first().click();
    await page.locator('[data-testid="ui2-dec-v2-tab-confidence"]').click();
    await expect(page.locator('[data-testid="ui2-dec-v2-confidence-panel"]')).toBeVisible();
  });

  test('switching to post-trade tab shows content', async ({ page }) => {
    await page.locator('[data-testid^="ui2-dec-v2-row-"]').first().click();
    await page.locator('[data-testid="ui2-dec-v2-tab-post-trade"]').click();
    await expect(page.locator('[data-testid="ui2-dec-v2-post-trade-panel"]')).toBeVisible();
  });

  test('risk evaluation section visible', async ({ page }) => {
    await page.locator('[data-testid^="ui2-dec-v2-row-"]').first().click();
    await expect(page.locator('[data-testid="ui2-dec-v2-risk-eval"]')).toBeVisible();
  });
});

// ── Wave 18: NL Workflow Generator ──────────────────────────

test.describe('v1.159 — NL Workflow Generator', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/nl-workflow`);
    await page.waitForSelector('[data-testid="ui2-nl-workflow-page"][data-ready="true"]', { state: 'attached', timeout: 8000 });
  });

  test('page loads with ready marker', async ({ page }) => {
    await expect(page.locator('[data-testid="ui2-nl-workflow-page"]')).toBeVisible();
    await expect(page.locator('[data-testid="ui2-nl-workflow-page"]')).toHaveAttribute('data-ready', 'true');
  });

  test('shows header', async ({ page }) => {
    await expect(page.locator('[data-testid="ui2-nl-workflow-header"]')).toBeVisible();
  });

  test('shows prompt input and generate button', async ({ page }) => {
    await expect(page.locator('[data-testid="ui2-nl-prompt-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="ui2-nl-generate-btn"]')).toBeVisible();
  });

  test('shows example prompt buttons', async ({ page }) => {
    const examples = page.locator('[data-testid^="ui2-nl-example-"]');
    const count = await examples.count();
    expect(count).toBe(3);
  });

  test('clicking example populates input', async ({ page }) => {
    await page.locator('[data-testid="ui2-nl-example-0"]').click();
    const value = await page.locator('[data-testid="ui2-nl-prompt-input"]').inputValue();
    expect(value.length).toBeGreaterThan(0);
  });

  test('generate button creates workflow result', async ({ page }) => {
    await page.locator('[data-testid="ui2-nl-prompt-input"]').fill('Create a daily report export workflow');
    await page.locator('[data-testid="ui2-nl-generate-btn"]').click();
    await expect(page.locator('[data-testid="ui2-nl-workflow-result"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="ui2-nl-wf-name"]')).toBeVisible();
  });

  test('validate button shows validation result', async ({ page }) => {
    await page.locator('[data-testid="ui2-nl-prompt-input"]').fill('Create a daily report export workflow');
    await page.locator('[data-testid="ui2-nl-generate-btn"]').click();
    await expect(page.locator('[data-testid="ui2-nl-workflow-result"]')).toBeVisible({ timeout: 5000 });
    await page.locator('[data-testid="ui2-nl-validate-btn"]').click();
    await expect(page.locator('[data-testid="ui2-nl-validation-result"]')).toBeVisible({ timeout: 5000 });
  });

  test('simulate button shows simulation result', async ({ page }) => {
    await page.locator('[data-testid="ui2-nl-prompt-input"]').fill('Create a daily report export workflow');
    await page.locator('[data-testid="ui2-nl-generate-btn"]').click();
    await expect(page.locator('[data-testid="ui2-nl-workflow-result"]')).toBeVisible({ timeout: 5000 });
    await page.locator('[data-testid="ui2-nl-simulate-btn"]').click();
    await expect(page.locator('[data-testid="ui2-nl-simulation-result"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="ui2-nl-sim-status"]')).toBeVisible();
  });

  test('clear button removes workflow', async ({ page }) => {
    await page.locator('[data-testid="ui2-nl-prompt-input"]').fill('daily export');
    await page.locator('[data-testid="ui2-nl-generate-btn"]').click();
    await expect(page.locator('[data-testid="ui2-nl-workflow-result"]')).toBeVisible({ timeout: 5000 });
    await page.locator('[data-testid="ui2-nl-clear-btn"]').click();
    await expect(page.locator('[data-testid="ui2-nl-workflow-result"]')).not.toBeVisible();
  });
});
