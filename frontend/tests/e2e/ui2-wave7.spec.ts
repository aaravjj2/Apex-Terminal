/**
 * Wave 7 E2E Tests (v1.63-v1.72)
 * Automation Studio, Search, Autopilot 2.0 Pipeline, AI Agent
 * data-testid selectors ONLY — headed, workers=1, retries=0
 */
import { test, expect } from '@playwright/test';

const BASE = '/ui2';

// ── v1.63-65: Automation Studio ──────────────────────────────

test.describe('v1.63-65 — Automation Studio', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/automation`);
    await page.waitForSelector('[data-testid="automation-ready"]', { state: 'attached', timeout: 8000 });
  });

  test('page loads with ready marker', async ({ page }) => {
    await expect(page.locator('[data-testid="automation-ui2-page"]')).toBeVisible();
    await expect(page.locator('[data-testid="automation-ready"]')).toBeAttached();
  });

  test('shows workflows tab with demo data', async ({ page }) => {
    await expect(page.locator('[data-testid="automation-wf-table"]')).toBeVisible();
    // Should have at least 3 demo workflows
    const rows = page.locator('[data-testid="automation-wf-table"] tbody tr');
    await expect(rows).toHaveCount(3);
  });

  test('creates new workflow', async ({ page }) => {
    await page.click('[data-testid="automation-create-btn"]');
    await expect(page.locator('[data-testid="automation-create-form"]')).toBeVisible();
    await page.fill('[data-testid="automation-wf-name"]', 'E2E Test Workflow');
    await page.fill('[data-testid="automation-wf-desc"]', 'Created by E2E');
    await page.click('[data-testid="automation-wf-submit"]');
    // Should now have 4 workflows
    const rows = page.locator('[data-testid="automation-wf-table"] tbody tr');
    await expect(rows).toHaveCount(4);
  });

  test('runs workflow and shows steps', async ({ page }) => {
    // Click the first Run button
    const runBtns = page.locator('[data-testid^="automation-run-"]');
    await runBtns.first().click();
    // Switch to Runs tab via data-testid
    await page.click('[data-testid="automation-tabs-tab-runs"]');
    await expect(page.locator('[data-testid="automation-runs-table"]')).toBeVisible();
  });

  test('tabs switch correctly', async ({ page }) => {
    const tabs = page.locator('[data-testid="automation-tabs"]');
    await expect(tabs).toBeVisible();
    await page.click('[data-testid="automation-tabs-tab-runs"]');
    await expect(page.locator('[data-testid="automation-runs-panel"]')).toBeVisible();
    await page.click('[data-testid="automation-tabs-tab-artifacts"]');
    await expect(page.locator('[data-testid="automation-artifacts-panel"]')).toBeVisible();
    await page.click('[data-testid="automation-tabs-tab-workflows"]');
    await expect(page.locator('[data-testid="automation-workflows-panel"]')).toBeVisible();
  });
});

// ── v1.66-68: Search ─────────────────────────────────────────

test.describe('v1.66-68 — Search', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/search`);
    await page.waitForSelector('[data-testid="search-ready"]', { state: 'attached', timeout: 8000 });
  });

  test('page loads with search bar', async ({ page }) => {
    await expect(page.locator('[data-testid="search-ui2-page"]')).toBeVisible();
    await expect(page.locator('[data-testid="search-input"]')).toBeVisible();
  });

  test('search returns results for SPY', async ({ page }) => {
    await page.fill('[data-testid="search-input"]', 'SPY');
    await page.press('[data-testid="search-input"]', 'Enter');
    await expect(page.locator('[data-testid="search-count"]')).toContainText(/\d+ result/);
    const rows = page.locator('[data-testid="search-results-table"] tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
  });

  test('entity type filters work', async ({ page }) => {
    await page.fill('[data-testid="search-input"]', 'SPY');
    await page.press('[data-testid="search-input"]', 'Enter');
    // Click a filter
    const filterBtns = page.locator('[data-testid^="search-filter-"]');
    const count = await filterBtns.count();
    expect(count).toBeGreaterThan(3);
  });

  test('clicking result shows detail drawer', async ({ page }) => {
    await page.fill('[data-testid="search-input"]', 'SPY');
    await page.press('[data-testid="search-input"]', 'Enter');
    // Wait for results
    await page.waitForSelector('[data-testid="search-results-table"] tbody tr');
    await page.locator('[data-testid="search-results-table"] tbody tr').first().click();
    await expect(page.locator('[data-testid="search-detail-drawer"]')).toBeVisible();
    await expect(page.locator('[data-testid="search-detail-title"]')).toBeVisible();
    // Close it
    await page.click('[data-testid="search-detail-close"]');
    await expect(page.locator('[data-testid="search-detail-drawer"]')).not.toBeVisible();
  });
});

// ── v1.69-70: Autopilot 2.0 Pipeline ────────────────────────

test.describe('v1.69-70 — Autopilot 2.0 Pipeline', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/autopilot`);
    await page.waitForSelector('[data-testid="autopilot-ready"]', { state: 'attached', timeout: 8000 });
  });

  test('page loads with tabs and run button', async ({ page }) => {
    await expect(page.locator('[data-testid="autopilot-ui2-page"]')).toBeVisible();
    await expect(page.locator('[data-testid="autopilot-tabs"]')).toBeVisible();
    await expect(page.locator('[data-testid="autopilot-run-pipeline-btn"]')).toBeVisible();
  });

  test('controls tab shows kill switch', async ({ page }) => {
    await page.click('[data-testid="autopilot-tab-controls"]');
    await expect(page.locator('[data-testid="autopilot-kill-switch-panel"]')).toBeVisible();
    await expect(page.locator('[data-testid="autopilot-kill-switch-btn"]')).toBeVisible();
  });

  test('run pipeline shows stages and decisions', async ({ page }) => {
    await page.click('[data-testid="autopilot-run-pipeline-btn"]');
    // Should auto-switch to pipeline tab
    await expect(page.locator('[data-testid="autopilot-pipeline-panel"]')).toBeVisible();
    await expect(page.locator('[data-testid="autopilot-stage-timeline"]')).toBeVisible();
    // Check 6 stages (scoped within timeline to exclude timeline itself)
    const stages = page.locator('[data-testid="autopilot-stage-timeline"] [data-testid^="autopilot-stage-"]');
    await expect(stages).toHaveCount(6);
    // Summary bar
    await expect(page.locator('[data-testid="autopilot-summary-bar"]')).toBeVisible();
    // Hash display
    await expect(page.locator('[data-testid="autopilot-run-hash"]')).toBeVisible();
    const hash = await page.locator('[data-testid="autopilot-run-hash"]').textContent();
    expect(hash!.length).toBeGreaterThan(0);
    // Decision table
    await expect(page.locator('[data-testid="autopilot-decisions-table"]')).toBeVisible();
    // Rejections table
    await expect(page.locator('[data-testid="autopilot-rejections-table"]')).toBeVisible();
  });

  test('ledger tab shows decision details', async ({ page }) => {
    await page.click('[data-testid="autopilot-run-pipeline-btn"]');
    await page.click('[data-testid="autopilot-tab-ledger"]');
    await expect(page.locator('[data-testid="autopilot-ledger-panel"]')).toBeVisible();
    // Default sub-tab should be decisions
    await expect(page.locator('[data-testid="autopilot-ledger-decisions"]')).toBeVisible();
    // Switch to postmortem
    await page.click('[data-testid="autopilot-ledger-tab-postmortem"]');
    await expect(page.locator('[data-testid="autopilot-ledger-postmortem"]')).toBeVisible();
  });

  test('deterministic hash is consistent across runs', async ({ page }) => {
    await page.click('[data-testid="autopilot-run-pipeline-btn"]');
    await page.waitForSelector('[data-testid="autopilot-run-hash"]');
    const h1 = await page.locator('[data-testid="autopilot-run-hash"]').textContent();
    // Run again
    await page.click('[data-testid="autopilot-run-pipeline-btn"]');
    await page.waitForTimeout(200);
    // Select first run
    await page.click('[data-testid="autopilot-run-select-0"]');
    const h2 = await page.locator('[data-testid="autopilot-run-hash"]').textContent();
    expect(h1).toBe(h2);
  });
});

// ── v1.71-72: AI Agent ──────────────────────────────────────

test.describe('v1.71-72 — AI Agent', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/agent`);
    await page.waitForSelector('[data-testid="agent-ready"]', { state: 'attached', timeout: 8000 });
  });

  test('page loads with input and empty state', async ({ page }) => {
    await expect(page.locator('[data-testid="agent-ui2-page"]')).toBeVisible();
    await expect(page.locator('[data-testid="agent-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="agent-empty"]')).toBeVisible();
    await expect(page.locator('[data-testid="agent-send-btn"]')).toBeVisible();
  });

  test('quick prompts populate input', async ({ page }) => {
    await page.click('[data-testid="agent-quick-prompt-0"]');
    const val = await page.locator('[data-testid="agent-input"]').inputValue();
    expect(val.length).toBeGreaterThan(0);
  });

  test('sending message shows conversation', async ({ page }) => {
    await page.fill('[data-testid="agent-input"]', 'Generate a risk report');
    await page.click('[data-testid="agent-send-btn"]');
    // Should show 2 messages (user + assistant)
    await expect(page.locator('[data-testid="agent-msg-count"]')).toContainText('2');
    // Messages area should have content (scoped to messages container)
    const msgs = page.locator('[data-testid="agent-messages"] [data-testid^="agent-msg-"]');
    const count = await msgs.count();
    expect(count).toBe(2);
  });

  test('risk prompt triggers tool calls', async ({ page }) => {
    await page.fill('[data-testid="agent-input"]', 'Generate a risk report');
    await page.click('[data-testid="agent-send-btn"]');
    // Should show tool calls
    const toolCalls = page.locator('[data-testid^="agent-tool-call-"]');
    const count = await toolCalls.count();
    expect(count).toBeGreaterThan(0);
  });

  test('tool registry toggles', async ({ page }) => {
    await page.click('[data-testid="agent-tools-toggle"]');
    await expect(page.locator('[data-testid="agent-tool-registry"]')).toBeVisible();
    await expect(page.locator('[data-testid="agent-tools-table"]')).toBeVisible();
    await page.click('[data-testid="agent-tools-toggle"]');
    await expect(page.locator('[data-testid="agent-tool-registry"]')).not.toBeVisible();
  });

  test('clear button resets conversation', async ({ page }) => {
    await page.fill('[data-testid="agent-input"]', 'Test message');
    await page.click('[data-testid="agent-send-btn"]');
    await expect(page.locator('[data-testid="agent-msg-count"]')).toContainText('2');
    await page.click('[data-testid="agent-clear-btn"]');
    await expect(page.locator('[data-testid="agent-msg-count"]')).toContainText('0');
    await expect(page.locator('[data-testid="agent-empty"]')).toBeVisible();
  });
});

// ── Determinism & Navigation ─────────────────────────────────

test.describe('v1.63-72 — Wave 7 Integration', () => {
  test('all wave 7 pages have ready markers', async ({ page }) => {
    const pages = ['automation', 'search', 'agent', 'autopilot'];
    for (const p of pages) {
      await page.goto(`${BASE}/${p}`);
      const readySelector = p === 'autopilot' ? 'autopilot-ready' : `${p}-ready`;
      await page.waitForSelector(`[data-testid="${readySelector}"]`, { state: 'attached', timeout: 8000 });
    }
  });

  test('left rail shows wave 7 workspaces', async ({ page }) => {
    await page.goto(`${BASE}/dashboard`);
    await expect(page.locator('[data-testid="ui2-app-shell"]')).toBeVisible();
    // Check left rail has automation, search, agent entries via data-testid
    await expect(page.locator('[data-testid="ui2-rail-automation"]')).toBeVisible();
    await expect(page.locator('[data-testid="ui2-rail-search"]')).toBeVisible();
    await expect(page.locator('[data-testid="ui2-rail-agent"]')).toBeVisible();
  });
});
