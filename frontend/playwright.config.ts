import { defineConfig, devices } from '@playwright/test';

// Single source of truth for port configuration
const backendPort = process.env.APEX_BACKEND_PORT || '8010';
const frontendPort = process.env.APEX_FRONTEND_PORT || '5100';
const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://localhost:${frontendPort}`;
const isCI = !!process.env.CI;

export default defineConfig({
    testDir: './tests/e2e',
    fullyParallel: false,  // Sequential for stability during stabilization
    forbidOnly: isCI,
    retries: 0,  // No retries - fix real issues, don't mask them
    workers: 1,  // Single worker for stable tests
    reporter: [
        ['list'],
        ['html', { open: 'never' }],
    ],
    use: {
        baseURL,
        trace: 'on',  // Capture trace for ALL tests (required for Week 3 proof pack)
        screenshot: 'on',
        video: 'on',  // Capture video for ALL tests (required for Week 3 proof pack)
        headless: isCI,  // Headless in CI; headed locally for debugging
        ...(isCI ? {} : { channel: 'chrome' as const }),
        launchOptions: {
            args: [
                '--no-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
            ],
            ...(isCI ? {} : { slowMo: 50 }),
        },
        actionTimeout: 15000,
        navigationTimeout: 60000,
    },
    // Reuse existing servers when running locally (they're already started)
    // In CI, start both backend and frontend
    webServer: isCI ? [
        {
            // Backend server (FastAPI) — mock credentials only; never load keys.env in CI
            command: `cd ../phase1 && PROFILE=dev DATABASE_URL=sqlite+aiosqlite:///../phase1/data/apex-ci.db TRADING_ENV=paper PAPER_DRY_RUN=true ALPACA3_KEY=test_key_for_ci ALPACA3_SECRET=test_secret_for_ci APCA_API_KEY_ID=test_key_for_ci APCA_API_SECRET_KEY=test_secret_for_ci python -m uvicorn services.api.main:app --host 0.0.0.0 --port ${backendPort}`,
            url: `http://localhost:${backendPort}/health`,
            reuseExistingServer: false,
            timeout: 180000,
            stdout: 'pipe',
            stderr: 'pipe',
            env: {
                PROFILE: 'dev',
                ALPACA3_KEY: 'test_key_for_ci',
                ALPACA3_SECRET: 'test_secret_for_ci',
                APCA_API_KEY_ID: 'test_key_for_ci',
                APCA_API_SECRET_KEY: 'test_secret_for_ci',
                APEX_BACKEND_PORT: backendPort,
                DATABASE_URL: 'sqlite+aiosqlite:///../phase1/data/apex-ci.db',
                TRADING_ENV: 'paper',
                PAPER_DRY_RUN: 'true',
            },
        },
        {
            // Frontend server (Vite preview for stability)
            command: `npm run build && npm run preview -- --port ${frontendPort}`,
            url: `http://localhost:${frontendPort}`,
            reuseExistingServer: false,
            timeout: 180000,
            stdout: 'pipe',
            stderr: 'pipe',
            env: {
                APEX_BACKEND_PORT: backendPort,
                VITE_HITL_DRY_RUN: 'true',
                VITE_PIPELINE_JOB_ID: 'dry-run-apex-command-center',
            },
        },
    ] : undefined,  // Local: no webServer - assume servers are already running
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
    snapshotDir: './tests/e2e/__snapshots__',
    expect: {
        timeout: 15000,
        toHaveScreenshot: {
            maxDiffPixelRatio: 0.05,
            threshold: 0.2,
        },
    },
    timeout: 60000,
});
