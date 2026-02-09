#!/usr/bin/env python3
"""
Determinism check for Risk Desk pipeline.
Runs the pipeline twice with identical inputs and verifies outputs match.
"""
import json
import hashlib
import sys
from pathlib import Path

# Add phase1 to path
sys.path.insert(0, str(Path(__file__).parent / "phase1"))

from services.risk_desk.pipeline import execute_risk_run

def hash_result(result):
    """
    Compute hash of pipeline result, excluding non-deterministic fields.
    run_id is excluded because it contains uuid4() randomness.
    """
    # Extract fields that should be deterministic
    deterministic_data = {
        'ok': result.ok,
        'error': result.error,
    }
    
    if result.validation:
        deterministic_data['validation'] = {
            'is_valid': result.validation.valid,
            'issue_count': len(result.validation.issues),
            'issues': [
                {'field': i.field, 'severity': i.severity, 'code': i.code}
                for i in result.validation.issues
            ],
        }
    
    if result.greeks:
        deterministic_data['greeks'] = {
            'delta': round(result.greeks.net_delta, 4),
            'gamma': round(result.greeks.net_gamma, 4),
            'vega': round(result.greeks.net_vega, 4),
            'theta': round(result.greeks.net_theta, 4),
        }
    
    if result.stress:
        deterministic_data['stress'] = {
            'scenario_id': result.stress.scenario.id,
            'pnl': round(result.stress.total_pnl, 4),
            'hedge_count': len(result.stress.hedge_candidates),
        }
    
    if result.compliance:
        deterministic_data['compliance'] = {
            'status': result.compliance.status,
            'violation_count': len(result.compliance.violations),
            'violations': [
                {'code': v.code, 'severity': v.severity}
                for v in result.compliance.violations
            ],
        }
    
    if result.verification:
        deterministic_data['verification'] = {
            'verified': result.verification.verified,
            'max_delta_deviation': round(result.verification.max_delta_deviation, 6),
        }
    
    deterministic_data['tool_trace'] = [
        {'tool': t.tool_id, 'status': t.status}
        for t in result.tool_trace
    ]
    
    # Serialize and hash
    data_str = json.dumps(deterministic_data, sort_keys=True)
    return hashlib.sha256(data_str.encode()).hexdigest()

def main():
    print("Determinism Check: Week 2 Risk Desk Pipeline")
    print("=" * 60)
    
    # Load demo CSV from fixtures
    fixtures_dir = Path(__file__).parent / "phase1" / "services" / "risk_desk" / "fixtures"
    csv_path = fixtures_dir / "demo_portfolio.csv"
    csv_text = csv_path.read_text()
    
    scenario_id = "moderate_selloff"
    
    # Use default snapshot (None) — pipeline will load it
    snapshot = None
    
    print(f"Running pipeline twice with scenario: {scenario_id}")
    print()
    
    # Run 1
    print("Run 1...")
    result1 = execute_risk_run(csv_text, scenario_id, snapshot)
    print(f"  OK: {result1.ok}, Error: {result1.error if result1.error else 'None'}")
    hash1 = hash_result(result1)
    print(f"  Hash: {hash1}")
    
    # Run 2
    print("Run 2...")
    result2 = execute_risk_run(csv_text, scenario_id, snapshot)
    print(f"  OK: {result2.ok}, Error: {result2.error if result2.error else 'None'}")
    hash2 = hash_result(result2)
    print(f"  Hash: {hash2}")
    
    print()
    if hash1 == hash2:
        print("✓ DETERMINISM VERIFIED: Hashes match")
        print("  Pipeline produces identical outputs for identical inputs.")
        return 0
    else:
        print("✗ DETERMINISM FAILED: Hashes differ")
        print("  Investigating differences...")
        print()
        print("Run 1 data:")
        print(f"  run_id: {result1.run_id}")
        print(f"  validation.valid: {result1.validation.valid if result1.validation else None}")
        print(f"  greeks.net_delta: {result1.greeks.net_delta if result1.greeks else None}")
        print(f"  stress.total_pnl: {result1.stress.total_pnl if result1.stress else None}")
        print(f"  compliance.status: {result1.compliance.status if result1.compliance else None}")
        print()
        print("Run 2 data:")
        print(f"  run_id: {result2.run_id}")
        print(f"  validation.valid: {result2.validation.valid if result2.validation else None}")
        print(f"  greeks.net_delta: {result2.greeks.net_delta if result2.greeks else None}")
        print(f"  stress.total_pnl: {result2.stress.total_pnl if result2.stress else None}")
        print(f"  compliance.status: {result2.compliance.status if result2.compliance else None}")
        print()
        print("Most likely cause: run_id contains timestamp or random value.")
        print("Consider excluding run_id from determinism check if it's just an ID.")
        return 1

if __name__ == "__main__":
    sys.exit(main())
