# Deployment

> Build pipeline, hosting, CI/CD, and release management for the Apex Terminal platform.

---

## Table of Contents

- [Overview](#overview)
- [Vite Build Process](#vite-build-process)
- [Git SHA Injection](#git-sha-injection)
- [Environment Configuration](#environment-configuration)
- [Static Asset Hosting & CDN](#static-asset-hosting--cdn)
- [FastAPI Backend Deployment](#fastapi-backend-deployment)
- [Docker](#docker)
- [CI/CD Pipeline](#cicd-pipeline)
- [Health Checks](#health-checks)
- [Rollback Strategy](#rollback-strategy)

---

## Overview

Apex Terminal deploys as two independent units: a static frontend served via CDN, and a FastAPI backend deployed as a containerized service. The frontend build is triggered by Git pushes, producing content-hashed assets optimized for aggressive caching. The backend runs in Docker containers behind a load balancer.

---

## Vite Build Process

The production build runs through Vite's optimized pipeline:

```bash
npm run build
# Equivalent to: vite build
```

Build output structure:

```
dist/
├── index.html             # Entry point with hashed asset references
├── assets/
│   ├── vendor-a3f2c1.js   # React, Zustand, router (~120KB gzipped)
│   ├── charts-b7e4d2.js   # lightweight-charts, Recharts (~80KB gzipped)
│   ├── core-c9f1a3.js     # Shared hooks, utils, components (~50KB gzipped)
│   ├── feature-*.js       # Lazy-loaded feature chunks (~15-40KB each)
│   └── index-d2e5f4.css   # Compiled Tailwind CSS
└── favicon.ico
```

### Chunk Strategy

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'zustand', 'react-router-dom', 'immer'],
          charts: ['lightweight-charts', 'recharts'],
        },
      },
    },
  },
});
```

Content-hashed filenames ensure browsers only re-download chunks that actually changed between deploys.

---

## Git SHA Injection

The build injects the current Git commit SHA for version tracking:

```bash
VITE_GIT_SHA=$(git rev-parse --short HEAD) vite build
```

This SHA is accessible at runtime:

```typescript
const buildVersion = import.meta.env.VITE_GIT_SHA ?? 'dev';

function AppFooter() {
  return <span className="text-xs text-zinc-500">Build {buildVersion}</span>;
}
```

It also appears in error reports sent to the monitoring service, enabling exact commit-to-bug mapping.

---

## Environment Configuration

Environment variables are managed per deployment stage:

| Variable | Dev | Staging | Production |
|----------|-----|---------|------------|
| `VITE_API_URL` | `http://localhost:8000` | `https://staging-api.apexterminal.io` | `https://api.apexterminal.io` |
| `VITE_WS_URL` | `ws://localhost:8000/ws` | `wss://staging-api.apexterminal.io/ws` | `wss://api.apexterminal.io/ws` |
| `VITE_GIT_SHA` | `dev` | CI-injected | CI-injected |
| `VITE_ENV` | `development` | `staging` | `production` |

Files: `.env`, `.env.staging`, `.env.production`. Only `VITE_`-prefixed variables are exposed to the frontend bundle.

---

## Static Asset Hosting & CDN

```
Client Browser
    │
    ▼
CDN Edge (CloudFront / Cloudflare)
    │  Cache-Control: public, max-age=31536000, immutable (hashed assets)
    │  Cache-Control: no-cache (index.html)
    ▼
Origin (S3 / GCS bucket)
```

- `index.html` is served with `Cache-Control: no-cache` to ensure clients always fetch the latest entry point
- Hashed asset files (`.js`, `.css`, images) are cached for 1 year with `immutable`
- Brotli compression is applied at the CDN edge for all text assets
- Deploy = upload new assets to bucket + invalidate `index.html` at CDN

---

## FastAPI Backend Deployment

The Python backend runs as a multi-worker ASGI application:

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

In production, the backend is deployed behind an nginx reverse proxy that handles TLS termination and routes `/api/*` and `/ws/*` to the FastAPI service.

---

## Docker

### Frontend Build Stage

```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_GIT_SHA
ARG VITE_ENV=production
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

### Backend

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
```

### Docker Compose (Development)

```yaml
services:
  frontend:
    build: ./frontend
    ports: ["5100:80"]
    depends_on: [backend]

  backend:
    build: ./backend
    ports: ["8000:8000"]
    environment:
      - DATABASE_URL=postgresql://user:pass@db:5432/apex
    depends_on: [db]

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: apex
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass
    volumes: ["pgdata:/var/lib/postgresql/data"]

volumes:
  pgdata:
```

---

## CI/CD Pipeline

```
Push to main
    │
    ▼
┌──────────────┐
│   Lint        │  ESLint, TypeScript check, Prettier
└──────┬───────┘
       ▼
┌──────────────┐
│  Unit Tests   │  Vitest (30+ files, ~15s)
└──────┬───────┘
       ▼
┌──────────────┐
│    Build      │  Vite production build with VITE_GIT_SHA
└──────┬───────┘
       ▼
┌──────────────┐
│   E2E Tests   │  Playwright (204 specs, ~30min)
└──────┬───────┘
       ▼
┌──────────────┐
│   Deploy      │  Upload to CDN origin (staging or prod)
└──────┬───────┘
       ▼
┌──────────────┐
│ Health Check  │  Verify /health endpoint responds
└──────────────┘
```

### Stage Gates

- **Lint**: Fails on any ESLint error or TypeScript compilation error
- **Unit Tests**: Fails if any test fails or `lib/` coverage drops below 85%
- **E2E Tests**: Runs on staging deployment; blocks production deploy on failure
- **Deploy**: Blue/green deployment — new version is verified before traffic switch

---

## Health Checks

### Frontend Health

A static `health.json` file is generated during build:

```json
{
  "status": "ok",
  "version": "a3f2c1e",
  "buildTime": "2026-03-01T12:00:00Z"
}
```

CDN health checks request this file. If the CDN returns a stale or missing response, alerts fire.

### Backend Health

```python
@app.get("/api/health")
async def health():
    db_ok = await check_database()
    ws_ok = check_websocket_connections()
    return {
        "status": "healthy" if (db_ok and ws_ok) else "degraded",
        "database": db_ok,
        "websocket": ws_ok,
        "version": os.environ.get("GIT_SHA", "unknown"),
        "uptime": get_uptime_seconds(),
    }
```

Load balancers poll `/api/health` every 10 seconds and remove unhealthy instances from the pool.

---

## Rollback Strategy

| Scenario | Rollback Method | Time to Recover |
|----------|----------------|-----------------|
| Frontend regression | Repoint CDN to previous build assets in bucket | < 1 minute |
| Backend regression | Roll back Docker image tag in orchestrator | < 2 minutes |
| Database migration issue | Run reverse migration script | 5–15 minutes |
| Full rollback | Restore CDN + backend + DB snapshot | 15–30 minutes |

Previous builds are retained in the asset bucket for 30 days, tagged by Git SHA. The CI pipeline stores the last 10 successful build SHA mappings, enabling one-command rollbacks via `./scripts/rollback.sh <sha>`.
