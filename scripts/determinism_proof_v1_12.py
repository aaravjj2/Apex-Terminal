#!/usr/bin/env python3
"""
v1.12 Determinism Proof - LIVE Backend Test
Proves that identical BacktestConfig produces identical outputs.
No stubs, no 422 errors, real DEMO mode execution.
"""

import json
import hashlib
import requests
import sys
from datetime import datetime
from pathlib import Path


def canonicalize_backtest_run(run_data: dict) -> dict:
    """
    Canonicalize backtest run output for deterministic comparison.
    
    Rules:
    1. Remove non-deterministic fields (run_id, started_at, completed_at, timestamps)
    2. Sort all dict keys recursively
    3. Format floats consistently to 8 decimal places
    4. Sort lists where order is not semantically meaningful
    5. Preserve time-series ordering (equity_curve, trades by timestamp)
    """
    canonical = {}
    
    # Remove non-deterministic fields
    excluded_fields = {'run_id', 'started_at', 'completed_at'}
    
    for key, value in sorted(run_data.items()):
        if key in excluded_fields:
            continue
            
        if isinstance(value, dict):
            canonical[key] = canonicalize_backtest_run(value)
        elif isinstance(value, list):
            # Preserve time-series order for equity_curve and trades
            if key in ('equity_curve', 'trades'):
                canonical[key] = [canonicalize_backtest_run(item) if isinstance(item, dict) else item for item in value]
            else:
                # For other lists, sort if items are dicts (by JSON repr), else preserve
                if value and isinstance(value[0], dict):
                    canonical[key] = sorted([canonicalize_backtest_run(item) for item in value], 
                                           key=lambda x: json.dumps(x, sort_keys=True))
                else:
                    canonical[key] = value
        elif isinstance(value, float):
            # Format floats consistently
            canonical[key] = round(value, 8)
        elif isinstance(value, datetime):
            # Skip datetime fields
            continue
        else:
            canonical[key] = value
    
    return canonical


def compute_hash(data: dict) -> str:
    """Compute SHA256 hash of canonical JSON representation."""
    canonical_json = json.dumps(data, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(canonical_json.encode('utf-8')).hexdigest()


def run_determinism_proof(backend_url: str, output_dir: Path):
    """
    Run determinism proof:
    1. Send identical BacktestConfig twice
    2. Canonicalize outputs
    3. Compare hashes
    4. Assert equality
    """
    
    print("=" * 80)
    print("v1.12 DETERMINISM PROOF - LIVE BACKEND")
    print("=" * 80)
    print()
    
    # Define test config - EXACT schema matching BacktestConfig
    test_config = {
        "strategy_id": "demo-sma-crossover",
        "symbol": "SPY",
        "start_date": "2023-01-01",
        "end_date": "2023-01-31",
        "initial_capital": 100000.0,
        "slippage_bps": 5.0,
        "fee_per_trade": 1.0,
        "seed": 42
    }
    
    print(f"Backend URL: {backend_url}")
    print(f"Test Config:")
    print(json.dumps(test_config, indent=2))
    print()
    
    # Ensure output directory exists
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Save input config
    with open(output_dir / "inputs.json", "w") as f:
        json.dump(test_config, f, indent=2)
    
    # Run 1
    print("=" * 80)
    print("RUN 1")
    print("=" * 80)
    try:
        response1 = requests.post(
            f"{backend_url}/api/backtest/run",
            json=test_config,
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        print(f"Status Code: {response1.status_code}")
        
        if response1.status_code == 422:
            print("ERROR: 422 Unprocessable Entity")
            print("Response:")
            print(json.dumps(response1.json(), indent=2))
            sys.exit(1)
        
        response1.raise_for_status()
        run1_data = response1.json()
        print(f"Run ID: {run1_data.get('run_id', 'N/A')}")
        print(f"Status: {run1_data.get('status', 'N/A')}")
        print(f"Config Hash: {run1_data.get('config_hash', 'N/A')}")
        print()
        
        # Save raw output
        with open(output_dir / "output_run1.json", "w") as f:
            json.dump(run1_data, f, indent=2)
        
    except requests.exceptions.RequestException as e:
        print(f"ERROR: Request failed - {e}")
        sys.exit(1)
    
    # Run 2
    print("=" * 80)
    print("RUN 2")
    print("=" * 80)
    try:
        response2 = requests.post(
            f"{backend_url}/api/backtest/run",
            json=test_config,
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        print(f"Status Code: {response2.status_code}")
        
        if response2.status_code == 422:
            print("ERROR: 422 Unprocessable Entity")
            print("Response:")
            print(json.dumps(response2.json(), indent=2))
            sys.exit(1)
        
        response2.raise_for_status()
        run2_data = response2.json()
        print(f"Run ID: {run2_data.get('run_id', 'N/A')}")
        print(f"Status: {run2_data.get('status', 'N/A')}")
        print(f"Config Hash: {run2_data.get('config_hash', 'N/A')}")
        print()
        
        # Save raw output
        with open(output_dir / "output_run2.json", "w") as f:
            json.dump(run2_data, f, indent=2)
        
    except requests.exceptions.RequestException as e:
        print(f"ERROR: Request failed - {e}")
        sys.exit(1)
    
    # Canonicalize
    print("=" * 80)
    print("CANONICALIZATION")
    print("=" * 80)
    print("Applying canonicalization rules:")
    print("  1. Remove non-deterministic fields (run_id, timestamps)")
    print("  2. Sort all dict keys")
    print("  3. Format floats to 8 decimal places")
    print("  4. Preserve time-series ordering (equity_curve, trades)")
    print()
    
    canonical1 = canonicalize_backtest_run(run1_data)
    canonical2 = canonicalize_backtest_run(run2_data)
    
    # Save canonical outputs
    with open(output_dir / "canonical_run1.json", "w") as f:
        json.dump(canonical1, f, indent=2, sort_keys=True)
    
    with open(output_dir / "canonical_run2.json", "w") as f:
        json.dump(canonical2, f, indent=2, sort_keys=True)
    
    # Compute hashes
    hash1 = compute_hash(canonical1)
    hash2 = compute_hash(canonical2)
    
    print(f"Hash Run 1: {hash1}")
    print(f"Hash Run 2: {hash2}")
    print()
    
    # Save hashes
    hashes = {
        "run1_canonical_sha256": hash1,
        "run2_canonical_sha256": hash2,
        "match": hash1 == hash2
    }
    
    with open(output_dir / "hashes.json", "w") as f:
        json.dump(hashes, f, indent=2)
    
    # Save canonicalization rules
    canonicalization_md = """# Canonicalization Rules

## Purpose
Ensure deterministic comparison of backtest runs by removing non-deterministic fields and normalizing representation.

## Rules Applied

### 1. Remove Non-Deterministic Fields
Excluded fields:
- `run_id` - Unique per run, generated by backend
- `started_at` - Timestamp when run started
- `completed_at` - Timestamp when run completed
- Any `timestamp` fields in top-level response (metadata)

### 2. Sort Dictionary Keys
All dictionaries are sorted alphabetically by key for consistent ordering.

### 3. Float Formatting
All float values are rounded to 8 decimal places to avoid floating-point precision issues.

### 4. List Ordering
- **Time-series lists** (`equity_curve`, `trades`): Preserve original order (semantically meaningful)
- **Other lists with dicts**: Sort by JSON representation for consistency
- **Primitive lists**: Preserve original order

### 5. Recursive Application
Canonicalization is applied recursively to all nested structures.

## Hash Computation
1. Convert canonical dict to JSON with `sort_keys=True`
2. Encode as UTF-8
3. Compute SHA256 hash

## Expected Outcome
Identical configs + identical seed → identical canonical hashes.
"""
    
    with open(output_dir / "canonicalization.md", "w") as f:
        f.write(canonicalization_md)
    
    # Assert equality
    print("=" * 80)
    print("DETERMINISM ASSERTION")
    print("=" * 80)
    
    if hash1 == hash2:
        print("✅ PASSED: Hashes match - determinism proven")
        assertion_result = "PASSED"
        
        # Save assertion
        with open(output_dir / "assertion.txt", "w") as f:
            f.write("DETERMINISM PROOF: PASSED\n")
            f.write(f"Canonical Hash: {hash1}\n")
            f.write("Identical configs produce identical canonical outputs.\n")
        
        return 0
    else:
        print("❌ FAILED: Hashes do not match - non-determinism detected")
        assertion_result = "FAILED"
        
        # Save assertion with diff
        with open(output_dir / "assertion.txt", "w") as f:
            f.write("DETERMINISM PROOF: FAILED\n")
            f.write(f"Hash Run 1: {hash1}\n")
            f.write(f"Hash Run 2: {hash2}\n")
            f.write("Identical configs produced different outputs.\n")
            f.write("Check canonical_run*.json for differences.\n")
        
        # Attempt to show diff
        try:
            import difflib
            canonical1_str = json.dumps(canonical1, indent=2, sort_keys=True).splitlines()
            canonical2_str = json.dumps(canonical2, indent=2, sort_keys=True).splitlines()
            diff = list(difflib.unified_diff(canonical1_str, canonical2_str, 
                                             fromfile='canonical_run1', 
                                             tofile='canonical_run2', 
                                             lineterm=''))
            if diff:
                print("\nDiff (first 50 lines):")
                for line in diff[:50]:
                    print(line)
                
                with open(output_dir / "diff.txt", "w") as f:
                    f.write('\n'.join(diff))
        except Exception as e:
            print(f"Could not generate diff: {e}")
        
        return 1


if __name__ == "__main__":
    backend_url = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000"
    
    output_dir = Path(__file__).parent.parent / "artifacts" / "proof" / "20260208-134632-v1.12" / "determinism"
    
    exit_code = run_determinism_proof(backend_url, output_dir)
    sys.exit(exit_code)
