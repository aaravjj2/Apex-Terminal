const { chromium } = require('playwright');

(async () => {
    console.log('Attempting to launch chromium...');
    try {
        const browser = await chromium.launch({ headless: true });
        console.log('Browser launched successfully');
        const context = await browser.newContext();
        const page = await context.newPage();
        console.log('Navigating to example.com...');
        await page.goto('https://example.com');
        console.log('Page title:', await page.title());
        await browser.close();
        console.log('Diagnostic finished successfully');
    } catch (error) {
        console.error('Diagnostic FAILED:', error.message);
        if (error.message.includes('executable')) {
            console.log('Suggestion: Run "npx playwright install"');
        }
    }
})();
