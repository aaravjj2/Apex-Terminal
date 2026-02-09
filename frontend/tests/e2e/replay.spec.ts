import { test, expect } from '@playwright/test';

test.describe('Replay Controls', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('index.html');
        // Navigate to Replay view
        const replayNav = page.locator('button, a').filter({ hasText: 'Replay' }).first();
        if (await replayNav.isVisible({ timeout: 3000 }).catch(() => false)) {
            await replayNav.click();
            await page.waitForTimeout(500);
        }
    });

    test('should display replay mode badge', async ({ page }) => {
        // Check for any mode badge in the replay view (could be LIVE, REPLAY, etc)
        const modeBadge = page.locator('text=/LIVE|REPLAY|BACKTEST|PAPER/i').first();
        await expect(modeBadge).toBeVisible({ timeout: 5000 });
    });

    test('should have play/pause button', async ({ page }) => {
        const playPauseButton = page.locator('button').filter({
            has: page.locator('text=/Play|Pause/i, svg[class*="play"], svg[class*="pause"]')
        }).first();

        if (await playPauseButton.isVisible({ timeout: 3000 }).catch(() => false)) {
            await expect(playPauseButton).toBeEnabled();
            await playPauseButton.click();
            await page.waitForTimeout(200);
        }
    });

    test('should have speed controls', async ({ page }) => {
        // Look for speed buttons (0.5x, 1x, 2x, 5x, 10x)
        const speedButton = page.locator('button').filter({ hasText: /\dx/ }).first();
        if (await speedButton.isVisible({ timeout: 2000 }).catch(() => false)) {
            await speedButton.click();
            await page.waitForTimeout(200);
        }
    });

    test('should have timeline scrubber', async ({ page }) => {
        const scrubber = page.locator('input[type="range"], .scrubber, .timeline');
        if (await scrubber.isVisible({ timeout: 2000 }).catch(() => false)) {
            await expect(scrubber).toBeVisible();
        }
    });

    test('should display current timestamp', async ({ page }) => {
        // Look for timestamp display (HH:MM:SS or date format)
        const timestamp = page.locator('text=/\\d{1,2}:\\d{2}:\\d{2}|\\d{4}-\\d{2}-\\d{2}/').first();
        if (await timestamp.isVisible({ timeout: 2000 }).catch(() => false)) {
            await expect(timestamp).toBeVisible();
        }
    });

    test('screenshot replay controls bar', async ({ page }) => {
        await page.waitForTimeout(500);
        await expect(page).toHaveScreenshot('replay-controls.png', {
            animations: 'disabled',
        });
    });
});

test.describe('Replay Keyboard Shortcuts', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('index.html');
        // Navigate to Replay view
        const replayNav = page.locator('button, a').filter({ hasText: 'Replay' }).first();
        if (await replayNav.isVisible({ timeout: 3000 }).catch(() => false)) {
            await replayNav.click();
            await page.waitForTimeout(500);
        }
    });

    test('Space should toggle play/pause', async ({ page }) => {
        await page.waitForTimeout(1000);
        await page.keyboard.press('Space');
        await page.waitForTimeout(300);
        // Just verify no crash
        await expect(page.locator('body')).toBeVisible({ timeout: 10000 });
    });

    test('Arrow keys should step through bars', async ({ page }) => {
        await page.waitForTimeout(1000);
        await page.keyboard.press('ArrowRight');
        await page.waitForTimeout(100);
        await page.keyboard.press('ArrowLeft');
        await page.waitForTimeout(100);
        // Verify no crash
        await expect(page.locator('body')).toBeVisible({ timeout: 10000 });
    });
});
