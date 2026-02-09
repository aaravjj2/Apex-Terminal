# E2E Testing Guide

## Overview

This directory contains end-to-end (E2E) tests for the TradingView Recreation frontend using Playwright.

## Running Tests Locally

### Prerequisites

1. Build the application first:
```bash
npm run build
```

2. Start the development server in a separate terminal:
```bash
npm run dev
```

The dev server will start on `http://localhost:5100`.

### Running Tests

Once the dev server is running, execute the tests:

```bash
# Run all tests
npx playwright test

# Run tests in headed mode (see browser)
npx playwright test --headed

# Run specific test file
npx playwright test tests/e2e/indicators.spec.ts

# Run tests in debug mode
npx playwright test --debug

# Run tests with UI mode (recommended for development)
npx playwright test --ui
```

### Viewing Test Reports

After test execution, view the HTML report:

```bash
npx playwright show-report
```

## Test Structure

```
tests/
├── setup.ts              # Global test setup
├── e2e/                  # End-to-end tests
│   ├── indicators.spec.ts    # Indicator modal/dock tests
│   └── ...
├── integration/          # Integration tests
└── unit/                # Unit tests
```

## Current E2E Tests

### Indicators Tests (`tests/e2e/indicators.spec.ts`)

Tests the indicator library modal and indicator management:

1. **RSI Add Test**: Opens modal, searches for RSI, adds to chart, verifies badge updates
2. **SMA Add/Remove Test**: Complete flow of adding SMA, verifying dock display, and removing indicator

#### Key Selectors Used:
- Role-based: `getByRole('button', { name: 'Indicators' })`
- Class-based: `.cursor-pointer` for list items
- DOM evaluation for badge verification

## CI/CD Integration

Tests are automatically run in CI using GitHub Actions (see `.github/workflows/e2e.yml`).

CI runs tests against a production build to ensure parity with deployed application.

## Environment Variables

- `PLAYWRIGHT_BASE_URL`: Override base URL for tests (default: `http://localhost:5100`)

Example:
```bash
PLAYWRIGHT_BASE_URL=http://localhost:3000 npx playwright test
```

## Writing New Tests

### Best Practices

1. **Use Role-Based Selectors**: Prefer `getByRole()` for accessibility and robustness
2. **Wait for Content**: Use `expect().toBeVisible()` to ensure elements are ready
3. **Test User Flows**: Test complete workflows, not isolated UI interactions
4. **Avoid Hardcoded Waits**: Use Playwright's auto-waiting instead of `page.waitForTimeout()`

### Example Test Template

```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should do something', async ({ page }) => {
    // Arrange: Set up test conditions
    
    // Act: Perform user actions
    await page.getByRole('button', { name: 'Click Me' }).click();
    
    // Assert: Verify outcomes
    await expect(page.getByText('Success')).toBeVisible();
  });
});
```

## Troubleshooting

### Connection Refused Error

If tests fail with `ERR_CONNECTION_REFUSED`:
- Ensure dev server is running on port 5100
- Check `npm run dev` output for the correct port
- Verify no firewall is blocking localhost:5100

### Flaky Tests

If tests occasionally fail:
- Check for race conditions (missing `.toBeVisible()` waits)
- Verify test isolation (each test should be independent)
- Review network timing issues

### Timeout Errors

If tests timeout:
- Increase timeout in `playwright.config.ts` if needed
- Check if backend API is responding
- Verify test selectors are correct

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Playwright Testing Guide](https://playwright.dev/docs/writing-tests)
