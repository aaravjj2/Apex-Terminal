// Quick script to screenshot Playwright HTML report
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  const reportPath = path.join(__dirname, 'frontend/playwright-report-risk-desk/index.html');
  await page.goto(`file://${reportPath}`);
  
  // Wait for report to load
  await page.waitForTimeout(2000);
  
  // Take screenshot
  await page.screenshot({ 
    path: path.join(__dirname, 'artifacts/week2-risk-desk/playwright_report_screenshot.png'),
    fullPage: true 
  });
  
  console.log('✓ Screenshot saved: artifacts/week2-risk-desk/playwright_report_screenshot.png');
  await browser.close();
})();
