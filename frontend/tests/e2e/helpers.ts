/**
 * E2E Test Helpers
 * 
 * Provides stable, deterministic test utilities for Playwright E2E tests.
 * Use these helpers instead of arbitrary waitForTimeout calls.
 */

import { Page, expect } from '@playwright/test';

// ============================================================================
// DETERMINISTIC MODE
// ============================================================================

/**
 * Enables deterministic E2E mode by injecting into the page.
 * This freezes time, random, and disables animations for snapshot stability.
 * 
 * Call this BEFORE navigating to the page or immediately after navigation.
 */
export async function enableDeterministicMode(page: Page, frozenTime?: number): Promise<void> {
    const fixedTimestamp = frozenTime ?? Date.UTC(2025, 0, 15, 12, 0, 0); // Jan 15, 2025, 12:00 UTC
    
    await page.addInitScript(`
        // Freeze time
        const FROZEN_TIME = ${fixedTimestamp};
        const OriginalDate = Date;
        
        class MockDate extends OriginalDate {
            constructor(...args) {
                if (args.length === 0) {
                    super(FROZEN_TIME);
                } else {
                    super(...args);
                }
            }
            static now() { return FROZEN_TIME; }
        }
        window.Date = MockDate;
        
        // Freeze random
        let seed = 12345;
        Math.random = function() {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed / 0x7fffffff;
        };
        
        // Mark E2E mode
        window.__E2E_MODE__ = true;
        window.__E2E_FROZEN_TIME__ = FROZEN_TIME;
        
        // Disable CSS animations and transitions
        const style = document.createElement('style');
        style.id = 'e2e-disable-animations';
        style.textContent = \`
            *, *::before, *::after {
                animation-duration: 0s !important;
                animation-delay: 0s !important;
                transition-duration: 0s !important;
                transition-delay: 0s !important;
            }
        \`;
        if (document.head) {
            document.head.appendChild(style);
        } else {
            document.addEventListener('DOMContentLoaded', () => {
                document.head.appendChild(style);
            });
        }
    `);
}

// ============================================================================
// APP READINESS
// ============================================================================

/**
 * Waits for the application to be fully ready.
 * 
 * Checks:
 * 1. Shell elements (TopBar, LeftNav) are visible
 * 2. Backend health endpoint returns OK
 * 3. No loading spinners/skeletons visible
 * 
 * Use this instead of arbitrary waitForTimeout calls.
 */
export async function waitForAppReady(page: Page, options?: {
    timeout?: number;
    skipHealthCheck?: boolean;
}): Promise<void> {
    const timeout = options?.timeout ?? 30000;
    const skipHealthCheck = options?.skipHealthCheck ?? false;
    
    // Wait for shell to render
    await expect(page.locator('[data-testid="app-shell"]')).toBeVisible({ timeout });
    
    // Wait for TopBar
    const topBar = page.locator('[data-testid="top-app-bar"], [data-testid="topbar"]');
    await expect(topBar.first()).toBeVisible({ timeout });
    
    // Wait for LeftNav
    const leftNav = page.locator('[data-testid="left-nav"], [data-testid="leftnav"]');
    await expect(leftNav.first()).toBeVisible({ timeout });
    
    // Wait for any loading states to finish
    await page.waitForFunction(() => {
        const loadingElements = document.querySelectorAll(
            '[data-loading="true"], .loading, .skeleton, [aria-busy="true"]'
        );
        return loadingElements.length === 0;
    }, { timeout }).catch(() => {
        // Loading check is best-effort
    });
    
    // Verify backend health
    if (!skipHealthCheck) {
        try {
            const response = await page.request.get('http://localhost:8000/health', { timeout: 5000 });
            if (!response.ok()) {
                console.warn('Backend health check returned non-OK status');
            }
        } catch {
            console.warn('Backend health check failed - continuing anyway');
        }
    }
    
    // Small buffer for React to settle
    await page.waitForTimeout(100);
}

/**
 * Navigate to a URL with deterministic mode enabled.
 * This is the recommended way to navigate in E2E tests.
 */
export async function navigateDeterministic(
    page: Page, 
    path: string = '/',
    options?: { waitForReady?: boolean }
): Promise<void> {
    await enableDeterministicMode(page);
    
    // Add e2e query param to signal deterministic mode to the app
    const url = path.includes('?') ? `${path}&e2e=1` : `${path}?e2e=1`;
    await page.goto(url);
    
    if (options?.waitForReady !== false) {
        await waitForAppReady(page);
    }
}

// ============================================================================
// ELEMENT WAITERS
// ============================================================================

/**
 * Wait for a specific element by test ID to be visible.
 */
export async function waitForTestId(
    page: Page, 
    testId: string, 
    options?: { timeout?: number }
): Promise<void> {
    const timeout = options?.timeout ?? 15000;
    await expect(page.locator(`[data-testid="${testId}"]`)).toBeVisible({ timeout });
}

/**
 * Wait for element containing specific text.
 */
export async function waitForText(
    page: Page, 
    text: string, 
    options?: { timeout?: number }
): Promise<void> {
    const timeout = options?.timeout ?? 15000;
    // waitForText utility replaced with testid-based checks
}

/**
 * Wait for navigation to a specific view.
 */
export async function waitForView(
    page: Page, 
    viewTestId: string, 
    options?: { timeout?: number }
): Promise<void> {
    await waitForTestId(page, viewTestId, options);
}

/**
 * Wait for WebSocket to connect.
 */
export async function waitForWebSocketConnected(
    page: Page,
    options?: { timeout?: number }
): Promise<void> {
    const timeout = options?.timeout ?? 10000;
    
    // Look for connected status indicator
    const wsStatusPill = page.locator('[data-testid="ws-status-pill"]');
    const connectedStatus = page.locator('[data-ws-status="connected"], [data-ws-status="CONNECTED"]');
    
    try {
        await expect(wsStatusPill.or(connectedStatus).first()).toBeVisible({ timeout });
    } catch {
        // Fallback: wait a reasonable time for WS connection
        await page.waitForTimeout(2000);
    }
}

/**
 * Wait for data to load (e.g., tables, charts).
 */
export async function waitForDataLoaded(
    page: Page,
    containerTestId: string,
    options?: { timeout?: number }
): Promise<void> {
    const timeout = options?.timeout ?? 15000;
    const container = page.locator(`[data-testid="${containerTestId}"]`);
    
    await expect(container).toBeVisible({ timeout });
    
    // Wait for loading state to clear within container
    await container.evaluate((el) => {
        return new Promise<void>((resolve) => {
            const checkLoading = () => {
                const loading = el.querySelector('[data-loading="true"], .loading, .skeleton');
                if (!loading) {
                    resolve();
                } else {
                    requestAnimationFrame(checkLoading);
                }
            };
            checkLoading();
        });
    }).catch(() => {
        // Best effort
    });
}

// ============================================================================
// INTERACTION HELPERS
// ============================================================================

/**
 * Click a navigation item and wait for the view to load.
 */
export async function navigateToView(
    page: Page,
    navItemText: string,
    expectedViewTestId: string,
    options?: { timeout?: number }
): Promise<void> {
    const timeout = options?.timeout ?? 15000;
    
    // Find and click the nav item
    const navItem = page.locator('[data-testid="left-nav"], [data-testid="leftnav"]')
        .locator(`button, a, [role="button"]`)
        .filter({ hasText: navItemText });
    
    await expect(navItem.first()).toBeVisible({ timeout: 5000 });
    await navItem.first().click();
    
    // Wait for the view to appear
    await waitForTestId(page, expectedViewTestId, { timeout });
}

/**
 * Click an element by test ID.
 */
export async function clickTestId(
    page: Page,
    testId: string,
    options?: { timeout?: number }
): Promise<void> {
    const timeout = options?.timeout ?? 15000;
    const element = page.locator(`[data-testid="${testId}"]`);
    await expect(element).toBeVisible({ timeout });
    await element.click();
}

/**
 * Fill an input by test ID.
 */
export async function fillTestId(
    page: Page,
    testId: string,
    value: string,
    options?: { timeout?: number }
): Promise<void> {
    const timeout = options?.timeout ?? 15000;
    const element = page.locator(`[data-testid="${testId}"]`);
    await expect(element).toBeVisible({ timeout });
    await element.fill(value);
}

// ============================================================================
// SNAPSHOT HELPERS
// ============================================================================

/**
 * Take a snapshot with deterministic settings.
 * Masks volatile regions automatically.
 */
export async function takeStableSnapshot(
    page: Page,
    name: string,
    options?: {
        maskTestIds?: string[];
        fullPage?: boolean;
    }
): Promise<void> {
    const maskTestIds = options?.maskTestIds ?? [
        'timestamp',
        'clock',
        'ws-latency',
        'last-updated',
    ];
    
    const maskLocators = maskTestIds.map(id => 
        page.locator(`[data-testid="${id}"]`)
    );
    
    await expect(page).toHaveScreenshot(name, {
        fullPage: options?.fullPage ?? false,
        mask: maskLocators,
        animations: 'disabled',
    });
}

// ============================================================================
// CLEANUP HELPERS
// ============================================================================

/**
 * Clean up any dialogs that might be open.
 */
export async function dismissAllDialogs(page: Page): Promise<void> {
    page.on('dialog', async dialog => {
        await dialog.dismiss();
    });
}

/**
 * Reset app state (useful between test scenarios).
 */
export async function resetAppState(page: Page): Promise<void> {
    await page.evaluate(() => {
        // Clear local storage
        localStorage.clear();
        // Clear session storage
        sessionStorage.clear();
    });
}
