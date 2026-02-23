// Wave 126 — Submission bundle: scripts exist, Makefile has bundle target.
import { test, expect } from '@playwright/test';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKSPACE = join(__dirname, '..', '..', '..', '..');

test('w126 generate_submission_bundle.py exists', async () => {
  expect(existsSync(join(WORKSPACE, 'scripts/generate_submission_bundle.py'))).toBe(true);
});

test('w126 bundle script references zipfile', async () => {
  const content = readFileSync(join(WORKSPACE, 'scripts/generate_submission_bundle.py'), 'utf8');
  expect(content.toLowerCase()).toMatch(/zip/);
});

test('w126 bundle script references docs', async () => {
  const content = readFileSync(join(WORKSPACE, 'scripts/generate_submission_bundle.py'), 'utf8');
  expect(content).toContain('docs');
});

test('w126 Makefile has bundle target', async () => {
  const content = readFileSync(join(WORKSPACE, 'Makefile'), 'utf8');
  expect(content).toContain('bundle');
});

test('w126 proof directory exists', async () => {
  expect(existsSync(join(WORKSPACE, 'proof'))).toBe(true);
});

test('w126 scripts directory exists', async () => {
  expect(existsSync(join(WORKSPACE, 'scripts'))).toBe(true);
});

test('w126 check_submission_compliance.py exists', async () => {
  expect(existsSync(join(WORKSPACE, 'scripts/check_submission_compliance.py'))).toBe(true);
});
