import { expect, test } from '@playwright/test';

/**
 * Trading Command Center — simplified HITL + arb radar.
 * Requires: phase1 API (:8010 or APEX_BACKEND_PORT) + frontend (:5100).
 */
test.describe('Command Center', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/ui2/command-center');
    await expect(page.getByTestId('autopilot-pipeline-page')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('hitl-review')).toBeVisible();
  });

  test('loads pipeline layers, arb tracker, and drift strip', async ({ page }) => {
    await expect(page.getByTestId('autopilot-pipeline-page')).toBeVisible();
    await expect(page.getByTestId('pipe-layers')).toBeVisible();
    await expect(page.getByTestId('autopilot-pipeline-page').getByTestId('arb-tracker')).toBeVisible();
    await expect(page.getByTestId('pipe-audit')).toBeVisible();
    const drift = page.getByTestId('hitl-drift');
    await expect(drift).toBeVisible();
    await expect(drift).not.toContainText('189.42');
  });

  test('run dry cycle then pre-authorize', async ({ page }) => {
    const runBtn = page.getByTestId('hitl-run-dry-cycle');
    await expect(runBtn).toBeEnabled();
    await runBtn.click();
    await expect(page.getByTestId('hitl-gates-badge')).toContainText('PASS', { timeout: 120_000 });

    const pre = page.getByTestId('hitl-pre-authorize');
    await expect(pre).toBeEnabled({ timeout: 10_000 });
    await pre.click();
    await expect(page.getByText(/PRE-AUTHORIZED/i)).toBeVisible({ timeout: 10_000 });
  });
});
