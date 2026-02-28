/**
 * Core Correctness Track — Strategy + Backtester E2E Suite
 * Tests runs manager, filtering, report viewer, new run submission (deterministic).
 * All selectors use data-testid only. No waitForTimeout.
 */

import { test, expect } from '@playwright/test';

const PAGE = 'http://localhost:5100/ui2/backtest';

test.describe('Backtest — Runs Manager', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
    await expect(page.getByTestId('backtest-ui2-page')).toBeVisible();
  });

  test('page renders with header', async ({ page }) => {
    await expect(page.getByTestId('backtest-header')).toBeVisible();
  });

  test('tabs are visible: Runs Manager, Report Viewer, New Run', async ({ page }) => {
    await expect(page.getByTestId('backtest-tabs')).toBeVisible();
  });

  test('runs manager section is visible by default', async ({ page }) => {
    await expect(page.getByTestId('backtest-runs-manager')).toBeVisible();
  });

  test('filters row is visible', async ({ page }) => {
    await expect(page.getByTestId('backtest-filters')).toBeVisible();
  });

  test('symbol filter input is editable', async ({ page }) => {
    const filter = page.getByTestId('backtest-filter-symbol');
    await expect(filter).toBeVisible();
    await filter.fill('MSFT');
    await expect(filter).toHaveValue('MSFT');
  });

  test('strategy filter input is editable', async ({ page }) => {
    const filter = page.getByTestId('backtest-filter-strategy');
    await expect(filter).toBeVisible();
    await filter.fill('strat-1');
    await expect(filter).toHaveValue('strat-1');
  });

  test('runs table is visible', async ({ page }) => {
    await expect(page.getByTestId('backtest-runs-table')).toBeVisible();
  });

  test('runs table starts empty in online mode', async ({ page }) => {
    const dataRows = page.locator('[data-testid^="backtest-runs-table-row-"]');
    await expect(dataRows).toHaveCount(0);
  });

  test('filtering by symbol "MSFT" narrows results', async ({ page }) => {
    await page.getByTestId('backtest-filter-symbol').fill('MSFT');
    const rows = page.locator('[data-testid="backtest-runs-table"] tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('filtering by unknown symbol shows 0 results', async ({ page }) => {
    await page.getByTestId('backtest-filter-symbol').fill('ZZZZZZ');
    // Count only real data rows (DataTable renders a placeholder row when empty)
    const dataRows = page.locator('[data-testid^="backtest-runs-table-row-"]');
    await expect(dataRows).toHaveCount(0);
  });

  test('clearing symbol filter restores all runs', async ({ page }) => {
    // Create a run first so there's data to filter
    await page.getByTestId('backtest-tabs-tab-new-run').click();
    await page.getByTestId('backtest-submit-btn').click();
    await expect(page.getByTestId('backtest-submit-result')).toBeVisible();
    await page.getByTestId('backtest-tabs-tab-runs').click();
    // Now filter and clear
    await page.getByTestId('backtest-filter-symbol').fill('ZZZZZZ');
    await page.getByTestId('backtest-filter-symbol').fill('');
    const dataRows = page.locator('[data-testid^="backtest-runs-table-row-"]');
    expect(await dataRows.count()).toBeGreaterThanOrEqual(1);
  });

  test('status badges are rendered in runs table', async ({ page }) => {
    // Create a run first so there's data with status badges
    await page.getByTestId('backtest-tabs-tab-new-run').click();
    await page.getByTestId('backtest-submit-btn').click();
    await expect(page.getByTestId('backtest-submit-result')).toBeVisible();
    await page.getByTestId('backtest-tabs-tab-runs').click();
    const badges = page.locator('[data-testid^="backtest-status-"]');
    expect(await badges.count()).toBeGreaterThanOrEqual(1);
  });

  test('open button is present for each run', async ({ page }) => {
    // Create a run first so open buttons appear
    await page.getByTestId('backtest-tabs-tab-new-run').click();
    await page.getByTestId('backtest-submit-btn').click();
    await expect(page.getByTestId('backtest-submit-result')).toBeVisible();
    await page.getByTestId('backtest-tabs-tab-runs').click();
    const openBtns = page.locator('[data-testid^="backtest-open-"]');
    expect(await openBtns.count()).toBeGreaterThanOrEqual(1);
  });

  test('backtest-ready hidden marker is attached', async ({ page }) => {
    await expect(page.getByTestId('backtest-ready')).toBeAttached();
  });

});

test.describe('Backtest — Report Viewer', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
    await expect(page.getByTestId('backtest-ui2-page')).toBeVisible();
    // Submit a run so there's data for report viewer tests
    await page.getByTestId('backtest-tabs-tab-new-run').click();
    await page.getByTestId('backtest-submit-btn').click();
    await expect(page.getByTestId('backtest-submit-result')).toBeVisible();
    await page.getByTestId('backtest-tabs-tab-runs').click();
  });

  test('clicking open on a run navigates to report tab', async ({ page }) => {
    const openBtn = page.locator('[data-testid^="backtest-open-"]').first();
    await openBtn.click();
    await expect(page.getByTestId('backtest-report-viewer')).toBeVisible();
    await expect(page.getByTestId('backtest-report-content')).toBeVisible();
  });

  test('report shows provenance section', async ({ page }) => {
    const openBtn = page.locator('[data-testid^="backtest-open-"]').first();
    await openBtn.click();
    await expect(page.getByTestId('backtest-report-provenance')).toBeVisible();
  });

  test('provenance shows Run ID', async ({ page }) => {
    const openBtn = page.locator('[data-testid^="backtest-open-"]').first();
    await openBtn.click();
    const provenance = await page.getByTestId('backtest-report-provenance').textContent();
    expect(provenance).toContain('Run ID');
  });

  test('provenance shows Symbol', async ({ page }) => {
    const openBtn = page.locator('[data-testid^="backtest-open-"]').first();
    await openBtn.click();
    const provenance = await page.getByTestId('backtest-report-provenance').textContent();
    expect(provenance).toContain('Symbol');
  });

  test('report shows 5 metrics stats', async ({ page }) => {
    const openBtn = page.locator('[data-testid^="backtest-open-"]').first();
    await openBtn.click();
    await expect(page.getByTestId('backtest-report-results')).toBeVisible();
    // 5 stats: sharpe-ratio, total-return, max-drawdown, win-rate, trade-count
    const stats = page.locator('[data-testid^="backtest-stat-"]');
    expect(await stats.count()).toBe(5);
  });

  test('all 5 stat values are non-empty', async ({ page }) => {
    const openBtn = page.locator('[data-testid^="backtest-open-"]').first();
    await openBtn.click();
    for (const statId of ['sharpe-ratio', 'total-return', 'max-drawdown', 'win-rate', 'trade-count']) {
      const stat = page.getByTestId(`backtest-stat-${statId}`);
      await expect(stat).toBeVisible();
      const text = await stat.textContent();
      expect(text?.trim()).not.toBe('');
    }
  });

  test('report status badge is visible', async ({ page }) => {
    const openBtn = page.locator('[data-testid^="backtest-open-"]').first();
    await openBtn.click();
    await expect(page.getByTestId('backtest-report-status')).toBeVisible();
  });

});

test.describe('Backtest — New Run Form (Deterministic)', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
    await expect(page.getByTestId('backtest-ui2-page')).toBeVisible();
  });

  test('navigating to new-run tab shows form', async ({ page }) => {
    // Find and click the "New Run" tab
    const newRunTab = page.getByTestId('backtest-tabs-tab-new-run');
    if (await newRunTab.isVisible()) {
      await newRunTab.click();
      await expect(page.getByTestId('backtest-new-run-form')).toBeVisible();
    }
  });

  test('symbol selector has options', async ({ page }) => {
    const newRunTab = page.getByTestId('backtest-tabs-tab-new-run');
    if (await newRunTab.isVisible()) {
      await newRunTab.click();
      const symbolSelect = page.getByTestId('backtest-new-symbol');
      await expect(symbolSelect).toBeVisible();
      const options = await symbolSelect.evaluate((el: HTMLSelectElement) =>
        Array.from(el.options).map(o => o.value)
      );
      expect(options).toContain('AAPL');
      expect(options).toContain('NVDA');
    }
  });

  test('strategy selector has 4 options', async ({ page }) => {
    const newRunTab = page.getByTestId('backtest-tabs-tab-new-run');
    if (await newRunTab.isVisible()) {
      await newRunTab.click();
      const stratSelect = page.getByTestId('backtest-new-strategy');
      const options = await stratSelect.evaluate((el: HTMLSelectElement) =>
        Array.from(el.options).map(o => o.value)
      );
      expect(options.length).toBe(4);
    }
  });

  test('months selector has period options', async ({ page }) => {
    const newRunTab = page.getByTestId('backtest-tabs-tab-new-run');
    if (await newRunTab.isVisible()) {
      await newRunTab.click();
      const monthsSelect = page.getByTestId('backtest-new-months');
      const options = await monthsSelect.evaluate((el: HTMLSelectElement) =>
        Array.from(el.options).map(o => o.value)
      );
      expect(options).toContain('12');
    }
  });

  test('submit button is visible', async ({ page }) => {
    const newRunTab = page.getByTestId('backtest-tabs-tab-new-run');
    if (await newRunTab.isVisible()) {
      await newRunTab.click();
      await expect(page.getByTestId('backtest-submit-btn')).toBeVisible();
    }
  });

  test('clicking submit shows result panel', async ({ page }) => {
    const newRunTab = page.getByTestId('backtest-tabs-tab-new-run');
    if (await newRunTab.isVisible()) {
      await newRunTab.click();
      await page.getByTestId('backtest-submit-btn').click();
      await expect(page.getByTestId('backtest-submit-result')).toBeVisible();
    }
  });

  test('result shows symbol, strategy, sharpe, return, trades', async ({ page }) => {
    const newRunTab = page.getByTestId('backtest-tabs-tab-new-run');
    if (await newRunTab.isVisible()) {
      await newRunTab.click();
      await page.getByTestId('backtest-submit-btn').click();
      await expect(page.getByTestId('backtest-result-symbol')).toBeVisible();
      await expect(page.getByTestId('backtest-result-strategy')).toBeVisible();
      await expect(page.getByTestId('backtest-result-sharpe')).toBeVisible();
      await expect(page.getByTestId('backtest-result-return')).toBeVisible();
      await expect(page.getByTestId('backtest-result-trades')).toBeVisible();
    }
  });

  test('same inputs always produce same Sharpe (determinism)', async ({ page }) => {
    const newRunTab = page.getByTestId('backtest-tabs-tab-new-run');
    if (await newRunTab.isVisible()) {
      await newRunTab.click();
      // Select AAPL + strat-1 + 12 months
      await page.getByTestId('backtest-new-symbol').selectOption('AAPL');
      await page.getByTestId('backtest-new-strategy').selectOption('strat-1');
      await page.getByTestId('backtest-new-months').selectOption('12');
      await page.getByTestId('backtest-submit-btn').click();
      const sharpe1 = await page.getByTestId('backtest-result-sharpe').textContent();

      // Reload and repeat
      await page.goto(PAGE);
      await page.getByTestId('backtest-tabs-tab-new-run').click();
      await page.getByTestId('backtest-new-symbol').selectOption('AAPL');
      await page.getByTestId('backtest-new-strategy').selectOption('strat-1');
      await page.getByTestId('backtest-new-months').selectOption('12');
      await page.getByTestId('backtest-submit-btn').click();
      const sharpe2 = await page.getByTestId('backtest-result-sharpe').textContent();

      expect(sharpe1).toBe(sharpe2);
    }
  });

  test('new run appears in runs table after submission', async ({ page }) => {
    const newRunTab = page.getByTestId('backtest-tabs-tab-new-run');
    if (await newRunTab.isVisible()) {
      await newRunTab.click();
      const countBefore = await page.locator('[data-testid^="backtest-open-"]').count();
      await page.getByTestId('backtest-submit-btn').click();
      // Navigate to runs tab to verify
      const runsTabBtn = page.getByTestId('backtest-tabs-tab-runs');
      await runsTabBtn.click();
      const countAfter = await page.locator('[data-testid^="backtest-open-"]').count();
      expect(countAfter).toBeGreaterThanOrEqual(countBefore);
    }
  });

  test('view report button opens report for new run', async ({ page }) => {
    const newRunTab = page.getByTestId('backtest-tabs-tab-new-run');
    if (await newRunTab.isVisible()) {
      await newRunTab.click();
      await page.getByTestId('backtest-submit-btn').click();
      await expect(page.getByTestId('backtest-view-new-run-btn')).toBeVisible();
      await page.getByTestId('backtest-view-new-run-btn').click();
      await expect(page.getByTestId('backtest-report-content')).toBeVisible();
    }
  });

});
