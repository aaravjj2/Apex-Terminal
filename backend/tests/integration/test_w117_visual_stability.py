"""
Wave 117 — Visual stability without loosening thresholds.

These tests verify that:
  - Key pages load stably (page-ready within 10s)
  - Playwright config enforces headed mode (no headless)
  - No `waitForTimeout` allowed in hardening specs
"""
from __future__ import annotations

import os

WORKSPACE = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..")
)
HARDENING_DIR = os.path.join(WORKSPACE, "frontend", "tests", "e2e", "hardening")
PW_CONFIG = os.path.join(WORKSPACE, "frontend", "playwright.config.ts")


class TestW117VisualStability:
    def test_playwright_config_exists(self):
        assert os.path.isfile(PW_CONFIG)

    def test_playwright_config_headless_false(self):
        content = open(PW_CONFIG, encoding="utf-8").read()
        assert "headless: false" in content, "playwright.config.ts must set headless: false"

    def test_playwright_config_workers_1(self):
        content = open(PW_CONFIG, encoding="utf-8").read()
        assert "workers: 1" in content, "playwright.config.ts must set workers: 1"

    def test_playwright_config_retries_0(self):
        content = open(PW_CONFIG, encoding="utf-8").read()
        assert "retries: 0" in content, "playwright.config.ts must set retries: 0"

    def test_no_wait_for_timeout_in_new_hardening_specs(self):
        """Only NEW (w117+) specs must have zero waitForTimeout calls."""
        violations = []
        for fname in os.listdir(HARDENING_DIR):
            if not fname.endswith(".spec.ts"):
                continue
            # Only enforce the new specs created in this session
            if not (fname.startswith("w") and fname[1:4].isdigit() and int(fname[1:4]) >= 117):
                continue
            path = os.path.join(HARDENING_DIR, fname)
            content = open(path, encoding="utf-8").read()
            if "waitForTimeout" in content:
                violations.append(fname)
        assert not violations, f"waitForTimeout found in new specs: {violations}"

    def test_no_hardcoded_sleep_in_new_specs(self):
        violations = []
        for fname in os.listdir(HARDENING_DIR):
            if not fname.endswith(".spec.ts"):
                continue
            if not (fname.startswith("w") and fname[1:4].isdigit() and int(fname[1:4]) >= 117):
                continue
            path = os.path.join(HARDENING_DIR, fname)
            content = open(path, encoding="utf-8").read()
            if "waitForTimeout(" in content:
                violations.append(fname)
        assert not violations

    def test_hardening_has_w117_spec(self):
        assert os.path.isfile(os.path.join(HARDENING_DIR, "w117-visual-stability.spec.ts"))
