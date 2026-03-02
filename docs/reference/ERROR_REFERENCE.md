# Error Code Reference

> Complete catalog of error codes, messages, and resolution steps for Apex Terminal.

## Table of Contents

- [Error Format](#error-format)
- [Authentication (1000–1099)](#authentication-10001099)
- [Authorization (1100–1199)](#authorization-11001199)
- [Trading (2000–2099)](#trading-20002099)
- [Market Data (3000–3099)](#market-data-30003099)
- [Options (3100–3199)](#options-31003199)
- [Portfolio (3200–3299)](#portfolio-32003299)
- [System (4000–4099)](#system-40004099)
- [Client / UI (5000–5099)](#client--ui-50005099)

---

## Error Format

All errors follow a consistent structure:

```typescript
interface AppError {
  code: number;        // Numeric error code
  domain: string;      // Error domain (auth, trading, data, system)
  message: string;     // Human-readable message
  details?: string;    // Additional context
  timestamp: string;   // ISO 8601
  recoverable: boolean;
}
```

Errors are logged to the activity log (`LOG` command) and shown via toast notifications.

---

## Authentication (1000–1099)

| Code | Message | Cause | Resolution |
|------|---------|-------|------------|
| 1000 | Session expired | JWT token has expired | Re-authenticate; app will redirect to login |
| 1001 | Invalid credentials | Wrong username or password | Verify credentials and retry |
| 1002 | Account locked | Too many failed login attempts | Wait 15 minutes or contact support |
| 1003 | Token refresh failed | Refresh token is invalid or expired | Log out and log back in |
| 1004 | MFA required | Multi-factor authentication not provided | Complete MFA challenge |
| 1005 | MFA verification failed | Incorrect MFA code | Re-enter the code from your authenticator |
| 1006 | Session conflict | Active session detected on another device | Confirm to invalidate the other session |
| 1010 | API key invalid | API key does not exist or was revoked | Generate a new API key in Settings |
| 1011 | API key rate limited | Too many requests with this key | Reduce request frequency; see rate limits |

---

## Authorization (1100–1199)

| Code | Message | Cause | Resolution |
|------|---------|-------|------------|
| 1100 | Insufficient permissions | User role lacks required permission | Contact account admin to upgrade role |
| 1101 | Feature not available | Feature not included in current plan | Upgrade subscription tier |
| 1102 | Paper trading only | Account restricted to paper trading | Switch to paper mode or upgrade to live |
| 1103 | Read-only mode | Account is in read-only state | Contact support; may be a compliance hold |
| 1110 | IP not whitelisted | Request from non-whitelisted IP | Add IP to whitelist in Settings → Security |
| 1111 | Geo-restricted | Service not available in your region | Use a supported region or VPN |

---

## Trading (2000–2099)

| Code | Message | Cause | Resolution |
|------|---------|-------|------------|
| 2000 | Insufficient buying power | Not enough cash/margin for the order | Reduce quantity or deposit funds |
| 2001 | Invalid order parameters | Missing or malformed order fields | Check symbol, quantity, price, type |
| 2002 | Symbol not tradeable | Symbol is halted, delisted, or unsupported | Verify symbol status; try later if halted |
| 2003 | Market closed | Order submitted outside trading hours | Wait for market open or enable extended hours |
| 2004 | Price out of range | Limit price exceeds exchange price bands | Adjust price closer to current market |
| 2005 | Quantity exceeds limit | Order size exceeds per-order maximum | Reduce quantity or split into multiple orders |
| 2006 | Duplicate order | Identical order submitted within 1 second | Wait before resubmitting; check if first filled |
| 2007 | Order not found | Cancel/modify request for nonexistent order | Order may have already filled or expired |
| 2008 | Order not modifiable | Order is in a terminal state | Submit a new order instead |
| 2010 | Position limit exceeded | Opening this order would exceed max position | Close existing positions first |
| 2011 | Short selling restricted | Short sales not allowed for this security | Check regulation and borrow availability |
| 2020 | Bracket order invalid | SL or TP price is on the wrong side | Ensure SL < entry (long) and TP > entry (long) |
| 2021 | OCO conflict | One-cancels-other orders reference same side | Verify OCO pair has opposing triggers |
| 2030 | PDT restriction | Pattern Day Trader rule violation (< $25K) | Maintain $25K equity or reduce day trades |

---

## Market Data (3000–3099)

| Code | Message | Cause | Resolution |
|------|---------|-------|------------|
| 3000 | Symbol not found | Ticker does not exist in the data provider | Check spelling; use search for suggestions |
| 3001 | Data unavailable | No data for the requested time range | Widen the date range or try a different interval |
| 3002 | WebSocket disconnected | Lost connection to real-time data feed | App will auto-reconnect; check network |
| 3003 | WebSocket reconnect failed | Auto-reconnect exhausted all retries (5) | Reload the page or check connectivity |
| 3004 | Rate limit exceeded | Too many data requests per minute | Slow down requests; default limit is 120/min |
| 3005 | Stale data warning | Data has not updated in > 60 seconds | May indicate upstream feed issue |
| 3010 | Historical data timeout | Request for historical bars timed out | Reduce date range or try again later |
| 3011 | Snapshot unavailable | Quote snapshot failed | Retry; may be a transient API issue |

---

## Options (3100–3199)

| Code | Message | Cause | Resolution |
|------|---------|-------|------------|
| 3100 | Options chain unavailable | No options data for this underlying | Symbol may not have listed options |
| 3101 | Expiration not found | Requested expiry does not exist | Use the options chain picker for valid dates |
| 3102 | IV calculation failed | Newton-Raphson did not converge | Likely deep OTM or illiquid; price may be stale |
| 3103 | Greeks computation error | Invalid inputs to Greek formulas | Check that T > 0 and σ > 0 |
| 3110 | Monte Carlo timeout | Simulation exceeded time budget (5s) | Reduce path count or simplify payoff |

---

## Portfolio (3200–3299)

| Code | Message | Cause | Resolution |
|------|---------|-------|------------|
| 3200 | Portfolio sync failed | Could not fetch latest positions from broker | Retry; check API key permissions |
| 3201 | Attribution error | Benchmark data missing for attribution window | Ensure benchmark symbol is valid and has data |
| 3202 | Risk calculation failed | Covariance matrix is singular | Add more diversified positions or shorten window |
| 3210 | Backtest data gap | Missing OHLCV data during backtest period | Adjust date range to avoid gaps |
| 3211 | Backtest timeout | Simulation exceeded 30-second limit | Reduce date range or simplify strategy |

---

## System (4000–4099)

| Code | Message | Cause | Resolution |
|------|---------|-------|------------|
| 4000 | Internal error | Unhandled exception | Report bug with error details |
| 4001 | Service unavailable | Backend API is down or unreachable | Check status page; retry later |
| 4002 | Request timeout | API request exceeded 30-second timeout | Retry; consider smaller payload |
| 4003 | Configuration error | Missing or invalid environment variable | Check `.env` file; see ENVIRONMENT_VARIABLES.md |
| 4010 | IndexedDB unavailable | Browser does not support IndexedDB | Use a supported browser; see BROWSER_SUPPORT.md |
| 4011 | IndexedDB quota exceeded | Local storage limit reached | Clear old data in Settings → Storage |
| 4012 | Web Worker failed | Worker script failed to initialize | Reload the app; check for CSP issues |
| 4020 | Build version mismatch | Client version does not match API version | Hard refresh (`Ctrl+Shift+R`) to load latest build |

---

## Client / UI (5000–5099)

| Code | Message | Cause | Resolution |
|------|---------|-------|------------|
| 5000 | Chart render error | Canvas rendering failed | Resize the panel or reload; check GPU drivers |
| 5001 | Layout restore failed | Saved layout JSON is corrupted | Reset layout in Settings → Workspace |
| 5002 | Theme load error | Custom theme file is malformed | Revert to default theme |
| 5003 | Shortcut conflict | Two actions bound to the same key combo | Resolve in Settings → Keyboard |
| 5010 | Export failed | PNG/CSV/PDF export could not complete | Check disk space and browser permissions |
| 5011 | Clipboard error | Could not write to clipboard | Grant clipboard permission in browser |
| 5020 | Component mount error | React component failed to mount | Check console for stack trace; report bug |

---

*Errors are defined in `frontend/src/lib/utils/errors.ts` and handled by the global error boundary.*
