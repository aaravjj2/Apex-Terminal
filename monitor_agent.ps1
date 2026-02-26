#!/usr/bin/env pwsh
# =============================================================================
# APEX TERMINAL — REAL-TIME AUTOPILOT MONITORING AGENT
# Runs continuously until 3 buy trades are confirmed placed
# =============================================================================

$BASE = "http://localhost:8000"
$TARGET_BUYS = 3
$total_buys = 0
$cycle_count = 0
$all_placed_orders = @()
$start_time = Get-Date

function Format-Timestamp { (Get-Date).ToString("HH:mm:ss") }

function Write-Banner {
    Write-Host ""
    Write-Host "===================================================================" -ForegroundColor Cyan
    Write-Host "  APEX TERMINAL AUTOPILOT MONITORING AGENT" -ForegroundColor Cyan
    Write-Host "  TARGET: $TARGET_BUYS buy trades | Market: $(Format-Timestamp)" -ForegroundColor Cyan
    Write-Host "===================================================================" -ForegroundColor Cyan
}

function Get-CycleResult {
    try {
        $r = Invoke-RestMethod "$BASE/api/ops/autopilot/cycle" -TimeoutSec 10
        return $r.cycle
    } catch {
        Write-Host "[$(Format-Timestamp)] WARNING: Could not fetch cycle: $_" -ForegroundColor Yellow
        return $null
    }
}

function Trigger-Cycle {
    try {
        $r = Invoke-RestMethod "$BASE/api/ops/autopilot/run-now?force=true" -Method POST -ContentType "application/json" -TimeoutSec 10
        return $r.correlation_id
    } catch {
        Write-Host "[$(Format-Timestamp)] WARNING: Could not trigger cycle: $_" -ForegroundColor Yellow
        return $null
    }
}

function Get-Positions {
    try {
        $r = Invoke-RestMethod "$BASE/api/ops/autopilot/positions" -TimeoutSec 10
        return $r
    } catch {
        return $null
    }
}

Write-Banner

Write-Host ""
Write-Host "[$(Format-Timestamp)] Starting monitoring loop — waiting for $TARGET_BUYS buy trades..." -ForegroundColor Green
Write-Host ""

# Check current state first
$last_cycle = Get-CycleResult
if ($last_cycle) {
    Write-Host "[$(Format-Timestamp)] Last completed cycle: $($last_cycle.run_id)" -ForegroundColor Gray
    Write-Host "  Previous orders placed: $($last_cycle.orders_placed)" -ForegroundColor Gray
}

while ($total_buys -lt $TARGET_BUYS) {
    $cycle_count++
    $corr_id = Trigger-Cycle
    
    if ($corr_id) {
        Write-Host "[$(Format-Timestamp)] Cycle #$cycle_count triggered (cid=$corr_id)" -ForegroundColor Yellow
    } else {
        Write-Host "[$(Format-Timestamp)] Cycle trigger failed, retrying in 15s..." -ForegroundColor Red
        Start-Sleep 15
        continue
    }
    
    # Wait for cycle to complete
    Start-Sleep 20
    
    # Fetch result
    $cycle = Get-CycleResult
    if (-not $cycle) {
        Write-Host "[$(Format-Timestamp)] Could not fetch cycle result" -ForegroundColor Red
        Start-Sleep 10
        continue
    }
    
    # Parse results
    $new_orders = $cycle.orders_placed
    $gates       = if ($cycle.gates_triggered) { $cycle.gates_triggered -join "," } else { "none" }
    $reasons     = if ($cycle.no_action_reasons) { $cycle.no_action_reasons -join " | " } else { "N/A" }
    $regime      = if ($cycle.market) { $cycle.market.regime } else { "?" }
    $vix         = if ($cycle.market) { [math]::Round($cycle.market.vix_level, 2) } else { "?" }
    
    Write-Host ""
    Write-Host "─────────────────────────────────────────────────────────────────" -ForegroundColor DarkGray
    Write-Host "[$(Format-Timestamp)] CYCLE $cycle_count COMPLETE — $($cycle.run_id)" -ForegroundColor Cyan
    Write-Host "  Candidates: gen=$($cycle.candidates_generated) sel=$($cycle.candidates_selected)" -ForegroundColor White
    Write-Host "  Orders placed: $new_orders  filled: $($cycle.orders_filled)" -ForegroundColor White
    Write-Host "  Gates triggered: $gates" -ForegroundColor $(if ($gates -eq "none") { "Green" } else { "Yellow" })
    Write-Host "  No action: $reasons" -ForegroundColor Gray
    Write-Host "  Market: regime=$regime VIX=$vix" -ForegroundColor Gray
    
    if ($new_orders -gt 0) {
        $total_buys += $new_orders
        $all_placed_orders += [PSCustomObject]@{
            Cycle   = $cycle_count
            RunId   = $cycle.run_id
            Orders  = $new_orders
            Time    = (Get-Date).ToString("HH:mm:ss")
        }
        
        Write-Host ""
        Write-Host "  *** BUY TRADE PLACED! Total: $total_buys/$TARGET_BUYS ***" -ForegroundColor Green -BackgroundColor DarkGreen
        Write-Host ""
        
        if ($total_buys -ge $TARGET_BUYS) {
            break
        }
    } else {
        Write-Host "  No orders this cycle." -ForegroundColor Gray
    }
    
    # Progress bar
    $progress = "[$('▓' * $total_buys)$('░' * ($TARGET_BUYS - $total_buys))] $total_buys/$TARGET_BUYS buys"
    Write-Host "  Progress: $progress" -ForegroundColor Cyan
    
    # Wait before next cycle (avoid anti-thrash gate)
    $wait = 35
    Write-Host "[$(Format-Timestamp)] Waiting ${wait}s before next cycle..." -ForegroundColor Gray
    Start-Sleep $wait
}

# ============================================================================
# MISSION COMPLETE
# ============================================================================
Write-Host ""
Write-Host "===================================================================" -ForegroundColor Green
Write-Host "  *** MISSION COMPLETE: $total_buys BUY TRADES PLACED! ***" -ForegroundColor Green
Write-Host "===================================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Summary:" -ForegroundColor Cyan
$elapsed = (Get-Date) - $start_time
Write-Host "  Total cycles run: $cycle_count" -ForegroundColor White
Write-Host "  Total time: $([math]::Round($elapsed.TotalMinutes, 1)) minutes" -ForegroundColor White
Write-Host "  Buy trades placed:" -ForegroundColor White
$all_placed_orders | ForEach-Object {
    Write-Host "    Cycle $($_.Cycle): $($_.Orders) order(s) — $($_.RunId) at $($_.Time)" -ForegroundColor Green
}
Write-Host ""
