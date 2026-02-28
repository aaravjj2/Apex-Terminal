"""
Wave 108 — Export bundles API routes.
Prefix: /api/v3/export
"""
from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import Response

from backend.core.export_bundle import (
    EXPORT_BUNDLE_VERSION,
    create_export_bundle,
    get_manifest_only,
)

router = APIRouter()


@router.get("/version")
async def version():
    return {"version": EXPORT_BUNDLE_VERSION, "status": "ok"}


@router.post("/bundle", status_code=201)
async def create_bundle():
    """Create and return an export bundle as a JSON response with metadata."""
    result = await create_export_bundle()
    return {
        "filename": result["filename"],
        "manifest": result["manifest"],
        "file_sizes": result["file_sizes"],
        "created_at": result["created_at"],
        "status": "created",
    }


@router.get("/bundle/download")
async def download_bundle():
    """Create and stream an export bundle ZIP file."""
    result = await create_export_bundle()
    return Response(
        content=result["zip_bytes"],
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="{result["filename"]}"',
            "X-Bundle-Hash": result["manifest"]["bundle_hash"],
        },
    )


@router.get("/manifest")
async def manifest():
    """Return the current export manifest (deterministic hash of data state)."""
    m = await get_manifest_only()
    return m
