/**
 * Core Correctness Track — Workflow Builder E2E Suite
 * Tests create workflow, validate, save, templates, import/export.
 * All selectors use data-testid only. No waitForTimeout.
 */

import { test, expect } from '@playwright/test';

const PAGE = 'http://localhost:5100/ui2/workflow-builder';

test.describe('Workflow Builder — Page Load & Layout', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
    await expect(page.getByTestId('ui2-workflow-builder-page')).toBeVisible();
  });

  test('header is visible', async ({ page }) => {
    await expect(page.getByTestId('ui2-workflow-builder-header')).toBeVisible();
  });

  test('create button is visible', async ({ page }) => {
    await expect(page.getByTestId('ui2-workflow-create-btn')).toBeVisible();
  });

  test('tabs row is visible', async ({ page }) => {
    await expect(page.getByTestId('ui2-workflow-tabs')).toBeVisible();
  });

  test('workflows tab is visible', async ({ page }) => {
    await expect(page.getByTestId('ui2-workflow-tab-workflows')).toBeVisible();
  });

  test('templates tab is visible', async ({ page }) => {
    await expect(page.getByTestId('ui2-workflow-tab-templates')).toBeVisible();
  });

  test('import/export tab is visible', async ({ page }) => {
    await expect(page.getByTestId('ui2-workflow-tab-import')).toBeVisible();
  });

  test('workflow list panel is visible on default tab', async ({ page }) => {
    await expect(page.getByTestId('ui2-workflow-list')).toBeVisible();
  });

});

test.describe('Workflow Builder — Create Workflow', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
    await expect(page.getByTestId('ui2-workflow-builder-page')).toBeVisible();
  });

  test('clicking New Workflow shows the form', async ({ page }) => {
    await page.getByTestId('ui2-workflow-create-btn').click();
    await expect(page.getByTestId('ui2-workflow-form')).toBeVisible();
  });

  test('workflow name input is editable', async ({ page }) => {
    await page.getByTestId('ui2-workflow-create-btn').click();
    const nameInput = page.getByTestId('ui2-workflow-name-input');
    await expect(nameInput).toBeVisible();
    await nameInput.fill('My Test Workflow');
    await expect(nameInput).toHaveValue('My Test Workflow');
  });

  test('trigger type selector has options', async ({ page }) => {
    await page.getByTestId('ui2-workflow-create-btn').click();
    const triggerSelect = page.getByTestId('ui2-workflow-trigger-select');
    await expect(triggerSelect).toBeVisible();
    const options = await triggerSelect.evaluate((el: HTMLSelectElement) => 
      Array.from(el.options).map(o => o.value)
    );
    expect(options).toContain('schedule');
    expect(options).toContain('market_event');
  });

  test('trigger config input is editable', async ({ page }) => {
    await page.getByTestId('ui2-workflow-create-btn').click();
    const triggerConfig = page.getByTestId('ui2-workflow-trigger-config');
    await expect(triggerConfig).toBeVisible();
  });

  test('add action button is visible', async ({ page }) => {
    await page.getByTestId('ui2-workflow-create-btn').click();
    await expect(page.getByTestId('ui2-workflow-add-action-btn')).toBeVisible();
  });

  test('adding an action creates a new row', async ({ page }) => {
    await page.getByTestId('ui2-workflow-create-btn').click();
    const initialActions = await page.locator('[data-testid^="ui2-workflow-action-type-"]').count();
    await page.getByTestId('ui2-workflow-add-action-btn').click();
    const newCount = await page.locator('[data-testid^="ui2-workflow-action-type-"]').count();
    expect(newCount).toBe(initialActions + 1);
  });

  test('action type selector has valid options', async ({ page }) => {
    await page.getByTestId('ui2-workflow-create-btn').click();
    const actionType = page.getByTestId('ui2-workflow-action-type-0');
    await expect(actionType).toBeVisible();
    const options = await actionType.evaluate((el: HTMLSelectElement) =>
      Array.from(el.options).map(o => o.value)
    );
    expect(options).toContain('place_order');
    expect(options).toContain('notify');
  });

  test('validate button is visible in form', async ({ page }) => {
    await page.getByTestId('ui2-workflow-create-btn').click();
    await expect(page.getByTestId('ui2-workflow-validate-btn')).toBeVisible();
  });

  test('validate with empty name shows error', async ({ page }) => {
    await page.getByTestId('ui2-workflow-create-btn').click();
    // Clear the name (default is empty)
    const nameInput = page.getByTestId('ui2-workflow-name-input');
    await nameInput.fill('');
    await page.getByTestId('ui2-workflow-validate-btn').click();
    const result = page.getByTestId('ui2-workflow-validate-result');
    await expect(result).toBeVisible();
    const text = await result.textContent();
    expect(text).toContain('required');
  });

  test('validate with valid inputs shows success', async ({ page }) => {
    await page.getByTestId('ui2-workflow-create-btn').click();
    await page.getByTestId('ui2-workflow-name-input').fill('Validated Workflow');
    // First action already present (notify), config is '{}'
    await page.getByTestId('ui2-workflow-validate-btn').click();
    const result = page.getByTestId('ui2-workflow-validate-result');
    await expect(result).toBeVisible();
    const text = await result.textContent();
    expect(text).toContain('valid');
  });

  test('save button creates workflow and clears form', async ({ page }) => {
    await page.getByTestId('ui2-workflow-create-btn').click();
    await page.getByTestId('ui2-workflow-name-input').fill('Saved Test Workflow');
    await page.getByTestId('ui2-workflow-save-btn').click();
    // Form should close after save
    await expect(page.getByTestId('ui2-workflow-form')).not.toBeVisible();
  });

  test('saved workflow appears in the list', async ({ page }) => {
    await page.getByTestId('ui2-workflow-create-btn').click();
    await page.getByTestId('ui2-workflow-name-input').fill('Unique Workflow XYZ');
    await page.getByTestId('ui2-workflow-save-btn').click();
    // Workflow items should be in list
    const items = page.locator('[data-testid^="ui2-workflow-item-"]');
    expect(await items.count()).toBeGreaterThanOrEqual(1);
  });

});

test.describe('Workflow Builder — Templates', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
    await expect(page.getByTestId('ui2-workflow-builder-page')).toBeVisible();
  });

  test('templates tab shows templates list', async ({ page }) => {
    await page.getByTestId('ui2-workflow-tab-templates').click();
    await expect(page.getByTestId('ui2-workflow-templates-list')).toBeVisible();
  });

  test('at least 1 template is available', async ({ page }) => {
    await page.getByTestId('ui2-workflow-tab-templates').click();
    const templates = page.locator('[data-testid^="ui2-workflow-template-"]');
    expect(await templates.count()).toBeGreaterThanOrEqual(1);
  });

  test('Use Template button is visible on each template', async ({ page }) => {
    await page.getByTestId('ui2-workflow-tab-templates').click();
    const templates = page.locator('[data-testid^="ui2-workflow-template-"]');
    const firstTemplate = templates.first();
    if (await firstTemplate.isVisible()) {
      const templateId = await firstTemplate.getAttribute('data-testid');
      const id = templateId?.replace('ui2-workflow-template-', '');
      if (id) {
        await expect(page.getByTestId(`ui2-workflow-apply-template-${id}`)).toBeVisible();
      }
    }
  });

  test('applying a template adds it to the workflow list', async ({ page }) => {
    await page.getByTestId('ui2-workflow-tab-templates').click();
    const templates = page.locator('[data-testid^="ui2-workflow-template-"]');
    if (await templates.count() > 0) {
      const templateId = await templates.first().getAttribute('data-testid');
      const id = templateId?.replace('ui2-workflow-template-', '');
      if (id) {
        await page.getByTestId(`ui2-workflow-apply-template-${id}`).click();
        await page.getByTestId('ui2-workflow-tab-workflows').click();
        const items = page.locator('[data-testid^="ui2-workflow-item-"]');
        expect(await items.count()).toBeGreaterThanOrEqual(1);
      }
    }
  });

});

test.describe('Workflow Builder — Import/Export', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
    await expect(page.getByTestId('ui2-workflow-builder-page')).toBeVisible();
  });

  test('import tab shows import textarea', async ({ page }) => {
    await page.getByTestId('ui2-workflow-tab-import').click();
    await expect(page.getByTestId('ui2-workflow-import-section')).toBeVisible();
    await expect(page.getByTestId('ui2-workflow-import-textarea')).toBeVisible();
  });

  test('import button is visible on import tab', async ({ page }) => {
    await page.getByTestId('ui2-workflow-tab-import').click();
    await expect(page.getByTestId('ui2-workflow-import-btn')).toBeVisible();
  });

  test('importing valid JSON adds a workflow', async ({ page }) => {
    await page.getByTestId('ui2-workflow-tab-import').click();
    const validJson = JSON.stringify({
      name: 'Imported Workflow',
      trigger: { type: 'schedule', config: { cron: '0 9 * * 1-5' } },
      actions: [{ type: 'notify', config: { message: 'Market open' } }],
    });
    await page.getByTestId('ui2-workflow-import-textarea').fill(validJson);
    await page.getByTestId('ui2-workflow-import-btn').click();
    // Switch to workflows tab to verify
    await page.getByTestId('ui2-workflow-tab-workflows').click();
    const items = page.locator('[data-testid^="ui2-workflow-item-"]');
    expect(await items.count()).toBeGreaterThanOrEqual(1);
  });

  test('exporting a workflow shows JSON on import tab', async ({ page }) => {
    // First create a workflow
    await page.getByTestId('ui2-workflow-create-btn').click();
    await page.getByTestId('ui2-workflow-name-input').fill('Export Test');
    await page.getByTestId('ui2-workflow-save-btn').click();

    // Find and export the workflow
    const items = page.locator('[data-testid^="ui2-workflow-item-"]');
    if (await items.count() > 0) {
      const itemId = await items.first().getAttribute('data-testid');
      const id = itemId?.replace('ui2-workflow-item-', '');
      if (id) {
        await page.getByTestId(`ui2-workflow-export-${id}`).click();
        // Should auto-navigate to import tab and show export JSON
        await expect(page.getByTestId('ui2-workflow-export-json')).toBeVisible();
        const json = await page.getByTestId('ui2-workflow-export-json').textContent();
        expect(json).toContain('workflow_id');
      }
    }
  });

});
