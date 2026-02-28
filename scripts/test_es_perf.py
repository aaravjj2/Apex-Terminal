"""Quick ES latency test."""
import requests, time, json

ES = "http://localhost:9200"
BACKEND = "http://localhost:8000"

# Direct ES BM25
start = time.time()
r = requests.post(f"{ES}/apex-backtests/_search",
    json={"query": {"multi_match": {"query": "momentum", "fields": ["summary^2","strategy_name","tags"]}}, "size": 5},
    timeout=10)
elapsed = (time.time() - start) * 1000
hits = r.json().get("hits", {}).get("hits", [])
print(f"Direct BM25: {elapsed:.0f}ms - {len(hits)} hits")

# Direct kNN
start = time.time()
vec = [0.5]*64
r = requests.post(f"{ES}/apex-backtests/_search",
    json={"knn": {"field": "pattern_vec", "query_vector": vec, "k": 5, "num_candidates": 25}, "size": 5},
    timeout=10)
elapsed = (time.time() - start) * 1000
hits = r.json().get("hits", {}).get("hits", [])
print(f"Direct kNN: {elapsed:.0f}ms - {r.status_code} - {len(hits)} hits")

# Direct _msearch
start = time.time()
body = (
    json.dumps({"index": "apex-backtests"}) + "\n"
    + json.dumps({"query": {"multi_match": {"query": "momentum", "fields": ["summary^2","strategy_name","tags"]}}, "size": 5}) + "\n"
    + json.dumps({"index": "apex-backtests"}) + "\n"
    + json.dumps({"knn": {"field": "pattern_vec", "query_vector": vec, "k": 5, "num_candidates": 25}, "size": 5}) + "\n"
)
r = requests.post(f"{ES}/_msearch",
    data=body.encode(),
    headers={"Content-Type": "application/x-ndjson"},
    timeout=10)
elapsed = (time.time() - start) * 1000
responses = r.json().get("responses", [])
print(f"Direct _msearch: {elapsed:.0f}ms - status={r.status_code} - {len(responses)} responses")

# Backend hybrid
start = time.time()
r = requests.post(f"{BACKEND}/api/v4/elastihack/hybrid/search",
    json={"query": "momentum breakout", "size": 5}, timeout=30)
elapsed = (time.time() - start) * 1000
data = r.json()
print(f"Backend hybrid: {elapsed:.0f}ms (server: {data.get('latency_ms')}ms) - {len(data.get('hits', []))} hits")
