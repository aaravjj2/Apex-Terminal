const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    console.log('Navigating to http://localhost:5173...');

    try {
        // Navigate with strict 10 second timeout
        await page.goto('http://localhost:5173', { timeout: 10000 });
        console.log('Page loaded, waiting for content...');

        // Wait 5 seconds for React to render
        await page.waitForTimeout(5000);

        // Check if root has content
        const rootContent = await page.evaluate(() => {
            const root = document.getElementById('root');
            return root ? root.children.length : 0;
        });

        console.log('Root element children count:', rootContent);

        if (rootContent === 0) {
            console.log('ERROR: Dashboard failed to render - root is empty');

            // Capture console errors
            const logs = await page.evaluate(() => {
                return window.__consoleErrors || [];
            });
            console.log('Console errors:', logs);
        } else {
            console.log('SUCCESS: Dashboard rendered with content');
        }

        // Take screenshot regardless
        await page.screenshot({
            path: '/home/aarav/.gemini/antigravity/brain/eb9c17bd-626e-4bce-be73-b7b3ab0c1d46/playwright_snapshot.png',
            fullPage: true
        });
        console.log('Screenshot saved to playwright_snapshot.png');

    } catch (error) {
        console.log('ERROR:', error.message);

        // Try to take screenshot even on error
        try {
            await page.screenshot({
                path: '/home/aarav/.gemini/antigravity/brain/eb9c17bd-626e-4bce-be73-b7b3ab0c1d46/playwright_error_snapshot.png'
            });
        } catch (e) { }
    }

    await browser.close();
    console.log('Test complete');
})();
