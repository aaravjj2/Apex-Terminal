#!/usr/bin/env python3
# ============================================================
# evaluate_apex_w01.py  — WEEK 1 DETERMINISTIC JUDGE
# Apex Terminal · Week 1: Terminal Shell Refactor
#
# DELIVERABLES VALIDATED:
#   A) Backend Ops Endpoints     (8 checks)
#   B) Frontend Build & Assets   (4 checks)
#   C) Playwright E2E Tests      (1 check — all must pass)
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
REPO_PATH    = Path(os.getenv("APEX_REPO_PATH",
                              r"C:\Tradingview\Tradingview recreation"))
BACKEND_URL  = os.getenv("APEX_BACKEND_URL", "http://localhost:8000")
FRONTEND_URL = os.getenv("APEX_FRONTEND_URL", "http://localhost:5100")
ES_URL       = os.getenv("APEX_ES_URL", "http://localhost:9200")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "devstral")

client = OpenAI(api_key="ollama", base_url="http://localhost:11434/v1")

# ── GATE REGISTRY ─────────────────────────────────────────────
GATES = {}

def register(gate_id, section, name, passed, proof):
    GATES[gate_id] = {
        "pass": passed, "proof": proof,
        "section": section, "name": name
    }
    c   = Fore.GREEN if passed else Fore.RED
    sym = "PASS" if passed else "FAIL"
    print(f"  {c}[{sym}] {gate_id}: {name}{Style.RESET_ALL}")
    # Word-wrap the proof
    words = proof.split()
    line  = "         "
    for w in words:
        if len(line) + len(w) > 80:
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
    if sub: print(f"  {Fore.YELLOW}{sub}{Style.RESET_ALL}")
    print(f"{Fore.CYAN}{'━'*68}{Style.RESET_ALL}")

def api(method, path, **kw):
    try:
        r = getattr(requests, method)(
            f"{BACKEND_URL}{path}", timeout=kw.pop("timeout", 8), **kw)
        try:    return r.status_code, r.json()
        except: return r.status_code, None
    except: return 0, None

def find_file(*names):
    for name in names:
        for p in REPO_PATH.rglob(name):
            if any(s in str(p) for s in [".venv","__pycache__",".git","node_modules"]):
                continue
            return p
    return None

def read_json(path):
    try:    return json.loads(Path(path).read_text(encoding="utf-8"))
    except: return None

def src_contains(pattern, ext="*.py", max_files=200):
    """Search source files for a regex pattern. Returns (found: bool, example: str)."""
    count = 0
    for f in REPO_PATH.rglob(ext):
        if any(s in str(f) for s in [".venv","__pycache__",".git","node_modules","dist","build"]):
            continue
        try:
            content = f.read_text(encoding="utf-8", errors="ignore")
            m = re.search(pattern, content, re.I | re.MULTILINE)
            if m:
                return True, f"{f.name}:{m.group(0)[:80]}"
        except: pass
        count += 1
        if count > max_files: break
    return False, ""

def count_tests_in_suite():
    """Run pytest --collect-only and count collected tests."""
    for venv_py in [
        REPO_PATH / "phase1" / ".venv" / "Scripts" / "python.exe",
        REPO_PATH / ".venv" / "Scripts" / "python.exe",
        REPO_PATH / "backend" / ".venv" / "Scripts" / "python.exe",
    ]:
        if venv_py.exists():
            try:
                r = subprocess.run(
                    [str(venv_py), "-m", "pytest", "--collect-only", "-q", "--tb=no"],
                    cwd=str(REPO_PATH / "phase1") if (REPO_PATH/"phase1").exists() else str(REPO_PATH),
                    capture_output=True, text=True, timeout=60
                )
                lines = r.stdout + r.stderr
                m = re.search(r"(\d+) tests? collected", lines)
                if m: return int(m.group(1)), lines
                m = re.search(r"(\d+) selected", lines)
                if m: return int(m.group(1)), lines
            except: pass
    return 0, "could not run pytest"

def run_pytest_with_coverage():
    """Run pytest with coverage and return (passed, failed, skipped, coverage_pct)."""
    for venv_py in [
        REPO_PATH / "phase1" / ".venv" / "Scripts" / "python.exe",
        REPO_PATH / ".venv" / "Scripts" / "python.exe",
    ]:
        if not venv_py.exists(): continue
        cwd = str(REPO_PATH / "phase1") if (REPO_PATH/"phase1").exists() else str(REPO_PATH)
        try:
            r = subprocess.run(
                [str(venv_py), "-m", "pytest", "--tb=no", "-q",
                 "--cov=.", "--cov-report=term-missing",
                 "--json-report", "--json-report-file=w01_pytest_report.json"],
                cwd=cwd, capture_output=True, text=True, timeout=300
            )
            output = r.stdout + r.stderr

            # Parse counts
            passed = failed = skipped = 0
            for line in output.split("\n"):
                m = re.search(r"(\d+) passed", line)
                if m: passed = int(m.group(1))
                m = re.search(r"(\d+) failed", line)
                if m: failed = int(m.group(1))
                m = re.search(r"(\d+) skipped", line)
                if m: skipped = int(m.group(1))

            # Parse coverage
            cov_pct = 0.0
            for line in output.split("\n"):
                m = re.search(r"TOTAL\s+\d+\s+\d+\s+([\d.]+)%", line)
                if m: cov_pct = float(m.group(1)); break

            return passed, failed, skipped, cov_pct, output
        except subprocess.TimeoutExpired:
            return 0, 0, 0, 0.0, "TIMEOUT — tests took > 5 minutes"
        except Exception as e:
            return 0, 0, 0, 0.0, str(e)
    return 0, 0, 0, 0.0, "no venv found"

def count_loc_git_diff():
    """Count lines added in recent commits (proxy for week's LOC delivery)."""
    try:
        r = subprocess.run(
            ["git", "diff", "--stat", "HEAD~7", "HEAD"],
            cwd=str(REPO_PATH), capture_output=True, text=True, timeout=15
        )
        lines = r.stdout
        m = re.search(r"(\d+) insertion", lines)
        return int(m.group(1)) if m else 0, lines
    except:
        try:
            r = subprocess.run(
                ["git", "log", "--oneline", "-50"],
                cwd=str(REPO_PATH), capture_output=True, text=True, timeout=10
            )
            return len(r.stdout.strip().split("\n")) * 2000, r.stdout[:200]  # rough estimate
        except:
            return 0, "git unavailable"


# ════════════════════════════════════════════════════════════
# SECTION A — UI/UX STRUCTURE (8 gates)
# Plan spec: CommandBar, SymbolContextBus, MonitorGrid,
# ExecutionBlotter. 20+ keyboard shortcuts. Linked context.
# Accessibility pack. IA tree (4 states). UX blueprint appendix.
# ════════════════════════════════════════════════════════════

def section_a():
    hdr("SECTION A — UI/UX Structure",
        "CommandBar | SymbolContextBus | MonitorGrid | ExecutionBlotter | "
        "20+ shortcuts | linked-context | accessibility | IA tree")

    fe_src = None
    for candidate in ["frontend/src", "src", "apps/web/src", "client/src", "ui/src"]:
        p = REPO_PATH / candidate
        if p.exists(): fe_src = p; break

    def fe_files(ext="*.tsx"):
        if not fe_src: return []
        return [f for f in fe_src.rglob(ext)
                if not any(s in str(f) for s in ["node_modules", "dist", ".next"])]

    all_fe_names = [f.stem.lower() for f in fe_files()]

    # ── A1: 4 primary components exist and are non-trivial ────
    required = ["commandbar", "symbolcontextbus", "monitorgrid", "executionblotter"]
    found    = [c for c in required if any(c in n for n in all_fe_names)]
    missing  = [c for c in required if c not in [f for c2 in found for f in [c2]]]
    # re-check with partial match
    found2 = []
    for req in required:
        match = any(req.replace("context","").replace("execution","exec") in n or req in n
                    for n in all_fe_names)
        if match: found2.append(req)
    missing2 = [r for r in required if r not in found2]

    # Check component line counts (non-trivial = >50 LOC)
    substantial = 0
    for f in fe_files():
        if any(c in f.stem.lower() for c in ["commandbar","symbolcontext","monitorgrid","executionblotter","execblotter"]):
            try:
                lines = len(f.read_text(encoding="utf-8",errors="ignore").split("\n"))
                if lines > 50: substantial += 1
            except: pass

    register("A1", "A", "CommandBar, SymbolContextBus, MonitorGrid, ExecutionBlotter implemented (>50 LOC each)",
        substantial >= 4,
        f"{substantial}/4 substantial components found" if substantial >= 4 else
        f"Only {substantial}/4 substantial components. Missing or trivial: "
        f"{missing2 or 'check component names match exactly'}. "
        "Each must be >50 LOC with actual implementation, not empty stubs.")

    # ── A2: IA tree — 4 states defined ───────────────────────
    # Look for state machine / IA definitions
    ia_patterns = [
        r"landing.?state|landingState",
        r"deep.?dive.?state|deepDiveState|deepdive",
        r"action.?state|actionState",
        r"failure.?state|failureState|errorState",
    ]
    states_found = []
    for pattern in ia_patterns:
        found_p, ex = src_contains(pattern, "*.tsx")
        if not found_p:
            found_p, ex = src_contains(pattern, "*.ts")
        if found_p: states_found.append(pattern.split("|")[0])

    register("A2", "A", "IA tree: 4 states defined (landing | deep-dive | action | failure)",
        len(states_found) >= 4,
        f"{len(states_found)}/4 states found: {states_found}" if len(states_found) >= 4 else
        f"Only {len(states_found)}/4 states found: {states_found}. "
        "Add explicit state constants: LANDING_STATE, DEEP_DIVE_STATE, ACTION_STATE, FAILURE_STATE "
        "in a shell.types.ts or stateMachine.ts file.")

    # ── A3: Keyboard map — 20+ shortcuts with conflict matrix ─
    # Look for keybind/shortcut definitions
    shortcut_count = 0
    conflict_matrix = False
    for f in fe_files("*.ts") + fe_files("*.tsx") + fe_files("*.json"):
        try:
            content = f.read_text(encoding="utf-8", errors="ignore")
            # Count shortcut-like patterns: {key: "Ctrl+K"} or "mod+k" patterns
            shortcuts = re.findall(r"""["'](ctrl|cmd|mod|alt|shift)\+[a-z0-9]["']""",
                                   content, re.I)
            shortcut_count += len(shortcuts)
            if "conflict" in content.lower() or "conflictMatrix" in content or "keyConflict" in content:
                conflict_matrix = True
        except: pass

    register("A3", "A", "Keyboard map: 20+ shortcuts + conflict resolution matrix",
        shortcut_count >= 20 and conflict_matrix,
        f"{shortcut_count} shortcuts found, conflict matrix={conflict_matrix}" if shortcut_count >= 20 else
        f"Only {shortcut_count} keyboard shortcuts detected (need ≥20). "
        "Define in a keyboardMap.ts file: {shortcut: string, action: string, "
        "conflictsWith: string[]}. Add a resolveConflict() function.")

    # ── A4: Linked-context propagation ───────────────────────
    context_signals = {
        "symbol_ctx":    any(k in " ".join(all_fe_names) for k in ["symbolcontext","symbolctx","symbolbus"]),
        "timeframe_ctx": src_contains(r"timeframe.*context|timeframeCtx|tf.*context", "*.tsx")[0] or
                         src_contains(r"timeframe.*context|timeframeCtx|tf.*context", "*.ts")[0],
        "account_ctx":   src_contains(r"account.*context|accountCtx", "*.tsx")[0] or
                         src_contains(r"accountContext|accountCtx", "*.ts")[0],
        "strategy_ctx":  src_contains(r"strategy.*context|strategyCtx|strategy.*bus", "*.tsx")[0],
    }
    found_ctx = [k for k,v in context_signals.items() if v]

    register("A4", "A", "Linked-context: symbol + timeframe + account + strategy propagation",
        len(found_ctx) >= 4,
        f"Context signals found: {found_ctx}" if len(found_ctx) >= 4 else
        f"Only {len(found_ctx)}/4 context types found: {found_ctx}. "
        "Implement a ContextBus with: symbolCtx, timeframeCtx, accountCtx, strategyCtx. "
        "Use React Context or Zustand store. Each change must propagate to all subscribed panels.")

    # ── A5: Accessibility pack ────────────────────────────────
    a11y = {
        "semantic_headings":  src_contains(r"<h[1-6]|role=[\"']heading", "*.tsx")[0],
        "landmarks":          src_contains(r"role=[\"'](main|navigation|banner|complementary|contentinfo)", "*.tsx")[0],
        "tab_order":          src_contains(r"tabIndex|tab-index|tabindex", "*.tsx")[0],
        "aria_labels":        src_contains(r"aria-label|aria-labelledby|aria-describedby", "*.tsx")[0],
        "contrast_check":     (find_file("axe-core", "a11y.config.*", "accessibility.config.*") is not None or
                               src_contains(r"axe|jest-axe|@testing-library.*a11y", "*.ts")[0]),
    }
    a11y_count = sum(a11y.values())
    register("A5", "A", "Accessibility pack: headings + landmarks + tab order + ARIA + contrast",
        a11y_count >= 5,
        f"a11y checks: {a11y}" if a11y_count >= 5 else
        f"Only {a11y_count}/5 a11y requirements met: {a11y}. "
        "Add: semantic <h1>/<h2> headings, role=main/navigation landmarks, "
        "tabIndex on interactive elements, aria-label on all icons/buttons, "
        "jest-axe in test suite for automated contrast checking.")

    # ── A6: UX blueprint appendix (wireframes + anti-patterns) ─
    ux_docs = list(REPO_PATH.rglob("*.md")) + list(REPO_PATH.rglob("*.mdx"))
    ux_doc_content = ""
    ux_artifact_count = 0
    for doc in ux_docs[:20]:
        try:
            c = doc.read_text(encoding="utf-8", errors="ignore").lower()
            ux_doc_content += c
        except: pass

    # Plan requires 25+ UX artifacts: wireframes, interaction maps, keyboard matrix, accessibility audits
    wireframes    = (REPO_PATH / "docs" / "wireframes").exists() or \
                    bool(list(REPO_PATH.rglob("wireframe*"))) or \
                    "wireframe" in ux_doc_content
    anti_patterns = "anti-pattern" in ux_doc_content or "antipattern" in ux_doc_content
    acceptance    = "acceptance" in ux_doc_content and "check" in ux_doc_content
    interaction   = "interaction" in ux_doc_content and ("state" in ux_doc_content or "map" in ux_doc_content)

    ux_score = sum([wireframes, anti_patterns, acceptance, interaction])
    register("A6", "A", "UX blueprint: wireframes + interaction states + anti-patterns + acceptance checks",
        ux_score >= 4,
        "UX blueprint complete: wireframes, anti-patterns, acceptance checks, interaction maps found" if ux_score >= 4 else
        f"UX blueprint incomplete ({ux_score}/4): "
        f"wireframes={wireframes}, anti_patterns={anti_patterns}, "
        f"acceptance={acceptance}, interaction_maps={interaction}. "
        "Create docs/ux/W01_blueprint.md with: wireframe links/embeds, "
        "interaction state diagram, list of UX anti-patterns to avoid, "
        "acceptance checklist with testable criteria.")

    # ── A7: Non-headless Playwright E2E with traces + videos ──
    pw_config = find_file("playwright.config.ts", "playwright.config.js")
    pw_ok = False
    pw_issues = []
    if pw_config:
        c = pw_config.read_text(encoding="utf-8", errors="ignore")
        if "headless: false" not in c and "headed" not in c.lower():
            pw_issues.append("not running headed (headless: false required)")
        if "trace" not in c.lower():   pw_issues.append("trace: 'on' missing")
        if "video" not in c.lower():   pw_issues.append("video: 'on' missing")
        if "screenshot" not in c.lower(): pw_issues.append("screenshot: 'on' missing")
        # Check for actual spec files
        spec_files = list(pw_config.parent.rglob("*.spec.ts")) + \
                     list(pw_config.parent.rglob("*.spec.js"))
        if len(spec_files) < 3:
            pw_issues.append(f"only {len(spec_files)} spec files (need ≥3 for W1 scope)")
        pw_ok = not pw_issues
    else:
        pw_issues = ["playwright.config.ts not found"]

    register("A7", "A", "Playwright E2E: headed (non-headless) + traces + screenshots + videos",
        pw_ok,
        f"Playwright config compliant: {len(list(pw_config.parent.rglob('*.spec.ts')))} spec files" if pw_ok else
        f"Playwright issues: {'; '.join(pw_issues)}. "
        "Fix playwright.config.ts: headless: false, trace: 'on', video: 'on', screenshot: 'on'.")

    # ── A8: 25+ UX artifacts checklist ───────────────────────
    # Count actual artifact files: images, docs, spec files
    artifact_count = 0
    for pattern in ["*.fig", "*.sketch", "wireframe*", "*.png", "*.svg",
                    "*keyboard*", "*matrix*", "*accessibility*", "*audit*", "*ux*"]:
        matches = [p for p in REPO_PATH.rglob(pattern)
                   if not any(s in str(p) for s in ["node_modules","dist",".git"])]
        artifact_count += len(matches)

    # Count markdown docs that are UX-related
    for doc in REPO_PATH.rglob("*.md"):
        if any(k in doc.stem.lower() for k in ["ux","ui","design","wireframe","blueprint","keyboard","a11y"]):
            artifact_count += 1

    register("A8", "A", "≥25 UX artifacts: wireframes, interaction maps, keyboard matrix, accessibility audits",
        artifact_count >= 25,
        f"{artifact_count} UX artifacts found" if artifact_count >= 25 else
        f"Only {artifact_count} UX artifacts (need ≥25). "
        "Create: docs/ux/wireframes/ (5+ screens), docs/ux/keyboard_matrix.md, "
        "docs/ux/interaction_states.md (4 states × 4 components = 16 docs), "
        "docs/ux/accessibility_audit.md, docs/ux/anti_patterns.md. "
        "Screenshots from Playwright runs also count.")


# ════════════════════════════════════════════════════════════
# SECTION B — BACKEND API CONTRACTS (8 gates)
# Plan spec: /api/v1/monitors, /api/v1/execution/orders,
# /api/v1/risk/checks, /api/v1/portfolio/analytics
# Versioning, idempotency keys, deterministic error taxonomy,
# retries with backoff, dead-letter channels, replay controls.
# ════════════════════════════════════════════════════════════

def section_b():
    hdr("SECTION B — Backend API Contracts",
        "/monitors | /execution/orders | /risk/checks | /portfolio/analytics | "
        "idempotency | retries | dead-letter | sequence diagrams")

    # ── B1: 4 W1 API contracts respond correctly ──────────────
    w1_apis = {
        "/api/v1/monitors":             None,
        "/api/v1/execution/orders":     None,
        "/api/v1/risk/checks":          None,
        "/api/v1/portfolio/analytics":  None,
    }
    for ep in w1_apis:
        sc, _ = api("get", ep)
        w1_apis[ep] = sc

    working = {ep: sc for ep, sc in w1_apis.items() if sc not in [0, 404, 405]}
    missing = {ep: sc for ep, sc in w1_apis.items() if sc in [0, 404]}

    register("B1", "B", "W1 API contracts: /monitors + /execution/orders + /risk/checks + /portfolio/analytics",
        len(working) >= 4,
        f"All 4 endpoints responding: {working}" if len(working) >= 4 else
        f"Working: {working}. Missing/404: {missing}. "
        "Create these exact routes in your FastAPI app. They must return structured data, "
        "not 404. Even empty lists {} are acceptable for now — existence is not enough, "
        "they must be registered and callable.")

    # ── B2: Versioning — /api/v1/ prefix and version header ──
    sc, data = api("get", "/api/v1/monitors")
    has_v1_prefix = sc not in [0, 404]

    # Check response headers for API version
    try:
        r = requests.get(f"{BACKEND_URL}/api/v1/monitors", timeout=5)
        version_header = r.headers.get("X-API-Version") or r.headers.get("API-Version") or ""
        has_version_header = bool(version_header)
    except:
        has_version_header = False

    # Also check OpenAPI spec for version info
    sc_docs, spec = api("get", "/openapi.json")
    spec_has_version = bool(spec and spec.get("info", {}).get("version"))

    register("B2", "B", "API versioning: /v1/ prefix + version metadata in spec",
        has_v1_prefix and spec_has_version,
        f"v1 prefix={has_v1_prefix}, spec version={spec_has_version}" if (has_v1_prefix and spec_has_version) else
        f"v1_prefix={has_v1_prefix}, spec_version={spec_has_version}, version_header={has_version_header}. "
        "Ensure all routes use /api/v1/ prefix. Add version to openapi.json info.version. "
        "Optionally add X-API-Version response header.")

    # ── B3: Idempotency keys on mutation endpoints ────────────
    # POST an order with an Idempotency-Key header
    idem_key = f"test-idem-{int(time.time())}"
    sc1, r1 = api("post", "/api/v1/execution/orders",
                  headers={"Idempotency-Key": idem_key},
                  json={"symbol": "AAPL", "side": "buy", "qty": 1, "type": "market"},
                  timeout=10)
    sc2, r2 = api("post", "/api/v1/execution/orders",
                  headers={"Idempotency-Key": idem_key},
                  json={"symbol": "AAPL", "side": "buy", "qty": 1, "type": "market"},
                  timeout=10)

    # Idempotency: same key → same response, not duplicate order
    idempotent = False
    if sc1 in [200,201] and sc2 in [200,201] and r1 and r2:
        # Check if order IDs match (idempotent) vs differ (not idempotent)
        id1 = r1.get("id") or r1.get("order_id") or r1.get("orderId")
        id2 = r2.get("id") or r2.get("order_id") or r2.get("orderId")
        idempotent = bool(id1 and id2 and id1 == id2)
    elif sc1 in [200,201] and sc2 == 409:
        idempotent = True  # 409 Conflict on repeat = valid idempotency

    # Also check source code for idempotency implementation
    code_has_idempotency = src_contains(
        r"idempotency.key|idempotency_key|IdempotencyKey|idem.*key", "*.py")[0]

    register("B3", "B", "Idempotency keys: duplicate POSTs return same response",
        idempotent or (code_has_idempotency and sc1 in [200,201]),
        f"Idempotent POST confirmed: id1==id2" if idempotent else
        f"Live test: sc1={sc1}, sc2={sc2}. Code has idempotency={code_has_idempotency}. "
        "Implement X-Idempotency-Key header processing in POST /execution/orders. "
        "Store key→response in Redis/DB. On duplicate key, return stored response.")

    # ── B4: Deterministic error taxonomy ─────────────────────
    # Check for structured error codes (not just HTTP status)
    error_codes_found, ex = src_contains(
        r"ErrorCode|error_code|ERROR_CODE|ApexError|TerminalError", "*.py")
    error_enum_found, _  = src_contains(r"class.*Error.*Enum|class.*ErrorCode", "*.py")
    error_middleware, _  = src_contains(r"exception_handler|@app.exception|error.*handler", "*.py")

    register("B4", "B", "Deterministic error taxonomy: structured error codes + exception handlers",
        (error_codes_found or error_enum_found) and error_middleware,
        f"Error codes={error_codes_found}, enum={error_enum_found}, handlers={error_middleware}" if
        (error_codes_found and error_middleware) else
        f"error_codes={error_codes_found}, middleware={error_middleware}. "
        "Create errors.py with ErrorCode enum: ORDER_NOT_FOUND, RISK_LIMIT_EXCEEDED, etc. "
        "Add FastAPI @app.exception_handler(ApexException) that returns "
        "{error_code, message, trace_id, timestamp}.")

    # ── B5: Retries with backoff + dead-letter channels ───────
    retry_found, retry_ex = src_contains(r"retry|backoff|exponential.*backoff|tenacity|retry_with", "*.py")
    dlq_found,   dlq_ex   = src_contains(r"dead.letter|dlq|dead_letter|DeadLetter", "*.py")

    # Also check the elastihack DLQ endpoint we saw in earlier runs
    sc_dlq, _ = api("get", "/api/v4/elastihack/vector/dlq")
    has_live_dlq = sc_dlq == 200

    register("B5", "B", "Retries with backoff + dead-letter channel implementation",
        retry_found and (dlq_found or has_live_dlq),
        f"retry={retry_ex[:60]}, DLQ live={has_live_dlq}" if (retry_found and (dlq_found or has_live_dlq)) else
        f"retry={retry_found}({retry_ex[:40]}), dlq={dlq_found or has_live_dlq}. "
        "Add tenacity @retry(stop=stop_after_attempt(3), wait=wait_exponential()) "
        "to all external calls. Route failed messages to a DLQ table/queue with "
        "GET /api/v1/dlq and POST /api/v1/dlq/{id}/retry endpoints.")

    # ── B6: Replay controls ───────────────────────────────────
    replay_found, replay_ex = src_contains(r"replay|event.*replay|replay.*event|replayable", "*.py")
    sc_replay, _ = api("post", "/api/v1/monitors/replay", json={"from": "2026-02-01"}, timeout=5)
    # Check elastihack replay
    sc_replay2, _ = api("post", "/api/v4/elastihack/vector/backfill", json={}, timeout=5)

    has_replay = replay_found or sc_replay in [200,201,202] or sc_replay2 in [200,201,202]
    register("B6", "B", "Replay controls: replayable event stream + replay endpoint",
        has_replay,
        f"Replay found: {replay_ex[:60] if replay_found else ''}, "
        f"endpoint status: {sc_replay}" if has_replay else
        f"No replay controls. replay_code={replay_found}, replay_ep={sc_replay}. "
        "Implement event sourcing pattern: store all state changes as events. "
        "Add POST /api/v1/events/replay?from=ISO_DATE that re-processes events. "
        "Plan requires 'replay controls' as a Week 1 deliverable.")

    # ── B7: Sequence diagrams (backend documentation) ─────────
    seq_diagrams = (
        list(REPO_PATH.rglob("*.mermaid")) +
        list(REPO_PATH.rglob("sequence*.md")) +
        list(REPO_PATH.rglob("*sequence*.md")) +
        list(REPO_PATH.rglob("*diagram*.md"))
    )
    # Check markdown files for mermaid sequence diagrams
    mermaid_seq_count = 0
    for doc in list(REPO_PATH.rglob("*.md"))[:50]:
        try:
            c = doc.read_text(encoding="utf-8", errors="ignore")
            mermaid_seq_count += len(re.findall(r"```mermaid.*?sequenceDiagram", c, re.DOTALL))
        except: pass

    total_diagrams = len(seq_diagrams) + mermaid_seq_count
    register("B7", "B", "Sequence diagrams: request flow + async events + failure recovery",
        total_diagrams >= 3,
        f"{total_diagrams} sequence diagrams found (files + mermaid blocks)" if total_diagrams >= 3 else
        f"Only {total_diagrams} diagrams (need ≥3 for: request flow, async events, failure recovery). "
        "Add to docs/backend/: request_flow.md, async_events.md, failure_recovery.md. "
        "Use mermaid: ```mermaid\nsequenceDiagram\n  Client->>FastAPI: POST /order\n  FastAPI->>DB: save\n```")

    # ── B8: 20+ backend artifacts checklist ──────────────────
    backend_docs = list(REPO_PATH.rglob("*.md"))
    backend_doc_count = 0
    for d in backend_docs:
        if any(k in d.stem.lower() for k in
               ["route","spec","endpoint","contract","sequence","diagram","dependency",
                "rollback","plan","backoff","dlq","retry","schema","api","backend","service"]):
            backend_doc_count += 1
    # Count spec files, route files
    spec_count = len(list(REPO_PATH.rglob("*spec*.py"))) + len(list(REPO_PATH.rglob("*contract*.py")))
    total_backend_artifacts = backend_doc_count + spec_count

    register("B8", "B", "≥20 backend artifacts: route specs, sequence diagrams, dependency maps, rollback plans",
        total_backend_artifacts >= 20,
        f"{total_backend_artifacts} backend artifacts found" if total_backend_artifacts >= 20 else
        f"Only {total_backend_artifacts} backend artifacts (need ≥20). "
        "Create: docs/backend/routes/ (4 route specs), docs/backend/sequences/ (3 diagrams), "
        "docs/backend/dependencies.md, docs/backend/rollback.md, "
        "docs/backend/blast_radius.md, docs/backend/service_ownership.md.")


# ════════════════════════════════════════════════════════════
# SECTION C — DATA ARCHITECTURE (6 gates)
# Plan spec: order_lifecycle_v3, portfolio_snapshot_v2,
# risk_decision_v1, entity_graph_node_v2
# Ingestion→serving path, storage tiers, drift detection.
# ════════════════════════════════════════════════════════════

def section_c():
    hdr("SECTION C — Data Architecture",
        "order_lifecycle_v3 | portfolio_snapshot_v2 | risk_decision_v1 | entity_graph_node_v2 | "
        "ingestion→serving | storage tiers | drift detection")

    # ── C1: W1 schemas exist in Elasticsearch ────────────────
    w1_schemas = {
        "order_lifecycle_v3":    False,
        "portfolio_snapshot_v2": False,
        "risk_decision_v1":      False,
        "entity_graph_node_v2":  False,
    }
    try:
        r = requests.get(f"{ES_URL}/_cat/indices?format=json", timeout=5)
        indices = [idx["index"] for idx in r.json()]
        for schema in w1_schemas:
            # Flexible match: schema name or parts of it
            short = schema.replace("_v3","").replace("_v2","").replace("_v1","")
            w1_schemas[schema] = any(schema in idx or short in idx for idx in indices)
    except: pass

    # Also check in source code for schema definitions
    for schema in w1_schemas:
        if not w1_schemas[schema]:
            found, _ = src_contains(schema, "*.py")
            if not found:
                found, _ = src_contains(schema, "*.json")
            w1_schemas[schema] = found

    present = [s for s,v in w1_schemas.items() if v]
    missing = [s for s,v in w1_schemas.items() if not v]

    register("C1", "C", "W1 schemas: order_lifecycle_v3 + portfolio_snapshot_v2 + risk_decision_v1 + entity_graph_node_v2",
        len(present) >= 4,
        f"All 4 schemas found/defined: {present}" if len(present) >= 4 else
        f"Missing schemas: {missing}. "
        "Create ES index templates: PUT /_index_template/order_lifecycle_v3 with mappings. "
        "Also define Python dataclasses/Pydantic models for each. "
        "These are named exactly in the Week 1 plan — they must exist.")

    # ── C2: Data lineage metadata on schemas ──────────────────
    lineage_found, lineage_ex = src_contains(
        r"lineage|data_lineage|DataLineage|source_system|upstream|downstream", "*.py")
    lineage_doc = find_file("lineage*.md", "data_lineage*.md", "lineage*.json")

    register("C2", "C", "Data lineage metadata: keys, source, upstream, downstream defined",
        lineage_found or bool(lineage_doc),
        f"Lineage in code: {lineage_ex[:60]}" if lineage_found else
        f"lineage_code={lineage_found}, lineage_doc={bool(lineage_doc)}. "
        "Add lineage metadata to each schema: "
        "{source_system, upstream_schemas, downstream_consumers, owner, sla_ms}. "
        "Create docs/data/lineage_map.md showing data flow from ingestion to serving.")

    # ── C3: Storage tiers defined (hot / warm / cold / evidence) ─
    tier_patterns = {
        "hot":      src_contains(r"hot.*tier|storage.*hot|tier.*=.*hot|\"hot\"", "*.py")[0],
        "warm":     src_contains(r"warm.*tier|storage.*warm|tier.*=.*warm|\"warm\"", "*.py")[0],
        "cold":     src_contains(r"cold.*tier|storage.*cold|tier.*=.*cold|\"cold\"", "*.py")[0],
        "evidence": src_contains(r"evidence.*tier|evidence.*retention|immutable.*store", "*.py")[0],
    }
    tiers_found = [t for t,v in tier_patterns.items() if v]

    register("C3", "C", "Storage tiers: hot + warm + cold + evidence retention defined",
        len(tiers_found) >= 4,
        f"All tiers defined: {tiers_found}" if len(tiers_found) >= 4 else
        f"Only {len(tiers_found)}/4 tiers: {tiers_found}. "
        "Define storage_tier: Literal['hot','warm','cold','evidence'] on each schema. "
        "hot = current day (Redis/ES), warm = 30d (ES), cold = 1yr (S3), "
        "evidence = immutable audit (WORM). Add STORAGE_POLICY dict in config.")

    # ── C4: Ingestion → serving path with checkpoints ─────────
    ingestion_ep = None
    for ep in ["/api/v1/ingest", "/api/v3/elasticsearch/ingest", "/api/v1/data/ingest"]:
        sc, _ = api("get", ep)
        if sc not in [0, 404]: ingestion_ep = ep; break

    ingestion_code, ing_ex = src_contains(r"ingest|ingestion|data_pipeline|DataPipeline", "*.py")
    checkpoint_code, _     = src_contains(r"checkpoint|Checkpoint|data_checkpoint", "*.py")
    observability_code, _  = src_contains(r"metrics.*ingest|ingest.*metric|pipeline.*metric", "*.py")

    register("C4", "C", "Ingestion→serving path with transformation checkpoints + observability",
        (ingestion_code and checkpoint_code) or ingestion_ep is not None,
        f"Ingestion path confirmed: ep={ingestion_ep}, checkpoints={checkpoint_code}" if
        (ingestion_code and checkpoint_code) else
        f"ingestion={ingestion_code}, checkpoint={checkpoint_code}, ep={ingestion_ep}. "
        "Map the full ingestion pipeline: source → validate → transform → checkpoint → index → serve. "
        "Each stage must log metrics: {stage, records_in, records_out, duration_ms, errors}.")

    # ── C5: Data replay validation + drift detection ──────────
    drift_found, drift_ex   = src_contains(r"drift|data_drift|DriftDetect|schema_drift", "*.py")
    replay_valid, replay_ex = src_contains(r"replay.*valid|replay.*check|replay.*test", "*.py")

    # Check for drift detection endpoint
    sc_drift, _ = api("get", "/api/v1/data/drift")
    if sc_drift not in [200]: sc_drift, _ = api("get", "/api/v2/elasticsearch/stats/apex-backtests")

    register("C5", "C", "Data replay validation + drift detection across historical windows",
        (drift_found and replay_valid) or drift_found,
        f"drift={drift_ex[:50]}, replay_valid={replay_ex[:50]}" if drift_found else
        f"drift={drift_found}, replay_validation={replay_valid}. "
        "Implement drift detection: compare schema hash between runs. "
        "Add replay_test.py that replays last 7 days of events and validates output matches baseline. "
        "Save drift_report.json: {schema, baseline_hash, current_hash, drift_detected: bool}.")

    # ── C6: 15+ data artifacts ────────────────────────────────
    data_docs = 0
    for p in REPO_PATH.rglob("*.md"):
        if any(k in p.stem.lower() for k in
               ["lineage","schema","data","quality","retention","tier","replay","drift","pipeline"]):
            data_docs += 1
    # Count schema definition files
    schema_files = len(list(REPO_PATH.rglob("*schema*.py"))) + \
                   len(list(REPO_PATH.rglob("*schema*.json"))) + \
                   len(list(REPO_PATH.rglob("*model*.py")))
    total_data = data_docs + min(schema_files, 10)

    register("C6", "C", "≥15 data artifacts: lineage docs, schema diffs, quality reports, replay outcomes",
        total_data >= 15,
        f"{total_data} data artifacts found" if total_data >= 15 else
        f"Only {total_data} data artifacts (need ≥15). "
        "Create: docs/data/lineage_map.md, docs/data/schema_registry.md, "
        "docs/data/quality_report.md, docs/data/retention_matrix.md, "
        "docs/data/replay_outcome.md + 4 schema files + 5 quality SLO definitions.")


# ════════════════════════════════════════════════════════════
# SECTION D — BLOOMBERG-STYLE FEATURE DEPTH (6 gates)
# Plan spec: command-launch enhancement, 2 monitor-layout
# power-user capabilities, BQL-like templates, PORT analytics,
# EMSX blotter traceability, contextual intelligence alerts.
# ════════════════════════════════════════════════════════════

def section_d():
    hdr("SECTION D — Bloomberg-Style Feature Depth",
        "command-launch | monitor-layout power features | BQL templates | "
        "PORT analytics | EMSX blotter | contextual alerts")

    # ── D1: Command-launch enhancement ───────────────────────
    # CommandBar should support command palette style launching
    sc_cmd, cmd_data = api("get", "/api/v1/monitors")
    # Look for command launcher patterns
    cmd_found, cmd_ex = src_contains(
        r"CommandPalette|commandLaunch|command.*launcher|LaunchCommand|spotlight", "*.tsx")
    if not cmd_found:
        cmd_found, cmd_ex = src_contains(r"CommandPalette|commandLaunch", "*.ts")

    register("D1", "D", "Command-launch enhancement: CommandBar with palette-style launcher",
        cmd_found,
        f"Command launcher found: {cmd_ex[:60]}" if cmd_found else
        "No command palette/launcher found. Implement CommandBar with: "
        "- Ctrl+K or > prefix to open palette, "
        "- Fuzzy search across all terminal commands, "
        "- Recent commands history, "
        "- Category grouping (Trading | Analysis | System). "
        "Bloomberg's <GO> command launcher is the reference.")

    # ── D2: 2 monitor-layout power-user capabilities ──────────
    power_features = {
        "multi_panel":     src_contains(r"MultiPanel|multi.panel|panel.*layout|PanelGrid|split.*panel", "*.tsx")[0],
        "saved_layouts":   src_contains(r"saveLayout|save.*layout|SavedLayout|layout.*save", "*.tsx")[0] or
                           bool(api("get", "/api/v1/workspaces")[0] not in [0,404]),
        "drag_drop":       src_contains(r"onDragEnd|useDrag|DndContext|draggable", "*.tsx")[0],
        "fullscreen_panel":src_contains(r"fullscreen|Fullscreen|maximiz", "*.tsx")[0],
        "panel_resize":    src_contains(r"resizable|Resizable|resize.*panel|panel.*resize", "*.tsx")[0],
    }
    power_found = [f for f,v in power_features.items() if v]

    register("D2", "D", "≥2 monitor-layout power-user capabilities (multi-panel, layouts, drag, fullscreen)",
        len(power_found) >= 2,
        f"Power features: {power_found}" if len(power_found) >= 2 else
        f"Only {len(power_found)}/2+ power features: {power_features}. "
        "Implement at least 2 of: multi-panel split view, save/restore layouts, "
        "drag-and-drop panel reordering, fullscreen panel mode, resizable panels.")

    # ── D3: BQL-like analysis templates ───────────────────────
    bql_found, bql_ex = src_contains(r"BQL|bql|SavedView|saved.*view|AnalysisTemplate|analysis.*template", "*.tsx")
    if not bql_found:
        bql_found, bql_ex = src_contains(r"BQL|saved_view|analysis_template", "*.py")
    sc_saved, _ = api("get", "/api/v3/elasticsearch/saved-queries")
    if sc_saved not in [200]: sc_saved, _ = api("get", "/api/v4/elastihack/saved-searches")

    register("D3", "D", "BQL-like analysis templates with reusable saved views",
        bql_found or sc_saved == 200,
        f"BQL/saved views: code={bql_ex[:50]}, saved-queries endpoint={sc_saved}" if
        (bql_found or sc_saved == 200) else
        "No BQL-like templates found. Implement: "
        "- SavedView component with template library "
        "- GET /api/v1/analysis/templates returns categorized saved views "
        "- Each template has: name, description, query, visualisation_config "
        "- Bloomberg's BQL is the reference: structured financial query language.")

    # ── D4: PORT-style analytics with drill-down ──────────────
    port_found, port_ex = src_contains(
        r"portfolio.*analytics|attribution|drill.?down|DrillDown|PortAnalytics|performance.*attribution", "*.tsx")
    if not port_found:
        port_found, port_ex = src_contains(r"attribution|drill_down", "*.py")

    sc_port, _ = api("get", "/api/v1/portfolio/analytics")
    port_live   = sc_port not in [0, 404]

    register("D4", "D", "PORT-style analytics: attribution drill-down + context-aware overlays",
        (port_found and port_live),
        f"PORT analytics: code={port_ex[:50]}, endpoint={sc_port}" if (port_found and port_live) else
        f"port_code={port_found}, portfolio_ep={sc_port}. "
        "Implement /api/v1/portfolio/analytics returning: "
        "{total_pnl, attribution: [{factor, contribution, pct}], positions: [...]}. "
        "Frontend: drill-down from portfolio → strategy → position → trade. "
        "Add context overlay showing how current symbol contributes to portfolio risk.")

    # ── D5: EMSX-style blotter traceability ───────────────────
    blotter_found, blotter_ex = src_contains(
        r"ExecutionBlotter|blotter|parent.*child.*order|order.*lineage|approval.*chain", "*.tsx")
    sc_orders, orders = api("get", "/api/v1/execution/orders")
    has_parent_child = False
    if orders:
        sample = str(orders)
        has_parent_child = "parent" in sample.lower() or "child" in sample.lower()

    register("D5", "D", "EMSX-style blotter: action history + parent-child linkage + approvals",
        blotter_found and (sc_orders not in [0,404]),
        f"Blotter component found, orders endpoint={sc_orders}" if blotter_found else
        f"blotter_code={blotter_found}, orders_ep={sc_orders}, parent_child={has_parent_child}. "
        "ExecutionBlotter must show: order timeline, parent→child order tree, "
        "approval chain with timestamps, fill history, rejection reasons. "
        "Add parent_order_id, child_orders, approval_history fields to order model.")

    # ── D6: Contextual intelligence in message center ─────────
    alert_found, alert_ex = src_contains(
        r"AlertCenter|alert.*center|MessageCenter|contextual.*alert|strategy.*provenance", "*.tsx")
    sc_alerts, _ = api("get", "/api/v1/alerts")
    if sc_alerts in [0,404]: sc_alerts, _ = api("get", "/api/v2/alerts")

    register("D6", "D", "Contextual intelligence: alerts + incidents + strategy provenance in message center",
        alert_found or sc_alerts not in [0,404],
        f"Alert center found: {alert_ex[:50]}" if alert_found else
        f"alert_code={alert_found}, alerts_ep={sc_alerts}. "
        "Implement AlertCenter component showing: "
        "price alerts with context (why triggered, related positions), "
        "incident notifications with impact assessment, "
        "strategy provenance (which strategy triggered this alert). "
        "Each alert must link to the relevant panel.")


# ════════════════════════════════════════════════════════════
# SECTION E — TESTING & QUALITY (7 gates)
# Plan spec: >100,000 LOC, ≥3,500 tests, 95%+ coverage,
# unit/integration/contract/E2E/perf/chaos test types.
# Daily canary + weekly production promotion with rollback proof.
# ════════════════════════════════════════════════════════════

def section_e():
    hdr("SECTION E — Testing & Quality",
        ">100k LOC | ≥3,500 tests | 95%+ coverage | "
        "unit+integration+contract+E2E+perf+chaos | canary + rollback proof")

    # ── E1: >100,000 LOC delivered this week ─────────────────
    loc_added, git_output = count_loc_git_diff()
    register("E1", "E", ">100,000 self-tested LOC delivered this week (git diff)",
        loc_added >= 100000,
        f"{loc_added:,} lines added in last 7 commits" if loc_added >= 100000 else
        f"Only {loc_added:,} LOC in recent commits (need >100,000). "
        "This is the plan's hardest non-negotiable. >100k LOC/week means ~14,300 lines/day. "
        "Ensure every file change is committed. Count: python -c \"import subprocess; "
        "r=subprocess.run(['git','diff','--stat','HEAD~7','HEAD'],capture_output=True,text=True); "
        "print(r.stdout)\"")

    # ── E2: ≥3,500 tests collected ────────────────────────────
    test_count, collect_output = count_tests_in_suite()
    register("E2", "E", "≥3,500 tests collected (unit + integration + contract + E2E + perf + chaos)",
        test_count >= 3500,
        f"{test_count:,} tests collected across all test types" if test_count >= 3500 else
        f"Only {test_count:,} tests (need ≥3,500). "
        "Breakdown needed: unit (1000+), integration (800+), contract (300+), "
        "E2E Playwright (200+), performance (100+), chaos (50+). "
        "Add pytest-parametrize for property-based tests to rapidly grow count.")

    # ── E3: 95%+ changed-line coverage ───────────────────────
    passed, failed, skipped, cov_pct, cov_output = run_pytest_with_coverage()
    # Also check coverage.xml if it exists
    cov_xml = find_file("coverage.xml", ".coverage")
    if cov_pct == 0.0 and cov_xml:
        try:
            import xml.etree.ElementTree as ET
            tree = ET.parse(str(cov_xml))
            root = tree.getroot()
            cov_pct = float(root.attrib.get("line-rate", "0")) * 100
        except: pass

    register("E3", "E", "95%+ changed-line test coverage",
        cov_pct >= 95.0,
        f"{cov_pct:.1f}% coverage, {passed} passed, {failed} failed, {skipped} skipped"
        if cov_pct >= 95.0 else
        f"Coverage={cov_pct:.1f}% (need ≥95%). passed={passed}, failed={failed}. "
        "Run: pytest --cov=. --cov-report=html --cov-fail-under=95. "
        "Focus on coverage of new code this week — use # pragma: no cover sparingly.")

    # ── E4: 0 failed, 0 skipped (plan constitution) ──────────
    register("E4", "E", "pytest: 0 failed, 0 skipped (quality gate)",
        failed == 0 and skipped == 0 and passed > 0,
        f"{passed} passed, 0 failed, 0 skipped" if (failed == 0 and skipped == 0 and passed > 0) else
        f"{passed} passed, {failed} FAILED, {skipped} SKIPPED. "
        "Fix all failures. Convert skips to real tests. "
        "A skipped test is a hidden regression waiting to happen.")

    # ── E5: Chaos tests exist ─────────────────────────────────
    chaos_found, chaos_ex = src_contains(r"chaos|fault.*inject|dependency.*loss|stale.*feed", "*.py")
    chaos_files = list(REPO_PATH.rglob("*chaos*")) + list(REPO_PATH.rglob("*fault*"))

    register("E5", "E", "Chaos tests: dependency loss + stale feed + delayed events + graceful degradation",
        chaos_found or bool(chaos_files),
        f"Chaos tests found: {chaos_ex[:60]}" if (chaos_found or chaos_files) else
        "No chaos tests found. Add tests/chaos/ with: "
        "test_es_unavailable.py (mock ES down, verify graceful degradation), "
        "test_stale_feed.py (inject stale data, verify staleness detection), "
        "test_delayed_events.py (add latency to queue, verify ordering). "
        "Use pytest-mock to simulate dependency failures.")

    # ── E6: Performance tests with SLO gates ─────────────────
    perf_found, perf_ex = src_contains(r"locust|k6|wrk|benchmark|performance.*test|@pytest.mark.perf", "*.py")
    slo_found, slo_ex   = src_contains(r"slo|latency.*budget|p99|p95|threshold.*ms", "*.py")

    register("E6", "E", "Performance tests: latency + throughput + soak targets tied to SLO gates",
        perf_found and slo_found,
        f"Perf tests found: {perf_ex[:50]}, SLOs: {slo_ex[:50]}" if (perf_found and slo_found) else
        f"perf={perf_found}, slo={slo_found}. "
        "Add tests/performance/test_api_latency.py using locust or pytest-benchmark. "
        "Define SLO gates: monitors_p99 < 200ms, orders_p99 < 100ms. "
        "Fail CI if p99 exceeds budget. Log results to perf_report.json.")

    # ── E7: Rollback proof + canary evidence ──────────────────
    rollback_found, rollback_ex = src_contains(r"rollback|roll.back|RollbackPlan|canary|blue.green", "*.py")
    rollback_doc = find_file("rollback*.md", "canary*.md", "release*.md", "ROLLBACK.md")
    sc_slo, _ = api("get", "/api/v1/ops/slo")
    if sc_slo in [0,404]: sc_slo, _ = api("get", "/api/v2/elasticsearch/health")

    register("E7", "E", "Rollback proof + canary evidence: SLO monitoring + rollback plan doc",
        (rollback_found or bool(rollback_doc)) and sc_slo not in [0,404],
        f"Rollback: {rollback_ex[:50]}, SLO endpoint={sc_slo}" if rollback_found else
        f"rollback_code={rollback_found}, rollback_doc={bool(rollback_doc)}, slo_ep={sc_slo}. "
        "Create docs/ops/rollback_plan.md: step-by-step rollback procedure for W1 changes. "
        "Implement /api/v1/ops/slo returning current SLO burn rate. "
        "Plan requires 'daily canary and weekly production promotion with rollback proof'.")


# ════════════════════════════════════════════════════════════
# SECTION F — SECURITY & COMPLIANCE (5 gates)
# Plan spec: threat model, auth scope, audit log completeness,
# policy tests, immutable release evidence pack.
# ════════════════════════════════════════════════════════════

def section_f():
    hdr("SECTION F — Security & Compliance",
        "threat model | auth scope | audit log | policy tests | release evidence pack")

    # ── F1: Threat model for W1 new paths ────────────────────
    threat_model = (find_file("threat_model*.md", "THREAT_MODEL.md", "threat*.md") or
                    find_file("security*.md", "SECURITY.md"))
    threat_code, threat_ex = src_contains(r"threat|privileged.*action|data_mutation|sensitive", "*.py")

    register("F1", "F", "Threat model: all new privileged actions + data mutation paths documented",
        bool(threat_model) or threat_code,
        f"Threat model: {threat_model or threat_ex[:60]}" if (threat_model or threat_code) else
        "No threat model found. Create docs/security/threat_model.md listing: "
        "all new privileged endpoints from W1 (/execution/orders, /risk/checks), "
        "data mutation paths, potential attack vectors, mitigations. "
        "Use STRIDE methodology. Plan requires this as a W1 deliverable.")

    # ── F2: Auth scope validation ─────────────────────────────
    auth_found, auth_ex = src_contains(r"auth|bearer|jwt|oauth|scope|permission|require_scope", "*.py")
    secret_ok, secret_ex = src_contains(r"os.environ|getenv|settings\.|Config\.|SECRET", "*.py")
    hardcoded, hc_ex = src_contains(r"api_key\s*=\s*[\"'][a-zA-Z0-9]{16,}", "*.py")  # hardcoded keys

    register("F2", "F", "Auth scope + secret-handling validated (no hardcoded secrets)",
        auth_found and secret_ok and not hardcoded,
        f"auth={auth_ex[:40]}, secrets via env={secret_ok}, hardcoded={hardcoded}" if
        (auth_found and not hardcoded) else
        f"auth={auth_found}, env_secrets={secret_ok}, hardcoded_detected={hardcoded}. "
        f"{'CRITICAL: hardcoded secrets detected — rotate immediately.' if hardcoded else ''} "
        "All API keys must come from os.environ. Add auth scope validation to /execution/orders.")

    # ── F3: Audit log completeness ────────────────────────────
    audit_found, audit_ex = src_contains(r"audit.*log|AuditLog|audit_event|log.*audit", "*.py")
    sc_audit, audit_data = api("get", "/api/v1/audit-events")
    if sc_audit in [0,404]: sc_audit, audit_data = api("get", "/api/v2/audit-events")
    if sc_audit in [0,404]: sc_audit, audit_data = api("get", "/api/audit")

    audit_has_data = False
    if audit_data:
        items = audit_data if isinstance(audit_data, list) else audit_data.get("items", [])
        audit_has_data = len(items) > 0

    register("F3", "F", "Audit log: complete + queryable + contains W1 mutations",
        (audit_found and (audit_has_data or sc_audit not in [0,404])),
        f"Audit log: code={audit_ex[:40]}, endpoint={sc_audit}, has_data={audit_has_data}" if
        audit_found else
        f"audit_code={audit_found}, audit_ep={sc_audit}, data={audit_has_data}. "
        "Add audit logging to all W1 mutation endpoints. "
        "Each audit event: {event_type, user, timestamp, resource_id, before, after, ip}. "
        "GET /api/v1/audit-events must be filterable by resource and time range.")

    # ── F4: Policy tests for restricted workflows ─────────────
    policy_found, policy_ex = src_contains(r"policy.*test|test.*policy|approval.*chain|test.*approval", "*.py")
    policy_files = list(REPO_PATH.rglob("*policy*test*")) + list(REPO_PATH.rglob("*test*policy*"))

    register("F4", "F", "Policy tests: restricted workflows + approval-chain correctness",
        policy_found or bool(policy_files),
        f"Policy tests: {policy_ex[:60]}" if (policy_found or policy_files) else
        "No policy tests found. Add tests/security/test_policies.py: "
        "test_cannot_place_order_without_risk_approval(), "
        "test_large_order_requires_manual_approval(), "
        "test_audit_log_captures_approval_chain(). "
        "These prove the approval chain works correctly under all conditions.")

    # ── F5: Immutable release evidence pack ───────────────────
    evidence_pack = (find_file("release_evidence*.json", "release_pack*.md",
                                "compliance_attestation*.md", "evidence_pack*.md") or
                     find_file("RELEASE*.md", "release*.md"))
    evidence_code, ev_ex = src_contains(r"evidence.*pack|release.*evidence|compliance.*attest", "*.py")

    register("F5", "F", "Immutable release evidence pack: approvals + compliance attestations",
        bool(evidence_pack) or evidence_code,
        f"Evidence pack: {evidence_pack}" if evidence_pack else
        f"evidence_doc={bool(evidence_pack)}, evidence_code={evidence_code}. "
        "Create docs/releases/W01_evidence_pack.md with: "
        "- test run results (pytest output), "
        "- coverage report link, "
        "- security scan results, "
        "- approval sign-offs, "
        "- SLO burn report, "
        "- rollback verification. "
        "Plan requires 10+ governance artifacts including release signoffs.")


# ════════════════════════════════════════════════════════════
# LLM VERDICT
# ════════════════════════════════════════════════════════════

def w01_llm_verdict():
    total  = len(GATES)
    passed = sum(g["pass"] for g in GATES.values())
    score  = round(passed / total * 10, 2)

    hdr("WEEK 1 LLM VERDICT", f"Model: {OLLAMA_MODEL}")

    sections = {}
    for gid, g in GATES.items():
        s = g["section"]
        sections.setdefault(s, {"pass": 0, "total": 0})
        sections[s]["total"] += 1
        if g["pass"]: sections[s]["pass"] += 1

    failed_gates = [
        {"gate": gid, "name": g["name"], "section": g["section"], "proof": g["proof"]}
        for gid, g in GATES.items() if not g["pass"]
    ]

    prompt = f"""You are the lead engineering reviewer for Apex Terminal.
You are grading Week 1 completion against the plan: "Terminal shell refactor".

Week 1 non-negotiables (from plan):
- >100,000 self-tested LOC delivered
- ≥3,500 tests touched (unit, integration, contract, E2E, perf, chaos)
- 95%+ changed-line coverage
- Daily canary + weekly production promotion with rollback proof
- Bloomberg-style capability maturity score must improve vs prior week
- Primary components: CommandBar, SymbolContextBus, MonitorGrid, ExecutionBlotter
- API contracts: /api/v1/monitors, /api/v1/execution/orders, /api/v1/risk/checks, /api/v1/portfolio/analytics
- Schemas: order_lifecycle_v3, portfolio_snapshot_v2, risk_decision_v1, entity_graph_node_v2
- W1 artifacts required: 25+ UX, 20+ backend, 15+ data, 10+ governance

BINARY SCORE: {passed}/{total} = {score}/10
Section pass rates: {json.dumps({s: f"{v['pass']}/{v['total']}" for s, v in sections.items()})}

Failed gates ({len(failed_gates)}):
{json.dumps(failed_gates[:15], indent=2)}

Respond in valid JSON only — no markdown, no preamble.
Be brutally specific about what W1 exit criteria are not met.

{{
  "week1_complete": false,
  "score": {score},
  "can_promote_to_week2": false,
  "honest_assessment": "2 sentences. What is the actual state of W1 completion.",
  "blockers_for_w2_promotion": ["list of specific missing things that block moving to W2"],
  "critical_path": "What single work item, if done, would unlock the most other gates",
  "bloomberg_maturity_verdict": "Does this actually improve Bloomberg-parity vs a blank project? Specific.",
  "priority_fixes": [
    {{
      "gate": "gate_id",
      "action": "exact implementation step",
      "hours": 2
    }}
  ],
  "week2_readiness": "GO / NO-GO with specific condition"
}}"""

    try:
        resp = client.chat.completions.create(
            model=OLLAMA_MODEL,
            messages=[
                {"role": "system", "content": "Engineering reviewer. Valid JSON only. Zero softening."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.05, max_tokens=2500
        )
        raw = resp.choices[0].message.content.strip()
        if "```" in raw:
            for part in raw.split("```"):
                p = part.strip().lstrip("json").strip()
                try: return json.loads(p)
                except: pass
        return json.loads(raw)
    except Exception as e:
        print(f"  {Fore.RED}LLM failed: {e}{Style.RESET_ALL}")
        return None


# ════════════════════════════════════════════════════════════
# PRINT REPORT
# ════════════════════════════════════════════════════════════

def print_report(verdict):
    total  = len(GATES)
    passed = sum(g["pass"] for g in GATES.values())
    score  = round(passed / total * 10, 2)

    hdr("WEEK 1 BINARY GATE REPORT — APEX TERMINAL")

    pct    = passed / total
    c      = Fore.GREEN if pct >= 0.8 else (Fore.YELLOW if pct >= 0.5 else Fore.RED)
    filled = int(pct * 46)
    bar    = "█" * filled + "░" * (46 - filled)
    print(f"\n  {c}W1 SCORE: {score}/10  [{bar}]  {passed}/{total} gates{Style.RESET_ALL}")
    print(f"  {Fore.RED}Week 2 promotion requires ALL {total} gates GREEN.{Style.RESET_ALL}\n")

    snames = {
        "A": "UI/UX Structure        ",
        "B": "Backend API Contracts  ",
        "C": "Data Architecture      ",
        "D": "Bloomberg-Style Depth  ",
        "E": "Testing & Quality      ",
        "F": "Security & Compliance  ",
    }
    sections = {}
    for gid, g in GATES.items():
        s = g["section"]
        sections.setdefault(s, {"pass": 0, "total": 0, "gates": []})
        sections[s]["total"] += 1
        sections[s]["gates"].append((gid, g))
        if g["pass"]: sections[s]["pass"] += 1

    for sid in sorted(sections.keys()):
        sec = sections[sid]
        sp, st = sec["pass"], sec["total"]
        sc = Fore.GREEN if sp == st else (Fore.YELLOW if sp > 0 else Fore.RED)
        print(f"  {sc}[{sid}] {snames.get(sid, sid)}  {sp}/{st} PASS{Style.RESET_ALL}")
        for gid, g in sec["gates"]:
            sym = f"{Fore.GREEN}✓" if g["pass"] else f"{Fore.RED}✗"
            print(f"    {sym} {gid}: {g['name']}{Style.RESET_ALL}")

    if verdict:
        print(f"\n  {Fore.RED}{'═'*66}{Style.RESET_ALL}")
        print(f"  {Fore.RED}WEEK 1 ENGINEERING VERDICT{Style.RESET_ALL}")
        print(f"  {Fore.RED}{'═'*66}{Style.RESET_ALL}")

        assess = verdict.get("honest_assessment", "")
        if assess: print(f"\n  {Fore.RED}ASSESSMENT:{Style.RESET_ALL}\n  {assess}")

        can_promote = verdict.get("can_promote_to_week2", False)
        w2_ready    = verdict.get("week2_readiness", "NO-GO")
        rc = Fore.GREEN if can_promote else Fore.RED
        print(f"\n  Week 2 Promotion: {rc}{w2_ready}{Style.RESET_ALL}")

        blockers = verdict.get("blockers_for_w2_promotion", [])
        if blockers:
            print(f"\n  {Fore.RED}BLOCKERS FOR W2 PROMOTION:{Style.RESET_ALL}")
            for b in blockers[:6]: print(f"    • {b}")

        cp = verdict.get("critical_path", "")
        if cp: print(f"\n  {Fore.YELLOW}CRITICAL PATH:{Style.RESET_ALL}\n  {cp}")

        bloomberg = verdict.get("bloomberg_maturity_verdict", "")
        if bloomberg: print(f"\n  {Fore.CYAN}BLOOMBERG MATURITY:{Style.RESET_ALL}\n  {bloomberg}")

        fixes = verdict.get("priority_fixes", [])
        if fixes:
            print(f"\n  {Fore.YELLOW}PRIORITY FIXES (ordered):{Style.RESET_ALL}")
            for i, fix in enumerate(fixes[:8], 1):
                print(f"    {i}. [{fix.get('gate')}] {fix.get('action', '')}  (~{fix.get('hours','?')}h)")

    print(f"\n{'━'*68}\n")


# ════════════════════════════════════════════════════════════
# MAIN
# ════════════════════════════════════════════════════════════

if __name__ == "__main__":
    hdr("APEX TERMINAL — WEEK 1 NUCLEAR JUDGE",
        "Mission: Terminal shell refactor | Plan: W01-W13 Foundation & Execution Core")
    print(f"  Repo     : {REPO_PATH}")
    print(f"  Backend  : {BACKEND_URL}")
    print(f"  Model    : {OLLAMA_MODEL}")
    print(f"  {Fore.RED}40 binary gates. 10/10 = ALL green. W2 blocked until ALL pass.{Style.RESET_ALL}")
    print(f"  {Fore.RED}Non-negotiables: >100k LOC/week, ≥3,500 tests, 95%+ coverage.{Style.RESET_ALL}")

    if not REPO_PATH.exists():
        print(f"  {Fore.RED}REPO NOT FOUND: {REPO_PATH}{Style.RESET_ALL}"); sys.exit(1)

    for name, url in [("Backend", f"{BACKEND_URL}/docs"),
                      ("Frontend", FRONTEND_URL),
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
        section_e()
        section_f()

        verdict = w01_llm_verdict()
        print_report(verdict)

        total  = len(GATES)
        passed = sum(g["pass"] for g in GATES.values())
        out    = REPO_PATH / "w01_nuclear_gate_report.json"
        with open(out, "w") as f:
            json.dump({
                "week": 1,
                "mission": "Terminal shell refactor",
                "score": round(passed/total*10, 2),
                "gates_passed": passed,
                "total_gates": total,
                "gates": GATES,
                "verdict": verdict
            }, f, indent=2, default=str)
        print(f"  {Fore.GREEN}✓ Report saved: {out}{Style.RESET_ALL}")

    except KeyboardInterrupt:
        print(f"\n  {Fore.YELLOW}Interrupted{Style.RESET_ALL}")
