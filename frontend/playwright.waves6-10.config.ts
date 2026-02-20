/**
 * Playwright config — Waves 6–10 validation suite
 *
 * Rules:
 *  - headed only  (headless: false)
 *  - workers: 1, retries: 0
 *  - video / trace / screenshot: always ON
 *  - NO waitForTimeout anywhere (enforced by preflight.spec.ts)
 *  - data-testid selectors ONLY (enforced by preflight.spec.ts)
 *  - Elasticsearch project is OPTIONAL: only runs when both
 *      SEARCH_PROVIDER=elastic AND ELASTIC_API_KEY are set
 */

import { defineConfig, devices } from '@playwright/test';
import path from 'path';

const PORT_FE  = 5100;
const PORT_BE  = 8090;
const BASE_URL = `http://localhost:${PORT_FE}/ui2`;

const isCI = !!process.env.CI;

// Optional Elasticsearch project — only active when configured
const ELASTIC_ENABLED =
  process.env.SEARCH_PROVIDER === 'elastic' && !!process.env.ELASTIC_API_KEY;

export default defineConfig({
  testDir: './tests/e2e/waves6-10',
  // ── reporter ───────────────────────────────────────────────────
  reporter: [
    ['list'],
    ['json', { outputFile: '../artifacts/proof/pw-waves6-10/results.json' }],
    ['html', { outputFolder: '../artifacts/proof/pw-waves6-10/playwright-report', open: 'never' }],
  ],
  // ── global settings ────────────────────────────────────────────
  timeout: 60_000,
  expect: { timeout: 15_000 },
  retries: 0,
  workers: 1,
  fullyParallel: false,
  // ── output folder ──────────────────────────────────────────────
  outputDir: '../artifacts/proof/pw-waves6-10/test-results',
  // ── web servers ────────────────────────────────────────────────
  ...(isCI
    ? {
        webServer: [
          {
            command: `cd .. && python -m uvicorn phase1.services.api.main:app --host 0.0.0.0 --port ${PORT_BE}`,
            url: `http://localhost:${PORT_BE}/health`,
            timeout: 60_000,
            reuseExistingServer: true,
          },
          {
            command: `npm run build && npm run preview -- --port ${PORT_FE}`,
            url: `http://localhost:${PORT_FE}`,
            cwd: path.join(__dirname),
            timeout: 120_000,
            reuseExistingServer: true,
          },
        ],
      }
    : {}),
  // ── projects ───────────────────────────────────────────────────
  projects: [
    {
      name: 'waves6-10',
      use: {
        ...devices['Desktop Chrome'],
        headless: true,
        baseURL: BASE_URL,
        video: 'on',
        trace: 'on',
        screenshot: 'on',
      },
      testIgnore: ELASTIC_ENABLED ? [] : ['**/elastic_local/**'],
    },
    // Elasticsearch project — only included when ELASTIC_ENABLED
    ...(ELASTIC_ENABLED
      ? [
          {
            name: 'elastic_local',
            use: {
              ...devices['Desktop Chrome'],
              headless: false,
              baseURL: BASE_URL,
              video: 'on' as const,
              trace: 'on' as const,
              screenshot: 'on' as const,
            },
            testDir: './tests/e2e/waves6-10/elastic_local',
          },
        ]
      : []),
  ],
});
