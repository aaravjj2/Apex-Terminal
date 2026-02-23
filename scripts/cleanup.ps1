<#
.SYNOPSIS
  Safe cleanup of local-only build/test outputs.
  NEVER deletes: keys.env, source code, git history, node_modules (use separately).
.DESCRIPTION
  Removes: test results, playwright reports, proof packs, log files, __pycache__,
  stale run outputs, and build artifacts.
  Safe: only touches gitignored / generated outputs.
#>

param(
    [switch]$DryRun,
    [switch]$IncludeNodeModules
)

$root = Split-Path -Parent $PSScriptRoot

function Remove-SafeItem {
    param([string]$Path, [string]$Description)
    if (Test-Path $Path) {
        if ($DryRun) {
            Write-Host "[DRY-RUN] Would remove: $Description ($Path)" -ForegroundColor Yellow
        } else {
            Remove-Item -Recurse -Force $Path -ErrorAction SilentlyContinue
            Write-Host "[REMOVED] $Description" -ForegroundColor Green
        }
    }
}

Write-Host "=== Apex Terminal Cleanup ===" -ForegroundColor Cyan
if ($DryRun) { Write-Host "(DRY RUN - no files will be deleted)" -ForegroundColor Yellow }

# Test results and playwright reports
Remove-SafeItem "$root\test-results" "Root test-results/"
Remove-SafeItem "$root\playwright-report" "Root playwright-report/"
Remove-SafeItem "$root\e2e-results" "Root e2e-results/"
Remove-SafeItem "$root\frontend\test-results" "Frontend test-results/"
Remove-SafeItem "$root\frontend\playwright-report" "Frontend playwright-report/"
Remove-SafeItem "$root\frontend\e2e-results" "Frontend e2e-results/"
Remove-SafeItem "$root\phase1\test-results" "Phase1 test-results/"
Remove-SafeItem "$root\phase1\e2e-results" "Phase1 e2e-results/"

# Stale named report/result directories
Get-ChildItem -Path $root -Directory -Filter "playwright-report-*" -ErrorAction SilentlyContinue | ForEach-Object {
    Remove-SafeItem $_.FullName "Stale playwright report: $($_.Name)"
}
Get-ChildItem -Path $root -Directory -Filter "test-results-*" -ErrorAction SilentlyContinue | ForEach-Object {
    Remove-SafeItem $_.FullName "Stale test results: $($_.Name)"
}
Get-ChildItem -Path "$root\frontend" -Directory -Filter "playwright-report-*" -ErrorAction SilentlyContinue | ForEach-Object {
    Remove-SafeItem $_.FullName "Stale frontend playwright report: $($_.Name)"
}
Get-ChildItem -Path "$root\frontend" -Directory -Filter "test-results-*" -ErrorAction SilentlyContinue | ForEach-Object {
    Remove-SafeItem $_.FullName "Stale frontend test results: $($_.Name)"
}

# __pycache__ directories
Get-ChildItem -Path $root -Directory -Recurse -Filter "__pycache__" -ErrorAction SilentlyContinue | ForEach-Object {
    Remove-SafeItem $_.FullName "Python cache: $($_.Name) in $($_.Parent.Name)"
}

# .pytest_cache directories
Get-ChildItem -Path $root -Directory -Recurse -Filter ".pytest_cache" -ErrorAction SilentlyContinue | ForEach-Object {
    Remove-SafeItem $_.FullName "Pytest cache: $($_.FullName -replace [regex]::Escape($root), '')"
}

# Stale log files at root
Get-ChildItem -Path $root -File -Filter "*.log" -ErrorAction SilentlyContinue | ForEach-Object {
    Remove-SafeItem $_.FullName "Root log: $($_.Name)"
}

# Stale run output files (w*_*.txt, pw_*.txt, pytest_*.txt)
Get-ChildItem -Path $root -File | Where-Object { $_.Name -match '^(w\d+|pw_|pytest_|e2e_).*\.txt$' } | ForEach-Object {
    Remove-SafeItem $_.FullName "Stale run output: $($_.Name)"
}

# Proof packs (local only, not committed)
Remove-SafeItem "$root\proof" "proof/ directory"
Remove-SafeItem "$root\proofpacks" "proofpacks/ directory"
Remove-SafeItem "$root\submission_bundle.zip" "submission_bundle.zip"

# Build dist
Remove-SafeItem "$root\frontend\dist" "Frontend dist/"

# Database files
Get-ChildItem -Path $root -File -Filter "*.db" -ErrorAction SilentlyContinue | Where-Object { $_.Name -ne "keys.env" } | ForEach-Object {
    Remove-SafeItem $_.FullName "Database: $($_.Name)"
}

# Node modules (optional)
if ($IncludeNodeModules) {
    Remove-SafeItem "$root\node_modules" "Root node_modules/"
    Remove-SafeItem "$root\frontend\node_modules" "Frontend node_modules/"
}

Write-Host "`n=== Cleanup complete ===" -ForegroundColor Cyan
