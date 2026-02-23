"""
Wave 110 — Submission kit v1 tests.
Verifies all submission assets are present and have meaningful content.
"""
from __future__ import annotations

import os
import re

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))


def _path(*parts: str) -> str:
    return os.path.join(ROOT, *parts)


def _read(*parts: str) -> str:
    with open(_path(*parts), encoding="utf-8") as f:
        return f.read()


# ─────────────────────────────────────────────────────────────────────────────
# File existence
# ─────────────────────────────────────────────────────────────────────────────

class TestSubmissionFiles:
    def test_license_exists(self):
        assert os.path.isfile(_path("LICENSE")), "LICENSE file missing"

    def test_terracode_md_exists(self):
        assert os.path.isfile(_path("docs", "submission", "TERRACODE.md"))

    def test_elastihack_md_exists(self):
        assert os.path.isfile(_path("docs", "submission", "ELASTIHACK.md"))

    def test_checklist_md_exists(self):
        assert os.path.isfile(_path("docs", "submission", "CHECKLIST.md"))

    def test_architecture_diagram_exists(self):
        # Either docs/ARCHITECTURE.md (Mermaid) or docs/img/architecture.* (image)
        md_exists = os.path.isfile(_path("docs", "ARCHITECTURE.md"))
        img_exists = any(
            os.path.isfile(_path("docs", "img", f))
            for f in ["architecture.svg", "architecture.png", "architecture.jpg"]
            if os.path.isdir(_path("docs", "img"))
        )
        assert md_exists or img_exists, \
            "Architecture diagram not found (expected docs/ARCHITECTURE.md or docs/img/architecture.*)"


# ─────────────────────────────────────────────────────────────────────────────
# LICENSE content
# ─────────────────────────────────────────────────────────────────────────────

class TestLicense:
    def test_license_is_osi(self):
        content = _read("LICENSE")
        # MIT, Apache 2.0, GPL, etc. are all OSI
        osi_keywords = ["MIT", "Apache", "GPL", "BSD", "ISC", "MPL"]
        assert any(k in content for k in osi_keywords), \
            "LICENSE should be an OSI-approved license (MIT, Apache, GPL, etc.)"

    def test_license_has_copyright(self):
        content = _read("LICENSE")
        assert "Copyright" in content or "copyright" in content


# ─────────────────────────────────────────────────────────────────────────────
# TERRACODE.md content
# ─────────────────────────────────────────────────────────────────────────────

class TestTerracode:
    def test_has_problem_section(self):
        content = _read("docs", "submission", "TERRACODE.md")
        assert "## Problem" in content or "# Problem" in content

    def test_has_solution_section(self):
        content = _read("docs", "submission", "TERRACODE.md")
        assert "## Solution" in content or "# Solution" in content

    def test_has_stack_section(self):
        content = _read("docs", "submission", "TERRACODE.md")
        assert "## Stack" in content or "Stack" in content

    def test_has_ai_section(self):
        content = _read("docs", "submission", "TERRACODE.md")
        assert "AI" in content

    def test_has_demo_script(self):
        content = _read("docs", "submission", "TERRACODE.md")
        assert "Demo" in content or "demo" in content

    def test_mentions_elasticsearch(self):
        content = _read("docs", "submission", "TERRACODE.md")
        assert "Elasticsearch" in content or "elasticsearch" in content.lower()

    def test_has_code_block(self):
        content = _read("docs", "submission", "TERRACODE.md")
        assert "```" in content, "Demo script should include a code block"


# ─────────────────────────────────────────────────────────────────────────────
# ELASTIHACK.md content
# ─────────────────────────────────────────────────────────────────────────────

class TestElastiHack:
    def test_has_elasticsearch_section(self):
        content = _read("docs", "submission", "ELASTIHACK.md")
        assert "Elasticsearch" in content

    def test_mentions_agent_builder(self):
        content = _read("docs", "submission", "ELASTIHACK.md")
        assert "Agent Builder" in content or "Agent builder" in content

    def test_has_tool_trace(self):
        content = _read("docs", "submission", "ELASTIHACK.md")
        assert "Tool Trace" in content or "tool trace" in content.lower() \
            or "trace" in content.lower()

    def test_has_citations(self):
        content = _read("docs", "submission", "ELASTIHACK.md")
        assert "citation" in content.lower() or "cite" in content.lower() \
            or "Citation" in content

    def test_has_safe_action(self):
        content = _read("docs", "submission", "ELASTIHACK.md")
        assert "safe action" in content.lower() or "Safe Action" in content

    def test_has_demo_script(self):
        content = _read("docs", "submission", "ELASTIHACK.md")
        assert "Demo" in content or "demo" in content

    def test_mentions_rbac(self):
        content = _read("docs", "submission", "ELASTIHACK.md")
        assert "RBAC" in content or "rbac" in content or "role" in content.lower()

    def test_has_es_indices_table(self):
        content = _read("docs", "submission", "ELASTIHACK.md")
        assert "apex-tickets" in content or "apex-controls" in content


# ─────────────────────────────────────────────────────────────────────────────
# CHECKLIST.md content
# ─────────────────────────────────────────────────────────────────────────────

class TestChecklist:
    def test_has_elastihack_section(self):
        content = _read("docs", "submission", "CHECKLIST.md")
        assert "ElastiHack" in content

    def test_has_terracode_section(self):
        content = _read("docs", "submission", "CHECKLIST.md")
        assert "TERRACODE" in content or "Terracode" in content

    def test_has_checkboxes(self):
        content = _read("docs", "submission", "CHECKLIST.md")
        assert "- [x]" in content or "- [ ]" in content

    def test_mentions_license(self):
        content = _read("docs", "submission", "CHECKLIST.md")
        assert "license" in content.lower() or "LICENSE" in content


# ─────────────────────────────────────────────────────────────────────────────
# Architecture document
# ─────────────────────────────────────────────────────────────────────────────

class TestArchitecture:
    def test_architecture_has_content(self):
        content = _read("docs", "ARCHITECTURE.md")
        assert len(content) > 200, "Architecture document too short"

    def test_architecture_mentions_elasticsearch(self):
        content = _read("docs", "ARCHITECTURE.md")
        assert "Elasticsearch" in content or "elasticsearch" in content.lower()

    def test_architecture_mentions_backend(self):
        content = _read("docs", "ARCHITECTURE.md")
        assert "FastAPI" in content or "backend" in content.lower()

    def test_architecture_mentions_frontend(self):
        content = _read("docs", "ARCHITECTURE.md")
        assert "React" in content or "frontend" in content.lower()
