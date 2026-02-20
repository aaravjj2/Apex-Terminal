/**
 * Shared E2E fixtures for Wave 1–5 validation suite.
 * All selectors use data-testid ONLY.
 */
import { test as base, expect, type Page, type Locator } from '@playwright/test';

// ── Deterministic timestamp: fixed for all runs ──
export const FROZEN_TIME = new Date('2026-02-18T12:00:00.000Z').getTime();

// ── Locator helpers (data-testid only) ──
export function tid(page: Page, testId: string): Locator {
  return page.locator(`[data-testid="${testId}"]`);
}

export function tidAll(page: Page, testIdPrefix: string): Locator {
  return page.locator(`[data-testid^="${testIdPrefix}"]`);
}

// ── Enable deterministic mode ──
export async function enableDeterministicMode(page: Page): Promise<void> {
  await page.addInitScript(`
    (() => {
      const frozen = ${FROZEN_TIME};
      const OrigDate = Date;
      const FakeDate = function(...args) {
        if (args.length === 0) return new OrigDate(frozen);
        return new OrigDate(...args);
      };
      FakeDate.now = () => frozen;
      FakeDate.parse = OrigDate.parse;
      FakeDate.UTC = OrigDate.UTC;
      FakeDate.prototype = OrigDate.prototype;
      window.Date = FakeDate;

      // Seed Math.random for determinism
      let seed = 42;
      Math.random = () => { seed = (seed * 16807 + 0) % 2147483647; return (seed - 1) / 2147483646; };

      // Disable CSS animations/transitions
      const style = document.createElement('style');
      style.textContent = '*, *::before, *::after { animation-duration: 0s !important; transition-duration: 0s !important; }';
      document.head.appendChild(style);

      window.__E2E_MODE__ = true;
    })();
  `);
}

// ── Wait for app shell to be ready ──
export async function waitForAppReady(page: Page): Promise<void> {
  await tid(page, 'app-shell').waitFor({ state: 'visible', timeout: 30000 });
  await tid(page, 'left-nav').waitFor({ state: 'visible', timeout: 15000 });
  await tid(page, 'main-content').waitFor({ state: 'visible', timeout: 15000 });
}

// ── Navigate to UI2 with deterministic mode ──
export async function gotoApp(page: Page): Promise<void> {
  await enableDeterministicMode(page);
  await page.goto('/?e2e=1', { waitUntil: 'networkidle' });
  await waitForAppReady(page);
}

// ── Navigate to a specific view via LeftNav ──
export async function navigateToView(page: Page, viewId: string): Promise<void> {
  const navItem = tid(page, `nav-item-${viewId}`);
  await navItem.waitFor({ state: 'visible', timeout: 10000 });
  await navItem.click();
  // Wait for main content to update
  await page.waitForFunction(() => true, undefined, { timeout: 3000 });
}

// ── Wait for a specific panel to be ready ──
export async function waitForPanelReady(page: Page, panelReadyTestId: string): Promise<void> {
  try {
    await tid(page, panelReadyTestId).waitFor({ state: 'attached', timeout: 15000 });
  } catch {
    // Panel may not use -ready suffix; just wait for the main panel
    const baseName = panelReadyTestId.replace('-ready', '');
    await tid(page, baseName).waitFor({ state: 'visible', timeout: 10000 });
  }
}

// ── Reset app state (clear storage) ──
export async function resetAppState(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

// ── Take named screenshot ──
export async function takeScreenshot(page: Page, name: string): Promise<Buffer> {
  return await page.screenshot({
    path: `test-results/screenshots/${name}.png`,
    fullPage: true,
  });
}

// ── API client helper ──
const API_BASE = 'http://127.0.0.1:8090';

export async function apiGet(page: Page, endpoint: string): Promise<unknown> {
  return await page.evaluate(async (url: string) => {
    const res = await fetch(url);
    return res.ok ? res.json() : null;
  }, `${API_BASE}${endpoint}`);
}

export async function apiPost(page: Page, endpoint: string, body: unknown): Promise<unknown> {
  return await page.evaluate(async ({ url, body }: { url: string; body: unknown }) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.ok ? res.json() : null;
  }, { url: `${API_BASE}${endpoint}`, body });
}

// ── Crypto hash helper for determinism checks ──
export async function sha256(page: Page, text: string): Promise<string> {
  return await page.evaluate(async (t: string) => {
    const data = new TextEncoder().encode(t);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  }, text);
}

// ── Extended test fixture with common setup ──
export const test = base.extend<{ appPage: Page }>({
  appPage: async ({ page }, use) => {
    await enableDeterministicMode(page);
    await page.goto('/?e2e=1', { waitUntil: 'networkidle' });
    await waitForAppReady(page);
    await use(page);
  },
});

export { expect };
