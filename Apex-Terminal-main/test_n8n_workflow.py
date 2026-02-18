#!/usr/bin/env python3
"""
Test n8n Workflow Endpoints
Simulates the workflow execution to verify all endpoints work correctly.
"""

import requests
import time
import json
from datetime import datetime

BASE_URL = "http://localhost:8000/api/v1"
N8N_URL = "http://localhost:5678"

def test_endpoint(name: str, method: str, url: str, data=None, expected_keys=None):
    """Test a single endpoint."""
    print(f"\n{'='*60}")
    print(f"Testing: {name}")
    print(f"{'='*60}")
    
    try:
        if method == "GET":
            response = requests.get(url, timeout=30)
        elif method == "POST":
            response = requests.post(url, json=data, timeout=60)
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code < 400:
            result = response.json()
            print(f"✅ SUCCESS")
            
            if expected_keys:
                for key in expected_keys:
                    if key in result:
                        print(f"  ✓ Found key: {key} = {str(result[key])[:100]}")
                    else:
                        print(f"  ⚠ Missing key: {key}")
            
            return True, result
        else:
            print(f"❌ FAILED: {response.text[:200]}")
            return False, response.text
            
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
        return False, str(e)


def main():
    print(f"""
    ╔══════════════════════════════════════════════════════════╗
    ║        n8n Workflow Endpoint Validation Suite           ║
    ║                    January 14, 2026                      ║
    ╚══════════════════════════════════════════════════════════╝
    """)
    
    results = {}
    
    # Test 1: n8n Health
    print("\n🔍 Step 0: Verify n8n is running...")
    success, data = test_endpoint(
        "n8n Health Check",
        "GET",
        f"{N8N_URL}/healthz",
        expected_keys=["status"]
    )
    results["n8n_health"] = success
    
    # Test 2: Autopilot Status (Pre-check)
    success, data = test_endpoint(
        "Autopilot Status (Pre-Run)",
        "GET",
        f"{BASE_URL}/autopilot/status",
        expected_keys=["state", "kill_switch_active", "websocket_connected"]
    )
    results["autopilot_status"] = success
    
    if success:
        print(f"\n  Current State: {data.get('state')}")
        print(f"  Kill Switch: {data.get('kill_switch_active')}")
        print(f"  WebSocket: {data.get('websocket_connected')}")
    
    # Test 3: Autopilot Run (DRY RUN)
    print("\n⚠️  Testing autopilot/run with dry_run=true...")
    success, data = test_endpoint(
        "Autopilot Run (Dry Run)",
        "POST",
        f"{BASE_URL}/autopilot/run",
        data={"dry_run": True, "force": True},
        expected_keys=["status", "run_id"]
    )
    results["autopilot_run"] = success
    
    if success:
        run_id = data.get("run_id", "N/A")
        print(f"  Run ID: {run_id}")
    
    # Test 4: Wait 5 seconds (workflow waits 30s)
    print("\n⏳ Waiting 5 seconds (workflow waits 30s)...")
    time.sleep(5)
    
    # Test 5: Verify Last Run
    success, data = test_endpoint(
        "Verification: Last Run",
        "GET",
        f"{BASE_URL}/verification/last_run",
        expected_keys=["verified_count", "discrepancy_count"]
    )
    results["verification_last_run"] = success
    
    # Test 6: Check Alpaca Activity
    success, data = test_endpoint(
        "Verification: Alpaca Recent Activity",
        "GET",
        f"{BASE_URL}/verification/alpaca/recent_activity",
        expected_keys=["orders"]
    )
    results["alpaca_activity"] = success
    
    if success:
        orders = data.get("orders", [])
        print(f"  Orders Found: {len(orders)}")
    
    # Test 7: Daily Report
    success, data = test_endpoint(
        "Reports: Daily Summary",
        "GET",
        f"{BASE_URL}/reports/daily"
    )
    results["daily_report"] = success
    
    # Summary
    print(f"\n\n{'='*60}")
    print("📊 TEST SUMMARY")
    print(f"{'='*60}")
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for test_name, success in results.items():
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}  {test_name}")
    
    print(f"\n{'='*60}")
    print(f"Results: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
    print(f"{'='*60}")
    
    if passed == total:
        print("\n🎉 All endpoints are working! Workflow is ready for tomorrow.")
        print("\n📋 Next Steps:")
        print("   1. Import workflow to n8n: http://localhost:5678")
        print("   2. Activate the workflow")
        print("   3. Workflow will trigger at 9:30 AM EST tomorrow")
        return 0
    else:
        print("\n⚠️  Some endpoints failed. Review the errors above.")
        return 1


if __name__ == "__main__":
    exit(main())
