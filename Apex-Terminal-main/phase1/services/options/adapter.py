"""
Options Data Adapter
Fetches options chain data from YFinance (allowed provider)
"""

import logging
from datetime import date, datetime, timedelta
from typing import Optional, List, Tuple
from dataclasses import dataclass

from .models import (
    OptionContract, OptionChain, OptionType, Greeks,
    IVAnalytics, PutCallRatio
)
from .greeks import BlackScholesCalculator, implied_volatility


logger = logging.getLogger(__name__)


# Default risk-free rate (approximate 10Y Treasury)
DEFAULT_RISK_FREE_RATE = 0.045


class OptionsDataAdapter:
    """
    Adapter for fetching options data from YFinance
    
    YFinance is an allowed data source per requirements.
    Falls back gracefully with "Data unavailable" if fetch fails.
    """
    
    def __init__(self, risk_free_rate: float = DEFAULT_RISK_FREE_RATE):
        self.risk_free_rate = risk_free_rate
        self._yf = None  # Lazy load
    
    def _get_yfinance(self):
        """Lazy load yfinance"""
        if self._yf is None:
            try:
                import yfinance as yf
                self._yf = yf
            except ImportError:
                logger.error("yfinance not installed")
                raise ImportError("yfinance required for options data: pip install yfinance")
        return self._yf
    
    def get_chain(
        self,
        symbol: str,
        expiration: Optional[date] = None,
    ) -> Optional[OptionChain]:
        """
        Fetch options chain for a symbol
        
        Args:
            symbol: Ticker symbol (e.g., "AAPL")
            expiration: Specific expiration date, or None for all
            
        Returns:
            OptionChain or None if unavailable
        """
        try:
            yf = self._get_yfinance()
            ticker = yf.Ticker(symbol)
            
            # Get underlying price
            try:
                info = ticker.fast_info
                # fast_info is an object with attributes, not a dict
                underlying_price = getattr(info, 'lastPrice', None) or getattr(info, 'last_price', None) or getattr(info, 'regularMarketPrice', None)
                if underlying_price is None:
                    hist = ticker.history(period="1d")
                    if not hist.empty:
                        underlying_price = float(hist['Close'].iloc[-1])
                    else:
                        logger.warning(f"Cannot get underlying price for {symbol}")
                        return None
            except Exception as e:
                logger.warning(f"Error getting underlying price for {symbol}: {e}")
                return None
            
            # Get available expirations
            try:
                expirations_str = ticker.options
                if not expirations_str:
                    logger.info(f"No options available for {symbol}")
                    return None
            except Exception as e:
                logger.warning(f"No options chain for {symbol}: {e}")
                return None
            
            expirations = [
                datetime.strptime(exp_str, "%Y-%m-%d").date()
                for exp_str in expirations_str
            ]
            
            # Filter by expiration if specified
            if expiration:
                if expiration not in expirations:
                    logger.info(f"Expiration {expiration} not available for {symbol}")
                    return None
                target_expirations = [expiration]
            else:
                # Get first 4 expirations to limit data
                target_expirations = expirations[:4]
            
            contracts = []
            today = date.today()
            
            for exp in target_expirations:
                try:
                    opt = ticker.option_chain(exp.strftime("%Y-%m-%d"))
                    
                    # Process calls
                    for _, row in opt.calls.iterrows():
                        contract = self._row_to_contract(
                            symbol, row, OptionType.CALL, exp,
                            underlying_price, today
                        )
                        if contract:
                            contracts.append(contract)
                    
                    # Process puts
                    for _, row in opt.puts.iterrows():
                        contract = self._row_to_contract(
                            symbol, row, OptionType.PUT, exp,
                            underlying_price, today
                        )
                        if contract:
                            contracts.append(contract)
                            
                except Exception as e:
                    logger.warning(f"Error fetching chain for {symbol} {exp}: {e}")
                    continue
            
            if not contracts:
                return None
            
            return OptionChain(
                symbol=symbol,
                underlying_price=underlying_price,
                expirations=expirations,
                contracts=contracts,
                timestamp=datetime.utcnow(),
                provider="yfinance",
            )
            
        except Exception as e:
            logger.error(f"Error fetching options chain for {symbol}: {e}")
            return None
    
    def _row_to_contract(
        self,
        symbol: str,
        row,
        option_type: OptionType,
        expiration: date,
        underlying_price: float,
        today: date,
    ) -> Optional[OptionContract]:
        """Convert yfinance row to OptionContract

        Coerce any non-finite numeric values (NaN/Inf) to None early so they
        cannot propagate to higher layers and break JSON serialization.
        """
        try:
            import math as _math

            def _safe_float(v):
                try:
                    if v is None:
                        return None
                    f = float(v)
                    return f if _math.isfinite(f) else None
                except Exception:
                    return None

            strike = _safe_float(row.get('strike'))
            if strike is None or strike <= 0:
                return None

            bid = _safe_float(row.get('bid'))
            ask = _safe_float(row.get('ask'))
            last = _safe_float(row.get('lastPrice'))

            # Calculate mark (mid price): only when both bid and ask are finite
            if bid is not None and ask is not None:
                mark = (bid + ask) / 2
            else:
                mark = last
            
            volume = int(row.get('volume', 0)) if row.get('volume') else 0
            oi = int(row.get('openInterest', 0)) if row.get('openInterest') else 0
            
            # Get IV from yfinance or calculate; sanitize non-finite IVs
            iv_raw = row.get('impliedVolatility')
            iv = None
            if iv_raw is not None:
                try:
                    iv = float(iv_raw)
                    if not (iv is not None and __import__('math').isfinite(iv)):
                        iv = None
                except Exception:
                    iv = None
            else:
                # Try to calculate IV from price
                if mark and mark > 0:
                    dte = (expiration - today).days
                    if dte > 0:
                        try:
                            iv = implied_volatility(
                                mark, underlying_price, strike, dte,
                                self.risk_free_rate,
                                option_type.value
                            )
                        except Exception:
                            iv = None
            
            # Calculate Greeks if we have IV
            greeks = None
            if iv and iv > 0:
                dte = (expiration - today).days
                if dte > 0:
                    result = BlackScholesCalculator.calculate_all(
                        underlying_price, strike, dte,
                        self.risk_free_rate, iv, option_type.value
                    )
                    greeks = Greeks(
                        delta=result.delta,
                        gamma=result.gamma,
                        theta=result.theta,
                        vega=result.vega,
                        rho=result.rho,
                    )
            
            # Determine ITM status
            if option_type == OptionType.CALL:
                itm = underlying_price > strike
            else:
                itm = underlying_price < strike
            
            dte = (expiration - today).days
            
            return OptionContract(
                symbol=symbol,
                contract_symbol=row.get('contractSymbol', f"{symbol}{expiration}{option_type.value[0].upper()}{int(strike)}"),
                option_type=option_type,
                strike=strike,
                expiration=expiration,
                bid=bid,
                ask=ask,
                last=last,
                mark=mark,
                volume=volume,
                open_interest=oi,
                implied_volatility=iv,
                greeks=greeks,
                in_the_money=itm,
                days_to_expiration=max(0, dte),
            )
            
        except Exception as e:
            logger.debug(f"Error parsing option row: {e}")
            return None
    
    def get_put_call_ratio(self, chain: OptionChain) -> PutCallRatio:
        """
        Calculate Put/Call ratios from chain data
        
        Returns both volume-based and OI-based PCR
        """
        calls = chain.calls()
        puts = chain.puts()
        
        call_volume = sum(c.volume for c in calls)
        put_volume = sum(p.volume for p in puts)
        call_oi = sum(c.open_interest for c in calls)
        put_oi = sum(p.open_interest for p in puts)
        
        volume_pcr = put_volume / call_volume if call_volume > 0 else 0.0
        oi_pcr = put_oi / call_oi if call_oi > 0 else 0.0
        
        return PutCallRatio(
            symbol=chain.symbol,
            volume_pcr=volume_pcr,
            oi_pcr=oi_pcr,
            total_put_volume=put_volume,
            total_call_volume=call_volume,
            total_put_oi=put_oi,
            total_call_oi=call_oi,
        )
    
    def get_atm_iv(
        self,
        chain: OptionChain,
        expiration: Optional[date] = None,
    ) -> Optional[float]:
        """
        Get ATM implied volatility for a chain
        
        Uses average of ATM call and put IV
        """
        # Use first expiration if not specified
        if expiration is None:
            if not chain.expirations:
                return None
            expiration = chain.expirations[0]
        
        calls = chain.calls(expiration)
        puts = chain.puts(expiration)
        
        if not calls or not puts:
            return None
        
        # Find ATM strikes
        price = chain.underlying_price
        
        atm_call = min(calls, key=lambda c: abs(c.strike - price))
        atm_put = min(puts, key=lambda p: abs(p.strike - price))
        
        ivs = []
        if atm_call.implied_volatility:
            ivs.append(atm_call.implied_volatility)
        if atm_put.implied_volatility:
            ivs.append(atm_put.implied_volatility)
        
        if not ivs:
            return None
        
        return sum(ivs) / len(ivs)


from ..config import get_settings

# Singleton adapter instance
_adapter: Optional["HybridOptionsAdapter"] = None


class HybridOptionsAdapter:
    """
    Hybrid adapter that tries Alpaca first (if enabled) and falls back to yfinance.
    This ensures options data is always available even if Alpaca doesn't return data.
    """
    
    def __init__(self, alpaca_adapter=None, yfinance_adapter=None):
        self._alpaca = alpaca_adapter
        self._yfinance = yfinance_adapter or OptionsDataAdapter()
    
    def get_chain(self, symbol: str, expiration=None):
        # Try Alpaca first if available
        if self._alpaca:
            try:
                chain = self._alpaca.get_chain(symbol, expiration)
                if chain and chain.contracts:
                    return chain
            except Exception as e:
                logger.debug(f"Alpaca options failed, falling back to yfinance: {e}")
        
        # Fall back to yfinance
        return self._yfinance.get_chain(symbol, expiration)
    
    def get_put_call_ratio(self, chain):
        return self._yfinance.get_put_call_ratio(chain)
    
    def get_atm_iv(self, chain, expiration=None):
        return self._yfinance.get_atm_iv(chain, expiration)


def get_options_adapter() -> HybridOptionsAdapter:
    """Get or create the hybrid options data adapter"""
    global _adapter
    if _adapter is None:
        settings = get_settings()
        alpaca_adapter = None
        
        # Try to initialize Alpaca adapter if enabled
        if getattr(settings, "enable_alpaca_options", False) and settings.apca_api_key_id and settings.apca_api_secret_key:
            try:
                from .alpaca_adapter import AlpacaOptionsAdapter
                alpaca_adapter = AlpacaOptionsAdapter()
                logger.info("Alpaca options adapter initialized (with yfinance fallback)")
            except Exception:
                logger.warning("alpaca_adapter_init_failed, using yfinance only")
        
        _adapter = HybridOptionsAdapter(alpaca_adapter=alpaca_adapter)
    return _adapter
