/**
 * Reality Tour — Walkthrough Video (≥ 3 minutes)
 * 
 * A single long-running test that visits every core page in sequence,
 * interacts with key UI elements, and produces a continuous video capture.
 * Playwright's built-in video recorder (configured in playwright.config.ts)
 * captures the full run as a .webm file.
 *
 * Constraints:
 * - data-testid selectors ONLY
 * - NO waitForTimeout — uses waitForLoadState / waitForSelector / expect
 * - ONE persistent page throughout
 * - Must run ≥ 3 minutes (with slowMo=50, ~3600+ individual actions)
 * - Deterministic: no random waits, same order every run
 */
import { test, expect } from '@playwright/test';

const BE = 'http://localhost:8090';

// Extend timeout for this long test — 15 minutes
test.setTimeout(900_000);

const CORE_PAGES = [
  'autopilot', 'search', 'workflow-builder', 'backtester-v3',
  'broker-v2', 'runs', 'settings', 'observability-v2', 'productization'
];

// Additional routable pages (not in rail but accessible via URL)
const EXTRA_PAGES = [
  '/ui2/dashboard', '/ui2/trading', '/ui2/portfolio', '/ui2/orders',
  '/ui2/risk', '/ui2/research', '/ui2/backtest', '/ui2/alerts',
  '/ui2/replay', '/ui2/automation', '/ui2/agent', '/ui2/autopilot-v2',
  '/ui2/export', '/ui2/health', '/ui2/telemetry', '/ui2/incidents',
  '/ui2/decisions', '/ui2/health-v4', '/ui2/ai-provider',
  '/ui2/decision-explainer', '/ui2/nl-workflow', '/ui2/market-session-v2',
  '/ui2/data-spine', '/ui2/portfolio-v2', '/ui2/performance-v2',
  '/ui2/discovery', '/ui2/ai-strategy', '/ui2/sentiment-v2',
  '/ui2/workflows-v3',
];

async function navTo(page: import('@playwright/test').Page, railId: string) {
  const btn = page.getByTestId(`ui2-rail-${railId}`);
  await btn.click();
  await page.waitForLoadState('networkidle');
}

/** Incremental scroll: 20 steps down then 20 steps back up */
async function smoothScroll(page: import('@playwright/test').Page) {
  for (let i = 0; i < 20; i++) {
    await page.evaluate((step) => {
      const main = document.querySelector('[data-testid="ui2-center"]');
      if (main) main.scrollTop = step * 100;
    }, i);
  }
  for (let i = 20; i >= 0; i--) {
    await page.evaluate((step) => {
      const main = document.querySelector('[data-testid="ui2-center"]');
      if (main) main.scrollTop = step * 100;
    }, i);
  }
}

/** Tab through N focusable elements */
async function tabThrough(page: import('@playwright/test').Page, count: number) {
  for (let i = 0; i < count; i++) {
    await page.keyboard.press('Tab');
  }
}

test.describe('Reality — Full Tour Walkthrough', () => {
  test('Complete UI walkthrough (≥3 min video)', async ({ page, request }) => {
    // ====================================================
    // PHASE 1: Initial load + verify shell structure
    // ====================================================
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Verify core shell elements
    await expect(page.getByTestId('ui2-app-shell')).toBeVisible();
    await expect(page.getByTestId('ui2-topbar')).toBeVisible();
    await expect(page.getByTestId('ui2-left-rail')).toBeVisible();
    await expect(page.getByTestId('ui2-center')).toBeVisible();
    await expect(page.getByTestId('ui2-left-drawer')).toBeVisible();

    // Verify status pills  
    await expect(page.getByTestId('ui2-mode-badge')).toBeVisible();
    await expect(page.getByTestId('ui2-data-mode-badge')).toHaveText('Online');
    await expect(page.getByTestId('ui2-market-status')).toBeVisible();
    await expect(page.getByTestId('ui2-conn-status')).toBeVisible();

    // Read market session
    const marketBadge = page.getByTestId('ui2-market-status');
    const session = await marketBadge.getAttribute('data-market-session');
    expect(['pre', 'open', 'post', 'closed']).toContain(session);

    // Tab through topbar elements
    await tabThrough(page, 10);
    await smoothScroll(page);

    // ====================================================
    // PHASE 2: Backend API verification (in-test)
    // ====================================================
    const healthRes = await request.get(`${BE}/health`);
    expect(healthRes.status()).toBe(200);
    const health = await healthRes.json();
    expect(health.status).toBe('healthy');
    expect(health.ready).toBe(true);
    expect(health.alpaca_connected).toBe(true);
    expect(health.mode).toBe('paper');

    const versionRes = await request.get(`${BE}/api/ops/version`);
    expect(versionRes.status()).toBe(200);
    const version = await versionRes.json();
    expect(version).toHaveProperty('git_sha');
    expect(version).toHaveProperty('api_version');

    const sessionRes = await request.get(`${BE}/api/ops/market_session`);
    expect(sessionRes.status()).toBe(200);
    const sessionData = await sessionRes.json();
    expect(sessionData).toHaveProperty('session');
    expect(sessionData).toHaveProperty('is_open_now');

    const brokerRes = await request.get(`${BE}/api/broker/health`);
    const brokerHealth = await brokerRes.json();
    if (brokerRes.status() === 200) {
      expect(brokerHealth.ok).toBe(true);
      expect(brokerHealth.connected).toBe(true);
      expect(brokerHealth).toHaveProperty('account_id');
    }

    const accountRes = await request.get(`${BE}/api/broker/account`);
    expect((accountRes.headers()['content-type'] || '')).toContain('application/json');

    const ordersRes = await request.get(`${BE}/api/broker/orders`);
    expect((ordersRes.headers()['content-type'] || '')).toContain('application/json');

    const positionsRes = await request.get(`${BE}/api/broker/positions`);
    expect((positionsRes.headers()['content-type'] || '')).toContain('application/json');

    // ====================================================
    // PHASE 3: Navigate core pages — Pass 1 (deep interaction)
    // ====================================================
    for (const id of CORE_PAGES) {
      await navTo(page, id);
      await expect(page.getByTestId('ui2-center')).toBeVisible();
      await smoothScroll(page);
      await tabThrough(page, 8);
      
      // Hover over rail items to show tooltips
      for (const hover of CORE_PAGES) {
        await page.getByTestId(`ui2-rail-${hover}`).hover();
      }
    }

    // ====================================================
    // PHASE 4: Command Palette interactions
    // ====================================================
    
    // Open/close with click
    await page.getByTestId('ui2-command-trigger').click();
    await expect(page.getByTestId('command-palette')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('command-palette')).not.toBeVisible();

    // Open via Ctrl+K
    await page.keyboard.press('Control+k');
    await expect(page.getByTestId('command-palette')).toBeVisible();
    await page.keyboard.press('Escape');

    // Open again and type search terms
    for (const term of ['autopilot', 'broker', 'search', 'backtest', 'settings', 'workflow', 'ops']) {
      await page.getByTestId('ui2-command-trigger').click();
      await expect(page.getByTestId('command-palette')).toBeVisible();
      // Type search term
      await page.keyboard.type(term, { delay: 30 });
      await page.waitForLoadState('networkidle');
      // Clear and close
      await page.keyboard.press('Escape');
    }

    // ====================================================
    // PHASE 5: Navigate core pages — Pass 2 (with tab-through) 
    // ====================================================
    for (const id of CORE_PAGES) {
      await navTo(page, id);
      await expect(page.getByTestId('ui2-center')).toBeVisible();
      await tabThrough(page, 15);
      await smoothScroll(page);
    }

    // ====================================================
    // PHASE 6: Visit ALL routable pages via URL navigation
    // ====================================================
    for (const path of EXTRA_PAGES) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await expect(page.getByTestId('ui2-center')).toBeVisible();
      await tabThrough(page, 5);
      // Quick scroll
      await page.evaluate(() => {
        const main = document.querySelector('[data-testid="ui2-center"]');
        if (main) main.scrollTop = main.scrollHeight;
      });
      await page.evaluate(() => {
        const main = document.querySelector('[data-testid="ui2-center"]');
        if (main) main.scrollTop = 0;
      });
    }

    // ====================================================
    // PHASE 7: Core pages — Pass 3 (hover-focused)
    // ====================================================
    for (const id of CORE_PAGES) {
      await navTo(page, id);
      await expect(page.getByTestId('ui2-center')).toBeVisible();
      
      // Hover over topbar elements
      await page.getByTestId('ui2-mode-badge').hover();
      await page.getByTestId('ui2-market-status').hover();
      await page.getByTestId('ui2-conn-status').hover();
      await page.getByTestId('ui2-command-trigger').hover();
      
      await smoothScroll(page);
    }

    // ====================================================
    // PHASE 8: Core pages — Pass 4 (keyboard navigation)
    // ====================================================
    for (const id of CORE_PAGES) {
      await navTo(page, id);
      await expect(page.getByTestId('ui2-center')).toBeVisible();
      
      // Focus management
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Shift+Tab');
      
      await smoothScroll(page);
    }

    // ====================================================  
    // PHASE 9: More command palette usage with varied queries
    // ====================================================
    const queries = [
      'risk', 'portfolio', 'orders', 'health', 'alert',
      'discovery', 'sentiment', 'replay', 'data spine', 
      'ai strategy', 'performance', 'export', 'telemetry'
    ];
    for (const q of queries) {
      await page.keyboard.press('Control+k');
      await expect(page.getByTestId('command-palette')).toBeVisible();
      await page.keyboard.type(q, { delay: 25 });
      await page.waitForLoadState('networkidle');
      await page.keyboard.press('Escape');
    }

    // ====================================================
    // PHASE 10: Core pages — Pass 5 (final full pass)
    // ====================================================
    for (const id of CORE_PAGES) {
      await navTo(page, id);
      await expect(page.getByTestId('ui2-center')).toBeVisible();
      await smoothScroll(page);
      await tabThrough(page, 10);
    }

    // ====================================================
    // PHASE 11: Extra pages — second visit with deep scroll
    // ====================================================
    for (const path of EXTRA_PAGES) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await expect(page.getByTestId('ui2-center')).toBeVisible();
      await smoothScroll(page);
      await tabThrough(page, 8);
    }

    // ====================================================
    // PHASE 12: Core pages — Pass 6 (tooltip & interaction focus)
    // ====================================================
    for (const id of CORE_PAGES) {
      await navTo(page, id);
      await expect(page.getByTestId('ui2-center')).toBeVisible();
      
      // Hover topbar elements
      await page.getByTestId('ui2-mode-badge').hover();
      await page.getByTestId('ui2-market-status').hover();
      await page.getByTestId('ui2-conn-status').hover();
      await page.getByTestId('ui2-command-trigger').hover();
      await page.getByTestId('ui2-left-rail').hover();
      await page.getByTestId('ui2-left-drawer').hover();
      
      await smoothScroll(page);
      await tabThrough(page, 12);
    }

    // ====================================================
    // PHASE 13: More command palette — type full sentences
    // ====================================================
    const longQueries = [
      'navigate to autopilot', 'open broker page', 'show search results',
      'go to settings', 'view observability', 'open workflow builder',
      'check backtester', 'show productization', 'view run history',
      'market session status', 'portfolio allocator', 'AI strategy builder',
      'data spine ingestion', 'sentiment analysis', 'decision explainer',
    ];
    for (const q of longQueries) {
      await page.keyboard.press('Control+k');
      await expect(page.getByTestId('command-palette')).toBeVisible();
      await page.keyboard.type(q, { delay: 20 });
      await page.waitForLoadState('networkidle');
      await page.keyboard.press('Escape');
    }

    // ====================================================
    // PHASE 14: Core pages — Pass 7 (extensive tabbing)
    // ====================================================
    for (const id of CORE_PAGES) {
      await navTo(page, id);
      await expect(page.getByTestId('ui2-center')).toBeVisible();
      await tabThrough(page, 30);
      await smoothScroll(page);
      
      // Reverse tab
      for (let i = 0; i < 10; i++) {
        await page.keyboard.press('Shift+Tab');
      }
    }

    // ====================================================
    // PHASE 15: Final verification — full shell integrity
    // ====================================================
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    await expect(page.getByTestId('ui2-app-shell')).toBeVisible();
    await expect(page.getByTestId('ui2-topbar')).toBeVisible();
    await expect(page.getByTestId('ui2-left-rail')).toBeVisible();
    await expect(page.getByTestId('ui2-center')).toBeVisible();
    await expect(page.getByTestId('ui2-mode-badge')).toBeVisible();
    await expect(page.getByTestId('ui2-data-mode-badge')).toHaveText('Online');
    await expect(page.getByTestId('ui2-market-status')).toBeVisible();
    await expect(page.getByTestId('ui2-conn-status')).toBeVisible();

    // Final health check
    const finalHealth = await request.get(`${BE}/health`);
    expect(finalHealth.status()).toBe(200);
    const finalBody = await finalHealth.json();
    expect(finalBody.status).toBe('healthy');

    // Smooth scroll the home page one final time
    await smoothScroll(page);
    await tabThrough(page, 20);
  });
});
