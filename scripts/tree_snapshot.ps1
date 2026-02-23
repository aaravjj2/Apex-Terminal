#!/usr/bin/env pwsh
# tree_snapshot.ps1
# Deterministic repo tree snapshot — excludes bloat folders.
# Usage: scripts/tree_snapshot.ps1 > docs/migration/W81_tree_before.txt

param(
    [string]$Root = (Split-Path $PSScriptRoot -Parent),
    [string]$Output = ""
)

$excludeDirs = @(
    'node_modules', '__pycache__', '.venv', '.pytest_cache',
    'test-results', 'playwright-report', 'logs', 'artifacts',
    '.git', '.cache', 'dist', 'build', '.next', 'coverage',
    'htmlcov', '.mypy_cache', '.ruff_cache', 'proofpacks',
    'e2e-results', 'devpost_media', 'content', 'tts_cache.db'
)

function Get-Tree {
    param([string]$Path, [string]$Prefix = "")
    $items = Get-ChildItem -Path $Path -Force |
        Where-Object { $_.Name -notmatch '^_Zone\.Identifier$' -and
                       $excludeDirs -notcontains $_.Name } |
        Sort-Object { $_.PSIsContainer }, Name

    for ($i = 0; $i -lt $items.Count; $i++) {
        $item = $items[$i]
        $isLast = ($i -eq $items.Count - 1)
        $connector = if ($isLast) { '└── ' } else { '├── ' }
        $extension = if ($isLast) { '    ' } else { '│   ' }
        $suffix = if ($item.PSIsContainer) { '/' } else { '' }
        Write-Output "${Prefix}${connector}$($item.Name)${suffix}"
        if ($item.PSIsContainer) {
            Get-Tree -Path $item.FullName -Prefix "${Prefix}${extension}"
        }
    }
}

$header = @"
# Apex Terminal — Repo Tree Snapshot
# Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss UTC')
# Root: $Root
# Excludes: $($excludeDirs -join ', ')
#
"@

$treeOutput = & { Write-Output $header; Get-Tree -Path $Root }

if ($Output) {
    $treeOutput | Set-Content -Path $Output -Encoding UTF8
    Write-Host "Written to $Output"
} else {
    $treeOutput
}
