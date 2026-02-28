"""
FastAPI routes for CrossAssetEngine — correlations, risk regimes, carry trade, momentum.
"""
from __future__ import annotations

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services.cross_asset_engine import (
    CrossAssetEngine,
    AssetReturn,
    AssetClass,
    RiskRegime,
)

router = APIRouter(prefix="/api/cross-asset", tags=["Cross Asset"])
_engine = CrossAssetEngine()


# ─── Request / Response Models ────────────────────────────────────────────────

class AssetInput(BaseModel):
    symbol: str = Field(..., description="Asset ticker or identifier")
    asset_class: str = Field(..., description="Asset class: equity|fixed_income|fx|commodity|crypto|real_estate|alternative")
    returns: List[float] = Field(default_factory=list, description="Daily return series")
    yield_rate: float = Field(0.0, description="Current yield or dividend yield")
    carry: float = Field(0.0, description="Carry (rate differential or expected roll return)")
    volatility_series: List[float] = Field(default_factory=list, description="Daily realized vol series")


class AssetsRequest(BaseModel):
    assets: List[AssetInput] = Field(..., min_items=2, description="Asset universe")


class RiskRegimeRequest(BaseModel):
    equity_symbol: str = Field(..., description="Equity asset symbol")
    bond_symbol: str = Field(..., description="Bond asset symbol")
    assets: List[AssetInput]


class RollingCorrelationRequest(BaseModel):
    symbol_a: str = Field(..., description="First asset symbol")
    symbol_b: str = Field(..., description="Second asset symbol")
    assets: List[AssetInput]
    window: int = Field(21, ge=5, le=252, description="Rolling window in days")


class FedModelRequest(BaseModel):
    equity_symbol: str = Field(..., description="Equity asset for earnings yield")
    bond_10y_yield: float = Field(..., description="Current 10-year Treasury yield")
    assets: List[AssetInput]


class FXCarryRequest(BaseModel):
    domestic_rate: float = Field(..., description="Domestic interest rate")
    foreign_rate: float = Field(..., description="Foreign interest rate")
    spot_returns: List[float] = Field(..., description="Historical spot return series")


class FullViewRequest(BaseModel):
    assets: List[AssetInput]
    bond_10y_yield: float = Field(0.045, description="10-year Treasury yield for Fed Model")
    equity_symbol: Optional[str] = Field(None, description="Equity symbol for Fed Model (auto-detected if null)")


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _parse_asset(inp: AssetInput) -> AssetReturn:
    ac_map = {a.value: a for a in AssetClass}
    ac = ac_map.get(inp.asset_class.lower(), AssetClass.EQUITY)
    return AssetReturn(
        symbol=inp.symbol,
        asset_class=ac,
        returns=inp.returns,
        yield_rate=inp.yield_rate,
        carry=inp.carry,
        volatility_series=inp.volatility_series,
    )


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/capabilities")
def get_capabilities():
    """Return engine capabilities and supported asset classes."""
    return _engine.capabilities()


@router.post("/correlation-matrix")
def correlation_matrix(body: AssetsRequest):
    """Compute cross-asset return correlation matrix."""
    try:
        assets = [_parse_asset(a) for a in body.assets]
        matrix = _engine.correlation_matrix(assets)
        # Compute average pairwise correlation
        all_vals = []
        keys = list(matrix.keys())
        for i in range(len(keys)):
            for j in range(i + 1, len(keys)):
                all_vals.append(matrix[keys[i]][keys[j]])
        avg_corr = sum(all_vals) / len(all_vals) if all_vals else 0.0
        return {
            "asset_count": len(assets),
            "matrix": matrix,
            "avg_pairwise_correlation": round(avg_corr, 6),
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/rolling-correlation")
def rolling_correlation(body: RollingCorrelationRequest):
    """Compute rolling correlation between two assets over time."""
    try:
        asset_map = {a.symbol: _parse_asset(a) for a in body.assets}
        a = asset_map.get(body.symbol_a)
        b = asset_map.get(body.symbol_b)
        if a is None or b is None:
            raise HTTPException(status_code=404, detail="One or both symbols not found in assets list")
        from services.cross_asset_engine import CrossAssetCorrelation
        rolling = CrossAssetCorrelation.rolling_correlation(a, b, body.window)
        return {
            "symbol_a": body.symbol_a,
            "symbol_b": body.symbol_b,
            "window": body.window,
            "rolling_correlations": rolling,
            "latest": round(rolling[-1], 6) if rolling else None,
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/risk-regime")
def risk_regime(body: RiskRegimeRequest):
    """Detect current risk-on / risk-off regime using multi-signal scoring."""
    try:
        asset_map = {a.symbol: _parse_asset(a) for a in body.assets}
        equity = asset_map.get(body.equity_symbol)
        bond = asset_map.get(body.bond_symbol)
        if equity is None:
            raise HTTPException(status_code=404, detail=f"Equity symbol '{body.equity_symbol}' not found")
        if bond is None:
            raise HTTPException(status_code=404, detail=f"Bond symbol '{body.bond_symbol}' not found")
        score = _engine.risk_regime(equity, bond)
        regime = "risk_on" if score > 25 else "risk_off" if score < -25 else "neutral"
        return {
            "equity_symbol": body.equity_symbol,
            "bond_symbol": body.bond_symbol,
            "risk_on_score": round(score, 2),
            "regime": regime,
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/carry-ranking")
def carry_ranking(body: AssetsRequest):
    """Rank assets by carry (yield + expected roll)."""
    try:
        assets = [_parse_asset(a) for a in body.assets]
        result = _engine.carry_ranking(assets)
        return {"count": len(result), "rankings": result}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/fx-carry")
def fx_carry(body: FXCarryRequest):
    """Analyze FX carry trade attractiveness between two currencies."""
    try:
        from services.cross_asset_engine import CarryTradeAnalyzer
        result = CarryTradeAnalyzer.fx_carry(
            body.domestic_rate, body.foreign_rate, body.spot_returns
        )
        return result
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/fed-model")
def fed_model(body: FedModelRequest):
    """Evaluate equity vs bond attractiveness using the Fed Model."""
    try:
        asset_map = {a.symbol: _parse_asset(a) for a in body.assets}
        equity = asset_map.get(body.equity_symbol)
        if equity is None:
            raise HTTPException(status_code=404, detail=f"Equity symbol '{body.equity_symbol}' not found")
        result = _engine.fed_model(equity, body.bond_10y_yield)
        return result
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/flight-to-safety")
def flight_to_safety(body: AssetsRequest):
    """Detect flight-to-safety flows across asset classes."""
    try:
        assets = [_parse_asset(a) for a in body.assets]
        result = _engine.flight_to_safety(assets)
        if not result:
            raise HTTPException(status_code=422, detail="Insufficient data or no safe-haven assets provided")
        return result
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/momentum-ranking")
def momentum_ranking(body: AssetsRequest):
    """Rank assets by 12-month minus 1-month time-series momentum."""
    try:
        assets = [_parse_asset(a) for a in body.assets]
        result = _engine.momentum_ranking(assets)
        return {"count": len(result), "rankings": result}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/full-view")
def full_cross_asset_view(body: FullViewRequest):
    """Generate a complete cross-asset dashboard view."""
    try:
        assets = [_parse_asset(a) for a in body.assets]
        equity_sym = body.equity_symbol
        if equity_sym is None:
            # auto-detect first equity
            for a in assets:
                if a.asset_class == AssetClass.EQUITY:
                    equity_sym = a.symbol
                    break
        result = _engine.full_cross_asset_view(assets, body.bond_10y_yield, equity_sym)
        return result
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
