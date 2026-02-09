$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
Set-Location "c:\Tradingview recreation\frontend"

# Run all tests and capture exit code
$process = Start-Process -FilePath "cmd.exe" -ArgumentList "/c","npx playwright test --reporter=list" -RedirectStandardOutput "pw-stdout.log" -RedirectStandardError "pw-stderr.log" -PassThru -NoNewWindow -Wait
$exitCode = $process.ExitCode

# Write summary
"EXIT_CODE=$exitCode" | Out-File "pw-summary.txt" -Encoding utf8
Get-Content "pw-stderr.log" -Tail 20 | Out-File "pw-summary.txt" -Append -Encoding utf8
Get-Content "pw-stdout.log" -Tail 20 | Out-File "pw-summary.txt" -Append -Encoding utf8
"DONE" | Out-File "pw-done.flag" -Encoding utf8
