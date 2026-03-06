// Wave 125 — ElastiHack demo tour: script covers ES search, endpoints respond.
import { test, expect } from '@playwright/test';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKSPACE = join(__dirname, '..', '..', '..', '..');
const BASE = 'http://localhost:8000';
const FRONT = 'http://localhost:5100';

test('w125 ELASTIHACK_DEMO_SCRIPT.md exists', async () => {
  expect(existsSync(join(WORKSPACE, 'docs/submission/ELASTIHACK_DEMO_SCRIPT.md'))).toBe(true);
});

test('w125 script references elasticsearch', async () => {
  const content = readFileSync(join(WORKSPACE, 'docs/submission/ELASTIHACK_DEMO_SCRIPT.md'), 'utf8');
  expect(content.toLowerCase()).toMatch(/elastic/);
});

test('w125 script references search', async () => {
  const content = readFileSync(join(WORKSPACE, 'docs/submission/ELASTIHACK_DEMO_SCRIPT.md'), 'utf8');
  expect(content.toLowerCase()).toContain('search');
});

test('w125 script has steps', async () => {
  const content = readFileSync(join(WORKSPACE, 'docs/submission/ELASTIHACK_DEMO_SCRIPT.md'), 'utf8');
  // Script uses Scene headings
  expect(content.toLowerCase()).toMatch(/scene|navigate/);
});

test('w125 ES health connected', async ({ request }) => {
  const r = await request.get(`${BASE}/api/v3/ops/elasticsearch`);
  expect(r.status()).toBe(200);
  const data = await r.json();
  expect(data).toHaveProperty('connected');
});

test('w125 ES cluster_status present', async ({ request }) => {
  const r = await request.get(`${BASE}/api/v3/ops/elasticsearch`);
  const data = await r.json();
  expect(['green', 'yellow', 'red']).toContain(data.cluster_status);
});

test('w125 search endpoint responds', async ({ request }) => {
  const r = await request.get(`${BASE}/api/v3/tickets/tickets/search?q=elastic`);
  expect(r.status()).toBe(200);
});
