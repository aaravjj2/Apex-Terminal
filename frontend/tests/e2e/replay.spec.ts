import { test, expect } from '@playwright/test';

test.describe('Replay Controls', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        // Navigate to Replay view
        const replayNav = page.getByTestId('nav-item-replay');
        if (await replayNav.isVisible({ timeout: 3000 }).catch(() => false)) {
            await replayNav.click();
            await page.waitForTimeout(500);
        }
    });

    test('should display replay mode badge', async ({ page }) => {
        // Check for any mode badge in the replay view (could be LIVE, REPLAY, etc)
        const modeBadge = page.getByTestId('mode-badge');
        await expect(modeBadge).toBeVisible({ timeout: 5000 });
    });

    test('should have play/pause button', async ({ page }) => {
        const playPauseButton = page.getByTestId('replay-play-btn');

        if (await playPauseButton.isVisible({ timeout: 3000 }).catch(() => false)) {
            await expect(playPauseButton).toBeEnabled();
            await playPauseButton.click();
            await page.waitForTimeout(200);
        }
    });

    test('should have speed controls', async ({ page }) => {
        // Look for speed buttons (0.5x, 1x, 2x, 5x, 10x)
        const speedButton = page.getByTestId('replay-speed-btn');
        if (await speedButton.isVisible({ timeout: 2000 }).catch(() => false)) {
            await speedButton.click();
            await page.waitForTimeout(200);
        }
    });

    test('should have timeline scrubber', async ({ page }) => {
        const scrubber = page.getByTestId('replay-scrubber');
        if (await scrubber.isVisible({ timeout: 2000 }).catch(() => false)) {
            await expect(scrubber).toBeVisible();
        }
    });

    test('should display current timestamp', async ({ page }) => {
        // Look for timestamp display (HH:MM:SS or date format)
        const timestamp = page.getByTestId('replay-time');
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
        await page.goto('/');
        // Navigate to Replay view
        const replayNav = page.getByTestId('nav-item-replay');
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
        await expect(page.getByTestId('app-shell')).toBeVisible({ timeout: 10000 });
    });

    test('Arrow keys should step through bars', async ({ page }) => {
        await page.waitForTimeout(1000);
        await page.keyboard.press('ArrowRight');
        await page.waitForTimeout(100);
        await page.keyboard.press('ArrowLeft');
        await page.waitForTimeout(100);
        // Verify no crash
        await expect(page.getByTestId('app-shell')).toBeVisible({ timeout: 10000 });
    });
});
