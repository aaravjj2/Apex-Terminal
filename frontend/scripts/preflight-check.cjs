#!/usr/bin/env node
/**
 * Playwright Preflight Check
 * Fails if core spec files violate the Core Correctness Track rules:
 *   - No waitForTimeout
 *   - No getByText / getByRole / text= selectors
 *   - playwright.config.ts must be headed, workers=1, retries=0, artifacts ON
 */

const fs = require('fs');
const path = require('path');

const CORE_SPECS_DIR = path.join(__dirname, '../tests/e2e/core');
const PLAYWRIGHT_CONFIG = path.join(__dirname, '../playwright.config.ts');

let errors = 0;

function fail(msg) {
  console.error(`❌ PREFLIGHT FAIL: ${msg}`);
  errors++;
}

function ok(msg) {
  console.log(`✅ ${msg}`);
}

// ── 1. Check core spec files ─────────────────────────────────

const specFiles = fs.readdirSync(CORE_SPECS_DIR)
  .filter(f => f.endsWith('.spec.ts'))
  .map(f => path.join(CORE_SPECS_DIR, f));

if (specFiles.length === 0) {
  fail('No spec files found in tests/e2e/core/');
} else {
  ok(`Found ${specFiles.length} core spec file(s)`);
}

const FORBIDDEN_PATTERNS = [
  { pattern: /waitForTimeout/, name: 'waitForTimeout' },
  { pattern: /getByText\(/, name: 'getByText()' },
  { pattern: /getByRole\(/, name: 'getByRole()' },
  { pattern: /text=["'`]/, name: 'text= selector' },
  { pattern: /[^a-z]role=["'`]/, name: 'role= selector' },
];

for (const specFile of specFiles) {
  const content = fs.readFileSync(specFile, 'utf8');
  const relPath = path.relative(process.cwd(), specFile);
  let fileOk = true;

  for (const { pattern, name } of FORBIDDEN_PATTERNS) {
    const lines = content.split('\n');
    lines.forEach((line, i) => {
      if (pattern.test(line) && !line.trim().startsWith('//') && !line.trim().startsWith('*')) {
        fail(`${relPath}:${i + 1} — forbidden selector: ${name}`);
        fileOk = false;
      }
    });
  }

  if (fileOk) ok(`${path.basename(specFile)} — no forbidden selectors`);
}

// ── 2. Count total test() calls ───────────────────────────────

let totalTests = 0;
for (const specFile of specFiles) {
  const content = fs.readFileSync(specFile, 'utf8');
  const matches = content.match(/^\s+test\(/gm) || [];
  totalTests += matches.length;
}

if (totalTests < 75) {
  fail(`Total tests ${totalTests} < 75 minimum`);
} else {
  ok(`Total tests: ${totalTests} (≥75 required)`);
}

// ── 3. Check playwright.config.ts ────────────────────────────

if (!fs.existsSync(PLAYWRIGHT_CONFIG)) {
  fail('playwright.config.ts not found');
} else {
  const config = fs.readFileSync(PLAYWRIGHT_CONFIG, 'utf8');

  if (!/headless:\s*false/.test(config)) {
    fail('playwright.config.ts: headless must be false (headed mode required)');
  } else {
    ok('playwright.config.ts: headless=false ✓');
  }

  if (!/workers:\s*1/.test(config)) {
    fail('playwright.config.ts: workers must be 1');
  } else {
    ok('playwright.config.ts: workers=1 ✓');
  }

  if (!/retries:\s*0/.test(config)) {
    fail('playwright.config.ts: retries must be 0');
  } else {
    ok('playwright.config.ts: retries=0 ✓');
  }

  if (!/video:\s*['"]on['"]/.test(config)) {
    fail('playwright.config.ts: video must be "on"');
  } else {
    ok('playwright.config.ts: video=on ✓');
  }

  if (!/screenshot:\s*['"]on['"]/.test(config)) {
    fail('playwright.config.ts: screenshot must be "on"');
  } else {
    ok('playwright.config.ts: screenshot=on ✓');
  }

  if (!/trace:\s*['"]on['"]/.test(config)) {
    fail('playwright.config.ts: trace must be "on"');
  } else {
    ok('playwright.config.ts: trace=on ✓');
  }
}

// ── 4. Final result ───────────────────────────────────────────

if (errors > 0) {
  console.error(`\n💥 Preflight check FAILED with ${errors} error(s). Fix before running Playwright.`);
  process.exit(1);
} else {
  console.log(`\n✨ All preflight checks PASSED (${specFiles.length} specs, ${totalTests} tests)`);
  process.exit(0);
}
