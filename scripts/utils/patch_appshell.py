"""Patch AppShellUI2.tsx with WORKSPACES + CORE_NAV_IDS for W15-W104."""
import os

BASE = r"C:\Tradingview\Tradingview recreation"
FPATH = os.path.join(BASE, "frontend", "src", "ui2", "AppShellUI2.tsx")

WEEKS = [
    (15, "cross-asset-quote", "Cross-Asset Quotes", "💹", "tools", "Real-time cross-asset quote aggregation"),
    (16, "corporate-actions", "Corporate Actions", "📋", "tools", "Corporate actions ingestion and audit trail"),
    (17, "economic-calendar", "Economic Calendar", "📅", "tools", "Global economic event calendar"),
    (18, "news-enrichment", "News Enrichment", "📰", "tools", "NLP-enriched news with sentiment scoring"),
    (19, "entity-resolution", "Entity Resolution", "🔗", "tools", "Entity resolution and deduplication"),
    (20, "theme-clustering", "Theme Clustering", "🎯", "tools", "ML-powered thematic clustering"),
    (21, "research-notebook", "Research Notebook", "📓", "tools", "Collaborative research notebooks"),
    (22, "bql-query", "BQL Query", "⌨️", "tools", "Bloomberg-style query language"),
    (23, "search-explain", "Search Explain", "🔍", "tools", "Search ranking explainability"),
    (24, "screeners", "Screeners", "📊", "tools", "Stock screeners with monitoring"),
    (25, "collaboration", "Collaboration", "👥", "tools", "Analyst collaboration toolkit"),
    (26, "research-governance", "Research Gov", "🏛️", "tools", "Research QA and governance"),
    (27, "execution-cockpit", "Exec Cockpit", "🎛️", "main", "Real-time execution monitoring"),
    (28, "blotter", "Blotter", "📑", "main", "Execution blotter with audit trail"),
    (29, "pre-trade-risk", "Pre-Trade Risk", "⚠️", "tools", "Pre-trade risk checks"),
    (30, "surveillance", "Surveillance", "👁️", "tools", "Post-trade surveillance"),
    (31, "attribution", "Attribution", "📊", "tools", "Portfolio attribution engine"),
    (32, "factor-model", "Factor Model", "🧮", "tools", "Multi-factor risk model"),
    (33, "stress-scenarios", "Stress Scenarios", "🌪️", "tools", "Stress scenario composer"),
    (34, "pnl-explain", "PnL Explainer", "💰", "tools", "PnL explainability service"),
    (35, "reconciliation", "Reconciliation", "🔄", "system", "Trade reconciliation automation"),
    (36, "smart-routing", "Smart Routing", "🛤️", "tools", "Smart order routing"),
    (37, "broker-scoring", "Broker Scoring", "⭐", "tools", "Broker quality scoring"),
    (38, "cross-account", "Cross-Account", "🔐", "system", "Cross-account controls"),
    (39, "risk-governance", "Risk Governance", "🏛️", "system", "Risk governance framework"),
    (40, "agent-registry", "Agent Registry", "🤖", "tools", "AI agent registry"),
    (41, "autopilot-playbook", "Playbook", "📖", "tools", "Autopilot playbook engine"),
    (42, "prompt-firewall", "Prompt Firewall", "🔥", "system", "Prompt policy firewall"),
    (43, "model-router", "Model Router", "🔀", "system", "AI model router"),
    (44, "eval-harness", "Eval Harness", "🧪", "tools", "Model evaluation harness"),
    (45, "approval-queue", "Approval Queue", "✅", "system", "Human approval queue"),
    (46, "strategy-sim", "Strategy Sim", "🎲", "tools", "Strategy simulation"),
    (47, "signal-provenance", "Signal Provenance", "📜", "tools", "Signal provenance ledger"),
    (48, "incident-ai", "Incident AI", "🚨", "system", "Incident-aware AI fallback"),
    (49, "drift-detection", "Drift Detection", "📐", "tools", "Drift detection pipeline"),
    (50, "control-tower", "Control Tower", "🗼", "main", "Autopilot control tower"),
    (51, "policy-attestation", "Policy Attest", "📝", "system", "Policy attestation packs"),
    (52, "ai-governance", "AI Governance", "🏗️", "system", "AI release governance"),
    (53, "options-matrix", "Options Matrix", "📐", "tools", "Options chain matrix"),
    (54, "greeks-service", "Greeks", "Δ", "tools", "Greeks computation service"),
    (55, "vol-surface", "Vol Surface", "📈", "tools", "Volatility surface analytics"),
    (56, "payoff-lab", "Payoff Lab", "🔬", "tools", "Strategy payoff lab"),
    (57, "spread-tools", "Spread Tools", "🔧", "tools", "Options spread execution"),
    (58, "futures-curve", "Futures Curve", "📉", "tools", "Futures curve analytics"),
    (59, "rates-monitor", "Rates Monitor", "💵", "tools", "Interest rates monitor"),
    (60, "cross-margin", "Cross-Margin", "💼", "system", "Cross-margin controls"),
    (61, "derivatives-oms", "Derivatives OMS", "🏢", "main", "Derivatives order management"),
    (62, "vol-scanner", "Vol Scanner", "🔎", "tools", "Volatility scanner"),
    (63, "hedge-engine", "Hedge Engine", "🛡️", "tools", "Hedge recommendation engine"),
    (64, "risk-adj-exec", "Risk-Adj Exec", "⚡", "tools", "Risk-adjusted execution"),
    (65, "derivatives-gov", "Deriv Gov", "🏛️", "system", "Derivatives governance"),
    (66, "policy-code", "Policy Code", "📜", "system", "Policy-as-code engine"),
    (67, "entitlements", "Entitlements", "🔑", "system", "Entitlements matrix"),
    (68, "approval-chain", "Approval Chain", "🔗", "system", "Approval chain engine"),
    (69, "evidence-vault", "Evidence Vault", "🔒", "system", "Regulatory evidence vault"),
    (70, "retention-policy", "Retention Policy", "🗑️", "system", "Data retention automation"),
    (71, "audit-replay", "Audit Replay", "⏪", "system", "Audit event replay"),
    (72, "incident-compliance", "Incident Compl", "🔔", "system", "Incident compliance bridge"),
    (73, "supervisory", "Supervisory", "👔", "system", "Supervisory dashboards"),
    (74, "kri-scoring", "KRI Scoring", "📏", "system", "Key Risk Indicator scoring"),
    (75, "third-party-risk", "3rd Party Risk", "🌐", "system", "Third-party risk connectors"),
    (76, "sso-hardening", "SSO Hardening", "🔐", "system", "Enterprise SSO hardening"),
    (77, "jurisdiction", "Jurisdiction", "🌍", "system", "Jurisdiction rulesets"),
    (78, "control-framework", "Control FW", "✔️", "system", "Control framework signoff"),
    (79, "plugin-runtime", "Plugins", "🧩", "system", "Plugin sandbox runtime"),
    (80, "sdk-api", "SDK Standard", "📘", "system", "SDK API standard"),
    (81, "app-sandbox", "App Sandbox", "📦", "system", "App sandbox controls"),
    (82, "marketplace", "Marketplace", "🏪", "tools", "Extension marketplace"),
    (83, "partner-ci", "Partner CI", "🤝", "system", "Partner CI certification"),
    (84, "usage-metering", "Usage Metering", "📊", "system", "Usage metering pipeline"),
    (85, "billing-events", "Billing", "💳", "system", "Billing event processing"),
    (86, "ext-observability", "Ext Observ", "🔭", "system", "Extension observability"),
    (87, "tenant-quota", "Tenant Quota", "📐", "system", "Tenant quota controls"),
    (88, "compat-matrix", "Compat Matrix", "🔢", "system", "Compatibility matrix"),
    (89, "dev-portal", "Dev Portal", "🌐", "tools", "Developer portal"),
    (90, "support-sla", "Support SLA", "🎫", "system", "Support SLA management"),
    (91, "marketplace-trust", "Mktplace Trust", "🔒", "system", "Marketplace trust security"),
    (92, "multi-region", "Multi-Region", "🌏", "system", "Multi-region traffic steering"),
    (93, "latency-budget", "Latency Budget", "⏱️", "system", "Latency budget engine"),
    (94, "cost-profiler", "Cost Profiler", "💲", "system", "Infrastructure cost profiler"),
    (95, "reliability-econ", "Reliability Econ", "📊", "system", "Reliability economics dashboard"),
    (96, "regional-failover", "Failover Drills", "🔄", "system", "Regional failover drills"),
    (97, "data-residency", "Data Residency", "📍", "system", "Data residency controls"),
    (98, "ops-automation-ai", "Ops AI", "🤖", "system", "AI ops automation"),
    (99, "hot-path", "Hot Path", "🔥", "system", "Hot path profiling"),
    (100, "release-quality", "Release Quality", "🎯", "system", "Release quality predictor"),
    (101, "capacity-plan", "Capacity Plan", "📐", "system", "Capacity planning model"),
    (102, "platform-debt", "Platform Debt", "🧹", "system", "Technical debt retirement"),
    (103, "operator-enable", "Operator Enable", "📚", "system", "Operator enablement"),
    (104, "global-readiness", "Global Ready", "🌟", "system", "Global readiness certification"),
]

with open(FPATH, "r", encoding="utf-8") as f:
    content = f.read()

# Build entries
entries = "  // ── Masterplan W15-W104: 2-Year Feature Set ──\n"
for w, slug, title, icon, section, desc in WEEKS:
    kws = "', '".join(slug.split("-"))
    entries += (
        f"  {{\n"
        f"    id: '{slug}',\n"
        f"    label: '{title}',\n"
        f"    icon: '{icon}',\n"
        f"    path: '/ui2/{slug}',\n"
        f"    section: '{section}',\n"
        f"    description: '{desc}',\n"
        f"    keywords: ['{kws}']\n"
        f"  }},\n"
    )

# Find the closing ]; of WORKSPACES
marker = "    keywords: ['dataset', 'snapshot', 'sha256', 'integrity', 'immutable', 'data']\n  },\n];"
if marker in content:
    replacement = (
        "    keywords: ['dataset', 'snapshot', 'sha256', 'integrity', 'immutable', 'data']\n"
        "  },\n"
        + entries
        + "];"
    )
    content = content.replace(marker, replacement)
    print(f"Inserted {len(WEEKS)} WORKSPACES entries")
else:
    print("ERROR: WORKSPACES marker not found")
    # Try to find it
    idx = content.find("'immutable', 'data'")
    if idx > -1:
        print(f"Found 'immutable data' at position {idx}")
        print(repr(content[idx:idx+60]))

# Update CORE_NAV_IDS
old_core = "const CORE_NAV_IDS = new Set(['autopilot', 'search', 'workflow-builder', 'backtester-v3', 'broker-v2', 'runs', 'settings', 'observability-v2', 'productization', 'dataset-snapshots']);"
new_core = "const CORE_NAV_IDS = new Set(['autopilot', 'search', 'workflow-builder', 'backtester-v3', 'broker-v2', 'runs', 'settings', 'observability-v2', 'productization', 'dataset-snapshots', 'execution-cockpit', 'control-tower', 'options-matrix', 'derivatives-oms', 'marketplace', 'global-readiness']);"

if old_core in content:
    content = content.replace(old_core, new_core)
    print("Updated CORE_NAV_IDS (+6)")
else:
    print("ERROR: CORE_NAV_IDS marker not found")

with open(FPATH, "w", encoding="utf-8") as f:
    f.write(content)
print("Done!")
