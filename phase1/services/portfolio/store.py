"""
DEMO Portfolio Store (v1.20)
In-memory portfolio CRUD with fixture seeding and deterministic behavior.
"""

from typing import Dict, List, Optional
from decimal import Decimal
from datetime import datetime, date
import hashlib

from .schemas import (
    Portfolio,
    Position,
    Lot,
    PortfolioCreateRequest,
    PortfolioUpdateRequest,
    PositionCreateRequest,
    PORTFOLIO_SCHEMA_VERSION
)


class PortfolioStore:
    """
    In-memory portfolio store with deterministic ID generation.
    Seeded from fixtures at startup for DEMO mode.
    """
    
    def __init__(self, seed: int = 42):
        """Initialize store with deterministic seed"""
        self.seed = seed
        self._portfolios: Dict[str, Portfolio] = {}
        self._id_counter = 0
    
    def _generate_id(self, prefix: str = "PORT") -> str:
        """Generate deterministic IDs based on counter"""
        self._id_counter += 1
        # Use seed + counter for deterministic IDs
        hash_input = f"{self.seed}-{prefix}-{self._id_counter}"
        hash_hex = hashlib.sha256(hash_input.encode()).hexdigest()[:12]
        return f"{prefix}-{hash_hex}"
    
    def seed_fixtures(self, fixtures: List[Portfolio]):
        """Seed store with fixture portfolios"""
        for portfolio in fixtures:
            # Ensure content hash is computed
            if not portfolio.content_hash:
                portfolio.content_hash = portfolio.compute_hash()
            self._portfolios[portfolio.portfolio_id] = portfolio
    
    def list_portfolios(self, sort_by: str = "portfolio_id") -> List[Portfolio]:
        """
        List all portfolios with stable ordering.
        
        Args:
            sort_by: Field to sort by (portfolio_id, name, created_at)
        
        Returns:
            Sorted list of portfolios
        """
        portfolios = list(self._portfolios.values())
        
        # Stable sorting
        if sort_by == "name":
            portfolios.sort(key=lambda p: (p.name, p.portfolio_id))
        elif sort_by == "created_at":
            portfolios.sort(key=lambda p: (p.created_at, p.portfolio_id))
        else:  # portfolio_id (default)
            portfolios.sort(key=lambda p: p.portfolio_id)
        
        return portfolios
    
    def get_portfolio(self, portfolio_id: str) -> Optional[Portfolio]:
        """Get portfolio by ID"""
        return self._portfolios.get(portfolio_id)
    
    def create_portfolio(self, request: PortfolioCreateRequest) -> Portfolio:
        """Create a new portfolio"""
        portfolio_id = self._generate_id("PORT")
        
        now = datetime.utcnow()
        portfolio = Portfolio(
            portfolio_id=portfolio_id,
            name=request.name,
            currency=request.currency,
            cash_balance=request.initial_cash,
            positions=[],
            created_at=now,
            updated_at=now,
            schema_version=PORTFOLIO_SCHEMA_VERSION
        )
        
        # Compute content hash
        portfolio.content_hash = portfolio.compute_hash()
        
        self._portfolios[portfolio_id] = portfolio
        return portfolio
    
    def update_portfolio(
        self,
        portfolio_id: str,
        request: PortfolioUpdateRequest
    ) -> Optional[Portfolio]:
        """Update portfolio metadata"""
        portfolio = self._portfolios.get(portfolio_id)
        if not portfolio:
            return None
        
        # Update fields
        if request.name is not None:
            portfolio.name = request.name
        if request.currency is not None:
            portfolio.currency = request.currency
        
        portfolio.updated_at = datetime.utcnow()
        
        # Recompute content hash
        portfolio.content_hash = portfolio.compute_hash()
        
        return portfolio
    
    def delete_portfolio(self, portfolio_id: str) -> bool:
        """Delete a portfolio"""
        if portfolio_id in self._portfolios:
            del self._portfolios[portfolio_id]
            return True
        return False
    
    def add_position(
        self,
        portfolio_id: str,
        request: PositionCreateRequest
    ) -> Optional[Portfolio]:
        """Add or update a position in a portfolio"""
        portfolio = self._portfolios.get(portfolio_id)
        if not portfolio:
            return None
        
        # Check if position already exists
        existing = next(
            (p for p in portfolio.positions if p.symbol == request.symbol),
            None
        )
        
        if existing:
            # Update existing position (simple averaging for DEMO)
            total_qty = existing.quantity + request.quantity
            if total_qty != 0:
                # Weighted average cost basis
                total_cost = (
                    existing.quantity * existing.average_cost_basis +
                    request.quantity * request.cost_basis_per_unit
                )
                existing.average_cost_basis = total_cost / total_qty
                existing.quantity = total_qty
            else:
                # Position closed, remove it
                portfolio.positions = [
                    p for p in portfolio.positions if p.symbol != request.symbol
                ]
        else:
            # Create new position
            acquisition_date = request.acquisition_date or date.today()
            
            lot = Lot(
                lot_id=self._generate_id("LOT"),
                symbol=request.symbol,
                quantity=abs(request.quantity),
                acquisition_date=acquisition_date,
                cost_basis_per_unit=request.cost_basis_per_unit,
                remaining_quantity=abs(request.quantity)
            )
            
            position = Position(
                symbol=request.symbol,
                quantity=request.quantity,
                average_cost_basis=request.cost_basis_per_unit,
                current_price=None,
                lots=[lot]
            )
            
            portfolio.positions.append(position)
        
        portfolio.updated_at = datetime.utcnow()
        portfolio.content_hash = portfolio.compute_hash()
        
        return portfolio
    
    def clear(self):
        """Clear all portfolios (for testing)"""
        self._portfolios.clear()
        self._id_counter = 0


# Global store instance for DEMO mode
_demo_store: Optional[PortfolioStore] = None


def get_demo_store() -> PortfolioStore:
    """Get or create the global DEMO store"""
    global _demo_store
    if _demo_store is None:
        _demo_store = PortfolioStore(seed=42)
    return _demo_store


def reset_demo_store():
    """Reset the DEMO store (for testing)"""
    global _demo_store
    _demo_store = None
