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
  console.log('\n📷  APEX TERMINAL — RECAPTURE (v4) — fixing loading-state issues\n');

  const browser = await chromium.launch({ headless: false, args: ['--start-maximized'] });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await ctx.newPage();

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
    // 02  DASHBOARD — SECTOR OVERVIEW subtab
    //     Must click a dedicated "SECTOR OVERVIEW" or similar tab
    //     If the dashboard only has OVERVIEW/POSITIONS/HEATMAP/MOVERS,
    //     capture OVERVIEW then navigate to the separate sector visual.
    // ═══════════════════════════════════════════════════════════════
    console.log('\n── 02  Dashboard sector overview');
    await nav(page, '/ui2/dashboard');
    // Try dedicated SECTOR tab first
    const sectorClicked = await clickText(page, 'SECTOR', 2500);
    if (!sectorClicked) {
      // Fallback: click HEATMAP which is a sector heatmap
      await clickText(page, 'HEATMAP', 2500);
    }
    await sleep(1500);
    await shot(page, '02-dashboard-sector-overview');

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
    // 07  TRADING — WATCHLIST TILES  (needs tiles with prices loaded)
    // ═══════════════════════════════════════════════════════════════
    console.log('\n── 07  Trading watchlist tiles');
    await nav(page, '/ui2/trading', 4000);
    // Try switching to the husk trading view which has watchlist tiles
    // Or look for  a watchlist tab in the trading page
    await clickText(page, 'WATCHLIST', 2500);
    // Wait for price data in tiles
    await sleep(3000);
    // If still no tiles, try husk dashboard which has watchlist
    const hasTiles = await page.locator('[class*="tile"], [class*="watchlist-row"], [data-testid*="watchlist"]').count();
    if (hasTiles === 0) {
      // Fallback: navigate to husk dashboard which prominently shows watchlist tiles
      await nav(page, '/ui2/husk/dashboard', 3000);
      await sleep(2000);
    }
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
    //     BacktestUI2 requires live backend for strategies.
    //     Use BacktesterV3UI2 which has self-contained mock data.
    //     Navigate, select strategy, run, wait for chart results.
    // ═══════════════════════════════════════════════════════════════
    console.log('\n── 15  Backtest strategy results');

    // Try BacktesterV3 first (self-contained, no backend needed)
    await nav(page, '/ui2/backtest-v3', 3000);
    await waitForReady(page);
    await sleep(1000);

    // If that 404s/redirects, fall back to main backtest and try harder
    const currentUrl = page.url();
    if (!currentUrl.includes('backtest')) {
      await nav(page, '/ui2/backtest', 4000);
    }

    // Try to run: on BacktesterV3 just click the RUN button
    const ranV3 = await (async () => {
      try {
        const runBtn = page.locator('button').filter({ hasText: /^RUN BACKTEST$|^RUN$/ }).first();
        if (await runBtn.count()) {
          const isDisabled = await runBtn.getAttribute('disabled');
          if (!isDisabled) {
            await runBtn.click();
            await sleep(5000);
            return true;
          }
        }
      } catch { /* skip */ }
      return false;
    })();

    if (!ranV3) {
      // BacktestUI2 path: strategies loaded from API.
      // Wait up to 8s for strategies to populate via API; if backend offline they may still load via mock.
      try {
        await page.waitForSelector('select[data-testid="backtest-strategy"] option:not([value=""])', { timeout: 8000 });
      } catch { /* no strategies loaded */ }

      // Select strategy if available
      try {
        await page.selectOption('select[data-testid="backtest-strategy"]', { index: 0 });
        await sleep(500);
      } catch { /* skip */ }

      // Try clicking run button now
      try {
        const submitBtn = page.getByTestId('backtest-submit-btn');
        const disabled = await submitBtn.getAttribute('disabled');
        if (!disabled) {
          await submitBtn.click();
          await sleep(6000);
        }
      } catch { /* skip */ }
    }

    // Navigate to Runs tab and open analyze if a run exists
    try {
      await clickText(page, 'Runs', 1500);
      await sleep(1000);
      const analyzeBtn = page.locator('[data-testid^="analyze-run-"]').first();
      if (await analyzeBtn.count()) {
        await analyzeBtn.click();
        await sleep(4000);
      }
    } catch { /* skip */ }

    await waitForReady(page);
    await sleep(2000);
    await shot(page, '15-backtest-strategy-results');

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
    // 21  ELASTIHACK — OVERVIEW
    // ═══════════════════════════════════════════════════════════════
    console.log('\n── 21  ElastiHack overview');
    await nav(page, '/ui2/elastihack', 5000);
    await waitForReady(page, 12000);
    // Wait specifically for contract/index data to appear (not "Loading contract...")
    const maxWait = Date.now() + 12000;
    while (Date.now() < maxWait) {
      const loadingText = await page.getByText('Loading contract', { exact: false }).count();
      if (loadingText === 0) break;
      await sleep(800);
    }
    await sleep(2000);
    await shot(page, '21-elastihack-overview-dashboard');

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
    await clickText(page, 'Ops', 3500);
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
    // 28  ELASTIHACK — OVERVIEW FINAL (distinct from 21: navigate away then back)
    // ═══════════════════════════════════════════════════════════════
    console.log('\n── 28  ElastiHack overview final');
    // Navigate away first
    await nav(page, '/ui2/dashboard', 1000);
    await sleep(500);
    // Come back fresh
    await nav(page, '/ui2/elastihack', 5000);
    await waitForReady(page, 12000);
    const maxWait28 = Date.now() + 12000;
    while (Date.now() < maxWait28) {
      const loadingText = await page.getByText('Loading contract', { exact: false }).count();
      if (loadingText === 0) break;
      await sleep(800);
    }
    // Ensure we're on Overview tab
    await clickText(page, 'Overview', 2000);
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
    //     Create a test agent then run it so tool calls / citations appear
    // ═══════════════════════════════════════════════════════════════
    console.log('\n── 33  Agent builder tools / citations');
    await nav(page, '/ui2/agent-builder', 3000);
    await waitForReady(page);

    // Fill agent name
    await fillInput(page, '[data-testid="builder-agent-name-input"]', 'Screenshot Test Agent');
    // Fill description
    await fillInput(page, '[data-testid="builder-agent-desc-input"]', 'Agent for capturing tools/citations view');
    // Click Create
    try {
      const createBtn = page.getByTestId('builder-create-agent-btn');
      if (await createBtn.count()) { await createBtn.click(); await sleep(3000); }
    } catch { /* skip */ }

    // Select the first agent in the list
    try {
      const agentItem = page.locator('[data-testid^="builder-agent-item-"]').first();
      if (await agentItem.count()) { await agentItem.click(); await sleep(1000); }
    } catch {
      // Try clicking the first agent row directly
      try {
        const rows = page.locator('[data-testid*="agent-row"], [class*="agent-row"]');
        if (await rows.count()) { await rows.first().click(); await sleep(1000); }
      } catch {}
    }

    // Fill run query
    await fillInput(page, '[data-testid="builder-run-query-input"], input[placeholder*="query"], input[placeholder*="Query"]', 'Analyze AAPL risk exposure');

    // Click Run
    try {
      const runBtn = page.getByTestId('builder-run-btn');
      if (await runBtn.count()) {
        await runBtn.click();
      } else {
        await clickText(page, 'Run', 200);
      }
      await sleep(4000);
    } catch { /* skip */ }

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
    //     Scroll or zoom in to show just the ticker strip
    // ═══════════════════════════════════════════════════════════════
    console.log('\n── 37  Bloomberg ticker strip detail');
    await nav(page, '/ui2/husk/dashboard', 4000);
    await waitForReady(page);
    await sleep(2000);
    // Try to scroll to and screenshot just the ticker strip area
    try {
      const tickerStrip = page.locator(
        '[class*="ticker"], [data-testid*="ticker"], [class*="market-strip"], [class*="top-bar"]'
      ).first();
      if (await tickerStrip.count()) {
        await tickerStrip.scrollIntoViewIfNeeded();
        await sleep(1000);
        // Zoom in using viewport clip to show ticker area
        await page.evaluate(() => {
          window.scrollTo(0, 0);
        });
        await sleep(500);
      }
    } catch { /* skip */ }
    // Take a cropped screenshot of the top ~200px (ticker strip area)
    await page.screenshot({
      path: path.join(OUT, '37-bloomberg-ticker-strip-detail.png'),
      clip: { x: 0, y: 0, width: 1920, height: 200 },
    });
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
    // ═══════════════════════════════════════════════════════════════
    console.log('\n── 39  Bloomberg order book depth');
    await nav(page, '/ui2/husk/trading', 4000);
    await waitForReady(page);
    // Try to navigate to order book / depth tab
    const depthClicked =
      (await clickText(page, 'ORDER BOOK', 2500)) ||
      (await clickText(page, 'DEPTH', 2500)) ||
      (await clickText(page, 'DOM', 2500));

    if (!depthClicked) {
      // Fallback: scroll down to show order book portion of the same page
      try {
        await page.evaluate(() => window.scrollTo(0, 600));
        await sleep(1000);
      } catch { /* skip */ }
    }
    await sleep(2000);
    // Clip to the order book area if available
    try {
      const ob = page.locator(
        '[data-testid*="order-book"], [data-testid*="orderbook"], [class*="order-book"], [class*="depth"]'
      ).first();
      if (await ob.count()) {
        const box = await ob.boundingBox();
        if (box) {
          await page.screenshot({
            path: path.join(OUT, '39-bloomberg-order-book-depth.png'),
            clip: {
              x: Math.max(0, box.x - 20),
              y: Math.max(0, box.y - 20),
              width: Math.min(box.width + 40, 1920),
              height: Math.min(box.height + 40, 1080),
            },
          });
          console.log('  📸  39-bloomberg-order-book-depth.png (clipped)');
        } else {
          throw new Error('no box');
        }
      } else {
        throw new Error('no element');
      }
    } catch {
      await shot(page, '39-bloomberg-order-book-depth');
    }

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
    // ═══════════════════════════════════════════════════════════════
    console.log('\n── 41  Final hero shot');
    await nav(page, '/ui2/dashboard', 5000);
    await waitForReady(page);
    await sleep(3000);
    await shot(page, '41-FINAL-apex-terminal-complete');

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
