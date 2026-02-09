# Lean CLI Local Runbook (Windows/WSL)

Since the automated environment lacked authorization, you must execute the final "Real Engine" verification manually.

## 1. Prerequisites
1.  **Docker Desktop** installed and running.
    *   Settings -> General -> Check "Expose daemon on tcp://localhost:2375 without TLS".
    *   Settings -> Resources -> WSL Integration -> Enable for your distro.
2.  **Lean CLI**: `pip install lean`
3.  **Authentication**: Run `lean login` and provide your User ID and API Token from [QuantConnect Account](https://www.quantconne ct.com/account).

## 2. Setup Workspace
```bash
# Create a new directory to avoid "Old CLI root" errors
mkdir lean_validation
cd lean_validation

# Initialize (Interactive)
lean init 
# Select "python", "QuantConnect", etc.
```

## 3. Acquire Data
To run the Jan 2023 backtest, you need SPY and QQQ data.
```bash
# Download data (requires Agreement)
lean data download "SPY" "QQQ"
# Select "Equity" -> "Daily" -> "USA"
# Select "Option" -> "Minute" (or Daily if available) for SPY/QQQ
```
*Alternatively, use the `tools/generate_lean_data.py` script provided in the repo to generate mock zips if you lack a data sub.*

## 4. Run Backtest
Copy the `qc/AutopilotQC_v1` directory into your `lean_validation` folder (or symlink).

```bash
# Run Backtest
lean backtest AutopilotQC_v1 --verbose
```

## 5. Validate Results
Check the logs in `lean_validation/AutopilotQC_v1/backtests/<timestamp>/`:
1.  **Scan Count**: Should be ~80 for Jan 2023.
2.  **Tape Keys**: Look for keys like `tape/2023-01-xx/scan-XXXX.json`.
3.  **Dry Run**: Ensure "Orders: 0".
