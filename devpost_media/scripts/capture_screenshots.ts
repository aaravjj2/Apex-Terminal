/**
 * Playwright Screenshot Capture for Devpost Media
 * 
 * Captures the 7 required screenshots in 3:2 ratio (1920x1280):
 * 1. Dashboard (chart + sidebar)
 * 2. Symbol switching (before/after)
 * 3. Autopilot candidates
 * 4. Trade execution
 * 5. Monitoring exits
 * 6. Architecture diagram
 * 7. N8N workflow (if applicable)
 */

import { chromium, Browser, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const VIEWPORT = { width: 1920, height: 1280 };
const OUTPUT_DIR = path.join(__dirname, '../images');
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:50001';

interface Screenshot {
  name: string;
  filename: string;
  description: string;
  url: string;
  waitFor?: string;
  action?: (page: Page) => Promise<void>;
}

const screenshots: Screenshot[] = [
  {
    name: '01_dashboard',
    filename: '01_dashboard.png',
    description: 'Main dashboard with chart and sidebar',
    url: `${FRONTEND_URL}/`,
    waitFor: 'canvas, [class*="chart"]',
  },
  {
    name: '02_symbol_detail',
    filename: '02_symbol_switching.png',
    description: 'Symbol detail page showing price data',
    url: `${FRONTEND_URL}/symbol/SPY`,
    waitFor: '[class*="price"], [class*="symbol"]',
  },
  {
    name: '03_autopilot_status',
    filename: '03_autopilot_candidates.png',
    description: 'Autopilot status and candidate generation',
    url: `${FRONTEND_URL}/system`,
    waitFor: 'text=Autopilot',
  },
  {
    name: '04_positions',
    filename: '04_trade_execution.png',
    description: 'Open positions and trade execution',
    url: `${FRONTEND_URL}/positions`,
    waitFor: '[class*="position"], table',
  },
  {
    name: '05_trades_history',
    filename: '05_monitoring_exits.png',
    description: 'Trade history and exit monitoring',
    url: `${FRONTEND_URL}/trades`,
    waitFor: '[class*="trade"], table',
  },
];

async function ensureOutputDir() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
}

async function waitForReady(page: Page) {
  // Wait for network to be idle
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {
    console.log('  ⚠ Network idle timeout (continuing anyway)');
  });
  
  // Wait a bit for React hydration
  await page.waitForTimeout(1000);
}

async function captureScreenshot(browser: Browser, screenshot: Screenshot) {
  console.log(`\n📸 Capturing: ${screenshot.name}`);
  console.log(`   URL: ${screenshot.url}`);
  
  const page = await browser.newPage({ viewport: VIEWPORT });
  
  try {
    // Navigate to page
    await page.goto(screenshot.url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    
    // Wait for specific element if specified
    if (screenshot.waitFor) {
      await page.waitForSelector(screenshot.waitFor, { timeout: 10000 }).catch(() => {
        console.log(`  ⚠ Wait selector timeout: ${screenshot.waitFor}`);
      });
    }
    
    // Wait for page to be ready
    await waitForReady(page);
    
    // Execute custom action if specified
    if (screenshot.action) {
      await screenshot.action(page);
      await page.waitForTimeout(500);
    }
    
    // Take screenshot
    const filepath = path.join(OUTPUT_DIR, screenshot.filename);
    await page.screenshot({
      path: filepath,
      fullPage: false,
    });
    
    const stats = fs.statSync(filepath);
    console.log(`   ✓ Saved: ${screenshot.filename} (${(stats.size / 1024).toFixed(1)} KB)`);
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`   ✗ Error capturing ${screenshot.name}:`, errorMessage);
  } finally {
    await page.close();
  }
}

async function checkBackendHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${BACKEND_URL}/health`);
    return response.ok;
  } catch (error) {
    return false;
  }
}

async function main() {
  console.log('========================================');
  console.log('   Screenshot Capture for Devpost');
  console.log('========================================\n');
  
  console.log(`Backend:  ${BACKEND_URL}`);
  console.log(`Frontend: ${FRONTEND_URL}`);
  console.log(`Output:   ${OUTPUT_DIR}`);
  
  // Ensure output directory exists
  ensureOutputDir();
  
  // Check backend health
  console.log('\n🔍 Checking backend health...');
  const backendHealthy = await checkBackendHealth();
  if (!backendHealthy) {
    console.error('✗ Backend is not responding. Please start it first:');
    console.error('  ./scripts/run_demo.sh');
    process.exit(1);
  }
  console.log('✓ Backend healthy');
  
  // Launch browser
  console.log('\n🌐 Launching browser...');
  const browser = await chromium.launch({
    headless: true,
  });
  console.log('✓ Browser launched');
  
  try {
    // Capture each screenshot
    for (const screenshot of screenshots) {
      await captureScreenshot(browser, screenshot);
    }
    
    console.log('\n========================================');
    console.log('   ✅ All screenshots captured!');
    console.log('========================================\n');
    console.log(`Output directory: ${OUTPUT_DIR}`);
    console.log('\nNext steps:');
    console.log('  1. Review screenshots for quality');
    console.log('  2. Create architecture diagram (06_architecture.png)');
    console.log('  3. Capture n8n workflow if applicable (07_n8n_workflow.png)');
    console.log('  4. Run video capture script');
    
  } finally {
    await browser.close();
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { main as captureScreenshots };
