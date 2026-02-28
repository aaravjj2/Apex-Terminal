// Wave 121 — Runbooks: all ops docs exist, ops endpoints respond.
import { test, expect } from '@playwright/test';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKSPACE = join(__dirname, '..', '..', '..', '..');
const BASE = 'http://localhost:8090';

const DOCS = [
  ['docs/ops/TROUBLESHOOTING.md', 'troubleshoot'],
  ['docs/ops/RESET.md', 'reset'],
  ['docs/ops/SLO.md', 'slo'],
  ['docs/ops/JUDGE_MODE.md', 'judge'],
  ['docs/ONBOARDING.md', 'getting started'],
];

for (const [rel, keyword] of DOCS) {
  test(`w121 ${rel} exists and has ${keyword}`, async () => {
    const path = join(WORKSPACE, rel);
    expect(existsSync(path)).toBe(true);
    const content = readFileSync(path, 'utf8').toLowerCase();
    expect(content).toContain(keyword);
  });
}

test('w121 reset version endpoint', async ({ request }) => {
  const r = await request.get(`${BASE}/api/v3/ops/reset/version`);
  expect(r.status()).toBe(200);
  const data = await r.json();
  expect(data).toHaveProperty('version');
});

test('w121 reset-all endpoint ok', async ({ request }) => {
  const r = await request.post(`${BASE}/api/v3/ops/reset-all`);
  expect(r.status()).toBe(200);
  const data = await r.json();
  expect(data.status).toBe('ok');
});
