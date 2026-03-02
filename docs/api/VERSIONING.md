# API Versioning

URL path-based versioning strategy with structured deprecation policy, version negotiation, and backward compatibility guarantees.

## Table of Contents

- [Versioning Strategy](#versioning-strategy)
- [Version Format](#version-format)
- [URL Structure](#url-structure)
- [Version Negotiation](#version-negotiation)
- [Active Versions](#active-versions)
- [Deprecation Policy](#deprecation-policy)
- [Backward Compatibility](#backward-compatibility-rules)
- [Migration Guides](#migration-guides)
- [Version Headers](#version-headers)

## Versioning Strategy

Apex Terminal uses **URL path versioning** for clarity and cacheability. The version prefix appears immediately after `/api/`:

```
/api/v1/market-data/AAPL/quote
/api/v2/market-data/AAPL/quote
```

During the development phase, endpoints without a version prefix (e.g., `/api/market-data/...`) are aliased to the current stable version. In production, explicit versioning is required.

## Version Format

Versions follow a simplified semver scheme:

| Component | Description | Example |
|-----------|-------------|---------|
| Major (`vN`) | Breaking changes to request/response contracts | `v1` → `v2` |
| Minor | Additive, non-breaking changes (new fields, endpoints) | Transparent |
| Patch | Bug fixes, performance improvements | Transparent |

Only **major** versions appear in the URL. Minor and patch changes are deployed transparently with no version bump.

## URL Structure

```
https://api.apex-terminal.com/api/v1/{resource}/{sub-resource}
                                ^^^^ ^^
                                base version
```

In development, the Vite proxy maps:
```
http://localhost:5100/api/v1/* → http://localhost:8000/api/v1/*
http://localhost:5100/ws       → ws://localhost:8000/ws
```

## Version Negotiation

The server respects the version in the URL path. Additional negotiation is available via headers:

| Header | Direction | Description |
|--------|-----------|-------------|
| `X-API-Version` | Request | Override URL version (for testing) |
| `X-API-Version` | Response | Actual version that served the request |
| `X-API-Deprecated` | Response | `true` if endpoint version is deprecated |
| `X-API-Sunset` | Response | ISO 8601 date when this version will be removed |

```typescript
// Request with version header override
const response = await client.get('/api/v1/market-data/AAPL/quote', {
  headers: { 'X-API-Version': 'v2' },
});

// Response headers for deprecated endpoint
{
  'X-API-Version': 'v1',
  'X-API-Deprecated': 'true',
  'X-API-Sunset': '2026-09-01T00:00:00Z'
}
```

## Active Versions

| Version | Status | Released | Sunset Date |
|---------|--------|----------|-------------|
| `v1` | Deprecated | 2025-01-15 | 2026-09-01 |
| `v2` | Stable (current) | 2025-10-01 | — |
| `v3` | Beta | 2026-02-01 | — |

- **Stable**: Fully supported, receives bug fixes
- **Deprecated**: Still functional, receives critical security fixes only
- **Beta**: Available for testing, may have breaking changes
- **Sunset**: Removed — requests return `410 Gone`

## Deprecation Policy

1. **Announcement**: Deprecation is announced at least 6 months before sunset via changelog, API response headers, and email to registered developers
2. **Warning Period**: Deprecated endpoints return `X-API-Deprecated: true` and `X-API-Sunset` headers on every response
3. **Migration Window**: At least 6 months between deprecation announcement and sunset
4. **Sunset**: After the sunset date, requests to the deprecated version return:

```typescript
// HTTP 410 Gone
{
  "code": 4300,
  "message": "API v1 has been sunset. Please migrate to v2.",
  "details": {
    "sunsetDate": "2026-09-01",
    "migrationGuide": "https://docs.apex-terminal.com/migration/v1-to-v2",
    "currentVersion": "v2"
  }
}
```

## Backward Compatibility Rules

Changes that **do not** require a version bump (non-breaking):

- Adding new optional fields to response objects
- Adding new endpoints
- Adding new optional query parameters
- Adding new enum values to response fields
- Increasing rate limits
- Relaxing validation constraints

Changes that **do** require a major version bump (breaking):

- Removing or renaming response fields
- Changing field types (e.g., `string` → `number`)
- Removing endpoints
- Changing URL path structure
- Making previously optional parameters required
- Changing authentication mechanism
- Changing error response format
- Reducing rate limits

## Migration Guides

### v1 → v2 Summary

| Area | v1 | v2 |
|------|-----|-----|
| Quote response | Flat object | Nested `quote` and `meta` objects |
| Order creation | `qty` field | Renamed to `quantity` |
| Pagination | Offset-based only | Cursor-based (with offset fallback) |
| Error format | `{ error: string }` | `{ code, message, details }` |
| Auth | API key header | JWT Bearer token |
| WebSocket | Separate auth endpoint | Inline auth message |

```typescript
// v1 quote response (deprecated)
{ symbol: 'AAPL', price: 192.45, volume: 42315600, ... }

// v2 quote response (current)
{
  quote: { symbol: 'AAPL', price: 192.45, bid: 192.44, ask: 192.46, ... },
  meta: { exchange: 'NASDAQ', marketStatus: 'open', timestamp: 1709312400000 }
}
```

## Version Headers

The API client in `client.ts` automatically sets the version header:

```typescript
client.defaults.headers.common['X-API-Version'] = 'v2';

client.interceptors.response.use((response) => {
  if (response.headers['x-api-deprecated'] === 'true') {
    console.warn(
      `API endpoint deprecated. Sunset: ${response.headers['x-api-sunset']}. ` +
      `Migrate to the latest version.`
    );
  }
  return response;
});
```
