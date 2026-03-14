/**
 * Apex Terminal — Screenshot + Video Capture (Node 12 compatible, CommonJS)
 * Run: node media/capture.js
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const SCREENSHOTS = path.join(__dirname, 'screenshots');
const VIDEOS      = path.join(__dirname, 'videos');
fs.mkdirSync(SCREENSHOTS, { recursive: true });
fs.mkdirSync(VIDEOS,      { recursive: true });

const BASE = 'http://localhost:5100';

const PAGES = [
  { id: 'dashboard',          path: '/ui2/dashboard',          label: 'Dashboard'          },
  { id: 'trading',            path: '/ui2/trading',            label: 'Trading / Chart'    },
  { id: 'portfolio',          path: '/ui2/portfolio',          label: 'Portfolio'          },
  { id: 'autopilot',          path: '/ui2/autopilot',          label: 'Autopilot Engine'   },
  { id: 'autopilot-v2',       path: '/ui2/autopilot-v2',       label: 'Autopilot V2'       },
  { id: 'options-chain',      path: '/ui2/options-chain',      label: 'Options Chain'      },
  { id: 'heatmap',            path: '/ui2/heatmap',            label: 'Market Heatmap'     },
  { id: 'watchlist-manager',  path: '/ui2/watchlist-manager',  label: 'Watchlist Manager'  },
  { id: 'screeners',          path: '/ui2/screeners',          label: 'Screeners'          },
  { id: 'backtest',           path: '/ui2/backtest',           label: 'Backtest'           },
  { id: 'financial-analysis', path: '/ui2/financial-analysis', label: 'Financial Analysis' },
  { id: 'model-router',       path: '/ui2/model-router',       label: 'Model Router'       },
  { id: 'risk',               path: '/ui2/risk',               label: 'Risk Dashboard'     },
];

function wait(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }

async function captureScreenshots() {
  console.log('Capturing screenshots…');
  const browser = await chromium.launch({ headless: false, args: ['--window-size=1920,1080'] });
  const ctx = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    colorScheme: 'dark',
  });
  const page = await ctx.newPage();

  for (var i = 0; i < PAGES.length; i++) {
    var p = PAGES[i];
    try {
      await page.goto(BASE + p.path, { waitUntil: 'networkidle', timeout: 25000 });
      await wait(2000);
      var file = path.join(SCREENSHOTS, p.id + '.png');
      await page.screenshot({ path: file, fullPage: false });
      console.log('  OK  ' + p.label + '  ->  ' + file);
    } catch (e) {
      console.warn('  WARN  ' + p.label + ': ' + e.message);
    }
  }

  await page.close();
  await ctx.close();
  await browser.close();
  console.log('Screenshots done.');
}

async function recordWalkthrough() {
  console.log('\nRecording 3-min walkthrough video…');
  const browser = await chromium.launch({ headless: false, args: ['--window-size=1920,1080'] });
  const ctx = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    colorScheme: 'dark',
    recordVideo: {
      dir: VIDEOS,
      size: { width: 1920, height: 1080 },
    },
  });
  const page = await ctx.newPage();

  // 14s per page * 13 pages = 182s (3:02)
  var DWELL = 14000;

  for (var i = 0; i < PAGES.length; i++) {
    var p = PAGES[i];
    try {
      console.log('  > ' + p.label);
      await page.goto(BASE + p.path, { waitUntil: 'networkidle', timeout: 25000 });
      await wait(DWELL);
    } catch (e) {
      console.warn('  WARN  ' + p.label + ': ' + e.message);
      await wait(DWELL / 2);
    }
  }

  var video = page.video();
  await page.close();
  await ctx.close();
  await browser.close();

  // video.path() returns the saved file path
  if (video) {
    try {
      var savedPath = await video.path();
      if (savedPath) {
        var dest = path.join(VIDEOS, 'apex-terminal-walkthrough.webm');
        fs.renameSync(savedPath, dest);
        console.log('\n  Video saved -> ' + dest);
      }
    } catch (e) {
      console.warn('  Video rename failed: ' + e.message);
    }
  }
}

(async function main() {
  try {
    await captureScreenshots();
    await recordWalkthrough();
    console.log('\nCapture complete. Screenshots + video in ./media/');
  } catch (e) {
    console.error('Capture failed:', e);
    process.exit(1);
  }
})();
