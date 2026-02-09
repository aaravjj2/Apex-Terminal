"""
Package Manifest Schema - Defines the structure of strategy/indicator packages.
"""
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from enum import Enum


class PackageType(str, Enum):
    STRATEGY = "strategy"
    INDICATOR = "indicator"
    UTILITY = "utility"


class Capability(str, Enum):
    """Permissions that a package can request."""
    READ_BARS = "read_bars"
    READ_PORTFOLIO = "read_portfolio"
    PLACE_ORDERS = "place_orders"
    ACCESS_NETWORK = "access_network"
    WRITE_FILES = "write_files"


class PackageManifest(BaseModel):
    """
    Package manifest following a standardized format.
    Similar to package.json but for trading tools.
    """
    name: str = Field(..., description="Package name (kebab-case)")
    version: str = Field(..., description="Semantic version (e.g., 1.0.0)")
    description: str = Field("", description="Short description")
    author: str = Field("anonymous", description="Author name or email")
    
    type: PackageType = Field(PackageType.STRATEGY, description="Package type")
    
    # Entry points
    main: str = Field("index.py", description="Main entry file")
    
    # Dependencies and requirements
    dependencies: List[str] = Field(default_factory=list, description="Other packages this depends on")
    python_requires: str = Field(">=3.9", description="Python version requirement")
    
    # Capabilities (permissions)
    capabilities: List[Capability] = Field(
        default_factory=lambda: [Capability.READ_BARS],
        description="Permissions this package needs"
    )
    
    # Metadata
    tags: List[str] = Field(default_factory=list, description="Searchable tags")
    homepage: Optional[str] = Field(None, description="URL to documentation")
    license: str = Field("MIT", description="License type")
    
    # Validation
    test_command: Optional[str] = Field(None, description="Command to run tests")
    
    class Config:
        use_enum_values = True


class InstalledPackage(BaseModel):
    """Record of an installed package."""
    manifest: PackageManifest
    installed_at: str
    content_hash: str
    enabled: bool = True
    source_path: Optional[str] = None
