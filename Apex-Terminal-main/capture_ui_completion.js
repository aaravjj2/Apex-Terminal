// Capture UI completion state screenshot
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Navigate to Options section first, then Risk Desk
  await page.goto('http://localhost:4173', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000); // Wait for React to render
  await page.click('[data-testid="nav-item-options"]', { timeout: 10000 });
  await page.waitForTimeout(500);
  await page.click('[data-testid="options-tab-risk-desk"]', { timeout: 10000 });
  await page.waitForSelector('[data-testid="risk-desk-panel"]', { timeout: 10000 });
  
  // Load demo data
 await page.click('[data-testid="load-demo-btn"]');
  await page.waitForTimeout(500);
  
  // Run pipeline with moderate selloff scenario
  await page.selectOption('[data-testid="scenario-select"]', 'moderate_selloff');
  await page.click('[data-testid="run-button"]');
  
  // Wait for pipeline to complete
  await page.waitForSelector('[data-testid="run-status"]:has-text("Pipeline Complete")', { timeout: 30000 });
  await page.waitForTimeout(1000); // Extra wait for UI to settle
  
  // Take full-page screenshot
  await page.screenshot({ 
    path: path.join(__dirname, 'artifacts/week2-risk-desk/ui_completion_screenshot.png'),
    fullPage: true 
  });
  
  console.log('✓ UI completion screenshot saved: artifacts/week2-risk-desk/ui_completion_screenshot.png');
  await browser.close();
})();
