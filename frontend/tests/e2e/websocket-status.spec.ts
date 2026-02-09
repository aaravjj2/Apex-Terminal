import { test, expect } from '@playwright/test';

test('AIPanel shows WebSocket Status section', async ({ page }) => {
    // Go to app root
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // WebSocket status pill is in the top app bar, visible on any page
    await page.waitForTimeout(500);

    // Verify the ws-status-pill is visible in the top bar
    const statusPill = page.getByTestId('ws-status-pill');
    await expect(statusPill).toBeVisible({ timeout: 10000 });

    // Verify a data-ws-status attribute is present (connected, disconnected, connecting, etc.)
    const wsStatus = await statusPill.getAttribute('data-ws-status');
    expect(wsStatus).toBeTruthy();

    // Take a screenshot for manual verification
    await page.screenshot({ path: 'test-results/snapshots/websocket-status.png', fullPage: false });
});