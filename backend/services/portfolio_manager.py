"""
Portfolio Manager Engine — §5.1–§5.4
=====================================
Full portfolio management: construction, risk analytics, performance
attribution, optimization (mean-variance, Black-Litterman, risk parity).

Uses Polygon/Alpaca for real portfolio data + yfinance as fallback.
"""

import os
import math
import logging
import asyncio
import random
from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from dataclasses import dataclass, field, asdict
from enum import Enum
from collections import defaultdict

import httpx

logger = logging.getLogger("portfolio_manager")

POLYGON_KEY = os.getenv("POLYGON_API_KEY", "")
ALPACA_KEY = os.getenv("ALPACA_API_KEY", "")
ALPACA_SECRET = os.getenv("ALPACA_SECRET_KEY", "")
ALPACA_BASE = os.getenv("ALPACA_BASE_URL", "https://paper-api.alpaca.markets")
FRED_KEY = os.getenv("FRED_API_KEY", "")

RISK_FREE_RATE = 0.052
TRADING_DAYS = 252


# ═══════════════════════════════════════════════════════════════════════════════
# §5.1 — PORTFOLIO CONSTRUCTION
# ═══════════════════════════════════════════════════════════════════════════════

class AssetClass(str, Enum):
    EQUITY = "equity"
    FIXED_INCOME = "fixed_income"
    COMMODITY = "commodity"
    FX = "fx"
    CRYPTO = "crypto"
    REAL_ESTATE = "real_estate"
    ALTERNATIVES = "alternatives"
    CASH = "cash"


class Sector(str, Enum):
    TECHNOLOGY = "technology"
    HEALTHCARE = "healthcare"
    FINANCIALS = "financials"
    CONSUMER_DISC = "consumer_discretionary"
    CONSUMER_STAPLES = "consumer_staples"
    INDUSTRIALS = "industrials"
    ENERGY = "energy"
    MATERIALS = "materials"
    UTILITIES = "utilities"
    REAL_ESTATE = "real_estate"
    COMMUNICATION = "communication_services"


@dataclass
class Position:
    symbol: str
    quantity: float
    avg_cost: float
    current_price: float = 0.0
    market_value: float = 0.0
    unrealized_pnl: float = 0.0
    unrealized_pnl_pct: float = 0.0
    weight: float = 0.0
    asset_class: str = "equity"
    sector: str = ""
    beta: float = 1.0
    daily_return: float = 0.0
    cumulative_return: float = 0.0
    cost_basis: float = 0.0
    side: str = "long"


@dataclass
class Portfolio:
    name: str = "Default"
    positions: list = field(default_factory=list)
    cash: float = 0.0
    total_value: float = 0.0
    total_cost: float = 0.0
    total_pnl: float = 0.0
    total_pnl_pct: float = 0.0
    num_positions: int = 0
    created_at: str = ""
    updated_at: str = ""
    benchmark: str = "SPY"

    # Risk metrics
    portfolio_beta: float = 0.0
    portfolio_volatility: float = 0.0
    sharpe_ratio: float = 0.0
    sortino_ratio: float = 0.0
    max_drawdown: float = 0.0
    calmar_ratio: float = 0.0
    treynor_ratio: float = 0.0
    information_ratio: float = 0.0
    tracking_error: float = 0.0
    var_95: float = 0.0
    cvar_95: float = 0.0

    # Allocations
    sector_allocation: dict = field(default_factory=dict)
    asset_class_allocation: dict = field(default_factory=dict)
    geographic_allocation: dict = field(default_factory=dict)
    concentration_risk: dict = field(default_factory=dict)


class PortfolioBuilder:
    """Build and manage portfolio from multiple data sources."""

    def __init__(self):
        self._http: Optional[httpx.AsyncClient] = None

    async def _get_http(self) -> httpx.AsyncClient:
        if self._http is None or self._http.is_closed:
            self._http = httpx.AsyncClient(timeout=20.0)
        return self._http

    async def fetch_alpaca_positions(self) -> list[dict]:
        """Fetch positions from Alpaca paper account."""
        if not ALPACA_KEY or not ALPACA_SECRET:
            return []

        http = await self._get_http()
        headers = {
            "APCA-API-KEY-ID": ALPACA_KEY,
            "APCA-API-SECRET-KEY": ALPACA_SECRET,
        }

        try:
            resp = await http.get(f"{ALPACA_BASE}/v2/positions", headers=headers)
            if resp.status_code != 200:
                logger.warning(f"Alpaca positions failed: {resp.status_code}")
                return []
            return resp.json()
        except Exception as e:
            logger.warning(f"Alpaca positions error: {e}")
            return []

    async def fetch_alpaca_account(self) -> dict:
        """Fetch Alpaca account summary."""
        if not ALPACA_KEY or not ALPACA_SECRET:
            return {}

        http = await self._get_http()
        headers = {
            "APCA-API-KEY-ID": ALPACA_KEY,
            "APCA-API-SECRET-KEY": ALPACA_SECRET,
        }

        try:
            resp = await http.get(f"{ALPACA_BASE}/v2/account", headers=headers)
            return resp.json()
        except Exception as e:
            logger.warning(f"Alpaca account error: {e}")
            return {}

    async def build_portfolio(self) -> Portfolio:
        """Build portfolio from Alpaca or demo data."""
        positions = await self.fetch_alpaca_positions()
        account = await self.fetch_alpaca_account()

        portfolio = Portfolio(
            name="Live Portfolio" if positions else "Demo Portfolio",
            created_at=datetime.now(timezone.utc).isoformat(),
            updated_at=datetime.now(timezone.utc).isoformat(),
        )

        if positions:
            portfolio.cash = float(account.get("cash", 0))
            for p in positions:
                pos = Position(
                    symbol=p.get("symbol", ""),
                    quantity=float(p.get("qty", 0)),
                    avg_cost=float(p.get("avg_entry_price", 0)),
                    current_price=float(p.get("current_price", 0)),
                    market_value=float(p.get("market_value", 0)),
                    unrealized_pnl=float(p.get("unrealized_pl", 0)),
                    unrealized_pnl_pct=float(p.get("unrealized_plpc", 0)) * 100,
                    side=p.get("side", "long"),
                    cost_basis=float(p.get("cost_basis", 0)),
                )
                portfolio.positions.append(pos)
        else:
            portfolio = await self._build_demo_portfolio()

        # Calculate aggregates
        total_market_value = sum(p.market_value for p in portfolio.positions) + portfolio.cash
        portfolio.total_value = total_market_value
        portfolio.total_cost = sum(p.cost_basis or (p.avg_cost * p.quantity) for p in portfolio.positions)
        portfolio.total_pnl = portfolio.total_value - portfolio.total_cost
        portfolio.total_pnl_pct = (portfolio.total_pnl / portfolio.total_cost * 100) if portfolio.total_cost > 0 else 0
        portfolio.num_positions = len(portfolio.positions)

        # Calculate weights
        for p in portfolio.positions:
            p.weight = p.market_value / total_market_value if total_market_value > 0 else 0

        # Calculate allocations
        portfolio.sector_allocation = self._calc_sector_allocation(portfolio.positions)
        portfolio.asset_class_allocation = self._calc_asset_class_allocation(portfolio.positions)
        portfolio.concentration_risk = self._calc_concentration_risk(portfolio.positions)

        return portfolio

    async def _build_demo_portfolio(self) -> Portfolio:
        """Build a demo portfolio with typical holdings."""
        demo_holdings = [
            ("AAPL", 50, 172.50, "technology"),
            ("MSFT", 30, 378.20, "technology"),
            ("GOOGL", 20, 141.80, "communication_services"),
            ("AMZN", 25, 178.90, "consumer_discretionary"),
            ("NVDA", 40, 495.20, "technology"),
            ("META", 15, 505.10, "communication_services"),
            ("JPM", 35, 198.40, "financials"),
            ("JNJ", 20, 157.30, "healthcare"),
            ("V", 25, 278.60, "financials"),
            ("PG", 30, 162.40, "consumer_staples"),
            ("XOM", 40, 105.80, "energy"),
            ("UNH", 10, 528.70, "healthcare"),
            ("HD", 15, 368.90, "consumer_discretionary"),
            ("BAC", 60, 34.20, "financials"),
            ("DIS", 20, 112.50, "communication_services"),
            ("TSLA", 15, 248.50, "consumer_discretionary"),
            ("BRK.B", 12, 412.80, "financials"),
            ("LLY", 8, 788.30, "healthcare"),
            ("AVGO", 10, 1,285.40, "technology"),
            ("SPY", 20, 505.20, "equity_etf"),
        ]

        positions = []
        for symbol, qty, price, sector in demo_holdings:
            # Simulate cost basis as slightly different
            cost_mult = random.uniform(0.85, 1.15)
            avg_cost = price * cost_mult
            mv = qty * price
            pnl = mv - qty * avg_cost

            positions.append(Position(
                symbol=symbol,
                quantity=qty,
                avg_cost=round(avg_cost, 2),
                current_price=price,
                market_value=round(mv, 2),
                unrealized_pnl=round(pnl, 2),
                unrealized_pnl_pct=round((price / avg_cost - 1) * 100, 2),
                sector=sector,
                cost_basis=round(qty * avg_cost, 2),
                asset_class="equity",
            ))

        return Portfolio(
            positions=positions,
            cash=25000.0,
            name="Demo Portfolio",
        )

    def _calc_sector_allocation(self, positions: list[Position]) -> dict:
        alloc = defaultdict(float)
        total = sum(p.market_value for p in positions)
        if total <= 0:
            return {}
        for p in positions:
            sector = p.sector or "unknown"
            alloc[sector] += p.market_value
        return {s: round(v / total * 100, 2) for s, v in sorted(alloc.items(), key=lambda x: -x[1])}

    def _calc_asset_class_allocation(self, positions: list[Position]) -> dict:
        alloc = defaultdict(float)
        total = sum(p.market_value for p in positions)
        if total <= 0:
            return {}
        for p in positions:
            ac = p.asset_class or "equity"
            alloc[ac] += p.market_value
        return {ac: round(v / total * 100, 2) for ac, v in sorted(alloc.items(), key=lambda x: -x[1])}

    def _calc_concentration_risk(self, positions: list[Position]) -> dict:
        total = sum(p.market_value for p in positions)
        if total <= 0 or not positions:
            return {}

        weights = sorted([(p.symbol, p.market_value / total) for p in positions], key=lambda x: -x[1])

        hhi = sum(w[1] ** 2 for w in weights) * 10000
        top1 = weights[0][1] * 100 if weights else 0
        top5 = sum(w[1] for w in weights[:5]) * 100
        top10 = sum(w[1] for w in weights[:10]) * 100

        effective_n = 1 / sum(w[1] ** 2 for w in weights) if weights else 0

        return {
            "hhi": round(hhi, 1),
            "top_1_pct": round(top1, 2),
            "top_5_pct": round(top5, 2),
            "top_10_pct": round(top10, 2),
            "effective_positions": round(effective_n, 1),
            "total_positions": len(positions),
        }


# ═══════════════════════════════════════════════════════════════════════════════
# §5.2 — RISK ANALYTICS
# ═══════════════════════════════════════════════════════════════════════════════

class PortfolioRiskAnalytics:
    """Calculate comprehensive portfolio risk metrics."""

    def __init__(self):
        self._http: Optional[httpx.AsyncClient] = None
        self._returns_cache: dict[str, list[float]] = {}

    async def _get_http(self) -> httpx.AsyncClient:
        if self._http is None or self._http.is_closed:
            self._http = httpx.AsyncClient(timeout=20.0)
        return self._http

    async def _fetch_returns(self, symbol: str, days: int = 252) -> list[float]:
        """Fetch historical daily returns."""
        if symbol in self._returns_cache:
            return self._returns_cache[symbol]

        # Try Polygon
        if POLYGON_KEY:
            try:
                http = await self._get_http()
                end = datetime.now().strftime("%Y-%m-%d")
                start = (datetime.now() - timedelta(days=days * 2)).strftime("%Y-%m-%d")
                url = f"https://api.polygon.io/v2/aggs/ticker/{symbol}/range/1/day/{start}/{end}?adjusted=true&sort=asc&limit={days}&apiKey={POLYGON_KEY}"
                resp = await http.get(url)
                data = resp.json()
                results = data.get("results", [])
                if results:
                    prices = [r["c"] for r in results]
                    returns = [(prices[i] / prices[i - 1] - 1) for i in range(1, len(prices))]
                    self._returns_cache[symbol] = returns
                    return returns
            except Exception as e:
                logger.warning(f"Polygon returns failed for {symbol}: {e}")

        # yfinance fallback
        try:
            import concurrent.futures
            def _yf_fetch():
                import yfinance as yf
                ticker = yf.Ticker(symbol)
                hist = ticker.history(period=f"{days}d")
                if hist.empty:
                    return []
                prices = hist["Close"].tolist()
                return [(prices[i] / prices[i - 1] - 1) for i in range(1, len(prices))]

            loop = asyncio.get_event_loop()
            with concurrent.futures.ThreadPoolExecutor() as pool:
                returns = await loop.run_in_executor(pool, _yf_fetch)
            self._returns_cache[symbol] = returns
            return returns
        except Exception as e:
            logger.warning(f"yfinance returns failed for {symbol}: {e}")
            # Generate synthetic returns
            returns = [random.gauss(0.0004, 0.02) for _ in range(min(days, 252))]
            self._returns_cache[symbol] = returns
            return returns

    def _mean(self, arr: list[float]) -> float:
        return sum(arr) / len(arr) if arr else 0

    def _std(self, arr: list[float]) -> float:
        if len(arr) < 2:
            return 0
        m = self._mean(arr)
        return math.sqrt(sum((x - m) ** 2 for x in arr) / (len(arr) - 1))

    def _covariance(self, a: list[float], b: list[float]) -> float:
        n = min(len(a), len(b))
        if n < 2:
            return 0
        ma, mb = self._mean(a[:n]), self._mean(b[:n])
        return sum((a[i] - ma) * (b[i] - mb) for i in range(n)) / (n - 1)

    def _correlation(self, a: list[float], b: list[float]) -> float:
        sa, sb = self._std(a), self._std(b)
        if sa == 0 or sb == 0:
            return 0
        return self._covariance(a, b) / (sa * sb)

    async def calculate_beta(self, symbol: str, benchmark: str = "SPY") -> float:
        """Calculate beta relative to benchmark."""
        sym_returns = await self._fetch_returns(symbol)
        bench_returns = await self._fetch_returns(benchmark)
        n = min(len(sym_returns), len(bench_returns))
        if n < 10:
            return 1.0

        cov = self._covariance(sym_returns[:n], bench_returns[:n])
        var = self._std(bench_returns[:n]) ** 2
        return round(cov / var, 4) if var > 0 else 1.0

    async def calculate_portfolio_metrics(self, portfolio: Portfolio) -> dict:
        """Calculate comprehensive portfolio risk metrics."""
        if not portfolio.positions:
            return {}

        # Fetch returns for all positions
        symbols = [p.symbol for p in portfolio.positions]
        weights = [p.weight for p in portfolio.positions]

        all_returns = {}
        for symbol in symbols:
            all_returns[symbol] = await self._fetch_returns(symbol)

        # Benchmark returns
        bench_returns = await self._fetch_returns(portfolio.benchmark)

        # Portfolio daily returns (weighted sum of position returns)
        min_len = min(len(r) for r in all_returns.values()) if all_returns else 0
        min_len = min(min_len, len(bench_returns)) if bench_returns else min_len

        port_returns = []
        for i in range(min_len):
            day_return = sum(
                weights[j] * all_returns[symbols[j]][i]
                for j in range(len(symbols))
                if i < len(all_returns[symbols[j]])
            )
            port_returns.append(day_return)

        if not port_returns:
            return {}

        # Annualized return
        cumulative = 1.0
        for r in port_returns:
            cumulative *= (1 + r)
        annualized_return = cumulative ** (TRADING_DAYS / len(port_returns)) - 1

        # Volatility
        daily_vol = self._std(port_returns)
        annual_vol = daily_vol * math.sqrt(TRADING_DAYS)

        # Sharpe Ratio
        sharpe = (annualized_return - RISK_FREE_RATE) / annual_vol if annual_vol > 0 else 0

        # Sortino Ratio (downside deviation)
        downside_returns = [r for r in port_returns if r < 0]
        downside_dev = self._std(downside_returns) * math.sqrt(TRADING_DAYS) if downside_returns else daily_vol * math.sqrt(TRADING_DAYS)
        sortino = (annualized_return - RISK_FREE_RATE) / downside_dev if downside_dev > 0 else 0

        # Max Drawdown
        cumulative_values = [1.0]
        for r in port_returns:
            cumulative_values.append(cumulative_values[-1] * (1 + r))
        peak = cumulative_values[0]
        max_dd = 0
        for v in cumulative_values:
            peak = max(peak, v)
            dd = (peak - v) / peak
            max_dd = max(max_dd, dd)

        # Calmar Ratio
        calmar = annualized_return / max_dd if max_dd > 0 else 0

        # Portfolio Beta
        port_bench_cov = self._covariance(port_returns[:min_len], bench_returns[:min_len])
        bench_var = self._std(bench_returns[:min_len]) ** 2
        portfolio_beta = port_bench_cov / bench_var if bench_var > 0 else 1.0

        # Treynor Ratio
        treynor = (annualized_return - RISK_FREE_RATE) / portfolio_beta if portfolio_beta != 0 else 0

        # Tracking Error & Information Ratio
        excess_returns = [port_returns[i] - bench_returns[i] for i in range(min_len)]
        tracking_error = self._std(excess_returns) * math.sqrt(TRADING_DAYS)
        info_ratio = self._mean(excess_returns) * TRADING_DAYS / tracking_error if tracking_error > 0 else 0

        # VaR (95% confidence, parametric)
        var_95 = -(self._mean(port_returns) - 1.645 * daily_vol) * portfolio.total_value
        var_99 = -(self._mean(port_returns) - 2.326 * daily_vol) * portfolio.total_value

        # CVaR (Expected Shortfall)
        sorted_returns = sorted(port_returns)
        cutoff = int(len(sorted_returns) * 0.05)
        worst_returns = sorted_returns[:max(cutoff, 1)]
        cvar_95 = -self._mean(worst_returns) * portfolio.total_value

        # Historical VaR
        historical_var_95 = -sorted_returns[max(cutoff - 1, 0)] * portfolio.total_value

        # R-squared
        corr = self._correlation(port_returns[:min_len], bench_returns[:min_len])
        r_squared = corr ** 2

        return {
            "annualized_return": round(annualized_return * 100, 2),
            "annualized_volatility": round(annual_vol * 100, 2),
            "daily_volatility": round(daily_vol * 100, 4),
            "sharpe_ratio": round(sharpe, 3),
            "sortino_ratio": round(sortino, 3),
            "max_drawdown": round(max_dd * 100, 2),
            "calmar_ratio": round(calmar, 3),
            "portfolio_beta": round(portfolio_beta, 3),
            "treynor_ratio": round(treynor, 4),
            "tracking_error": round(tracking_error * 100, 2),
            "information_ratio": round(info_ratio, 3),
            "r_squared": round(r_squared, 3),
            "var_95_1d": round(var_95, 2),
            "var_99_1d": round(var_99, 2),
            "cvar_95_1d": round(cvar_95, 2),
            "historical_var_95": round(historical_var_95, 2),
            "risk_free_rate": RISK_FREE_RATE,
            "observation_days": len(port_returns),
        }

    async def calculate_correlation_matrix(self, symbols: list[str]) -> dict:
        """Calculate correlation matrix for a set of symbols."""
        all_returns = {}
        for sym in symbols:
            all_returns[sym] = await self._fetch_returns(sym)

        n = len(symbols)
        matrix = [[0.0] * n for _ in range(n)]

        for i in range(n):
            for j in range(n):
                if i == j:
                    matrix[i][j] = 1.0
                elif i < j:
                    corr = self._correlation(all_returns[symbols[i]], all_returns[symbols[j]])
                    matrix[i][j] = round(corr, 4)
                    matrix[j][i] = round(corr, 4)

        return {
            "symbols": symbols,
            "matrix": matrix,
        }

    async def calculate_covariance_matrix(self, symbols: list[str]) -> dict:
        """Calculate annualized covariance matrix."""
        all_returns = {}
        for sym in symbols:
            all_returns[sym] = await self._fetch_returns(sym)

        n = len(symbols)
        matrix = [[0.0] * n for _ in range(n)]

        for i in range(n):
            for j in range(n):
                cov = self._covariance(all_returns[symbols[i]], all_returns[symbols[j]]) * TRADING_DAYS
                matrix[i][j] = round(cov, 8)

        return {
            "symbols": symbols,
            "matrix": matrix,
        }


# ═══════════════════════════════════════════════════════════════════════════════
# §5.3 — PERFORMANCE ATTRIBUTION (Brinson)
# ═══════════════════════════════════════════════════════════════════════════════

class PerformanceAttribution:
    """Brinson-Fachler performance attribution model."""

    def __init__(self, risk_analytics: PortfolioRiskAnalytics):
        self.risk = risk_analytics

    async def brinson_attribution(self, portfolio: Portfolio, benchmark_weights: dict,
                                   benchmark_returns: dict) -> dict:
        """
        Brinson-Fachler attribution:
        - Allocation effect
        - Selection effect
        - Interaction effect
        """
        sectors = set()
        port_sector_weights = defaultdict(float)
        port_sector_returns = defaultdict(list)

        for pos in portfolio.positions:
            sector = pos.sector or "unknown"
            sectors.add(sector)
            port_sector_weights[sector] += pos.weight
            returns = await self.risk._fetch_returns(pos.symbol, 20)
            if returns:
                daily_ret = self.risk._mean(returns)
                port_sector_returns[sector].append((pos.weight, daily_ret))

        # Calculate sector-level portfolio returns
        total_port_return = 0.0
        total_bench_return = 0.0
        attribution_detail = []

        for sector in sectors:
            wp = port_sector_weights.get(sector, 0)
            wb = benchmark_weights.get(sector, 0)
            rp = 0
            if port_sector_returns[sector]:
                total_w = sum(w for w, _ in port_sector_returns[sector])
                if total_w > 0:
                    rp = sum(w * r for w, r in port_sector_returns[sector]) / total_w
            rb = benchmark_returns.get(sector, 0)

            # Overall benchmark return
            total_bench_return_for_sector = sum(wb * rb for s, (wb, rb) in
                                                 [(s, (benchmark_weights.get(s, 0), benchmark_returns.get(s, 0)))
                                                  for s in sectors])

            allocation = (wp - wb) * (rb - total_bench_return_for_sector / len(sectors) if sectors else 0)
            selection = wb * (rp - rb)
            interaction = (wp - wb) * (rp - rb)

            attribution_detail.append({
                "sector": sector,
                "portfolio_weight": round(wp * 100, 2),
                "benchmark_weight": round(wb * 100, 2),
                "portfolio_return": round(rp * 100, 4),
                "benchmark_return": round(rb * 100, 4),
                "allocation_effect": round(allocation * 100, 4),
                "selection_effect": round(selection * 100, 4),
                "interaction_effect": round(interaction * 100, 4),
                "total_effect": round((allocation + selection + interaction) * 100, 4),
            })

            total_port_return += wp * rp
            total_bench_return += wb * rb

        total_allocation = sum(d["allocation_effect"] for d in attribution_detail)
        total_selection = sum(d["selection_effect"] for d in attribution_detail)
        total_interaction = sum(d["interaction_effect"] for d in attribution_detail)

        return {
            "portfolio_return": round(total_port_return * 100, 4),
            "benchmark_return": round(total_bench_return * 100, 4),
            "active_return": round((total_port_return - total_bench_return) * 100, 4),
            "allocation_effect": round(total_allocation, 4),
            "selection_effect": round(total_selection, 4),
            "interaction_effect": round(total_interaction, 4),
            "detail": attribution_detail,
        }

    async def factor_attribution(self, portfolio: Portfolio, factors: list[str] = None) -> dict:
        """Multi-factor attribution (Fama-French style)."""
        if factors is None:
            factors = ["SPY", "IWM", "AGG", "GLD", "VNQ"]  # Market, Small, Bonds, Gold, REIT

        port_returns = []
        weights = [p.weight for p in portfolio.positions]
        symbols = [p.symbol for p in portfolio.positions]
        all_returns = {}
        for sym in symbols:
            all_returns[sym] = await self.risk._fetch_returns(sym)

        factor_returns = {}
        for f in factors:
            factor_returns[f] = await self.risk._fetch_returns(f)

        min_len = min(
            min(len(r) for r in all_returns.values()) if all_returns else 0,
            min(len(r) for r in factor_returns.values()) if factor_returns else 0,
        )

        if min_len < 20:
            return {"error": "Insufficient data for factor attribution"}

        # Portfolio returns
        for i in range(min_len):
            day_return = sum(
                weights[j] * all_returns[symbols[j]][i]
                for j in range(len(symbols))
                if i < len(all_returns[symbols[j]])
            )
            port_returns.append(day_return)

        # Simple OLS regression: portfolio = alpha + sum(beta_i * factor_i) + epsilon
        factor_exposures = {}
        for f_name in factors:
            f_rets = factor_returns[f_name][:min_len]
            cov = self.risk._covariance(port_returns, f_rets)
            var = self.risk._std(f_rets) ** 2
            beta = cov / var if var > 0 else 0
            factor_exposures[f_name] = {
                "beta": round(beta, 4),
                "contribution": round(beta * self.risk._mean(f_rets) * TRADING_DAYS * 100, 4),
            }

        alpha = self.risk._mean(port_returns) * TRADING_DAYS - sum(
            fe["beta"] * self.risk._mean(factor_returns[f][:min_len]) * TRADING_DAYS
            for f, fe in factor_exposures.items()
        )

        return {
            "alpha_annualized": round(alpha * 100, 4),
            "factor_exposures": factor_exposures,
            "factors": factors,
            "observation_days": min_len,
        }


# ═══════════════════════════════════════════════════════════════════════════════
# §5.4 — PORTFOLIO OPTIMIZATION
# ═══════════════════════════════════════════════════════════════════════════════

class PortfolioOptimizer:
    """Portfolio optimization: mean-variance, risk parity, Black-Litterman."""

    def __init__(self, risk_analytics: PortfolioRiskAnalytics):
        self.risk = risk_analytics

    async def mean_variance(self, symbols: list[str], target_return: Optional[float] = None,
                             constraints: Optional[dict] = None) -> dict:
        """Markowitz mean-variance optimization."""
        n = len(symbols)
        if n < 2:
            return {"error": "Need at least 2 assets"}

        # Fetch returns
        all_returns = {}
        for sym in symbols:
            all_returns[sym] = await self.risk._fetch_returns(sym)

        # Calculate expected returns and covariance matrix
        min_len = min(len(r) for r in all_returns.values())
        expected_returns = [self.risk._mean(all_returns[sym][:min_len]) * TRADING_DAYS for sym in symbols]

        cov_matrix = [[0.0] * n for _ in range(n)]
        for i in range(n):
            for j in range(n):
                cov = self.risk._covariance(
                    all_returns[symbols[i]][:min_len],
                    all_returns[symbols[j]][:min_len]
                ) * TRADING_DAYS
                cov_matrix[i][j] = cov

        # Find optimal weights using gradient descent
        weights = [1.0 / n] * n
        min_weight = (constraints or {}).get("min_weight", 0.0)
        max_weight = (constraints or {}).get("max_weight", 1.0)
        learning_rate = 0.001
        iterations = 5000

        best_sharpe = -999
        best_weights = weights[:]

        for iteration in range(iterations):
            # Portfolio return
            port_return = sum(weights[i] * expected_returns[i] for i in range(n))

            # Portfolio variance
            port_var = 0
            for i in range(n):
                for j in range(n):
                    port_var += weights[i] * weights[j] * cov_matrix[i][j]
            port_vol = math.sqrt(max(port_var, 0))

            # Sharpe ratio
            sharpe = (port_return - RISK_FREE_RATE) / port_vol if port_vol > 0 else 0

            if target_return is not None:
                # Minimize vol subject to target return
                objective = port_var + 100 * (port_return - target_return) ** 2
            else:
                # Maximize Sharpe
                objective = -sharpe

            if sharpe > best_sharpe:
                best_sharpe = sharpe
                best_weights = weights[:]

            # Gradient (numerical)
            grad = [0.0] * n
            eps = 0.0001
            for k in range(n):
                w_plus = weights[:]
                w_plus[k] += eps
                # Normalize
                total = sum(w_plus)
                w_plus = [w / total for w in w_plus]

                pr = sum(w_plus[i] * expected_returns[i] for i in range(n))
                pv = sum(w_plus[i] * w_plus[j] * cov_matrix[i][j] for i in range(n) for j in range(n))
                pvol = math.sqrt(max(pv, 0))
                sh = (pr - RISK_FREE_RATE) / pvol if pvol > 0 else 0

                if target_return is not None:
                    obj_plus = pv + 100 * (pr - target_return) ** 2
                else:
                    obj_plus = -sh

                grad[k] = (obj_plus - objective) / eps

            # Update weights
            for k in range(n):
                weights[k] -= learning_rate * grad[k]
                weights[k] = max(min_weight, min(max_weight, weights[k]))

            # Normalize
            total = sum(weights)
            if total > 0:
                weights = [w / total for w in weights]

        # Use best weights found
        weights = best_weights

        # Final metrics
        port_return = sum(weights[i] * expected_returns[i] for i in range(n))
        port_var = sum(weights[i] * weights[j] * cov_matrix[i][j] for i in range(n) for j in range(n))
        port_vol = math.sqrt(max(port_var, 0))

        return {
            "weights": {symbols[i]: round(weights[i], 4) for i in range(n)},
            "expected_return": round(port_return * 100, 2),
            "volatility": round(port_vol * 100, 2),
            "sharpe_ratio": round((port_return - RISK_FREE_RATE) / port_vol, 3) if port_vol > 0 else 0,
            "method": "mean_variance",
        }

    async def minimum_variance(self, symbols: list[str]) -> dict:
        """Find minimum variance portfolio."""
        return await self.mean_variance(symbols, target_return=0)

    async def risk_parity(self, symbols: list[str]) -> dict:
        """Risk parity: equal risk contribution from each asset."""
        n = len(symbols)
        all_returns = {}
        for sym in symbols:
            all_returns[sym] = await self.risk._fetch_returns(sym)

        min_len = min(len(r) for r in all_returns.values())

        # Covariance matrix
        cov_matrix = [[0.0] * n for _ in range(n)]
        for i in range(n):
            for j in range(n):
                cov = self.risk._covariance(
                    all_returns[symbols[i]][:min_len],
                    all_returns[symbols[j]][:min_len]
                ) * TRADING_DAYS
                cov_matrix[i][j] = cov

        # Start with inverse volatility weights
        vols = [math.sqrt(max(cov_matrix[i][i], 0.0001)) for i in range(n)]
        weights = [1.0 / v for v in vols]
        total = sum(weights)
        weights = [w / total for w in weights]

        # Iterative risk parity
        for _ in range(1000):
            # Calculate marginal risk contributions
            port_var = sum(weights[i] * weights[j] * cov_matrix[i][j] for i in range(n) for j in range(n))
            port_vol = math.sqrt(max(port_var, 0.0001))

            mrc = [0.0] * n
            for i in range(n):
                marginal = sum(weights[j] * cov_matrix[i][j] for j in range(n))
                mrc[i] = weights[i] * marginal / port_vol

            total_risk = sum(mrc)
            target_risk = total_risk / n

            # Adjust weights
            for i in range(n):
                if mrc[i] > 0:
                    weights[i] *= (target_risk / mrc[i]) ** 0.1

            total = sum(weights)
            weights = [w / total for w in weights]

        # Final metrics
        port_var = sum(weights[i] * weights[j] * cov_matrix[i][j] for i in range(n) for j in range(n))
        port_vol = math.sqrt(max(port_var, 0))
        expected_returns = [self.risk._mean(all_returns[sym][:min_len]) * TRADING_DAYS for sym in symbols]
        port_return = sum(weights[i] * expected_returns[i] for i in range(n))

        # Risk contributions
        risk_contributions = {}
        for i in range(n):
            marginal = sum(weights[j] * cov_matrix[i][j] for j in range(n))
            rc = weights[i] * marginal / port_vol if port_vol > 0 else 0
            risk_contributions[symbols[i]] = round(rc / port_vol * 100 if port_vol > 0 else 0, 2)

        return {
            "weights": {symbols[i]: round(weights[i], 4) for i in range(n)},
            "expected_return": round(port_return * 100, 2),
            "volatility": round(port_vol * 100, 2),
            "sharpe_ratio": round((port_return - RISK_FREE_RATE) / port_vol, 3) if port_vol > 0 else 0,
            "risk_contributions": risk_contributions,
            "method": "risk_parity",
        }

    async def black_litterman(self, symbols: list[str], views: list[dict],
                                market_cap_weights: Optional[dict] = None) -> dict:
        """
        Black-Litterman model incorporating investor views.

        views format: [{"asset": "AAPL", "return": 0.15, "confidence": 0.8}, ...]
        """
        n = len(symbols)
        all_returns = {}
        for sym in symbols:
            all_returns[sym] = await self.risk._fetch_returns(sym)

        min_len = min(len(r) for r in all_returns.values())

        # Covariance matrix
        cov_matrix = [[0.0] * n for _ in range(n)]
        for i in range(n):
            for j in range(n):
                cov = self.risk._covariance(
                    all_returns[symbols[i]][:min_len],
                    all_returns[symbols[j]][:min_len]
                ) * TRADING_DAYS
                cov_matrix[i][j] = cov

        # Market cap weights (equilibrium)
        if market_cap_weights is None:
            mkt_weights = [1.0 / n] * n
        else:
            mkt_weights = [market_cap_weights.get(sym, 1.0 / n) for sym in symbols]
            total = sum(mkt_weights)
            mkt_weights = [w / total for w in mkt_weights]

        # Risk aversion parameter
        risk_aversion = 2.5  # typical value

        # Implied equilibrium returns: Pi = delta * Sigma * w_mkt
        equilibrium_returns = [0.0] * n
        for i in range(n):
            equilibrium_returns[i] = risk_aversion * sum(cov_matrix[i][j] * mkt_weights[j] for j in range(n))

        # Process views
        tau = 0.05  # Scalar for uncertainty of the prior
        num_views = len(views)

        if num_views == 0:
            # No views — return equilibrium weights
            return {
                "weights": {symbols[i]: round(mkt_weights[i], 4) for i in range(n)},
                "expected_return": round(sum(equilibrium_returns[i] * mkt_weights[i] for i in range(n)) * 100, 2),
                "method": "black_litterman_equilibrium",
            }

        # Pick matrix P and view vector Q
        P = [[0.0] * n for _ in range(num_views)]
        Q = [0.0] * num_views
        omega_diag = [0.0] * num_views

        for v_idx, view in enumerate(views):
            asset = view.get("asset", "")
            if asset in symbols:
                asset_idx = symbols.index(asset)
                P[v_idx][asset_idx] = 1.0
                Q[v_idx] = view.get("return", equilibrium_returns[asset_idx])
                confidence = view.get("confidence", 0.5)
                omega_diag[v_idx] = (1 - confidence) / confidence * tau * cov_matrix[asset_idx][asset_idx]
            else:
                omega_diag[v_idx] = 1.0

        # Black-Litterman posterior returns = (tau*Sigma)^-1 * Pi + P' * Omega^-1 * Q
        # Simplified: adjust equilibrium returns based on views
        bl_returns = equilibrium_returns[:]
        for v_idx in range(num_views):
            for i in range(n):
                if P[v_idx][i] != 0:
                    view_weight = tau / (tau + omega_diag[v_idx]) if (tau + omega_diag[v_idx]) > 0 else 0.5
                    bl_returns[i] = (1 - view_weight) * equilibrium_returns[i] + view_weight * Q[v_idx]

        # Optimize with updated returns using simple inverse-variance weighting
        vols = [math.sqrt(max(cov_matrix[i][i], 0.0001)) for i in range(n)]
        adjusted_weights = [bl_returns[i] / (risk_aversion * vols[i] ** 2) for i in range(n)]

        # Normalize and clamp
        min_w = max(min(adjusted_weights), 0)
        adjusted_weights = [max(w, 0) for w in adjusted_weights]
        total = sum(adjusted_weights)
        if total > 0:
            adjusted_weights = [w / total for w in adjusted_weights]
        else:
            adjusted_weights = mkt_weights

        port_return = sum(adjusted_weights[i] * bl_returns[i] for i in range(n))
        port_var = sum(adjusted_weights[i] * adjusted_weights[j] * cov_matrix[i][j] for i in range(n) for j in range(n))
        port_vol = math.sqrt(max(port_var, 0))

        return {
            "weights": {symbols[i]: round(adjusted_weights[i], 4) for i in range(n)},
            "expected_return": round(port_return * 100, 2),
            "volatility": round(port_vol * 100, 2),
            "sharpe_ratio": round((port_return - RISK_FREE_RATE) / port_vol, 3) if port_vol > 0 else 0,
            "equilibrium_returns": {symbols[i]: round(equilibrium_returns[i] * 100, 2) for i in range(n)},
            "bl_returns": {symbols[i]: round(bl_returns[i] * 100, 2) for i in range(n)},
            "views_applied": num_views,
            "method": "black_litterman",
        }

    async def efficient_frontier(self, symbols: list[str], num_points: int = 50) -> dict:
        """Generate the entire efficient frontier."""
        n = len(symbols)
        all_returns = {}
        for sym in symbols:
            all_returns[sym] = await self.risk._fetch_returns(sym)

        min_len = min(len(r) for r in all_returns.values())
        expected_returns = [self.risk._mean(all_returns[sym][:min_len]) * TRADING_DAYS for sym in symbols]

        min_ret = min(expected_returns)
        max_ret = max(expected_returns)

        frontier = []
        for i in range(num_points):
            target = min_ret + (max_ret - min_ret) * i / (num_points - 1)
            result = await self.mean_variance(symbols, target_return=target)
            frontier.append({
                "return": result.get("expected_return", 0),
                "volatility": result.get("volatility", 0),
                "sharpe": result.get("sharpe_ratio", 0),
                "weights": result.get("weights", {}),
            })

        # Also find max Sharpe and min variance
        max_sharpe = await self.mean_variance(symbols)
        min_var = await self.minimum_variance(symbols)

        return {
            "frontier": frontier,
            "max_sharpe_portfolio": max_sharpe,
            "min_variance_portfolio": min_var,
            "symbols": symbols,
        }

    async def rebalance_recommendation(self, portfolio: Portfolio,
                                         target_weights: dict) -> list[dict]:
        """Generate trade recommendations to rebalance to target weights."""
        current_weights = {p.symbol: p.weight for p in portfolio.positions}
        total_value = portfolio.total_value

        trades = []
        for symbol, target in target_weights.items():
            current = current_weights.get(symbol, 0)
            diff = target - current
            if abs(diff) < 0.001:
                continue

            dollar_amount = diff * total_value
            # Get current price
            price = 0
            for p in portfolio.positions:
                if p.symbol == symbol:
                    price = p.current_price
                    break

            if price <= 0:
                price = 100  # placeholder

            shares = int(dollar_amount / price)
            if shares == 0:
                continue

            trades.append({
                "symbol": symbol,
                "action": "buy" if shares > 0 else "sell",
                "shares": abs(shares),
                "estimated_price": price,
                "estimated_value": round(abs(shares) * price, 2),
                "current_weight": round(current * 100, 2),
                "target_weight": round(target * 100, 2),
                "weight_change": round(diff * 100, 2),
            })

        trades.sort(key=lambda t: abs(t["weight_change"]), reverse=True)
        return trades


# ═══════════════════════════════════════════════════════════════════════════════
# TAX LOT MANAGEMENT
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class TaxLot:
    symbol: str
    quantity: float
    purchase_price: float
    purchase_date: str
    lot_id: str = ""
    current_price: float = 0.0
    unrealized_gain: float = 0.0
    holding_period_days: int = 0
    is_long_term: bool = False
    tax_rate: float = 0.0


class TaxLotManager:
    """Manage tax lots for tax-loss harvesting."""

    def __init__(self):
        self.lots: list[TaxLot] = []
        self.short_term_rate = 0.37  # Ordinary income rate
        self.long_term_rate = 0.20   # Long-term capital gains rate

    def add_lot(self, symbol: str, quantity: float, price: float, date: str):
        lot_id = f"{symbol}_{date}_{len(self.lots)}"
        self.lots.append(TaxLot(
            symbol=symbol,
            quantity=quantity,
            purchase_price=price,
            purchase_date=date,
            lot_id=lot_id,
        ))

    def update_prices(self, prices: dict[str, float]):
        now = datetime.now()
        for lot in self.lots:
            if lot.symbol in prices:
                lot.current_price = prices[lot.symbol]
                lot.unrealized_gain = (lot.current_price - lot.purchase_price) * lot.quantity
                purchase = datetime.strptime(lot.purchase_date, "%Y-%m-%d")
                lot.holding_period_days = (now - purchase).days
                lot.is_long_term = lot.holding_period_days > 365
                lot.tax_rate = self.long_term_rate if lot.is_long_term else self.short_term_rate

    def find_harvest_candidates(self, min_loss: float = -100) -> list[dict]:
        """Find tax-loss harvesting opportunities."""
        candidates = []
        for lot in self.lots:
            if lot.unrealized_gain < min_loss:
                tax_savings = abs(lot.unrealized_gain) * lot.tax_rate
                candidates.append({
                    "lot_id": lot.lot_id,
                    "symbol": lot.symbol,
                    "quantity": lot.quantity,
                    "purchase_price": lot.purchase_price,
                    "current_price": lot.current_price,
                    "unrealized_loss": round(lot.unrealized_gain, 2),
                    "tax_savings": round(tax_savings, 2),
                    "holding_days": lot.holding_period_days,
                    "is_long_term": lot.is_long_term,
                    "tax_rate": lot.tax_rate,
                })

        candidates.sort(key=lambda c: c["tax_savings"], reverse=True)
        return candidates

    def optimal_lot_selection(self, symbol: str, shares_to_sell: int,
                               method: str = "tax_efficient") -> list[dict]:
        """Select optimal lots to sell (FIFO, LIFO, tax-efficient, specific)."""
        symbol_lots = [l for l in self.lots if l.symbol == symbol and l.quantity > 0]

        if method == "fifo":
            symbol_lots.sort(key=lambda l: l.purchase_date)
        elif method == "lifo":
            symbol_lots.sort(key=lambda l: l.purchase_date, reverse=True)
        elif method == "tax_efficient":
            # Sell losses first (short-term first), then long-term gains, then short-term gains
            symbol_lots.sort(key=lambda l: (
                0 if l.unrealized_gain < 0 and not l.is_long_term else
                1 if l.unrealized_gain < 0 and l.is_long_term else
                2 if l.unrealized_gain >= 0 and l.is_long_term else 3,
                l.unrealized_gain,
            ))
        elif method == "highest_cost":
            symbol_lots.sort(key=lambda l: l.purchase_price, reverse=True)

        selected = []
        remaining = shares_to_sell
        for lot in symbol_lots:
            if remaining <= 0:
                break
            qty = min(lot.quantity, remaining)
            selected.append({
                "lot_id": lot.lot_id,
                "quantity": qty,
                "purchase_price": lot.purchase_price,
                "gain_loss": round((lot.current_price - lot.purchase_price) * qty, 2),
                "tax_impact": round((lot.current_price - lot.purchase_price) * qty * lot.tax_rate, 2),
            })
            remaining -= qty

        return selected


# ═══════════════════════════════════════════════════════════════════════════════
# DIVIDEND TRACKING
# ═══════════════════════════════════════════════════════════════════════════════

class DividendTracker:
    """Track dividend income and yield."""

    def __init__(self):
        self._http: Optional[httpx.AsyncClient] = None

    async def _get_http(self) -> httpx.AsyncClient:
        if self._http is None or self._http.is_closed:
            self._http = httpx.AsyncClient(timeout=15.0)
        return self._http

    async def get_dividend_info(self, symbol: str) -> dict:
        """Get dividend information for a symbol."""
        # Try Polygon
        if POLYGON_KEY:
            try:
                http = await self._get_http()
                url = f"https://api.polygon.io/v3/reference/dividends?ticker={symbol}&limit=12&apiKey={POLYGON_KEY}"
                resp = await http.get(url)
                data = resp.json()
                dividends = data.get("results", [])

                if dividends:
                    annual_div = sum(float(d.get("cash_amount", 0)) for d in dividends[:4])
                    latest = dividends[0]

                    # Get price
                    snap = f"https://api.polygon.io/v2/aggs/ticker/{symbol}/prev?apiKey={POLYGON_KEY}"
                    s_resp = await http.get(snap)
                    price = s_resp.json().get("results", [{}])[0].get("c", 100)

                    return {
                        "symbol": symbol,
                        "annual_dividend": round(annual_div, 2),
                        "dividend_yield": round(annual_div / price * 100, 2) if price > 0 else 0,
                        "frequency": latest.get("frequency", 4),
                        "ex_date": latest.get("ex_dividend_date", ""),
                        "pay_date": latest.get("pay_date", ""),
                        "record_date": latest.get("record_date", ""),
                        "last_amount": float(latest.get("cash_amount", 0)),
                        "history": [
                            {
                                "ex_date": d.get("ex_dividend_date", ""),
                                "amount": float(d.get("cash_amount", 0)),
                                "pay_date": d.get("pay_date", ""),
                            } for d in dividends[:12]
                        ],
                        "source": "polygon",
                    }
            except Exception as e:
                logger.warning(f"Polygon dividend failed: {e}")

        # yfinance fallback
        try:
            import concurrent.futures

            def _fetch():
                import yfinance as yf
                ticker = yf.Ticker(symbol)
                info = ticker.info
                return {
                    "symbol": symbol,
                    "annual_dividend": info.get("dividendRate", 0),
                    "dividend_yield": round(info.get("dividendYield", 0) * 100, 2) if info.get("dividendYield") else 0,
                    "ex_date": str(info.get("exDividendDate", "")),
                    "payout_ratio": round(info.get("payoutRatio", 0) * 100, 2) if info.get("payoutRatio") else 0,
                    "five_year_avg_yield": round(info.get("fiveYearAvgDividendYield", 0), 2),
                    "source": "yfinance",
                }

            loop = asyncio.get_event_loop()
            with concurrent.futures.ThreadPoolExecutor() as pool:
                return await loop.run_in_executor(pool, _fetch)
        except Exception:
            return {"symbol": symbol, "error": "No dividend data available"}

    async def portfolio_dividend_summary(self, portfolio: Portfolio) -> dict:
        """Calculate total portfolio dividend income."""
        total_annual = 0
        details = []

        for pos in portfolio.positions:
            div_info = await self.get_dividend_info(pos.symbol)
            annual = div_info.get("annual_dividend", 0) * pos.quantity
            total_annual += annual
            details.append({
                "symbol": pos.symbol,
                "shares": pos.quantity,
                "dividend_per_share": div_info.get("annual_dividend", 0),
                "annual_income": round(annual, 2),
                "yield": div_info.get("dividend_yield", 0),
            })

        return {
            "total_annual_income": round(total_annual, 2),
            "monthly_income": round(total_annual / 12, 2),
            "portfolio_yield": round(total_annual / portfolio.total_value * 100, 2) if portfolio.total_value > 0 else 0,
            "details": details,
        }


# ═══════════════════════════════════════════════════════════════════════════════
# UNIFIED PORTFOLIO MANAGER
# ═══════════════════════════════════════════════════════════════════════════════

class PortfolioManager:
    """
    Unified entry point for all portfolio management operations.
    """

    def __init__(self):
        self.builder = PortfolioBuilder()
        self.risk = PortfolioRiskAnalytics()
        self.attribution = PerformanceAttribution(self.risk)
        self.optimizer = PortfolioOptimizer(self.risk)
        self.tax_manager = TaxLotManager()
        self.dividend_tracker = DividendTracker()
        self._portfolio: Optional[Portfolio] = None

    async def get_portfolio(self, force_refresh: bool = False) -> dict:
        if force_refresh or self._portfolio is None:
            self._portfolio = await self.builder.build_portfolio()
        return asdict(self._portfolio)

    async def get_risk_metrics(self) -> dict:
        if self._portfolio is None:
            self._portfolio = await self.builder.build_portfolio()
        return await self.risk.calculate_portfolio_metrics(self._portfolio)

    async def get_correlation_matrix(self, symbols: Optional[list[str]] = None) -> dict:
        if symbols is None:
            if self._portfolio is None:
                self._portfolio = await self.builder.build_portfolio()
            symbols = [p.symbol for p in self._portfolio.positions[:15]]
        return await self.risk.calculate_correlation_matrix(symbols)

    async def optimize(self, method: str = "mean_variance", symbols: Optional[list[str]] = None,
                        **kwargs) -> dict:
        if symbols is None:
            if self._portfolio is None:
                self._portfolio = await self.builder.build_portfolio()
            symbols = [p.symbol for p in self._portfolio.positions]

        if method == "mean_variance":
            return await self.optimizer.mean_variance(symbols, **kwargs)
        elif method == "risk_parity":
            return await self.optimizer.risk_parity(symbols)
        elif method == "black_litterman":
            return await self.optimizer.black_litterman(symbols, kwargs.get("views", []))
        elif method == "min_variance":
            return await self.optimizer.minimum_variance(symbols)
        else:
            return {"error": f"Unknown method: {method}"}

    async def get_efficient_frontier(self, symbols: Optional[list[str]] = None) -> dict:
        if symbols is None:
            if self._portfolio is None:
                self._portfolio = await self.builder.build_portfolio()
            symbols = [p.symbol for p in self._portfolio.positions[:10]]
        return await self.optimizer.efficient_frontier(symbols)

    async def get_factor_attribution(self) -> dict:
        if self._portfolio is None:
            self._portfolio = await self.builder.build_portfolio()
        return await self.attribution.factor_attribution(self._portfolio)

    async def get_rebalance_trades(self, target_weights: dict) -> list[dict]:
        if self._portfolio is None:
            self._portfolio = await self.builder.build_portfolio()
        return await self.optimizer.rebalance_recommendation(self._portfolio, target_weights)

    async def get_dividend_summary(self) -> dict:
        if self._portfolio is None:
            self._portfolio = await self.builder.build_portfolio()
        return await self.dividend_tracker.portfolio_dividend_summary(self._portfolio)

    async def get_tax_harvest_candidates(self) -> list[dict]:
        if self._portfolio is None:
            self._portfolio = await self.builder.build_portfolio()

        # Build tax lots from positions
        for pos in self._portfolio.positions:
            self.tax_manager.add_lot(
                pos.symbol, pos.quantity, pos.avg_cost,
                (datetime.now() - timedelta(days=random.randint(30, 365))).strftime("%Y-%m-%d"),
            )

        prices = {p.symbol: p.current_price for p in self._portfolio.positions}
        self.tax_manager.update_prices(prices)
        return self.tax_manager.find_harvest_candidates()


# ── Singleton ──
_portfolio_mgr: Optional[PortfolioManager] = None

def get_portfolio_manager() -> PortfolioManager:
    global _portfolio_mgr
    if _portfolio_mgr is None:
        _portfolio_mgr = PortfolioManager()
    return _portfolio_mgr
