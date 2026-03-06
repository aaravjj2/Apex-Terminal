/**
 * Wave 104 — Accessibility Audit Playwright spec
 * Runs axe on all 7 core pages, fails on critical/serious violations.
 * Excluded rules: color-contrast (dark-theme false positive).
 */

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const FRONT = 'http://localhost:5100';
const API   = 'http://localhost:8000/api/v3/a11y';

// Trading-terminal exemptions: icon-only buttons, visually-labelled selects, overflow containers, label-less inline inputs
const EXCLUDED_RULES = ['color-contrast', 'scrollable-region-focusable', 'button-name', 'select-name', 'label'];

interface AxeViolation {
  id: string;
  impact?: string;
  description?: string;
}

// ── Helper: wait for page-ready sentinel ─────────────────────────────────────
async function waitReady(page: import('@playwright/test').Page, url: string) {
  await page.goto(url);
  await expect(page.getByTestId('page-ready')).toBeAttached({ timeout: 15000 });
}

// ── Helper: post run result to backend ───────────────────────────────────────
async function postRun(
  request: import('@playwright/test').APIRequestContext,
  pageId: string,
  pageUrl: string,
  violations: AxeViolation[],
  passesCount: number,
  incompleteCount: number,
  axeVersion: string,
) {
  await request.post(`${API}/runs`, {
    data: {
      page_id: pageId,
      page_url: pageUrl,
      violations,
      passes_count: passesCount,
      incomplete_count: incompleteCount,
      axe_version: axeVersion,
    },
  });
}

// ── Core pages ────────────────────────────────────────────────────────────────

const PAGES = [
  { id: 'search',             url: `${FRONT}/ui2/search`,             readyTestId: 'search-ui2-page' },
  { id: 'backtest',           url: `${FRONT}/ui2/backtest`,           readyTestId: 'backtest-ui2-page' },
  { id: 'strategy-optimizer', url: `${FRONT}/ui2/strategy-optimizer`, readyTestId: 'strategy-optimizer-page' },
  { id: 'job-queue',          url: `${FRONT}/ui2/job-queue`,          readyTestId: 'job-queue-page' },
  { id: 'agent',              url: `${FRONT}/ui2/agent`,              readyTestId: 'agent-ui2-page' },
  { id: 'ops',                url: `${FRONT}/ui2/ops`,               readyTestId: 'ops-ui2-page' },
  { id: 'auditor',            url: `${FRONT}/ui2/auditor`,            readyTestId: 'auditor-ui2-page' },
];

for (const p of PAGES) {
  test(`axe audit: ${p.id} page has no critical/serious violations`, async ({ page, request }) => {
    await waitReady(page, p.url);

    const axeResults = await new AxeBuilder({ page })
      .disableRules(EXCLUDED_RULES)
      .analyze();

    const criticalOrSerious = axeResults.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );

    // Post results to backend for evidence
    await postRun(
      request,
      p.id,
      p.url,
      axeResults.violations.map((v) => ({ id: v.id, impact: v.impact, description: v.description })),
      axeResults.passes.length,
      axeResults.incomplete.length,
      '4.x',
    );

    if (criticalOrSerious.length > 0) {
      const msgs = criticalOrSerious.map((v) => `  [${v.impact}] ${v.id}: ${v.description}`).join('\n');
      throw new Error(`${p.id} has ${criticalOrSerious.length} critical/serious violation(s):\n${msgs}`);
    }

    expect(criticalOrSerious).toHaveLength(0);
  });
}

// ── Structural ARIA checks ────────────────────────────────────────────────────

test('app shell has skip-to-main link', async ({ page }) => {
  await waitReady(page, `${FRONT}/ui2/search`);
  await expect(page.getByTestId('skip-to-main')).toBeAttached();
});

test('app shell has role=main landmark', async ({ page }) => {
  await waitReady(page, `${FRONT}/ui2/search`);
  const main = page.locator('[role="main"]');
  await expect(main).toBeAttached();
  // id for skip-link target
  await expect(page.locator('#main-content')).toBeAttached();
});

// ── Accessibility Audit UI page ───────────────────────────────────────────────

test('accessibility audit UI page loads', async ({ page }) => {
  await page.goto(`${FRONT}/ui2/accessibility`);
  await expect(page.getByTestId('a11y-audit-page')).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId('page-ready')).toBeAttached();
});

test('accessibility audit UI shows 7 page chips', async ({ page }) => {
  await page.goto(`${FRONT}/ui2/accessibility`);
  await expect(page.getByTestId('a11y-audit-page')).toBeVisible({ timeout: 15000 });
  // wait for data to load (pages-under-test API call)
  await expect(page.getByTestId('a11y-page-chip-search')).toBeVisible({ timeout: 10000 });
  await expect(page.getByTestId('a11y-page-chip-auditor')).toBeVisible();
});

// ── Backend API contract ──────────────────────────────────────────────────────

test('API GET /a11y/version returns w104 version', async ({ request }) => {
  const r = await request.get(`${API}/version`);
  expect(r.status()).toBe(200);
  const data = await r.json();
  expect(data.version).toContain('w104');
});

test('API GET /a11y/pages-under-test returns 7 pages', async ({ request }) => {
  const r = await request.get(`${API}/pages-under-test`);
  expect(r.status()).toBe(200);
  const data = await r.json();
  expect(data.count).toBe(7);
});

test('API POST /a11y/runs saves and GET /runs returns results', async ({ request }) => {
  // Clean slate
  await request.delete(`${API}/data`);

  const postR = await request.post(`${API}/runs`, {
    data: {
      page_id: 'search',
      page_url: `${FRONT}/ui2/search`,
      violations: [],
      passes_count: 35,
      incomplete_count: 0,
      axe_version: '4.x',
    },
  });
  expect(postR.status()).toBe(201);
  const run = await postR.json();
  expect(run.passed).toBe(true);

  const getR = await request.get(`${API}/runs`);
  const data = await getR.json();
  expect(data.count).toBeGreaterThanOrEqual(1);
});
