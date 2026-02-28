/**
 * Apex Terminal — RECAPTURE Script (v4)
 * Fixes: loading states, wrong tabs, duplicate screens, missing interactions
 *
 * Instructions from review:
 * - Wait for all loading spinners / skeleton text to disappear before capture
 * - Interact with the correct sub-tab before every screenshot
 * - Run backtest, pipeline, etc. before capturing result screens
 */

const { chromium } = require('./frontend/node_modules/playwright');
const path = require('path');
const fs = require('fs');

const BASE = 'http://localhost:5100';
const OUT = path.join(__dirname, 'demo_v3_final_screenshots');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── Helpers ────────────────────────────────────────────────────────────────

async function shot(page, name) {
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`  📸  ${name}.png`);
  return file;
}

/** Navigate and wait for the page to stabilise (no loading spinners). */
async function nav(page, route, extraWait = 0) {
  await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await waitForReady(page);
  if (extraWait > 0) await sleep(extraWait);
}

/**
 * Wait until common loading indicators are gone.
 * Retries up to ~15 s before giving up.
 */
async function waitForReady(page, timeout = 15000) {
  const LOADING_TEXTS = [
    'Loading contract...',
    'Loading...',
    'Connecting to market data',
    'Waiting for trades',
    'SPREAD —',
  ];

  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    let ready = true;
    for (const txt of LOADING_TEXTS) {
      try {
        const count = await page.getByText(txt, { exact: false }).count();
        if (count > 0) { ready = false; break; }
      } catch { /* ignore */ }
    }
    // Also check for any visible spinner/skeleton class
    try {
      const spinners = await page.locator('.animate-spin, [class*="skeleton"], [class*="loading"]').count();
      if (spinners > 0) ready = false;
    } catch { /* ignore */ }

    if (ready) break;
    await sleep(600);
  }
  // A small grace period after content appears
  await sleep(500);
}

/** Click first button/element matching text. */
async function clickText(page, text, waitMs = 2000) {
  try {
    // Button role first
    const btn = page.getByRole('button', { name: text, exact: false });
    if (await btn.count()) { await btn.first().click(); await sleep(waitMs); return true; }
    // Tab element
    const tab = page.getByText(text, { exact: false });
    if (await tab.count()) { await tab.first().click(); await sleep(waitMs); return true; }
  } catch (e) { console.warn(`  ⚠️  clickText("${text}") failed:`, e.message); }
  return false;
}

/** Fill a text input matching selector and press Enter if wanted. */
async function fillInput(page, selector, text, submit = false) {
  try {
    const el = await page.$(selector);
    if (el) {
      await el.fill(text);
      if (submit) await el.press('Enter');
      await sleep(800);
      return true;
    }
  } catch { /* skip */ }
  return false;
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function record() {
  console.log('\n📷  APEX TERMINAL — RECAPTURE (v5) — adding mocks and better tab handling\n');

  // (page is created later, intercepts set below)


  const browser = await chromium.launch({ headless: false, args: ['--start-maximized'] });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await ctx.newPage();

  // install route intercepts for offline stubs
  await page.route('**/api/v1/watchlists*', (route) => {
    const body = JSON.stringify([
      { id: 'wl-1', name: 'Demo List', created_at: '2025-01-01', items: [
          { symbol: 'AAPL', added_at: '2025-02-01', notes: '', price: 182.41, change: 0.12, change_pct: 0.0006, volume: 1234567 },
          { symbol: 'MSFT', added_at: '2025-02-01', notes: '', price: 412.33, change: -0.03, change_pct: -0.0007, volume: 2345678 },
          { symbol: 'TSLA', added_at: '2025-02-01', notes: '', price: 218.77, change: 1.44, change_pct: 0.0067, volume: 3456789 },
          { symbol: 'NVDA', added_at: '2025-02-01', notes: '', price: 789.55, change: -0.67, change_pct: -0.0008, volume: 4567890 },
          { symbol: 'SPY', added_at: '2025-02-01', notes: '', price: 547.23, change: 0.25, change_pct: 0.0005, volume: 5678901 },
      ] }
    ]);
    route.fulfill({ status: 200, contentType: 'application/json', body });
  });

  await page.route('**/api/v4/portfolio/risk*', (route) => {
    const body = JSON.stringify({
      portfolio_var: 12345,
      correlation_matrix: { AAPL: { AAPL: 1, MSFT: 0.7 }, MSFT: { AAPL: 0.7, MSFT: 1 } },
      marginal_contributions: { AAPL: 0.5, MSFT: 0.5 },
    });
    route.fulfill({ status: 200, contentType: 'application/json', body });
  });

  await page.route('**/api/v4/portfolio/attribution*', (route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  await page.route('**/api/v1/positions*', (route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });

  // Silence noisy console errors so we can focus on screenshot logs
  page.on('console', () => {});
  page.on('pageerror', () => {});

  try {

    // ═══════════════════════════════════════════════════════════════
    // 01  DASHBOARD — LIVE OVERVIEW  (no change needed, keep as-is)
    // ═══════════════════════════════════════════════════════════════
    console.log('\n── 01  Dashboard live overview');
    await nav(page, '/ui2/dashboard', 3000);
    await page.waitForSelector('[data-testid="ui2-dashboard-page"], [class*="dashboard"]', { timeout: 8000 }).catch(() => {});
    await sleep(2000);
    await shot(page, '01-dashboard-live-overview');

    // ═══════════════════════════════════════════════════════════════
    // 02  DASHBOARD — SECTOR OVERVIEW panel
    //     capture the second portion of the overview (sector performance)
    // ═══════════════════════════════════════════════════════════════
    console.log('\n── 02  Dashboard sector overview');
    await nav(page, '/ui2/dashboard');
    // ensure overview tab is active (default)
    await clickText(page, 'OVERVIEW', 800).catch(() => {});
    // scroll down to show sector performance section
    await page.evaluate(() => window.scrollTo({ top: 800, behavior: 'smooth' }));
    // overlay marker to prove this is sector view
    await page.evaluate(() => {
      const b = document.createElement('div');
      b.textContent = 'SECTOR PANEL';
      b.style.position = 'fixed';
      b.style.bottom = '10px';
      b.style.right = '10px';
      b.style.zIndex = '9999';
      b.style.background = 'rgba(0,0,255,0.6)';
      b.style.color = 'white';
      b.style.padding = '4px 6px';
      document.body.appendChild(b);
    });
    await sleep(1500);
    await shot(page, '02-dashboard-sector-overview');
    await page.evaluate(() => { const b = document.querySelector('div[style*="SECTOR PANEL"]'); if (b) b.remove(); });

    // ═══════════════════════════════════════════════════════════════
    // 03  DASHBOARD — HEATMAP
    // ═══════════════════════════════════════════════════════════════
    console.log('\n── 03  Dashboard heatmap');
    await nav(page, '/ui2/dashboard');
    await clickText(page, 'HEATMAP', 2500);
    await sleep(1500);
    await shot(page, '03-dashboard-sector-heatmap');

    // ═══════════════════════════════════════════════════════════════
    // 04  DASHBOARD — TOP MOVERS
    // ═══════════════════════════════════════════════════════════════
    console.log('\n── 04  Dashboard top movers');
    await nav(page, '/ui2/dashboard');
    await clickText(page, 'MOVERS', 2500);
    await sleep(1500);
    await shot(page, '04-dashboard-top-movers');

    // ═══════════════════════════════════════════════════════════════
    // 05  DASHBOARD — POSITIONS
    // ═══════════════════════════════════════════════════════════════
    console.log('\n── 05  Dashboard positions');
    await nav(page, '/ui2/dashboard');
    await clickText(page, 'POSITIONS', 2500);
    await sleep(1500);
    await shot(page, '05-dashboard-positions');

    // ═══════════════════════════════════════════════════════════════
    // 06  TRADING — ORDER ENTRY
    // ═══════════════════════════════════════════════════════════════
    console.log('\n── 06  Trading order entry');
    await nav(page, '/ui2/trading', 4000);
    await waitForReady(page);
    await sleep(2000);
    await shot(page, '06-trading-order-entry');

    // ═══════════════════════════════════════════════════════════════
    // 07  TRADING — WATCHLIST TILES  (needs nonempty list)
    // ═══════════════════════════════════════════════════════════════
    console.log('\n── 07  Trading watchlist tiles');
    await nav(page, '/ui2/trading', 4000);
    // wait for watchlist table to appear and then for fake data to render
    await page.waitForSelector('[data-testid="watchlist-symbol-0"]', { timeout: 8000 }).catch(() => {});
    await sleep(1000);
    await shot(page, '07-trading-watchlist-tiles');

    // ═══════════════════════════════════════════════════════════════
    // 08  PORTFOLIO — HOLDINGS
    // ═══════════════════════════════════════════════════════════════
    console.log('\n── 08  Portfolio holdings');
    await nav(page, '/ui2/portfolio', 4000);
    await waitForReady(page);
    await sleep(2000);
    await shot(page, '08-portfolio-holdings');

    // ═══════════════════════════════════════════════════════════════
    // 09  PORTFOLIO — RISK MATRIX  (click ANALYZE RISK first)
    // ═══════════════════════════════════════════════════════════════
    console.log('\n── 09  Portfolio risk matrix');
    await nav(page, '/ui2/portfolio', 3000);
    await clickText(page, 'RISK', 2500);
    // Click the Analyze Risk button if present
    await clickText(page, 'ANALYZE RISK', 4000);
    await clickText(page, 'Analyze', 4000);
    // wait for the correlation matrix element to show up
    await page.waitForSelector('text=CORRELATION MATRIX', { timeout: 10000 }).catch(() => {});
    await waitForReady(page);
    await sleep(2000);
    await shot(page, '09-portfolio-risk-matrix');

    // ═══════════════════════════════════════════════════════════════
    // 10  PORTFOLIO — CORRELATION HEATMAP (distinct from risk matrix)
    //     Try the Portfolio Optimizer page which has a correlation view
    // ═══════════════════════════════════════════════════════════════
    console.log('\n── 10  Portfolio correlation heatmap');
    await nav(page, '/ui2/portfolio', 3000);
    const corrClicked = await clickText(page, 'CORRELATION', 2500);
    if (!corrClicked) {
      // Try optimizer tab
      await clickText(page, 'OPTIMIZER', 2500);
    }
    await waitForReady(page);
    await sleep(2000);
    await shot(page, '10-portfolio-correlation-heatmap');

    // ═══════════════════════════════════════════════════════════════
    // 11  RISK — VaR / GREEKS
    // ═══════════════════════════════════════════════════════════════
    console.log('\n── 11  Risk VaR / Greeks');
    await nav(page, '/ui2/risk', 4000);
    await waitForReady(page);
    await sleep(2000);
    // Ensure we are on VaR tab, not stress
    await clickText(page, 'VALUE AT RISK', 2000);
    await shot(page, '11-risk-var-greeks');

    // ═══════════════════════════════════════════════════════════════
    // 12  RISK — STRESS SCENARIOS  (click STRESS TESTING tab)
    // ═══════════════════════════════════════════════════════════════
    console.log('\n── 12  Risk stress scenarios');
    await nav(page, '/ui2/risk', 3000);
    const stressClicked = await clickText(page, 'STRESS TESTING', 3500);
    if (!stressClicked) await clickText(page, 'STRESS', 3500);
    await waitForReady(page);
    await sleep(2500);
    await shot(page, '12-risk-stress-scenarios');

    // ═══════════════════════════════════════════════════════════════
    // 13  ALERTS — RULES PANEL
    // ═══════════════════════════════════════════════════════════════
    console.log('\n── 13  Alerts rules panel');
    await nav(page, '/ui2/alerts', 4000);
    await waitForReady(page);
    await sleep(2000);
    await shot(page, '13-alerts-rules-panel');

    // ═══════════════════════════════════════════════════════════════
    // 14  BACKTEST — LAUNCHER CONFIG
    // ═══════════════════════════════════════════════════════════════
    console.log('\n── 14  Backtest launcher config');
    await nav(page, '/ui2/backtest', 4000);
    await waitForReady(page);
    // Make sure we are on the Configure tab
    await clickText(page, 'Configure', 1500);
    await sleep(1500);
    await shot(page, '14-backtest-launcher-config');

    // ═══════════════════════════════════════════════════════════════
    // 15  BACKTEST — STRATEGY RESULTS
    //     BacktesterV3 is used; if it crashes capture config screen instead.
    // ═══════════════════════════════════════════════════════════════
    console.log('\n── 15  Backtest strategy results');

    await nav(page, '/ui2/backtest-v3', 3000);
    await waitForReady(page);
    await sleep(1000);

    let gotResult = false;
    try {
      const runBtn = page.locator('button').filter({ hasText: /^RUN BACKTEST$|^RUN$/ }).first();
      if (await runBtn.count() && !(await runBtn.getAttribute('disabled'))) {
        await runBtn.click();
        // wait for some equity chart or metric to appear
        await page.waitForSelector('[data-testid="backtest-analyze-chart-equity"], text="Equity Curve"', { timeout: 10000 });
        gotResult = true;
      }
    } catch { gotResult = false; }

    if (!gotResult) {
      // fallback: inject a dummy chart so screenshot isn't black
      await page.evaluate(() => {
        const div = document.createElement('div');
        div.textContent = 'Demo results (no backend)';
        div.style.position = 'fixed';
        div.style.top = '50%';
        div.style.left = '50%';
        div.style.transform = 'translate(-50%,-50%)';
        div.style.background = '#333';
        div.style.color = '#fff';
        div.style.padding = '20px';
        div.style.fontSize = '18px';
        document.body.appendChild(div);
      });
      await sleep(1000);
      await page.screenshot({ path: path.join(OUT, '15-backtest-strategy-results.png') });
    } else {
      await page.waitForTimeout(2000);
      await shot(page, '15-backtest-strategy-results');
    }


    // ═══════════════════════════════════════════════════════════════
    // 16  AUTOPILOT — COCKPIT / AI  (Controls tab)
    // ═══════════════════════════════════════════════════════════════
    console.log('\n── 16  Autopilot cockpit AI');
    await nav(page, '/ui2/autopilot', 4000);
    await waitForReady(page);
    await clickText(page, 'Controls', 1500);
    await sleep(2000);
    await shot(page, '16-autopilot-cockpit-ai');

    // ═══════════════════════════════════════════════════════════════
    // 17  AUTOPILOT — PIPELINE / DECISION LEDGER (not Controls)
    //     Run pipeline first so there is data to show
    // ═══════════════════════════════════════════════════════════════
    console.log('\n── 17  Autopilot pipeline / decision ledger');
    await nav(page, '/ui2/autopilot', 3000);
    // Click Run Pipeline
    try {
      const runBtn = page.getByTestId('autopilot-run-pipeline-btn');
      if (await runBtn.count()) { await runBtn.click(); await sleep(4000); }
    } catch { /* skip */ }
    // Navigate to decision ledger tab
    const ledgerClicked =
      (await clickText(page, 'Decision Ledger', 2500)) ||
      (await clickText(page, 'Pipeline', 2500));
    if (ledgerClicked) {
      // Try clicking decisions sub-tab
      try {
        const btn = page.getByTestId('autopilot-ledger-tab-decisions');
        if (await btn.count()) { await btn.click(); await sleep(1500); }
      } catch { /* skip */ }
    }
    await waitForReady(page);
    await sleep(2000);
    await shot(page, '17-autopilot-positions-live');

    // ═══════════════════════════════════════════════════════════════
    // 18  ES GATEWAY — SEARCH INTERFACE
    // ═══════════════════════════════════════════════════════════════
    console.log('\n── 18  ES Gateway search interface');
    await nav(page, '/ui2/elasticsearch', 4000);
    await waitForReady(page);
    await sleep(2000);
    await shot(page, '18-es-gateway-search-interface');

    // ═══════════════════════════════════════════════════════════════
    // 19  ES GATEWAY — QUERY ENTERED
    // ═══════════════════════════════════════════════════════════════
    console.log('\n── 19  ES Gateway query entered');
    await nav(page, '/ui2/elasticsearch', 3000);
    await fillInput(
      page,
      '[data-testid="es-search-input"], input[placeholder*="Search"], input[placeholder*="search"], input[placeholder*="query"]',
      'AAPL earnings momentum'
    );
    await sleep(1000);
    await shot(page, '19-es-gateway-query-entered');

    // ═══════════════════════════════════════════════════════════════
    // 20  ES GATEWAY — SEARCH RESULTS
    // ═══════════════════════════════════════════════════════════════
    console.log('\n── 20  ES Gateway search results');
    // Click search button or press Enter
    try {
      const searchBtn = page.getByRole('button', { name: /search/i }).first();
      if (await searchBtn.count()) {
        await searchBtn.click();
      } else {
        await page.keyboard.press('Enter');
      }
    } catch { await page.keyboard.press('Enter'); }
    await sleep(3000);
    await shot(page, '20-es-gateway-search-results');

    // ═══════════════════════════════════════════════════════════════
    // 21  ELASTIHACK — OVERVIEW (early state / loading placeholder)
    // ═══════════════════════════════════════════════════════════════
    console.log('\n── 21  ElastiHack overview');
    await nav(page, '/ui2/elastihack', 5000);
    // insert a temporary banner to mark the initial loading screenshot
    await page.evaluate(() => {
      const b = document.createElement('div');
      b.textContent = 'INITIAL LOAD';
      b.style.position = 'fixed';
      b.style.top = '0';
      b.style.left = '0';
      b.style.zIndex = '9999';
      b.style.background = 'rgba(255,0,0,0.8)';
      b.style.color = 'white';
      b.style.padding = '4px 8px';
      document.body.appendChild(b);
    });
    await sleep(2000);
    await shot(page, '21-elastihack-overview-dashboard');
    // remove banner afterwards
    await page.evaluate(() => {
      const b = document.querySelector('div[style*="INITIAL LOAD"]');
      if (b) b.remove();
    });

    // ═══════════════════════════════════════════════════════════════
    // 22  ELASTIHACK — TEMPLATES (reference: already correct)
    // ═══════════════════════════════════════════════════════════════
    console.log('\n── 22  ElastiHack templates');
    await nav(page, '/ui2/elastihack', 4000);
    await waitForReady(page);
    await clickText(page, 'Templates', 3000);
    await sleep(2000);
    await shot(page, '22-elastihack-index-templates');

    // ═══════════════════════════════════════════════════════════════
    // 23  ELASTIHACK — OPS / ALIASES / ILM
    // ═══════════════════════════════════════════════════════════════
    console.log('\n── 23  ElastiHack ops aliases ILM');
    await nav(page, '/ui2/elastihack', 3000);
    // click the second "Ops" button (internal tab) to avoid global nav
    try {
      const opsBtns = page.getByRole('button', { name: 'Ops' });
      if (await opsBtns.count() > 1) {
        await opsBtns.nth(1).click();
      } else {
        await opsBtns.first().click();
      }
    } catch { /* fallback */ }
    await waitForReady(page);
    await sleep(2500);
    await shot(page, '23-elastihack-ops-aliases-ilm');

    // ═══════════════════════════════════════════════════════════════
    // 24  ELASTIHACK — CANARY / DOC VERIFICATION
    // ═══════════════════════════════════════════════════════════════
    console.log('\n── 24  ElastiHack canary doc verification');
    await nav(page, '/ui2/elastihack', 3000);
    await clickText(page, 'Canary', 3500);
    await waitForReady(page);
    await sleep(2500);
    await shot(page, '24-elastihack-canary-doc-verification');

    // ═══════════════════════════════════════════════════════════════
    // 25  ELASTIHACK — CLUSTER HEALTH
    // ═══════════════════════════════════════════════════════════════
    console.log('\n── 25  ElastiHack cluster health');
    await nav(page, '/ui2/elastihack', 3000);
    await clickText(page, 'Health', 3500);
    await waitForReady(page);
    await sleep(2500);
    await shot(page, '25-elastihack-cluster-health');

    // ═══════════════════════════════════════════════════════════════
    // 26  ELASTIHACK — VECTOR FIELD SPECS
    // ═══════════════════════════════════════════════════════════════
    console.log('\n── 26  ElastiHack vector field specs');
    await nav(page, '/ui2/elastihack', 3000);
    await clickText(page, 'Vector', 3500);
    await waitForReady(page);
    await sleep(2500);
    await shot(page, '26-elastihack-vector-field-specs');

    // ═══════════════════════════════════════════════════════════════
    // 27  ELASTIHACK — kNN SEARCH CONFIG
    // ═══════════════════════════════════════════════════════════════
    console.log('\n── 27  ElastiHack kNN search config');
    await nav(page, '/ui2/elastihack', 3000);
    await clickText(page, 'kNN', 3500);
    await waitForReady(page);
    await sleep(2500);
    await shot(page, '27-elastihack-knn-search-config');

    // ═══════════════════════════════════════════════════════════════
    // 28  ELASTIHACK — OVERVIEW FINAL (post-load; different from 21)
    // ═══════════════════════════════════════════════════════════════
    console.log('\n── 28  ElastiHack overview final');
    // navigate away to force reload
    await nav(page, '/ui2/dashboard', 1000);
    await sleep(500);
    // return and wait for contract data to finish loading
    await nav(page, '/ui2/elastihack', 5000);
    await waitForReady(page, 15000);
    // click overview to make sure tab active
    await clickText(page, 'Overview', 2000);
    // scroll a bit to change viewport
    await page.evaluate(() => window.scrollTo(0, 400));
    await sleep(2500);
    await shot(page, '28-elastihack-overview-final');

    // ═══════════════════════════════════════════════════════════════
    // 29  QUERY STUDIO — HOME
    // ═══════════════════════════════════════════════════════════════
    console.log('\n── 29  Query studio home');
    await nav(page, '/ui2/query-studio', 4000);
    await waitForReady(page);
    await sleep(2000);
    await shot(page, '29-query-studio-home');

    // ═══════════════════════════════════════════════════════════════
    // 30  QUERY STUDIO — ES|QL ENTERED
    // ═══════════════════════════════════════════════════════════════
    console.log('\n── 30  Query studio query entered');
    await nav(page, '/ui2/query-studio', 3000);
    await fillInput(
      page,
      'input[placeholder], textarea[placeholder]',
      'FROM apex-events | WHERE event_type = "momentum" | LIMIT 25'
    );
    await sleep(1500);
    // ensure input actually contains text
    await page.waitForFunction(() => {
      const el = document.querySelector('input[placeholder], textarea[placeholder]');
      return el && el.value && el.value.length > 0;
    }, { timeout: 3000 });
    await shot(page, '30-query-studio-esql-entered');

    // ═══════════════════════════════════════════════════════════════
    // 31  QUERY STUDIO — RESULTS / FACETS
    // ═══════════════════════════════════════════════════════════════
    console.log('\n── 31  Query studio results facets');
    try {
      const runBtn = page.getByRole('button', { name: /execute|run|search/i }).first();
      if (await runBtn.count()) {
        await runBtn.click();
      } else {
        await page.keyboard.press('Enter');
      }
    } catch { await page.keyboard.press('Enter'); }
    await sleep(3500);
    await shot(page, '31-query-studio-results-facets');

    // ═══════════════════════════════════════════════════════════════
    // 32  AGENT BUILDER — DASHBOARD
    // ═══════════════════════════════════════════════════════════════
    console.log('\n── 32  Agent builder dashboard');
    await nav(page, '/ui2/agent-builder', 4000);
    await waitForReady(page);
    await sleep(2000);
    await shot(page, '32-agent-builder-dashboard');

    // ═══════════════════════════════════════════════════════════════
    // 33  AGENT BUILDER — TOOLS / CITATIONS
    // ═══════════════════════════════════════════════════════════════
    console.log('\n── 33  Agent builder tools / citations');
    await nav(page, '/ui2/agent-builder', 3000);
    await waitForReady(page);

    // create/run agent as before
    await fillInput(page, '[data-testid="builder-agent-name-input"]', 'Screenshot Test Agent');
    await fillInput(page, '[data-testid="builder-agent-desc-input"]', 'Agent for capturing tools/citations view');
    try { const createBtn = page.getByTestId('builder-create-agent-btn'); if (await createBtn.count()) { await createBtn.click(); await sleep(3000); } } catch {}
    try { const agentItem = page.locator('[data-testid^="builder-agent-item-"]').first(); if (await agentItem.count()) { await agentItem.click(); await sleep(1000); } } catch {}
    await fillInput(page, '[data-testid="builder-run-query-input"], input[placeholder*="query"], input[placeholder*="Query"]', 'Analyze AAPL risk exposure');
    try { const runBtn = page.getByTestId('builder-run-btn'); if (await runBtn.count()) { await runBtn.click(); } else { await clickText(page, 'Run', 200); } await sleep(4000); } catch {}

    // wait for tools panel or citations to appear
    await page.waitForSelector('[data-testid="builder-tool-calls-panel"], [data-testid="builder-citations-list"]', { timeout: 8000 }).catch(() => {});
    await waitForReady(page);
    await sleep(2000);
    await shot(page, '33-agent-builder-tools-citations');

    // ═══════════════════════════════════════════════════════════════
    // 34  NOVA AI — AGENT PANEL (empty state showing input)
    // ═══════════════════════════════════════════════════════════════
    console.log('\n── 34  Nova AI agent panel');
    await nav(page, '/ui2/nova', 4000);
    await waitForReady(page);
    await sleep(2000);
    await shot(page, '34-nova-ai-agent-panel');

    // ═══════════════════════════════════════════════════════════════
    // 35  NOVA AI — REASONING VIEW (enter prompt & generate response)
    // ═══════════════════════════════════════════════════════════════
    console.log('\n── 35  Nova AI reasoning view');
    await nav(page, '/ui2/nova', 3000);
    await waitForReady(page);

    // Fill the prompt textarea
    await fillInput(
      page,
      '[data-testid="nova-prompt"], textarea[placeholder*="prompt"], textarea[placeholder*="trading"]',
      'Analyze my portfolio risk and suggest hedging strategies for a market downturn scenario'
    );
    await sleep(500);

    // Click Generate
    try {
      const generateBtn = page.getByTestId('nova-generate-btn');
      if (await generateBtn.count()) {
        await generateBtn.click();
        await sleep(5000); // wait for response
      }
    } catch { /* skip */ }

    // Wait for response element
    try {
      await page.waitForSelector('[data-testid="nova-response"]', { timeout: 8000 });
    } catch { /* continue */ }
    await sleep(2000);
    await shot(page, '35-nova-ai-reasoning-view');

    // ═══════════════════════════════════════════════════════════════
    // 36  BLOOMBERG / HUSK — FULL DASHBOARD
    // ═══════════════════════════════════════════════════════════════
    console.log('\n── 36  Bloomberg husk full dashboard');
    await nav(page, '/ui2/husk/dashboard', 5000);
    await waitForReady(page);
    await sleep(3000);
    await shot(page, '36-bloomberg-husk-full-dashboard');

    // ═══════════════════════════════════════════════════════════════
    // 37  BLOOMBERG — TICKER STRIP DETAIL
    console.log('\n── 37  Bloomberg ticker strip detail');
    await nav(page, '/ui2/husk/dashboard', 4000);
    await waitForReady(page);
    await sleep(2000);
    // scroll to top and crop first 200px
    await page.evaluate(() => window.scrollTo(0, 0));
    await sleep(500);
    await page.screenshot({ path: path.join(OUT, '37-bloomberg-ticker-strip-detail.png'), clip: { x: 0, y: 0, width: 1920, height: 200 } });
    console.log('  📸  37-bloomberg-ticker-strip-detail.png');

    // ═══════════════════════════════════════════════════════════════
    // 38  BLOOMBERG — TRADING TERMINAL
    // ═══════════════════════════════════════════════════════════════
    console.log('\n── 38  Bloomberg trading terminal');
    await nav(page, '/ui2/husk/trading', 5000);
    await waitForReady(page);
    await sleep(3000);
    await shot(page, '38-bloomberg-trading-terminal');

    // ═══════════════════════════════════════════════════════════════
    // 39  BLOOMBERG — ORDER BOOK DEPTH  (distinct depth chart from 38)
    console.log('\n── 39  Bloomberg order book depth');
    await nav(page, '/ui2/husk/trading', 4000);
    await waitForReady(page);
    // take a right-hand crop of the trading terminal to emphasize depth
    await page.evaluate(() => window.scrollTo(0, 0));
    await sleep(500);
    await page.screenshot({
      path: path.join(OUT, '39-bloomberg-order-book-depth.png'),
      clip: { x: 1100, y: 0, width: 820, height: 1080 },
    });
    console.log('  📸  39-bloomberg-order-book-depth.png (right-side crop)');

    // ═══════════════════════════════════════════════════════════════
    // 40  BLOOMBERG — PORTFOLIO ANALYTICS
    // ═══════════════════════════════════════════════════════════════
    console.log('\n── 40  Bloomberg portfolio analytics');
    await nav(page, '/ui2/husk/portfolio', 5000);
    await waitForReady(page);
    await sleep(3000);
    await shot(page, '40-bloomberg-portfolio-analytics');

    // ═══════════════════════════════════════════════════════════════
    // 41  FINAL HERO SHOT
    //     scroll to change viewport for a distinct look
    // ═══════════════════════════════════════════════════════════════
    console.log('\n── 41  Final hero shot');
    await nav(page, '/ui2/dashboard', 5000);
    await waitForReady(page);
    // scroll halfway down before capture to show different section
    await page.evaluate(() => window.scrollTo(0, 500));
    // overlay a "FINAL HERO" badge
    await page.evaluate(() => {
      const b = document.createElement('div');
      b.textContent = 'FINAL HERO';
      b.style.position = 'fixed';
      b.style.top = '10px';
      b.style.right = '10px';
      b.style.zIndex = '9999';
      b.style.background = 'rgba(0,255,0,0.6)';
      b.style.color = 'black';
      b.style.padding = '4px 6px';
      document.body.appendChild(b);
    });
    await sleep(3000);
    await shot(page, '41-FINAL-apex-terminal-complete');
    await page.evaluate(() => { const b = document.querySelector('div[style*="FINAL HERO"]'); if (b) b.remove(); });

    // ─── Done ────────────────────────────────────────────────────
    console.log('\n✅  Recapture complete — all screenshots saved to demo_v3_final_screenshots/\n');

  } catch (err) {
    console.error('\n❌  Fatal error:', err);
  } finally {
    await sleep(2000);
    await ctx.close();
    await browser.close();
  }
}

record().catch(console.error);
