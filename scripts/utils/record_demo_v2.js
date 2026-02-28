/**
 * Apex Terminal — Hackathon Demo Video Recorder v2
 * Comprehensive 4-minute walkthrough of ALL features
 * Uses Playwright with video recording enabled
 *
 * Run: node record_demo_v2.js
 */

const { chromium } = require('./frontend/node_modules/playwright');
const path = require('path');
const fs = require('fs');

const BASE = 'http://localhost:5100';
const OUTPUT_DIR = path.join(__dirname, 'demo_v2_screenshots');

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function go(page, route, label) {
  console.log(`  → ${route}  [${label}]`);
  await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await sleep(1800);
}

async function shot(page, idx, name) {
  const file = path.join(OUTPUT_DIR, `${String(idx).padStart(2, '0')}-${name}.png`);
  await page.screenshot({ path: file, type: 'png', fullPage: false });
  console.log(`    📸 ${path.basename(file)}`);
}

async function clickTab(page, text) {
  const btn = page.getByRole('button', { name: text, exact: false });
  if (await btn.count()) { await btn.first().click(); await sleep(900); return true; }
  const tab = page.getByText(text, { exact: false });
  if (await tab.count()) { await tab.first().click(); await sleep(900); return true; }
  return false;
}

async function recordDemo() {
  console.log('\n🎬  APEX TERMINAL  —  Hackathon Demo Recording v2\n');

  const browser = await chromium.launch({ headless: false, args: ['--start-maximized'] });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: { dir: __dirname, size: { width: 1920, height: 1080 } },
  });

  const page = await context.newPage();
  let idx = 1;
  const s = (name) => shot(page, idx++, name);

  try {
    // ─────────────────────────────────────────────────────────────────
    // SEGMENT 1 — MARKET COMMAND CENTER  (~0:00-0:45)
    // ─────────────────────────────────────────────────────────────────
    console.log('\n── 1/10  MARKET COMMAND CENTER ──');
    await go(page, '/ui2/dashboard', 'dashboard');
    await s('dashboard-overview');
    await sleep(1200);
    await s('ticker-strip-live');
    await clickTab(page, 'HEATMAP');
    await s('sector-heatmap');
    await clickTab(page, 'MOVERS');
    await s('top-movers');
    await clickTab(page, 'POSITIONS');
    await s('positions-dashboard');
    await clickTab(page, 'OVERVIEW');
    await sleep(800);
    await s('dashboard-final');

    // ─────────────────────────────────────────────────────────────────
    // SEGMENT 2 — TRADING TERMINAL  (~0:45-1:15)
    // ─────────────────────────────────────────────────────────────────
    console.log('\n── 2/10  TRADING TERMINAL ──');
    await go(page, '/ui2/trading', 'trading');
    await s('trading-main');
    await sleep(1000);
    await s('order-blotter');

    // ─────────────────────────────────────────────────────────────────
    // SEGMENT 3 — PORTFOLIO MANAGEMENT  (~1:15-1:45)
    // ─────────────────────────────────────────────────────────────────
    console.log('\n── 3/10  PORTFOLIO ──');
    await go(page, '/ui2/portfolio', 'portfolio');
    await s('portfolio-holdings');
    await clickTab(page, 'RISK');
    await s('portfolio-risk');
    await clickTab(page, 'CORRELATION');
    await s('portfolio-correlation');

    // ─────────────────────────────────────────────────────────────────
    // SEGMENT 4 — RISK DASHBOARD  (~1:45-2:05)
    // ─────────────────────────────────────────────────────────────────
    console.log('\n── 4/10  RISK DASHBOARD ──');
    await go(page, '/ui2/risk', 'risk');
    await s('risk-dashboard');

    // ─────────────────────────────────────────────────────────────────
    // SEGMENT 5 — ALERTS  (~2:05-2:20)
    // ─────────────────────────────────────────────────────────────────
    console.log('\n── 5/10  ALERTS ──');
    await go(page, '/ui2/alerts', 'alerts');
    await s('alerts-panel');

    // ─────────────────────────────────────────────────────────────────
    // SEGMENT 6 — BACKTESTING  (~2:20-2:40)
    // ─────────────────────────────────────────────────────────────────
    console.log('\n── 6/10  BACKTESTING ──');
    await go(page, '/ui2/backtest', 'backtest');
    await s('backtest-launcher');
    await sleep(800);
    await s('backtest-results');

    // ─────────────────────────────────────────────────────────────────
    // SEGMENT 7 — AI AUTOPILOT  (~2:40-3:05)
    // ─────────────────────────────────────────────────────────────────
    console.log('\n── 7/10  AI AUTOPILOT ──');
    await go(page, '/ui2/autopilot', 'autopilot');
    await s('autopilot-cockpit');
    await sleep(1000);
    await s('autopilot-positions');

    // ─────────────────────────────────────────────────────────────────
    // SEGMENT 8 — ELASTICSEARCH AGENT  (~3:05-3:30)
    // ─────────────────────────────────────────────────────────────────
    console.log('\n── 8/10  ELASTICSEARCH AGENT ──');
    await go(page, '/ui2/elasticsearch', 'elasticsearch');
    await s('elasticsearch-agent-panel');
    await sleep(1500);
    await s('elasticsearch-search-interface');
    await go(page, '/ui2/nova', 'nova-ai');
    await s('nova-ai-agent');

    // ─────────────────────────────────────────────────────────────────
    // SEGMENT 9 — AGENT BUILDER + QUERY STUDIO  (~3:30-3:55)
    // ─────────────────────────────────────────────────────────────────
    console.log('\n── 9/10  AGENT BUILDER + QUERY STUDIO ──');
    await go(page, '/ui2/agent-builder', 'agent-builder');
    await s('agent-builder');
    await go(page, '/ui2/query-studio', 'query-studio');
    await s('query-studio');

    // ─────────────────────────────────────────────────────────────────
    // SEGMENT 10 — BLOOMBERG HUSK VIEWS  (~3:55-4:30)
    // ─────────────────────────────────────────────────────────────────
    console.log('\n── 10/10  BLOOMBERG TERMINAL HUSK VIEWS ──');
    await go(page, '/ui2/husk/dashboard', 'bloomberg-dashboard');
    await s('bloomberg-husk-dashboard');
    await sleep(1200);
    await s('bloomberg-ticker-full');
    await go(page, '/ui2/husk/trading', 'bloomberg-trading');
    await s('bloomberg-trading-terminal');
    await sleep(1000);
    await s('bloomberg-order-book');
    await go(page, '/ui2/husk/portfolio', 'bloomberg-portfolio');
    await s('bloomberg-portfolio-husk');

    // Final hero shot
    await go(page, '/ui2/dashboard', 'final');
    await sleep(2000);
    await s('FINAL-apex-terminal-hero');

    console.log(`\n✅  Done — ${idx - 1} screenshots captured`);
    console.log(`📁  ${OUTPUT_DIR}`);

  } catch (err) {
    console.error('\n❌  Error:', err.message);
  } finally {
    await sleep(3000); // let video flush
    await context.close();
    await browser.close();

    // Rename the latest .webm
    const webms = fs.readdirSync(__dirname)
      .filter((f) => f.endsWith('.webm') && f !== 'apex_terminal_demo.webm' && f !== 'apex_terminal_demo_v2.webm')
      .map((f) => ({ f, t: fs.statSync(path.join(__dirname, f)).mtimeMs }))
      .sort((a, b) => b.t - a.t);

    if (webms.length > 0) {
      const src = path.join(__dirname, webms[0].f);
      const dst = path.join(__dirname, 'apex_terminal_demo_v2.webm');
      fs.renameSync(src, dst);
      const mb = (fs.statSync(dst).size / 1024 / 1024).toFixed(1);
      console.log(`\n🎬  Video: apex_terminal_demo_v2.webm  (${mb} MB)`);
    }
  }
}

recordDemo().catch(console.error);
