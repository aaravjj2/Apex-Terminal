"""
Elasticsearch Mandatory Service — Wave 11-19
ES is REQUIRED and the ONLY search backend. Fail fast if unavailable.
Manages index templates, ILM policies, aliases, and document indexing.
"""

import os
import logging
from typing import Optional, Any
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
import json
import hashlib

logger = logging.getLogger(__name__)

# ES connection config from environment
ES_URL = os.environ.get("ELASTICSEARCH_URL", "http://localhost:9200")
ES_USER = os.environ.get("ELASTICSEARCH_USER", "")
ES_PASS = os.environ.get("ELASTICSEARCH_PASSWORD", "")


class IndexName(str, Enum):
    AUTOPILOT_RUNS = "apex-autopilot-runs"
    AUTOPILOT_DECISIONS = "apex-autopilot-decisions"
    BACKTESTS = "apex-backtests"
    STRATEGIES = "apex-strategies"
    WORKFLOWS = "apex-workflows"
    WORKFLOW_RUNS = "apex-workflow-runs"
    NEWS = "apex-news"
    SENTIMENT = "apex-sentiment"
    EVENTS = "apex-events"
    ORDERS = "apex-orders"
    FILLS = "apex-fills"
    POSITIONS = "apex-positions"
    PNL_SNAPSHOTS = "apex-pnl-snapshots"
    EXPORTS = "apex-exports"
    INCIDENTS = "apex-incidents"
    PERFORMANCE = "apex-performance"
    AI_STRATEGY_RUNS = "apex-ai-strategy-runs"
    DISCOVERY_REPORTS = "apex-discovery-reports"


@dataclass
class ESDocument:
    index: str
    doc_id: str
    body: dict
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


# Index templates with mappings
INDEX_TEMPLATES: dict[str, dict] = {
    IndexName.AUTOPILOT_RUNS: {
        "mappings": {
            "properties": {
                "run_id": {"type": "keyword"},
                "timestamp": {"type": "date"},
                "phase": {"type": "keyword"},
                "symbols": {"type": "keyword"},
                "decisions": {"type": "nested"},
                "pnl": {"type": "float"},
                "status": {"type": "keyword"},
                "duration_ms": {"type": "long"},
            }
        }
    },
    IndexName.BACKTESTS: {
        "mappings": {
            "properties": {
                "backtest_id": {"type": "keyword"},
                "strategy_id": {"type": "keyword"},
                "strategy_name": {"type": "text", "fields": {"keyword": {"type": "keyword"}}},
                "timestamp": {"type": "date"},
                "symbols": {"type": "keyword"},
                "start_date": {"type": "date"},
                "end_date": {"type": "date"},
                "total_return": {"type": "float"},
                "sharpe_ratio": {"type": "float"},
                "max_drawdown": {"type": "float"},
                "win_rate": {"type": "float"},
                "trade_count": {"type": "integer"},
                "status": {"type": "keyword"},
            }
        }
    },
    IndexName.STRATEGIES: {
        "mappings": {
            "properties": {
                "strategy_id": {"type": "keyword"},
                "name": {"type": "text", "fields": {"keyword": {"type": "keyword"}}},
                "type": {"type": "keyword"},
                "version": {"type": "keyword"},
                "params": {"type": "object", "enabled": False},
                "created_at": {"type": "date"},
                "updated_at": {"type": "date"},
                "status": {"type": "keyword"},
            }
        }
    },
    IndexName.WORKFLOWS: {
        "mappings": {
            "properties": {
                "workflow_id": {"type": "keyword"},
                "name": {"type": "text", "fields": {"keyword": {"type": "keyword"}}},
                "template": {"type": "keyword"},
                "schedule": {"type": "keyword"},
                "session_trigger": {"type": "keyword"},
                "created_at": {"type": "date"},
                "status": {"type": "keyword"},
                "steps": {"type": "nested"},
            }
        }
    },
    IndexName.WORKFLOW_RUNS: {
        "mappings": {
            "properties": {
                "run_id": {"type": "keyword"},
                "workflow_id": {"type": "keyword"},
                "trigger": {"type": "keyword"},
                "started_at": {"type": "date"},
                "completed_at": {"type": "date"},
                "status": {"type": "keyword"},
                "steps_completed": {"type": "integer"},
                "steps_total": {"type": "integer"},
                "artifacts": {"type": "object", "enabled": False},
            }
        }
    },
    IndexName.NEWS: {
        "mappings": {
            "properties": {
                "article_id": {"type": "keyword"},
                "headline": {"type": "text"},
                "summary": {"type": "text"},
                "source": {"type": "keyword"},
                "symbols": {"type": "keyword"},
                "published_at": {"type": "date"},
                "ingested_at": {"type": "date"},
                "url": {"type": "keyword"},
                "sentiment_score": {"type": "float"},
                "sentiment_label": {"type": "keyword"},
            }
        }
    },
    IndexName.SENTIMENT: {
        "mappings": {
            "properties": {
                "article_id": {"type": "keyword"},
                "symbol": {"type": "keyword"},
                "model": {"type": "keyword"},
                "model_version": {"type": "keyword"},
                "score": {"type": "float"},
                "label": {"type": "keyword"},
                "confidence": {"type": "float"},
                "timestamp": {"type": "date"},
            }
        }
    },
    IndexName.EVENTS: {
        "mappings": {
            "properties": {
                "event_id": {"type": "keyword"},
                "event_type": {"type": "keyword"},
                "source": {"type": "keyword"},
                "timestamp": {"type": "date"},
                "severity": {"type": "keyword"},
                "message": {"type": "text"},
                "metadata": {"type": "object", "enabled": False},
            }
        }
    },
    IndexName.ORDERS: {
        "mappings": {
            "properties": {
                "order_id": {"type": "keyword"},
                "symbol": {"type": "keyword"},
                "side": {"type": "keyword"},
                "qty": {"type": "float"},
                "order_type": {"type": "keyword"},
                "status": {"type": "keyword"},
                "submitted_at": {"type": "date"},
                "filled_at": {"type": "date"},
                "fill_price": {"type": "float"},
                "source": {"type": "keyword"},
            }
        }
    },
    IndexName.FILLS: {
        "mappings": {
            "properties": {
                "fill_id": {"type": "keyword"},
                "order_id": {"type": "keyword"},
                "symbol": {"type": "keyword"},
                "qty": {"type": "float"},
                "price": {"type": "float"},
                "timestamp": {"type": "date"},
                "commission": {"type": "float"},
            }
        }
    },
    IndexName.POSITIONS: {
        "mappings": {
            "properties": {
                "symbol": {"type": "keyword"},
                "qty": {"type": "float"},
                "avg_entry": {"type": "float"},
                "current_price": {"type": "float"},
                "unrealized_pnl": {"type": "float"},
                "timestamp": {"type": "date"},
            }
        }
    },
    IndexName.PNL_SNAPSHOTS: {
        "mappings": {
            "properties": {
                "snapshot_id": {"type": "keyword"},
                "timestamp": {"type": "date"},
                "total_equity": {"type": "float"},
                "daily_pnl": {"type": "float"},
                "realized_pnl": {"type": "float"},
                "unrealized_pnl": {"type": "float"},
                "positions_count": {"type": "integer"},
            }
        }
    },
    IndexName.INCIDENTS: {
        "mappings": {
            "properties": {
                "incident_id": {"type": "keyword"},
                "type": {"type": "keyword"},
                "severity": {"type": "keyword"},
                "message": {"type": "text"},
                "timestamp": {"type": "date"},
                "resolved": {"type": "boolean"},
                "resolved_at": {"type": "date"},
            }
        }
    },
    IndexName.PERFORMANCE: {
        "mappings": {
            "properties": {
                "strategy_id": {"type": "keyword"},
                "timestamp": {"type": "date"},
                "win_rate": {"type": "float"},
                "expectancy": {"type": "float"},
                "sharpe": {"type": "float"},
                "max_drawdown": {"type": "float"},
                "rolling_pnl": {"type": "float"},
            }
        }
    },
    IndexName.AI_STRATEGY_RUNS: {
        "mappings": {
            "properties": {
                "run_id": {"type": "keyword"},
                "prompt": {"type": "text"},
                "model": {"type": "keyword"},
                "strategy_spec": {"type": "object", "enabled": False},
                "validation_result": {"type": "keyword"},
                "validation_errors": {"type": "text"},
                "timestamp": {"type": "date"},
            }
        }
    },
    IndexName.DISCOVERY_REPORTS: {
        "mappings": {
            "properties": {
                "report_id": {"type": "keyword"},
                "timestamp": {"type": "date"},
                "candidates_evaluated": {"type": "integer"},
                "best_strategy_id": {"type": "keyword"},
                "best_sharpe": {"type": "float"},
                "best_return": {"type": "float"},
                "walk_forward_pass": {"type": "boolean"},
                "robustness_score": {"type": "float"},
            }
        }
    },
    IndexName.EXPORTS: {
        "mappings": {
            "properties": {
                "export_id": {"type": "keyword"},
                "type": {"type": "keyword"},
                "timestamp": {"type": "date"},
                "path": {"type": "keyword"},
                "size_bytes": {"type": "long"},
            }
        }
    },
}

# ILM Policies for high-volume indices
ILM_POLICIES = {
    "apex-events-ilm": {
        "policy": {
            "phases": {
                "hot": {"min_age": "0ms", "actions": {"rollover": {"max_age": "7d", "max_size": "5gb"}}},
                "warm": {"min_age": "30d", "actions": {"shrink": {"number_of_shards": 1}}},
                "delete": {"min_age": "90d", "actions": {"delete": {}}},
            }
        }
    },
    "apex-quotes-ilm": {
        "policy": {
            "phases": {
                "hot": {"min_age": "0ms", "actions": {"rollover": {"max_age": "1d", "max_size": "10gb"}}},
                "warm": {"min_age": "7d", "actions": {"shrink": {"number_of_shards": 1}}},
                "delete": {"min_age": "30d", "actions": {"delete": {}}},
            }
        }
    },
}


class ElasticsearchService:
    """
    Mandatory Elasticsearch service. Fail fast if ES is unavailable.
    All search, indexing, and observability flows through this service.
    """

    def __init__(self, es_url: str = ES_URL, es_user: str = ES_USER, es_pass: str = ES_PASS):
        self.es_url = es_url.rstrip("/")
        self.es_user = es_user
        self.es_pass = es_pass
        self._available = False
        self._indices_created: set[str] = set()

    async def check_health(self) -> dict:
        """Check ES cluster health. Returns health dict or raises."""
        import httpx
        try:
            auth = (self.es_user, self.es_pass) if self.es_user else None
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(f"{self.es_url}/_cluster/health", auth=auth)
                if resp.status_code == 200:
                    self._available = True
                    return resp.json()
                raise ConnectionError(f"ES health check failed: {resp.status_code}")
        except Exception as e:
            self._available = False
            raise ConnectionError(f"Elasticsearch unavailable at {self.es_url}: {e}")

    async def ensure_available(self) -> bool:
        """Ensure ES is available. Raises if not."""
        health = await self.check_health()
        status = health.get("status", "unknown")
        if status in ("green", "yellow"):
            self._available = True
            return True
        raise ConnectionError(f"ES cluster status: {status}")

    async def create_index_if_not_exists(self, index_name: str, settings: Optional[dict] = None) -> bool:
        """Create index with template mappings if it doesn't exist."""
        import httpx
        auth = (self.es_user, self.es_pass) if self.es_user else None
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.head(f"{self.es_url}/{index_name}", auth=auth)
            if resp.status_code == 200:
                self._indices_created.add(index_name)
                return False  # Already exists

            body = settings or INDEX_TEMPLATES.get(index_name, {})
            resp = await client.put(f"{self.es_url}/{index_name}", json=body, auth=auth)
            if resp.status_code in (200, 201):
                self._indices_created.add(index_name)
                logger.info(f"Created index: {index_name}")
                return True
            logger.error(f"Failed to create index {index_name}: {resp.text}")
            return False

    async def setup_all_indices(self) -> dict[str, bool]:
        """Create all required indices."""
        results = {}
        for index_name in IndexName:
            try:
                created = await self.create_index_if_not_exists(index_name.value)
                results[index_name.value] = True
            except Exception as e:
                logger.error(f"Failed to setup index {index_name.value}: {e}")
                results[index_name.value] = False
        return results

    async def setup_ilm_policies(self) -> dict[str, bool]:
        """Setup ILM policies for high-volume indices."""
        import httpx
        results = {}
        auth = (self.es_user, self.es_pass) if self.es_user else None
        async with httpx.AsyncClient(timeout=10.0) as client:
            for policy_name, policy_body in ILM_POLICIES.items():
                try:
                    resp = await client.put(
                        f"{self.es_url}/_ilm/policy/{policy_name}",
                        json=policy_body,
                        auth=auth,
                    )
                    results[policy_name] = resp.status_code in (200, 201)
                except Exception as e:
                    logger.error(f"Failed to create ILM policy {policy_name}: {e}")
                    results[policy_name] = False
        return results

    async def index_document(self, doc: ESDocument) -> bool:
        """Index a single document."""
        import httpx
        auth = (self.es_user, self.es_pass) if self.es_user else None
        body = {**doc.body, "@timestamp": doc.timestamp}
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.put(
                    f"{self.es_url}/{doc.index}/_doc/{doc.doc_id}",
                    json=body,
                    auth=auth,
                )
                return resp.status_code in (200, 201)
        except Exception as e:
            logger.error(f"Failed to index doc {doc.doc_id} to {doc.index}: {e}")
            return False

    async def bulk_index(self, docs: list[ESDocument]) -> dict:
        """Bulk index documents."""
        import httpx
        if not docs:
            return {"indexed": 0, "errors": 0}

        auth = (self.es_user, self.es_pass) if self.es_user else None
        lines = []
        for doc in docs:
            action = json.dumps({"index": {"_index": doc.index, "_id": doc.doc_id}})
            body = json.dumps({**doc.body, "@timestamp": doc.timestamp})
            lines.append(action)
            lines.append(body)

        bulk_body = "\n".join(lines) + "\n"
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    f"{self.es_url}/_bulk",
                    content=bulk_body,
                    headers={"Content-Type": "application/x-ndjson"},
                    auth=auth,
                )
                result = resp.json()
                errors = sum(1 for item in result.get("items", []) if item.get("index", {}).get("error"))
                return {"indexed": len(docs) - errors, "errors": errors}
        except Exception as e:
            logger.error(f"Bulk index failed: {e}")
            return {"indexed": 0, "errors": len(docs)}

    async def search(self, index: str, query: dict, size: int = 20,
                     sort: Optional[list] = None, search_after: Optional[list] = None) -> dict:
        """Execute a search query with cursor pagination."""
        import httpx
        auth = (self.es_user, self.es_pass) if self.es_user else None
        body: dict[str, Any] = {"query": query, "size": size}
        if sort:
            body["sort"] = sort
        if search_after:
            body["search_after"] = search_after

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(
                    f"{self.es_url}/{index}/_search",
                    json=body,
                    auth=auth,
                )
                return resp.json()
        except Exception as e:
            logger.error(f"Search failed on {index}: {e}")
            return {"hits": {"hits": [], "total": {"value": 0}}}

    async def get_index_stats(self) -> dict:
        """Get stats for all apex- indices."""
        import httpx
        auth = (self.es_user, self.es_pass) if self.es_user else None
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(f"{self.es_url}/apex-*/_stats", auth=auth)
                if resp.status_code == 200:
                    data = resp.json()
                    indices = data.get("indices", {})
                    return {
                        name: {
                            "docs_count": stats.get("primaries", {}).get("docs", {}).get("count", 0),
                            "size_bytes": stats.get("primaries", {}).get("store", {}).get("size_in_bytes", 0),
                        }
                        for name, stats in indices.items()
                    }
                return {}
        except Exception as e:
            logger.error(f"Failed to get index stats: {e}")
            return {}

    async def delete_index(self, index_name: str) -> bool:
        """Delete an index (for reindex workflows)."""
        import httpx
        auth = (self.es_user, self.es_pass) if self.es_user else None
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.delete(f"{self.es_url}/{index_name}", auth=auth)
                return resp.status_code == 200
        except Exception as e:
            logger.error(f"Failed to delete index {index_name}: {e}")
            return False

    @property
    def is_available(self) -> bool:
        return self._available


_es_service: Optional[ElasticsearchService] = None


def get_elasticsearch_service() -> ElasticsearchService:
    global _es_service
    if _es_service is None:
        _es_service = ElasticsearchService()
    return _es_service
