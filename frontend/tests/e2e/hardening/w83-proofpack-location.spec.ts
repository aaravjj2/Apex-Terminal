/**
 * W83 Proof Pack Location Guard
 * Verifies that proof packs land under artifacts/proof/ and are never served
 * from the frontend (they should not be accessible via UI).
 */
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// process.cwd() is the frontend/ dir when playwright runs; repo root is one level up
const REPO_ROOT = path.resolve(process.cwd(), '..');

test.describe('W83 Retention Policy Guard', () => {
  test('artifacts/proof: not served as static files', async ({ page }) => {
    // Vite dev server serves SPA fallback (HTML, not actual files) for any path
    // that isn't in frontend/public/. This verifies proof packs are NOT served.
    const response = await page.request.get(
      'http://localhost:5100/artifacts/proof/README.md',
      { failOnStatusCode: false }
    );
    // Either 404 (preview) or 200 with HTML fallback (dev server) — but NOT the actual readme
    const contentType = response.headers()['content-type'] || '';
    // Must NOT be markdown or plain text (which would mean we're serving the file)
    const body = await response.text();
    expect(body).not.toMatch(/^#\s+Apex Terminal.*Proof/m);
    // Should be HTML SPA fallback, not raw file content
    if (response.status() === 200) {
      expect(contentType).toContain('text/html');
    }
  });

  test('RETENTION.md exists on disk', async () => {
    const retentionPath = path.join(REPO_ROOT, 'docs', 'RETENTION.md');
    expect(fs.existsSync(retentionPath)).toBe(true);
  });

  test('clean_workspace.ps1 script exists', async () => {
    const scriptPath = path.join(REPO_ROOT, 'scripts', 'clean_workspace.ps1');
    expect(fs.existsSync(scriptPath)).toBe(true);
  });

  test('assert_no_tracked_bloat.ps1 script exists', async () => {
    const scriptPath = path.join(REPO_ROOT, 'scripts', 'assert_no_tracked_bloat.ps1');
    expect(fs.existsSync(scriptPath)).toBe(true);
  });

  test('UI2 ops page does not expose proof pack paths', async ({ page }) => {
    await page.goto('http://localhost:5100/ui2/ops');
    await expect(page.getByTestId('ops-ui2-page')).toBeVisible({ timeout: 10000 });
    // Assert no proof pack path leaked into visible page content via data attributes
    const content = await page.getByTestId('ops-ui2-page').textContent();
    expect(content || '').not.toContain('artifacts/proof');
  });
});
