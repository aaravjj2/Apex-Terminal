"""
v1.23 Portfolio Import/Export Round-Trip Tests
Tests canonical export format, import with validation, and determinism.
"""

import pytest
import json
from decimal import Decimal
from datetime import datetime, date

from phase1.services.portfolio.schemas import (
    Portfolio,
    Position,
    Lot,
    PortfolioExport,
    PortfolioImportRequest,
    PortfolioCreateRequest,
    PortfolioListResponse,
    PORTFOLIO_SCHEMA_VERSION,
)
from phase1.services.portfolio.store import PortfolioStore
from phase1.services.portfolio.fixtures import create_demo_fixtures


@pytest.fixture
def store():
    """Fresh store with demo fixtures."""
    s = PortfolioStore(seed=42)
    s.seed_fixtures(create_demo_fixtures())
    return s


def test_export_contains_portfolio_and_hash(store: PortfolioStore):
    """Export should contain portfolio data and a computed hash."""
    portfolio = store.list_portfolios()[0]
    export = PortfolioExport(portfolio=portfolio)
    export.export_hash = export.compute_export_hash()

    assert export.portfolio.portfolio_id == portfolio.portfolio_id
    assert export.schema_version == PORTFOLIO_SCHEMA_VERSION
    assert export.export_hash is not None
    assert len(export.export_hash) == 64  # SHA256 hex


def test_export_hash_deterministic(store: PortfolioStore):
    """Same portfolio should produce the same export hash."""
    portfolio = store.list_portfolios()[0]
    export1 = PortfolioExport(portfolio=portfolio)
    export1.export_hash = export1.compute_export_hash()

    export2 = PortfolioExport(portfolio=portfolio)
    export2.export_hash = export2.compute_export_hash()

    assert export1.export_hash == export2.export_hash


def test_import_round_trip_new_id(store: PortfolioStore):
    """Export → JSON → import into store with new ID preserves positions."""
    portfolio = store.list_portfolios()[0]
    original_id = portfolio.portfolio_id
    original_positions = len(portfolio.positions)

    # Export
    export = PortfolioExport(portfolio=portfolio)
    export.export_hash = export.compute_export_hash()
    payload = export.model_dump(mode="json")

    # Import (same ID exists → new ID created)
    request = PortfolioImportRequest(**payload)
    assert request.schema_version == PORTFOLIO_SCHEMA_VERSION

    # Simulate import into the store
    from phase1.services.portfolio.api import import_portfolio
    import asyncio

    # We need to test the logic, not the API endpoint directly
    # So test the store-level behavior:
    existing = store.get_portfolio(request.portfolio.portfolio_id)
    assert existing is not None  # Same ID exists

    # Import with new ID
    create_req = PortfolioCreateRequest(
        name=f"{request.portfolio.name} (imported)",
        currency=request.portfolio.currency,
        initial_cash=request.portfolio.cash_balance
    )
    new_portfolio = store.create_portfolio(create_req)
    assert new_portfolio.portfolio_id != original_id

    # Copy positions
    from phase1.services.portfolio.schemas import PositionCreateRequest
    for pos in request.portfolio.positions:
        store.add_position(
            new_portfolio.portfolio_id,
            PositionCreateRequest(
                symbol=pos.symbol,
                quantity=pos.quantity,
                cost_basis_per_unit=pos.average_cost_basis,
            )
        )

    imported = store.get_portfolio(new_portfolio.portfolio_id)
    assert imported is not None
    assert len(imported.positions) == original_positions


def test_import_round_trip_fresh_store():
    """Export → import into a fresh store (no collision) preserves exact portfolio."""
    source = PortfolioStore(seed=42)
    source.seed_fixtures(create_demo_fixtures())
    portfolio = source.list_portfolios()[0]
    original_id = portfolio.portfolio_id

    # Export from source
    export = PortfolioExport(portfolio=portfolio)
    export.export_hash = export.compute_export_hash()
    payload = export.model_dump(mode="json")

    # Import into fresh store
    dest = PortfolioStore(seed=99)
    request = PortfolioImportRequest(**payload)
    imported = request.portfolio
    imported.content_hash = imported.compute_hash()
    dest._portfolios[imported.portfolio_id] = imported

    result = dest.get_portfolio(original_id)
    assert result is not None
    assert result.portfolio_id == original_id
    assert result.name == portfolio.name
    assert result.currency == portfolio.currency
    assert len(result.positions) == len(portfolio.positions)


def test_import_schema_version_validation():
    """Import should reject incompatible schema versions."""
    with pytest.raises(Exception):
        PortfolioImportRequest(
            portfolio=Portfolio(
                portfolio_id="TEST",
                name="Test",
                currency="USD",
                cash_balance=Decimal("0"),
                positions=[],
            ),
            schema_version="2.0.0",  # Incompatible
        )


def test_import_hash_verification():
    """Import with wrong hash should be detectable."""
    source = PortfolioStore(seed=42)
    source.seed_fixtures(create_demo_fixtures())
    portfolio = source.list_portfolios()[0]

    export = PortfolioExport(portfolio=portfolio)
    export.export_hash = export.compute_export_hash()

    # Tamper with portfolio name
    export_data = export.model_dump(mode="json")
    export_data["portfolio"]["name"] = "TAMPERED"

    # Re-create and check hash mismatch
    request = PortfolioImportRequest(**export_data)
    verification_export = PortfolioExport(portfolio=request.portfolio)
    computed = verification_export.compute_export_hash()
    assert computed != request.export_hash  # Hash should NOT match


def test_export_json_serializable(store: PortfolioStore):
    """Export must be fully JSON serializable (no binary, no special types)."""
    portfolio = store.list_portfolios()[0]
    export = PortfolioExport(portfolio=portfolio)
    export.export_hash = export.compute_export_hash()

    json_str = export.model_dump_json()
    parsed = json.loads(json_str)

    assert "portfolio" in parsed
    assert "schema_version" in parsed
    assert "export_hash" in parsed
    assert isinstance(parsed["export_hash"], str)


def test_all_demo_portfolios_exportable(store: PortfolioStore):
    """Every demo portfolio should be exportable without error."""
    portfolios = store.list_portfolios()
    assert len(portfolios) >= 2  # At least 2 demo portfolios

    for p in portfolios:
        export = PortfolioExport(portfolio=p)
        export.export_hash = export.compute_export_hash()
        assert export.export_hash is not None
        # Verify JSON round-trip
        json_str = export.model_dump_json()
        parsed = json.loads(json_str)
        assert parsed["portfolio"]["portfolio_id"] == p.portfolio_id
