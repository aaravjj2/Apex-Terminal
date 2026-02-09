import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5100';
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
        headless: true,  // Run without browser window
        channel: 'chrome',  // Use installed Chrome, not Chromium
        launchOptions: {
            args: [
                '--no-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
            ],
            slowMo: 50,
        },
        actionTimeout: 15000,
        navigationTimeout: 30000,
    },
    // Reuse existing servers when running locally (they're already started)
    // In CI, start both backend and frontend
    webServer: isCI ? [
        {
            // Backend server (FastAPI)
            command: 'cd ../phase1 && source ../keys.env && uvicorn services.api.main:app --host 0.0.0.0 --port 8000',
            url: 'http://localhost:8000/health',
            reuseExistingServer: false,
            timeout: 120000,
            stdout: 'pipe',
            stderr: 'pipe',
        },
        {
            // Frontend server (Vite preview for stability)
            command: 'npm run build && npm run preview -- --port 5100',
            url: 'http://localhost:5100',
            reuseExistingServer: false,
            timeout: 120000,
            stdout: 'pipe',
            stderr: 'pipe',
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
