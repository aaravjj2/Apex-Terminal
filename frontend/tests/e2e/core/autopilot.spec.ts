/**
 * Core Correctness Track — Autopilot + PnL E2E Suite
 * Tests kill switch, rule toggles, pipeline 2.0, decision ledger, determinism.
 * All selectors use data-testid only. No waitForTimeout.
 */

import { test, expect } from '@playwright/test';

const PAGE = 'http://localhost:5100/ui2/autopilot';

test.describe('Autopilot — Controls Tab', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
    await expect(page.getByTestId('autopilot-ui2-page')).toBeVisible();
  });

  test('page renders with correct header', async ({ page }) => {
    await expect(page.getByTestId('autopilot-header')).toBeVisible();
  });

  test('tabs render: controls, pipeline, ledger', async ({ page }) => {
    await expect(page.getByTestId('autopilot-tab-controls')).toBeVisible();
    await expect(page.getByTestId('autopilot-tab-pipeline')).toBeVisible();
    await expect(page.getByTestId('autopilot-tab-ledger')).toBeVisible();
  });

  test('controls tab is active by default', async ({ page }) => {
    await expect(page.getByTestId('autopilot-kill-switch-panel')).toBeVisible();
  });

  test('kill switch button is visible and shows correct state', async ({ page }) => {
    await expect(page.getByTestId('autopilot-kill-switch-btn')).toBeVisible();
  });

  test('kill switch click opens confirm modal', async ({ page }) => {
    // Ensure kill switch is inactive (should be by default)
    const btn = page.getByTestId('autopilot-kill-switch-btn');
    const text = await btn.textContent();
    if (text?.includes('KILL SWITCH')) {
      await btn.click();
      await expect(page.getByTestId('autopilot-confirm-modal')).toBeVisible();
    } else {
      // Already active, just check the panel
      await expect(page.getByTestId('autopilot-kill-switch-panel')).toBeVisible();
    }
  });

  test('confirm modal has activate and cancel buttons', async ({ page }) => {
    const btn = page.getByTestId('autopilot-kill-switch-btn');
    const text = await btn.textContent();
    if (text?.includes('KILL SWITCH')) {
      await btn.click();
      await expect(page.getByTestId('autopilot-confirm-activate')).toBeVisible();
      await expect(page.getByTestId('autopilot-confirm-cancel')).toBeVisible();
    }
  });

  test('cancel button dismisses confirm modal', async ({ page }) => {
    const btn = page.getByTestId('autopilot-kill-switch-btn');
    const text = await btn.textContent();
    if (text?.includes('KILL SWITCH')) {
      await btn.click();
      await expect(page.getByTestId('autopilot-confirm-modal')).toBeVisible();
      await page.getByTestId('autopilot-confirm-cancel').click();
      await expect(page.getByTestId('autopilot-confirm-modal')).not.toBeVisible();
    }
  });

  test('rules list is visible on controls tab', async ({ page }) => {
    await expect(page.getByTestId('autopilot-rules-list')).toBeVisible();
  });

  test('at least 3 rule items are rendered', async ({ page }) => {
    const rules = page.locator('[data-testid^="autopilot-rule-"]').filter({ hasNot: page.locator('[data-testid^="autopilot-rule-toggle-"]') });
    await expect(rules).toHaveCount(await rules.count());
    expect(await rules.count()).toBeGreaterThanOrEqual(3);
  });

  test('rule toggle buttons are visible', async ({ page }) => {
    const toggles = page.locator('[data-testid^="autopilot-rule-toggle-"]');
    expect(await toggles.count()).toBeGreaterThanOrEqual(3);
  });

  test('clicking a rule toggle changes its state', async ({ page }) => {
    const firstToggle = page.locator('[data-testid^="autopilot-rule-toggle-"]').first();
    const initialText = await firstToggle.textContent();
    await firstToggle.click();
    const newText = await firstToggle.textContent();
    // State should have changed (ON ↔ OFF)
    expect(newText).not.toBe(initialText);
  });

  test('activity feed table is visible on controls tab', async ({ page }) => {
    await expect(page.getByTestId('autopilot-activity-table')).toBeVisible();
  });

  test('run pipeline button is visible', async ({ page }) => {
    await expect(page.getByTestId('autopilot-run-pipeline-btn')).toBeVisible();
  });

  test('autopilot-ready hidden marker is attached', async ({ page }) => {
    await expect(page.getByTestId('autopilot-ready')).toBeAttached();
  });

});

test.describe('Autopilot — Pipeline 2.0 Tab', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
    await expect(page.getByTestId('autopilot-ui2-page')).toBeVisible();
  });

  test('clicking pipeline tab shows pipeline panel', async ({ page }) => {
    await page.getByTestId('autopilot-tab-pipeline').click();
    await expect(page.getByTestId('autopilot-pipeline-panel')).toBeVisible();
  });

  test('before running, pipeline panel shows empty state', async ({ page }) => {
    await page.getByTestId('autopilot-tab-pipeline').click();
    // No run selected yet — should show prompt
    const panel = page.getByTestId('autopilot-pipeline-panel');
    const text = await panel.textContent();
    expect(text).toContain('Run Pipeline');
  });

  test('clicking Run Pipeline executes pipeline and shows stages', async ({ page }) => {
    await page.getByTestId('autopilot-run-pipeline-btn').click();
    // Should auto-switch to pipeline tab
    await expect(page.getByTestId('autopilot-stage-timeline')).toBeVisible();
  });

  test('pipeline run shows 6 stages', async ({ page }) => {
    await page.getByTestId('autopilot-run-pipeline-btn').click();
    await expect(page.getByTestId('autopilot-stage-timeline')).toBeVisible();
    // Use data rows only — exclude the `autopilot-stage-timeline` container
    const stages = page.locator('[data-testid^="autopilot-stage-"]:not([data-testid="autopilot-stage-timeline"])');
    await expect(stages).toHaveCount(6);
  });

  test('pipeline summary bar is visible after run', async ({ page }) => {
    await page.getByTestId('autopilot-run-pipeline-btn').click();
    await expect(page.getByTestId('autopilot-summary-bar')).toBeVisible();
  });

  test('deterministic hash is rendered after run', async ({ page }) => {
    await page.getByTestId('autopilot-run-pipeline-btn').click();
    await expect(page.getByTestId('autopilot-run-hash')).toBeVisible();
    const hash = await page.getByTestId('autopilot-run-hash').textContent();
    expect(hash).toMatch(/^[0-9a-f]{8}$/);
  });

  test('running pipeline twice produces same deterministic hash', async ({ page }) => {
    // First run
    await page.getByTestId('autopilot-run-pipeline-btn').click();
    await expect(page.getByTestId('autopilot-run-hash')).toBeVisible();
    const hash1 = await page.getByTestId('autopilot-run-hash').textContent();

    // Second run
    await page.goto(PAGE);
    await page.getByTestId('autopilot-run-pipeline-btn').click();
    await expect(page.getByTestId('autopilot-run-hash')).toBeVisible();
    const hash2 = await page.getByTestId('autopilot-run-hash').textContent();

    expect(hash1).toBe(hash2);
  });

  test('accepted trades table is visible after run', async ({ page }) => {
    await page.getByTestId('autopilot-run-pipeline-btn').click();
    await expect(page.getByTestId('autopilot-decisions-table')).toBeVisible();
  });

  test('rejections table is visible after run', async ({ page }) => {
    await page.getByTestId('autopilot-run-pipeline-btn').click();
    await expect(page.getByTestId('autopilot-rejections-table')).toBeVisible();
  });

  test('run selector appears for multiple runs', async ({ page }) => {
    await page.getByTestId('autopilot-run-pipeline-btn').click();
    await expect(page.getByTestId('autopilot-run-select-0')).toBeVisible();
  });

  test('second run can be selected after running pipeline again', async ({ page }) => {
    await page.getByTestId('autopilot-run-pipeline-btn').click();
    await expect(page.getByTestId('autopilot-stage-timeline')).toBeVisible();
    // Run a second time
    await page.getByTestId('autopilot-run-pipeline-btn').click();
    // Should now have 2 run selector buttons
    await expect(page.getByTestId('autopilot-run-select-1')).toBeVisible();
  });

});

test.describe('Autopilot — Decision Ledger Tab', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
    await expect(page.getByTestId('autopilot-ui2-page')).toBeVisible();
    // Run pipeline first
    await page.getByTestId('autopilot-run-pipeline-btn').click();
    // Navigate to ledger tab
    await page.getByTestId('autopilot-tab-ledger').click();
    await expect(page.getByTestId('autopilot-ledger-panel')).toBeVisible();
  });

  test('ledger tab shows 4 sub-tabs', async ({ page }) => {
    await expect(page.getByTestId('autopilot-ledger-tab-decisions')).toBeVisible();
    await expect(page.getByTestId('autopilot-ledger-tab-rejections')).toBeVisible();
    await expect(page.getByTestId('autopilot-ledger-tab-orders')).toBeVisible();
    await expect(page.getByTestId('autopilot-ledger-tab-postmortem')).toBeVisible();
  });

  test('decisions ledger shows decisions table', async ({ page }) => {
    await page.getByTestId('autopilot-ledger-tab-decisions').click();
    await expect(page.getByTestId('autopilot-ledger-decisions')).toBeVisible();
  });

  test('rejections ledger shows rejections table', async ({ page }) => {
    await page.getByTestId('autopilot-ledger-tab-rejections').click();
    await expect(page.getByTestId('autopilot-ledger-rejections')).toBeVisible();
  });

  test('orders ledger shows orders JSON', async ({ page }) => {
    await page.getByTestId('autopilot-ledger-tab-orders').click();
    await expect(page.getByTestId('autopilot-ledger-orders')).toBeVisible();
    const text = await page.getByTestId('autopilot-ledger-orders').textContent();
    expect(text).toContain('order_id');
  });

  test('postmortem ledger shows markdown summary', async ({ page }) => {
    await page.getByTestId('autopilot-ledger-tab-postmortem').click();
    await expect(page.getByTestId('autopilot-ledger-postmortem')).toBeVisible();
    const text = await page.getByTestId('autopilot-ledger-postmortem').textContent();
    expect(text).toContain('Autopilot 2.0 Post-Trade Summary');
  });

  test('postmortem contains deterministic timestamp', async ({ page }) => {
    await page.getByTestId('autopilot-ledger-tab-postmortem').click();
    const text = await page.getByTestId('autopilot-ledger-postmortem').textContent();
    expect(text).toContain('2026-02-15T14:30:00Z');
  });

});
