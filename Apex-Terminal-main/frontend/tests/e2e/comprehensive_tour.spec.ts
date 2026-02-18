import { test, expect } from '@playwright/test';
import path from 'path';
import { navigateDeterministic } from './helpers';

const MEDIA_DIR = path.resolve(process.cwd(), '../devpost_media');

test.use({
    baseURL: 'http://localhost:5100',
    video: 'on',
    viewport: { width: 1920, height: 1080 },
    recordVideo: {
        dir: MEDIA_DIR,
        size: { width: 1920, height: 1080 }
    }
});

test.describe('Comprehensive Demo Tour', () => {
    test('record full application tour', async ({ page }) => {
        test.setTimeout(120000);

        // 1. Start at Dashboard (Command Center) - The "Hero" Shot
        console.log('Step 1: Dashboard / Home');
        await navigateDeterministic(page, '/');
        // By default it might go to Chart, so explicitly click Dashboard if needed, 
        // but let's assume valid start. If default is chart, we switch to Dashboard first.

        try {
            await page.getByTestId('nav-item-dashboard').click();
        } catch (e) {
            console.log('Already on dashboard or nav item issue');
        }
        await page.waitForTimeout(3000); // Linger for video

        // 2. Chart (Monitor)
        console.log('Step 2: Chart/Monitor');
        await page.getByTestId('nav-item-monitor').click();
        await page.waitForSelector('canvas', { timeout: 10000 }).catch(() => { });
        await page.waitForTimeout(3000);

        // 3. Options Analytics
        console.log('Step 3: Options');
        await page.getByTestId('nav-item-options').click();
        await page.getByTestId('options-tab-chain').waitFor({ state: 'visible' }).catch(() => { });
        await page.waitForTimeout(3000);

        // 4. Autopilot
        console.log('Step 4: Autopilot');
        await page.getByTestId('nav-item-autopilot').click();
        await page.waitForTimeout(3000);

        // 5. Portfolio
        console.log('Step 5: Portfolio');
        await page.getByTestId('nav-item-portfolio').click();
        await page.waitForTimeout(2000);

        // 6. Orders
        console.log('Step 6: Orders');
        await page.getByTestId('nav-item-orders').click();
        await page.waitForTimeout(2000);

        // 7. Runs
        console.log('Step 7: Runs');
        await page.getByTestId('nav-item-runs').click();
        await page.waitForTimeout(2000);

        // 8. Strategies
        console.log('Step 8: Strategies');
        await page.getByTestId('nav-item-strategies').click();
        await page.waitForTimeout(2000);

        console.log('Tour Complete');
    });
});
