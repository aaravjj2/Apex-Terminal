#!/usr/bin/env python3
"""Collect all health-invariant endpoint responses into proof/logs/."""
import datetime
import json
import pathlib
import urllib.request

BASE = "http://127.0.0.1:8090"
WORKSPACE = pathlib.Path(__file__).resolve().parent.parent
LOGS = WORKSPACE / "proof" / "logs"
LOGS.mkdir(parents=True, exist_ok=True)

ts = datetime.datetime.now(datetime.timezone.utc).isoformat()

endpoints = {
    "ops_health":        "/api/v3/ops/health",
    "ops_ws_health":     "/api/v3/ops/ws/health",
    "ops_elasticsearch": "/api/v3/ops/elasticsearch",
    "es_pipeline_lag":   "/api/v3/elasticsearch/pipeline/lag",
    "ops_broker":        "/api/v3/ops/broker",
}

results = {}
for name, ep in endpoints.items():
    try:
        r = urllib.request.urlopen(BASE + ep, timeout=10)
        body = json.loads(r.read())
        payload = {"collected_at": ts, "endpoint": ep, "http_status": r.status, "body": body}
        (LOGS / f"{name}.json").write_text(json.dumps(payload, indent=2), encoding="utf-8")
        results[name] = {"status": r.status, "ok": True}
        print(f"  OK  {ep}")
    except Exception as e:
        payload = {"collected_at": ts, "endpoint": ep, "error": str(e)}
        (LOGS / f"{name}.json").write_text(json.dumps(payload, indent=2), encoding="utf-8")
        results[name] = {"status": "ERR", "ok": False, "error": str(e)}
        print(f"  ERR {ep} -> {e}")

# Extract key invariants from main health endpoint
h_raw = json.loads((LOGS / "ops_health.json").read_text())
h = h_raw.get("body", {})
deps = h.get("dependencies", {})
es_dep = deps.get("elasticsearch", {})
broker_dep = deps.get("broker", {})

ws_raw = json.loads((LOGS / "ops_ws_health.json").read_text())
ws_body = ws_raw.get("body", {})

print()
print("=== KEY INVARIANTS ===")
ready = h.get("ready")
print(f"  backend ready:             {ready}")
es_conn = es_dep.get("connected")
print(f"  elasticsearch connected:   {es_conn}")
es_status = es_dep.get("cluster_status")
print(f"  elasticsearch cluster:     {es_status}")
broker_conn = broker_dep.get("connected")
print(f"  broker connected:          {broker_conn}")
broker_status = broker_dep.get("account_status")
print(f"  broker account_status:     {broker_status}")
dc = ws_body.get("disconnect_count", "N/A")
print(f"  ws disconnect_count:       {dc}")

invariants = {
    "collected_at": ts,
    "backend_ready": ready,
    "elasticsearch_connected": es_conn,
    "elasticsearch_cluster_status": es_status,
    "broker_connected": broker_conn,
    "broker_account_status": broker_status,
    "ws_disconnect_count": dc,
    "endpoints_checked": list(endpoints.values()),
    "endpoint_results": results,
}
(LOGS / "health_invariants.json").write_text(json.dumps(invariants, indent=2), encoding="utf-8")
print()
print(f"Saved: proof/logs/health_invariants.json  (and {len(endpoints)} per-endpoint JSONs)")
