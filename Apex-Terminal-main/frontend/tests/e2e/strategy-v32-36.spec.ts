/**
 * Strategy Lab v1.32-v1.36 E2E Suite
 *
 * v1.32: Export Bundle Enrichment — manifest + spec/validation in exports
 * v1.33: UI Polish — skeletons, banners, empty states, +visual checkpoints
 * v1.34: Migration Guards — warning banner for old schema versions
 * v1.35: Library Filter / Sort — tag input, type select, sort controls
 * v1.36: Hash Ledger — chained hash display
 */

import { test, expect, Page } from '@playwright/test';
import {
  enableDeterministicMode,
  waitForAppReady,
  takeStableSnapshot,
} from './helpers';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5100';

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

async function goToStrategyLab(page: Page) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await enableDeterministicMode(page);
  await waitForAppReady(page);

  // Navigate: Options → Strategy Lab
  await page.getByTestId('nav-item-options').click();
  await expect(page.getByTestId('options-main-tab-strategy-lab')).toBeVisible({ timeout: 8000 });
  await page.getByTestId('options-main-tab-strategy-lab').click();
  await expect(page.getByTestId('strategy-lab-panel')).toBeVisible({ timeout: 8000 });
}

/* ------------------------------------------------------------------ */
/* v1.33: UI Polish — Banners, Skeletons, Empty States                */
/* ------------------------------------------------------------------ */

test.describe('v1.33 — Strategy Lab UI Polish', () => {
  test.beforeEach(async ({ page }) => {
    await goToStrategyLab(page);
  });

  test('CP01: Builder tab shows ready banner', async ({ page }) => {
    await expect(page.getByTestId('strategy-lab-tab-builder')).toBeVisible();
    await page.getByTestId('strategy-lab-tab-builder').click();
    await expect(page.getByTestId('strategy-builder-ready')).toBeVisible();
    // v1.33: ready banner should appear
    await expect(page.getByTestId('builder-status-ready')).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: 'e2e-results/v33-01-builder-ready-banner.png', fullPage: true });
  });

  test('CP02: Library tab shows count banner', async ({ page }) => {
    await page.getByTestId('strategy-lab-tab-library').click();
    await expect(page.getByTestId('strategy-library-ready')).toBeVisible();
    await expect(page.getByTestId('library-count-banner')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('library-toolbar')).toBeVisible();
    await page.screenshot({ path: 'e2e-results/v33-02-library-count-banner.png', fullPage: true });
  });

  test('CP03: Validate tab shows info banner', async ({ page }) => {
    await page.getByTestId('strategy-lab-tab-validate').click();
    await expect(page.getByTestId('strategy-validate-ready')).toBeVisible();
    await expect(page.getByTestId('validate-status-banner')).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: 'e2e-results/v33-03-validate-info-banner.png', fullPage: true });
  });

  test('CP04: Builder shows JSON preview with testid', async ({ page }) => {
    await page.getByTestId('strategy-lab-tab-builder').click();
    await expect(page.getByTestId('strategy-json-preview')).toBeVisible();
    await page.screenshot({ path: 'e2e-results/v33-04-builder-json-preview.png', fullPage: true });
  });

  test('CP05: Library table renders strategy items', async ({ page }) => {
    await page.getByTestId('strategy-lab-tab-library').click();
    await expect(page.getByTestId('strategy-library-table')).toBeVisible();
    await expect(page.getByTestId('library-item-0')).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: 'e2e-results/v33-05-library-items.png', fullPage: true });
  });

  test('CP06: Validate JSON with valid input', async ({ page }) => {
    await page.getByTestId('strategy-lab-tab-validate').click();
    await page.getByTestId('strategy-json-input').fill('{"name":"test","strategy_type":"crossover"}');
    await page.getByTestId('strategy-validation-run').click();
    await expect(page.getByTestId('validate-result')).toBeVisible();
    await page.screenshot({ path: 'e2e-results/v33-06-validate-result.png', fullPage: true });
  });

  test('CP07: Validate JSON with invalid input', async ({ page }) => {
    await page.getByTestId('strategy-lab-tab-validate').click();
    await page.getByTestId('strategy-json-input').fill('not valid json');
    await page.getByTestId('strategy-validation-run').click();
    await expect(page.getByTestId('validate-result')).toBeVisible();
    await expect(page.getByTestId('validate-result')).toContainText('Error');
    await page.screenshot({ path: 'e2e-results/v33-07-validate-error.png', fullPage: true });
  });

  test('CP08: Strategy name input is editable', async ({ page }) => {
    await page.getByTestId('strategy-lab-tab-builder').click();
    const nameInput = page.getByTestId('strategy-name-input');
    await nameInput.fill('E2E Test Strategy');
    await expect(nameInput).toHaveValue('E2E Test Strategy');
    await page.screenshot({ path: 'e2e-results/v33-08-name-input.png', fullPage: true });
  });

  test('CP09: Strategy type select works', async ({ page }) => {
    await page.getByTestId('strategy-lab-tab-builder').click();
    const typeSelect = page.getByTestId('strategy-type-select');
    await typeSelect.selectOption('mean_reversion');
    await expect(typeSelect).toHaveValue('mean_reversion');
    await page.screenshot({ path: 'e2e-results/v33-09-type-select.png', fullPage: true });
  });

  test('CP10: Tab switching between all three tabs', async ({ page }) => {
    // Builder → Library → Validate → Builder
    await page.getByTestId('strategy-lab-tab-builder').click();
    await expect(page.getByTestId('strategy-builder-ready')).toBeVisible();

    await page.getByTestId('strategy-lab-tab-library').click();
    await expect(page.getByTestId('strategy-library-ready')).toBeVisible();

    await page.getByTestId('strategy-lab-tab-validate').click();
    await expect(page.getByTestId('strategy-validate-ready')).toBeVisible();

    await page.getByTestId('strategy-lab-tab-builder').click();
    await expect(page.getByTestId('strategy-builder-ready')).toBeVisible();
    await page.screenshot({ path: 'e2e-results/v33-10-tab-switching.png', fullPage: true });
  });
});

/* ------------------------------------------------------------------ */
/* v1.35: Library Filter / Sort                                       */
/* ------------------------------------------------------------------ */

test.describe('v1.35 — Strategy Library Filter / Sort', () => {
  test.beforeEach(async ({ page }) => {
    await goToStrategyLab(page);
    await page.getByTestId('strategy-lab-tab-library').click();
    await expect(page.getByTestId('strategy-library-ready')).toBeVisible();
  });

  test('filter toggle shows filter panel', async ({ page }) => {
    await expect(page.getByTestId('strategy-filter')).toBeVisible();
    await page.getByTestId('strategy-filter-toggle').click();
    await expect(page.getByTestId('strategy-filter-tag-input')).toBeVisible();
    await expect(page.getByTestId('strategy-filter-type-select')).toBeVisible();
    await expect(page.getByTestId('strategy-filter-sort-select')).toBeVisible();
    await expect(page.getByTestId('strategy-filter-apply')).toBeVisible();
    await expect(page.getByTestId('strategy-filter-reset')).toBeVisible();
    await page.screenshot({ path: 'e2e-results/v35-01-filter-panel-open.png', fullPage: true });
  });

  test('apply filter button triggers fetch', async ({ page }) => {
    await page.getByTestId('strategy-filter-toggle').click();
    await page.getByTestId('strategy-filter-apply').click();
    // Should still have library items
    await expect(page.getByTestId('strategy-library-table')).toBeVisible();
    await page.screenshot({ path: 'e2e-results/v35-02-filter-applied.png', fullPage: true });
  });

  test('sort order toggle works', async ({ page }) => {
    await page.getByTestId('strategy-filter-toggle').click();
    const sortBtn = page.getByTestId('strategy-filter-sort-order');
    await sortBtn.click(); // toggle asc → desc
    await page.screenshot({ path: 'e2e-results/v35-03-sort-order-toggled.png', fullPage: true });
  });

  test('reset clears filter state', async ({ page }) => {
    await page.getByTestId('strategy-filter-toggle').click();
    const tagInput = page.getByTestId('strategy-filter-tag-input');
    await tagInput.fill('test-tag');
    await page.getByTestId('strategy-filter-reset').click();
    await expect(tagInput).toHaveValue('');
    await page.screenshot({ path: 'e2e-results/v35-04-filter-reset.png', fullPage: true });
  });
});

/* ------------------------------------------------------------------ */
/* v1.33: Visual Regression Checkpoints (stable screenshots)          */
/* ------------------------------------------------------------------ */

test.describe('v1.33 — Visual Regression Checkpoints', () => {
  test.beforeEach(async ({ page }) => {
    await goToStrategyLab(page);
  });

  test('VR01: builder default state', async ({ page }) => {
    await page.getByTestId('strategy-lab-tab-builder').click();
    await expect(page.getByTestId('strategy-builder-ready')).toBeVisible();
    await takeStableSnapshot(page, 'v33-vr01-builder-default.png', {
      maskTestIds: ['timestamp', 'clock', 'ws-latency', 'last-updated'],
      fullPage: true,
    });
  });

  test('VR02: library default state', async ({ page }) => {
    await page.getByTestId('strategy-lab-tab-library').click();
    await expect(page.getByTestId('strategy-library-ready')).toBeVisible();
    await takeStableSnapshot(page, 'v33-vr02-library-default.png', {
      maskTestIds: ['timestamp', 'clock', 'ws-latency', 'last-updated'],
      fullPage: true,
    });
  });

  test('VR03: validate default state', async ({ page }) => {
    await page.getByTestId('strategy-lab-tab-validate').click();
    await expect(page.getByTestId('strategy-validate-ready')).toBeVisible();
    await takeStableSnapshot(page, 'v33-vr03-validate-default.png', {
      maskTestIds: ['timestamp', 'clock', 'ws-latency', 'last-updated'],
      fullPage: true,
    });
  });
});
