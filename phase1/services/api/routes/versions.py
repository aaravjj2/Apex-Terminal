"""
Versions API Routes - Strategy versioning endpoints.
"""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List
from services.persistence.version_store import get_version_store

router = APIRouter(tags=["Versions"])


class VersionCreate(BaseModel):
    content: dict
    message: Optional[str] = None
    author: Optional[str] = "user"


class VersionResponse(BaseModel):
    id: int
    strategy_id: str
    version: int
    content_hash: str
    message: Optional[str]
    author: str
    created_at: str


class DiffResponse(BaseModel):
    strategy_id: str
    from_version: int
    to_version: int
    changes: List[dict]


@router.get("/strategies/{strategy_id}/versions", response_model=List[VersionResponse])
async def list_versions(strategy_id: str, limit: int = Query(50, le=100)):
    """List all versions for a strategy."""
    store = get_version_store()
    versions = store.list_versions(strategy_id, limit=limit)
    return [
        VersionResponse(
            id=v['id'],
            strategy_id=v['strategy_id'],
            version=v['version'],
            content_hash=v['content_hash'],
            message=v['message'],
            author=v['author'],
            created_at=v['created_at']
        )
        for v in versions
    ]


@router.get("/strategies/{strategy_id}/versions/{version}")
async def get_version(strategy_id: str, version: int):
    """Get a specific version with full content."""
    store = get_version_store()
    v = store.get_version(strategy_id, version)
    if not v:
        raise HTTPException(status_code=404, detail="Version not found")
    return v


@router.post("/strategies/{strategy_id}/versions", response_model=VersionResponse)
async def create_version(strategy_id: str, data: VersionCreate):
    """Create a new version for a strategy."""
    store = get_version_store()
    v = store.create_version(
        strategy_id=strategy_id,
        content=data.content,
        message=data.message,
        author=data.author or "user"
    )
    return VersionResponse(
        id=v['id'],
        strategy_id=v['strategy_id'],
        version=v['version'],
        content_hash=v['content_hash'],
        message=v['message'],
        author=v['author'],
        created_at=v['created_at']
    )


@router.get("/strategies/{strategy_id}/diff", response_model=DiffResponse)
async def diff_versions(
    strategy_id: str, 
    v1: int = Query(..., description="From version"),
    v2: int = Query(..., description="To version")
):
    """Compute diff between two versions."""
    store = get_version_store()
    diff = store.diff_versions(strategy_id, v1, v2)
    if "error" in diff:
        raise HTTPException(status_code=404, detail=diff["error"])
    return diff


@router.post("/strategies/{strategy_id}/rollback/{version}")
async def rollback_version(strategy_id: str, version: int, author: str = "user"):
    """Rollback to a specific version (creates a new version with old content)."""
    store = get_version_store()
    result = store.rollback(strategy_id, version, author=author)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return {"message": f"Rolled back to version {version}", "new_version": result}
