
import { test, expect } from '@playwright/test';

test('WebSocket Stable Connection Timer', async ({ page }) => {
    // 1. Capture console logs
    const logs: string[] = [];
    page.on('console', msg => logs.push(msg.text()));

    // 2. Load Dashboard
    await page.goto('http://localhost:5100');

    // 3. Wait 8 seconds (Timer is 5s)
    await page.waitForTimeout(8000);

    // 4. Verify log exists
    const stableLog = logs.find(l => l.includes('WS Connection Stable - Resetting Backoff'));

    if (stableLog) {
        console.log('✅ Found Stability Log:', stableLog);
    } else {
        console.log('❌ Stability Log NOT FOUND. All logs:', logs);
        throw new Error('Stability timer did not fire');
    }
});
