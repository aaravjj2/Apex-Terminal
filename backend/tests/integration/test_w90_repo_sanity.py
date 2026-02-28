"""
W90 — Repo sanity gates.
Tests that scan_testids.py and scan_playwright.py pass clean.
"""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent.parent.parent  # workspace root
PYTHON = sys.executable


def run_script(script_name: str) -> subprocess.CompletedProcess:
    script = ROOT / "scripts" / script_name
    return subprocess.run(
        [PYTHON, str(script)],
        capture_output=True,
        text=True,
        cwd=str(ROOT),
    )


class TestScanTestids:
    def test_scan_testids_exits_zero(self):
        """scan_testids.py must exit 0 (no missing data-testid violations)."""
        result = run_script("scan_testids.py")
        assert result.returncode == 0, (
            f"scan_testids.py found violations:\n{result.stdout}\n{result.stderr}"
        )

    def test_scan_testids_reports_ok(self):
        """scan_testids.py output must start with OK:"""
        result = run_script("scan_testids.py")
        assert result.returncode == 0
        assert result.stdout.startswith("OK:"), f"Unexpected output: {result.stdout}"

    def test_scan_testids_scans_files(self):
        """scan_testids.py must scan at least 50 TSX files."""
        result = run_script("scan_testids.py")
        assert result.returncode == 0
        # Extract file count from "OK: N files scanned"
        import re
        m = re.search(r"OK: (\d+) files", result.stdout)
        assert m, f"Could not parse file count: {result.stdout}"
        count = int(m.group(1))
        assert count >= 50, f"Expected ≥50 files scanned, got {count}"


class TestScanPlaywright:
    def test_scan_playwright_exits_zero(self):
        """scan_playwright.py must exit 0 (no forbidden patterns in hardening specs)."""
        result = run_script("scan_playwright.py")
        assert result.returncode == 0, (
            f"scan_playwright.py found violations:\n{result.stdout}\n{result.stderr}"
        )

    def test_scan_playwright_reports_ok(self):
        """scan_playwright.py output must start with OK:"""
        result = run_script("scan_playwright.py")
        assert result.returncode == 0
        assert result.stdout.startswith("OK:"), f"Unexpected output: {result.stdout}"

    def test_scan_playwright_scans_specs(self):
        """scan_playwright.py must scan at least 10 hardening specs."""
        result = run_script("scan_playwright.py")
        assert result.returncode == 0
        import re
        m = re.search(r"OK: (\d+) hardening specs", result.stdout)
        assert m, f"Could not parse spec count: {result.stdout}"
        count = int(m.group(1))
        assert count >= 10, f"Expected ≥10 specs scanned, got {count}"


class TestContributingDocs:
    def test_contributing_md_exists(self):
        """docs/CONTRIBUTING.md must exist."""
        docs = ROOT / "docs" / "CONTRIBUTING.md"
        assert docs.exists(), f"CONTRIBUTING.md not found at {docs}"

    def test_contributing_md_has_testid_section(self):
        """docs/CONTRIBUTING.md must document the data-testid requirement."""
        docs = ROOT / "docs" / "CONTRIBUTING.md"
        content = docs.read_text(encoding="utf-8")
        assert "data-testid" in content, "CONTRIBUTING.md missing data-testid section"

    def test_contributing_md_has_forbidden_patterns_section(self):
        """docs/CONTRIBUTING.md must document forbidden Playwright patterns."""
        docs = ROOT / "docs" / "CONTRIBUTING.md"
        content = docs.read_text(encoding="utf-8")
        assert "waitForTimeout" in content, "CONTRIBUTING.md missing waitForTimeout section"
        assert "getByText" in content, "CONTRIBUTING.md missing getByText section"

    def test_contributing_md_has_wave_proof_table(self):
        """docs/CONTRIBUTING.md must document wave proof requirements."""
        docs = ROOT / "docs" / "CONTRIBUTING.md"
        content = docs.read_text(encoding="utf-8")
        assert "Wave Proof" in content or "wave" in content.lower()
        assert "pytest" in content.lower()
        assert "playwright" in content.lower()


class TestScannerDetection:
    """Verify scanners correctly identify violations in synthetic test content."""

    def test_scan_testids_rejects_button_without_testid(self, tmp_path):
        """Scanner must flag a button missing data-testid."""
        # Create a synthetic TSX file with a violation
        fake_tsx = tmp_path / "BadComponent.tsx"
        fake_tsx.write_text('<button onClick={handler}>Click</button>\n')

        script = ROOT / "scripts" / "scan_testids.py"
        # Run scanner against this file directly by importing the module
        import importlib.util
        spec = importlib.util.spec_from_file_location("scan_testids", script)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)

        violations = mod.scan_file(fake_tsx)
        assert len(violations) == 1, f"Expected 1 violation, got {violations}"

    def test_scan_testids_accepts_button_with_testid(self, tmp_path):
        """Scanner must accept a button that has data-testid."""
        fake_tsx = tmp_path / "GoodComponent.tsx"
        fake_tsx.write_text('<button data-testid="my-btn" onClick={handler}>Click</button>\n')

        script = ROOT / "scripts" / "scan_testids.py"
        import importlib.util
        spec = importlib.util.spec_from_file_location("scan_testids", script)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)

        violations = mod.scan_file(fake_tsx)
        assert len(violations) == 0, f"Expected 0 violations, got {violations}"

    def test_scan_playwright_rejects_wait_for_timeout(self, tmp_path):
        """Scanner must flag waitForTimeout in a spec file."""
        fake_spec = tmp_path / "bad.spec.ts"
        fake_spec.write_text("await page.waitForTimeout(1000);\n")

        script = ROOT / "scripts" / "scan_playwright.py"
        import importlib.util
        spec_mod = importlib.util.spec_from_file_location("scan_playwright", script)
        mod = importlib.util.module_from_spec(spec_mod)
        spec_mod.loader.exec_module(mod)

        violations = mod.scan_file(fake_spec)
        assert len(violations) == 1, f"Expected 1 violation, got {violations}"

    def test_scan_playwright_rejects_get_by_text(self, tmp_path):
        """Scanner must flag getByText in a spec file."""
        fake_spec = tmp_path / "bad.spec.ts"
        fake_spec.write_text("await page.getByText('Submit').click();\n")

        script = ROOT / "scripts" / "scan_playwright.py"
        import importlib.util
        spec_mod = importlib.util.spec_from_file_location("scan_playwright", script)
        mod = importlib.util.module_from_spec(spec_mod)
        spec_mod.loader.exec_module(mod)

        violations = mod.scan_file(fake_spec)
        assert len(violations) == 1, f"Expected 1 violation, got {violations}"
