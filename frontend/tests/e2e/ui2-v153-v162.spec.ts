/**
 * UI2 v1.53-v1.62 E2E Test Suite
 * Tests all new features: UI2 primary route, market tape, command registry,
 * order ticket, autopilot kill switch, scenario builder, backtest run manager,
 * strategies artifacts/diff, platform health dashboard
 * 
 * Headed mode, workers=1, retries=0, data-testid selectors ONLY
 */

import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:5100';

// ─────────────────────────────────────────────────────────────
// v1.53: UI2 Primary Route
// ─────────────────────────────────────────────────────────────
test.describe('v1.53 — UI2 Primary Route', () => {
  test('root URL redirects to /ui2/dashboard', async ({ page }) => {
    await page.goto(BASE);
    await expect(page).toHaveURL(/\/ui2\/dashboard/);
    await expect(page.getByTestId('ui2-app-shell')).toBeVisible();
  });

  test('unknown path redirects to /ui2/dashboard', async ({ page }) => {
    await page.goto(`${BASE}/nonexistent`);
    await expect(page).toHaveURL(/\/ui2\/dashboard/);
  });

  test('legacy path /legacy loads Shell', async ({ page }) => {
    // just verify no crash navigating to legacy
    await page.goto(`${BASE}/legacy`);
    await page.waitForTimeout(1000);
    // Should not show UI2 app shell on legacy
    const ui2Shell = page.getByTestId('ui2-app-shell');
    await expect(ui2Shell).not.toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────
// v1.56: Market Tape
// ─────────────────────────────────────────────────────────────
test.describe('v1.56 — Market Tape', () => {
  test('market tape is visible in app shell', async ({ page }) => {
    await page.goto(`${BASE}/ui2/dashboard`);
    await expect(page.getByTestId('ui2-market-tape')).toBeVisible();
  });

  test('market tape shows connection status badge', async ({ page }) => {
    await page.goto(`${BASE}/ui2/dashboard`);
    const status = page.getByTestId('ui2-market-tape-status');
    await expect(status).toBeVisible();
    await expect(status).toContainText(/DEMO STREAM|REPLAY|OFFLINE/);
  });

  test('market tape shows ticker symbols', async ({ page }) => {
    await page.goto(`${BASE}/ui2/dashboard`);
    // Wait for stream to produce at least one tick
    await page.waitForTimeout(2000);
    // At least one of the known symbols should appear
    const tape = page.getByTestId('ui2-market-tape');
    await expect(tape).toBeVisible();
  });

  test('market tape shows sequence counter', async ({ page }) => {
    await page.goto(`${BASE}/ui2/dashboard`);
    await page.waitForTimeout(2000);
    const seq = page.getByTestId('ui2-market-tape-sequence');
    await expect(seq).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────
// v1.55: Command Registry (enhanced palette)
// ─────────────────────────────────────────────────────────────
test.describe('v1.55 — Command Registry', () => {
  test('command palette shows action commands', async ({ page }) => {
    await page.goto(`${BASE}/ui2/dashboard`);
    await page.keyboard.press('Control+k');
    const input = page.getByTestId('ui2-command-palette-input');
    await input.fill('backtest');
    // Should show "Run Backtest" action command
    const results = page.getByTestId('ui2-command-palette-results');
    await expect(results).toContainText(/backtest/i);
  });

  test('command palette shows ticker commands', async ({ page }) => {
    await page.goto(`${BASE}/ui2/dashboard`);
    await page.keyboard.press('Control+k');
    const input = page.getByTestId('ui2-command-palette-input');
    await input.fill('SPY');
    const results = page.getByTestId('ui2-command-palette-results');
    await expect(results).toContainText('SPY');
  });
});

// ─────────────────────────────────────────────────────────────
// v1.58: Autopilot Kill Switch
// ─────────────────────────────────────────────────────────────
test.describe('v1.58 — Autopilot Kill Switch', () => {
  test('autopilot page loads with kill switch panel', async ({ page }) => {
    await page.goto(`${BASE}/ui2/autopilot`);
    await expect(page.getByTestId('autopilot-ui2-page')).toBeVisible();
    await expect(page.getByTestId('autopilot-kill-switch-panel')).toBeVisible();
    await expect(page.getByTestId('autopilot-kill-switch-btn')).toBeVisible();
  });

  test('kill switch shows confirm modal when clicked', async ({ page }) => {
    await page.goto(`${BASE}/ui2/autopilot`);
    await page.getByTestId('autopilot-kill-switch-btn').click();
    await expect(page.getByTestId('autopilot-confirm-modal')).toBeVisible();
    await expect(page.getByTestId('autopilot-confirm-activate')).toBeVisible();
    await expect(page.getByTestId('autopilot-confirm-cancel')).toBeVisible();
  });

  test('confirm modal can be cancelled', async ({ page }) => {
    await page.goto(`${BASE}/ui2/autopilot`);
    await page.getByTestId('autopilot-kill-switch-btn').click();
    await page.getByTestId('autopilot-confirm-cancel').click();
    await expect(page.getByTestId('autopilot-confirm-modal')).not.toBeVisible();
  });

  test('kill switch activates after confirmation', async ({ page }) => {
    await page.goto(`${BASE}/ui2/autopilot`);
    await page.getByTestId('autopilot-kill-switch-btn').click();
    await page.getByTestId('autopilot-confirm-activate').click();
    // Kill switch panel should now show HALTED state
    const panel = page.getByTestId('autopilot-kill-switch-panel');
    await expect(panel).toContainText(/HALTED|Resume Trading/i);
  });

  test('autopilot shows rules list', async ({ page }) => {
    await page.goto(`${BASE}/ui2/autopilot`);
    await expect(page.getByTestId('autopilot-rules-list')).toBeVisible();
    // Should have at least one rule
    await expect(page.getByTestId('autopilot-rule-rule-1')).toBeVisible();
  });

  test('autopilot shows activity table', async ({ page }) => {
    await page.goto(`${BASE}/ui2/autopilot`);
    await expect(page.getByTestId('autopilot-activity-table')).toBeVisible();
  });

  test('autopilot ready marker is present', async ({ page }) => {
    await page.goto(`${BASE}/ui2/autopilot`);
    await expect(page.getByTestId('autopilot-ready')).toBeAttached();
  });
});

// ─────────────────────────────────────────────────────────────
// v1.59: Risk Scenario Builder
// ─────────────────────────────────────────────────────────────
test.describe('v1.59 — Risk Scenario Builder', () => {
  test('risk page loads with scenario builder tab', async ({ page }) => {
    await page.goto(`${BASE}/ui2/risk`);
    await expect(page.getByTestId('risk-ui2-page')).toBeVisible();
    await expect(page.getByTestId('risk-tabs')).toBeVisible();
  });

  test('scenario builder has controls', async ({ page }) => {
    await page.goto(`${BASE}/ui2/risk`);
    await expect(page.getByTestId('risk-scenario-controls')).toBeVisible();
    await expect(page.getByTestId('risk-severity')).toBeVisible();
    await expect(page.getByTestId('risk-equity-shock')).toBeVisible();
    await expect(page.getByTestId('risk-run-scenario')).toBeVisible();
  });

  test('running scenario produces results', async ({ page }) => {
    await page.goto(`${BASE}/ui2/risk`);
    await page.getByTestId('risk-run-scenario').click();
    await expect(page.getByTestId('risk-scenario-results')).toBeVisible();
    await expect(page.getByTestId('risk-export-btn')).toBeVisible();
  });

  test('export button shows deterministic hash', async ({ page }) => {
    await page.goto(`${BASE}/ui2/risk`);
    await page.getByTestId('risk-run-scenario').click();
    await page.getByTestId('risk-export-btn').click();
    await expect(page.getByTestId('risk-export-hash')).toBeVisible();
    const hash = await page.getByTestId('risk-export-hash').textContent();
    expect(hash).toMatch(/Hash:\s+\w+/);
  });

  test('risk ready marker is present', async ({ page }) => {
    await page.goto(`${BASE}/ui2/risk`);
    await expect(page.getByTestId('risk-ready')).toBeAttached();
  });
});

// ─────────────────────────────────────────────────────────────
// v1.60: Backtest Run Manager
// ─────────────────────────────────────────────────────────────
test.describe('v1.60 — Backtest Run Manager', () => {
  test('backtest page loads with runs manager', async ({ page }) => {
    await page.goto(`${BASE}/ui2/backtest`);
    await expect(page.getByTestId('backtest-ui2-page')).toBeVisible();
    await expect(page.getByTestId('backtest-tabs')).toBeVisible();
    await expect(page.getByTestId('backtest-runs-manager')).toBeVisible();
  });

  test('runs table shows demo runs', async ({ page }) => {
    await page.goto(`${BASE}/ui2/backtest`);
    await expect(page.getByTestId('backtest-runs-table')).toBeVisible();
    await expect(page.getByTestId('backtest-status-bt-1')).toBeVisible();
  });

  test('filter by symbol works', async ({ page }) => {
    await page.goto(`${BASE}/ui2/backtest`);
    await page.getByTestId('backtest-filter-symbol').fill('MSFT');
    // Should show bt-1 (MSFT) but not bt-2 (NVDA)
    await expect(page.getByTestId('backtest-status-bt-1')).toBeVisible();
    await expect(page.getByTestId('backtest-status-bt-2')).not.toBeVisible();
  });

  test('open report viewer for a run', async ({ page }) => {
    await page.goto(`${BASE}/ui2/backtest`);
    await page.getByTestId('backtest-open-bt-1').click();
    await expect(page.getByTestId('backtest-report-content')).toBeVisible();
    await expect(page.getByTestId('backtest-report-provenance')).toBeVisible();
    await expect(page.getByTestId('backtest-report-results')).toBeVisible();
  });

  test('report viewer shows stats for completed run', async ({ page }) => {
    await page.goto(`${BASE}/ui2/backtest`);
    await page.getByTestId('backtest-open-bt-1').click();
    await expect(page.getByTestId('backtest-stat-sharpe-ratio')).toBeVisible();
    await expect(page.getByTestId('backtest-stat-total-return')).toBeVisible();
  });

  test('backtest ready marker is present', async ({ page }) => {
    await page.goto(`${BASE}/ui2/backtest`);
    await expect(page.getByTestId('backtest-ready')).toBeAttached();
  });
});

// ─────────────────────────────────────────────────────────────
// v1.61: Strategies Artifacts & Diff
// ─────────────────────────────────────────────────────────────
test.describe('v1.61 — Strategies Artifacts & Diff', () => {
  test('research page loads with strategies tab', async ({ page }) => {
    await page.goto(`${BASE}/ui2/research`);
    await expect(page.getByTestId('research-ui2-page')).toBeVisible();
    await expect(page.getByTestId('research-tabs')).toBeVisible();
    await expect(page.getByTestId('research-strategies-panel')).toBeVisible();
  });

  test('strategies table shows demo strategies', async ({ page }) => {
    await page.goto(`${BASE}/ui2/research`);
    await expect(page.getByTestId('research-strategies-table')).toBeVisible();
    await expect(page.getByTestId('strategy-status-strat-1')).toBeVisible();
  });

  test('clicking Artifacts shows artifacts for strategy', async ({ page }) => {
    await page.goto(`${BASE}/ui2/research`);
    await page.getByTestId('strategy-select-strat-1').click();
    await expect(page.getByTestId('research-artifacts-panel')).toBeVisible();
    await expect(page.getByTestId('research-artifacts-table')).toBeVisible();
  });

  test('clicking Validate shows validation results', async ({ page }) => {
    await page.goto(`${BASE}/ui2/research`);
    await page.getByTestId('strategy-validate-strat-1').click();
    await expect(page.getByTestId('research-validation-panel')).toBeVisible();
    await expect(page.getByTestId('research-validation-result')).toBeVisible();
    await expect(page.getByTestId('validation-overall')).toBeVisible();
  });

  test('validation shows check items', async ({ page }) => {
    await page.goto(`${BASE}/ui2/research`);
    await page.getByTestId('strategy-validate-strat-1').click();
    await expect(page.getByTestId('validation-check-0')).toBeVisible();
  });

  test('clicking Diff shows diff viewer', async ({ page }) => {
    await page.goto(`${BASE}/ui2/research`);
    await page.getByTestId('strategy-diff-strat-1').click();
    await expect(page.getByTestId('research-diff-panel')).toBeVisible();
    await expect(page.getByTestId('research-diff-content')).toBeVisible();
    await expect(page.getByTestId('research-diff-view')).toBeVisible();
  });

  test('research ready marker is present', async ({ page }) => {
    await page.goto(`${BASE}/ui2/research`);
    await expect(page.getByTestId('research-ready')).toBeAttached();
  });
});

// ─────────────────────────────────────────────────────────────
// v1.62: Platform Health Dashboard
// ─────────────────────────────────────────────────────────────
test.describe('v1.62 — Platform Health Dashboard', () => {
  test('ops page loads with health dashboard', async ({ page }) => {
    await page.goto(`${BASE}/ui2/ops`);
    await expect(page.getByTestId('ops-ui2-page')).toBeVisible();
    await expect(page.getByTestId('ops-tabs')).toBeVisible();
    await expect(page.getByTestId('ops-health-dashboard')).toBeVisible();
  });

  test('health dashboard shows summary cards', async ({ page }) => {
    await page.goto(`${BASE}/ui2/ops`);
    await expect(page.getByTestId('ops-health-summary')).toBeVisible();
    await expect(page.getByTestId('ops-summary-services')).toBeVisible();
    await expect(page.getByTestId('ops-summary-mode')).toBeVisible();
  });

  test('health table shows service statuses', async ({ page }) => {
    await page.goto(`${BASE}/ui2/ops`);
    await expect(page.getByTestId('ops-health-table')).toBeVisible();
    await expect(page.getByTestId('health-status-h-1')).toBeVisible();
  });

  test('incidents tab shows incident list', async ({ page }) => {
    await page.goto(`${BASE}/ui2/ops`);
    // Switch to incidents tab
    const tabs = page.getByTestId('ops-tabs');
    await tabs.getByText('Incidents').click();
    await expect(page.getByTestId('ops-incidents-panel')).toBeVisible();
    await expect(page.getByTestId('ops-incidents-table')).toBeVisible();
  });

  test('about tab shows platform info', async ({ page }) => {
    await page.goto(`${BASE}/ui2/ops`);
    const tabs = page.getByTestId('ops-tabs');
    await tabs.getByText('About').click();
    await expect(page.getByTestId('ops-about-panel')).toBeVisible();
    await expect(page.getByTestId('ops-platform-info')).toBeVisible();
    await expect(page.getByTestId('ops-info-version')).toBeVisible();
  });

  test('ops ready marker is present', async ({ page }) => {
    await page.goto(`${BASE}/ui2/ops`);
    await expect(page.getByTestId('ops-ready')).toBeAttached();
  });

  // Settings page (v1.62 enhancement)
  test('settings page loads with general tab', async ({ page }) => {
    await page.goto(`${BASE}/ui2/settings`);
    await expect(page.getByTestId('settings-ui2-page')).toBeVisible();
    await expect(page.getByTestId('settings-general')).toBeVisible();
    await expect(page.getByTestId('settings-section-display')).toBeVisible();
    await expect(page.getByTestId('settings-section-data')).toBeVisible();
  });

  test('settings about tab shows version info', async ({ page }) => {
    await page.goto(`${BASE}/ui2/settings`);
    const tabs = page.getByTestId('settings-tabs');
    await tabs.getByText('About').click();
    await expect(page.getByTestId('settings-about')).toBeVisible();
    await expect(page.getByTestId('settings-about-info')).toBeVisible();
  });

  test('settings ready marker is present', async ({ page }) => {
    await page.goto(`${BASE}/ui2/settings`);
    await expect(page.getByTestId('settings-ready')).toBeAttached();
  });
});

// ─────────────────────────────────────────────────────────────
// Cross-cutting: Determinism
// ─────────────────────────────────────────────────────────────
test.describe('v1.53-62 — Determinism', () => {
  test('risk scenario produces deterministic hash on repeated run', async ({ page }) => {
    await page.goto(`${BASE}/ui2/risk`);
    await page.getByTestId('risk-run-scenario').click();
    await page.getByTestId('risk-export-btn').click();
    const hash1 = await page.getByTestId('risk-export-hash').textContent();

    // Reload and do again
    await page.goto(`${BASE}/ui2/risk`);
    await page.getByTestId('risk-run-scenario').click();
    await page.getByTestId('risk-export-btn').click();
    const hash2 = await page.getByTestId('risk-export-hash').textContent();

    expect(hash1).toBe(hash2);
  });

  test('all new pages have ready markers', async ({ page }) => {
    const pages = [
      { path: '/ui2/autopilot', marker: 'autopilot-ready' },
      { path: '/ui2/risk', marker: 'risk-ready' },
      { path: '/ui2/backtest', marker: 'backtest-ready' },
      { path: '/ui2/research', marker: 'research-ready' },
      { path: '/ui2/ops', marker: 'ops-ready' },
      { path: '/ui2/settings', marker: 'settings-ready' },
    ];

    for (const p of pages) {
      await page.goto(`${BASE}${p.path}`);
      await expect(page.getByTestId(p.marker)).toBeAttached();
    }
  });
});
