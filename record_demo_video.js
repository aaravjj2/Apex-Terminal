/**
 * Apex Terminal — Hackathon Demo Video Recorder
 * Records a comprehensive 3+ minute walkthrough of all features
 * Uses Playwright with video recording enabled
 * 
 * Run: node record_demo_video.js
 */

const { chromium } = require('./frontend/node_modules/playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://localhost:5100';
const UI2_URL = 'http://localhost:5101';
const OUTPUT_DIR = path.join(__dirname, 'demo_screenshots');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function recordDemo() {
  console.log('🎬 Starting Apex Terminal Demo Recording...\n');

  const browser = await chromium.launch({
    headless: false,
    args: ['--start-maximized'],
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: {
      dir: __dirname,
      size: { width: 1920, height: 1080 },
    },
  });

  const page = await context.newPage();
  let screenshotIndex = 1;

  const shot = async (name) => {
    const filename = `${String(screenshotIndex++).padStart(2, '0')}-${name}.png`;
    await page.screenshot({ path: path.join(OUTPUT_DIR, filename), type: 'png' });
    console.log(`  📸 ${filename}`);
  };

  try {
    // =========================================================
    // SECTION 1: Opening the terminal (0:00 - 0:30)
    // =========================================================
    console.log('\n📡 Section 1: Apex Terminal Overview...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await sleep(2000);
    await shot('01-apex-terminal-home');

    // Show the live ticker strip animating
    await sleep(2500);
    await shot('02-live-ticker-strip');

    // =========================================================
    // SECTION 2: Market Command Center (0:30 - 1:00)
    // =========================================================
    console.log('\n📊 Section 2: Market Command Center...');
    await sleep(1500);
    await shot('03-market-command-center');

    // Click through tabs
    const heatmapTab = await page.$('text=HEATMAP');
    if (heatmapTab) { await heatmapTab.click(); await sleep(1000); }
    await shot('04-sector-heatmap');

    const moversTab = await page.$('text=MOVERS');
    if (moversTab) { await moversTab.click(); await sleep(1000); }
    await shot('05-top-movers');

    // =========================================================
    // SECTION 3: Bloomberg Husk — Dashboard (1:00 - 1:30)
    // =========================================================
    console.log('\n🖥️  Section 3: Bloomberg Dashboard Husk...');
    await page.goto(`${UI2_URL}/ui2/husk/dashboard`, { waitUntil: 'networkidle' });
    await sleep(2000);
    await shot('06-bloomberg-dashboard-husk');

    // Highlight ticker strip
    await sleep(1500);
    await shot('07-dashboard-full-view');

    // =========================================================
    // SECTION 4: Bloomberg Trading Terminal (1:30 - 2:00)
    // =========================================================
    console.log('\n💹 Section 4: Trading Terminal...');
    await page.goto(`${UI2_URL}/ui2/husk/trading`, { waitUntil: 'networkidle' });
    await sleep(2000);
    await shot('08-trading-terminal');

    // Scroll down to see order book detail
    await sleep(1500);
    await shot('09-order-book-detail');

    // Click BUY button
    const buyBtn = await page.$('text=BUY');
    if (buyBtn) {
      await buyBtn.hover();
      await sleep(800);
    }
    await shot('10-order-entry');

    // =========================================================
    // SECTION 5: Portfolio Management (2:00 - 2:30)
    // =========================================================
    console.log('\n💼 Section 5: Portfolio View...');
    await page.goto(`${UI2_URL}/ui2/husk/portfolio`, { waitUntil: 'networkidle' });
    await sleep(2000);
    await shot('11-portfolio-holdings');

    // Click Risk tab
    const riskTab = await page.$('text=RISK');
    if (riskTab) { await riskTab.click(); await sleep(1000); }
    await shot('12-portfolio-risk');

    // Click Correlation tab
    const corrTab = await page.$('text=CORRELATION');
    if (corrTab) { await corrTab.click(); await sleep(1000); }
    await shot('13-portfolio-correlation');

    // =========================================================
    // SECTION 6: Main App UI — Left Nav Features (2:30 - 3:00)
    // =========================================================
    console.log('\n⚙️  Section 6: Full Feature Suite...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await sleep(1500);

    // Navigate through left sidebar
    const navItems = await page.$$('[data-testid^="nav-"]');
    console.log(`  Found ${navItems.length} nav items`);
    
    // Try clicking charts/trading link
    await sleep(1000);
    await shot('14-apex-full-terminal');

    // Overview/Positions tab
    const positionsTab = await page.$('text=POSITIONS');
    if (positionsTab) { await positionsTab.click(); await sleep(1200); }
    await shot('15-positions-view');

    // Back to overview
    const overviewTab = await page.$('text=OVERVIEW');
    if (overviewTab) { await overviewTab.click(); await sleep(1000); }
    await shot('16-market-overview');

    // =========================================================
    // SECTION 7: AI Agents & Autopilot (3:00 - 3:30)
    // =========================================================
    console.log('\n🤖 Section 7: AI Agents Showcase...');
    await sleep(2000);
    await shot('17-apex-agents-ready');

    // Final overview showing the complete Bloomberg UI2
    await page.goto(`${UI2_URL}/ui2/husk/dashboard`, { waitUntil: 'networkidle' });
    await sleep(2000);
    await shot('18-bloomberg-final-dashboard');

    await page.goto(`${UI2_URL}/ui2/husk/trading`, { waitUntil: 'networkidle' });
    await sleep(2000);
    await shot('19-bloomberg-final-trading');

    await page.goto(`${UI2_URL}/ui2/husk/portfolio`, { waitUntil: 'networkidle' });
    await sleep(2000);
    await shot('20-bloomberg-final-portfolio');

    console.log('\n✅ Recording complete!');
    console.log(`📁 Screenshots saved to: ${OUTPUT_DIR}`);

  } catch (err) {
    console.error('Error during recording:', err);
  } finally {
    await sleep(2000);
    await context.close();
    await browser.close();
    
    // Find the video file
    const videos = fs.readdirSync(__dirname).filter(f => f.endsWith('.webm'));
    if (videos.length > 0) {
      const videoFile = videos[videos.length - 1];
      const newName = 'apex_terminal_demo.webm';
      if (videoFile !== newName) {
        fs.renameSync(
          path.join(__dirname, videoFile),
          path.join(__dirname, newName)
        );
      }
      console.log(`\n🎬 Video saved as: ${newName}`);
      console.log(`  Size: ${(fs.statSync(path.join(__dirname, newName)).size / 1024 / 1024).toFixed(1)} MB`);
    }
  }
}

recordDemo().catch(console.error);
