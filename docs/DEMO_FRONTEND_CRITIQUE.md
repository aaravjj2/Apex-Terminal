# Apex Terminal Demo — Frontend Critique & Improvement Guide

> Deep-dive analysis of `demo/index.html` (≈4,800 lines, ≈313KB), identifying structural, accessibility, UX, and maintainability issues with actionable remediation steps.
> Based on full codebase audit of the Apex Terminal demo.

---

## Executive Summary

| Category | Status | Summary |
|----------|--------|---------|
| **Visual design** | ✓ Strong | Coherent dark theme, CSS variables, Inter + JetBrains Mono |
| **Feature breadth** | ✓ Strong | 20+ views, command palette, settings, keyboard shortcuts |
| **Accessibility** | ✗ Weak | `user-select:none`, no ARIA, no focus management |
| **Maintainability** | ✗ Weak | Monolithic file, inline handlers, mixed patterns |
| **Functional fidelity** | △ Partial | Theme/chart-type controls show UI but don't change behavior |
| **Responsiveness** | ✗ Missing | Fixed layout, no breakpoints |
| **Performance** | △ Adequate | All views in DOM, no lazy mount; resize debouncing absent |

---

# PART 1 — ACCESSIBILITY

## 1.1 Text Selection Disabled Globally

**Location:** `html, body { user-select: none }` (line 12)

**Problem:**  
Every element inherits `user-select: none`. Users cannot:
- Copy symbol names, prices, or IDs from tables
- Select code in Strategy Studio for copying
- Select text in Research, news, or alert descriptions

**Impact:**
- **WCAG 2.1** (2.1.1 Keyboard): Indirect impact; selection is a common task
- **Usability:** Traders routinely copy data into spreadsheets, notes, or other tools
- **Screen readers:** Some assistive tech relies on selection behavior

**Recommendation:**
```css
/* Replace global block with scoped exclusions */
html, body { user-select: none }  /* optional for chrome */

/* Or allow selection in content areas */
.tbl-wrap, .code-area, .wl-row, .alert-row, .idea-body, 
.eco-row, .fund-row, .think-text, .check-desc, .svc-name {
  user-select: text;
}
```

---

## 1.2 Missing ARIA and Semantic Structure

**Problem:**  
The demo uses almost no ARIA attributes and limited semantic HTML.

**Current state:**

| Element | Current | Needed |
|---------|---------|--------|
| Nav items | `<div class="nav-item">` | `role="tab"`, `aria-selected`, `aria-controls` |
| Nav groups | `role="button"` only | `aria-expanded`, `tabindex="0"`, Enter/Space handlers |
| Modals | Plain `div` | `role="dialog"`, `aria-modal="true"`, `aria-labelledby` |
| Command palette | No ARIA | `role="combobox"`, `aria-expanded`, `aria-activedescendant` |
| Icon buttons | `title` only | `aria-label` for screen readers |
| Tables | `<table>` ✓ | `aria-label` or `caption` for context |

**Example fix — Nav groups:**
```html
<!-- Before -->
<div class="nav-group-label" onclick="toggleNavGroup(...)" role="button">

<!-- After -->
<div class="nav-group-label" role="button" tabindex="0" 
     aria-expanded="true" aria-controls="nav-trade-items"
     onkeydown="if(e.key==='Enter'||e.key===' ') { e.preventDefault(); toggleNavGroup(...) }">
```

---

## 1.3 Focus Management in Modals

**Locations:** Settings overlay, Command palette

**Problem:**
- No focus trap; Tab can move focus outside the modal
- When modal opens, focus is not moved to the first focusable element
- When modal closes, focus is not returned to the trigger

**Current behavior:**
- Command palette: `document.getElementById('cmd-in').focus()` — only input gets focus, no trap
- Settings: No focus management at all

**Recommendation (focus trap pattern):**
```javascript
function trapFocus(container) {
  const focusables = container.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  const first = focusables[0], last = focusables[focusables.length - 1];
  container.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
}
```

---

## 1.4 Command Palette Keyboard Navigation

**Location:** `filterCmd()`, `renderCmdResults()`, keyboard handler

**Problem:**
- Only mouse click selects an item
- Arrow keys (↑/↓) do nothing
- Enter does not activate the highlighted item
- No `aria-activedescendant` to indicate selection

**Recommendation:**
- Track `cmdSel` (already present) and bind ArrowUp/ArrowDown to update it
- On Enter, execute `items[cmdSel].action` and close
- Set `aria-activedescendant` on the input to the active item's id
- Add `role="listbox"` and `role="option"` to results container and items

---

# PART 2 — MAINTAINABILITY & ARCHITECTURE

## 2.1 Monolithic File Structure

**Problem:**  
All HTML, CSS, and JS live in a single ~4,800-line file.

**Consequences:**
- Hard to navigate, debug, and test
- No clear ownership for views or modules
- Merge conflicts when multiple developers edit
- No tree-shaking or selective loading

**Recommendation — Modular layout:**
```
demo/
├── index.html          # Shell: layout, topbar, nav, sidebar; loads modules
├── css/
│   ├── base.css        # Reset, variables
│   ├── components.css  # Buttons, badges, tables, modals
│   └── views.css       # View-specific layouts
├── js/
│   ├── app.js          # Boot, routing, state
│   ├── chart.js        # initCharts, renderChart, renderRSI
│   ├── views/          # Per-view logic
│   │   ├── dashboard.js
│   │   ├── portfolio.js
│   │   ├── backtest.js
│   │   └── ...
│   ├── ui.js           # Toast, command palette, settings
│   └── data.js         # SYMBOLS, mock data, genOHLCV
└── api-bridge.js
```

---

## 2.2 Inline Event Handlers

**Problem:**  
100+ `onclick`, `oninput`, `onmouseover`/`onmouseout` attributes.

**Example:**
```html
<div class="nav-item" data-view="trading" onclick="switchView('trading')">
```

**Issues:**
- CSP (Content Security Policy) may block inline handlers
- Hard to trace and refactor
- No centralized event handling
- Mixing markup and behavior

**Recommendation:**
```html
<div class="nav-item" data-view="trading" data-action="switchView">
```

```javascript
document.getElementById('leftnav').addEventListener('click', (e) => {
  const item = e.target.closest('[data-action]');
  if (!item) return;
  const action = item.dataset.action;
  const view = item.dataset.view;
  if (action === 'switchView' && view) switchView(view);
});
```

---

## 2.3 innerHTML and XSS Surface

**Locations:**  
`renderWatchlist()`, `initMiniPositions()`, `initSidebarNews()`, `renderCmdResults()`, `initScanner()`, status bar, movers, news, etc.

**Problem:**
- Direct string interpolation into `innerHTML` without sanitization
- If any data source becomes user-controlled or external, XSS is possible

**Example:**
```javascript
el.innerHTML = wl.map(w=>`<div class="wl-row" onclick="setSymbol('${w.sym}')">...`).join('');
```

If `w.sym` ever contained `"')"></div><img src=x onerror=alert(1)>"`, it would execute.

**Recommendation:**
- Use `textContent` for text nodes, or
- Use a minimal sanitizer (e.g. DOMPurify), or
- Use `createElement`/`appendChild` with safe setters

---

## 2.4 Monkey-Patching and Global Mutation

**Location:** Lines 4755–4760

```javascript
const origSwitchView2 = window.switchView;
window.switchView = function(v) {
  origSwitchView2(v);
  if (v==='options') setTimeout(enhanceOptionsView, 80);
  if (v==='portfolio') { setTimeout(()=>{ initPortfolio(); enhancePortfolioView(); }, 80); }
};
```

**Problem:**
- Overwrites global `switchView`
- View-specific setup scattered across patch logic
- Order of execution depends on script load order
- Hard to test

**Recommendation:**
- Implement a `viewLifecycle` registry: `{ onEnter: [fn], onLeave: [fn] }`
- `switchView` iterates over lifecycle hooks instead of hardcoding view names

---

# PART 3 — FUNCTIONAL FIDELITY (UI vs Behavior)

## 3.1 Theme Toggle Does Not Change Theme

**Location:** `setTheme(t)` (around line 2865)

**Current implementation:**
```javascript
function setTheme(t){
  document.querySelectorAll('.theme-btn').forEach(b=>b.classList.remove('active'));
  document.querySelector('.theme-btn[data-theme="'+t+'"]')?.classList.add('active');
  showToast('Theme','Theme set to '+t,'info')
}
```

**Problem:**
- Only updates button state and shows a toast
- No change to `:root` CSS variables
- Light/system theme never applied

**Expected behavior:**
- **Dark:** Current `--bg0`, `--tx`, etc.
- **Light:** Inverted palette (e.g. `--bg0: #fff`, `--tx: #131722`)
- **System:** `prefers-color-scheme` media query

**Recommendation:**
```javascript
const THEMES = {
  dark: { '--bg0': '#0C0E12', '--tx': '#D1D4DC', /* ... */ },
  light: { '--bg0': '#FFFFFF', '--tx': '#131722', /* ... */ },
};
function setTheme(t) {
  const vars = t === 'system' 
    ? (matchMedia('(prefers-color-scheme:dark)').matches ? THEMES.dark : THEMES.light)
    : THEMES[t];
  Object.entries(vars).forEach(([k,v]) => document.documentElement.style.setProperty(k,v));
  // ... update buttons, toast
}
```

---

## 3.2 Chart Type Dropdown Offers Unsupported Types

**Location:** `setChartTypeAdv(type)` (lines 4740–4746)

**Current implementation:**
```javascript
function setChartTypeAdv(type) {
  chartType = ['candles','heikin-ashi','hollow','bar'].includes(type) ? 'candles' : 'line';
  if (type === 'area') chartType = 'area';
  setTimeout(initCharts, 10);
  showToast('Chart Type', type + ' chart', 'info');
}
```

**Problem:**
- Dropdown options: Candles, Heikin-Ashi, Hollow, Bar, Line, Area, Renko, Baseline
- Only `candles`, `line`, and `area` actually affect rendering
- Heikin-Ashi, Hollow, Bar, Renko, Baseline all map to `candles` (incorrect) or are ignored

**Rendering logic (lines 1937–1958):**
```javascript
if (chartType === 'candles') { /* candle draw */ } else { /* line draw */ }
// No branch for area, heikin-ashi, etc.
```

**Recommendation:**
- **Option A:** Implement missing chart types in the renderer (Heikin-Ashi, Hollow, Bar, Renko, Baseline, Area)
- **Option B:** Remove unsupported options from the dropdown until implemented

---

## 3.3 Indicator Panel Shows Toast Only

**Location:** `openIndicatorPanel()` (around line 4749)

**Current:**
```javascript
function openIndicatorPanel() {
  showToast('Indicators', 'EMA(12), EMA(26), RSI(14), BB(20,2), Volume active', 'info');
}
```

**Problem:**
- No panel, modal, or sidebar
- No way to add/remove or configure indicators
- Chart already has EMA/BB/RSI hardcoded; user cannot change them

**Recommendation:**
- Add a slide-out or modal with a list of indicators
- Allow toggle on/off and basic parameter editing (period, color)
- Wire to chart rendering so changes take effect

---

## 3.4 Chart Font Size Setting Has No Effect

**Location:** Settings modal (around line 1698)

```html
<div class="set-row">
  <span>Chart font size</span>
  <select>
    <option>Default</option><option>Large</option><option>Compact</option>
  </select>
</div>
```

**Problem:**
- No `onchange`, no `id`, no connection to chart rendering
- Canvas uses `ctx.font='9px JetBrains Mono'` etc.; no variable for font size

**Recommendation:**
- Add `id="chart-font-size"` and `onchange="setChartFontSize(this.value)"`
- Store value (e.g. in a global or state object)
- On chart redraw, use that value when setting `ctx.font`

---

## 3.5 Drawing Tools — No Actual Drawing

**Location:** `setDraw()`, `clearDrawings()`

**Current:**
```javascript
function setDraw(el, tool) {
  currentDraw = tool;
  document.querySelectorAll('.draw-btn').forEach(b=>b.classList.remove('active'));
  el.classList.add('active');
}
function clearDrawings() { showToast('Drawings','All drawings cleared','info'); }
```

**Problem:**
- `currentDraw` is set but never used in chart mouse handlers
- No drawing layer, no persistence
- Clear only shows a toast; no state cleared

**Note:** The drawing strip is present and the lib has tools; the demo does not wire them to the chart.

---

# PART 4 — RESPONSIVENESS & LAYOUT

## 4.1 Fixed Grid With No Breakpoints

**Location:** `#layout { grid-template-columns: 60px 1fr 292px }` (lines 52, 3171)

**Problem:**
- On viewport width < ~900px, content is squeezed
- Right sidebar (order entry, watchlist, Level 2) stays fixed width
- No collapse, overlay, or stacking

**Recommendation:**
```css
@media (max-width: 1200px) {
  #layout { grid-template-columns: 60px 1fr 240px; }
}
@media (max-width: 900px) {
  #layout { grid-template-columns: 60px 1fr; }
  #rightsidebar { display: none; } /* or slide-over */
}
@media (max-width: 600px) {
  #layout { grid-template-columns: 1fr; }
  #leftnav { width: 48px; } /* or hamburger */
}
```

---

## 4.2 Status Bar Ticker Animation

**Location:** `.sb-tape { animation: scrolll 55s linear infinite }`

**Problem:**
- On narrow viewports, the ticker may be barely visible or feel abrupt
- No `prefers-reduced-motion` consideration

**Recommendation:**
```css
@media (prefers-reduced-motion: reduce) {
  .sb-tape { animation: none; }
}
```

---

# PART 5 — PERFORMANCE & RUNTIME

## 5.1 All Views in DOM

**Problem:**
- 20+ view divs exist in the DOM; only `display:none`/`display:flex` toggles visibility
- Each view can contain tables, canvases, complex markup
- No lazy initialization; e.g. `initDashboard()` runs when switching to dashboard, but DOM is always present

**Impact:**
- Higher memory use
- More elements for browser to style/layout
- Slower initial parse for large HTML

**Recommendation:**
- Lazy-mount: render view markup only when first visited
- Or use a simple router that creates/destroys view containers

---

## 5.2 Resize Handler Without Debouncing

**Location:** (around line 3103)
```javascript
window.addEventListener('resize', () => {
  const tv = document.getElementById('view-trading');
  if (tv && tv.classList.contains('active')) setTimeout(initCharts,50);
});
```

**Problem:**
- Resize fires frequently during drag
- `initCharts` is expensive (canvas redraw)
- 50ms delay helps but is ad-hoc; no proper debounce

**Recommendation:**
```javascript
let resizeTm;
window.addEventListener('resize', () => {
  clearTimeout(resizeTm);
  resizeTm = setTimeout(() => { /* ... initCharts */ }, 150);
});
```

---

## 5.3 Canvas Image Rendering

**Location:** `canvas { image-rendering: pixelated; }` (line 3194)

**Problem:**
- `pixelated` can make line charts and text look jagged
- Often intended for pixel-art, not financial charts

**Recommendation:**
- Use `auto` or `crisp-edges` for clearer lines
- Or remove and rely on default; test on HiDPI

---

# PART 6 — CODE QUALITY & CONSISTENCY

## 6.1 Inline Styles in Generated HTML

**Locations:** `initMiniPositions()`, `initSidebarNews()`

**Example:**
```javascript
el.innerHTML = pos.map(p=>`<div style="padding:6px 10px;border-bottom:1px solid var(--bdr);cursor:pointer;..."
```

**Problem:**
- Duplicates styles that exist elsewhere as classes
- Hard to maintain; changes require both CSS and JS edits

**Recommendation:**
- Add classes like `.mini-pos-row`, `.sidebar-news-row` and use them in the template

---

## 6.2 SVG `stroke-width` vs `strokeWidth`

**Location:** SVG elements use `stroke-width` in attributes.

**Note:**
- In HTML/SVG, `stroke-width` is valid
- When creating SVG via JS (`createElementNS`), use `setAttribute('stroke-width', ...)` or camelCase `strokeWidth` for consistency

**Status:** Minor; no functional bug if used in static HTML.

---

## 6.3 Duplicated Chart Logic

**Problem:**
- `chartType` controls candles vs line; area is partially supported
- `toggleChartType()` toggles between candles/line
- `setChartTypeAdv()` is used by the enhanced dropdown
- Two code paths for the same concern

**Recommendation:**
- Single source of truth: `chartType` and one function `setChartType(t)` used by both toggle and dropdown

---

# PART 7 — PRIORITIZED REMEDIATION

## P0 — Critical (Do First)

| # | Issue | Effort | Impact |
|---|-------|--------|--------|
| 1 | Remove or scope `user-select: none` | Low | Usability, copy-paste |
| 2 | Implement actual theme switching | Medium | User expectation |
| 3 | Fix or restrict chart type dropdown | Low | User expectation |

## P1 — High (Accessibility)

| # | Issue | Effort | Impact |
|---|-------|--------|--------|
| 4 | Add ARIA labels to icon buttons, modals | Low | Screen readers |
| 5 | Focus trap in Settings and Command palette | Medium | Keyboard users |
| 6 | Arrow-key navigation in command palette | Medium | Power users |
| 7 | `aria-expanded` and keyboard support for nav groups | Low | Keyboard users |

## P2 — Medium (Maintainability)

| # | Issue | Effort | Impact |
|---|-------|--------|--------|
| 8 | Split into modules (HTML/CSS/JS) | High | Long-term maintenance |
| 9 | Replace inline handlers with `addEventListener` | Medium | CSP, refactoring |
| 10 | Introduce view lifecycle registry (replace monkey-patch) | Medium | Consistency |

## P3 — Lower (Polish)

| # | Issue | Effort | Impact |
|---|-------|--------|--------|
| 11 | Responsive breakpoints | Medium | Mobile/tablet |
| 12 | Debounce resize handler | Low | Performance |
| 13 | Replace inline styles with classes | Low | Consistency |
| 14 | Chart font size wiring | Low | Settings credibility |

---

# APPENDIX A — File and Line References

| Issue | File | Approx. Lines |
|-------|------|---------------|
| user-select | index.html | 12 |
| Theme toggle | index.html | 1692–1696, 2865 |
| Chart type | index.html | 4716–4726, 4740–4746 |
| setDraw / clearDrawings | index.html | 2960–2966 |
| Monkey-patch switchView | index.html | 4755–4760 |
| initMiniPositions inline | index.html | 2779–2790 |
| initSidebarNews inline | index.html | 2802–2806 |
| Resize handler | index.html | 3103–3106 |
| Command palette | index.html | 2727–2797, 3090–3097 |
| Nav groups | index.html | 440, 469, 490, 519 |

---

# APPENDIX B — Recommended CSS Variables for Light Theme

```css
[data-theme="light"] {
  --bg0: #FFFFFF;
  --bg1: #F5F6F8;
  --bg2: #E8EAED;
  --bg3: #DCE0E5;
  --bg4: #D1D4DC;
  --bdr: #C5C9D1;
  --bdr-a: #B0B4BC;
  --tx: #131722;
  --tx2: #5D606B;
  --tx3: #787B86;
  --brand: #2962FF;
  --up: #089981;
  --dn: #F23645;
  /* ... adjust shadows, etc. */
}
```

---

*Document generated from codebase audit. Last updated March 2025.*
