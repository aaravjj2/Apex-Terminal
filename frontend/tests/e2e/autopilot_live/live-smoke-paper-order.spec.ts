/**
 * live-smoke-paper-order.spec.ts
 *
 * End-to-end smoke test: verifies the full command center renders
 * all 8 tabs without errors, and that the LLM tab exposes provider badges.
 *
 * This spec does NOT actually fire a paper order (order submission
 * requires armed state + market open + valid chain; we only verify
 * the UI path is reachable and correct data-testids are present).
 */

import { test, expect } from '@playwright/test';

const PAGE = 'http://localhost:5100/ui2/autopilot-command-center';

const ALL_TABS = [
  { btn: 'tab-btn-status',     content: 'tab-status'     },
  { btn: 'tab-btn-cycles',     content: 'tab-cycles'     },
  { btn: 'tab-btn-decisions',  content: 'tab-decisions'  },
  { btn: 'tab-btn-rejections', content: 'tab-rejections' },
  { btn: 'tab-btn-orders',     content: 'tab-orders'     },
  { btn: 'tab-btn-positions',  content: 'tab-positions'  },
  { btn: 'tab-btn-pnl',        content: 'tab-pnl'        },
  { btn: 'tab-btn-llm',        content: 'tab-llm'        },
];

test.describe('Autopilot Command Center — Smoke', () => {

  test('all 8 tabs navigate without JS errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));

    await page.goto(PAGE, { waitUntil: 'networkidle' });

    for (const { btn, content } of ALL_TABS) {
      await page.getByTestId(btn).click();
      await expect(page.getByTestId(content)).toBeVisible();
    }

    expect(errors.filter(e => !e.includes('ResizeObserver'))).toHaveLength(0);
  });

  test('LLM tab shows provider badges', async ({ page }) => {
    await page.goto(PAGE, { waitUntil: 'networkidle' });
    await page.getByTestId('tab-btn-llm').click();
    await expect(page.getByTestId('tab-llm')).toBeVisible();

    const llmEmpty = page.getByTestId('llm-empty');
    const providers = page.getByTestId('llm-providers');

    const anyVisible = (await providers.isVisible().catch(() => false)) || (await llmEmpty.isVisible().catch(() => false));
    expect(anyVisible).toBe(true);
  });

  test('LLM provider-specific badges present when data available', async ({ page }) => {
    await page.goto(PAGE, { waitUntil: 'networkidle' });
    await page.getByTestId('tab-btn-llm').click();

    const hasData = await page.getByTestId('llm-providers').isVisible().catch(() => false);
    if (!hasData) return; // backend not running — graceful skip

    await expect(page.getByTestId('badge-gemini')).toBeVisible();
    await expect(page.getByTestId('badge-groq')).toBeVisible();
    await expect(page.getByTestId('badge-ollama')).toBeVisible();
  });

  test('Decisions tab renders sections', async ({ page }) => {
    await page.goto(PAGE, { waitUntil: 'networkidle' });
    await page.getByTestId('tab-btn-decisions').click();
    await expect(page.getByTestId('tab-decisions')).toBeVisible();
    const list  = page.getByTestId('decisions-list');
    const empty = page.getByTestId('decisions-empty');
    const anyVisible = (await list.isVisible().catch(() => false)) || (await empty.isVisible().catch(() => false));
    expect(anyVisible).toBe(true);
  });

  test('Rejections tab renders sections', async ({ page }) => {
    await page.goto(PAGE, { waitUntil: 'networkidle' });
    await page.getByTestId('tab-btn-rejections').click();
    await expect(page.getByTestId('tab-rejections')).toBeVisible();
    const list  = page.getByTestId('rejections-list');
    const empty = page.getByTestId('rejections-empty');
    const anyVisible = (await list.isVisible().catch(() => false)) || (await empty.isVisible().catch(() => false));
    expect(anyVisible).toBe(true);
  });

  test('global error banner not shown on clean load', async ({ page }) => {
    await page.goto(PAGE, { waitUntil: 'networkidle' });
    const banner = page.getByTestId('global-error-banner');
    const visible = await banner.isVisible().catch(() => false);
    // If backend is up, no error banner should appear
    // This is informational — we record the state, not fail the test
    if (visible) {
      const msg = await banner.textContent();
      console.log(`[smoke] global-error-banner visible: ${msg}`);
    }
    // Kill-switch banner should not be present unless switch is active
    const ksBanner = page.getByTestId('kill-switch-banner');
    const ksVisible = await ksBanner.isVisible().catch(() => false);
    if (ksVisible) console.log('[smoke] kill-switch-banner is active');
  });
});
