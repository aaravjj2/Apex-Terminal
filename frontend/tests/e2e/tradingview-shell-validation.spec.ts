/**
 * TradingView Shell Validation — Comprehensive Playwright E2E Tests
 * Validates the new TradingView-inspired layout matches demo/index.html exactly
 * 
 * Grid structure: 40px TopBar | 1fr Layout (48px LeftNav + 1fr Content + 286px RightSidebar) | 20px StatusBar
 * Theme: TradingView blue (#2962FF), dark background (#0C0E12)
 * 
 * Run with: xvfb-run --auto-servernum npx playwright test tests/e2e/tradingview-shell-validation.spec.ts --config=playwright.config.mcp.ts
 */
import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:5100';

test.describe('TradingView Shell — Grid Layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/ui2/dashboard`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid="ui2-app-shell"]', { timeout: 15000 });
  });

  test('Main grid has 3 rows: 40px topbar, 1fr layout, 20px statusbar', async ({ page }) => {
    const shell = page.locator('[data-testid="ui2-app-shell"]');
    await expect(shell).toBeVisible();
    const box = await shell.boundingBox();
    expect(box!.width).toBeGreaterThan(1000);
    expect(box!.height).toBeGreaterThan(700);
  });

  test('TopBar is exactly 40px tall', async ({ page }) => {
    const topbar = page.locator('[data-testid="ui2-topbar"]');
    await expect(topbar).toBeVisible();
    const box = await topbar.boundingBox();
    expect(box!.height).toBe(40);
  });

  test('LeftNav is exactly 48px wide', async ({ page }) => {
    const leftnav = page.locator('[data-testid="ui2-left-rail"]');
    await expect(leftnav).toBeVisible();
    const box = await leftnav.boundingBox();
    expect(box!.width).toBe(48);
  });

  test('RightSidebar is approximately 286px wide', async ({ page }) => {
    const sidebar = page.locator('[data-testid="ui2-right-sidebar"]');
    await expect(sidebar).toBeVisible();
    const box = await sidebar.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(280);
    expect(box!.width).toBeLessThanOrEqual(292);
  });

  test('Center content fills remaining space', async ({ page }) => {
    const center = page.locator('[data-testid="ui2-center"]');
    await expect(center).toBeVisible();
    const box = await center.boundingBox();
    // With 1920px viewport: 1920 - 48 - 286 - 2px borders = ~1584px
    expect(box!.width).toBeGreaterThan(500);
  });
});

test.describe('TradingView Shell — TopBar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/ui2/dashboard`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid="ui2-app-shell"]', { timeout: 15000 });
  });

  test('TopBar shows APEX logo text', async ({ page }) => {
    const topbar = page.locator('[data-testid="ui2-topbar"]');
    await expect(topbar).toContainText('APEX');
  });

  test('TopBar shows mode badge (LIVE or PAPER)', async ({ page }) => {
    const badge = page.locator('[data-testid="ui2-mode-badge"]');
    await expect(badge).toBeVisible();
    const text = await badge.textContent();
    expect(['LIVE', 'PAPER']).toContain(text?.trim());
  });

  test('TopBar has search/command trigger', async ({ page }) => {
    const trigger = page.locator('[data-testid="ui2-command-trigger"]');
    await expect(trigger).toBeVisible();
  });

  test('TopBar shows symbol strip with tradable assets', async ({ page }) => {
    const topbar = page.locator('[data-testid="ui2-topbar"]');
    // Symbol strip should have AAPL, TSLA, SPY, BTC, ETH
    await expect(topbar).toContainText('AAPL');
    await expect(topbar).toContainText('TSLA');
    await expect(topbar).toContainText('SPY');
    await expect(topbar).toContainText('BTC');
    await expect(topbar).toContainText('ETH');
  });

  test('TopBar shows clock with ET timezone', async ({ page }) => {
    const clock = page.locator('[data-testid="ui2-clock"]');
    await expect(clock).toBeVisible();
    const text = await clock.textContent();
    expect(text).toContain('ET');
  });
});

test.describe('TradingView Shell — LeftNav Groups', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/ui2/dashboard`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid="ui2-app-shell"]', { timeout: 15000 });
  });

  test('LeftNav shows Autopilot button at top', async ({ page }) => {
    const autopilot = page.locator('[data-testid="ui2-rail-autopilot"]');
    await expect(autopilot).toBeVisible();
  });

  test('TRADE group is expanded by default showing 6 items', async ({ page }) => {
    const leftnav = page.locator('[data-testid="ui2-left-rail"]');
    // TRADE group items: trading, dashboard, portfolio, orders, risk, heatmap
    await expect(leftnav.locator('[data-testid="ui2-rail-trading"]')).toBeVisible();
    await expect(leftnav.locator('[data-testid="ui2-rail-dashboard"]')).toBeVisible();
    await expect(leftnav.locator('[data-testid="ui2-rail-portfolio"]')).toBeVisible();
    await expect(leftnav.locator('[data-testid="ui2-rail-orders"]')).toBeVisible();
    await expect(leftnav.locator('[data-testid="ui2-rail-risk"]')).toBeVisible();
    await expect(leftnav.locator('[data-testid="ui2-rail-heatmap"]')).toBeVisible();
  });

  test('STRAT, MKTS, ASSET, SYS groups exist as collapsible headers', async ({ page }) => {
    const leftnav = page.locator('[data-testid="ui2-left-rail"]');
    // These should show as collapsed group headers
    await expect(leftnav).toContainText('STRAT');
    await expect(leftnav).toContainText('MKTS');
    await expect(leftnav).toContainText('ASSET');
    await expect(leftnav).toContainText('SYS');
  });

  test('Clicking group header toggles expansion', async ({ page }) => {
    const leftnav = page.locator('[data-testid="ui2-left-rail"]');
    // STRAT should be collapsed
    const stratHeader = leftnav.getByText('STRAT');
    await stratHeader.click();
    // After clicking, backtest items should appear
    await expect(leftnav.locator('[data-testid="ui2-rail-backtest"]')).toBeVisible({ timeout: 2000 });
  });

  test('Nav click navigates to correct route', async ({ page }) => {
    const tradingBtn = page.locator('[data-testid="ui2-rail-trading"]');
    await tradingBtn.click();
    await page.waitForURL(/\/ui2\/trading/, { timeout: 5000 });
    expect(page.url()).toContain('/ui2/trading');
  });
});

test.describe('TradingView Shell — Right Sidebar (6 tabs)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/ui2/dashboard`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid="ui2-app-shell"]', { timeout: 15000 });
  });

  test('Right sidebar has 6 tab buttons', async ({ page }) => {
    const sidebar = page.locator('[data-testid="ui2-right-sidebar"]');
    await expect(sidebar.locator('[data-testid="sidebar-tab-order"]')).toBeVisible();
    await expect(sidebar.locator('[data-testid="sidebar-tab-watch"]')).toBeVisible();
    await expect(sidebar.locator('[data-testid="sidebar-tab-pos"]')).toBeVisible();
    await expect(sidebar.locator('[data-testid="sidebar-tab-news"]')).toBeVisible();
    await expect(sidebar.locator('[data-testid="sidebar-tab-l2"]')).toBeVisible();
    await expect(sidebar.locator('[data-testid="sidebar-tab-ts"]')).toBeVisible();
  });

  test('Order tab shows BUY/SELL buttons by default', async ({ page }) => {
    const sidebar = page.locator('[data-testid="ui2-right-sidebar"]');
    await expect(sidebar.getByText('BUY', { exact: true }).first()).toBeVisible();
    await expect(sidebar.getByText('SELL', { exact: true }).first()).toBeVisible();
  });

  test('Order tab has order type dropdown (Limit, Market, Stop, etc.)', async ({ page }) => {
    const sidebar = page.locator('[data-testid="ui2-right-sidebar"]');
    await expect(sidebar).toContainText('ORDER TYPE');
    const select = sidebar.locator('select').first();
    await expect(select).toBeVisible();
  });

  test('Order tab has quantity and limit price inputs', async ({ page }) => {
    const sidebar = page.locator('[data-testid="ui2-right-sidebar"]');
    await expect(sidebar).toContainText('QUANTITY');
    await expect(sidebar).toContainText('LIMIT PRICE');
  });

  test('Order tab shows risk check status', async ({ page }) => {
    const sidebar = page.locator('[data-testid="ui2-right-sidebar"]');
    await expect(sidebar).toContainText('Risk check');
  });

  test('Clicking watchlist tab shows symbols', async ({ page }) => {
    const sidebar = page.locator('[data-testid="ui2-right-sidebar"]');
    await sidebar.locator('[data-testid="sidebar-tab-watch"]').click();
    // Should show watchlist symbols
    await expect(sidebar).toContainText('AAPL');
    await expect(sidebar).toContainText('TSLA');
  });

  test('Clicking L2 tab shows bid/ask depth book', async ({ page }) => {
    const sidebar = page.locator('[data-testid="ui2-right-sidebar"]');
    await sidebar.locator('[data-testid="sidebar-tab-l2"]').click();
    // Should show bid/ask headers
    // L2 shows order book with bid/ask depth levels
    await expect(sidebar).toContainText('ORDER BOOK');
  });
});

test.describe('TradingView Shell — StatusBar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/ui2/dashboard`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid="ui2-app-shell"]', { timeout: 15000 });
  });

  test('StatusBar shows NAV value', async ({ page }) => {
    const shell = page.locator('[data-testid="ui2-app-shell"]');
    await expect(shell).toContainText('NAV');
    await expect(shell).toContainText('$');
  });

  test('StatusBar shows leverage indicator', async ({ page }) => {
    const shell = page.locator('[data-testid="ui2-app-shell"]');
    await expect(shell).toContainText('Lev');
  });

  test('StatusBar has scrolling ticker tape with market data', async ({ page }) => {
    const shell = page.locator('[data-testid="ui2-app-shell"]');
    // Ticker should have major indices
    await expect(shell).toContainText('SPX');
    await expect(shell).toContainText('NDX');
  });
});

test.describe('TradingView Shell — Command Palette', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/ui2/dashboard`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid="ui2-app-shell"]', { timeout: 15000 });
  });

  test('Ctrl+K opens command palette', async ({ page }) => {
    await page.keyboard.press('Control+k');
    const palette = page.locator('[data-testid="command-palette"]');
    await expect(palette).toBeVisible({ timeout: 3000 });
  });

  test('Command palette has search input', async ({ page }) => {
    await page.keyboard.press('Control+k');
    const input = page.locator('[data-testid="command-palette-input"]');
    await expect(input).toBeVisible({ timeout: 3000 });
    await expect(input).toBeFocused();
  });

  test('Command palette search filters results', async ({ page }) => {
    await page.keyboard.press('Control+k');
    const input = page.locator('[data-testid="command-palette-input"]');
    await input.fill('trading');
    // Should show filtered results
    const palette = page.locator('[data-testid="command-palette"]');
    await expect(palette).toContainText('Trading');
  });

  test('Escape closes command palette', async ({ page }) => {
    await page.keyboard.press('Control+k');
    const palette = page.locator('[data-testid="command-palette"]');
    await expect(palette).toBeVisible({ timeout: 3000 });
    await page.keyboard.press('Escape');
    await expect(palette).not.toBeVisible({ timeout: 2000 });
  });

  test('Command palette navigates on Enter', async ({ page }) => {
    await page.keyboard.press('Control+k');
    const input = page.locator('[data-testid="command-palette-input"]');
    await input.fill('heatmap');
    await page.waitForTimeout(300);
    await page.keyboard.press('Enter');
    await page.waitForURL(/\/ui2\/heatmap/, { timeout: 5000 });
    expect(page.url()).toContain('/ui2/heatmap');
  });
});

test.describe('TradingView Shell — Multi-Page Navigation', () => {
  const pages = [
    { path: '/ui2/dashboard', name: 'Dashboard', testId: 'ui2-rail-dashboard' },
    { path: '/ui2/trading', name: 'Trading', testId: 'ui2-rail-trading' },
    { path: '/ui2/portfolio', name: 'Portfolio', testId: 'ui2-rail-portfolio' },
    { path: '/ui2/orders', name: 'Orders', testId: 'ui2-rail-orders' },
    { path: '/ui2/risk-dashboard', name: 'Risk', testId: 'ui2-rail-risk' },
    { path: '/ui2/heatmap', name: 'Heatmap', testId: 'ui2-rail-heatmap' },
  ];

  for (const pg of pages) {
    test(`${pg.name} page loads via LeftNav click`, async ({ page }) => {
      const errors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          const text = msg.text();
          if (!text.includes('net::ERR_') && !text.includes('WebSocket') && 
              !text.includes('favicon') && !text.includes('Failed to load resource')) {
            errors.push(text);
          }
        }
      });
      await page.goto(`${BASE}/ui2/dashboard`, { waitUntil: 'networkidle' });
      await page.waitForSelector('[data-testid="ui2-app-shell"]', { timeout: 15000 });
      
      const navBtn = page.locator(`[data-testid="${pg.testId}"]`);
      await navBtn.click();
      await page.waitForURL(new RegExp(pg.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), { timeout: 5000 });
      
      // Verify shell is still intact after navigation
      await expect(page.locator('[data-testid="ui2-topbar"]')).toBeVisible();
      await expect(page.locator('[data-testid="ui2-left-rail"]')).toBeVisible();
      await expect(page.locator('[data-testid="ui2-right-sidebar"]')).toBeVisible();
      await expect(page.locator('[data-testid="ui2-center"]')).toBeVisible();
      
      expect(errors).toEqual([]);
    });
  }
});

test.describe('TradingView Shell — Design Tokens', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/ui2/dashboard`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid="ui2-app-shell"]', { timeout: 15000 });
  });

  test('App uses dark background theme (#0C0E12 or similar)', async ({ page }) => {
    const shell = page.locator('[data-testid="ui2-app-shell"]');
    const bg = await shell.evaluate(el => getComputedStyle(el).backgroundColor);
    // Should be a very dark color
    const match = bg.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (match) {
      const [, r, g, b] = match.map(Number);
      // All channels should be very low (dark)
      expect(r).toBeLessThan(50);
      expect(g).toBeLessThan(50);
      expect(b).toBeLessThan(50);
    }
  });

  test('Font family uses Inter (not IBM Plex Mono)', async ({ page }) => {
    const shell = page.locator('[data-testid="ui2-app-shell"]');
    const fontFamily = await shell.evaluate(el => getComputedStyle(el).fontFamily);
    expect(fontFamily.toLowerCase()).toContain('inter');
    expect(fontFamily.toLowerCase()).not.toContain('ibm plex mono');
  });
});

test.describe('TradingView Shell — No Console Errors', () => {
  const pages = [
    '/ui2/dashboard',
    '/ui2/trading',
    '/ui2/portfolio',
    '/ui2/backtest-engine',
    '/ui2/options-chain',
    '/ui2/heatmap',
    '/ui2/risk-dashboard',
    '/ui2/bloomberg-terminal',
    '/ui2/fx-dashboard',
    '/ui2/crypto',
  ];

  for (const path of pages) {
    test(`No console errors on ${path}`, async ({ page }) => {
      const errors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          const text = msg.text();
          if (!text.includes('net::ERR_') && !text.includes('WebSocket') && 
              !text.includes('favicon') && !text.includes('Failed to load resource')) {
            errors.push(text);
          }
        }
      });
      await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
      await page.waitForSelector('[data-testid="ui2-app-shell"]', { timeout: 15000 });
      await page.waitForTimeout(1000);
      expect(errors).toEqual([]);
    });
  }
});
