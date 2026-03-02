# Dependencies Audit

> Third-party dependency inventory with versions, licenses, purpose, and risk assessment.

## Table of Contents

- [Runtime Dependencies](#runtime-dependencies)
- [Development Dependencies](#development-dependencies)
- [License Summary](#license-summary)
- [Risk Assessment Criteria](#risk-assessment-criteria)
- [Update Policy](#update-policy)

---

## Runtime Dependencies

| Package | Version | License | Purpose | Weekly DL | Risk |
|---------|---------|---------|---------|-----------|------|
| `react` | 19.0.0 | MIT | UI component library | 25M+ | Low |
| `react-dom` | 19.0.0 | MIT | DOM rendering for React | 25M+ | Low |
| `react-router-dom` | 7.x | MIT | Client-side routing with nested layouts | 12M+ | Low |
| `zustand` | 5.x | MIT | Lightweight state management | 4M+ | Low |
| `immer` | 10.x | MIT | Immutable state updates for Zustand middleware | 8M+ | Low |
| `tailwindcss` | 4.x | MIT | Utility-first CSS framework | 10M+ | Low |
| `clsx` | 2.x | MIT | Conditional className composition | 15M+ | Low |
| `tailwind-merge` | 2.x | MIT | Intelligent Tailwind class deduplication | 4M+ | Low |
| `lightweight-charts` | 4.x | Apache-2.0 | High-performance financial charting (canvas) | 200K+ | Low |
| `recharts` | 2.x | MIT | React declarative charting (SVG) for dashboards | 2M+ | Low |
| `chart.js` | 4.x | MIT | Canvas charting for analytics panels | 3M+ | Low |
| `lucide-react` | 0.4x | ISC | Icon library (tree-shakeable SVG icons) | 2M+ | Low |
| `cmdk` | 1.x | MIT | Command palette component (⌘K) | 300K+ | Low |
| `react-resizable-panels` | 2.x | MIT | Resizable panel layout system | 400K+ | Low |

### Dependency Details

#### lightweight-charts

- **Maintainer:** TradingView, Inc.
- **Bundle impact:** ~120KB min+gzip
- **Why chosen:** Best-in-class financial chart rendering; GPU-accelerated canvas; native candlestick, line, area, histogram series; crosshair and tooltip support.
- **Alternatives evaluated:** D3.js (too low-level), Highcharts (commercial license), TradingView widget (not embeddable).

#### zustand

- **Maintainer:** pmndrs (Poimandres)
- **Bundle impact:** ~2KB min+gzip
- **Why chosen:** Minimal API surface, no boilerplate, excellent TypeScript support, middleware for immer/persist/devtools, supports React 19 concurrent features.
- **Alternatives evaluated:** Redux Toolkit (heavier), Jotai (atomic model less suited to our store architecture), Valtio (proxy-based, less predictable).

#### cmdk

- **Maintainer:** Rauno Freiberg
- **Bundle impact:** ~5KB min+gzip
- **Why chosen:** Accessible command palette with composable API, keyboard navigation, fuzzy search.

---

## Development Dependencies

| Package | Version | License | Purpose | Risk |
|---------|---------|---------|---------|------|
| `typescript` | 5.9.x | Apache-2.0 | Static type checking | Low |
| `vite` | 5.x | MIT | Build tool and dev server | Low |
| `@vitejs/plugin-react` | 4.x | MIT | React Fast Refresh for Vite | Low |
| `vitest` | 2.x | MIT | Unit/integration test framework | Low |
| `@testing-library/react` | 16.x | MIT | React component testing utilities | Low |
| `playwright` | 1.4x | Apache-2.0 | E2E browser testing (Chromium, Firefox, WebKit) | Low |
| `pixelmatch` | 6.x | ISC | Pixel-level image comparison for visual regression | Low |
| `pngjs` | 7.x | MIT | PNG encoding/decoding for screenshot comparison | Low |
| `eslint` | 9.x | MIT | Code linting | Low |
| `prettier` | 3.x | MIT | Code formatting | Low |
| `postcss` | 8.x | MIT | CSS transformation pipeline | Low |
| `autoprefixer` | 10.x | MIT | Vendor prefix insertion | Low |

---

## License Summary

| License | Count | Commercial Use | Modification | Distribution | Patent Grant |
|---------|-------|---------------|--------------|--------------|-------------|
| MIT | 16 | Yes | Yes | Yes | No |
| Apache-2.0 | 3 | Yes | Yes | Yes | Yes |
| ISC | 2 | Yes | Yes | Yes | No |

All dependencies use permissive open-source licenses. No copyleft (GPL/LGPL/AGPL) dependencies are included.

### Compliance Checklist

- [x] All licenses permit commercial use
- [x] All licenses permit modification and redistribution
- [x] No copyleft licenses that would require source disclosure
- [x] Attribution notices maintained in `LICENSE` and build output
- [x] No dependencies with "Commons Clause" or similar restrictions

---

## Risk Assessment Criteria

Each dependency is rated on a 3-level scale:

| Rating | Criteria |
|--------|---------|
| **Low** | Actively maintained (commits within 90 days), > 100K weekly downloads, permissive license, no known vulnerabilities, established maintainer/org |
| **Medium** | Maintained but lower activity, < 100K weekly downloads, single maintainer, or niche use case |
| **High** | Unmaintained (no commits > 6 months), known CVEs, restrictive license, or critical path with no alternative |

### Current Risk Distribution

| Rating | Count | Percentage |
|--------|-------|-----------|
| Low | 18 | 100% |
| Medium | 0 | 0% |
| High | 0 | 0% |

---

## Update Policy

| Category | Cadence | Process |
|----------|---------|---------|
| **Security patches** | Immediate | Dependabot auto-merge for patch versions |
| **Minor versions** | Weekly | Review changelog, run test suite, merge if green |
| **Major versions** | Quarterly | Evaluate breaking changes, create migration branch, full regression test |

### Automated Tooling

- **Dependabot** — Weekly PRs for outdated dependencies
- **npm audit** — Run in CI on every push; fail on high/critical
- **Socket.dev** — Supply chain attack detection on new dependencies
- **Bundlephobia check** — PR comment with bundle size delta for new deps

### Adding New Dependencies

Before adding a dependency, evaluate:

1. **Necessity** — Can this be implemented in < 100 lines without a dependency?
2. **Bundle size** — What is the min+gzip cost? Is it tree-shakeable?
3. **Maintenance** — Active maintainer? Community size? Bus factor?
4. **License** — Permissive? Compatible with MIT?
5. **Security** — Any known CVEs? Socket.dev score?
6. **Alternatives** — Is there a lighter or better-maintained option?

---

*Run `npm ls --depth=0` for the current installed tree. Run `npm audit` for vulnerability status.*
