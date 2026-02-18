"""
Strategy Artifacts API Router (v1.28 + v1.29 + v1.30)
Endpoints for artifact CRUD, validation, diff, lineage, and demo reset.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Any, Dict, List, Optional

from ...strategy_lab.artifact_models import StrategyArtifact, canonical_json
from ...strategy_lab.artifact_store import get_artifact_store
from ...strategy_lab.artifact_validator import validate_artifact_spec
from ...strategy_lab.artifact_diff import compute_diff, compute_diff_hash, get_lineage_chain

router = APIRouter(prefix="/api/v1/strategy-artifacts", tags=["strategy-artifacts"])


class CreateArtifactRequest(BaseModel):
    """Request to create/store a strategy artifact."""
    name: str
    type: str
    spec: Dict[str, Any] = Field(default_factory=dict)
    version: str = "1"
    schema_version: int = 1
    parent_id: Optional[str] = None
    derived_from: Optional[str] = None


class ValidateRequest(BaseModel):
    """Request to validate a strategy spec."""
    name: Optional[str] = None
    type: Optional[str] = None
    spec: Optional[Dict[str, Any]] = None
    version: Optional[str] = "1"
    schema_version: Optional[int] = 1


class ArtifactResponse(BaseModel):
    """Response for a single artifact."""
    schema_version: int
    id: str
    checksum: str
    name: str
    type: str
    version: str
    spec: Dict[str, Any]
    created_at: str
    parent_id: Optional[str] = None
    derived_from: Optional[str] = None


class DiffRequest(BaseModel):
    """Request to diff two artifacts."""
    left_id: str
    right_id: str


class ValidationResponse(BaseModel):
    """Response for validation."""
    input_checksum: str
    valid: bool
    errors: List[Dict[str, str]]
    warnings: List[Dict[str, str]]


def _artifact_to_response(a: StrategyArtifact) -> dict:
    return {
        "schema_version": a.schema_version,
        "id": a.id,
        "checksum": a.checksum,
        "name": a.name,
        "type": a.type,
        "version": a.version,
        "spec": a.spec,
        "created_at": a.created_at,
        "parent_id": a.parent_id,
        "derived_from": a.derived_from,
    }


@router.get("", response_model=List[ArtifactResponse])
async def list_artifacts():
    """List all strategy artifacts in deterministic order."""
    store = get_artifact_store()
    artifacts = store.list()
    return [_artifact_to_response(a) for a in artifacts]


@router.get("/{artifact_id}", response_model=ArtifactResponse)
async def get_artifact(artifact_id: str):
    """Get a single strategy artifact by ID."""
    store = get_artifact_store()
    artifact = store.get(artifact_id)
    if not artifact:
        raise HTTPException(status_code=404, detail=f"Artifact not found: {artifact_id}")
    return _artifact_to_response(artifact)


@router.post("", response_model=ArtifactResponse)
async def create_artifact(req: CreateArtifactRequest):
    """
    Create/store a strategy artifact. 
    If the same content-hash already exists, returns the existing artifact.
    """
    store = get_artifact_store()
    artifact = store.create(
        name=req.name,
        type_=req.type,
        spec=req.spec,
        version=req.version,
        schema_version=req.schema_version,
        parent_id=req.parent_id,
        derived_from=req.derived_from,
    )
    return _artifact_to_response(artifact)


@router.post("/validate", response_model=ValidationResponse)
async def validate_artifact(req: ValidateRequest):
    """
    Validate a strategy spec. Returns deterministic error/warning report.
    """
    spec_input = {
        "name": req.name,
        "type": req.type,
        "spec": req.spec,
        "version": req.version or "1",
        "schema_version": req.schema_version or 1,
    }
    result = validate_artifact_spec(spec_input)
    return result


@router.post("/reset-demo")
async def reset_demo():
    """Reset the artifact store to seeded demo state (E2E determinism)."""
    store = get_artifact_store()
    store.reset_demo()
    return {"status": "ok", "message": "Artifact store reset to demo state", "count": store.count()}


@router.post("/diff")
async def diff_artifacts(req: DiffRequest):
    """
    Compute a deterministic diff between two artifacts (v1.30).
    Returns canonical JSON representations and sorted changes list.
    """
    store = get_artifact_store()
    left = store.get(req.left_id)
    if not left:
        raise HTTPException(status_code=404, detail=f"Left artifact not found: {req.left_id}")
    right = store.get(req.right_id)
    if not right:
        raise HTTPException(status_code=404, detail=f"Right artifact not found: {req.right_id}")
    diff_result = compute_diff(left, right)
    diff_result["diff_hash"] = compute_diff_hash(diff_result)
    return diff_result


@router.get("/{artifact_id}/lineage")
async def get_artifact_lineage(artifact_id: str):
    """
    Get the lineage chain for an artifact (v1.30).
    Returns ordered list from root ancestor to current artifact.
    """
    store = get_artifact_store()
    artifact = store.get(artifact_id)
    if not artifact:
        raise HTTPException(status_code=404, detail=f"Artifact not found: {artifact_id}")
    chain = get_lineage_chain(artifact_id, store.get)
    return {"artifact_id": artifact_id, "lineage": chain}
