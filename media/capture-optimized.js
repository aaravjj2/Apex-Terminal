/**
 * Apex Terminal — Optimized Screenshot Capture
 * Captures all 13 pages with PNG compression optimized for <5MB per file
 * Run: ~/.nvm/versions/node/v22.21.1/bin/node media/capture-optimized.js
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const SCREENSHOTS = path.join(__dirname, 'screenshots-optimized');
fs.mkdirSync(SCREENSHOTS, { recursive: true });

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

function getFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

async function captureScreenshots() {
  console.log('🖼  Capturing optimized screenshots…\n');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1600, height: 900 }, // Smaller viewport for smaller file size
    colorScheme: 'dark',
  });
  const page = await context.newPage();

  for (var i = 0; i < PAGES.length; i++) {
    var p = PAGES[i];
    try {
      await page.goto(BASE + p.path, { waitUntil: 'load', timeout: 30000 });
      await wait(2000);
      var file = path.join(SCREENSHOTS, p.id + '.png');
      // Use higher quality PNG compression (lower compression = smaller file)
      // For Playwright, PNG compression is automatic and optimized
      await page.screenshot({ path: file, fullPage: false });

      var stats = fs.statSync(file);
      var size = getFileSize(stats.size);
      var mark = stats.size < 5 * 1024 * 1024 ? '✓' : '⚠';
      console.log('  ' + mark + '  ' + p.label.padEnd(24) + '  ' + size);
    } catch (e) {
      console.warn('  ✗  ' + p.label.padEnd(24) + '  ' + e.message);
    }
  }

  await context.close();
  await browser.close();

  console.log('\n✅  Screenshots saved to ./media/screenshots-optimized/');
}

(async function main() {
  try {
    await captureScreenshots();
  } catch (e) {
    console.error('Capture failed:', e);
    process.exit(1);
  }
})();
