# Security

> Authentication, authorization, and defense-in-depth strategies protecting the Apex Terminal platform and its users' financial data.

---

## Table of Contents

- [Overview](#overview)
- [Authentication Flow](#authentication-flow)
- [JWT & Token Management](#jwt--token-management)
- [API Client Auth Interceptors](#api-client-auth-interceptors)
- [XSS Prevention](#xss-prevention)
- [CSRF Protection](#csrf-protection)
- [Input Validation](#input-validation)
- [Content Security Policy](#content-security-policy)
- [Secure WebSocket Connections](#secure-websocket-connections)
- [Permission Checks](#permission-checks)
- [Data Encryption](#data-encryption)

---

## Overview

Apex Terminal handles sensitive financial data, trade execution, and personal portfolio information. Security is enforced at every layer: the FastAPI backend authenticates requests, the frontend sanitizes all user input, WebSocket connections are authenticated, and client-side storage is scoped to prevent cross-origin leakage.

---

## Authentication Flow

```
User Login
    │
    ▼
POST /api/auth/login { email, password }
    │
    ▼
FastAPI validates credentials → Issues JWT pair
    │
    ▼
Frontend stores tokens:
  - accessToken  → in-memory (Zustand authStore)
  - refreshToken → httpOnly secure cookie
    │
    ▼
All subsequent API calls include Authorization header
```

The access token is intentionally **not** stored in `localStorage` or `sessionStorage` to prevent XSS exfiltration. It lives only in the Zustand `authStore` in memory. On page refresh, a silent refresh flow exchanges the `httpOnly` cookie for a new access token.

---

## JWT & Token Management

| Token | Lifetime | Storage | Purpose |
|-------|----------|---------|---------|
| Access token | 15 minutes | In-memory (Zustand) | API authentication |
| Refresh token | 7 days | `httpOnly` secure cookie | Silent token renewal |

### Token Refresh

```typescript
async function refreshAccessToken(): Promise<string> {
  const response = await fetch('/api/auth/refresh', {
    method: 'POST',
    credentials: 'include', // sends httpOnly cookie
  });

  if (!response.ok) {
    useAuthStore.getState().logout();
    throw new Error('Session expired');
  }

  const { accessToken } = await response.json();
  useAuthStore.getState().setAccessToken(accessToken);
  return accessToken;
}
```

A background timer proactively refreshes the token 60 seconds before expiry, avoiding failed requests from clock drift.

---

## API Client Auth Interceptors

The `ApiClient` automatically attaches the access token and handles 401 responses:

```typescript
class ApiClient {
  private async request<T>(url: string, config: RequestConfig): Promise<T> {
    const token = useAuthStore.getState().accessToken;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    };

    const response = await fetch(url, { ...config, headers });

    if (response.status === 401) {
      const newToken = await refreshAccessToken();
      headers.Authorization = `Bearer ${newToken}`;
      return this.request(url, { ...config, headers });
    }

    if (!response.ok) throw new ApiError(response.status, await response.text());
    return response.json();
  }
}
```

Only one refresh attempt is made per failed request to prevent infinite loops. Concurrent 401 responses are deduplicated so only a single refresh call is issued.

---

## XSS Prevention

### React's Built-in Escaping

React escapes all dynamic content rendered via JSX by default. The codebase enforces a strict prohibition on `dangerouslySetInnerHTML`.

### User-Supplied Content

Bloomberg command-line input, alert names, and watchlist labels pass through a sanitization layer:

```typescript
export function sanitizeText(input: string): string {
  const div = document.createElement('div');
  div.textContent = input;
  return div.innerHTML;
}
```

### Third-Party Content

News articles and external data rendered in the news feed are sanitized with DOMPurify before rendering:

```typescript
import DOMPurify from 'dompurify';

function NewsArticle({ html }: { html: string }) {
  const clean = DOMPurify.sanitize(html, { ALLOWED_TAGS: ['b', 'i', 'a', 'p', 'br'] });
  return <div dangerouslySetInnerHTML={{ __html: clean }} />;
}
```

This is the **only** approved use of `dangerouslySetInnerHTML` in the codebase.

---

## CSRF Protection

- The `refreshToken` cookie is set with `SameSite=Strict`, preventing cross-origin submission
- All state-mutating API calls use `POST`/`PUT`/`DELETE` — never `GET`
- The FastAPI backend validates the `Origin` header on every mutating request
- API requests include a custom `X-Requested-With: ApexTerminal` header, which the backend requires on all non-GET endpoints

---

## Input Validation

### Client-Side Validation

Order entry and alert creation validate inputs before submission:

```typescript
function validateOrder(order: OrderInput): ValidationResult {
  const errors: string[] = [];

  if (order.quantity <= 0) errors.push('Quantity must be positive');
  if (order.quantity > 1_000_000) errors.push('Quantity exceeds maximum');
  if (order.type === 'limit' && !order.price) errors.push('Limit price required');
  if (order.price && order.price <= 0) errors.push('Price must be positive');
  if (!/^[A-Z]{1,5}$/.test(order.symbol)) errors.push('Invalid symbol format');

  return { valid: errors.length === 0, errors };
}
```

### Server-Side Validation

The FastAPI backend uses Pydantic models for strict schema enforcement. Client-side validation is a UX convenience — the backend is the authority.

---

## Content Security Policy

The production build serves pages with a restrictive CSP header:

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  connect-src 'self' wss://*.apexterminal.io https://*.apexterminal.io;
  font-src 'self';
  worker-src 'self' blob:;
  frame-src 'none';
```

Key points:
- `worker-src blob:` allows Vite's inline Web Worker bundling
- `connect-src` is scoped to the platform's own WebSocket and API endpoints
- `frame-src 'none'` prevents embedding in iframes (clickjacking defense)
- No `eval()` or inline scripts are used anywhere in the codebase

---

## Secure WebSocket Connections

WebSocket connections authenticate via the access token sent as a query parameter on the initial handshake:

```typescript
const ws = new WebSocket(`wss://api.apexterminal.io/ws?token=${accessToken}`);
```

The backend validates the token on connection upgrade. If the token expires mid-session, the client sends a `{ type: 'auth', token: newToken }` message after refreshing. Connections use `wss://` (TLS) exclusively in production.

---

## Permission Checks

Route-level and feature-level permission checks gate access to trading, admin, and premium features:

```typescript
function ProtectedRoute({ permission, children }: ProtectedRouteProps) {
  const permissions = useAuthStore((s) => s.permissions);

  if (!permissions.includes(permission)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
}

// Usage in router
<Route path="/trading" element={
  <ProtectedRoute permission="trade:execute">
    <TradingPage />
  </ProtectedRoute>
} />
```

Permissions are included in the JWT payload and verified on both client and server.

---

## Data Encryption

| Data | At Rest | In Transit |
|------|---------|------------|
| API requests | N/A | TLS 1.3 |
| WebSocket | N/A | WSS (TLS 1.3) |
| localStorage settings | Unencrypted (non-sensitive) | N/A |
| IndexedDB (backtest results) | Unencrypted (local only) | N/A |
| Passwords | bcrypt hash (server) | TLS 1.3 |
| Refresh token cookie | `httpOnly; Secure; SameSite=Strict` | TLS 1.3 |

Sensitive data like API keys for external market data providers are stored only on the backend and never exposed to the frontend. The client never handles raw credentials beyond the initial login form submission.
