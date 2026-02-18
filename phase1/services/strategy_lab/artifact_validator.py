"""
Strategy Artifact Validator (v1.29)
Deterministic validation with explicit rule IDs and stable ordering.
"""

import hashlib
from typing import Any, Dict, List
from .artifact_models import canonical_json


class ValidationIssue:
    """A single validation issue (error or warning)."""

    __slots__ = ("rule_id", "message", "path")

    def __init__(self, rule_id: str, message: str, path: str) -> None:
        self.rule_id = rule_id
        self.message = message
        self.path = path

    def to_dict(self) -> Dict[str, str]:
        return {"rule_id": self.rule_id, "message": self.message, "path": self.path}


SUPPORTED_TYPES = {"crossover", "signal", "mean_reversion", "breakout"}


def _sort_issues(issues: List[ValidationIssue]) -> List[Dict[str, str]]:
    """Sort issues by rule_id, then path, then message for determinism."""
    issues.sort(key=lambda i: (i.rule_id, i.path, i.message))
    return [i.to_dict() for i in issues]


def validate_artifact_spec(spec_input: Dict[str, Any]) -> Dict[str, Any]:
    """
    Validate a strategy artifact spec input.
    
    spec_input should contain: name, type, spec (and optionally version, schema_version).
    
    Returns a deterministic validation report:
    {
        "input_checksum": "<sha256>",
        "valid": bool,
        "errors": [...],   # sorted by rule_id, path, message
        "warnings": [...]  # sorted by rule_id, path, message
    }
    """
    # Compute input checksum for determinism proof
    input_bytes = canonical_json(spec_input)
    input_checksum = hashlib.sha256(input_bytes).hexdigest()

    errors: List[ValidationIssue] = []
    warnings: List[ValidationIssue] = []

    name = spec_input.get("name")
    type_ = spec_input.get("type")
    spec = spec_input.get("spec")
    version = spec_input.get("version", "1")
    schema_version = spec_input.get("schema_version", 1)

    # STRAT_001: name required
    if not name or (isinstance(name, str) and len(name.strip()) == 0):
        errors.append(ValidationIssue("STRAT_001", "Strategy name is required", "name"))

    # STRAT_002: type must be supported
    if not type_:
        errors.append(ValidationIssue("STRAT_002", "Strategy type is required", "type"))
    elif type_ not in SUPPORTED_TYPES:
        errors.append(ValidationIssue(
            "STRAT_002",
            f"Unsupported strategy type: {type_}. Must be one of: {', '.join(sorted(SUPPORTED_TYPES))}",
            "type"
        ))

    # STRAT_003: spec must include at least one indicator
    if not spec or not isinstance(spec, dict):
        errors.append(ValidationIssue("STRAT_003", "Strategy spec is required and must be an object", "spec"))
        # Also emit warnings for missing entry/exit since spec is absent
        warnings.append(ValidationIssue("STRAT_006", "Strategy spec has no entry condition defined", "spec.entry"))
        warnings.append(ValidationIssue("STRAT_007", "Strategy spec has no exit condition defined", "spec.exit"))
    else:
        indicators = spec.get("indicators")
        if not indicators or not isinstance(indicators, list) or len(indicators) == 0:
            errors.append(ValidationIssue("STRAT_003", "Strategy spec must include at least one indicator", "spec.indicators"))

        # STRAT_004: numeric bounds checks
        stop_loss = spec.get("stop_loss_pct")
        if stop_loss is not None:
            if not isinstance(stop_loss, (int, float)):
                errors.append(ValidationIssue("STRAT_004", "stop_loss_pct must be a number", "spec.stop_loss_pct"))
            elif stop_loss < 0:
                errors.append(ValidationIssue("STRAT_004", "stop_loss_pct must be >= 0", "spec.stop_loss_pct"))
            elif stop_loss > 50:
                warnings.append(ValidationIssue("STRAT_004", f"stop_loss_pct of {stop_loss}% is very large (>50%)", "spec.stop_loss_pct"))

        take_profit = spec.get("take_profit_pct")
        if take_profit is not None:
            if not isinstance(take_profit, (int, float)):
                errors.append(ValidationIssue("STRAT_004", "take_profit_pct must be a number", "spec.take_profit_pct"))
            elif take_profit < 0:
                errors.append(ValidationIssue("STRAT_004", "take_profit_pct must be >= 0", "spec.take_profit_pct"))
            elif take_profit < 1:
                warnings.append(ValidationIssue("STRAT_004", f"take_profit_pct of {take_profit}% is very small (<1%)", "spec.take_profit_pct"))

        # STRAT_005: crossover needs >= 2 indicators
        if type_ == "crossover" and indicators and isinstance(indicators, list) and len(indicators) < 2:
            errors.append(ValidationIssue("STRAT_005", "Crossover strategies require at least 2 indicators", "spec.indicators"))

        # STRAT_006: entry condition should exist
        entry = spec.get("entry")
        if not entry:
            warnings.append(ValidationIssue("STRAT_006", "Strategy spec has no entry condition defined", "spec.entry"))

        # STRAT_007: exit condition should exist
        exit_ = spec.get("exit")
        if not exit_:
            warnings.append(ValidationIssue("STRAT_007", "Strategy spec has no exit condition defined", "spec.exit"))

    # STRAT_008: version should be a non-empty string
    if not version or (isinstance(version, str) and len(version.strip()) == 0):
        warnings.append(ValidationIssue("STRAT_008", "Version is empty; defaulting to '1'", "version"))

    # STRAT_009: schema_version should be positive int
    if not isinstance(schema_version, int) or schema_version < 1:
        warnings.append(ValidationIssue("STRAT_009", "schema_version should be a positive integer", "schema_version"))

    # STRAT_010: name length check
    if name and isinstance(name, str) and len(name) > 100:
        warnings.append(ValidationIssue("STRAT_010", "Strategy name exceeds 100 characters", "name"))

    return {
        "input_checksum": input_checksum,
        "valid": len(errors) == 0,
        "errors": _sort_issues(errors),
        "warnings": _sort_issues(warnings),
    }
