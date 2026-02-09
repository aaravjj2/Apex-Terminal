import { test, expect } from '@playwright/test';

test('capture autopilot evidence', async ({ page }) => {
    // 1. Go to app root (or autopilot directly, but let's click to be sure)
    await page.goto('http://localhost:5173/');

    // 2. Click Autopilot Nav Item
    await page.getByTestId('nav-item-autopilot').click();

    // 3. Wait for new dashboard
    await page.waitForSelector('[data-testid="autopilot-dashboard"]', { timeout: 10000 });

    // 4. Take Dashboard Screenshot
    await page.screenshot({ path: 'final_dashboard.png', fullPage: true });

    // 5. Click Universe Button
    await page.getByTestId('toggle-universe-btn').click();

    // 6. Wait for Modal
    await page.waitForSelector('[data-testid="universe-editor"]', { timeout: 5000 });

    // 7. Take Universe Screenshot
    await page.screenshot({ path: 'final_universe.png' });
});
