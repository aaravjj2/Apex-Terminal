"""
Financial Intelligence API Routes

Provides endpoints for:
- Portfolio analytics and metrics
- AI insights and recommendations
- Risk assessment
- Multi-agent finance analysis
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import random

router = APIRouter(prefix="/intelligence", tags=["Financial Intelligence"])


# Models
class PortfolioMetrics(BaseModel):
    total_equity: float
    total_cash: float
    buying_power: float
    open_pnl: float
    day_pnl: float
    realized_pnl: float
    position_count: int
    win_rate: float
    avg_return: float
    sharpe_ratio: float
    max_drawdown: float
    options_exposure: float


class RiskMetrics(BaseModel):
    overall_score: int  # 1-10
    market_risk: int
    execution_risk: int
    concentration_risk: int
    volatility_exposure: int
    recommendations: List[str]


class MarketSentiment(BaseModel):
    overall: str  # bullish, neutral, bearish
    score: float  # -1 to 1
    news_velocity: str  # low, normal, high
    vix_level: float
    trend_strength: float
    key_events: List[str]


class AIInsight(BaseModel):
    id: str
    type: str  # opportunity, warning, info, action
    title: str
    description: str
    confidence: float
    timestamp: str
    symbol: Optional[str] = None


class StockAnalysis(BaseModel):
    symbol: str
    price: float
    change: float
    change_pct: float
    recommendation: str
    target_price: float
    analyst_count: int
    news_sentiment: float
    technical_score: float
    fundamental_score: float


class AnalysisRequest(BaseModel):
    query: str
    symbols: Optional[List[str]] = None


class AnalysisResponse(BaseModel):
    summary: str
    analyses: List[StockAnalysis]
    insights: List[AIInsight]
    agent_actions: List[Dict[str, Any]]


# Routes
@router.get("/metrics", response_model=PortfolioMetrics)
async def get_portfolio_metrics():
    """Get comprehensive portfolio metrics."""
    # In production, this would pull from actual portfolio data
    return PortfolioMetrics(
        total_equity=1000.0,
        total_cash=250.0,
        buying_power=500.0,
        open_pnl=-13.0,
        day_pnl=-8.0,
        realized_pnl=45.0,
        position_count=2,
        win_rate=0.65,
        avg_return=0.032,
        sharpe_ratio=1.2,
        max_drawdown=-0.05,
        options_exposure=750.0
    )


@router.get("/risk", response_model=RiskMetrics)
async def get_risk_metrics():
    """Get current risk assessment."""
    return RiskMetrics(
        overall_score=4,
        market_risk=3,
        execution_risk=2,
        concentration_risk=5,
        volatility_exposure=4,
        recommendations=[
            "Consider diversifying across more underlyings",
            "Monitor VIX for volatility expansion",
            "Set tighter stops for high-DTE options"
        ]
    )


@router.get("/sentiment", response_model=MarketSentiment)
async def get_market_sentiment():
    """Get current market sentiment analysis."""
    # In production, aggregate from multiple data sources
    return MarketSentiment(
        overall="neutral",
        score=0.15,
        news_velocity="normal",
        vix_level=18.5,
        trend_strength=0.3,
        key_events=[
            "FOMC meeting in 2 days",
            "Tech earnings season starting",
            "Jobs report next week"
        ]
    )


@router.get("/insights", response_model=List[AIInsight])
async def get_ai_insights():
    """Get AI-generated insights and recommendations."""
    return [
        AIInsight(
            id="1",
            type="opportunity",
            title="AAPL shows bullish divergence",
            description="RSI divergence detected with price action. Consider long call strategy.",
            confidence=0.78,
            timestamp=datetime.utcnow().isoformat(),
            symbol="AAPL"
        ),
        AIInsight(
            id="2",
            type="warning",
            title="High concentration in tech sector",
            description="80% of positions are in technology. Consider hedging with sector rotation.",
            confidence=0.92,
            timestamp=(datetime.utcnow() - timedelta(minutes=5)).isoformat()
        ),
        AIInsight(
            id="3",
            type="info",
            title="FOMC meeting in 2 days",
            description="Expect increased volatility. IV expansion likely across all underlyings.",
            confidence=0.95,
            timestamp=(datetime.utcnow() - timedelta(minutes=10)).isoformat()
        )
    ]


@router.post("/analyze", response_model=AnalysisResponse)
async def run_multi_agent_analysis(request: AnalysisRequest):
    """Run multi-agent financial analysis on symbols."""
    symbols = request.symbols or ["AAPL"]
    
    # Simulate multi-agent analysis
    analyses = []
    for symbol in symbols[:4]:  # Limit to 4 symbols
        analyses.append(StockAnalysis(
            symbol=symbol,
            price=150.0 + random.random() * 200,
            change=(random.random() - 0.5) * 10,
            change_pct=(random.random() - 0.5) * 5,
            recommendation=random.choice(["strong_buy", "buy", "hold", "sell"]),
            target_price=160.0 + random.random() * 200,
            analyst_count=int(10 + random.random() * 30),
            news_sentiment=(random.random() - 0.5) * 2,
            technical_score=random.random(),
            fundamental_score=random.random()
        ))
    
    # Generate insights based on analysis
    insights = [
        AIInsight(
            id="a1",
            type="opportunity" if analyses[0].recommendation in ["buy", "strong_buy"] else "info",
            title=f"{symbols[0]} Analysis Complete",
            description=f"Technical score: {analyses[0].technical_score:.0%}, Fundamental: {analyses[0].fundamental_score:.0%}",
            confidence=0.75 + random.random() * 0.2,
            timestamp=datetime.utcnow().isoformat(),
            symbol=symbols[0]
        )
    ]
    
    # Agent actions log
    agent_actions = [
        {"agent": "market-analyst", "status": "completed", "task": "Analyzed market conditions"},
        {"agent": "stock-researcher", "status": "completed", "task": f"Researched {', '.join(symbols)}"},
        {"agent": "sentiment-analyzer", "status": "completed", "task": "Scanned news & sentiment"},
        {"agent": "risk-assessor", "status": "completed", "task": "Evaluated risk factors"}
    ]
    
    # Generate summary
    positive_count = len([a for a in analyses if a.recommendation in ["buy", "strong_buy"]])
    summary = f"""
**Analysis Complete** 🎯

Our multi-agent team has analyzed {', '.join(symbols)}:

**Key Findings:**
- {positive_count} out of {len(analyses)} stocks have BUY or STRONG BUY ratings
- Average analyst target suggests significant upside potential
- News sentiment is {'predominantly positive' if sum(a.news_sentiment for a in analyses) > 0 else 'mixed'}

**Top Pick:** {max(analyses, key=lambda a: a.technical_score + a.fundamental_score).symbol} shows the strongest combined technical and fundamental signals.
    """.strip()
    
    return AnalysisResponse(
        summary=summary,
        analyses=analyses,
        insights=insights,
        agent_actions=agent_actions
    )


@router.get("/pnl-history")
async def get_pnl_history(timeframe: str = "1W"):
    """Get P&L history data for charting."""
    num_points = {"1D": 24, "1W": 7, "1M": 30, "ALL": 90}.get(timeframe, 7)
    
    labels = []
    values = []
    cumulative = []
    running_total = 0
    
    for i in range(num_points):
        daily_pnl = (random.random() - 0.45) * 50
        running_total += daily_pnl
        
        if timeframe == "1D":
            labels.append(f"{i}:00")
        else:
            date = datetime.utcnow() - timedelta(days=num_points - i)
            labels.append(date.strftime("%b %d"))
        
        values.append(daily_pnl)
        cumulative.append(running_total)
    
    return {
        "labels": labels,
        "values": values,
        "cumulative": cumulative
    }


@router.get("/trade-history")
async def get_trade_history(limit: int = 20):
    """Get recent trade history with P&L."""
    trades = []
    for i in range(limit):
        is_win = random.random() > 0.4
        pnl = (random.random() * 100 + 20) if is_win else -(random.random() * 60 + 10)
        
        trades.append({
            "id": f"trade-{i}",
            "symbol": random.choice(["AAPL", "NVDA", "GOOGL", "SPY", "TSLA"]),
            "side": random.choice(["long", "short"]),
            "entry_price": 100 + random.random() * 200,
            "exit_price": 100 + random.random() * 200 if i < limit - 2 else None,
            "pnl": pnl,
            "pnl_percent": pnl / (100 + random.random() * 200),
            "entry_time": (datetime.utcnow() - timedelta(hours=(limit - i) * 4)).isoformat(),
            "exit_time": (datetime.utcnow() - timedelta(hours=(limit - i - 1) * 4)).isoformat() if i < limit - 2 else None,
            "status": "closed" if i < limit - 2 else "open"
        })
    
    return {"trades": trades[::-1]}  # Reverse to show newest first


@router.get("/performance-metrics")
async def get_performance_metrics():
    """Get trading performance metrics."""
    return {
        "total_pnl": 245.0,
        "total_trades": 18,
        "winning_trades": 12,
        "losing_trades": 6,
        "win_rate": 0.667,
        "avg_win": 42.50,
        "avg_loss": 28.30,
        "profit_factor": 1.85,
        "max_drawdown": -0.08,
        "current_streak": 3,
        "streak_type": "win",
        "best_trade": 156.00,
        "worst_trade": -78.00,
        "avg_holding_time": 8.5,
        "sharpe_ratio": 1.45
    }
