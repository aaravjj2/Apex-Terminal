"""
Portfolio Management Schemas (v1.19)
Pydantic v2 models for portfolio CRUD with deterministic content hashing.
"""

from __future__ import annotations
from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import datetime, date
from decimal import Decimal
import hashlib
import json


# Schema version for portfolio format evolution
PORTFOLIO_SCHEMA_VERSION = "1.0.0"


def compute_content_hash(obj: dict, exclude_keys: Optional[List[str]] = None) -> str:
    """
    Compute deterministic SHA256 content hash from canonical JSON.
    
    Args:
        obj: Dictionary to hash
        exclude_keys: Keys to exclude from hash computation (e.g., 'content_hash', 'id')
    
    Returns:
        Hex-encoded SHA256 hash
    """
    # Remove excluded keys
    if exclude_keys:
        obj = {k: v for k, v in obj.items() if k not in exclude_keys}
    
    # Canonicalize: sort keys, stable float formatting
    canonical = json.dumps(obj, sort_keys=True, default=str)
    return hashlib.sha256(canonical.encode('utf-8')).hexdigest()


class Lot(BaseModel):
    """
    A lot represents a specific acquisition of securities.
    Used for tax lot tracking and FIFO/LIFO accounting.
    """
    lot_id: str = Field(..., description="Unique lot identifier")
    symbol: str = Field(..., description="Security symbol")
    quantity: Decimal = Field(..., description="Quantity in this lot (must be positive)")
    acquisition_date: date = Field(..., description="Date the lot was acquired")
    cost_basis_per_unit: Decimal = Field(..., description="Cost basis per unit in portfolio currency")
    remaining_quantity: Decimal = Field(..., description="Remaining quantity not yet sold")
    
    @field_validator('quantity', 'remaining_quantity')
    @classmethod
    def must_be_positive(cls, v):
        if v <= 0:
            raise ValueError("Quantity must be positive")
        return v
    
    @field_validator('remaining_quantity')
    @classmethod
    def remaining_not_exceed_original(cls, v, info):
        if 'quantity' in info.data and v > info.data['quantity']:
            raise ValueError("Remaining quantity cannot exceed original quantity")
        return v
    
    model_config = {
        "json_schema_extra": {
            "example": {
                "lot_id": "LOT-001",
                "symbol": "AAPL",
                "quantity": "100.00",
                "acquisition_date": "2024-01-15",
                "cost_basis_per_unit": "150.25",
                "remaining_quantity": "100.00"
            }
        }
    }


class Position(BaseModel):
    """
    A position represents the aggregated holding of a security.
    Multiple lots may contribute to a single position.
    """
    symbol: str = Field(..., description="Security symbol")
    quantity: Decimal = Field(..., description="Total quantity (positive for long, negative for short)")
    average_cost_basis: Decimal = Field(..., description="Weighted average cost basis per unit")
    current_price: Optional[Decimal] = Field(None, description="Current market price (for valuation)")
    lots: List[Lot] = Field(default_factory=list, description="Individual lots comprising this position")
    
    def compute_market_value(self) -> Optional[Decimal]:
        """Compute market value if current_price is available"""
        if self.current_price is not None:
            return self.quantity * self.current_price
        return None
    
    def compute_unrealized_pnl(self) -> Optional[Decimal]:
        """Compute unrealized P&L if current_price is available"""
        if self.current_price is not None:
            return (self.current_price - self.average_cost_basis) * self.quantity
        return None
    
    model_config = {
        "json_schema_extra": {
            "example": {
                "symbol": "AAPL",
                "quantity": "100.00",
                "average_cost_basis": "150.25",
                "current_price": "175.50",
                "lots": []
            }
        }
    }


class PositionValuation(BaseModel):
    """Valuation details for a single position"""
    symbol: str
    quantity: Decimal
    cost_basis: Decimal
    current_price: Decimal
    market_value: Decimal
    unrealized_pnl: Decimal
    
    model_config = {"json_schema_extra": {"example": {"symbol": "AAPL", "quantity": "100", "cost_basis": "150.00", "current_price": "175.50", "market_value": "17550.00", "unrealized_pnl": "2550.00"}}}


class ValuationInputs(BaseModel):
    """Inputs used for valuation calculation (for determinism verification)"""
    pricing_source: str = Field(..., description="Source of pricing data (e.g., 'demo-bars:last-close')")
    source_checksum: str = Field(..., description="Checksum of the pricing source fixture")
    rounding_policy: str = Field(default="0.01", description="Decimal rounding policy")
    as_of: datetime = Field(..., description="Timestamp used for valuation (from fixture data)")
    
    model_config = {"json_schema_extra": {"example": {"pricing_source": "demo-bars:last-close", "source_checksum": "abc123...", "rounding_policy": "0.01", "as_of": "2024-01-15T16:00:00Z"}}}


class ValuationSnapshot(BaseModel):
    """
    Point-in-time valuation snapshot of a portfolio (v1.21 deterministic).
    Includes net value, total PnL, and per-position details.
    """
    snapshot_id: str = Field(..., description="Unique snapshot identifier")
    portfolio_id: str = Field(..., description="Portfolio this snapshot belongs to")
    as_of: datetime = Field(..., description="Valuation timestamp (from fixture data, not wall clock)")
    net_value: Decimal = Field(..., description="Total net value (cash + positions market value)")
    pnl_total: Decimal = Field(..., description="Total unrealized P&L")
    cash_balance: Decimal = Field(..., description="Cash balance")
    positions_market_value: Decimal = Field(..., description="Total market value of positions")
    per_position: List[PositionValuation] = Field(default_factory=list, description="Per-position valuation details (stable ordering)")
    valuation_inputs: ValuationInputs = Field(..., description="Inputs used for this valuation")
    
    # Schema version for format evolution
    schema_version: str = Field(default=PORTFOLIO_SCHEMA_VERSION, description="Schema version")
    
    # Content hash for integrity verification
    content_hash: Optional[str] = Field(None, description="SHA256 hash of canonical snapshot content")
    
    def compute_hash(self) -> str:
        """Compute content hash excluding hash field itself"""
        data = self.model_dump()
        return compute_content_hash(data, exclude_keys=['content_hash'])
    
    model_config = {
        "json_schema_extra": {
            "example": {
                "snapshot_id": "SNAP-001",
                "portfolio_id": "PORT-001",
                "timestamp": "2024-02-12T10:30:00Z",
                "total_market_value": "17550.00",
                "cash_balance": "5000.00",
                "total_cost_basis": "15025.00",
                "unrealized_pnl": "2525.00",
                "positions_snapshot": [],
                "schema_version": "1.0.0",
                "content_hash": "abc123..."
            }
        }
    }


class Portfolio(BaseModel):
    """
    A portfolio is a collection of positions and cash.
    This is the primary domain object for portfolio management.
    """
    portfolio_id: str = Field(..., description="Unique portfolio identifier")
    name: str = Field(..., description="Portfolio name")
    currency: str = Field(default="USD", description="Base currency for the portfolio")
    cash_balance: Decimal = Field(default=Decimal("0.00"), description="Current cash balance")
    positions: List[Position] = Field(default_factory=list, description="List of positions in the portfolio")
    
    created_at: datetime = Field(default_factory=datetime.utcnow, description="Portfolio creation timestamp")
    updated_at: datetime = Field(default_factory=datetime.utcnow, description="Last update timestamp")
    
    # Schema version for format evolution
    schema_version: str = Field(default=PORTFOLIO_SCHEMA_VERSION, description="Schema version")
    
    # Content hash for integrity verification
    content_hash: Optional[str] = Field(None, description="SHA256 hash of canonical portfolio content")
    
    def compute_hash(self) -> str:
        """Compute content hash excluding hash, timestamps, and id fields"""
        data = self.model_dump()
        return compute_content_hash(
            data, 
            exclude_keys=['content_hash', 'portfolio_id', 'created_at', 'updated_at']
        )
    
    def compute_total_market_value(self) -> Decimal:
        """Compute total market value of all positions + cash"""
        positions_value = sum(
            (pos.compute_market_value() or Decimal("0.00"))
            for pos in self.positions
        )
        return positions_value + self.cash_balance
    
    def compute_total_cost_basis(self) -> Decimal:
        """Compute total cost basis of all positions"""
        return sum(
            pos.quantity * pos.average_cost_basis
            for pos in self.positions
        )
    
    def compute_unrealized_pnl(self) -> Decimal:
        """Compute total unrealized P&L"""
        return sum(
            (pos.compute_unrealized_pnl() or Decimal("0.00"))
            for pos in self.positions
        )
    
    @field_validator('currency')
    @classmethod
    def currency_must_be_valid(cls, v):
        # Simple validation - expand as needed
        valid_currencies = ["USD", "EUR", "GBP", "CAD", "JPY"]
        if v not in valid_currencies:
            raise ValueError(f"Currency must be one of {valid_currencies}")
        return v
    
    model_config = {
        "json_schema_extra": {
            "example": {
                "portfolio_id": "PORT-001",
                "name": "My Growth Portfolio",
                "currency": "USD",
                "cash_balance": "5000.00",
                "positions": [],
                "created_at": "2024-02-12T10:00:00Z",
                "updated_at": "2024-02-12T10:30:00Z",
                "schema_version": "1.0.0",
                "content_hash": "abc123..."
            }
        }
    }


# Request/Response models for API

class PortfolioCreateRequest(BaseModel):
    """Request to create a new portfolio"""
    name: str = Field(..., min_length=1, max_length=100, description="Portfolio name")
    currency: str = Field(default="USD", description="Base currency")
    initial_cash: Decimal = Field(default=Decimal("0.00"), ge=0, description="Initial cash balance")


class PortfolioUpdateRequest(BaseModel):
    """Request to update portfolio metadata"""
    name: Optional[str] = Field(None, min_length=1, max_length=100, description="Portfolio name")
    currency: Optional[str] = Field(None, description="Base currency")


class PositionCreateRequest(BaseModel):
    """Request to add a position to a portfolio"""
    symbol: str = Field(..., min_length=1, description="Security symbol")
    quantity: Decimal = Field(..., description="Quantity (positive for long, negative for short)")
    cost_basis_per_unit: Decimal = Field(..., ge=0, description="Cost basis per unit")
    acquisition_date: Optional[date] = Field(None, description="Acquisition date (defaults to today)")


class PortfolioListResponse(BaseModel):
    """Response for listing portfolios"""
    portfolios: List[Portfolio] = Field(default_factory=list)
    total_count: int = Field(default=0, description="Total number of portfolios")


class PortfolioExport(BaseModel):
    """Canonical export format for determinism verification"""
    portfolio: Portfolio
    export_timestamp: datetime = Field(default_factory=datetime.utcnow)
    schema_version: str = Field(default=PORTFOLIO_SCHEMA_VERSION)
    export_hash: Optional[str] = Field(None, description="Hash of the exported content")
    
    def compute_export_hash(self) -> str:
        """Compute hash of export excluding the hash field"""
        data = self.model_dump()
        return compute_content_hash(data, exclude_keys=['export_hash', 'export_timestamp'])


class PortfolioImportRequest(BaseModel):
    """
    v1.23: Request to import a portfolio from canonical format.
    Accepts the same structure as PortfolioExport and validates schema version.
    """
    portfolio: Portfolio
    schema_version: str = Field(default=PORTFOLIO_SCHEMA_VERSION)
    export_hash: Optional[str] = Field(None, description="Hash from the export (verified on import)")

    @field_validator('schema_version')
    @classmethod
    def schema_version_must_be_compatible(cls, v: str) -> str:
        # Accept 1.x.x versions
        parts = v.split('.')
        if len(parts) != 3 or parts[0] != '1':
            raise ValueError(f"Incompatible schema version: {v}")
        return v
