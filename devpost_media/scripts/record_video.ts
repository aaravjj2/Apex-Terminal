/**
 * Playwright Video Recording for Devpost Demo
 * 
 * Records a complete demo video following the storyboard:
 * 1. Dashboard / Chart UI
 * 2. Autopilot / Candidate Generation
 * 3. Trade Execution
 * 4. Position Monitoring
 * 5. Exit Management
 */

import { chromium, Browser, Page, BrowserContext } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';

const VIEWPORT = { width: 1920, height: 1080 };
const OUTPUT_DIR = path.join(__dirname, '../video');
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:50001';

// Scene timings (in milliseconds)
const SCENES = {
  TITLE: 5000,
  DASHBOARD: 30000,
  AUTOPILOT: 45000,
  EXECUTION: 30000,
  MONITORING: 30000,
  ARCHITECTURE: 30000,
  CLOSING: 10000,
};

async function ensureOutputDir() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
}

async function checkHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${BACKEND_URL}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForElement(page: Page, selector: string, timeout = 10000) {
  try {
    await page.waitForSelector(selector, { timeout, state: 'visible' });
    return true;
  } catch {
    console.log(`  ⚠ Timeout waiting for: ${selector}`);
    return false;
  }
}

async function navigate(page: Page, path: string, waitSelector?: string) {
  await page.goto(`${FRONTEND_URL}${path}`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => { });
  if (waitSelector) {
    await waitForElement(page, waitSelector);
  }
  await page.waitForTimeout(1000); // Let React hydrate
}

async function recordDemo(context: BrowserContext) {
  console.log('\\n🎬 Starting demo recording...\\n');

  const page = await context.newPage();
  const startTime = Date.now();

  try {
    // Scene 1: Title Card (5s)
    console.log('[Scene 1] Title Card (5s)');
    await page.goto(`${FRONTEND_URL}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(SCENES.TITLE);

    // Scene 2: Dashboard / Chart UI (30s)
    console.log('[Scene 2] Dashboard / Chart UI (30s)');
    await navigate(page, '/', 'canvas, [class*="chart"], h1');

    // Show chart interaction
    await page.waitForTimeout(3000);

    // Try to interact with chart if visible
    const chartArea = page.locator('canvas, [class*="chart"]').first();
    if (await chartArea.isVisible()) {
      const box = await chartArea.boundingBox();
      if (box) {
        // Hover over chart
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.waitForTimeout(2000);
      }
    }

    await page.waitForTimeout(SCENES.DASHBOARD - 5000);

    // Scene 3: Autopilot / Candidate Generation (45s)
    console.log('[Scene 3] Autopilot / Candidate Generation (45s)');
    await navigate(page, '/system', 'text=Autopilot, text=System');

    // Scroll to autopilot section
    await page.evaluate(() => {
      const autopilotSection = document.querySelector('[id*="autopilot"], [class*="autopilot"]');
      if (autopilotSection) {
        autopilotSection.scrollIntoView({ behavior: 'smooth' });
      }
    });
    await page.waitForTimeout(2000);

    // Try to click "Run Cycle" button if visible
    const runButton = page.locator('button:has-text("Run"), button:has-text("Cycle")').first();
    if (await runButton.isVisible().catch(() => false)) {
      console.log('  Clicking Run Cycle button...');
      await runButton.click();
      await page.waitForTimeout(5000); // Wait for candidates to generate
    }

    await page.waitForTimeout(SCENES.AUTOPILOT - 7000);

    // Scene 4: Trade Execution / Positions (30s)
    console.log('[Scene 4] Trade Execution / Positions (30s)');
    await navigate(page, '/positions', 'h1, [class*="position"], table');

    await page.waitForTimeout(5000);

    // Scroll through positions if they exist
    await page.evaluate(() => {
      window.scrollTo({ top: 200, behavior: 'smooth' });
    });
    await page.waitForTimeout(3000);

    await page.evaluate(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    await page.waitForTimeout(SCENES.EXECUTION - 8000);

    // Scene 5: Monitoring / Trade History (30s)
    console.log('[Scene 5] Monitoring / Trade History (30s)');
    await navigate(page, '/trades', 'h1, [class*="trade"], table');

    await page.waitForTimeout(5000);

    // Scroll through trade history
    await page.evaluate(() => {
      window.scrollTo({ top: 300, behavior: 'smooth' });
    });
    await page.waitForTimeout(3000);

    await page.evaluate(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    await page.waitForTimeout(SCENES.MONITORING - 8000);

    // Scene 6: Architecture (30s) - Show diagram image
    console.log('[Scene 6] Architecture Diagram (30s)');
    const diagramPath = path.join(__dirname, '../images/06_architecture.svg');
    if (fs.existsSync(diagramPath)) {
      await page.goto(`file://${diagramPath}`);
      await page.waitForTimeout(SCENES.ARCHITECTURE);
    } else {
      console.log('  ⚠ Architecture diagram not found, showing dashboard instead');
      await navigate(page, '/');
      await page.waitForTimeout(SCENES.ARCHITECTURE);
    }

    // Scene 7: Closing (10s)
    console.log('[Scene 7] Closing Credits (10s)');
    await navigate(page, '/');
    await page.waitForTimeout(SCENES.CLOSING);

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\\n✅ Recording complete! Duration: ${duration}s`);

  } catch (error) {
    console.error('\\n❌ Recording error:', error);
    throw error;
  } finally {
    await page.close();
  }
}

async function main() {
  console.log('========================================');
  console.log('   Video Recording for Devpost');
  console.log('========================================\\n');

  console.log(`Backend:  ${BACKEND_URL}`);
  console.log(`Frontend: ${FRONTEND_URL}`);
  console.log(`Output:   ${OUTPUT_DIR}`);

  // Ensure output directory
  ensureOutputDir();

  // Check backend
  console.log('\\n🔍 Checking backend health...');
  const healthy = await checkHealth();
  if (!healthy) {
    console.error('\\n❌ Backend not responding. Start it first:');
    console.error('  ./scripts/run_demo.sh');
    process.exit(1);
  }
  console.log('✅ Backend healthy');

  // Calculate expected duration
  const totalSeconds = Object.values(SCENES).reduce((sum, val) => sum + val, 0) / 1000;
  console.log(`\\n⏱  Expected duration: ${(totalSeconds / 60).toFixed(1)} minutes`);
  console.log('\\n🎥 Launching browser with video recording...\\n');

  // Launch browser with video recording
  const browser = await chromium.launch({
    headless: true, // Run headless for environment compatibility
  });

  const videoPath = path.join(OUTPUT_DIR, 'demo_raw.webm');
  const context = await browser.newContext({
    viewport: VIEWPORT,
    recordVideo: {
      dir: OUTPUT_DIR,
      size: VIEWPORT,
    },
  });

  try {
    await recordDemo(context);

    // Close context to finalize video
    await context.close();
    await browser.close();

    console.log('\\n🎞  Processing video file...');
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for file write

    // Find the video file (Playwright names it uniquely)
    const files = fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.webm'));
    if (files.length > 0) {
      const sourceVideo = path.join(OUTPUT_DIR, files[files.length - 1]);
      const targetVideo = path.join(OUTPUT_DIR, 'demo_raw.webm');

      if (sourceVideo !== targetVideo) {
        fs.renameSync(sourceVideo, targetVideo);
      }

      const stats = fs.statSync(targetVideo);
      console.log(`✅ Video saved: demo_raw.webm (${(stats.size / 1024 / 1024).toFixed(1)} MB)`);

      console.log('\\n========================================');
      console.log('   Next Steps');
      console.log('========================================\\n');
      console.log('1. Convert to MP4:');
      console.log(`   ffmpeg -i "${targetVideo}" -c:v libx264 -preset medium -crf 23 -c:a aac -b:a 128k "${OUTPUT_DIR}/demo.mp4"`);
      console.log('\\n2. Extract thumbnail:');
      console.log(`   ffmpeg -i "${OUTPUT_DIR}/demo.mp4" -ss 00:00:15 -vframes 1 -s 1280x720 "${OUTPUT_DIR}/thumbnail.png"`);
      console.log('\\n3. Add narration (optional):');
      console.log('   Use video editing software to add voiceover from demo_script.md');
      console.log('\\n4. Trim to 2-3 minutes if needed');

    } else {
      console.log('⚠ Video file not found. Check OUTPUT_DIR.');
    }

  } catch (error) {
    await context.close().catch(() => { });
    await browser.close().catch(() => { });
    throw error;
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('\\nFatal error:', error);
    process.exit(1);
  });
}

export { main as recordDemo };
