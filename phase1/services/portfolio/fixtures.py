"""
DEMO Portfolio Fixtures (v1.19)
Deterministic fixture portfolios with checksums for testing and DEMO mode.
"""

from decimal import Decimal
from datetime import datetime, date
from typing import List

from .schemas import Portfolio, Position, Lot, PORTFOLIO_SCHEMA_VERSION


def create_demo_fixtures() -> List[Portfolio]:
    """
    Create deterministic DEMO fixture portfolios.
    
    Returns:
        List of fixture portfolios with stable content hashes
    """
    fixtures = []
    
    # Fixture 1: Growth Portfolio with tech stocks
    growth_portfolio = Portfolio(
        portfolio_id="DEMO-PORT-001",
        name="Tech Growth Portfolio",
        currency="USD",
        cash_balance=Decimal("25000.00"),
        positions=[
            Position(
                symbol="AAPL",
                quantity=Decimal("100.00"),
                average_cost_basis=Decimal("150.00"),
                current_price=Decimal("175.50"),
                lots=[
                    Lot(
                        lot_id="DEMO-LOT-001",
                        symbol="AAPL",
                        quantity=Decimal("100.00"),
                        acquisition_date=date(2024, 1, 15),
                        cost_basis_per_unit=Decimal("150.00"),
                        remaining_quantity=Decimal("100.00")
                    )
                ]
            ),
            Position(
                symbol="MSFT",
                quantity=Decimal("50.00"),
                average_cost_basis=Decimal("300.00"),
                current_price=Decimal("350.00"),
                lots=[
                    Lot(
                        lot_id="DEMO-LOT-002",
                        symbol="MSFT",
                        quantity=Decimal("50.00"),
                        acquisition_date=date(2024, 1, 20),
                        cost_basis_per_unit=Decimal("300.00"),
                        remaining_quantity=Decimal("50.00")
                    )
                ]
            ),
            Position(
                symbol="GOOGL",
                quantity=Decimal("75.00"),
                average_cost_basis=Decimal("120.00"),
                current_price=Decimal("140.00"),
                lots=[
                    Lot(
                        lot_id="DEMO-LOT-003",
                        symbol="GOOGL",
                        quantity=Decimal("75.00"),
                        acquisition_date=date(2024, 2, 1),
                        cost_basis_per_unit=Decimal("120.00"),
                        remaining_quantity=Decimal("75.00")
                    )
                ]
            )
        ],
        created_at=datetime(2024, 1, 15, 10, 0, 0),
        updated_at=datetime(2024, 2, 12, 10, 0, 0),
        schema_version=PORTFOLIO_SCHEMA_VERSION
    )
    growth_portfolio.content_hash = growth_portfolio.compute_hash()
    fixtures.append(growth_portfolio)
    
    # Fixture 2: Income Portfolio with dividend stocks
    income_portfolio = Portfolio(
        portfolio_id="DEMO-PORT-002",
        name="Dividend Income Portfolio",
        currency="USD",
        cash_balance=Decimal("10000.00"),
        positions=[
            Position(
                symbol="JNJ",
                quantity=Decimal("200.00"),
                average_cost_basis=Decimal("160.00"),
                current_price=Decimal("165.00"),
                lots=[
                    Lot(
                        lot_id="DEMO-LOT-004",
                        symbol="JNJ",
                        quantity=Decimal("200.00"),
                        acquisition_date=date(2023, 6, 1),
                        cost_basis_per_unit=Decimal("160.00"),
                        remaining_quantity=Decimal("200.00")
                    )
                ]
            ),
            Position(
                symbol="KO",
                quantity=Decimal("300.00"),
                average_cost_basis=Decimal("55.00"),
                current_price=Decimal("60.00"),
                lots=[
                    Lot(
                        lot_id="DEMO-LOT-005",
                        symbol="KO",
                        quantity=Decimal("300.00"),
                        acquisition_date=date(2023, 7, 15),
                        cost_basis_per_unit=Decimal("55.00"),
                        remaining_quantity=Decimal("300.00")
                    )
                ]
            )
        ],
        created_at=datetime(2023, 6, 1, 9, 0, 0),
        updated_at=datetime(2024, 2, 10, 15, 30, 0),
        schema_version=PORTFOLIO_SCHEMA_VERSION
    )
    income_portfolio.content_hash = income_portfolio.compute_hash()
    fixtures.append(income_portfolio)
    
    # Fixture 3: Empty Portfolio (for testing create flows)
    empty_portfolio = Portfolio(
        portfolio_id="DEMO-PORT-003",
        name="New Portfolio",
        currency="USD",
        cash_balance=Decimal("100000.00"),
        positions=[],
        created_at=datetime(2024, 2, 12, 8, 0, 0),
        updated_at=datetime(2024, 2, 12, 8, 0, 0),
        schema_version=PORTFOLIO_SCHEMA_VERSION
    )
    empty_portfolio.content_hash = empty_portfolio.compute_hash()
    fixtures.append(empty_portfolio)
    
    return fixtures


def get_fixture_checksums() -> dict:
    """
    Get SHA256 checksums of all fixture portfolios.
    Used for determinism verification.
    
    Returns:
        Dictionary mapping portfolio_id to checksum
    """
    fixtures = create_demo_fixtures()
    return {
        portfolio.portfolio_id: portfolio.content_hash
        for portfolio in fixtures
    }


# Pre-computed checksums for fast validation
EXPECTED_FIXTURE_CHECKSUMS = {
    "DEMO-PORT-001": None,  # Computed on first load
    "DEMO-PORT-002": None,
    "DEMO-PORT-003": None
}


def verify_fixtures_determinism() -> bool:
    """
    Verify that fixtures are generated deterministically.
    Creates fixtures twice and compares checksums.
    
    Returns:
        True if checksums match across two generations
    """
    checksums1 = get_fixture_checksums()
    checksums2 = get_fixture_checksums()
    
    return checksums1 == checksums2
