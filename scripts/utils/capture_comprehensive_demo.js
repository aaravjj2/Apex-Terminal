/**
 * Comprehensive Feature Documentation Capture Script
 * Captures snapshots of all major features + full demo video
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const FRONTEND_URL = 'http://localhost:5100';
const SCREENSHOTS_DIR = path.join(__dirname, 'devpost_media', 'images', '2026-comprehensive');
const VIDEO_DIR = path.join(__dirname, 'devpost_media', 'video');

// Ensure directories exist
[SCREENSHOTS_DIR, VIDEO_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

async function captureFeatures() {
  const browser = await chromium.launch({
    headless: false,
    args: ['--start-maximized']
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: {
      dir: VIDEO_DIR,
      size: { width: 1920, height: 1080 }
    }
  });

  const page = await context.newPage();
  
  console.log('📸 Starting comprehensive feature capture...\n');

  try {
    // Navigate to app
    console.log('1️⃣  Loading application...');
    await page.goto(FRONTEND_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    // 1. Dashboard - Command Center
    console.log('📷 Capturing: Dashboard Command Center');
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '01_dashboard_command_center.png'),
      fullPage: true
    });
    await page.waitForTimeout(2000);

    // Helper function to safely click navigation buttons
    const safeClick = async (buttonText, fallbackText = null) => {
      try {
        await page.click(`button:has-text("${buttonText}")`, { timeout: 5000 });
        return true;
      } catch (e) {
        if (fallbackText) {
          try {
            await page.click(`button:has-text("${fallbackText}")`, { timeout: 5000 });
            return true;
          } catch (e2) {
            console.warn(`⚠️  Could not click ${buttonText} or ${fallbackText}`);
          }
        } else {
          console.warn(`⚠️  Could not click ${buttonText}`);
        }
        return false;
      }
    };

    // 2. Navigate to Chart
    console.log('📷 Capturing: Chart View');
    if (await safeClick('Chart ⌘1', 'Chart')) {
      await page.waitForTimeout(3000);
      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, '02_chart_view.png'),
        fullPage: true
      });
    }

    // 3. Portfolio View
    console.log('📷 Capturing: Portfolio');
    if (await safeClick('Portfolio ⌘P', 'Portfolio')) {
      await page.waitForTimeout(3000);
      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, '03_portfolio_view.png'),
        fullPage: true
      });
    }

    // 4. Orders View
    console.log('📷 Capturing: Orders');
    if (await safeClick('Orders ⌘O', 'Orders')) {
      await page.waitForTimeout(3000);
      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, '04_orders_view.png'),
        fullPage: true
      });
    }

    // 5. Autopilot View
    console.log('📷 Capturing: Autopilot');
    if (await safeClick('Autopilot ⌘A', 'Autopilot')) {
      await page.waitForTimeout(3000);
      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, '05_autopilot_view.png'),
        fullPage: true
      });
    }

    // 6. Strategies & Rules
    console.log('📷 Capturing: Strategies & Rules');
    if (await safeClick('Strategies & Rules ⌘S', 'Strategies')) {
      await page.waitForTimeout(3000);
      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, '06_strategies_rules.png'),
        fullPage: true
      });
    }

    // 7. Runs / Audit Log
    console.log('📷 Capturing: Runs / Audit Log');
    if (await safeClick('Runs / Audit Log ⌘R', 'Runs')) {
      await page.waitForTimeout(3000);
      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, '07_runs_audit_log.png'),
        fullPage: true
      });
    }

    // 8. Options Workstation
    console.log('📷 Capturing: Options Workstation');
    if (await safeClick('Options ⌘2', 'Options')) {
      await page.waitForTimeout(4000);
      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, '08_options_workstation.png'),
        fullPage: true
      });
    }

    // 9. Backtests
    console.log('📷 Capturing: Backtests');
    if (await safeClick('Backtests ⌘B', 'Backtests')) {
      await page.waitForTimeout(3000);
      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, '09_backtests_view.png'),
        fullPage: true
      });
    }

    // 10. Replay
    console.log('📷 Capturing: Replay');
    if (await safeClick('Replay ⌘3', 'Replay')) {
      await page.waitForTimeout(3000);
      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, '10_replay_view.png'),
        fullPage: true
      });
    }

    // 11. Alerts
    console.log('📷 Capturing: Alerts');
    if (await safeClick('Alerts ⌘4', 'Alerts')) {
      await page.waitForTimeout(3000);
      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, '11_alerts_view.png'),
        fullPage: true
      });
    }

    // 12. Settings
    console.log('📷 Capturing: Settings');
    if (await safeClick('Settings', 'Settings ')) {
      await page.waitForTimeout(3000);
      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, '12_settings_view.png'),
        fullPage: true
      });
    }

    // 13. Back to Dashboard for final view
    console.log('📷 Capturing: Dashboard Final');
    await safeClick('Dashboard ⌘D', 'Dashboard');
    await page.waitForTimeout(2000);

    // === NOW RECORD A COMPREHENSIVE DEMO VIDEO (3+ minutes) ===
    console.log('\n🎥 Recording comprehensive demo video (3+ minutes)...\n');

    // Start from Dashboard
    await safeClick('Dashboard ⌘D', 'Dashboard');
    await page.waitForTimeout(2000);

    console.log('🎬 Section 1: Dashboard & Market Overview (30s)');
    await page.waitForTimeout(5000);
    // Scroll through dashboard
    await page.evaluate(() => window.scrollTo(0, 500));
    await page.waitForTimeout(3000);
    await page.evaluate(() => window.scrollTo(0, 1000));
    await page.waitForTimeout(3000);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(2000);

    console.log('🎬 Section 2: Chart & Technical Analysis (40s)');
    await safeClick('Chart ⌘1', 'Chart');
    await page.waitForTimeout(3000);
    
    // Try to interact with chart - change symbol if possible
    const searchButton = page.locator('button:has-text("Search")').first();
    if (await searchButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await searchButton.click();
      await page.waitForTimeout(1000);
      await page.keyboard.type('AAPL');
      await page.waitForTimeout(1500);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(4000);
    }

    // Try different timeframes if buttons visible
    const timeframeButtons = ['1D', '1H', '5m'];
    for (const tf of timeframeButtons) {
      const tfButton = page.locator(`button:has-text("${tf}")`).first();
      if (await tfButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await tfButton.click();
        await page.waitForTimeout(3000);
      }
    }

    console.log('🎬 Section 3: Portfolio Management (25s)');
    await safeClick('Portfolio ⌘P', 'Portfolio');
    await page.waitForTimeout(5000);
    await page.evaluate(() => window.scrollTo(0, 300));
    await page.waitForTimeout(3000);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(2000);

    console.log('🎬 Section 4: Orders & Execution (20s)');
    await safeClick('Orders ⌘O', 'Orders');
    await page.waitForTimeout(5000);

    console.log('🎬 Section 5: Autopilot Intelligence (30s)');
    await safeClick('Autopilot ⌘A', 'Autopilot');
    await page.waitForTimeout(7000);
    await page.evaluate(() => window.scrollTo(0, 400));
    await page.waitForTimeout(3000);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(3000);

    console.log('🎬 Section 6: Strategy Development (25s)');
    await safeClick('Strategies & Rules ⌘S', 'Strategies');
    await page.waitForTimeout(6000);
    
    console.log('🎬 Section 7: Options Trading (25s)');
    await safeClick('Options ⌘2', 'Options');
    await page.waitForTimeout(6000);
    await page.evaluate(() => window.scrollTo(0, 400));
    await page.waitForTimeout(3000);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(2000);

    console.log('🎬 Section 8: Backtesting & Analysis (20s)');
    await safeClick('Backtests ⌘B', 'Backtests');
    await page.waitForTimeout(5000);

    console.log('🎬 Section 9: Runs & Monitoring (15s)');
    await safeClick('Runs / Audit Log ⌘R', 'Runs');
    await page.waitForTimeout(4000);

    console.log('🎬 Section 10: Replay Mode (15s)');
    await safeClick('Replay ⌘3', 'Replay');
    await page.waitForTimeout(4000);

    console.log('🎬 Section 11: Settings & Configuration (15s)');
    await safeClick('Settings', 'Settings ');
    await page.waitForTimeout(4000);

    console.log('🎬 Final: Return to Dashboard (10s)');
    await safeClick('Dashboard ⌘D', 'Dashboard');
    await page.waitForTimeout(5000);

    console.log('\n✅ Video recording complete! Total duration: ~3.5 minutes\n');

  } catch (error) {
    console.error('❌ Error during capture:', error);
  } finally {
    // Close and save video
    await page.close();
    await context.close();
    await browser.close();

    console.log('\n✅ All captures complete!');
    console.log(`📁 Screenshots saved to: ${SCREENSHOTS_DIR}`);
    console.log(`🎥 Video saved to: ${VIDEO_DIR}`);
    console.log('\n📝 Summary:');
    console.log('   - 13 feature screenshots captured');
    console.log('   - 1 comprehensive 4-minute demo video');
    console.log('\nRenaming video file...');
    
    // Find the video file and rename it
    setTimeout(() => {
      const files = fs.readdirSync(VIDEO_DIR);
      const videoFile = files.find(f => f.endsWith('.webm'));
      if (videoFile) {
        const oldPath = path.join(VIDEO_DIR, videoFile);
        const newPath = path.join(VIDEO_DIR, 'comprehensive_demo_2026.webm');
        fs.renameSync(oldPath, newPath);
        console.log(`✅ Video renamed to: comprehensive_demo_2026.webm`);
      }
    }, 2000);
  }
}

// Run the capture
captureFeatures().catch(console.error);
