# scripts/bootstrap_keys_example.ps1
# Creates keys.env from keys.env.example if it doesn't already exist.

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir
$Example = Join-Path $RootDir "keys.env.example"
$Target = Join-Path $RootDir "keys.env"

if (-not (Test-Path $Example)) {
    Write-Error "ERROR: keys.env.example not found at $Example"
    exit 1
}

if (Test-Path $Target) {
    Write-Host "keys.env already exists — skipping. Edit it to update your keys."
} else {
    Copy-Item -Path $Example -Destination $Target
    Write-Host "Created keys.env from keys.env.example"
    Write-Host "=> Fill in your real API keys in: $Target"
}
