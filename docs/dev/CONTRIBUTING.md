# Contributing to Apex Terminal

Guidelines for contributing to the Apex Terminal financial analytics platform.

## Table of Contents

- [Getting Started](#getting-started)
- [Branch Naming](#branch-naming)
- [Commit Messages](#commit-messages)
- [Pull Request Process](#pull-request-process)
- [Code Review Checklist](#code-review-checklist)
- [Coding Standards](#coding-standards)
- [Testing Requirements](#testing-requirements)
- [Documentation Expectations](#documentation-expectations)
- [Do's and Don'ts](#dos-and-donts)

## Getting Started

```bash
# 1. Fork the repo, then clone your fork
git clone git@github.com:<you>/apex-terminal.git
cd apex-terminal

# 2. Install dependencies
cd frontend && npm install

# 3. Start dev server
npm run dev

# 4. Run tests to verify setup
npm run test && npm run test:e2e
```

Add the upstream remote so you can pull changes:

```bash
git remote add upstream git@github.com:apex-terminal/apex-terminal.git
git fetch upstream
```

## Branch Naming

All branches must use a category prefix:

| Prefix     | Purpose                         | Example                        |
| ---------- | ------------------------------- | ------------------------------ |
| `feature/` | New functionality               | `feature/options-chain-view`   |
| `fix/`     | Bug fixes                       | `fix/chart-crosshair-flicker`  |
| `docs/`    | Documentation only              | `docs/api-client-guide`        |
| `refactor/`| Code restructuring              | `refactor/store-selectors`     |
| `perf/`    | Performance improvements        | `perf/indicator-worker-batch`  |
| `test/`    | Adding or updating tests        | `test/backtest-engine-edge`    |
| `chore/`   | Tooling, CI, dependency updates | `chore/vite-5-upgrade`         |

Branch off `main` and keep branches short-lived (< 1 week ideally).

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`

**Scopes** map to top-level directories: `chart`, `store`, `api`, `hook`, `indicator`, `drawing`, `backtest`, `worker`, `ui`, `e2e`

```bash
# Good
feat(indicator): add Hull Moving Average to indicator worker
fix(chart): resolve crosshair desync across linked charts
perf(worker): batch indicator calculations in single message

# Bad — no scope, vague description
fix: fixed stuff
```

## Pull Request Process

1. Rebase on `main` before opening a PR — no merge commits.
2. Fill out the PR template: **Summary**, **Motivation**, **Test plan**, **Screenshots** (if UI).
3. Ensure CI passes: lint, type-check, unit tests, E2E.
4. Request at least one reviewer. Two reviewers for store/api/worker changes.
5. Squash-merge into `main` after approval.

## Code Review Checklist

Reviewers should verify:

- [ ] Types are strict — no `any` escape hatches without a comment justifying it
- [ ] New components are accessible (keyboard nav, ARIA)
- [ ] New hooks clean up subscriptions/timers in their effect teardown
- [ ] Store actions use Immer's draft syntax (no spread in `set()`)
- [ ] API calls handle error states and loading states
- [ ] Unit tests cover happy path + at least one edge case
- [ ] No `console.log` left in production code
- [ ] Bundle impact is reasonable (check `npm run build` output)

## Coding Standards

- **TypeScript strict mode** — `strict: true` in `tsconfig.json`. No `@ts-ignore`.
- **Functional components only** — no class components.
- **Zustand + Immer** for global state. `useState` for local component state.
- **Tailwind v4** for styling. No inline `style` props unless dynamically computed.
- **Absolute imports** via `@/` alias mapping to `frontend/src/`.

```typescript
// Correct — absolute import
import { useChartStore } from '@/stores/chartStore';

// Avoid — relative climbing
import { useChartStore } from '../../../stores/chartStore';
```

## Testing Requirements

| Change Type       | Required Tests                                |
| ----------------- | --------------------------------------------- |
| Pure function      | Vitest unit test with ≥ 3 cases              |
| Zustand store      | Vitest test exercising actions + selectors    |
| React component    | React Testing Library render + interaction    |
| API endpoint       | Vitest test with mocked `apiClient`           |
| User-facing flow   | Playwright E2E spec                           |
| Worker logic       | Vitest test posting messages to worker        |

Coverage thresholds: **80% lines**, **75% branches** for new files.

## Documentation Expectations

- Every exported function/type gets a JSDoc `@description` and `@example`.
- New hooks get an entry in `docs/dev/HOOK_GUIDE.md`.
- New store slices get an entry in `docs/dev/STORE_GUIDE.md`.
- API modules must document request/response shapes inline.

## Do's and Don'ts

**Do:**
- Write small, focused PRs (< 400 lines diff)
- Add `data-testid` attributes to interactive elements for E2E tests
- Use the existing `apiClient` singleton — don't create new fetch wrappers
- Run `npm run lint && npm run typecheck` before pushing

**Don't:**
- Commit `.env` files or API keys
- Add new dependencies without discussing in a PR comment first
- Bypass TypeScript with `as any` casts
- Mutate state outside of Immer's `set()` callback
- Write E2E tests that depend on real network calls
