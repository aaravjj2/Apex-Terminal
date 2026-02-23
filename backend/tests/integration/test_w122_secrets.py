"""
Wave 122 â€” Secrets hygiene.

Verifies:
  - account_number is redacted in broker health response
  - No raw Alpaca secrets in API responses
  - check_secrets.py script exists
"""
from __future__ import annotations

import os
import re

import requests

WORKSPACE = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..")
)
BASE = "http://localhost:8090"


class TestW122Secrets:
    def test_check_secrets_script_exists(self):
        path = os.path.join(WORKSPACE, "scripts", "check_secrets.py")
        assert os.path.isfile(path)

    def test_broker_account_is_redacted(self):
        r = requests.get(f"{BASE}/api/v3/ops/broker", timeout=10)
        assert r.status_code == 200
        data = r.json()
        acct = data.get("account_number", "")
        # Must be masked â€” either *** prefix format or partial mask
        assert "***" in acct or re.search(r"\*+", acct), (
            f"account_number not redacted: {acct!r}"
        )

    def test_broker_no_raw_key(self):
        r = requests.get(f"{BASE}/api/v3/ops/broker", timeout=10)
        text = r.text
        # Alpaca live keys start with PK / AK followed by long alphanumeric
        assert not re.search(r"\bPK[A-Z0-9]{16,}\b", text)
        assert not re.search(r"\bSK[A-Z0-9]{16,}\b", text)

    def test_health_no_raw_key(self):
        r = requests.get(f"{BASE}/api/v3/ops/health", timeout=10)
        text = r.text
        assert not re.search(r"\bPK[A-Z0-9]{16,}\b", text)

    def test_ws_health_no_raw_key(self):
        r = requests.get(f"{BASE}/api/v3/ops/ws/health", timeout=10)
        text = r.text
        assert not re.search(r"\bPK[A-Z0-9]{16,}\b", text)

    def test_es_health_no_raw_key(self):
        r = requests.get(f"{BASE}/api/v3/ops/elasticsearch", timeout=10)
        text = r.text
        assert not re.search(r"\bPK[A-Z0-9]{16,}\b", text)

    def test_check_secrets_script_has_patterns(self):
        path = os.path.join(WORKSPACE, "scripts", "check_secrets.py")
        content = open(path, encoding='utf-8').read()
        assert "ALPACA" in content or "PK" in content

    def test_w122_spec_exists(self):
        spec = os.path.join(
            WORKSPACE, "frontend", "tests", "e2e", "hardening", "w122-secrets.spec.ts"
        )
        assert os.path.isfile(spec)

