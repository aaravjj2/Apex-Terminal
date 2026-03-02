# Mobile and Responsive Usage Guide

> Use Apex Terminal on tablets and phones with touch-optimized interactions.

Apex Terminal is built responsive-first using Tailwind v4 breakpoints. While the full desktop experience is optimal, the platform adapts gracefully to smaller screens with simplified layouts and touch gestures.

---

## Table of Contents

1. [Responsive Breakpoints](#responsive-breakpoints)
2. [Touch Gestures](#touch-gestures)
3. [Mobile Layout Adaptations](#mobile-layout-adaptations)
4. [Chart Interaction on Mobile](#chart-interaction-on-mobile)
5. [Quick Trade from Mobile](#quick-trade-from-mobile)
6. [Mobile Navigation](#mobile-navigation)
7. [Limitations](#limitations)
8. [Tips](#tips)

---

## Responsive Breakpoints

The interface adapts at these screen widths:

| Breakpoint | Width | Layout Behavior |
|------------|-------|-----------------|
| **Desktop** | ≥ 1280px | Full multi-panel workspace with all features |
| **Laptop** | 1024–1279px | Reduced sidebar, panels stack vertically |
| **Tablet** | 768–1023px | Single-panel view with tab navigation |
| **Mobile** | < 768px | Simplified single-column layout |

The platform detects your screen size on load and switches layouts automatically. You can also force a layout via Settings → Appearance → Layout Mode.

---

## Touch Gestures

The chart and panels support standard touch interactions:

| Gesture | Action |
|---------|--------|
| **Single tap** | Select item, place crosshair |
| **Double tap** | Auto-scale chart / zoom to fit |
| **Pinch** | Zoom in/out on chart |
| **Two-finger drag** | Pan chart horizontally and vertically |
| **Long press** | Open context menu (equivalent to right-click) |
| **Swipe left/right** | Navigate between tabs on mobile |
| **Swipe down** | Pull-to-refresh data |

> **Note:** Drawing tools require tap-and-hold to place anchor points. Two taps to finish a drawing.

---

## Mobile Layout Adaptations

On screens below 768px, the following changes take effect:

- **Sidebar collapses** to a bottom tab bar with icons for Watchlist, Chart, Orders, Portfolio, and More.
- **Multi-panel workspaces** simplify to a single active panel with tab switching.
- **Command bar** is accessible via the search icon in the top bar (instead of Ctrl+K).
- **Indicator panel** opens as a full-screen overlay.
- **Order ticket** opens as a bottom sheet instead of a side panel.
- **Tables** become horizontally scrollable with pinned first columns.

![Mobile Layout](../assets/screenshots/mobile-layout.png)

---

## Chart Interaction on Mobile

The chart is fully interactive on touch devices:

1. **Pan and zoom** using pinch and two-finger drag.
2. **Crosshair** appears on single tap. Tap elsewhere to move it.
3. **Timeframe selector** moves to a horizontal scrollable strip above the chart.
4. **Indicators** — tap the "fx" button to open the indicator overlay. Tap an indicator to add it.
5. **Drawing tools** — tap the pencil icon to open the drawing toolbar as a bottom sheet. Select a tool, then tap the chart to place points.

The OHLCV legend appears in a condensed format at the top of the chart.

> **Tip:** Rotate your device to landscape mode for a wider chart view with more visible bars.

---

## Quick Trade from Mobile

Place orders quickly on mobile:

1. Tap the **Trade** button in the bottom tab bar (or long-press a price on the chart).
2. The order ticket opens as a bottom sheet.
3. Confirm the symbol and side (Buy/Sell toggle).
4. Enter quantity. For limit orders, set the price.
5. Tap **Submit**. A confirmation toast appears.

The mobile order ticket is streamlined — advanced order types (bracket, OCO) are available under the "Advanced" toggle.

![Mobile Order Ticket](../assets/screenshots/mobile-order-ticket.png)

---

## Mobile Navigation

On small screens, navigation uses a bottom tab bar:

| Tab | Icon | Content |
|-----|------|---------|
| **Watchlist** | Star | Symbol list with mini-quotes |
| **Chart** | Candlestick | Active chart with indicators |
| **Trade** | Arrow | Order ticket and blotter |
| **Portfolio** | Briefcase | Holdings and P&L |
| **More** | Hamburger | Settings, alerts, screener, news, etc. |

Swipe between tabs or tap icons. The "More" tab opens a full menu for secondary features.

---

## Limitations

Some features are reduced or unavailable on mobile:

| Feature | Mobile Status |
|---------|--------------|
| Multi-panel workspaces | Not available — single panel with tabs |
| Complex drawing tools | Available but less precise on small screens |
| Bloomberg command bar | Available via search icon, no Ctrl+K |
| Options strategy builder | Simplified view — desktop recommended |
| Backtester | View-only results — configuration on desktop |
| Vim-style key sequences | Not available (no physical keyboard) |
| Panel resizing | Not applicable — automatic layout |
| Keyboard shortcuts | Limited to on-screen controls |

> **Note:** For full functionality, use a desktop or laptop. Mobile is optimized for monitoring, quick trades, and alerts.

---

## Tips

- **Use landscape mode** for charting — it provides significantly more chart real estate.
- **Add to home screen** — on both iOS and Android, you can "Add to Home Screen" for an app-like experience.
- **Enable push notifications** — so alerts work even when the browser tab is in the background.
- **Use the watchlist as your hub** — it's the fastest way to navigate between symbols on mobile.
- **Monitor, don't analyze** — use mobile for monitoring positions and quick actions. Save deep analysis for desktop.
- **Reduce indicators on mobile** — 2–3 indicators maximum for readable charts on small screens.

---

*Next: [Data Sources](DATA_SOURCES.md) to configure your market data providers.*
