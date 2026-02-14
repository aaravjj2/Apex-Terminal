"""
Strategy Artifact Models (v1.28 + v1.30)
Content-hash based artifact schema with canonical JSON for determinism.
v1.30: lineage fields (parent_id, derived_from), deterministic timestamps.
"""

import hashlib
import json
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


# Deterministic timestamp for DEMO mode artifacts
DEMO_TIMESTAMP = "2025-01-15T00:00:00Z"


class StrategyArtifact(BaseModel):
    """
    Strategy Artifact with content-hash ID.
    The id is sha256 of canonical JSON of {schema_version, name, type, version, spec}.
    v1.30: Added parent_id and derived_from for lineage tracking.
    """
    schema_version: int = Field(default=1, description="Schema version")
    id: str = Field(default="", description="Content-hash sha256 hex")
    checksum: str = Field(default="", description="sha256 hex of canonical JSON")
    name: str = Field(..., description="Strategy name")
    type: str = Field(..., description="Strategy type (crossover, signal, mean_reversion, breakout)")
    version: str = Field(default="1", description="Artifact version")
    spec: Dict[str, Any] = Field(default_factory=dict, description="Strategy specification (canonicalized)")
    created_at: str = Field(default=DEMO_TIMESTAMP, description="Creation timestamp (DEMO: constant)")
    # v1.30 lineage fields
    parent_id: Optional[str] = Field(default=None, description="Content-hash ID of parent artifact")
    derived_from: Optional[str] = Field(default=None, description="Content-hash ID of original base artifact")


def canonical_json(obj: Any) -> bytes:
    """
    Produce canonical JSON bytes with stable key ordering and stable float formatting.
    Keys are sorted recursively, no extra whitespace.
    """
    return json.dumps(
        _canonicalize(obj),
        sort_keys=True,
        separators=(',', ':'),
        ensure_ascii=True,
    ).encode('utf-8')


def _canonicalize(obj: Any) -> Any:
    """Recursively canonicalize a value for deterministic JSON."""
    if isinstance(obj, dict):
        return {k: _canonicalize(v) for k, v in sorted(obj.items())}
    elif isinstance(obj, (list, tuple)):
        return [_canonicalize(v) for v in obj]
    elif isinstance(obj, float):
        # Stable float formatting: remove trailing zeros
        if obj == int(obj) and not (obj != obj):  # not NaN
            return int(obj)
        return obj
    elif isinstance(obj, bool):
        return obj
    elif isinstance(obj, int):
        return obj
    elif isinstance(obj, str):
        return obj
    elif obj is None:
        return None
    else:
        return str(obj)


def compute_content_hash(
    schema_version: int,
    name: str,
    type_: str,
    version: str,
    spec: Dict[str, Any],
) -> str:
    """
    Compute content-hash from canonical JSON of
    {schema_version, name, type, version, spec}.
    Returns sha256 hex digest.
    """
    payload = {
        "schema_version": schema_version,
        "name": name,
        "type": type_,
        "version": version,
        "spec": spec,
    }
    raw = canonical_json(payload)
    return hashlib.sha256(raw).hexdigest()


def build_artifact(
    name: str,
    type_: str,
    spec: Dict[str, Any],
    version: str = "1",
    schema_version: int = 1,
    created_at: str = DEMO_TIMESTAMP,
    parent_id: Optional[str] = None,
    derived_from: Optional[str] = None,
) -> StrategyArtifact:
    """
    Build a StrategyArtifact with computed content-hash id and checksum.
    v1.30: supports lineage via parent_id and derived_from.
    """
    content_hash = compute_content_hash(schema_version, name, type_, version, spec)
    return StrategyArtifact(
        schema_version=schema_version,
        id=content_hash,
        checksum=content_hash,
        name=name,
        type=type_,
        version=version,
        spec=spec,
        created_at=created_at,
        parent_id=parent_id,
        derived_from=derived_from,
    )
