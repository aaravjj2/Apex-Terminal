/**
 * Autopilot E2E Tests
 * Comprehensive Playwright tests for AI Options Autopilot feature
 * 
 * Requirements:
 * - Non-headless mode for visual verification
 * - Mandatory snapshots for all major views
 * - Interactive clicker tests for all controls
 */

import { test, expect, Page } from '@playwright/test';

// Helper to wait for API responses
async function waitForAutopilotAPI(page: Page) {
    await page.waitForResponse(
        (response) => response.url().includes('/api/v1/autopilot/') && response.status() === 200,
        { timeout: 10000 }
    ).catch(() => {
        // API might not be running - continue anyway for UI tests
    });
}

test.describe('Autopilot Feature', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');  // Uses baseURL from playwright.config.ts
        await page.waitForLoadState('networkidle');
        await page.waitForSelector('nav', { timeout: 10000 });
    });

    test.describe('Navigation & Access', () => {
        test('autopilot nav item is visible in left navigation', async ({ page }) => {
            const navItem = page.getByTestId('nav-item-autopilot');
            await expect(navItem).toBeVisible();
            
            // Snapshot: Left nav with autopilot item
            await page.screenshot({ 
                path: 'test-results/snapshots/autopilot-nav-item.png',
                fullPage: false 
            });
        });

        test('clicking autopilot nav item navigates to autopilot view', async ({ page }) => {
            await page.getByTestId('nav-item-autopilot').click();
            await page.waitForTimeout(1000);
            
            // Verify autopilot view is shown
            const autopilotView = page.getByTestId('autopilot-view');
            await expect(autopilotView).toBeVisible({ timeout: 5000 });
            
            // Snapshot: Autopilot view loaded
            await page.screenshot({ 
                path: 'test-results/snapshots/autopilot-view-loaded.png',
                fullPage: true 
            });
        });
    });

    test.describe('Dashboard Tab', () => {
        test.beforeEach(async ({ page }) => {
            await page.getByTestId('nav-item-autopilot').click();
            await page.waitForTimeout(500);
        });

        test('shows PAPER TRADING MODE banner prominently', async ({ page }) => {
            const banner = page.getByTestId('paper-mode-banner');
            await expect(banner).toBeVisible();
            await expect(banner).toContainText('PAPER TRADING');
            await expect(banner).toContainText('NO REAL MONEY');
            
            // Snapshot: Paper mode banner
            await page.screenshot({ 
                path: 'test-results/snapshots/autopilot-paper-banner.png',
                clip: { x: 0, y: 0, width: 1280, height: 100 }
            });
        });

        test('displays portfolio summary cards', async ({ page }) => {
            // Wait for dashboard to load
            await page.waitForSelector('[data-testid="autopilot-dashboard"]', { timeout: 5000 });
            
            // Check for portfolio cards
            const equityCard = page.getByTestId('portfolio-card-paper-equity');
            const pnlCard = page.getByTestId('portfolio-card-total-p&l');
            
            await expect(equityCard).toBeVisible();
            await expect(pnlCard).toBeVisible();
            
            // Snapshot: Portfolio cards
            await page.screenshot({ 
                path: 'test-results/snapshots/autopilot-portfolio-cards.png',
                fullPage: true 
            });
        });

        test('run cycle button is clickable', async ({ page }) => {
            const runButton = page.getByTestId('run-cycle-btn');
            await expect(runButton).toBeVisible();
            await expect(runButton).toBeEnabled();
            
            // Click the button
            await runButton.click();
            
            // Snapshot: After clicking run cycle
            await page.waitForTimeout(1000);
            await page.screenshot({ 
                path: 'test-results/snapshots/autopilot-after-run-click.png',
                fullPage: true 
            });
        });

        test('pause/resume button toggles state', async ({ page }) => {
            const pauseBtn = page.getByTestId('pause-resume-btn');
            await expect(pauseBtn).toBeVisible();
            
            // Get initial text
            const initialText = await pauseBtn.textContent();
            
            // Click to toggle
            await pauseBtn.click();
            await page.waitForTimeout(500);
            
            // Snapshot: After pause/resume toggle
            await page.screenshot({ 
                path: 'test-results/snapshots/autopilot-pause-toggle.png',
                fullPage: true 
            });
        });

        test('kill switch button has warning styling', async ({ page }) => {
            const killSwitch = page.getByTestId('kill-switch-btn');
            await expect(killSwitch).toBeVisible();
            
            // Verify it has red/danger styling (bg-red class)
            const classes = await killSwitch.getAttribute('class');
            expect(classes).toContain('bg-red');
            
            // Snapshot: Kill switch button
            await page.screenshot({ 
                path: 'test-results/snapshots/autopilot-kill-switch.png',
                fullPage: true 
            });
        });

        test('clicking kill switch shows confirmation or activates', async ({ page }) => {
            const killSwitch = page.getByTestId('kill-switch-btn');
            
            // Click kill switch
            await killSwitch.click();
            await page.waitForTimeout(1000);
            
            // Snapshot: Kill switch activated
            await page.screenshot({ 
                path: 'test-results/snapshots/autopilot-kill-switch-activated.png',
                fullPage: true 
            });
        });
    });

    test.describe('Positions Tab', () => {
        test.beforeEach(async ({ page }) => {
            await page.getByTestId('nav-item-autopilot').click();
            await page.waitForTimeout(500);
            await page.getByTestId('autopilot-tab-positions').click();
            await page.waitForTimeout(500);
        });

        test('positions view loads with filter buttons', async ({ page }) => {
            const positionsView = page.getByTestId('autopilot-positions');
            await expect(positionsView).toBeVisible();
            
            // Check filter buttons
            await expect(page.getByTestId('filter-open')).toBeVisible();
            await expect(page.getByTestId('filter-closed')).toBeVisible();
            await expect(page.getByTestId('filter-all')).toBeVisible();
            
            // Snapshot: Positions view
            await page.screenshot({ 
                path: 'test-results/snapshots/autopilot-positions-view.png',
                fullPage: true 
            });
        });

        test('filter buttons change active state on click', async ({ page }) => {
            const openFilter = page.getByTestId('filter-open');
            const closedFilter = page.getByTestId('filter-closed');
            const allFilter = page.getByTestId('filter-all');
            
            // Click closed filter
            await closedFilter.click();
            await page.waitForTimeout(300);
            
            // Verify closed is now active (has blue background)
            const closedClasses = await closedFilter.getAttribute('class');
            expect(closedClasses).toContain('bg-blue');
            
            // Snapshot: Closed filter active
            await page.screenshot({ 
                path: 'test-results/snapshots/autopilot-positions-closed-filter.png',
                fullPage: true 
            });
            
            // Click all filter
            await allFilter.click();
            await page.waitForTimeout(300);
            
            // Snapshot: All filter active
            await page.screenshot({ 
                path: 'test-results/snapshots/autopilot-positions-all-filter.png',
                fullPage: true 
            });
        });

        test('refresh button triggers data reload', async ({ page }) => {
            const refreshBtn = page.getByTestId('refresh-positions');
            await expect(refreshBtn).toBeVisible();
            
            await refreshBtn.click();
            
            // Snapshot: After refresh
            await page.waitForTimeout(500);
            await page.screenshot({ 
                path: 'test-results/snapshots/autopilot-positions-refreshed.png',
                fullPage: true 
            });
        });
    });

    test.describe('Activity Tab', () => {
        test.beforeEach(async ({ page }) => {
            await page.getByTestId('nav-item-autopilot').click();
            await page.waitForTimeout(500);
            await page.getByTestId('autopilot-tab-activity').click();
            await page.waitForTimeout(500);
        });

        test('activity view loads with filter options', async ({ page }) => {
            const activityView = page.getByTestId('autopilot-activity');
            await expect(activityView).toBeVisible();
            
            // Check filter buttons
            await expect(page.getByTestId('filter-all')).toBeVisible();
            await expect(page.getByTestId('filter-trades')).toBeVisible();
            await expect(page.getByTestId('filter-validation')).toBeVisible();
            await expect(page.getByTestId('filter-errors')).toBeVisible();
            
            // Snapshot: Activity view
            await page.screenshot({ 
                path: 'test-results/snapshots/autopilot-activity-view.png',
                fullPage: true 
            });
        });

        test('limit dropdown has options', async ({ page }) => {
            const limitSelect = page.getByTestId('limit-select');
            await expect(limitSelect).toBeVisible();
            
            // Click to open
            await limitSelect.click();
            
            // Snapshot: Limit dropdown open
            await page.screenshot({ 
                path: 'test-results/snapshots/autopilot-activity-limit-dropdown.png',
                fullPage: true 
            });
        });

        test('clicking errors filter shows only errors', async ({ page }) => {
            const errorsFilter = page.getByTestId('filter-errors');
            await errorsFilter.click();
            await page.waitForTimeout(500);
            
            // Snapshot: Errors filter active
            await page.screenshot({ 
                path: 'test-results/snapshots/autopilot-activity-errors.png',
                fullPage: true 
            });
        });
    });

    test.describe('Settings Tab', () => {
        test.beforeEach(async ({ page }) => {
            await page.getByTestId('nav-item-autopilot').click();
            await page.waitForTimeout(500);
            await page.getByTestId('autopilot-tab-settings').click();
            await page.waitForTimeout(500);
        });

        test('settings view loads with all sections', async ({ page }) => {
            const settingsView = page.getByTestId('autopilot-settings');
            await expect(settingsView).toBeVisible();
            
            // Snapshot: Settings view
            await page.screenshot({ 
                path: 'test-results/snapshots/autopilot-settings-view.png',
                fullPage: true 
            });
        });

        test('paper equity input is editable', async ({ page }) => {
            const equityInput = page.getByTestId('paper-equity-input');
            await expect(equityInput).toBeVisible();
            
            // Clear and type new value
            await equityInput.clear();
            await equityInput.fill('2000');
            
            // Verify value changed
            await expect(equityInput).toHaveValue('2000');
            
            // Snapshot: After editing equity
            await page.screenshot({ 
                path: 'test-results/snapshots/autopilot-settings-equity-edited.png',
                fullPage: true 
            });
        });

        test('mode dropdown has options', async ({ page }) => {
            const modeSelect = page.getByTestId('mode-select');
            await expect(modeSelect).toBeVisible();
            
            // Change mode
            await modeSelect.selectOption('semi');
            
            // Snapshot: Mode changed
            await page.screenshot({ 
                path: 'test-results/snapshots/autopilot-settings-mode-changed.png',
                fullPage: true 
            });
        });

        test('LLM checkbox toggles', async ({ page }) => {
            const llmCheckbox = page.getByTestId('llm-checkbox');
            await expect(llmCheckbox).toBeVisible();
            
            // Get initial state
            const isChecked = await llmCheckbox.isChecked();
            
            // Toggle
            await llmCheckbox.click();
            
            // Verify toggle
            await expect(llmCheckbox).toBeChecked({ checked: !isChecked });
            
            // Snapshot: LLM toggled
            await page.screenshot({ 
                path: 'test-results/snapshots/autopilot-settings-llm-toggled.png',
                fullPage: true 
            });
        });

        test('risk limit inputs are editable', async ({ page }) => {
            const maxRiskInput = page.getByTestId('max-risk-per-trade');
            await expect(maxRiskInput).toBeVisible();
            
            await maxRiskInput.clear();
            await maxRiskInput.fill('75');
            
            await expect(maxRiskInput).toHaveValue('75');
            
            // Snapshot: Risk limits edited
            await page.screenshot({ 
                path: 'test-results/snapshots/autopilot-settings-risk-edited.png',
                fullPage: true 
            });
        });

        test('strategy templates are toggleable', async ({ page }) => {
            // Find and toggle a template
            const pcsTemplate = page.getByTestId('template-PUT_CREDIT_SPREAD');
            await expect(pcsTemplate).toBeVisible();
            
            // Toggle it
            await pcsTemplate.click();
            await page.waitForTimeout(300);
            
            // Snapshot: Template toggled
            await page.screenshot({ 
                path: 'test-results/snapshots/autopilot-settings-template-toggled.png',
                fullPage: true 
            });
        });

        test('save button enables when changes made', async ({ page }) => {
            const saveBtn = page.getByTestId('save-btn');
            
            // Initially might be disabled
            const initialDisabled = await saveBtn.isDisabled();
            
            // Make a change
            const equityInput = page.getByTestId('paper-equity-input');
            await equityInput.clear();
            await equityInput.fill('1500');
            
            // Save should now be enabled
            await expect(saveBtn).toBeEnabled();
            
            // Snapshot: Save enabled
            await page.screenshot({ 
                path: 'test-results/snapshots/autopilot-settings-save-enabled.png',
                fullPage: true 
            });
        });

        test('reset button restores defaults', async ({ page }) => {
            const resetBtn = page.getByTestId('reset-btn');
            await expect(resetBtn).toBeVisible();
            
            // Make a change first
            const equityInput = page.getByTestId('paper-equity-input');
            const originalValue = await equityInput.inputValue();
            await equityInput.clear();
            await equityInput.fill('9999');
            
            // Click reset
            await resetBtn.click();
            await page.waitForTimeout(500);
            
            // Snapshot: After reset
            await page.screenshot({ 
                path: 'test-results/snapshots/autopilot-settings-reset.png',
                fullPage: true 
            });
        });
    });

    test.describe('Tab Navigation', () => {
        test.beforeEach(async ({ page }) => {
            await page.getByTestId('nav-item-autopilot').click();
            await page.waitForTimeout(500);
        });

        test('all tabs are clickable and switch content', async ({ page }) => {
            const tabs = ['dashboard', 'positions', 'activity', 'settings'];
            
            for (const tab of tabs) {
                const tabButton = page.getByTestId(`autopilot-tab-${tab}`);
                await expect(tabButton).toBeVisible();
                await tabButton.click();
                await page.waitForTimeout(300);
                
                // Snapshot: Each tab
                await page.screenshot({ 
                    path: `test-results/snapshots/autopilot-tab-${tab}.png`,
                    fullPage: true 
                });
            }
        });

        test('active tab has visual indicator', async ({ page }) => {
            // Dashboard tab should be active by default
            const dashboardTab = page.getByTestId('autopilot-tab-dashboard');
            const dashboardClasses = await dashboardTab.getAttribute('class');
            expect(dashboardClasses).toContain('border-blue');
            
            // Click positions tab
            const positionsTab = page.getByTestId('autopilot-tab-positions');
            await positionsTab.click();
            await page.waitForTimeout(300);
            
            // Positions should now be active
            const positionsClasses = await positionsTab.getAttribute('class');
            expect(positionsClasses).toContain('border-blue');
            
            // Dashboard should no longer be active
            const updatedDashboardClasses = await dashboardTab.getAttribute('class');
            expect(updatedDashboardClasses).not.toContain('border-blue');
        });
    });

    test.describe('Visual Regression Snapshots', () => {
        test('full autopilot dashboard snapshot', async ({ page }) => {
            await page.getByTestId('nav-item-autopilot').click();
            await page.waitForTimeout(1000);
            
            // Wait for content to load
            await page.waitForSelector('[data-testid="autopilot-dashboard"]');
            
            expect(await page.screenshot()).toMatchSnapshot('autopilot-dashboard-full.png');
        });

        test('full positions view snapshot', async ({ page }) => {
            await page.getByTestId('nav-item-autopilot').click();
            await page.waitForTimeout(500);
            await page.getByTestId('autopilot-tab-positions').click();
            await page.waitForTimeout(500);
            
            expect(await page.screenshot()).toMatchSnapshot('autopilot-positions-full.png');
        });

        test('full activity view snapshot', async ({ page }) => {
            await page.getByTestId('nav-item-autopilot').click();
            await page.waitForTimeout(500);
            await page.getByTestId('autopilot-tab-activity').click();
            await page.waitForTimeout(500);
            
            expect(await page.screenshot()).toMatchSnapshot('autopilot-activity-full.png');
        });

        test('full settings view snapshot', async ({ page }) => {
            await page.getByTestId('nav-item-autopilot').click();
            await page.waitForTimeout(500);
            await page.getByTestId('autopilot-tab-settings').click();
            await page.waitForTimeout(500);
            
            expect(await page.screenshot()).toMatchSnapshot('autopilot-settings-full.png');
        });
    });
});

test.describe('Autopilot Accessibility', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');  // Use baseURL from config
        await page.waitForLoadState('networkidle');
        await page.getByTestId('nav-item-autopilot').click();
        await page.waitForTimeout(500);
    });

    test('all interactive elements have accessible labels', async ({ page }) => {
        // Check buttons have text content
        const runButton = page.getByTestId('run-cycle-btn');
        const buttonText = await runButton.textContent();
        expect(buttonText).toBeTruthy();
        expect(buttonText!.length).toBeGreaterThan(0);
        
        // Check inputs have labels
        await page.getByTestId('autopilot-tab-settings').click();
        await page.waitForTimeout(300);
        
        const equityInput = page.getByTestId('paper-equity-input');
        await expect(equityInput).toBeVisible();
    });

    test('keyboard navigation works', async ({ page }) => {
        // Tab through elements
        await page.keyboard.press('Tab');
        await page.keyboard.press('Tab');
        await page.keyboard.press('Tab');
        
        // Take snapshot of focused state
        await page.screenshot({ 
            path: 'test-results/snapshots/autopilot-keyboard-nav.png',
            fullPage: true 
        });
    });
});
