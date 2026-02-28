// Wave 130 — Final proof pack: all health endpoints, proof files, compliance docs.
import { test, expect } from '@playwright/test';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKSPACE = join(__dirname, '..', '..', '..', '..');
const BASE = 'http://localhost:8090';

// ── health endpoints ──────────────────────────────────────────────────────────
test('w130 /api/v3/ops/health → 200', async ({ request }) => {
  const r = await request.get(`${BASE}/api/v3/ops/health`);
  expect(r.status()).toBe(200);
});

test('w130 /api/v3/ops/ws/health → 200', async ({ request }) => {
  const r = await request.get(`${BASE}/api/v3/ops/ws/health`);
  expect(r.status()).toBe(200);
});

test('w130 /api/v3/ops/elasticsearch → 200', async ({ request }) => {
  const r = await request.get(`${BASE}/api/v3/ops/elasticsearch`);
  expect(r.status()).toBe(200);
});

test('w130 /api/v3/ops/broker → 200', async ({ request }) => {
  const r = await request.get(`${BASE}/api/v3/ops/broker`);
  expect(r.status()).toBe(200);
});

test('w130 /api/v3/ops/reset/version → starts with w', async ({ request }) => {
  const r = await request.get(`${BASE}/api/v3/ops/reset/version`);
  expect(r.status()).toBe(200);
  const data = await r.json();
  expect(data.version).toMatch(/^w/);
});

// ── proof files ───────────────────────────────────────────────────────────────
test('w130 proof/determinism-run1.json exists', async () => {
  expect(existsSync(join(WORKSPACE, 'proof/determinism-run1.json'))).toBe(true);
});

test('w130 proof/determinism-run2.json exists', async () => {
  expect(existsSync(join(WORKSPACE, 'proof/determinism-run2.json'))).toBe(true);
});

test('w130 proof/determinism-diff.txt is empty', async () => {
  const path = join(WORKSPACE, 'proof/determinism-diff.txt');
  expect(existsSync(path)).toBe(true);
  expect(readFileSync(path, 'utf8').trim()).toBe('');
});

// ── compliance docs ───────────────────────────────────────────────────────────
test('w130 README.md exists', async () => {
  expect(existsSync(join(WORKSPACE, 'README.md'))).toBe(true);
});

test('w130 ONBOARDING.md exists', async () => {
  expect(existsSync(join(WORKSPACE, 'docs/ONBOARDING.md'))).toBe(true);
});

test('w130 TERRACODE demo script exists', async () => {
  expect(existsSync(join(WORKSPACE, 'docs/submission/TERRACODE_DEMO_SCRIPT.md'))).toBe(true);
});

test('w130 ELASTIHACK demo script exists', async () => {
  expect(existsSync(join(WORKSPACE, 'docs/submission/ELASTIHACK_DEMO_SCRIPT.md'))).toBe(true);
});

test('w130 SLO doc exists', async () => {
  expect(existsSync(join(WORKSPACE, 'docs/ops/SLO.md'))).toBe(true);
});
