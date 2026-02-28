"""Patch all registration files: main.py, routes.tsx, index.ts, AppShellUI2.tsx"""
import re

BASE = r"C:\Tradingview\Tradingview recreation"

# ── All W15-W104 weeks ──
WEEKS = [
    (15, "cross-asset-quote", "CrossAssetQuoteUI2", "Cross-Asset Quotes", "💹", "tools", "Real-time cross-asset quote aggregation with multi-exchange feeds"),
    (16, "corporate-actions", "CorporateActionsUI2", "Corporate Actions", "📋", "tools", "Corporate actions ingestion, adjustment, and audit trail"),
    (17, "economic-calendar", "EconomicCalendarUI2", "Economic Calendar", "📅", "tools", "Global economic event calendar with impact scoring and alerts"),
    (18, "news-enrichment", "NewsEnrichmentUI2", "News Enrichment", "📰", "tools", "NLP-enriched news feed with entity extraction and sentiment"),
    (19, "entity-resolution", "EntityResolutionUI2", "Entity Resolution", "🔗", "tools", "Entity resolution pipeline for cross-reference matching"),
    (20, "theme-clustering", "ThemeClusteringUI2", "Theme Clustering", "🎯", "tools", "ML-powered thematic clustering of market sectors"),
    (21, "research-notebook", "ResearchNotebookUI2", "Research Notebook", "📓", "tools", "Collaborative research notebooks with code cells"),
    (22, "bql-query", "BqlQueryUI2", "BQL Query Builder", "⌨️", "tools", "Bloomberg-style query language for financial data"),
    (23, "search-explain", "SearchExplainUI2", "Search Explainability", "🔍", "tools", "Search ranking transparency with scoring breakdown"),
    (24, "screeners", "ScreenersUI2", "Screeners & Monitors", "📊", "tools", "Saved stock screeners with real-time monitoring"),
    (25, "collaboration", "CollaborationUI2", "Collaboration", "👥", "tools", "Analyst collaboration toolkit with shared workspaces"),
    (26, "research-governance", "ResearchGovernanceUI2", "Research Governance", "🏛️", "tools", "Research quality assurance and governance controls"),
    (27, "execution-cockpit", "ExecutionCockpitUI2", "Execution Cockpit", "🎛️", "main", "Real-time execution monitoring with fill quality"),
    (28, "blotter", "BlotterUI2", "Blotter", "📑", "main", "Decomposed execution blotter with parent-child linking"),
    (29, "pre-trade-risk", "PreTradeRiskUI2", "Pre-Trade Risk", "⚠️", "tools", "Pre-trade risk checks with limit validation"),
    (30, "surveillance", "SurveillanceUI2", "Surveillance", "👁️", "tools", "Post-trade surveillance with pattern detection"),
    (31, "attribution", "AttributionUI2", "Attribution Engine", "📊", "tools", "Multi-factor portfolio attribution with Brinson"),
    (32, "factor-model", "FactorModelUI2", "Factor Model", "🧮", "tools", "Multi-factor risk model with factor exposures"),
    (33, "stress-scenarios", "StressScenariosUI2", "Stress Scenarios", "🌪️", "tools", "Stress scenario composer with historical replay"),
    (34, "pnl-explain", "PnlExplainUI2", "PnL Explainer", "💰", "tools", "PnL explainability with attribution waterfall"),
    (35, "reconciliation", "ReconciliationUI2", "Reconciliation", "🔄", "system", "Automated trade reconciliation with break detection"),
    (36, "smart-routing", "SmartRoutingUI2", "Smart Routing", "🛤️", "tools", "Smart order routing with venue analysis"),
    (37, "broker-scoring", "BrokerScoringUI2", "Broker Scoring", "⭐", "tools", "Broker quality scoring with execution benchmarking"),
    (38, "cross-account", "CrossAccountUI2", "Cross-Account", "🔐", "system", "Cross-account controls and aggregated positions"),
    (39, "risk-governance", "RiskGovernanceUI2", "Risk Governance", "🏛️", "system", "Risk governance framework with policy enforcement"),
    (40, "agent-registry", "AgentRegistryUI2", "Agent Registry", "🤖", "tools", "AI agent registry with capability discovery"),
    (41, "autopilot-playbook", "AutopilotPlaybookUI2", "Autopilot Playbook", "📖", "tools", "Autopilot playbook engine with strategy templates"),
    (42, "prompt-firewall", "PromptFirewallUI2", "Prompt Firewall", "🔥", "system", "Prompt policy firewall with input sanitization"),
    (43, "model-router", "ModelRouterUI2", "Model Router", "🔀", "system", "AI model router with load balancing and fallback"),
    (44, "eval-harness", "EvalHarnessUI2", "Eval Harness", "🧪", "tools", "Model evaluation harness with benchmark suites"),
    (45, "approval-queue", "ApprovalQueueUI2", "Approval Queue", "✅", "system", "Human-in-the-loop approval queue for AI decisions"),
    (46, "strategy-sim", "StrategySimUI2", "Strategy Simulation", "🎲", "tools", "Strategy simulation with Monte Carlo analysis"),
    (47, "signal-provenance", "SignalProvenanceUI2", "Signal Provenance", "📜", "tools", "Signal provenance ledger with lineage tracking"),
    (48, "incident-ai", "IncidentAiUI2", "Incident AI Fallback", "🚨", "system", "Incident-aware AI fallback with degradation"),
    (49, "drift-detection", "DriftDetectionUI2", "Drift Detection", "📐", "tools", "Data and model drift detection with alerting"),
    (50, "control-tower", "ControlTowerUI2", "Control Tower", "🗼", "main", "Autopilot UX control tower with real-time status"),
    (51, "policy-attestation", "PolicyAttestationUI2", "Policy Attestation", "📝", "system", "Policy attestation packs with evidence collection"),
    (52, "ai-governance", "AiGovernanceUI2", "AI Governance", "🏗️", "system", "AI release governance with model review"),
    (53, "options-matrix", "OptionsMatrixUI2", "Options Matrix", "📐", "tools", "Options chain matrix with real-time Greeks"),
    (54, "greeks-service", "GreeksServiceUI2", "Greeks Service", "Δ", "tools", "Real-time Greeks computation with sensitivity"),
    (55, "vol-surface", "VolSurfaceUI2", "Vol Surface", "📈", "tools", "Volatility surface snapshots with term structure"),
    (56, "payoff-lab", "PayoffLabUI2", "Payoff Lab", "🔬", "tools", "Strategy payoff lab with risk-reward visualization"),
    (57, "spread-tools", "SpreadToolsUI2", "Spread Tools", "🔧", "tools", "Options spread execution with leg optimization"),
    (58, "futures-curve", "FuturesCurveUI2", "Futures Curve", "📉", "tools", "Futures curve analytics with term structure"),
    (59, "rates-monitor", "RatesMonitorUI2", "Rates Monitor", "💵", "tools", "Interest rates monitor with yield curves"),
    (60, "cross-margin", "CrossMarginUI2", "Cross-Margin", "💼", "system", "Cross-margin controls with portfolio margining"),
    (61, "derivatives-oms", "DerivativesOmsUI2", "Derivatives OMS", "🏢", "main", "Derivatives order management with multi-leg"),
    (62, "vol-scanner", "VolScannerUI2", "Vol Scanner", "🔎", "tools", "Volatility scanner with unusual activity detection"),
    (63, "hedge-engine", "HedgeEngineUI2", "Hedge Engine", "🛡️", "tools", "Hedge recommendation engine with cost optimization"),
    (64, "risk-adj-exec", "RiskAdjExecUI2", "Risk-Adj Execution", "⚡", "tools", "Risk-adjusted execution with dynamic sizing"),
    (65, "derivatives-gov", "DerivativesGovUI2", "Derivatives Governance", "🏛️", "system", "Derivatives governance gates with position limits"),
    (66, "policy-code", "PolicyCodeUI2", "Policy as Code", "📜", "system", "Policy-as-code engine with rule authoring"),
    (67, "entitlements", "EntitlementsUI2", "Entitlements", "🔑", "system", "Entitlements matrix with role-based access"),
    (68, "approval-chain", "ApprovalChainUI2", "Approval Chain", "🔗", "system", "Multi-level approval chain with escalation"),
    (69, "evidence-vault", "EvidenceVaultUI2", "Evidence Vault", "🔒", "system", "Immutable regulatory evidence vault"),
    (70, "retention-policy", "RetentionPolicyUI2", "Retention Policy", "🗑️", "system", "Data retention policy automation"),
    (71, "audit-replay", "AuditReplayUI2", "Audit Replay", "⏪", "system", "Audit event replay with timeline visualization"),
    (72, "incident-compliance", "IncidentComplianceUI2", "Incident Compliance", "🔔", "system", "Incident-compliance bridge with notifications"),
    (73, "supervisory", "SupervisoryUI2", "Supervisory", "👔", "system", "Supervisory dashboards with KPI monitoring"),
    (74, "kri-scoring", "KriScoringUI2", "KRI Scoring", "📏", "system", "Key Risk Indicator scoring with controls"),
    (75, "third-party-risk", "ThirdPartyRiskUI2", "Third-Party Risk", "🌐", "system", "Third-party risk connectors with monitoring"),
    (76, "sso-hardening", "SsoHardeningUI2", "SSO Hardening", "🔐", "system", "Enterprise SSO hardening with MFA enforcement"),
    (77, "jurisdiction", "JurisdictionUI2", "Jurisdiction Rules", "🌍", "system", "Jurisdiction ruleset engine with compliance"),
    (78, "control-framework", "ControlFrameworkUI2", "Control Framework", "✔️", "system", "Control framework signoff with maturity"),
    (79, "plugin-runtime", "PluginRuntimeUI2", "Plugin Runtime", "🧩", "system", "Plugin sandbox runtime with capability model"),
    (80, "sdk-api", "SdkApiUI2", "SDK Standard", "📘", "system", "Public SDK API standard with versioning"),
    (81, "app-sandbox", "AppSandboxUI2", "App Sandbox", "📦", "system", "App sandbox controls with resource limits"),
    (82, "marketplace", "MarketplaceUI2", "Marketplace", "🏪", "tools", "Extension marketplace with listing and discovery"),
    (83, "partner-ci", "PartnerCiUI2", "Partner CI", "🤝", "system", "Partner CI certification with test suites"),
    (84, "usage-metering", "UsageMeteringUI2", "Usage Metering", "📊", "system", "Usage metering with real-time tracking"),
    (85, "billing-events", "BillingEventsUI2", "Billing Events", "💳", "system", "Billing event processing with invoicing"),
    (86, "ext-observability", "ExtObservabilityUI2", "Extension Observability", "🔭", "system", "Extension observability with monitoring"),
    (87, "tenant-quota", "TenantQuotaUI2", "Tenant Quota", "📐", "system", "Tenant quota controls with resource allocation"),
    (88, "compat-matrix", "CompatMatrixUI2", "Compat Matrix", "🔢", "system", "Compatibility matrix with version testing"),
    (89, "dev-portal", "DevPortalUI2", "Developer Portal", "🌐", "tools", "Developer portal with docs and playground"),
    (90, "support-sla", "SupportSlaUI2", "Support SLA", "🎫", "system", "Support SLA management with triage"),
    (91, "marketplace-trust", "MarketplaceTrustUI2", "Marketplace Trust", "🔒", "system", "Marketplace trust and security with scanning"),
    (92, "multi-region", "MultiRegionUI2", "Multi-Region", "🌏", "system", "Multi-region traffic steering with geo-routing"),
    (93, "latency-budget", "LatencyBudgetUI2", "Latency Budget", "⏱️", "system", "Latency budget engine with SLO tracking"),
    (94, "cost-profiler", "CostProfilerUI2", "Cost Profiler", "💲", "system", "Infrastructure cost profiler with optimization"),
    (95, "reliability-econ", "ReliabilityEconUI2", "Reliability Economics", "📊", "system", "Reliability economics with error budget tracking"),
    (96, "regional-failover", "RegionalFailoverUI2", "Regional Failover", "🔄", "system", "Regional failover drills with recovery"),
    (97, "data-residency", "DataResidencyUI2", "Data Residency", "📍", "system", "Data residency controls with geo classification"),
    (98, "ops-automation-ai", "OpsAutomationAiUI2", "Ops Automation AI", "🤖", "system", "AI-powered operational automation"),
    (99, "hot-path", "HotPathUI2", "Hot Path Profiling", "🔥", "system", "Hot path profiling with flame graphs"),
    (100, "release-quality", "ReleaseQualityUI2", "Release Quality", "🎯", "system", "Release quality predictor with risk scoring"),
    (101, "capacity-plan", "CapacityPlanUI2", "Capacity Planning", "📐", "system", "Capacity planning with forecasting"),
    (102, "platform-debt", "PlatformDebtUI2", "Platform Debt", "🧹", "system", "Technical debt retirement tracking"),
    (103, "operator-enable", "OperatorEnableUI2", "Operator Enablement", "📚", "system", "Operator enablement with training"),
    (104, "global-readiness", "GlobalReadinessUI2", "Global Readiness", "🌟", "system", "Global readiness certification"),
]

# Map slug -> backend module name
def slug_to_module(week, slug):
    return f"w{week:02d}_{slug.replace('-', '_')}"


# ═══════════════════════════════════════════════════
# 1) PATCH main.py — add imports + include_router
# ═══════════════════════════════════════════════════
def patch_main_py():
    fpath = f"{BASE}/phase1/services/api/main.py"
    with open(fpath, "r", encoding="utf-8") as f:
        content = f.read()

    # Build import block
    import_lines = "\n# ── Masterplan W15-W104: 2-Year Feature Set ──\nfrom .routes import (\n"
    for w, slug, *_ in WEEKS:
        mod = slug_to_module(w, slug)
        import_lines += f"    {mod},\n"
    import_lines += ")\n"

    # Insert imports after the existing w21/w46 import line
    marker = "from .routes import w21_backtest_v4, w46_elasticsearch_v3"
    if marker in content:
        content = content.replace(marker, marker + "\n" + import_lines)
    else:
        print("WARNING: Could not find import marker in main.py")
        return

    # Build router registration block
    router_lines = "\n    # ── Masterplan W15-W104: 2-Year Feature Set ──\n"
    for w, slug, *_ in WEEKS:
        mod = slug_to_module(w, slug)
        router_lines += f'    app.include_router({mod}.router, tags=["w{w:02d}-{slug}"])\n'

    # Insert after the w46 registration
    reg_marker = '    app.include_router(w46_elasticsearch_v3.router, tags=["elasticsearch-v3"])'
    if reg_marker in content:
        content = content.replace(reg_marker, reg_marker + "\n" + router_lines)
    else:
        print("WARNING: Could not find router registration marker in main.py")
        return

    with open(fpath, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"✓ Patched main.py (+{len(WEEKS)} imports, +{len(WEEKS)} routers)")


# ═══════════════════════════════════════════════════
# 2) PATCH index.ts — add page exports
# ═══════════════════════════════════════════════════
def patch_index_ts():
    fpath = f"{BASE}/frontend/src/ui2/pages/index.ts"
    with open(fpath, "r", encoding="utf-8") as f:
        content = f.read()

    exports = "\n// ── Masterplan W15-W104: 2-Year Feature Set ──\n"
    for w, slug, comp, title, *_ in WEEKS:
        fname = comp  # e.g. CrossAssetQuoteUI2
        exports += f"export {{ {comp} }} from './{fname}'; // W{w:02d}\n"

    content = content.rstrip() + "\n" + exports
    with open(fpath, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"✓ Patched index.ts (+{len(WEEKS)} exports)")


# ═══════════════════════════════════════════════════
# 3) PATCH routes.tsx — add imports + routes
# ═══════════════════════════════════════════════════
def patch_routes_tsx():
    fpath = f"{BASE}/frontend/src/ui2/routes.tsx"
    with open(fpath, "r", encoding="utf-8") as f:
        content = f.read()

    # Add component names to the import block — find the closing "} from './pages';"
    import_additions = "\n  // Masterplan W15-W104\n"
    for w, slug, comp, *_ in WEEKS:
        import_additions += f"  {comp},\n"

    # Insert before "} from './pages';"
    import_marker = "} from './pages';"
    if import_marker in content:
        content = content.replace(import_marker, import_additions + import_marker)
    else:
        print("WARNING: Could not find import marker in routes.tsx")
        return

    # Add routes before the closing </Route></Routes>
    route_additions = "\n        {/* ── Masterplan W15-W104: 2-Year Feature Set ── */}\n"
    for w, slug, comp, title, *_ in WEEKS:
        route_additions += f'        <Route path="{slug}" element={{<{comp} />}} />\n'

    # Find the last route and insert before </Route>
    close_marker = "        {/* W14 — Dataset Snapshot Management */}\n        <Route path=\"dataset-snapshots\" element={<DatasetSnapshotUI2 />} />"
    if close_marker in content:
        content = content.replace(close_marker, close_marker + "\n" + route_additions)
    else:
        print("WARNING: Could not find route close marker in routes.tsx")
        return

    with open(fpath, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"✓ Patched routes.tsx (+{len(WEEKS)} imports, +{len(WEEKS)} routes)")


# ═══════════════════════════════════════════════════
# 4) PATCH AppShellUI2.tsx — add WORKSPACES entries
# ═══════════════════════════════════════════════════
def patch_appshell():
    fpath = f"{BASE}/frontend/src/ui2/AppShellUI2.tsx"
    with open(fpath, "r", encoding="utf-8") as f:
        content = f.read()

    # Build WORKSPACES entries
    ws_entries = "\n  // ── Masterplan W15-W104: 2-Year Feature Set ──\n"
    for w, slug, comp, title, icon, section, desc in WEEKS:
        kws = "', '".join(slug.split("-"))
        ws_entries += f"  {{ id: '{slug}', label: '{title}', icon: '{icon}', path: '/ui2/{slug}', section: '{section}', description: '{desc}', keywords: ['{kws}'] }},\n"

    # Find the end of WORKSPACES array — look for the dataset-snapshots entry which is last
    ws_marker = "  { id: 'dataset-snapshots',"
    idx = content.find(ws_marker)
    if idx == -1:
        print("WARNING: Could not find dataset-snapshots in WORKSPACES")
        return
    
    # Find the end of that line (or the next line after the closing })
    end_of_entry = content.find("},", idx)
    if end_of_entry == -1:
        print("WARNING: Could not find end of dataset-snapshots entry")
        return
    end_of_entry += 2  # include "},\n" 
    # Find the newline
    nl = content.find("\n", end_of_entry)
    if nl == -1:
        nl = end_of_entry
    
    content = content[:nl+1] + ws_entries + content[nl+1:]

    # Also add key pages to CORE_NAV_IDS
    core_additions = [
        "execution-cockpit", "control-tower", "options-matrix", 
        "derivatives-oms", "marketplace", "global-readiness"
    ]
    
    # Find CORE_NAV_IDS set
    core_marker = "const CORE_NAV_IDS"
    core_idx = content.find(core_marker)
    if core_idx != -1:
        # Find the closing ])
        set_end = content.find("]);", core_idx)
        if set_end != -1:
            # Add new IDs before the ]
            additions = ""
            for cid in core_additions:
                if f"'{cid}'" not in content[core_idx:set_end]:
                    additions += f"  '{cid}',\n"
            if additions:
                content = content[:set_end] + additions + content[set_end:]

    with open(fpath, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"✓ Patched AppShellUI2.tsx (+{len(WEEKS)} WORKSPACES, +{len(core_additions)} CORE_NAV_IDS)")


if __name__ == "__main__":
    patch_main_py()
    patch_index_ts()
    patch_routes_tsx()
    patch_appshell()
    print("\n✅ All registrations patched!")
