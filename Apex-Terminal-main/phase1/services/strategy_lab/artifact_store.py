"""
Strategy Artifact Store (v1.28 + v1.30)
Deterministic in-memory store keyed by content-hash id.
v1.30: lineage support (parent_id, derived_from).
"""

from typing import Dict, List, Optional
from .artifact_models import StrategyArtifact, build_artifact


# Demo seed artifacts for deterministic E2E
_DEMO_SEED_ARTIFACTS: List[dict] = [
    {
        "name": "SMA Crossover 20/50",
        "type": "crossover",
        "version": "1",
        "spec": {
            "indicators": [
                {"type": "SMA", "params": {"period": 20}},
                {"type": "SMA", "params": {"period": 50}},
            ],
            "entry": {"condition": "cross_above", "fast": "SMA_20", "slow": "SMA_50"},
            "exit": {"condition": "cross_below", "fast": "SMA_20", "slow": "SMA_50"},
            "stop_loss_pct": 2,
            "take_profit_pct": 5,
        },
    },
    {
        "name": "RSI Mean Reversion",
        "type": "mean_reversion",
        "version": "1",
        "spec": {
            "indicators": [
                {"type": "RSI", "params": {"period": 14}},
            ],
            "entry": {"condition": "below", "indicator": "RSI_14", "threshold": 30},
            "exit": {"condition": "above", "indicator": "RSI_14", "threshold": 70},
            "stop_loss_pct": 3,
            "take_profit_pct": 10,
        },
    },
]


class ArtifactStore:
    """In-memory deterministic artifact store."""

    def __init__(self) -> None:
        self._artifacts: Dict[str, StrategyArtifact] = {}
        self._seed_demo()

    def _seed_demo(self) -> None:
        """Seed with demo artifacts for E2E determinism."""
        for seed in _DEMO_SEED_ARTIFACTS:
            artifact = build_artifact(
                name=seed["name"],
                type_=seed["type"],
                spec=seed["spec"],
                version=seed.get("version", "1"),
            )
            self._artifacts[artifact.id] = artifact

    def reset_demo(self) -> None:
        """Reset store to seeded demo state (E2E determinism)."""
        self._artifacts.clear()
        self._seed_demo()

    def create(self, name: str, type_: str, spec: dict, version: str = "1",
               schema_version: int = 1, parent_id: Optional[str] = None,
               derived_from: Optional[str] = None) -> StrategyArtifact:
        """
        Create/store an artifact. If same content-hash already exists,
        returns the existing artifact (idempotent).
        v1.30: supports lineage via parent_id, derived_from.
        """
        artifact = build_artifact(
            name=name,
            type_=type_,
            spec=spec,
            version=version,
            schema_version=schema_version,
            parent_id=parent_id,
            derived_from=derived_from,
        )
        if artifact.id not in self._artifacts:
            self._artifacts[artifact.id] = artifact
        return self._artifacts[artifact.id]

    def get(self, artifact_id: str) -> Optional[StrategyArtifact]:
        """Get artifact by ID."""
        return self._artifacts.get(artifact_id)

    def list(self) -> List[StrategyArtifact]:
        """List all artifacts in deterministic order (sorted by id)."""
        return sorted(self._artifacts.values(), key=lambda a: a.id)

    def count(self) -> int:
        return len(self._artifacts)


# Global singleton
_store = ArtifactStore()


def get_artifact_store() -> ArtifactStore:
    """Get the global artifact store instance."""
    return _store
