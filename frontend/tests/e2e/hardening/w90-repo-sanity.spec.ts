/**
 * W90 — Repo sanity gates: testids + forbidden Playwright patterns.
 * These tests exercise the scanner scripts and the contributing docs via API.
 */
import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.resolve(__dirname, '../../../../');
const PYTHON = 'C:\\Python314\\python.exe';

function runScript(script: string): { stdout: string; stderr: string; status: number } {
  const scriptPath = path.join(ROOT, 'scripts', script);
  try {
    const stdout = execSync(`"${PYTHON}" "${scriptPath}"`, {
      cwd: ROOT,
      encoding: 'utf-8',
      timeout: 30000,
    });
    return { stdout, stderr: '', status: 0 };
  } catch (err: any) {
    return {
      stdout: err.stdout ?? '',
      stderr: err.stderr ?? '',
      status: err.status ?? 1,
    };
  }
}

test.describe('W90 Repo Sanity Gates', () => {
  test('scan_testids exits 0 (no missing data-testid violations)', () => {
    const result = runScript('scan_testids.py');
    expect(result.status, `Violations found:\n${result.stdout}`).toBe(0);
  });

  test('scan_testids output starts with OK:', () => {
    const result = runScript('scan_testids.py');
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toMatch(/^OK:/);
  });

  test('scan_testids scans at least 50 TSX files', () => {
    const result = runScript('scan_testids.py');
    expect(result.status).toBe(0);
    const m = result.stdout.match(/OK: (\d+) files/);
    expect(m, `Cannot parse file count from: ${result.stdout}`).not.toBeNull();
    const count = parseInt(m![1], 10);
    expect(count).toBeGreaterThanOrEqual(50);
  });

  test('scan_playwright exits 0 (no forbidden patterns in hardening specs)', () => {
    const result = runScript('scan_playwright.py');
    expect(result.status, `Violations found:\n${result.stdout}`).toBe(0);
  });

  test('scan_playwright output starts with OK:', () => {
    const result = runScript('scan_playwright.py');
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toMatch(/^OK:/);
  });

  test('scan_playwright scans at least 10 hardening specs', () => {
    const result = runScript('scan_playwright.py');
    expect(result.status).toBe(0);
    const m = result.stdout.match(/OK: (\d+) hardening specs/);
    expect(m, `Cannot parse spec count from: ${result.stdout}`).not.toBeNull();
    const count = parseInt(m![1], 10);
    expect(count).toBeGreaterThanOrEqual(10);
  });
});

test.describe('W90 Contributing Docs', () => {
  test('docs/CONTRIBUTING.md exists', () => {
    const docsPath = path.join(ROOT, 'docs', 'CONTRIBUTING.md');
    expect(fs.existsSync(docsPath), `CONTRIBUTING.md not found at ${docsPath}`).toBe(true);
  });

  test('CONTRIBUTING.md documents data-testid requirement', () => {
    const content = fs.readFileSync(path.join(ROOT, 'docs', 'CONTRIBUTING.md'), 'utf-8');
    expect(content).toContain('data-testid');
  });

  test('CONTRIBUTING.md documents forbidden Playwright patterns', () => {
    const content = fs.readFileSync(path.join(ROOT, 'docs', 'CONTRIBUTING.md'), 'utf-8');
    expect(content).toContain('waitForTimeout');
    expect(content).toContain('getByText');
  });

  test('CONTRIBUTING.md documents wave proof requirements', () => {
    const content = fs.readFileSync(path.join(ROOT, 'docs', 'CONTRIBUTING.md'), 'utf-8');
    expect(content.toLowerCase()).toContain('wave');
    expect(content.toLowerCase()).toContain('pytest');
    expect(content.toLowerCase()).toContain('playwright');
  });
});
