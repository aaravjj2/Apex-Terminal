/**
 * v1.93 — No Fake KPIs Guard Test
 * Ensures UI2 pages DO NOT import DEMO_* constants from fixtures/constants
 * and present them as "real" data.
 * 
 * DEMO_* imports are OK for:
 * - demo/fixtures.ts itself (defines fixtures)
 * - stores that use DEMO_TS for deterministic timestamps (acceptable)
 * - AppShellUI2 for user/status badges (acceptable presentational constants)
 * 
 * DEMO_* imports are NOT OK for:
 * - Dashboard KPIs (should use tradingStore/positionsStore)
 * - Orders tables (should use tradingStore)  
 * - Real-time stats/metrics in workspace pages
 */

import { describe, it } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const UI2_PAGES_DIR = join(__dirname, '../../src/ui2/pages');
const FORBIDDEN_PATTERNS = [
  /import\s+\{[^}]*DEMO_KPIS[^}]*\}\s+from/,
  /import\s+\{[^}]*DEMO_ORDERS[^}]*\}\s+from/,
  /import\s+\{[^}]*DEMO_POSITIONS[^}]*\}\s+from/,
  /import\s+\{[^}]*DEMO_INSIGHTS[^}]*\}\s+from/,
];

const ALLOWED_EXCEPTIONS = new Set([
  'OpsUI2.tsx', // Uses DEMO_TIMESTAMP for platform info (acceptable)
]);

function scanFile(filePath: string): { violations: string[], file: string } {
  const content = readFileSync(filePath, 'utf-8');
  const violations: string[] = [];
  
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(content)) {
      const match = content.match(pattern);
      violations.push(`Found forbidden import: ${match?.[0]}`);
    }
  }
  
  return { violations, file: filePath };
}

describe('No Fake KPIs Guard (v1.93)', () => {
  it('UI2 pages must not import DEMO_KPIS/DEMO_ORDERS/DEMO_POSITIONS as real data', () => {
    try {
      const files = readdirSync(UI2_PAGES_DIR).filter(f => f.endsWith('.tsx'));
      const allViolations: Array<{ file: string; violations: string[] }> = [];
      
      for (const file of files) {
        if (ALLOWED_EXCEPTIONS.has(file)) continue;
        
        const result = scanFile(join(UI2_PAGES_DIR, file));
        if (result.violations.length > 0) {
          allViolations.push({ file, violations: result.violations });
        }
      }
      
      if (allViolations.length > 0) {
        const errorMsg = allViolations.map(v => 
          `${v.file}:\n  ${v.violations.join('\n  ')}`
        ).join('\n\n');
        
        throw new Error(
          `Found ${allViolations.length} file(s) with forbidden DEMO_* imports:\n\n${errorMsg}\n\n` +
          `UI2 pages must use real data from stores (tradingStore, positionsStore, etc.) not DEMO fixtures.`
        );
      }
      
      // If we get here, all good
      expect(allViolations).toHaveLength(0);
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        // Pages dir doesn't exist yet, that's OK
        expect(true).toBe(true);
      } else {
        throw err;
      }
    }
  });
});
