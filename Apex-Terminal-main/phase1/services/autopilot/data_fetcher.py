"""
Market Data Fetcher - Fetches real-time data from Tradier and yFinance.

Provides live options chain data and stock prices for autopilot candidates.
"""

import os
import logging
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime, date, timedelta
from dataclasses import dataclass
import requests
from pathlib import Path

# Load keys.env to ensure API keys are available
from dotenv import load_dotenv
_keys_path = Path(__file__).parent.parent.parent / "keys.env"
if _keys_path.exists():
    load_dotenv(_keys_path, override=True)

logger = logging.getLogger(__name__)


@dataclass
class OptionQuote:
    """Single option quote."""
    symbol: str
    underlying: str
    option_type: str  # 'call' or 'put'
    strike: float
    expiry: date
    bid: float
    ask: float
    last: float
    volume: int
    open_interest: int
    implied_vol: float
    delta: float
    gamma: float
    theta: float
    vega: float
    
    @property
    def mid(self) -> float:
        return (self.bid + self.ask) / 2


@dataclass
class StockQuote:
    """Stock price quote."""
    symbol: str
    last: float
    bid: float
    ask: float
    volume: int
    timestamp: datetime


class TradierDataFetcher:
    """Fetches options data from Tradier API."""
    
    BASE_URL = "https://api.tradier.com/v1"
    SANDBOX_URL = "https://sandbox.tradier.com/v1"
    
    def __init__(self, api_key: Optional[str] = None, sandbox: bool = False):
        self.api_key = api_key or os.environ.get("TRADIER_BROKERAGE_KEY")
        self.base_url = self.SANDBOX_URL if sandbox else self.BASE_URL
        
        if not self.api_key:
            logger.warning("Tradier API key not set - options data unavailable")
    
    @property
    def headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Accept": "application/json",
        }
    
    def get_quote(self, symbol: str) -> Optional[StockQuote]:
        """Get stock quote."""
        if not self.api_key:
            return None
        
        try:
            resp = requests.get(
                f"{self.base_url}/markets/quotes",
                params={"symbols": symbol},
                headers=self.headers,
                timeout=10,
            )
            resp.raise_for_status()
            data = resp.json()
            
            quote_data = data.get("quotes", {}).get("quote", {})
            if not quote_data:
                return None
            
            return StockQuote(
                symbol=symbol,
                last=float(quote_data.get("last", 0)),
                bid=float(quote_data.get("bid", 0)),
                ask=float(quote_data.get("ask", 0)),
                volume=int(quote_data.get("volume", 0)),
                timestamp=datetime.utcnow(),
            )
            
        except Exception as e:
            logger.error(f"Tradier quote error for {symbol}: {e}")
            return None
    
    def get_options_chain(
        self,
        symbol: str,
        expiry: Optional[date] = None,
        weekly_only: bool = False,
    ) -> List[OptionQuote]:
        """Get options chain for symbol."""
        if not self.api_key:
            return []
        
        try:
            # Get expirations if not specified
            if expiry is None:
                expiry = self._get_next_weekly_expiry() if weekly_only else self._get_next_monthly_expiry()
            
            resp = requests.get(
                f"{self.base_url}/markets/options/chains",
                params={
                    "symbol": symbol,
                    "expiration": expiry.isoformat(),
                    "greeks": "true",
                },
                headers=self.headers,
                timeout=15,
            )
            resp.raise_for_status()
            data = resp.json()
            
            options = data.get("options", {}).get("option", [])
            if not options:
                return []
            
            # Ensure it's a list
            if isinstance(options, dict):
                options = [options]
            
            quotes = []
            for opt in options:
                try:
                    greeks = opt.get("greeks", {}) or {}
                    
                    quotes.append(OptionQuote(
                        symbol=opt.get("symbol", ""),
                        underlying=symbol,
                        option_type=opt.get("option_type", "call"),
                        strike=float(opt.get("strike", 0)),
                        expiry=datetime.strptime(opt.get("expiration_date", ""), "%Y-%m-%d").date(),
                        bid=float(opt.get("bid", 0) or 0),
                        ask=float(opt.get("ask", 0) or 0),
                        last=float(opt.get("last", 0) or 0),
                        volume=int(opt.get("volume", 0) or 0),
                        open_interest=int(opt.get("open_interest", 0) or 0),
                        implied_vol=float(greeks.get("smv_vol", 0) or 0),
                        delta=float(greeks.get("delta", 0) or 0),
                        gamma=float(greeks.get("gamma", 0) or 0),
                        theta=float(greeks.get("theta", 0) or 0),
                        vega=float(greeks.get("vega", 0) or 0),
                    ))
                except Exception as e:
                    logger.debug(f"Skipping option: {e}")
            
            logger.info(f"Fetched {len(quotes)} options for {symbol}")
            return quotes
            
        except Exception as e:
            logger.error(f"Tradier chain error for {symbol}: {e}")
            return []
    
    def _get_next_monthly_expiry(self) -> date:
        """Get next monthly expiry (3rd Friday)."""
        today = date.today()
        # Find next month's 3rd Friday
        if today.day > 15:
            month = today.month + 1
            year = today.year
            if month > 12:
                month = 1
                year += 1
        else:
            month = today.month
            year = today.year
        
        # Find 3rd Friday
        first_day = date(year, month, 1)
        first_friday = first_day + timedelta(days=(4 - first_day.weekday()) % 7)
        third_friday = first_friday + timedelta(days=14)
        
        return third_friday

    def _get_next_weekly_expiry(self) -> date:
        """Get next weekly expiry (nearest upcoming Friday)."""
        today = date.today()
        days_ahead = (4 - today.weekday()) % 7
        if days_ahead == 0:
            days_ahead = 7
        return today + timedelta(days=days_ahead)


class YFinanceDataFetcher:
    """Fetches stock data from yFinance."""
    
    def __init__(self):
        self._yf = None
        try:
            import yfinance as yf
            self._yf = yf
            logger.info("yFinance initialized")
        except ImportError:
            logger.warning("yfinance not installed - run: pip install yfinance")
    
    def get_quote(self, symbol: str) -> Optional[StockQuote]:
        """Get stock quote from yFinance."""
        if not self._yf:
            return None
        
        try:
            ticker = self._yf.Ticker(symbol)
            info = ticker.fast_info
            
            return StockQuote(
                symbol=symbol,
                last=float(info.last_price or 0),
                bid=float(getattr(info, 'bid', 0) or 0),
                ask=float(getattr(info, 'ask', 0) or 0),
                volume=int(getattr(info, 'last_volume', 0) or 0),
                timestamp=datetime.utcnow(),
            )
            
        except Exception as e:
            logger.error(f"yFinance error for {symbol}: {e}")
            return None
    
    def get_historical_prices(
        self,
        symbol: str,
        period: str = "1mo",
    ) -> List[float]:
        """Get historical closing prices."""
        if not self._yf:
            return []
        
        try:
            ticker = self._yf.Ticker(symbol)
            hist = ticker.history(period=period)
            return hist["Close"].tolist()
            
        except Exception as e:
            logger.error(f"yFinance history error for {symbol}: {e}")
            return []


class MarketDataProvider:
    """
    Combined market data provider using Tradier + yFinance.
    
    - Tradier: Real-time options chains with Greeks
    - yFinance: Stock prices and historical data
    """
    
    def __init__(self):
        self.tradier = TradierDataFetcher()
        self.yfinance = YFinanceDataFetcher()
        self._cache: Dict[str, Any] = {}
        self._cache_time: Dict[str, datetime] = {}
        self._cache_ttl = timedelta(seconds=30)
    
    def get_stock_price(self, symbol: str) -> float:
        """Get current stock price, prefer Tradier then yFinance."""
        cache_key = f"price_{symbol}"
        if self._is_cached(cache_key):
            return self._cache[cache_key]
        
        # Try Tradier first
        quote = self.tradier.get_quote(symbol)
        if quote and quote.last > 0:
            self._set_cache(cache_key, quote.last)
            return quote.last
        
        # Fall back to yFinance
        quote = self.yfinance.get_quote(symbol)
        if quote and quote.last > 0:
            self._set_cache(cache_key, quote.last)
            return quote.last
        
        return 0.0
    
    def get_options_chain(
        self,
        symbol: str,
        expiry: Optional[date] = None,
        weekly_only: bool = False,
    ) -> List[OptionQuote]:
        """Get options chain from Tradier."""
        cache_key = f"chain_{symbol}_{expiry}"
        if self._is_cached(cache_key):
            return self._cache[cache_key]
        
        chain = self.tradier.get_options_chain(symbol, expiry, weekly_only=weekly_only)
        if chain:
            self._set_cache(cache_key, chain)
        return chain

    def get_next_weekly_expiry(self) -> date:
        """Get next weekly expiry date."""
        return self.tradier._get_next_weekly_expiry()

    def get_next_monthly_expiry(self) -> date:
        """Get next monthly expiry date."""
        return self.tradier._get_next_monthly_expiry()
    
    def get_historical_prices(self, symbol: str, period: str = "1mo") -> List[float]:
        """Get historical prices from yFinance."""
        cache_key = f"hist_{symbol}_{period}"
        if self._is_cached(cache_key):
            return self._cache[cache_key]
        
        prices = self.yfinance.get_historical_prices(symbol, period)
        if prices:
            self._set_cache(cache_key, prices)
        return prices
    
    def get_price_history(self, symbol: str, days: int = 60) -> List[float]:
        """
        Get price history for technical analysis.
        
        Args:
            symbol: Ticker symbol
            days: Number of days of history
            
        Returns:
            List of closing prices (oldest to newest)
        """
        # Map days to yfinance periods
        if days <= 5:
            period = "5d"
        elif days <= 30:
            period = "1mo"
        elif days <= 60:
            period = "2mo"
        elif days <= 90:
            period = "3mo"
        else:
            period = "6mo"
        
        prices = self.get_historical_prices(symbol, period)
        
        # Return last N days
        if len(prices) > days:
            return prices[-days:]
        return prices
    
    def get_volume_history(self, symbol: str, days: int = 60) -> List[float]:
        """
        Get volume history for technical analysis.
        
        Args:
            symbol: Ticker symbol
            days: Number of days of history
            
        Returns:
            List of daily volumes (oldest to newest)
        """
        if not self.yfinance._yf:
            return [1_000_000] * days  # Default volumes
        
        try:
            # Map days to periods
            if days <= 5:
                period = "5d"
            elif days <= 30:
                period = "1mo"
            elif days <= 60:
                period = "2mo"
            elif days <= 90:
                period = "3mo"
            else:
                period = "6mo"
            
            ticker = self.yfinance._yf.Ticker(symbol)
            hist = ticker.history(period=period)
            volumes = hist["Volume"].tolist()
            
            # Return last N days
            if len(volumes) > days:
                return volumes[-days:]
            return volumes
            
        except Exception as e:
            logger.error(f"Volume history error for {symbol}: {e}")
            return [1_000_000] * days
    
    def get_ohlcv_history(
        self,
        symbol: str,
        days: int = 60
    ) -> Dict[str, List[float]]:
        """
        Get full OHLCV history for comprehensive technical analysis.
        
        Returns:
            Dict with 'open', 'high', 'low', 'close', 'volume' lists
        """
        if not self.yfinance._yf:
            default_price = self.get_stock_price(symbol) or 100.0
            return {
                "open": [default_price] * days,
                "high": [default_price * 1.01] * days,
                "low": [default_price * 0.99] * days,
                "close": [default_price] * days,
                "volume": [1_000_000] * days,
            }
        
        try:
            # Map days to periods
            if days <= 5:
                period = "5d"
            elif days <= 30:
                period = "1mo"
            elif days <= 60:
                period = "2mo"
            elif days <= 90:
                period = "3mo"
            else:
                period = "6mo"
            
            ticker = self.yfinance._yf.Ticker(symbol)
            hist = ticker.history(period=period)
            
            result = {
                "open": hist["Open"].tolist()[-days:],
                "high": hist["High"].tolist()[-days:],
                "low": hist["Low"].tolist()[-days:],
                "close": hist["Close"].tolist()[-days:],
                "volume": hist["Volume"].tolist()[-days:],
            }
            
            return result
            
        except Exception as e:
            logger.error(f"OHLCV history error for {symbol}: {e}")
            default_price = self.get_stock_price(symbol) or 100.0
            return {
                "open": [default_price] * days,
                "high": [default_price * 1.01] * days,
                "low": [default_price * 0.99] * days,
                "close": [default_price] * days,
                "volume": [1_000_000] * days,
            }
    
    def find_spread_legs(
        self,
        symbol: str,
        option_type: str,
        target_delta: float = 0.30,
        width: float = 5.0,
        min_dte: int = 14,
        max_dte: int = 45,
    ) -> Optional[Tuple[OptionQuote, OptionQuote]]:
        """
        Find option legs for a spread based on delta targeting.
        
        Returns (long_leg, short_leg) for credit spreads.
        """
        chain = self.get_options_chain(symbol)
        if not chain:
            return None
        
        # Filter by type and DTE
        today = date.today()
        filtered = [
            o for o in chain
            if o.option_type == option_type
            and min_dte <= (o.expiry - today).days <= max_dte
        ]
        
        if not filtered:
            return None
        
        # Find option closest to target delta
        short_leg = min(
            filtered,
            key=lambda o: abs(abs(o.delta) - target_delta)
        )
        
        # Find long leg at width distance
        strike_diff = width if option_type == "put" else -width
        target_strike = short_leg.strike + strike_diff
        
        long_leg = min(
            [o for o in filtered if o.expiry == short_leg.expiry],
            key=lambda o: abs(o.strike - target_strike),
            default=None
        )
        
        if not long_leg:
            return None
        
        return (long_leg, short_leg)
    
    def _is_cached(self, key: str) -> bool:
        if key not in self._cache:
            return False
        if datetime.utcnow() - self._cache_time.get(key, datetime.min) > self._cache_ttl:
            del self._cache[key]
            return False
        return True
    
    def _set_cache(self, key: str, value: Any) -> None:
        self._cache[key] = value
        self._cache_time[key] = datetime.utcnow()


# Global instance
_data_provider: Optional[MarketDataProvider] = None


def get_data_provider() -> MarketDataProvider:
    """Get or create the global data provider."""
    global _data_provider
    if _data_provider is None:
        _data_provider = MarketDataProvider()
    return _data_provider
