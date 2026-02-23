"""
Wave 109 — Docker compose + judge mode tests.
Verifies infrastructure files, compose config, and the full running stack.
"""
from __future__ import annotations

import os
import re

import requests
import yaml

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
API = "http://localhost:8090"


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _path(*parts: str) -> str:
    return os.path.join(ROOT, *parts)


def _load_compose() -> dict:
    with open(_path("docker-compose.judge.yml")) as f:
        return yaml.safe_load(f)


def _read_run_local() -> str:
    with open(_path("docs", "RUN_LOCAL.md")) as f:
        return f.read()


# ─────────────────────────────────────────────────────────────────────────────
# Infrastructure file existence
# ─────────────────────────────────────────────────────────────────────────────

class TestInfraFiles:
    def test_compose_judge_yml_exists(self):
        assert os.path.isfile(_path("docker-compose.judge.yml")), \
            "docker-compose.judge.yml missing"

    def test_run_local_md_exists(self):
        assert os.path.isfile(_path("docs", "RUN_LOCAL.md")), \
            "docs/RUN_LOCAL.md missing"

    def test_bootstrap_sh_exists(self):
        assert os.path.isfile(_path("scripts", "bootstrap_keys_example.sh")), \
            "scripts/bootstrap_keys_example.sh missing"

    def test_bootstrap_ps1_exists(self):
        assert os.path.isfile(_path("scripts", "bootstrap_keys_example.ps1")), \
            "scripts/bootstrap_keys_example.ps1 missing"

    def test_keys_env_example_exists(self):
        assert os.path.isfile(_path("keys.env.example")), \
            "keys.env.example missing"


# ─────────────────────────────────────────────────────────────────────────────
# keys.env.example content
# ─────────────────────────────────────────────────────────────────────────────

class TestKeysTemplate:
    def test_keys_env_example_has_finnhub(self):
        content = open(_path("keys.env.example")).read()
        assert "FINNHUB" in content or "finnhub" in content.lower()

    def test_keys_env_example_has_alpaca(self):
        content = open(_path("keys.env.example")).read()
        assert "APCA" in content or "ALPACA" in content or "alpaca" in content.lower()

    def test_keys_env_example_has_postgres(self):
        content = open(_path("keys.env.example")).read()
        assert "POSTGRES" in content

    def test_keys_env_example_no_real_secrets(self):
        content = open(_path("keys.env.example")).read()
        # Should only have placeholder values
        assert "your_" in content or "your-" in content or "placeholder" in content.lower() \
            or all(len(line) == 0 or "=" not in line or line.strip().endswith("_here")
                   or line.strip().endswith("_key") or "your_" in line
                   for line in content.splitlines()
                   if "KEY" in line or "PASSWORD" in line or "SECRET" in line)


# ─────────────────────────────────────────────────────────────────────────────
# docker-compose.judge.yml content
# ─────────────────────────────────────────────────────────────────────────────

class TestComposeFile:
    def test_compose_has_postgres(self):
        compose = _load_compose()
        services = compose.get("services", {})
        # Check for any postgres service
        pg_services = [k for k, v in services.items()
                       if "postgres" in str(v.get("image", "")).lower()]
        assert pg_services, "No postgres service found in docker-compose.judge.yml"

    def test_compose_has_elasticsearch(self):
        compose = _load_compose()
        services = compose.get("services", {})
        es_services = [k for k, v in services.items()
                       if "elasticsearch" in str(v.get("image", "")).lower()]
        assert es_services, "No elasticsearch service found in docker-compose.judge.yml"

    def test_compose_has_kibana(self):
        compose = _load_compose()
        services = compose.get("services", {})
        kibana_services = [k for k, v in services.items()
                           if "kibana" in str(v.get("image", "")).lower()]
        assert kibana_services, "No kibana service found in docker-compose.judge.yml"

    def test_compose_has_backend(self):
        compose = _load_compose()
        services = compose.get("services", {})
        # Backend is built (not a published image)
        backend_services = [k for k, v in services.items()
                            if "build" in v or "uvicorn" in str(v.get("command", ""))]
        assert backend_services, "No backend service found in docker-compose.judge.yml"

    def test_compose_has_frontend(self):
        compose = _load_compose()
        services = compose.get("services", {})
        frontend_services = [k for k, v in services.items()
                             if "5100" in str(v.get("ports", "")) or "node" in str(v.get("image", ""))]
        assert frontend_services, "No frontend service found in docker-compose.judge.yml"

    def test_compose_backend_exposes_8090(self):
        compose = _load_compose()
        services = compose.get("services", {})
        backend = services.get("backend") or next(
            (v for v in services.values() if "uvicorn" in str(v.get("command", ""))), None
        )
        assert backend is not None, "Backend service not found"
        ports = str(backend.get("ports", ""))
        cmd = str(backend.get("command", ""))
        assert "8090" in ports or "8090" in cmd, \
            f"Backend does not use port 8090: ports={ports}, cmd={cmd}"

    def test_compose_es_has_healthcheck(self):
        compose = _load_compose()
        services = compose.get("services", {})
        es = next(
            (v for v in services.values()
             if "elasticsearch" in str(v.get("image", "")).lower()), None
        )
        assert es is not None
        assert "healthcheck" in es, "ES service missing healthcheck"

    def test_compose_has_volumes(self):
        compose = _load_compose()
        assert "volumes" in compose, "docker-compose.judge.yml missing top-level volumes"

    def test_compose_es_version_8(self):
        compose = _load_compose()
        services = compose.get("services", {})
        es = next(
            (v for v in services.values()
             if "elasticsearch" in str(v.get("image", "")).lower()), None
        )
        image = es.get("image", "")
        assert image.startswith("elasticsearch:8"), \
            f"ES image should be version 8, got: {image}"


# ─────────────────────────────────────────────────────────────────────────────
# RUN_LOCAL.md — exactly 3 commands
# ─────────────────────────────────────────────────────────────────────────────

class TestRunLocalMd:
    def test_has_quick_start_section(self):
        content = _read_run_local()
        assert "## Quick Start" in content

    def test_has_exactly_3_commands_in_quick_start(self):
        content = _read_run_local()
        # Extract text between '## Quick Start' and the next '---' or '##' heading
        match = re.search(r"## Quick Start(.*?)(?:^---|\Z|^## )", content,
                          re.DOTALL | re.MULTILINE)
        assert match, "## Quick Start section not found"
        section = match.group(1)
        # Count ```bash blocks in that section
        bash_blocks = re.findall(r"```bash\n", section)
        assert len(bash_blocks) == 3, \
            f"Expected exactly 3 bash commands in Quick Start, found {len(bash_blocks)}"

    def test_quick_start_has_bootstrap_command(self):
        content = _read_run_local()
        assert "bootstrap_keys_example" in content

    def test_quick_start_has_docker_compose_command(self):
        content = _read_run_local()
        assert "docker-compose.judge.yml" in content or "docker compose" in content

    def test_quick_start_has_verify_command(self):
        content = _read_run_local()
        assert "curl" in content or "http://localhost:8090" in content


# ─────────────────────────────────────────────────────────────────────────────
# Stack health (running local stack)
# ─────────────────────────────────────────────────────────────────────────────

class TestStackHealth:
    def test_backend_reachable(self):
        r = requests.get(f"{API}/api/v3/export/version", timeout=5)
        assert r.status_code == 200

    def test_w104_a11y_version(self):
        r = requests.get(f"{API}/api/v3/a11y/version", timeout=5)
        assert r.status_code == 200
        body = r.json()
        assert body["version"].startswith("w104")

    def test_w105_perf_version(self):
        r = requests.get(f"{API}/api/v3/perf/version", timeout=5)
        assert r.status_code == 200
        body = r.json()
        assert body["version"].startswith("w105")

    def test_w106_controls_version(self):
        r = requests.get(f"{API}/api/v3/controls/version", timeout=5)
        assert r.status_code == 200
        body = r.json()
        assert body["version"].startswith("w106")

    def test_w107_tickets_version(self):
        r = requests.get(f"{API}/api/v3/tickets/version", timeout=5)
        assert r.status_code == 200
        body = r.json()
        assert body["version"].startswith("w107")

    def test_w108_export_version(self):
        r = requests.get(f"{API}/api/v3/export/version", timeout=5)
        assert r.status_code == 200
        body = r.json()
        assert body["version"].startswith("w108")

    def test_es_cluster_health(self):
        r = requests.get("http://localhost:9200/_cluster/health", timeout=5)
        assert r.status_code == 200
        body = r.json()
        assert body.get("status") in ("green", "yellow")

    def test_es_version_8(self):
        r = requests.get("http://localhost:9200", timeout=5)
        assert r.status_code == 200
        body = r.json()
        version = body.get("version", {}).get("number", "")
        assert version.startswith("8"), f"Expected ES 8.x, got {version}"

    def test_all_versions_respond_200(self):
        # All wave version endpoints should return 200 and include a version field
        for path in ["/api/v3/a11y/version", "/api/v3/perf/version",
                     "/api/v3/controls/version", "/api/v3/tickets/version",
                     "/api/v3/export/version"]:
            r = requests.get(f"{API}{path}", timeout=5)
            assert r.status_code == 200, f"{path} not 200"
            body = r.json()
            assert "version" in body, f"{path} missing version field: {body}"

    def test_w107_w108_have_status_ok(self):
        # W107 tickets and W108 export include status: ok
        for path in ["/api/v3/tickets/version", "/api/v3/export/version"]:
            r = requests.get(f"{API}{path}", timeout=5)
            assert r.status_code == 200, f"{path} not 200"
            body = r.json()
            assert body.get("status") == "ok", f"{path} status not ok: {body}"
