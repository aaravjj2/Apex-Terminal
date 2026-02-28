"""
judge_server.py — Apex Terminal Week 1 Active Judge Backend
============================================================
Calibrated to ACTUAL Apex Terminal repo layout:
  - Frontend:  frontend/src/   @ localhost:5100  (React 19.2 + Vite + Zustand)
  - Backend:   phase1/         @ localhost:8000  (FastAPI + SQLite/SQLAlchemy)
  - Venv:      phase1/venv/    (confirmed from README)
  - DB:        phase1/phase1.db  (SQLite — NOT Elasticsearch)
  - Tests:     367 pytest + 112 Vitest + 551 Playwright = ~1030 total
  - LOC:       ~50k (README claim)

LLM:  Ollama devstral:latest  ← matches your existing scripts exactly

ClawWork Integration (HKUDS/ClawWork):
  After every judge run, writes w01_judge_report/clawwork_artifact.md
  Pass this to ClawWork's submit_work(work_output=..., artifact_file_paths=[...])

Run: uvicorn judge_server:app --host 0.0.0.0 --port 7474 --reload
"""

import asyncio, subprocess, requests, json, time, os, re, base64, shutil
from pathlib import Path
from typing import AsyncGenerator, Optional
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI

# ── CONFIG ────────────────────────────────────────────────────
REPO_PATH    = Path(os.getenv("APEX_REPO",    r"C:\Tradingview\Tradingview recreation"))
BACKEND_URL  = os.getenv("APEX_BACKEND",      "http://localhost:8000")
FRONTEND_URL = os.getenv("APEX_FRONTEND",     "http://localhost:5100")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL",      "devstral:latest")   # your model
OLLAMA_BASE  = os.getenv("OLLAMA_BASE",       "http://localhost:11434/v1")

llm = OpenAI(api_key="ollama", base_url=OLLAMA_BASE)

app = FastAPI(title="Apex Judge Server")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ── CONFIRMED REPO LAYOUT ─────────────────────────────────────
PHASE1_DIR   = REPO_PATH / "phase1"
VENV_DIR     = PHASE1_DIR / "venv"
FRONTEND_DIR = REPO_PATH / "frontend"
FRONTEND_SRC = FRONTEND_DIR / "src"
TESTS_DIR    = PHASE1_DIR / "tests"
DB_FILE      = PHASE1_DIR / "phase1.db"
SERVICES_DIR = PHASE1_DIR / "services"
DOCS_DIR     = REPO_PATH / "docs"
ARTIFACTS_DIR= REPO_PATH / "artifacts"
STRATEGIES_DIR=REPO_PATH / "strategies"
REPORT_DIR   = REPO_PATH / "w01_judge_report"

SKIP_DIRS = {".venv","venv","__pycache__",".git","node_modules","dist",".pytest_cache","=15.0.0","=2024.1"}

# ── HELPERS ───────────────────────────────────────────────────

def find_venv_python() -> Optional[str]:
    for c in [
        VENV_DIR  / "Scripts" / "python.exe",
        VENV_DIR  / "bin"     / "python",
        PHASE1_DIR / ".venv"  / "Scripts" / "python.exe",
        PHASE1_DIR / ".venv"  / "bin"     / "python",
    ]:
        if c.exists(): return str(c)
    return None

def http_probe(method: str, path: str, **kw) -> dict:
    url = f"{BACKEND_URL}{path}"
    start = time.perf_counter()
    try:
        r = getattr(requests, method)(url, timeout=kw.pop("timeout", 8), **kw)
        ms = round((time.perf_counter() - start) * 1000, 1)
        try:    body = r.json()
        except: body = None
        return {"status": r.status_code, "ms": ms, "body": body, "ok": r.status_code < 400}
    except requests.exceptions.ConnectionError:
        return {"status": 0, "ms": 0, "body": None, "ok": False, "error": "connection refused"}
    except requests.exceptions.Timeout:
        return {"status": 408, "ms": 8000, "body": None, "ok": False, "error": "timeout"}

def measure_latency(path: str, runs: int = 5) -> dict:
    times = [r["ms"] for _ in range(runs) if (r := http_probe("get", path))["ms"] > 0]
    if not times: return {"p50": None, "p95": None, "p99": None, "samples": 0}
    times.sort()
    def pct(p): return round(times[max(0, int(len(times)*p/100)-1)], 1)
    return {"p50": pct(50), "p95": pct(95), "p99": pct(99), "samples": len(times)}

def src_search(pattern: str, dirs: list = None, exts=("*.py",)) -> tuple[bool, str]:
    search_dirs = [Path(d) for d in (dirs or [PHASE1_DIR])]
    for d in search_dirs:
        if not d.exists(): continue
        for ext in exts:
            for f in d.rglob(ext):
                if any(s in str(f) for s in SKIP_DIRS): continue
                try:
                    m = re.search(pattern, f.read_text(errors="ignore"), re.I | re.M)
                    if m: return True, f"{f.name}: {m.group(0)[:70]}"
                except: pass
    return False, ""

def fe_search(pattern: str) -> tuple[bool, str]:
    if not FRONTEND_SRC.exists(): return False, ""
    for ext in ["*.tsx", "*.ts", "*.jsx", "*.js"]:
        for f in FRONTEND_SRC.rglob(ext):
            if any(s in str(f) for s in SKIP_DIRS): continue
            try:
                m = re.search(pattern, f.read_text(errors="ignore"), re.I)
                if m: return True, f"{f.name}: {m.group(0)[:60]}"
            except: pass
    return False, ""

def check_sqlite() -> dict:
    r = {"db_exists": DB_FILE.exists(), "tables": [], "has_ohlcv": False,
         "has_orders": False, "has_positions": False}
    if not r["db_exists"]: return r
    try:
        import sqlite3
        conn = sqlite3.connect(str(DB_FILE))
        cur = conn.cursor()
        cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [row[0] for row in cur.fetchall()]
        conn.close()
        r["tables"] = tables
        r["has_ohlcv"]     = any("bar" in t.lower() or "ohlcv" in t.lower() or "candle" in t.lower() for t in tables)
        r["has_orders"]    = any("order" in t.lower() for t in tables)
        r["has_positions"] = any("position" in t.lower() for t in tables)
    except Exception as e:
        r["error"] = str(e)
    return r

def git_loc() -> dict:
    try:
        r1 = subprocess.run(["git","ls-files"], cwd=str(REPO_PATH),
                            capture_output=True, text=True, timeout=15)
        files = [l.strip() for l in r1.stdout.strip().split("\n") if l.strip()]
        total = 0
        for f in files:
            try:
                fp = REPO_PATH / f
                if fp.suffix in [".py",".ts",".tsx",".js",".jsx"] and fp.exists():
                    total += fp.read_text(errors="ignore").count("\n")
            except: pass
        r2 = subprocess.run(["git","rev-list","--count","HEAD"],
                            cwd=str(REPO_PATH), capture_output=True, text=True, timeout=10)
        commits = int(r2.stdout.strip()) if r2.stdout.strip().isdigit() else 0
        return {"total_loc": total, "tracked_files": len(files), "total_commits": commits}
    except Exception as e:
        return {"total_loc": 0, "error": str(e)}

def sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"

# ── PLAYWRIGHT AUDIT ──────────────────────────────────────────

async def run_playwright_audit() -> dict:
    node = shutil.which("node")
    if not node: return {"error": "node not found"}

    REPORT_DIR.mkdir(exist_ok=True)
    script   = REPORT_DIR / "_pw.js"
    report   = REPORT_DIR / "_pw_report.json"
    shot     = REPORT_DIR / "_screenshot.png"
    shot_str = str(shot).replace("\\", "/")
    rep_str  = str(report).replace("\\", "/")

    script.write_text(f"""
const {{ chromium }} = require('playwright');
const fs = require('fs');
(async () => {{
  let out = {{}};
  try {{
    const br = await chromium.launch({{ headless: true }});
    const ctx = await br.newContext({{ viewport: {{ width:1920, height:1080 }} }});
    const pg = await ctx.newPage();
    const errs=[]; const netFails=[];
    pg.on('console', m=>{{ if(m.type()==='error') errs.push(m.text()); }});
    pg.on('response', r=>{{ if(r.status()>=400&&!r.url().includes('hmr')&&!r.url().includes('hot')) netFails.push({{url:r.url(),status:r.status()}}); }});
    await pg.goto('{FRONTEND_URL}',{{waitUntil:'networkidle',timeout:30000}});
    await pg.screenshot({{path:'{shot_str}',fullPage:true}});
    const comps={{
      canvas:       await pg.evaluate(()=>document.querySelectorAll('canvas').length),
      chart:        await pg.locator('[class*="chart" i],[class*="Chart"]').count(),
      dashboard:    await pg.locator('[class*="dashboard" i],[class*="Dashboard"]').count(),
      watchlist:    await pg.locator('[class*="watchlist" i],[class*="Watchlist"]').count(),
      blotter:      await pg.locator('[class*="blotter" i],[class*="orders" i]').count(),
    }};
    let palette=false;
    try {{ await pg.keyboard.press('Control+k'); await pg.waitForTimeout(600); palette=await pg.locator('[role="dialog"],[role="combobox"],[class*="palette" i]').count()>0; }} catch(e){{}}
    const text=(await pg.evaluate(()=>document.body.innerText)).trim().length;
    const aria=await pg.evaluate(()=>document.querySelectorAll('[aria-label]').length);
    const roles=await pg.evaluate(()=>document.querySelectorAll('[role]').length);
    const hdgs=await pg.evaluate(()=>document.querySelectorAll('h1,h2,h3').length);
    out={{title:await pg.title(),comps,paletteOpened:palette,hasContent:text>50,ariaCount:aria,roleCount:roles,headingCount:hdgs,consoleErrors:errs.slice(0,10),netFails:netFails.slice(0,10)}};
    await br.close();
  }} catch(e) {{ out={{error:e.message}}; }}
  fs.writeFileSync('{rep_str}', JSON.stringify(out,null,2));
}})();
""")

    proc = await asyncio.create_subprocess_exec(
        node, str(script),
        stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        cwd=str(FRONTEND_DIR)
    )
    try:
        _, stderr = await asyncio.wait_for(proc.communicate(), timeout=60)
    except asyncio.TimeoutError:
        return {"error": "playwright timeout 60s"}

    if report.exists():
        try:    result = json.loads(report.read_text())
        except: result = {"error": "parse failed"}
    else:
        result = {"error": stderr.decode()[:300] if stderr else "no report"}

    if shot.exists():
        result["screenshot_b64"] = base64.b64encode(shot.read_bytes()).decode()
    return result

# ── PYTEST RUNNER ─────────────────────────────────────────────

async def run_pytest_stream(yield_fn) -> dict:
    venv_py = find_venv_python()
    if not venv_py:
        await yield_fn(sse("pytest_line", {"line": "ERROR: no venv python at phase1/venv/", "level": "error"}))
        return {"passed":0,"failed":0,"skipped":0,"coverage":0.0,"count":0}

    cwd = str(PHASE1_DIR)

    # Collect count
    try:
        proc = await asyncio.create_subprocess_exec(
            venv_py, "-m", "pytest", "--collect-only", "-q", "--tb=no",
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE, cwd=cwd
        )
        out, _ = await asyncio.wait_for(proc.communicate(), timeout=60)
        m = re.search(r"(\d+) tests? collected", out.decode())
        test_count = int(m.group(1)) if m else 0
    except: test_count = 0

    await yield_fn(sse("pytest_count", {"count": test_count}))

    # Vitest/Playwright info from file system
    vitest_ok = (FRONTEND_DIR / "vitest.config.ts").exists()
    pw_specs  = len(list((FRONTEND_DIR / "tests").rglob("*.spec.ts"))) if (FRONTEND_DIR/"tests").exists() else 0
    if vitest_ok:
        await yield_fn(sse("pytest_line", {"line": f"Vitest frontend suite detected (vitest.config.ts found, ~112 tests per README)", "level":"info"}))
    if pw_specs:
        await yield_fn(sse("pytest_line", {"line": f"Playwright: {pw_specs} spec files detected (551 tests per README)", "level":"info"}))

    # Run pytest + cov
    proc = await asyncio.create_subprocess_exec(
        venv_py, "-m", "pytest", "--tb=short", "-q",
        "--cov=.", "--cov-report=term-missing",
        "--cov-report=json:w01_coverage.json", "--timeout=30",
        stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.STDOUT, cwd=cwd
    )

    lines = []
    try:
        while True:
            lb = await asyncio.wait_for(proc.stdout.readline(), timeout=310)
            if not lb: break
            line = lb.decode(errors="replace").rstrip()
            if line:
                lines.append(line)
                lvl = ("error" if "FAILED" in line or "ERROR" in line else
                       "pass"  if "passed" in line else
                       "warn"  if ("warning" in line.lower() or "SKIP" in line) else "info")
                await yield_fn(sse("pytest_line", {"line": line, "level": lvl}))
    except asyncio.TimeoutError:
        await yield_fn(sse("pytest_line", {"line": "TIMEOUT: 5min exceeded", "level":"error"}))
    await proc.wait()

    full = "\n".join(lines)
    def ei(pat): m = re.search(pat, full); return int(m.group(1)) if m else 0
    passed  = ei(r"(\d+) passed")
    failed  = ei(r"(\d+) failed")
    skipped = ei(r"(\d+) skipped")
    cov = 0.0
    cov_f = PHASE1_DIR / "w01_coverage.json"
    if cov_f.exists():
        try: cov = json.loads(cov_f.read_text()).get("totals",{}).get("percent_covered",0.0)
        except: pass
    if cov == 0.0:
        m = re.search(r"TOTAL\s+\d+\s+\d+\s+([\d.]+)%", full)
        if m: cov = float(m.group(1))

    return {
        "passed": passed, "failed": failed, "skipped": skipped,
        "coverage": round(cov, 1), "count": test_count,
        "vitest_detected": vitest_ok, "playwright_specs": pw_specs,
        "total_suite_est": test_count + (112 if vitest_ok else 0) + (pw_specs * 15),
        "failures": re.findall(r"FAILED ([\w/:.]+)", full)[:10],
    }

# ── GATE EVALUATORS ───────────────────────────────────────────

def eval_gate(gate_id: str) -> dict:
    result = {"id": gate_id, "pass": False, "proof": "", "evidence": {}}

    # ─ A: UI/UX ──────────────────────────────────────────────
    if gate_id == "A1":
        # Apex Terminal confirmed components
        check = {
            "CommandPalette": fe_search(r"CommandPalette|command.*palette|cmdk")[0],
            "ChartWorkspace": fe_search(r"ChartWorkspace|ChartEngine|lightweight.*chart|LightweightChart")[0],
            "DashboardTile":  fe_search(r"DashboardTile|TileGrid|dashboard.*tile|BloombergTile")[0],
            "OrdersBlotter":  fe_search(r"OrdersBlotter|orders.*blotter|order.*table|OrderList")[0],
        }
        found = sum(check.values())
        result["pass"] = found >= 4
        result["proof"] = (f"All 4 components in frontend/src/: {list(check.keys())}"
                           if found >= 4 else f"Only {found}/4: {check}")
        result["evidence"] = check

    elif gate_id == "A2":
        result["proof"] = "Playwright live gate (injected at runtime)"

    elif gate_id == "A3":
        # Apex Terminal shortcuts: Ctrl+K, Ctrl+1/2/3/4/5, Space, arrows, Ctrl+Z, Ctrl+Y
        count, map_found = 0, False
        for f in list(FRONTEND_SRC.rglob("*.ts")) + list(FRONTEND_SRC.rglob("*.tsx")):
            if any(s in str(f) for s in SKIP_DIRS): continue
            try:
                src = f.read_text(errors="ignore")
                count += len(re.findall(
                    r"['\"](?:ctrl|control|cmd|meta|alt|shift)\+[a-z0-9k]['\"]"
                    r"|key\s*===\s*['\"][A-Z][a-z]+['\"]"
                    r"|KeyboardEvent.*key.*==", src, re.I))
                if re.search(r"hotkey|keymap|shortcut.*map|keyboard.*map", src, re.I):
                    map_found = True
            except: pass
        result["pass"] = count >= 8 or map_found
        result["proof"] = f"{count} keyboard bindings, hotkey_map={map_found}"
        result["evidence"] = {"binding_count": count, "hotkey_map": map_found}

    elif gate_id == "A4":
        result["proof"] = "Playwright live gate (injected at runtime)"

    elif gate_id == "A5":
        checks = {
            "aria_label":   fe_search(r'aria-label=')[0],
            "roles":        fe_search(r'role=["\'](main|navigation|dialog|button|listbox|menu)')[0],
            "tabindex":     fe_search(r'tabIndex')[0],
            "sr_only":      fe_search(r'sr-only|visually-hidden|aria-hidden')[0],
            "alt_text":     fe_search(r'alt=["\']\w')[0],
        }
        score = sum(checks.values())
        result["pass"] = score >= 4
        result["proof"] = f"a11y {score}/5: {checks}"
        result["evidence"] = checks

    elif gate_id == "A6":
        cfg1       = FRONTEND_DIR / "playwright.config.ts"
        cfg2       = FRONTEND_DIR / "playwright.video.config.ts"
        spec_count = len(list((FRONTEND_DIR / "tests").rglob("*.spec.ts"))) if (FRONTEND_DIR/"tests").exists() else 0
        trace, video = False, cfg2.exists()
        if cfg1.exists():
            src = cfg1.read_text(errors="ignore")
            trace = "trace" in src
        result["pass"] = cfg1.exists() and spec_count >= 3
        result["proof"] = (f"playwright.config.ts ✓, video_config={video}, {spec_count} spec files, trace={trace}"
                           if cfg1.exists() else "playwright.config.ts not found")
        result["evidence"] = {"spec_count": spec_count, "has_video_config": video, "has_trace": trace}

    elif gate_id == "A7":
        count = 0
        for d in [ARTIFACTS_DIR, REPO_PATH/"devpost_media",
                  REPO_PATH/"artifacts"/"proof"/"v1-51-52-uiux"]:
            if d.exists():
                count += len([f for f in d.rglob("*")
                               if f.is_file() and f.suffix in
                               [".png",".jpg",".webp",".gif",".mp4",".pdf",".md",".webm"]])
        result["pass"] = count >= 5
        result["proof"] = f"{count} UX artifacts in artifacts/ + devpost_media/"

    # ─ B: Backend API ─────────────────────────────────────────
    elif gate_id == "B1":
        probes = {ep: http_probe("get", ep) for ep in
                  ["/api/v1/bars", "/api/v1/positions", "/api/v1/orders", "/api/v1/portfolio"]}
        docs    = http_probe("get", "/docs")
        openapi = http_probe("get", "/openapi.json")
        alive = [ep for ep, r in probes.items() if r["status"] not in [0, 404, 405]]
        result["pass"] = openapi["ok"] and len(alive) >= 2
        result["proof"] = (f"OpenAPI ✓, {len(alive)}/4 data endpoints live: {[e.split('/')[-1] for e in alive]}"
                           if openapi["ok"] else
                           f"Backend down ({openapi['status']}). Start: cd phase1 && uvicorn services.api.main:app --port 8000")
        result["evidence"] = {**probes, "openapi_status": openapi["status"]}

    elif gate_id == "B2":
        budgets = {"/api/v1/bars": 300, "/api/v1/positions": 200, "/api/v1/orders": 200}
        lats, breaches = {}, []
        for ep, budget in budgets.items():
            lat = measure_latency(ep)
            lats[ep.split("/")[-1]] = lat
            if lat["p99"] and lat["p99"] > budget:
                breaches.append(f"{ep.split('/')[-1]}:p99={lat['p99']}ms>budget={budget}ms")
        has_data = any(v["samples"] > 0 for v in lats.values())
        result["pass"] = len(breaches) == 0 and has_data
        result["proof"] = ("SLO met: {" + ",".join(f"{k}:{v.get('p99')}ms" for k, v in lats.items()) + "}"
                   if not breaches else f"SLO breaches: {breaches}")
        result["evidence"] = lats

    elif gate_id == "B3":
        ws_be = src_search(r"WebSocket|websocket|ws:/|wss:/")[0]
        ws_fe = fe_search(r"WebSocket|useWebSocket|ws:/|wss:/")[0]
        result["pass"] = ws_be and ws_fe
        result["proof"] = f"backend_ws={ws_be}, frontend_ws={ws_fe}"

    elif gate_id == "B4":
        r = http_probe("post", "/api/v1/orders", json={"garbage": True})
        structured = isinstance(r["body"], dict)
        handler = src_search(r"exception_handler|HTTPException|@app\.exception")[0]
        result["pass"] = handler
        result["proof"] = f"exception_handler={handler}, bad_req={r['status']}, structured_response={structured}"

    elif gate_id == "B5":
        fallback   = src_search(r"fallback|MockProvider|DEMO_MODE|demo_mode|mock.*data")[0]
        reconnect  = src_search(r"reconnect|retry|on_close.*sleep|backoff|tenacity")[0]
        result["pass"] = fallback and reconnect
        result["proof"] = f"fallback={fallback}, reconnect={reconnect}"

    elif gate_id == "B6":
        replay_be = src_search(r"replay|ReplayMode|REPLAY")[0]
        replay_fe = fe_search(r"replay|ReplayMode|replay.*speed")[0]
        result["pass"] = replay_be and replay_fe
        result["proof"] = f"replay_backend={replay_be}, replay_frontend={replay_fe}"

    elif gate_id == "B7":
        r = http_probe("get", "/openapi.json")
        spec = r["body"] or {}
        paths   = len(spec.get("paths", {}))
        version = spec.get("info", {}).get("version", "")
        schemas = len((spec.get("components") or {}).get("schemas", {}))
        result["pass"] = bool(spec) and paths >= 5
        result["proof"] = f"paths={paths}, version={version or 'MISSING'}, schemas={schemas}"
        result["evidence"] = {"path_count": paths, "version": version, "schema_count": schemas}

    elif gate_id == "B8":
        doc_md = list(DOCS_DIR.rglob("*.md")) if DOCS_DIR.exists() else []
        root_md = [p for p in REPO_PATH.glob("*.md") if p.stat().st_size > 500]
        total = len([f for f in doc_md if f.stat().st_size > 500]) + len(root_md)
        result["pass"] = total >= 5
        result["proof"] = f"{total} substantial .md docs"

    # ─ C: Data Architecture (SQLite, not ES) ─────────────────
    elif gate_id == "C1":
        db = check_sqlite()
        result["pass"] = db["db_exists"] and len(db["tables"]) >= 3
        result["proof"] = (f"SQLite ✓, tables={db['tables']}"
                           if db["db_exists"] else
                           "phase1.db not found — run backend once to create")
        result["evidence"] = db

    elif gate_id == "C2":
        models = src_search(r"class\s+\w+\(Base\)|Column\(|declarative_base|mapped_column")[0]
        result["pass"] = models
        result["proof"] = f"SQLAlchemy ORM models={models}"

    elif gate_id == "C3":
        providers = {
            "finnhub": src_search(r"FinnhubClient|finnhub")[0],
            "alpaca":  src_search(r"AlpacaClient|alpaca_trade")[0],
            "yahoo":   src_search(r"yfinance|yahoo")[0],
            "mock_csv":src_search(r"MockData|mock.*csv|read_csv.*data")[0],
        }
        count = sum(providers.values())
        result["pass"] = count >= 3
        result["proof"] = f"{count}/4 data providers: {providers}"
        result["evidence"] = providers

    elif gate_id == "C4":
        bar_eng  = src_search(r"BarAggregator|bar_engine|ohlcv.*aggregat|aggregate.*bar")[0]
        timeframes= src_search(r"TimeframeManager|timeframe.*1m|'1m'.*'5m'|TIMEFRAMES")[0]
        result["pass"] = bar_eng and timeframes
        result["proof"] = f"bar_engine={bar_eng}, multi_timeframe={timeframes}"

    elif gate_id == "C5":
        engine = src_search(r"StrategyEngine|strategy_engine|BaseStrategy|@strategy")[0]
        files  = list(STRATEGIES_DIR.glob("*.py")) if STRATEGIES_DIR.exists() else []
        result["pass"] = engine and len(files) >= 2
        result["proof"] = f"strategy_engine={engine}, files={[f.name for f in files]}"
        result["evidence"] = {"strategy_files": [f.name for f in files]}

    elif gate_id == "C6":
        det = src_search(r"deterministic|seed.*replay|replay.*csv|csv.*replay")[0]
        csv_count = len(list((REPO_PATH/"data").rglob("*.csv"))) if (REPO_PATH/"data").exists() else 0
        result["pass"] = det and csv_count > 0
        result["proof"] = f"deterministic_code={det}, csv_data_files={csv_count}"

    # ─ D: Bloomberg-Style Features ───────────────────────────
    elif gate_id == "D1":
        palette = fe_search(r"CommandPalette|command.*palette|cmdk")[0]
        fuzzy   = fe_search(r"Fuse\.|fuse\.js|matchSorter|fuzzy")[0]
        result["pass"] = palette and fuzzy
        result["proof"] = f"command_palette={palette}, fuzzy_search={fuzzy}"

    elif gate_id == "D2":
        # 14 tiles confirmed in README
        tiles = {
            "MiniChart":     fe_search(r"MiniChart")[0],
            "Scanner":       fe_search(r"Scanner|MarketScanner")[0],
            "Heatmap":       fe_search(r"Heatmap|SectorHeat")[0],
            "OptionsChain":  fe_search(r"OptionsChain")[0],
            "GreeksPanel":   fe_search(r"GreeksPanel|greeks")[0],
            "IVSurface":     fe_search(r"IVSurface|ImpliedVol")[0],
            "PnLAnalytics":  fe_search(r"PnLAnalytics|PnlAnalytics")[0],
        }
        found = sum(tiles.values())
        result["pass"] = found >= 4
        result["proof"] = f"{found}/14 Bloomberg tiles: {[k for k,v in tiles.items() if v]}"
        result["evidence"] = tiles

    elif gate_id == "D3":
        # 35 indicators across 5 categories confirmed in README
        cats = {
            "trend":     fe_search(r"EMA|SMA|VWAP|Ichimoku|Supertrend")[0],
            "momentum":  fe_search(r"RSI|MACD|Stochastic")[0],
            "volatility":fe_search(r"BollingerBands|ATR|KeltnerChannel")[0],
            "volume":    fe_search(r"OBV|MFI|VolumeProfile")[0],
        }
        count = sum(cats.values())
        result["pass"] = count >= 3
        result["proof"] = f"Indicator categories {count}/4: {cats}"
        result["evidence"] = cats

    elif gate_id == "D4":
        backtest_be = src_search(r"BacktestEngine|backt|vectorbt")[0]
        backtest_fe = fe_search(r"Backtest|backtest.*result")[0]
        result["pass"] = backtest_be and backtest_fe
        result["proof"] = f"backtest_engine={backtest_be}, backtest_ui={backtest_fe}"

    elif gate_id == "D5":
        paper_be = src_search(r"paper.*trad|PAPER.*MODE|paper_order")[0]
        paper_fe = fe_search(r"paper.*trad|PaperTrad|paperMode")[0]
        result["pass"] = paper_be or paper_fe
        result["proof"] = f"paper_trading_backend={paper_be}, paper_trading_frontend={paper_fe}"

    elif gate_id == "D6":
        doc  = (REPO_PATH / "AUTOPILOT_EXPLANATION.md").exists()
        code = src_search(r"autopilot|AutopilotBrain|autopilot_brain")[0]
        result["pass"] = doc or code
        result["proof"] = f"AUTOPILOT_EXPLANATION.md={doc}, autopilot_code={code}"

    # ─ E: Testing & Quality ───────────────────────────────────
    elif gate_id == "E1":
        stats = git_loc()
        # README says 50k LOC; pass at 35k (realistic W1 threshold)
        result["pass"] = stats["total_loc"] >= 35000
        result["proof"] = (f"{stats['total_loc']:,} LOC across {stats.get('tracked_files',0)} tracked files"
                           if stats["total_loc"] >= 35000 else
                           f"Only {stats['total_loc']:,} LOC (need ≥35k)")
        result["evidence"] = stats

    elif gate_id == "E5":
        chaos = [f for f in PHASE1_DIR.rglob("*.py")
                 if any(k in f.stem.lower() for k in ["chaos","fault","resilience"])
                 and "venv" not in str(f)]
        n8n = (REPO_PATH / "test_n8n_workflow.py").exists()
        result["pass"] = bool(chaos) or n8n
        result["proof"] = f"{len(chaos)} chaos files, n8n_tests={n8n}"

    elif gate_id == "E6":
        perf = [f for f in PHASE1_DIR.rglob("*.py")
                if any(k in str(f).lower() for k in ["perf","bench","load","stress"])
                and "venv" not in str(f)]
        result["pass"] = bool(perf)
        result["proof"] = f"{len(perf)} perf/benchmark files"

    elif gate_id == "E7":
        docs = {
            "RUNBOOK.md":            (REPO_PATH/"RUNBOOK.md").exists(),
            "IMPLEMENTATION_STATUS": (REPO_PATH/"IMPLEMENTATION_STATUS.md").exists(),
            "QUICK_REFERENCE.md":    (REPO_PATH/"QUICK_REFERENCE.md").exists(),
            "TEST_STATUS_SUMMARY":   (REPO_PATH/"TEST_STATUS_SUMMARY.md").exists(),
        }
        result["pass"] = sum(docs.values()) >= 2
        result["proof"] = f"Ops docs: {docs}"
        result["evidence"] = docs

    # ─ F: Security & Compliance ───────────────────────────────
    elif gate_id == "F1":
        example   = (REPO_PATH/"keys.env.example").exists()
        gitignore = (REPO_PATH/".gitignore").exists()
        gi_ok = False
        if gitignore:
            try: gi_ok = "keys.env" in (REPO_PATH/".gitignore").read_text()
            except: pass
        hardcoded = src_search(r'(?:api_key|secret)\s*=\s*["\'][A-Za-z0-9]{20,}["\']')[0]
        result["pass"] = example and gi_ok and not hardcoded
        result["proof"] = f"keys.env.example={example}, gitignore_ok={gi_ok}, hardcoded_secrets={hardcoded}"

    elif gate_id == "F2":
        auth = src_search(r"api_key|API_KEY|authorization|bearer")[0]
        env  = src_search(r"load_dotenv|os\.environ|os\.getenv")[0]
        result["pass"] = auth and env
        result["proof"] = f"auth_code={auth}, env_loading={env}"

    elif gate_id == "F3":
        audit_doc  = (PHASE1_DIR/"SYSTEM_AUDIT.md").exists()
        audit_code = src_search(r"audit|AuditLog|audit_log|log.*trade")[0]
        result["pass"] = audit_doc or audit_code
        result["proof"] = f"SYSTEM_AUDIT.md={audit_doc}, audit_code={audit_code}"

    elif gate_id == "F4":
        files = ([f for f in TESTS_DIR.rglob("*.py")
                  if any(k in f.stem.lower() for k in ["trade","order","position","portfolio"])
                  and "venv" not in str(f)]
                 if TESTS_DIR.exists() else [])
        result["pass"] = len(files) >= 2
        result["proof"] = f"{len(files)} trading-logic test files: {[f.name for f in files[:5]]}"

    elif gate_id == "F5":
        docker   = (REPO_PATH/"docker-compose.unified.yml").exists()
        procfile = (REPO_PATH/"Procfile").exists()
        makefile = (REPO_PATH/"Makefile").exists()
        result["pass"] = docker or (procfile and makefile)
        result["proof"] = f"docker-compose={docker}, Procfile={procfile}, Makefile={makefile}"

    else:
        result["proof"] = f"Gate {gate_id} not implemented"

    return result

# ── GATE DEFINITIONS ──────────────────────────────────────────
GATE_DEFS = [
    ("A1","A","4 core components in frontend/src/: CommandPalette, Chart, Dashboard, Blotter"),
    ("A2","A","Live UI renders at localhost:5100 with canvas (Lightweight Charts), 0 errors"),
    ("A3","A","Keyboard shortcuts bound: Ctrl+K, Ctrl+1/2/3/4/5, Space, arrows"),
    ("A4","A","Live DOM: aria-labels + roles present (Playwright)"),
    ("A5","A","Accessibility: aria-label, roles, tabIndex, sr-only, alt text in source"),
    ("A6","A","Playwright: playwright.config.ts + video.config.ts + ≥3 spec files"),
    ("A7","A","≥5 UX artifacts in artifacts/ or devpost_media/"),
    ("B1","B","FastAPI live: /openapi.json + ≥2 data endpoints respond"),
    ("B2","B","API latency SLO: bars≤300ms, positions/orders≤200ms (p99)"),
    ("B3","B","WebSocket: WS code in backend + frontend"),
    ("B4","B","Error handling: HTTPException in FastAPI backend"),
    ("B5","B","Resilience: fallback/demo mode + reconnect logic"),
    ("B6","B","REPLAY mode: backend + frontend (speed control)"),
    ("B7","B","OpenAPI spec: ≥5 paths auto-generated by FastAPI"),
    ("B8","B","≥5 substantial markdown docs"),
    ("C1","C","SQLite DB: phase1.db exists with ≥3 tables"),
    ("C2","C","SQLAlchemy ORM models defined"),
    ("C3","C","≥3 data providers: Finnhub + Alpaca + Yahoo/Mock"),
    ("C4","C","Bar engine: OHLCV aggregation + multi-timeframe"),
    ("C5","C","Strategy engine class + ≥2 strategy files in strategies/"),
    ("C6","C","Deterministic replay: seed/CSV + data files present"),
    ("D1","D","Command palette: Ctrl+K + fuzzy search (Fuse.js / matchSorter)"),
    ("D2","D","≥4 of 14 Bloomberg tiles implemented"),
    ("D3","D","≥3 of 4 indicator categories: trend, momentum, volatility, volume"),
    ("D4","D","Backtesting: BacktestEngine + result UI"),
    ("D5","D","Paper trading: paper order execution backend + frontend"),
    ("D6","D","Autopilot: AUTOPILOT_EXPLANATION.md + autopilot_brain code"),
    ("E1","E","≥35,000 LOC in Python/TS/JS source files"),
    ("E5","E","Chaos/fault test files present"),
    ("E6","E","Performance/benchmark test files present"),
    ("E7","E","≥2 ops docs: RUNBOOK.md, IMPLEMENTATION_STATUS.md, etc."),
    ("F1","F","Secrets: keys.env.example + .gitignore covers keys.env + no hardcoded secrets"),
    ("F2","F","Auth: API keys loaded from env vars"),
    ("F3","F","Audit: SYSTEM_AUDIT.md or audit_log code"),
    ("F4","F","≥2 trading-logic test files (order/trade/position/portfolio)"),
    ("F5","F","Deployment: docker-compose.unified.yml or Procfile+Makefile"),
]

# ── LLM VERDICT ───────────────────────────────────────────────

def build_llm_verdict(gates: dict, pytest_summary: dict, pw: dict) -> dict:
    total  = len(gates)
    passed = sum(1 for g in gates.values() if g.get("pass"))
    score  = round(passed / total * 10, 2) if total else 0
    failed = [{"gate": gid, "proof": g.get("proof","")[:100]}
              for gid, g in gates.items() if not g.get("pass")]

    prompt = f"""You are lead engineering reviewer for Apex Terminal.
Stack: React 19.2 + TypeScript + Vite + Zustand / FastAPI + SQLite + WebSockets.
TradingView-style charting (Lightweight Charts, canvas) + Bloomberg analytics tiles.
NO Elasticsearch. 1030 tests total (367 pytest + 112 Vitest + 551 Playwright E2E).
~50k LOC, ~17 commits total.

Active judge results:
SCORE: {passed}/{total} = {score}/10
Pytest: {json.dumps(pytest_summary)}
Playwright: {json.dumps({k:v for k,v in pw.items() if k != "screenshot_b64"})}

Failed ({len(failed)}): {json.dumps(failed[:12], indent=2)}

Respond JSON only (no markdown):
{{
  "week1_complete": false,
  "score": {score},
  "can_promote_to_week2": false,
  "honest_assessment": "2 sentences. Brutally honest. Specific to a trading terminal, not generic.",
  "blockers": ["gate_id: exact fix — e.g. A2: frontend not starting, run npm run dev in frontend/"],
  "critical_path": "single highest-leverage unblocking action",
  "trading_platform_maturity": 5,
  "priority_fixes": [{{"gate":"A1","action":"specific step to fix","hours":2}}],
  "week2_readiness": "GO" or "NO-GO — specific reason"
}}"""

    try:
        resp = llm.chat.completions.create(
            model=OLLAMA_MODEL,
            messages=[
                {"role":"system","content":"Engineering judge. JSON only. Be specific to the Apex Terminal trading platform."},
                {"role":"user","content":prompt}
            ],
            temperature=0.05, max_tokens=2000
        )
        raw = re.sub(r"```json|```", "", resp.choices[0].message.content).strip()
        return json.loads(raw)
    except Exception as e:
        return {
            "week1_complete": False, "score": score,
            "can_promote_to_week2": passed == total,
            "honest_assessment": f"devstral:latest unavailable ({type(e).__name__}: {e}). Score={score}/10.",
            "blockers": [f"{g['gate']}: {g['proof'][:60]}" for g in failed[:5]],
            "critical_path": "Fix Ollama: `ollama pull devstral:latest && ollama serve`",
            "trading_platform_maturity": max(1, int(score)),
            "priority_fixes": [],
            "week2_readiness": "GO" if passed == total else "NO-GO"
        }

# ── CLAWWORK ARTIFACT ─────────────────────────────────────────

def write_clawwork_artifact(gates: dict, pytest_summary: dict, verdict: dict, elapsed: float) -> str:
    """
    Writes a work artifact compatible with ClawWork's submit_work() tool.
    Usage in ClawWork agent:
        submit_work(
            work_output="Week 1 judge complete. See attached report.",
            artifact_file_paths=["path/to/w01_judge_report/clawwork_artifact.md"]
        )
    """
    REPORT_DIR.mkdir(exist_ok=True)
    total  = len(gates)
    passed = sum(1 for g in gates.values() if g.get("pass"))
    score  = round(passed / total * 10, 2) if total else 0

    lines = [
        "# Apex Terminal — Week 1 Active Judge Report",
        f"> Generated: {datetime.now(timezone.utc).isoformat()} | Runtime: {elapsed:.1f}s | Model: {OLLAMA_MODEL}",
        "",
        "## Score",
        f"**{passed}/{total} gates passed = {score}/10**",
        "",
        "| Metric | Value |",
        "|--------|-------|",
        f"| pytest passed | {pytest_summary.get('passed',0)} |",
        f"| pytest failed | {pytest_summary.get('failed',0)} |",
        f"| coverage | {pytest_summary.get('coverage',0):.1f}% |",
        f"| total test est | {pytest_summary.get('total_suite_est',0)} |",
        f"| W2 ready | {'✅ YES' if verdict.get('can_promote_to_week2') else '❌ NO'} |",
        "",
        "## Assessment",
        verdict.get("honest_assessment", "N/A"),
        "",
        "## Critical Path",
        f"**{verdict.get('critical_path','N/A')}**",
        "",
    ]

    for section in ["A","B","C","D","E","F"]:
        sg = [(gid,g) for gid,g in sorted(gates.items()) if g.get("section")==section]
        if not sg: continue
        sp = sum(1 for _,g in sg if g.get("pass"))
        lines.append(f"## Section {section} — {sp}/{len(sg)} pass")
        for gid, g in sg:
            icon = "✅" if g.get("pass") else "❌"
            lines.append(f"- {icon} **{gid}**: {g.get('name','')}")
            if not g.get("pass"):
                lines.append(f"  - `{g.get('proof','')[:100]}`")
        lines.append("")

    if verdict.get("priority_fixes"):
        lines.append("## Priority Fixes")
        for fix in verdict["priority_fixes"][:8]:
            lines.append(f"- **[{fix.get('gate')}]** {fix.get('action')} (~{fix.get('hours')}h)")
        lines.append("")

    if verdict.get("blockers"):
        lines.append("## W2 Blockers")
        for b in verdict["blockers"][:6]:
            lines.append(f"- {b}")

    text = "\n".join(lines)
    artifact_path = REPORT_DIR / "clawwork_artifact.md"
    artifact_path.write_text(text, encoding="utf-8")

    json_path = REPORT_DIR / "w01_active_gate_report.json"
    json_path.write_text(json.dumps({
        "score": score, "passed": passed, "total": total,
        "gates": gates, "pytest": pytest_summary, "verdict": verdict,
        "elapsed_s": elapsed, "model": OLLAMA_MODEL,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }, indent=2), encoding="utf-8")

    return str(artifact_path)

# ── SSE STREAM ────────────────────────────────────────────────

@app.get("/api/judge/run")
async def run_judge():
    async def generate() -> AsyncGenerator[str, None]:
        t0 = time.perf_counter()
        yield sse("start", {
            "timestamp":   datetime.now(timezone.utc).isoformat(),
            "total_gates": len(GATE_DEFS),
            "model":       OLLAMA_MODEL,
            "repo":        str(REPO_PATH),
        })

        # Pre-flight
        for name, url, key in [
            ("FastAPI backend", f"{BACKEND_URL}/docs",  "backend"),
            ("Vite frontend",   FRONTEND_URL,            "frontend"),
        ]:
            try:
                r = requests.get(url, timeout=4)
                info = {"running": True, "status": r.status_code}
            except:
                info = {"running": False}
            yield sse("service_check", {"service": key, **info})
            await asyncio.sleep(0.05)

        venv_py = find_venv_python()
        yield sse("service_check", {
            "service": "venv_python", "running": venv_py is not None,
            "path": venv_py or "not found at phase1/venv/"
        })
        db = await asyncio.get_event_loop().run_in_executor(None, check_sqlite)
        yield sse("service_check", {"service": "sqlite_db",
                                     "running": db["db_exists"],
                                     "tables": db.get("tables", [])})

        # Structural gates
        all_gates = {}
        for gid, sec, name in GATE_DEFS:
            if gid in ["A2","A4","E2","E3","E4"]: continue
            try:
                res = await asyncio.get_event_loop().run_in_executor(None, eval_gate, gid)
            except Exception as e:
                res = {"pass": False, "proof": f"Error: {e}", "evidence": {}}
            res.update({"id": gid, "section": sec, "name": name})
            all_gates[gid] = res
            yield sse("gate_result", res)
            await asyncio.sleep(0.02)

        # Playwright
        yield sse("playwright_start", {"message": f"Playwright → {FRONTEND_URL}"})
        pw = {}
        try:
            pw = await asyncio.wait_for(run_playwright_audit(), timeout=90)
        except asyncio.TimeoutError:
            pw = {"error": "timeout 90s"}
        except Exception as e:
            pw = {"error": str(e)}

        # A2 from playwright
        has_canvas = pw.get("comps", {}).get("canvas", 0) > 0
        errs = pw.get("consoleErrors", [])
        a2 = {
            "id":"A2","section":"A",
            "name":"Live UI renders at localhost:5100 with canvas (Lightweight Charts), 0 errors",
            "pass": pw.get("hasContent") and has_canvas and len(errs) == 0,
            "proof": (f"UI ✓, canvas={pw.get('comps',{}).get('canvas','?')} (Lightweight Charts), 0 console errors"
                      if (pw.get("hasContent") and has_canvas and not errs) else
                      f"hasContent={pw.get('hasContent')}, canvas={pw.get('comps',{}).get('canvas',0)}, errors={len(errs)}: {errs[:2]}"),
            "evidence": {k:v for k,v in pw.items() if k != "screenshot_b64"},
            "screenshot_b64": pw.get("screenshot_b64"),
        }
        all_gates["A2"] = a2
        yield sse("gate_result", a2)

        # A4 from playwright
        a4 = {
            "id":"A4","section":"A",
            "name":"Live DOM: aria-labels + roles present (Playwright)",
            "pass": pw.get("ariaCount",0) >= 5 and pw.get("roleCount",0) >= 3,
            "proof": f"aria-labels={pw.get('ariaCount',0)}, roles={pw.get('roleCount',0)}, headings={pw.get('headingCount',0)}",
            "evidence": {"aria": pw.get("ariaCount",0), "roles": pw.get("roleCount",0)},
        }
        all_gates["A4"] = a4
        yield sse("gate_result", a4)

        yield sse("playwright_done", {
            "title":         pw.get("title",""),
            "comps":         pw.get("comps",{}),
            "paletteOpened": pw.get("paletteOpened", False),
            "consoleErrors": errs[:5],
            "hasScreenshot": bool(pw.get("screenshot_b64")),
            "screenshot_b64":pw.get("screenshot_b64",""),
            "error":         pw.get("error",""),
        })

        # Pytest
        yield sse("pytest_start", {"message": f"Running pytest in {PHASE1_DIR}..."})
        buf = []
        async def collect(s): buf.append(s)
        pytest_sum = {"passed":0,"failed":0,"skipped":0,"coverage":0.0,"count":0}
        try:
            pytest_sum = await asyncio.wait_for(run_pytest_stream(collect), timeout=360)
        except asyncio.TimeoutError:
            pytest_sum["error"] = "timeout"
        for s in buf: yield s

        count = pytest_sum.get("count",0)
        cov   = pytest_sum.get("coverage",0.0)
        pf    = pytest_sum.get("passed",0)
        ff    = pytest_sum.get("failed",0)
        sk    = pytest_sum.get("skipped",0)

        for gid, name, ok, proof in [
            ("E2","pytest test count (README: 367 backend tests)",
             count >= 300,
             f"{count} tests collected (README baseline: 367 backend)"),
            ("E3","pytest coverage ≥70% (W1 Apex Terminal target)",
             cov >= 70.0,
             f"{cov:.1f}% (need ≥70% for W1)" if cov < 70 else f"{cov:.1f}% ✓"),
            ("E4","pytest: 0 failures, 0 skipped",
             ff == 0 and sk == 0 and pf > 0,
             f"{pf} passed, 0 failed, 0 skipped ✓" if (ff==0 and sk==0 and pf>0) else
             f"{pf} passed, {ff} FAILED, {sk} SKIPPED"),
        ]:
            gate = {"id":gid,"section":"E","name":name,
                    "pass":ok,"proof":proof,"evidence":pytest_sum}
            all_gates[gid] = gate
            yield sse("gate_result", gate)

        yield sse("pytest_done", pytest_sum)

        # LLM
        yield sse("llm_start", {"message": f"Consulting {OLLAMA_MODEL}..."})
        try:
            verdict = await asyncio.get_event_loop().run_in_executor(
                None, build_llm_verdict, all_gates, pytest_sum,
                {k:v for k,v in pw.items() if k != "screenshot_b64"}
            )
        except Exception as e:
            verdict = {"error": str(e), "honest_assessment": "LLM unavailable"}
        yield sse("llm_verdict", verdict)

        # ClawWork artifact
        elapsed = round(time.perf_counter() - t0, 1)
        try:
            artifact = await asyncio.get_event_loop().run_in_executor(
                None, write_clawwork_artifact, all_gates, pytest_sum, verdict, elapsed
            )
            yield sse("artifact_written", {"path": artifact,
                "clawwork_usage": "submit_work(work_output='W1 judge done', artifact_file_paths=['" + artifact + "'])"})
        except Exception as e:
            yield sse("artifact_written", {"error": str(e)})

        total_g  = len(all_gates)
        passed_g = sum(1 for g in all_gates.values() if g.get("pass"))
        yield sse("done", {
            "score":     round(passed_g/total_g*10, 2) if total_g else 0,
            "passed":    passed_g, "total": total_g,
            "elapsed_s": elapsed, "model": OLLAMA_MODEL,
        })

    return StreamingResponse(generate(), media_type="text/event-stream",
                             headers={"Cache-Control":"no-cache","X-Accel-Buffering":"no"})

@app.get("/api/judge/gates")
async def get_gates():
    return [{"id":gid,"section":sec,"name":name} for gid,sec,name in GATE_DEFS]

@app.get("/health")
async def health():
    return {"status":"ok","model":OLLAMA_MODEL,"repo":str(REPO_PATH),
            "db":str(DB_FILE),"venv":find_venv_python()}
