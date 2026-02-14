"""
Strategy Artifact Diff Engine (v1.30)
Deterministic, canonical diff output between two strategy artifacts.
"""

import hashlib
import json
from typing import Any, Dict, List, Optional, Tuple

from .artifact_models import StrategyArtifact, canonical_json, _canonicalize


def _json_pointer_paths(obj: Any, prefix: str = "") -> List[Tuple[str, Any]]:
    """
    Flatten an object into a sorted list of (json_pointer, value) pairs.
    Uses RFC 6901-style JSON pointers.
    """
    results: List[Tuple[str, Any]] = []
    if isinstance(obj, dict):
        for k in sorted(obj.keys()):
            child_path = f"{prefix}/{k}"
            results.extend(_json_pointer_paths(obj[k], child_path))
    elif isinstance(obj, (list, tuple)):
        for i, v in enumerate(obj):
            child_path = f"{prefix}/{i}"
            results.extend(_json_pointer_paths(v, child_path))
    else:
        results.append((prefix, obj))
    return results


def _value_hash(v: Any) -> str:
    """Hash a single value deterministically for sorting."""
    return hashlib.sha256(
        json.dumps(_canonicalize(v), sort_keys=True, separators=(',', ':')).encode()
    ).hexdigest()[:16]


def compute_diff(left: StrategyArtifact, right: StrategyArtifact) -> Dict[str, Any]:
    """
    Compute a deterministic diff between two strategy artifacts.

    Returns a dict with:
      - left_id, right_id
      - left_canonical: canonical JSON object (dict)
      - right_canonical: canonical JSON object (dict)
      - changes[]: deterministic list of changes, sorted by (json_pointer, op, value_hash)

    Each change entry:
      - path: json_pointer string
      - op: "added" | "removed" | "changed"
      - left_value: value in left (None if added)
      - right_value: value in right (None if removed)
    """
    # Build canonical representations (only content fields, not metadata)
    left_content = _canonicalize({
        "schema_version": left.schema_version,
        "name": left.name,
        "type": left.type,
        "version": left.version,
        "spec": left.spec,
    })
    right_content = _canonicalize({
        "schema_version": right.schema_version,
        "name": right.name,
        "type": right.type,
        "version": right.version,
        "spec": right.spec,
    })

    # Flatten both to path->value maps
    left_paths = dict(_json_pointer_paths(left_content))
    right_paths = dict(_json_pointer_paths(right_content))

    all_paths = sorted(set(left_paths.keys()) | set(right_paths.keys()))

    changes: List[Dict[str, Any]] = []
    for path in all_paths:
        in_left = path in left_paths
        in_right = path in right_paths

        if in_left and in_right:
            lv = left_paths[path]
            rv = right_paths[path]
            if _canonicalize(lv) != _canonicalize(rv):
                changes.append({
                    "path": path,
                    "op": "changed",
                    "left_value": lv,
                    "right_value": rv,
                })
        elif in_left and not in_right:
            changes.append({
                "path": path,
                "op": "removed",
                "left_value": left_paths[path],
                "right_value": None,
            })
        else:  # in_right and not in_left
            changes.append({
                "path": path,
                "op": "added",
                "left_value": None,
                "right_value": right_paths[path],
            })

    # Sort changes deterministically: by path, then op, then value hashes
    changes.sort(key=lambda c: (
        c["path"],
        c["op"],
        _value_hash(c.get("left_value")),
        _value_hash(c.get("right_value")),
    ))

    result = {
        "left_id": left.id,
        "right_id": right.id,
        "left_canonical": left_content,
        "right_canonical": right_content,
        "changes": changes,
    }
    return result


def compute_diff_hash(diff_output: Dict[str, Any]) -> str:
    """Compute sha256 of the canonical JSON of a diff output."""
    raw = canonical_json(diff_output)
    return hashlib.sha256(raw).hexdigest()


def get_lineage_chain(
    artifact_id: str,
    store_lookup: callable,
    max_depth: int = 50,
) -> List[Dict[str, Any]]:
    """
    Walk the parent_id chain for an artifact, returning an ordered list
    from the root ancestor to the given artifact.

    Each entry: { id, name, version, parent_id, depth }
    Ordering is deterministic: root first, then child, etc.
    """
    chain: List[Dict[str, Any]] = []
    visited = set()
    current_id = artifact_id
    depth = 0

    while current_id and depth < max_depth:
        if current_id in visited:
            break  # cycle protection
        visited.add(current_id)

        artifact = store_lookup(current_id)
        if not artifact:
            break

        chain.append({
            "id": artifact.id,
            "name": artifact.name,
            "version": artifact.version,
            "parent_id": artifact.parent_id,
            "derived_from": artifact.derived_from,
            "depth": depth,
        })
        current_id = artifact.parent_id
        depth += 1

    # Reverse so root is first
    chain.reverse()
    # Re-assign depth from root=0
    for i, entry in enumerate(chain):
        entry["depth"] = i

    return chain
