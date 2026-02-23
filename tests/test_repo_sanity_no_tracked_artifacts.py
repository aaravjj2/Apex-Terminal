"""
W83 Repo Sanity — No Tracked Artifacts
Fails if forbidden directories/files are tracked by git.
"""
import subprocess
import os
import pytest


FORBIDDEN_PATTERNS = [
    "node_modules/",
    "__pycache__/",
    ".pytest_cache/",
    "test-results/",
    "playwright-report/",
    "artifacts/proof/",
    "htmlcov/",
    ".mypy_cache/",
    ".ruff_cache/",
    "proofpacks/",
]


def git_ls_files(pattern: str) -> list[str]:
    """Return a list of tracked git files matching pattern."""
    result = subprocess.run(
        ["git", "ls-files", "--", f"{pattern}*"],
        capture_output=True,
        text=True,
        cwd=os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    )
    lines = [l.strip() for l in result.stdout.splitlines() if l.strip()]
    return lines


@pytest.mark.parametrize("pattern", FORBIDDEN_PATTERNS)
def test_no_tracked_bloat(pattern):
    """No files matching forbidden pattern should be tracked by git."""
    tracked = git_ls_files(pattern)
    assert len(tracked) == 0, (
        f"Found {len(tracked)} tracked file(s) under '{pattern}':\n"
        + "\n".join(f"  {f}" for f in tracked[:10])
    )


def test_no_zone_identifier_files_tracked():
    """Windows Zone.Identifier files should never be tracked."""
    result = subprocess.run(
        ["git", "ls-files"],
        capture_output=True,
        text=True,
        cwd=os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    )
    zone_files = [l for l in result.stdout.splitlines() if "Zone.Identifier" in l]
    assert len(zone_files) == 0, (
        f"Found {len(zone_files)} tracked Zone.Identifier file(s):\n"
        + "\n".join(f"  {f}" for f in zone_files[:10])
    )


def test_retention_doc_exists():
    """docs/RETENTION.md must exist (Wave 83 deliverable)."""
    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    retention = os.path.join(repo_root, "docs", "RETENTION.md")
    assert os.path.exists(retention), f"Missing: {retention}"


def test_clean_workspace_script_exists():
    """scripts/clean_workspace.ps1 must exist (Wave 83 deliverable)."""
    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    script = os.path.join(repo_root, "scripts", "clean_workspace.ps1")
    assert os.path.exists(script), f"Missing: {script}"


def test_gitignore_has_required_patterns():
    """gitignore must contain all required exclusion patterns."""
    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    gitignore = os.path.join(repo_root, ".gitignore")
    content = open(gitignore).read()
    required = [
        "node_modules/",
        "__pycache__/",
        ".pytest_cache/",
        "test-results/",
        "playwright-report/",
        "logs/",
        "artifacts/",
    ]
    for pattern in required:
        assert pattern in content, f".gitignore missing: {pattern}"
