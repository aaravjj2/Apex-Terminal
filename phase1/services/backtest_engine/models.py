"""
Backtest Engine Domain Models
"""

from pydantic import BaseModel, Field
from typing import Dict, List, Optional, Any
from datetime import datetime, date
from enum import Enum


class BacktestStatus(str, Enum):
    """Backtest run status"""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class Side(str, Enum):
    """Trade side"""
    BUY = "buy"
    SELL = "sell"


class BacktestConfig(BaseModel):
    """Backtest configuration"""
    strategy_id: str
    symbol: str = Field(..., description="Symbol to backtest (e.g., SPY, AAPL)")
    start_date: date
    end_date: date
    initial_capital: float = Field(default=100000.0, gt=0)
    slippage_bps: float = Field(default=5.0, ge=0, description="Slippage in basis points")
    fee_per_trade: float = Field(default=1.0, ge=0, description="Fee per trade")
    seed: int = Field(default=42, description="Random seed for determinism")
    
    class Config:
        json_schema_extra = {
            "example": {
                "strategy_id": "demo-sma-crossover",
                "symbol": "SPY",
                "start_date": "2023-01-01",
                "end_date": "2023-12-31",
                "initial_capital": 100000.0,
                "slippage_bps": 5.0,
                "fee_per_trade": 1.0,
                "seed": 42
            }
        }


class TradeFill(BaseModel):
    """Individual trade fill"""
    trade_id: str
    timestamp: datetime
    symbol: str
    side: Side
    quantity: float
    price: float
    fees: float
    pnl: Optional[float] = None  # Only for exit trades
    
    class Config:
        json_schema_extra = {
            "example": {
                "trade_id": "trade-001",
                "timestamp": "2023-03-15T14:30:00Z",
                "symbol": "SPY",
                "side": "buy",
                "quantity": 100.0,
                "price": 385.50,
                "fees": 1.0
            }
        }


class BacktestMetrics(BaseModel):
    """Backtest performance metrics"""
    total_return_pct: float
    cagr_pct: float
    max_drawdown_pct: float
    sharpe_ratio: float
    win_rate_pct: float
    total_trades: int
    winning_trades: int
    losing_trades: int
    avg_win: float
    avg_loss: float
    profit_factor: float
    final_equity: float
    
    class Config:
        json_schema_extra = {
            "example": {
                "total_return_pct": 15.3,
                "cagr_pct": 15.1,
                "max_drawdown_pct": -8.2,
                "sharpe_ratio": 1.45,
                "win_rate_pct": 58.3,
                "total_trades": 24,
                "winning_trades": 14,
                "losing_trades": 10,
                "avg_win": 850.0,
                "avg_loss": -420.0,
                "profit_factor": 2.02,
                "final_equity": 115300.0
            }
        }


class EquityPoint(BaseModel):
    """Single point in equity curve"""
    timestamp: datetime
    equity: float


class BacktestRun(BaseModel):
    """Complete backtest run with results"""
    run_id: str
    config: BacktestConfig
    status: BacktestStatus
    
    # Results
    trades: List[TradeFill] = Field(default_factory=list)
    equity_curve: List[EquityPoint] = Field(default_factory=list)
    metrics: Optional[BacktestMetrics] = None
    
    # Determinism
    config_hash: str = Field(..., description="Hash of config for reproducibility")
    
    # Metadata
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error: Optional[str] = None
    
    class Config:
        json_schema_extra = {
            "example": {
                "run_id": "run-abc123",
                "status": "completed",
                "config_hash": "sha256:abc123...",
                "started_at": "2024-01-01T10:00:00Z",
                "completed_at": "2024-01-01T10:00:05Z"
            }
        }


class CompareResult(BaseModel):
    """Result of comparing two backtest runs"""
    run_id_a: str
    run_id_b: str
    metrics_a: BacktestMetrics
    metrics_b: BacktestMetrics
    delta: Dict[str, float]  # Metric name -> difference
