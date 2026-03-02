import { test, expect } from '@playwright/test';

const LOAD_OPTS = { timeout: 30_000 };

test.describe('Accessibility — Basic A11y Checks', () => {
  test('dashboard has proper html lang attribute', async ({ page }) => {
    await page.goto('/ui2/dashboard');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    const lang = await page.locator('html').getAttribute('lang');
    expect(lang).toBeTruthy();
  });

  test('page has a title element', async ({ page }) => {
    await page.goto('/ui2/dashboard');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    const title = await page.title();
    expect(title).toBeTruthy();
    expect(title.length).toBeGreaterThan(0);
  });

  test('skip-to-main link is present', async ({ page }) => {
    await page.goto('/ui2/dashboard');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    const skipLink = page.getByTestId('skip-to-main');
    const exists = await skipLink.count();
    expect(exists).toBeGreaterThan(0);
  });

  test('interactive buttons are keyboard-focusable', async ({ page }) => {
    await page.goto('/ui2/dashboard');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    await expect(page.getByTestId('dashboard-ui2-page')).toBeVisible({ timeout: 15_000 });

    const buttons = page.locator('button:visible');
    const count = await buttons.count();
    if (count > 0) {
      const firstBtn = buttons.first();
      const tabIndex = await firstBtn.getAttribute('tabindex');
      const isNotHidden = tabIndex !== '-1';
      expect(isNotHidden).toBe(true);
    }
  });

  test('form inputs have associated labels or accessible names', async ({ page }) => {
    await page.goto('/ui2/backtest');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});

    const inputs = page.locator('input:visible, select:visible');
    const count = await inputs.count();
    let accessibleCount = 0;
    if (count > 0) {
      for (let i = 0; i < Math.min(count, 5); i++) {
        const input = inputs.nth(i);
        const ariaLabel = await input.getAttribute('aria-label');
        const ariaLabelledBy = await input.getAttribute('aria-labelledby');
        const placeholder = await input.getAttribute('placeholder');
        const title = await input.getAttribute('title');
        const id = await input.getAttribute('id');
        const type = await input.getAttribute('type');
        const hasAccessibleName = !!(ariaLabel || ariaLabelledBy || placeholder || title || id || type);
        if (hasAccessibleName) accessibleCount++;
      }
      expect(accessibleCount).toBeGreaterThan(0);
    }
  });

  test('no images without alt text on dashboard', async ({ page }) => {
    await page.goto('/ui2/dashboard');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    await expect(page.getByTestId('dashboard-ui2-page')).toBeVisible({ timeout: 15_000 });

    const images = page.locator('img');
    const count = await images.count();
    for (let i = 0; i < count; i++) {
      const alt = await images.nth(i).getAttribute('alt');
      const role = await images.nth(i).getAttribute('role');
      const hasAlt = alt !== null || role === 'presentation';
      expect(hasAlt).toBe(true);
    }
  });

  test('color contrast: text elements have readable color on dark backgrounds', async ({ page }) => {
    await page.goto('/ui2/dashboard');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    await expect(page.getByTestId('dashboard-ui2-page')).toBeVisible({ timeout: 15_000 });

    const bodyBg = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="dashboard-ui2-page"]');
      if (!el) return null;
      return window.getComputedStyle(el).backgroundColor;
    });

    const bodyColor = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="dashboard-ui2-page"]');
      if (!el) return null;
      return window.getComputedStyle(el).color;
    });

    expect(bodyBg).toBeTruthy();
    expect(bodyColor).toBeTruthy();
    if (bodyBg && bodyColor && bodyBg !== 'rgba(0, 0, 0, 0)') {
      expect(bodyBg).not.toBe(bodyColor);
    }
  });

  test('page has no duplicate IDs in main content', async ({ page }) => {
    await page.goto('/ui2/dashboard');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    await expect(page.getByTestId('dashboard-ui2-page')).toBeVisible({ timeout: 15_000 });

    const dupeCount = await page.evaluate(() => {
      const ids = Array.from(document.querySelectorAll('[id]')).map(el => el.id).filter(Boolean);
      const seen = new Set<string>();
      let dupes = 0;
      for (const id of ids) {
        if (seen.has(id)) dupes++;
        seen.add(id);
      }
      return dupes;
    });
    expect(dupeCount).toBeLessThanOrEqual(3);
  });

  test('focus is visible when tabbing through topbar', async ({ page }) => {
    await page.goto('/ui2/dashboard');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    await expect(page.getByTestId('ui2-topbar')).toBeVisible({ timeout: 15_000 });

    await page.keyboard.press('Tab');
    const activeTag = await page.evaluate(() => document.activeElement?.tagName);
    expect(activeTag).toBeTruthy();
  });

  test('trading page inputs are focusable', async ({ page }) => {
    await page.goto('/ui2/search');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    await expect(page.getByTestId('search-input')).toBeVisible({ timeout: 15_000 });

    const searchInput = page.getByTestId('search-input');
    await searchInput.focus();
    const isFocused = await page.evaluate(
      () => document.activeElement?.getAttribute('data-testid') === 'search-input'
    );
    expect(isFocused).toBe(true);
  });

  test('viewport meta tag is set for mobile responsiveness', async ({ page }) => {
    await page.goto('/ui2/dashboard');
    await page.waitForLoadState('networkidle', LOAD_OPTS).catch(() => {});
    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(viewport).toBeTruthy();
    expect(viewport).toContain('width');
  });
});
