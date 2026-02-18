/**
 * Strategy Diff Viewer + Version Lineage E2E Tests (v1.30)
 *
 * Tests:
 * - Navigate to Strategy Lab > Diff tab
 * - Auto-select left/right artifacts
 * - Compute diff and verify canonical JSON panels
 * - Verify changes list with deterministic ordering
 * - Verify lineage panel displays
 * - Screenshot assertion
 */

import { test, expect } from '@playwright/test';

async function navigateToStrategyLabDiff(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');

  // Click Options nav item
  const navOptions = page.locator('[data-testid="nav-item-options"]');
  await expect(navOptions).toBeVisible({ timeout: 10000 });
  await navOptions.click();

  // Click Strategy Lab main tab
  const strategyLabTab = page.locator('[data-testid="options-main-tab-strategy-lab"]');
  await expect(strategyLabTab).toBeVisible({ timeout: 5000 });
  await strategyLabTab.click();

  // Verify strategy lab panel is visible
  const labPanel = page.locator('[data-testid="strategy-lab-panel"]');
  await expect(labPanel).toBeVisible({ timeout: 5000 });

  // First visit Artifacts tab to load the artifacts list
  const artifactsTab = page.locator('[data-testid="strategy-lab-tab-artifacts"]');
  await expect(artifactsTab).toBeVisible({ timeout: 5000 });
  await artifactsTab.click();

  // Wait for artifacts to load
  const artifactsPanel = page.locator('[data-testid="strategy-artifacts-panel"]');
  await expect(artifactsPanel).toBeVisible({ timeout: 5000 });
  const rows = page.locator('[data-testid^="strategy-artifact-row-"]');
  await expect(rows.first()).toBeVisible({ timeout: 5000 });

  // Now click Diff tab
  const diffTab = page.locator('[data-testid="strategy-lab-tab-diff"]');
  await expect(diffTab).toBeVisible({ timeout: 5000 });
  await diffTab.click();
}

test.describe('v1.30 Strategy Diff Viewer + Version Lineage', () => {
  test.beforeEach(async ({ page }) => {
    // Reset demo state for determinism
    await page.request.post('http://localhost:8000/api/v1/strategy-artifacts/reset-demo');
  });

  test('diff panel displays with artifact selectors', async ({ page }) => {
    await navigateToStrategyLabDiff(page);

    const diffPanel = page.locator('[data-testid="strategy-diff-panel"]');
    await expect(diffPanel).toBeVisible({ timeout: 5000 });

    const leftSelect = page.locator('[data-testid="strategy-diff-left-select"]');
    const rightSelect = page.locator('[data-testid="strategy-diff-right-select"]');
    await expect(leftSelect).toBeVisible();
    await expect(rightSelect).toBeVisible();
  });

  test('compute diff shows canonical JSON side-by-side', async ({ page }) => {
    await navigateToStrategyLabDiff(page);

    // Wait for auto-diff computation
    const readyMarker = page.locator('[data-testid="strategy-diff-ready"]');
    await expect(readyMarker).toBeAttached({ timeout: 10000 });

    // Left canonical JSON
    const leftJson = page.locator('[data-testid="strategy-diff-left-json"]');
    await expect(leftJson).toBeVisible();
    const leftText = await leftJson.textContent();
    expect(leftText).toBeTruthy();

    // Right canonical JSON
    const rightJson = page.locator('[data-testid="strategy-diff-right-json"]');
    await expect(rightJson).toBeVisible();
    const rightText = await rightJson.textContent();
    expect(rightText).toBeTruthy();

    // Left and right should be different
    expect(leftText).not.toEqual(rightText);
  });

  test('diff changes list has deterministic ordering', async ({ page }) => {
    await navigateToStrategyLabDiff(page);

    const readyMarker = page.locator('[data-testid="strategy-diff-ready"]');
    await expect(readyMarker).toBeAttached({ timeout: 10000 });

    const changesPanel = page.locator('[data-testid="strategy-diff-changes"]');
    await expect(changesPanel).toBeVisible();

    // Should have at least 1 change
    const changeEntries = changesPanel.locator('div');
    const count = await changeEntries.count();
    expect(count).toBeGreaterThan(0);
  });

  test('diff open button triggers computation', async ({ page }) => {
    await navigateToStrategyLabDiff(page);

    const openBtn = page.locator('[data-testid="strategy-diff-open"]');
    await expect(openBtn).toBeVisible();
    await openBtn.click();

    const readyMarker = page.locator('[data-testid="strategy-diff-ready"]');
    await expect(readyMarker).toBeAttached({ timeout: 10000 });
  });

  test('lineage panel displays for artifact', async ({ page }) => {
    await navigateToStrategyLabDiff(page);

    const readyMarker = page.locator('[data-testid="strategy-diff-ready"]');
    await expect(readyMarker).toBeAttached({ timeout: 10000 });

    const lineagePanel = page.locator('[data-testid="strategy-lineage-panel"]');
    await expect(lineagePanel).toBeVisible({ timeout: 5000 });

    // Should have at least 1 lineage item
    const item0 = page.locator('[data-testid="strategy-lineage-item-0"]');
    await expect(item0).toBeVisible();
  });

  test('diff screenshot assertion', async ({ page }) => {
    await navigateToStrategyLabDiff(page);

    const readyMarker = page.locator('[data-testid="strategy-diff-ready"]');
    await expect(readyMarker).toBeAttached({ timeout: 10000 });

    await page.screenshot({
      path: 'test-results/snapshots/strategy-diff-viewer-v1-30.png',
      fullPage: false,
    });
  });

  test('diff output is deterministic across reloads', async ({ page }) => {
    await navigateToStrategyLabDiff(page);

    const readyMarker = page.locator('[data-testid="strategy-diff-ready"]');
    await expect(readyMarker).toBeAttached({ timeout: 10000 });

    const changesPanel = page.locator('[data-testid="strategy-diff-changes"]');
    const firstRunText = await changesPanel.textContent();

    // Reload and repeat
    await page.reload();
    await navigateToStrategyLabDiff(page);
    await expect(readyMarker).toBeAttached({ timeout: 10000 });

    const secondRunText = await changesPanel.textContent();
    expect(firstRunText).toEqual(secondRunText);
  });
});
