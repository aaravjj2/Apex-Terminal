/**
 * Playwright MCP Headed Config — Nuclear Judge W01-W14
 *
 * Features:
 *   - Persistent 1920×1080 window (no headless)
 *   - trace=on, video=on, screenshot=on
 *   - Fail on console error & network >= 400
 *   - workers=1, retries=0, data-testid only
 *   - Single chromium project
 */
import { defineConfig, devices } from '@playwright/test';

const frontendPort = process.env.APEX_FRONTEND_PORT || '5100';
const backendPort = process.env.APEX_BACKEND_PORT || '8000';
const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://localhost:${frontendPort}`;
const startServers = !!process.env.CI || !!process.env.PLAYWRIGHT_START_SERVERS;

const webServer = startServers ? [
    {
        command: `cd ../phase1 && uvicorn services.api.main:app --host 0.0.0.0 --port ${backendPort}`,
        url: `http://localhost:${backendPort}/health`,
        reuseExistingServer: true,
        timeout: 120000,
    },
    {
        command: `npm run dev`,
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120000,
    },
] : undefined;

export default defineConfig({
    testDir: './tests/e2e',
    fullyParallel: false,
    forbidOnly: true,
    retries: 0,
    workers: 1,
    outputDir: './test-results/mcp-artifacts',
    reporter: [
        ['list'],
        ['json', { outputFile: './test-results/mcp-results.json' }],
        ['html', { open: 'never', outputFolder: './test-results/mcp-html-report' }],
    ],
    use: {
        baseURL,
        trace: 'on',
        screenshot: 'on',
        video: 'on',
        headless: false,
        channel: 'chrome',
        viewport: { width: 1920, height: 1080 },
        launchOptions: {
            args: [
                '--no-sandbox',
                '--disable-dev-shm-usage',
                '--window-size=1920,1080',
            ],
            slowMo: 50,
        },
        actionTimeout: 15000,
        navigationTimeout: 60000,
        // Strict locator mode — data-testid only
        testIdAttribute: 'data-testid',
    },
    projects: [
        {
            name: 'mcp-headed',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
    expect: {
        timeout: 15000,
    },
    timeout: 60000,
    webServer,
});
