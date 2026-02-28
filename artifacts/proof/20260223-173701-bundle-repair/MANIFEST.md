# Bundle Repair Proof Pack

**Date:** 2026-02-23 17:37 UTC  
**Agent:** Release Artifact Repair Agent  
**Commit:** 5f88f59 (Reality Repair, main)

## Summary

Bundle `artifacts/submission_bundle.zip` verified by unzip-l equivalent; all required entries present.

| Metric | Value |
|--------|-------|
| Total files | 27 |
| Total size | 8.10 MB |
| screenshots count | 13 ≥ 10 ✓ |
| TOUR.webm size | 7.47 MB ≥ 1 MB ✓ |
| Required entries | 8/8 ✓ |
| pytest gate | 21/21 passed ✓ |
| Generator exit code | 0 ✓ |

## Root Cause

Old `generate_submission_bundle.py` (Wave 126) only bundled a hardcoded list of doc files.  
Screenshots and TOUR.webm were never referenced.

## Fix Applied

1. Replaced `scripts/generate_submission_bundle.py` with staging-directory approach  
   - Walks all of `artifacts/submission_bundle_staging/**` and adds every file  
   - Mandatory verification step asserts 8 required entries + MIN_SCREENSHOTS=10 + TOUR.webm ≥ 1 MB  
   - Exits non-zero on any failure  
2. Created `artifacts/submission_bundle_staging/` with all 27 required files  
3. Fixed `proof/determinism-diff.txt` encoding: rewritten as UTF-8 (was UTF-16 LE from PowerShell)  
4. Added `phase1/tests/integration/test_submission_bundle_contents.py` pytest gate (21 tests)  
5. Updated `Makefile` `bundle` target: runs generator + listing print + pytest gate

## Files in this Proof Pack

- `logs/bundle_build.txt` — Full unzip-l listing + required-entry verification + pytest result
