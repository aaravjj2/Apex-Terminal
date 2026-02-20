/**
 * preflight.spec.ts
 *
 * Validates that the waves6-10 test suite itself uses ONLY allowed patterns.
 * Forbidden selectors: getByText, getByRole, waitForTimeout
 * Required selector strategy: data-testid (getByTestId or locator('[data-testid=...'))
 *
 * This file scans every spec file in this directory and asserts zero forbidden patterns.
 */
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ESM-safe __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const SPEC_DIR = path.dirname(__filename);

const FORBIDDEN_PATTERNS: Array<{ name: string; re: RegExp }> = [
  { name: 'getByText', re: /\.getByText\s*\(/ },
  { name: 'getByRole', re: /\.getByRole\s*\(/ },
  { name: 'waitForTimeout', re: /\.waitForTimeout\s*\(/ },
  { name: 'page.waitForTimeout', re: /page\.waitForTimeout\s*\(/ },
];

function collectSpecFiles(dir: string): string[] {
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.spec.ts') && f !== 'preflight.spec.ts')
    .map(f => path.join(dir, f));
}

test.describe('preflight — forbidden pattern guard', () => {
  const specFiles = collectSpecFiles(SPEC_DIR);

  test(`found ${specFiles.length} spec file(s) to check`, () => {
    expect(specFiles.length).toBeGreaterThanOrEqual(5);
  });

  for (const filePath of specFiles) {
    const fileName = path.basename(filePath);
    const src = fs.readFileSync(filePath, 'utf-8');

    for (const { name, re } of FORBIDDEN_PATTERNS) {
      test(`${fileName} must not use ${name}`, () => {
        const matches = src.match(re);
        expect(
          matches,
          `"${name}" is forbidden in ${fileName}. Found: ${JSON.stringify(matches)}`
        ).toBeNull();
      });
    }

    test(`${fileName} selectors must use data-testid`, () => {
      // Every locator call should reference data-testid
      // We allow getByTestId and [data-testid= patterns
      const locatorCalls = [...src.matchAll(/\.locator\s*\(\s*['"`]([^'"`]+)['"`]/g)].map(m => m[1]);
      for (const sel of locatorCalls) {
        if (sel.includes('data-testid') || sel.startsWith('//') || sel.startsWith('xpath')) continue;
        // allow pseudo-classes like :nth-child only after data-testid
        expect(
          sel,
          `Forbidden locator "${sel}" in ${fileName} — use data-testid selectors`
        ).toContain('data-testid');
      }
    });
  }
});
