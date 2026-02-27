/**
 * Apex Terminal — Comprehensive Hackathon Demo Recording v3
 * Target: 3+ minutes (180s+), heavy Elasticsearch + all features
 * Run: node record_demo_v3.js
 */
const { chromium } = require('./frontend/node_modules/playwright');
const path = require('path');
const fs = require('fs');

const BASE = 'http://localhost:5100';
const OUT = path.join(__dirname, 'demo_v3_final_screenshots');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function nav(page, route, wait = 4500) {
  await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await sleep(wait);
}

async function shot(page, idx, name) {
  const file = path.join(OUT, `${String(idx).padStart(2, '0')}-${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`  📸 ${path.basename(file)}`);
  return file;
}

async function clickAny(page, ...selectors) {
  for (const sel of selectors) {
    try {
      const el = await page.$(sel);
      if (el) { await el.click(); await sleep(900); return true; }
    } catch { /* skip */ }
  }
  return false;
}

async function clickTab(page, text) {
  const btns = page.getByRole('button', { name: text, exact: false });
  if (await btns.count()) { await btns.first().click(); await sleep(2200); return true; }
  const spans = page.getByText(text, { exact: false });
  if (await spans.count()) { await spans.first().click(); await sleep(2200); return true; }
  return false;
}

async function typeInto(page, selector, text) {
  try {
    await page.fill(selector, text);
    await sleep(400);
  } catch { /* skip */ }
}

async function record() {
  console.log('\n🎬  APEX TERMINAL — Full Hackathon Demo v3  (target: 200s+)\n');

  const browser = await chromium.launch({ headless: false, args: ['--start-maximized'] });
  const ctx = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: { dir: __dirname, size: { width: 1920, height: 1080 } },
  });
  const page = await ctx.newPage();
  let i = 1;
  const s = (name) => shot(page, i++, name);
  const t0 = Date.now();
  const elapsed = () => `${((Date.now() - t0) / 1000).toFixed(0)}s`;

  try {
    // ═══════════════════════════════════════════════════════════════════
    // PART 1 — MARKET COMMAND CENTER  (~0s - 35s)
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n▶ 1/12  MARKET COMMAND CENTER');
    await nav(page, '/ui2/dashboard', 5000);
    await s('dashboard-live-overview');           // live ticker + overview
    await sleep(3000);
    await s('dashboard-sector-overview');
    await sleep(2000);
    await clickTab(page, 'HEATMAP');
    await s('dashboard-sector-heatmap');
    await sleep(2000);
    await clickTab(page, 'MOVERS');
    await s('dashboard-top-movers');
    await sleep(2000);
    await clickTab(page, 'POSITIONS');
    await s('dashboard-positions');
    await sleep(2000);
    await clickTab(page, 'OVERVIEW');
    console.log(`    [${elapsed()}]`);

    // ═══════════════════════════════════════════════════════════════════
    // PART 2 — TRADING TERMINAL  (~25s - 45s)
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n▶ 2/12  TRADING TERMINAL');
    await nav(page, '/ui2/trading', 5000);
    await s('trading-order-entry');
    await sleep(3000);
    await s('trading-watchlist-tiles');
    console.log(`    [${elapsed()}]`);

    // ═══════════════════════════════════════════════════════════════════
    // PART 3 — PORTFOLIO MANAGEMENT  (~45s - 65s)
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n▶ 3/12  PORTFOLIO MANAGEMENT');
    await nav(page, '/ui2/portfolio', 5000);
    await s('portfolio-holdings');
    await sleep(2500);
    await clickTab(page, 'RISK');
    await s('portfolio-risk-matrix');
    await sleep(2000);
    await clickTab(page, 'CORRELATION');
    await s('portfolio-correlation-heatmap');
    console.log(`    [${elapsed()}]`);

    // ═══════════════════════════════════════════════════════════════════
    // PART 4 — RISK ENGINE  (~65s - 80s)
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n▶ 4/12  RISK ENGINE');
    await nav(page, '/ui2/risk', 5000);
    await s('risk-var-greeks');
    await sleep(3000);
    await s('risk-stress-scenarios');
    console.log(`    [${elapsed()}]`);

    // ═══════════════════════════════════════════════════════════════════
    // PART 5 — ALERTS & STRATEGY BACKTEST  (~80s - 100s)
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n▶ 5/12  ALERTS + BACKTEST');
    await nav(page, '/ui2/alerts', 4500);
    await s('alerts-rules-panel');
    await sleep(2000);
    await nav(page, '/ui2/backtest', 5000);
    await s('backtest-launcher-config');
    await sleep(3000);
    await s('backtest-strategy-results');
    console.log(`    [${elapsed()}]`);

    // ═══════════════════════════════════════════════════════════════════
    // PART 6 — AI AUTOPILOT  (~100s - 118s)
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n▶ 6/12  AI AUTOPILOT');
    await nav(page, '/ui2/autopilot', 5000);
    await s('autopilot-cockpit-ai');
    await sleep(3000);
    await s('autopilot-positions-live');
    console.log(`    [${elapsed()}]`);

    // ═══════════════════════════════════════════════════════════════════
    // PART 7 — ELASTICSEARCH GATEWAY  (~118s - 140s)
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n▶ 7/12  ELASTICSEARCH GATEWAY');
    await nav(page, '/ui2/elasticsearch', 5000);
    await s('es-gateway-search-interface');
    await sleep(2000);
    // Type a search query to show the UI in action
    await typeInto(page, '[data-testid="es-search-input"], input[placeholder*="Search"]', 'AAPL earnings momentum');
    await sleep(1500);
    await s('es-gateway-query-entered');
    await clickAny(page, '[data-testid="es-search-btn"]', 'button:has-text("Search")');
    await sleep(2500);
    await s('es-gateway-search-results');
    console.log(`    [${elapsed()}]`);

    // ═══════════════════════════════════════════════════════════════════
    // PART 8 — ELASTIHACK COMMAND CENTER  (~140s - 175s)  ← MAIN HACKATHON
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n▶ 8/12  ELASTIHACK COMMAND CENTER  ← PRIMARY HACKATHON FEATURE');
    await nav(page, '/ui2/elastihack', 5000);
    await s('elastihack-overview-dashboard');
    await sleep(2500);
    // Navigate each tab — dwell 2.5s to show the content
    await clickTab(page, 'Templates');
    await sleep(1500);
    await s('elastihack-index-templates');
    await clickTab(page, 'Ops');
    await sleep(1500);
    await s('elastihack-ops-aliases-ilm');
    await clickTab(page, 'Canary');
    await sleep(1500);
    await s('elastihack-canary-doc-verification');
    await clickTab(page, 'Health');
    await sleep(1500);
    await s('elastihack-cluster-health');
    await clickTab(page, 'Vector');
    await sleep(1500);
    await s('elastihack-vector-field-specs');
    await clickTab(page, 'kNN');
    await sleep(1500);
    await s('elastihack-knn-search-config');
    await sleep(2000);
    // Back to overview
    await clickTab(page, 'Overview');
    await sleep(2000);
    await s('elastihack-overview-final');
    console.log(`    [${elapsed()}]`);

    // ═══════════════════════════════════════════════════════════════════
    // PART 9 — QUERY STUDIO  (~175s - 195s)
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n▶ 9/12  QUERY STUDIO (ES|QL)');
    await nav(page, '/ui2/query-studio', 5000);
    await s('query-studio-home');
    await sleep(2000);
    await typeInto(page, 'input[placeholder*="Search"], input[placeholder*="query"], input[placeholder*="Query"]', 'momentum strategy backtest');
    await sleep(1500);
    await s('query-studio-esql-entered');
    await clickAny(page, 'button:has-text("Search")', 'button:has-text("Run")', 'button:has-text("Execute")');
    await sleep(3000);
    await s('query-studio-results-facets');
    console.log(`    [${elapsed()}]`);

    // ═══════════════════════════════════════════════════════════════════
    // PART 10 — AGENT BUILDER  (~195s - 215s)
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n▶ 10/12  ELASTIC AGENT BUILDER');
    await nav(page, '/ui2/agent-builder', 5000);
    await s('agent-builder-dashboard');
    await sleep(3000);
    await s('agent-builder-tools-citations');
    console.log(`    [${elapsed()}]`);

    // ═══════════════════════════════════════════════════════════════════
    // PART 11 — NOVA AI AGENT  (~215s - 230s)
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n▶ 11/12  NOVA AI AGENT');
    await nav(page, '/ui2/nova', 5000);
    await s('nova-ai-agent-panel');
    await sleep(3000);
    await s('nova-ai-reasoning-view');
    console.log(`    [${elapsed()}]`);

    // ═══════════════════════════════════════════════════════════════════
    // PART 12 — BLOOMBERG TERMINAL HUSK VIEWS  (~230s - 265s)
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n▶ 12/12  BLOOMBERG TERMINAL HUSK VIEWS');
    await nav(page, '/ui2/husk/dashboard', 5000);
    await s('bloomberg-husk-full-dashboard');
    await sleep(3000);
    await s('bloomberg-ticker-strip-detail');
    await nav(page, '/ui2/husk/trading', 5000);
    await s('bloomberg-trading-terminal');
    await sleep(3000);
    await s('bloomberg-order-book-depth');
    await nav(page, '/ui2/husk/portfolio', 5000);
    await s('bloomberg-portfolio-analytics');
    await sleep(3000);

    // Final hero shot back on dashboard
    await nav(page, '/ui2/dashboard', 5000);
    await sleep(4000);
    await s('FINAL-apex-terminal-complete');

    const totalSec = ((Date.now() - t0) / 1000).toFixed(0);
    console.log(`\n✅  Recording complete — ${i - 1} screenshots — ${totalSec}s elapsed`);

  } catch (err) {
    console.error('\n❌  Error:', err.message);
  } finally {
    await sleep(6000); // let video flush to disk
    await ctx.close();
    await browser.close();

    // Rename newest webm (skip old ones we already renamed)
    const skip = new Set(['apex_terminal_demo.webm', 'apex_terminal_demo_v2.webm']);
    const webms = fs.readdirSync(__dirname)
      .filter((f) => f.endsWith('.webm') && !skip.has(f))
      .map((f) => ({ f, t: fs.statSync(path.join(__dirname, f)).mtimeMs }))
      .sort((a, b) => b.t - a.t);

    if (webms.length > 0) {
      const src = path.join(__dirname, webms[0].f);
      const dst = path.join(__dirname, 'apex_terminal_demo_v3.webm');
      fs.renameSync(src, dst);
      const mb = (fs.statSync(dst).size / 1024 / 1024).toFixed(1);
      console.log(`\n🎬  apex_terminal_demo_v3.webm  (${mb} MB)`);
    } else {
      console.log('\n⚠️  No new .webm found — recording may have already been named.');
    }
  }
}

record().catch(console.error);
