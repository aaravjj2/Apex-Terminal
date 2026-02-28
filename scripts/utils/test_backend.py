#!/usr/bin/env python3
"""
Quick backend verification test - checks consolidated autopilot API
"""

import requests
import sys
import json

BASE_URL = "http://localhost:8000"

def test_health():
    """Test basic health endpoint"""
    resp = requests.get(f"{BASE_URL}/health")
    print(f"✓ Health check: {resp.status_code}")
    assert resp.status_code == 200
    data = resp.json()
    print(f"  Status: {data['status']}")
    print(f"  Mode: {data['mode']}")

def test_autopilot_status():
    """Test unified autopilot status endpoint"""
    resp = requests.get(f"{BASE_URL}/api/v1/autopilot/status")
    print(f"✓ Autopilot status: {resp.status_code}")
    assert resp.status_code == 200
    data = resp.json()
    print(f"  Running: {data['is_running']}")
    print(f"  Kill Switch: {data['kill_switch_active']}")
    print(f"  Phase: {data['current_phase']}")

def test_autopilot_ws_status():
    """Test WebSocket status endpoint"""
    resp = requests.get(f"{BASE_URL}/api/v1/autopilot/ws_status")
    print(f"✓ WebSocket status: {resp.status_code}")
    assert resp.status_code == 200
    data = resp.json()
    print(f"  Connections: {data['connections']}")
    print(f"  Subscriptions: {data['subscriptions']}")
    print(f"  Heartbeat: {data['heartbeat_running']}")

def test_autopilot_health():
    """Test autopilot health endpoint"""
    resp = requests.get(f"{BASE_URL}/api/v1/autopilot/health")
    print(f"✓ Autopilot health: {resp.status_code}")
    assert resp.status_code == 200
    data = resp.json()
    print(f"  Status: {data['status']}")
    print(f"  Engine Running: {data['engine_running']}")

def test_autopilot_config():
    """Test autopilot config endpoint"""
    resp = requests.get(f"{BASE_URL}/api/v1/autopilot/config")
    print(f"✓ Autopilot config: {resp.status_code}")
    assert resp.status_code == 200
    data = resp.json()
    cfg = data.get("config", {})
    print(f"  Paper Equity: ${cfg.get('paper_equity')}")
    print(f"  Mode: {cfg.get('mode')}")

def test_legacy_endpoints_removed():
    """Verify legacy autopilot endpoints are gone"""
    # These should NOT exist anymore (404)
    legacy_endpoints = [
        "/api/v1/autopilot-legacy/config",
    ]
    
    for endpoint in legacy_endpoints:
        resp = requests.get(f"{BASE_URL}{endpoint}")
        if resp.status_code == 404:
            print(f"✓ Legacy endpoint removed: {endpoint}")
        else:
            print(f"✗ Legacy endpoint still exists: {endpoint} ({resp.status_code})")

def main():
    print("=" * 60)
    print("Backend Consolidation Test")
    print("=" * 60)
    print()
    
    try:
        test_health()
        print()
        test_autopilot_status()
        print()
        test_autopilot_ws_status()
        print()
        test_autopilot_health()
        print()
        test_autopilot_config()
        print()
        test_legacy_endpoints_removed()
        print()
        print("=" * 60)
        print("✓ All tests passed!")
        print("=" * 60)
        return 0
    except Exception as e:
        print(f"\n✗ Test failed: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    sys.exit(main())
