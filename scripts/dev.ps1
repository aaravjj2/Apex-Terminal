#!/usr/bin/env pwsh
# scripts/dev.ps1
# Apex Terminal — Windows dev launcher
# Usage:
#   .\scripts\dev.ps1 up       # start backend + frontend + ES
#   .\scripts\dev.ps1 down     # stop all services
#   .\scripts\dev.ps1 api      # start backend only
#   .\scripts\dev.ps1 web      # start frontend only
#   .\scripts\dev.ps1 test     # run tsc + vitest + pytest
#   .\scripts\dev.ps1 e2e      # run Playwright headed suite
#   .\scripts\dev.ps1 proof    # run full proof pack generation

param(
    [Parameter(Position=0)]
    [ValidateSet('up','down','api','web','test','e2e','proof','es')]
    [string]$Target = 'up'
)

$Root = Split-Path $PSScriptRoot -Parent
$BackendDir = Join-Path $Root "phase1"
$FrontendDir = Join-Path $Root "frontend"
$KeysEnv = Join-Path $Root "keys.env"
$ProofDir = Join-Path $Root "artifacts/proof"

function Load-Keys {
    if (Test-Path $KeysEnv) {
        Get-Content $KeysEnv | ForEach-Object {
            if ($_ -match '^([^#=\s]+)\s*=\s*(.*)$') {
                [System.Environment]::SetEnvironmentVariable($Matches[1], $Matches[2])
            }
        }
        Write-Host "Keys loaded from keys.env" -ForegroundColor Green
    } else {
        Write-Warning "keys.env not found at $KeysEnv"
    }
}

function Start-ES {
    $esDir = "$env:USERPROFILE\elasticsearch\elasticsearch-8.17.0"
    if (Test-Path "$esDir\bin\elasticsearch.bat") {
        $existing = netstat -ano 2>$null | Select-String ":9200" | Select-Object -First 1
        if ($existing) {
            Write-Host "ES already running on :9200" -ForegroundColor Yellow
        } else {
            Start-Process "$esDir\bin\elasticsearch.bat" -WindowStyle Hidden
            Write-Host "ES starting…" -ForegroundColor Cyan
            Start-Sleep 10
        }
    } else {
        Write-Warning "Elasticsearch not found at $esDir"
    }
}

function Start-Backend {
    Write-Host "Starting backend on :8090…" -ForegroundColor Cyan
    $env:DATABASE_URL = "sqlite+aiosqlite:///./phase1.db"
    Start-Process -FilePath "C:\Python314\python.exe" `
        -ArgumentList "-m uvicorn services.api.main:app --host 0.0.0.0 --port 8090" `
        -WorkingDirectory $BackendDir -WindowStyle Minimized
    Start-Sleep 4
    try {
        $r = Invoke-RestMethod http://127.0.0.1:8090/health -TimeoutSec 5
        Write-Host "Backend LIVE: status=$($r.status)" -ForegroundColor Green
    } catch {
        Write-Warning "Backend health check failed (may still be starting)"
    }
}

function Start-Frontend {
    Write-Host "Starting frontend on :5100…" -ForegroundColor Cyan
    Start-Process -FilePath "cmd.exe" `
        -ArgumentList "/c npm run dev -- --port 5100" `
        -WorkingDirectory $FrontendDir -WindowStyle Minimized
    Start-Sleep 6
    Write-Host "Frontend started" -ForegroundColor Green
}

switch ($Target) {
    'up' {
        Load-Keys
        Start-ES
        Start-Backend
        Start-Frontend
        Write-Host "`nAll services started:" -ForegroundColor Green
        Write-Host "  Backend:  http://127.0.0.1:8090" -ForegroundColor White
        Write-Host "  Frontend: http://localhost:5100/ui2/dashboard" -ForegroundColor White
        Write-Host "  ES:       http://localhost:9200" -ForegroundColor White
    }
    'down' {
        Stop-Process -Name python -Force -ErrorAction SilentlyContinue
        Stop-Process -Name node -Force -ErrorAction SilentlyContinue
        Write-Host "All services stopped" -ForegroundColor Yellow
    }
    'api' {
        Load-Keys
        Start-Backend
    }
    'web' {
        Start-Frontend
    }
    'es' {
        Start-ES
    }
    'test' {
        Write-Host "=== tsc ===" -ForegroundColor Cyan
        Set-Location $FrontendDir
        npx.cmd tsc --noEmit
        if ($LASTEXITCODE -ne 0) { exit 1 }
        Write-Host "=== vitest ===" -ForegroundColor Cyan
        npx.cmd vitest run
        if ($LASTEXITCODE -ne 0) { exit 1 }
        Write-Host "=== pytest root ===" -ForegroundColor Cyan
        Set-Location $Root
        C:\Python314\python.exe -m pytest tests/ -x -q
        if ($LASTEXITCODE -ne 0) { exit 1 }
        Write-Host "=== pytest phase1 ===" -ForegroundColor Cyan
        $env:ELASTICSEARCH_URL = "http://localhost:9200"
        Set-Location (Join-Path $Root "phase1")
        C:\Python314\python.exe -m pytest tests/ -x -q
        if ($LASTEXITCODE -ne 0) { exit 1 }
        Write-Host "=== ALL TESTS PASSED ===" -ForegroundColor Green
    }
    'e2e' {
        Set-Location $FrontendDir
        npx.cmd playwright test tests/e2e/hardening/ --reporter=line
    }
    'proof' {
        $ts = Get-Date -Format 'yyyyMMdd-HHmmss'
        $dir = Join-Path $ProofDir "$ts-w81-w130"
        New-Item -ItemType Directory -Force $dir | Out-Null
        Write-Host "Proof pack: $dir"
        # Run all gates and capture
        Set-Location $FrontendDir
        npx.cmd tsc --noEmit 2>&1 | Out-File "$dir\gate-tsc.txt" -Encoding UTF8
        npx.cmd vitest run 2>&1 | Out-File "$dir\gate-vitest.txt" -Encoding UTF8
        Set-Location $Root
        C:\Python314\python.exe -m pytest tests/ -x -q 2>&1 | Out-File "$dir\gate-pytest-root.txt" -Encoding UTF8
        $env:ELASTICSEARCH_URL = "http://localhost:9200"
        Set-Location (Join-Path $Root "phase1")
        C:\Python314\python.exe -m pytest tests/ -x -q 2>&1 | Out-File "$dir\gate-pytest-phase1.txt" -Encoding UTF8
        Set-Location $FrontendDir
        npx.cmd playwright test tests/e2e/hardening/ --reporter=line 2>&1 | Out-File "$dir\gate-playwright-run1.txt" -Encoding UTF8
        npx.cmd playwright test tests/e2e/hardening/ --reporter=line 2>&1 | Out-File "$dir\gate-playwright-run2.txt" -Encoding UTF8
        Write-Host "Proof pack complete at: $dir" -ForegroundColor Green
    }
}
