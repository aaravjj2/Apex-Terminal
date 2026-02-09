"""
AI Options Autopilot - Unified Trading System

This module implements a fully automated options trading system.
Alpaca paper trading is the source of truth for positions and orders.

Architecture (v2):
- unified_engine: The ONLY autopilot execution path (replaces runloop)
- broker_position_manager: Position management with Alpaca as truth
- news_provider: News/sentiment from Finnhub + yfinance
- unified_router: The ONLY API router for autopilot

Legacy (deprecated - DO NOT USE):
- runloop: Old orchestration loop - REPLACED by unified_engine
- unified_cycle: Intermediate implementation - REPLACED by unified_engine

Active Components:
- config: Autopilot configuration and budget management
- universe: Liquid options universe management
- features: Market feature computation (regime, IV, liquidity)
- candidates: Deterministic trade candidate generation
- selector: Ranking/selection interface (deterministic + LLM)
- validator: Hard risk rule enforcement
- paper_broker: Paper trade execution simulation
- position_manager: Options position ledger with Greeks
- monitor: Exit monitoring and risk management
- reporting: Daily P&L and attribution reports
"""

from .config import (
    AutopilotConfig,
    AutopilotMode,
    StrategyTemplate,
    RiskLimits,
    StrategyConstraints,
    EarningsPolicy,
    ForecastSettings,
    LLMSettings,
)
from .universe import UniverseManager, UniverseSymbol, LiquidityFilter
from .features import (
    FeatureEngine,
    SymbolFeatures,
    TrendDirection,
    VolatilityRegime,
    PriceForecast,
)
from .candidates import (
    CandidateGenerator,
    TradeCandidate,
    OptionLeg,
    CandidateStatus,
)
from .selector import (
    CandidateSelector,
    DeterministicRanker,
    LLMRanker,
    SelectionResult,
    create_selector,
)
from .validator import (
    TradeValidator,
    ValidationResult,
    BatchValidationResult,
    RejectionCode,
)
from .paper_broker import (
    PaperBroker,
    PaperOrder,
    PaperFill,
    OrderStatus,
    OrderType,
    FillMetrics,
)
from .position_manager import (
    PositionManager,
    OptionsPosition,
    PositionStatus,
    PositionGreeks,
    PortfolioState,
)
from .monitor import (
    PositionMonitor,
    ExitSignal,
    ExitReason,
    RiskAlert,
    MonitoringResult,
)
from .reporting import (
    ReportGenerator,
    DailyReport,
    TemplateAttribution,
    SymbolAttribution,
    RunCycleLog,
    ActivityLogger,
)
from .trade_stream import (
    TradeUpdateType,
    TradeUpdate,
    AlpacaTradeStream,
    TradeUpdateHandler,
    get_trade_handler,
)
from .news_sentiment import (
    NewsCategory,
    SentimentBucket,
    RecencyBucket,
    NewsArticle,
    SentimentScore,
    FinnhubNewsProvider,
    SentimentEngine,
    get_news_provider,
    get_sentiment_engine,
)

# NEW UNIFIED SYSTEM (v2)
from .unified_engine import (
    UnifiedAutopilotEngine,
    get_unified_engine,
    RunArtifact,
    CyclePhase as UnifiedCyclePhase,
    ExitReason,
    ValidationGate,
)
from .broker_position_manager import (
    BrokerPositionManager,
    get_broker_position_manager,
    BrokerExitRule,
    BrokerPositionMeta,
    EnrichedBrokerPosition,
    ExitTrigger,
    BrokerExitSignal,
)
from .news_provider import (
    NewsProvider,
    get_news_provider as get_news_provider_v2,
    NewsItem,
    SentimentSnapshot,
    MarketSentiment,
)
from .unified_router import router as unified_autopilot_router

__all__ = [
    # Config
    'AutopilotConfig',
    'AutopilotMode',
    'StrategyTemplate',
    'RiskLimits',
    'StrategyConstraints',
    'EarningsPolicy',
    'ForecastSettings',
    'LLMSettings',
    # Universe
    'UniverseManager',
    'UniverseSymbol',
    'LiquidityFilter',
    # Features
    'FeatureEngine',
    'SymbolFeatures',
    'TrendDirection',
    'VolatilityRegime',
    'PriceForecast',
    # Candidates
    'CandidateGenerator',
    'TradeCandidate',
    'OptionLeg',
    'CandidateStatus',
    # Selector
    'CandidateSelector',
    'DeterministicRanker',
    'LLMRanker',
    'SelectionResult',
    'create_selector',
    # Validator
    'TradeValidator',
    'ValidationResult',
    'BatchValidationResult',
    'RejectionCode',
    # Paper Broker
    'PaperBroker',
    'PaperOrder',
    'PaperFill',
    'OrderStatus',
    'OrderType',
    'FillMetrics',
    # Position Manager
    'PositionManager',
    'OptionsPosition',
    'PositionStatus',
    'PositionGreeks',
    'PortfolioState',
    # Monitor
    'PositionMonitor',
    'ExitSignal',
    'ExitReason',
    'RiskAlert',
    'MonitoringResult',
    # Reporting
    'ReportGenerator',
    'DailyReport',
    'TemplateAttribution',
    'SymbolAttribution',
    'RunCycleLog',
    'ActivityLogger',
    # Trade Stream
    'TradeUpdateType',
    'TradeUpdate',
    'AlpacaTradeStream',
    'TradeUpdateHandler',
    'get_trade_handler',
    # News Sentiment
    'NewsCategory',
    'SentimentBucket',
    'RecencyBucket',
    'NewsArticle',
    'SentimentScore',
    'FinnhubNewsProvider',
    'SentimentEngine',
    'get_news_provider',
    'get_sentiment_engine',
    # NEW UNIFIED SYSTEM (v2)
    'UnifiedAutopilotEngine',
    'get_unified_engine',
    'RunArtifact',
    'UnifiedCyclePhase',
    'ExitReason',
    'ValidationGate',
    'BrokerPositionManager',
    'get_broker_position_manager',
    'BrokerExitRule',
    'BrokerPositionMeta',
    'EnrichedBrokerPosition',
    'ExitTrigger',
    'BrokerExitSignal',
    'NewsProvider',
    'get_news_provider_v2',
    'NewsItem',
    'SentimentSnapshot',
    'MarketSentiment',
    'unified_autopilot_router',
]
