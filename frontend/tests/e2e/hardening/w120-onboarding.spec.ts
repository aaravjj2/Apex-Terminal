// Wave 120 — Onboarding: docs/ONBOARDING.md exists, guided tour pages reachable.
import { test, expect } from '@playwright/test';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKSPACE = join(__dirname, '..', '..', '..', '..');
const BASE = 'http://localhost:8090';
const FRONT = 'http://localhost:5100';

test('w120 ONBOARDING.md exists', async () => {
  const path = join(WORKSPACE, 'docs', 'ONBOARDING.md');
  expect(existsSync(path)).toBe(true);
});

test('w120 ONBOARDING.md has getting started', async () => {
  const path = join(WORKSPACE, 'docs', 'ONBOARDING.md');
  const content = readFileSync(path, 'utf8');
  expect(content.toLowerCase()).toContain('getting started');
});

test('w120 ONBOARDING.md references health check', async () => {
  const path = join(WORKSPACE, 'docs', 'ONBOARDING.md');
  const content = readFileSync(path, 'utf8');
  expect(content).toContain('/api/v3/ops/health');
});

test('w120 all health endpoints up', async ({ request }) => {
  for (const ep of ['/api/v3/ops/health', '/api/v3/ops/ws/health', '/api/v3/ops/elasticsearch', '/api/v3/ops/broker']) {
    const r = await request.get(`${BASE}${ep}`);
    expect(r.status()).toBe(200);
  }
});

test('w120 auditor page loads', async ({ page }) => {
  await page.goto(`${FRONT}/ui2/auditor`);
  await page.locator('[data-testid="page-ready"]').waitFor({ state: 'visible', timeout: 15000 });
  await expect(page.locator('[data-testid="page-ready"]')).toBeVisible();
});

test('w120 ops page loads', async ({ page }) => {
  await page.goto(`${FRONT}/ui2/ops`);
  await expect(page.locator('body')).toBeVisible();
});
