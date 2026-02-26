"""Fix JSX double-brace issue in all generated UI2 pages."""
import os
import re

PAGES_DIR = r"C:\Tradingview\Tradingview recreation\frontend\src\ui2\pages"

# List of component names we generated
WEEKS = list(range(15, 105))
SLUGS = {
    15: "CrossAssetQuote", 16: "CorporateActions", 17: "EconomicCalendar",
    18: "NewsEnrichment", 19: "EntityResolution", 20: "ThemeClustering",
    21: "ResearchNotebook", 22: "BqlQuery", 23: "SearchExplain",
    24: "Screeners", 25: "Collaboration", 26: "ResearchGovernance",
    27: "ExecutionCockpit", 28: "Blotter", 29: "PreTradeRisk",
    30: "Surveillance", 31: "Attribution", 32: "FactorModel",
    33: "StressScenarios", 34: "PnlExplain", 35: "Reconciliation",
    36: "SmartRouting", 37: "BrokerScoring", 38: "CrossAccount",
    39: "RiskGovernance", 40: "AgentRegistry", 41: "AutopilotPlaybook",
    42: "PromptFirewall", 43: "ModelRouter", 44: "EvalHarness",
    45: "ApprovalQueue", 46: "StrategySim", 47: "SignalProvenance",
    48: "IncidentAi", 49: "DriftDetection", 50: "ControlTower",
    51: "PolicyAttestation", 52: "AiGovernance", 53: "OptionsMatrix",
    54: "GreeksService", 55: "VolSurface", 56: "PayoffLab",
    57: "SpreadTools", 58: "FuturesCurve", 59: "RatesMonitor",
    60: "CrossMargin", 61: "DerivativesOms", 62: "VolScanner",
    63: "HedgeEngine", 64: "RiskAdjExec", 65: "DerivativesGov",
    66: "PolicyCode", 67: "Entitlements", 68: "ApprovalChain",
    69: "EvidenceVault", 70: "RetentionPolicy", 71: "AuditReplay",
    72: "IncidentCompliance", 73: "Supervisory", 74: "KriScoring",
    75: "ThirdPartyRisk", 76: "SsoHardening", 77: "Jurisdiction",
    78: "ControlFramework", 79: "PluginRuntime", 80: "SdkApi",
    81: "AppSandbox", 82: "Marketplace", 83: "PartnerCi",
    84: "UsageMetering", 85: "BillingEvents", 86: "ExtObservability",
    87: "TenantQuota", 88: "CompatMatrix", 89: "DevPortal",
    90: "SupportSla", 91: "MarketplaceTrust", 92: "MultiRegion",
    93: "LatencyBudget", 94: "CostProfiler", 95: "ReliabilityEcon",
    96: "RegionalFailover", 97: "DataResidency", 98: "OpsAutomationAi",
    99: "HotPath", 100: "ReleaseQuality", 101: "CapacityPlan",
    102: "PlatformDebt", 103: "OperatorEnable", 104: "GlobalReadiness",
}

fixed = 0
for w, name in SLUGS.items():
    fname = f"{name}UI2.tsx"
    fpath = os.path.join(PAGES_DIR, fname)
    if not os.path.exists(fpath):
        continue
    
    with open(fpath, "r", encoding="utf-8") as f:
        content = f.read()
    
    original = content
    
    # Fix 1: InfoRow div style - single braces to double
    content = content.replace(
        "<div style={ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }>",
        "<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>"
    )
    
    # Fix 2: InfoRow span style - the value span
    content = content.replace(
        "<span style={ fontSize: '13px', fontWeight: 500, color: 'var(--ui2-text-primary)' }>",
        "<span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--ui2-text-primary)' }}>"
    )
    
    # Fix 3: MetricCell value div
    content = content.replace(
        "<div style={ fontSize: '16px', fontWeight: 700, fontFamily: 'var(--ui2-font-mono)', color: 'var(--ui2-text-primary)', marginTop: '2px' }>",
        "<div style={{ fontSize: '16px', fontWeight: 700, fontFamily: 'var(--ui2-font-mono)', color: 'var(--ui2-text-primary)', marginTop: '2px' }}>"
    )
    
    # Fix 4: padding divs with single braces
    content = content.replace(
        "style={{ padding: '12px 16px 0 16px' }}",
        "style={{ padding: '12px 16px 0 16px' }}"
    )
    content = content.replace(
        "style={{ padding: '0 16px 8px 16px' }}",
        "style={{ padding: '0 16px 8px 16px' }}"
    )
    
    # Fix 5: Any remaining single-brace style objects in JSX
    # Pattern: style={ word: ... }> needs to be style={{ word: ... }}>
    # This is tricky because we need to distinguish JSX-context { obj } from {{ obj }}
    # Let me use a regex to find style={ ...not-braces... }>
    content = re.sub(
        r'style=\{ (display|fontSize|fontWeight|fontFamily|color|padding|margin|flex|gap|grid)',
        r'style={{ \1',
        content
    )
    # Close the matching brace
    content = re.sub(
        r"(style=\{\{[^}]+)\}>",
        r"\1}}>",
        content
    )
    
    # Fix 6: column render lambdas that need double braces
    # {{ fontSize: '12px' }} is already correct but {{{ fontSize: '12px' }}} would be wrong
    # Let me check for style={{{ which is triple braces (wrong) 
    content = content.replace("style={{{", "style={{")
    content = content.replace("}}}>{", "}}>")
    
    # Fix 7: General fix — find `style={` followed by a CSS property name (not a variable)
    # that doesn't have a second { 
    def fix_inline_style(match):
        # Already has double braces?
        return match.group(0)
    
    if content != original:
        with open(fpath, "w", encoding="utf-8") as f:
            f.write(content)
        fixed += 1

print(f"Fixed {fixed} / {len(SLUGS)} files")

# Verify one file
test_path = os.path.join(PAGES_DIR, "CrossAssetQuoteUI2.tsx")
with open(test_path, "r", encoding="utf-8") as f:
    c = f.read()
# Check for any remaining single-brace style patterns
singles = re.findall(r'style=\{[^{].*?\}>', c)
if singles:
    print(f"WARNING: Still found {len(singles)} single-brace styles:")
    for s in singles[:5]:
        print(f"  {s[:100]}")
else:
    print("All style braces look correct in CrossAssetQuoteUI2.tsx")
