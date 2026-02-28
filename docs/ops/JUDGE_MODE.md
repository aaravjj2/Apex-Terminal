# Judge Mode Guide

## Overview

Judge mode allows evaluators to run the full Apex Terminal stack locally in a single command.

## Quick Start

```bash
bash scripts/bootstrap_keys_example.sh
docker compose -f docker-compose.judge.yml up -d
curl http://localhost:8090/api/v3/export/version
```

See [RUN_LOCAL.md](../RUN_LOCAL.md) for full instructions.

## What judge mode provides

1. **Full stack** — Postgres, Elasticsearch, Kibana, Backend (8090), Frontend (5100)
2. **Health gates** — All services must be healthy before tests run
3. **Deterministic runs** — Same results every time (`retries=0`)
4. **Proof artifacts** — Screenshots, traces, videos, playwright-report/

## Running the full E2E suite

```bash
# Backend tests
python -m pytest backend/tests/ -v

# E2E tests (headless, no browser window)
npx playwright test tests/e2e/hardening/ --workers=1 --retries=0
```

## Validating results

```bash
# Check all versions
curl http://localhost:8090/api/v3/ops/health
curl http://localhost:8090/api/v3/export/version
curl http://localhost:8090/api/v3/ops/reset/version
```

## SLO Thresholds

See [SLO.md](SLO.md) for service-level objectives that the test suite enforces.
