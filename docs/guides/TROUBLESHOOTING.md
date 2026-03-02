# Troubleshooting

> Solutions for common issues you may encounter in Apex Terminal.

This guide covers the most frequently reported problems, their causes, and step-by-step fixes. If your issue isn't listed here, check the [FAQ](FAQ.md) or open a GitHub issue.

---

## Table of Contents

1. [WebSocket Connection Failures](#websocket-connection-failures)
2. [Chart Not Loading](#chart-not-loading)
3. [Slow Performance](#slow-performance)
4. [Data Not Updating](#data-not-updating)
5. [Login and Authentication Issues](#login-and-authentication-issues)
6. [Browser Compatibility](#browser-compatibility)
7. [Clearing Cache and Storage](#clearing-cache-and-storage)
8. [Backend Startup Errors](#backend-startup-errors)
9. [Build and Compilation Errors](#build-and-compilation-errors)
10. [Still Stuck?](#still-stuck)

---

## WebSocket Connection Failures

**Symptoms:** Real-time data not streaming, connection status indicator shows red, console shows WebSocket errors.

**Causes and Fixes:**

| Cause | Fix |
|-------|-----|
| Backend not running | Start the backend: `uvicorn main:app --reload --port 8000` |
| Wrong WS URL | Check `VITE_WS_URL` in `frontend/.env` matches the backend |
| Firewall blocking | Allow port 8000 in your firewall settings |
| Proxy interference | If behind a corporate proxy, configure WebSocket passthrough |
| Browser extension blocking | Disable ad-blockers or privacy extensions temporarily |

Test the connection manually:

```javascript
const ws = new WebSocket('ws://localhost:8000/ws');
ws.onopen = () => console.log('Connected');
ws.onerror = (e) => console.error('Failed', e);
```

---

## Chart Not Loading

**Symptoms:** Chart area is blank, spinner that never resolves, or error message in the chart panel.

**Steps to resolve:**

1. **Check the console** — Open DevTools (F12) → Console. Look for errors related to `lightweight-charts` or data fetching.
2. **Verify the symbol** — Ensure the symbol exists in your data source. Try a common ticker like `AAPL`.
3. **Check the backend** — Verify `http://localhost:8000/api/v1/bars/AAPL?timeframe=1D` returns data.
4. **Clear chart cache** — Settings → Advanced → Clear Chart Cache.
5. **Reset chart state** — Right-click the chart panel → **Reset Panel**.

> **Tip:** If only specific symbols fail, the issue is likely missing data on the backend, not a frontend bug.

---

## Slow Performance

**Symptoms:** UI lag, delayed chart updates, slow panel resizing, high memory usage.

**Optimization steps:**

1. **Reduce open panels** — Each panel consumes memory. Close unused panels.
2. **Limit indicators** — More than 5–6 indicators per chart significantly impacts rendering.
3. **Reduce chart history** — Shorten the visible date range. Rendering 10 years of daily data is heavy.
4. **Disable animations** — Settings → Appearance → Disable Animations.
5. **Check browser memory** — Open Task Manager (Shift+Esc in Chrome). If a tab exceeds 1 GB, consider refreshing.
6. **Use Chrome or Edge** — They have the best performance with canvas-heavy applications.
7. **Close DevTools** — The DevTools console logging can slow down the application noticeably.

| Scenario | Expected Memory |
|----------|----------------|
| Single chart, few indicators | 200–400 MB |
| Multi-chart (4 panels) | 400–800 MB |
| Full workspace (6+ panels) | 800 MB–1.2 GB |

---

## Data Not Updating

**Symptoms:** Prices are stale, last candle not updating, watchlist frozen.

**Steps:**

1. **Check WebSocket** — Look at the connection indicator in the bottom bar. Green = connected.
2. **Check market hours** — Data won't update outside trading hours unless using a 24/7 data source.
3. **Refresh the subscription** — Click the symbol field and re-select the same symbol.
4. **Restart the backend** — The data provider connection may have dropped server-side.
5. **Check data source status** — Visit your data provider's status page to confirm their API is operational.

---

## Login and Authentication Issues

**Symptoms:** Can't log in, token expired errors, 401 responses.

| Issue | Fix |
|-------|-----|
| Wrong credentials | Verify username/password. Reset via Settings if needed. |
| Token expired | Re-authenticate. Tokens expire after 1 hour by default. |
| CORS error on login | Ensure `CORS_ORIGINS` in backend `.env` includes the frontend URL |
| Cookies blocked | Ensure third-party cookies are enabled or use token-based auth |

---

## Browser Compatibility

Apex Terminal is tested on:

| Browser | Version | Status |
|---------|---------|--------|
| Chrome | 110+ | Fully supported |
| Edge | 110+ | Fully supported |
| Firefox | 115+ | Supported (minor canvas differences) |
| Safari | 16+ | Supported (WebSocket may need HTTPS in production) |
| Mobile Chrome | Latest | Responsive mode supported |
| Mobile Safari | Latest | Responsive mode supported |

> **Note:** Internet Explorer is not supported. Apex Terminal uses modern APIs (WebSocket, IndexedDB, Web Workers, ResizeObserver) that require a modern browser.

---

## Clearing Cache and Storage

If you experience persistent issues after updates:

1. **Clear IndexedDB:** Settings → Advanced → Clear All Data. This removes saved workspaces, chart templates, and preferences.
2. **Clear browser cache:** Hard refresh with `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac).
3. **Clear localStorage:** DevTools → Application → Local Storage → right-click → Clear.
4. **Full reset:** Delete the site data entirely from browser settings.

> **Warning:** Clearing IndexedDB removes all saved workspaces and preferences. Export your workspaces first if you want to preserve them.

---

## Backend Startup Errors

| Error | Fix |
|-------|-----|
| `ModuleNotFoundError` | Run `pip install -r requirements.txt` in the backend venv |
| `Address already in use` | Kill the process on port 8000: `lsof -i :8000` then `kill <PID>` |
| `Database error` | Delete `apex.db` and restart to recreate the schema |
| `Connection refused` on data provider | Check API keys in backend `.env` |

---

## Build and Compilation Errors

| Error | Fix |
|-------|-----|
| TypeScript errors after pull | Run `npm install` to update dependencies |
| Tailwind classes not applying | Ensure `tailwind.config.ts` includes all content paths |
| Vite HMR not working | Restart the dev server. Check for syntax errors in recent edits. |
| `Out of memory` during build | Increase Node memory: `NODE_OPTIONS=--max-old-space-size=4096 npm run build` |

---

## Still Stuck?

1. Search existing [GitHub Issues](https://github.com/your-org/apex-terminal/issues) for your problem.
2. Check the [FAQ](FAQ.md) for answers to common questions.
3. Open a new issue with: browser version, OS, console errors, and steps to reproduce.
4. Join the community Discord for real-time help.

---

*Next: [FAQ](FAQ.md) for frequently asked questions.*
