"""
Wave 126 â€” Submission bundle generation.

Verifies:
  - generate_submission_bundle.py exists and has correct structure
  - Bundle script references required files
  - Makefile has a bundle target
"""
from __future__ import annotations

import os

WORKSPACE = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..")
)


class TestW126Bundle:
    def test_bundle_script_exists(self):
        path = os.path.join(WORKSPACE, "scripts", "generate_submission_bundle.py")
        assert os.path.isfile(path)

    def test_bundle_script_has_zipfile(self):
        path = os.path.join(WORKSPACE, "scripts", "generate_submission_bundle.py")
        content = open(path, encoding='utf-8').read()
        assert "zipfile" in content or "zip" in content.lower()

    def test_bundle_script_references_docs(self):
        path = os.path.join(WORKSPACE, "scripts", "generate_submission_bundle.py")
        content = open(path, encoding='utf-8').read()
        assert "docs" in content

    def test_makefile_has_bundle_target(self):
        path = os.path.join(WORKSPACE, "Makefile")
        assert os.path.isfile(path)
        content = open(path, encoding='utf-8').read()
        assert "bundle" in content

    def test_scripts_directory_exists(self):
        path = os.path.join(WORKSPACE, "scripts")
        assert os.path.isdir(path)

    def test_proof_directory_exists(self):
        path = os.path.join(WORKSPACE, "proof")
        assert os.path.isdir(path)

    def test_w126_spec_exists(self):
        spec = os.path.join(
            WORKSPACE, "frontend", "tests", "e2e", "hardening", "w126-bundle.spec.ts"
        )
        assert os.path.isfile(spec)

