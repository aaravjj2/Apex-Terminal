import { test, expect } from '@playwright/test';

test.describe('Canonical P1 Contract', () => {
    test.beforeEach(async ({ page }) => {
        page.on('console', msg => console.log(`BROWSER: ${msg.text()}`));
        page.on('pageerror', err => console.log(`BROWSER ERROR: ${err}`));
        // 1. Load with e2e flag to ensure deterministic mode
        await page.goto('http://127.0.0.1:5100/?e2e=1');
    });

    test('should enter deterministic mode and connect websockets', async ({ page }) => {
        // Verify E2E mode class
        await expect(page.locator('body')).toHaveClass(/e2e-mode/);

        // Verify Data Feed connects
        // Wait for Status Indicator to reflect CONNECTED state via data attribute
        const indicator = page.getByTestId('ws-status-pill');
        await expect(indicator).toHaveAttribute('data-ws-status', 'CONNECTED', { timeout: 20000 });
    });

    test('should trigger strategy run', async ({ page }) => {
        // Verify E2E mode
        await expect(page.locator('body')).toHaveClass(/e2e-mode/);

        // Find and click start button (Autopilot toggle)
        const startBtn = page.getByTestId('autopilot-toggle');
        await expect(startBtn).toBeVisible();
        await startBtn.click();

        // Ensure UI doesn't crash on click
    });

    test('should handle websocket disconnect and reconnect', async ({ page }) => {
        // 1. Initial State: Connected
        const indicator = page.getByTestId('ws-status-pill');
        await expect(indicator).toHaveAttribute('data-ws-status', 'CONNECTED', { timeout: 20000 });

        // 2. Simulate Network Offline
        await page.context().setOffline(true);

        // 3. Verify Disconnection
        // Note: WebSocket might take a moment to realize it's closed depending on browser implementation
        // or we might need to wait for the heartbeat.
        // For the sake of speed in E2E, we might see it stay CONNECTED until timeout if we don't force it.
        // onclose/error fairly quickly in modern browsers.
        // We look for NOT connected.
        // NOTE: Heartbeat timeout is 35s, so we must wait at least that long if immediate close doesn't happen.
        await expect(indicator).not.toHaveAttribute('data-ws-status', 'CONNECTED', { timeout: 40000 });

        // 4. Simulate Network Online
        await page.context().setOffline(false);

        // 5. Verify Reconnection
        await expect(indicator).toHaveAttribute('data-ws-status', 'CONNECTED', { timeout: 30000 });
    });
});
