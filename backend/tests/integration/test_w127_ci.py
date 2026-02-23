"""
Wave 127 â€” CI / Makefile gate.

Verifies:
  - Makefile has all required targets: test, e2e, secrets, compliance, bundle, determinism, 3x
  - scripts/run_3x.ps1 exists
  - scripts/determinism_check.py exists
"""
from __future__ import annotations

import os

WORKSPACE = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..")
)

REQUIRED_TARGETS = ["test", "e2e", "secrets", "compliance", "bundle", "determinism", "3x"]


class TestW127CI:
    def test_makefile_exists(self):
        path = os.path.join(WORKSPACE, "Makefile")
        assert os.path.isfile(path)

    def test_makefile_has_all_targets(self):
        path = os.path.join(WORKSPACE, "Makefile")
        content = open(path, encoding='utf-8').read()
        missing = [t for t in REQUIRED_TARGETS if t not in content]
        assert not missing, f"Makefile missing targets: {missing}"

    def test_run_3x_exists(self):
        path = os.path.join(WORKSPACE, "scripts", "run_3x.ps1")
        assert os.path.isfile(path)

    def test_run_3x_has_loop(self):
        path = os.path.join(WORKSPACE, "scripts", "run_3x.ps1")
        content = open(path, encoding='utf-8').read()
        assert "3" in content or "for" in content.lower() or "loop" in content.lower()

    def test_determinism_check_exists(self):
        path = os.path.join(WORKSPACE, "scripts", "determinism_check.py")
        assert os.path.isfile(path)

    def test_determinism_check_has_subprocess(self):
        path = os.path.join(WORKSPACE, "scripts", "determinism_check.py")
        content = open(path, encoding='utf-8').read()
        assert "subprocess" in content

    def test_w127_spec_exists(self):
        spec = os.path.join(
            WORKSPACE, "frontend", "tests", "e2e", "hardening", "w127-ci.spec.ts"
        )
        assert os.path.isfile(spec)

