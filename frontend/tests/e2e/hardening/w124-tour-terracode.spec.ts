// Wave 124 — TerraCode demo tour: script covers convergence + key endpoints respond.
import { test, expect } from '@playwright/test';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKSPACE = join(__dirname, '..', '..', '..', '..');
const BASE = 'http://localhost:8000';
const FRONT = 'http://localhost:5100';

test('w124 TERRACODE_DEMO_SCRIPT.md exists', async () => {
  expect(existsSync(join(WORKSPACE, 'docs/submission/TERRACODE_DEMO_SCRIPT.md'))).toBe(true);
});

test('w124 script references controls-domain', async () => {
  const content = readFileSync(join(WORKSPACE, 'docs/submission/TERRACODE_DEMO_SCRIPT.md'), 'utf8');
  expect(content.toLowerCase()).toContain('controls');
});

test('w124 script references safe-actions', async () => {
  const content = readFileSync(join(WORKSPACE, 'docs/submission/TERRACODE_DEMO_SCRIPT.md'), 'utf8');
  expect(content.toLowerCase()).toContain('safe');
});

test('w124 script has demo scenes', async () => {
  const content = readFileSync(join(WORKSPACE, 'docs/submission/TERRACODE_DEMO_SCRIPT.md'), 'utf8');
  // Script uses Scene headings (Scene 1, Scene 2, ...)
  expect(content.toLowerCase()).toMatch(/scene|navigate/);
});

test('w124 tickets search endpoint', async ({ request }) => {
  const r = await request.get(`${BASE}/api/v3/tickets/tickets/search?q=terracode`);
  expect(r.status()).toBe(200);
});

test('w124 reset version endpoint', async ({ request }) => {
  const r = await request.get(`${BASE}/api/v3/ops/reset/version`);
  expect(r.status()).toBe(200);
});

test('w124 safe-actions page loads', async ({ page }) => {
  await page.goto(`${FRONT}/ui2/safe-actions`);
  await page.locator('[data-testid="page-ready"]').waitFor({ state: 'visible', timeout: 15000 });
  await expect(page.locator('[data-testid="page-ready"]')).toBeVisible();
});
