"""
Wave 123 â€” Submission compliance.

Verifies:
  - All required docs exist (LICENSE, README, demo scripts, SLO, etc.)
  - check_submission_compliance.py exists and lists required files
  - generate_submission_bundle.py exists
"""
from __future__ import annotations

import os

WORKSPACE = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..")
)

REQUIRED_FILES = [
    "README.md",
    "docs/ops/SLO.md",
    "docs/ops/TROUBLESHOOTING.md",
    "docs/ops/RESET.md",
    "docs/ops/JUDGE_MODE.md",
    "docs/ONBOARDING.md",
    "docs/submission/TERRACODE_DEMO_SCRIPT.md",
    "docs/submission/ELASTIHACK_DEMO_SCRIPT.md",
    "scripts/check_submission_compliance.py",
    "scripts/generate_submission_bundle.py",
    "scripts/check_secrets.py",
]


class TestW123Compliance:
    def test_compliance_script_exists(self):
        path = os.path.join(WORKSPACE, "scripts", "check_submission_compliance.py")
        assert os.path.isfile(path)

    def test_bundle_script_exists(self):
        path = os.path.join(WORKSPACE, "scripts", "generate_submission_bundle.py")
        assert os.path.isfile(path)

    def test_readme_exists(self):
        path = os.path.join(WORKSPACE, "README.md")
        assert os.path.isfile(path)

    def test_slo_doc_exists(self):
        path = os.path.join(WORKSPACE, "docs", "ops", "SLO.md")
        assert os.path.isfile(path)

    def test_terracode_demo_script_exists(self):
        path = os.path.join(WORKSPACE, "docs", "submission", "TERRACODE_DEMO_SCRIPT.md")
        assert os.path.isfile(path)

    def test_elastihack_demo_script_exists(self):
        path = os.path.join(WORKSPACE, "docs", "submission", "ELASTIHACK_DEMO_SCRIPT.md")
        assert os.path.isfile(path)

    def test_onboarding_doc_exists(self):
        path = os.path.join(WORKSPACE, "docs", "ONBOARDING.md")
        assert os.path.isfile(path)

    def test_all_required_files_present(self):
        missing = []
        for rel in REQUIRED_FILES:
            if not os.path.isfile(os.path.join(WORKSPACE, rel)):
                missing.append(rel)
        assert not missing, f"Missing files: {missing}"

    def test_w123_spec_exists(self):
        spec = os.path.join(
            WORKSPACE, "frontend", "tests", "e2e", "hardening", "w123-compliance.spec.ts"
        )
        assert os.path.isfile(spec)

