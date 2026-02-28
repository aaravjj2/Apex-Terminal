// Wave 119 — Determinism: proof JSON files exist, diff is empty.
import { test, expect } from '@playwright/test';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKSPACE = join(__dirname, '..', '..', '..', '..');
const BASE = 'http://localhost:8090';

test('w119 proof/determinism-run1.json exists', async () => {
  const path = join(WORKSPACE, 'proof', 'determinism-run1.json');
  expect(existsSync(path)).toBe(true);
});

test('w119 proof/determinism-run2.json exists', async () => {
  const path = join(WORKSPACE, 'proof', 'determinism-run2.json');
  expect(existsSync(path)).toBe(true);
});

test('w119 proof/determinism-diff.txt exists', async () => {
  const path = join(WORKSPACE, 'proof', 'determinism-diff.txt');
  expect(existsSync(path)).toBe(true);
});

test('w119 proof diff is empty', async () => {
  const path = join(WORKSPACE, 'proof', 'determinism-diff.txt');
  const content = readFileSync(path, 'utf8').trim();
  expect(content).toBe('');
});

test('w119 determinism_check.py script exists', async () => {
  const path = join(WORKSPACE, 'scripts', 'determinism_check.py');
  expect(existsSync(path)).toBe(true);
});

test('w119 reset version stable', async ({ request }) => {
  const r1 = await request.get(`${BASE}/api/v3/ops/reset/version`);
  const r2 = await request.get(`${BASE}/api/v3/ops/reset/version`);
  expect(r1.status()).toBe(200);
  expect(r2.status()).toBe(200);
  const d1 = await r1.json();
  const d2 = await r2.json();
  expect(d1.version).toBe(d2.version);
});

test('w119 proof run1 is valid json', async () => {
  const path = join(WORKSPACE, 'proof', 'determinism-run1.json');
  const content = readFileSync(path, 'utf8');
  expect(() => JSON.parse(content)).not.toThrow();
});
