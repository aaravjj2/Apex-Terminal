"""
Strategy Export Bundler (v1.32)
Creates enriched export bundles including strategy spec + validation.
Also serves as the foundation for the Hash Ledger (v1.36).
"""

import hashlib
import json
from typing import Any, Dict, List, Optional

from ..strategy_lab.artifact_models import canonical_json, StrategyArtifact
from ..strategy_lab.artifact_store import get_artifact_store
from ..strategy_lab.artifact_validator import validate_artifact_spec


def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def build_strategy_bundle_manifest(
    run_id: str,
    strategy_id: Optional[str] = None,
    strategy_artifact_id: Optional[str] = None,
    extra_files: Optional[Dict[str, bytes]] = None,
) -> Dict[str, Any]:
    """
    Build an enriched bundle manifest that includes strategy spec + validation.
    Returns a dict with:
      - files: list of {name, sha256} in deterministic order
      - checksums: deterministic ordered dict
      - strategy_spec: the spec JSON (if found)
      - strategy_validation: the validation result (if found)

    Determinism: files list is sorted by name; checksums sorted by key.
    """
    files_map: Dict[str, str] = {}  # name -> sha256

    # Add extra files (run.json, trades.csv, etc.)
    if extra_files:
        for name, data in extra_files.items():
            files_map[name] = _sha256(data)

    # Try to find strategy artifact
    spec_json: Optional[Dict] = None
    validation_json: Optional[Dict] = None

    store = get_artifact_store()
    artifact: Optional[StrategyArtifact] = None

    if strategy_artifact_id:
        artifact = store.get(strategy_artifact_id)
    if not artifact and strategy_id:
        # Try matching by name pattern
        for a in store.list():
            if a.name.lower().replace(' ', '-').replace('/', '-') == strategy_id:
                artifact = a
                break

    if artifact:
        spec_data = {
            "schema_version": artifact.schema_version,
            "id": artifact.id,
            "name": artifact.name,
            "type": artifact.type,
            "version": artifact.version,
            "spec": artifact.spec,
            "checksum": artifact.checksum,
            "created_at": artifact.created_at,
        }
        spec_bytes = canonical_json(spec_data)
        spec_json = json.loads(spec_bytes)
        files_map["strategy/spec.json"] = _sha256(spec_bytes)

        # Produce validation
        val_input = {
            "name": artifact.name,
            "type": artifact.type,
            "spec": artifact.spec,
            "version": artifact.version,
            "schema_version": artifact.schema_version,
        }
        val_result = validate_artifact_spec(val_input)
        val_bytes = canonical_json(val_result)
        validation_json = json.loads(val_bytes)
        files_map["strategy/validation.json"] = _sha256(val_bytes)

    # Build deterministically sorted file list
    sorted_names = sorted(files_map.keys())
    files_list = [{"name": n, "sha256": files_map[n]} for n in sorted_names]

    manifest = {
        "run_id": run_id,
        "version": "1.32",
        "files": files_list,
        "checksums": {n: files_map[n] for n in sorted_names},
        "file_count": len(files_list),
    }

    if spec_json is not None:
        manifest["strategy_spec"] = spec_json
    if validation_json is not None:
        manifest["strategy_validation"] = validation_json

    # Manifest's own checksum (of everything except itself)
    manifest_content = canonical_json(manifest)
    manifest["manifest_checksum"] = _sha256(manifest_content)

    return manifest


def build_hash_ledger(
    run_id: str,
    strategy_artifact_id: Optional[str] = None,
    config_hash: Optional[str] = None,
    bars_source_hash: Optional[str] = None,
    provenance_hash: Optional[str] = None,
    outputs_hash: Optional[str] = None,
    report_manifest_hash: Optional[str] = None,
) -> Dict[str, Any]:
    """
    v1.36: Build a chained hash ledger recording all component hashes.
    All fields are canonically ordered.
    """
    store = get_artifact_store()
    spec_hash: Optional[str] = None
    if strategy_artifact_id:
        artifact = store.get(strategy_artifact_id)
        if artifact:
            spec_hash = artifact.checksum

    ledger = {
        "run_id": run_id,
        "version": "1.36",
        "chain": {
            "strategy_spec_hash": spec_hash,
            "bars_source_hash": bars_source_hash,
            "provenance_hash": provenance_hash,
            "run_config_hash": config_hash,
            "outputs_hash": outputs_hash,
            "report_manifest_hash": report_manifest_hash,
        },
    }

    # Compute ledger checksum
    ledger_bytes = canonical_json(ledger)
    ledger["ledger_checksum"] = _sha256(ledger_bytes)

    return ledger
