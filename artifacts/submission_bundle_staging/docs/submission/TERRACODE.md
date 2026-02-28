# Apex Terminal — TERRACODE Submission

## Problem

Retail and semi-professional traders lack institutional-grade tooling. They have no
reliable way to run compliance-gated trades, audit strategy decisions, or prove
reproducibility of system states to regulators or collaborators. Manual processes
are fragile, expensive, and not AI-assisted.

## Solution

**Apex Terminal** is an AI-native trading operations platform that brings together:

- **Safe Actions** — RBAC-gated ticket system for compliance-controlled trading decisions
- **Controls Domain** — Live regulatory control graph (AP/AR, reconciliation) indexed in Elasticsearch
- **Accessibility + Performance Auditing** — Automated W3C a11y and Core Web Vitals monitoring baked into CI
- **Export Bundle** — One-click reproducible judge bundle with deterministic SHA256 manifest

All backed by a FastAPI backend, React frontend, SQLite + Elasticsearch 8, and an
AI agent layer (Groq/Gemini) that explains every decision.

## Stack

| Layer       | Technology                          |
|------------|--------------------------------------|
| Backend     | Python 3.14 + FastAPI + uvicorn      |
| Frontend    | React 18 + TypeScript + Vite         |
| Storage     | SQLite (ops) + Elasticsearch 8 (real-time) |
| AI          | Groq (compound reasoning) + Gemini   |
| Broker      | Alpaca paper trading API             |
| Data        | Finnhub, Alpaca, Tiingo              |
| Infra       | Docker Compose (judge mode)          |

## How AI Is Used

1. **Agent Builder**: ES-powered agent analyzes strategy signals and generates
   natural-language reasoning for every safe action ticket.
2. **LLM Reasoning Layer**: Each compliance decision is accompanied by an
   AI-generated explanation (Groq compound-beta) — auditable and storable.
3. **Anomaly Detection**: AI identifies performance budget regressions from
   Core Web Vitals measurements in real time.
4. **Strategy suggestions**: Backtesting results are explained by the LLM,
   not just displayed as numbers.

## Demo Script (2–3 min)

**Minute 0–1 — Judge mode startup:**
```bash
bash scripts/bootstrap_keys_example.sh
docker compose -f docker-compose.judge.yml up -d
curl http://localhost:8090/api/v3/export/version
# Shows: {"version":"w108-v1.0","status":"ok"}
```

**Minute 1–2 — Safe action ticket + RBAC:**
- Navigate to `http://localhost:5100/ui2/safe-actions`
- Select role **admin**, enter ticket title, click **Create Ticket**
- Observe ticket ID + audit trail entry in real time
- Switch role to **viewer** — button grays out with "Viewers cannot create tickets"

**Minute 2–3 — Export bundle for judges:**
- Navigate to `http://localhost:5100/ui2/export-bundle`
- Click **Create Bundle** — manifest appears with SHA256 of every file
- Click **Download ZIP** — opens ZIP with `manifest.json`, `db_tables.json`, `es_templates.json`, `README.md`
- Bundle hash is deterministic; running again produces identical hash

## Reproducibility

Every system state is captured in the export bundle:
- DB tables (tickets, controls, audit events, perf samples)
- ES index templates (verified against live cluster)
- SHA256 hashes prove nothing was tampered with
