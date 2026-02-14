#!/usr/bin/env python3
"""
Portfolio Determinism Verification Script (v1.19 + v1.20)

This script verifies that portfolio export and list operations are deterministic.
It exports portfolios twice and compares hashes to ensure stability.

Exit Codes:
  0 - All determinism checks passed
  1 - Determinism check failed (hashes don't match)
"""

import sys
import json
import hashlib
import requests
from pathlib import Path

BASE_URL = "http://localhost:8000"
ARTIFACTS_DIR = Path(__file__).parent.parent / "artifacts" / "determinism"

def canonical_json(obj):
    """Convert object to canonical JSON string"""
    return json.dumps(obj, sort_keys=True, default=str)

def compute_sha256(data: str) -> str:
    """Compute SHA256 hash of string"""
    return hashlib.sha256(data.encode()).hexdigest()

def verify_export_determinism():
    """Verify that portfolio export is deterministic"""
    print("=" * 80)
    print("PORTFOLIO EXPORT DETERMINISM VERIFICATION")
    print("=" * 80)
    
    # Reset to fixtures
    print("\n1. Resetting portfolios to fixture state...")
    resp = requests.post(f"{BASE_URL}/api/v1/portfolios/reset")
    resp.raise_for_status()
    print(f"   ✓ Reset: {resp.json()}")
    
    # Get first portfolio
    print("\n2. Getting portfolio list...")
    resp = requests.get(f"{BASE_URL}/api/v1/portfolios")
    resp.raise_for_status()
    portfolios = resp.json()["portfolios"]
    if not portfolios:
        print("   ✗ No portfolios found!")
        return False
    
    portfolio_id = portfolios[0]["portfolio_id"]
    print(f"   ✓ Found portfolio: {portfolio_id}")
    
    # Export twice
    print(f"\n3. Exporting portfolio {portfolio_id} twice...")
    resp1 = requests.get(f"{BASE_URL}/api/v1/portfolios/{portfolio_id}/export")
    resp1.raise_for_status()
    export1 = resp1.json()
    
    resp2 = requests.get(f"{BASE_URL}/api/v1/portfolios/{portfolio_id}/export")
    resp2.raise_for_status()
    export2 = resp2.json()
    
    # Save first export
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    export_file = ARTIFACTS_DIR / "portfolio_export.json"
    with open(export_file, "w") as f:
        json.dump(export1, f, indent=2, sort_keys=True)
    print(f"   ✓ Saved export to: {export_file}")
    
    # Use the API-provided export_hash (which already excludes timestamp)
    hash1 = export1.get("export_hash")
    hash2 = export2.get("export_hash")
    
    # Also compute hash of entire response (including timestamp changing parts)
    full_canonical1 = canonical_json(export1)
    full_canonical2 = canonical_json(export2)
    full_hash1 = compute_sha256(full_canonical1)
    full_hash2 = compute_sha256(full_canonical2)
    
    # Save hash
    hash_file = ARTIFACTS_DIR / "portfolio_export.sha256"
    with open(hash_file, "w") as f:
        f.write(f"{hash1}  portfolio_export.json (API export_hash)\n")
        f.write(f"{full_hash1}  portfolio_export.json (full JSON with timestamp)\n")
    print(f"   ✓ Saved hash to: {hash_file}")
    
    # Compare
    print(f"\n4. Comparing hashes...")
    print(f"   Export 1 API export_hash: {hash1}")
    print(f"   Export 2 API export_hash: {hash2}")
    print(f"   Export 1 full JSON SHA256: {full_hash1}")
    print(f"   Export 2 full JSON SHA256: {full_hash2}")
    
    if hash1 == hash2:
        print("   ✓ PASS: API export_hash matches (content deterministic)")
        print("   ✓ Full JSON differs due to export_timestamp (expected)")
        return True
    else:
        print("   ✗ FAIL: API export_hash DO NOT match (non-deterministic)")
        return False

def verify_list_determinism():
    """Verify that portfolio list is deterministic"""
    print("\n" + "=" * 80)
    print("PORTFOLIO LIST DETERMINISM VERIFICATION")
    print("=" * 80)
    
    print("\n1. Fetching portfolio list twice...")
    resp1 = requests.get(f"{BASE_URL}/api/v1/portfolios?sort_by=portfolio_id")
    resp1.raise_for_status()
    list1 = resp1.json()
    
    resp2 = requests.get(f"{BASE_URL}/api/v1/portfolios?sort_by=portfolio_id")
    resp2.raise_for_status()
    list2 = resp2.json()
    
    # Save first list
    list_file = ARTIFACTS_DIR / "portfolio_list_response.json"
    with open(list_file, "w") as f:
        json.dump(list1, f, indent=2, sort_keys=True)
    print(f"   ✓ Saved list to: {list_file}")
    
    # Compute hashes
    canonical1 = canonical_json(list1)
    canonical2 = canonical_json(list2)
    hash1 = compute_sha256(canonical1)
    hash2 = compute_sha256(canonical2)
    
    # Save hash
    hash_file = ARTIFACTS_DIR / "portfolio_list_response.sha256"
    with open(hash_file, "w") as f:
        f.write(f"{hash1}  portfolio_list_response.json\n")
    print(f"   ✓ Saved hash to: {hash_file}")
    
    # Compare
    print(f"\n2. Comparing hashes...")
    print(f"   List 1 SHA256: {hash1}")
    print(f"   List 2 SHA256: {hash2}")
    
    # Also compare portfolio IDs for stable ordering
    ids1 = [p["portfolio_id"] for p in list1["portfolios"]]
    ids2 = [p["portfolio_id"] for p in list2["portfolios"]]
    
    print(f"\n3. Verifying stable ordering...")
    print(f"   List 1 IDs: {ids1}")
    print(f"   List 2 IDs: {ids2}")
    
    if hash1 == hash2 and ids1 == ids2:
        print("   ✓ PASS: List hashes and ordering match (deterministic)")
        return True
    else:
        if hash1 != hash2:
            print("   ✗ FAIL: List hashes DO NOT match")
        if ids1 != ids2:
            print("   ✗ FAIL: List ordering is NOT stable")
        return False

def main():
    """Run all determinism verification checks"""
    print("Portfolio Determinism Verification (v1.19 + v1.20)")
    print("Verifying 2-run stability for exports and lists\n")
    
    try:
        export_ok = verify_export_determinism()
        list_ok = verify_list_determinism()
        
        print("\n" + "=" * 80)
        print("SUMMARY")
        print("=" * 80)
        print(f"Export determinism: {'✓ PASS' if export_ok else '✗ FAIL'}")
        print(f"List determinism:   {'✓ PASS' if list_ok else '✗ FAIL'}")
        
        if export_ok and list_ok:
            print("\n✓ All determinism checks PASSED")
            print(f"\nArtifacts saved to: {ARTIFACTS_DIR}")
            return 0
        else:
            print("\n✗ Some determinism checks FAILED")
            return 1
            
    except Exception as e:
        print(f"\n✗ ERROR: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    sys.exit(main())
