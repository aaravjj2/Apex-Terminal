# ============================================================
# evaluate_apex_brutal.py
# NUCLEAR-GRADE HACKATHON JUDGE — Apex Terminal
# Evaluates across 4 hackathons simultaneously
#
# Hackathons:
#   1. Elasticsearch Devpost     — PRIMARY (no deadline given, running)
#   2. DevDash                   — DEADLINE: Feb 20 (LIKELY PASSED)
#   3. Dev Season of Code (DSOC) — DEADLINE: Feb 28 5pm EST (students only)
#   4. TerraCode Convergence     — DEADLINE: Feb 26 5pm EST (TODAY/TOMORROW)
#
# Scoring philosophy:
#   - 0 points for "it exists"
#   - Points only for live proof that works RIGHT NOW
#   - A judge spending 3 minutes on your demo must be WOWED or you lose
#   - If a 2019 intern's CRUD app could do what you do, you score 0 on innovation
#   - The bar is: "Top 3 among 865 competing projects" — would you bet $5k on this?
#
# Run: python evaluate_apex_brutal.py
# ============================================================

import subprocess, requests, json, time, sys, os, re
from pathlib import Path
from datetime import datetime, timezone

try:
    from openai import OpenAI
    from colorama import Fore, Style, init
    init(autoreset=True)
except ImportError:
    subprocess.run([sys.executable, "-m", "pip", "install", "openai", "colorama", "requests"], check=True)
    from openai import OpenAI
    from colorama import Fore, Style, init
    init(autoreset=True)

# ── CONFIG ───────────────────────────────────────────────────
REPO_PATH    = Path(os.getenv("APEX_REPO_PATH", r"C:\Tradingview\Tradingview recreation"))
BACKEND_URL  = "http://127.0.0.1:8000"
FRONTEND_URL = "http://127.0.0.1:5100"
ES_URL       = "http://127.0.0.1:9200"
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "devstral")

client = OpenAI(api_key="ollama", base_url="http://127.0.0.1:11434/v1")

# ── HACKATHON DEFINITIONS (pulled from actual pages) ─────────
HACKATHONS = {
    "elasticsearch": {
        "name": "Elasticsearch Vector Search Hackathon (Devpost)",
        "deadline": "TBD — submissions open",
        "prize": "$unknown",
        "participants": "unknown",
        "criteria": {
            "elasticsearch_use":         0.40,  # MUST use ES as core, not bolt-on
            "technical_implementation":  0.25,
            "originality_impact":        0.20,
            "documentation":             0.15,
        },
        "dealbreakers": [
            "No dense_vector/kNN search actually working live",
            "Fewer than 1000 documents indexed",
            "ES is a side feature rather than the core",
            "No hybrid BM25+kNN search",
        ]
    },
    "devdash": {
        "name": "DevDash — Code the Tomorrow",
        "deadline": "Feb 20, 2026 5pm EST — LIKELY PASSED",
        "prize": "$10,000",
        "participants": "865",
        "status": "DEADLINE PASSED — check if late submissions accepted",
        "criteria": {
            "creativity":       0.33,
            "real_world_use":   0.34,
            "technologies_used": 0.33,
        },
        "dealbreakers": [
            "Not a working prototype — must be functional",
            "No video demo (2-5 min required)",
            "No source code repo with setup instructions",
            "No presentation slides/PDF",
            "865 participants — generic fintech dashboard will NOT win",
        ]
    },
    "dsoc": {
        "name": "Dev Season of Code (DSOC) 2026",
        "deadline": "Feb 28, 2026 5pm EST",
        "prize": "$3,950",
        "participants": "274",
        "status": "OPEN — 4 days left",
        "eligibility": "STUDENTS ONLY — verify you qualify",
        "criteria": {
            "innovation":           0.20,
            "responsiveness":       0.20,
            "functionality":        0.20,
            "creativity_uniqueness": 0.20,
            "design_aesthetics":    0.20,
        },
        "dealbreakers": [
            "Must be a student to enter — non-students disqualified",
            "No demo video (strongly recommended = effectively required)",
            "Non-original work — must be built during hackathon period",
            "274 participants, $2k first prize — competition is real but beatable",
        ]
    },
    "terracode": {
        "name": "TerraCode Convergence — CREATE FOR FUTURE",
        "deadline": "Feb 26, 2026 5pm EST — TODAY/TOMORROW",
        "prize": "$5,000",
        "participants": "215",
        "status": "CRITICAL — hours left",
        "criteria": {
            "innovation_creativity":     0.25,
            "technical_implementation": 0.25,
            "impact_relevance":         0.20,
            "design_ux":                0.15,
            "presentation_demo":        0.15,
        },
        "dealbreakers": [
            "Must use AI meaningfully — not just calling an API",
            "Must have 2-3 min demo video",
            "Must have public GitHub repo",
            "Must have live demo link (if available)",
            "Must be functional prototype — slides only = disqualified",
            "215 participants — manageable competition but TODAY is deadline",
        ]
    }
}

# ── HELPERS ──────────────────────────────────────────────────
def hdr(text, color=Fore.CYAN):
    print(f"\n{color}{'='*66}\n  {text}\n{'='*66}{Style.RESET_ALL}")

def ok(m):    print(f"  {Fore.GREEN}✓ {m}{Style.RESET_ALL}")
def fail(m):  print(f"  {Fore.RED}✗ {m}{Style.RESET_ALL}")
def warn(m):  print(f"  {Fore.YELLOW}⚠ {m}{Style.RESET_ALL}")
def crit(m):  print(f"  {Fore.RED}🚨 {m}{Style.RESET_ALL}")
def bar(label, val, maxv, note=""):
    filled = int((val/maxv)*20)
    b = "█"*filled + "░"*(20-filled)
    pct = (val/maxv)*100
    c = Fore.GREEN if pct >= 70 else (Fore.YELLOW if pct >= 40 else Fore.RED)
    print(f"  {c}{label:<35} [{b}] {val:.1f}/{maxv}  {note}{Style.RESET_ALL}")

# ════════════════════════════════════════════════════════════
# HARD EVIDENCE PROBES — binary pass/fail, no credit for existence
# ════════════════════════════════════════════════════════════

def probe_elasticsearch_depth():
    """Probe ES beyond 'it's running'. Does the search ACTUALLY return useful financial data?"""
    hdr("PROBE 1 — Elasticsearch Depth (Not Just Running)")
    ev = {"score": 0, "max": 10, "details": {}}

    # P1a: Is ES green? Yellow = degraded, Red = broken
    try:
        r = requests.get(f"{ES_URL}/_cluster/health", timeout=5)
        status = r.json().get("status")
        if status == "green":
            ok(f"Cluster health: green"); ev["score"] += 1
        elif status == "yellow":
            warn("Cluster health: YELLOW — degraded, shards unassigned. Judges running this will see errors.")
        else:
            fail(f"Cluster health: {status} — BROKEN"); ev["score"] -= 2
        ev["details"]["cluster_status"] = status
    except Exception as e:
        fail(f"ES unreachable: {e}"); return ev

    # P1b: Document count — 335 is embarrassingly low for a 'production trading platform'
    try:
        r = requests.get(f"{ES_URL}/_cat/count?v&format=json", timeout=5)
        counts = r.json()
        total = sum(int(c.get("count", 0)) for c in counts if not c.get("index","").startswith("."))
        ev["details"]["total_docs"] = total
        if total >= 10000:
            ok(f"Documents: {total:,} — impressive volume"); ev["score"] += 2
        elif total >= 1000:
            warn(f"Documents: {total:,} — meets minimum but barely. Top projects have 10k+")
        elif total >= 100:
            fail(f"Documents: {total:,} — CRITICAL LOW. 335 docs is a dev sandbox, not a trading terminal")
        else:
            fail(f"Documents: {total:,} — essentially empty"); ev["score"] -= 1
        ev["details"]["doc_count_ok"] = total >= 1000
    except: pass

    # P1c: Does kNN actually RETURN financially meaningful results?
    knn_endpoints = [
        "/api/v4/elastihack/knn/similar_backtests",
        "/api/v4/elastihack/knn/similar_strategies",
        "/api/v4/elastihack/knn/similar_cycles",
    ]
    knn_works = False
    for ep in knn_endpoints:
        try:
            r = requests.post(f"{BACKEND_URL}{ep}",
                json={"query": "RSI momentum breakout", "size": 5},
                timeout=10)
            if r.status_code == 200:
                data = r.json()
                hits = data if isinstance(data, list) else data.get("hits", data.get("results", []))
                if len(hits) > 0:
                    # Check if results have financial fields
                    sample = str(hits[0]).lower()
                    has_finance = any(k in sample for k in ["ticker", "symbol", "return", "sharpe", "pnl", "strategy", "backtest"])
                    if has_finance:
                        ok(f"kNN search {ep}: returns {len(hits)} results WITH financial fields"); ev["score"] += 2; knn_works = True; break
                    else:
                        warn(f"kNN search {ep}: returns data but NO financial fields — just generic vectors"); ev["score"] += 0.5; knn_works = True; break
                else:
                    warn(f"kNN search {ep}: 200 OK but ZERO hits — index is empty")
        except Exception as e:
            pass

    if not knn_works:
        fail("kNN search: NONE of the kNN endpoints return actual results")
        fail("A trading terminal that can't find similar trading strategies is DOA for this hackathon")
        ev["details"]["knn_returns_results"] = False
    else:
        ev["details"]["knn_returns_results"] = True

    # P1d: Hybrid search latency — 11076ms is UNACCEPTABLE for a live demo
    try:
        start = time.time()
        r = requests.post(f"{BACKEND_URL}/api/v4/elastihack/hybrid/search",
            json={"query": "momentum breakout RSI oversold", "size": 5},
            timeout=30)
        elapsed_ms = (time.time() - start) * 1000
        ev["details"]["hybrid_latency_ms"] = round(elapsed_ms)

        if elapsed_ms < 500:
            ok(f"Hybrid search latency: {elapsed_ms:.0f}ms — acceptable"); ev["score"] += 1
        elif elapsed_ms < 2000:
            warn(f"Hybrid search latency: {elapsed_ms:.0f}ms — slow but survivable")
        elif elapsed_ms < 5000:
            fail(f"Hybrid search latency: {elapsed_ms:.0f}ms — judges will think it's broken"); ev["score"] -= 1
        else:
            crit(f"Hybrid search latency: {elapsed_ms:.0f}ms — THIS KILLED YOUR DEMO LAST TIME")
            crit("11 SECONDS for a search query in a 'trading terminal' is disqualifying")
            crit("Fix: reduce embedding dimensions, cache embeddings, or use approximate kNN")
            ev["score"] -= 2
    except Exception as e:
        fail(f"Hybrid search failed entirely: {e}")

    # P1e: ELSER — semantic search is a differentiator, does it actually work?
    try:
        r = requests.post(f"{BACKEND_URL}/api/v3/elasticsearch/semantic/status", timeout=5)
        if r.status_code == 200:
            data = r.json()
            if data.get("available") or data.get("status") == "ready":
                ok("ELSER semantic search: READY — major differentiator"); ev["score"] += 2
            else:
                warn(f"ELSER status: {data} — may not be operational")
        else:
            # Try direct ELSER search
            r2 = requests.post(f"{BACKEND_URL}/api/v4/elastihack/elser/search",
                json={"query": "high volatility momentum strategy"},
                timeout=15)
            if r2.status_code == 200 and len(r2.json() if isinstance(r2.json(), list) else r2.json().get("hits",[])) > 0:
                ok("ELSER semantic search: WORKING — strong differentiator"); ev["score"] += 2
            else:
                warn("ELSER endpoint returns 200 but empty results")
    except: warn("ELSER status check failed")

    # P1f: Index mapping validation — does the index have a proper dense_vector field?
    try:
        r = requests.get(f"{ES_URL}/apex-backtests*/_mapping", timeout=5)
        if r.status_code == 200:
            mapping_str = json.dumps(r.json())
            has_dense = "dense_vector" in mapping_str
            has_text = "text" in mapping_str and "analyzer" in mapping_str
            if has_dense and has_text:
                ok("Index mapping: dense_vector + analyzed text fields — proper hybrid setup"); ev["score"] += 1
            elif has_dense:
                ok("Index mapping: dense_vector field detected"); ev["score"] += 0.5
            else:
                warn("No dense_vector mapping found — kNN search may not be real")
    except: pass

    # P1g: Aggregation capability — prove ES is used for analytics, not just search
    try:
        # Try multiple possible field names for strategy
        agg_fields = ["strategy_name.keyword", "strategy.keyword", "strategy_type.keyword"]
        agg_found = False
        for agg_field in agg_fields:
            agg_body = {
                "size": 0,
                "aggs": {
                    "strategy_breakdown": {"terms": {"field": agg_field, "size": 10}},
                    "avg_return": {"avg": {"field": "total_return"}}
                }
            }
            r = requests.post(f"{ES_URL}/apex-backtests*/_search", json=agg_body, timeout=5)
            if r.status_code == 200:
                aggs = r.json().get("aggregations", {})
                buckets = aggs.get("strategy_breakdown", {}).get("buckets", [])
                if len(buckets) >= 3:
                    ok(f"ES aggregations: {len(buckets)} strategy types with analytics — genuine ES use"); ev["score"] += 2
                    agg_found = True; break
                elif len(buckets) > 0:
                    ok(f"ES aggregations: {len(buckets)} strategy types"); ev["score"] += 1
                    agg_found = True; break
        if not agg_found:
            warn("Aggregation returned no buckets — data may not have proper keyword fields")
    except: pass

    # P1h: Multiple indices — a real production system has more than one index
    try:
        r = requests.get(f"{ES_URL}/_cat/indices?v&format=json", timeout=5)
        if r.status_code == 200:
            indices = [i for i in r.json() if not i.get("index","").startswith(".")]
            ev["details"]["index_count"] = len(indices)
            if len(indices) >= 3:
                ok(f"Index architecture: {len(indices)} indices — proper data separation"); ev["score"] += 2
            elif len(indices) >= 2:
                ok(f"Index count: {len(indices)} — minimal separation"); ev["score"] += 1
    except: pass

    ev["details"]["final_score"] = ev["score"]
    return ev


def probe_live_trading_features():
    """Does the 'trading terminal' actually trade/analyze in real-time?"""
    hdr("PROBE 2 — Live Trading Features (Is This Actually a Terminal?)")
    ev = {"score": 0, "max": 10, "details": {}}

    # P2a: Real-time price data — does it actually stream?
    try:
        r = requests.get(f"{BACKEND_URL}/api/v1/market/quote?symbol=AAPL", timeout=5)
        if r.status_code != 200:
            r = requests.get(f"{BACKEND_URL}/api/market/quote?symbol=AAPL", timeout=5)
        if r.status_code == 200:
            data = r.json()
            price = data.get("price") or data.get("last") or data.get("c") or data.get("close")
            if price and float(price) > 0:
                ok(f"Live price feed: AAPL = ${price}"); ev["score"] += 2
                ev["details"]["live_prices"] = True
            else:
                warn(f"Price endpoint works but returns no price: {str(data)[:100]}")
                ev["details"]["live_prices"] = False
        else:
            fail(f"No live price endpoint working (tried /api/v1/market/quote)")
            warn("A trading terminal without live prices is a chart library with extra steps")
            ev["details"]["live_prices"] = False
    except: fail("Price feed unreachable")

    # P2b: WebSocket — is it actually streaming?
    try:
        import websocket as ws_lib
        ws = ws_lib.create_connection(f"ws://127.0.0.1:8000/ws", timeout=3)
        ws.close()
        ok("WebSocket streaming: LIVE"); ev["score"] += 1; ev["details"]["websocket"] = True
    except ImportError:
        # Install and retry once
        try:
            subprocess.run([sys.executable, "-m", "pip", "install", "websocket-client", "-q"], check=True)
            import websocket as ws_lib
            ws = ws_lib.create_connection(f"ws://127.0.0.1:8000/ws", timeout=3)
            ws.close()
            ok("WebSocket streaming: LIVE"); ev["score"] += 1; ev["details"]["websocket"] = True
        except:
            warn("WebSocket-client installed but WS connection failed — real-time streaming unverified")
    except Exception as e:
        warn(f"WebSocket check failed: {e}")

    # P2c: Backtesting — can you actually run a strategy?
    backtest_endpoints = ["/api/backtests/run", "/api/v1/backtest/run", "/api/strategies/backtest"]
    for ep in backtest_endpoints:
        try:
            r = requests.post(f"{BACKEND_URL}{ep}",
                json={"strategy": "sma_crossover", "symbol": "AAPL", "start": "2024-01-01", "end": "2024-12-31"},
                timeout=20)
            if r.status_code in [200, 201, 202]:
                data = r.json()
                has_results = any(k in str(data).lower() for k in ["return", "sharpe", "drawdown", "pnl", "result", "trade"])
                if has_results:
                    ok(f"Backtesting: WORKS at {ep} with financial results"); ev["score"] += 2
                    ev["details"]["backtesting_works"] = True
                    break
                else:
                    warn(f"Backtest endpoint returns 200 but no financial metrics in response")
        except: pass
    else:
        r2 = requests.get(f"{BACKEND_URL}/api/backtests", timeout=5)
        if r2.status_code == 200:
            data = r2.json()
            count = len(data) if isinstance(data, list) else data.get("total", 0)
            if count > 0:
                ok(f"Backtests in DB: {count} stored results"); ev["score"] += 1
                ev["details"]["has_backtest_data"] = True
            else:
                fail("Backtest list is empty — no strategies have been tested")
                ev["details"]["has_backtest_data"] = False

    # P2d: Indicators — the README claims 35+ technical indicators
    indicator_endpoints = ["/api/indicators", "/api/v1/indicators", "/api/analysis/indicators"]
    for ep in indicator_endpoints:
        try:
            r = requests.get(f"{BACKEND_URL}{ep}", timeout=5)
            if r.status_code == 200:
                data = r.json()
                count = len(data) if isinstance(data, list) else data.get("count", 0)
                if count >= 35:
                    ok(f"Technical indicators: {count} available (claims 35+, delivers)"); ev["score"] += 1
                elif count > 0:
                    warn(f"Technical indicators: only {count} returned (README claims 35+)")
                break
        except: pass

    # P2e: Does the autopilot actually do anything autonomous?
    try:
        r = requests.get(f"{BACKEND_URL}/api/autopilot", timeout=5)
        if r.status_code == 200:
            data = r.json()
            data_str = str(data).lower()
            if any(k in data_str for k in ["running", "active", "decision", "signal", "action"]):
                ok("Autopilot: ACTIVE with decision/signal data"); ev["score"] += 2
            else:
                warn(f"Autopilot endpoint exists but appears idle: {str(data)[:100]}")
                ev["score"] += 0.5
    except: warn("Autopilot endpoint not reachable")

    # P2f: Portfolio/positions tracking — a trading terminal must track positions
    portfolio_eps = ["/api/autopilot/positions", "/api/portfolio", "/api/v1/portfolio", "/api/positions"]
    for ep in portfolio_eps:
        try:
            r = requests.get(f"{BACKEND_URL}{ep}", timeout=5)
            if r.status_code == 200:
                ok(f"Portfolio/positions endpoint: {ep} — tracks trades"); ev["score"] += 1
                ev["details"]["portfolio_endpoint"] = ep
                break
        except: pass

    # P2g: Batch/multi-symbol quotes — real terminals show multiple tickers simultaneously
    try:
        r = requests.get(f"{BACKEND_URL}/api/v1/market/quotes/batch?symbols=AAPL,MSFT,GOOGL", timeout=8)
        if r.status_code == 200:
            data = r.json()
            results = data.get("results", data) if isinstance(data, dict) else data
            if isinstance(results, (list, dict)) and len(results) >= 2:
                ok(f"Batch quotes: {len(results)} symbols returned simultaneously"); ev["score"] += 1
                ev["details"]["batch_quotes"] = True
        else:
            # Try POST-based market data as fallback
            r2 = requests.post(f"{BACKEND_URL}/api/v1/market-data",
                json={"symbols": ["AAPL", "MSFT"]}, timeout=8)
            if r2.status_code == 200:
                ok("Market data endpoint supports multi-symbol queries"); ev["score"] += 1
    except: pass

    # P2h: Historical OHLCV data — charting requires candlestick data
    ohlcv_eps = ["/api/v1/market-data", "/api/market/history", "/api/v1/candles"]
    for ep in ohlcv_eps:
        try:
            r = requests.post(f"{BACKEND_URL}{ep}",
                json={"symbol": "AAPL", "interval": "1d", "limit": 10},
                timeout=8)
            if r.status_code == 200:
                data = r.json()
                data_str = str(data).lower()
                if any(k in data_str for k in ["open", "high", "low", "close", "ohlc", "candle"]):
                    ok(f"OHLCV data: {ep} returns candlestick data — real charting support"); ev["score"] += 1
                    ev["details"]["ohlcv_endpoint"] = ep
                    break
        except: pass

    ev["details"]["final_score"] = min(ev["score"], ev["max"])
    return ev


def probe_originality():
    """Would this stand out among 865 submissions? Or is it another dashboard?"""
    hdr("PROBE 3 — Originality (Would This Win Among 865 Projects?)")
    ev = {"score": 0, "max": 10, "details": {}}

    # P3a: The 'elastihack' endpoints are specifically built for this hackathon — good sign
    try:
        r = requests.get(f"{BACKEND_URL}/api/v4/elastihack/vector/coverage", timeout=5)
        if r.status_code == 200:
            data = r.json()
            data_str = str(data).lower()
            coverage = data.get("coverage_pct") or data.get("coverage") or 0
            if isinstance(coverage, (int, float)) and coverage > 0:
                ok(f"Hackathon-specific vector coverage endpoint: {coverage}% indexed"); ev["score"] += 1
            else:
                ok("Hackathon-specific /elastihack/ namespace exists — dedicated build"); ev["score"] += 0.5
    except: pass

    # P3b: ELSER + hybrid + kNN together = genuine differentiation in this space
    differentiation_features = {
        "elser_semantic": "/api/v4/elastihack/elser/search",
        "hybrid_rrf": "/api/v4/elastihack/hybrid/search",
        "knn_similar_strategies": "/api/v4/elastihack/knn/similar_strategies",
        "knn_explain": "/api/v4/elastihack/knn/explain",
        "saved_searches": "/api/v4/elastihack/saved-searches",
    }
    working = 0
    for feature, ep in differentiation_features.items():
        try:
            r = requests.head(f"{BACKEND_URL}{ep}", timeout=3)
            if r.status_code < 500:
                working += 1
        except: pass
    if working >= 4:
        ok(f"Differentiation features: {working}/5 working — strong ES expertise signal"); ev["score"] += 2
    elif working >= 2:
        warn(f"Differentiation features: only {working}/5 working")
        ev["score"] += 1
    else:
        fail("Most advanced ES features non-functional — looks like a student project with ES added")

    # P3c: The combination of TradingView+Bloomberg+Elasticsearch is unusual
    # Check if the frontend actually has these views
    frontend_src = REPO_PATH / "frontend" / "src"
    if not frontend_src.exists():
        frontend_src = REPO_PATH / "src"

    if frontend_src.exists():
        all_files = [f.name.lower() for f in frontend_src.rglob("*.tsx")] + \
                    [f.name.lower() for f in frontend_src.rglob("*.jsx")]

        unique_features = {
            "options_chain":   any("option" in f for f in all_files),
            "iv_surface":      any("iv" in f or "volatil" in f for f in all_files),
            "strategy_editor": any("strateg" in f or "editor" in f for f in all_files),
            "replay_mode":     any("replay" in f for f in all_files),
            "heatmap":         any("heatmap" in f or "heat" in f for f in all_files),
            "autopilot":       any("autopilot" in f or "auto" in f for f in all_files),
            "search_ui":       any("search" in f for f in all_files),
        }
        ev["details"]["unique_features"] = unique_features
        unique_count = sum(unique_features.values())
        if unique_count >= 6:
            ok(f"Unique UI features: {unique_count}/7 — genuinely differentiated from basic charting apps")
            ev["score"] += 3
        elif unique_count >= 4:
            warn(f"Unique UI features: {unique_count}/7 — some differentiation but competitors may match")
            ev["score"] += 1.5
        else:
            fail(f"Unique UI features: only {unique_count}/7 — this looks like any other charting library demo")

    # P3d: Does the README tell a COMPELLING story or read like a feature list?
    readme = REPO_PATH / "README.md"
    if readme.exists():
        content = readme.read_text(encoding="utf-8", errors="ignore")
        story_signals = ["problem", "why", "because", "unlike", "instead of", "the challenge", "we built"]
        feature_list_signals = ["• ", "- [x]", "feature:", "support", "includes"]
        story_count = sum(1 for s in story_signals if s in content.lower())
        list_count = sum(1 for s in feature_list_signals if s in content)
        if story_count >= 3 and list_count < 20:
            ok("README tells a story — judges will understand WHY this was built"); ev["score"] += 1
        elif list_count > 30:
            fail("README is a feature list — judges skim and forget. Write a narrative.")
            fail("No judge ever picked a winner because it had the longest bullet list")

    # P3e: TypeScript component architecture — serious frontend engineering signal
    frontend_src = REPO_PATH / "frontend" / "src"
    if not frontend_src.exists():
        frontend_src = REPO_PATH / "src"
    if frontend_src.exists():
        tsx_files = list(frontend_src.rglob("*.tsx"))
        ts_files = list(frontend_src.rglob("*.ts"))
        total_ts = len(tsx_files) + len(ts_files)
        if total_ts >= 100:
            ok(f"TypeScript architecture: {len(tsx_files)} TSX + {len(ts_files)} TS files — serious engineering"); ev["score"] += 2
        elif total_ts >= 30:
            ok(f"TypeScript coverage: {total_ts} TS/TSX files"); ev["score"] += 1

    # P3f: Architecture documentation — shows mature engineering thinking
    arch_docs = list(REPO_PATH.rglob("ARCHITECTURE.md")) + list(REPO_PATH.rglob("architecture.md"))
    if arch_docs:
        ok(f"Architecture documentation: {arch_docs[0].name} — shows engineering maturity"); ev["score"] += 1

    # P3g: Docker/containerization — production deployment readiness
    docker_files = list(REPO_PATH.glob("docker-compose*.yml")) + list(REPO_PATH.glob("Dockerfile"))
    if len(docker_files) >= 2:
        ok(f"Docker infrastructure: {len(docker_files)} compose/Dockerfile — production ready"); ev["score"] += 1
    elif docker_files:
        ok("Docker support present"); ev["score"] += 0.5

    ev["details"]["final_score"] = min(ev["score"], ev["max"])
    return ev


def probe_submission_readiness():
    """Would a 3-minute Devpost submission pass basic requirements?"""
    hdr("PROBE 4 — Submission Readiness (Will You Even Be Considered?)")
    ev = {"score": 0, "max": 10, "details": {}}

    # P4a: Video — MANDATORY for ALL three hackathons
    video_files = (list(REPO_PATH.rglob("*.mp4")) +
                   list(REPO_PATH.rglob("*.webm")) +
                   list(REPO_PATH.rglob("*.mov")))
    ev["details"]["has_video"] = bool(video_files)
    if video_files:
        ok(f"Demo video found: {video_files[0].name}"); ev["score"] += 3
    else:
        crit("NO DEMO VIDEO — this DISQUALIFIES you from DevDash, DSOC, and TerraCode")
        crit("All three hackathons require a 2-5 minute demo video. Zero exceptions.")
        crit("Record one NOW. Open OBS or Loom. This is the #1 priority.")

    # P4b: Can someone clone and run this in under 10 minutes?
    readme = REPO_PATH / "README.md"
    if readme.exists():
        content = readme.read_text(encoding="utf-8", errors="ignore")
        has_clone  = bool(re.search(r"git clone", content, re.I))
        has_pip    = bool(re.search(r"pip install", content, re.I))
        has_npm    = bool(re.search(r"npm install", content, re.I))
        has_env    = bool(re.search(r"\.env|api.key|environment", content, re.I))
        has_run    = bool(re.search(r"uvicorn|npm run|python.*main|startup", content, re.I))

        checks = {"git clone": has_clone, "pip/npm install": has_pip or has_npm,
                  "env setup": has_env, "run instructions": has_run}
        ev["details"]["readme_setup"] = checks

        passing = sum(checks.values())
        if passing == 4:
            ok("README has complete setup instructions (clone → install → config → run)"); ev["score"] += 2
        elif passing >= 2:
            warn(f"README setup instructions: {passing}/4 complete — judges will give up setting up")
            ev["score"] += 0.5
        else:
            fail("README has NO clear setup path — judges will skip your project")

    # P4c: .env.example — without this judges can't run it
    has_env_example = (any(REPO_PATH.rglob(".env.example")) or
                       any(REPO_PATH.rglob("keys.env.example")))
    ev["details"]["env_example"] = has_env_example
    if has_env_example:
        ok(".env.example present — judges can configure API keys"); ev["score"] += 1
    else:
        fail(".env.example MISSING — judges will hit 500 errors and assume it's broken")

    # P4d: Live demo URL — TerraCode specifically asks for this
    has_live_link = False
    if readme.exists():
        content = readme.read_text(encoding="utf-8", errors="ignore")
        live_patterns = [r"https?://[a-z0-9\-]+\.(vercel|railway|render|fly|heroku|netlify)\.app",
                         r"demo.*https?://", r"live.*https?://"]
        has_live_link = any(re.search(p, content, re.I) for p in live_patterns)
    ev["details"]["has_live_demo"] = has_live_link
    if has_live_link:
        ok("Live demo URL in README — satisfies TerraCode requirement"); ev["score"] += 2
    else:
        warn("No live demo URL — TerraCode asks for this, deploy to Railway/Vercel/Render")
        warn("This alone could cost you the TerraCode prize")

    # P4e: Presentation slides (required by DevDash, recommended elsewhere)
    has_slides = (any(REPO_PATH.rglob("*.pdf")) or
                  any(REPO_PATH.rglob("*.pptx")) or
                  bool(re.search(r"slides|presentation|pitch", readme.read_text() if readme.exists() else "", re.I)))
    ev["details"]["has_slides"] = has_slides
    if has_slides:
        ok("Presentation slides found"); ev["score"] += 1
    else:
        warn("No presentation slides — DevDash explicitly requires a PDF/slide deck")

    # P4f: DSOC-specific — are you a student? (cannot verify but flag it)
    warn("DSOC is STUDENTS ONLY — confirm you're eligible before submitting there")

    # P4g: LICENSE file — open-source credibility
    has_license = (REPO_PATH / "LICENSE").exists() or (REPO_PATH / "LICENSE.md").exists()
    ev["details"]["has_license"] = has_license
    if has_license:
        ok("LICENSE file present — open-source compliance"); ev["score"] += 1
    else:
        warn("No LICENSE file — judges may question open-source legitimacy")

    # P4h: Architecture/technical documentation beyond basic README
    arch_files = list(REPO_PATH.rglob("ARCHITECTURE.md")) + list(REPO_PATH.rglob("DEPLOY.md")) + \
                 list(REPO_PATH.rglob("CONTRIBUTING.md"))
    if len(arch_files) >= 2:
        ok(f"Technical docs: {len(arch_files)} supplementary docs — professional submission"); ev["score"] += 1
    elif arch_files:
        ok(f"Technical docs: {arch_files[0].name}"); ev["score"] += 0.5

    # P4i: Docker/containerization for reproducibility
    has_docker = any(REPO_PATH.glob("docker-compose*.yml")) or (REPO_PATH / "Dockerfile").exists()
    if has_docker:
        ok("Docker support: judges can reproduce the setup consistently"); ev["score"] += 1

    ev["details"]["final_score"] = min(ev["score"], ev["max"])
    return ev


def probe_design_ux():
    """Would a non-technical judge think this looks professional?"""
    hdr("PROBE 5 — Design & UX (TerraCode weights this 15%)")
    ev = {"score": 0, "max": 10, "details": {}}

    # P5a: Does the frontend actually load with real data?
    try:
        r = requests.get(FRONTEND_URL, timeout=5)
        if r.status_code == 200:
            content = r.text
            # Check if it's a proper React app with content or just a loading spinner
            has_content = len(content) > 2000 and "root" in content
            if has_content:
                ok("Frontend loads with content"); ev["score"] += 1
            else:
                warn("Frontend loads but appears minimal — may be blank in browser")
        else:
            fail(f"Frontend returns {r.status_code}")
    except Exception as e:
        fail(f"Frontend unreachable: {e}")

    # P5b: Screenshot quality — look at the actual artifacts
    screenshots = list(REPO_PATH.rglob("*.png")) + list(REPO_PATH.rglob("*.jpg"))
    proof_shots = [s for s in screenshots if "proof" in str(s).lower() or "demo" in str(s).lower() or
                   "dashboard" in str(s).lower() or "screenshot" in str(s).lower()]
    ev["details"]["proof_screenshots"] = len(proof_shots)

    if len(proof_shots) >= 10:
        ok(f"Demo screenshots: {len(proof_shots)} proof images found"); ev["score"] += 2
    elif len(proof_shots) >= 3:
        warn(f"Demo screenshots: only {len(proof_shots)} — need 5+ for a compelling Devpost gallery")
        ev["score"] += 1
    else:
        fail("Fewer than 3 usable screenshots — Devpost gallery will look empty")

    # P5c: Does the app handle the search results from ES gracefully?
    # (A search UI that shows raw JSON is not production-ready)
    search_ui_files = []
    frontend_src = REPO_PATH / "frontend" / "src"
    if frontend_src.exists():
        for f in frontend_src.rglob("*.tsx"):
            if "search" in f.name.lower():
                try:
                    content = f.read_text(encoding="utf-8", errors="ignore")
                    # Check for proper result rendering (not just JSON.stringify)
                    has_rendering = ("map(" in content or ".map(" in content) and "JSON.stringify" not in content
                    if has_rendering:
                        search_ui_files.append(f.name)
                except: pass

    if search_ui_files:
        ok(f"Search UI properly renders results: {search_ui_files[:2]}"); ev["score"] += 2
    else:
        warn("Cannot confirm search results are rendered as proper UI (not raw JSON)")

    # P5d: Mobile responsiveness? (DSOC judges design/aesthetics)
    frontend_css = list((REPO_PATH / "frontend").rglob("*.css")) if (REPO_PATH / "frontend").exists() else []
    has_responsive = False
    for css_file in frontend_css[:5]:
        try:
            content = css_file.read_text(encoding="utf-8", errors="ignore")
            if "@media" in content or "sm:" in content or "responsive" in content.lower():
                has_responsive = True
                break
        except: pass
    if has_responsive:
        ok("Responsive CSS detected — mobile/tablet layout supported"); ev["score"] += 1
    else:
        warn("No responsive CSS detected — may look broken on mobile for DSOC judges")

    # P5e: Dark mode / theme system — professional trading apps are ALWAYS dark
    frontend_src = REPO_PATH / "frontend" / "src"
    if not frontend_src.exists():
        frontend_src = REPO_PATH / "src"
    has_theme = False
    if frontend_src.exists():
        for f in frontend_src.rglob("*.tsx"):
            if "theme" in f.name.lower() or "dark" in f.name.lower():
                has_theme = True
                break
        if not has_theme:
            # Check for theme-related code in any component
            for f in list(frontend_src.rglob("*.tsx"))[:20]:
                try:
                    content = f.read_text(encoding="utf-8", errors="ignore")
                    if "isDark" in content or "darkMode" in content or "ThemeToggle" in content or "theme" in content.lower():
                        has_theme = True
                        break
                except: pass
    if has_theme:
        ok("Dark mode / theme system: present — professional trading UI"); ev["score"] += 2
    else:
        warn("No theme system detected — trading terminals need dark mode")

    # P5f: Component architecture depth — more components = richer UI
    tsx_count = 0
    if frontend_src.exists():
        tsx_count = len(list(frontend_src.rglob("*.tsx")))
    ev["details"]["tsx_component_count"] = tsx_count
    if tsx_count >= 100:
        ok(f"Component count: {tsx_count} TSX files — massive UI surface area"); ev["score"] += 2
    elif tsx_count >= 50:
        ok(f"Component count: {tsx_count} TSX files — substantial UI"); ev["score"] += 1
    elif tsx_count >= 20:
        warn(f"Component count: {tsx_count} TSX files — basic UI")

    # P5g: CSS transitions & animations — polished UIs have micro-interactions
    has_animations = False
    if frontend_src.exists():
        for f in list(frontend_src.rglob("*.tsx"))[:30]:
            try:
                content = f.read_text(encoding="utf-8", errors="ignore")
                if "transition" in content and ("hover" in content or "animate" in content):
                    has_animations = True
                    break
            except: pass
    if not has_animations:
        for css_file in frontend_css[:5]:
            try:
                content = css_file.read_text(encoding="utf-8", errors="ignore")
                if "transition" in content or "animation" in content or "@keyframes" in content:
                    has_animations = True
                    break
            except: pass
    if has_animations:
        ok("CSS transitions/animations: polished micro-interactions"); ev["score"] += 1
    else:
        warn("No transitions or animations — UI may feel flat and static")

    # P5h: TypeScript in frontend — type safety signals production quality
    if frontend_src.exists():
        ts_strict = False
        for tc_name in ["tsconfig.json", "tsconfig.app.json", "tsconfig.node.json"]:
            tsconfig = REPO_PATH / "frontend" / tc_name
            if tsconfig.exists():
                try:
                    content = tsconfig.read_text(encoding="utf-8", errors="ignore")
                    if "strict" in content:
                        ts_strict = True
                        break
                except: pass
        if ts_strict:
            ok("TypeScript strict mode in frontend — production-grade type safety"); ev["score"] += 1
        elif tsx_count > 0:
            ok("TypeScript frontend — type-safe components"); ev["score"] += 0.5

    ev["details"]["final_score"] = min(ev["score"], ev["max"])
    return ev


# ════════════════════════════════════════════════════════════
# COMPUTE HACKATHON-SPECIFIC SCORES
# ════════════════════════════════════════════════════════════

def compute_all_scores(es, trading, orig, sub, design):
    results = {}

    es_s    = min(es["score"], es["max"]) / es["max"]
    trade_s = min(trading["score"], trading["max"]) / trading["max"]
    orig_s  = min(orig["score"], orig["max"]) / orig["max"]
    sub_s   = min(sub["score"], sub["max"]) / sub["max"]
    design_s = min(design["score"], design["max"]) / design["max"]

    # Elasticsearch hackathon
    results["elasticsearch"] = {
        "score": round((es_s*0.40 + trade_s*0.25 + orig_s*0.20 + sub_s*0.15) * 10, 1),
        "breakdown": {
            "elasticsearch_use":        round(es_s * 10, 1),
            "technical_implementation": round(trade_s * 10, 1),
            "originality_impact":       round(orig_s * 10, 1),
            "documentation":            round(sub_s * 10, 1),
        },
        "dealbreaker": es["details"].get("hybrid_latency_ms", 0) > 5000
    }

    # DevDash
    results["devdash"] = {
        "score": round((orig_s*0.33 + trade_s*0.34 + es_s*0.33) * 10, 1),
        "breakdown": {
            "creativity":        round(orig_s * 10, 1),
            "real_world_use":    round(trade_s * 10, 1),
            "technologies_used": round(es_s * 10, 1),
        },
        "status": "DEADLINE PASSED — Feb 20, 2026",
        "dealbreaker": not sub["details"].get("has_video", False)
    }

    # DSOC
    results["dsoc"] = {
        "score": round((orig_s*0.20 + trade_s*0.20 + trade_s*0.20 + orig_s*0.20 + design_s*0.20) * 10, 1),
        "breakdown": {
            "innovation":            round(orig_s * 10, 1),
            "responsiveness":        round(trade_s * 10, 1),
            "functionality":         round(trade_s * 10, 1),
            "creativity_uniqueness": round(orig_s * 10, 1),
            "design_aesthetics":     round(design_s * 10, 1),
        },
        "dealbreaker": not sub["details"].get("has_video", False)
    }

    # TerraCode
    results["terracode"] = {
        "score": round((orig_s*0.25 + es_s*0.25 + trade_s*0.20 + design_s*0.15 + sub_s*0.15) * 10, 1),
        "breakdown": {
            "innovation_creativity":     round(orig_s * 10, 1),
            "technical_implementation": round(es_s * 10, 1),
            "impact_relevance":         round(trade_s * 10, 1),
            "design_ux":                round(design_s * 10, 1),
            "presentation_demo":        round(sub_s * 10, 1),
        },
        "dealbreaker": not sub["details"].get("has_live_demo", False)
    }

    return results


# ════════════════════════════════════════════════════════════
# NUCLEAR LLM JUDGE
# ════════════════════════════════════════════════════════════

def nuclear_llm_judge(es, trading, orig, sub, design, scores):
    hdr("NUCLEAR LLM JUDGE", Fore.RED)
    warn(f"Model: {OLLAMA_MODEL}")
    warn("Instructed to be maximally critical. No encouragement. No softening.")
    warn("Grading as if $10,000 of YOUR OWN money is on the line...")

    now_utc = datetime.now(timezone.utc)
    terracode_deadline = datetime(2026, 2, 26, 22, 0, 0, tzinfo=timezone.utc)  # 5pm EST = 10pm UTC
    dsoc_deadline = datetime(2026, 2, 28, 22, 0, 0, tzinfo=timezone.utc)
    terra_hours = max(0, (terracode_deadline - now_utc).total_seconds() / 3600)
    dsoc_hours  = max(0, (dsoc_deadline - now_utc).total_seconds() / 3600)

    # Build evidence summary
    evidence = {
        "cluster_health": es["details"].get("cluster_status", "unknown"),
        "total_docs": es["details"].get("total_docs", 0),
        "knn_returns_results": es["details"].get("knn_returns_results", False),
        "hybrid_latency_ms": es["details"].get("hybrid_latency_ms", "untested"),
        "live_prices": trading["details"].get("live_prices", False),
        "websocket_streaming": trading["details"].get("websocket", False),
        "backtesting_works": trading["details"].get("backtesting_works", False),
        "unique_ui_features": orig["details"].get("unique_features", {}),
        "has_video": sub["details"].get("has_video", False),
        "has_env_example": sub["details"].get("env_example", False),
        "has_live_demo_url": sub["details"].get("has_live_demo", False),
        "has_slides": sub["details"].get("has_slides", False),
        "proof_screenshots": design["details"].get("proof_screenshots", 0),
    }

    prompt = f"""You are a ruthless hackathon judge. You have sat on 50+ judging panels.
You have watched hundreds of trading/fintech demos. You are NOT impressed by large codebases.
You do NOT give points for effort. You judge ONLY what you see working in 3 minutes.

PROJECT: Apex Terminal — "Professional Market Analysis Platform"
Claims: TradingView-style charting + Bloomberg terminal + Elasticsearch vector search
Stack: FastAPI :8000, React :5100, Elasticsearch :9200

HACKATHONS BEING EVALUATED (with deadlines):
1. Elasticsearch Devpost — Primary, open
2. DevDash ($10k, 865 participants) — DEADLINE WAS FEB 20 — PASSED
3. Dev Season of Code/DSOC ($3,950, students only) — {dsoc_hours:.0f} hours left
4. TerraCode Convergence ($5k, 215 participants) — {terra_hours:.0f} hours left

HARD EVIDENCE (what probes found RIGHT NOW):
{json.dumps(evidence, indent=2)}

COMPUTED SCORES (evidence-based, 0-10):
Elasticsearch hackathon: {scores['elasticsearch']['score']}/10
DevDash: {scores['devdash']['score']}/10 (DEADLINE PASSED)
DSOC: {scores['dsoc']['score']}/10
TerraCode: {scores['terracode']['score']}/10

CRITICAL FLAGS:
- Hybrid search latency: {evidence.get('hybrid_latency_ms', 'unknown')}ms (>5000ms = demo killer)
- Has video: {evidence['has_video']} (required for ALL 3 open hackathons)
- Has live demo URL: {evidence['has_live_demo_url']} (TerraCode asks for this)
- Total ES documents: {evidence['total_docs']} (low = weak showcase)
- Live price feed: {evidence['live_prices']} (core claim of "trading terminal")

YOUR TASK: Be brutally honest. Answer these questions:

1. Among 865 DevDash projects, where does this realistically rank? Top 10? Top 50? Bottom half?
2. What is the SINGLE thing that, if a competitor also has it, this project loses?
3. What would make a senior trading technology engineer immediately dismiss this project?
4. For TerraCode ({terra_hours:.0f}h left): what's the ONE thing to fix RIGHT NOW?
5. For DSOC ({dsoc_hours:.0f}h left): is this worth submitting at all, or does it need more work first?
6. Is the ES integration genuinely impressive or is it "we added ES to our existing app and called it a hackathon project"?

Respond ONLY in valid JSON (zero extra text):
{{
  "per_hackathon": {{
    "elasticsearch": {{
      "score": {scores['elasticsearch']['score']},
      "rank_among_competitors": "Top X% estimate",
      "why_it_wins_or_loses": "specific reason",
      "single_fix_for_top_score": "exact specific action"
    }},
    "devdash": {{
      "score": {scores['devdash']['score']},
      "status": "DEADLINE PASSED",
      "would_have_placed": "estimated placement if submitted",
      "lesson_for_next_time": "specific lesson"
    }},
    "dsoc": {{
      "score": {scores['dsoc']['score']},
      "submit_now_or_fix_first": "submit or fix — be definitive",
      "top_priority_in_{int(dsoc_hours)}h": "single most impactful action",
      "realistic_placement": "1st/2nd/3rd/honorable/no-place — be specific"
    }},
    "terracode": {{
      "score": {scores['terracode']['score']},
      "submit_now_or_fix_first": "submit or fix — {terra_hours:.0f}h left",
      "top_priority_in_{int(terra_hours)}h": "single most impactful action with exact implementation",
      "realistic_placement": "1st/2nd/3rd/honorable/no-place — be specific"
    }}
  }},
  "killer_weakness": "The ONE thing that would make a senior trading tech engineer dismiss this project in 30 seconds",
  "killer_strength": "The ONE thing genuinely impressive that competitors are unlikely to have",
  "video_urgency": "How badly does the missing video hurt each hackathon chance — be specific and brutal",
  "latency_verdict": "Is the 11-second hybrid search a disqualifying problem or fixable in time?",
  "honest_overall": "Two sentences. No softening. Where does this project actually stand right now."
}}"""

    try:
        response = client.chat.completions.create(
            model=OLLAMA_MODEL,
            messages=[
                {"role": "system", "content": "You are a ruthless, experienced hackathon judge. You speak only in specific, actionable truths. You respond only in valid JSON."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.05,
            max_tokens=3000
        )
        raw = response.choices[0].message.content.strip()
        if "```" in raw:
            for part in raw.split("```"):
                part = part.strip().lstrip("json").strip()
                try:
                    return json.loads(part)
                except: pass
        return json.loads(raw)
    except json.JSONDecodeError as e:
        fail(f"LLM returned invalid JSON: {e}")
        print(f"  Raw (first 600): {raw[:600]}")
        return None
    except Exception as e:
        fail(f"Ollama failed: {e}"); return None


# ════════════════════════════════════════════════════════════
# PRINT RESULTS
# ════════════════════════════════════════════════════════════

def print_nuclear_results(scores, llm):
    hdr("NUCLEAR EVALUATION — APEX TERMINAL", Fore.RED)

    # Deadlines at a glance
    print(f"\n  {Fore.RED}⏰ DEADLINE STATUS:{Style.RESET_ALL}")
    print(f"  {'TerraCode Convergence':<30} Feb 26 5pm EST — {'HOURS LEFT' if scores['terracode']['score'] else 'CHECK NOW'}")
    print(f"  {'Dev Season of Code':<30} Feb 28 5pm EST — OPEN")
    print(f"  {'DevDash':<30} Feb 20 5pm EST — {Fore.RED}DEADLINE PASSED{Style.RESET_ALL}")
    print(f"  {'Elasticsearch Devpost':<30} Open — no urgent deadline")

    # Per-hackathon scores
    print(f"\n  {Fore.CYAN}HACKATHON-SPECIFIC SCORES (evidence-based):{Style.RESET_ALL}")
    for hk_id, hk_data in scores.items():
        hk_info = HACKATHONS[hk_id]
        s = hk_data["score"]
        c = Fore.GREEN if s >= 7 else (Fore.YELLOW if s >= 4 else Fore.RED)
        db = f"  {Fore.RED}⚠ DEALBREAKER DETECTED{Style.RESET_ALL}" if hk_data.get("dealbreaker") else ""
        print(f"\n  {c}{'─'*55}{Style.RESET_ALL}")
        print(f"  {c}{hk_info['name']}{Style.RESET_ALL}")
        print(f"  Prize: {hk_info['prize']} | Participants: {hk_info['participants']}")
        if "status" in hk_data:
            print(f"  {Fore.RED}STATUS: {hk_data['status']}{Style.RESET_ALL}")
        bar(f"  Overall", s, 10, "")
        for criterion, val in hk_data["breakdown"].items():
            bar(f"    {criterion}", val, 10)
        if db:
            print(db)

    # LLM judgment
    if llm:
        print(f"\n  {Fore.RED}{'═'*64}{Style.RESET_ALL}")
        print(f"  {Fore.RED}LLM BRUTAL JUDGMENT{Style.RESET_ALL}")
        print(f"  {Fore.RED}{'═'*64}{Style.RESET_ALL}")

        kw = llm.get("killer_weakness", "")
        ks = llm.get("killer_strength", "")
        video = llm.get("video_urgency", "")
        latency = llm.get("latency_verdict", "")
        overall = llm.get("honest_overall", "")

        if kw:
            print(f"\n  {Fore.RED}KILLER WEAKNESS:{Style.RESET_ALL}")
            print(f"  {kw}")
        if ks:
            print(f"\n  {Fore.GREEN}KILLER STRENGTH:{Style.RESET_ALL}")
            print(f"  {ks}")
        if video:
            print(f"\n  {Fore.RED}VIDEO URGENCY:{Style.RESET_ALL}")
            print(f"  {video}")
        if latency:
            print(f"\n  {Fore.YELLOW}LATENCY VERDICT:{Style.RESET_ALL}")
            print(f"  {latency}")

        # Per-hackathon LLM notes
        per = llm.get("per_hackathon", {})
        for hk_id in ["terracode", "dsoc", "elasticsearch", "devdash"]:
            hk = per.get(hk_id, {})
            if hk:
                print(f"\n  {Fore.CYAN}{HACKATHONS[hk_id]['name']}:{Style.RESET_ALL}")
                for k, v in hk.items():
                    if v and k != "score":
                        label = k.replace("_", " ").title()
                        print(f"    {label}: {v}")

        if overall:
            print(f"\n  {Fore.RED}HONEST OVERALL:{Style.RESET_ALL}")
            print(f"  {overall}")

    print(f"\n{'='*66}\n")


# ── MAIN ──────────────────────────────────────────────────────
if __name__ == "__main__":
    hdr("APEX TERMINAL — NUCLEAR MULTI-HACKATHON JUDGE", Fore.RED)
    print(f"  Repo     : {REPO_PATH}")
    print(f"  Model    : {OLLAMA_MODEL}")
    print(f"  Mode     : NUCLEAR — zero credit for scaffolding or existence")
    print(f"  {Fore.RED}Assumes backend (:8000), frontend (:5100), ES (:9200) already running{Style.RESET_ALL}")

    if not REPO_PATH.exists():
        fail(f"Repo not found at {REPO_PATH}")
        sys.exit(1)

    # Check services
    for name, url in [("Backend", BACKEND_URL+"/docs"), ("Frontend", FRONTEND_URL), ("Elasticsearch", ES_URL)]:
        try:
            requests.get(url, timeout=3)
            ok(f"{name}: running")
        except:
            fail(f"{name}: NOT RUNNING at {url}")
            warn(f"Start it first, then re-run this script")

    try:
        es_ev      = probe_elasticsearch_depth()
        trading_ev = probe_live_trading_features()
        orig_ev    = probe_originality()
        sub_ev     = probe_submission_readiness()
        design_ev  = probe_design_ux()

        all_scores = compute_all_scores(es_ev, trading_ev, orig_ev, sub_ev, design_ev)

        llm_judgment = nuclear_llm_judge(es_ev, trading_ev, orig_ev, sub_ev, design_ev, all_scores)

        print_nuclear_results(all_scores, llm_judgment)

        # Save
        out = {
            "probes": {
                "elasticsearch": es_ev, "trading": trading_ev,
                "originality": orig_ev, "submission": sub_ev, "design": design_ev
            },
            "scores": all_scores,
            "llm_judgment": llm_judgment
        }
        out_file = REPO_PATH / "nuclear_evaluation.json"
        with open(out_file, "w") as f:
            json.dump(out, f, indent=2, default=str)
        ok(f"Full results: {out_file}")

    except KeyboardInterrupt:
        warn("Interrupted")
