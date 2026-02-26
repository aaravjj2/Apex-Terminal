"""
Integration tests for W14 — Immutable Dataset Snapshot Baseline.

Tests cover:
- POST /api/v3/backtest/datasets/snapshot → create real snapshot
- GET  /api/v3/backtest/datasets → list
- GET  /api/v3/backtest/datasets/{id} → get by ID
- GET  /api/v3/backtest/datasets/{id}/bars → bar data
- GET  /api/v3/backtest/datasets/{id}/checksum → integrity verification
- GET  /api/v3/backtest/datasets/snapshot → auth-protected latest
- Deduplication: same inputs → same dataset_id
- Backtest run with dataset_id binding
- Typed error responses (BT_CFG_INVALID, BT_DATA_MISSING)
- SHA-256 determinism
"""

import os
import sys
import json
import pytest
import tempfile
from pathlib import Path
from datetime import date, timedelta
from unittest.mock import patch

# Ensure project root is on sys.path
_ROOT = Path(__file__).resolve().parents[2]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///./test_phase1.db")

import numpy as np
from httpx import AsyncClient, ASGITransport
from services.api.main import app
from services.market_data.models import BarDaily, compute_bars_sha256
from services.backtest_engine.dataset_snapshot import (
    DatasetStore,
    DatasetSnapshot,
    DatasetSnapshotRequest,
    create_snapshot,
    get_snapshot,
    load_snapshot_bars,
    list_snapshots,
    BtCfgInvalid,
    BtDataMissing,
    BtDependencyDown,
)
import services.backtest_engine.data_pipeline as dp

_transport = ASGITransport(app=app)
_AUTH = {"Authorization": "Bearer test-integration-token-xyz"}


# ── Helpers ──────────────────────────────────────────────────────────────────

def _make_bars(symbol: str = "TEST", n: int = 200) -> list[BarDaily]:
    """Generate deterministic synthetic bars."""
    bars = []
    price = 150.0
    rng = np.random.RandomState(42)
    base = date(2020, 1, 2)
    for i in range(n):
        d = base + timedelta(days=i)
        if d.weekday() >= 5:
            continue
        ret = rng.normal(0.0005, 0.015)
        c = price * (1 + ret)
        bars.append(BarDaily(
            symbol=symbol.upper(),
            date=d,
            open=round(price, 2),
            high=round(max(price, c) * 1.005, 2),
            low=round(min(price, c) * 0.995, 2),
            close=round(c, 2),
            adj_close=round(c, 2),
            volume=int(rng.uniform(1e6, 5e6)),
            source="test-fixture",
        ))
        price = c
    return bars


@pytest.fixture()
def tmp_store(tmp_path):
    """Create a temporary DatasetStore backed by a temp SQLite file."""
    db_path = tmp_path / "test_datasets.db"
    return DatasetStore(db_path=db_path)


@pytest.fixture()
def mock_bars():
    """Return deterministic test bars."""
    return _make_bars("AAPL", 200)


# ══════════════════════════════════════════════════════════════════════════════
# Unit tests for DatasetStore
# ══════════════════════════════════════════════════════════════════════════════


class TestDatasetStore:
    """Tests for the SQLite-backed DatasetStore."""

    def test_save_and_get(self, tmp_store):
        snap = DatasetSnapshot(
            dataset_id="ds-test-001",
            symbol="AAPL",
            start_date="2020-01-01",
            end_date="2023-01-01",
            provider="yfinance",
            sha256="abc123def456",
            row_count=100,
            created_at="2024-01-01T00:00:00Z",
        )
        tmp_store.save(snap, bars_json='[{"test": true}]')
        result = tmp_store.get("ds-test-001")
        assert result is not None
        assert result.dataset_id == "ds-test-001"
        assert result.symbol == "AAPL"
        assert result.row_count == 100

    def test_get_nonexistent(self, tmp_store):
        assert tmp_store.get("ds-nonexistent") is None

    def test_bars_json_roundtrip(self, tmp_store):
        snap = DatasetSnapshot(
            dataset_id="ds-test-bars",
            symbol="MSFT",
            start_date="2020-01-01",
            end_date="2021-01-01",
            provider="yfinance",
            sha256="bars_hash_123",
            row_count=50,
            created_at="2024-01-01T00:00:00Z",
        )
        bars_data = json.dumps([{"date": "2020-01-02", "close": 150.5}])
        tmp_store.save(snap, bars_json=bars_data)
        retrieved = tmp_store.get_bars_json("ds-test-bars")
        assert retrieved is not None
        parsed = json.loads(retrieved)
        assert len(parsed) == 1
        assert parsed[0]["close"] == 150.5

    def test_list_all(self, tmp_store):
        for i in range(3):
            snap = DatasetSnapshot(
                dataset_id=f"ds-list-{i}",
                symbol="AAPL" if i < 2 else "MSFT",
                start_date="2020-01-01",
                end_date="2023-01-01",
                provider="yfinance",
                sha256=f"hash_{i}",
                row_count=100 + i,
                created_at=f"2024-01-0{i+1}T00:00:00Z",
            )
            tmp_store.save(snap)
        all_snaps = tmp_store.list_all()
        assert len(all_snaps) == 3

    def test_list_filter_by_symbol(self, tmp_store):
        for i, sym in enumerate(["AAPL", "AAPL", "MSFT"]):
            snap = DatasetSnapshot(
                dataset_id=f"ds-filter-{i}",
                symbol=sym,
                start_date="2020-01-01",
                end_date="2023-01-01",
                provider="yfinance",
                sha256=f"filter_hash_{i}",
                row_count=100,
                created_at=f"2024-01-0{i+1}T00:00:00Z",
            )
            tmp_store.save(snap)
        aapl_snaps = tmp_store.list_all(symbol="AAPL")
        assert len(aapl_snaps) == 2
        msft_snaps = tmp_store.list_all(symbol="MSFT")
        assert len(msft_snaps) == 1

    def test_find_by_sha256(self, tmp_store):
        snap = DatasetSnapshot(
            dataset_id="ds-sha-search",
            symbol="GOOG",
            start_date="2020-01-01",
            end_date="2023-01-01",
            provider="yfinance",
            sha256="unique_hash_for_search",
            row_count=200,
            created_at="2024-01-01T00:00:00Z",
        )
        tmp_store.save(snap)
        found = tmp_store.find_by_sha256("unique_hash_for_search")
        assert found is not None
        assert found.dataset_id == "ds-sha-search"
        not_found = tmp_store.find_by_sha256("nonexistent_hash")
        assert not_found is None

    def test_upsert_on_duplicate_key(self, tmp_store):
        snap1 = DatasetSnapshot(
            dataset_id="ds-upsert",
            symbol="AAPL",
            start_date="2020-01-01",
            end_date="2023-01-01",
            provider="yfinance",
            sha256="upsert_hash",
            row_count=100,
            created_at="2024-01-01T00:00:00Z",
        )
        tmp_store.save(snap1)
        snap2 = DatasetSnapshot(
            dataset_id="ds-upsert",
            symbol="AAPL",
            start_date="2020-01-01",
            end_date="2023-01-01",
            provider="yfinance",
            sha256="upsert_hash",
            row_count=200,  # Updated
            created_at="2024-01-02T00:00:00Z",
        )
        tmp_store.save(snap2)
        result = tmp_store.get("ds-upsert")
        assert result.row_count == 200  # should be updated


# ══════════════════════════════════════════════════════════════════════════════
# Unit tests for snapshot service functions
# ══════════════════════════════════════════════════════════════════════════════


class TestSnapshotService:
    """Tests for create_snapshot, get_snapshot, etc."""

    def test_create_snapshot_with_mock_data(self, tmp_store, mock_bars):
        """Snapshot creation with mocked data pipeline."""
        with patch.object(dp, "load_bars", return_value=(mock_bars, None)):
            req = DatasetSnapshotRequest(
                symbol="AAPL",
                start_date="2020-01-01",
                end_date="2023-01-01",
            )
            snap = create_snapshot(req, store=tmp_store)
            assert snap.dataset_id.startswith("ds-")
            assert snap.symbol == "AAPL"
            assert snap.row_count == len(mock_bars)
            assert len(snap.sha256) == 64

    def test_sha256_determinism(self, tmp_store, mock_bars):
        """Same bars → same SHA-256 every time."""
        sha1 = compute_bars_sha256(mock_bars)
        sha2 = compute_bars_sha256(mock_bars)
        assert sha1 == sha2
        assert len(sha1) == 64

    def test_dedup_returns_existing(self, tmp_store, mock_bars):
        """Creating the same snapshot twice returns the same object."""
        with patch.object(dp, "load_bars", return_value=(mock_bars, None)):
            req = DatasetSnapshotRequest(
                symbol="AAPL",
                start_date="2020-01-01",
                end_date="2023-01-01",
            )
            snap1 = create_snapshot(req, store=tmp_store)
            snap2 = create_snapshot(req, store=tmp_store)
            assert snap1.dataset_id == snap2.dataset_id
            assert snap1.sha256 == snap2.sha256

    def test_get_snapshot_not_found(self, tmp_store):
        """get_snapshot raises BtDataMissing for unknown ID."""
        with pytest.raises(BtDataMissing):
            get_snapshot("ds-nonexistent", store=tmp_store)

    def test_load_bars_roundtrip(self, tmp_store, mock_bars):
        """Bars saved can be loaded back as BarDaily."""
        with patch.object(dp, "load_bars", return_value=(mock_bars, None)):
            req = DatasetSnapshotRequest(
                symbol="AAPL",
                start_date="2020-01-01",
                end_date="2023-01-01",
            )
            snap = create_snapshot(req, store=tmp_store)
            loaded = load_snapshot_bars(snap.dataset_id, store=tmp_store)
            assert len(loaded) == len(mock_bars)
            assert loaded[0].symbol == mock_bars[0].symbol

    def test_invalid_date_format(self, tmp_store):
        """Invalid date raises BtCfgInvalid."""
        with patch.object(dp, "load_bars", return_value=([], None)):
            req = DatasetSnapshotRequest(
                symbol="AAPL",
                start_date="not-a-date",
                end_date="2023-01-01",
            )
            with pytest.raises(BtCfgInvalid):
                create_snapshot(req, store=tmp_store)

    def test_end_before_start(self, tmp_store):
        """end_date before start_date raises BtCfgInvalid."""
        with patch.object(dp, "load_bars", return_value=([], None)):
            req = DatasetSnapshotRequest(
                symbol="AAPL",
                start_date="2023-01-01",
                end_date="2020-01-01",
            )
            with pytest.raises(BtCfgInvalid):
                create_snapshot(req, store=tmp_store)

    def test_no_data_available(self, tmp_store):
        """No bars returns BtDataMissing."""
        with patch.object(dp, "load_bars", return_value=([], None)), \
             patch.object(dp, "fetch_daily", side_effect=RuntimeError("no data")):
            req = DatasetSnapshotRequest(
                symbol="ZZZZ",
                start_date="2020-01-01",
                end_date="2023-01-01",
            )
            with pytest.raises(BtDependencyDown):
                create_snapshot(req, store=tmp_store)

    def test_list_snapshots(self, tmp_store, mock_bars):
        """list_snapshots returns all created snapshots."""
        with patch.object(dp, "load_bars", return_value=(mock_bars, None)):
            req = DatasetSnapshotRequest(
                symbol="AAPL",
                start_date="2020-01-01",
                end_date="2023-01-01",
            )
            create_snapshot(req, store=tmp_store)
            snaps = list_snapshots(store=tmp_store)
            assert len(snaps) >= 1
            snaps_aapl = list_snapshots(symbol="AAPL", store=tmp_store)
            assert len(snaps_aapl) >= 1


# ══════════════════════════════════════════════════════════════════════════════
# API Integration tests (HTTP endpoints)
# ══════════════════════════════════════════════════════════════════════════════


@pytest.mark.anyio
class TestW14DatasetAPI:
    """Integration tests for W14 dataset snapshot HTTP endpoints."""

    async def test_list_datasets_empty(self):
        async with AsyncClient(transport=_transport, base_url="http://test") as c:
            r = await c.get("/api/v3/backtest/datasets")
            assert r.status_code == 200
            data = r.json()
            assert "datasets" in data
            assert "count" in data
            assert isinstance(data["datasets"], list)

    async def test_create_snapshot_requires_auth(self):
        async with AsyncClient(transport=_transport, base_url="http://test") as c:
            r = await c.post(
                "/api/v3/backtest/datasets/snapshot",
                json={"symbol": "AAPL", "start_date": "2020-01-01", "end_date": "2023-01-01"},
            )
            assert r.status_code == 401

    async def test_create_snapshot_invalid_date(self):
        async with AsyncClient(transport=_transport, base_url="http://test") as c:
            r = await c.post(
                "/api/v3/backtest/datasets/snapshot",
                headers=_AUTH,
                json={"symbol": "AAPL", "start_date": "bad", "end_date": "2023-01-01"},
            )
            # The validator min_length=8 may reject "bad" with 422
            assert r.status_code in (400, 422)

    async def test_get_snapshot_auth_gate(self):
        """GET /datasets/snapshot without auth → 401."""
        async with AsyncClient(transport=_transport, base_url="http://test") as c:
            r = await c.get("/api/v3/backtest/datasets/snapshot")
            assert r.status_code == 401

    async def test_get_snapshot_with_auth(self):
        """GET /datasets/snapshot with auth → 200."""
        async with AsyncClient(transport=_transport, base_url="http://test") as c:
            r = await c.get("/api/v3/backtest/datasets/snapshot", headers=_AUTH)
            assert r.status_code == 200
            data = r.json()
            assert "dataset_id" in data

    async def test_get_nonexistent_dataset(self):
        async with AsyncClient(transport=_transport, base_url="http://test") as c:
            r = await c.get("/api/v3/backtest/datasets/ds-nonexistent-xyz")
            # Should return 409 (BT_DATA_MISSING) wrapped in JSONResponse
            assert r.status_code == 409
            data = r.json()
            assert data["error_code"] == "BT_DATA_MISSING"

    async def test_create_and_retrieve_snapshot(self):
        """Full flow: create → get by ID → verify checksum."""
        mock_bars = _make_bars("TSLA", 100)
        with patch.object(dp, "load_bars", return_value=(mock_bars, None)):
            async with AsyncClient(transport=_transport, base_url="http://test") as c:
                # Create
                r = await c.post(
                    "/api/v3/backtest/datasets/snapshot",
                    headers=_AUTH,
                    json={"symbol": "TSLA", "start_date": "2020-01-01", "end_date": "2023-01-01"},
                )
                assert r.status_code == 200
                data = r.json()
                ds_id = data["dataset_id"]
                assert ds_id.startswith("ds-")
                assert "sha256" in data
                assert data["row_count"] == len(mock_bars)

                # Get by ID
                r2 = await c.get(f"/api/v3/backtest/datasets/{ds_id}")
                assert r2.status_code == 200
                assert r2.json()["dataset_id"] == ds_id

                # Get bars
                r3 = await c.get(f"/api/v3/backtest/datasets/{ds_id}/bars")
                assert r3.status_code == 200
                bars_data = r3.json()
                assert bars_data["row_count"] == len(mock_bars)

                # Verify checksum
                r4 = await c.get(f"/api/v3/backtest/datasets/{ds_id}/checksum")
                assert r4.status_code == 200
                checksum_data = r4.json()
                assert checksum_data["integrity"] == "verified"
                assert checksum_data["stored_sha256"] == checksum_data["recomputed_sha256"]

    async def test_dedup_via_api(self):
        """Same request twice → same dataset_id."""
        mock_bars = _make_bars("DEDUP", 50)
        with patch.object(dp, "load_bars", return_value=(mock_bars, None)):
            async with AsyncClient(transport=_transport, base_url="http://test") as c:
                body = {"symbol": "DEDUP", "start_date": "2020-01-01", "end_date": "2022-01-01"}
                r1 = await c.post("/api/v3/backtest/datasets/snapshot", headers=_AUTH, json=body)
                r2 = await c.post("/api/v3/backtest/datasets/snapshot", headers=_AUTH, json=body)
                assert r1.json()["dataset_id"] == r2.json()["dataset_id"]
                assert r1.json()["sha256"] == r2.json()["sha256"]


# ══════════════════════════════════════════════════════════════════════════════
# Backtest engine with dataset_id binding
# ══════════════════════════════════════════════════════════════════════════════


class TestEngineDatasetBinding:
    """Test that engine_v2 can run against a dataset snapshot."""

    def test_run_with_dataset_id(self, tmp_store, mock_bars):
        """Engine loads bars from snapshot when dataset_id is set."""
        from services.backtest_engine.engine_v2 import BacktestEngineV2
        from services.backtest_engine.models import BacktestConfig

        # Create snapshot first
        with patch.object(dp, "load_bars", return_value=(mock_bars, None)):
            req = DatasetSnapshotRequest(
                symbol="AAPL",
                start_date="2020-01-01",
                end_date="2021-06-01",
            )
            snap = create_snapshot(req, store=tmp_store)

        # Patch the global store to use our temp store
        with patch("services.backtest_engine.dataset_snapshot.DatasetStore", return_value=tmp_store):
            engine = BacktestEngineV2()
            config = BacktestConfig(
                symbol="AAPL",
                strategy_id="sma-crossover",
                start_date=date(2020, 1, 1),
                end_date=date(2021, 6, 1),
                initial_capital=100000,
                dataset_id=snap.dataset_id,
            )
            run = engine.run(config)
            assert run.status.value == "completed"
            assert run.provenance.source == "DATASET_SNAPSHOT"
            assert run.provenance.dataset_id == snap.dataset_id
            assert len(run.equity_curve) > 0
