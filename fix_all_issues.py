"""
Comprehensive fix script for all W15-W104 generated files.
1. Backend: Replace empty data[] with realistic demo data  
2. Frontend: Fix StatusBadge variant Python template string
3. Frontend: Fix StatusBadge for POST endpoints
"""
import os, re, json, hashlib, random
from datetime import datetime, timedelta

ROOT = os.path.dirname(os.path.abspath(__file__))
BACKEND = os.path.join(ROOT, "phase1", "services", "api", "routes")
FRONTEND = os.path.join(ROOT, "frontend", "src", "ui2", "pages")

# ─── WEEK DEFINITIONS (same as generate_masterplan.py) ────────────────────────
WEEKS = [
    (15, "cross_asset_quote", "Cross-Asset Quotes", "quotes"),
    (16, "corporate_actions", "Corporate Actions", "corporate-actions"),
    (17, "economic_calendar", "Economic Calendar", "economic-calendar"),
    (18, "news_enrichment", "News Enrichment", "news-enrichment"),
    (19, "entity_resolution", "Entity Resolution", "entity-resolution"),
    (20, "theme_clustering", "Theme Clustering", "theme-clustering"),
    (21, "research_notebook", "Research Notebook", "research-notebook"),
    (22, "bql_query", "BQL Query", "bql-query"),
    (23, "search_explain", "Search Explain", "search-explain"),
    (24, "screeners", "Screeners", "screeners"),
    (25, "collaboration", "Collaboration", "collaboration"),
    (26, "research_governance", "Research Governance", "research-governance"),
    (27, "execution_cockpit", "Execution Cockpit", "execution-cockpit"),
    (28, "blotter", "Blotter", "blotter"),
    (29, "pre_trade_risk", "Pre-Trade Risk", "pre-trade-risk"),
    (30, "surveillance", "Surveillance", "surveillance"),
    (31, "attribution", "Attribution", "attribution"),
    (32, "factor_model", "Factor Model", "factor-model"),
    (33, "stress_scenarios", "Stress Scenarios", "stress-scenarios"),
    (34, "pnl_explain", "PnL Explainer", "pnl-explain"),
    (35, "reconciliation", "Reconciliation", "reconciliation"),
    (36, "smart_routing", "Smart Routing", "smart-routing"),
    (37, "broker_scoring", "Broker Scoring", "broker-scoring"),
    (38, "cross_account", "Cross-Account", "cross-account"),
    (39, "risk_governance", "Risk Governance", "risk-governance"),
    (40, "agent_registry", "Agent Registry", "agent-registry"),
    (41, "autopilot_playbook", "Playbook", "autopilot-playbook"),
    (42, "prompt_firewall", "Prompt Firewall", "prompt-firewall"),
    (43, "model_router", "Model Router", "model-router"),
    (44, "eval_harness", "Eval Harness", "eval-harness"),
    (45, "approval_queue", "Approval Queue", "approval-queue"),
    (46, "strategy_sim", "Strategy Sim", "strategy-sim"),
    (47, "signal_provenance", "Signal Provenance", "signal-provenance"),
    (48, "incident_ai", "Incident AI", "incident-ai"),
    (49, "drift_detection", "Drift Detection", "drift-detection"),
    (50, "control_tower", "Control Tower", "control-tower"),
    (51, "policy_attestation", "Policy Attestation", "policy-attestation"),
    (52, "ai_governance", "AI Governance", "ai-governance"),
    (53, "options_matrix", "Options Matrix", "options-matrix"),
    (54, "greeks_service", "Greeks Service", "greeks-service"),
    (55, "vol_surface", "Vol Surface", "vol-surface"),
    (56, "payoff_lab", "Payoff Lab", "payoff-lab"),
    (57, "spread_tools", "Spread Tools", "spread-tools"),
    (58, "futures_curve", "Futures Curve", "futures-curve"),
    (59, "rates_monitor", "Rates Monitor", "rates-monitor"),
    (60, "cross_margin", "Cross-Margin", "cross-margin"),
    (61, "derivatives_oms", "Derivatives OMS", "derivatives-oms"),
    (62, "vol_scanner", "Vol Scanner", "vol-scanner"),
    (63, "hedge_engine", "Hedge Engine", "hedge-engine"),
    (64, "risk_adj_exec", "Risk-Adj Exec", "risk-adj-exec"),
    (65, "derivatives_governance", "Derivatives Governance", "derivatives-governance"),
    (66, "policy_code", "Policy Code", "policy-code"),
    (67, "entitlements", "Entitlements", "entitlements"),
    (68, "approval_chain", "Approval Chain", "approval-chain"),
    (69, "evidence_vault", "Evidence Vault", "evidence-vault"),
    (70, "retention_policy", "Retention Policy", "retention-policy"),
    (71, "audit_replay", "Audit Replay", "audit-replay"),
    (72, "incident_compliance", "Incident Compliance", "incident-compliance"),
    (73, "supervisory", "Supervisory", "supervisory"),
    (74, "kri_scoring", "KRI Scoring", "kri-scoring"),
    (75, "third_party_risk", "Third-Party Risk", "third-party-risk"),
    (76, "sso_hardening", "SSO Hardening", "sso-hardening"),
    (77, "jurisdiction", "Jurisdiction", "jurisdiction"),
    (78, "control_framework", "Control Framework", "control-framework"),
    (79, "plugin_runtime", "Plugin Runtime", "plugin-runtime"),
    (80, "sdk_api", "SDK API", "sdk-api"),
    (81, "app_sandbox", "App Sandbox", "app-sandbox"),
    (82, "marketplace", "Marketplace", "marketplace"),
    (83, "partner_ci", "Partner CI", "partner-ci"),
    (84, "usage_metering", "Usage Metering", "usage-metering"),
    (85, "billing_events", "Billing Events", "billing-events"),
    (86, "ext_observability", "Ext Observability", "ext-observability"),
    (87, "tenant_quota", "Tenant Quota", "tenant-quota"),
    (88, "compat_matrix", "Compat Matrix", "compat-matrix"),
    (89, "dev_portal", "Dev Portal", "dev-portal"),
    (90, "support_sla", "Support SLA", "support-sla"),
    (91, "marketplace_trust", "Marketplace Trust", "marketplace-trust"),
    (92, "multi_region", "Multi-Region", "multi-region"),
    (93, "latency_budget", "Latency Budget", "latency-budget"),
    (94, "cost_profiler", "Cost Profiler", "cost-profiler"),
    (95, "reliability_econ", "Reliability Econ", "reliability-econ"),
    (96, "regional_failover", "Regional Failover", "regional-failover"),
    (97, "data_residency", "Data Residency", "data-residency"),
    (98, "ops_automation_ai", "Ops Automation AI", "ops-automation-ai"),
    (99, "hot_path", "Hot Path", "hot-path"),
    (100, "release_quality", "Release Quality", "release-quality"),
    (101, "capacity_plan", "Capacity Plan", "capacity-plan"),
    (102, "platform_debt", "Platform Debt", "platform-debt"),
    (103, "operator_enable", "Operator Enable", "operator-enable"),
    (104, "global_readiness", "Global Readiness", "global-readiness"),
]

# ─── DEMO DATA SEEDS ──────────────────────────────────────────────────────────
STATUSES = ["active", "active", "active", "pending", "completed", "warning", "active", "active"]
SYMBOLS = ["AAPL", "MSFT", "NVDA", "TSLA", "SPY", "GOOGL", "AMZN", "META", "JPM", "GS", "BAC", "V"]
NAMES_BY_FEATURE = {
    "quotes": ["AAPL Real-time Feed", "MSFT Multi-exchange Agg", "NVDA Cross-venue Quote", "SPY ETF Composite", "TSLA Options Feed", "GOOGL L2 Depth", "AMZN Pre-market", "META Extended Hours"],
    "corporate-actions": ["AAPL Stock Split 4:1", "MSFT Dividend $0.75", "NVDA Spinoff Record", "TSLA Merger Filing", "JPM Rights Issue", "GS Tender Offer", "AMZN Buyback Program", "META Name Change"],
    "economic-calendar": ["FOMC Rate Decision", "Non-Farm Payrolls", "CPI YoY Release", "GDP Q4 Advance", "PCE Price Index", "ISM Manufacturing", "Retail Sales MoM", "Jobless Claims Weekly"],
    "execution-cockpit": ["Fill AAPL Limit Buy", "Fill MSFT Market Sell", "Partial NVDA Block", "Reject TSLA Pre-Check", "Fill SPY TWAP", "Fill GOOGL VWAP", "Timeout AMZN Iceberg", "Fill META Algo"],
    "blotter": ["Order #2847 AAPL", "Order #2848 MSFT", "Order #2849 NVDA", "Amend #2850 TSLA", "Order #2851 SPY", "Cancel #2852 META", "Order #2853 GOOGL", "Order #2854 JPM"],
    "options-matrix": ["AAPL 175C Jan25", "MSFT 400P Feb25", "NVDA 500C Mar25", "SPY 450P Q1", "TSLA 200C Weekly", "GOOGL 140C LEAPS", "META 350P Hedge", "AMZN 180C Spread"],
    "agent-registry": ["Momentum Agent v3.2", "Mean-Reversion Agent", "Pairs Trading Bot", "News Sentiment Agent", "Volatility Harvester", "Factor Rotation Agent", "Stat-Arb Agent", "ML Signal Generator"],
    "control-tower": ["System Health Monitor", "Risk Limit Check", "Order Queue Status", "P&L Real-time Feed", "Position Reconcile", "Market Data Check", "Latency Monitor", "Compliance Scanner"],
    "marketplace": ["Bloomberg Bridge Plugin", "Reuters Feed Adapter", "Custom Screener Pro", "AI Signal Pack v2", "Risk Dashboard Pro", "Portfolio Optimizer", "Trade Analytics Suite", "Compliance Module"],
}

def generate_demo_items(feature_slug, week, count=8):
    """Generate realistic demo data items."""
    # Use feature-specific names if available, otherwise generic
    names = NAMES_BY_FEATURE.get(feature_slug, None)
    if not names:
        # Generate generic but contextual names
        names = [f"{feature_slug.replace('-', ' ').title()} Item {i+1}" for i in range(count)]
    
    items = []
    base_time = datetime(2026, 2, 26, 9, 30, 0)
    for i in range(min(count, len(names))):
        seed = f"{feature_slug}-{i}"
        h = hashlib.md5(seed.encode()).hexdigest()[:8]
        status = STATUSES[i % len(STATUSES)]
        updated = (base_time - timedelta(minutes=i*17, seconds=i*31)).strftime("%Y-%m-%dT%H:%M:%SZ")
        items.append({
            "id": f"{feature_slug[:3]}-{h}",
            "name": names[i],
            "status": status,
            "updated": updated,
            "symbol": SYMBOLS[i % len(SYMBOLS)],
            "value": round(100 + (hash(seed) % 900) + (hash(seed) % 100) / 100, 2),
        })
    return items


def fix_backend_file(filepath, week, feature_name, feature_slug):
    """Replace empty data:[] in overview endpoint with demo data."""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    items = generate_demo_items(feature_slug, week)
    active_count = sum(1 for it in items if it["status"] == "active")
    
    # Build the data list as Python source
    data_lines = []
    for it in items:
        data_lines.append(f'            {{"id": "{it["id"]}", "name": "{it["name"]}", "status": "{it["status"]}", "updated": "{it["updated"]}", "symbol": "{it["symbol"]}", "value": {it["value"]}}}')
    data_str = ",\n".join(data_lines)
    
    metadata_str = f'{{"generated": True, "version": "v4", "week": "W{week}", "total": {len(items)}, "active": {active_count}, "lastSync": "2026-02-26T09:30:00Z"}}'
    
    # Replace the overview endpoint's data:[] and metadata
    old_overview = '''        "data": [],
        "metadata": {"generated": True, "version": "v4", "week": "W''' + str(week) + '"},'
    
    new_overview = f'''        "data": [
{data_str}
        ],
        "metadata": {metadata_str},'''
    
    if old_overview in content:
        # Only replace the FIRST occurrence (the overview endpoint)
        content = content.replace(old_overview, new_overview, 1)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    return True


def fix_frontend_statusbadge(filepath):
    """Fix StatusBadge variant that has Python template string."""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    
    # Fix: variant="{'success' if method == 'GET' else 'warning'}" → variant="success" for GET, variant="warning" for POST
    # All GET endpoints have the same broken template
    content = content.replace(
        """variant="{'success' if method == 'GET' else 'warning'}">GET</StatusBadge>""",
        'variant="success">GET</StatusBadge>'
    )
    content = content.replace(
        """variant="{'success' if method == 'GET' else 'warning'}">POST</StatusBadge>""",
        'variant="warning">POST</StatusBadge>'
    )
    
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    return False


def main():
    backend_fixed = 0
    frontend_fixed = 0
    
    for week, slug, title, api_slug in WEEKS:
        # Fix backend
        backend_file = os.path.join(BACKEND, f"w{week}_{slug}.py")
        if os.path.exists(backend_file):
            if fix_backend_file(backend_file, week, title, api_slug):
                backend_fixed += 1
        
        # Fix frontend - need to find the right filename
        # Convert slug to camelCase UI2 name
        parts = slug.split('_')
        component = ''.join(p.capitalize() for p in parts)
        frontend_file = os.path.join(FRONTEND, f"{component}UI2.tsx")
        if os.path.exists(frontend_file):
            if fix_frontend_statusbadge(frontend_file):
                frontend_fixed += 1
    
    print(f"Backend: Fixed {backend_fixed}/90 files with demo data")
    print(f"Frontend: Fixed {frontend_fixed}/90 StatusBadge variants")

if __name__ == "__main__":
    main()
