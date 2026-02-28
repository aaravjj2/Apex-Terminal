const { chromium } = require('playwright');
const path = require('path');

(async () => {
    const extensionPath = path.resolve(__dirname, 'browser_extension');
    console.log(`Loading extension from: ${extensionPath}`);

    try {
        // use launchPersistentContext because standard launch usually doesn't support extensions in the same way
        const context = await chromium.launchPersistentContext('', {
            headless: false, // extensions often require headless: false
            args: [
                `--disable-extensions-except=${extensionPath}`,
                `--load-extension=${extensionPath}`
            ]
        });

        const page = await context.pages()[0] || await context.newPage();
        await page.goto('https://www.wikipedia.org/');
        const title = await page.title();
        console.log('Page title:', title);

        if (title.includes('Wikipedia')) {
            console.log('SUCCESS: Browser launched with extension and opened Wikipedia.');
        }

        await context.close();
    } catch (error) {
        console.error('Error verifying extension:', error);
        // If headless: false fails (no display), fallback to sanity check without extension
        process.exit(1);
    }
})();
