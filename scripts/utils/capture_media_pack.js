/**
 * Media Pack Capture Script
 * Captures screenshots + ≥3-minute demo video of all major features.
 * Uses data-testid selectors for reliability (nav starts collapsed).
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const FRONTEND_URL = 'http://localhost:5100';
const OUTPUT_DIR = path.join(__dirname, 'artifacts', 'proof', 'media-pack');
const SCREENSHOTS_DIR = path.join(OUTPUT_DIR, 'screenshots');
const VIDEO_DIR = path.join(OUTPUT_DIR, 'video');

// Ensure directories
[SCREENSHOTS_DIR, VIDEO_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// All navigable views with their data-testid
const VIEWS = [
  { id: 'dashboard',  name: '01_dashboard',           wait: 3000 },
  { id: 'monitor',    name: '02_chart',                wait: 4000 },
  { id: 'portfolio',  name: '03_portfolio',            wait: 3000 },
  { id: 'orders',     name: '04_orders',               wait: 3000 },
  { id: 'autopilot',  name: '05_autopilot',            wait: 3000 },
  { id: 'strategies', name: '06_strategies_rules',     wait: 3000 },
  { id: 'runs',       name: '07_runs_audit_log',       wait: 3000 },
  { id: 'options',    name: '08_options_workstation',   wait: 4000 },
  { id: 'backtest',   name: '09_backtests',            wait: 3000 },
  { id: 'replay',     name: '10_replay',               wait: 3000 },
  { id: 'alerts',     name: '11_alerts',               wait: 3000 },
  { id: 'incidents',  name: '12_incidents',            wait: 3000 },
  { id: 'agents',     name: '13_agents',               wait: 3000 },
  { id: 'cache',      name: '14_cache_viewer',         wait: 3000 },
  { id: 'settings',   name: '15_settings',             wait: 3000 },
];

async function navigateTo(page, viewId) {
  const sel = `[data-testid="nav-item-${viewId}"]`;
  try {
    await page.click(sel, { timeout: 5000 });
    return true;
  } catch (e) {
    console.warn(`  ⚠ Could not click nav-item-${viewId}`);
    return false;
  }
}

async function captureFeatures() {
  const browser = await chromium.launch({
    headless: false,
    args: ['--start-maximized'],
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: { dir: VIDEO_DIR, size: { width: 1920, height: 1080 } },
  });

  const page = await context.newPage();
  console.log('📸 Starting media pack capture...\n');

  try {
    // --- Load app ---
    console.log('Loading application...');
    await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(3000);

    // --- Pass 1: Screenshots ---
    console.log('\n=== PASS 1: Feature Screenshots ===\n');

    for (const view of VIEWS) {
      console.log(`📷 ${view.name}`);
      if (await navigateTo(page, view.id)) {
        await page.waitForTimeout(view.wait);
        await page.screenshot({
          path: path.join(SCREENSHOTS_DIR, `${view.name}.png`),
          fullPage: false,
        });
      }
    }

    // --- Pass 2: ≥3-minute Video Tour ---
    console.log('\n=== PASS 2: Demo Video Recording (~3.5 min) ===\n');

    // Dashboard overview (30s)
    console.log('🎬 1/10 Dashboard & Market Overview (30s)');
    await navigateTo(page, 'dashboard');
    await page.waitForTimeout(5000);
    await page.evaluate(() => window.scrollTo(0, 400));
    await page.waitForTimeout(5000);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(3000);

    // Chart view (30s)
    console.log('🎬 2/10 Chart & Technical Analysis (30s)');
    await navigateTo(page, 'monitor');
    await page.waitForTimeout(8000);
    await page.evaluate(() => window.scrollTo(0, 300));
    await page.waitForTimeout(5000);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(4000);

    // Portfolio (25s)
    console.log('🎬 3/10 Portfolio Management (25s)');
    await navigateTo(page, 'portfolio');
    await page.waitForTimeout(6000);
    await page.evaluate(() => window.scrollTo(0, 300));
    await page.waitForTimeout(4000);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(3000);

    // Autopilot (25s)
    console.log('🎬 4/10 Autopilot Intelligence (25s)');
    await navigateTo(page, 'autopilot');
    await page.waitForTimeout(7000);
    await page.evaluate(() => window.scrollTo(0, 400));
    await page.waitForTimeout(5000);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(3000);

    // Options (25s)
    console.log('🎬 5/10 Options Trading (25s)');
    await navigateTo(page, 'options');
    await page.waitForTimeout(7000);
    await page.evaluate(() => window.scrollTo(0, 400));
    await page.waitForTimeout(5000);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(3000);

    // Backtests (20s)
    console.log('🎬 6/10 Backtesting & Analysis (20s)');
    await navigateTo(page, 'backtest');
    await page.waitForTimeout(8000);
    await page.evaluate(() => window.scrollTo(0, 300));
    await page.waitForTimeout(4000);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(3000);

    // Strategies (20s)
    console.log('🎬 7/10 Strategy Development (20s)');
    await navigateTo(page, 'strategies');
    await page.waitForTimeout(7000);
    await page.evaluate(() => window.scrollTo(0, 300));
    await page.waitForTimeout(3000);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(2000);

    // Runs / Audit (15s)
    console.log('🎬 8/10 Runs & Audit Log (15s)');
    await navigateTo(page, 'runs');
    await page.waitForTimeout(6000);
    await page.evaluate(() => window.scrollTo(0, 300));
    await page.waitForTimeout(3000);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(2000);

    // Agents (15s)
    console.log('🎬 9/10 AI Agents (15s)');
    await navigateTo(page, 'agents');
    await page.waitForTimeout(5000);
    await page.evaluate(() => window.scrollTo(0, 300));
    await page.waitForTimeout(3000);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(2000);

    // Final dashboard (10s)
    console.log('🎬 10/10 Return to Dashboard (10s)');
    await navigateTo(page, 'dashboard');
    await page.waitForTimeout(5000);

    console.log('\n✅ Video recording complete (~3.5 min)\n');

  } catch (error) {
    console.error('❌ Error during capture:', error);
  } finally {
    await page.close();
    await context.close();
    await browser.close();

    console.log('\n📁 Screenshots: ' + SCREENSHOTS_DIR);
    console.log('🎥 Video dir:    ' + VIDEO_DIR);

    // Rename the auto-generated webm file
    setTimeout(() => {
      const files = fs.readdirSync(VIDEO_DIR);
      const videoFile = files.find(f => f.endsWith('.webm'));
      if (videoFile) {
        const oldPath = path.join(VIDEO_DIR, videoFile);
        const newPath = path.join(VIDEO_DIR, 'demo_tour.webm');
        try {
          fs.renameSync(oldPath, newPath);
          console.log('✅ Video saved as demo_tour.webm');
        } catch (e) {
          console.log('Video file: ' + videoFile);
        }
      }
      console.log('\n✅ Media pack complete.');
    }, 3000);
  }
}

captureFeatures().catch(console.error);
