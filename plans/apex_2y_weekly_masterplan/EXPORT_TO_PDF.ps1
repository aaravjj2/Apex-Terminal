Param(
    [string]$PlanDir = "c:\Tradingview\Tradingview recreation\plans\apex_2y_weekly_masterplan",
    [string]$OutputDir = "c:\Tradingview\Tradingview recreation\plans\apex_2y_weekly_masterplan\pdf"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $PlanDir)) {
    throw "Plan directory not found: $PlanDir"
}

if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir | Out-Null
}

$docs = @(
    "01_W01-W13_Foundation_and_Execution_Core.md",
    "02_W14-W26_Market_Data_and_Research_Superset.md",
    "03_W27-W39_Trading_Risk_and_Portfolio_Intelligence.md",
    "04_W40-W52_AI_Autopilot_and_Strategy_Operating_System.md",
    "05_W53-W65_Options_Derivatives_and_Multi_Asset_Expansion.md",
    "06_W66-W78_Enterprise_Workflows_Compliance_and_Controls.md",
    "07_W79-W91_Platform_Ecosystem_and_Developer_Marketplace.md",
    "08_W92-W104_Global_Scale_Optimization_and_Operating_Excellence.md"
)

$pandoc = Get-Command pandoc -ErrorAction SilentlyContinue
if (-not $pandoc) {
    Write-Host "Pandoc is not installed. Install it first to generate PDFs:" -ForegroundColor Yellow
    Write-Host "  winget install --id JohnMacFarlane.Pandoc -e"
    Write-Host "Then rerun this script."
    exit 1
}

foreach ($doc in $docs) {
    $inFile = Join-Path $PlanDir $doc
    if (-not (Test-Path $inFile)) {
        Write-Host "Skipping missing file: $doc" -ForegroundColor Yellow
        continue
    }

    $outFile = Join-Path $OutputDir ($doc -replace "\.md$", ".pdf")

    pandoc $inFile `
        --from markdown `
        --to pdf `
        --pdf-engine=xelatex `
        --toc `
        --number-sections `
        --metadata title="Apex Terminal 2-Year Weekly Plan" `
        -o $outFile

    Write-Host "Generated: $outFile" -ForegroundColor Green
}

Write-Host "Done. PDFs are in: $OutputDir" -ForegroundColor Cyan
