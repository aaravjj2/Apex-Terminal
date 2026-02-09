"""
Strategy validation logic
"""

from .models import StrategyDefinition, ValidationResult, ValidationError
from typing import List


def validate_strategy(strategy: StrategyDefinition) -> ValidationResult:
    """
    Validate a strategy definition.
    Returns ValidationResult with errors and warnings.
    """
    errors: List[ValidationError] = []
    warnings: List[ValidationError] = []
    
    # Check strategy type is set
    if not strategy.strategy_type:
        errors.append(ValidationError(
            field="strategy_type",
            message="Strategy type is required"
        ))
    
    # Check name is not empty
    if not strategy.name or len(strategy.name.strip()) == 0:
        errors.append(ValidationError(
            field="name",
            message="Strategy name cannot be empty"
        ))
    
    # For crossover strategies, ensure at least 2 indicators
    if strategy.strategy_type == "crossover":
        if len(strategy.indicators) < 2:
            errors.append(ValidationError(
                field="indicators",
                message="Crossover strategies require at least 2 indicators"
            ))
    
    # For signal strategies, check that indicators are referenced in conditions
    if strategy.strategy_type == "signal":
        if not strategy.indicators:
            warnings.append(ValidationError(
                field="indicators",
                message="Signal strategy has no indicators defined"
            ))
        
        if not strategy.entry_condition:
            warnings.append(ValidationError(
                field="entry_condition",
                message="Signal strategy should have entry condition"
            ))
    
    # Check stop loss and take profit are reasonable
    if strategy.stop_loss_pct is not None and strategy.stop_loss_pct > 50:
        warnings.append(ValidationError(
            field="stop_loss_pct",
            message=f"Stop loss of {strategy.stop_loss_pct}% is very large"
        ))
    
    if strategy.take_profit_pct is not None and strategy.take_profit_pct < 1:
        warnings.append(ValidationError(
            field="take_profit_pct",
            message=f"Take profit of {strategy.take_profit_pct}% is very small"
        ))
    
    return ValidationResult(
        valid=len(errors) == 0,
        errors=errors,
        warnings=warnings
    )
