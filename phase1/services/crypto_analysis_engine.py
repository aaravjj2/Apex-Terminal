"""
Crypto Analysis Engine — On-chain metrics, DeFi analytics, cross-exchange analysis,
whale detection, network health, token economics, liquidity pool analysis,
yield farming optimization, NFT analytics, blockchain metrics.

Pure computation — no FastAPI dependencies.
"""

from __future__ import annotations

import math
import statistics
from collections import defaultdict
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple


class BlockchainNetwork(str, Enum):
    BITCOIN = "bitcoin"
    ETHEREUM = "ethereum"
    SOLANA = "solana"
    POLYGON = "polygon"
    ARBITRUM = "arbitrum"
    OPTIMISM = "optimism"
    AVALANCHE = "avalanche"
    BSC = "bsc"
    BASE = "base"


class DeFiProtocolType(str, Enum):
    DEX = "dex"
    LENDING = "lending"
    YIELD_AGGREGATOR = "yield_aggregator"
    LIQUID_STAKING = "liquid_staking"
    CDP = "cdp"
    PERPETUALS = "perpetuals"
    OPTIONS = "options"
    BRIDGE = "bridge"


@dataclass
class OnChainMetrics:
    active_addresses: int
    transaction_count: int
    transaction_volume: float
    avg_transaction_value: float
    hash_rate: float
    difficulty: float
    block_time: float
    gas_price: float

    def to_dict(self) -> dict:
        return {
            "active_addresses": self.active_addresses,
            "transaction_count": self.transaction_count,
            "transaction_volume": round(self.transaction_volume, 2),
            "avg_transaction_value": round(self.avg_transaction_value, 2),
            "hash_rate": round(self.hash_rate, 2),
            "difficulty": round(self.difficulty, 2),
            "block_time": round(self.block_time, 2),
            "gas_price": round(self.gas_price, 2),
        }


@dataclass
class TokenEconomics:
    total_supply: float
    circulating_supply: float
    max_supply: float
    inflation_rate: float
    staking_ratio: float
    burn_rate: float

    @property
    def supply_ratio(self) -> float:
        return self.circulating_supply / self.total_supply if self.total_supply > 0 else 0

    @property
    def fully_diluted_ratio(self) -> float:
        return self.circulating_supply / self.max_supply if self.max_supply > 0 else 0

    def to_dict(self) -> dict:
        return {
            "total_supply": round(self.total_supply, 2),
            "circulating_supply": round(self.circulating_supply, 2),
            "max_supply": round(self.max_supply, 2),
            "inflation_rate": round(self.inflation_rate, 4),
            "staking_ratio": round(self.staking_ratio, 4),
            "burn_rate": round(self.burn_rate, 6),
            "supply_ratio": round(self.supply_ratio, 4),
            "fully_diluted_ratio": round(self.fully_diluted_ratio, 4),
        }


@dataclass
class LiquidityPoolMetrics:
    token_a_reserve: float
    token_b_reserve: float
    total_value_locked: float
    fee_tier: float
    volume_24h: float
    fees_24h: float
    apy: float

    def to_dict(self) -> dict:
        return {
            "token_a_reserve": round(self.token_a_reserve, 4),
            "token_b_reserve": round(self.token_b_reserve, 4),
            "total_value_locked": round(self.total_value_locked, 2),
            "fee_tier": round(self.fee_tier, 4),
            "volume_24h": round(self.volume_24h, 2),
            "fees_24h": round(self.fees_24h, 2),
            "apy": round(self.apy, 4),
        }


# ── On-Chain Analysis ─────────────────────────────────────────────────

class OnChainAnalysis:
    @staticmethod
    def nvt_ratio(
        market_cap: float,
        transaction_volume: float,
    ) -> dict:
        """Network Value to Transactions ratio (crypto P/E)."""
        nvt = market_cap / transaction_volume if transaction_volume > 0 else float("inf")
        signal = "overvalued" if nvt > 150 else "fair" if nvt > 50 else "undervalued"
        return {
            "nvt_ratio": round(nvt, 2),
            "signal": signal,
            "market_cap": round(market_cap, 2),
            "transaction_volume": round(transaction_volume, 2),
        }

    @staticmethod
    def mvrv_ratio(
        market_cap: float,
        realized_cap: float,
    ) -> dict:
        """Market Value to Realized Value ratio."""
        mvrv = market_cap / realized_cap if realized_cap > 0 else 1.0
        zone = (
            "extreme_overvaluation" if mvrv > 3.5
            else "overvaluation" if mvrv > 2.0
            else "fair_value" if mvrv > 1.0
            else "undervaluation" if mvrv > 0.8
            else "extreme_undervaluation"
        )
        return {
            "mvrv_ratio": round(mvrv, 4),
            "zone": zone,
            "unrealized_profit_pct": round((mvrv - 1) * 100, 2),
        }

    @staticmethod
    def stock_to_flow(
        current_supply: float,
        annual_production: float,
    ) -> dict:
        """Stock-to-Flow model."""
        sf = current_supply / annual_production if annual_production > 0 else float("inf")
        # Model price = e^(3.21 * ln(SF) + 14.6) — simplified Bitcoin S2F
        model_price = math.exp(3.21 * math.log(sf) + 14.6) if sf > 0 else 0
        return {
            "stock_to_flow": round(sf, 2),
            "model_price": round(model_price, 2),
            "scarcity_rating": "extremely_scarce" if sf > 50 else "scarce" if sf > 20 else "moderate",
        }

    @staticmethod
    def sopr(
        spent_output_profits: list[float],
    ) -> dict:
        """Spent Output Profit Ratio."""
        if not spent_output_profits:
            return {"sopr": 1.0, "signal": "neutral"}

        avg_sopr = statistics.mean(spent_output_profits)
        signal = "profit_taking" if avg_sopr > 1.05 else "capitulation" if avg_sopr < 0.95 else "neutral"
        return {
            "sopr": round(avg_sopr, 4),
            "signal": signal,
            "above_one_pct": round(sum(1 for s in spent_output_profits if s > 1) / len(spent_output_profits) * 100, 2),
        }

    @staticmethod
    def puell_multiple(
        daily_coin_issuance_usd: float,
        ma_365_issuance: float,
    ) -> dict:
        """Puell Multiple — miner revenue relative to yearly average."""
        puell = daily_coin_issuance_usd / ma_365_issuance if ma_365_issuance > 0 else 1.0
        zone = (
            "overheated" if puell > 4.0
            else "elevated" if puell > 1.5
            else "fair" if puell > 0.5
            else "undervalued" if puell > 0.3
            else "extremely_undervalued"
        )
        return {
            "puell_multiple": round(puell, 4),
            "zone": zone,
        }

    @staticmethod
    def thermocap_multiple(
        market_cap: float,
        cumulative_miner_revenue: float,
    ) -> dict:
        """Thermocap Multiple."""
        multiple = market_cap / cumulative_miner_revenue if cumulative_miner_revenue > 0 else 0
        return {
            "thermocap_multiple": round(multiple, 2),
            "zone": "overvalued" if multiple > 32 else "fair" if multiple > 8 else "undervalued",
        }


# ── Whale Detection ───────────────────────────────────────────────────

class WhaleDetection:
    @staticmethod
    def identify_whales(
        addresses: list[str],
        balances: list[float],
        threshold_pct: float = 0.1,
        total_supply: float = 0,
    ) -> dict:
        """Identify whale addresses based on holdings."""
        if not balances or total_supply <= 0:
            total_supply = sum(balances) if balances else 1

        threshold = total_supply * threshold_pct / 100
        whales = []
        total_whale_balance = 0.0

        for addr, bal in zip(addresses, balances):
            if bal >= threshold:
                whales.append({
                    "address": addr,
                    "balance": round(bal, 4),
                    "pct_of_supply": round(bal / total_supply * 100, 4),
                })
                total_whale_balance += bal

        whales.sort(key=lambda x: x["balance"], reverse=True)

        return {
            "whale_count": len(whales),
            "total_whale_holdings": round(total_whale_balance, 4),
            "whale_pct_of_supply": round(total_whale_balance / total_supply * 100, 4),
            "concentration_risk": "high" if total_whale_balance / total_supply > 0.4 else "medium" if total_whale_balance / total_supply > 0.2 else "low",
            "top_whales": whales[:20],
        }

    @staticmethod
    def whale_flow_analysis(
        inflows: list[float],
        outflows: list[float],
        timestamps: list[float],
    ) -> dict:
        """Analyze whale exchange flows."""
        n = min(len(inflows), len(outflows))
        if n == 0:
            return {}

        net_flows = [inflows[i] - outflows[i] for i in range(n)]

        return {
            "total_inflows": round(sum(inflows[:n]), 4),
            "total_outflows": round(sum(outflows[:n]), 4),
            "net_flow": round(sum(net_flows), 4),
            "avg_daily_inflow": round(statistics.mean(inflows[:n]), 4),
            "avg_daily_outflow": round(statistics.mean(outflows[:n]), 4),
            "flow_trend": "accumulation" if sum(net_flows[-7:]) < 0 else "distribution",
            "max_single_inflow": round(max(inflows[:n]), 4),
            "max_single_outflow": round(max(outflows[:n]), 4),
        }


# ── DeFi Analytics ────────────────────────────────────────────────────

class DeFiAnalytics:
    @staticmethod
    def impermanent_loss(
        price_ratio_change: float,
    ) -> dict:
        """
        Calculate impermanent loss for constant product AMM.
        price_ratio_change: new_price / old_price
        """
        r = price_ratio_change
        if r <= 0:
            return {"impermanent_loss_pct": 0}

        # IL = 2*sqrt(r)/(1+r) - 1
        il = 2 * math.sqrt(r) / (1 + r) - 1

        return {
            "impermanent_loss_pct": round(il * 100, 4),
            "price_ratio": round(r, 4),
            "hodl_value_multiplier": round((1 + r) / 2, 4),
            "lp_value_multiplier": round(math.sqrt(r), 4),
        }

    @staticmethod
    def concentrated_liquidity_il(
        price_ratio_change: float,
        lower_tick: float,
        upper_tick: float,
    ) -> dict:
        """
        Impermanent loss for concentrated liquidity (Uniswap v3 style).
        """
        r = price_ratio_change
        pa = lower_tick
        pb = upper_tick

        if r <= 0 or pa <= 0 or pb <= pa:
            return {"impermanent_loss_pct": 0}

        sqrt_r = math.sqrt(r)
        sqrt_pa = math.sqrt(pa)
        sqrt_pb = math.sqrt(pb)

        if r < pa:
            # All in token1
            il = (math.sqrt(r * pa) - pa) / (r + pa) * 2 if (r + pa) > 0 else 0
        elif r > pb:
            # All in token0
            il = (math.sqrt(r * pb) - pb) / (r + pb) * 2 if (r + pb) > 0 else 0
        else:
            # In range
            lp_value = (sqrt_r - sqrt_pa) + (1 / sqrt_r - 1 / sqrt_pb)
            hold_value = (sqrt_pb - sqrt_pa) if r == 1 else (r - 1) / (2 * (sqrt_pb - sqrt_pa)) + 1
            il = lp_value / hold_value - 1 if hold_value > 0 else 0

        return {
            "concentrated_il_pct": round(il * 100, 4),
            "range": [round(pa, 4), round(pb, 4)],
            "capital_efficiency_multiplier": round((sqrt_pb) / (sqrt_pb - sqrt_pa) if sqrt_pb > sqrt_pa else 1, 2),
        }

    @staticmethod
    def yield_comparison(
        opportunities: list[dict],
    ) -> list[dict]:
        """
        Compare yield farming opportunities.
        Each: {name, base_apy, reward_apy, il_estimate, tvl, risk_score}
        """
        ranked = []
        for opp in opportunities:
            base_apy = opp.get("base_apy", 0)
            reward_apy = opp.get("reward_apy", 0)
            il = abs(opp.get("il_estimate", 0))
            risk = opp.get("risk_score", 5)
            tvl = opp.get("tvl", 0)

            # Net yield estimate
            net_apy = base_apy + reward_apy - il

            # Risk-adjusted yield (sharpe-like)
            risk_adj = net_apy / max(risk, 1)

            ranked.append({
                "name": opp.get("name", "unknown"),
                "gross_apy": round(base_apy + reward_apy, 4),
                "estimated_il": round(il, 4),
                "net_apy": round(net_apy, 4),
                "risk_score": risk,
                "risk_adjusted_yield": round(risk_adj, 4),
                "tvl": round(tvl, 2),
            })

        ranked.sort(key=lambda x: x["risk_adjusted_yield"], reverse=True)
        for i, r in enumerate(ranked):
            r["rank"] = i + 1

        return ranked

    @staticmethod
    def lending_health_factor(
        collateral_value: float,
        borrowed_value: float,
        liquidation_threshold: float = 0.8,
    ) -> dict:
        """Calculate lending position health factor."""
        health_factor = (collateral_value * liquidation_threshold) / borrowed_value if borrowed_value > 0 else float("inf")
        ltv = borrowed_value / collateral_value if collateral_value > 0 else 0

        liquidation_price_drop = 1 - (1 / health_factor) if health_factor > 0 else 0

        return {
            "health_factor": round(health_factor, 4),
            "ltv": round(ltv, 4),
            "max_ltv": round(liquidation_threshold, 4),
            "status": "safe" if health_factor > 1.5 else "warning" if health_factor > 1.1 else "danger",
            "liquidation_price_drop_pct": round(liquidation_price_drop * 100, 2),
            "available_to_borrow": round(max(0, collateral_value * liquidation_threshold - borrowed_value), 2),
        }


# ── Cross-Exchange Analysis ──────────────────────────────────────────

class CrossExchangeAnalysis:
    @staticmethod
    def arbitrage_opportunities(
        exchange_prices: dict[str, float],
        fees: dict[str, float] | None = None,
        transfer_cost: float = 0.001,
    ) -> list[dict]:
        """Find arbitrage opportunities across exchanges."""
        if fees is None:
            fees = {e: 0.001 for e in exchange_prices}

        opportunities = []
        exchanges = list(exchange_prices.keys())

        for i in range(len(exchanges)):
            for j in range(i + 1, len(exchanges)):
                ex_buy = exchanges[i]
                ex_sell = exchanges[j]
                price_buy = exchange_prices[ex_buy]
                price_sell = exchange_prices[ex_sell]

                if price_buy >= price_sell:
                    ex_buy, ex_sell = ex_sell, ex_buy
                    price_buy, price_sell = price_sell, price_buy

                spread_pct = (price_sell - price_buy) / price_buy
                total_fees = fees.get(ex_buy, 0.001) + fees.get(ex_sell, 0.001) + transfer_cost
                net_profit = spread_pct - total_fees

                if net_profit > 0:
                    opportunities.append({
                        "buy_exchange": ex_buy,
                        "sell_exchange": ex_sell,
                        "buy_price": round(price_buy, 4),
                        "sell_price": round(price_sell, 4),
                        "spread_pct": round(spread_pct * 100, 4),
                        "total_fees_pct": round(total_fees * 100, 4),
                        "net_profit_pct": round(net_profit * 100, 4),
                    })

        opportunities.sort(key=lambda x: x["net_profit_pct"], reverse=True)
        return opportunities

    @staticmethod
    def funding_rate_analysis(
        funding_rates: dict[str, list[float]],
    ) -> dict:
        """Analyze funding rates across exchanges and time."""
        analysis = {}

        for exchange, rates in funding_rates.items():
            if not rates:
                continue

            avg_rate = statistics.mean(rates)
            annualized = avg_rate * 3 * 365  # 8-hour funding × 3 × 365

            analysis[exchange] = {
                "current_rate": round(rates[-1], 6),
                "avg_rate": round(avg_rate, 6),
                "annualized_pct": round(annualized * 100, 2),
                "max_rate": round(max(rates), 6),
                "min_rate": round(min(rates), 6),
                "positive_pct": round(sum(1 for r in rates if r > 0) / len(rates) * 100, 2),
                "sentiment": "bullish" if avg_rate > 0.0001 else "bearish" if avg_rate < -0.0001 else "neutral",
            }

        return analysis

    @staticmethod
    def volume_distribution(
        exchange_volumes: dict[str, float],
    ) -> dict:
        """Analyze volume distribution across exchanges."""
        total = sum(exchange_volumes.values())
        if total <= 0:
            return {}

        dist = []
        for ex, vol in sorted(exchange_volumes.items(), key=lambda x: -x[1]):
            dist.append({
                "exchange": ex,
                "volume": round(vol, 2),
                "market_share_pct": round(vol / total * 100, 2),
            })

        # HHI concentration index
        shares = [vol / total for vol in exchange_volumes.values()]
        hhi = sum(s ** 2 for s in shares) * 10000

        return {
            "total_volume": round(total, 2),
            "distribution": dist,
            "hhi_concentration": round(hhi, 0),
            "concentration_level": "high" if hhi > 2500 else "moderate" if hhi > 1500 else "low",
            "top_exchange": dist[0]["exchange"] if dist else "",
        }


# ── Network Health ────────────────────────────────────────────────────

class NetworkHealth:
    @staticmethod
    def network_score(
        active_addresses: int,
        transaction_count: int,
        avg_block_time: float,
        node_count: int,
        staking_ratio: float = 0,
        uptime: float = 1.0,
    ) -> dict:
        """Compute network health score (0-100)."""
        # Activity score
        activity = min(100, 20 * math.log10(active_addresses + 1)) * 0.25

        # Transaction throughput
        throughput = min(100, 15 * math.log10(transaction_count + 1)) * 0.20

        # Decentralization (more nodes = better)
        decentralization = min(100, 25 * math.log10(node_count + 1)) * 0.20

        # Block time consistency (lower is better for most chains)
        block_score = max(0, 100 - abs(avg_block_time - 12) * 5) * 0.15  # Optimal ~12s

        # Staking participation
        stake_score = min(100, staking_ratio * 200) * 0.10

        # Uptime
        uptime_score = uptime * 100 * 0.10

        total = activity + throughput + decentralization + block_score + stake_score + uptime_score

        return {
            "health_score": round(total, 2),
            "activity_score": round(activity / 0.25, 2),
            "throughput_score": round(throughput / 0.20, 2),
            "decentralization_score": round(decentralization / 0.20, 2),
            "block_time_score": round(block_score / 0.15, 2),
            "staking_score": round(stake_score / 0.10, 2),
            "uptime_score": round(uptime_score / 0.10, 2),
            "status": "healthy" if total > 70 else "moderate" if total > 40 else "concerning",
        }


# ── Gas Analytics ─────────────────────────────────────────────────────

class GasAnalytics:
    @staticmethod
    def gas_analysis(
        gas_prices: list[float],
        block_utilizations: list[float],
    ) -> dict:
        if not gas_prices:
            return {}

        return {
            "current_gas": round(gas_prices[-1], 2),
            "avg_gas": round(statistics.mean(gas_prices), 2),
            "median_gas": round(statistics.median(gas_prices), 2),
            "percentile_25": round(sorted(gas_prices)[len(gas_prices) // 4], 2),
            "percentile_75": round(sorted(gas_prices)[3 * len(gas_prices) // 4], 2),
            "max_gas": round(max(gas_prices), 2),
            "min_gas": round(min(gas_prices), 2),
            "gas_volatility": round(statistics.stdev(gas_prices), 2) if len(gas_prices) > 1 else 0,
            "avg_block_utilization": round(statistics.mean(block_utilizations) * 100, 2) if block_utilizations else 0,
            "recommendation": "wait" if gas_prices[-1] > statistics.mean(gas_prices) * 1.5 else "optimal" if gas_prices[-1] < statistics.median(gas_prices) else "normal",
        }

    @staticmethod
    def estimate_transaction_cost(
        gas_price_gwei: float,
        gas_limit: int = 21000,
        eth_price: float = 2000,
    ) -> dict:
        gas_cost_eth = gas_price_gwei * gas_limit / 1e9
        gas_cost_usd = gas_cost_eth * eth_price

        return {
            "gas_price_gwei": round(gas_price_gwei, 2),
            "gas_limit": gas_limit,
            "cost_eth": round(gas_cost_eth, 6),
            "cost_usd": round(gas_cost_usd, 4),
        }


# ── Orchestrator ──────────────────────────────────────────────────────

class CryptoAnalysisEngine:
    def __init__(self) -> None:
        self.onchain = OnChainAnalysis()
        self.whale = WhaleDetection()
        self.defi = DeFiAnalytics()
        self.exchange = CrossExchangeAnalysis()
        self.network = NetworkHealth()
        self.gas = GasAnalytics()

    def nvt_analysis(self, market_cap: float, tx_volume: float) -> dict:
        return self.onchain.nvt_ratio(market_cap, tx_volume)

    def mvrv_analysis(self, market_cap: float, realized_cap: float) -> dict:
        return self.onchain.mvrv_ratio(market_cap, realized_cap)

    def stock_to_flow_model(self, supply: float, annual_production: float) -> dict:
        return self.onchain.stock_to_flow(supply, annual_production)

    def whale_analysis(self, addresses: list[str], balances: list[float], **kwargs) -> dict:
        return self.whale.identify_whales(addresses, balances, **kwargs)

    def impermanent_loss(self, price_ratio_change: float) -> dict:
        return self.defi.impermanent_loss(price_ratio_change)

    def lending_health(self, collateral: float, borrowed: float, **kwargs) -> dict:
        return self.defi.lending_health_factor(collateral, borrowed, **kwargs)

    def yield_comparison(self, opportunities: list[dict]) -> list[dict]:
        return self.defi.yield_comparison(opportunities)

    def find_arbitrage(self, exchange_prices: dict[str, float], **kwargs) -> list[dict]:
        return self.exchange.arbitrage_opportunities(exchange_prices, **kwargs)

    def funding_rates(self, rates: dict[str, list[float]]) -> dict:
        return self.exchange.funding_rate_analysis(rates)

    def network_health(self, **kwargs) -> dict:
        return self.network.network_score(**kwargs)

    def gas_estimate(self, **kwargs) -> dict:
        return self.gas.estimate_transaction_cost(**kwargs)

    def capabilities(self) -> dict:
        return {
            "engine": "CryptoAnalysisEngine",
            "version": "1.0.0",
            "features": [
                "on_chain_metrics (NVT, MVRV, S2F, SOPR, Puell, Thermocap)",
                "whale_detection_and_flow_analysis",
                "defi_analytics (impermanent_loss, concentrated_liquidity_IL)",
                "yield_farming_comparison",
                "lending_health_factor",
                "cross_exchange_arbitrage_detection",
                "funding_rate_analysis",
                "volume_distribution_analysis",
                "network_health_scoring",
                "gas_analytics_and_estimation",
                "token_economics_analysis",
            ],
        }
