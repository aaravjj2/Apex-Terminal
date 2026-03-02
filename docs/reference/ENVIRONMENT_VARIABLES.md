# Environment Variables Reference

> All configuration variables used by Apex Terminal, with types, defaults, and descriptions.

## Table of Contents

- [Overview](#overview)
- [Client Variables (VITE\_)](#client-variables-vite_)
- [Build-Time Variables](#build-time-variables)
- [Server / CI Variables](#server--ci-variables)
- [Feature Flags](#feature-flags)
- [Configuration Files](#configuration-files)
- [Security Notes](#security-notes)

---

## Overview

Apex Terminal uses Vite's environment variable system. Only variables prefixed with `VITE_` are exposed to client-side code. All others are available only during the build process.

### Precedence (highest to lowest)

1. CLI overrides: `VITE_API_URL=https://api.example.com vite build`
2. `.env.local` — local overrides, git-ignored
3. `.env.[mode]` — mode-specific (`.env.development`, `.env.production`)
4. `.env` — base defaults

---

## Client Variables (VITE_)

These variables are embedded into the client bundle at build time and accessible via `import.meta.env.VITE_*`.

| Variable | Type | Default | Required | Description |
|----------|------|---------|----------|-------------|
| `VITE_API_URL` | `string` (URL) | `http://localhost:3001/api` | Yes | Base URL for the REST API. Must include protocol and path prefix. No trailing slash. |
| `VITE_WS_URL` | `string` (URL) | `ws://localhost:3001/ws` | Yes | WebSocket endpoint for real-time market data and order updates. Supports `ws://` and `wss://`. |
| `VITE_APP_TITLE` | `string` | `Apex Terminal` | No | Application title shown in the browser tab and header. |
| `VITE_DEFAULT_SYMBOL` | `string` | `AAPL` | No | Symbol loaded on first visit when no saved state exists. |
| `VITE_DEFAULT_INTERVAL` | `string` | `1D` | No | Default chart timeframe. Valid values: `1m`, `5m`, `15m`, `1h`, `4h`, `1D`, `1W`, `1M`. |
| `VITE_ANALYTICS_KEY` | `string` | _(empty)_ | No | Analytics provider API key. If empty, analytics are disabled entirely. No data is collected. |
| `VITE_ANALYTICS_PROVIDER` | `string` | `none` | No | Analytics backend: `none`, `posthog`, `plausible`, `mixpanel`. |
| `VITE_SENTRY_DSN` | `string` | _(empty)_ | No | Sentry DSN for error tracking. If empty, Sentry is not initialized. |
| `VITE_FEATURE_FLAGS` | `string` (JSON) | `{}` | No | JSON string of feature flag overrides. See [Feature Flags](#feature-flags). |
| `VITE_MAX_WS_RECONNECT` | `number` | `5` | No | Maximum WebSocket reconnection attempts before showing error. |
| `VITE_WS_RECONNECT_DELAY` | `number` | `2000` | No | Base delay (ms) between reconnection attempts. Exponential backoff is applied. |
| `VITE_PAPER_TRADING_ONLY` | `boolean` | `false` | No | When `true`, disables live trading entirely. Only paper trading is available. |
| `VITE_LOG_LEVEL` | `string` | `warn` | No | Client-side logging verbosity: `debug`, `info`, `warn`, `error`, `silent`. |

---

## Build-Time Variables

Injected by Vite during the build process. Not prefixed with `VITE_` but available via `import.meta.env`.

| Variable | Type | Source | Description |
|----------|------|--------|-------------|
| `VITE_GIT_SHA` | `string` | `git rev-parse --short HEAD` | Short commit hash, injected via `vite.config.ts` define block. Used in version display and error reports. |
| `VITE_BUILD_TIME` | `string` (ISO 8601) | `new Date().toISOString()` | Build timestamp. Shown in Settings → About. |
| `MODE` | `string` | Vite CLI | Current mode: `development`, `production`, `test`. |
| `DEV` | `boolean` | Vite | `true` in development mode. |
| `PROD` | `boolean` | Vite | `true` in production mode. |
| `SSR` | `boolean` | Vite | Always `false` (Apex Terminal is client-only). |
| `BASE_URL` | `string` | `vite.config.ts` → `base` | Base path for deployment (default `/`). |

### vite.config.ts Injection

```typescript
export default defineConfig({
  define: {
    __GIT_SHA__: JSON.stringify(
      execSync('git rev-parse --short HEAD').toString().trim()
    ),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
});
```

---

## Server / CI Variables

Used only in CI pipelines and server-side scripts. Never exposed to the client.

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `NODE_ENV` | `string` | `development` | Runtime environment. Set to `production` for optimized builds. |
| `CI` | `boolean` | `false` | Set to `true` in CI pipelines. Disables interactive prompts, enables stricter lint. |
| `PLAYWRIGHT_BASE_URL` | `string` | `http://localhost:5173` | Base URL for E2E tests. |
| `COVERAGE_DIR` | `string` | `./coverage` | Output directory for test coverage reports. |
| `DEPLOY_TARGET` | `string` | _(none)_ | Deployment target: `vercel`, `netlify`, `cloudflare`, `s3`. |
| `DEPLOY_TOKEN` | `string` | _(none)_ | Deployment authentication token. |
| `NPM_TOKEN` | `string` | _(none)_ | npm registry auth for private packages. |

---

## Feature Flags

Feature flags control experimental or gradually-rolled-out functionality. Set via `VITE_FEATURE_FLAGS` as a JSON string.

### Available Flags

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `bloomberg_mode` | `boolean` | `true` | Enable Bloomberg-style terminal interface |
| `ml_predictions` | `boolean` | `true` | Show ML price predictions on chart |
| `social_feed` | `boolean` | `true` | Enable social trading feed |
| `options_analytics` | `boolean` | `true` | Enable options pricing and Greeks |
| `advanced_orders` | `boolean` | `false` | Enable TWAP/VWAP algorithmic orders |
| `voice_control` | `boolean` | `false` | Enable voice command input |
| `ai_copilot` | `boolean` | `false` | Enable AI trading assistant |
| `debug_overlays` | `boolean` | `false` | Show render count and performance overlays |

### Setting Flags

```bash
# .env.local
VITE_FEATURE_FLAGS='{"ai_copilot": true, "debug_overlays": true}'
```

### Runtime Access

```typescript
import { useFeatureFlag } from '@/hooks/useFeatureFlags';

const isEnabled = useFeatureFlag('ai_copilot'); // boolean
```

---

## Configuration Files

| File | Git-tracked | Purpose |
|------|-------------|---------|
| `.env` | Yes | Base defaults for all environments |
| `.env.development` | Yes | Development-specific overrides |
| `.env.production` | Yes | Production-specific overrides |
| `.env.test` | Yes | Test-specific overrides |
| `.env.local` | No | Local developer overrides (git-ignored) |
| `.env.development.local` | No | Local dev overrides (git-ignored) |
| `.env.production.local` | No | Local prod overrides (git-ignored) |

---

## Security Notes

1. **Never commit secrets to `.env` files that are git-tracked.** Use `.env.local` or CI environment variables for API keys and tokens.
2. **`VITE_` variables are public.** They are embedded in the JavaScript bundle and visible to anyone who inspects the source. Never put server-side secrets in `VITE_` variables.
3. **`VITE_ANALYTICS_KEY`** is safe to expose — analytics keys are designed to be client-facing.
4. **`VITE_SENTRY_DSN`** is safe to expose — Sentry DSNs are public by design.
5. **`DEPLOY_TOKEN` and `NPM_TOKEN`** must only be set in CI secrets, never in `.env` files.

---

*See `vite.config.ts` for the full build configuration and variable injection logic.*
