#!/usr/bin/env pwsh
# scripts/clean_workspace.ps1
# Safe workspace cleanup — removes local bloat without touching keys or source.
# Usage:
#   scripts/clean_workspace.ps1         # actually clean
#   scripts/clean_workspace.ps1 --dry   # dry run (show what would be removed)

param(
    [switch]$Dry = $false
)

$Root = Split-Path $PSScriptRoot -Parent

$toDelete = @(
    # Python caches
    (Get-ChildItem $Root -Recurse -Directory -Filter "__pycache__" -ErrorAction SilentlyContinue | Where-Object { $_.FullName -notmatch '\.git' }),
    (Get-ChildItem $Root -Recurse -Directory -Filter ".pytest_cache" -ErrorAction SilentlyContinue),
    (Get-ChildItem $Root -Recurse -Directory -Filter ".mypy_cache" -ErrorAction SilentlyContinue),
    (Get-ChildItem $Root -Recurse -Directory -Filter ".ruff_cache" -ErrorAction SilentlyContinue),
    # Test output
    (Get-ChildItem $Root -Recurse -Directory -Filter "test-results" -ErrorAction SilentlyContinue | Where-Object { $_.FullName -notmatch '\.git' }),
    (Get-ChildItem $Root -Recurse -Directory -Filter "playwright-report" -ErrorAction SilentlyContinue | Where-Object { $_.FullName -notmatch '\.git' }),
    (Get-ChildItem $Root -Recurse -Directory -Filter "blob-report" -ErrorAction SilentlyContinue),
    # Build outputs
    (Get-ChildItem $Root -Recurse -Directory -Filter "dist" -ErrorAction SilentlyContinue | Where-Object { $_.FullName -notmatch 'node_modules|\.git' }),
    (Get-ChildItem $Root -Recurse -Directory -Filter "htmlcov" -ErrorAction SilentlyContinue)
)

$logFiles = Get-ChildItem $Root -File -Filter "*.log" -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -notmatch 'node_modules|\.git|\.venv' }

$outFiles = Get-ChildItem $Root -File -Filter "*.out" -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -notmatch 'node_modules|\.git|\.venv' }

$allItems = ($toDelete | ForEach-Object { $_ }) + @($logFiles) + @($outFiles) |
    Where-Object { $_ -ne $null }

if ($allItems.Count -eq 0) {
    Write-Host "Nothing to clean." -ForegroundColor Green
    exit 0
}

foreach ($item in $allItems) {
    if ($Dry) {
        Write-Host "[DRY] Would remove: $($item.FullName)" -ForegroundColor Yellow
    } else {
        try {
            Remove-Item -LiteralPath $item.FullName -Recurse -Force -ErrorAction SilentlyContinue
            Write-Host "Removed: $($item.FullName)" -ForegroundColor Gray
        } catch {
            Write-Warning "Could not remove: $($item.FullName): $_"
        }
    }
}

if (-not $Dry) {
    Write-Host "Workspace cleaned." -ForegroundColor Green
}
