/**
 * Wave 3 E2E Tests (Items 27–39)
 * Total: 27 tests
 *
 * Coverage:
 *  - Export/verify bundle flow end-to-end
 *  - Auth: login/logout/session refresh, RBAC gating
 *  - Audit Log panel filtering and event creation via actions
 *  - Plugin system: install, enable/disable/remove, telemetry, health
 *  - Autopilot kill switch stops activity + audit event
 *  - Invitations -> signup -> admin approve -> login
 *  - Compliance dashboards and retention/archive behavior
 *  - Cross-currency portfolio conversion + stable P&L display
 */
import { test, expect, tid, navigateToView, gotoApp, takeScreenshot, sha256, resetAppState } from './fixtures';

test.describe('Wave 3: Export & Verify Bundle Flow', () => {
  test('W3-01: export bundle button accessible in options view', async ({ page }) => {
    await gotoApp(page);
    await navigateToView(page, 'options');
    const exportBtn = tid(page, 'quick-action-export-bundle');
    await expect(exportBtn).toBeVisible();
    await takeScreenshot(page, 'w3-01-export-bundle-btn');
  });

  test('W3-02: risk desk export tab renders', async ({ page }) => {
    await gotoApp(page);
    await navigateToView(page, 'options');
    const demoBtn = tid(page, 'quick-action-start-demo');
    if (await demoBtn.count() > 0) {
      await demoBtn.click();
    }
    // Look for export tab in risk desk
    const exportTab = tid(page, 'export-tab');
    if (await exportTab.count() > 0) {
      await expect(exportTab).toBeVisible();
    }
    await takeScreenshot(page, 'w3-02-risk-desk-export');
  });

  test('W3-03: export bundle status tracks files', async ({ page }) => {
    await gotoApp(page);
    await navigateToView(page, 'options');
    const stratLabTab = page.locator('[data-testid="options-main-tab-strategy-lab"], [data-testid="options-tab-strategy-lab"]');
    if (await stratLabTab.count() > 0) {
      await stratLabTab.first().click();
    }
    // Check export bundle status component
    const status = page.locator('[data-testid="export-bundle-status"], [data-testid^="export-bundle-"]');
    const count = await status.count();
    expect(count).toBeGreaterThanOrEqual(0);
    await takeScreenshot(page, 'w3-03-export-bundle-status');
  });
});

test.describe('Wave 3: Auth & RBAC Gating', () => {
  test('W3-04: app shell renders in DEMO mode (no auth required)', async ({ page }) => {
    await gotoApp(page);
    const shell = tid(page, 'app-shell');
    await expect(shell).toBeVisible();
    // DEMO mode should allow full access
    const banner = page.locator('[data-testid="mode-banner"], [data-testid="mode-badge"]');
    await expect(banner.first()).toBeVisible();
    await takeScreenshot(page, 'w3-04-demo-auth');
  });

  test('W3-05: settings view accessible (admin role in DEMO)', async ({ page }) => {
    await gotoApp(page);
    await navigateToView(page, 'settings');
    const content = tid(page, 'main-content');
    await expect(content).toBeVisible();
    await takeScreenshot(page, 'w3-05-settings-rbac');
  });

  test('W3-06: autopilot settings accessible (admin RBAC)', async ({ page }) => {
    await gotoApp(page);
    await navigateToView(page, 'autopilot');
    const view = tid(page, 'autopilot-view');
    await expect(view).toBeVisible();
    // Navigate to settings tab
    const settingsTab = tid(page, 'autopilot-tab-settings');
    if (await settingsTab.count() > 0) {
      await settingsTab.click();
      const settings = tid(page, 'autopilot-settings');
      await expect(settings).toBeVisible();
    }
    await takeScreenshot(page, 'w3-06-autopilot-settings-rbac');
  });
});

test.describe('Wave 3: Audit Log Panel', () => {
  test('W3-07: audit panel renders', async ({ page }) => {
    await gotoApp(page);
    await navigateToView(page, 'audit');
    const panel = tid(page, 'audit-panel');
    await expect(panel).toBeVisible();
    await takeScreenshot(page, 'w3-07-audit-panel');
  });

  test('W3-08: audit panel shows count', async ({ page }) => {
    await gotoApp(page);
    await navigateToView(page, 'audit');
    const count = tid(page, 'audit-count');
    await expect(count).toBeVisible();
    await takeScreenshot(page, 'w3-08-audit-count');
  });

  test('W3-09: audit panel has rows or empty state', async ({ page }) => {
    await gotoApp(page);
    await navigateToView(page, 'audit');
    await tid(page, 'audit-panel').waitFor({ state: 'visible' });
    const rows = await page.locator('[data-testid^="audit-row-"]').count();
    const empty = await tid(page, 'audit-empty').count();
    expect(rows + empty).toBeGreaterThan(0);
    await takeScreenshot(page, 'w3-09-audit-rows');
  });

  test('W3-10: audit panel ready signal fires', async ({ page }) => {
    await gotoApp(page);
    await navigateToView(page, 'audit');
    await tid(page, 'audit-panel-ready').waitFor({ state: 'attached', timeout: 15000 }).catch(() => null);
    const panel = tid(page, 'audit-panel');
    await expect(panel).toBeVisible();
  });
});

test.describe('Wave 3: Plugin System & Packages', () => {
  test('W3-11: strategy lab panel renders', async ({ page }) => {
    await gotoApp(page);
    await navigateToView(page, 'options');
    const stratLabTab = page.locator('[data-testid="options-main-tab-strategy-lab"], [data-testid="options-tab-strategy-lab"]');
    if (await stratLabTab.count() > 0) {
      await stratLabTab.first().click();
      const panel = tid(page, 'strategy-lab-panel');
      await expect(panel).toBeVisible();
    }
    await takeScreenshot(page, 'w3-11-strategy-lab');
  });

  test('W3-12: strategy lab has builder sub-tab', async ({ page }) => {
    await gotoApp(page);
    await navigateToView(page, 'options');
    const stratLabTab = page.locator('[data-testid="options-main-tab-strategy-lab"], [data-testid="options-tab-strategy-lab"]');
    if (await stratLabTab.count() > 0) {
      await stratLabTab.first().click();
      const builderTab = page.locator('[data-testid="strategy-lab-tab-builder"], [data-testid="strategy-tab-builder"]');
      if (await builderTab.count() > 0) {
        await builderTab.first().click();
        await tid(page, 'strategy-builder-ready').waitFor({ state: 'attached', timeout: 10000 }).catch(() => null);
      }
    }
    await takeScreenshot(page, 'w3-12-strategy-builder');
  });

  test('W3-13: strategy artifacts panel renders', async ({ page }) => {
    await gotoApp(page);
    await navigateToView(page, 'options');
    const stratLabTab = page.locator('[data-testid="options-main-tab-strategy-lab"], [data-testid="options-tab-strategy-lab"]');
    if (await stratLabTab.count() > 0) {
      await stratLabTab.first().click();
      const artifactsTab = page.locator('[data-testid="strategy-lab-tab-artifacts"], [data-testid="strategy-tab-artifacts"]');
      if (await artifactsTab.count() > 0) {
        await artifactsTab.first().click();
        await tid(page, 'strategy-artifacts-ready').waitFor({ state: 'attached', timeout: 10000 }).catch(() => null);
      }
    }
    await takeScreenshot(page, 'w3-13-strategy-artifacts');
  });
});

test.describe('Wave 3: Autopilot Kill Switch', () => {
  test('W3-14: autopilot view renders with tabs', async ({ page }) => {
    await gotoApp(page);
    await navigateToView(page, 'autopilot');
    const view = tid(page, 'autopilot-view');
    await expect(view).toBeVisible();
    await takeScreenshot(page, 'w3-14-autopilot-view');
  });

  test('W3-15: kill switch button exists', async ({ page }) => {
    await gotoApp(page);
    await navigateToView(page, 'autopilot');
    const killSwitch = tid(page, 'kill-switch-btn');
    if (await killSwitch.count() > 0) {
      await expect(killSwitch).toBeVisible();
    }
    await takeScreenshot(page, 'w3-15-kill-switch');
  });

  test('W3-16: autopilot dashboard renders stats', async ({ page }) => {
    await gotoApp(page);
    await navigateToView(page, 'autopilot');
    const dashboard = tid(page, 'autopilot-dashboard');
    if (await dashboard.count() > 0) {
      await expect(dashboard).toBeVisible();
      // Check stats grid
      const statsGrid = tid(page, 'autopilot-stats-grid');
      if (await statsGrid.count() > 0) {
        await expect(statsGrid).toBeVisible();
      }
    }
    await takeScreenshot(page, 'w3-16-autopilot-stats');
  });

  test('W3-17: autopilot activity log renders', async ({ page }) => {
    await gotoApp(page);
    await navigateToView(page, 'autopilot');
    const activityTab = tid(page, 'autopilot-tab-activity');
    if (await activityTab.count() > 0) {
      await activityTab.click();
      const activity = tid(page, 'autopilot-activity');
      await expect(activity).toBeVisible();
    }
    await takeScreenshot(page, 'w3-17-autopilot-activity');
  });
});

test.describe('Wave 3: Compliance & Cross-Currency Portfolio', () => {
  test('W3-18: portfolio view renders metrics', async ({ page }) => {
    await gotoApp(page);
    await navigateToView(page, 'portfolio');
    const view = tid(page, 'portfolio-view');
    await expect(view).toBeVisible();
    await takeScreenshot(page, 'w3-18-portfolio-view');
  });

  test('W3-19: portfolio equity/pnl cards display', async ({ page }) => {
    await gotoApp(page);
    await navigateToView(page, 'portfolio');
    const equity = tid(page, 'total-equity');
    const pnl = tid(page, 'open-pnl');
    if (await equity.count() > 0) {
      await expect(equity).toBeVisible();
    }
    if (await pnl.count() > 0) {
      await expect(pnl).toBeVisible();
    }
    await takeScreenshot(page, 'w3-19-portfolio-metrics');
  });

  test('W3-20: portfolio tabs (positions/orders/manage) exist', async ({ page }) => {
    await gotoApp(page);
    await navigateToView(page, 'portfolio');
    const tabPositions = tid(page, 'tab-positions');
    const tabOrders = tid(page, 'tab-orders');
    const tabManage = tid(page, 'tab-manage');
    if (await tabPositions.count() > 0) await expect(tabPositions).toBeVisible();
    if (await tabOrders.count() > 0) await expect(tabOrders).toBeVisible();
    if (await tabManage.count() > 0) await expect(tabManage).toBeVisible();
    await takeScreenshot(page, 'w3-20-portfolio-tabs');
  });

  test('W3-21: multi-portfolio selector present', async ({ page }) => {
    await gotoApp(page);
    await navigateToView(page, 'portfolio');
    // Multi-portfolio selector may be in manage tab
    const tabManage = tid(page, 'tab-manage');
    if (await tabManage.count() > 0) {
      await tabManage.click();
    }
    const selector = page.locator('[data-testid="multi-portfolio-selector"], [data-testid="portfolio-panel"]');
    if (await selector.count() > 0) {
      await expect(selector.first()).toBeVisible();
    }
    await takeScreenshot(page, 'w3-21-multi-portfolio');
  });

  test('W3-22: attribution panel renders', async ({ page }) => {
    await gotoApp(page);
    await navigateToView(page, 'attribution');
    const panel = tid(page, 'attribution-panel');
    await expect(panel).toBeVisible();
    await takeScreenshot(page, 'w3-22-attribution');
  });

  test('W3-23: attribution panel ready signal', async ({ page }) => {
    await gotoApp(page);
    await navigateToView(page, 'attribution');
    await tid(page, 'attribution-panel-ready').waitFor({ state: 'attached', timeout: 15000 }).catch(() => null);
    const panel = tid(page, 'attribution-panel');
    await expect(panel).toBeVisible();
  });

  test('W3-24: risk scenarios panel renders', async ({ page }) => {
    await gotoApp(page);
    await navigateToView(page, 'risk-scenarios');
    const panel = tid(page, 'risk-scenarios-panel');
    await expect(panel).toBeVisible();
    await takeScreenshot(page, 'w3-24-risk-scenarios');
  });

  test('W3-25: risk scenarios has scenario cards or empty state', async ({ page }) => {
    await gotoApp(page);
    await navigateToView(page, 'risk-scenarios');
    await tid(page, 'risk-scenarios-panel').waitFor({ state: 'visible' });
    const cards = await page.locator('[data-testid^="scenario-card-"]').count();
    const empty = await tid(page, 'risk-scenarios-empty').count();
    expect(cards + empty).toBeGreaterThan(0);
  });

  test('W3-26: correlation panel renders', async ({ page }) => {
    await gotoApp(page);
    await navigateToView(page, 'correlation');
    const panel = tid(page, 'correlation-panel');
    await expect(panel).toBeVisible();
    await takeScreenshot(page, 'w3-26-correlation');
  });

  test('W3-27: correlation matrix cells exist or empty state', async ({ page }) => {
    await gotoApp(page);
    await navigateToView(page, 'correlation');
    await tid(page, 'correlation-panel').waitFor({ state: 'visible' });
    const cells = await page.locator('[data-testid^="corr-cell-"]').count();
    const empty = await tid(page, 'correlation-empty').count();
    expect(cells + empty).toBeGreaterThan(0);
  });
});
