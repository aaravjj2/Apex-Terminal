const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    const consoleLogs = [];
    page.on('console', msg => consoleLogs.push(`[${msg.type()}] ${msg.text()}`));
    page.on('pageerror', err => consoleLogs.push(`[ERROR] ${err.message}`));

    console.log('Navigating to http://localhost:5100...');

    try {
        await page.goto('http://localhost:5100', { timeout: 30000, waitUntil: 'networkidle' });
        console.log('Page loaded');

        // Wait a bit more for any animations or async data
        await page.waitForTimeout(5000);

        // Take screenshot
        const screenshotPath = '/home/aarav/Aarav/Tradingview recreation/artifacts/verification/20260112-160000/snapshots/gate0_boot.png';
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`Screenshot saved to ${screenshotPath}`);

        // Check for critical errors in logs
        const hasErrors = consoleLogs.some(log => log.includes('[error]') || log.includes('[ERROR]'));
        
        if (hasErrors) {
            console.log('FAIL: Console errors detected');
        } else {
            console.log('SUCCESS: No console errors detected');
        }

    } catch (error) {
        console.log('ERROR:', error.message);
        consoleLogs.push(`[Script Error] ${error.message}`);
    } finally {
        const logPath = '/home/aarav/Aarav/Tradingview recreation/artifacts/verification/20260112-160000/app_logs/browser_console.log';
        fs.writeFileSync(logPath, consoleLogs.join('\n'));
        console.log(`Console logs saved to ${logPath}`);
        
        await browser.close();
    }
})();
