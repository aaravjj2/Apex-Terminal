#!/usr/bin/env node
/**
 * preflight-e2e-gate.js — Strict E2E enforcement gate
 *
 * HARD GATES:
 *  1. No forbidden selector APIs (getByText, getByRole, getByLabel, getByPlaceholder,
 *     getByAltText, getByTitle, text=, waitForTimeout)
 *  2. playwright.config.ts must have headless: false, retries: 0, workers: 1,
 *     video/trace/screenshot: 'on'
 *  3. webServer must NOT use vite dev
 *
 * Exit 0 = all clear, Exit 1 = violation found
 */

const fs = require('fs');
const path = require('path');

const E2E_DIR = path.resolve(__dirname, '..', 'tests', 'e2e', 'waves1-5');
const CONFIG_PATH = path.resolve(__dirname, '..', 'playwright.config.ts');

const FORBIDDEN_PATTERNS = [
  { pattern: /\bgetByText\s*\(/g,         label: 'getByText()' },
  { pattern: /\bgetByRole\s*\(/g,         label: 'getByRole()' },
  { pattern: /\bgetByLabel\s*\(/g,        label: 'getByLabel()' },
  { pattern: /\bgetByPlaceholder\s*\(/g,  label: 'getByPlaceholder()' },
  { pattern: /\bgetByAltText\s*\(/g,      label: 'getByAltText()' },
  { pattern: /\bgetByTitle\s*\(/g,        label: 'getByTitle()' },
  { pattern: /['"`]text\s*=/g,           label: 'text= selector' },
  { pattern: /\bwaitForTimeout\s*\(/g,    label: 'waitForTimeout()' },
];

let violations = [];

function scanDir(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'dist', '.git', '__snapshots__'].includes(entry.name)) continue;
      scanDir(fullPath);
    } else if (entry.isFile() && /\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        for (const { pattern, label } of FORBIDDEN_PATTERNS) {
          pattern.lastIndex = 0;
          if (pattern.test(lines[i])) {
            violations.push({
              file: path.relative(process.cwd(), fullPath),
              line: i + 1,
              label,
              text: lines[i].trim().substring(0, 120),
            });
          }
        }
      }
    }
  }
}

function validateConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    violations.push({ file: CONFIG_PATH, line: 0, label: 'MISSING CONFIG', text: 'playwright.config.ts not found' });
    return;
  }
  const content = fs.readFileSync(CONFIG_PATH, 'utf8');

  // headless must be false
  if (!/headless\s*:\s*false/.test(content)) {
    violations.push({ file: 'playwright.config.ts', line: 0, label: 'CONFIG', text: 'headless must be false' });
  }
  // retries must be 0
  if (!/retries\s*:\s*0/.test(content)) {
    violations.push({ file: 'playwright.config.ts', line: 0, label: 'CONFIG', text: 'retries must be 0' });
  }
  // workers must be 1
  if (!/workers\s*:\s*1/.test(content)) {
    violations.push({ file: 'playwright.config.ts', line: 0, label: 'CONFIG', text: 'workers must be 1' });
  }
  // video on
  if (!/video\s*:\s*['"]on['"]/.test(content)) {
    violations.push({ file: 'playwright.config.ts', line: 0, label: 'CONFIG', text: "video must be 'on'" });
  }
  // trace on
  if (!/trace\s*:\s*['"]on['"]/.test(content)) {
    violations.push({ file: 'playwright.config.ts', line: 0, label: 'CONFIG', text: "trace must be 'on'" });
  }
  // screenshot on
  if (!/screenshot\s*:\s*['"]on['"]/.test(content)) {
    violations.push({ file: 'playwright.config.ts', line: 0, label: 'CONFIG', text: "screenshot must be 'on'" });
  }
  // webServer must not use vite dev (only build + preview)
  if (/command\s*:\s*['"].*\bvite\b(?!.*\b(?:preview|build)\b)/.test(content)) {
    violations.push({ file: 'playwright.config.ts', line: 0, label: 'CONFIG', text: 'webServer must use vite build + preview, not dev' });
  }
}

// --- Main ---
console.log('=== Preflight E2E Gate ===');
console.log(`Scanning: ${E2E_DIR}`);
scanDir(E2E_DIR);
console.log('Validating: playwright.config.ts');
validateConfig();

if (violations.length > 0) {
  console.error(`\n❌ ${violations.length} VIOLATION(S) FOUND:\n`);
  for (const v of violations) {
    console.error(`  [${v.label}] ${v.file}:${v.line}  ${v.text}`);
  }
  process.exit(1);
} else {
  console.log('\n✅ All E2E preflight checks passed.\n');
  process.exit(0);
}
