"""Portfolio management module."""
from .manager import PortfolioManager, Position as LegacyPosition, Trade, PositionSide

# v1.19 + v1.20: Portfolio CRUD (different from legacy trading portfolio)
from .schemas import (
    Portfolio,
    Position,
    Lot,
    ValuationSnapshot,
    PositionValuation,
    ValuationInputs,
    PortfolioCreateRequest,
    PortfolioUpdateRequest,
    PositionCreateRequest,
    PortfolioListResponse,
    PortfolioExport,
    PortfolioImportRequest,
    PORTFOLIO_SCHEMA_VERSION,
    compute_content_hash
)

from .fixtures import (
    create_demo_fixtures,
    get_fixture_checksums,
    verify_fixtures_determinism
)

from .store import (
    PortfolioStore,
    get_demo_store,
    reset_demo_store
)

from .api import router as portfolio_router

# v1.21: Valuation service
from .valuation import compute_portfolio_valuation
from .pricing import load_demo_prices, get_pricing_source_label

__all__ = [
    # v1.19 + v1.20
    "Portfolio",
    "Position",
    "Lot",
    "ValuationSnapshot",
    "PositionValuation",
    "ValuationInputs",
    "PortfolioCreateRequest",
    "PortfolioUpdateRequest",
    "PositionCreateRequest",
    "PortfolioListResponse",
    "PortfolioExport",
    "PortfolioImportRequest",
    "PORTFOLIO_SCHEMA_VERSION",
    "compute_content_hash",
    "create_demo_fixtures",
    "get_fixture_checksums",
    "verify_fixtures_determinism",
    "PortfolioStore",
    "get_demo_store",
    "reset_demo_store",
    "portfolio_router",
    # v1.21
    "compute_portfolio_valuation",
    "load_demo_prices",
    "get_pricing_source_label",
]

