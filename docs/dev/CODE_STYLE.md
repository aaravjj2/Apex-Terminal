# Code Style Guide

TypeScript and React conventions for the Apex Terminal codebase.

## Table of Contents

- [TypeScript Configuration](#typescript-configuration)
- [Naming Conventions](#naming-conventions)
- [File Organization](#file-organization)
- [Import Ordering](#import-ordering)
- [ESLint Rules](#eslint-rules)
- [Prettier Configuration](#prettier-configuration)
- [File Length Guidelines](#file-length-guidelines)
- [Code Examples](#code-examples)
- [Do's and Don'ts](#dos-and-donts)

## TypeScript Configuration

Strict mode is **non-negotiable**. The project `tsconfig.json` enforces:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": false,
    "target": "ES2022",
    "module": "ESNext",
    "jsx": "react-jsx"
  }
}
```

Never use `@ts-ignore`. If a type escape is truly needed, use `@ts-expect-error` with a comment explaining why.

## Naming Conventions

| Element            | Convention         | Example                           |
| ------------------ | ------------------ | --------------------------------- |
| Functions          | `camelCase`        | `calculateRSI`, `fetchQuote`      |
| React components   | `PascalCase`       | `ChartToolbar`, `OrderPanel`      |
| Hooks              | `use` + PascalCase | `useChart`, `useMarketData`       |
| Constants          | `UPPER_SNAKE_CASE` | `MAX_CHARTS`, `DEFAULT_TIMEFRAME` |
| Types / Interfaces | `PascalCase`       | `ChartInstance`, `BarRequest`     |
| Enums              | `PascalCase`       | `DrawingType`, `MarketStatus`     |
| Files — components | `PascalCase.tsx`   | `ChartToolbar.tsx`                |
| Files — utilities  | `camelCase.ts`     | `movingAverages.ts`               |
| Files — stores     | `camelCase.ts`     | `chartStore.ts`                   |
| Files — hooks      | `camelCase.ts`     | `useChart.ts`                     |
| CSS/Tailwind files | `kebab-case`       | `chart-panel.css`                 |

Prefix boolean variables with `is`, `has`, `should`, or `can`:

```typescript
const isLoading = true;
const hasPermission = checkAuth();
const shouldReconnect = attempts < MAX_RETRIES;
```

## File Organization

Every module file follows a consistent section order:

```typescript
// 1. Imports (see ordering below)
import { create } from 'zustand';
import type { Bar } from '@/lib/marketData/types';

// 2. Type definitions
export interface IndicatorConfig { /* ... */ }

// 3. Constants
const DEFAULT_PERIOD = 14;

// 4. Helper functions (private)
function validatePeriod(p: number): boolean { /* ... */ }

// 5. Main export (component / hook / store / function)
export function useIndicator() { /* ... */ }

// 6. Secondary exports (selectors, utilities)
export const selectActiveIndicator = (s: State) => s.active;
```

Use section divider comments for long files:

```typescript
// ─── Types ──────────────────────────────────────────────────
// ─── Helpers ────────────────────────────────────────────────
// ─── Store ──────────────────────────────────────────────────
// ─── Selectors ──────────────────────────────────────────────
```

## Import Ordering

Imports are grouped and separated by blank lines:

```typescript
// 1. React / framework
import { useState, useCallback, useEffect } from 'react';

// 2. Third-party libraries
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

// 3. Internal absolute imports — stores, hooks, api
import { useChartStore } from '@/stores/chartStore';
import { apiClient } from '@/api/client';

// 4. Internal absolute imports — lib utilities
import { sma, ema } from '@/lib/indicators/movingAverages';

// 5. Relative imports (same module)
import type { ChartConfig } from './types';

// 6. Type-only imports last
import type { Bar, Timeframe } from '@/lib/marketData/types';
```

## ESLint Rules

Key rules enforced via `eslint.config.js`:

```javascript
export default [
  {
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'prefer-const': 'error',
      'no-var': 'error',
      'eqeqeq': ['error', 'always'],
    },
  },
];
```

Run the linter:

```bash
npm run lint          # check
npm run lint -- --fix # auto-fix
```

## Prettier Configuration

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 110,
  "tabWidth": 2,
  "bracketSpacing": true,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

Format on save is expected. Run manually with `npm run format`.

## File Length Guidelines

| File Type     | Target   | Hard Limit |
| ------------- | -------- | ---------- |
| Component     | < 200    | 400 lines  |
| Hook          | < 150    | 300 lines  |
| Store         | < 300    | 600 lines  |
| Utility/lib   | < 200    | 500 lines  |
| Test          | < 250    | 500 lines  |
| Worker        | < 200    | 400 lines  |

When a file exceeds its target, consider splitting. Store files can use slice patterns; components can extract sub-components.

## Code Examples

### Typed function with clear return

```typescript
export function bollingerBands(
  data: number[],
  period: number,
  multiplier: number,
): { upper: number[]; middle: number[]; lower: number[] } {
  const middle = sma(data, period);
  // ... computation
  return { upper, middle, lower };
}
```

### Component with props interface

```typescript
interface PriceCellProps {
  readonly value: number;
  readonly previousValue?: number;
  readonly decimals?: number;
}

export function PriceCell({ value, previousValue, decimals = 2 }: PriceCellProps) {
  const color = previousValue && value > previousValue ? 'text-green-400' : 'text-red-400';
  return <span className={color}>{value.toFixed(decimals)}</span>;
}
```

## Do's and Don'ts

**Do:**
- Use `type` imports for interfaces/types: `import type { Bar } from '...'`
- Prefer `const` over `let`; never use `var`
- Destructure props in the function signature
- Use template literals over string concatenation
- Keep functions under 40 lines — extract helpers

**Don't:**
- Use `enum` for simple string unions — prefer `type Status = 'open' | 'closed'`
- Export mutable variables
- Use `!` non-null assertion without a preceding guard
- Mix Tailwind classes with CSS modules in the same component
- Leave `TODO` comments without an associated issue number
