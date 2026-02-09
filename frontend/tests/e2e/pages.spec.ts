import { test, expect } from '@playwright/test';

test.describe('Page Navigation and Rendering', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');
    });

    test('Monitor page renders chart', async ({ page }) => {
        // Navigate to Monitor using testid
        await page.getByTestId('nav-item-monitor').click();
        await page.waitForTimeout(500);

        // Chart canvas should be present
        const chartCanvas = page.getByTestId('chart-canvas');
        await expect(chartCanvas).toBeVisible({ timeout: 10000 });

        await expect(page).toHaveScreenshot('page-monitor.png', { animations: 'disabled', maxDiffPixelRatio: 0.1 });
    });

    test('Replay page renders controls', async ({ page }) => {
        await page.getByTestId('nav-item-replay').click();
        await page.waitForTimeout(300);

        // Replay badge should be visible
        const replayBadge = page.locator('text=/REPLAY/i').first();
        await expect(replayBadge).toBeVisible({ timeout: 3000 });

        await expect(page).toHaveScreenshot('page-replay.png', { animations: 'disabled' });
    });

    test('Strategies page renders list', async ({ page }) => {
        await page.getByTestId('nav-item-strategies').click();
        await page.waitForTimeout(300);

        // Strategies heading or list should be visible
        const strategiesContent = page.locator('text=/Strategies|Strategy/i').first();
        await expect(strategiesContent).toBeVisible({ timeout: 3000 });

        await expect(page).toHaveScreenshot('page-strategies.png', { animations: 'disabled' });
    });

    test('Alerts page renders', async ({ page }) => {
        await page.getByTestId('nav-item-alerts').click();
        await page.waitForTimeout(300);

        const alertsContent = page.locator('text=/Alerts|Alert/i').first();
        await expect(alertsContent).toBeVisible({ timeout: 3000 });

        await expect(page).toHaveScreenshot('page-alerts.png', { animations: 'disabled', maxDiffPixelRatio: 0.1 });
    });

    test('Portfolio page renders positions', async ({ page }) => {
        await page.getByTestId('nav-item-portfolio').click();
        await page.waitForTimeout(300);

        // Portfolio should show value or positions
        const portfolioContent = page.locator('text=/Portfolio|Positions|Value/i').first();
        await expect(portfolioContent).toBeVisible({ timeout: 3000 });

        await expect(page).toHaveScreenshot('page-portfolio.png', { animations: 'disabled' });
    });

    test('Runs/Audit page renders', async ({ page }) => {
        // Use runs nav item which exists in LeftNavEnhanced
        await page.getByTestId('nav-item-runs').click();
        await page.waitForTimeout(300);

        const runsContent = page.locator('text=/Run|Audit|Log|History/i').first();
        await expect(runsContent).toBeVisible({ timeout: 3000 });

        await expect(page).toHaveScreenshot('page-runs.png', { animations: 'disabled' });
    });

    test('Settings page renders API keys section', async ({ page }) => {
        await page.getByTestId('nav-item-settings').click();
        await page.waitForTimeout(300);

        const settingsContent = page.locator('text=/Settings|API|Keys/i').first();
        await expect(settingsContent).toBeVisible({ timeout: 3000 });

        await expect(page).toHaveScreenshot('page-settings.png', { animations: 'disabled' });
    });
});
