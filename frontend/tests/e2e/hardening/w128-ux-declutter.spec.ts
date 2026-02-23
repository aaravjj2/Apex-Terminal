// Wave 128 — UX declutter: required nav routes are reachable.
import { test, expect } from '@playwright/test';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKSPACE = join(__dirname, '..', '..', '..', '..');
const FRONT = 'http://localhost:5100';

test('w128 routes file has convergence', async () => {
  const candidates = ['frontend/src/ui2/routes.tsx', 'frontend/src/routes.tsx', 'frontend/src/App.tsx'];
  let content = '';
  for (const c of candidates) {
    const p = join(WORKSPACE, c);
    if (existsSync(p)) { content = readFileSync(p, 'utf8'); break; }
  }
  expect(content.toLowerCase()).toContain('convergence');
});

test('w128 routes file has auditor', async () => {
  const candidates = ['frontend/src/ui2/routes.tsx', 'frontend/src/routes.tsx', 'frontend/src/App.tsx'];
  let content = '';
  for (const c of candidates) {
    const p = join(WORKSPACE, c);
    if (existsSync(p)) { content = readFileSync(p, 'utf8'); break; }
  }
  expect(content.toLowerCase()).toContain('auditor');
});

test('w128 routes file has search', async () => {
  const candidates = ['frontend/src/ui2/routes.tsx', 'frontend/src/routes.tsx', 'frontend/src/App.tsx'];
  let content = '';
  for (const c of candidates) {
    const p = join(WORKSPACE, c);
    if (existsSync(p)) { content = readFileSync(p, 'utf8'); break; }
  }
  expect(content.toLowerCase()).toContain('search');
});

test('w128 auditor page loads', async ({ page }) => {
  await page.goto(`${FRONT}/ui2/auditor`);
  await page.locator('[data-testid="page-ready"]').waitFor({ state: 'visible', timeout: 15000 });
  await expect(page.locator('[data-testid="page-ready"]')).toBeVisible();
});

test('w128 accessibility page loads', async ({ page }) => {
  await page.goto(`${FRONT}/ui2/accessibility`);
  await page.locator('[data-testid="page-ready"]').waitFor({ state: 'visible', timeout: 15000 });
  await expect(page.locator('[data-testid="page-ready"]')).toBeVisible();
});
