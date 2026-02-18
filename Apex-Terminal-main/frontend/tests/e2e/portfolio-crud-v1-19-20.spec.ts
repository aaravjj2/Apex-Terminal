/**
 * E2E Tests for Portfolio CRUD (v1.19 + v1.20)
 * 
 * Coverage:
 * - Visual: empty state, loaded demo, portfolio selected
 * - E2E: create, add position, edit, determinism
 */

import { test, expect } from '@playwright/test';

// Configure for determinism
test.use({
  video: 'on',
  screenshot: 'on',
  trace: 'on'
});

const BASE_URL = 'http://localhost:5100';

// Helper: Navigate to portfolio panel (adjust based on actual routing)
async function navigateToPortfolio(page) {
  await page.goto(BASE_URL);
  // Click portfolio nav item (ViewId = 'portfolio')
  const portfolioNav = page.locator('[data-testid="nav-item-portfolio"]');
  await expect(portfolioNav).toBeVisible({ timeout: 10000 });
  await portfolioNav.click();
  // Switch to the "Manage" tab which contains PortfolioCrudPanel
  const manageTab = page.locator('[data-testid="tab-manage"]');
  await expect(manageTab).toBeVisible({ timeout: 5000 });
  await manageTab.click();
  await page.waitForSelector('[data-testid="portfolio-panel"]', { timeout: 10000 });
}

test.describe('Portfolio CRUD v1.19+v1.20', () => {
  
  test('visual: portfolio empty view snapshot', async ({ page }) => {
    // Clear all existing portfolios via API for empty state test
    const listRes = await page.request.get('http://localhost:8000/api/v1/portfolios?sort_by=portfolio_id');
    const listData = await listRes.json();
    const portfolios = listData.portfolios || [];
    for (const p of portfolios) {
      await page.request.delete(`http://localhost:8000/api/v1/portfolios/${p.portfolio_id}`);
    }

    await navigateToPortfolio(page);
    
    // Wait for panel ready
    await page.waitForSelector('[data-testid="portfolio-panel"]');
    
    // Should show empty state
    const emptyState = page.locator('[data-testid="portfolio-empty"]');
    await expect(emptyState).toBeVisible({ timeout: 5000 });
    
    // Snapshot (will fail first run - update baselines with --update-snapshots)
    await expect(page.locator('[data-testid="portfolio-panel"]')).toHaveScreenshot('portfolio-empty-view.png');
  });

  test('visual: load demo portfolio → list view snapshot', async ({ page }) => {
    await navigateToPortfolio(page);
    
    // Load demo
    const loadDemoBtn = page.locator('[data-testid="portfolio-load-demo-btn"]');
    await expect(loadDemoBtn).toBeVisible();
    await loadDemoBtn.click();
    
    // Wait for ready state
    await page.waitForSelector('[data-testid="portfolio-ready"]', { timeout: 10000 });
    
    // Verify table exists
    const table = page.locator('[data-testid="portfolio-table"]');
    await expect(table).toBeVisible();
    
    // Verify at least one row
    const rows = page.locator('[data-testid^="portfolio-row-"]');
    await expect(rows.first()).toBeVisible();
    
    // Snapshot
    await expect(page.locator('[data-testid="portfolio-panel"]')).toHaveScreenshot('portfolio-loaded-demo.png');
  });

  test('visual: portfolio table with demo data', async ({ page }) => {
    await navigateToPortfolio(page);
    
    // Load demo
    await page.locator('[data-testid="portfolio-load-demo-btn"]').click();
    await page.waitForSelector('[data-testid="portfolio-ready"]');
    
    // Check specific demo portfolio (DEMO-PORT-001)
    const demoRow = page.locator('[data-testid="portfolio-row-DEMO-PORT-001"]');
    await expect(demoRow).toBeVisible();
    
    // Verify name cell
    const nameCell = page.locator('[data-testid="portfolio-name-cell-DEMO-PORT-001"]');
    await expect(nameCell).toContainText('Tech Growth');
    
    // Snapshot of table
    await expect(page.locator('[data-testid="portfolio-table"]')).toHaveScreenshot('portfolio-table-demo.png');
  });

  test('e2e: create portfolio → verify table row', async ({ page }) => {
    await navigateToPortfolio(page);
    
    // Click create
    const createBtn = page.locator('[data-testid="portfolio-create-btn"]');
    await expect(createBtn).toBeVisible();
    await createBtn.click();
    
    // Wait for modal
    await page.waitForSelector('[data-testid="portfolio-modal"]');
    await page.waitForSelector('[data-testid="portfolio-modal-ready"]');
    
    // Fill form
    await page.locator('[data-testid="portfolio-name-input"]').fill('E2E Test Portfolio');
    await page.locator('[data-testid="portfolio-currency-input"]').selectOption('USD');
    await page.locator('[data-testid="portfolio-initial-cash-input"]').fill('50000');
    
    // Save
    await page.locator('[data-testid="portfolio-save-btn"]').click();
    
    // Wait for modal to close and success
    await page.waitForSelector('[data-testid="portfolio-modal"]', { state: 'hidden', timeout: 5000 });
    
    // Wait for ready state
    await page.waitForSelector('[data-testid="portfolio-ready"]');
    
    // Verify table has at least one row
    const rows = page.locator('[data-testid^="portfolio-row-"]');
    await expect(rows.first()).toBeVisible();
    
    // Verify one of the rows contains our portfolio name
    const allText = await page.locator('[data-testid="portfolio-table"]').textContent();
    expect(allText).toContain('E2E Test Portfolio');
  });

  test('e2e: create portfolio → add position → verify position count', async ({ page }) => {
    await navigateToPortfolio(page);
    
    // Create portfolio
    await page.locator('[data-testid="portfolio-create-btn"]').click();
    await page.waitForSelector('[data-testid="portfolio-modal-ready"]');
    await page.locator('[data-testid="portfolio-name-input"]').fill('Position Test');
    await page.locator('[data-testid="portfolio-save-btn"]').click();
    await page.waitForSelector('[data-testid="portfolio-modal"]', { state: 'hidden' });
    await page.waitForSelector('[data-testid="portfolio-ready"]');
    
    // Find the portfolio row
    const table = page.locator('[data-testid="portfolio-table"]');
    const row = table.locator('text=Position Test').locator('xpath=ancestor::tr');
    
    // Click "Add Position" button
    const addPosBtn = row.locator('button:has-text("Add Position")');
    await addPosBtn.click();
    
    // Wait for position modal
    await page.waitForSelector('[data-testid="position-modal"]');
    await page.waitForSelector('[data-testid="position-modal-ready"]');
    
    // Fill position form
    await page.locator('[data-testid="position-symbol-input"]').fill('AAPL');
    await page.locator('[data-testid="position-qty-input"]').fill('100');
    await page.locator('[data-testid="position-price-input"]').fill('150.00');
    
    // Save position
    await page.locator('[data-testid="position-save-btn"]').click();
    await page.waitForSelector('[data-testid="position-modal"]', { state: 'hidden', timeout: 5000 });
    
    // Wait for table to refresh
    await page.waitForTimeout(500);  // Small wait for table update
    
    // Verify position count updated (should show "1" in positions column)
    const positionsCell = row.locator('td').nth(3); // Positions column
    await expect(positionsCell).toContainText('1');
  });

  test('e2e: edit portfolio name → verify updated', async ({ page }) => {
    await navigateToPortfolio(page);
    
    // Load demo
    await page.locator('[data-testid="portfolio-load-demo-btn"]').click();
    await page.waitForSelector('[data-testid="portfolio-ready"]');
    
    // Find first demo portfolio
    const firstRow = page.locator('[data-testid^="portfolio-row-"]').first();
    const originalName = await firstRow.locator('td').first().textContent();
    
    // Click edit
    const editBtn = firstRow.locator('button:has-text("Edit")');
    await editBtn.click();
    
    // Wait for modal
    await page.waitForSelector('[data-testid="portfolio-modal-ready"]');
    
    // Update name
    const nameInput = page.locator('[data-testid="portfolio-name-input"]');
    const newName = `${originalName} - Updated`;
    await nameInput.clear();
    await nameInput.fill(newName);
    
    // Save
    await page.locator('[data-testid="portfolio-save-btn"]').click();
    await page.waitForSelector('[data-testid="portfolio-modal"]', { state: 'hidden' });
    
    // Verify name updated in table
    await page.waitForTimeout(500);
    const updatedRow = page.locator('[data-testid^="portfolio-row-"]').first();
    const updatedName = await updatedRow.locator('td').first().textContent();
    expect(updatedName).toContain('Updated');
  });

  test('e2e: export portfolio → verify JSON has schema_version + content_hash', async ({ page }) => {
    await navigateToPortfolio(page);
    
    // Load demo
    await page.locator('[data-testid="portfolio-load-demo-btn"]').click();
    await page.waitForSelector('[data-testid="portfolio-ready"]');
    
    // Get first portfolio ID
    const firstRow = page.locator('[data-testid^="portfolio-row-"]').first();
    const portfolioId = await firstRow.getAttribute('data-testid');
    const id = portfolioId?.replace('portfolio-row-', '');
    
    // Fetch export via API
    const response = await page.request.get(`${BASE_URL}/api/v1/portfolios/${id}/export`);
    expect(response.ok()).toBeTruthy();
    
    const exportData = await response.json();
    
    // Verify export structure
    expect(exportData).toHaveProperty('portfolio');
    expect(exportData.portfolio).toHaveProperty('schema_version');
    expect(exportData.portfolio).toHaveProperty('content_hash');
    expect(exportData).toHaveProperty('export_hash');
    
    // Verify schema version
    expect(exportData.portfolio.schema_version).toBe('1.0.0');
  });

  test('e2e: export twice → verify deterministic hash', async ({ page }) => {
    await navigateToPortfolio(page);
    
    // Load demo
    await page.locator('[data-testid="portfolio-load-demo-btn"]').click();
    await page.waitForSelector('[data-testid="portfolio-ready"]');
    
    // Get first portfolio ID
    const firstRow = page.locator('[data-testid^="portfolio-row-"]').first();
    const portfolioId = await firstRow.getAttribute('data-testid');
    const id = portfolioId?.replace('portfolio-row-', '');
    
    // Export twice
    const response1 = await page.request.get(`${BASE_URL}/api/v1/portfolios/${id}/export`);
    const export1 = await response1.json();
    
    const response2 = await page.request.get(`${BASE_URL}/api/v1/portfolios/${id}/export`);
    const export2 = await response2.json();
    
    // Verify hashes match
    expect(export1.export_hash).toBe(export2.export_hash);
    expect(export1.portfolio.content_hash).toBe(export2.portfolio.content_hash);
  });

  test('e2e: list portfolios twice → verify stable ordering', async ({ page }) => {
    await navigateToPortfolio(page);
    
    // Load demo
    await page.locator('[data-testid="portfolio-load-demo-btn"]').click();
    await page.waitForSelector('[data-testid="portfolio-ready"]');
    
    // Get list via API twice
    const response1 = await page.request.get(`${BASE_URL}/api/v1/portfolios?sort_by=portfolio_id`);
    const list1 = await response1.json();
    
    const response2 = await page.request.get(`${BASE_URL}/api/v1/portfolios?sort_by=portfolio_id`);
    const list2 = await response2.json();
    
    // Verify same order
    const ids1 = list1.portfolios.map((p: any) => p.portfolio_id);
    const ids2 = list2.portfolios.map((p: any) => p.portfolio_id);
    
    expect(ids1).toEqual(ids2);
    expect(ids1.length).toBeGreaterThan(0);
  });

});
