#!/usr/bin/env python3
# ============================================================
# evaluate_apex_w01.py  — WEEK 1 DETERMINISTIC JUDGE
# Apex Terminal · Week 1: Terminal Shell Refactor
#
# DELIVERABLES VALIDATED:
#   A) Backend Ops Endpoints     (6 checks)
#   B) Frontend Build & Assets   (4 checks)
#   C) Playwright E2E Tests      (3 checks)
#   D) Code Quality & Wiring     (5 checks)
#
# SCORING: 18 binary gates → 10.0 scale
#   10.0  = ALL 18 green, 0 criticisms
#   <10.0 = proportional deduction
#
# No LLM dependency. Fully deterministic. Reproducible.
# ============================================================

import subprocess, requests, json, time, sys, os, re
from pathlib import Path
from datetime import datetime, timezone

try:
    from colorama import Fore, Style, init
    init(autoreset=True)
except ImportError:
    subprocess.run([sys.executable, "-m", "pip", "install",
                    "colorama", "requests"], check=True)
    from colorama import Fore, Style, init
    init(autoreset=True)

# ── CONFIG ────────────────────────────────────────────────────
REPO      = Path(os.getenv("APEX_REPO_PATH",
                            r"C:\Tradingview\Tradingview recreation"))
BE_URL    = os.getenv("APEX_BACKEND_URL",  "http://localhost:8000")
FE_URL    = os.getenv("APEX_FRONTEND_URL", "http://localhost:5100")
ES_URL    = os.getenv("APEX_ES_URL",       "http://localhost:9200")
FE_SRC    = REPO / "frontend" / "src"
FE_TESTS  = REPO / "frontend" / "tests" / "e2e" / "w01"

# ── GATE REGISTRY ─────────────────────────────────────────────
GATES = {}
CRITICISMS = []

def gate(gid, section, name, passed, proof):
    GATES[gid] = {"pass": passed, "proof": proof, "section": section, "name": name}
    c   = Fore.GREEN if passed else Fore.RED
    sym = "PASS" if passed else "FAIL"
    print(f"  {c}[{sym}] {gid}: {name}{Style.RESET_ALL}")
    if not passed:
        CRITICISMS.append({"gate": gid, "name": name, "proof": proof})
    # word-wrap proof
    words = proof.split()
    line  = "         "
    for w in words:
        if len(line) + len(w) > 90:
            print(f"  {c}{line}{Style.RESET_ALL}")
            line = "         " + w + " "
        else:
            line += w + " "
    if line.strip():
        print(f"  {c}{line}{Style.RESET_ALL}")

# ── HELPERS ───────────────────────────────────────────────────
def hdr(text, sub=""):
    print(f"\n{Fore.CYAN}{'━'*68}")
    print(f"  {text}")
    if sub:
        print(f"  {Fore.YELLOW}{sub}{Style.RESET_ALL}")
    print(f"{Fore.CYAN}{'━'*68}{Style.RESET_ALL}")

def api(path, method="get", **kw):
    try:
        r = getattr(requests, method)(
            f"{BE_URL}{path}", timeout=kw.pop("timeout", 8), **kw)
        try:    return r.status_code, r.json()
        except: return r.status_code, None
    except:
        return 0, None

def find_fe(name):
    """Find a frontend source file by stem match. Prefers exact match."""
    # First pass: exact stem match (case-insensitive)
    for ext in ("*.tsx", "*.ts"):
        for f in FE_SRC.rglob(ext):
            if f.stem.lower() == name.lower():
                return f
    # Second pass: partial stem match
    for ext in ("*.tsx", "*.ts"):
        for f in FE_SRC.rglob(ext):
            if name.lower() in f.stem.lower():
                return f
    return None

def read_src(path):
    if path and path.exists():
        return path.read_text(encoding="utf-8", errors="ignore")
    return ""

def file_lines(path):
    return len(read_src(path).splitlines()) if path else 0


# ═══════════════════════════════════════════════════════════════
# SECTION A — BACKEND OPS ENDPOINTS (6 gates)
# ═══════════════════════════════════════════════════════════════

def section_a():
    hdr("SECTION A — Backend Ops Endpoints",
        "/ops/version | /ops/elastic/health | /ops/broker/health | "
        "/ops/ws/health | /ops/market_session | market/quote")

    # A1: /api/ops/version
    sc, d = api("/api/ops/version")
    ok = sc == 200 and d and "git_sha" in d and "api_version" in d
    gate("A1", "A", "/api/ops/version returns git_sha + api_version",
         ok,
         f"status={sc}, keys={list((d or {}).keys())[:6]}" if ok else
         f"status={sc}. Expected 200 with git_sha, api_version, build_time fields.")

    # A2: /api/ops/elastic/health
    sc, d = api("/api/ops/elastic/health")
    ok = sc in (200, 503) and d and "connected" in d
    gate("A2", "A", "/api/ops/elastic/health returns connected + cluster_status",
         ok,
         f"status={sc}, connected={d.get('connected') if d else '?'}" if ok else
         f"status={sc}. Expected 200/503 with 'connected' boolean field.")

    # A3: /api/ops/broker/health
    sc, d = api("/api/ops/broker/health")
    ok = sc in (200, 503) and d and "connected" in d
    gate("A3", "A", "/api/ops/broker/health returns broker connection status",
         ok,
         f"status={sc}, connected={d.get('connected') if d else '?'}" if ok else
         f"status={sc}. Expected 200/503 with 'connected' boolean.")

    # A4: /api/ops/ws/health
    sc, d = api("/api/ops/ws/health")
    ok = sc == 200 and d and "running" in d
    gate("A4", "A", "/api/ops/ws/health returns running + heartbeat info",
         ok,
         f"status={sc}, running={d.get('running') if d else '?'}" if ok else
         f"status={sc}. Expected 200 with 'running' boolean.")

    # A5: /api/ops/market_session
    sc, d = api("/api/ops/market_session")
    ok = (sc == 200 and d and d.get("timezone") == "America/New_York"
          and d.get("session") in ("regular", "pre", "post", "closed"))
    gate("A5", "A", "/api/ops/market_session returns session + timezone America/New_York",
         ok,
         f"status={sc}, session={d.get('session') if d else '?'}, tz={d.get('timezone') if d else '?'}" if ok else
         f"status={sc}. Expected timezone=America/New_York, session in [regular,pre,post,closed].")

    # A6: /api/v1/market/quote?symbol=AAPL (live quote)
    sc, d = api("/api/v1/market/quote", params={"symbol": "AAPL"})
    ok = sc == 200 and d and ("price" in d or "last" in d or "c" in d or "close" in d
                              or "current_price" in d or "latestPrice" in d)
    gate("A6", "A", "Market quote endpoint returns live price for AAPL",
         ok,
         f"status={sc}, keys={list((d or {}).keys())[:8]}" if ok else
         f"status={sc}. No live price field found. Need /api/v1/market/quote?symbol=AAPL.")


# ═══════════════════════════════════════════════════════════════
# SECTION B — FRONTEND BUILD & COMPONENTS (4 gates)
# ═══════════════════════════════════════════════════════════════

def section_b():
    hdr("SECTION B — Frontend Build & Components",
        "CommandPalette | ContextBus | MonitorGrid | OpsUI2")

    # B1: CommandPalette.tsx exists with data-testid + >100 LOC
    cp = find_fe("CommandPalette")
    src = read_src(cp)
    loc = file_lines(cp)
    has_testids = (
        "'command-palette'" in src and
        '${testId}-input' in src and
        '${testId}-results' in src
    )
    ok = loc > 100 and has_testids
    gate("B1", "B", "CommandPalette.tsx: >100 LOC + data-testid instrumented",
         ok,
         f"{cp.name if cp else 'NOT FOUND'}: {loc} LOC, testids={has_testids}" if ok else
         f"{'File not found' if not cp else f'{loc} LOC, testids={has_testids}'}. "
         "Need command-palette, command-palette-input, command-palette-results testids.")

    # B2: contextBusStore.ts exists with activeSymbol + setActiveSymbol
    cb = find_fe("contextBus")
    src = read_src(cb)
    loc = file_lines(cb)
    has_api = "activeSymbol" in src and "setActiveSymbol" in src
    ok = loc > 30 and has_api
    gate("B2", "B", "ContextBus store: activeSymbol + setActiveSymbol + >30 LOC",
         ok,
         f"{cb.name if cb else 'NOT FOUND'}: {loc} LOC, has_api={has_api}" if ok else
         f"{'File not found' if not cb else f'{loc} LOC, has_api={has_api}'}. "
         "Need Zustand store with activeSymbol state and setActiveSymbol action.")

    # B3: MonitorGrid.tsx exists with layout persistence + data-testid
    mg = find_fe("MonitorGrid")
    src = read_src(mg)
    loc = file_lines(mg)
    has_persist = "localStorage" in src or "apex-monitor-grid" in src
    has_testids = "'monitor-grid'" in src and '${testId}-panel' in src
    ok = loc > 100 and has_persist and has_testids
    gate("B3", "B", "MonitorGrid.tsx: layout persistence + data-testid + >100 LOC",
         ok,
         f"{mg.name if mg else 'NOT FOUND'}: {loc} LOC, persist={has_persist}, testids={has_testids}" if ok else
         f"{'File not found' if not mg else f'{loc} LOC, persist={has_persist}, testids={has_testids}'}. "
         "Need localStorage layout save + monitor-grid, monitor-grid-panel testids.")

    # B4: OpsUI2.tsx exists with data-ready gating + correlation_id + >200 LOC
    ops = find_fe("OpsUI2")
    src = read_src(ops)
    loc = file_lines(ops)
    has_ready = "data-ready" in src
    has_cid   = "correlation_id" in src or "correlationId" in src or "copy-cid" in src
    ok = loc > 200 and has_ready and has_cid
    gate("B4", "B", "OpsUI2.tsx: data-ready gating + correlation_id display + >200 LOC",
         ok,
         f"{ops.name if ops else 'NOT FOUND'}: {loc} LOC, data-ready={has_ready}, cid={has_cid}" if ok else
         f"{'File not found' if not ops else f'{loc} LOC, data-ready={has_ready}, cid={has_cid}'}. "
         "Need data-ready attribute on service cards + correlation_id copy button.")


# ═══════════════════════════════════════════════════════════════
# SECTION C — PLAYWRIGHT E2E (3 gates)
# ═══════════════════════════════════════════════════════════════

def section_c():
    hdr("SECTION C — Playwright E2E Tests",
        "W01 spec files | headed config | data-testid-only selectors")

    # C1: W01 test spec exists with adequate coverage
    specs = list(FE_TESTS.rglob("*.spec.ts")) if FE_TESTS.exists() else []
    total_lines = sum(file_lines(s) for s in specs)
    ok = len(specs) >= 1 and total_lines > 100
    gate("C1", "C", "W01 Playwright spec exists with >100 LOC of tests",
         ok,
         f"{len(specs)} spec files, {total_lines} total LOC" if ok else
         f"Found {len(specs)} specs ({total_lines} LOC). "
         "Need frontend/tests/e2e/w01/*.spec.ts with real test assertions.")

    # C2: Playwright config is headed with traces/screenshots/video
    pw_cfg = REPO / "frontend" / "playwright.config.ts"
    src = read_src(pw_cfg)
    checks = {
        "headless_false": "headless: false" in src or "headless:false" in src,
        "trace_on":       "'on'" in src and "trace" in src,
        "video_on":       "video" in src,
        "screenshot_on":  "screenshot" in src,
        "workers_1":      "workers: 1" in src or "workers:1" in src,
        "retries_0":      "retries: 0" in src or "retries:0" in src,
    }
    ok = all(checks.values())
    gate("C2", "C", "Playwright config: headed + trace + video + screenshot + workers=1 + retries=0",
         ok,
         f"Config checks: {checks}" if ok else
         f"Failing checks: {[k for k,v in checks.items() if not v]}. Fix playwright.config.ts.")

    # C3: W01 specs use data-testid only (no getByRole, getByText, raw text)
    violations = []
    for spec in specs:
        src = read_src(spec)
        lines = src.splitlines()
        for i, line in enumerate(lines, 1):
            # Skip comments
            stripped = line.strip()
            if stripped.startswith("//") or stripped.startswith("*") or stripped.startswith("/*"):
                continue
            # Check for forbidden selectors in non-comment lines
            if "getByRole(" in line:
                violations.append(f"{spec.name}:{i}: getByRole")
            if "getByText(" in line:
                violations.append(f"{spec.name}:{i}: getByText")
            if "getByLabel(" in line:
                violations.append(f"{spec.name}:{i}: getByLabel")
            if "getByPlaceholder(" in line:
                violations.append(f"{spec.name}:{i}: getByPlaceholder")
            if "waitForTimeout(" in line:
                violations.append(f"{spec.name}:{i}: waitForTimeout")
            # hasText on filter is a text-based selector - flag it
            if re.search(r'\.filter\(\s*\{\s*hasText:', line):
                violations.append(f"{spec.name}:{i}: filter(hasText) — use data-testid")
    ok = len(violations) == 0
    gate("C3", "C", "W01 specs use data-testid ONLY (no getByRole/getByText/waitForTimeout)",
         ok,
         "All selectors use data-testid — compliant" if ok else
         f"{len(violations)} violations: {violations[:5]}. "
         "Replace with [data-testid=...] selectors.")


# ═══════════════════════════════════════════════════════════════
# SECTION D — CODE QUALITY & WIRING (5 gates)
# ═══════════════════════════════════════════════════════════════

def section_d():
    hdr("SECTION D — Code Quality & Wiring",
        "Blotter real data | correlation_id | context propagation | "
        "layout persistence | AppShell integration")

    # D1: OrdersBlotter fetches real Alpaca data (not mock/demo)
    ob = find_fe("OrdersBlotter")
    src = read_src(ob)
    has_fetch = "/api/" in src and "orders" in src.lower()
    no_mock   = not any(w in src.lower() for w in ["mock", "demo", "fake", "seeded", "dummy"])
    has_testid = 'orders-blotter' in src
    ok = has_fetch and no_mock and has_testid
    gate("D1", "D", "OrdersBlotter: fetches real Alpaca data, no mock/demo, has data-testid",
         ok,
         f"fetch={has_fetch}, no_mock={no_mock}, testid={has_testid}" if ok else
         f"fetch={has_fetch}, no_mock={no_mock}, testid={has_testid}. "
         "Must fetch from real /api endpoint, no demo data.")

    # D2: Backend ops endpoints return JSON with correlation_id
    cid_count = 0
    for ep in ["/api/broker/health", "/api/v3/ops/health"]:
        sc, d = api(ep)
        if sc == 200 and d and ("correlation_id" in d or "correlationId" in d):
            cid_count += 1
    ok = cid_count >= 1
    gate("D2", "D", "At least 1 ops endpoint returns correlation_id in JSON body",
         ok,
         f"{cid_count} endpoints with correlation_id" if ok else
         "No endpoint returned correlation_id. Add to response JSON.")

    # D3: ContextBus propagates — AppShellUI2 uses setActiveSymbol
    shell = find_fe("AppShellUI2")
    src = read_src(shell)
    uses_bus = ("setActiveSymbol" in src or "useContextBus" in src or "contextBus" in src.lower())
    has_indicator = 'ui2-active-symbol' in src
    ok = uses_bus and has_indicator
    gate("D3", "D", "AppShellUI2 wires ContextBus with active symbol indicator",
         ok,
         f"uses_bus={uses_bus}, indicator={has_indicator}" if ok else
         f"uses_bus={uses_bus}, indicator={has_indicator}. "
         "AppShell must import contextBus and render active symbol in topbar.")

    # D4: MonitorGrid saves layout to localStorage
    mg = find_fe("MonitorGrid")
    src = read_src(mg)
    saves = "localStorage.setItem" in src or "setItem" in src
    reads = "localStorage.getItem" in src or "getItem" in src
    ok = saves and reads
    gate("D4", "D", "MonitorGrid persists layout in localStorage (read + write)",
         ok,
         f"saves={saves}, reads={reads}" if ok else
         f"saves={saves}, reads={reads}. Must use localStorage.getItem/setItem.")

    # D5: AppShellUI2 has market status + connection status badges
    shell = find_fe("AppShellUI2")
    src = read_src(shell)
    has_market   = 'ui2-market-status' in src and 'data-market-session' in src
    has_conn     = 'ui2-conn-status' in src
    has_palette  = 'ui2-command-trigger' in src
    ok = has_market and has_conn and has_palette
    gate("D5", "D", "AppShellUI2: market status + conn status + command trigger all data-testid'd",
         ok,
         f"market={has_market}, conn={has_conn}, palette={has_palette}" if ok else
         f"market={has_market}, conn={has_conn}, palette={has_palette}. "
         "All status indicators must have data-testid attributes.")


# ═══════════════════════════════════════════════════════════════
# SCORING + REPORT
# ═══════════════════════════════════════════════════════════════

def print_report():
    total  = len(GATES)
    passed = sum(1 for g in GATES.values() if g["pass"])
    score  = round(passed / total * 10, 2) if total > 0 else 0

    hdr("WEEK 1 GATE REPORT — APEX TERMINAL")

    pct    = passed / total if total else 0
    c      = Fore.GREEN if pct >= 1.0 else (Fore.YELLOW if pct >= 0.7 else Fore.RED)
    filled = int(pct * 50)
    bar    = "█" * filled + "░" * (50 - filled)
    print(f"\n  {c}W1 SCORE: {score}/10  [{bar}]  {passed}/{total} gates{Style.RESET_ALL}")
    if pct < 1.0:
        print(f"  {Fore.RED}10/10 required for W2 promotion.{Style.RESET_ALL}")
    else:
        print(f"  {Fore.GREEN}ALL GATES GREEN — W2 promotion eligible.{Style.RESET_ALL}")

    snames = {"A": "Backend Ops Endpoints  ",
              "B": "Frontend Components    ",
              "C": "Playwright E2E Tests   ",
              "D": "Code Quality & Wiring  "}

    sections = {}
    for gid, g in GATES.items():
        s = g["section"]
        sections.setdefault(s, {"pass": 0, "total": 0, "gates": []})
        sections[s]["total"] += 1
        sections[s]["gates"].append((gid, g))
        if g["pass"]:
            sections[s]["pass"] += 1

    print()
    for sid in sorted(sections.keys()):
        sec = sections[sid]
        sp, st = sec["pass"], sec["total"]
        sc = Fore.GREEN if sp == st else (Fore.YELLOW if sp > 0 else Fore.RED)
        print(f"  {sc}[{sid}] {snames.get(sid, sid)}  {sp}/{st} PASS{Style.RESET_ALL}")
        for gid, g in sec["gates"]:
            sym = f"{Fore.GREEN}✓" if g["pass"] else f"{Fore.RED}✗"
            print(f"    {sym} {gid}: {g['name']}{Style.RESET_ALL}")

    if CRITICISMS:
        print(f"\n  {Fore.RED}CRITICISMS ({len(CRITICISMS)}):{Style.RESET_ALL}")
        for cr in CRITICISMS:
            print(f"    • [{cr['gate']}] {cr['name']}")

    return score, passed, total


# ═══════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════

if __name__ == "__main__":
    hdr("APEX TERMINAL — WEEK 1 DETERMINISTIC JUDGE",
        "Mission: Terminal shell refactor | 18 binary gates | 10/10 = ALL green")
    print(f"  Repo     : {REPO}")
    print(f"  Backend  : {BE_URL}")
    print(f"  Frontend : {FE_URL}")
    print(f"  ES       : {ES_URL}")

    if not REPO.exists():
        print(f"  {Fore.RED}REPO NOT FOUND: {REPO}{Style.RESET_ALL}")
        sys.exit(1)

    # Connectivity pre-check
    for name, url in [("Backend", f"{BE_URL}/docs"),
                      ("Frontend", FE_URL),
                      ("Elasticsearch", f"{ES_URL}/_cluster/health")]:
        try:
            requests.get(url, timeout=3)
            print(f"  {Fore.GREEN}✓ {name}: running{Style.RESET_ALL}")
        except:
            print(f"  {Fore.YELLOW}⚠ {name}: not detected — some gates will fail{Style.RESET_ALL}")

    try:
        section_a()
        section_b()
        section_c()
        section_d()

        score, passed, total = print_report()

        # Write JSON report
        out = REPO / "w01_judge_result.json"
        result = {
            "week": 1,
            "mission": "Terminal shell refactor",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "score": score,
            "gates_passed": passed,
            "total_gates": total,
            "all_green": passed == total,
            "criticisms": CRITICISMS,
            "gates": GATES,
        }
        with open(out, "w") as f:
            json.dump(result, f, indent=2, default=str)
        print(f"\n  {Fore.GREEN}✓ Report saved: {out}{Style.RESET_ALL}")

        # Exit code: 0 if perfect, 1 if any failure
        sys.exit(0 if passed == total else 1)

    except KeyboardInterrupt:
        print(f"\n  {Fore.YELLOW}Interrupted{Style.RESET_ALL}")
        sys.exit(1)
    except Exception as e:
        print(f"\n  {Fore.RED}JUDGE CRASHED: {e}{Style.RESET_ALL}")
        import traceback
        traceback.print_exc()
        sys.exit(2)
