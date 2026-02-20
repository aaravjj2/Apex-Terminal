"""
Search Depth Routes — Provider Status, Explain View, Elastic Adapter
Pure deterministic demo endpoints. Elasticsearch is OFF by default.
"""
import hashlib, json
from typing import List, Optional
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/api/ui2/search-depth")

DEMO_TS = "2026-02-15T14:30:00Z"


def _fnv32(s: str) -> int:
    h = 0x811C9DC5
    for c in s:
        h ^= ord(c)
        h = (h * 0x01000193) & 0xFFFFFFFF
    return h


# ── Models ───────────────────────────────────────────────────────────────────

class ProviderStatus(BaseModel):
    active_backend: str
    doc_count: int
    index_count: int
    last_index_build: str
    health: str
    version: str
    index_prefix: str
    is_reachable: bool


class MappingField(BaseModel):
    field_name: str
    field_type: str
    indexed: bool
    analyzed: bool


class IndexMapping(BaseModel):
    index_name: str
    fields: List[MappingField]
    doc_count: int
    last_updated: str


class ExplainFactor(BaseModel):
    factor: str
    weight: float
    score: float
    description: str


class SearchExplain(BaseModel):
    doc_id: str
    query: str
    backend: str
    total_score: float
    factors: List[ExplainFactor]
    doc_id_hash: str
    explain_hash: str


class SearchConfig(BaseModel):
    provider: str
    elastic_configured: bool
    elastic_url: Optional[str]
    index_prefix: str


# ── Demo Data ────────────────────────────────────────────────────────────────

_MAPPINGS: List[IndexMapping] = [
    IndexMapping(
        index_name="apex-orders", doc_count=156, last_updated=DEMO_TS,
        fields=[
            MappingField(field_name="doc_id", field_type="keyword", indexed=True, analyzed=False),
            MappingField(field_name="title", field_type="text", indexed=True, analyzed=True),
            MappingField(field_name="body", field_type="text", indexed=True, analyzed=True),
            MappingField(field_name="symbol", field_type="keyword", indexed=True, analyzed=False),
            MappingField(field_name="entity_type", field_type="keyword", indexed=True, analyzed=False),
            MappingField(field_name="timestamp", field_type="date", indexed=True, analyzed=False),
        ],
    ),
    IndexMapping(
        index_name="apex-strategies", doc_count=42, last_updated=DEMO_TS,
        fields=[
            MappingField(field_name="doc_id", field_type="keyword", indexed=True, analyzed=False),
            MappingField(field_name="title", field_type="text", indexed=True, analyzed=True),
            MappingField(field_name="body", field_type="text", indexed=True, analyzed=True),
            MappingField(field_name="symbol", field_type="keyword", indexed=True, analyzed=False),
            MappingField(field_name="entity_type", field_type="keyword", indexed=True, analyzed=False),
            MappingField(field_name="timestamp", field_type="date", indexed=True, analyzed=False),
        ],
    ),
    IndexMapping(
        index_name="apex-workflows", doc_count=28, last_updated=DEMO_TS,
        fields=[
            MappingField(field_name="doc_id", field_type="keyword", indexed=True, analyzed=False),
            MappingField(field_name="title", field_type="text", indexed=True, analyzed=True),
            MappingField(field_name="body", field_type="text", indexed=True, analyzed=True),
            MappingField(field_name="entity_type", field_type="keyword", indexed=True, analyzed=False),
            MappingField(field_name="timestamp", field_type="date", indexed=True, analyzed=False),
        ],
    ),
]

_PROVIDER_STATUS = ProviderStatus(
    active_backend="local",
    doc_count=sum(m.doc_count for m in _MAPPINGS),
    index_count=len(_MAPPINGS),
    last_index_build=DEMO_TS,
    health="green",
    version="1.0.0-demo",
    index_prefix="apex-",
    is_reachable=True,
)


def _gen_explain(doc_id: str, query: str) -> SearchExplain:
    doc_hash = f"{_fnv32(f'{doc_id}:{DEMO_TS}') & 0xFFFFFFFF:08x}"
    seed = _fnv32(f"{doc_id}:{query}:explain")
    factors = [
        ExplainFactor(factor="tf-idf", weight=0.4,
                      score=round(((seed % 100) / 100) * 0.4, 2),
                      description=f'Term frequency × IDF for "{query}"'),
        ExplainFactor(factor="field_boost_title", weight=0.3,
                      score=round(((_fnv32(f"{seed}:title") % 100) / 100) * 0.3, 2),
                      description="Title field boost (2×)"),
        ExplainFactor(factor="recency", weight=0.15,
                      score=round(((_fnv32(f"{seed}:recency") % 100) / 100) * 0.15, 2),
                      description="Document recency decay"),
        ExplainFactor(factor="symbol_match", weight=0.15,
                      score=round(((_fnv32(f"{seed}:symbol") % 100) / 100) * 0.15, 2),
                      description="Exact symbol match bonus"),
    ]
    total = round(sum(f.score for f in factors), 2)
    eh = f"{_fnv32(json.dumps([f.model_dump() for f in factors])) & 0xFFFFFFFF:08x}"
    return SearchExplain(
        doc_id=doc_id, query=query, backend="local",
        total_score=total, factors=factors,
        doc_id_hash=doc_hash, explain_hash=eh,
    )


# ── Routes ───────────────────────────────────────────────────────────────────

@router.get("/provider-status", response_model=ProviderStatus)
def get_provider_status():
    return _PROVIDER_STATUS


@router.get("/mappings", response_model=List[IndexMapping])
def get_mappings():
    return _MAPPINGS


@router.get("/explain", response_model=SearchExplain)
def get_explain(doc_id: str, query: str):
    return _gen_explain(doc_id, query)


@router.get("/config", response_model=SearchConfig)
def get_search_config():
    return SearchConfig(
        provider="local", elastic_configured=False,
        elastic_url=None, index_prefix="apex-",
    )


@router.get("/hash")
def get_hash():
    return {"hash": hashlib.sha256(f"search-depth:{DEMO_TS}".encode()).hexdigest()[:16]}
