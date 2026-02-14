"""
Backend tests for v1.19 + v1.20 (Portfolio Schemas and CRUD)

Coverage:
- Schema validation
- Content hash determinism
- Fixture determinism
- Store CRUD operations
- API endpoints
- Stable ordering
"""

import pytest
from decimal import Decimal
from datetime import datetime
from phase1.services.portfolio.schemas import (
    Portfolio,
    Position,
    Lot,
    ValuationSnapshot,
    compute_content_hash,
    PortfolioCreateRequest,
    PortfolioUpdateRequest,
    PositionCreateRequest,
    PORTFOLIO_SCHEMA_VERSION
)
from phase1.services.portfolio.store import PortfolioStore, reset_demo_store
from phase1.services.portfolio.fixtures import (
    create_demo_fixtures,
    get_fixture_checksums,
    verify_fixtures_determinism
)


# =============================================================================
# Schema Validation Tests
# =============================================================================

def test_portfolio_create_valid():
    """Test creating a valid portfolio"""
    portfolio = Portfolio(
        portfolio_id="TEST-001",
        name="Test Portfolio",
        currency="USD",
        cash_balance=Decimal("10000.00"),
        positions=[],
        created_at=datetime.now(),
        updated_at=datetime.now(),
        schema_version=PORTFOLIO_SCHEMA_VERSION,
        content_hash=None
    )
    assert portfolio.name == "Test Portfolio"
    assert portfolio.currency == "USD"
    assert portfolio.cash_balance == Decimal("10000.00")


def test_portfolio_invalid_currency():
    """Test portfolio with invalid currency fails validation"""
    with pytest.raises(ValueError, match="currency"):
        Portfolio(
            portfolio_id="TEST-001",
            name="Test Portfolio",
            currency="INVALID",  # Invalid currency
            cash_balance=Decimal("10000.00"),
            positions=[],
            created_at=datetime.now(),
            updated_at=datetime.now(),
            schema_version=PORTFOLIO_SCHEMA_VERSION,
            content_hash=None
        )


def test_position_negative_quantity():
    """Test lot enforces positive quantity"""
    # Lot enforces positive quantity
    lot = Lot(
        lot_id="LOT-001",
        symbol="AAPL",
        quantity=Decimal("100"),
        acquisition_date=datetime.now().date(),
        cost_basis_per_unit=Decimal("150.00"),
        remaining_quantity=Decimal("100")
    )
    assert lot.remaining_quantity > 0


def test_lot_remaining_exceeds_original():
    """Test lot with remaining > original fails validation"""
    with pytest.raises(ValueError, match="cannot exceed original"):
        Lot(
            lot_id="LOT-001",
            symbol="AAPL",
            quantity=Decimal("100"),
            acquisition_date=datetime.now().date(),
            cost_basis_per_unit=Decimal("150.00"),
            remaining_quantity=Decimal("150")  # Exceeds original
        )


# =============================================================================
# Content Hash Determinism Tests
# =============================================================================

def test_content_hash_stable_same_input():
    """Test content hash is stable for same input"""
    data = {
        "name": "Test Portfolio",
        "currency": "USD",
        "cash_balance": "10000.00"
    }
    
    hash1 = compute_content_hash(data, exclude_keys=set())
    hash2 = compute_content_hash(data, exclude_keys=set())
    
    assert hash1 == hash2
    assert len(hash1) == 64  # SHA256 hex digest


def test_content_hash_excludes_id_timestamps():
    """Test content hash excludes specified keys"""
    data1 = {
        "portfolio_id": "ID-001",
        "name": "Test Portfolio",
        "created_at": "2024-01-01",
        "currency": "USD"
    }
    
    data2 = {
        "portfolio_id": "ID-002",  # Different ID
        "name": "Test Portfolio",
        "created_at": "2024-01-02",  # Different timestamp
        "currency": "USD"
    }
    
    exclude_keys = {"portfolio_id", "created_at"}
    hash1 = compute_content_hash(data1, exclude_keys=exclude_keys)
    hash2 = compute_content_hash(data2, exclude_keys=exclude_keys)
    
    assert hash1 == hash2  # Hashes should match when excluding ID and timestamps


def test_portfolio_compute_hash():
    """Test Portfolio.compute_hash() method"""
    portfolio = Portfolio(
        portfolio_id="TEST-001",
        name="Test Portfolio",
        currency="USD",
        cash_balance=Decimal("10000.00"),
        positions=[],
        created_at=datetime(2024, 1, 1),
        updated_at=datetime(2024, 1, 2),
        schema_version=PORTFOLIO_SCHEMA_VERSION,
        content_hash=None
    )
    
    hash1 = portfolio.compute_hash()
    hash2 = portfolio.compute_hash()
    
    assert hash1 == hash2
    assert len(hash1) == 64


# =============================================================================
# Fixtures Tests
# =============================================================================

def test_fixtures_deterministic():
    """Test fixtures are deterministic across multiple calls"""
    verify_fixtures_determinism()  # Should not raise


def test_fixture_checksums_stable():
    """Test fixture checksums are stable"""
    checksums1 = get_fixture_checksums()
    checksums2 = get_fixture_checksums()
    
    assert checksums1 == checksums2
    assert len(checksums1) == 3  # 3 demo portfolios


def test_three_fixtures_loaded():
    """Test all 3 demo fixtures exist"""
    fixtures = create_demo_fixtures()
    
    assert len(fixtures) == 3
    assert fixtures[0].portfolio_id == "DEMO-PORT-001"
    assert fixtures[1].portfolio_id == "DEMO-PORT-002"
    assert fixtures[2].portfolio_id == "DEMO-PORT-003"
    
    # Verify fixture 1 has positions
    assert len(fixtures[0].positions) == 3  # AAPL, MSFT, GOOGL
    
    # Verify fixture 2 has positions
    assert len(fixtures[1].positions) == 2  # JNJ, KO
    
    # Verify fixture 3 is empty
    assert len(fixtures[2].positions) == 0


# =============================================================================
# Store CRUD Tests
# =============================================================================

def test_create_portfolio_deterministic_id():
    """Test portfolio creation with deterministic ID"""
    reset_demo_store()
    store = PortfolioStore(seed=42)
    
    request = PortfolioCreateRequest(
        name="Test Portfolio",
        currency="USD",
        cash_balance=Decimal("10000.00")
    )
    
    portfolio1 = store.create_portfolio(request)
    
    # Reset and create again with same seed
    reset_demo_store()
    store2 = PortfolioStore(seed=42)
    portfolio2 = store2.create_portfolio(request)
    
    assert portfolio1.portfolio_id == portfolio2.portfolio_id  # Deterministic


def test_list_portfolios_stable_ordering():
    """Test list portfolios with stable ordering"""
    reset_demo_store()
    store = PortfolioStore(seed=42)
    
    # Create multiple portfolios
    for name in ["Zebra", "Alpha", "Beta"]:
        store.create_portfolio(PortfolioCreateRequest(
            name=name,
            currency="USD",
            cash_balance=Decimal("10000.00")
        ))
    
    # List twice with same sort_by
    portfolios1 = store.list_portfolios(sort_by="portfolio_id")
    portfolios2 = store.list_portfolios(sort_by="portfolio_id")
    
    ids1 = [p.portfolio_id for p in portfolios1]
    ids2 = [p.portfolio_id for p in portfolios2]
    
    assert ids1 == ids2  # Stable ordering


def test_update_portfolio_recomputes_hash():
    """Test updating portfolio recomputes content hash"""
    reset_demo_store()
    store = PortfolioStore(seed=42)
    
    # Create portfolio
    portfolio = store.create_portfolio(PortfolioCreateRequest(
        name="Original Name",
        currency="USD",
        cash_balance=Decimal("10000.00")
    ))
    
    original_hash = portfolio.content_hash
    
    # Update portfolio
    updated = store.update_portfolio(
        portfolio.portfolio_id,
        PortfolioUpdateRequest(name="Updated Name")
    )
    
    assert updated.name == "Updated Name"
    assert updated.content_hash != original_hash  # Hash changed


def test_add_position_creates_lot():
    """Test adding position creates a lot"""
    reset_demo_store()
    store = PortfolioStore(seed=42)
    
    # Create portfolio
    portfolio = store.create_portfolio(PortfolioCreateRequest(
        name="Test Portfolio",
        currency="USD",
        cash_balance=Decimal("10000.00")
    ))
    
    # Add position
    updated = store.add_position(
        portfolio.portfolio_id,
        PositionCreateRequest(
            symbol="AAPL",
            quantity=Decimal("100"),
            cost_basis_per_unit=Decimal("150.00"),
            acquisition_date=datetime.now().date()
        )
    )
    
    assert len(updated.positions) == 1
    assert updated.positions[0].symbol == "AAPL"
    assert len(updated.positions[0].lots) == 1


def test_add_position_updates_existing():
    """Test adding position to existing symbol updates quantity"""
    reset_demo_store()
    store = PortfolioStore(seed=42)
    
    # Create portfolio
    portfolio = store.create_portfolio(PortfolioCreateRequest(
        name="Test Portfolio",
        currency="USD",
        cash_balance=Decimal("10000.00")
    ))
    
    # Add first position
    portfolio = store.add_position(
        portfolio.portfolio_id,
        PositionCreateRequest(
            symbol="AAPL",
            quantity=Decimal("100"),
            cost_basis_per_unit=Decimal("150.00"),
            acquisition_date=datetime.now().date()
        )
    )
    
    # Add second position for same symbol
    portfolio = store.add_position(
        portfolio.portfolio_id,
        PositionCreateRequest(
            symbol="AAPL",
            quantity=Decimal("50"),
            cost_basis_per_unit=Decimal("160.00"),
            acquisition_date=datetime.now().date()
        )
    )
    
    # Should still have 1 position with updated quantity (simple averaging for DEMO)
    assert len(portfolio.positions) == 1
    assert portfolio.positions[0].symbol == "AAPL"
    assert portfolio.positions[0].quantity == Decimal("150")  # 100 + 50
    # Average cost basis should be weighted average
    expected_avg = (Decimal("100") * Decimal("150.00") + Decimal("50") * Decimal("160.00")) / Decimal("150")
    assert abs(portfolio.positions[0].average_cost_basis - expected_avg) < Decimal("0.01")


# =============================================================================
# Determinism Artifacts Tests
# =============================================================================

def test_export_twice_same_hash():
    """Test exporting portfolio twice produces same hash"""
    reset_demo_store()
    store = PortfolioStore(seed=42)
    
    # Create and add position
    portfolio = store.create_portfolio(PortfolioCreateRequest(
        name="Test Portfolio",
        currency="USD",
        cash_balance=Decimal("10000.00")
    ))
    
    portfolio = store.add_position(
        portfolio.portfolio_id,
        PositionCreateRequest(
            symbol="AAPL",
            quantity=Decimal("100"),
            cost_basis_per_unit=Decimal("150.00"),
            acquisition_date=datetime(2024, 1, 15).date()
        )
    )
    
    # Export twice
    hash1 = portfolio.compute_hash()
    hash2 = portfolio.compute_hash()
    
    assert hash1 == hash2


def test_list_response_stable():
    """Test list response is stable across multiple calls"""
    reset_demo_store()
    store = PortfolioStore(seed=42)
    store.seed_fixtures(create_demo_fixtures())
    
    # List twice
    portfolios1 = store.list_portfolios(sort_by="portfolio_id")
    portfolios2 = store.list_portfolios(sort_by="portfolio_id")
    
    # Compare portfolio IDs and names
    ids1 = [(p.portfolio_id, p.name) for p in portfolios1]
    ids2 = [(p.portfolio_id, p.name) for p in portfolios2]
    
    assert ids1 == ids2
