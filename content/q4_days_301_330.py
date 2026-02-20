
from quarter_04 import add_day

# ─── MONTH 11: FUND STRUCTURE & INVESTOR PORTAL (DAYS 301-330) ──────────────

# Week 42: Investor Portal Development
add_day(301, "Investor Portal Setup (Vite+React)",
    "Secure portal for Limited Partners (LPs).",
    ["npm create vite apps/investor-portal"],
    ["apps/investor-portal/src/App.tsx"],
    ["Frontend", "Auth0"],
    ["Setup Auth0 login (MFA Required)", "Route protection"],
    "Public access.", "Secure Area"
)

add_day(302, "NAV Performance Charting",
    "Interactive equity curve for investor view.",
    ["npm install lightweight-charts"],
    ["apps/investor-portal/src/components/NAVChart.tsx"],
    ["Visualization", "Time Series"],
    ["Fetch daily NAV from API", "Compare vs SPY benchmark"],
    "Data delay.", "T+1 NAV"
)

add_day(303, "Document Vault (S3)",
    "Secure storage for subscription docs and K-1s.",
    ["touch apps/api/routes/documents.py"],
    ["apps/api/routes/documents.py"],
    ["Storage", "Security"],
    ["Generate pre-signed URLs", "Upload monthly statements"],
    "Public bucket.", "Private access"
)

add_day(304, "Subscription/Redemption Workflow",
    "Digital workflow for capital calls and withdrawals.",
    ["touch apps/fund/workflow.py"],
    ["apps/web/src/features/Fund/CapitalFlow.tsx"],
    ["Workflow", "Approvals"],
    ["LP requests redemption", "GP approves/rejects"],
    "Lost request.", "Audit trail"
)

add_day(305, "Investor CRM Integration",
    "Sync investor data with Salesforce/Hubspot.",
    ["pip install simple-salesforce"],
    ["apps/services/crm_sync.py"],
    ["CRM", "Sync"],
    ["Push AUM updates to CRM", "Pull contact info"],
    "Data conflict.", "CRM Master"
)

add_day(306, "Fund Fact Sheet Generator",
    "Auto-generate PDF fact sheet with monthly performance metrics.",
    ["pip install reportlab"],
    ["reports/fact_sheet_gen.py"],
    ["Reporting", "PDF"],
    ["Calculate MoM returns", "Render PDF with charts"],
    "Typo.", "Professional design"
)

add_day(307, "Notification Center (Email/SMS)",
    "Alert LPs about new statements or capital calls.",
    ["pip install twilio sendgrid"],
    ["apps/services/notifications.py"],
    ["Messaging", "Channels"],
    ["Send 'Statement Ready' email", "Send 'Capital Call' SMS"],
    "Spam.", "Transactional only"
)

# Week 43: Back Office & Fund Admin
add_day(308, "General Ledger (Double Entry)",
    "Core accounting system for the fund.",
    ["touch apps/accounting/ledger.py"],
    ["apps/accounting/ledger.py"],
    ["Accounting", "Immutable Log"],
    ["Debit Cash / Credit Equity", "Enforce A = L + E"],
    "Unbalanced books.", "Zero discrepancy"
)

add_day(309, "Fee Engine (2 & 20)",
    "Calculate Management and Performance fees automatically.",
    ["touch apps/accounting/fees.py"],
    ["apps/accounting/fees.py"],
    ["Calculation", "Accrual"],
    ["Accrue 2% Mgmt Fee daily", "Accrue 20% Perf Fee on HWM"],
    "Overcharging.", "Audit ready"
)

add_day(310, "High Water Mark (HWM) Tracking",
    "Track HWM per investor to ensure fair fees.",
    ["touch apps/accounting/hwm.py"],
    ["apps/accounting/hwm.py"],
    ["State Tracking", "Fairness"],
    ["Update HWM on crystallization", "Handle loss carryforward"],
    "Reset error.", "Perpetual HWM"
)

add_day(311, "NAV Calculation Service",
    "Official End-of-Day Net Asset Value calculation.",
    ["touch apps/accounting/nav.py"],
    ["apps/accounting/nav.py"],
    ["Valuation", "Mark-to-Market"],
    ["Sum(Assets) - Sum(Liabilities) - AccruedFees", "Divide by Shares Outstanding"],
    "Pricing error.", "Strike NAV"
)

add_day(312, "Audit Trail Immutable Ledger",
    "Cryptographically verifiable log of all fund movements.",
    ["pip install merkletools"],
    ["apps/accounting/audit_chain.py"],
    ["Blockchain-lite", "Security"],
    ["Hash daily transactions", "Publish root hash daily"],
    "Tampering.", "Provable history"
)

add_day(313, "Automated Recon with Prime Broker",
    "Daily reconciliation of positions and cash with IBKR.",
    ["python scripts/recon/prime_broker.py"],
    ["reports/recon_break_report.md"],
    ["Reconciliation", "Operations"],
    ["Match internal ledger vs PB report", "Alert on breaks"],
    "Unnoticed break.", "T+1 resolution"
)

add_day(314, "Expense Management",
    "Track fund expenses (Legal, Audit, Data) against budget.",
    ["touch apps/accounting/expenses.py"],
    ["apps/accounting/expenses.py"],
    ["Budgeting", "Expense Ratio"],
    ["Approve invoices", "Allocate to fund vs implementation"],
    "Leakage.", "Low Opex"
)

# Week 44: Regulatory & Compliance
add_day(315, "KYC/AML Integration (Sumsub)",
    "Automate identity verification for new investors.",
    ["pip install sumsub-python-sdk"],
    ["apps/compliance/kyc.py"],
    ["Identity Verification", "Compliance"],
    ["Upload Passport/ID", "Check Sanctions List"],
    "Manual check.", "Auto-approve"
)

add_day(316, "Form 13F Generator",
    "Auto-generate XML for SEC 13F quarterly filing.",
    ["touch apps/compliance/filings/13f.py"],
    ["apps/compliance/filings/13f.xml"],
    ["Regulatory", "XML"],
    ["Aggregate long positions > $100M", "Format to SEC spec"],
    "Late filing.", "Auto-submit ready"
)

add_day(317, "Wash Sale Compliance Engine",
    "Final check for restricted wash sales across all accounts.",
    ["python apps/compliance/wash_sale_check.py"],
    ["reports/wash_sale_impact.md"],
    ["Tax", "Optimization"],
    ["Identify potential wash sales", "Simulation of tax impact"],
    "Surprise tax.", "Tax efficiency"
)

add_day(318, "Accredited Investor Verification",
    "Manage 506(c) verification letters.",
    ["touch apps/compliance/accreditation.py"],
    ["apps/compliance/accreditation.py"],
    ["Workflow", "Legal"],
    ["Store CPA letters", "Track expiry"],
    "Non-compliance.", "Verified LPs"
)

add_day(319, "Insider Trading Prevention (Restricted List)",
    "Block trades on restricted symbols (employee trading).",
    ["touch apps/compliance/restricted_list.py"],
    ["apps/compliance/restricted_list.py"],
    ["Policy", "Blocking"],
    ["Maintain blacklist", "Reject orders middleware"],
    "Violation.", "Zero tolerance"
)

add_day(320, "Cybersecurity Audit Prep",
    "Prepare evidence for penetration testing.",
    ["nmap -sV localhost"],
    ["reports/security_scan.md"],
    ["Security", "Hardening"],
    ["Run static analysis (Bandit)", "Close open ports"],
    "Vulnerability.", "Clean scan"
)

# Week 45: Q4 Month 2 Review
add_day(321, "Fund Operations Review",
    "End-to-end dry run of month-end close process.",
    ["python scripts/ops/month_end_close.py"],
    ["reports/q4_m2_ops_review.md"],
    ["Operations", "Process"],
    ["Calculate NAV", "Generate Fees", "Produce Statements"],
    "Delay.", "Close in 1 day"
)

add_day(322, "Investor Experience Audit",
    "Feedback loop on the portal UI/UX.",
    ["touch docs/ux/investor_feedback.md"],
    ["docs/ux/investor_feedback.md"],
    ["Product", "UX"],
    ["User testing session", "Simplify subscription flow"],
    "Confusion.", "Seamless UX"
)

add_day(323, "Load Testing (Endgame Scale)",
    "Simulate 10,000 concurrent LPs checking performance.",
    ["locust -f tests/load/portal.py"],
    ["reports/portal_load_test.html"],
    ["Scalability", "Performance"],
    ["Spike traffic", "Verify API latency"],
    "Crash.", "Auto-scale"
)

add_day(324, "Disaster Recovery Drill (Full)",
    "Simulate complete region failure and recovery.",
    ["python scripts/dr/failover_region.py"],
    ["reports/dr_drill_results.md"],
    ["Resilience", "Continuity"],
    ["Failover DB to secondary region", "Redirect DNS"],
    "Data loss.", "RPO < 5min"
)

add_day(325, "Documentation Finalization",
    "Ensure all 365 days of code have docstrings.",
    ["pydocstyle apps/"],
    ["docs/api/coverage.md"],
    ["Quality", "Docs"],
    ["Auto-generate API reference", "Fill gaps"],
    "Undocumented.", "100% Doc coverage"
)

add_day(326, "Code Freeze for V1.0",
    "Lock main branch, only critical bug fixes allowed.",
    ["git tag v1.0.0-rc1"],
    ["RELEASE_CANDIDATE.md"],
    ["Release Management", "Freeze"],
    ["Notify team", "Branch permissions lock"],
    "Feature creep.", "Stability"
)

add_day(327, "Regression Testing Marathon",
    "Run every single test case defined in the last year.",
    ["pytest tests/"],
    ["reports/final_regression.xml"],
    ["QA", "Verification"],
    ["Unit, Integration, E2E", "Fix any regression"],
    "Red tests.", "All Green"
)

add_day(328, "Security Penetration Test",
    "External red-team attack on the platform.",
    ["touch reports/pentest_findings.md"],
    ["reports/pentest_findings.md"],
    ["Security", "Validation"],
    ["Attempt SQLi, XSS, CSRF", "Patch vulnerabilities"],
    "Exploit.", "Secure fortress"
)

add_day(329, "Go/No-Go Decision Meeting",
    "Final stakeholder review before launch.",
    ["touch docs/launch/go_no_go.md"],
    ["docs/launch/decision.md"],
    ["Management", "Decision"],
    ["Review Audit, Security, Ops, Legal", "Sign-off"],
    "No-Go.", "GO FOR LAUNCH"
)

add_day(330, "Q4 Month 2 Retrospective",
    "Reflection on the Fund Admin buildout.",
    ["touch reports/q4_m2_retro.md"],
    ["reports/q4_m2_retro.md"],
    ["Review", "Learning"],
    ["What went well?", "What was harder than expected?"],
    "Burnout.", "Celebration ready"
)
