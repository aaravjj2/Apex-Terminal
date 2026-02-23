#!/usr/bin/env bash
# Safe cleanup of local-only build/test outputs.
# NEVER deletes: keys.env, source code, git history.
# Usage: ./scripts/cleanup.sh [--dry-run] [--node-modules]

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DRY_RUN=false
INC_NM=false

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --node-modules) INC_NM=true ;;
  esac
done

remove_safe() {
  local path="$1" desc="$2"
  if [ -e "$path" ]; then
    if $DRY_RUN; then
      echo "[DRY-RUN] Would remove: $desc ($path)"
    else
      rm -rf "$path"
      echo "[REMOVED] $desc"
    fi
  fi
}

echo "=== Apex Terminal Cleanup ==="
$DRY_RUN && echo "(DRY RUN — no files deleted)"

# Test outputs
remove_safe "$ROOT/test-results" "Root test-results/"
remove_safe "$ROOT/playwright-report" "Root playwright-report/"
remove_safe "$ROOT/e2e-results" "Root e2e-results/"
remove_safe "$ROOT/frontend/test-results" "Frontend test-results/"
remove_safe "$ROOT/frontend/playwright-report" "Frontend playwright-report/"
remove_safe "$ROOT/frontend/e2e-results" "Frontend e2e-results/"
remove_safe "$ROOT/phase1/test-results" "Phase1 test-results/"
remove_safe "$ROOT/phase1/e2e-results" "Phase1 e2e-results/"

# Stale named directories
for d in "$ROOT"/playwright-report-* "$ROOT"/test-results-* \
         "$ROOT"/frontend/playwright-report-* "$ROOT"/frontend/test-results-*; do
  [ -d "$d" ] && remove_safe "$d" "Stale: $(basename "$d")"
done

# __pycache__
find "$ROOT" -type d -name "__pycache__" 2>/dev/null | while read -r p; do
  remove_safe "$p" "__pycache__: $p"
done

# .pytest_cache
find "$ROOT" -type d -name ".pytest_cache" 2>/dev/null | while read -r p; do
  remove_safe "$p" ".pytest_cache: $p"
done

# Root logs
find "$ROOT" -maxdepth 1 -name "*.log" -type f 2>/dev/null | while read -r f; do
  remove_safe "$f" "Root log: $(basename "$f")"
done

# Stale run outputs
find "$ROOT" -maxdepth 1 -type f \( -name "w*_*.txt" -o -name "pw_*.txt" -o -name "pytest_*.txt" -o -name "e2e_*.txt" \) 2>/dev/null | while read -r f; do
  remove_safe "$f" "Stale output: $(basename "$f")"
done

# Proof packs
remove_safe "$ROOT/proof" "proof/"
remove_safe "$ROOT/proofpacks" "proofpacks/"
remove_safe "$ROOT/submission_bundle.zip" "submission_bundle.zip"

# Build
remove_safe "$ROOT/frontend/dist" "Frontend dist/"

# Database files
find "$ROOT" -maxdepth 1 -name "*.db" -type f 2>/dev/null | while read -r f; do
  remove_safe "$f" "Database: $(basename "$f")"
done

# Node modules (optional)
if $INC_NM; then
  remove_safe "$ROOT/node_modules" "Root node_modules/"
  remove_safe "$ROOT/frontend/node_modules" "Frontend node_modules/"
fi

echo "=== Cleanup complete ==="
