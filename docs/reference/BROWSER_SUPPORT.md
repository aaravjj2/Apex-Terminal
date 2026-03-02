# Browser Compatibility Reference

> Supported browsers, required web platform features, known issues, and polyfill guidance.

## Table of Contents

- [Supported Browsers](#supported-browsers)
- [Required Web Platform Features](#required-web-platform-features)
- [Known Browser Issues](#known-browser-issues)
- [Polyfills](#polyfills)
- [Mobile Browser Support](#mobile-browser-support)
- [Testing Matrix](#testing-matrix)

---

## Supported Browsers

| Browser | Minimum Version | Engine | Support Level |
|---------|----------------|--------|---------------|
| Google Chrome | 90+ | Blink/V8 | Full |
| Microsoft Edge | 90+ | Blink/V8 | Full |
| Mozilla Firefox | 90+ | Gecko/SpiderMonkey | Full |
| Apple Safari | 15+ | WebKit/JSC | Full |
| Safari iOS | 15+ | WebKit | Partial (see mobile) |
| Chrome Android | 90+ | Blink/V8 | Partial (see mobile) |
| Samsung Internet | 16+ | Blink/V8 | Partial |
| Opera | 76+ | Blink/V8 | Community (untested) |

### Support Levels

| Level | Definition |
|-------|-----------|
| **Full** | All features work, actively tested in CI, bugs are P0/P1 |
| **Partial** | Core features work, some layout/interaction limitations on small screens |
| **Community** | Expected to work (shares engine with a Full browser), not tested in CI |
| **Unsupported** | Internet Explorer, legacy Edge (EdgeHTML), browsers below minimum versions |

---

## Required Web Platform Features

Apex Terminal depends on the following browser APIs. All are available in every supported browser version listed above.

| Feature | Used By | Spec | Chrome | Firefox | Safari |
|---------|---------|------|--------|---------|--------|
| ES2022 (top-level await, `.at()`, error cause) | Core runtime | TC39 | 91+ | 89+ | 15+ |
| ES Modules (`import`/`export`) | Vite, all code | ES2015 | 61+ | 60+ | 11+ |
| WebSocket | Market data streaming | RFC 6455 | 4+ | 11+ | 5+ |
| Canvas 2D | lightweight-charts, Chart.js | HTML5 | 1+ | 1.5+ | 1+ |
| IndexedDB | Offline storage, caching | W3C | 24+ | 16+ | 10+ |
| Web Workers | Indicator/ML/order computation | HTML5 | 4+ | 3.5+ | 4+ |
| ResizeObserver | Panel resizing, chart resize | W3C | 64+ | 69+ | 13.1+ |
| Intersection Observer | Lazy loading, infinite scroll | W3C | 51+ | 55+ | 12.1+ |
| CSS Custom Properties | Theming | CSS3 | 49+ | 31+ | 9.1+ |
| CSS Grid | Layout system | CSS3 | 57+ | 52+ | 10.1+ |
| CSS `gap` on Flexbox | Component spacing | CSS3 | 84+ | 63+ | 14.1+ |
| `structuredClone()` | Worker data transfer | HTML | 98+ | 94+ | 15.4+ |
| `crypto.randomUUID()` | ID generation | Web Crypto | 92+ | 95+ | 15.4+ |
| Fetch API | REST API calls | WHATWG | 42+ | 39+ | 10.1+ |
| AbortController | Request cancellation | DOM | 66+ | 57+ | 12.1+ |
| `requestAnimationFrame` | Chart animations | HTML5 | 10+ | 23+ | 6+ |
| Clipboard API | Copy chart/data | W3C | 66+ | 63+ | 13.1+ |
| Broadcast Channel | Cross-tab sync | HTML5 | 54+ | 38+ | 15.4+ |

---

## Known Browser Issues

### Safari

| Issue | Versions | Workaround |
|-------|----------|------------|
| IndexedDB transaction auto-commit on `await` | 15.0–15.3 | Wrapped transactions in microtask-safe helper |
| `ResizeObserver` loop error in devtools | All | Suppressed via `window.onerror` guard; harmless |
| `100vh` includes address bar height | iOS < 15.4 | Use `dvh` unit with `100vh` fallback |
| WebSocket connection limit per origin | All | Multiplexed all feeds over single connection |
| `crypto.randomUUID()` requires secure context | All | Falls back to `crypto.getRandomValues()` polyfill |

### Firefox

| Issue | Versions | Workaround |
|-------|----------|------------|
| Canvas fingerprinting protection blocks `toDataURL()` | Privacy mode | Chart export falls back to DOM screenshot |
| `Intl.NumberFormat` `notation: 'compact'` missing options | < 93 | Custom compact number formatter |
| Slow `OffscreenCanvas` in Workers | < 105 | Disabled offscreen rendering on affected versions |

### Chrome / Edge

| Issue | Versions | Workaround |
|-------|----------|------------|
| Memory leak with large Canvas contexts | 90–95 | Explicit `canvas.getContext('2d')` cleanup on unmount |
| DevTools open causes `requestAnimationFrame` throttle | All | No workaround needed; only affects development |

---

## Polyfills

Apex Terminal ships zero polyfills by default. The minimum browser versions guarantee all required APIs are available natively.

### Optional Polyfills

If you need to support older browsers (not recommended), add these manually:

| Feature | Polyfill | Size |
|---------|----------|------|
| `structuredClone` | `@ungap/structured-clone` | 1.2KB |
| `crypto.randomUUID` | `uuid` package | 1.5KB |
| `ResizeObserver` | `resize-observer-polyfill` | 3KB |
| `Array.prototype.at` | `core-js/proposals/relative-indexing-method` | 0.5KB |

### Adding Polyfills

```typescript
// vite.config.ts — only if targeting older browsers
import legacy from '@vitejs/plugin-legacy';

export default defineConfig({
  plugins: [
    legacy({
      targets: ['chrome >= 80', 'firefox >= 80', 'safari >= 14'],
    }),
  ],
});
```

---

## Mobile Browser Support

Mobile browsers receive **Partial** support. The desktop-optimized UI adapts to smaller screens with limitations.

| Feature | Mobile Status | Notes |
|---------|--------------|-------|
| Chart viewing | Works | Touch pan/zoom via lightweight-charts |
| Indicator overlays | Works | Limited screen space for legend |
| Order entry | Works | Simplified form layout |
| Multi-panel layout | Limited | Collapses to single-panel with tab navigation |
| Keyboard shortcuts | N/A | Not applicable on touch devices |
| Drawing tools | Limited | Touch drawing is less precise |
| Bloomberg terminal | Disabled | Requires physical keyboard |
| Drag-and-drop | Limited | Uses long-press gesture |

### Responsive Breakpoints

| Breakpoint | Width | Layout |
|------------|-------|--------|
| Mobile | < 640px | Single panel, bottom tab nav |
| Tablet | 640–1024px | Two panels, collapsible sidebar |
| Desktop | 1024–1440px | Multi-panel with sidebar |
| Wide | > 1440px | Full Bloomberg-style layout |

---

## Testing Matrix

Automated browser testing runs on every PR via Playwright.

| Browser | Engine | CI Environment | Visual Regression |
|---------|--------|---------------|-------------------|
| Chromium (latest) | Blink | Playwright Docker | Yes (baseline) |
| Firefox (latest) | Gecko | Playwright Docker | Yes |
| WebKit (latest) | WebKit | Playwright Docker | Yes |

### Running Locally

```bash
npx playwright install
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
```

---

*Feature detection is preferred over user-agent sniffing. See `lib/platform/` for capability checks.*
