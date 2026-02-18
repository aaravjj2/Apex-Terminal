"""
Strategy Schema Migration (v1.34)
Pure-function migrations for strategy artifact schema versions.
All outputs are deterministic and canonically ordered.
"""

import copy
import json
from typing import Any, Dict, List, Optional, Tuple

from .artifact_models import canonical_json

# Current schema version
CURRENT_SCHEMA_VERSION = 1

# Known schema versions that can be migrated
KNOWN_VERSIONS = {0, 1}


class MigrationError(Exception):
    """Raised for unknown or unmigrateable schema versions."""
    pass


def migrate_artifact_spec(
    artifact_data: Dict[str, Any],
) -> Tuple[Dict[str, Any], List[str]]:
    """
    Migrate an artifact spec from any known older schema version to current.
    Pure function — no side effects, no mutation of input.

    Returns:
        (migrated_data, warnings)

    Raises:
        MigrationError for unknown schema versions.
    """
    data = copy.deepcopy(artifact_data)
    sv = data.get("schema_version", 1)
    warnings: List[str] = []

    if sv not in KNOWN_VERSIONS:
        raise MigrationError(
            f"Unknown schema_version={sv}. "
            f"Known versions: {sorted(KNOWN_VERSIONS)}"
        )

    if sv == 0:
        # v0 → v1: add missing fields
        if "version" not in data:
            data["version"] = "1"
            warnings.append("Added default version='1' (migrated from v0)")
        if "spec" not in data:
            data["spec"] = {}
            warnings.append("Added empty spec (migrated from v0)")
        if "type" not in data or not data["type"]:
            data["type"] = "signal"
            warnings.append("Set default type='signal' (migrated from v0)")
        data["schema_version"] = CURRENT_SCHEMA_VERSION
        warnings.append(f"Migrated from schema_version=0 to {CURRENT_SCHEMA_VERSION}")

    # Already current version — no changes needed
    return data, warnings


def validate_schema_version(version: Any) -> Dict[str, Any]:
    """
    Validate a schema version value.
    Returns deterministic error payload with stable field order if invalid.
    """
    if not isinstance(version, int):
        return {
            "error": "invalid_schema_version",
            "message": f"schema_version must be an integer, got {type(version).__name__}",
            "valid": False,
        }

    if version not in KNOWN_VERSIONS:
        return {
            "error": "unknown_schema_version",
            "known_versions": sorted(KNOWN_VERSIONS),
            "message": f"Unknown schema_version={version}",
            "received": version,
            "valid": False,
        }

    return {
        "current": version == CURRENT_SCHEMA_VERSION,
        "message": "OK",
        "valid": True,
        "version": version,
    }


def get_migration_preview(artifact_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Preview what migration would produce, without changing anything.
    Returns a deterministic preview with canonical JSON.
    """
    try:
        migrated, warnings = migrate_artifact_spec(artifact_data)
        migrated_bytes = canonical_json(migrated)
        return {
            "migrated": json.loads(migrated_bytes),
            "needs_migration": artifact_data.get("schema_version", 1) != CURRENT_SCHEMA_VERSION,
            "source_version": artifact_data.get("schema_version", 1),
            "target_version": CURRENT_SCHEMA_VERSION,
            "warnings": sorted(warnings),
        }
    except MigrationError as e:
        return {
            "error": str(e),
            "needs_migration": True,
            "source_version": artifact_data.get("schema_version", "unknown"),
            "target_version": CURRENT_SCHEMA_VERSION,
            "warnings": [],
        }
