# Ops SLO Thresholds

Service-level objectives for Apex Terminal suite monitors.
All E2E specs in `hardening/` enforce these thresholds at runtime.

---

## WebSocket (WS) Stability — W113

| Metric | SLO |
|---|---|
| `running` | `true` |
| `heartbeat_task_alive` | `true` |
| `disconnect_count` | Must not increment during a test run |
| `last_heartbeat_age_s` | `< 60 s` |

Spec: `w113-ws-stability.spec.ts`

---

## Elasticsearch (ES) Health — W114

| Metric | SLO |
|---|---|
| `connected` | `true` |
| `cluster_status` | `yellow` or `green` (not `red`) |
| `latency_ms` | `< 2000 ms` |
| `node_count` | `>= 1` |

Spec: `w114-es-stability.spec.ts`

---

## Broker Sync — W115

| Metric | SLO |
|---|---|
| `connected` | `true` |
| `latency_ms` | `< 5000 ms` |
| `trading_blocked` | `false` |

Spec: `w115-broker-stability.spec.ts`

---

## Violation Behaviour

Any breach of the above thresholds causes the respective spec to **fail the CI run** immediately.
No retries are allowed (`retries=0` in `playwright.config.ts`).
