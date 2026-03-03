import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  retries: 0, workers: 4, reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5100',
    headless: true,
    actionTimeout: 15000,
    navigationTimeout: 45000,
  },
});
