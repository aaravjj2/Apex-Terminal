#!/usr/bin/env node
/**
 * Selector Policy Gate (v1.12 Objective G)
 * 
 * Enforces data-testid-only selector policy for Playwright E2E tests.
 * 
 * ALLOWED:
 * - page.getByTestId('my-element')
 * - locator('[data-testid="my-element"]')
 * - data-testid attributes in files
 * 
 * FORBIDDEN:
 * - page.getByText('some text')
 * - page.getByRole('button', { name: 'Submit' })
 * - page.locator('.css-class')
 * - page.locator('#id')
 * - page.locator('div > span')
 * - getByLabel, getByPlaceholder, getByAltText, getByTitle
 * 
 * EXIT CODES:
 * - 0: All tests compliant (data-testid only)
 * - 1: Forbidden patterns found
 * - 2: CLI usage error
 */

const fs = require('fs');
const path = require('path');

// Forbidden patterns with descriptions
const FORBIDDEN_PATTERNS = [
  { regex: /\.getByText\(/g, name: 'getByText()' },
  { regex: /\.getByRole\(/g, name: 'getByRole()' },
  { regex: /\.getByLabel\(/g, name: 'getByLabel()' },
  { regex: /\.getByPlaceholder\(/g, name: 'getByPlaceholder()' },
  { regex: /\.getByAltText\(/g, name: 'getByAltText()' },
  { regex: /\.getByTitle\(/g, name: 'getByTitle()' },
  // CSS selectors in locator (class, id, tag, descendant)
  { regex: /\.locator\s*\(\s*['"`][\s]*[.#]/g, name: 'locator() with CSS class/id' },
  { regex: /\.locator\s*\(\s*['"`][\s]*[a-zA-Z]+[\s]*[>+~]/g, name: 'locator() with CSS combinator' },
];

// Allowed patterns (for positive validation)
const ALLOWED_PATTERNS = [
  /\.getByTestId\(/g,
  /data-testid=/g,
  /\[data-testid=/g,
];

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const violations = [];

  for (const { regex, name } of FORBIDDEN_PATTERNS) {
    const matches = content.matchAll(regex);
    for (const match of matches) {
      const lineNumber = content.substring(0, match.index).split('\n').length;
      const lineContent = content.split('\n')[lineNumber - 1].trim();
      violations.push({
        file: filePath,
        line: lineNumber,
        pattern: name,
        code: lineContent,
      });
    }
  }

  return violations;
}

function scanDirectory(dirPath, extensions = ['.ts', '.tsx', '.js', '.jsx']) {
  let violations = [];

  function traverse(currentPath) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        // Skip node_modules, dist, build
        if (['node_modules', 'dist', 'build', '.git'].includes(entry.name)) {
          continue;
        }
        traverse(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (extensions.includes(ext)) {
          const fileViolations = scanFile(fullPath);
          violations = violations.concat(fileViolations);
        }
      }
    }
  }

  traverse(dirPath);
  return violations;
}

function printReport(violations) {
  if (violations.length === 0) {
    console.log('✅ SELECTOR POLICY: COMPLIANT');
    console.log('All tests use data-testid selectors only.');
    return 0;
  }

  console.log('❌ SELECTOR POLICY: VIOLATIONS FOUND\n');
  console.log(`Total violations: ${violations.length}\n`);

  // Group by file
  const byFile = {};
  for (const v of violations) {
    if (!byFile[v.file]) {
      byFile[v.file] = [];
    }
    byFile[v.file].push(v);
  }

  for (const [file, fileViolations] of Object.entries(byFile)) {
    console.log(`File: ${file}`);
    console.log(`Violations: ${fileViolations.length}`);
    for (const v of fileViolations) {
      console.log(`  Line ${v.line}: ${v.pattern}`);
      console.log(`    ${v.code.substring(0, 100)}${v.code.length > 100 ? '...' : ''}`);
    }
    console.log('');
  }

  console.log('FORBIDDEN PATTERNS:');
  console.log('  - .getByText(), .getByRole(), .getByLabel(), .getByPlaceholder(), .getByAltText(), .getByTitle()');
  console.log('  - .locator() with CSS selectors (class, id, tag, combinator)');
  console.log('  - .locator() with non-testid attribute selectors');
  console.log('\nALLOWED PATTERNS:');
  console.log('  - .getByTestId("my-element")');
  console.log('  - .locator(\'[data-testid="my-element"]\')');
  console.log('  - data-testid="my-element" in JSX/HTML');

  return 1;
}

// CLI
function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: node scripts/selector-policy-gate.js <directory>');
    console.error('Example: node scripts/selector-policy-gate.js frontend/tests/e2e/');
    process.exit(2);
  }

  const targetPath = args[0];

  if (!fs.existsSync(targetPath)) {
    console.error(`Error: Path does not exist: ${targetPath}`);
    process.exit(2);
  }

  const stat = fs.statSync(targetPath);
  let violations = [];

  if (stat.isDirectory()) {
    violations = scanDirectory(targetPath);
  } else if (stat.isFile()) {
    violations = scanFile(targetPath);
  } else {
    console.error(`Error: Path is neither file nor directory: ${targetPath}`);
    process.exit(2);
  }

  const exitCode = printReport(violations);
  process.exit(exitCode);
}

if (require.main === module) {
  main();
}

module.exports = { scanFile, scanDirectory, FORBIDDEN_PATTERNS, ALLOWED_PATTERNS };
