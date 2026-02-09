"""
News/Sentiment Gate (Milestone 2)

Provides structured news analysis for gating decisions:
- shock_flag: Binary indicator for trade-stopping news
- sentiment_score: [-1, +1] directional bias
- confidence: [0, 1] how confident in the signal

Integrates with Finnhub and yfinance for news data.
"""

import logging
import os
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any
from datetime import datetime, timedelta
from enum import Enum

logger = logging.getLogger(__name__)

class NewsImpact(str, Enum):
    """News impact levels."""
    HIGH = "high"      # Earnings, FDA, lawsuits, etc.
    MEDIUM = "medium"  # Analyst upgrades/downgrades
    LOW = "low"        # General market noise
    NONE = "none"

@dataclass
class NewsItem:
    """Single news item."""
    headline: str
    source: str
    published_at: datetime
    impact: NewsImpact = NewsImpact.LOW
    sentiment: float = 0.0  # -1 to 1
    symbols: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "headline": self.headline,
            "source": self.source,
            "published_at": self.published_at.isoformat(),
            "impact": self.impact.value,
            "sentiment": self.sentiment,
            "symbols": self.symbols,
        }

@dataclass
class SentimentResult:
    """
    Structured sentiment output for gating.
    
    This is the exact schema specified in STRATEGY_SPEC.md
    """
    symbol: str
    timestamp: datetime
    
    # Core gating signals
    shock_flag: bool = False
    sentiment_score: float = 0.0  # -1 to 1
    confidence: float = 0.5  # 0 to 1
    
    # Additional context
    headline_count_recent: int = 0
    top_3_headlines: List[str] = field(default_factory=list)
    
    # Details
    impact_level: NewsImpact = NewsImpact.NONE
    news_velocity: str = "normal"  # normal, elevated, spike
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "symbol": self.symbol,
            "timestamp": self.timestamp.isoformat(),
            "shock_flag": self.shock_flag,
            "sentiment_score": self.sentiment_score,
            "confidence": self.confidence,
            "headline_count_recent": self.headline_count_recent,
            "top_3_headlines": self.top_3_headlines,
            "impact_level": self.impact_level.value,
            "news_velocity": self.news_velocity,
        }

# Shock keywords that trigger shock_flag
SHOCK_KEYWORDS = [
    "lawsuit", "sued", "sues", "litigation",
    "fraud", "investigation", "sec",
    "bankruptcy", "default", "layoff", "layoffs",
    "recall", "warning", "downgrade",
    "hack", "breach", "cyberattack",
    "ceo resign", "cfo resign", "fired",
    "earnings miss", "guidance cut", "lowered guidance",
    "fda reject", "failed trial",
    "tariff", "sanction", "ban",
]

# Positive keywords
POSITIVE_KEYWORDS = [
    "beat", "exceeds", "upgrade", "raised",
    "approval", "approved", "fda approved",
    "record", "surge", "soar", "rally",
    "buyback", "dividend increase",
    "partnership", "deal", "acquisition",
]

# Negative keywords  
NEGATIVE_KEYWORDS = [
    "miss", "below", "downgrade", "cut",
    "decline", "drop", "fall", "plunge",
    "concern", "risk", "warn", "caution",
    "sell", "avoid",
]

class SentimentGate:
    """
    News and sentiment gating system.
    
    Fetches news and computes structured sentiment output
    for use in trade gating decisions.
    """
    
    def __init__(
        self,
        finnhub_api_key: Optional[str] = None,
        lookback_hours: float = 24.0,
    ):
        self.finnhub_key = finnhub_api_key or os.environ.get("FINNHUB_API_KEY")
        self.lookback = timedelta(hours=lookback_hours)
        self._cache: Dict[str, SentimentResult] = {}
    
    async def analyze(self, symbol: str) -> SentimentResult:
        """
        Analyze news sentiment for a symbol.
        
        Returns structured SentimentResult for gating.
        """
        timestamp = datetime.utcnow()
        
        # Fetch news
        news_items = await self._fetch_news(symbol)
        
        if not news_items:
            return SentimentResult(
                symbol=symbol,
                timestamp=timestamp,
                confidence=0.3,  # Low confidence with no news
            )
        
        # Analyze headlines
        shock_flag = False
        sentiment_scores = []
        impacts = []
        
        for item in news_items:
            headline_lower = item.headline.lower()
            
            # Check for shock keywords
            for keyword in SHOCK_KEYWORDS:
                if keyword in headline_lower:
                    shock_flag = True
                    item.impact = NewsImpact.HIGH
                    break
            
            # Score sentiment
            score = self._score_headline(headline_lower)
            item.sentiment = score
            sentiment_scores.append(score)
            impacts.append(item.impact)
        
        # Aggregate
        avg_sentiment = sum(sentiment_scores) / len(sentiment_scores) if sentiment_scores else 0
        
        # Determine confidence based on consistency
        if sentiment_scores:
            # Higher confidence if all agree
            positive_count = sum(1 for s in sentiment_scores if s > 0.1)
            negative_count = sum(1 for s in sentiment_scores if s < -0.1)
            total = len(sentiment_scores)
            
            if positive_count == total or negative_count == total:
                confidence = 0.85
            elif positive_count > total * 0.7 or negative_count > total * 0.7:
                confidence = 0.7
            else:
                confidence = 0.5
        else:
            confidence = 0.3
        
        # Determine impact level
        if NewsImpact.HIGH in impacts:
            impact_level = NewsImpact.HIGH
        elif NewsImpact.MEDIUM in impacts:
            impact_level = NewsImpact.MEDIUM
        else:
            impact_level = NewsImpact.LOW
        
        # News velocity
        if len(news_items) > 10:
            velocity = "spike"
        elif len(news_items) > 5:
            velocity = "elevated"
        else:
            velocity = "normal"
        
        result = SentimentResult(
            symbol=symbol,
            timestamp=timestamp,
            shock_flag=shock_flag,
            sentiment_score=avg_sentiment,
            confidence=confidence,
            headline_count_recent=len(news_items),
            top_3_headlines=[n.headline for n in news_items[:3]],
            impact_level=impact_level,
            news_velocity=velocity,
        )
        
        self._cache[symbol] = result
        return result
    
    def _score_headline(self, headline: str) -> float:
        """Score a headline for sentiment."""
        score = 0.0
        
        for keyword in POSITIVE_KEYWORDS:
            if keyword in headline:
                score += 0.2
        
        for keyword in NEGATIVE_KEYWORDS:
            if keyword in headline:
                score -= 0.2
        
        # Clamp to [-1, 1]
        return max(-1.0, min(1.0, score))
    
    async def _fetch_news(self, symbol: str) -> List[NewsItem]:
        """
        Fetch news for symbol.
        
        Uses Finnhub if available, otherwise returns empty.
        In production, integrate with actual APIs.
        """
        # For now, return empty - real implementation would call APIs
        # This allows the gating logic to be tested without API keys
        
        if self.finnhub_key:
            try:
                return await self._fetch_finnhub(symbol)
            except Exception as e:
                logger.warning(f"Finnhub fetch failed: {e}")
        
        return []
    
    async def _fetch_finnhub(self, symbol: str) -> List[NewsItem]:
        """Fetch from Finnhub API."""
        import aiohttp
        
        url = f"https://finnhub.io/api/v1/company-news"
        params = {
            "symbol": symbol,
            "from": (datetime.utcnow() - self.lookback).strftime("%Y-%m-%d"),
            "to": datetime.utcnow().strftime("%Y-%m-%d"),
            "token": self.finnhub_key,
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.get(url, params=params) as resp:
                if resp.status != 200:
                    return []
                
                data = await resp.json()
                
                return [
                    NewsItem(
                        headline=item.get("headline", ""),
                        source=item.get("source", ""),
                        published_at=datetime.fromtimestamp(item.get("datetime", 0)),
                        symbols=[symbol],
                    )
                    for item in data[:20]  # Limit to 20
                ]
    
    def get_cached(self, symbol: str) -> Optional[SentimentResult]:
        """Get cached sentiment for symbol."""
        return self._cache.get(symbol)
    
    def check_gate(self, result: SentimentResult, direction: str = "bullish") -> Dict[str, Any]:
        """
        Check if sentiment gates pass for a trade.
        
        Returns dict with gate results.
        """
        gates = {
            "passed": True,
            "reasons": [],
        }
        
        # Shock blocks credit spreads
        if result.shock_flag:
            gates["reasons"].append("shock_flag: high-impact news detected")
            # Don't fail gate - just flag for template selection
        
        # Sentiment conflict
        if direction == "bullish" and result.sentiment_score < -0.3 and result.confidence > 0.6:
            gates["passed"] = False
            gates["reasons"].append(f"sentiment_conflict: bearish ({result.sentiment_score:.2f}) vs bullish trade")
        
        if direction == "bearish" and result.sentiment_score > 0.3 and result.confidence > 0.6:
            gates["passed"] = False
            gates["reasons"].append(f"sentiment_conflict: bullish ({result.sentiment_score:.2f}) vs bearish trade")
        
        return gates
