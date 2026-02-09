import { test, expect } from '@playwright/test';

test('check page loads without critical errors', async ({ page }) => {
    const criticalErrors: string[] = [];
    const failedRequests: string[] = [];

    page.on('console', msg => {
        const text = msg.text();
        // Only track critical errors (not WS disconnects or backend fetch errors which are expected without backend)
        if (msg.type() === 'error' && 
            !text.includes('WebSocket') && 
            !text.includes('WS Error') &&
            !text.includes('ERR_CONNECTION_REFUSED') &&
            !text.includes('Failed to fetch') &&
            !text.includes('clock state') &&
            !text.includes('fetch drawings')
        ) {
            criticalErrors.push(`[${msg.type()}] ${text}`);
            console.log(`Console Error: ${text}`);
        }
    });

    page.on('pageerror', err => {
        // React errors and other critical page errors (not network issues)
        if (!err.message.includes('WebSocket') && 
            !err.message.includes('Failed to fetch') &&
            !err.message.includes('ERR_CONNECTION_REFUSED')
        ) {
            criticalErrors.push(`Page Error: ${err.message}`);
            console.log(`Page Error: ${err.message}`);
        }
    });

    page.on('requestfailed', request => {
        const failure = request.failure();
        const url = request.url();
        // Only fail if it's NOT a websocket and NOT expected backend absence
        if (!url.includes('ws://') && !url.includes('8000') && !url.includes('localhost')) {
            const errorText = `Request failed: ${url} - ${failure?.errorText || 'Unknown error'}`;
            failedRequests.push(errorText);
            console.log(errorText);
        }
    });

    await page.goto('index.html');

    // Wait for page to stabilize
    await page.waitForTimeout(2000);

    // Verify shell renders
    await page.waitForTimeout(2000);
    await expect(page.locator('header.bg-panel-bg, nav, [data-testid="nav-item-monitor"]').first()).toBeVisible({ timeout: 10000 });

    // Assert no critical page errors (ignore WS)
    expect(criticalErrors, 'Should have no critical errors').toEqual([]);

    // Assert no failed HTTP requests (WS excluded)
    expect(failedRequests, 'Should have no failed HTTP requests').toEqual([]);
});
