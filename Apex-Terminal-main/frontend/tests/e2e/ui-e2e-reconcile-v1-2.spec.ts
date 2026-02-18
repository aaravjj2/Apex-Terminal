/**
 * UI E2E Reconciliation v1.2 - FOCUSED SUITE (No Backtest)
 * TARGET: >=18 tests passing, retries=0
 * SCOPE: Risk Desk, Strategy Lab, QuickActions, Navigation
 */

import { test, expect } from '@playwright/test';

test.describe('UI E2E v1.2', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5100');
    await page.waitForTimeout(1500);
  });

  test('01 - Options view loads', async ({ page }) => {
    await page.getByTestId('nav-item-options').click();
    await page.waitForTimeout(500);
    await expect(page.getByTestId('options-main-tab-analytics')).toBeVisible();
    await expect(page.getByTestId('options-main-tab-risk-desk')).toBeVisible();
  });

  test('02 - Tab: Analytics to Risk Desk', async ({ page }) => {
    await page.getByTestId('nav-item-options').click();
    await page.waitForTimeout(500);
    await page.getByTestId('options-main-tab-risk-desk').click();
    await page.waitForTimeout(500);
    await expect(page.getByTestId('risk-desk-panel')).toBeVisible();
  });

  test('03 - Tab: Risk Desk to Strategy Lab', async ({ page }) => {
    await page.getByTestId('nav-item-options').click();
    await page.waitForTimeout(500);
    await page.getByTestId('options-main-tab-strategy-lab').click();
    await page.waitForTimeout(500);
    await expect(page.getByTestId('strategy-lab-panel')).toBeVisible();
  });

  test('04 - Tab: Strategy Lab to Analytics', async ({ page }) => {
    await page.getByTestId('nav-item-options').click();
    await page.waitForTimeout(500);
    await page.getByTestId('options-main-tab-strategy-lab').click();
    await page.waitForTimeout(500);
    await page.getByTestId('options-main-tab-analytics').click();
    await page.waitForTimeout(500);
    await expect(page.getByTestId('options-tab-chain')).toBeVisible();
  });

  test('05 - Risk Desk: Load Demo visible', async ({ page }) => {
    await page.getByTestId('nav-item-options').click();
    await page.waitForTimeout(500);
    await page.getByTestId('options-main-tab-risk-desk').click();
    await page.waitForTimeout(500);
    await expect(page.getByTestId('load-demo-btn')).toBeVisible();
  });

  test('06 - Risk Desk: Run after Load Demo', async ({ page }) => {
    await page.getByTestId('nav-item-options').click();
    await page.waitForTimeout(500);
    await page.getByTestId('options-main-tab-risk-desk').click();
    await page.waitForTimeout(500);
    await page.getByTestId('load-demo-btn').click();
    await page.waitForTimeout(1000);
    await page.getByTestId('run-button').click();
    await page.waitForTimeout(3000);
    await expect(page.getByTestId('greeks-card')).toBeVisible();
  });

  test('07 - Risk Desk: Greeks populated', async ({ page }) => {
    await page.getByTestId('nav-item-options').click();
    await page.waitForTimeout(500);
    await page.getByTestId('options-main-tab-risk-desk').click();
    await page.waitForTimeout(500);
    await page.getByTestId('load-demo-btn').click();
    await page.waitForTimeout(1000);
    await page.getByTestId('run-button').click();
    await page.waitForTimeout(3000);
    await expect(page.getByTestId('net-delta')).toBeVisible();
  });

  test('08 - Risk Desk: Stress populated', async ({ page }) => {
    await page.getByTestId('nav-item-options').click();
    await page.waitForTimeout(500);
    await page.getByTestId('options-main-tab-risk-desk').click();
    await page.waitForTimeout(500);
    await page.getByTestId('load-demo-btn').click();
    await page.waitForTimeout(1000);
    await page.getByTestId('run-button').click();
    await page.waitForTimeout(3000);
    await expect(page.getByTestId('stress-card')).toBeVisible();
  });

  test('09 - Risk Desk: Hedge candidates populated', async ({ page }) => {
    await page.getByTestId('nav-item-options').click();
    await page.waitForTimeout(500);
    await page.getByTestId('options-main-tab-risk-desk').click();
    await page.waitForTimeout(500);
    await page.getByTestId('load-demo-btn').click();
    await page.waitForTimeout(1000);
    await page.getByTestId('run-button').click();
    await page.waitForTimeout(3000);
    await expect(page.getByTestId('hedge-candidates')).toBeVisible();
  });

  test('10 - Risk Desk: Runs subtab clickable', async ({ page }) => {
    await page.getByTestId('nav-item-options').click();
    await page.waitForTimeout(500);
    await page.getByTestId('options-main-tab-risk-desk').click();
    await page.waitForTimeout(500);
    await page.getByTestId('riskdesk-subtab-runs').click();
    await page.waitForTimeout(500);
    await expect(page.getByTestId('riskdesk-subtab-runs')).toHaveClass(/bg-brand/);
  });

  test('11 - Risk Desk: Export subtab clickable', async ({ page }) => {
    await page.getByTestId('nav-item-options').click();
    await page.waitForTimeout(500);
    await page.getByTestId('options-main-tab-risk-desk').click();
    await page.waitForTimeout(500);
    await page.getByTestId('riskdesk-subtab-export').click();
    await page.waitForTimeout(500);
    await expect(page.getByTestId('riskdesk-subtab-export')).toHaveClass(/bg-brand/);
  });

  test('12 - Strategy Lab: Builder subtab', async ({ page }) => {
    await page.getByTestId('nav-item-options').click();
    await page.waitForTimeout(500);
    await page.getByTestId('options-main-tab-strategy-lab').click();
    await page.waitForTimeout(500);
    await page.getByTestId('strategy-lab-tab-builder').click();
    await page.waitForTimeout(500);
    await expect(page.getByTestId('strategy-lab-tab-builder')).toHaveClass(/bg-brand/);
  });

  test('13 - Risk Desk: Run subtab active by default', async ({ page }) => {
    await page.getByTestId('nav-item-options').click();
    await page.waitForTimeout(500);
    await page.getByTestId('options-main-tab-risk-desk').click();
    await page.waitForTimeout(500);
    await expect(page.getByTestId('riskdesk-subtab-run')).toHaveClass(/bg-brand/);
  });

  test('14 - Strategy Lab: Validate subtab', async ({ page }) => {
    await page.getByTestId('nav-item-options').click();
    await page.waitForTimeout(500);
    await page.getByTestId('options-main-tab-strategy-lab').click();
    await page.waitForTimeout(500);
    await page.getByTestId('strategy-lab-tab-validate').click();
    await page.waitForTimeout(500);
    await expect(page.getByTestId('strategy-lab-tab-validate')).toHaveClass(/bg-brand/);
  });

  test('15 - QuickActions: Strip visible', async ({ page }) => {
    await page.getByTestId('nav-item-options').click();
    await page.waitForTimeout(500);
    await expect(page.getByTestId('quick-actions-strip')).toBeVisible();
  });

  test('16 - QuickActions: Start Demo button', async ({ page }) => {
    await page.getByTestId('nav-item-options').click();
    await page.waitForTimeout(500);
    await expect(page.getByTestId('quick-action-start-demo')).toBeVisible();
  });

  test('17 - QuickActions: Start Demo navigates', async ({ page }) => {
    await page.getByTestId('nav-item-options').click();
    await page.waitForTimeout(500);
    await page.getByTestId('quick-action-start-demo').click();
    await page.waitForTimeout(1000);
    await expect(page.getByTestId('risk-desk-panel')).toBeVisible();
  });

  test('18 - Strategy Lab: Builder subtab active by default', async ({ page }) => {
    await page.getByTestId('nav-item-options').click();
    await page.waitForTimeout(500);
    await page.getByTestId('options-main-tab-strategy-lab').click();
    await page.waitForTimeout(500);
    await expect(page.getByTestId('strategy-lab-tab-builder')).toHaveClass(/bg-brand/);
  });

  test('19 - Analytics: Tab active on load', async ({ page }) => {
    await page.getByTestId('nav-item-options').click();
    await page.waitForTimeout(500);
    await expect(page.getByTestId('options-main-tab-analytics')).toHaveClass(/bg-brand/);
  });

  test('20 - Analytics: Options Chain visible', async ({ page }) => {
    await page.getByTestId('nav-item-options').click();
    await page.waitForTimeout(500);
    await expect(page.getByTestId('options-tab-chain')).toBeVisible();
  });

});

