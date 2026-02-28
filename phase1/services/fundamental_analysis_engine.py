"""
Fundamental Analysis Engine — Financial statement analysis, ratios, valuation models.

Covers: income statement, balance sheet, cash flow analysis, ratio computation
(profitability, liquidity, solvency, efficiency, valuation), DCF, DDM, comparables,
residual income, DuPont decomposition, Altman Z-Score, Piotroski F-Score,
Beneish M-Score, financial health scoring, peer comparison, trend analysis.

Pure computation — no FastAPI dependencies.
"""

from __future__ import annotations

import math
import statistics
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple


# ── Enums ───────────────────────────────────────────────────────────────

class ValuationMethod(str, Enum):
    DCF = "dcf"
    DDM = "ddm"
    COMPARABLES = "comparables"
    RESIDUAL_INCOME = "residual_income"
    ASSET_BASED = "asset_based"
    EV_EBITDA = "ev_ebitda"
    PE_RELATIVE = "pe_relative"
    PEG = "peg"


class FinancialHealth(str, Enum):
    EXCELLENT = "excellent"
    GOOD = "good"
    FAIR = "fair"
    WEAK = "weak"
    DISTRESSED = "distressed"


class RatioCategory(str, Enum):
    PROFITABILITY = "profitability"
    LIQUIDITY = "liquidity"
    SOLVENCY = "solvency"
    EFFICIENCY = "efficiency"
    VALUATION = "valuation"
    GROWTH = "growth"
    COVERAGE = "coverage"


class GrowthTrend(str, Enum):
    ACCELERATING = "accelerating"
    STABLE = "stable"
    DECELERATING = "decelerating"
    DECLINING = "declining"
    VOLATILE = "volatile"


# ── Data Classes ────────────────────────────────────────────────────────

@dataclass
class IncomeStatement:
    """Annual or quarterly income statement."""
    period: str = ""
    revenue: float = 0.0
    cost_of_goods_sold: float = 0.0
    gross_profit: float = 0.0
    operating_expenses: float = 0.0
    sga_expense: float = 0.0
    rd_expense: float = 0.0
    depreciation_amortization: float = 0.0
    operating_income: float = 0.0
    interest_expense: float = 0.0
    interest_income: float = 0.0
    other_income: float = 0.0
    pretax_income: float = 0.0
    income_tax: float = 0.0
    net_income: float = 0.0
    ebitda: float = 0.0
    ebit: float = 0.0
    eps_basic: float = 0.0
    eps_diluted: float = 0.0
    shares_outstanding: float = 0.0
    shares_diluted: float = 0.0
    dividends_per_share: float = 0.0

    @property
    def gross_margin(self) -> float:
        return self.gross_profit / self.revenue if self.revenue else 0.0

    @property
    def operating_margin(self) -> float:
        return self.operating_income / self.revenue if self.revenue else 0.0

    @property
    def net_margin(self) -> float:
        return self.net_income / self.revenue if self.revenue else 0.0

    @property
    def ebitda_margin(self) -> float:
        return self.ebitda / self.revenue if self.revenue else 0.0

    @property
    def tax_rate(self) -> float:
        return self.income_tax / self.pretax_income if self.pretax_income else 0.0

    @property
    def rd_intensity(self) -> float:
        return self.rd_expense / self.revenue if self.revenue else 0.0

    def to_dict(self) -> dict:
        return {
            "period": self.period,
            "revenue": self.revenue,
            "gross_profit": self.gross_profit,
            "operating_income": self.operating_income,
            "net_income": self.net_income,
            "ebitda": self.ebitda,
            "eps_diluted": self.eps_diluted,
            "gross_margin": round(self.gross_margin, 4),
            "operating_margin": round(self.operating_margin, 4),
            "net_margin": round(self.net_margin, 4),
            "ebitda_margin": round(self.ebitda_margin, 4),
        }


@dataclass
class BalanceSheet:
    """Annual or quarterly balance sheet."""
    period: str = ""
    # Assets
    cash_and_equivalents: float = 0.0
    short_term_investments: float = 0.0
    accounts_receivable: float = 0.0
    inventory: float = 0.0
    other_current_assets: float = 0.0
    total_current_assets: float = 0.0
    property_plant_equipment: float = 0.0
    goodwill: float = 0.0
    intangible_assets: float = 0.0
    long_term_investments: float = 0.0
    other_non_current_assets: float = 0.0
    total_assets: float = 0.0
    # Liabilities
    accounts_payable: float = 0.0
    short_term_debt: float = 0.0
    current_portion_lt_debt: float = 0.0
    accrued_liabilities: float = 0.0
    other_current_liabilities: float = 0.0
    total_current_liabilities: float = 0.0
    long_term_debt: float = 0.0
    deferred_tax_liabilities: float = 0.0
    other_non_current_liabilities: float = 0.0
    total_liabilities: float = 0.0
    # Equity
    common_stock: float = 0.0
    retained_earnings: float = 0.0
    additional_paid_in_capital: float = 0.0
    treasury_stock: float = 0.0
    accumulated_other_comprehensive_income: float = 0.0
    total_shareholders_equity: float = 0.0
    minority_interest: float = 0.0
    total_equity: float = 0.0
    shares_outstanding: float = 0.0

    @property
    def net_debt(self) -> float:
        return (self.short_term_debt + self.long_term_debt +
                self.current_portion_lt_debt - self.cash_and_equivalents -
                self.short_term_investments)

    @property
    def working_capital(self) -> float:
        return self.total_current_assets - self.total_current_liabilities

    @property
    def tangible_book_value(self) -> float:
        return self.total_shareholders_equity - self.goodwill - self.intangible_assets

    @property
    def book_value_per_share(self) -> float:
        return self.total_shareholders_equity / self.shares_outstanding if self.shares_outstanding else 0.0

    @property
    def tangible_bvps(self) -> float:
        return self.tangible_book_value / self.shares_outstanding if self.shares_outstanding else 0.0

    def to_dict(self) -> dict:
        return {
            "period": self.period,
            "total_assets": self.total_assets,
            "total_liabilities": self.total_liabilities,
            "total_equity": self.total_equity,
            "cash": self.cash_and_equivalents,
            "net_debt": round(self.net_debt, 2),
            "working_capital": round(self.working_capital, 2),
            "book_value_per_share": round(self.book_value_per_share, 2),
        }


@dataclass
class CashFlowStatement:
    """Annual or quarterly cash flow statement."""
    period: str = ""
    # Operating
    net_income: float = 0.0
    depreciation_amortization: float = 0.0
    stock_based_compensation: float = 0.0
    change_in_working_capital: float = 0.0
    change_in_receivables: float = 0.0
    change_in_inventory: float = 0.0
    change_in_payables: float = 0.0
    deferred_taxes: float = 0.0
    other_operating: float = 0.0
    operating_cash_flow: float = 0.0
    # Investing
    capital_expenditure: float = 0.0
    acquisitions: float = 0.0
    purchases_of_investments: float = 0.0
    sales_of_investments: float = 0.0
    other_investing: float = 0.0
    investing_cash_flow: float = 0.0
    # Financing
    debt_issuance: float = 0.0
    debt_repayment: float = 0.0
    share_issuance: float = 0.0
    share_repurchase: float = 0.0
    dividends_paid: float = 0.0
    other_financing: float = 0.0
    financing_cash_flow: float = 0.0
    # Summary
    net_change_in_cash: float = 0.0
    beginning_cash: float = 0.0
    ending_cash: float = 0.0

    @property
    def free_cash_flow(self) -> float:
        return self.operating_cash_flow - abs(self.capital_expenditure)

    @property
    def fcf_margin(self) -> float:
        return 0.0  # Needs revenue — compute externally

    @property
    def capex_to_ocf(self) -> float:
        return abs(self.capital_expenditure) / self.operating_cash_flow if self.operating_cash_flow else 0.0

    def to_dict(self) -> dict:
        return {
            "period": self.period,
            "operating_cash_flow": self.operating_cash_flow,
            "investing_cash_flow": self.investing_cash_flow,
            "financing_cash_flow": self.financing_cash_flow,
            "free_cash_flow": round(self.free_cash_flow, 2),
            "capex": self.capital_expenditure,
            "dividends_paid": self.dividends_paid,
        }


@dataclass
class ValuationResult:
    """Result of a valuation model."""
    method: ValuationMethod
    intrinsic_value: float
    current_price: float
    upside_pct: float
    confidence: float = 0.5
    assumptions: Dict[str, Any] = field(default_factory=dict)

    @property
    def margin_of_safety(self) -> float:
        return (self.intrinsic_value - self.current_price) / self.intrinsic_value if self.intrinsic_value else 0.0

    def to_dict(self) -> dict:
        return {
            "method": self.method.value,
            "intrinsic_value": round(self.intrinsic_value, 2),
            "current_price": round(self.current_price, 2),
            "upside_pct": round(self.upside_pct, 2),
            "margin_of_safety": round(self.margin_of_safety, 4),
            "confidence": round(self.confidence, 2),
            "assumptions": self.assumptions,
        }


# ── Ratio Calculators ──────────────────────────────────────────────────

class ProfitabilityRatios:
    """Calculate profitability metrics from financial statements."""

    @staticmethod
    def all_ratios(income: IncomeStatement, balance: BalanceSheet) -> dict:
        ta = balance.total_assets if balance.total_assets else 1
        te = balance.total_shareholders_equity if balance.total_shareholders_equity else 1
        rev = income.revenue if income.revenue else 1

        return {
            "gross_margin": round(income.gross_margin, 4),
            "operating_margin": round(income.operating_margin, 4),
            "net_margin": round(income.net_margin, 4),
            "ebitda_margin": round(income.ebitda_margin, 4),
            "return_on_assets": round(income.net_income / ta, 4),
            "return_on_equity": round(income.net_income / te, 4),
            "return_on_invested_capital": round(
                income.operating_income * (1 - income.tax_rate) /
                (te + balance.long_term_debt) if (te + balance.long_term_debt) else 0, 4),
            "return_on_capital_employed": round(
                income.ebit / (ta - balance.total_current_liabilities)
                if (ta - balance.total_current_liabilities) else 0, 4),
            "asset_turnover": round(rev / ta, 4),
            "rd_intensity": round(income.rd_intensity, 4),
        }


class LiquidityRatios:
    """Calculate liquidity metrics."""

    @staticmethod
    def all_ratios(balance: BalanceSheet) -> dict:
        cl = balance.total_current_liabilities if balance.total_current_liabilities else 1

        quick_assets = (balance.cash_and_equivalents +
                        balance.short_term_investments +
                        balance.accounts_receivable)

        return {
            "current_ratio": round(balance.total_current_assets / cl, 4),
            "quick_ratio": round(quick_assets / cl, 4),
            "cash_ratio": round(
                (balance.cash_and_equivalents + balance.short_term_investments) / cl, 4),
            "working_capital": round(balance.working_capital, 2),
            "working_capital_ratio": round(balance.working_capital / balance.total_assets, 4)
            if balance.total_assets else 0,
            "defensive_interval": round(
                quick_assets / (balance.total_current_liabilities / 365)
                if balance.total_current_liabilities else 0, 1),
        }


class SolvencyRatios:
    """Calculate solvency/leverage metrics."""

    @staticmethod
    def all_ratios(
        balance: BalanceSheet,
        income: Optional[IncomeStatement] = None,
        cash_flow: Optional[CashFlowStatement] = None,
    ) -> dict:
        ta = balance.total_assets if balance.total_assets else 1
        te = balance.total_shareholders_equity if balance.total_shareholders_equity else 1
        total_debt = balance.short_term_debt + balance.long_term_debt + balance.current_portion_lt_debt

        ratios = {
            "debt_to_equity": round(total_debt / te, 4),
            "debt_to_assets": round(total_debt / ta, 4),
            "equity_multiplier": round(ta / te, 4),
            "net_debt_to_equity": round(balance.net_debt / te, 4),
            "long_term_debt_to_equity": round(balance.long_term_debt / te, 4),
            "total_liabilities_to_equity": round(balance.total_liabilities / te, 4),
            "financial_leverage": round(ta / te, 4),
        }

        if income:
            ebitda = income.ebitda if income.ebitda else 1
            ratios["net_debt_to_ebitda"] = round(balance.net_debt / ebitda, 4)
            ratios["interest_coverage"] = round(
                income.ebit / income.interest_expense if income.interest_expense else 999, 4)
            ratios["cash_interest_coverage"] = round(
                income.ebitda / income.interest_expense if income.interest_expense else 999, 4)

        if cash_flow:
            ratios["debt_service_coverage"] = round(
                cash_flow.operating_cash_flow / (total_debt / 5)
                if total_debt else 999, 4)
            ratios["ocf_to_debt"] = round(
                cash_flow.operating_cash_flow / total_debt if total_debt else 999, 4)

        return ratios


class EfficiencyRatios:
    """Calculate efficiency/activity metrics."""

    @staticmethod
    def all_ratios(income: IncomeStatement, balance: BalanceSheet) -> dict:
        rev = income.revenue if income.revenue else 1
        cogs = income.cost_of_goods_sold if income.cost_of_goods_sold else 1
        ar = balance.accounts_receivable if balance.accounts_receivable else 1
        inv = balance.inventory if balance.inventory else 1
        ap = balance.accounts_payable if balance.accounts_payable else 1
        ta = balance.total_assets if balance.total_assets else 1

        receivables_turnover = rev / ar
        inventory_turnover = cogs / inv
        payables_turnover = cogs / ap

        return {
            "asset_turnover": round(rev / ta, 4),
            "fixed_asset_turnover": round(
                rev / balance.property_plant_equipment
                if balance.property_plant_equipment else 0, 4),
            "receivables_turnover": round(receivables_turnover, 4),
            "days_sales_outstanding": round(365 / receivables_turnover, 1),
            "inventory_turnover": round(inventory_turnover, 4),
            "days_inventory_outstanding": round(365 / inventory_turnover, 1),
            "payables_turnover": round(payables_turnover, 4),
            "days_payable_outstanding": round(365 / payables_turnover, 1),
            "cash_conversion_cycle": round(
                365 / receivables_turnover + 365 / inventory_turnover - 365 / payables_turnover, 1),
            "working_capital_turnover": round(
                rev / balance.working_capital if balance.working_capital else 0, 4),
        }


class ValuationRatios:
    """Calculate valuation metrics."""

    @staticmethod
    def all_ratios(
        income: IncomeStatement,
        balance: BalanceSheet,
        cash_flow: Optional[CashFlowStatement] = None,
        market_price: float = 0.0,
        market_cap: float = 0.0,
    ) -> dict:
        eps = income.eps_diluted if income.eps_diluted else 0.001
        bvps = balance.book_value_per_share if balance.book_value_per_share else 0.001
        revenue_per_share = income.revenue / balance.shares_outstanding if balance.shares_outstanding else 0.001

        ratios = {
            "pe_ratio": round(market_price / eps if eps else 0, 2),
            "price_to_book": round(market_price / bvps if bvps else 0, 2),
            "price_to_sales": round(market_price / revenue_per_share if revenue_per_share else 0, 2),
            "price_to_tangible_book": round(
                market_price / balance.tangible_bvps if balance.tangible_bvps else 0, 2),
            "earnings_yield": round(eps / market_price * 100 if market_price else 0, 2),
            "dividend_yield": round(
                income.dividends_per_share / market_price * 100 if market_price else 0, 2),
            "payout_ratio": round(
                income.dividends_per_share / eps * 100 if eps else 0, 2),
        }

        if market_cap:
            ebitda = income.ebitda if income.ebitda else 0.001
            ev = market_cap + balance.net_debt
            ratios["ev_to_ebitda"] = round(ev / ebitda if ebitda else 0, 2)
            ratios["ev_to_revenue"] = round(ev / income.revenue if income.revenue else 0, 2)
            ratios["ev_to_ebit"] = round(ev / income.ebit if income.ebit else 0, 2)
            ratios["enterprise_value"] = round(ev, 2)

        if cash_flow:
            fcf = cash_flow.free_cash_flow
            fcf_ps = fcf / balance.shares_outstanding if balance.shares_outstanding else 0
            ratios["price_to_fcf"] = round(market_price / fcf_ps if fcf_ps else 0, 2)
            ratios["fcf_yield"] = round(fcf_ps / market_price * 100 if market_price else 0, 2)
            if market_cap:
                ratios["ev_to_fcf"] = round((market_cap + balance.net_debt) / fcf if fcf else 0, 2)

        return ratios


class GrowthRatios:
    """Calculate growth metrics from multi-period data."""

    @staticmethod
    def period_growth(current: float, prior: float) -> float:
        if prior == 0:
            return 0.0
        return (current - prior) / abs(prior)

    @staticmethod
    def cagr(begin: float, end: float, years: int) -> float:
        if begin <= 0 or end <= 0 or years <= 0:
            return 0.0
        return (end / begin) ** (1 / years) - 1

    @staticmethod
    def all_growth(
        current_income: IncomeStatement,
        prior_income: IncomeStatement,
        current_balance: Optional[BalanceSheet] = None,
        prior_balance: Optional[BalanceSheet] = None,
    ) -> dict:
        pg = GrowthRatios.period_growth
        growth = {
            "revenue_growth": round(pg(current_income.revenue, prior_income.revenue), 4),
            "gross_profit_growth": round(pg(current_income.gross_profit, prior_income.gross_profit), 4),
            "operating_income_growth": round(
                pg(current_income.operating_income, prior_income.operating_income), 4),
            "net_income_growth": round(pg(current_income.net_income, prior_income.net_income), 4),
            "ebitda_growth": round(pg(current_income.ebitda, prior_income.ebitda), 4),
            "eps_growth": round(pg(current_income.eps_diluted, prior_income.eps_diluted), 4),
        }

        if current_balance and prior_balance:
            growth["total_assets_growth"] = round(
                pg(current_balance.total_assets, prior_balance.total_assets), 4)
            growth["equity_growth"] = round(
                pg(current_balance.total_shareholders_equity,
                   prior_balance.total_shareholders_equity), 4)

        return growth

    @staticmethod
    def growth_trend(values: list[float]) -> GrowthTrend:
        if len(values) < 3:
            return GrowthTrend.STABLE

        growth_rates = [
            GrowthRatios.period_growth(values[i], values[i - 1])
            for i in range(1, len(values))
        ]

        if all(g > 0 for g in growth_rates):
            diffs = [growth_rates[i] - growth_rates[i - 1] for i in range(1, len(growth_rates))]
            if all(d > 0 for d in diffs):
                return GrowthTrend.ACCELERATING
            elif all(d < 0 for d in diffs):
                return GrowthTrend.DECELERATING
            return GrowthTrend.STABLE

        if all(g < 0 for g in growth_rates):
            return GrowthTrend.DECLINING

        if len(growth_rates) > 2:
            stdev = statistics.stdev(growth_rates)
            mean_g = statistics.mean(growth_rates)
            if stdev > abs(mean_g) * 2:
                return GrowthTrend.VOLATILE

        return GrowthTrend.STABLE


# ── Valuation Models ────────────────────────────────────────────────────

class DCFModel:
    """Discounted Cash Flow valuation model."""

    @staticmethod
    def project_fcf(
        base_fcf: float,
        growth_rates: list[float],
    ) -> list[float]:
        projected = []
        fcf = base_fcf
        for g in growth_rates:
            fcf *= (1 + g)
            projected.append(fcf)
        return projected

    @staticmethod
    def terminal_value_gordon(
        final_fcf: float,
        terminal_growth: float,
        wacc: float,
    ) -> float:
        if wacc <= terminal_growth:
            return final_fcf * 20  # cap
        return final_fcf * (1 + terminal_growth) / (wacc - terminal_growth)

    @staticmethod
    def terminal_value_exit_multiple(
        final_ebitda: float,
        exit_multiple: float,
    ) -> float:
        return final_ebitda * exit_multiple

    @staticmethod
    def discount_cash_flows(
        cash_flows: list[float],
        terminal_value: float,
        wacc: float,
    ) -> float:
        pv = 0.0
        for i, cf in enumerate(cash_flows):
            pv += cf / ((1 + wacc) ** (i + 1))
        pv += terminal_value / ((1 + wacc) ** len(cash_flows))
        return pv

    @staticmethod
    def equity_value(
        enterprise_value: float,
        net_debt: float,
        minority_interest: float = 0.0,
    ) -> float:
        return enterprise_value - net_debt - minority_interest

    @staticmethod
    def intrinsic_value_per_share(
        equity_value: float,
        shares_outstanding: float,
    ) -> float:
        return equity_value / shares_outstanding if shares_outstanding else 0.0

    @staticmethod
    def full_dcf(
        base_fcf: float,
        growth_rates: list[float],
        terminal_growth: float,
        wacc: float,
        net_debt: float,
        shares_outstanding: float,
        current_price: float,
    ) -> ValuationResult:
        projected = DCFModel.project_fcf(base_fcf, growth_rates)
        if not projected:
            projected = [base_fcf]
        tv = DCFModel.terminal_value_gordon(projected[-1], terminal_growth, wacc)
        ev = DCFModel.discount_cash_flows(projected, tv, wacc)
        eq = DCFModel.equity_value(ev, net_debt)
        ivps = DCFModel.intrinsic_value_per_share(eq, shares_outstanding)
        upside = ((ivps / current_price) - 1) * 100 if current_price else 0

        return ValuationResult(
            method=ValuationMethod.DCF,
            intrinsic_value=ivps,
            current_price=current_price,
            upside_pct=upside,
            confidence=0.6,
            assumptions={
                "growth_rates": [round(g, 4) for g in growth_rates],
                "terminal_growth": terminal_growth,
                "wacc": wacc,
                "base_fcf": base_fcf,
                "enterprise_value": round(ev, 2),
                "terminal_value": round(tv, 2),
            },
        )


class DDMModel:
    """Dividend Discount Model (Gordon Growth)."""

    @staticmethod
    def gordon_growth(
        dividend: float,
        growth_rate: float,
        required_return: float,
    ) -> float:
        if required_return <= growth_rate:
            return dividend * 50  # cap
        return dividend * (1 + growth_rate) / (required_return - growth_rate)

    @staticmethod
    def two_stage_ddm(
        current_dividend: float,
        high_growth: float,
        high_growth_years: int,
        stable_growth: float,
        required_return: float,
    ) -> float:
        pv = 0.0
        div = current_dividend
        for i in range(1, high_growth_years + 1):
            div *= (1 + high_growth)
            pv += div / ((1 + required_return) ** i)

        terminal_div = div * (1 + stable_growth)
        if required_return > stable_growth:
            tv = terminal_div / (required_return - stable_growth)
        else:
            tv = terminal_div * 50
        pv += tv / ((1 + required_return) ** high_growth_years)

        return pv

    @staticmethod
    def h_model(
        current_dividend: float,
        high_growth: float,
        stable_growth: float,
        half_life_years: float,
        required_return: float,
    ) -> float:
        """H-Model: growth declines linearly from high to stable."""
        if required_return <= stable_growth:
            return current_dividend * 50
        d0 = current_dividend
        value = (d0 * (1 + stable_growth) / (required_return - stable_growth) +
                 d0 * half_life_years * (high_growth - stable_growth) /
                 (required_return - stable_growth))
        return value

    @staticmethod
    def full_ddm(
        current_dividend: float,
        growth_rate: float,
        required_return: float,
        current_price: float,
        method: str = "gordon",
    ) -> ValuationResult:
        if method == "gordon":
            iv = DDMModel.gordon_growth(current_dividend, growth_rate, required_return)
        elif method == "two_stage":
            iv = DDMModel.two_stage_ddm(
                current_dividend, growth_rate, 5, growth_rate * 0.5, required_return)
        else:
            iv = DDMModel.gordon_growth(current_dividend, growth_rate, required_return)

        upside = ((iv / current_price) - 1) * 100 if current_price else 0

        return ValuationResult(
            method=ValuationMethod.DDM,
            intrinsic_value=iv,
            current_price=current_price,
            upside_pct=upside,
            confidence=0.5,
            assumptions={
                "current_dividend": current_dividend,
                "growth_rate": growth_rate,
                "required_return": required_return,
                "model": method,
            },
        )


class ComparablesValuation:
    """Relative valuation using peer comparables."""

    @staticmethod
    def pe_based(
        company_eps: float,
        peer_pe_ratios: list[float],
        current_price: float,
    ) -> ValuationResult:
        if not peer_pe_ratios:
            return ValuationResult(ValuationMethod.PE_RELATIVE, 0, current_price, 0)

        median_pe = sorted(peer_pe_ratios)[len(peer_pe_ratios) // 2]
        iv = company_eps * median_pe
        upside = ((iv / current_price) - 1) * 100 if current_price else 0

        return ValuationResult(
            method=ValuationMethod.PE_RELATIVE,
            intrinsic_value=iv,
            current_price=current_price,
            upside_pct=upside,
            confidence=0.55,
            assumptions={"median_peer_pe": median_pe, "company_eps": company_eps},
        )

    @staticmethod
    def ev_ebitda_based(
        company_ebitda: float,
        peer_ev_ebitda: list[float],
        net_debt: float,
        shares_outstanding: float,
        current_price: float,
    ) -> ValuationResult:
        if not peer_ev_ebitda:
            return ValuationResult(ValuationMethod.EV_EBITDA, 0, current_price, 0)

        median = sorted(peer_ev_ebitda)[len(peer_ev_ebitda) // 2]
        ev = company_ebitda * median
        equity = ev - net_debt
        ivps = equity / shares_outstanding if shares_outstanding else 0
        upside = ((ivps / current_price) - 1) * 100 if current_price else 0

        return ValuationResult(
            method=ValuationMethod.EV_EBITDA,
            intrinsic_value=ivps,
            current_price=current_price,
            upside_pct=upside,
            confidence=0.6,
            assumptions={"median_ev_ebitda": median, "implied_ev": round(ev, 2)},
        )

    @staticmethod
    def peg_based(
        pe_ratio: float,
        earnings_growth: float,
        current_price: float,
        fair_peg: float = 1.0,
    ) -> ValuationResult:
        if earnings_growth <= 0:
            return ValuationResult(ValuationMethod.PEG, current_price, current_price, 0)

        current_peg = pe_ratio / (earnings_growth * 100)
        fair_pe = fair_peg * earnings_growth * 100
        iv = (fair_pe / pe_ratio) * current_price if pe_ratio else current_price
        upside = ((iv / current_price) - 1) * 100 if current_price else 0

        return ValuationResult(
            method=ValuationMethod.PEG,
            intrinsic_value=iv,
            current_price=current_price,
            upside_pct=upside,
            confidence=0.45,
            assumptions={"current_peg": round(current_peg, 2), "fair_peg": fair_peg},
        )


class ResidualIncomeModel:
    """Residual income / EVA valuation model."""

    @staticmethod
    def residual_income(
        net_income: float,
        equity: float,
        cost_of_equity: float,
    ) -> float:
        return net_income - (equity * cost_of_equity)

    @staticmethod
    def economic_value_added(
        nopat: float,
        invested_capital: float,
        wacc: float,
    ) -> float:
        return nopat - (invested_capital * wacc)

    @staticmethod
    def value_from_ri(
        book_value: float,
        projected_ri: list[float],
        cost_of_equity: float,
        terminal_ri: float = 0.0,
    ) -> float:
        pv_ri = sum(
            ri / ((1 + cost_of_equity) ** (i + 1))
            for i, ri in enumerate(projected_ri)
        )
        if cost_of_equity > 0:
            pv_terminal = (terminal_ri / cost_of_equity) / ((1 + cost_of_equity) ** len(projected_ri))
        else:
            pv_terminal = 0
        return book_value + pv_ri + pv_terminal


# ── Quality Scores ─────────────────────────────────────────────────────

class AltmanZScore:
    """Altman Z-Score bankruptcy predictor."""

    @staticmethod
    def calculate(
        working_capital: float,
        retained_earnings: float,
        ebit: float,
        market_cap: float,
        total_liabilities: float,
        revenue: float,
        total_assets: float,
    ) -> dict:
        ta = total_assets if total_assets else 1

        x1 = working_capital / ta
        x2 = retained_earnings / ta
        x3 = ebit / ta
        x4 = market_cap / (total_liabilities if total_liabilities else 1)
        x5 = revenue / ta

        z = 1.2 * x1 + 1.4 * x2 + 3.3 * x3 + 0.6 * x4 + 1.0 * x5

        if z > 2.99:
            zone = "safe"
        elif z > 1.81:
            zone = "grey"
        else:
            zone = "distress"

        return {
            "z_score": round(z, 4),
            "zone": zone,
            "components": {
                "x1_working_capital": round(x1, 4),
                "x2_retained_earnings": round(x2, 4),
                "x3_ebit": round(x3, 4),
                "x4_market_to_debt": round(x4, 4),
                "x5_asset_turnover": round(x5, 4),
            },
        }


class PiotroskiFScore:
    """Piotroski F-Score (0-9) for financial strength."""

    @staticmethod
    def calculate(
        # Current year
        net_income: float,
        operating_cash_flow: float,
        roa_current: float,
        roa_prior: float,
        # Leverage & liquidity
        long_term_debt_current: float,
        long_term_debt_prior: float,
        current_ratio_current: float,
        current_ratio_prior: float,
        shares_current: float,
        shares_prior: float,
        # Efficiency
        gross_margin_current: float,
        gross_margin_prior: float,
        asset_turnover_current: float,
        asset_turnover_prior: float,
    ) -> dict:
        score = 0
        details = {}

        # Profitability (4 points)
        details["positive_net_income"] = net_income > 0
        if net_income > 0:
            score += 1

        details["positive_ocf"] = operating_cash_flow > 0
        if operating_cash_flow > 0:
            score += 1

        details["improving_roa"] = roa_current > roa_prior
        if roa_current > roa_prior:
            score += 1

        details["ocf_exceeds_ni"] = operating_cash_flow > net_income
        if operating_cash_flow > net_income:
            score += 1

        # Leverage/liquidity (3 points)
        details["decreasing_leverage"] = long_term_debt_current < long_term_debt_prior
        if long_term_debt_current < long_term_debt_prior:
            score += 1

        details["improving_current_ratio"] = current_ratio_current > current_ratio_prior
        if current_ratio_current > current_ratio_prior:
            score += 1

        details["no_dilution"] = shares_current <= shares_prior
        if shares_current <= shares_prior:
            score += 1

        # Operating efficiency (2 points)
        details["improving_gross_margin"] = gross_margin_current > gross_margin_prior
        if gross_margin_current > gross_margin_prior:
            score += 1

        details["improving_asset_turnover"] = asset_turnover_current > asset_turnover_prior
        if asset_turnover_current > asset_turnover_prior:
            score += 1

        if score >= 8:
            signal = "strong_buy"
        elif score >= 6:
            signal = "buy"
        elif score >= 4:
            signal = "hold"
        elif score >= 2:
            signal = "sell"
        else:
            signal = "strong_sell"

        return {
            "f_score": score,
            "max_score": 9,
            "signal": signal,
            "details": details,
        }


class BeneishMScore:
    """Beneish M-Score — earnings manipulation detector."""

    @staticmethod
    def calculate(
        dsri: float,  # Days Sales in Receivables Index
        gmi: float,   # Gross Margin Index
        aqi: float,   # Asset Quality Index
        sgi: float,   # Sales Growth Index
        depi: float,  # Depreciation Index
        sgai: float,  # SGA Index
        lvgi: float,  # Leverage Index
        tata: float,  # Total Accruals to Total Assets
    ) -> dict:
        m = (-4.84 + 0.920 * dsri + 0.528 * gmi + 0.404 * aqi +
             0.892 * sgi + 0.115 * depi - 0.172 * sgai +
             4.679 * tata - 0.327 * lvgi)

        if m > -1.78:
            flag = "likely_manipulator"
        else:
            flag = "unlikely_manipulator"

        return {
            "m_score": round(m, 4),
            "flag": flag,
            "threshold": -1.78,
            "components": {
                "dsri": round(dsri, 4),
                "gmi": round(gmi, 4),
                "aqi": round(aqi, 4),
                "sgi": round(sgi, 4),
                "depi": round(depi, 4),
                "sgai": round(sgai, 4),
                "lvgi": round(lvgi, 4),
                "tata": round(tata, 4),
            },
        }

    @staticmethod
    def from_statements(
        current_income: IncomeStatement,
        prior_income: IncomeStatement,
        current_balance: BalanceSheet,
        prior_balance: BalanceSheet,
    ) -> dict:
        """Compute M-Score directly from financial statements."""
        # DSRI
        ar_curr = current_balance.accounts_receivable or 1
        ar_prior = prior_balance.accounts_receivable or 1
        rev_curr = current_income.revenue or 1
        rev_prior = prior_income.revenue or 1
        dsri = (ar_curr / rev_curr) / (ar_prior / rev_prior)

        # GMI
        gm_prior = prior_income.gross_margin or 0.001
        gm_curr = current_income.gross_margin or 0.001
        gmi = gm_prior / gm_curr if gm_curr else 1

        # AQI
        ta_curr = current_balance.total_assets or 1
        ta_prior = prior_balance.total_assets or 1
        ca_curr = current_balance.total_current_assets
        ppe_curr = current_balance.property_plant_equipment
        ca_prior = prior_balance.total_current_assets
        ppe_prior = prior_balance.property_plant_equipment
        aq_curr = 1 - (ca_curr + ppe_curr) / ta_curr
        aq_prior = 1 - (ca_prior + ppe_prior) / ta_prior
        aqi = aq_curr / aq_prior if aq_prior else 1

        # SGI
        sgi = rev_curr / rev_prior

        # DEPI
        da_curr = current_income.depreciation_amortization
        da_prior = prior_income.depreciation_amortization
        depi_curr = da_curr / (da_curr + ppe_curr) if (da_curr + ppe_curr) else 0
        depi_prior = da_prior / (da_prior + ppe_prior) if (da_prior + ppe_prior) else 0
        depi = depi_prior / depi_curr if depi_curr else 1

        # SGAI
        sga_curr = current_income.sga_expense / rev_curr if rev_curr else 0
        sga_prior = prior_income.sga_expense / rev_prior if rev_prior else 0
        sgai = sga_curr / sga_prior if sga_prior else 1

        # LVGI
        tl_curr = current_balance.total_liabilities
        tl_prior = prior_balance.total_liabilities
        lvgi = (tl_curr / ta_curr) / (tl_prior / ta_prior) if (tl_prior / ta_prior) else 1

        # TATA
        tata = (current_income.net_income -
                (current_balance.total_current_assets - prior_balance.total_current_assets -
                 (current_balance.cash_and_equivalents - prior_balance.cash_and_equivalents) -
                 (current_balance.total_current_liabilities - prior_balance.total_current_liabilities))) / ta_curr

        return BeneishMScore.calculate(dsri, gmi, aqi, sgi, depi, sgai, lvgi, tata)


class DuPontAnalysis:
    """DuPont decomposition of ROE."""

    @staticmethod
    def three_way(
        net_income: float,
        revenue: float,
        total_assets: float,
        total_equity: float,
    ) -> dict:
        net_margin = net_income / revenue if revenue else 0
        asset_turnover = revenue / total_assets if total_assets else 0
        equity_multiplier = total_assets / total_equity if total_equity else 0
        roe = net_margin * asset_turnover * equity_multiplier

        return {
            "roe": round(roe, 4),
            "net_margin": round(net_margin, 4),
            "asset_turnover": round(asset_turnover, 4),
            "equity_multiplier": round(equity_multiplier, 4),
        }

    @staticmethod
    def five_way(
        ebt: float,
        ebit: float,
        revenue: float,
        total_assets: float,
        total_equity: float,
        net_income: float,
    ) -> dict:
        tax_burden = net_income / ebt if ebt else 0
        interest_burden = ebt / ebit if ebit else 0
        operating_margin = ebit / revenue if revenue else 0
        asset_turnover = revenue / total_assets if total_assets else 0
        equity_multiplier = total_assets / total_equity if total_equity else 0
        roe = tax_burden * interest_burden * operating_margin * asset_turnover * equity_multiplier

        return {
            "roe": round(roe, 4),
            "tax_burden": round(tax_burden, 4),
            "interest_burden": round(interest_burden, 4),
            "operating_margin": round(operating_margin, 4),
            "asset_turnover": round(asset_turnover, 4),
            "equity_multiplier": round(equity_multiplier, 4),
        }


# ── Financial Health Scorer ────────────────────────────────────────────

class FinancialHealthScorer:
    """Composite financial health score."""

    @staticmethod
    def score(
        profitability: dict,
        liquidity: dict,
        solvency: dict,
        efficiency: dict,
    ) -> dict:
        points = 0
        max_points = 100
        details = {}

        # Profitability (30 pts)
        if profitability.get("net_margin", 0) > 0.15:
            points += 10
        elif profitability.get("net_margin", 0) > 0.05:
            points += 5

        if profitability.get("return_on_equity", 0) > 0.15:
            points += 10
        elif profitability.get("return_on_equity", 0) > 0.08:
            points += 5

        if profitability.get("return_on_assets", 0) > 0.08:
            points += 10
        elif profitability.get("return_on_assets", 0) > 0.03:
            points += 5

        details["profitability_score"] = min(points, 30)

        # Liquidity (20 pts)
        liq_pts = 0
        cr = liquidity.get("current_ratio", 0)
        if 1.5 <= cr <= 3.0:
            liq_pts += 10
        elif cr >= 1.0:
            liq_pts += 5

        qr = liquidity.get("quick_ratio", 0)
        if qr >= 1.0:
            liq_pts += 10
        elif qr >= 0.5:
            liq_pts += 5

        details["liquidity_score"] = min(liq_pts, 20)
        points += details["liquidity_score"]

        # Solvency (30 pts)
        solv_pts = 0
        de = solvency.get("debt_to_equity", 999)
        if de < 0.5:
            solv_pts += 15
        elif de < 1.0:
            solv_pts += 10
        elif de < 2.0:
            solv_pts += 5

        ic = solvency.get("interest_coverage", 0)
        if ic > 10:
            solv_pts += 15
        elif ic > 5:
            solv_pts += 10
        elif ic > 2:
            solv_pts += 5

        details["solvency_score"] = min(solv_pts, 30)
        points += details["solvency_score"]

        # Efficiency (20 pts)
        eff_pts = 0
        ccc = efficiency.get("cash_conversion_cycle", 999)
        if ccc < 30:
            eff_pts += 10
        elif ccc < 60:
            eff_pts += 5

        at = efficiency.get("asset_turnover", 0)
        if at > 1.5:
            eff_pts += 10
        elif at > 0.5:
            eff_pts += 5

        details["efficiency_score"] = min(eff_pts, 20)
        points += details["efficiency_score"]

        total = min(points, max_points)

        if total >= 80:
            health = FinancialHealth.EXCELLENT
        elif total >= 60:
            health = FinancialHealth.GOOD
        elif total >= 40:
            health = FinancialHealth.FAIR
        elif total >= 20:
            health = FinancialHealth.WEAK
        else:
            health = FinancialHealth.DISTRESSED

        return {
            "total_score": total,
            "max_score": max_points,
            "health": health.value,
            "details": details,
        }


# ── Peer Comparison ────────────────────────────────────────────────────

class PeerComparison:
    """Compare a company against peers on multiple dimensions."""

    @staticmethod
    def rank_among_peers(
        company_value: float,
        peer_values: list[float],
        higher_is_better: bool = True,
    ) -> dict:
        all_values = peer_values + [company_value]
        sorted_vals = sorted(all_values, reverse=higher_is_better)
        rank = sorted_vals.index(company_value) + 1
        percentile = (1 - (rank - 1) / len(all_values)) * 100

        return {
            "value": round(company_value, 4),
            "rank": rank,
            "total": len(all_values),
            "percentile": round(percentile, 1),
            "peer_median": round(statistics.median(peer_values), 4) if peer_values else 0,
            "peer_mean": round(statistics.mean(peer_values), 4) if peer_values else 0,
        }

    @staticmethod
    def multi_metric_comparison(
        company_metrics: dict,
        peer_metrics_list: list[dict],
        higher_is_better_map: dict,
    ) -> dict:
        results = {}
        for metric, company_val in company_metrics.items():
            peer_vals = [p.get(metric, 0) for p in peer_metrics_list if metric in p]
            hib = higher_is_better_map.get(metric, True)
            results[metric] = PeerComparison.rank_among_peers(company_val, peer_vals, hib)
        return results


# ── Trend Analyzer ─────────────────────────────────────────────────────

class FinancialTrendAnalyzer:
    """Analyze trends across multiple reporting periods."""

    @staticmethod
    def revenue_trend(incomes: list[IncomeStatement]) -> dict:
        revenues = [i.revenue for i in incomes]
        return FinancialTrendAnalyzer._analyze_metric(revenues, "revenue")

    @staticmethod
    def margin_trends(incomes: list[IncomeStatement]) -> dict:
        return {
            "gross_margin": FinancialTrendAnalyzer._analyze_metric(
                [i.gross_margin for i in incomes], "gross_margin"),
            "operating_margin": FinancialTrendAnalyzer._analyze_metric(
                [i.operating_margin for i in incomes], "operating_margin"),
            "net_margin": FinancialTrendAnalyzer._analyze_metric(
                [i.net_margin for i in incomes], "net_margin"),
        }

    @staticmethod
    def cash_flow_quality(
        incomes: list[IncomeStatement],
        cash_flows: list[CashFlowStatement],
    ) -> dict:
        if not incomes or not cash_flows:
            return {"quality": "unknown"}

        accrual_ratios = []
        for inc, cf in zip(incomes, cash_flows):
            if inc.net_income != 0:
                ratio = cf.operating_cash_flow / inc.net_income
                accrual_ratios.append(ratio)

        if not accrual_ratios:
            return {"quality": "unknown"}

        avg = statistics.mean(accrual_ratios)
        if avg > 1.2:
            quality = "excellent"
        elif avg > 0.8:
            quality = "good"
        elif avg > 0.5:
            quality = "fair"
        else:
            quality = "poor"

        return {
            "quality": quality,
            "avg_ocf_to_ni": round(avg, 4),
            "ratios": [round(r, 4) for r in accrual_ratios],
        }

    @staticmethod
    def _analyze_metric(values: list[float], name: str) -> dict:
        if len(values) < 2:
            return {"metric": name, "trend": "insufficient_data"}

        growth_rates = [
            GrowthRatios.period_growth(values[i], values[i - 1])
            for i in range(1, len(values))
        ]

        trend = GrowthRatios.growth_trend(values)

        result = {
            "metric": name,
            "values": [round(v, 2) for v in values],
            "growth_rates": [round(g, 4) for g in growth_rates],
            "trend": trend.value,
            "latest": round(values[-1], 2),
            "avg_growth": round(statistics.mean(growth_rates), 4) if growth_rates else 0,
        }

        if len(values) >= 3:
            result["cagr"] = round(
                GrowthRatios.cagr(values[0], values[-1], len(values) - 1), 4)

        return result


# ── WACC Calculator ────────────────────────────────────────────────────

class WACCCalculator:
    """Weighted Average Cost of Capital."""

    @staticmethod
    def cost_of_equity_capm(
        risk_free_rate: float,
        beta: float,
        equity_risk_premium: float,
    ) -> float:
        return risk_free_rate + beta * equity_risk_premium

    @staticmethod
    def cost_of_equity_buildup(
        risk_free_rate: float,
        equity_risk_premium: float,
        size_premium: float = 0.0,
        company_specific_risk: float = 0.0,
    ) -> float:
        return risk_free_rate + equity_risk_premium + size_premium + company_specific_risk

    @staticmethod
    def cost_of_debt(
        interest_expense: float,
        total_debt: float,
        tax_rate: float,
    ) -> float:
        if total_debt == 0:
            return 0.0
        pre_tax = interest_expense / total_debt
        return pre_tax * (1 - tax_rate)

    @staticmethod
    def calculate(
        market_cap: float,
        total_debt: float,
        cost_of_equity: float,
        cost_of_debt: float,
    ) -> dict:
        total = market_cap + total_debt
        if total == 0:
            return {"wacc": 0.0, "equity_weight": 0.0, "debt_weight": 0.0}

        we = market_cap / total
        wd = total_debt / total
        wacc = we * cost_of_equity + wd * cost_of_debt

        return {
            "wacc": round(wacc, 4),
            "equity_weight": round(we, 4),
            "debt_weight": round(wd, 4),
            "cost_of_equity": round(cost_of_equity, 4),
            "cost_of_debt": round(cost_of_debt, 4),
        }


# ── Orchestrator ──────────────────────────────────────────────────────

class FundamentalAnalysisEngine:
    """Top-level orchestrator for all fundamental analysis functionality."""

    def __init__(self) -> None:
        self.dcf = DCFModel()
        self.ddm = DDMModel()
        self.comparables = ComparablesValuation()
        self.residual = ResidualIncomeModel()
        self.altman = AltmanZScore()
        self.piotroski = PiotroskiFScore()
        self.beneish = BeneishMScore()
        self.dupont = DuPontAnalysis()
        self.health_scorer = FinancialHealthScorer()
        self.peer_comp = PeerComparison()
        self.trend = FinancialTrendAnalyzer()
        self.wacc_calc = WACCCalculator()

    def all_ratios(
        self,
        income: IncomeStatement,
        balance: BalanceSheet,
        cash_flow: Optional[CashFlowStatement] = None,
        market_price: float = 0.0,
        market_cap: float = 0.0,
    ) -> dict:
        """Compute all financial ratios in one call."""
        return {
            "profitability": ProfitabilityRatios.all_ratios(income, balance),
            "liquidity": LiquidityRatios.all_ratios(balance),
            "solvency": SolvencyRatios.all_ratios(balance, income, cash_flow),
            "efficiency": EfficiencyRatios.all_ratios(income, balance),
            "valuation": ValuationRatios.all_ratios(
                income, balance, cash_flow, market_price, market_cap),
        }

    def dcf_valuation(
        self,
        base_fcf: float,
        growth_rates: list[float],
        terminal_growth: float,
        wacc: float,
        net_debt: float,
        shares: float,
        price: float,
    ) -> dict:
        result = self.dcf.full_dcf(
            base_fcf, growth_rates, terminal_growth, wacc, net_debt, shares, price)
        return result.to_dict()

    def ddm_valuation(
        self,
        dividend: float,
        growth: float,
        required_return: float,
        price: float,
    ) -> dict:
        result = self.ddm.full_ddm(dividend, growth, required_return, price)
        return result.to_dict()

    def altman_z(
        self,
        income: IncomeStatement,
        balance: BalanceSheet,
        market_cap: float,
    ) -> dict:
        return self.altman.calculate(
            working_capital=balance.working_capital,
            retained_earnings=balance.retained_earnings,
            ebit=income.ebit,
            market_cap=market_cap,
            total_liabilities=balance.total_liabilities,
            revenue=income.revenue,
            total_assets=balance.total_assets,
        )

    def piotroski_f(
        self,
        current_income: IncomeStatement,
        prior_income: IncomeStatement,
        current_balance: BalanceSheet,
        prior_balance: BalanceSheet,
        current_cf: CashFlowStatement,
    ) -> dict:
        ta_curr = current_balance.total_assets or 1
        ta_prior = prior_balance.total_assets or 1
        roa_curr = current_income.net_income / ta_curr
        roa_prior = prior_income.net_income / ta_prior
        cl_curr = current_balance.total_current_liabilities or 1
        cl_prior = prior_balance.total_current_liabilities or 1

        return self.piotroski.calculate(
            net_income=current_income.net_income,
            operating_cash_flow=current_cf.operating_cash_flow,
            roa_current=roa_curr,
            roa_prior=roa_prior,
            long_term_debt_current=current_balance.long_term_debt,
            long_term_debt_prior=prior_balance.long_term_debt,
            current_ratio_current=current_balance.total_current_assets / cl_curr,
            current_ratio_prior=prior_balance.total_current_assets / cl_prior,
            shares_current=current_balance.shares_outstanding,
            shares_prior=prior_balance.shares_outstanding,
            gross_margin_current=current_income.gross_margin,
            gross_margin_prior=prior_income.gross_margin,
            asset_turnover_current=current_income.revenue / ta_curr,
            asset_turnover_prior=prior_income.revenue / ta_prior,
        )

    def dupont_analysis(
        self,
        income: IncomeStatement,
        balance: BalanceSheet,
    ) -> dict:
        three = self.dupont.three_way(
            income.net_income, income.revenue,
            balance.total_assets, balance.total_shareholders_equity)
        five = self.dupont.five_way(
            income.pretax_income, income.ebit, income.revenue,
            balance.total_assets, balance.total_shareholders_equity,
            income.net_income)
        return {"three_way": three, "five_way": five}

    def financial_health(
        self,
        income: IncomeStatement,
        balance: BalanceSheet,
        cash_flow: Optional[CashFlowStatement] = None,
    ) -> dict:
        prof = ProfitabilityRatios.all_ratios(income, balance)
        liq = LiquidityRatios.all_ratios(balance)
        solv = SolvencyRatios.all_ratios(balance, income, cash_flow)
        eff = EfficiencyRatios.all_ratios(income, balance)
        return self.health_scorer.score(prof, liq, solv, eff)

    def revenue_analysis(self, incomes: list[IncomeStatement]) -> dict:
        return self.trend.revenue_trend(incomes)

    def margin_analysis(self, incomes: list[IncomeStatement]) -> dict:
        return self.trend.margin_trends(incomes)

    def calculate_wacc(
        self,
        risk_free: float,
        beta: float,
        erp: float,
        interest_expense: float,
        total_debt: float,
        tax_rate: float,
        market_cap: float,
    ) -> dict:
        ke = self.wacc_calc.cost_of_equity_capm(risk_free, beta, erp)
        kd = self.wacc_calc.cost_of_debt(interest_expense, total_debt, tax_rate)
        return self.wacc_calc.calculate(market_cap, total_debt, ke, kd)

    def comprehensive_valuation(
        self,
        income: IncomeStatement,
        balance: BalanceSheet,
        cash_flow: CashFlowStatement,
        market_price: float,
        market_cap: float,
        peer_pe_ratios: list[float] = None,
        peer_ev_ebitda: list[float] = None,
        wacc: float = 0.10,
        terminal_growth: float = 0.025,
    ) -> dict:
        """Run all valuation models and provide composite view."""
        valuations = []

        # DCF
        if cash_flow.free_cash_flow > 0:
            dcf_result = self.dcf.full_dcf(
                cash_flow.free_cash_flow,
                [0.10, 0.08, 0.06, 0.04, 0.03],
                terminal_growth, wacc, balance.net_debt,
                balance.shares_outstanding, market_price)
            valuations.append(dcf_result)

        # DDM
        if income.dividends_per_share > 0:
            ddm_result = self.ddm.full_ddm(
                income.dividends_per_share, 0.05, wacc + 0.02, market_price)
            valuations.append(ddm_result)

        # PE comparables
        if peer_pe_ratios:
            pe_result = self.comparables.pe_based(
                income.eps_diluted, peer_pe_ratios, market_price)
            valuations.append(pe_result)

        # EV/EBITDA
        if peer_ev_ebitda:
            ev_result = self.comparables.ev_ebitda_based(
                income.ebitda, peer_ev_ebitda, balance.net_debt,
                balance.shares_outstanding, market_price)
            valuations.append(ev_result)

        ivs = [v.intrinsic_value for v in valuations if v.intrinsic_value > 0]
        avg_iv = statistics.mean(ivs) if ivs else market_price

        return {
            "models": [v.to_dict() for v in valuations],
            "composite_intrinsic_value": round(avg_iv, 2),
            "current_price": market_price,
            "composite_upside_pct": round(((avg_iv / market_price) - 1) * 100, 2) if market_price else 0,
            "models_count": len(valuations),
        }

    def full_analysis(
        self,
        income: IncomeStatement,
        balance: BalanceSheet,
        cash_flow: Optional[CashFlowStatement] = None,
        market_price: float = 0.0,
        market_cap: float = 0.0,
    ) -> dict:
        """Complete fundamental analysis dashboard."""
        ratios = self.all_ratios(income, balance, cash_flow, market_price, market_cap)
        health = self.financial_health(income, balance, cash_flow)
        dupont = self.dupont_analysis(income, balance)

        z_score = None
        if market_cap:
            z_score = self.altman_z(income, balance, market_cap)

        return {
            "ratios": ratios,
            "financial_health": health,
            "dupont": dupont,
            "altman_z": z_score,
        }

    def capabilities(self) -> dict:
        return {
            "engine": "FundamentalAnalysisEngine",
            "version": "1.0.0",
            "features": [
                "profitability_ratios (margin, ROE, ROA, ROIC, ROCE)",
                "liquidity_ratios (current, quick, cash, defensive)",
                "solvency_ratios (D/E, interest coverage, net debt/EBITDA)",
                "efficiency_ratios (turnover, CCC, DSO, DIO, DPO)",
                "valuation_ratios (PE, PB, PS, EV/EBITDA, FCF yield)",
                "growth_metrics (CAGR, trend analysis)",
                "dcf_valuation (Gordon terminal, multi-stage)",
                "ddm_valuation (Gordon, two-stage, H-model)",
                "comparables_valuation (PE, EV/EBITDA, PEG)",
                "residual_income_model",
                "altman_z_score (bankruptcy predictor)",
                "piotroski_f_score (financial strength 0-9)",
                "beneish_m_score (earnings manipulation detector)",
                "dupont_analysis (3-way and 5-way decomposition)",
                "financial_health_scoring (composite 0-100)",
                "wacc_calculation (CAPM, build-up)",
                "peer_comparison (rank, percentile)",
                "multi_period_trend_analysis",
                "cash_flow_quality_assessment",
                "comprehensive_valuation (multi-model composite)",
            ],
        }
