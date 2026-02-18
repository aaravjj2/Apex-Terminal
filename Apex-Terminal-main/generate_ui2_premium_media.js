/**
 * UI2 Premium Polish Media Pack Generator
 * Captures screenshots and video for proof pack
 */

const playwright = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:5100';
const MEDIA_DIR = path.join(__dirname, 'artifacts', 'media', 'ui2-premium');
const SCREENSHOTS_DIR = path.join(MEDIA_DIR, 'screenshots');
const VIDEO_DIR = path.join(MEDIA_DIR, 'video');

// Ensure directories exist
[MEDIA_DIR, SCREENSHOTS_DIR, VIDEO_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

async function captureMediaPack() {
  console.log('🎬 Starting UI2 Premium Polish media pack generation...\n');
  
  const browser = await playwright.chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: {
      dir: VIDEO_DIR,
      size: { width: 1920, height: 1080 }
    }
  });
  
  const page = await context.newPage();
  
  try {
    console.log('📸 Phase 1: App Shell & Navigation');
    await page.goto(`${BASE_URL}/ui2`);
    await page.waitForSelector('[data-testid="ui2-app-shell"]', { timeout: 15000 });
    await page.waitForTimeout(2000); // Let animations settle
    
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '01-ui2-app-shell.png'), fullPage: false });
    console.log('  ✅ App shell captured');
    
    console.log('\n📸 Phase 2: Command Palette');
    await page.keyboard.press('Control+k');
    await page.waitForSelector('[data-testid="ui2-command-palette"]', { timeout: 5000 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '02-command-palette.png'), fullPage: false });
    console.log('  ✅ Command palette captured');
    
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    
    console.log('\n📸 Phase 3: Dashboard Premium Components');
    await page.click('[data-testid="ui2-rail-dashboard"]');
    await page.waitForSelector('[data-testid="dashboard-ui2-page"]', { timeout: 5000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '03-dashboard-kpi-strip.png'), fullPage: false });
    console.log('  ✅ Dashboard with KPI strip captured');
    
    await page.waitForSelector('[data-testid="ui2-insights-panel"]', { timeout: 5000 });
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '04-dashboard-insights-panel.png'), fullPage: false });
    console.log('  ✅ AI insights panel captured');
    
    await page.waitForSelector('[data-testid="ui2-data-table-positions"]', { timeout: 5000 });
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '05-dashboard-positions-table.png'), fullPage: false });
    console.log('  ✅ Positions table with P&L captured');
    
    console.log('\n📸 Phase 4: Orders Premium Components');
    await page.click('[data-testid="ui2-rail-orders"]');
    await page.waitForSelector('[data-testid="orders-ui2-page"]', { timeout: 5000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '06-orders-table-badges.png'), fullPage: false });
    console.log('  ✅ Orders table with status badges captured');
    
    await page.waitForSelector('[data-testid="order-status-ORD-2024-003"]', { timeout: 5000 });
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '07-orders-progress-bar.png'), fullPage: false });
    console.log('  ✅ Fill progress bar captured');
    
    await page.waitForSelector('[data-testid="order-summary-filled"]', { timeout: 5000 });
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '08-orders-summary-stats.png'), fullPage: false });
    console.log('  ✅ Order summary stats captured');
    
    console.log('\n📸 Phase 5: All Workspaces Tour');
    const workspaces = [
      { id: 'trading', label: 'Trading' },
      { id: 'portfolio', label: 'Portfolio' },
      { id: 'risk', label: 'Risk & Options' },
      { id: 'research', label: 'Research' },
      { id: 'backtest', label: 'Backtest' },
      { id: 'autopilot', label: 'Autopilot' },
      { id: 'alerts', label: 'Alerts' },
      { id: 'replay', label: 'Replay' },
      { id: 'runs', label: 'Runs & Audit' },
      { id: 'ops', label: 'Ops' },
      { id: 'settings', label: 'Settings' }
    ];
    
    let idx = 9;
    for (const workspace of workspaces) {
      await page.click(`[data-testid="ui2-rail-${workspace.id}"]`);
      await page.waitForURL(new RegExp(`/ui2/${workspace.id}`), { timeout: 5000 });
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, `${String(idx).padStart(2, '0')}-workspace-${workspace.id}.png`), fullPage: false });
      console.log(`  ✅ ${workspace.label} workspace captured`);
      idx++;
    }
    
    console.log('\n📸 Phase 6: Design System Details');
    await page.click('[data-testid="ui2-rail-dashboard"]');
    await page.waitForSelector('[data-testid="dashboard-ui2-page"]', { timeout: 5000 });
    await page.waitForTimeout(1000);
    
    // Capture KPI card detail
    const kpiElement = await page.locator('[data-testid="kpi-item-portfolio-value"]');
    await kpiElement.screenshot({ path: path.join(SCREENSHOTS_DIR, '20-design-kpi-card-detail.png') });
    console.log('  ✅ KPI card detail captured');
    
    // Capture insight card detail
    const insightElement = await page.locator('[data-testid="insight-card-insight-001"]');
    await insightElement.screenshot({ path: path.join(SCREENSHOTS_DIR, '21-design-insight-card-detail.png') });
    console.log('  ✅ Insight card detail captured');
    
    console.log('\n✅ All screenshots captured successfully!\n');
    console.log('🎥 Video recording in progress (will be saved on browser close)...\n');
    
    // Keep browser open for video recording
    console.log('📹 Final walkthrough for video...');
    await page.goto(`${BASE_URL}/ui2/dashboard`);
    await page.waitForTimeout(2000);
    
    // Quick navigation tour for video
    await page.keyboard.press('Control+k');
    await page.waitForTimeout(1000);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    
    for (const workspace of ['orders', 'trading', 'portfolio', 'risk', 'dashboard']) {
      await page.click(`[data-testid="ui2-rail-${workspace}"]`);
      await page.waitForTimeout(2000);
    }
    
    console.log('✅ Video walkthrough complete!\n');
    
  } catch (error) {
    console.error('❌ Error during media capture:', error);
    throw error;
  } finally {
    await context.close();
    await browser.close();
    console.log('✅ Browser closed, video saved\n');
    
    // Rename video file
    const videoFiles = fs.readdirSync(VIDEO_DIR);
    if (videoFiles.length > 0) {
      const videoFile = videoFiles[0];
      const newVideoName = 'ui2-premium-polish-demo.webm';
      fs.renameSync(
        path.join(VIDEO_DIR, videoFile),
        path.join(VIDEO_DIR, newVideoName)
      );
      console.log(`📹 Video saved as: ${newVideoName}\n`);
    }
    
    console.log('════════════════════════════════════════════════════════');
    console.log('🎉 UI2 Premium Polish Media Pack Complete!');
    console.log('════════════════════════════════════════════════════════');
    console.log(`📂 Location: ${MEDIA_DIR}`);
    console.log(`📸 Screenshots: ${SCREENSHOTS_DIR}`);
    console.log(`🎥 Video: ${VIDEO_DIR}`);
    console.log('════════════════════════════════════════════════════════\n');
  }
}

captureMediaPack().catch(console.error);
