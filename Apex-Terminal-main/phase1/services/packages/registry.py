"""
Package Registry - Local storage and management of installed packages.
"""
import json
import os
from datetime import datetime
from typing import Dict, List, Optional
from .manifest import PackageManifest, InstalledPackage
from .validator import get_validator


class PackageRegistry:
    """
    Manages the local package registry.
    Stores packages in a JSON file for simplicity.
    """
    
    def __init__(self, registry_path: str = None):
        if registry_path is None:
            # Default path relative to project
            base_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
            registry_path = os.path.join(base_dir, "packages_registry.json")
        
        self.registry_path = registry_path
        self._packages: Dict[str, InstalledPackage] = {}
        self._load()
    
    def _load(self):
        """Load registry from disk."""
        if os.path.exists(self.registry_path):
            try:
                with open(self.registry_path, 'r') as f:
                    data = json.load(f)
                    for name, pkg_data in data.items():
                        self._packages[name] = InstalledPackage(**pkg_data)
            except Exception as e:
                print(f"Warning: Failed to load registry: {e}")
    
    def _save(self):
        """Save registry to disk."""
        try:
            data = {name: pkg.dict() for name, pkg in self._packages.items()}
            with open(self.registry_path, 'w') as f:
                json.dump(data, f, indent=2, default=str)
        except Exception as e:
            print(f"Warning: Failed to save registry: {e}")
    
    def install(self, bundle: dict) -> tuple[bool, str]:
        """
        Install a package from a bundle.
        Returns (success, message).
        """
        validator = get_validator()
        
        # Validate bundle
        is_valid, error, manifest = validator.validate_bundle(bundle)
        if not is_valid:
            return False, f"Validation failed: {error}"
        
        # Check if already installed
        if manifest.name in self._packages:
            existing = self._packages[manifest.name]
            if existing.manifest.version == manifest.version:
                return False, f"Package {manifest.name}@{manifest.version} already installed"
        
        # Compute hash
        content_hash = validator.compute_content_hash(bundle['code'])
        
        # Create installed package record
        installed = InstalledPackage(
            manifest=manifest,
            installed_at=datetime.utcnow().isoformat(),
            content_hash=content_hash,
            enabled=True
        )
        
        self._packages[manifest.name] = installed
        self._save()
        
        return True, f"Installed {manifest.name}@{manifest.version}"
    
    def uninstall(self, name: str) -> tuple[bool, str]:
        """Uninstall a package by name."""
        if name not in self._packages:
            return False, f"Package '{name}' not found"
        
        del self._packages[name]
        self._save()
        
        return True, f"Uninstalled {name}"
    
    def get(self, name: str) -> Optional[InstalledPackage]:
        """Get an installed package by name."""
        return self._packages.get(name)
    
    def list_all(self) -> List[InstalledPackage]:
        """List all installed packages."""
        return list(self._packages.values())
    
    def enable(self, name: str) -> tuple[bool, str]:
        """Enable a package."""
        if name not in self._packages:
            return False, f"Package '{name}' not found"
        self._packages[name].enabled = True
        self._save()
        return True, f"Enabled {name}"
    
    def disable(self, name: str) -> tuple[bool, str]:
        """Disable a package."""
        if name not in self._packages:
            return False, f"Package '{name}' not found"
        self._packages[name].enabled = False
        self._save()
        return True, f"Disabled {name}"


# Singleton registry
_registry: Optional[PackageRegistry] = None

def get_registry() -> PackageRegistry:
    global _registry
    if _registry is None:
        _registry = PackageRegistry()
    return _registry
