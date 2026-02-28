"""
Wave 84 – Config Loader + Startup Checks
-----------------------------------------
Gates:
  • ApexSettings fail-fast: PROFILE=prod raises ValueError when APCA or DB keys missing
  • /api/v3/ops/health returns correlation_id + ready + dependencies
  • /api/v3/ops/elasticsearch returns ES health schema
  • /api/v3/ops/broker returns broker health schema
  • run_all_checks() returns correct structure
Hard constraints: real server on :8090, ES on :9200, no mocks
"""

import os
import re
import sys
import time
import uuid
import importlib

import httpx
import pytest

BASE_URL = "http://127.0.0.1:8090"
TIMEOUT = 10.0


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------


def get(path: str, timeout: float = TIMEOUT) -> httpx.Response:
    return httpx.get(f"{BASE_URL}{path}", timeout=timeout)


# ---------------------------------------------------------------------------
# ApexSettings fail-fast (unit-level, no server needed)
# ---------------------------------------------------------------------------


class TestApexSettingsFailFast:
    """Verify ApexSettings raises ValueError in prod when required fields missing."""

    def test_profile_dev_never_raises(self):
        """Dev profile should always succeed even with missing APCA keys."""
        # ensure backend.core.config is importable
        import backend.core.config as cfg_mod

        # Reload with env overriding to dev
        old = os.environ.get("PROFILE")
        os.environ["PROFILE"] = "dev"
        # wipe keys to confirm dev doesn't blow up
        old_key = os.environ.pop("APCA_API_KEY_ID", None)
        old_sec = os.environ.pop("APCA_API_SECRET_KEY", None)
        try:
            # Force reload settings (bypass lru_cache)
            settings = cfg_mod.ApexSettings(
                _env_file=None,
                profile="dev",
                apca_api_key_id="",
                apca_api_secret_key="",
            )
            assert settings.profile == "dev"
        finally:
            if old:
                os.environ["PROFILE"] = old
            elif "PROFILE" in os.environ:
                del os.environ["PROFILE"]
            if old_key:
                os.environ["APCA_API_KEY_ID"] = old_key
            if old_sec:
                os.environ["APCA_API_SECRET_KEY"] = old_sec

    def test_profile_prod_requires_apca_key(self):
        """In prod, missing APCA key should raise ValueError."""
        import backend.core.config as cfg_mod

        with pytest.raises(ValueError, match="(?i)apca|broker|key"):
            cfg_mod.ApexSettings(
                _env_file=None,
                profile="prod",
                apca_api_key_id="",
                apca_api_secret_key="some_secret",
                database_url="postgresql://user:pass@localhost/db",
            )

    def test_profile_prod_requires_apca_secret(self):
        """In prod, missing APCA secret should raise ValueError."""
        import backend.core.config as cfg_mod

        with pytest.raises(ValueError, match="(?i)apca|broker|secret"):
            cfg_mod.ApexSettings(
                _env_file=None,
                profile="prod",
                apca_api_key_id="some_key",
                apca_api_secret_key="",
                database_url="postgresql://user:pass@localhost/db",
            )

    def test_profile_prod_requires_postgres_url(self):
        """In prod, SQLite URL should raise ValueError (postgres required)."""
        import backend.core.config as cfg_mod

        with pytest.raises(ValueError, match="(?i)postgres|database|prod"):
            cfg_mod.ApexSettings(
                _env_file=None,
                profile="prod",
                apca_api_key_id="some_key",
                apca_api_secret_key="some_secret",
                database_url="sqlite:///./test.db",
            )

    def test_profile_prod_passes_with_all_fields(self):
        """In prod, valid APCA + Postgres URL → no error."""
        import backend.core.config as cfg_mod

        settings = cfg_mod.ApexSettings(
            _env_file=None,
            profile="prod",
            apca_api_key_id="some_key",
            apca_api_secret_key="some_secret",
            database_url="postgresql://user:pass@localhost/db",
        )
        assert settings.profile == "prod"

    def test_correlation_id_field_exists(self):
        """run_all_checks should return a correlation_id."""
        import asyncio
        import backend.core.startup_checks as sc

        result = asyncio.run(sc.run_all_checks())
        assert "correlation_id" in result
        # must be a valid UUID-like string
        uuid.UUID(result["correlation_id"])

    def test_run_all_checks_returns_ready_flag(self):
        """run_all_checks should return a 'ready' boolean."""
        import asyncio
        import backend.core.startup_checks as sc

        result = asyncio.run(sc.run_all_checks())
        assert "ready" in result
        assert isinstance(result["ready"], bool)

    def test_run_all_checks_has_dependencies_dict(self):
        """run_all_checks result must contain a dependencies dict."""
        import asyncio
        import backend.core.startup_checks as sc

        result = asyncio.run(sc.run_all_checks())
        assert "dependencies" in result
        assert isinstance(result["dependencies"], dict)


# ---------------------------------------------------------------------------
# Live server – /api/v3/ops/health
# ---------------------------------------------------------------------------


class TestOpsHealthV3Live:
    """Live server tests for /api/v3/ops/health."""

    def test_ops_health_200(self):
        r = get("/api/v3/ops/health")
        assert r.status_code == 200

    def test_ops_health_has_correlation_id(self):
        r = get("/api/v3/ops/health")
        body = r.json()
        assert "correlation_id" in body
        uuid.UUID(body["correlation_id"])  # must parse as UUID

    def test_ops_health_ready_is_bool(self):
        r = get("/api/v3/ops/health")
        body = r.json()
        assert isinstance(body.get("ready"), bool)

    def test_ops_health_checked_at_is_float(self):
        r = get("/api/v3/ops/health")
        body = r.json()
        assert isinstance(body.get("checked_at"), float)
        assert body["checked_at"] > 1_700_000_000  # sanity: after 2023

    def test_ops_health_dependencies_has_elasticsearch(self):
        r = get("/api/v3/ops/health")
        deps = r.json().get("dependencies", {})
        assert "elasticsearch" in deps
        es = deps["elasticsearch"]
        assert "connected" in es
        assert isinstance(es["connected"], bool)

    def test_ops_health_dependencies_has_broker(self):
        r = get("/api/v3/ops/health")
        deps = r.json().get("dependencies", {})
        assert "broker" in deps
        broker = deps["broker"]
        assert "connected" in broker
        assert isinstance(broker["connected"], bool)

    def test_ops_health_es_connected(self):
        r = get("/api/v3/ops/health")
        es = r.json()["dependencies"]["elasticsearch"]
        assert es["connected"] is True, f"ES not connected: {es}"

    def test_ops_health_broker_connected(self):
        r = get("/api/v3/ops/health")
        broker = r.json()["dependencies"]["broker"]
        assert broker["connected"] is True, f"Broker not connected: {broker}"

    def test_ops_health_es_has_cluster_name(self):
        r = get("/api/v3/ops/health")
        es = r.json()["dependencies"]["elasticsearch"]
        assert "cluster_name" in es
        assert es["cluster_name"] == "apex-local"

    def test_ops_health_latency_ms_positive(self):
        r = get("/api/v3/ops/health")
        deps = r.json()["dependencies"]
        for dep_name, dep_data in deps.items():
            if "latency_ms" in dep_data:
                assert dep_data["latency_ms"] >= 0, f"{dep_name} latency_ms must be >= 0"

    def test_ops_elasticsearch_endpoint_200(self):
        r = get("/api/v3/ops/elasticsearch")
        assert r.status_code == 200

    def test_ops_elasticsearch_has_connected(self):
        r = get("/api/v3/ops/elasticsearch")
        body = r.json()
        assert "connected" in body
        assert body["connected"] is True

    def test_ops_broker_endpoint_200(self):
        r = get("/api/v3/ops/broker")
        assert r.status_code == 200

    def test_ops_broker_has_account_status(self):
        r = get("/api/v3/ops/broker")
        body = r.json()
        assert "account_status" in body
        assert body["account_status"] == "ACTIVE"

    def test_ops_broker_not_trading_blocked(self):
        r = get("/api/v3/ops/broker")
        body = r.json()
        assert body.get("trading_blocked") is False

    def test_ops_health_correlation_id_differs_per_call(self):
        """Each call should generate a new correlation_id."""
        r1 = get("/api/v3/ops/health")
        r2 = get("/api/v3/ops/health")
        assert r1.json()["correlation_id"] != r2.json()["correlation_id"]
