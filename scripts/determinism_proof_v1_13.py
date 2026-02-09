"""
v1.13 Determinism Proof - Market Data Record/Replay
====================================================
Proves that identical market data requests produce identical responses
with deterministic cache_key and provenance tracking.
"""

import json
import hashlib
from pathlib import Path
import requests

BASE_URL = "http://localhost:8000"
PROOF_DIR = Path("artifacts/proof/20260208-183720-v1.13/determinism")
PROOF_DIR.mkdir(parents=True, exist_ok=True)


def canonicalize_response(data: dict) -> dict:
    """
    Canonicalize market data response by removing/normalizing non-deterministic fields.
    Preserve cache_key, source, and other provenance fields (they should be deterministic).
    """
    canonical = data.copy()
    
    # For bars response
    if "bars" in canonical:
        # Remove fetched_at if present in provenance (timestamps are non-deterministic in LOCAL mode)
        if "provenance" in canonical and "fetched_at" in canonical["provenance"]:
            canonical["provenance"]["fetched_at"] = None
    
    # For quote response  
    if "price" in canonical:
        # Normalize price to avoid floating point differences
        canonical["price"] = round(canonical["price"], 2)
        # Remove fetched_at
        if "provenance" in canonical and "fetched_at" in canonical["provenance"]:
            canonical["provenance"]["fetched_at"] = None
    
    return canonical


def compute_hash(data: dict) -> str:
    """Compute SHA256 hash of canonical JSON."""
    canonical_json = json.dumps(data, sort_keys=True)
    return hashlib.sha256(canonical_json.encode()).hexdigest()


def prove_determinism():
    """Run determinism proof for v1.13 market data API."""
    
    # Test request (DEMO mode, deterministic)
    request_payload = {
        "symbol": "SPY",
        "start_date": "2023-01-01",
        "end_date": "2023-12-31",
        "timeframe": "1d"
    }
    
    # Save input
    with open(PROOF_DIR / "inputs.json", "w") as f:
        json.dump(request_payload, f, indent=2)
    
    # First run
    print("Run 1...")
    response1 = requests.post(
        f"{BASE_URL}/api/v2/market-data/bars",
        json=request_payload,
        timeout=10
    )
    response1.raise_for_status()
    data1 = response1.json()
    
    with open(PROOF_DIR / "output_run1.json", "w") as f:
        json.dump(data1, f, indent=2)
    
    # Second run
    print("Run 2...")
    response2 = requests.post(
        f"{BASE_URL}/api/v2/market-data/bars",
        json=request_payload,
        timeout=10
    )
    response2.raise_for_status()
    data2 = response2.json()
    
    with open(PROOF_DIR / "output_run2.json", "w") as f:
        json.dump(data2, f, indent=2)
    
    # Canonicalize
    canonical1 = canonicalize_response(data1)
    canonical2 = canonicalize_response(data2)
    
    with open(PROOF_DIR / "canonical_run1.json", "w") as f:
        json.dump(canonical1, f, indent=2, sort_keys=True)
    
    with open(PROOF_DIR / "canonical_run2.json", "w") as f:
        json.dump(canonical2, f, indent=2, sort_keys=True)
    
    # Compute hashes
    hash1 = compute_hash(canonical1)
    hash2 = compute_hash(canonical2)
    
    hashes_data = {
        "run1_hash": hash1,
        "run2_hash": hash2,
        "match": hash1 == hash2
    }
    
    with open(PROOF_DIR / "hashes.json", "w") as f:
        json.dump(hashes_data, f, indent=2)
    
    # Provenance validation
    provenance1 = data1.get("provenance", {})
    provenance2 = data2.get("provenance", {})
    
    # In DEMO mode, source should be DEMO, cache_key should match
    cache_key_match = provenance1.get("cache_key") == provenance2.get("cache_key")
    source_match = provenance1.get("source") == provenance2.get("source")
    source_is_demo = provenance1.get("source") == "DEMO"
    
    # Write canonicalization rules
    with open(PROOF_DIR / "canonicalization.md", "w") as f:
        f.write("# v1.13 Market Data Canonicalization Rules\n\n")
        f.write("1. Remove `provenance.fetched_at` (timestamp non-deterministic in LOCAL mode)\n")
        f.write("2. Round `price` to 2 decimal places (floating point normalization)\n")
        f.write("3. Preserve `provenance.cache_key` (must be deterministic)\n")
        f.write("4. Preserve `provenance.source` (must be deterministic)\n")
        f.write("5. Preserve `provenance.checksum` (must be deterministic)\n")
        f.write("6. In DEMO mode, all fields except fetched_at are deterministic\n")
    
    # Write assertion
    assertion = f"""
v1.13 Determinism Proof Assertion
=================================

Run 1 Hash: {hash1}
Run 2 Hash: {hash2}

Hashes Match: {hashes_data['match']}
Cache Keys Match: {cache_key_match}
Sources Match: {source_match}
Source is DEMO: {source_is_demo}

{'✅ PASSED - Determinism proven' if hashes_data['match'] and cache_key_match else '❌ FAILED - Non-deterministic behavior detected'}
"""
    
    with open(PROOF_DIR / "assertion.txt", "w") as f:
        f.write(assertion)
    
    print(assertion)
    
    if not (hashes_data['match'] and cache_key_match):
        raise AssertionError("Determinism proof failed!")
    
    return hashes_data


if __name__ == "__main__":
    prove_determinism()
