Objective: Create a baseline snapshot + migration map so the refactor is guided, not guesswork.

Work to do

Create docs/migration/W81_baseline_audit.md:

exact backend entrypoint(s), frontend entrypoint(s)

API prefixes you currently expose

WebSocket endpoint(s) and channels (if any)

Elasticsearch endpoints and index naming conventions

the exact “gold” commands you run today for tsc/vitest/pytest/playwright

top 25 pain points you want gone

Generate docs/migration/W81_tree_before.txt using a deterministic script:

exclude: node_modules, __pycache__, .venv, .pytest_cache, test-results, playwright-report, logs, artifacts/proof

stable sort so two runs match

Add scripts:

scripts/tree_snapshot.sh

scripts/tree_snapshot.ps1

Generate docs/migration/W81_dep_audit.json:

Python: imported packages from runtime modules (not tests)

TS: imported packages from UI2 runtime modules (not tests)

list “installed but not imported”

Create docs/migration/W81_move_map.yaml mapping OLD → NEW paths:

include at least phase1/services/waves11_20/*, phase1/services/waves21_50/*, and UI2 paths (your tree has both). 

tree

 

tree

Create docs/migration/W81_api_inventory.md b

tree

o

tree

+ tags

Tests to add/upgrade (Playwright MCP-first)

Playwright: frontend/tests/e2e/hardening/w81-baseline-health.spec.ts

load UI2 shell

navigate to Ops/Health

assert all cards show data-ready="true"

Pytest: backend/tests/integration/test_w81_health_contract.py

GET /api/v3/ops/health returns stable schema + correlation_id

Repo gate script: scripts/assert_no_tracked_bloat.(sh|ps1)

fail if git tracks node_modules/, test-results/, playwright-report/, logs/

Acceptance (binary)

Running scripts/tree_snapshot.* twice produces identical output

Baseline MCP headed Playwright run passes against build+preview

Repo gate script passes

Proof artifacts

docs/migration/W81_* committed

proof pack includes the tree snapshot + dep audit + health test logs

Wave 082 — Canonical monorepo layout (backend/ + frontend/ + infrastructure/)

Objective: Clean tree with explicit backend/frontend/infra while keeping commands working.

Work to do

Create top-level folders:

backend/

frontend/

infrastructure/

Move frontend app into frontend/:

src/, public/, Vite config, Playwright config, frontend tests

Move backend runtime into backend/:

keep a temporary compatibility shim if needed, but write it down in the migration doc

Add infrastructure/docker-compose.yml:

Postgres

Elasticsearch

Kibana (optional but useful for demos)

Add root Makefile + scripts/dev.ps1:

make up / make down

make api / make web

make test (tsc+vitest+pytest)

make e2e (Playwright MCP headed)

make proof

Tests

Playwright: w82-smoke.spec.ts (UI2 loads, routes work, backend reachable on 8090)

Pytest: test_w82_import_sanity.py (routers import cleanly from new paths)

Acceptance

All existing gates still pass from repo root

No duplicated entrypoints

Proof

W82_tree_after.txt

Makefile logs in proof pack

Wave 083 — Stale artifact purge + retention policy

Objective: Delete stale outputs and prevent reintroduction.

Work to do

Add docs/RETENTION.md:

what is allowed in-repo vs must stay local

proof packs: stored in artifacts/proof/ and never committed

Update .gitignore to include:

**/node_modules/

**/__pycache__/

**/.pytest_cache/

test-results/

playwright-report/

logs/

artifacts/proof/

Add scripts/clean_workspace.(sh|ps1):

deletes local bloat safely

must never touch keys.env

Untrack/delete any committed artifacts in the working tree

Tests

Pytest: test_repo_sanity_no_tracked_artifacts.py (fails if forbidden dirs tracked)

Playwright: w83-proofpack-location.spec.ts (ensures proof packs land only under artifacts/proof/)

Acceptance

Repo has no tracked artifacts and the sanity test enforces it

Proof

retention doc + sanity output in proof pack

Wave 084 — Single config loader + fail-fast startup checks (no demo fallback)

Objective: Central config, no fake values, fail fast if deps/keys missing.

Work to do

Create backend/core/config.py (pydantic settings)

Create backend/core/startup_checks.py:

Postgres reachable

ES reachable

required indices exist (or template install + alias creation happens deterministically)

WS subsystem ready

Expose GET /api/v3/ops/health:

dependency statuses

correlation_id

last successful check timestamps

Remove demo/mock fallbacks across backend config paths

Tests

Pytest: test_startup_failfast_errors.py (missing env -> explicit errors)

Playwright: w84-ops-health.spec.ts (Ops shows all green when configured)

Acceptance

Backend refuses to run core flows without required deps

Ops health is truthful

Proof

Startup logs captured in proof pack (both a failing boot and a successful boot)

Wave 085 — Domain isolation firewall (import boundary tests)

Objective: Stop cross-import coupling by enforcing domains + contracts.

Work to do

Create backend/domains/:

search/

backtesting/

workflows/

agents/

broker/

audit/

Create backend/core/contracts/ for shared DTOs/interfaces

Start migrating code out of the parallel “wave module” layout (your tree shows phase1/services/waves11_20 and waves21_50). 

tree

Delete shims as you finish each domain (no permanent “compat forever” 

tree

test: test_architecture_import_boundaries.py scans imports and fails cross-domain imports

Playwright: w85-nav-regression.spec.ts ensures UI2 routes still work after migrations

Acceptance

Import boundary test passes

At least 2 domains fully migrated with no shims remaining

Proof

import scan report included in proof pack

Wave 086 — Event bus + immutable audit events indexed in ES

Objective: Every state change emits an event (auditable + searchable).

Work to do

Implement backend/core/event_bus.py:

correlation_id propagation

publish API

persistence hook

Create backend/domains/audit/models.py:

immutable events table

Create backend/domains/audit/routes.py:

/api/v3/events

/api/v3/events/search

Ensure these flows emit events:

strategy create/update

backtest run start/end

workflow run start/end

agent run start/end + tool calls

broker sync ticks

Index events into ES apex-events-* (versioned mapping)

Tests

Pytest: run a backtest -> assert event chain exists and indexed

Playwright: open Events timeline -> search by correlation_id -> open detail drawer

Acceptance

Events persist + index + render in UI2

Search returns events with stable ordering

Proof

screenshots: timeline + search result

logs: ES ingest + DB insert

Wave 087 — WebSocket reliability v1 (heartbeat + typed channels)

Objective: Real-time layer stays connected; disconnects are measurable.

Work to do

Implement WS server (FastAPI WS) with:

heartbeat ping/pong

typed channel subscriptions: events, jobs, prices, broker

server-side disconnect counter

Add /api/v3/ops/ws/health:

active clients

last heartbeat age

disconnect_count

UI2 Shell:

global WS indicator (green/yellow/red)

per-page channel badges

Tests

Playwright: WS indicator must stay green across a long multi-page flow

Pytest: connect/subscribe, receive heartbeat, receive an event broadcast

Acceptance

disconnect_count stays 0 during normal E2E

if WS drops, UI surfaces incident and auto-reconnects deterministically

Proof

WS health snapshots at start/end of Playwright run

Wave 088 — Ops workspace v1 (deps + ES + WS + broker + jobs)

Objective: Environment visibility inside UI2.

Work to do

Create UI2 OpsUI2 page with cards:

Postgres

Elasticsearch (cluster + templates + aliases + doc counts)

WS

Broker

Jobs

Lag/DLQ (once those exist)

Every card must have:

data-testid

data-ready gating (no hardcoded true)

copy correlation_id button

Tests

Playwright: Ops loads and every card shows ready + green

Pytest: ops endpoints stable schema + redaction (no secrets ever)

Acceptance

Ops is truthful and ready-gated

Proof

screenshots of Ops page + logs

Wave 089 — Command palette + deep link contract

Objective: Search-first navigation that is demo-friendly and fast.

Work to do

Add Ctrl/Cmd+K command palette

Implement deep-link contract for:

strategies

backtests

runs

jobs

events

tickets

agent runs

Tables support row highlight via query params (and clear it)

Tests

Playwright: palette -> open result -> highlight present -> browser back restores palette state

Acceptance

Deep links work across core entities

No forbidden selectors in tests (data-testid only)

Proof

short demo clip checkpoint in proof pack

Wave 090 — Repo sanity gates (testids + forbidden patterns)

Objective: Prevent regression into untestable UI and fragile E2E.

Work to do

Add script that fails build if:

interactive elements missing data-testid

Playwright tests contain getByText, getByRole, or raw text selectors

any test contains waitForTimeout

Add docs/CONTRIBUTING.md:

per-wave requires new Playwright coverage + proof artifacts

Tests

The scanners run as part of make test and fail loudly

Acceptance

Missing testid and forbidden patterns are blocked automatically

Proof

scanner outputs in proof pack

Waves 091–110 (Hackathon core: Elastic + Agent Builder + Convergence UX)
Wave 091 — Elasticsearch templates + aliases v4 (versioned)

Objective: Deterministic mappings with safe reindex and alias swaps.

Work to do

Implement ES templates for:

events, strategies, backtests, workflows, jobs, tickets, edges

Enforce alias convention:

apex-<type>-write, apex-<type>-read

Implement reindex:

plan -> execute -> verify -> alias swap

emit audit events for every step

Ops UI shows template + alias health

Tests

Pytest: templates installed and alias swap works

Playwright: ES Ops card shows templates, aliases, doc counts

Acceptance

Reindex + alias swap proven by tests

Proof

reindex logs + screenshots

Wave 092 — Bulk ingest + DLQ + lag metrics

Objective: No silent ES failures: DLQ + lag telemetry.

Work to do

Bulk ingest pipeline:

batching

retry/backoff

DLQ persistence in Postgres

Lag metrics:

canonical DB count vs ES count per type

DLQ drain endpoint + Ops UI action

Tests

Pytest: induce ES failure -> DLQ grows; recover -> drain; lag drops

Playwright: drain from Ops and see counts update

Acceptance

DLQ exists and is exercised

lag metrics are truthful

Wave 093 — Evidence graph v1 (nodes+edges)

Objective: Traceability layer indexed in ES and rendered in UI.

Work to do

Persist edges in Postgres and index into ES

Graph API: /api/v3/evidence/graph?root_type=&root_id=

UI2: Evidence Graph view on:

backtest run detail

strategy detail

ticket detail

agent run detail

Tests

Pytest: a backtest run creates expected edges

Playwright: open graph and assert nodes/edges > 0

Acceptance

Graph is non-empty for a real run and navigable

Wave 094 — Agent tools v1 (strict tools + audit trail)

Objective: Agents act only through explicit tools; every tool call logged and searchable.

Work to do

Tools:

search (ES)

fetch_entity

fetch_graph

summarize

create_ticket (safe action)

Persist agent runs + tool traces + citations (with correlation_id)

Index agent runs into ES

UI2: tool trace viewer + citations list with deep links

Tests

Pytest: tool traces persisted and secrets redacted

Playwright: run agent query -> open a citation -> see evidence graph

Acceptance

Agent runs are grounded and auditable

Wave 095 — Elastic Agent Builder integration (ElastiHack-critical)

Objective: Elastic Agent Builder drives real runs.

Work to do

Adapter to Elastic Agent Builder (server-side only, env-gated)

UI2 “Agent Builder” page:

create agent

run agent

view trace + citations + tool usage

Tests

Pytest: refuses without keys, validates schemas

Playwright: agent run end-to-end, citations open entity drawers

Acceptance

Agent Builder is central to the demo flow, not a side integration

Wave 096 — Search UX v3 (facets + saved searches + explain drawer)

Objective: Search becomes the primary experience.

Work to do

Facets: type, time, severity, symbol, run_id

Saved searches persisted per user

Explain drawer: query, filters, sort, matched fields (no secrets)

Deep link + highlight on destination pages

Tests

Playwright: facet -> save -> pin -> rerun -> stable ordering; open explain; deep link highlight

Pytest: stable sort contract tests

Wave 097 — Backtesting correctness contract + golden runs

Objective: Backtesting credibility: invariants + golden runs.

Work to do

Define invariants:

no lookahead

equity = cash + positions value

trades obey fill rules and cost model

Create 3 golden runs with frozen expected outputs (metrics + trade count)

Refuse runs on incomplete/invalid data, with clear error messages

Index run artifacts into ES and connect edges

Tests

Pytest: golden runs match expected outputs within strict tolerances

Playwright: run golden from UI and verify displayed metrics match

Wave 098 — Walk-forward + robustness v3

Objective: Anti-overfit evaluation by default.

Work to do

Walk-forward folds with purged gaps

Robustness matrix:

slippage multipliers

spread widening

execution delay

liquidity caps

Sensitivity heatmaps

Index fold artifacts + robustness deltas into ES

UI2 tabs for folds and robustness

Tests

Pytest fold determinism

Playwright run and view folds + robustness tables

Wave 099 — Strategy Studio v3

Objective: Template -> validate -> backtest -> archive workflow.

Work to do

StrategySpec schema + lint rules

UI editor with inline validation

Template gallery

Version history

Link strategy to runs and evidence graph

Searchable strategies with deep links

Tests

Playwright: lifecycle end-to-end (create, validate, backtest, search, open)

Pytest: schema/lint tests

Wave 100 — Job Queue v2 + WS progress

Objective: Queued/cancellable jobs with streamed progress.

Work to do

Job state machine: queued, running, succeeded, failed, canceled

WS channel jobs streams progress updates

UI2 job queue page + job detail drawer

Index jobs into ES

Tests

Playwright: submit job -> observe progress -> cancel -> verify state changes

Pytest: state machine invariants + idempotent cancel

Wave 101 — Convergence cockpit v1 (TerraCode wow screen)

Objective: Single cockpit: search + evidence graph + agent trace + safe action.

Work to do

3-pane layout:

left: search + saved searches

center: evidence graph

right: agent trace + citations + “create ticket”

Scenario presets that run real queries

Everything testid-instrumented and ready-gated

Tests

Playwright: run scenario -> panes populate -> create ticket -> ticket searchable

Wave 102 — Agent eval harness

Objective: Repeatable scoring of agent output and citation correctness.

Work to do

Small curated eval dataset stored in repo:

prompt

expected evidence IDs

Eval runner:

produces scores

stores results

indexes results into ES

UI2 eval page shows trends

Tests

Pytest determinism of eval results

Playwright: run eval and inspect a case

Wave 103 — UI2 standardization (PageShell + DataTable)

Objective: Fix the “hacked together” feel.

Work to do

Create PageShellUI2

Create DataTableUI2:

toolbar (search/filter/export)

virtualization for large lists

Migrate core pages: Search, Backtest, Strategy, Jobs, Agents, Ops, Auditor

Enforce loading/empty/error/ready states

Tests

Playwright: each core page transitions loading -> ready and has one key action

Wave 104 — Accessibility (headed Playwright + axe)

Objective: Win UX points and reduce obvious polish gaps.

Work to do

Add focus management (drawers/modals)

Add ARIA labels

Add skip links

Add visible focus ring

Integrate axe audit into headed Playwright run

Tests

Playwright: axe audit fails on critical/serious issues

Wave 105 — Performance budgets + CWV checks

Objective: Make it feel fast and measurable.

Work to do

Bundle size budget gate

Playwright performance sampling (store results in proof pack)

Reduce unnecessary re-renders and expensive tables

Tests

Playwright perf spec (fail if budgets exceeded)

Wave 106 — Accounting/controls alignment into ES + evidence graph

Objective: Unify the controls/audit track with ES and the evidence graph.

Work to do

Move AP/AR, reconciliation, controls into the domain layout

Index them into ES + edges

Auditor portal is ES-first, not DB-only

Tests

Playwright: auditor searches control -> opens evidence -> sees linked events/edges

Pytest: mapping + edge creation

Wave 107 — Safe actions (tickets)

Objective: Agents take reliable action safely and audibly.

Work to do

Ticket schema

RBAC gate

Audit events for creation/updates

Index tickets into ES and connect edges

Tests

Playwright: agent creates ticket -> ticket searchable -> audit trail visible

Pytest: idempotency

Wave 108 — Export bundles (reproducible)

Objective: One-click judge bundle and recovery artifacts.

Work to do

Export zip includes:

manifest with hashes

ES templates

selected DB tables

“how to reproduce” README

Ops UI triggers export

Tests

Pytest manifest determinism

Playwright export flow

Wave 109 — Docker compose + judge mode

Objective: Judges can run it without debugging.

Work to do

Compose: Postgres + ES + Kibana + backend + frontend preview

docs/RUN_LOCAL.md: exactly 3 commands to run

scripts/bootstrap_keys_example.* creates keys.env template

Tests

Playwright smoke run against compose startup

Wave 110 — Submission kit v1 (dual hackathon)

Objective: Submission assets are real and repeatable.

Work to do

Add OSI license file (required for ElastiHack)

Add docs/submission/TERRACODE.md:

problem, solution, stack, how AI used, demo script (2–3 min)

Add docs/submission/ELASTIHACK.md:

how ES + Agent Builder used, tool trace, citations, safe action, demo script (~3 min)

Add architecture diagram image in repo

Add docs/submission/CHECKLIST.md

Tests

Playwright “tour” specs exist for both demos

Waves 111–130 (extreme Playwright MCP strictness, reliability, and final proof)
Wave 111 — MCP-only enforcement gate

Objective: Block any non-MCP, headless, or misconfigured E2E run.

Work

Add config assertions:

headed only

workers=1

retries=0

video/trace/screenshot on

Add test file scanner:

fail if getByText, getByRole, or any role/text selector is used

fail if waitForTimeout appears anywhere

Tests

A self-test Playwright spec that fails if config isn’t compliant

Acceptance

Non-compliant runs cannot happen

Wave 112 — Persistent window for entire suite

Objective: One browser context + one page reused for the whole run.

Work

Refactor E2E harness:

beforeAll boots app once

tests reuse the same page

per-test reset is server-side (new reset endpoints), not by closing the window

Tests

Playwright asserts only one context/page exists

Wave 113 — Suite-level WS stability monitor

Objective: Fail the run if WS disconnects at any point in normal suite.

Work

Add suite monitor that polls /api/v3/ops/ws/health

Add UI WS indicator assertion that it never turns red

Tests

ws-stability.spec.ts runs alongside suite and fails on disconnect_count increment

Wave 114 — Suite-level ES health + lag monitor

Objective: Fail if ES health degrades or lag breaches SLO.

Work

Define SLO thresholds in docs/ops/SLO.md

Poll /api/v3/ops/elastic/health + /api/v3/elasticsearch/lag

Tests

es-stability.spec.ts fails if thresholds violated

Wave 115 — Suite-level broker sync monitor

Objective: Fail if broker sync becomes stale.

Work

Define broker staleness SLO

Poll /api/v3/ops/broker/health and assert sync advances during suite

Tests

broker-stability.spec.ts

Wave 116 — Expand E2E to 200+ high-signal tests

Objective: Coverage that proves correctness, not click-through.

Work

Add tests that verify backend state via API after UI actions:

create strategy -> verify stored + indexed

run backtest -> verify events + edges + ES docs

run agent -> verify tool trace + citations

create ticket -> verify audit trail

No fluff tests

Acceptance

=200 Playwright tests, all passing, zero skipped

Wave 117 — Visual stability without loosening thresholds

Objective: Fix nondeterminism rather than tolerating it.

Work

Remove volatile timestamps from UI or render them deterministically in E2E mode

Disable non-essential animations in E2E mode (deterministic flag)

Tests

Visual regression suite passes without increasing tolerances

Wave 118 — Zero-flake repeat-run harness (3x)

Objective: If it flakes once, it’s broken.

Work

Script runs key suites 3 times and diffs results

Store summaries in proof pack

Acceptance

Identical results across 3 runs

Wave 119 — Full determinism proof (full suite twice)

Objective: Prove run1 == run2 for the full E2E suite.

Work

Generate:

determinism-run1.json

determinism-run2.json

determinism-diff.txt must be empty

Wave 120 — Onboarding + guided tour mode

Objective: Better “user environment” on first run.

Work

“Getting Started” wizard:

checks Postgres/ES/WS/Broker health

shows missing env vars clearly

links to RUN_LOCAL

“Guided tour mode” with checklisted steps for recording demo videos

Wave 121 — Runbooks + troubleshooting + judge mode

Objective: Docs become an advantage.

Work

docs/ops/TROUBLESHOOTING.md

docs/ops/RESET.md

docs/ops/JUDGE_MODE.md

Wave 122 — Secrets and redaction hardening

Objective: No accidental key leaks.

Work

Log redaction for known patterns

Secret scan script that fails CI if secrets are detected in repo

Wave 123 — Submission compliance checks

Objective: Ensure Devpost requirements are satisfied automatically.

Work

Script validates:

OSI license present (ElastiHack)

demo scripts present

architecture diagram present

README has run steps

video requirements met (TerraCode 2–3 min, ElastiHack ~3 min)

Wave 124 — TerraCode demo script + tour spec

Objective: Nail TerraCode scoring categories (innovation, impact, UX, demo).

Work

Write docs/submission/TERRACODE_DEMO_SCRIPT.md

Implement tour-terracode.spec.ts that follows it end-to-end

Wave 125 — ElastiHack demo script + tour spec

Objective: Nail ElastiHack: Agent Builder + ES must be central.

Work

Write docs/submission/ELASTIHACK_DEMO_SCRIPT.md

Implement tour-elastihack.spec.ts

Wave 126 — Submission bundle generator (zip)

Objective: One command outputs a Devpost-ready bundle.

Work

Create submission_bundle.zip containing:

screenshots

diagram

demo scripts

proof manifest

README excerpt

Wave 127 — CI alignment (local == CI)

Objective: No surprises.

Work

CI runs the same make test and make e2e

No skipped tests allowed

Wave 128 — Final UX declutter

Objective: Fewer pages, more depth.

Work

Nav includes only:

Convergence

Search

Backtesting

Strategies

Agents

Ops

Auditor

Remove dead links and placeholder pages

Wave 129 — Incident drills (ES/WS/Broker outages)

Objective: Prove resilience and recovery.

Work

Controlled outage specs:

ES down briefly

WS forced disconnect

broker failure

System must surface incident banners and recover

Wave 130 — Final proof pack + dual-submission readiness

Objective: Ship final judge-grade proof.

Work

Generate proof pack with:

full logs

Playwright report

videos/traces/screenshots

determinism run1/run2 + diff

TOUR_TERRACODE.webm (2–3 min)

TOUR_ELASTIHACK.webm (~3 min)

submission bundle zip

Update README with exact run steps and “judge mode”