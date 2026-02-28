// Wave 122 — Secrets hygiene: account_number redacted, no raw keys in responses.
import { test, expect } from '@playwright/test';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKSPACE = join(__dirname, '..', '..', '..', '..');
const BASE = 'http://localhost:8090';

test('w122 check_secrets.py exists', async () => {
  const path = join(WORKSPACE, 'scripts', 'check_secrets.py');
  expect(existsSync(path)).toBe(true);
});

test('w122 broker account_number is redacted', async ({ request }) => {
  const r = await request.get(`${BASE}/api/v3/ops/broker`);
  expect(r.status()).toBe(200);
  const data = await r.json();
  const acct: string = data.account_number ?? '';
  expect(acct).toMatch(/\*/);
});

test('w122 broker response has no raw alpaca key', async ({ request }) => {
  const r = await request.get(`${BASE}/api/v3/ops/broker`);
  const text = await r.text();
  expect(text).not.toMatch(/\bPK[A-Z0-9]{16,}\b/);
  expect(text).not.toMatch(/\bSK[A-Z0-9]{16,}\b/);
});

test('w122 health response has no raw alpaca key', async ({ request }) => {
  const r = await request.get(`${BASE}/api/v3/ops/health`);
  const text = await r.text();
  expect(text).not.toMatch(/\bPK[A-Z0-9]{16,}\b/);
});

test('w122 es health has no raw key', async ({ request }) => {
  const r = await request.get(`${BASE}/api/v3/ops/elasticsearch`);
  const text = await r.text();
  expect(text).not.toMatch(/\bPK[A-Z0-9]{16,}\b/);
});
