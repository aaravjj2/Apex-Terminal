const playwright = require('playwright');

(async () => {
    const browser = await playwright.chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();
    
    // Listen to console
    page.on('console', msg => {
        const type = msg.type();
        const text = msg.text();
        if (text.includes('WS') || text.includes('WebSocket') || text.includes('websocket')) {
            console.log(`[${type.toUpperCase()}] ${text}`);
        }
    });
    
    // Listen to WebSocket
    page.on('websocket', ws => {
        console.log(`\n>>> WebSocket: ${ws.url()}`);
        ws.on('framesent', frame => console.log(`  -> SENT: ${frame.payload}`));
        ws.on('framereceived', frame => console.log(`  <- RECV: ${frame.payload}`));
        ws.on('close', () => console.log(`  X  CLOSED`));
    });
    
    console.log('Opening http://localhost:5173...');
    await page.goto('http://localhost:5173');
    
    console.log('Waiting for Monitor view to load...');
    await page.waitForTimeout(2000);
    
    // Click Monitor to trigger WebSocket
    try {
        await page.click('[data-testid="nav-item-monitor"]', { timeout: 5000 });
        console.log('Clicked Monitor view');
    } catch (e) {
        console.log('Could not find Monitor nav item, checking for chart...');
    }
    
    console.log('\nWaiting 60 seconds to monitor WebSocket...');
    await page.waitForTimeout(60000);
    
    await browser.close();
    console.log('Done!');
})();
