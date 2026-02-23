#!/usr/bin/env python3
"""
Verify the integrity of a recording set.

Usage:
    python scripts/verify_recording.py [--set core-default]

Checks:
    1. manifest.json exists and is valid JSON
    2. All files listed in manifest exist
    3. SHA-256 checksums match
    4. Required files are present (market_data/*.parquet)
    5. Parquet files are readable and have expected schema

Exit codes:
    0 = all checks passed
    1 = verification failure
"""
import argparse
import hashlib
import json
import os
import sys
from pathlib import Path

WORKSPACE_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REQUIRED_COLUMNS = {"open", "high", "low", "close", "volume"}


def sha256_file(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return "sha256:" + h.hexdigest()


def verify_recording(recording_set: str = "core-default", verbose: bool = True) -> bool:
    base_dir = Path(WORKSPACE_ROOT) / "data" / "recordings" / recording_set
    manifest_path = base_dir / "manifest.json"

    errors: list[str] = []
    warnings: list[str] = []

    def log(msg: str) -> None:
        if verbose:
            print(msg)

    def err(msg: str) -> None:
        errors.append(msg)
        if verbose:
            print(f"  ✗ {msg}")

    def ok(msg: str) -> None:
        if verbose:
            print(f"  ✓ {msg}")

    log(f"\n=== Verifying recording set: {recording_set} ===")

    # 1. Manifest exists
    if not manifest_path.exists():
        err(f"manifest.json not found at {manifest_path}")
        if verbose:
            print(f"\n{'FAILED' if errors else 'PASSED'}: {len(errors)} error(s)")
        return False

    # 2. Parse manifest
    try:
        with open(manifest_path) as f:
            manifest = json.load(f)
        ok(f"manifest.json parsed OK (set={manifest.get('set_name')}, version={manifest.get('version')})")
    except json.JSONDecodeError as e:
        err(f"manifest.json is invalid JSON: {e}")
        return False

    # 3. Required top-level fields
    required_fields = ["set_name", "version", "captured_at", "provider", "symbols", "date_range", "files"]
    for field in required_fields:
        if field not in manifest:
            err(f"manifest missing required field: {field}")
        else:
            ok(f"manifest has field '{field}'")

    # 4. Check symbols + date range
    symbols = manifest.get("symbols", [])
    if not symbols:
        err("no symbols in manifest")
    else:
        ok(f"symbols: {symbols}")

    dr = manifest.get("date_range", {})
    if dr.get("start") and dr.get("end"):
        ok(f"date_range: {dr['start']} → {dr['end']}")
    else:
        err("date_range missing start/end")

    # 5. Check each file
    files = manifest.get("files", {})
    if not files:
        warnings.append("manifest has no files listed")
    
    for rel_path, meta in files.items():
        full_path = base_dir / rel_path
        if not full_path.exists():
            err(f"file not found: {rel_path}")
            continue

        # Size check
        actual_size = full_path.stat().st_size
        expected_size = meta.get("size_bytes")
        if expected_size is not None and actual_size != expected_size:
            err(f"{rel_path}: size mismatch (expected {expected_size}, got {actual_size})")
        else:
            ok(f"{rel_path}: size OK ({actual_size:,} bytes)")

        # Hash check
        expected_hash = meta.get("sha256", "")
        if expected_hash:
            actual_hash = sha256_file(str(full_path))
            if actual_hash != expected_hash:
                err(f"{rel_path}: SHA-256 mismatch\n    expected: {expected_hash}\n    actual:   {actual_hash}")
            else:
                ok(f"{rel_path}: SHA-256 OK ({actual_hash[:30]}…)")

    # 6. Check all parquet files have required schema
    try:
        import pandas as pd
        market_data_dir = base_dir / "market_data"
        if market_data_dir.exists():
            for pq_file in market_data_dir.glob("*.parquet"):
                try:
                    df = pd.read_parquet(pq_file, engine="pyarrow")
                    cols = set(df.columns.str.lower())
                    missing = REQUIRED_COLUMNS - cols
                    if missing:
                        err(f"{pq_file.name}: missing columns {missing} (has {set(df.columns)})")
                    elif len(df) == 0:
                        err(f"{pq_file.name}: empty dataframe")
                    else:
                        ok(f"{pq_file.name}: schema OK ({len(df)} rows, cols={sorted(cols)[:5]}…)")
                except Exception as e:
                    err(f"{pq_file.name}: read failed: {e}")
    except ImportError:
        warnings.append("pandas/pyarrow not available, skipping parquet schema checks")

    # 7. Check broker_ledger JSONL if present
    ledger_dir = base_dir / "broker_ledger"
    if ledger_dir.exists():
        for jl_file in ledger_dir.glob("*.jsonl"):
            try:
                with open(jl_file) as f:
                    lines = f.readlines()
                parsed = [json.loads(line) for line in lines if line.strip()]
                ok(f"{jl_file.name}: {len(parsed)} records, valid JSON")
            except Exception as e:
                err(f"{jl_file.name}: read failed: {e}")

    # Summary
    log("")
    if warnings:
        for w in warnings:
            log(f"  ⚠ {w}")
    
    if errors:
        log(f"\n✗ VERIFICATION FAILED: {len(errors)} error(s)")
        return False
    else:
        log(f"\n✓ VERIFICATION PASSED: {recording_set}")
        return True


def main():
    parser = argparse.ArgumentParser(description="Verify recording set integrity")
    parser.add_argument("--set", default="core-default")
    parser.add_argument("--quiet", action="store_true")
    args = parser.parse_args()

    ok = verify_recording(args.set, verbose=not args.quiet)
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
