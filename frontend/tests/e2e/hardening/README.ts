/**
 * Hardening Suite — Index
 *
 * Run the full hardening suite:
 *   npx playwright test tests/e2e/hardening/
 *
 * Or run twice for determinism proof:
 *   npx playwright test tests/e2e/hardening/ --reporter=line
 *   npx playwright test tests/e2e/hardening/ --reporter=line
 *
 * Gates:
 *   Gate 1 — health-gates.spec.ts       (ops health endpoints)
 *   Gate 2 — backtest-determinism.spec.ts (determinism proof)
 *   Gate 3 — ws-stability.spec.ts        (WS heartbeat + no silent drop)
 *   Gate 4 — ui2-pages.spec.ts           (20 pages × render)
 *   Gate 5 — broker-sync.spec.ts         (live Alpaca paper broker)
 *
 * Zero-tolerance: 0 failed, 0 skipped, 0 errors required for sign-off.
 */

// This file intentionally left as documentation.
// Playwright auto-discovers all *.spec.ts files in this directory.
export {};
