"""
test_submission_bundle_contents.py
====================================
Pytest gate: opens artifacts/submission_bundle.zip and asserts the required
entries for Devpost submission are all present and correctly sized.

Run:
    cd phase1
    pytest tests/integration/test_submission_bundle_contents.py -v

CI gate — fails (non-zero) if any required entry is missing or TOUR.webm is < 1 MB.
"""
from __future__ import annotations

import fnmatch
import zipfile
from pathlib import Path

import pytest

# ──────────────────────────────────────────────────────────────────────────────
# Locate the bundle relative to this file (phase1/tests/integration/ → ../../..)
# ──────────────────────────────────────────────────────────────────────────────
REPO_ROOT = Path(__file__).resolve().parent.parent.parent.parent
BUNDLE_PATH = REPO_ROOT / "artifacts" / "submission_bundle.zip"

MIN_SCREENSHOTS = 10
SCREENSHOT_GLOB = "screenshots/*.png"
TOUR_MIN_BYTES = 1 * 1024 * 1024  # 1 MB

REQUIRED_ENTRIES = [
    "TOUR.webm",
    "MANIFEST.md",
    "proof/determinism-run1.json",
    "proof/determinism-run2.json",
    "proof/determinism-diff.txt",
    "docs/submission/CHECKLIST.md",
    "docs/submission/TERRACODE_DEMO_SCRIPT.md",
    "docs/submission/ELASTIHACK_DEMO_SCRIPT.md",
]


# ──────────────────────────────────────────────────────────────────────────────
# Fixtures
# ──────────────────────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def bundle_zip():
    """Open the submission bundle and return (ZipFile, members_set, info_map)."""
    if not BUNDLE_PATH.exists():
        pytest.skip(
            f"artifacts/submission_bundle.zip not found at {BUNDLE_PATH}. "
            "Run `python scripts/generate_submission_bundle.py` first."
        )
    with zipfile.ZipFile(BUNDLE_PATH, "r") as zf:
        members = set(zf.namelist())
        info_map = {i.filename: i for i in zf.infolist()}
        yield zf, members, info_map


@pytest.fixture(scope="module")
def members(bundle_zip):
    _, m, _ = bundle_zip
    return m


@pytest.fixture(scope="module")
def info_map(bundle_zip):
    _, _, im = bundle_zip
    return im


# ──────────────────────────────────────────────────────────────────────────────
# Tests
# ──────────────────────────────────────────────────────────────────────────────

class TestBundleExists:
    def test_bundle_file_exists(self):
        """The zip archive itself must be present."""
        assert BUNDLE_PATH.exists(), (
            f"submission_bundle.zip not found at {BUNDLE_PATH}. "
            "Run `python scripts/generate_submission_bundle.py`."
        )

    def test_bundle_is_valid_zip(self):
        """The file must be a valid zip archive (not corrupt, no appended bytes hack)."""
        assert zipfile.is_zipfile(BUNDLE_PATH), (
            f"{BUNDLE_PATH} is not a valid zip file."
        )


@pytest.mark.parametrize("entry", REQUIRED_ENTRIES)
class TestRequiredEntries:
    def test_required_entry_present(self, entry: str, members):
        """Each required entry must appear as a zip member."""
        assert entry in members, (
            f"Required zip entry '{entry}' is missing from submission_bundle.zip. "
            f"Run `python scripts/generate_submission_bundle.py` to regenerate."
        )


class TestScreenshots:
    def test_screenshot_count(self, members):
        """There must be at least MIN_SCREENSHOTS png files in screenshots/."""
        shots = [m for m in members if fnmatch.fnmatch(m, SCREENSHOT_GLOB)]
        assert len(shots) >= MIN_SCREENSHOTS, (
            f"Only {len(shots)} screenshot(s) found in zip (need >= {MIN_SCREENSHOTS}). "
            f"Found: {shots}"
        )

    def test_screenshots_are_files(self, bundle_zip):
        """Each screenshot entry must have non-zero compressed size."""
        _, members, info_map = bundle_zip
        shots = [m for m in members if fnmatch.fnmatch(m, SCREENSHOT_GLOB)]
        for shot in shots:
            size = info_map[shot].file_size
            assert size > 0, f"Screenshot {shot} has zero bytes — likely empty."


class TestTourVideo:
    def test_tour_webm_present(self, members):
        """TOUR.webm must be a zip member."""
        assert "TOUR.webm" in members, "TOUR.webm is missing from submission_bundle.zip"

    def test_tour_webm_size_minimum(self, info_map):
        """TOUR.webm must be >= 1 MB (proves it is a real video, not an empty placeholder)."""
        size = info_map.get("TOUR.webm", None)
        assert size is not None, "TOUR.webm info not found"
        assert size.file_size >= TOUR_MIN_BYTES, (
            f"TOUR.webm is only {size.file_size} bytes — "
            f"need >= {TOUR_MIN_BYTES} (1 MB). "
            "Re-run the Playwright tour spec to generate a full video."
        )


class TestDeterminismProof:
    def test_run1_present(self, members):
        assert "proof/determinism-run1.json" in members

    def test_run2_present(self, members):
        assert "proof/determinism-run2.json" in members

    def test_diff_present(self, members):
        assert "proof/determinism-diff.txt" in members

    def test_diff_content_says_deterministic(self, bundle_zip):
        """The diff file must contain a phrase confirming determinism (non-empty diff would say otherwise)."""
        zf, members, _ = bundle_zip
        assert "proof/determinism-diff.txt" in members
        raw = zf.read("proof/determinism-diff.txt")
        # Handle both UTF-8 (with or without BOM) and UTF-16 LE (PowerShell default)
        if raw[:2] in (b'\xff\xfe', b'\xfe\xff'):
            content = raw.decode("utf-16")
        else:
            content = raw.decode("utf-8", errors="replace")
        # Must contain confirmation phrase (written by generate_submission_bundle.py)
        assert "DETERMINISM PROOF" in content or "identical" in content, (
            "determinism-diff.txt does not contain expected determinism proof text. "
            f"Actual content: {content[:500]!r}"
        )


class TestDocsSubmission:
    def test_checklist_present(self, members):
        assert "docs/submission/CHECKLIST.md" in members

    def test_terracode_demo_present(self, members):
        assert "docs/submission/TERRACODE_DEMO_SCRIPT.md" in members

    def test_elastihack_demo_present(self, members):
        assert "docs/submission/ELASTIHACK_DEMO_SCRIPT.md" in members
