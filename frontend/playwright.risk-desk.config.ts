/**
 * Playwright config specifically for Risk Desk E2E tests.
 *
 * Uses vite preview (production build) to avoid HMR-related page reloads
 * that occur in dev mode and cause test flakiness.
 *
 * Captures video for ALL tests, screenshots at checkpoints,
 * traces, and generates an HTML report.
 */
import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:4173';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: ['risk-desk.spec.ts', 'risk-desk-w2.spec.ts'],
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report-risk-desk' }],
  ],
  outputDir: 'test-results-risk-desk',
  use: {
    baseURL,
    // Video for ALL tests (not just failures)
    video: 'on',
    // Screenshots at every step
    screenshot: 'on',
    // Full trace
    trace: 'on',
    headless: true,
    launchOptions: {
      args: [
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    },
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },
  webServer: [
    {
      command: 'cd ../phase1 && E2E_MODE=1 python3 -m uvicorn services.api.main:app --host 0.0.0.0 --port 8000 --log-level warning',
      port: 8000,
      reuseExistingServer: true,
      timeout: 30000,
    },
    {
      command: 'npx vite build && npx vite preview --port 4173 --strictPort',
      port: 4173,
      reuseExistingServer: true,
      timeout: 60000,
    },
  ],
  projects: [
    {
      name: 'risk-desk',
      use: {
        browserName: 'chromium',
        viewport: { width: 1280, height: 720 },
      },
    },
  ],
});
