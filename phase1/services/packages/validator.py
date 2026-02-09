"""
Package Validator - Validates package structure, hash, and permissions.
"""
import hashlib
import json
import os
from typing import Tuple, List, Optional
from .manifest import PackageManifest, Capability


class ValidationError(Exception):
    """Raised when package validation fails."""
    pass


class PackageValidator:
    """Validates package bundles before installation."""
    
    # Dangerous capabilities that require explicit approval
    DANGEROUS_CAPABILITIES = [
        Capability.PLACE_ORDERS,
        Capability.ACCESS_NETWORK,
        Capability.WRITE_FILES,
    ]
    
    def __init__(self):
        pass
    
    def validate_manifest(self, manifest_data: dict) -> Tuple[bool, Optional[str]]:
        """
        Validate a manifest dictionary.
        Returns (is_valid, error_message).
        """
        try:
            manifest = PackageManifest(**manifest_data)
            
            # Check name format
            if not manifest.name.replace('-', '').replace('_', '').isalnum():
                return False, "Package name must be alphanumeric with dashes/underscores"
            
            # Check version format (simple semver check)
            parts = manifest.version.split('.')
            if len(parts) < 2:
                return False, "Version must be in semver format (e.g., 1.0.0)"
            
            return True, None
            
        except Exception as e:
            return False, str(e)
    
    def compute_content_hash(self, content: str) -> str:
        """Compute SHA-256 hash of package content."""
        return hashlib.sha256(content.encode('utf-8')).hexdigest()
    
    def validate_bundle(self, bundle: dict) -> Tuple[bool, Optional[str], Optional[PackageManifest]]:
        """
        Validate a full package bundle.
        Bundle should have: manifest, code, optional test
        Returns (is_valid, error_message, parsed_manifest).
        """
        # Check required fields
        if 'manifest' not in bundle:
            return False, "Missing manifest in bundle", None
        
        if 'code' not in bundle:
            return False, "Missing code in bundle", None
        
        # Validate manifest
        is_valid, error = self.validate_manifest(bundle['manifest'])
        if not is_valid:
            return False, f"Invalid manifest: {error}", None
        
        manifest = PackageManifest(**bundle['manifest'])
        
        # Validate code is not empty
        if not bundle['code'].strip():
            return False, "Package code cannot be empty", None
        
        return True, None, manifest
    
    def check_dangerous_capabilities(self, manifest: PackageManifest) -> List[Capability]:
        """Return list of dangerous capabilities this package requests."""
        dangerous = []
        for cap in manifest.capabilities:
            cap_enum = Capability(cap) if isinstance(cap, str) else cap
            if cap_enum in self.DANGEROUS_CAPABILITIES:
                dangerous.append(cap_enum)
        return dangerous
    
    def enforce_capabilities(self, manifest: PackageManifest, allowed: List[Capability]) -> Tuple[bool, Optional[str]]:
        """
        Check if all package capabilities are allowed.
        Returns (is_allowed, error_message).
        """
        for cap in manifest.capabilities:
            cap_enum = Capability(cap) if isinstance(cap, str) else cap
            if cap_enum not in allowed:
                return False, f"Capability '{cap_enum.value}' not allowed"
        return True, None


# Singleton validator
_validator: Optional[PackageValidator] = None

def get_validator() -> PackageValidator:
    global _validator
    if _validator is None:
        _validator = PackageValidator()
    return _validator
