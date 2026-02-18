"""
Options Service Package
"""

from .models import (
    OptionType,
    PositionType,
    Greeks,
    OptionContract,
    OptionChain,
    IVAnalytics,
    VolatilitySkew,
    TermStructure,
    StrategyLeg,
    StrategyAnalysis,
    PutCallRatio,
)

from .greeks import (
    BlackScholesCalculator,
    GreeksResult,
    calculate_greeks,
    implied_volatility,
)

from .iv_analytics import (
    IVAnalyticsCalculator,
    VolatilitySkewCalculator,
    TermStructureCalculator,
    calculate_iv_analytics,
)

from .adapter import (
    OptionsDataAdapter,
    get_options_adapter,
)

from .strategy_factory import (
    StrategyFactory,
    StrategyTemplate,
    STRATEGY_TEMPLATES,
    get_strategy_factory,
)

__all__ = [
    # Models
    "OptionType",
    "PositionType",
    "Greeks",
    "OptionContract",
    "OptionChain",
    "IVAnalytics",
    "VolatilitySkew",
    "TermStructure",
    "StrategyLeg",
    "StrategyAnalysis",
    "PutCallRatio",
    # Greeks
    "BlackScholesCalculator",
    "GreeksResult",
    "calculate_greeks",
    "implied_volatility",
    # IV Analytics
    "IVAnalyticsCalculator",
    "VolatilitySkewCalculator",
    "TermStructureCalculator",
    "calculate_iv_analytics",
    # Adapter
    "OptionsDataAdapter",
    "get_options_adapter",
    # Strategy Factory
    "StrategyFactory",
    "StrategyTemplate",
    "STRATEGY_TEMPLATES",
    "get_strategy_factory",
]
