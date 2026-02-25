#!/usr/bin/env python3
"""Seed canary docs with pattern_vec into ES indices for coverage > 0."""
import json, urllib.request, sys, os

ES = os.environ.get("ELASTICSEARCH_URL", "http://localhost:9200")
H = {"Content-Type": "application/json"}

def req(method, path, body=None):
    d = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(ES + path, data=d, headers=H, method=method)
    try:
        with urllib.request.urlopen(r, timeout=15) as resp:
            raw = resp.read()
            return resp.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raw = e.read()
        return e.code, json.loads(raw) if raw else {"error": str(e)}

# Deterministic canary vector — unit vector in first dimension (valid for cosine)
VEC = [1.0] + [0.0] * 63

canaries = [
    ("/apex-backtests/_doc/canary-c1?refresh=true", {
        "run_id":"c1", "doc_type":"backtest_run", "status":"completed",
        "ticker":"AAPL", "cagr":0.18, "win_rate":0.60, "sharpe":1.5,
        "max_drawdown":-0.10, "pattern_vec": VEC
    }),
    ("/apex-workflows/_doc/canary-c1?refresh=true", {
        "cycle_id":"c1", "doc_type":"autopilot_cycle", "status":"completed",
        "win_rate":0.55, "cagr":0.15, "max_drawdown":-0.08, "pattern_vec": VEC
    }),
    ("/apex-strategies/_doc/canary-c1?refresh=true", {
        "strategy_id":"s001", "doc_type":"strategy", "status":"active",
        "pattern_vec": VEC
    }),
    ("/apex-autopilot/_doc/canary-c1?refresh=true", {
        "cycle_id":"ac1", "doc_type":"autopilot_cycle", "status":"completed",
        "win_rate":0.52, "cagr":0.12, "max_drawdown":-0.07, "pattern_vec": VEC
    }),
]

errors = 0
for path, doc in canaries:
    idx = path.split("/")[1]
    # check if index exists
    st, _ = req("HEAD", f"/{idx}")
    if st == 404:
        print(f"  - {idx}: not found, skip")
        continue
    st, r = req("PUT", path, doc)
    if 200 <= st < 300:
        print(f"  OK {idx}: {r.get('result','?')}")
    else:
        print(f"  FAIL {idx}: HTTP {st} {r}")
        errors += 1

# Count docs
print("\nDoc counts:")
for idx in ["apex-backtests","apex-workflows","apex-strategies","apex-autopilot",
            "apex-backtests-vec-20260224","apex-workflows-vec-20260224"]:
    st, r = req("GET", f"/{idx}/_count")
    if st == 404:
        print(f"  {idx}: not found")
    elif 200 <= st < 300:
        print(f"  {idx}: {r.get('count',0)} docs")

sys.exit(0 if errors == 0 else 1)
