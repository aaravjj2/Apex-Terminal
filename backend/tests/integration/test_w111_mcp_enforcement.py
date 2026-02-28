"""
Wave 111 — MCP-only enforcement gate tests.
Verifies playwright.config.ts is compliant and all spec files use only data-testid selectors.
"""
from __future__ import annotations

import os
import re
import glob

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
FRONTEND = os.path.join(ROOT, "frontend")


def _path(*parts: str) -> str:
    return os.path.join(ROOT, *parts)


def _read_config() -> str:
    with open(_path("frontend", "playwright.config.ts"), encoding="utf-8") as f:
        return f.read()


def _all_spec_files() -> list[str]:
    pattern = os.path.join(FRONTEND, "tests", "e2e", "hardening", "*.spec.ts")
    return glob.glob(pattern, recursive=False)


# ─────────────────────────────────────────────────────────────────────────────
# playwright.config.ts compliance
# ─────────────────────────────────────────────────────────────────────────────

class TestPlaywrightConfig:
    def test_config_file_exists(self):
        assert os.path.isfile(_path("frontend", "playwright.config.ts"))

    def test_headless_false(self):
        config = _read_config()
        # Either explicit 'headless: false' or 'headless: false'
        assert "headless: false" in config, \
            "playwright.config.ts must set headless: false (headed-only mode)"

    def test_workers_1(self):
        config = _read_config()
        assert "workers: 1" in config, \
            "playwright.config.ts must set workers: 1"

    def test_retries_0(self):
        config = _read_config()
        assert "retries: 0" in config, \
            "playwright.config.ts must set retries: 0"

    def test_video_on(self):
        config = _read_config()
        assert "video: 'on'" in config or 'video: "on"' in config, \
            "playwright.config.ts must set video: 'on'"

    def test_trace_on(self):
        config = _read_config()
        assert "trace: 'on'" in config or 'trace: "on"' in config, \
            "playwright.config.ts must set trace: 'on'"

    def test_screenshot_on(self):
        config = _read_config()
        assert "screenshot: 'on'" in config or 'screenshot: "on"' in config, \
            "playwright.config.ts must set screenshot: 'on'"


# ─────────────────────────────────────────────────────────────────────────────
# Test file scanner — forbidden patterns
# ─────────────────────────────────────────────────────────────────────────────

class TestSpecFileScanner:
    def _get_violations(self, forbidden_pattern: str) -> list[tuple[str, int, str]]:
        """Return list of (file, line_no, line) for any matches."""
        violations = []
        for spec_file in _all_spec_files():
            with open(spec_file, encoding="utf-8") as f:
                for i, line in enumerate(f, 1):
                    stripped = line.strip()
                    # Skip comments
                    if stripped.startswith("//") or stripped.startswith("*"):
                        continue
                    if re.search(forbidden_pattern, line):
                        violations.append((spec_file, i, line.rstrip()))
        return violations

    def test_no_get_by_text(self):
        # getByText selects by visible text — brittle, not MCP-compliant
        violations = self._get_violations(r'\.getByText\s*\(')
        assert not violations, \
            "getByText found in spec files (use data-testid only):\n" + \
            "\n".join(f"  {f}:{ln}: {txt}" for f, ln, txt in violations[:5])

    def test_no_get_by_role(self):
        # getByRole selects by ARIA role — brittle, not MCP-compliant
        violations = self._get_violations(r'\.getByRole\s*\(')
        assert not violations, \
            "getByRole found in spec files (use data-testid only):\n" + \
            "\n".join(f"  {f}:{ln}: {txt}" for f, ln, txt in violations[:5])

    def test_no_get_by_label(self):
        violations = self._get_violations(r'\.getByLabel\s*\(')
        assert not violations, \
            "getByLabel found in spec files:\n" + \
            "\n".join(f"  {f}:{ln}: {txt}" for f, ln, txt in violations[:5])

    def test_no_get_by_placeholder(self):
        violations = self._get_violations(r'\.getByPlaceholder\s*\(')
        assert not violations, \
            "getByPlaceholder found in spec files:\n" + \
            "\n".join(f"  {f}:{ln}: {txt}" for f, ln, txt in violations[:5])

    def test_no_wait_for_timeout(self):
        violations = self._get_violations(r'waitForTimeout\s*\(')
        assert not violations, \
            "waitForTimeout found in spec files (forbidden — fix real latency issues):\n" + \
            "\n".join(f"  {f}:{ln}: {txt}" for f, ln, txt in violations[:5])

    def test_spec_files_exist(self):
        specs = _all_spec_files()
        assert len(specs) >= 10, \
            f"Expected at least 10 spec files, found {len(specs)}"

    def test_all_specs_use_testid(self):
        """Every spec file that tests UI must use getByTestId at least once."""
        ui_specs = [
            f for f in _all_spec_files()
            if "w1" in os.path.basename(f) and "spec" in os.path.basename(f)
        ]
        missing_testid = []
        for spec_file in ui_specs:
            content = open(spec_file, encoding="utf-8").read()
            has_page_test = "page.goto" in content or "await page." in content
            has_testid = "getByTestId" in content or "data-testid" in content
            if has_page_test and not has_testid:
                missing_testid.append(spec_file)
        assert not missing_testid, \
            "Spec files with page tests but no getByTestId:\n" + \
            "\n".join(f"  {f}" for f in missing_testid[:5])
