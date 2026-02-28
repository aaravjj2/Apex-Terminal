// Wave 117 — Visual stability: pages load without crash, no unresolved animations.
import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:8090';
const FRONT = 'http://localhost:5100';

const PAGES = [
  '/ui2/safe-actions',
  '/ui2/accessibility',
  '/ui2/auditor',
];

for (const route of PAGES) {
  test(`w117 visual stable: ${route}`, async ({ page }) => {
    await page.goto(FRONT + route);
    await page.locator('[data-testid="page-ready"]').waitFor({ state: 'visible', timeout: 15000 });
    const title = page.locator('h1, h2, [data-testid="page-title"]').first();
    await expect(title).toBeVisible();
  });
}

test('w117 health endpoint stable', async ({ request }) => {
  const r = await request.get(`${BASE}/api/v3/ops/health`);
  expect(r.status()).toBe(200);
});

test('w117 no 5xx on safe-actions', async ({ page }) => {
  const errors: string[] = [];
  page.on('response', resp => {
    if (resp.status() >= 500) errors.push(`${resp.status()} ${resp.url()}`);
  });
  await page.goto(`${FRONT}/ui2/safe-actions`);
  await page.locator('[data-testid="page-ready"]').waitFor({ state: 'visible', timeout: 15000 });
  expect(errors).toHaveLength(0);
});
