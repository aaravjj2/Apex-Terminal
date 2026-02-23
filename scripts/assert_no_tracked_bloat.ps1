#!/usr/bin/env pwsh
# assert_no_tracked_bloat.ps1
# Repo gate: fails if forbidden directories/files are tracked by git.
# Usage: scripts/assert_no_tracked_bloat.ps1
# Exits 1 if any tracked bloat is found.

param(
    [string]$Root = (Split-Path $PSScriptRoot -Parent)
)

Set-Location $Root

$forbidden = @(
    'node_modules/',
    '__pycache__/',
    '.pytest_cache/',
    'test-results/',
    'playwright-report/',
    'logs/',
    'artifacts/proof/',
    'htmlcov/',
    '.mypy_cache/',
    '.ruff_cache/'
)

$errors = @()
foreach ($pattern in $forbidden) {
    $tracked = git ls-files --error-unmatch -- "$pattern*" 2>&1
    if ($LASTEXITCODE -eq 0) {
        $count = (git ls-files -- "$pattern*" 2>$null | Measure-Object -Line).Lines
        if ($count -gt 0) {
            $errors += "BLOAT: $pattern has $count tracked files"
        }
    }
}

# Also check for Zone.Identifier files
$zoneFiles = git ls-files 2>$null | Select-String "Zone.Identifier" | Measure-Object -Line
if ($zoneFiles.Lines -gt 0) {
    $errors += "BLOAT: $($zoneFiles.Lines) Zone.Identifier files tracked"
}

if ($errors.Count -gt 0) {
    Write-Host "FAIL — Tracked bloat detected:" -ForegroundColor Red
    $errors | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
    exit 1
} else {
    Write-Host "PASS — No tracked bloat found" -ForegroundColor Green
    exit 0
}
