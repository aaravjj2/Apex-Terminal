"""
Backend tests for v1.21 ( Portfolio Valuation)

Coverage:
- Valuation math correctness
- Stable ordering of per_position output
- Determinism (call twice → same hash)
- Pricing fixtures loading
"""

import pytest
from decimal import Decimal
from datetime import datetime
from phase1.services.portfolio.schemas import Portfolio, Position, Lot
from phase1.services.portfolio.valuation import compute_portfolio_valuation
from phase1.services.portfolio.pricing import load_demo_prices, get_pricing_source_label
from phase1.services.portfolio.fixtures import create_demo_fixtures
from phase1.services.portfolio.store import PortfolioStore, reset_demo_store
from phase1.services.portfolio.schemas import PortfolioCreateRequest, PositionCreateRequest


# =============================================================================
# Pricing Fixtures Tests
# =============================================================================

def test_load_demo_prices():
    """Test loading deterministic prices from fixtures"""
    prices, as_of, checksum = load_demo_prices()
    
    # Verify prices exist
    assert 'AAPL' in prices
    assert 'MSFT' in prices
    assert 'GOOGL' in prices
    assert 'JNJ' in prices
    assert 'KO' in prices
    
    # Verify prices are Decimal
    assert isinstance(prices['AAPL'], Decimal)
    assert isinstance(prices['MSFT'], Decimal)
    
    # Verify as_of is datetime
    assert isinstance(as_of, datetime)
    
    # Verify checksum exists
    assert len(checksum) == 64  # SHA256 hex digest
    
    # Verify pricing source label
    label = get_pricing_source_label()
    assert label == "demo-bars:last-close"


def test_pricing_determinism():
    """Test that loading prices twice gives same results"""
    prices1, as_of1, checksum1 = load_demo_prices()
    prices2, as_of2, checksum2 = load_demo_prices()
    
    assert prices1 == prices2
    assert as_of1 == as_of2
    assert checksum1 == checksum2


# =============================================================================
# Valuation Math Tests
# =============================================================================

def test_valuation_single_position():
    """Test valuation for portfolio with single position"""
    reset_demo_store()
    store = PortfolioStore(seed=42)
    
    # Create portfolio with one position
    portfolio = store.create_portfolio(PortfolioCreateRequest(
        name="Single Position Test",
        currency="USD",
        initial_cash=Decimal("10000.00")
    ))
    
    # Add AAPL position
    portfolio = store.add_position(
        portfolio.portfolio_id,
        PositionCreateRequest(
            symbol="AAPL",
            quantity=Decimal("100"),
            cost_basis_per_unit=Decimal("150.00"),
            acquisition_date=datetime(2024, 1, 15).date()
        )
    )
    
    # Compute valuation
    valuation = compute_portfolio_valuation(portfolio)
    
    # Verify structure
    assert valuation.portfolio_id == portfolio.portfolio_id
    assert valuation.cash_balance == Decimal("10000.00")
    assert len(valuation.per_position) == 1
    
    # Verify AAPL position valuation
    aapl= valuation.per_position[0]
    assert aapl.symbol == "AAPL"
    assert aapl.quantity == Decimal("100.00")
    assert aapl.cost_basis == Decimal("150.00")
    # AAPL current price should be from fixtures (last close)
    assert aapl.current_price > 0
    assert aapl.market_value == aapl.quantity * aapl.current_price
    assert aapl.unrealized_pnl == aapl.market_value - (aapl.quantity * aapl.cost_basis)
    
    # Verify totals
    assert valuation.positions_market_value == aapl.market_value
    assert valuation.pnl_total == aapl.unrealized_pnl
    assert valuation.net_value == valuation.cash_balance + valuation.positions_market_value
    
    # Verify valuation inputs
    assert valuation.valuation_inputs.pricing_source == "demo-bars:last-close"
    assert len(valuation.valuation_inputs.source_checksum) == 64
    assert valuation.valuation_inputs.rounding_policy == "0.01"
    assert isinstance(valuation.valuation_inputs.as_of, datetime)


def test_valuation_multi_position():
    """Test valuation for portfolio with multiple positions"""
    # Use demo fixture (DEMO-PORT-001 has 3 positions)
    fixtures = create_demo_fixtures()
    portfolio = fixtures[0]  # Tech Growth Portfolio
    
    # Compute valuation
    valuation = compute_portfolio_valuation(portfolio)
    
    # Verify structure
    assert len(valuation.per_position) == 3  # AAPL, MSFT, GOOGL
    
    # Verify sorting (should be alphabetical by symbol)
    symbols = [p.symbol for p in valuation.per_position]
    assert symbols == sorted(symbols)  # AAPL, GOOGL, MSFT
    
    # Verify each position has required fields
    for pos in valuation.per_position:
        assert pos.symbol in ['AAPL', 'MSFT', 'GOOGL']
        assert pos.quantity > 0
        assert pos.cost_basis > 0
        assert pos.current_price > 0
        assert pos.market_value > 0
        # unrealized_pnl can be positive or negative
        assert isinstance(pos.unrealized_pnl, Decimal)
    
    # Verify aggregates
    total_market_value = sum(p.market_value for p in valuation.per_position)
    total_pnl = sum(p.unrealized_pnl for p in valuation.per_position)
    
    assert valuation.positions_market_value == total_market_value
    assert valuation.pnl_total == total_pnl
    assert valuation.net_value == valuation.cash_balance + total_market_value


def test_valuation_empty_portfolio():
    """Test valuation for portfolio with no positions"""
    reset_demo_store()
    store = PortfolioStore(seed=42)
    
    # Create empty portfolio
    portfolio = store.create_portfolio(PortfolioCreateRequest(
        name="Empty Portfolio",
        currency="USD",
        initial_cash=Decimal("50000.00")
    ))
    
    # Compute valuation
    valuation = compute_portfolio_valuation(portfolio)
    
    # Verify empty valuation
    assert len(valuation.per_position) == 0
    assert valuation.positions_market_value == Decimal("0.00")
    assert valuation.pnl_total == Decimal("0.00")
    assert valuation.net_value == valuation.cash_balance
    assert valuation.cash_balance == Decimal("50000.00")


# =============================================================================
# Stable Ordering Tests
# =============================================================================

def test_valuation_stable_position_ordering():
    """Test that per_position list has stable ordering (symbol ascending)"""
    # Use demo fixture with multiple positions
    fixtures = create_demo_fixtures()
    portfolio = fixtures[0]
    
    # Compute valuation twice
    valuation1 = compute_portfolio_valuation(portfolio)
    valuation2 = compute_portfolio_valuation(portfolio)
    
    # Verify same ordering
    symbols1 = [p.symbol for p in valuation1.per_position]
    symbols2 = [p.symbol for p in valuation2.per_position]
    
    assert symbols1 == symbols2
    assert symbols1 == sorted(symbols1)  # Alphabetical


# ============================================================================
# Determinism Tests
# =============================================================================

def test_valuation_determinism():
    """Test that computing valuation twice gives identical canonical JSON hash"""
    fixtures = create_demo_fixtures()
    portfolio = fixtures[0]
    
    # Compute valuation twice
    valuation1 = compute_portfolio_valuation(portfolio)
    valuation2 = compute_portfolio_valuation(portfolio)
    
    # Verify content hashes match
    assert valuation1.content_hash == valuation2.content_hash
    
    # Verify snapshot IDs match (deterministic based on portfolio_id + as_of)
    assert valuation1.snapshot_id == valuation2.snapshot_id
    
    # Verify as_of timestamps match (from fixture, not wall clock)
    assert valuation1.as_of == valuation2.as_of
    
    # Verify all numeric values match
    assert valuation1.net_value == valuation2.net_value
    assert valuation1.pnl_total == valuation2.pnl_total
    assert valuation1.positions_market_value == valuation2.positions_market_value


def test_valuation_decimal_precision():
    """Test that all values are properly quantized to 0.01"""
    fixtures = create_demo_fixtures()
    portfolio = fixtures[0]
    
    valuation = compute_portfolio_valuation(portfolio)
    
    # Verify aggregates have 2 decimal places
    assert valuation.net_value == valuation.net_value.quantize(Decimal("0.01"))
    assert valuation.pnl_total == valuation.pnl_total.quantize(Decimal("0.01"))
    assert valuation.cash_balance == valuation.cash_balance.quantize(Decimal("0.01"))
    assert valuation.positions_market_value == valuation.positions_market_value.quantize(Decimal("0.01"))
    
    # Verify per-position values have 2 decimal places
    for pos in valuation.per_position:
        assert pos.quantity == pos.quantity.quantize(Decimal("0.01"))
        assert pos.cost_basis == pos.cost_basis.quantize(Decimal("0.01"))
        assert pos.current_price == pos.current_price.quantize(Decimal("0.01"))
        assert pos.market_value == pos.market_value.quantize(Decimal("0.01"))
        assert pos.unrealized_pnl == pos.unrealized_pnl.quantize(Decimal("0.01"))


def test_valuation_content_hash_excludes_hash():
    """Test that content hash excludes itself from computation"""
    fixtures = create_demo_fixtures()
    portfolio = fixtures[0]
    
    valuation = compute_portfolio_valuation(portfolio)
    
    # Hash should be 64-char SHA256
    assert len(valuation.content_hash) == 64
    
    # Verify hash is stable
    hash1 = valuation.compute_hash()
    hash2 = valuation.compute_hash()
    assert hash1 == hash2
    assert hash1 == valuation.content_hash
