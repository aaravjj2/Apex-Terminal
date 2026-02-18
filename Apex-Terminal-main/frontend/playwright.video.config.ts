import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './tests/e2e',
    timeout: 60000,
    use: {
        baseURL: 'http://localhost:5173',
        trace: 'on-first-retry',
        video: 'on', // Record video for all tests
        headless: true, // Keep headless for stability in agent env
        viewport: { width: 1280, height: 720 },
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
});
