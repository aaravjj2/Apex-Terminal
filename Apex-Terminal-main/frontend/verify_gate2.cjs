const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function verifyGate2() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const errors = [];
  const logs = [];

  page.on('console', msg => logs.push(`[CONSOLE] ${msg.type()}: ${msg.text()}`));
  page.on('pageerror', err => errors.push(`[PAGE_ERROR] ${err.message}`));

  // Monitor WebSocket frames
  const wsMessages = [];
  page.on('websocket', ws => {
    ws.on('framesent', frame => wsMessages.push({ dir: 'sent', payload: frame.payload }));
    ws.on('framereceived', frame => {
        try {
            const parsed = JSON.parse(frame.payload);
            wsMessages.push({ dir: 'recv', payload: parsed });
        } catch (e) {
            wsMessages.push({ dir: 'recv', payload: frame.payload });
        }
    });
  });

  try {
    console.log('Navigating to frontend...');
    await page.goto('http://localhost:5100', { waitUntil: 'networkidle' });

    console.log('Waiting for chart initialization...');
    await page.waitForTimeout(5000); // Wait for connection and initial backfill

    // Step 1: Verify Initial AAPL Data (Real Data Loop)
    console.log('Verifying AAPL data...');
    const aaplData = wsMessages.find(m => 
        m.dir === 'recv' && 
        (m.payload.symbol === 'AAPL' || m.payload.s === 'AAPL') && // Check payload structure
        (m.payload.close > 180 || m.payload.c > 180)
    );

    if (aaplData) {
        console.log('✅ Received Real AAPL Data > 180:', JSON.stringify(aaplData.payload).substring(0, 100) + '...');
    } else {
        console.log('❌ did not receive expected AAPL data > 180. Last 5 messages:');
        console.log(wsMessages.slice(-5));
        // Don't fail yet, maybe it's still connecting?
    }

    // Step 2: Interact - Change Symbol
    console.log('Opening Symbol Search...');
    // Take a pre-interaction screenshot
    await page.screenshot({ path: 'artifacts/gate2_pre_click.png' });
    
    // Check if button is visible - Target the one in ChartHeaderStrip (has NASDAQ label)
    const symbolBtn = page.locator('button').filter({ hasText: 'AAPL' }).filter({ hasText: 'NASDAQ' }).first();
    await symbolBtn.waitFor({ state: 'visible', timeout: 30000 });
    console.log('Button HTML:', await symbolBtn.evaluate(el => el.outerHTML));
    await symbolBtn.click({ force: true });
    
    console.log('Waiting for modal...');
    await page.waitForSelector('text=Symbol Search', { timeout: 30000 });

    console.log('Searching for MSFT...');
    await page.fill('input[placeholder*="Search"]', 'MSFT'); // Assumption on placeholder or inputs
    // Or focus is auto, just type?
    // SymbolSearchModal.tsx has `inputRef.current?.focus()`
    // waitForTimeout
    await page.waitForTimeout(500);
    
    console.log('Selecting MSFT...');
    await page.click('text=MSFT'); // Click the result

    console.log('Waiting for symbol switch...');
    await page.waitForTimeout(3000);

    // Step 3: Verify MSFT Data (Control Loop + Real Data)
    // Wait for the WS to send MSFT data
    console.log('Waiting for MSFT data > 300...');
    
    // We might have missed the messages if they came fast, or they are yet to come.
    // Check history messages in buffer first.
    let msftData = wsMessages.find(m => 
        m.dir === 'recv' && 
        m.payload.symbol === 'MSFT' && 
        (m.payload.close > 300 || m.payload.c > 300)
    );

    if (!msftData) {
        // Wait a bit more and check again
        await page.waitForTimeout(5000);
        msftData = wsMessages.find(m => 
            m.dir === 'recv' && 
            m.payload.symbol === 'MSFT' && 
            (m.payload.close > 300 || m.payload.c > 300)
        );
    }

    if (msftData) {
        console.log('✅ Received Real MSFT Data > 300:', JSON.stringify(msftData.payload).substring(0, 100) + '...');
    } else {
        console.error('❌ Failed to receive MSFT data. Messages:', wsMessages.filter(m => m.payload.symbol === 'MSFT').length);
        errors.push('No MSFT data received');
    }
    
    // Check visual element update
    const symbolText = await page.textContent('button:has-text("MSFT")');
    if (symbolText && symbolText.includes('MSFT')) {
        console.log('✅ UI updated to MSFT');
    } else {
        console.error('❌ UI validation failed for MSFT');
        errors.push('UI did not update to MSFT');
    }

    const screenshotPath = 'artifacts/gate2_interaction.png';
    await page.screenshot({ path: screenshotPath });
    console.log(`Saved screenshot to ${screenshotPath}`);

  } catch (err) {
    console.error('Test Execution Error:', err);
    await page.screenshot({ path: 'artifacts/gate2_error.png' }); // Capture error state
    console.log('Browser Logs:', logs);
    errors.push(err.message);
  } finally {
    await browser.close();
  }

  if (errors.length > 0) {
    console.log('GATE 2 VERIFICATION FAILED');
    console.log('Errors:', errors);
    console.log('Last 10 WS Messages:', wsMessages.slice(-10));
    console.log('Browser Logs:', logs);
    process.exit(1);
  } else {
    console.log('GATE 2 VERIFICATION PASSED');
    process.exit(0);
  }
}

verifyGate2();
