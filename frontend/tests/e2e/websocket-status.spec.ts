import { test, expect } from '@playwright/test';

test('AIPanel shows WebSocket Status section', async ({ page }) => {
    // Go to app root
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Navigate to Dashboard where AIPanel is rendered
    await page.getByTestId('nav-item-dashboard').click();
    await page.waitForTimeout(500);

    // Ensure the AIPanel is visible
    const aiPanel = page.getByTestId('ai-panel');
    await expect(aiPanel).toBeVisible({ timeout: 10000 });

    // Click Alerts tab inside the Autopilot view
    await page.getByTestId('ai-tab-alerts').click();
    await page.waitForTimeout(500);

    // Verify the WebSocket Status label is present
    await expect(aiPanel.getByTestId('ws-status-label')).toBeVisible();

    // Verify a status is shown - could be connected, disconnected, or polling
    // depending on whether the backend is running
    // Use .first() since ws-status-pill also shows connection status
    const statusBadge = aiPanel.getByTestId('ws-status-indicator');
    await expect(statusBadge).toBeVisible();

    // Take a screenshot for manual verification
    await page.screenshot({ path: 'test-results/snapshots/websocket-status.png', fullPage: false });
});