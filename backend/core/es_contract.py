"""
backend/core/es_contract.py — Wave 001

Elasticsearch Contract enforcement.
Canonical naming, doc_id hashing, contract version display.
"""
from __future__ import annotations

import hashlib
import json
import os
from typing import Any, Dict

CONTRACT_VERSION = "5.0"
CONTRACT_MANAGED_BY = "apex-terminal-elastihack"

ENTITY_TYPES = [
    "events", "strategies", "backtests", "workflows",
    "jobs", "tickets", "edges", "tool_traces",
]

EXTRA_INDICES = [
    "backtest-trades", "backtest-metrics", "agent-runs", "dlq",
]

ILM_POLICIES = {
    "apex-high-volume": {
        "applies_to": ["events", "tool_traces"],
        "hot_max_age": "7d",
        "warm_min_age": "30d",
        "delete_min_age": "90d",
    },
    "apex-standard": {
        "applies_to": ["backtests", "strategies", "workflows", "jobs"],
        "hot_max_age": None,
        "warm_min_age": "90d",
        "delete_min_age": "365d",
    },
    "apex-audit": {
        "applies_to": ["edges", "tickets"],
        "hot_max_age": None,
        "warm_min_age": None,
        "delete_min_age": "730d",
    },
}

SYNONYMS = [
    "backtest, bt, simulation",
    "strategy, strat, algo",
    "drawdown, dd, max_dd",
    "sharpe, sharpe_ratio",
    "cagr, compound_growth",
    "trade, fill, execution",
    "equity, portfolio_value, nav",
    "risk, var, volatility",
    "agent, ai_agent, bot",
]


def doc_id(entity_type: str, canonical_json: Dict[str, Any]) -> str:
    """SHA-256 of canonical JSON → first 24 hex chars. Idempotent."""
    payload = json.dumps(canonical_json, sort_keys=True, default=str)
    return hashlib.sha256(payload.encode()).hexdigest()[:24]


def index_name(entity_type: str, suffix: str | None = None) -> str:
    from datetime import datetime
    s = suffix or datetime.utcnow().strftime("%Y.%m")
    return f"apex-{entity_type}-{s}"


def write_alias(entity_type: str) -> str:
    return f"apex-{entity_type}-write"


def read_alias(entity_type: str) -> str:
    return f"apex-{entity_type}-read"


def get_contract_info() -> Dict[str, Any]:
    """Return contract metadata for /ops/elasticsearch display."""
    return {
        "contract_version": CONTRACT_VERSION,
        "managed_by": CONTRACT_MANAGED_BY,
        "entity_types": ENTITY_TYPES,
        "extra_indices": EXTRA_INDICES,
        "ilm_policies": list(ILM_POLICIES.keys()),
        "synonym_count": len(SYNONYMS),
        "doc_id_algo": "sha256-first24",
        "alias_convention": "apex-{type}-write / apex-{type}-read",
    }


def get_es_url() -> str:
    return os.environ.get("ELASTICSEARCH_URL", "http://localhost:9200").rstrip("/")


def is_es_required() -> bool:
    return os.environ.get("ELASTIC_REQUIRED", "").lower() in ("1", "true", "yes")


def is_vector_enabled() -> bool:
    return os.environ.get("ELASTICSEARCH_VECTOR_ENABLED", "").lower() in ("1", "true", "yes")
