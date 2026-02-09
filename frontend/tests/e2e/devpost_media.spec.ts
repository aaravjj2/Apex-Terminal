import { test, expect } from '@playwright/test';
import path from 'path';
import { navigateDeterministic } from './helpers';

// Output directory for media
const MEDIA_DIR = path.resolve(process.cwd(), '../devpost_media');
const IMAGES_DIR = path.join(MEDIA_DIR, 'images');

test.use({
    baseURL: 'http://localhost:5100',
    video: 'on',
    viewport: { width: 1920, height: 1280 },
    recordVideo: {
        dir: MEDIA_DIR,
        size: { width: 1920, height: 1280 }
    }
});

test.describe('Devpost Media Generation', () => {
    test('capture screenshots and video for entire demo flow', async ({ page, context }) => {
        // Ensure timeout is generous for video recording
        test.setTimeout(180000); // 3 minutes max

        // 1. Dashboard Load
        console.log('Step 1: Loading Dashboard (Deterministic)');
        await navigateDeterministic(page, '/');

        // Navigate to Chart view (Monitor)
        console.log('Switching to Chart View');
        await page.click('[data-testid="nav-item-monitor"]');

        // Wait for chart and sidebar
        await page.waitForSelector('canvas', { state: 'visible', timeout: 30000 });
        // Try to wait for something specific if possible, like header
        await page.waitForTimeout(5000); // Let animations settle

        await page.screenshot({ path: path.join(IMAGES_DIR, '01_dashboard.png') });

        // 2. Symbol Switching
        console.log('Step 2: Switching Symbol');
        // Assuming there is a symbol search or we can click a watchlist item
        // Trying to find a watchlist item - adapt selector as needed
        const watchlistSelector = '[data-testid="watchlist-item-AAPL"], [role="button"]:has-text("AAPL")';
        try {
            if (await page.isVisible(watchlistSelector)) {
                await page.click(watchlistSelector);
                await page.waitForTimeout(3000); // Wait for load
            }
        } catch (e) {
            console.log('Watchlist item not found, skipping specific cliock');
        }

        await page.screenshot({ path: path.join(IMAGES_DIR, '02_symbol_switching.png') });

        // 3. Autopilot Candidates
        console.log('Step 3: Autopilot Run');
        // Click run button if available
        // Look for "Run Autopilot" or similar
        const runButtonSelector = 'button:has-text("Run Cycle"), button:has-text("Start Autopilot")';
        if (await page.isVisible(runButtonSelector)) {
            await page.click(runButtonSelector);
            // Wait for candidates to appear
            await page.waitForTimeout(5000);
        }

        // Navigate or ensure we see the autopilot tab/panel
        // Assuming there's a tab or link for Autopilot
        const autopilotLinkSelector = 'a[href="/autopilot"], button:has-text("Autopilot")';
        if (await page.isVisible(autopilotLinkSelector)) {
            await page.click(autopilotLinkSelector);
            await page.waitForTimeout(2000);
        }

        await page.screenshot({ path: path.join(IMAGES_DIR, '03_autopilot_candidates.png') });

        // 4. Trade Execution (Simulated visual)
        console.log('Step 4: Trade Execution');
        // If we can select a candidate, do it
        const candidateSelector = '[data-testid^="candidate-row"], .candidate-card';
        if (await page.isVisible(candidateSelector)) {
            // Hover to show interactivity
            await page.hover(candidateSelector);
            await page.waitForTimeout(1000);
        }

        await page.screenshot({ path: path.join(IMAGES_DIR, '04_trade_execution.png') });

        // 5. Monitoring
        console.log('Step 5: Monitoring');
        // Switch to portfolio/positions view
        const portfolioLinkSelector = 'a[href="/portfolio"], button:has-text("Portfolio")';
        if (await page.isVisible(portfolioLinkSelector)) {
            await page.click(portfolioLinkSelector);
            await page.waitForTimeout(2000);
        }

        await page.screenshot({ path: path.join(IMAGES_DIR, '05_monitoring_exits.png') });

        // 6. Final cleanup wait
        await page.waitForTimeout(3000);

        console.log('Demo flow complete.');

        // Rename video file after test? Playwright saves with random name. 
        // We will have to find the latest video in the dir manually or renaming script.
        const videoPath = await page.video()?.path();
        console.log(`Video saved to: ${videoPath}`);
    });
});
