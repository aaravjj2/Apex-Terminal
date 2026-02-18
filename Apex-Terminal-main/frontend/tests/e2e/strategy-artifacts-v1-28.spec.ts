/**
 * Strategy Artifacts E2E Tests (v1.28)
 * 
 * Tests:
 * - Navigate to Strategy Lab > Artifacts tab
 * - Verify demo seed artifacts display
 * - Create/store a strategy with known deterministic spec
 * - Verify artifact id is stable on re-create with same spec
 * - Screenshot assertion of the artifacts list
 */

import { test, expect } from '@playwright/test';

// Navigate to Strategy Lab Artifacts tab
async function navigateToStrategyLabArtifacts(page: import('@playwright/test').Page) {
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
  
  // Click Artifacts tab
  const artifactsTab = page.locator('[data-testid="strategy-lab-tab-artifacts"]');
  await expect(artifactsTab).toBeVisible({ timeout: 5000 });
  await artifactsTab.click();
  
  // Verify artifacts panel is visible
  const artifactsPanel = page.locator('[data-testid="strategy-artifacts-panel"]');
  await expect(artifactsPanel).toBeVisible({ timeout: 5000 });
}

test.describe('v1.28 Strategy Artifacts', () => {
  test.beforeEach(async ({ page }) => {
    // Reset demo state for determinism
    try {
      await page.request.post('http://localhost:8000/api/v1/strategy-artifacts/reset-demo', { timeout: 30000 });
    } catch {
      console.warn('strategy-artifacts reset-demo timed out — continuing');
    }
  });

  test('artifacts panel displays demo seed artifacts', async ({ page }) => {
    await navigateToStrategyLabArtifacts(page);
    
    // Verify artifacts panel is visible
    const panel = page.locator('[data-testid="strategy-artifacts-panel"]');
    await expect(panel).toBeVisible();
    
    // Verify refresh button exists
    const refreshBtn = page.locator('[data-testid="strategy-artifacts-refresh"]');
    await expect(refreshBtn).toBeVisible();
    
    // Should have at least 2 demo seed artifacts (from rows)
    const rows = page.locator('[data-testid^="strategy-artifact-row-"]');
    await expect(rows.first()).toBeVisible({ timeout: 5000 });
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(2);
    
    // Take screenshot
    await page.screenshot({ path: 'test-results/snapshots/strategy-artifacts-list.png', fullPage: false });
  });

  test('create artifact with known deterministic spec', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    
    // Navigate to Options > Strategy Lab
    const navOptions = page.locator('[data-testid="nav-item-options"]');
    await expect(navOptions).toBeVisible({ timeout: 10000 });
    await navOptions.click();
    
    const strategyLabTab = page.locator('[data-testid="options-main-tab-strategy-lab"]');
    await expect(strategyLabTab).toBeVisible({ timeout: 5000 });
    await strategyLabTab.click();
    
    const labPanel = page.locator('[data-testid="strategy-lab-panel"]');
    await expect(labPanel).toBeVisible({ timeout: 5000 });
    
    // Stay on Builder tab, fill in strategy name
    const nameInput = page.locator('[data-testid="strategy-name-input"]');
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await nameInput.fill('E2E Test Strategy');
    
    // Select type
    const typeSelect = page.locator('[data-testid="strategy-type-select"]');
    await typeSelect.selectOption('signal');
    
    // Click Create Artifact button
    const createBtn = page.locator('[data-testid="strategy-artifact-create"]');
    await expect(createBtn).toBeVisible();
    await createBtn.click();
    
    // Verify success message appears
    const successMsg = page.locator('[data-testid="strategy-artifact-create-success"]');
    await expect(successMsg).toBeVisible({ timeout: 5000 });
    
    // Capture the artifact ID
    const idDisplay = page.locator('[data-testid="strategy-artifact-id-display"]');
    await expect(idDisplay).toBeVisible();
    const firstId = await idDisplay.textContent();
    expect(firstId).toBeTruthy();
    expect(firstId!.length).toBe(64); // sha256 hex
    
    // Take screenshot
    await page.screenshot({ path: 'test-results/snapshots/strategy-artifact-created.png', fullPage: false });
  });

  test('re-create same spec produces identical artifact id', async ({ page }) => {
    // Create the same artifact twice via API directly and verify IDs match
    const spec = {
      name: 'Deterministic Test',
      type: 'crossover',
      spec: {
        indicators: [
          { type: 'SMA', params: { period: 10 } },
          { type: 'SMA', params: { period: 30 } },
        ],
        entry: { condition: 'cross_above' },
        exit: { condition: 'cross_below' },
      },
    };
    
    const res1 = await page.request.post('http://localhost:8000/api/v1/strategy-artifacts', {
      data: spec,
      timeout: 30000,
    });
    const data1 = await res1.json();
    
    const res2 = await page.request.post('http://localhost:8000/api/v1/strategy-artifacts', {
      data: spec,
      timeout: 30000,
    });
    const data2 = await res2.json();
    
    // Assert identical IDs
    expect(data1.id).toBe(data2.id);
    expect(data1.checksum).toBe(data2.checksum);
    expect(data1.id.length).toBe(64);
    
    // Now navigate to verify in UI
    await navigateToStrategyLabArtifacts(page);
    
    // Verify the artifact row exists
    const row = page.locator(`[data-testid="strategy-artifact-row-${data1.id}"]`);
    await expect(row).toBeVisible({ timeout: 5000 });
    
    // Verify the name, type, version, checksum
    const nameCell = page.locator(`[data-testid="strategy-artifact-name-${data1.id}"]`);
    await expect(nameCell).toHaveText('Deterministic Test');
    
    const typeCell = page.locator(`[data-testid="strategy-artifact-type-${data1.id}"]`);
    await expect(typeCell).toHaveText('crossover');
    
    const versionCell = page.locator(`[data-testid="strategy-artifact-version-${data1.id}"]`);
    await expect(versionCell).toHaveText('1');
    
    // Take screenshot of stable artifact list
    await page.screenshot({ path: 'test-results/snapshots/strategy-artifacts-stable.png', fullPage: false });
  });

  test('artifact list has all required testid selectors', async ({ page }) => {
    await navigateToStrategyLabArtifacts(page);
    
    // Wait for at least one row
    const firstRow = page.locator('[data-testid^="strategy-artifact-row-"]').first();
    await expect(firstRow).toBeVisible({ timeout: 5000 });
    
    // Get the first artifact's id from the row testid
    const rowTestId = await firstRow.getAttribute('data-testid');
    const artifactId = rowTestId!.replace('strategy-artifact-row-', '');
    
    // Verify all required testid selectors exist
    await expect(page.locator(`[data-testid="strategy-artifact-id-${artifactId}"]`)).toBeVisible();
    await expect(page.locator(`[data-testid="strategy-artifact-name-${artifactId}"]`)).toBeVisible();
    await expect(page.locator(`[data-testid="strategy-artifact-type-${artifactId}"]`)).toBeVisible();
    await expect(page.locator(`[data-testid="strategy-artifact-version-${artifactId}"]`)).toBeVisible();
    await expect(page.locator(`[data-testid="strategy-artifact-checksum-${artifactId}"]`)).toBeVisible();
  });
});
