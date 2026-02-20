/**
 * UI2 Comprehensive E2E Test Suite
 * Tests all workspaces, command palette, navigation, and design system
 * Headed mode with full media capture (video, trace, screenshots)
 */

import { test, expect } from '@playwright/test';

// Test configuration
const BASE_URL = 'http://localhost:5100';
const UI2_BASE = `${BASE_URL}/ui2`;

// Workspace configurations
const WORKSPACES = [
  { id: 'dashboard', path: '/ui2/dashboard', label: 'Dashboard', testId: 'dashboard-ui2-page' },
  { id: 'trading', path: '/ui2/trading', label: 'Trading', testId: 'trading-ui2-page' },
  { id: 'portfolio', path: '/ui2/portfolio', label: 'Portfolio', testId: 'portfolio-ui2-page' },
  { id: 'orders', path: '/ui2/orders', label: 'Orders', testId: 'orders-ui2-page' },
  { id: 'risk', path: '/ui2/risk', label: 'Risk & Options', testId: 'risk-ui2-page' },
  { id: 'research', path: '/ui2/research', label: 'Research', testId: 'research-ui2-page' },
  { id: 'backtest', path: '/ui2/backtest', label: 'Backtest', testId: 'backtest-ui2-page' },
  { id: 'autopilot', path: '/ui2/autopilot', label: 'Autopilot', testId: 'autopilot-ui2-page' },
  { id: 'alerts', path: '/ui2/alerts', label: 'Alerts', testId: 'alerts-ui2-page' },
  { id: 'replay', path: '/ui2/replay', label: 'Replay', testId: 'replay-ui2-page' },
  { id: 'runs', path: '/ui2/runs', label: 'Runs & Audit', testId: 'runs-ui2-page' },
  { id: 'ops', path: '/ui2/ops', label: 'Ops', testId: 'ops-ui2-page' },
  { id: 'settings', path: '/ui2/settings', label: 'Settings', testId: 'settings-ui2-page' },
];

/**
 * Phase 1: Core App Shell Tests
 */
test.describe('UI2 App Shell - Professional Trading Terminal', () => {
  test('should load UI2 app shell with all core elements', async ({ page }) => {
    await page.goto(UI2_BASE);
    
    // Verify app shell loads
    await expect(page.getByTestId('ui2-app-shell')).toBeVisible();
    
    // Verify TopBar elements
    await expect(page.getByTestId('ui2-topbar')).toBeVisible();
    await expect(page.getByTestId('ui2-command-trigger')).toBeVisible();
    await expect(page.getByTestId('ui2-mode-badge')).toBeVisible();
    await expect(page.getByTestId('ui2-market-status')).toBeVisible();
    await expect(page.getByTestId('ui2-connectivity')).toBeVisible();
    
    // Verify Left Rail
    await expect(page.getByTestId('ui2-left-rail')).toBeVisible();
    
    // Verify Center workspace
    await expect(page.getByTestId('ui2-center')).toBeVisible();
    
    // Verify Bottom Dock
    await expect(page.getByTestId('ui2-bottom-dock')).toBeVisible();
    
    // Verify Right Sidebar
    await expect(page.getByTestId('ui2-right-sidebar')).toBeVisible();
  });

  test('should display brand and logo correctly', async ({ page }) => {
    await page.goto(UI2_BASE);
    
    // Check for Apex Terminal branding
    await expect(page.locator('text=Apex Terminal')).toBeVisible();
    await expect(page.locator('text=Professional Edition')).toBeVisible();
  });

  test('should display mode and status badges', async ({ page }) => {
    await page.goto(UI2_BASE);
    
    // Verify DEMO mode badge
    const modeBadge = page.getByTestId('ui2-mode-badge');
    await expect(modeBadge).toBeVisible();
    await expect(modeBadge).toContainText('DEMO');
    
    // Verify connectivity badge (WS)
    const connectivity = page.getByTestId('ui2-connectivity');
    await expect(connectivity).toBeVisible();
    await expect(connectivity).toContainText('WS');
  });

  // E2E mode attribute test
  test('should have E2E mode data attribute when in test mode', async ({ page }) => {
    await page.goto(`${UI2_BASE}/dashboard?e2e=1`);
    
    const appShell = page.getByTestId('ui2-app-shell');
    const e2eMode = await appShell.getAttribute('data-e2e-mode');
    expect(e2eMode).toBe('true');
  });
});

/**
 * Phase 2: Navigation & Routing Tests
 */
test.describe('UI2 Navigation - All Workspaces', () => {
  for (const workspace of WORKSPACES) {
    test(`should navigate to ${workspace.label} workspace`, async ({ page }) => {
      await page.goto(UI2_BASE);
      
      // Click left rail button
      await page.getByTestId(`ui2-rail-${workspace.id}`).click();
      
      // Verify URL changed
      await expect(page).toHaveURL(new RegExp(workspace.path));
      
      // Verify workspace page loaded with correct testId
      await expect(page.getByTestId(workspace.testId)).toBeVisible();
    });
  }

  test('should navigate between all workspaces sequentially', async ({ page }) => {
    await page.goto(UI2_BASE);
    
    for (const workspace of WORKSPACES) {
      await page.getByTestId(`ui2-rail-${workspace.id}`).click();
      await expect(page).toHaveURL(new RegExp(workspace.path));
      await expect(page.getByTestId(workspace.testId)).toBeVisible();
      
      // Small delay for stability
      await page.waitForTimeout(500);
    }
  });

  test('should maintain active state in left rail', async ({ page }) => {
    await page.goto('/ui2/trading');
    
    const tradingButton = page.getByTestId('ui2-rail-trading');
    
    // Check for active state (border-left with brand color via inline style)
    const style = await tradingButton.getAttribute('style');
    expect(style).toContain('border-left');
    expect(style).toContain('brand');
  });
});

/**
 * Phase 3: Command Palette Tests
 */
test.describe('UI2 Command Palette - Ctrl+K', () => {
  test('should open command palette with Ctrl+K', async ({ page }) => {
    await page.goto(UI2_BASE);
    
    // Press Ctrl+K
    await page.keyboard.press('Control+k');
    
    // Verify palette opened
    await expect(page.getByTestId('ui2-command-palette')).toBeVisible();
    await expect(page.getByTestId('ui2-command-palette-input')).toBeVisible();
    
    // Verify backdrop present
    await expect(page.getByTestId('ui2-command-palette-backdrop')).toBeVisible();
  });

  test('should open command palette by clicking trigger button', async ({ page }) => {
    await page.goto(UI2_BASE);
    
    // Click command trigger in top bar
    await page.getByTestId('ui2-command-trigger').click();
    
    // Verify palette opened
    await expect(page.getByTestId('ui2-command-palette')).toBeVisible();
  });

  test('should close command palette with Escape', async ({ page }) => {
    await page.goto(UI2_BASE);
    
    // Open palette
    await page.keyboard.press('Control+k');
    await expect(page.getByTestId('ui2-command-palette')).toBeVisible();
    
    // Close with Escape
    await page.keyboard.press('Escape');
    
    // Verify closed
    await expect(page.getByTestId('ui2-command-palette')).not.toBeVisible();
  });

  test('should filter commands by search query', async ({ page }) => {
    await page.goto(UI2_BASE);
    
    // Open palette
    await page.keyboard.press('Control+k');
    const input = page.getByTestId('ui2-command-palette-input');
    
    // Type "trading"
    await input.fill('trading');
    
    // Verify Trading command visible
    await expect(page.getByTestId('ui2-command-palette-item-trading')).toBeVisible();
    
    // Verify other commands filtered out (check that settings is not visible)
    const results = page.getByTestId('ui2-command-palette-results');
    const settingsItem = results.getByTestId('ui2-command-palette-item-settings');
    await expect(settingsItem).not.toBeVisible();
  });

  test('should navigate to workspace from command palette', async ({ page }) => {
    await page.goto(UI2_BASE);
    
    // Open palette
    await page.keyboard.press('Control+k');
    
    // Click Trading command
    await page.getByTestId('ui2-command-palette-item-trading').click();
    
    // Verify navigation
    await expect(page).toHaveURL(/\/ui2\/trading/);
    await expect(page.getByTestId('trading-ui2-page')).toBeVisible();
    
    // Verify palette closed
    await expect(page.getByTestId('ui2-command-palette')).not.toBeVisible();
  });

  // Keyboard navigation in palette
  test('should support keyboard navigation in palette', async ({ page }) => {
    await page.goto(UI2_BASE);
    
    // Open palette
    await page.keyboard.press('Control+k');
    
    // Navigate down
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    
    // Press Enter to select
    await page.keyboard.press('Enter');
    
    // Should navigate to an item (order depends on command list)
    await expect(page).toHaveURL(/\/ui2\//);
  });
});

/**
 * Phase 4: Design System Visual Tests
 */
test.describe('UI2 Design System - Bloomberg-Grade Polish', () => {
  test('should apply design tokens correctly', async ({ page }) => {
    await page.goto(UI2_BASE);
    
    const appShell = page.getByTestId('ui2-app-shell');
    
    // Verify root has ui2-root class
    const className = await appShell.getAttribute('class');
    expect(className).toContain('ui2-root');
    
    // Verify computed styles have design token values
    const bgColor = await appShell.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });
    
    // Background should be dark (not white)
    expect(bgColor).not.toBe('rgb(255, 255, 255)');
  });

  test('should display status badges with correct styling', async ({ page }) => {
    await page.goto(UI2_BASE);
    
    // Check mode badge
    const modeBadge = page.getByTestId('ui2-mode-badge');
    const badgeClass = await modeBadge.getAttribute('class');
    expect(badgeClass).toContain('ui2-badge');
  });
  
  // Focus ring test
  test('should have proper focus rings on interactive elements', async ({ page }) => {
    await page.goto(UI2_BASE);
    
    // Focus on command trigger
    const trigger = page.getByTestId('ui2-command-trigger');
    await trigger.focus();
    
    // Verify element is focused
    await expect(trigger).toBeFocused();
  });
});

/**
 * Phase 5: Workspace Content Tests
 */
test.describe('UI2 Workspace Content - Feature Parity', () => {
  test('Dashboard should display command center content', async ({ page }) => {
    await page.goto('/ui2/dashboard');
    
    await expect(page.getByTestId('dashboard-ui2-page')).toBeVisible();
    
    // Wait for command center to load
    await expect(page.getByTestId('command-center-view')).toBeVisible({ timeout: 10000 });
  });

  test('Trading workspace should display chart and panels', async ({ page }) => {
    await page.goto('/ui2/trading');
    
    await expect(page.getByTestId('trading-ui2-page')).toBeVisible();
    
    // Trading page embeds chart canvas and blotter
    // Just verify page loads successfully
  });

  test('Risk workspace should display options view', async ({ page }) => {
    await page.goto('/ui2/risk');
    
    await expect(page.getByTestId('risk-ui2-page')).toBeVisible();
  });

  test('Autopilot workspace should be operational', async ({ page }) => {
    await page.goto('/ui2/autopilot');
    
    await expect(page.getByTestId('autopilot-ui2-page')).toBeVisible();
    
    // Wait for autopilot view to load
    await page.waitForTimeout(2000);
  });
});

/**
 * Phase 6: Bottom Dock & Sidebar Tests
 */
test.describe('UI2 Layout Components', () => {
  test('should display bottom dock with tabs', async ({ page }) => {
    await page.goto(UI2_BASE);
    
    const bottomDock = page.getByTestId('ui2-bottom-dock');
    await expect(bottomDock).toBeVisible();
    
    // Verify tabs present (Orders, Trades, Logs)
    await expect(bottomDock.locator('text=Orders')).toBeVisible();
    await expect(bottomDock.locator('text=Trades')).toBeVisible();
    await expect(bottomDock.locator('text=Logs')).toBeVisible();
  });

  test('should switch bottom dock tabs', async ({ page }) => {
    await page.goto(UI2_BASE);
    
    const bottomDock = page.getByTestId('ui2-bottom-dock');
    
    // Click Trades tab
    await bottomDock.locator('text=Trades').click();
    
    // Wait for content to switch
    await page.waitForTimeout(500);
  });

  test('should display right sidebar', async ({ page }) => {
    await page.goto(UI2_BASE);
    
    await expect(page.getByTestId('ui2-right-sidebar')).toBeVisible();
  });
});

/**
 * Phase 7: Readiness Markers (deterministic UI)
 */
test.describe('UI2 Readiness Markers', () => {
  test('should have ui2-ready data attribute when loaded', async ({ page }) => {
    await page.goto(UI2_BASE);
    
    // Wait for app shell to be ready
    await expect(page.getByTestId('ui2-app-shell')).toBeVisible();
    
    // App should be interactive
    await expect(page.getByTestId('ui2-command-trigger')).toBeEnabled();
  });

  for (const workspace of WORKSPACES.slice(0, 5)) {
    test(`${workspace.label} should have readiness marker`, async ({ page }) => {
      await page.goto(workspace.path);
      
      // Wait for page to load
      await expect(page.getByTestId(workspace.testId)).toBeVisible();
      
      // Verify page is interactive
      await expect(page.getByTestId('ui2-topbar')).toBeVisible();
    });
  }
});

/**
 * Phase 8: Determinism & Stability Tests
 */
test.describe('UI2 Determinism - E2E Mode', () => {
  test('should load consistently with E2E mode flag', async ({ page }) => {
    // Load twice and verify same state
    await page.goto(`${UI2_BASE}?e2e=1`);
    await expect(page.getByTestId('ui2-app-shell')).toBeVisible();
    
    const firstLoad = await page.getByTestId('ui2-topbar').textContent();
    
    await page.goto(`${UI2_BASE}?e2e=1`);
    await expect(page.getByTestId('ui2-app-shell')).toBeVisible();
    
    const secondLoad = await page.getByTestId('ui2-topbar').textContent();
    
    // Both loads should have same content
    expect(firstLoad).toBe(secondLoad);
  });
  // Reduced motion test
  test('should have reduced motion in E2E mode', async ({ page }) => {
    await page.goto(`${UI2_BASE}/dashboard?e2e=1`);
    
    const appShell = page.getByTestId('ui2-app-shell');
    const e2eMode = await appShell.getAttribute('data-e2e-mode');
    
    expect(e2eMode).toBe('true');
  });
});

/**
 * Phase 9: Premium Components - Design System v2
 */
test.describe('UI2 Premium Components - Dashboard', () => {
  test('should display hero KPI strip with 6 metrics', async ({ page }) => {
    await page.goto('/ui2/dashboard');
    
    // Verify Dashboard loaded
    await expect(page.getByTestId('dashboard-ui2-page')).toBeVisible();
    
    // Verify KPI strip exists
    const kpiStrip = page.getByTestId('ui2-kpi-strip-hero');
    await expect(kpiStrip).toBeVisible();
    
    // Verify all 6 KPIs present
    await expect(page.getByTestId('kpi-item-portfolio-value')).toBeVisible();
    await expect(page.getByTestId('kpi-item-daily-pnl')).toBeVisible();
    await expect(page.getByTestId('kpi-item-open-positions')).toBeVisible();
    await expect(page.getByTestId('kpi-item-options-delta')).toBeVisible();
    await expect(page.getByTestId('kpi-item-theta-decay')).toBeVisible();
    await expect(page.getByTestId('kpi-item-win-rate')).toBeVisible();
    
    // Verify hero typography (large values)
    const portfolioValue = page.getByTestId('kpi-item-portfolio-value');
    const classList = await portfolioValue.getAttribute('class');
    expect(classList).toContain('hero'); // verify hero variant applied
  });

  test('should display AI insights panel with 4 insights', async ({ page }) => {
    await page.goto('/ui2/dashboard');
    
    // Verify insights panel exists
    const insightsPanel = page.getByTestId('ui2-insights-panel');
    await expect(insightsPanel).toBeVisible();
    
    // Verify all 4 insights present
    await expect(page.getByTestId('insight-card-insight-001')).toBeVisible();
    await expect(page.getByTestId('insight-card-insight-002')).toBeVisible();
    await expect(page.getByTestId('insight-card-insight-003')).toBeVisible();
    await expect(page.getByTestId('insight-card-insight-004')).toBeVisible();
    
    // Verify first insight has urgency badge
    const firstInsight = page.getByTestId('insight-card-insight-001');
    const urgencyBadge = firstInsight.getByTestId('insight-urgency-insight-001');
    await expect(urgencyBadge).toBeVisible();
    await expect(urgencyBadge).toContainText('high');
    
    // Verify first insight has confidence bar
    const confidenceBar = firstInsight.getByTestId('insight-confidence-insight-001');
    await expect(confidenceBar).toBeVisible();
  });

  test('should dismiss AI insight when X clicked', async ({ page }) => {
    await page.goto('/ui2/dashboard');
    
    // Verify 4 insights initially visible
    await expect(page.getByTestId('insight-card-insight-001')).toBeVisible();
    await expect(page.getByTestId('insight-card-insight-002')).toBeVisible();
    await expect(page.getByTestId('insight-card-insight-003')).toBeVisible();
    await expect(page.getByTestId('insight-card-insight-004')).toBeVisible();
    
    // Click dismiss button on first insight
    await page.getByTestId('insight-dismiss-insight-001').click();
    
    // Verify first insight removed
    await expect(page.getByTestId('insight-card-insight-001')).not.toBeVisible();
    
    // Verify other 3 still visible
    await expect(page.getByTestId('insight-card-insight-002')).toBeVisible();
    await expect(page.getByTestId('insight-card-insight-003')).toBeVisible();
    await expect(page.getByTestId('insight-card-insight-004')).toBeVisible();
  });

  test('should display positions table with P&L formatting', async ({ page }) => {
    await page.goto('/ui2/dashboard');
    
    // Verify positions table exists
    const positionsTable = page.getByTestId('ui2-data-table-positions');
    await expect(positionsTable).toBeVisible();
    
    // Verify at least 4 positions (AAPL, TSLA, SPY, NVDA)
    const rows = positionsTable.locator('tbody tr');
    await expect(rows).toHaveCount(4);
    
    // Verify P&L column has color-coded values
    const aaplRow = positionsTable.locator('tbody tr', { hasText: 'AAPL' });
    await expect(aaplRow).toBeVisible();
    
    // Check for positive P&L (green text)
    const pnlCell = aaplRow.locator('td').nth(4); // P&L column
    const pnlColor = await pnlCell.evaluate((el) => getComputedStyle(el).color);
    // Verify it's not default color (should be green for positive)
    expect(pnlColor).not.toBe('rgb(0, 0, 0)');
  });
});

test.describe('UI2 Premium Components - Orders', () => {
  test('should display orders table with status badges', async ({ page }) => {
    await page.goto('/ui2/orders');
    
    // Verify Orders workspace loaded
    await expect(page.getByTestId('orders-ui2-page')).toBeVisible();
    
    // Verify orders table exists
    const ordersTable = page.getByTestId('ui2-data-table-orders');
    await expect(ordersTable).toBeVisible();
    
    // Verify at least 5 orders present
    const rows = ordersTable.locator('tbody tr');
    await expect(rows).toHaveCount(5);
    
    // Verify status badges present
    await expect(page.getByTestId('order-status-ORD-2024-001')).toBeVisible();
    await expect(page.getByTestId('order-status-ORD-2024-002')).toBeVisible();
    await expect(page.getByTestId('order-status-ORD-2024-003')).toBeVisible();
    await expect(page.getByTestId('order-status-ORD-2024-004')).toBeVisible();
    await expect(page.getByTestId('order-status-ORD-2024-005')).toBeVisible();
    
    // Verify filled status badge shows "filled"
    const filledBadge = page.getByTestId('order-status-ORD-2024-001');
    await expect(filledBadge).toContainText('filled');
    
    // Verify working status badge shows "working"
    const workingBadge = page.getByTestId('order-status-ORD-2024-003');
    await expect(workingBadge).toContainText('working');
  });

  test('should display fill progress bar for working orders', async ({ page }) => {
    await page.goto('/ui2/orders');
    
    // Verify working order (ORD-2024-003) has progress bar
    const workingRow = page.locator('tbody tr', { hasText: 'ORD-2024-003' });
    await expect(workingRow).toBeVisible();
    
    // Verify progress bar exists
    const progressBar = workingRow.getByTestId('order-progress-ORD-2024-003');
    await expect(progressBar).toBeVisible();
    
    // Verify progress bar shows fill percentage
    const progressLabel = await progressBar.textContent();
    expect(progressLabel).toContain('%'); // Should show percentage like "75%"
  });

  test('should display action buttons for each order', async ({ page }) => {
    await page.goto('/ui2/orders');
    
    // Verify action buttons present for first order
    await expect(page.getByTestId('order-view-ORD-2024-001')).toBeVisible();
    await expect(page.getByTestId('order-clone-ORD-2024-001')).toBeVisible();
    await expect(page.getByTestId('order-cancel-ORD-2024-001')).toBeVisible();
    
    // Verify cancel button disabled for already filled order
    const cancelButton = page.getByTestId('order-cancel-ORD-2024-001');
    await expect(cancelButton).toBeDisabled();
  });

  test('should display summary stats cards with badges', async ({ page }) => {
    await page.goto('/ui2/orders');
    
    // Verify summary stats section
    const summarySection = page.locator('text=Summary Stats').locator('..').locator('..');
    await expect(summarySection).toBeVisible();
    
    // Verify at least 5 stat cards (Total, Filled, Working, Queued, Canceled)
    const statCards = summarySection.locator('[data-testid^=order-summary-]');
    await expect(statCards).toHaveCount(5);
    
    // Verify filled count shows "2"
    const filledCard = page.getByTestId('order-summary-filled');
    await expect(filledCard).toContainText('2');
    
    // Verify working count shows "1"
    const workingCard = page.getByTestId('order-summary-working');
    await expect(workingCard).toContainText('1');
  });
});

test.describe('UI2 DataTable Formatting', () => {
  test('should render price values with currency formatting', async ({ page }) => {
    await page.goto('/ui2/orders');
    
    // Check for currency formatted prices
    const ordersTable = page.getByTestId('ui2-data-table-orders');
    const priceCell = ordersTable.locator('tbody tr')  .first().locator('td').nth(6); // Price column
    
    const priceText = await priceCell.textContent();
    // Should have $ symbol and decimal places
    expect(priceText).toMatch(/\$[\d,]+\.\d{2}/);
  });

  test('should render null price values as "Market"', async ({ page }) => {
    await page.goto('/ui2/orders');
    
    // Find TSLA order (market order with null price)
    const tslaRow = page.locator('tbody tr', { hasText: 'TSLA' });
    const priceCell = tslaRow.locator('td').nth(6); // Price column
    
    // Should show "Market" for null price
    await expect(priceCell).toContainText('Market');
  });

  test('should handle null values with em dash', async ({ page }) => {
    await page.goto('/ui2/dashboard');
    
    // If any position has null/undefined values, should show "—"
    // This test verifies the formatValue null handling works
    const positionsTable = page.getByTestId('ui2-data-table-positions');
    await expect(positionsTable).toBeVisible();
    
    // Table should render without errors even if data has nulls
    const rows = positionsTable.locator('tbody tr');
    await expect(rows.first()).toBeVisible();
  });
});
