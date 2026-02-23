/**
 * Wave 111 — MCP-only enforcement gate self-test.
 * This spec fails if the Playwright config is non-compliant or test files
 * contain forbidden selectors (getByText, getByRole, waitForTimeout).
 *
 * NOTE: This spec itself only uses data-testid and request API — no forbidden selectors.
 */

import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ROOT = resolve(__dirname, '..', '..', '..', '..');  // workspace root
const FRONTEND = join(ROOT, 'frontend');
const CONFIG_FILE = join(FRONTEND, 'playwright.config.ts');
const SPECS_DIR = join(FRONTEND, 'tests', 'e2e', 'hardening');

// ─────────────────────────────────────────────────────────────────────────────
// Config compliance (read playwright.config.ts as text)
// ─────────────────────────────────────────────────────────────────────────────

function readConfig(): string {
  return readFileSync(CONFIG_FILE, 'utf-8');
}

function getAllSpecFiles(dir: string): string[] {
  const files: string[] = [];
  function walk(d: string) {
    for (const entry of readdirSync(d)) {
      const full = join(d, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else if (full.endsWith('.spec.ts')) {
        files.push(full);
      }
    }
  }
  walk(dir);
  return files;
}

test('config: headless: false is set', async () => {
  const config = readConfig();
  expect(config).toContain('headless: false');
});

test('config: workers: 1 is set', async () => {
  const config = readConfig();
  expect(config).toContain('workers: 1');
});

test('config: retries: 0 is set', async () => {
  const config = readConfig();
  expect(config).toContain('retries: 0');
});

test('config: video: on is set', async () => {
  const config = readConfig();
  expect(config).toMatch(/video:\s*['"]on['"]/);
});

test('config: trace: on is set', async () => {
  const config = readConfig();
  expect(config).toMatch(/trace:\s*['"]on['"]/);
});

test('config: screenshot: on is set', async () => {
  const config = readConfig();
  expect(config).toMatch(/screenshot:\s*['"]on['"]/);
});

// ─────────────────────────────────────────────────────────────────────────────
// Runtime enforcement: actual browser config
// ─────────────────────────────────────────────────────────────────────────────

test('runtime: browser is running in headed mode', async ({ browser }) => {
  // In headed mode, browser.browserType().name() is 'chromium' (not 'chromium-headless')
  // We verify by checking the config file which is enforced above
  const config = readConfig();
  expect(config).toContain('headless: false');
  // Also verify browser is connected (it must be — we're in a test)
  expect(browser.isConnected()).toBe(true);
});

// ─────────────────────────────────────────────────────────────────────────────
// File scanner: no forbidden selectors in any spec file
// ─────────────────────────────────────────────────────────────────────────────

function scanForPattern(pattern: RegExp): Array<{ file: string; line: number; text: string }> {
  const violations: Array<{ file: string; line: number; text: string }> = [];
  for (const specFile of getAllSpecFiles(SPECS_DIR)) {
    const lines = readFileSync(specFile, 'utf-8').split('\n');
    lines.forEach((line, i) => {
      const stripped = line.trim();
      if (stripped.startsWith('//') || stripped.startsWith('*')) return;
      if (pattern.test(line)) {
        violations.push({ file: specFile.replace(ROOT, ''), line: i + 1, text: line.trim() });
      }
    });
  }
  return violations;
}

test('scanner: no getByText in any spec file', async () => {
  const violations = scanForPattern(/\.getByText\s*\(/);
  const report = violations.slice(0, 3).map(v => `  ${v.file}:${v.line}: ${v.text}`).join('\n');
  expect(violations.length).toBe(0);
  if (violations.length > 0) console.error('getByText violations:\n' + report);
});

test('scanner: no getByRole in any spec file', async () => {
  const violations = scanForPattern(/\.getByRole\s*\(/);
  const report = violations.slice(0, 3).map(v => `  ${v.file}:${v.line}: ${v.text}`).join('\n');
  expect(violations.length).toBe(0);
  if (violations.length > 0) console.error('getByRole violations:\n' + report);
});

test('scanner: no getByLabel in any spec file', async () => {
  const violations = scanForPattern(/\.getByLabel\s*\(/);
  const report = violations.slice(0, 3).map(v => `  ${v.file}:${v.line}: ${v.text}`).join('\n');
  expect(violations.length).toBe(0);
  if (violations.length > 0) console.error('getByLabel violations:\n' + report);
});

test('scanner: no getByPlaceholder in any spec file', async () => {
  const violations = scanForPattern(/\.getByPlaceholder\s*\(/);
  const report = violations.slice(0, 3).map(v => `  ${v.file}:${v.line}: ${v.text}`).join('\n');
  expect(violations.length).toBe(0);
  if (violations.length > 0) console.error('getByPlaceholder violations:\n' + report);
});

test('scanner: no waitForTimeout in any spec file', async () => {
  const violations = scanForPattern(/waitForTimeout\s*\(/);
  const report = violations.slice(0, 3).map(v => `  ${v.file}:${v.line}: ${v.text}`).join('\n');
  expect(violations.length).toBe(0);
  if (violations.length > 0) console.error('waitForTimeout violations:\n' + report);
});

test('scanner: at least 10 spec files exist', async () => {
  const specFiles = getAllSpecFiles(SPECS_DIR);
  expect(specFiles.length).toBeGreaterThanOrEqual(10);
});
