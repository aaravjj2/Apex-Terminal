# Authentication

JWT-based authentication with access/refresh token rotation, automatic refresh via API client interceptors, and session management. All protected endpoints require a valid Bearer token.

## Table of Contents

- [Auth Flow Overview](#auth-flow-overview)
- [Endpoints](#endpoints)
- [Login](#post-login)
- [Token Refresh](#post-refresh-token)
- [Logout](#post-logout)
- [Token Structure](#token-structure)
- [API Client Interceptors](#api-client-interceptors)
- [Session Management](#session-management)
- [Error Handling](#error-handling)
- [Security Notes](#security-notes)

## Auth Flow Overview

1. User submits credentials via `POST /api/auth/login`
2. Server validates and returns an access token (short-lived) and refresh token (long-lived)
3. Client stores tokens — access token in memory, refresh token in httpOnly cookie
4. All API requests include `Authorization: Bearer <access_token>`
5. When access token expires, the client interceptor silently refreshes using the refresh token
6. On logout, both tokens are revoked server-side

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | Authenticate with credentials |
| POST | `/api/auth/refresh` | Refresh access token |
| POST | `/api/auth/logout` | Revoke tokens and end session |
| GET | `/api/auth/session` | Get current session info |
| POST | `/api/auth/revoke-all` | Revoke all sessions for user |

## POST Login

```typescript
interface LoginRequest {
  email: string;
  password: string;
  mfaCode?: string;          // Required if MFA is enabled
  deviceId?: string;         // For device-based session tracking
}

const auth = await client.post('/api/auth/login', {
  email: 'trader@example.com',
  password: 'securePassword123',
});

interface LoginResponse {
  accessToken: string;       // JWT, expires in 15 minutes
  refreshToken: string;      // Opaque token, expires in 7 days
  expiresIn: number;         // Access token TTL in seconds (900)
  tokenType: 'Bearer';
  user: {
    id: string;
    email: string;
    name: string;
    tier: 'free' | 'pro' | 'enterprise';
    mfaEnabled: boolean;
  };
}
```

## POST Refresh Token

Issues a new access token and rotates the refresh token (one-time use).

```typescript
interface RefreshRequest {
  refreshToken: string;
}

const tokens = await client.post('/api/auth/refresh', {
  refreshToken: currentRefreshToken,
});

interface RefreshResponse {
  accessToken: string;       // New access token
  refreshToken: string;      // New refresh token (old one is invalidated)
  expiresIn: number;
}
```

Refresh token rotation prevents replay attacks — each refresh token can only be used once. If a previously used refresh token is presented, the server revokes the entire token family and forces re-authentication.

## POST Logout

Invalidates both the access token and refresh token server-side.

```typescript
await client.post('/api/auth/logout');
// Returns 204 No Content
// Client clears stored tokens
```

## Token Structure

### Access Token (JWT)

```typescript
// Decoded JWT payload
interface AccessTokenPayload {
  sub: string;              // User ID
  email: string;
  tier: 'free' | 'pro' | 'enterprise';
  permissions: string[];    // ['trade', 'market_data', 'options', ...]
  iat: number;              // Issued at (Unix timestamp)
  exp: number;              // Expiration (Unix timestamp)
  jti: string;              // Unique token ID
  iss: 'apex-terminal';
}
```

### Token Lifetimes

| Token | Lifetime | Storage |
|-------|----------|---------|
| Access Token | 15 minutes | In-memory (Zustand store) |
| Refresh Token | 7 days | httpOnly cookie or secure storage |
| Session | 30 days | Server-side with activity extension |

## API Client Interceptors

The `client.ts` HTTP client handles token lifecycle automatically via Axios-style interceptors.

```typescript
// Request interceptor — attaches access token
client.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor — handles 401 with transparent refresh
client.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && !error.config._retry) {
      error.config._retry = true;
      const newTokens = await refreshAccessToken();
      error.config.headers.Authorization = `Bearer ${newTokens.accessToken}`;
      return client(error.config);  // Retry original request
    }
    return Promise.reject(error);
  }
);
```

Concurrent requests that trigger 401 are queued — only one refresh request is made, and all queued requests are retried with the new token.

## Session Management

```typescript
// GET /api/auth/session
interface SessionInfo {
  userId: string;
  tier: string;
  activeSessions: {
    id: string;
    deviceId: string;
    deviceName: string;
    ipAddress: string;
    lastActive: string;
    current: boolean;
  }[];
}

// POST /api/auth/revoke-all — ends all sessions except current
await client.post('/api/auth/revoke-all');
```

## Error Handling

| Status | Code | Description |
|--------|------|-------------|
| 401 | `1001` | Invalid credentials |
| 401 | `1002` | Access token expired |
| 401 | `1003` | Refresh token expired or revoked |
| 401 | `1004` | Token family revoked (possible theft detected) |
| 403 | `1005` | MFA code required |
| 403 | `1006` | Invalid MFA code |
| 429 | `1010` | Too many login attempts (locked for 15 minutes) |
| 403 | `1011` | Account suspended |

## Security Notes

- Access tokens are stateless JWTs validated via signature verification
- Refresh tokens are opaque and stored server-side with one-time-use enforcement
- Failed login attempts are rate-limited: 5 attempts per 15 minutes per email
- All tokens include a `jti` claim for individual revocation capability
- WebSocket authentication uses the same JWT — send via the `auth` message after connection
- CORS is configured to only allow the Vite dev server origin (`http://localhost:5100`)
