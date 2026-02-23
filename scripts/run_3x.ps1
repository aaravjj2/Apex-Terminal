# run_3x.ps1 - Wave 118 zero-flake harness
param()

$ROOT_DIR      = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$FRONTEND_DIR  = Join-Path $ROOT_DIR "frontend"
$PROOF_DIR     = Join-Path $ROOT_DIR "proof"
$LOGS_DIR      = Join-Path $PROOF_DIR "logs"
New-Item -ItemType Directory -Force -Path $PROOF_DIR | Out-Null
New-Item -ItemType Directory -Force -Path $LOGS_DIR  | Out-Null

$specs = @(
    "tests/e2e/hardening/w117-visual-stability.spec.ts",
    "tests/e2e/hardening/w118-zero-flake.spec.ts",
    "tests/e2e/hardening/w119-determinism.spec.ts",
    "tests/e2e/hardening/w120-onboarding.spec.ts",
    "tests/e2e/hardening/w121-runbooks.spec.ts",
    "tests/e2e/hardening/w122-secrets.spec.ts",
    "tests/e2e/hardening/w123-compliance.spec.ts",
    "tests/e2e/hardening/w124-tour-terracode.spec.ts",
    "tests/e2e/hardening/w125-tour-elastihack.spec.ts",
    "tests/e2e/hardening/w126-bundle.spec.ts",
    "tests/e2e/hardening/w127-ci.spec.ts",
    "tests/e2e/hardening/w128-ux-declutter.spec.ts",
    "tests/e2e/hardening/w129-incident-drills.spec.ts",
    "tests/e2e/hardening/w130-final-proof.spec.ts"
)

$summaries = @()
$counts    = @()

Write-Host "========================================"
Write-Host "  3x FLAKE DETECTOR -- W117-W130"
Write-Host "========================================"

for ($i = 1; $i -le 3; $i++) {
    Write-Host ""
    Write-Host "--- Run $i / 3 ---"
    $logFile = Join-Path $LOGS_DIR "run_3x_run${i}.txt"

    Push-Location $FRONTEND_DIR
    $rawOut = npx playwright test $specs --reporter=line --workers=1 --retries=0 2>&1
    Pop-Location

    $rawOut | Set-Content $logFile -Encoding UTF8

    $summaryLine = ($rawOut | Where-Object { $_ -match "passed" } | Select-Object -Last 1)
    if (-not $summaryLine) { $summaryLine = "(no summary)" }
    $summaries += [string]$summaryLine
    Write-Host "  Result: $summaryLine"

    if ($summaryLine -match "(\d+) passed") {
        $counts += [int]$Matches[1]
    } else {
        $counts += -1
    }
}

Write-Host ""
Write-Host "========================================"
Write-Host "  3-RUN SUMMARY"
Write-Host "========================================"
for ($i = 0; $i -lt 3; $i++) {
    Write-Host "  Run $($i+1): $($summaries[$i])"
}

$summaryPath = Join-Path $PROOF_DIR "run_3x_summary.txt"
$summaries | Set-Content $summaryPath -Encoding UTF8

$uniqueCounts = ($counts | Select-Object -Unique)
$allSame = ($uniqueCounts.Count -eq 1) -and ($counts[0] -ge 0)

if ($allSame) {
    $n = $counts[0]
    Write-Host ""
    Write-Host "PASS: all 3 runs identical: $n passed"
    Add-Content $summaryPath "PASS: all 3 runs = $n passed"
    exit 0
} else {
    $c = [string]::Join("-", $counts)
    Write-Host ""
    Write-Host "FAIL: run counts differ: $c"
    Add-Content $summaryPath "FAIL: run counts differ: $c"
    exit 1
}
