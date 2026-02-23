// Wave 127 — CI gate: Makefile has all required targets, run_3x.ps1 exists.
import { test, expect } from '@playwright/test';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKSPACE = join(__dirname, '..', '..', '..', '..');

const REQUIRED_TARGETS = ['test', 'e2e', 'secrets', 'compliance', 'bundle', 'determinism', '3x'];

test('w127 Makefile exists', async () => {
  expect(existsSync(join(WORKSPACE, 'Makefile'))).toBe(true);
});

test('w127 Makefile has all required targets', async () => {
  const content = readFileSync(join(WORKSPACE, 'Makefile'), 'utf8');
  const missing = REQUIRED_TARGETS.filter(t => !content.includes(t));
  expect(missing).toHaveLength(0);
});

test('w127 run_3x.ps1 exists', async () => {
  expect(existsSync(join(WORKSPACE, 'scripts/run_3x.ps1'))).toBe(true);
});

test('w127 determinism_check.py exists', async () => {
  expect(existsSync(join(WORKSPACE, 'scripts/determinism_check.py'))).toBe(true);
});

test('w127 determinism_check.py has subprocess', async () => {
  const content = readFileSync(join(WORKSPACE, 'scripts/determinism_check.py'), 'utf8');
  expect(content).toContain('subprocess');
});
