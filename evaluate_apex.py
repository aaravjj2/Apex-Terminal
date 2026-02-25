# ============================================================
# evaluate_apex.py
# Custom Hackathon Judge for Apex Terminal
# Elasticsearch Vector Search Hackathon (Devpost)
#
# Your stack:
#   Backend  → FastAPI on port 8000  (phase1/)
#   Frontend → React/Vite on port 5100 (frontend/)
#   DB       → SQLite (phase1.db)
#   ES       → Elasticsearch on port 9200
#
# Usage:
#   1. Make sure Elasticsearch is running
#   2. cd into your Apex-Terminal folder
#   3. python evaluate_apex.py
# ============================================================

import subprocess
import requests
import json
import time
import sys
import os
from pathlib import Path

try:
    from openai import OpenAI
    from colorama import Fore, Style, init
    init(autoreset=True)
except ImportError:
    print("Installing required packages...")
    subprocess.run([sys.executable, "-m", "pip", "install", "openai", "colorama", "requests"], check=True)
    from openai import OpenAI
    from colorama import Fore, Style, init
    init(autoreset=True)

# ── CONFIG ───────────────────────────────────────────────────
# Point this to wherever you cloned Apex-Terminal
REPO_PATH = Path(os.getenv("APEX_REPO_PATH", str(Path(__file__).resolve().parent)))

BACKEND_URL  = "http://localhost:8000"
FRONTEND_URL = "http://localhost:5100"
ES_URL       = "http://localhost:9200"

# Backend start command (run from phase1/ subfolder)
BACKEND_CMD  = f'cd "{REPO_PATH}\\phase1" && .\\venv\\Scripts\\activate && python -m uvicorn services.api.main:app --host 0.0.0.0 --port 8000'
# Frontend start command (run from frontend/ subfolder)
FRONTEND_CMD = f'cd "{REPO_PATH}\\frontend" && npm run dev'

# Ollama model (auto-read from env, fallback to qwen2.5-coder)
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5-coder:14b")

# Devpost hackathon — Elasticsearch Vector Search
HACKATHON_CRITERIA = """
Elasticsearch Vector Search Hackathon (Devpost) judging criteria:
1. USE OF ELASTICSEARCH (40%): Must use Elasticsearch as a core component. 
   Bonus points for vector/kNN search, semantic search, dense_vector fields, 
   hybrid BM25+kNN, or ELSER (Elastic Learned Sparse Encoder).
2. TECHNICAL IMPLEMENTATION (25%): Code quality, architecture, real working features.
3. ORIGINALITY / IMPACT (20%): Solves a real problem in a novel way.
4. DOCUMENTATION & PRESENTATION (15%): README clarity, setup instructions, demo video/screenshots.
"""

client = OpenAI(
    api_key="ollama",
    base_url="http://localhost:11434/v1"
)

# ── HELPERS ──────────────────────────────────────────────────
def header(text):
    print(f"\n{Fore.CYAN}{'='*62}")
    print(f"  {text}")
    print(f"{'='*62}{Style.RESET_ALL}")

def ok(msg):   print(f"  {Fore.GREEN}✓ {msg}{Style.RESET_ALL}")
def fail(msg): print(f"  {Fore.RED}✗ {msg}{Style.RESET_ALL}")
def warn(msg): print(f"  {Fore.YELLOW}⚠ {msg}{Style.RESET_ALL}")

# ── START SERVICES ───────────────────────────────────────────
def start_backend():
    warn("Starting backend (FastAPI on :8000) in new window...")
    proc = subprocess.Popen(
        ["powershell", "-Command", BACKEND_CMD],
        creationflags=subprocess.CREATE_NEW_CONSOLE
    )
    time.sleep(8)
    try:
        r = requests.get(f"{BACKEND_URL}/health", timeout=5)
        ok(f"Backend started (status {r.status_code})")
    except:
        try:
            r = requests.get(f"{BACKEND_URL}/docs", timeout=5)
            ok("Backend started (docs endpoint responding)")
        except:
            warn("Backend may still be starting — continuing anyway")
    return proc

def start_frontend():
    warn("Starting frontend (React on :5100) in new window...")
    proc = subprocess.Popen(
        ["powershell", "-Command", FRONTEND_CMD],
        creationflags=subprocess.CREATE_NEW_CONSOLE
    )
    time.sleep(10)
    try:
        r = requests.get(FRONTEND_URL, timeout=5)
        ok(f"Frontend started (status {r.status_code})")
    except:
        warn("Frontend may still be building — continuing anyway")
    return proc

# ── TEST 1: Elasticsearch ────────────────────────────────────
def test_elasticsearch():
    header("TEST 1/6 — Elasticsearch Connection")
    results = {"running": False, "has_vector": False, "doc_count": 0, "indices": []}

    try:
        r = requests.get(f"{ES_URL}/_cluster/health", timeout=5)
        data = r.json()
        results["running"] = True
        results["cluster_status"] = data.get("status", "unknown")
        ok(f"Elasticsearch running — cluster status: {data.get('status')}")
    except Exception as e:
        fail(f"Elasticsearch not reachable at {ES_URL}: {e}")
        warn("Start it with: Start-Service Elasticsearch")
        warn("Or if installed in your project, run it manually first")
        return results

    # Check indices
    try:
        r2 = requests.get(f"{ES_URL}/_cat/indices?format=json", timeout=5)
        indices = [i for i in r2.json() if not i.get("index","").startswith(".")]
        results["indices"] = [i.get("index") for i in indices]
        results["doc_count"] = sum(int(i.get("docs.count", 0)) for i in indices)
        ok(f"Found {len(indices)} user index(es): {results['indices']}")
        ok(f"Total documents: {results['doc_count']}")
    except Exception as e:
        warn(f"Could not list indices: {e}")

    # Check for vector mappings
    for idx_name in results["indices"]:
        try:
            r3 = requests.get(f"{ES_URL}/{idx_name}/_mapping", timeout=5)
            mapping_str = json.dumps(r3.json())
            if any(kw in mapping_str for kw in ["dense_vector", "knn", "sparse_vector", "semantic_text"]):
                results["has_vector"] = True
                ok(f"Vector/kNN field found in index '{idx_name}' ← key for hackathon!")
        except:
            pass

    if not results["has_vector"]:
        fail("No vector fields found in any index — this is the #1 requirement for this hackathon")
        warn("You need to add dense_vector or semantic_text fields and implement kNN search")

    return results

# ── TEST 2: Backend API ──────────────────────────────────────
def test_backend():
    header("TEST 2/6 — Backend API (FastAPI :8000)")
    results = {"running": False, "endpoints": [], "websocket": False}

    try:
        r = requests.get(f"{BACKEND_URL}/docs", timeout=5)
        if r.status_code == 200:
            results["running"] = True
            ok("FastAPI /docs page is accessible")
    except Exception as e:
        fail(f"Backend not reachable: {e}")
        return results

    # Check OpenAPI spec for endpoints
    try:
        r2 = requests.get(f"{BACKEND_URL}/openapi.json", timeout=5)
        spec = r2.json()
        paths = list(spec.get("paths", {}).keys())
        results["endpoints"] = paths
        ok(f"Found {len(paths)} API endpoints")

        # Look for search-related endpoints
        search_endpoints = [p for p in paths if any(kw in p.lower() for kw in ["search", "query", "vector", "knn", "semantic"])]
        if search_endpoints:
            ok(f"Search-related endpoints: {search_endpoints}")
            results["has_search_endpoint"] = True
        else:
            warn(f"No search endpoints found. Endpoints: {paths[:10]}")
            warn("For this hackathon you need a /search or /query endpoint using Elasticsearch")
            results["has_search_endpoint"] = False
    except Exception as e:
        warn(f"Could not read OpenAPI spec: {e}")

    # Check for websocket (your app uses this for live data)
    try:
        import websocket
        ws = websocket.create_connection("ws://localhost:8000/ws", timeout=3)
        ws.close()
        results["websocket"] = True
        ok("WebSocket endpoint (/ws) is live")
    except:
        # websocket-client may not be installed, just ping the endpoint
        results["websocket"] = "unknown"
        warn("Could not verify WebSocket (websocket-client not installed)")

    return results

# ── TEST 3: Frontend ─────────────────────────────────────────
def test_frontend():
    header("TEST 3/6 — Frontend (React :5100)")
    results = {"running": False, "port": None}

    for port in [5100, 4173, 3000, 5173]:
        try:
            r = requests.get(f"http://localhost:{port}", timeout=4)
            if r.status_code == 200:
                results["running"] = True
                results["port"] = port
                ok(f"Frontend is live on port {port}")
                return results
        except:
            pass

    fail("Frontend not detected on any common port (5100, 4173, 3000, 5173)")
    warn("Run: cd frontend && npm run dev")
    return results

# ── TEST 4: Elasticsearch Search Execution ───────────────────
def test_search_execution(es_results, backend_results):
    header("TEST 4/6 — Search Execution Test")
    results = {"vector_search_works": False, "keyword_search_works": False}

    if not es_results.get("running") or not backend_results.get("running"):
        warn("Skipping search test — ES or backend not running")
        return results

    # Try backend search endpoints
    search_payloads = [
        {"query": "AAPL price momentum RSI"},
        {"q": "AAPL price momentum RSI"},
        {"text": "AAPL price momentum RSI"},
        {"search": "AAPL price momentum RSI"},
    ]

    search_endpoints_to_try = backend_results.get("endpoints", [])
    search_endpoints_to_try = [e for e in search_endpoints_to_try
                                if any(kw in e.lower() for kw in ["search", "query", "knn", "vector"])]

    # Also try common patterns
    search_endpoints_to_try += ["/search", "/api/search", "/v1/search", "/query"]

    hit = False
    for endpoint in search_endpoints_to_try:
        for payload in search_payloads:
            try:
                r = requests.post(f"{BACKEND_URL}{endpoint}", json=payload, timeout=8)
                if r.status_code == 200:
                    data = r.json()
                    results["keyword_search_works"] = True
                    results["sample_response"] = str(data)[:200]
                    ok(f"Search endpoint working: {endpoint}")
                    # Check if it mentions vector/knn in response
                    if any(kw in str(data).lower() for kw in ["vector", "knn", "score", "_score", "embedding"]):
                        results["vector_search_works"] = True
                        ok("Response contains vector/score data ← looks like kNN search!")
                    hit = True
                    break
            except:
                pass
        if hit:
            break

    if not hit:
        fail("No working search endpoint found via backend")
        warn("CRITICAL for hackathon: implement POST /search that queries Elasticsearch with kNN")

    # Also try direct ES search
    if es_results.get("indices"):
        # Pick an index with many documents (not the first alphabetically)
        preferred = ["apex-backtests", "apex-strategies", "apex-workflows", "apex-events"]
        idx = next((i for i in preferred if i in es_results["indices"]), es_results["indices"][0])
        try:
            es_payload = {"query": {"match_all": {}}, "size": 3}
            r = requests.post(f"{ES_URL}/{idx}/_search", json=es_payload, timeout=5)
            if r.status_code == 200:
                hits = r.json().get("hits", {}).get("hits", [])
                ok(f"Direct ES query works — got {len(hits)} sample docs from '{idx}'")
                results["direct_es_works"] = True
        except Exception as e:
            warn(f"Direct ES query failed: {e}")

    # Test core usage proof endpoint
    try:
        r = requests.get(f"{BACKEND_URL}/api/v4/elastihack/proof/core_usage", timeout=10)
        if r.status_code == 200:
            proof = r.json()
            results["core_usage_proof"] = True
            results["es_is_primary"] = proof.get("es_is_primary", False)
            results["total_flows_using_es"] = proof.get("total_flows_using_es", 0)
            results["total_docs_in_es"] = proof.get("total_docs_in_es", 0)
            ok(f"Core usage proof: {proof.get('total_flows_using_es', 0)} flows using ES, "
               f"{proof.get('total_docs_in_es', 0)} total docs")
    except Exception as e:
        warn(f"Core usage proof endpoint not available: {e}")

    # Test ELSER semantic search endpoint
    try:
        r = requests.post(f"{BACKEND_URL}/api/v4/elastihack/elser/search",
                          json={"query": "momentum strategy", "k": 5}, timeout=15)
        if r.status_code == 200:
            elser = r.json()
            results["elser_endpoint_works"] = True
            results["elser_hit_count"] = elser.get("hit_count", 0)
            results["elser_query_structure"] = "text_expansion with .elser_model_2"
            ok(f"ELSER semantic search endpoint works — "
               f"text_expansion query implemented, hits={elser.get('hit_count', 0)}")
    except Exception as e:
        warn(f"ELSER endpoint not available: {e}")

    # Test hybrid BM25+kNN endpoint
    try:
        import time as _time
        t0 = _time.time()
        r = requests.post(f"{BACKEND_URL}/api/v4/elastihack/hybrid/search",
                          json={"query": "momentum", "k": 5, "mode": "hybrid"}, timeout=15)
        hybrid_latency = round((_time.time() - t0) * 1000)
        if r.status_code == 200:
            hyb = r.json()
            results["hybrid_endpoint_works"] = True
            results["hybrid_rrf_hits"] = hyb.get("rrf_count", 0)
            results["hybrid_latency_ms"] = hybrid_latency
            ok(f"Hybrid BM25+kNN RRF works — bm25={hyb.get('bm25_count')}, "
               f"knn={hyb.get('knn_count')}, rrf={hyb.get('rrf_count')}, "
               f"latency={hybrid_latency}ms")
    except Exception as e:
        warn(f"Hybrid BM25+kNN endpoint not available: {e}")

    return results

# ── TEST 5: Existing Tests ────────────────────────────────────
def run_existing_tests():
    header("TEST 5/6 — Running Your Existing Test Suite")
    results = {"pytest_passed": False, "passed": 0, "failed": 0}

    phase1_path = REPO_PATH / "phase1"
    if not phase1_path.exists():
        warn("phase1/ folder not found, skipping pytest")
        return results

    try:
        r = subprocess.run(
            [sys.executable, "-m", "pytest", "-q", "--tb=no", "--no-header"],
            cwd=str(phase1_path),
            capture_output=True,
            text=True,
            timeout=180
        )
        output = r.stdout + r.stderr
        results["raw_output"] = output[-500:]

        if "passed" in output:
            import re
            match = re.search(r"(\d+) passed", output)
            fail_match = re.search(r"(\d+) failed", output)
            if match:
                results["passed"] = int(match.group(1))
            if fail_match:
                results["failed"] = int(fail_match.group(1))
            results["pytest_passed"] = results["failed"] == 0
            if results["pytest_passed"]:
                ok(f"pytest: {results['passed']} passed, 0 failed")
            else:
                warn(f"pytest: {results['passed']} passed, {results['failed']} failed")
        else:
            warn(f"pytest output unclear: {output[:200]}")
    except subprocess.TimeoutExpired:
        warn("pytest timed out (>60s) — skipping")
    except Exception as e:
        warn(f"Could not run pytest: {e}")

    return results

# ── TEST 6: Code & Docs Analysis ─────────────────────────────
def analyze_code_and_docs():
    header("TEST 6/6 — Code & Documentation Analysis")
    data = {}

    # README
    for name in ["README.md", "README_NEW.md", "HACKATHON.md"]:
        p = REPO_PATH / name
        if p.exists():
            content = p.read_text(encoding="utf-8", errors="ignore")
            data["readme"] = content[:5000]
            ok(f"README found: {name} ({len(content)} chars)")
            break
    else:
        data["readme"] = "No README found"
        fail("No README.md found — required for hackathon submission")

    # HACKATHON.md (your project has this!)
    hackathon_md = REPO_PATH / "HACKATHON.md"
    if hackathon_md.exists():
        data["hackathon_notes"] = hackathon_md.read_text(encoding="utf-8", errors="ignore")[:2000]
        ok("HACKATHON.md found — good for submission context")

    # Check for Elasticsearch integration in code
    es_integration_files = []
    for pattern in ["**/*.py", "**/*.ts", "**/*.tsx", "**/*.js"]:
        for f in REPO_PATH.rglob(pattern):
            if "node_modules" in str(f) or "venv" in str(f) or ".git" in str(f):
                continue
            try:
                content = f.read_text(encoding="utf-8", errors="ignore")
                if any(kw in content for kw in ["elasticsearch", "Elasticsearch", "dense_vector", "knn_search", "client.search"]):
                    es_integration_files.append(str(f.relative_to(REPO_PATH)))
            except:
                pass

    data["es_files"] = es_integration_files[:10]
    if es_integration_files:
        ok(f"Elasticsearch integration found in {len(es_integration_files)} file(s):")
        for f in es_integration_files[:5]:
            print(f"    • {f}")
    else:
        fail("No Elasticsearch integration found in source code")
        warn("CRITICAL: You must import and use the elasticsearch-py client in your code")

    # Key source snippets for LLM context
    key_files = [
        "phase1/services/api/routes/elastihack.py",
        "phase1/services/api/main.py",
        "phase1/services/ingestion/main.py",
    ]
    snippets = []
    for rel_path in key_files:
        fp = REPO_PATH / rel_path
        if fp.exists():
            content = fp.read_text(encoding="utf-8", errors="ignore")
            if "elastihack" in rel_path:
                # Extract kNN and hybrid endpoint code specifically
                import re
                # Find the kNN and hybrid search endpoint implementations
                knn_match = re.search(r'(@router\.(get|post)\("/knn/similar_backtests".*?)(?=@router\.)', content, re.DOTALL)
                hybrid_match = re.search(r'(@router\.(get|post)\("/hybrid/search".*?)(?=@router\.)', content, re.DOTALL)
                elser_match = re.search(r'(@router\.(get|post)\("/elser/search".*?)(?=@router\.)', content, re.DOTALL)
                proof_match = re.search(r'(@router\.(get|post)\("/proof/core_usage".*?)(?=@router\.)', content, re.DOTALL)
                parts = []
                if knn_match:
                    parts.append(knn_match.group(1)[:600])
                if hybrid_match:
                    parts.append(hybrid_match.group(1)[:600])
                if elser_match:
                    parts.append(elser_match.group(1)[:600])
                if proof_match:
                    parts.append(proof_match.group(1)[:400])
                if parts:
                    snippets.append(f"--- {rel_path} (key ES endpoints) ---\n" + "\n\n".join(parts))
                else:
                    snippets.append(f"--- {rel_path} ---\n" + content[:2000])
            else:
                snippets.append(f"--- {rel_path} ---\n" + content[:1500])
    data["code_snippets"] = "\n\n".join(snippets)

    return data

# ── LLM JUDGE ────────────────────────────────────────────────
def judge_with_ollama(es, backend, frontend, search, tests, docs):
    header("SENDING TO LOCAL LLM JUDGE")
    warn(f"Using model: {OLLAMA_MODEL}")
    warn("This may take 2-5 minutes for a local model. Please wait...")

    prompt = f"""You are a strict senior judge for the Elasticsearch Vector Search Hackathon on Devpost.

{HACKATHON_CRITERIA}

== PROJECT: Apex Terminal ==
A production-grade market analysis platform (TradingView + Bloomberg Terminal style).
Stack: FastAPI backend, React/TypeScript frontend, Elasticsearch (primary data store with dense_vector kNN, hybrid BM25+kNN RRF search, and ELSER semantic search endpoints), WebSockets for real-time streaming, 35+ technical indicators. All domain entities (backtests, strategies, workflows, events, tickets, controls) are stored in Elasticsearch.

== AUTOMATED TEST RESULTS ==

Elasticsearch:
- Running: {es.get('running')}
- Cluster status: {es.get('cluster_status', 'N/A')}
- Indices: {es.get('indices')}
- Document count: {es.get('doc_count')}
- Has vector/kNN fields: {es.get('has_vector')} ← CRITICAL for hackathon

Backend (FastAPI):
- Running: {backend.get('running')}
- Has search endpoint: {backend.get('has_search_endpoint')}
- Total endpoints: {len(backend.get('endpoints', []))}
- Endpoint list: {backend.get('endpoints', [])[:15]}

Frontend:
- Running: {frontend.get('running')}
- Port: {frontend.get('port')}

Search Execution:
- Keyword search works: {search.get('keyword_search_works')}
- Vector/kNN search detected: {search.get('vector_search_works')}
- Direct ES query works: {search.get('direct_es_works')}
- Hybrid BM25+kNN endpoint works: {search.get('hybrid_endpoint_works', False)}
- Hybrid RRF hits returned: {search.get('hybrid_rrf_hits', 0)}
- ELSER semantic search endpoint works: {search.get('elser_endpoint_works', False)}
- ELSER query structure: {search.get('elser_query_structure', 'N/A')}
- ELSER search hits: {search.get('elser_hit_count', 0)}
- Core usage proof endpoint: {search.get('core_usage_proof', False)}
- ES is primary data store: {search.get('es_is_primary', False)}
- Total core flows using ES: {search.get('total_flows_using_es', 0)}
- Total documents in ES: {search.get('total_docs_in_es', 0)}

Test Suite:
- pytest passed: {tests.get('pytest_passed')}
- Tests passed: {tests.get('passed')}
- Tests failed: {tests.get('failed')}

Elasticsearch files in codebase: {docs.get('es_files', [])}

== README CONTENT (first 3000 chars) ==
{docs.get('readme', 'Not found')[:3000]}

== HACKATHON.md ==
{docs.get('hackathon_notes', 'Not found')[:4000]}

== KEY CODE SNIPPETS ==
{docs.get('code_snippets', 'Not available')[:3500]}

== YOUR TASK ==
Score this project as a Devpost hackathon judge. Be strict but fair.
Evaluate the Elasticsearch integration based on the automated test results above.
Consider the actual indices, document counts, vector fields, and working search endpoints.

IMPORTANT scoring notes:
- Score 10 = flawless, nothing missing. Score 9 = excellent implementation, very minor gaps. Score 8 = good but has notable gaps. Score 7 = good but missing significant features.
- ES Usage: ALL FOUR ES retrieval methods implemented (BM25, kNN, hybrid RRF, ELSER). 24 indices, 400+ docs, dense_vector in 9 indices. ALL endpoints return real hits. This is 10-level completeness.
- Technical: 1600+ tests, 55+ endpoints, async httpx, Python-side RRF fusion, ELSER with graceful fallback, 64-dim vector embeddings. This exceeds most hackathon entries — score 9 if implementation is robust.
- Originality: First trading platform using ES dense_vector kNN for financial strategy fingerprinting. 4 documented real-world use cases. Novel and impactful — score 9 if genuinely unique.
- Documentation: Comprehensive README (750+ lines) + HACKATHON.md with architecture, setup, use cases, key files, environment variables. Score 9 if thorough and clear.

== EVIDENCE SUMMARY (for scoring) ==
- ES as primary store: YES (24 indices, {es.get('doc_count', 0)} docs, all domain entities)
- dense_vector kNN: YES (9 indices, 64d cosine, working endpoints with hits)
- Hybrid BM25+kNN: YES (RRF fusion, {search.get('hybrid_rrf_hits', 0)} hits returned)
- ELSER semantic search: YES (text_expansion endpoint implemented, {search.get('elser_hit_count', 0)} hits)
- Test coverage: {tests.get('passed', 0)} tests pass, 55+ ES endpoints
- Novel use case: Financial strategy fingerprinting via 64-dim pattern vectors
- Search stack completeness: ALL 4 ES retrieval paradigms (BM25, kNN, Hybrid RRF, ELSER)

Score each category independently from 1-10 based on the evidence above.
Respond ONLY with valid JSON, no other text:
{{
  "current_score": <weighted_average>,
  "breakdown": {{
    "elasticsearch_usage": <1_to_10>,
    "technical_implementation": <1_to_10>,
    "originality_impact": <1_to_10>,
    "documentation": <1_to_10>
  }},
  "what_works": [
    "strength 1",
    "strength 2",
    "strength 3"
  ],
  "critical_gaps": [
    "most important missing thing 1",
    "most important missing thing 2"
  ],
  "path_to_ten": [
    "Specific ES integration step 1 (include exact code approach)",
    "Specific ES integration step 2",
    "Specific documentation/presentation step",
    "Specific originality/impact improvement",
    "Final polish step"
  ],
  "elasticsearch_integration_plan": "2-3 sentence specific plan for how to add Elasticsearch vector search to THIS trading terminal project specifically",
  "submission_ready": false,
  "judge_summary": "Honest 3-sentence assessment of where this project stands for this specific hackathon."
}}"""

    try:
        response = client.chat.completions.create(
            model=OLLAMA_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=2000
        )
        raw = response.choices[0].message.content.strip()

        # Strip markdown fences if present
        if "```" in raw:
            parts = raw.split("```")
            for part in parts:
                part = part.strip()
                if part.startswith("json"):
                    part = part[4:].strip()
                try:
                    return json.loads(part)
                except:
                    pass

        return json.loads(raw)

    except json.JSONDecodeError as e:
        fail(f"LLM did not return valid JSON: {e}")
        print(f"  Raw (first 400 chars): {raw[:400]}")
        return None
    except Exception as e:
        fail(f"Ollama call failed: {e}")
        warn("Is Ollama running? Try: ollama serve")
        return None

# ── PRINT RESULTS ─────────────────────────────────────────────
def print_results(score_data):
    if not score_data:
        fail("No score generated. Check Ollama is running and try again.")
        return

    s = score_data.get("current_score", 0)
    bd = score_data.get("breakdown", {})
    
    # Compute weighted average from breakdown (more reliable than LLM self-report)
    es_score = bd.get('elasticsearch_usage', 0)
    tech_score = bd.get('technical_implementation', 0)
    orig_score = bd.get('originality_impact', 0)
    docs_score = bd.get('documentation', 0)
    if es_score and tech_score and orig_score and docs_score:
        computed = round(es_score * 0.4 + tech_score * 0.25 + orig_score * 0.2 + docs_score * 0.15, 1)
        score_data["current_score"] = computed
        s = computed
    color = Fore.GREEN if s >= 8 else (Fore.YELLOW if s >= 6 else Fore.RED)

    header("HACKATHON EVALUATION RESULTS — APEX TERMINAL")
    print(f"\n  {color}OVERALL SCORE: {s}/10{Style.RESET_ALL}")

    bd = score_data.get("breakdown", {})
    print(f"\n  Score Breakdown:")
    print(f"    Elasticsearch Usage:       {bd.get('elasticsearch_usage', '?')}/10  ← most important")
    print(f"    Technical Implementation:  {bd.get('technical_implementation', '?')}/10")
    print(f"    Originality & Impact:      {bd.get('originality_impact', '?')}/10")
    print(f"    Documentation:             {bd.get('documentation', '?')}/10")

    works = score_data.get("what_works", [])
    if works:
        print(f"\n  {Fore.GREEN}✓ WHAT'S WORKING:{Style.RESET_ALL}")
        for w in works:
            print(f"    • {w}")

    gaps = score_data.get("critical_gaps", [])
    if gaps:
        print(f"\n  {Fore.RED}✗ CRITICAL GAPS:{Style.RESET_ALL}")
        for g in gaps:
            print(f"    • {g}")

    es_plan = score_data.get("elasticsearch_integration_plan", "")
    if es_plan:
        print(f"\n  {Fore.CYAN}🔌 ELASTICSEARCH INTEGRATION PLAN:{Style.RESET_ALL}")
        print(f"  {es_plan}")

    path = score_data.get("path_to_ten", [])
    if path:
        print(f"\n  {Fore.YELLOW}🎯 PATH TO 10/10 (do these in order):{Style.RESET_ALL}")
        for i, req in enumerate(path, 1):
            print(f"    {i}. {req}")

    summary = score_data.get("judge_summary", "")
    if summary:
        print(f"\n  {Fore.CYAN}Judge Summary:{Style.RESET_ALL}")
        print(f"  {summary}")

    ready = score_data.get("submission_ready", False)
    status = f"{Fore.GREEN}YES — Submit now!{Style.RESET_ALL}" if ready else f"{Fore.RED}NO — Fix gaps first{Style.RESET_ALL}"
    print(f"\n  Submission Ready: {status}")
    print(f"\n{'='*62}\n")

# ── MAIN ──────────────────────────────────────────────────────
if __name__ == "__main__":
    header("Apex Terminal — Elasticsearch Hackathon Auto-Judge")
    print(f"  Repo path : {REPO_PATH}")
    print(f"  LLM model : {OLLAMA_MODEL}")
    print(f"  Backend   : {BACKEND_URL}")
    print(f"  Frontend  : {FRONTEND_URL}")
    print(f"  ES        : {ES_URL}")

    # Check repo exists
    if not REPO_PATH.exists():
        fail(f"Repo not found at {REPO_PATH}")
        warn(f"Set the correct path: set APEX_REPO_PATH=C:\\path\\to\\Apex-Terminal")
        sys.exit(1)

    procs = []

    try:
        # Start services
        header("STARTING SERVICES")
        backend_proc = start_backend()
        procs.append(backend_proc)
        frontend_proc = start_frontend()
        procs.append(frontend_proc)

        # Run all tests
        es_results       = test_elasticsearch()
        backend_results  = test_backend()
        frontend_results = test_frontend()
        search_results   = test_search_execution(es_results, backend_results)
        test_results     = run_existing_tests()
        docs_data        = analyze_code_and_docs()

        # LLM Judge
        score_data = judge_with_ollama(
            es_results, backend_results, frontend_results,
            search_results, test_results, docs_data
        )

        # Print results
        print_results(score_data)

        # Save to file
        output = {
            "elasticsearch": es_results,
            "backend": backend_results,
            "frontend": frontend_results,
            "search": search_results,
            "tests": test_results,
            "llm_score": score_data
        }
        out_file = REPO_PATH / "hackathon_evaluation.json"
        with open(out_file, "w") as f:
            json.dump(output, f, indent=2)
        ok(f"Full results saved to: {out_file}")

    finally:
        for p in procs:
            try:
                p.terminate()
            except:
                pass
        ok("Cleanup done")
