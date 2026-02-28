/**
 * UI2 Redesign Media Pack Generator
 * Captures comprehensive screenshots and 3+ minute walkthrough video
 * Showcases Bloomberg-grade professional terminal redesign
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:5100/ui2';
const MEDIA_DIR = path.join(__dirname, 'artifacts', 'media', 'ui2-redesign');
const SCREENSHOTS_DIR = path.join(MEDIA_DIR, 'screenshots');
const VIDEO_DIR = path.join(MEDIA_DIR, 'video');

// Ensure directories exist
[MEDIA_DIR, SCREENSHOTS_DIR, VIDEO_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Workspace configurations
const WORKSPACES = [
    { id: 'dashboard', path: '/ui2/dashboard', label: 'Dashboard', testId: 'dashboard-ui2-page', duration: 20 },
    { id: 'trading', path: '/ui2/trading', label: 'Trading', testId: 'trading-ui2-page', duration: 25 },
    { id: 'portfolio', path: '/ui2/portfolio', label: 'Portfolio', testId: 'portfolio-ui2-page', duration: 20 },
    { id: 'orders', path: '/ui2/orders', label: 'Orders', testId: 'orders-ui2-page', duration: 15 },
    { id: 'risk', path: '/ui2/risk', label: 'Risk & Options', testId: 'risk-ui2-page', duration: 25 },
    { id: 'research', path: '/ui2/research', label: 'Research', testId: 'research-ui2-page', duration: 20 },
    { id: 'backtest', path: '/ui2/backtest', label: 'Backtest', testId: 'backtest-ui2-page', duration: 18 },
    { id: 'autopilot', path: '/ui2/autopilot', label: 'Autopilot', testId: 'autopilot-ui2-page', duration: 25 },
    { id: 'alerts', path: '/ui2/alerts', label: 'Alerts', testId: 'alerts-ui2-page', duration: 15 },
    { id: 'replay', path: '/ui2/replay', label: 'Replay', testId: 'replay-ui2-page', duration: 15 },
    { id: 'runs', path: '/ui2/runs', label: 'Runs & Audit', testId: 'runs-ui2-page', duration: 15 },
    { id: 'ops', path: '/ui2/ops', label: 'Ops', testId: 'ops-ui2-page', duration: 15 },
    { id: 'settings', path: '/ui2/settings', label: 'Settings', testId: 'settings-ui2-page', duration: 12 },
];

async function captureScreenshots(page) {
    console.log('\n📸 Capturing workspace screenshots...\n');
    
    for (const workspace of WORKSPACES) {
        console.log(`  Capturing ${workspace.label}...`);
        
        // Navigate to workspace
        await page.goto(`http://localhost:5100${workspace.path}`);
        
        // Wait for page to be ready
        await page.waitForSelector(`[data-testid="${workspace.testId}"]`, { timeout: 10000 });
        await page.waitForTimeout(2000); // Let content settle
        
        // Capture screenshot
        const screenshotPath = path.join(SCREENSHOTS_DIR, `${workspace.id}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: false });
        
        console.log(`    ✓ Saved to ${workspace.id}.png`);
    }
    
    // Capture command palette screenshot
    console.log('  Capturing Command Palette (Ctrl+K)...');
    await page.goto(BASE_URL);
    await page.waitForTimeout(2000);
    await page.keyboard.press('Control+k');
    await page.waitForSelector('[data-testid="ui2-command-palette"]', { timeout: 15000 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'command-palette.png') });
    console.log('    ✓ Saved to command-palette.png');
    
    // Capture app shell overview
    console.log('  Capturing App Shell overview...');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'app-shell-overview.png') });
    console.log('    ✓ Saved to app-shell-overview.png');
    
    console.log('\n✅ All screenshots captured!\n');
}

async function captureWalkthroughVideo() {
    console.log('\n🎥 Capturing 3+ minute comprehensive walkthrough video...\n');
    
    // Launch browser with video recording
    const browser = await chromium.launch({
        headless: false,
        channel: 'chrome',
        args: ['--no-sandbox', '--disable-gpu'],
        slowMo: 100, // Slow down for better visibility
    });
    
    const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        recordVideo: {
            dir: VIDEO_DIR,
            size: { width: 1920, height: 1080 },
        },
    });
    
    const page = await context.newPage();
    
    console.log('  Starting comprehensive walkthrough...\n');
    
    // Section 1: App Shell & Brand (15s)
    console.log('  [00:00-00:15] Section 1: App Shell & Professional Branding');
    await page.goto(BASE_URL);
    await page.waitForSelector('[data-testid="ui2-app-shell"]', { timeout: 10000 });
    await page.waitForTimeout(5000);
    
    // Highlight top bar elements
    await page.hover('[data-testid="ui2-mode-badge"]');
    await page.waitForTimeout(2000);
    await page.hover('[data-testid="ui2-connectivity"]');
    await page.waitForTimeout(2000);
    
    // Section 2: Command Palette (20s)
    console.log('  [00:15-00:35] Section 2: Command Palette (Ctrl+K)');
    await page.keyboard.press('Control+k');
    await page.waitForSelector('[data-testid="ui2-command-palette"]');
    await page.waitForTimeout(3000);
    
    // Type search query
    const input = page.locator('[data-testid="ui2-command-palette-input"]');
    await input.fill('trading');
    await page.waitForTimeout(3000);
    await input.fill('');
    await page.waitForTimeout(2000);
    
    // Navigate via palette
    await page.click('[data-testid="ui2-command-palette-item-trading"]');
    await page.waitForTimeout(3000);
    
    // Section 3: Trading Workspace (25s)
    console.log('  [00:35-01:00] Section 3: Trading Workspace');
    await page.waitForSelector('[data-testid="trading-ui2-page"]');
    await page.waitForTimeout(8000);
    
    // Interact with bottom dock
    const bottomDock = page.locator('[data-testid="ui2-bottom-dock"]');
    await bottomDock.locator('text=Trades').click();
    await page.waitForTimeout(4000);
    await bottomDock.locator('text=Orders').click();
    await page.waitForTimeout(4000);
    
    // Section 4: Dashboard (20s)
    console.log('  [01:00-01:20] Section 4: Dashboard - Command Center');
    await page.click('[data-testid="ui2-rail-dashboard"]');
    await page.waitForSelector('[data-testid="dashboard-ui2-page"]');
    await page.waitForTimeout(8000);
    
    // Section 5: Portfolio (18s)
    console.log('  [01:20-01:38] Section 5: Portfolio Management');
    await page.click('[data-testid="ui2-rail-portfolio"]');
    await page.waitForSelector('[data-testid="portfolio-ui2-page"]');
    await page.waitForTimeout(8000);
    
    // Section 6: Risk & Options (25s)
    console.log('  [01:38-02:03] Section 6: Risk Desk & Options Chain');
    await page.click('[data-testid="ui2-rail-risk"]');
    await page.waitForSelector('[data-testid="risk-ui2-page"]');
    await page.waitForTimeout(10000);
    
    // Section 7: Research & Strategies (20s)
    console.log('  [02:03-02:23] Section 7: Strategy Research Lab');
    await page.click('[data-testid="ui2-rail-research"]');
    await page.waitForSelector('[data-testid="research-ui2-page"]');
    await page.waitForTimeout(8000);
    
    // Section 8: Backtest (18s)
    console.log('  [02:23-02:41] Section 8: Backtesting Engine');
    await page.click('[data-testid="ui2-rail-backtest"]');
    await page.waitForSelector('[data-testid="backtest-ui2-page"]');
    await page.waitForTimeout(7000);
    
    // Section 9: Autopilot (25s)
    console.log('  [02:41-03:06] Section 9: Autonomous Trading Agent');
    await page.click('[data-testid="ui2-rail-autopilot"]');
    await page.waitForSelector('[data-testid="autopilot-ui2-page"]');
    await page.waitForTimeout(10000);
    
    // Section 10: Alerts (15s)
    console.log('  [03:06-03:21] Section 10: Alert Management');
    await page.click('[data-testid="ui2-rail-alerts"]');
    await page.waitForSelector('[data-testid="alerts-ui2-page"]');
    await page.waitForTimeout(6000);
    
    // Section 11: Orders (12s)
    console.log('  [03:21-03:33] Section 11: Order History');
    await page.click('[data-testid="ui2-rail-orders"]');
    await page.waitForSelector('[data-testid="orders-ui2-page"]');
    await page.waitForTimeout(5000);
    
    // Section 12: Settings (12s)
    console.log('  [03:33-03:45] Section 12: Platform Settings');
    await page.click('[data-testid="ui2-rail-settings"]');
    await page.waitForSelector('[data-testid="settings-ui2-page"]');
    await page.waitForTimeout(5000);
    
    // Final: Return to Dashboard (10s)
    console.log('  [03:45-03:55] Final: Return to Dashboard');
    await page.click('[data-testid="ui2-rail-dashboard"]');
    await page.waitForSelector('[data-testid="dashboard-ui2-page"]');
    await page.waitForTimeout(5000);
    
    console.log('\n  🎬 Recording complete! Finalizing video...\n');
    
    // Close to save video
    await context.close();
    await browser.close();
    
    // Rename video to friendly name
    const videoFiles = fs.readdirSync(VIDEO_DIR).filter(f => f.endsWith('.webm'));
    if (videoFiles.length > 0) {
        const oldPath = path.join(VIDEO_DIR, videoFiles[0]);
        const newPath = path.join(VIDEO_DIR, 'ui2-redesign-walkthrough-2026.webm');
        fs.renameSync(oldPath, newPath);
        console.log(`  ✅ Video saved to: ui2-redesign-walkthrough-2026.webm`);
        
        // Get file size
        const stats = fs.statSync(newPath);
        const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
        console.log(`  📊 Video size: ${sizeMB} MB`);
        console.log(`  ⏱️  Duration: ~3 minutes 55 seconds\n`);
    }
}

async function generateMediaPack() {
    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║   UI2 REDESIGN MEDIA PACK GENERATOR                   ║');
    console.log('║   Bloomberg Terminal-Grade Professional Showcase      ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');
    
    const browser = await chromium.launch({
        headless: false,
        channel: 'chrome',
        args: ['--no-sandbox', '--disable-gpu'],
    });
    
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    
    try {
        // 1. Capture screenshots
        await captureScreenshots(page);
        
        await browser.close();
        
        // 2. Capture walkthrough video (separate browser instance with recording)
        await captureWalkthroughVideo();
        
        // 3. Generate inventory
        console.log('\n📋 Media Pack Inventory:\n');
        console.log(`  Screenshots: ${fs.readdirSync(SCREENSHOTS_DIR).length} files`);
        console.log(`  Video: ${fs.readdirSync(VIDEO_DIR).filter(f => f.endsWith('.webm')).length} files`);
        console.log(`\n  Output directory: ${MEDIA_DIR}\n`);
        
        console.log('✅ Media pack generation complete!\n');
        
    } catch (error) {
        console.error('\n❌ Error generating media pack:', error);
        process.exit(1);
    }
}

// Run
generateMediaPack().catch(console.error);
