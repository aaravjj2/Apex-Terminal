"""
Strategy Factory
Creates and analyzes options strategies with payoff curves and Greeks
"""

from typing import List, Dict, Tuple, Optional, Literal
from dataclasses import dataclass
import math

from .models import StrategyLeg, StrategyAnalysis, PositionType, Greeks
from .greeks import BlackScholesCalculator


# Default configuration
DEFAULT_RISK_FREE_RATE = 0.045
NUM_PRICE_POINTS = 100
PRICE_RANGE_PERCENT = 0.20  # +/- 20% from current price


@dataclass
class StrategyTemplate:
    """Template definition for a strategy"""
    name: str
    description: str
    category: str  # "income", "directional", "neutral", "volatility"
    max_profit: str  # "limited", "unlimited"
    max_loss: str   # "limited", "unlimited"
    legs_description: str
    
    def to_dict(self) -> Dict:
        return {
            "name": self.name,
            "description": self.description,
            "category": self.category,
            "max_profit": self.max_profit,
            "max_loss": self.max_loss,
            "legs_description": self.legs_description,
        }


# Strategy template definitions
STRATEGY_TEMPLATES = {
    "covered_call": StrategyTemplate(
        name="Covered Call",
        description="Long stock + short call. Income strategy with capped upside.",
        category="income",
        max_profit="limited",
        max_loss="limited",  # Stock can go to 0
        legs_description="Long 100 shares + Short 1 OTM call",
    ),
    "cash_secured_put": StrategyTemplate(
        name="Cash-Secured Put",
        description="Short put with cash to buy stock. Income/entry strategy.",
        category="income",
        max_profit="limited",
        max_loss="limited",  # Strike - premium
        legs_description="Short 1 OTM put (cash secured)",
    ),
    "protective_put": StrategyTemplate(
        name="Protective Put",
        description="Long stock + long put. Hedges downside.",
        category="directional",
        max_profit="unlimited",
        max_loss="limited",
        legs_description="Long 100 shares + Long 1 ATM/OTM put",
    ),
    "collar": StrategyTemplate(
        name="Collar",
        description="Long stock + long put + short call. Zero-cost hedge.",
        category="neutral",
        max_profit="limited",
        max_loss="limited",
        legs_description="Long 100 shares + Long 1 put + Short 1 call",
    ),
    "vertical_debit_spread": StrategyTemplate(
        name="Vertical Debit Spread",
        description="Buy lower strike, sell higher strike (calls) or reverse (puts).",
        category="directional",
        max_profit="limited",
        max_loss="limited",
        legs_description="Long 1 option + Short 1 option (same expiry)",
    ),
    "vertical_credit_spread": StrategyTemplate(
        name="Vertical Credit Spread",
        description="Sell option, buy further OTM option for protection.",
        category="income",
        max_profit="limited",
        max_loss="limited",
        legs_description="Short 1 option + Long 1 option (same expiry)",
    ),
    "iron_condor": StrategyTemplate(
        name="Iron Condor",
        description="Sell OTM put spread + sell OTM call spread. Range-bound.",
        category="neutral",
        max_profit="limited",
        max_loss="limited",
        legs_description="Short 1 put spread + Short 1 call spread",
    ),
    "calendar_spread": StrategyTemplate(
        name="Calendar/Diagonal Spread",
        description="Sell near-term, buy far-term same/different strike.",
        category="volatility",
        max_profit="limited",
        max_loss="limited",
        legs_description="Short 1 near-term option + Long 1 far-term option",
    ),
    "long_straddle": StrategyTemplate(
        name="Long Straddle",
        description="Long ATM call + Long ATM put. Volatility play.",
        category="volatility",
        max_profit="unlimited",
        max_loss="limited",
        legs_description="Long 1 ATM call + Long 1 ATM put",
    ),
    "long_strangle": StrategyTemplate(
        name="Long Strangle",
        description="Long OTM call + Long OTM put. Cheaper volatility play.",
        category="volatility",
        max_profit="unlimited",
        max_loss="limited",
        legs_description="Long 1 OTM call + Long 1 OTM put",
    ),
}


class StrategyFactory:
    """
    Factory for creating and analyzing options strategies
    """
    
    def __init__(self, risk_free_rate: float = DEFAULT_RISK_FREE_RATE):
        self.risk_free_rate = risk_free_rate
    
    @staticmethod
    def get_templates() -> List[StrategyTemplate]:
        """Get all available strategy templates"""
        return list(STRATEGY_TEMPLATES.values())
    
    @staticmethod
    def get_template(name: str) -> Optional[StrategyTemplate]:
        """Get a specific strategy template"""
        return STRATEGY_TEMPLATES.get(name.lower().replace(" ", "_").replace("-", "_"))
    
    def analyze_strategy(
        self,
        legs: List[StrategyLeg],
        underlying_price: float,
        strategy_name: str = "Custom",
        price_range_pct: float = PRICE_RANGE_PERCENT,
        num_points: int = NUM_PRICE_POINTS,
    ) -> StrategyAnalysis:
        """
        Analyze a multi-leg options strategy
        
        Args:
            legs: List of StrategyLeg objects
            underlying_price: Current underlying price
            strategy_name: Name of the strategy
            price_range_pct: Price range as decimal (0.20 = 20%)
            num_points: Number of price points for payoff curve
            
        Returns:
            StrategyAnalysis with payoff curves and metrics
        """
        # Generate price range
        low = underlying_price * (1 - price_range_pct)
        high = underlying_price * (1 + price_range_pct)
        price_range = [low + (high - low) * i / (num_points - 1) for i in range(num_points)]
        
        # Calculate payoffs
        expiration_payoff = self._calculate_expiration_payoff(legs, price_range)
        theoretical_payoff = self._calculate_theoretical_payoff(
            legs, price_range, underlying_price
        )
        
        # Calculate risk metrics
        max_profit, max_loss = self._calculate_max_profit_loss(
            expiration_payoff, price_range, underlying_price, legs
        )
        
        # Calculate breakevens
        breakevens = self._find_breakevens(expiration_payoff, price_range)
        
        # Calculate net Greeks
        greeks = self._calculate_position_greeks(legs, underlying_price)
        
        return StrategyAnalysis(
            name=strategy_name,
            legs=legs,
            underlying_price=underlying_price,
            price_range=price_range,
            expiration_payoff=expiration_payoff,
            theoretical_payoff=theoretical_payoff,
            max_profit=max_profit,
            max_loss=max_loss,
            breakevens=breakevens,
            net_delta=greeks["delta"],
            net_gamma=greeks["gamma"],
            net_theta=greeks["theta"],
            net_vega=greeks["vega"],
        )
    
    def _calculate_expiration_payoff(
        self,
        legs: List[StrategyLeg],
        price_range: List[float],
    ) -> List[float]:
        """Calculate P/L at expiration for each price point"""
        payoffs = [0.0] * len(price_range)
        
        for i, price in enumerate(price_range):
            for leg in legs:
                if leg.option_type == "stock":
                    # Stock: P/L = (final - entry) * qty * sign
                    leg_pnl = (price - leg.strike) * leg.quantity * leg.sign
                elif leg.option_type == "call":
                    # Call at expiration: max(0, S-K) - premium
                    intrinsic = max(0, price - leg.strike)
                    leg_pnl = (intrinsic - leg.premium) * 100 * leg.quantity * leg.sign
                else:  # put
                    # Put at expiration: max(0, K-S) - premium
                    intrinsic = max(0, leg.strike - price)
                    leg_pnl = (intrinsic - leg.premium) * 100 * leg.quantity * leg.sign
                
                payoffs[i] += leg_pnl
        
        return payoffs
    
    def _calculate_theoretical_payoff(
        self,
        legs: List[StrategyLeg],
        price_range: List[float],
        current_price: float,
    ) -> List[float]:
        """Calculate current theoretical P/L (T+0 curve)"""
        payoffs = [0.0] * len(price_range)
        calc = BlackScholesCalculator
        
        for i, price in enumerate(price_range):
            for leg in legs:
                if leg.option_type == "stock":
                    leg_pnl = (price - leg.strike) * leg.quantity * leg.sign
                else:
                    # Get theoretical value at this price
                    if leg.option_type == "call":
                        theo = calc.call_price(
                            price, leg.strike, leg.expiration_days,
                            self.risk_free_rate, leg.iv
                        )
                    else:
                        theo = calc.put_price(
                            price, leg.strike, leg.expiration_days,
                            self.risk_free_rate, leg.iv
                        )
                    
                    leg_pnl = (theo - leg.premium) * 100 * leg.quantity * leg.sign
                
                payoffs[i] += leg_pnl
        
        return payoffs
    
    def _calculate_max_profit_loss(
        self,
        payoffs: List[float],
        price_range: List[float],
        underlying_price: float,
        legs: List[StrategyLeg],
    ) -> Tuple[float, float]:
        """Calculate max profit and max loss"""
        # For bounded strategies, use the payoff extremes
        max_profit = max(payoffs)
        max_loss = min(payoffs)
        
        # Check for unbounded scenarios
        has_stock = any(leg.option_type == "stock" for leg in legs)
        has_long_call = any(
            leg.option_type == "call" and leg.position == PositionType.LONG
            for leg in legs
        )
        has_short_put = any(
            leg.option_type == "put" and leg.position == PositionType.SHORT
            for leg in legs
        )
        
        # Long stock or long call = unlimited upside
        if has_stock or has_long_call:
            # Check if there's a short call capping upside
            has_short_call = any(
                leg.option_type == "call" and leg.position == PositionType.SHORT
                for leg in legs
            )
            if not has_short_call:
                max_profit = float('inf')
        
        # Short put or long stock = significant downside
        if (has_stock or has_short_put) and max_loss < 0:
            # Check if there's a long put protecting
            has_long_put = any(
                leg.option_type == "put" and leg.position == PositionType.LONG
                for leg in legs
            )
            if not has_long_put:
                # Could go to zero
                lowest_loss = payoffs[0]  # At lowest price
                max_loss = min(max_loss, lowest_loss)
        
        return max_profit, max_loss
    
    def _find_breakevens(
        self,
        payoffs: List[float],
        price_range: List[float],
    ) -> List[float]:
        """Find prices where P/L crosses zero"""
        breakevens = []
        
        for i in range(len(payoffs) - 1):
            if payoffs[i] * payoffs[i + 1] < 0:  # Sign change
                # Linear interpolation
                ratio = abs(payoffs[i]) / (abs(payoffs[i]) + abs(payoffs[i + 1]))
                be = price_range[i] + ratio * (price_range[i + 1] - price_range[i])
                breakevens.append(round(be, 2))
        
        return sorted(breakevens)
    
    def _calculate_position_greeks(
        self,
        legs: List[StrategyLeg],
        underlying_price: float,
    ) -> Dict[str, float]:
        """Calculate aggregate Greeks for position"""
        total = {"delta": 0.0, "gamma": 0.0, "theta": 0.0, "vega": 0.0}
        calc = BlackScholesCalculator
        
        for leg in legs:
            if leg.option_type == "stock":
                # Stock has delta of 1 per share
                total["delta"] += leg.sign * leg.quantity * 100
            else:
                result = calc.calculate_all(
                    underlying_price, leg.strike, leg.expiration_days,
                    self.risk_free_rate, leg.iv, leg.option_type
                )
                
                # Scale by quantity and position
                multiplier = leg.sign * leg.quantity * 100
                total["delta"] += result.delta * multiplier
                total["gamma"] += result.gamma * multiplier
                total["theta"] += result.theta * multiplier
                total["vega"] += result.vega * multiplier
        
        return total
    
    # ==========================================================================
    # Strategy Builders
    # ==========================================================================
    
    def build_covered_call(
        self,
        underlying_price: float,
        call_strike: float,
        call_premium: float,
        expiration_days: int,
        iv: float = 0.30,
    ) -> StrategyAnalysis:
        """Build a covered call strategy"""
        legs = [
            StrategyLeg(
                option_type="stock",
                position=PositionType.LONG,
                strike=underlying_price,  # Entry price
                premium=0,
                quantity=1,
                expiration_days=expiration_days,
            ),
            StrategyLeg(
                option_type="call",
                position=PositionType.SHORT,
                strike=call_strike,
                premium=call_premium,
                quantity=1,
                expiration_days=expiration_days,
                iv=iv,
            ),
        ]
        return self.analyze_strategy(legs, underlying_price, "Covered Call")
    
    def build_cash_secured_put(
        self,
        underlying_price: float,
        put_strike: float,
        put_premium: float,
        expiration_days: int,
        iv: float = 0.30,
    ) -> StrategyAnalysis:
        """Build a cash-secured put strategy"""
        legs = [
            StrategyLeg(
                option_type="put",
                position=PositionType.SHORT,
                strike=put_strike,
                premium=put_premium,
                quantity=1,
                expiration_days=expiration_days,
                iv=iv,
            ),
        ]
        return self.analyze_strategy(legs, underlying_price, "Cash-Secured Put")
    
    def build_protective_put(
        self,
        underlying_price: float,
        put_strike: float,
        put_premium: float,
        expiration_days: int,
        iv: float = 0.30,
    ) -> StrategyAnalysis:
        """Build a protective put strategy"""
        legs = [
            StrategyLeg(
                option_type="stock",
                position=PositionType.LONG,
                strike=underlying_price,
                premium=0,
                quantity=1,
                expiration_days=expiration_days,
            ),
            StrategyLeg(
                option_type="put",
                position=PositionType.LONG,
                strike=put_strike,
                premium=put_premium,
                quantity=1,
                expiration_days=expiration_days,
                iv=iv,
            ),
        ]
        return self.analyze_strategy(legs, underlying_price, "Protective Put")
    
    def build_collar(
        self,
        underlying_price: float,
        put_strike: float,
        put_premium: float,
        call_strike: float,
        call_premium: float,
        expiration_days: int,
        iv: float = 0.30,
    ) -> StrategyAnalysis:
        """Build a collar strategy"""
        legs = [
            StrategyLeg(
                option_type="stock",
                position=PositionType.LONG,
                strike=underlying_price,
                premium=0,
                quantity=1,
                expiration_days=expiration_days,
            ),
            StrategyLeg(
                option_type="put",
                position=PositionType.LONG,
                strike=put_strike,
                premium=put_premium,
                quantity=1,
                expiration_days=expiration_days,
                iv=iv,
            ),
            StrategyLeg(
                option_type="call",
                position=PositionType.SHORT,
                strike=call_strike,
                premium=call_premium,
                quantity=1,
                expiration_days=expiration_days,
                iv=iv,
            ),
        ]
        return self.analyze_strategy(legs, underlying_price, "Collar")
    
    def build_vertical_spread(
        self,
        underlying_price: float,
        long_strike: float,
        long_premium: float,
        short_strike: float,
        short_premium: float,
        option_type: Literal["call", "put"],
        expiration_days: int,
        iv: float = 0.30,
    ) -> StrategyAnalysis:
        """Build a vertical spread (debit or credit)"""
        is_debit = long_premium > short_premium
        name = f"Vertical {'Debit' if is_debit else 'Credit'} Spread ({option_type.title()})"
        
        legs = [
            StrategyLeg(
                option_type=option_type,
                position=PositionType.LONG,
                strike=long_strike,
                premium=long_premium,
                quantity=1,
                expiration_days=expiration_days,
                iv=iv,
            ),
            StrategyLeg(
                option_type=option_type,
                position=PositionType.SHORT,
                strike=short_strike,
                premium=short_premium,
                quantity=1,
                expiration_days=expiration_days,
                iv=iv,
            ),
        ]
        return self.analyze_strategy(legs, underlying_price, name)
    
    def build_iron_condor(
        self,
        underlying_price: float,
        put_long_strike: float,
        put_long_premium: float,
        put_short_strike: float,
        put_short_premium: float,
        call_short_strike: float,
        call_short_premium: float,
        call_long_strike: float,
        call_long_premium: float,
        expiration_days: int,
        iv: float = 0.30,
    ) -> StrategyAnalysis:
        """Build an iron condor strategy"""
        legs = [
            # Put spread (bull put)
            StrategyLeg(
                option_type="put",
                position=PositionType.LONG,
                strike=put_long_strike,
                premium=put_long_premium,
                quantity=1,
                expiration_days=expiration_days,
                iv=iv,
            ),
            StrategyLeg(
                option_type="put",
                position=PositionType.SHORT,
                strike=put_short_strike,
                premium=put_short_premium,
                quantity=1,
                expiration_days=expiration_days,
                iv=iv,
            ),
            # Call spread (bear call)
            StrategyLeg(
                option_type="call",
                position=PositionType.SHORT,
                strike=call_short_strike,
                premium=call_short_premium,
                quantity=1,
                expiration_days=expiration_days,
                iv=iv,
            ),
            StrategyLeg(
                option_type="call",
                position=PositionType.LONG,
                strike=call_long_strike,
                premium=call_long_premium,
                quantity=1,
                expiration_days=expiration_days,
                iv=iv,
            ),
        ]
        return self.analyze_strategy(legs, underlying_price, "Iron Condor")
    
    def build_straddle(
        self,
        underlying_price: float,
        strike: float,
        call_premium: float,
        put_premium: float,
        expiration_days: int,
        iv: float = 0.30,
        is_long: bool = True,
    ) -> StrategyAnalysis:
        """Build a straddle (long or short)"""
        position = PositionType.LONG if is_long else PositionType.SHORT
        name = f"{'Long' if is_long else 'Short'} Straddle"
        
        legs = [
            StrategyLeg(
                option_type="call",
                position=position,
                strike=strike,
                premium=call_premium,
                quantity=1,
                expiration_days=expiration_days,
                iv=iv,
            ),
            StrategyLeg(
                option_type="put",
                position=position,
                strike=strike,
                premium=put_premium,
                quantity=1,
                expiration_days=expiration_days,
                iv=iv,
            ),
        ]
        return self.analyze_strategy(legs, underlying_price, name)
    
    def build_strangle(
        self,
        underlying_price: float,
        call_strike: float,
        call_premium: float,
        put_strike: float,
        put_premium: float,
        expiration_days: int,
        iv: float = 0.30,
        is_long: bool = True,
    ) -> StrategyAnalysis:
        """Build a strangle (long or short)"""
        position = PositionType.LONG if is_long else PositionType.SHORT
        name = f"{'Long' if is_long else 'Short'} Strangle"
        
        legs = [
            StrategyLeg(
                option_type="call",
                position=position,
                strike=call_strike,
                premium=call_premium,
                quantity=1,
                expiration_days=expiration_days,
                iv=iv,
            ),
            StrategyLeg(
                option_type="put",
                position=position,
                strike=put_strike,
                premium=put_premium,
                quantity=1,
                expiration_days=expiration_days,
                iv=iv,
            ),
        ]
        return self.analyze_strategy(legs, underlying_price, name)


# Singleton instance
_factory: Optional[StrategyFactory] = None


def get_strategy_factory() -> StrategyFactory:
    """Get or create the strategy factory"""
    global _factory
    if _factory is None:
        _factory = StrategyFactory()
    return _factory
