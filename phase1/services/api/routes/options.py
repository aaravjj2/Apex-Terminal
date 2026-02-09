"""
Options API Routes
REST endpoints for options chain, Greeks, IV analytics
"""

from datetime import date, datetime
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
import structlog

from ...options import (
    get_options_adapter,
    OptionChain,
    calculate_greeks,
    IVAnalyticsCalculator,
    VolatilitySkewCalculator,
    TermStructureCalculator,
    get_strategy_factory,
    StrategyLeg,
    PositionType,
)


logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/options", tags=["options"])


# ============================================================================
# Response Models
# ============================================================================

class GreeksResponse(BaseModel):
    delta: float
    gamma: float
    theta: float
    vega: float
    rho: float
    theoretical_price: float
    intrinsic_value: float
    time_value: float


class ContractResponse(BaseModel):
    symbol: str
    contract_symbol: str
    option_type: str
    strike: float
    expiration: str
    bid: Optional[float]
    ask: Optional[float]
    last: Optional[float]
    mark: Optional[float]
    mid_price: Optional[float]
    volume: int
    open_interest: int
    implied_volatility: Optional[float]
    greeks: Optional[dict]
    in_the_money: bool
    days_to_expiration: int


class ChainResponse(BaseModel):
    symbol: str
    underlying_price: float
    expirations: List[str]
    contracts: List[ContractResponse]
    timestamp: str
    provider: str
    total_contracts: int
    unavailable: Optional[str] = None


class IVAnalyticsResponse(BaseModel):
    symbol: str
    current_iv: Optional[float]
    iv_rank: Optional[float]
    iv_percentile: Optional[float]
    iv_high: Optional[float]
    iv_low: Optional[float]
    lookback_days: int
    timestamp: str
    unavailable: Optional[str] = None


class SkewResponse(BaseModel):
    symbol: str
    expiration: str
    strikes: List[float]
    ivs: List[float]
    atm_strike: float
    atm_iv: float
    skew_slope: float
    delta25_put_iv: Optional[float]
    delta25_call_iv: Optional[float]
    skew_ratio: Optional[float]
    unavailable: Optional[str] = None


class TermStructureResponse(BaseModel):
    symbol: str
    expirations: List[str]
    days_to_expiration: List[int]
    ivs: List[float]
    structure_type: str
    unavailable: Optional[str] = None


class PutCallRatioResponse(BaseModel):
    symbol: str
    volume_pcr: float
    oi_pcr: float
    total_put_volume: int
    total_call_volume: int
    total_put_oi: int
    total_call_oi: int
    timestamp: str
    unavailable: Optional[str] = None


# Strategy Models
class StrategyTemplateResponse(BaseModel):
    name: str
    description: str
    category: str
    max_profit: str
    max_loss: str
    legs_description: str


class StrategyLegRequest(BaseModel):
    option_type: str = Field(..., description="'call', 'put', or 'stock'")
    position: str = Field(..., description="'long' or 'short'")
    strike: float
    premium: float = 0.0
    quantity: int = 1
    expiration_days: int = 30
    iv: float = 0.30


class StrategyAnalyzeRequest(BaseModel):
    legs: List[StrategyLegRequest]
    underlying_price: float
    strategy_name: str = "Custom"


class StrategyLegResponse(BaseModel):
    option_type: str
    position: str
    strike: float
    premium: float
    quantity: int
    expiration_days: int
    iv: Optional[float]


class StrategyAnalysisResponse(BaseModel):
    name: str
    legs: List[StrategyLegResponse]
    underlying_price: float
    price_range: List[float]
    expiration_payoff: List[float]
    theoretical_payoff: List[float]
    max_profit: float
    max_loss: float
    breakevens: List[float]
    net_delta: float
    net_gamma: float
    net_theta: float
    net_vega: float


# Pre-built strategy request models
class CoveredCallRequest(BaseModel):
    underlying_price: float
    call_strike: float
    call_premium: float
    expiration_days: int = 30
    iv: float = 0.30


class IronCondorRequest(BaseModel):
    underlying_price: float
    put_long_strike: float
    put_long_premium: float
    put_short_strike: float
    put_short_premium: float
    call_short_strike: float
    call_short_premium: float
    call_long_strike: float
    call_long_premium: float
    expiration_days: int = 30
    iv: float = 0.30


class StraddleRequest(BaseModel):
    underlying_price: float
    strike: float
    call_premium: float
    put_premium: float
    expiration_days: int = 30
    iv: float = 0.30
    is_long: bool = True


class VerticalSpreadRequest(BaseModel):
    underlying_price: float
    long_strike: float
    long_premium: float
    short_strike: float
    short_premium: float
    option_type: str = "call"
    expiration_days: int = 30
    iv: float = 0.30


# ============================================================================
# Endpoints
# ============================================================================

@router.get("/chain/{symbol}", response_model=ChainResponse)
async def get_options_chain(
    symbol: str,
    expiration: Optional[str] = Query(None, description="Specific expiration date (YYYY-MM-DD)"),
):
    """
    Get options chain for a symbol
    
    Returns calls and puts with Greeks, IV, OI, and volume
    """
    logger.info("options_chain_request", symbol=symbol, expiration=expiration)
    
    try:
        adapter = get_options_adapter()
        
        exp_date = None
        if expiration:
            try:
                exp_date = datetime.strptime(expiration, "%Y-%m-%d").date()
            except ValueError:
                raise HTTPException(400, f"Invalid expiration format: {expiration}")
        
        chain = adapter.get_chain(symbol, exp_date)
        
        if chain is None:
            return ChainResponse(
                symbol=symbol.upper(),
                underlying_price=0.0,
                expirations=[],
                contracts=[],
                timestamp=datetime.utcnow().isoformat(),
                provider="yfinance",
                total_contracts=0,
                unavailable=f"Options data unavailable for {symbol}",
            )
        
        # Sanitize numeric values to avoid NaN/Inf JSON serialization errors
        def _finite(v):
            try:
                import math as _math
                return v if (v is not None and _math.isfinite(v)) else None
            except Exception:
                return None

        contracts = []
        for c in chain.contracts:
            bid = _finite(c.bid)
            ask = _finite(c.ask)
            last = _finite(c.last)
            mark = _finite(c.mark)
            mid_price = _finite(c.mid_price)
            iv = _finite(c.implied_volatility)

            # if strike is not finite, skip the contract
            if not (c.strike is not None and _finite(c.strike) is not None):
                continue

            contracts.append(
                ContractResponse(
                    symbol=c.symbol,
                    contract_symbol=c.contract_symbol,
                    option_type=c.option_type.value,
                    strike=float(c.strike),
                    expiration=c.expiration.isoformat(),
                    bid=bid,
                    ask=ask,
                    last=last,
                    mark=mark,
                    mid_price=mid_price,
                    volume=c.volume,
                    open_interest=c.open_interest,
                    implied_volatility=iv,
                    greeks=c.greeks.to_dict() if c.greeks else None,
                    in_the_money=c.in_the_money,
                    days_to_expiration=c.days_to_expiration,
                )
            )

        underlying_price = chain.underlying_price if (chain.underlying_price is not None and __import__('math').isfinite(chain.underlying_price)) else 0.0
        provider = chain.provider or "yfinance"

        # Build response dict and perform sanity checks before returning
        response_data = {
            "symbol": chain.symbol,
            "underlying_price": underlying_price,
            "expirations": [e.isoformat() for e in chain.expirations],
            "contracts": [c.dict() if hasattr(c, 'dict') else c for c in contracts],
            "timestamp": chain.timestamp.isoformat(),
            "provider": provider,
            "total_contracts": len(contracts),
        }

        # Detect non-finite floats that will break JSON serialization
        import json, math as _math
        def _find_bad(val, path=""):
            if isinstance(val, dict):
                for k, v in val.items():
                    p = f"{path}.{k}" if path else k
                    bad = _find_bad(v, p)
                    if bad:
                        return bad
            elif isinstance(val, list):
                for i, v in enumerate(val):
                    p = f"{path}[{i}]"
                    bad = _find_bad(v, p)
                    if bad:
                        return bad
            elif isinstance(val, float):
                if not _math.isfinite(val):
                    return path
            return None

        bad = _find_bad(response_data)
        if bad:
            logger.error("bad_json_field_detected", field=bad)
            raise ValueError(f"Out of range float detected at {bad}")

        return ChainResponse(**response_data)
        
    except Exception as e:
        logger.error("options_chain_error", symbol=symbol, error=str(e))
        return ChainResponse(
            symbol=symbol.upper(),
            underlying_price=0.0,
            expirations=[],
            contracts=[],
            timestamp=datetime.utcnow().isoformat(),
            provider="yfinance",
            total_contracts=0,
            unavailable=f"Error fetching options: {str(e)}",
        )



@router.get("/expirations/{symbol}", response_model=List[str])
async def get_options_expirations(symbol: str):
    """
    Get available expiration dates for a symbol
    """
    logger.info("options_expirations_request", symbol=symbol)
    
    try:
        adapter = get_options_adapter()
        chain = adapter.get_chain(symbol)
        
        if chain is None or not chain.expirations:
             return []
             
        return [e.isoformat() for e in chain.expirations]
        
    except Exception as e:
        logger.error("options_expirations_error", symbol=symbol, error=str(e))
        return []


@router.get("/greeks/{symbol}", response_model=GreeksResponse)
async def calculate_option_greeks(
    symbol: str,
    strike: float = Query(..., description="Strike price"),
    expiration_days: int = Query(..., description="Days to expiration"),
    option_type: str = Query(..., description="call or put"),
    underlying_price: Optional[float] = Query(None, description="Underlying price (fetched if not provided)"),
    iv: Optional[float] = Query(None, description="Implied volatility (decimal, e.g., 0.30)"),
    risk_free_rate: float = Query(0.045, description="Risk-free rate (decimal)"),
):
    """
    Calculate Greeks for a specific option
    
    If underlying_price or iv not provided, will attempt to fetch from market
    """
    if option_type not in ("call", "put"):
        raise HTTPException(400, "option_type must be 'call' or 'put'")
    
    if expiration_days <= 0:
        raise HTTPException(400, "expiration_days must be positive")
    
    # Get underlying price if not provided
    spot = underlying_price
    if spot is None:
        try:
            adapter = get_options_adapter()
            chain = adapter.get_chain(symbol)
            if chain:
                spot = chain.underlying_price
        except Exception:
            pass
    
    if spot is None:
        raise HTTPException(400, f"Could not determine underlying price for {symbol}")
    
    # Default IV if not provided
    sigma = iv if iv is not None else 0.30
    
    result = calculate_greeks(spot, strike, expiration_days, risk_free_rate, sigma, option_type)
    
    return GreeksResponse(**result)


@router.get("/iv/{symbol}", response_model=IVAnalyticsResponse)
async def get_iv_analytics(
    symbol: str,
    lookback_days: int = Query(252, description="Lookback period in trading days"),
):
    """
    Get IV Rank and IV Percentile for a symbol
    
    Note: Historical IV data may be limited. Returns best-effort calculation.
    """
    logger.info("iv_analytics_request", symbol=symbol, lookback_days=lookback_days)
    
    try:
        adapter = get_options_adapter()
        chain = adapter.get_chain(symbol)
        
        if chain is None:
            return IVAnalyticsResponse(
                symbol=symbol.upper(),
                current_iv=None,
                iv_rank=None,
                iv_percentile=None,
                iv_high=None,
                iv_low=None,
                lookback_days=lookback_days,
                timestamp=datetime.utcnow().isoformat(),
                unavailable=f"Options data unavailable for {symbol}",
            )
        
        # Get current ATM IV
        current_iv = adapter.get_atm_iv(chain)
        
        if current_iv is None:
            return IVAnalyticsResponse(
                symbol=symbol.upper(),
                current_iv=None,
                iv_rank=None,
                iv_percentile=None,
                iv_high=None,
                iv_low=None,
                lookback_days=lookback_days,
                timestamp=datetime.utcnow().isoformat(),
                unavailable="Could not calculate ATM IV",
            )
        
        # Note: YFinance doesn't provide historical IV
        # We calculate rank/percentile as 50 (unknown) and note the limitation
        analytics = IVAnalyticsCalculator.calculate_analytics(
            symbol=symbol.upper(),
            current_iv=current_iv,
            historical_ivs=[],  # No historical data from yfinance
            lookback_days=lookback_days,
        )
        
        return IVAnalyticsResponse(
            symbol=analytics.symbol,
            current_iv=analytics.current_iv,
            iv_rank=analytics.iv_rank,
            iv_percentile=analytics.iv_percentile,
            iv_high=analytics.iv_high,
            iv_low=analytics.iv_low,
            lookback_days=analytics.lookback_days,
            timestamp=analytics.timestamp.isoformat(),
            unavailable="Historical IV data unavailable - rank/percentile are estimates" if not analytics.iv_high else None,
        )
        
    except Exception as e:
        logger.error("iv_analytics_error", symbol=symbol, error=str(e))
        return IVAnalyticsResponse(
            symbol=symbol.upper(),
            current_iv=None,
            iv_rank=None,
            iv_percentile=None,
            iv_high=None,
            iv_low=None,
            lookback_days=lookback_days,
            timestamp=datetime.utcnow().isoformat(),
            unavailable=f"Error calculating IV analytics: {str(e)}",
        )


@router.get("/skew/{symbol}/{expiration}", response_model=SkewResponse)
async def get_volatility_skew(
    symbol: str,
    expiration: str,
):
    """
    Get volatility skew for a specific expiration
    
    Returns IV by strike with skew metrics
    """
    logger.info("skew_request", symbol=symbol, expiration=expiration)
    
    try:
        exp_date = datetime.strptime(expiration, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(400, f"Invalid expiration format: {expiration}")
    
    try:
        adapter = get_options_adapter()
        chain = adapter.get_chain(symbol, exp_date)
        
        if chain is None:
            return SkewResponse(
                symbol=symbol.upper(),
                expiration=expiration,
                strikes=[],
                ivs=[],
                atm_strike=0.0,
                atm_iv=0.0,
                skew_slope=0.0,
                unavailable=f"Options data unavailable for {symbol} {expiration}",
            )
        
        # Get contracts for this expiration
        calls = chain.calls(exp_date)
        
        if not calls:
            return SkewResponse(
                symbol=symbol.upper(),
                expiration=expiration,
                strikes=[],
                ivs=[],
                atm_strike=0.0,
                atm_iv=0.0,
                skew_slope=0.0,
                unavailable="No call options found for expiration",
            )
        
        # Extract strikes and IVs (filter out None IVs)
        data = [
            (c.strike, c.implied_volatility, c.greeks.delta if c.greeks else None)
            for c in calls
            if c.implied_volatility is not None
        ]
        
        if not data:
            return SkewResponse(
                symbol=symbol.upper(),
                expiration=expiration,
                strikes=[],
                ivs=[],
                atm_strike=0.0,
                atm_iv=0.0,
                skew_slope=0.0,
                unavailable="No IV data available",
            )
        
        strikes, ivs, deltas = zip(*data)
        
        skew = VolatilitySkewCalculator.calculate_skew(
            symbol=symbol.upper(),
            expiration=exp_date,
            strikes=list(strikes),
            ivs=list(ivs),
            underlying_price=chain.underlying_price,
            deltas=list(deltas) if all(d is not None for d in deltas) else None,
        )
        
        result = skew.to_dict()
        return SkewResponse(**result)
        
    except Exception as e:
        logger.error("skew_error", symbol=symbol, error=str(e))
        return SkewResponse(
            symbol=symbol.upper(),
            expiration=expiration,
            strikes=[],
            ivs=[],
            atm_strike=0.0,
            atm_iv=0.0,
            skew_slope=0.0,
            unavailable=f"Error calculating skew: {str(e)}",
        )


@router.get("/term-structure/{symbol}", response_model=TermStructureResponse)
async def get_term_structure(symbol: str):
    """
    Get IV term structure across expirations
    
    Returns ATM IV for each expiration with structure classification
    """
    logger.info("term_structure_request", symbol=symbol)
    
    try:
        adapter = get_options_adapter()
        chain = adapter.get_chain(symbol)
        
        if chain is None or not chain.expirations:
            return TermStructureResponse(
                symbol=symbol.upper(),
                expirations=[],
                days_to_expiration=[],
                ivs=[],
                structure_type="flat",
                unavailable=f"Options data unavailable for {symbol}",
            )
        
        # Get ATM IV for each expiration
        expirations = []
        atm_ivs = []
        
        for exp in chain.expirations[:6]:  # Limit to 6 expirations
            iv = adapter.get_atm_iv(chain, exp)
            if iv is not None:
                expirations.append(exp)
                atm_ivs.append(iv)
        
        if not expirations:
            return TermStructureResponse(
                symbol=symbol.upper(),
                expirations=[],
                days_to_expiration=[],
                ivs=[],
                structure_type="flat",
                unavailable="Could not calculate ATM IV for any expiration",
            )
        
        term_structure = TermStructureCalculator.calculate_term_structure(
            symbol=symbol.upper(),
            expirations=expirations,
            atm_ivs=atm_ivs,
        )
        
        result = term_structure.to_dict()
        return TermStructureResponse(**result)
        
    except Exception as e:
        logger.error("term_structure_error", symbol=symbol, error=str(e))
        return TermStructureResponse(
            symbol=symbol.upper(),
            expirations=[],
            days_to_expiration=[],
            ivs=[],
            structure_type="flat",
            unavailable=f"Error calculating term structure: {str(e)}",
        )


@router.get("/pcr/{symbol}", response_model=PutCallRatioResponse)
async def get_put_call_ratio(symbol: str):
    """
    Get Put/Call ratio for a symbol
    
    Returns both volume-based and open interest-based PCR
    """
    logger.info("pcr_request", symbol=symbol)
    
    try:
        adapter = get_options_adapter()
        chain = adapter.get_chain(symbol)
        
        if chain is None:
            return PutCallRatioResponse(
                symbol=symbol.upper(),
                volume_pcr=0.0,
                oi_pcr=0.0,
                total_put_volume=0,
                total_call_volume=0,
                total_put_oi=0,
                total_call_oi=0,
                timestamp=datetime.utcnow().isoformat(),
                unavailable=f"Options data unavailable for {symbol}",
            )
        
        pcr = adapter.get_put_call_ratio(chain)
        result = pcr.to_dict()
        
        return PutCallRatioResponse(**result)
        
    except Exception as e:
        logger.error("pcr_error", symbol=symbol, error=str(e))
        return PutCallRatioResponse(
            symbol=symbol.upper(),
            volume_pcr=0.0,
            oi_pcr=0.0,
            total_put_volume=0,
            total_call_volume=0,
            total_put_oi=0,
            total_call_oi=0,
            timestamp=datetime.utcnow().isoformat(),
            unavailable=f"Error calculating PCR: {str(e)}",
        )


# ============================================================================
# Strategy Endpoints
# ============================================================================

@router.get("/strategies/templates", response_model=List[StrategyTemplateResponse])
async def get_strategy_templates():
    """
    Get all available strategy templates
    
    Returns list of pre-defined strategy types
    """
    factory = get_strategy_factory()
    templates = factory.get_templates()
    return [
        StrategyTemplateResponse(
            name=t.name,
            description=t.description,
            category=t.category,
            max_profit=t.max_profit,
            max_loss=t.max_loss,
            legs_description=t.legs_description,
        )
        for t in templates
    ]


@router.post("/strategies/analyze", response_model=StrategyAnalysisResponse)
async def analyze_strategy(request: StrategyAnalyzeRequest):
    """
    Analyze a custom options strategy
    
    Provide legs and underlying price to get payoff curves and Greeks
    """
    logger.info("strategy_analyze_request", 
                name=request.strategy_name, 
                num_legs=len(request.legs))
    
    try:
        factory = get_strategy_factory()
        
        legs = []
        for leg in request.legs:
            pos = PositionType.LONG if leg.position.lower() == "long" else PositionType.SHORT
            legs.append(StrategyLeg(
                option_type=leg.option_type.lower(),
                position=pos,
                strike=leg.strike,
                premium=leg.premium,
                quantity=leg.quantity,
                expiration_days=leg.expiration_days,
                iv=leg.iv,
            ))
        
        analysis = factory.analyze_strategy(
            legs=legs,
            underlying_price=request.underlying_price,
            strategy_name=request.strategy_name,
        )
        
        return StrategyAnalysisResponse(
            name=analysis.name,
            legs=[
                StrategyLegResponse(
                    option_type=l.option_type,
                    position=l.position.value,
                    strike=l.strike,
                    premium=l.premium,
                    quantity=l.quantity,
                    expiration_days=l.expiration_days,
                    iv=l.iv,
                )
                for l in analysis.legs
            ],
            underlying_price=analysis.underlying_price,
            price_range=analysis.price_range,
            expiration_payoff=analysis.expiration_payoff,
            theoretical_payoff=analysis.theoretical_payoff,
            max_profit=analysis.max_profit if analysis.max_profit != float('inf') else 999999999,
            max_loss=analysis.max_loss if analysis.max_loss != float('-inf') else -999999999,
            breakevens=analysis.breakevens,
            net_delta=analysis.net_delta,
            net_gamma=analysis.net_gamma,
            net_theta=analysis.net_theta,
            net_vega=analysis.net_vega,
        )
        
    except Exception as e:
        logger.error("strategy_analyze_error", error=str(e))
        raise HTTPException(500, f"Strategy analysis failed: {str(e)}")


@router.post("/strategies/covered-call", response_model=StrategyAnalysisResponse)
async def build_covered_call(request: CoveredCallRequest):
    """Build and analyze a covered call strategy"""
    factory = get_strategy_factory()
    analysis = factory.build_covered_call(
        underlying_price=request.underlying_price,
        call_strike=request.call_strike,
        call_premium=request.call_premium,
        expiration_days=request.expiration_days,
        iv=request.iv,
    )
    
    return StrategyAnalysisResponse(
        name=analysis.name,
        legs=[
            StrategyLegResponse(
                option_type=l.option_type,
                position=l.position.value,
                strike=l.strike,
                premium=l.premium,
                quantity=l.quantity,
                expiration_days=l.expiration_days,
                iv=l.iv,
            )
            for l in analysis.legs
        ],
        underlying_price=analysis.underlying_price,
        price_range=analysis.price_range,
        expiration_payoff=analysis.expiration_payoff,
        theoretical_payoff=analysis.theoretical_payoff,
        max_profit=analysis.max_profit if analysis.max_profit != float('inf') else 999999999,
        max_loss=analysis.max_loss,
        breakevens=analysis.breakevens,
        net_delta=analysis.net_delta,
        net_gamma=analysis.net_gamma,
        net_theta=analysis.net_theta,
        net_vega=analysis.net_vega,
    )


@router.post("/strategies/iron-condor", response_model=StrategyAnalysisResponse)
async def build_iron_condor(request: IronCondorRequest):
    """Build and analyze an iron condor strategy"""
    factory = get_strategy_factory()
    analysis = factory.build_iron_condor(
        underlying_price=request.underlying_price,
        put_long_strike=request.put_long_strike,
        put_long_premium=request.put_long_premium,
        put_short_strike=request.put_short_strike,
        put_short_premium=request.put_short_premium,
        call_short_strike=request.call_short_strike,
        call_short_premium=request.call_short_premium,
        call_long_strike=request.call_long_strike,
        call_long_premium=request.call_long_premium,
        expiration_days=request.expiration_days,
        iv=request.iv,
    )
    
    return StrategyAnalysisResponse(
        name=analysis.name,
        legs=[
            StrategyLegResponse(
                option_type=l.option_type,
                position=l.position.value,
                strike=l.strike,
                premium=l.premium,
                quantity=l.quantity,
                expiration_days=l.expiration_days,
                iv=l.iv,
            )
            for l in analysis.legs
        ],
        underlying_price=analysis.underlying_price,
        price_range=analysis.price_range,
        expiration_payoff=analysis.expiration_payoff,
        theoretical_payoff=analysis.theoretical_payoff,
        max_profit=analysis.max_profit,
        max_loss=analysis.max_loss,
        breakevens=analysis.breakevens,
        net_delta=analysis.net_delta,
        net_gamma=analysis.net_gamma,
        net_theta=analysis.net_theta,
        net_vega=analysis.net_vega,
    )


@router.post("/strategies/straddle", response_model=StrategyAnalysisResponse)
async def build_straddle(request: StraddleRequest):
    """Build and analyze a straddle strategy"""
    factory = get_strategy_factory()
    analysis = factory.build_straddle(
        underlying_price=request.underlying_price,
        strike=request.strike,
        call_premium=request.call_premium,
        put_premium=request.put_premium,
        expiration_days=request.expiration_days,
        iv=request.iv,
        is_long=request.is_long,
    )
    
    return StrategyAnalysisResponse(
        name=analysis.name,
        legs=[
            StrategyLegResponse(
                option_type=l.option_type,
                position=l.position.value,
                strike=l.strike,
                premium=l.premium,
                quantity=l.quantity,
                expiration_days=l.expiration_days,
                iv=l.iv,
            )
            for l in analysis.legs
        ],
        underlying_price=analysis.underlying_price,
        price_range=analysis.price_range,
        expiration_payoff=analysis.expiration_payoff,
        theoretical_payoff=analysis.theoretical_payoff,
        max_profit=analysis.max_profit if analysis.max_profit != float('inf') else 999999999,
        max_loss=analysis.max_loss,
        breakevens=analysis.breakevens,
        net_delta=analysis.net_delta,
        net_gamma=analysis.net_gamma,
        net_theta=analysis.net_theta,
        net_vega=analysis.net_vega,
    )


@router.post("/strategies/vertical-spread", response_model=StrategyAnalysisResponse)
async def build_vertical_spread(request: VerticalSpreadRequest):
    """Build and analyze a vertical spread strategy"""
    factory = get_strategy_factory()
    analysis = factory.build_vertical_spread(
        underlying_price=request.underlying_price,
        long_strike=request.long_strike,
        long_premium=request.long_premium,
        short_strike=request.short_strike,
        short_premium=request.short_premium,
        option_type=request.option_type,
        expiration_days=request.expiration_days,
        iv=request.iv,
    )
    
    return StrategyAnalysisResponse(
        name=analysis.name,
        legs=[
            StrategyLegResponse(
                option_type=l.option_type,
                position=l.position.value,
                strike=l.strike,
                premium=l.premium,
                quantity=l.quantity,
                expiration_days=l.expiration_days,
                iv=l.iv,
            )
            for l in analysis.legs
        ],
        underlying_price=analysis.underlying_price,
        price_range=analysis.price_range,
        expiration_payoff=analysis.expiration_payoff,
        theoretical_payoff=analysis.theoretical_payoff,
        max_profit=analysis.max_profit,
        max_loss=analysis.max_loss,
        breakevens=analysis.breakevens,
        net_delta=analysis.net_delta,
        net_gamma=analysis.net_gamma,
        net_theta=analysis.net_theta,
        net_vega=analysis.net_vega,
    )
