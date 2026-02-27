"""
Backtest Engine - Deterministic backtesting for strategies
"""

__all__ = ["models", "engine", "storage", "fixtures"]

# Re-export Bloomberg-grade backtesting classes from the standalone engine
try:
    from phase1.backtest_engine import (
        BacktestEngine,
        BacktestResult,
        BacktestMetrics,
        Trade,
        MovingAverageCrossStrategy,
        RSIMeanReversionStrategy,
        BollingerBandStrategy,
        BreakoutStrategy,
        FixedCommission,
        PerShareCommission,
        PercentageCommission,
        TieredCommission,
        FixedSlippage,
        VolumeSlippage,
        FixedFractional,
        ATRSizer,
        KellyCriterion,
        walk_forward_optimize,
        monte_carlo_backtest,
        generate_tearsheet,
    )
    __all__ += [
        "BacktestEngine", "BacktestResult", "BacktestMetrics", "Trade",
        "MovingAverageCrossStrategy", "RSIMeanReversionStrategy",
        "BollingerBandStrategy", "BreakoutStrategy",
        "FixedCommission", "PerShareCommission", "PercentageCommission", "TieredCommission",
        "FixedSlippage", "VolumeSlippage",
        "FixedFractional", "ATRSizer", "KellyCriterion",
        "walk_forward_optimize", "monte_carlo_backtest", "generate_tearsheet",
    ]
except ImportError:
    pass
