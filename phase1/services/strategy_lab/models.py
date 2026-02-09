"""
Strategy Lab Domain Models
"""

from pydantic import BaseModel, Field
from typing import Dict, List, Optional, Any, Literal
from datetime import datetime
from enum import Enum


class StrategyType(str, Enum):
    """Strategy types supported in v1"""
    SIGNAL = "signal"          # Signal-based strategy (indicators)
    CROSSOVER = "crossover"    # MA crossover
    MEAN_REVERSION = "mean_reversion"
    BREAKOUT = "breakout"


class IndicatorConfig(BaseModel):
    """Indicator configuration"""
    type: str = Field(..., description="Indicator type (SMA, EMA, RSI, etc.)")
    params: Dict[str, Any] = Field(default_factory=dict)
    
    class Config:
        json_schema_extra = {
            "example": {"type": "SMA", "params": {"period": 20}}
        }


class SignalCondition(BaseModel):
    """Signal condition for strategy"""
    condition_type: Literal["above", "below", "cross_above", "cross_below", "between"]
    indicator: str
    reference: Optional[float] = None
    reference_indicator: Optional[str] = None
    
    class Config:
        json_schema_extra = {
            "example": {"condition_type": "cross_above", "indicator": "price", "reference_indicator": "SMA_20"}
        }


class StrategyDefinition(BaseModel):
    """Complete strategy definition"""
    id: Optional[str] = None
    name: str = Field(..., min_length=1, max_length=100, description="Strategy name")
    description: Optional[str] = None
    strategy_type: StrategyType
    
    # Indicators used
    indicators: List[IndicatorConfig] = Field(default_factory=list)
    
    # Entry/Exit conditions
    entry_condition: Optional[SignalCondition] = None
    exit_condition: Optional[SignalCondition] = None
    
    # Risk management (v1 simple)
    stop_loss_pct: Optional[float] = Field(None, ge=0, le=100)
    take_profit_pct: Optional[float] = Field(None, ge=0, le=1000)
    
    # Metadata
    tags: List[str] = Field(default_factory=list)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    class Config:
        json_schema_extra = {
            "example": {
                "name": "SMA Crossover 20/50",
                "description": "Buy when SMA20 crosses above SMA50",
                "strategy_type": "crossover",
                "indicators": [
                    {"type": "SMA", "params": {"period": 20}},
                    {"type": "SMA", "params": {"period": 50}}
                ],
                "entry_condition": {
                    "condition_type": "cross_above",
                    "indicator": "SMA_20",
                    "reference_indicator": "SMA_50"
                },
                "exit_condition": {
                    "condition_type": "cross_below",
                    "indicator": "SMA_20",
                    "reference_indicator": "SMA_50"
                },
                "stop_loss_pct": 2.0,
                "tags": ["momentum", "trend"]
            }
        }


class ValidationError(BaseModel):
    """Strategy validation error"""
    field: str
    message: str
    line: Optional[int] = None


class ValidationResult(BaseModel):
    """Strategy validation result"""
    valid: bool
    errors: List[ValidationError] = Field(default_factory=list)
    warnings: List[ValidationError] = Field(default_factory=list)
