# ============================================================
# judge_loop.py  —  Autonomous Judge + Copilot Refinement Loop
# ============================================================
# HOW IT WORKS:
#   1. Judge runs strict automated tests (no hallucination — 
#      everything is actually executed and measured)
#   2. Judge synthesizes a brutally honest score + fix list
#   3. A precision-engineered prompt is written to a .md file
#      that Copilot Agent Mode reads via .github/copilot-instructions.md
#   4. VS Code Copilot Agent Mode is triggered via GitHub Copilot CLI
#      (the real programmatic path — no GUI scraping needed)
#   5. Agent makes the changes, runs tests, commits
#   6. Judge re-evaluates. Loop continues until score = 10.0
#
# REQUIRES:
#   pip install openai colorama requests pyautogui pyperclip
#   npm install -g @github/copilot-cli   (or via VS Code extension)
#   ollama running with devstral pulled
#   VS Code open with your project + Copilot Agent Mode enabled
#
# USAGE:
#   # For Apex Terminal:
#   $env:JUDGE_PROJECT = "apex"
#   $env:OLLAMA_MODEL  = "devstral"
#   python judge_loop.py
#
#   # For LedgerLive:
#   $env:JUDGE_PROJECT = "ledger"
#   python judge_loop.py
# ============================================================

import subprocess, requests, json, time, sys, os, shutil
import textwrap
from pathlib import Path
from datetime import datetime

try:
    from openai import OpenAI
    from colorama import Fore, Style, init
    init(autoreset=True)
except ImportError:
    subprocess.run([sys.executable, "-m", "pip", "install",
                    "openai", "colorama", "requests", "pyautogui", "pyperclip"], check=True)
    from openai import OpenAI
    from colorama import Fore, Style, init
    init(autoreset=True)

# ── PROJECT REGISTRY ─────────────────────────────────────────
PROJECTS = {
    "apex": {
        "name":         "Apex Terminal",
        "repo_path":    Path(r"C:\Tradingview\Tradingview recreation"),
        "backend_url":  "http://localhost:8000",
        "frontend_url": "http://localhost:5100",
        "backend_cmd":  r'cd "C:\Tradingview\Tradingview recreation\phase1" && .venv\Scripts\python -m uvicorn services.api.main:app --port 8000 --reload',
        "frontend_cmd": r'cd "C:\Tradingview\Tradingview recreation\frontend" && npm run dev',
        "test_cmd":     r'cd "C:\Tradingview\Tradingview recreation\phase1" && .venv\Scripts\python -m pytest tests/ -q --tb=short',
        "hackathon":    "Elasticsearch Vector Search (Devpost)",
        "target_score": 10.0,
        "judge_rubric": """
You are the most brutal, uncompromising senior judge for the Elasticsearch Vector Search 
Devpost hackathon. You have zero tolerance for:
- Hallucinated or fake test results
- Code that technically runs but doesn't actually use Elasticsearch kNN/vector search
- Missing dense_vector fields (this is THE core requirement)
- READMEs that claim features not proven by the test logs
- Frontend that shows data but doesn't route through ES
- Any gap between what's claimed and what's proven

Score breakdown (must sum to 10):
  elasticsearch_usage     (4.0 max) — ONLY if dense_vector + kNN actually executes
  technical_quality       (2.5 max) — Code quality, error handling, test coverage
  originality_impact      (2.0 max) — Novel problem solved in trading/finance domain
  documentation           (1.5 max) — README accuracy (deduct for unproven claims)
""",
    },
    "ledger": {
        "name":         "LedgerLive",
        "repo_path":    Path(r"C:\Aarav\ledgerlive"),
        "backend_url":  "http://127.0.0.1:8090",
        "frontend_url": "http://127.0.0.1:4174",
        "backend_cmd":  r'cd "C:\Aarav\ledgerlive\apps\api" && .venv\Scripts\python -m uvicorn app.main:app --port 8090 --reload',
        "frontend_cmd": r'cd "C:\Aarav\ledgerlive\apps\web" && npm run dev',
        "test_cmd":     r'cd "C:\Aarav\ledgerlive\apps\api" && .venv\Scripts\python -m pytest tests/ -q --tb=short',
        "hackathon":    "Airia Race Beyond the Track — Williams F1 / Atlassian",
        "target_score": 10.0,
        "judge_rubric": """
You are the most demanding judge for the Airia Williams F1 hackathon. You have zero 
tolerance for:
- Autonomous agent claims not backed by a real perceive→decide→act loop in the code
- F1 theming that is purely cosmetic (renamed buttons don't count)
- Airia platform "compatibility" that is just a mention in the README
- HITL review workflows that require constant human babysitting
- Missing evidence binder or audit trail that actually persists to disk/DB
- Any gap between README claims and what the test logs prove

Score breakdown (must sum to 10):
  agent_autonomy      (3.0 max) — Real autonomous loop proven by endpoint tests
  workflow_impact     (2.5 max) — Reconciliation, exceptions, audit actually work E2E
  f1_theme            (2.0 max) — Genuine racing operations metaphor, not just labels
  airia_platform      (1.5 max) — Real webhook/export Airia can call
  demo_quality        (1.0 max) — Working demo, README accuracy, screenshots
""",
    },
}

# ── CONFIG ───────────────────────────────────────────────────
PROJECT_KEY  = os.getenv("JUDGE_PROJECT", "apex")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "devstral")
MAX_LOOPS    = int(os.getenv("MAX_LOOPS", "10"))   # safety ceiling
LOG_DIR      = Path("judge_logs")
LOG_DIR.mkdir(exist_ok=True)

PROJECT   = PROJECTS[PROJECT_KEY]
REPO      = PROJECT["repo_path"]
COPILOT_INSTRUCTIONS = REPO / ".github" / "copilot-instructions.md"

client = OpenAI(api_key="ollama", base_url="http://localhost:11434/v1")

# ── HELPERS ──────────────────────────────────────────────────
def hdr(text, color=Fore.CYAN):
    bar = "=" * 62
    print(f"\n{color}{bar}\n  {text}\n{bar}{Style.RESET_ALL}")

def ok(m):   print(f"  {Fore.GREEN}✓ {m}{Style.RESET_ALL}")
def fail(m): print(f"  {Fore.RED}✗ {m}{Style.RESET_ALL}")
def warn(m): print(f"  {Fore.YELLOW}⚠ {m}{Style.RESET_ALL}")
def info(m): print(f"  {Fore.WHITE}{m}{Style.RESET_ALL}")

def ts():
    return datetime.now().strftime("%H:%M:%S")

# ── PHASE 1: START SERVICES ───────────────────────────────────
_service_procs = []

def start_services():
    hdr("STARTING SERVICES")
    global _service_procs

    # Kill stale processes on the ports first
    for port in [8000, 8090, 5100, 4174, 9200]:
        subprocess.run(
            ["powershell", "-Command", f"Get-NetTCPConnection -LocalPort {port} -ErrorAction SilentlyContinue | ForEach-Object {{ Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }}"],
            capture_output=True
        )
    time.sleep(2)

    p1 = subprocess.Popen(
        ["powershell", "-Command", PROJECT["backend_cmd"]],
        creationflags=subprocess.CREATE_NEW_CONSOLE
    )
    _service_procs.append(p1)
    time.sleep(8)

    p2 = subprocess.Popen(
        ["powershell", "-Command", PROJECT["frontend_cmd"]],
        creationflags=subprocess.CREATE_NEW_CONSOLE
    )
    _service_procs.append(p2)
    time.sleep(10)

    # Verify
    try:
        r = requests.get(f"{PROJECT['backend_url']}/docs", timeout=5)
        ok(f"Backend responding (docs status {r.status_code})")
    except:
        warn("Backend may still be starting")

    try:
        r = requests.get(PROJECT["frontend_url"], timeout=5)
        ok(f"Frontend responding (status {r.status_code})")
    except:
        warn("Frontend may still be building")

# ── PHASE 2: STRICT JUDGE (NO HALLUCINATION) ─────────────────
def run_strict_judge(loop_number):
    hdr(f"LOOP {loop_number} — STRICT JUDGE (Zero Hallucination Mode)", Fore.MAGENTA)
    evidence = {}

    # ── 2a. Backend health (real HTTP, not assumed) ───────────
    info(f"[{ts()}] Testing backend...")
    try:
        r = requests.get(f"{PROJECT['backend_url']}/openapi.json", timeout=5)
        spec = r.json()
        paths = list(spec.get("paths", {}).keys())
        evidence["backend_running"]   = True
        evidence["endpoint_count"]    = len(paths)
        evidence["endpoints_sample"]  = paths[:20]
    except Exception as e:
        evidence["backend_running"]   = False
        evidence["backend_error"]     = str(e)
        fail(f"Backend unreachable: {e}")

    # ── 2b. Frontend (real HTTP) ──────────────────────────────
    info(f"[{ts()}] Testing frontend...")
    for port in [5100, 4174, 4173, 5173]:
        try:
            r = requests.get(f"http://localhost:{port}", timeout=3)
            evidence["frontend_running"] = True
            evidence["frontend_port"]    = port
            ok(f"Frontend on :{port}")
            break
        except:
            pass
    else:
        evidence["frontend_running"] = False
        fail("Frontend not found on any port")

    # ── 2c. Elasticsearch (project-specific) ─────────────────
    if PROJECT_KEY == "apex":
        info(f"[{ts()}] Testing Elasticsearch...")
        try:
            r = requests.get("http://localhost:9200/_cluster/health", timeout=5)
            es = r.json()
            evidence["es_running"]         = True
            evidence["es_cluster_status"]  = es.get("status")

            # Check for vector fields — THE critical test
            r2 = requests.get("http://localhost:9200/_cat/indices?format=json", timeout=5)
            indices = [i for i in r2.json() if not i.get("index","").startswith(".")]
            evidence["es_indices"]     = [i["index"] for i in indices]
            evidence["es_doc_count"]   = sum(int(i.get("docs.count",0)) for i in indices)

            has_vector = False
            for idx in evidence["es_indices"][:5]:
                try:
                    mr = requests.get(f"http://localhost:9200/{idx}/_mapping", timeout=3)
                    if any(k in json.dumps(mr.json()) for k in ["dense_vector","knn","sparse_vector","semantic_text"]):
                        has_vector = True
                        evidence["es_vector_index"] = idx
                        ok(f"VECTOR FIELD FOUND in '{idx}'")
                except: pass
            evidence["es_has_vector"] = has_vector
            if not has_vector:
                fail("NO dense_vector fields — hackathon's #1 requirement missing")

            # Try actual kNN search
            if has_vector and evidence.get("es_vector_index"):
                try:
                    knn_q = {
                        "knn": {
                            "field":        "embedding",
                            "query_vector": [0.1] * 384,
                            "k":            5,
                            "num_candidates": 50
                        }
                    }
                    kr = requests.post(
                        f"http://localhost:9200/{evidence['es_vector_index']}/_search",
                        json=knn_q, timeout=5
                    )
                    evidence["knn_search_actually_works"] = kr.status_code == 200
                    ok(f"kNN search executed → status {kr.status_code}")
                except Exception as e:
                    evidence["knn_search_actually_works"] = False
                    evidence["knn_error"] = str(e)
        except Exception as e:
            evidence["es_running"] = False
            evidence["es_error"]   = str(e)

    # ── 2d. Run actual test suite ─────────────────────────────
    info(f"[{ts()}] Running test suite...")
    try:
        result = subprocess.run(
            ["powershell", "-Command", PROJECT["test_cmd"]],
            capture_output=True, text=True, timeout=120
        )
        output = result.stdout + result.stderr
        evidence["test_raw_output"] = output[-2000:]

        import re
        pm = re.search(r"(\d+) passed", output)
        fm = re.search(r"(\d+) failed", output)
        em = re.search(r"(\d+) error", output)
        evidence["tests_passed"]   = int(pm.group(1)) if pm else 0
        evidence["tests_failed"]   = int(fm.group(1)) if fm else 0
        evidence["tests_errors"]   = int(em.group(1)) if em else 0
        evidence["all_tests_pass"] = evidence["tests_failed"] == 0 and evidence["tests_errors"] == 0

        if evidence["all_tests_pass"] and evidence["tests_passed"] > 0:
            ok(f"pytest: {evidence['tests_passed']} passed ✓")
        else:
            fail(f"pytest: {evidence['tests_passed']} passed / {evidence['tests_failed']} failed / {evidence['tests_errors']} errors")
    except subprocess.TimeoutExpired:
        evidence["test_timeout"] = True
        warn("Tests timed out (>120s)")
    except Exception as e:
        evidence["test_error"] = str(e)

    # ── 2e. Read actual source files (anti-hallucination) ─────
    info(f"[{ts()}] Reading source files for evidence...")
    evidence["source_files"] = {}

    # Find files with key patterns
    search_patterns = {
        "apex":   ["dense_vector", "knn_search", "from elasticsearch", "import Elasticsearch"],
        "ledger": ["agent", "pipeline", "reconcil", "airia", "webhook"],
    }
    patterns = search_patterns.get(PROJECT_KEY, [])

    for pat in ["**/*.py", "**/*.ts", "**/*.tsx"]:
        for f in REPO.rglob(pat):
            if any(s in str(f) for s in ["node_modules",".venv","__pycache__",".git","judge_logs"]):
                continue
            try:
                content = f.read_text(encoding="utf-8", errors="ignore")
                for keyword in patterns:
                    if keyword.lower() in content.lower():
                        rel = str(f.relative_to(REPO))
                        if rel not in evidence["source_files"]:
                            evidence["source_files"][rel] = content[:800]
            except: pass

    ok(f"Found {len(evidence['source_files'])} relevant source files")

    # ── 2f. README accuracy check ─────────────────────────────
    readme = REPO / "README.md"
    if readme.exists():
        evidence["readme"] = readme.read_text(encoding="utf-8", errors="ignore")[:3000]

    # ── 2g. Score with LLM (strict mode) ─────────────────────
    info(f"[{ts()}] Sending to LLM judge (strict mode)...")
    score_data = call_llm_judge(evidence, loop_number)

    # Save evidence + score to log
    log_file = LOG_DIR / f"loop_{loop_number:02d}_{ts().replace(':','-')}.json"
    with open(log_file, "w") as f:
        json.dump({"evidence": {k: v for k, v in evidence.items() if k != "source_files"},
                   "score": score_data}, f, indent=2)
    ok(f"Evidence + score logged to {log_file}")

    return evidence, score_data

# ── PHASE 3: LLM JUDGE CALL ───────────────────────────────────
def call_llm_judge(evidence, loop_number):
    prompt = f"""
{PROJECT['judge_rubric']}

== HACKATHON: {PROJECT['hackathon']} ==
== PROJECT: {PROJECT['name']} ==
== LOOP: {loop_number} ==

== HARD EVIDENCE (automated tests — NOT self-reported) ==
Backend running: {evidence.get('backend_running')}
Endpoint count: {evidence.get('endpoint_count', 0)}
Frontend running: {evidence.get('frontend_running')} on port {evidence.get('frontend_port')}
Tests passed: {evidence.get('tests_passed', 0)}
Tests failed: {evidence.get('tests_failed', 0)}
All tests pass: {evidence.get('all_tests_pass', False)}
Test output (last 1000 chars):
{evidence.get('test_raw_output', 'No test output')[-1000:]}

{f"""
=== ELASTICSEARCH EVIDENCE ===
ES running: {evidence.get('es_running')}
Cluster status: {evidence.get('es_cluster_status')}
Indices: {evidence.get('es_indices', [])}
Doc count: {evidence.get('es_doc_count', 0)}
Has dense_vector fields: {evidence.get('es_has_vector')} ← THE key requirement
kNN search actually executed: {evidence.get('knn_search_actually_works')}
kNN error (if any): {evidence.get('knn_error', 'none')}
""" if PROJECT_KEY == "apex" else ""}

== RELEVANT SOURCE CODE (files matching key patterns) ==
{chr(10).join(f"--- {k} ---{chr(10)}{v[:400]}" for k, v in list(evidence.get('source_files', {}).items())[:5])}

== README (first 2000 chars) ==
{evidence.get('readme', 'Not found')[:2000]}

== YOUR TASK ==
You are the STRICTEST possible judge. 
- A score above 7 requires ALL critical requirements proven by test logs, not claims.
- A score of 10 requires zero gaps, all features proven, zero hallucination in docs.
- Be specific. Name exact files, endpoints, and line-level changes needed.
- NEVER give credit for something not proven by the evidence above.

Respond ONLY with valid JSON (no markdown, no explanation outside JSON):
{{
  "score": 6.5,
  "score_breakdown": {{
    "category_1_name": 3.5,
    "category_2_name": 1.5,
    "category_3_name": 1.0,
    "category_4_name": 0.5
  }},
  "proven_working": [
    "Specific thing proven by test evidence, not claimed"
  ],
  "blocking_issues": [
    {{
      "issue": "Exact description of what is missing or broken",
      "evidence": "Which test or log shows this is broken",
      "fix": "Exact file + function + change needed to fix this",
      "priority": "CRITICAL|HIGH|MEDIUM"
    }}
  ],
  "copilot_task": "A single, precise, self-contained task description for Copilot Agent Mode to implement. Include: which files to edit, what functions to add/modify, what the expected test result should be after the change. Be specific enough that Copilot can implement it without asking questions.",
  "reached_ten": false
}}
"""

    try:
        resp = client.chat.completions.create(
            model=OLLAMA_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.05,   # very low — we want consistent, strict judgments
            max_tokens=2500
        )
        raw = resp.choices[0].message.content.strip()

        # Strip markdown fences
        if "```" in raw:
            for part in raw.split("```"):
                part = part.strip().lstrip("json").strip()
                try:
                    return json.loads(part)
                except: pass
        return json.loads(raw)

    except json.JSONDecodeError as e:
        fail(f"LLM returned invalid JSON: {e}")
        return {"score": 0.0, "reached_ten": False,
                "copilot_task": "Fix all critical issues", "blocking_issues": []}
    except Exception as e:
        fail(f"Ollama error: {e}")
        return None

# ── PHASE 4: WRITE COPILOT INSTRUCTIONS ──────────────────────
def write_copilot_instructions(score_data, loop_number):
    """
    Write a precision-engineered prompt into .github/copilot-instructions.md
    This is what Copilot Agent Mode reads as its system context.
    We ALSO write a task file that the agent loop picks up.
    """
    hdr(f"LOOP {loop_number} — WRITING COPILOT TASK", Fore.BLUE)

    if not score_data:
        fail("No score data — skipping Copilot instructions")
        return False

    task      = score_data.get("copilot_task", "")
    issues    = score_data.get("blocking_issues", [])
    score     = score_data.get("score", 0)
    breakdown = score_data.get("score_breakdown", {})

    # Build a rich, engineered prompt for Copilot Agent Mode
    blocking_text = "\n".join(
        f"- [{b.get('priority','HIGH')}] {b.get('issue','')} — Fix: {b.get('fix','')}"
        for b in issues
    )

    instructions = f"""# Copilot Agent Instructions — Auto-Generated by Judge Loop
## Loop: {loop_number} | Score: {score}/10 | Project: {PROJECT['name']}
## Hackathon: {PROJECT['hackathon']}
## Generated: {datetime.now().isoformat()}

---

## YOUR SINGLE TASK FOR THIS LOOP

{task}

---

## BLOCKING ISSUES (fix these in priority order)

{blocking_text if blocking_text else "None identified yet."}

---

## CURRENT SCORE BREAKDOWN

{chr(10).join(f'- {k}: {v}' for k, v in breakdown.items())}

---

## STRICT CONSTRAINTS — DO NOT VIOLATE

1. Every change must be provably testable — add or modify a test that proves the change works.
2. Do not add claims to README.md that aren't proven by existing tests.
3. Do not mock or stub the feature you're implementing — it must actually work.
4. After implementing, run the test suite and confirm it passes.
5. Use @workspace context to understand the full codebase before making changes.
6. Commit all changes with a descriptive message referencing the loop number: "judge-loop-{loop_number}: <description>"

---

## PROJECT CONTEXT

- Backend: {PROJECT['backend_url']} (FastAPI)
- Frontend: {PROJECT['frontend_url']} (React/Vite)  
- Repo: {REPO}
- Run tests with: {PROJECT['test_cmd']}

---

## HOW TO VERIFY YOUR WORK

After implementing the task:
1. Run the test suite — all tests must pass
2. Manually test the specific endpoint or feature you added
3. Confirm the change addresses the blocking issue listed above
4. The judge loop will re-evaluate automatically
"""

    # Ensure .github dir exists
    github_dir = REPO / ".github"
    github_dir.mkdir(exist_ok=True)

    with open(COPILOT_INSTRUCTIONS, "w", encoding="utf-8") as f:
        f.write(instructions)

    ok(f"Copilot instructions written to {COPILOT_INSTRUCTIONS}")

    # ALSO write a standalone task file that's easier to paste
    task_file = REPO / f"judge_task_loop_{loop_number:02d}.md"
    with open(task_file, "w", encoding="utf-8") as f:
        f.write(f"# Judge Task — Loop {loop_number}\n\n## Score: {score}/10\n\n## Task\n\n{task}\n\n## Blocking Issues\n\n{blocking_text}\n")

    ok(f"Standalone task written to {task_file}")
    return True

# ── PHASE 5: TRIGGER COPILOT AGENT ───────────────────────────
def trigger_copilot_agent(score_data, loop_number):
    """
    Three strategies to trigger Copilot Agent Mode programmatically:
    
    Strategy A (BEST): GitHub Copilot CLI SDK — direct Python call
    Strategy B: VS Code CLI with --command flag
    Strategy C: Clipboard + pyautogui to paste into open VS Code window
    
    We try A first, fall back to B, then C.
    """
    hdr(f"LOOP {loop_number} — TRIGGERING COPILOT AGENT", Fore.BLUE)

    task = score_data.get("copilot_task", "Fix blocking issues per copilot-instructions.md")

    # ── Strategy A: GitHub Copilot CLI (real programmatic path) ──
    # The Copilot CLI exposes an API that the VS Code extension also uses
    copilot_cli = shutil.which("gh-copilot") or shutil.which("copilot")

    if copilot_cli:
        full_prompt = f"""@workspace #codebase

You are operating as an autonomous coding agent for {PROJECT['name']}.
Your instructions are in .github/copilot-instructions.md — read them first.

TASK FOR LOOP {loop_number}:
{task}

After completing the task:
1. Run tests to verify
2. Commit with message: "judge-loop-{loop_number}: <what you did>"
3. Do not ask for confirmation — implement completely and autonomously."""

        try:
            result = subprocess.run(
                [copilot_cli, "suggest", "-t", "shell", full_prompt],
                cwd=str(REPO),
                capture_output=True, text=True, timeout=300
            )
            if result.returncode == 0:
                ok("Copilot CLI triggered successfully")
                return "cli"
        except Exception as e:
            warn(f"Copilot CLI strategy failed: {e}")

    # ── Strategy B: VS Code --command (send to open VS Code) ──
    vscode = shutil.which("code") or shutil.which("code-insiders")
    if vscode:
        try:
            # Open the project folder in VS Code and trigger agent chat
            subprocess.Popen([
                vscode, str(REPO),
                "--goto", str(COPILOT_INSTRUCTIONS)
            ])
            time.sleep(3)
            ok("VS Code opened with instructions file")
            # Fall through to Strategy C to actually inject the prompt
        except Exception as e:
            warn(f"VS Code open failed: {e}")

    # ── Strategy C: Clipboard injection + keyboard automation ──
    # This actually works reliably since VS Code is the active window
    try:
        import pyautogui
        import pyperclip

        full_prompt = f"""@workspace

Read .github/copilot-instructions.md first, then implement the task for judge loop {loop_number}.

Current score: {score_data.get('score', 0)}/10
Task: {task[:500]}

Implement completely and autonomously. Run tests after. Commit your changes."""

        pyperclip.copy(full_prompt)
        time.sleep(1)

        # Open Copilot Chat in VS Code (Ctrl+Alt+I)
        pyautogui.hotkey("ctrl", "alt", "i")
        time.sleep(2)

        # Switch to Agent mode (Ctrl+Shift+I)
        pyautogui.hotkey("ctrl", "shift", "i")
        time.sleep(1)

        # Paste the prompt
        pyautogui.hotkey("ctrl", "v")
        time.sleep(0.5)

        # Send it
        pyautogui.press("enter")
        time.sleep(1)

        ok("Prompt injected into Copilot Agent via keyboard automation")
        warn("VS Code must be the active/foreground window for this to work")
        return "pyautogui"

    except ImportError:
        warn("pyautogui not installed — falling back to manual mode")
    except Exception as e:
        warn(f"Keyboard injection failed: {e}")

    # ── Fallback: Print the task for manual paste ──────────────
    warn("MANUAL MODE: Copilot could not be triggered automatically.")
    warn("Please open VS Code Copilot Chat (Ctrl+Alt+I), switch to Agent mode,")
    warn(f"and paste the contents of: {COPILOT_INSTRUCTIONS}")
    input("  Press ENTER when you've submitted the task to Copilot Agent...")
    return "manual"

# ── PHASE 6: WAIT FOR COPILOT TO FINISH ──────────────────────
def wait_for_copilot(loop_number, trigger_method):
    """
    Wait for Copilot Agent to finish working.
    Detects completion by watching for git commits or file changes.
    """
    hdr(f"LOOP {loop_number} — WAITING FOR COPILOT", Fore.YELLOW)

    if trigger_method == "manual":
        input(f"  Press ENTER when Copilot has finished implementing the changes...")
        return

    warn("Waiting for Copilot Agent to finish (watching for git activity)...")
    warn("Copilot Agent Mode is autonomous — it will run tests and commit itself")

    last_commit = _get_last_commit()
    wait_seconds = 0
    max_wait = 600  # 10 minutes max

    while wait_seconds < max_wait:
        time.sleep(10)
        wait_seconds += 10
        current_commit = _get_last_commit()

        if current_commit != last_commit:
            ok(f"New commit detected: {current_commit}")
            ok(f"Copilot finished in ~{wait_seconds}s")
            return

        # Also check for the judge task file being deleted (custom signal)
        task_file = REPO / f"judge_task_loop_{loop_number:02d}.md"
        if not task_file.exists():
            ok("Task file removed — Copilot signaled completion")
            return

        if wait_seconds % 60 == 0:
            info(f"Still waiting... ({wait_seconds}s elapsed)")

    warn(f"Copilot did not commit within {max_wait}s")
    warn("Continuing anyway — will re-evaluate current state")

def _get_last_commit():
    try:
        r = subprocess.run(
            ["git", "log", "--oneline", "-1"],
            cwd=str(REPO), capture_output=True, text=True
        )
        return r.stdout.strip()
    except:
        return ""

# ── PHASE 7: PRINT LOOP SUMMARY ──────────────────────────────
def print_loop_summary(loop_number, score_data, history):
    score = score_data.get("score", 0) if score_data else 0
    color = Fore.GREEN if score >= 9 else (Fore.YELLOW if score >= 7 else Fore.RED)

    hdr(f"LOOP {loop_number} SUMMARY", color)
    print(f"\n  {color}Score: {score}/10{Style.RESET_ALL}")

    # Score history trend
    if len(history) > 1:
        trend = " → ".join(f"{s:.1f}" for s in history)
        print(f"  Progress: {trend}")

    if score_data:
        bd = score_data.get("score_breakdown", {})
        print(f"\n  Breakdown:")
        for k, v in bd.items():
            bar = "█" * int(v * 2)
            print(f"    {k:<28} {v:.1f}  {bar}")

        proven = score_data.get("proven_working", [])
        if proven:
            print(f"\n  {Fore.GREEN}Proven working:{Style.RESET_ALL}")
            for p in proven[:3]:
                print(f"    ✓ {p}")

        blocking = score_data.get("blocking_issues", [])
        critical = [b for b in blocking if b.get("priority") == "CRITICAL"]
        if critical:
            print(f"\n  {Fore.RED}Still blocking (CRITICAL):{Style.RESET_ALL}")
            for b in critical[:3]:
                print(f"    ✗ {b.get('issue','')}")

    print()

# ── MAIN LOOP ─────────────────────────────────────────────────
def main():
    hdr(f"JUDGE + COPILOT REFINEMENT LOOP", Fore.GREEN)
    print(f"  Project  : {PROJECT['name']}")
    print(f"  Hackathon: {PROJECT['hackathon']}")
    print(f"  Repo     : {REPO}")
    print(f"  Model    : {OLLAMA_MODEL}")
    print(f"  Target   : {PROJECT['target_score']}/10")
    print(f"  Max loops: {MAX_LOOPS}")
    print(f"\n  {Fore.YELLOW}LOOP WILL RUN UNTIL SCORE = {PROJECT['target_score']} OR {MAX_LOOPS} LOOPS{Style.RESET_ALL}")
    print()

    if not REPO.exists():
        fail(f"Repo not found: {REPO}")
        sys.exit(1)

    score_history = []

    try:
        # Start services once (they persist across loops)
        start_services()

        for loop_num in range(1, MAX_LOOPS + 1):
            hdr(f"═══════════ LOOP {loop_num}/{MAX_LOOPS} ═══════════", Fore.WHITE)

            # JUDGE
            evidence, score_data = run_strict_judge(loop_num)

            if not score_data:
                fail("Judge returned no data — check Ollama is running")
                break

            current_score = score_data.get("score", 0)
            score_history.append(current_score)

            print_loop_summary(loop_num, score_data, score_history)

            # CHECK IF DONE
            if score_data.get("reached_ten") or current_score >= PROJECT["target_score"]:
                hdr("🏆 TARGET SCORE REACHED!", Fore.GREEN)
                print(f"\n  Final score: {current_score}/10")
                print(f"  Loops taken: {loop_num}")
                print(f"  Score progression: {' → '.join(str(s) for s in score_history)}")
                print(f"\n  Your project is ready to submit to: {PROJECT['hackathon']}")
                break

            # WRITE COPILOT INSTRUCTIONS
            wrote = write_copilot_instructions(score_data, loop_num)
            if not wrote:
                warn("Could not write Copilot instructions — skipping to next loop")
                continue

            # TRIGGER COPILOT
            trigger_method = trigger_copilot_agent(score_data, loop_num)

            # WAIT FOR COPILOT
            wait_for_copilot(loop_num, trigger_method)

            # Brief pause before re-judging
            info(f"Waiting 5s before re-evaluation...")
            time.sleep(5)

        else:
            warn(f"Reached maximum loops ({MAX_LOOPS}) without achieving {PROJECT['target_score']}/10")
            warn(f"Final score: {score_history[-1] if score_history else 'unknown'}/10")
            warn(f"Review judge_logs/ for detailed per-loop evidence")

    except KeyboardInterrupt:
        print(f"\n{Fore.YELLOW}  Loop interrupted by user{Style.RESET_ALL}")
    finally:
        # Cleanup service processes
        for p in _service_procs:
            try: p.terminate()
            except: pass
        ok("Services terminated")

        # Final summary
        if score_history:
            print(f"\n  Score history: {' → '.join(f'{s:.1f}' for s in score_history)}")
            print(f"  Logs saved in: {LOG_DIR.absolute()}")

if __name__ == "__main__":
    main()
