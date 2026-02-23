# Apex Terminal — Proof Pack MANIFEST
> Generated: 2026-02-23T17:42:32.163041+00:00  
> Scope: Waves 82–130  
> Standard: judge-grade, fully deterministic, zero tolerance

---

## 1. Stack Health (pre-test invariants)

| Invariant | Value |
|---|---|
| backend ready           | True |
| elasticsearch connected | True |
| elasticsearch cluster   | yellow (yellow = normal for single-node) |
| broker connected        | True |
| broker account_status   | ACTIVE |
| ws disconnect_count     | 3 (historical dev churn; not accumulated during test run) |
| collected_at            | 2026-02-23T17:33:25.161752+00:00 |

**Endpoints sampled:** `/api/v3/ops/health`, `/api/v3/ops/ws/health`, `/api/v3/ops/elasticsearch`, `/api/v3/elasticsearch/pipeline/lag`, `/api/v3/ops/broker`

Raw JSON evidence: `proof/logs/ops_health.json` through `proof/logs/ops_broker.json`

---

## 2. Backend pytest — W117–W130 (14 test files, 121 tests)

```
Run 1:  121 passed in 79.31s
Run 2:  121 passed in 79.87s
```

| Run | Command | Log |
|---|---|---|
| 1 | `C:\Python314\python.exe -m pytest backend/tests/integration/test_w117-w130_*.py -q` | `proof/logs/pytest-run1.txt` |
| 2 | *(same)* | `proof/logs/pytest-run2.txt` |

---

## 3. Playwright E2E — W117–W130 (14 specs, 100 tests)

**Config:** headed=true, workers=1, retries=0, trace=on, video=on, screenshot=on

```
Run 1:  100 passed
Run 2:  100 passed
```

| Run | Log |
|---|---|
| 1 | `proof/logs/pw-run1.txt` |
| 2 | `proof/logs/pw-run2.txt` |

---

## 4. Determinism Verdict

**diff:** `proof/determinism-diff.txt`

```
✅ EMPTY (deterministic)
```

Full artifacts: `proof/determinism-run1.json`, `proof/determinism-run2.json`

---

## 5. 3× Flake Detector

```
﻿[1A[2K  100 passed (31.9s)
[1A[2K  100 passed (30.3s)
[1A[2K  100 passed (29.9s)
PASS: all 3 runs = 100 passed
```

Logs: `proof/logs/run_3x_run1.txt`, `run_3x_run2.txt`, `run_3x_run3.txt`

---

## 6. Waves Implemented (82–130)

| Wave | Title | Status |
|---|---|---|
| 82  | Canonical monorepo layout | ✅ |
| 83  | Stale artifact purge + retention policy | ✅ |
| 84  | Single config loader + fail-fast startup | ✅ |
| 85  | Domain isolation firewall | ✅ |
| 86  | Event bus + immutable audit events in ES | ✅ |
| 87  | WebSocket reliability v1 | ✅ |
| 88  | Ops workspace v1 | ✅ |
| 89  | Command palette + deep link contract | ✅ |
| 90  | Repo sanity gates (testids + forbidden patterns) | ✅ |
| 91  | Elasticsearch templates + aliases v4 | ✅ |
| 92  | Bulk ingest + DLQ + lag metrics | ✅ |
| 93  | Evidence graph v1 | ✅ |
| 94  | Agent tools v1 | ✅ |
| 95  | Elastic Agent Builder integration | ✅ |
| 96  | Search UX v3 | ✅ |
| 97  | Backtesting correctness contract | ✅ |
| 98  | Walk-forward + robustness v3 | ✅ |
| 99  | Strategy Studio v3 | ✅ |
| 100 | Job Queue v2 + WS progress | ✅ |
| 101 | Convergence cockpit v1 | ✅ |
| 102 | Agent eval harness | ✅ |
| 103 | UI2 standardization | ✅ |
| 104 | Accessibility | ✅ |
| 105 | Performance budgets + CWV | ✅ |
| 106 | Accounting/controls alignment into ES | ✅ |
| 107 | Safe actions (tickets) | ✅ |
| 108 | Export bundles | ✅ |
| 109 | Docker compose + judge mode | ✅ |
| 110 | Submission kit v1 | ✅ |
| 111 | MCP-only enforcement gate | ✅ |
| 112 | Persistent window for suite | ✅ |
| 113 | Suite-level WS stability monitor | ✅ |
| 114 | Suite-level ES health + lag monitor | ✅ |
| 115 | Suite-level broker sync monitor | ✅ |
| 116 | Expand E2E to 200+ high-signal tests | ✅ |
| 117 | Visual stability (no threshold loosening) | ✅ |
| 118 | Zero-flake 3× repeat-run harness | ✅ |
| 119 | Full determinism proof (run1 == run2) | ✅ |
| 120 | Onboarding + guided tour mode | ✅ |
| 121 | Runbooks + troubleshooting + judge mode | ✅ |
| 122 | Secrets and redaction hardening | ✅ |
| 123 | Submission compliance checks | ✅ |
| 124 | TerraCode demo script + tour spec | ✅ |
| 125 | ElastiHack demo script + tour spec | ✅ |
| 126 | Submission bundle generator (zip) | ✅ |
| 127 | CI alignment (local == CI) | ✅ |
| 128 | Final UX declutter | ✅ |
| 129 | Incident drills (ES/WS/Broker outages) | ✅ |
| 130 | Final proof pack + dual-submission readiness | ✅ |

---

## 7. Key Files and Scripts

| File | Purpose |
|---|---|
| `docs/ONBOARDING.md` | Getting-started wizard |
| `docs/ops/RESET.md` | Reset procedure |
| `docs/ops/TROUBLESHOOTING.md` | Common failures + fixes |
| `docs/ops/JUDGE_MODE.md` | Judge run instructions |
| `docs/ops/SLO.md` | SLO thresholds |
| `docs/submission/TERRACODE_DEMO_SCRIPT.md` | TerraCode demo script |
| `docs/submission/ELASTIHACK_DEMO_SCRIPT.md` | ElastiHack demo script |
| `scripts/determinism_check.py` | pytest + playwright × 2 determinism |
| `scripts/run_3x.ps1` | 3× flake detector |
| `scripts/check_secrets.py` | CI secret scanner |
| `scripts/check_submission_compliance.py` | Devpost requirements validator |
| `scripts/generate_submission_bundle.py` | Build submission_bundle.zip |
| `phase1/services/api/routes/ops_reset.py` | Reset endpoints |

---

## 8. Proof Pack Inventory

| File | Size |
|---|---|
| `proof\determinism-diff.txt` | 0 bytes |
| `proof\determinism-run1.json` | 2,882 bytes |
| `proof\determinism-run2.json` | 2,882 bytes |
| `proof\logs\api_v3_elasticsearch_lag.json` | 138 bytes |
| `proof\logs\api_v3_ops_broker_health.json` | 138 bytes |
| `proof\logs\api_v3_ops_elastic_health.json` | 139 bytes |
| `proof\logs\api_v3_ops_health.json` | 705 bytes |
| `proof\logs\api_v3_ops_ws_health.json` | 353 bytes |
| `proof\logs\bundle.txt` | 208 bytes |
| `proof\logs\compliance.txt` | 1,586 bytes |
| `proof\logs\es_pipeline_lag.json` | 195 bytes |
| `proof\logs\health_invariants.json` | 843 bytes |
| `proof\logs\health_summary.json` | 356 bytes |
| `proof\logs\ops_broker.json` | 307 bytes |
| `proof\logs\ops_elasticsearch.json` | 283 bytes |
| `proof\logs\ops_health.json` | 711 bytes |
| `proof\logs\ops_ws_health.json` | 359 bytes |
| `proof\logs\pw-run1.txt` | 24,478 bytes |
| `proof\logs\pw-run2.txt` | 24,478 bytes |
| `proof\logs\pytest-run1.txt` | 2,644 bytes |
| `proof\logs\pytest-run2.txt` | 2,644 bytes |
| `proof\logs\run_3x_run1.txt` | 13,056 bytes |
| `proof\logs\run_3x_run2.txt` | 13,056 bytes |
| `proof\logs\run_3x_run3.txt` | 13,056 bytes |
| `proof\logs\secrets_scan.txt` | 54 bytes |
| `proof\MANIFEST.md` | 6,663 bytes |
| `proof\run_3x_summary.txt` | 124 bytes |

---

*End of MANIFEST — generated by `scripts/_generate_manifest.py`*
