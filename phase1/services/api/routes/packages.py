"""
Packages API Routes - Local marketplace endpoints.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from services.packages import get_registry, get_validator, Capability

router = APIRouter(tags=["Packages"])


class PackageBundle(BaseModel):
    manifest: dict
    code: str
    test: Optional[str] = None


class PackageResponse(BaseModel):
    name: str
    version: str
    type: str
    description: str
    author: str
    capabilities: List[str]
    enabled: bool
    installed_at: str


@router.get("/packages", response_model=List[PackageResponse])
async def list_packages():
    """List all installed packages."""
    registry = get_registry()
    packages = registry.list_all()
    return [
        PackageResponse(
            name=pkg.manifest.name,
            version=pkg.manifest.version,
            type=pkg.manifest.type,
            description=pkg.manifest.description,
            author=pkg.manifest.author,
            capabilities=[c if isinstance(c, str) else c.value for c in pkg.manifest.capabilities],
            enabled=pkg.enabled,
            installed_at=pkg.installed_at
        )
        for pkg in packages
    ]


@router.get("/packages/{name}")
async def get_package(name: str):
    """Get details for a specific package."""
    registry = get_registry()
    pkg = registry.get(name)
    if not pkg:
        raise HTTPException(status_code=404, detail="Package not found")
    return {
        "manifest": pkg.manifest.dict(),
        "content_hash": pkg.content_hash,
        "enabled": pkg.enabled,
        "installed_at": pkg.installed_at
    }


@router.post("/packages")
async def install_package(bundle: PackageBundle):
    """Install a package from a bundle."""
    registry = get_registry()
    validator = get_validator()
    
    # Check for dangerous capabilities
    is_valid, error, manifest = validator.validate_bundle(bundle.dict())
    if not is_valid:
        raise HTTPException(status_code=400, detail=error)
    
    dangerous = validator.check_dangerous_capabilities(manifest)
    
    success, message = registry.install(bundle.dict())
    if not success:
        raise HTTPException(status_code=400, detail=message)
    
    return {
        "message": message,
        "warnings": [f"Package requests dangerous capability: {cap.value}" for cap in dangerous] if dangerous else []
    }


@router.delete("/packages/{name}")
async def uninstall_package(name: str):
    """Uninstall a package."""
    registry = get_registry()
    success, message = registry.uninstall(name)
    if not success:
        raise HTTPException(status_code=404, detail=message)
    return {"message": message}


@router.post("/packages/{name}/enable")
async def enable_package(name: str):
    """Enable a disabled package."""
    registry = get_registry()
    success, message = registry.enable(name)
    if not success:
        raise HTTPException(status_code=404, detail=message)
    return {"message": message}


@router.post("/packages/{name}/disable")
async def disable_package(name: str):
    """Disable a package without uninstalling."""
    registry = get_registry()
    success, message = registry.disable(name)
    if not success:
        raise HTTPException(status_code=404, detail=message)
    return {"message": message}


@router.get("/packages/{name}/permissions")
async def get_package_permissions(name: str):
    """Get the capabilities/permissions for a package."""
    registry = get_registry()
    pkg = registry.get(name)
    if not pkg:
        raise HTTPException(status_code=404, detail="Package not found")
    
    validator = get_validator()
    dangerous = validator.check_dangerous_capabilities(pkg.manifest)
    
    return {
        "name": name,
        "capabilities": [c if isinstance(c, str) else c.value for c in pkg.manifest.capabilities],
        "dangerous_capabilities": [c.value for c in dangerous],
        "requires_approval": len(dangerous) > 0
    }
