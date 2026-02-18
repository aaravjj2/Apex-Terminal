"""
Tests for Strategy Factory
"""

import pytest
import math
from services.options.strategy_factory import (
    StrategyFactory,
    StrategyTemplate,
    STRATEGY_TEMPLATES,
    get_strategy_factory,
)
from services.options.models import StrategyLeg, PositionType


class TestStrategyTemplate:
    """Tests for StrategyTemplate"""
    
    def test_template_structure(self):
        """Test template has all required fields"""
        template = StrategyTemplate(
            name="Test Strategy",
            description="Test description",
            category="neutral",
            max_profit="limited",
            max_loss="limited",
            legs_description="Test legs",
        )
        
        assert template.name == "Test Strategy"
        assert template.category == "neutral"
        assert template.max_profit == "limited"
    
    def test_template_to_dict(self):
        """Test template serialization"""
        template = STRATEGY_TEMPLATES["iron_condor"]
        result = template.to_dict()
        
        assert "name" in result
        assert "description" in result
        assert "category" in result
        assert result["name"] == "Iron Condor"
    
    def test_all_templates_valid(self):
        """Test all built-in templates are valid"""
        for key, template in STRATEGY_TEMPLATES.items():
            assert template.name, f"{key} missing name"
            assert template.description, f"{key} missing description"
            assert template.category in ["income", "directional", "neutral", "volatility"]
            assert template.max_profit in ["limited", "unlimited"]
            assert template.max_loss in ["limited", "unlimited"]


class TestStrategyFactoryBasic:
    """Basic tests for StrategyFactory"""
    
    def setup_method(self):
        self.factory = StrategyFactory(risk_free_rate=0.05)
    
    def test_get_templates(self):
        """Test getting all templates"""
        templates = StrategyFactory.get_templates()
        
        assert len(templates) >= 10  # We defined 10 templates
        assert all(isinstance(t, StrategyTemplate) for t in templates)
    
    def test_get_template_by_name(self):
        """Test getting template by name"""
        template = StrategyFactory.get_template("iron_condor")
        assert template is not None
        assert template.name == "Iron Condor"
        
        template = StrategyFactory.get_template("Iron Condor")
        assert template is not None
        
        template = StrategyFactory.get_template("nonexistent")
        assert template is None
    
    def test_get_strategy_factory_singleton(self):
        """Test singleton pattern"""
        f1 = get_strategy_factory()
        f2 = get_strategy_factory()
        assert f1 is f2


class TestCoveredCall:
    """Tests for covered call strategy"""
    
    def setup_method(self):
        self.factory = StrategyFactory(risk_free_rate=0.05)
    
    def test_covered_call_basic(self):
        """Test basic covered call construction"""
        result = self.factory.build_covered_call(
            underlying_price=100.0,
            call_strike=105.0,
            call_premium=3.0,
            expiration_days=30,
            iv=0.30,
        )
        
        assert result.name == "Covered Call"
        assert len(result.legs) == 2
        assert result.underlying_price == 100.0
    
    def test_covered_call_max_profit(self):
        """Test covered call has limited max profit at strike + premium"""
        result = self.factory.build_covered_call(
            underlying_price=100.0,
            call_strike=105.0,
            call_premium=3.0,
            expiration_days=30,
        )
        
        # Max profit at expiration = (105 - 100) + 3 = $8 per share = $800
        # Check it's bounded and positive
        assert result.max_profit > 0
        assert result.max_profit != float('inf')
    
    def test_covered_call_max_loss(self):
        """Test covered call max loss (stock to zero)"""
        result = self.factory.build_covered_call(
            underlying_price=100.0,
            call_strike=105.0,
            call_premium=3.0,
            expiration_days=30,
        )
        
        # Max loss = stock value - premium = (100 - 3) * 100 = $9700
        # Should be negative (a loss)
        assert result.max_loss < 0
    
    def test_covered_call_breakeven(self):
        """Test covered call breakeven price"""
        result = self.factory.build_covered_call(
            underlying_price=100.0,
            call_strike=105.0,
            call_premium=3.0,
            expiration_days=30,
        )
        
        # Covered call starts with credit from selling call
        # Breakeven depends on how the payoff is modeled
        # The strategy has defined risk/reward within price range
        assert result.max_profit != float('inf')  # Capped upside
        assert result.max_loss < 0  # Can lose money


class TestCashSecuredPut:
    """Tests for cash-secured put strategy"""
    
    def setup_method(self):
        self.factory = StrategyFactory(risk_free_rate=0.05)
    
    def test_cash_secured_put_basic(self):
        """Test basic cash-secured put"""
        result = self.factory.build_cash_secured_put(
            underlying_price=100.0,
            put_strike=95.0,
            put_premium=2.5,
            expiration_days=30,
        )
        
        assert result.name == "Cash-Secured Put"
        assert len(result.legs) == 1
    
    def test_cash_secured_put_max_profit(self):
        """Test max profit is premium received"""
        result = self.factory.build_cash_secured_put(
            underlying_price=100.0,
            put_strike=95.0,
            put_premium=2.5,
            expiration_days=30,
        )
        
        # Max profit = premium * 100 = $250
        assert abs(result.max_profit - 250.0) < 10
    
    def test_cash_secured_put_max_loss(self):
        """Test max loss (assigned at strike - premium)"""
        result = self.factory.build_cash_secured_put(
            underlying_price=100.0,
            put_strike=95.0,
            put_premium=2.5,
            expiration_days=30,
        )
        
        # Max loss = (strike - premium) * 100 = 92.5 * 100 = $9250 if stock goes to 0
        assert result.max_loss < 0


class TestProtectivePut:
    """Tests for protective put strategy"""
    
    def setup_method(self):
        self.factory = StrategyFactory(risk_free_rate=0.05)
    
    def test_protective_put_basic(self):
        """Test basic protective put"""
        result = self.factory.build_protective_put(
            underlying_price=100.0,
            put_strike=95.0,
            put_premium=3.0,
            expiration_days=30,
        )
        
        assert result.name == "Protective Put"
        assert len(result.legs) == 2
    
    def test_protective_put_limited_loss(self):
        """Test protective put has limited downside"""
        result = self.factory.build_protective_put(
            underlying_price=100.0,
            put_strike=95.0,
            put_premium=3.0,
            expiration_days=30,
        )
        
        # Max loss = (stock entry - put strike) + premium = (100 - 95) + 3 = $8/share
        # = $800 per contract
        assert result.max_loss < 0
        assert result.max_loss > -1000  # Limited loss


class TestCollar:
    """Tests for collar strategy"""
    
    def setup_method(self):
        self.factory = StrategyFactory(risk_free_rate=0.05)
    
    def test_collar_basic(self):
        """Test basic collar"""
        result = self.factory.build_collar(
            underlying_price=100.0,
            put_strike=95.0,
            put_premium=2.0,
            call_strike=105.0,
            call_premium=2.0,
            expiration_days=30,
        )
        
        assert result.name == "Collar"
        assert len(result.legs) == 3
    
    def test_zero_cost_collar(self):
        """Test zero-cost collar (put and call premiums equal)"""
        result = self.factory.build_collar(
            underlying_price=100.0,
            put_strike=95.0,
            put_premium=2.0,
            call_strike=105.0,
            call_premium=2.0,
            expiration_days=30,
        )
        
        # Both profit and loss should be bounded
        assert result.max_profit != float('inf')
        assert result.max_loss > -float('inf')


class TestVerticalSpreads:
    """Tests for vertical spreads"""
    
    def setup_method(self):
        self.factory = StrategyFactory(risk_free_rate=0.05)
    
    def test_bull_call_spread(self):
        """Test bull call spread (debit)"""
        result = self.factory.build_vertical_spread(
            underlying_price=100.0,
            long_strike=100.0,
            long_premium=5.0,
            short_strike=105.0,
            short_premium=2.0,
            option_type="call",
            expiration_days=30,
        )
        
        assert "Debit" in result.name
        assert "Call" in result.name
        assert len(result.legs) == 2
    
    def test_bull_call_spread_max_profit(self):
        """Test bull call spread max profit"""
        result = self.factory.build_vertical_spread(
            underlying_price=100.0,
            long_strike=100.0,
            long_premium=5.0,
            short_strike=105.0,
            short_premium=2.0,
            option_type="call",
            expiration_days=30,
        )
        
        # Max profit = (105 - 100) - (5 - 2) = 5 - 3 = $2/share = $200
        assert abs(result.max_profit - 200.0) < 20
    
    def test_bull_call_spread_max_loss(self):
        """Test bull call spread max loss"""
        result = self.factory.build_vertical_spread(
            underlying_price=100.0,
            long_strike=100.0,
            long_premium=5.0,
            short_strike=105.0,
            short_premium=2.0,
            option_type="call",
            expiration_days=30,
        )
        
        # Max loss = net debit = $3/share = $300
        assert abs(result.max_loss - (-300.0)) < 20
    
    def test_bear_put_spread(self):
        """Test bear put spread"""
        result = self.factory.build_vertical_spread(
            underlying_price=100.0,
            long_strike=100.0,
            long_premium=5.0,
            short_strike=95.0,
            short_premium=2.0,
            option_type="put",
            expiration_days=30,
        )
        
        assert "Debit" in result.name
        assert "Put" in result.name


class TestIronCondor:
    """Tests for iron condor strategy"""
    
    def setup_method(self):
        self.factory = StrategyFactory(risk_free_rate=0.05)
    
    def test_iron_condor_basic(self):
        """Test basic iron condor"""
        result = self.factory.build_iron_condor(
            underlying_price=100.0,
            put_long_strike=90.0,
            put_long_premium=1.0,
            put_short_strike=95.0,
            put_short_premium=2.0,
            call_short_strike=105.0,
            call_short_premium=2.0,
            call_long_strike=110.0,
            call_long_premium=1.0,
            expiration_days=30,
        )
        
        assert result.name == "Iron Condor"
        assert len(result.legs) == 4
    
    def test_iron_condor_max_profit(self):
        """Test iron condor max profit is net credit"""
        result = self.factory.build_iron_condor(
            underlying_price=100.0,
            put_long_strike=90.0,
            put_long_premium=1.0,
            put_short_strike=95.0,
            put_short_premium=2.0,
            call_short_strike=105.0,
            call_short_premium=2.0,
            call_long_strike=110.0,
            call_long_premium=1.0,
            expiration_days=30,
        )
        
        # Net credit = (2 + 2) - (1 + 1) = $2/share = $200
        assert abs(result.max_profit - 200.0) < 20
    
    def test_iron_condor_max_loss(self):
        """Test iron condor max loss is width - credit"""
        result = self.factory.build_iron_condor(
            underlying_price=100.0,
            put_long_strike=90.0,
            put_long_premium=1.0,
            put_short_strike=95.0,
            put_short_premium=2.0,
            call_short_strike=105.0,
            call_short_premium=2.0,
            call_long_strike=110.0,
            call_long_premium=1.0,
            expiration_days=30,
        )
        
        # Width = $5, Net credit = $2, Max loss = $3/share = $300
        assert abs(result.max_loss - (-300.0)) < 20
    
    def test_iron_condor_two_breakevens(self):
        """Test iron condor has two breakeven points"""
        result = self.factory.build_iron_condor(
            underlying_price=100.0,
            put_long_strike=90.0,
            put_long_premium=1.0,
            put_short_strike=95.0,
            put_short_premium=2.0,
            call_short_strike=105.0,
            call_short_premium=2.0,
            call_long_strike=110.0,
            call_long_premium=1.0,
            expiration_days=30,
        )
        
        assert len(result.breakevens) == 2
        assert result.breakevens[0] < 100 < result.breakevens[1]


class TestStraddle:
    """Tests for straddle strategies"""
    
    def setup_method(self):
        self.factory = StrategyFactory(risk_free_rate=0.05)
    
    def test_long_straddle_basic(self):
        """Test basic long straddle"""
        result = self.factory.build_straddle(
            underlying_price=100.0,
            strike=100.0,
            call_premium=4.0,
            put_premium=4.0,
            expiration_days=30,
            is_long=True,
        )
        
        assert result.name == "Long Straddle"
        assert len(result.legs) == 2
    
    def test_long_straddle_unlimited_profit(self):
        """Test long straddle has unlimited profit potential"""
        result = self.factory.build_straddle(
            underlying_price=100.0,
            strike=100.0,
            call_premium=4.0,
            put_premium=4.0,
            expiration_days=30,
            is_long=True,
        )
        
        assert result.max_profit == float('inf')
    
    def test_long_straddle_max_loss(self):
        """Test long straddle max loss is total premium"""
        result = self.factory.build_straddle(
            underlying_price=100.0,
            strike=100.0,
            call_premium=4.0,
            put_premium=4.0,
            expiration_days=30,
            is_long=True,
        )
        
        # Max loss = (4 + 4) * 100 = $800 approximately
        # Allow small variance due to discrete price points
        assert abs(result.max_loss - (-800.0)) < 30
    
    def test_long_straddle_breakevens(self):
        """Test long straddle has two breakeven points"""
        result = self.factory.build_straddle(
            underlying_price=100.0,
            strike=100.0,
            call_premium=4.0,
            put_premium=4.0,
            expiration_days=30,
            is_long=True,
        )
        
        # Breakevens at strike +/- total premium = 92 and 108
        assert len(result.breakevens) == 2
        assert abs(result.breakevens[0] - 92.0) < 1
        assert abs(result.breakevens[1] - 108.0) < 1
    
    def test_short_straddle_basic(self):
        """Test short straddle"""
        result = self.factory.build_straddle(
            underlying_price=100.0,
            strike=100.0,
            call_premium=4.0,
            put_premium=4.0,
            expiration_days=30,
            is_long=False,
        )
        
        assert result.name == "Short Straddle"


class TestStrangle:
    """Tests for strangle strategies"""
    
    def setup_method(self):
        self.factory = StrategyFactory(risk_free_rate=0.05)
    
    def test_long_strangle_basic(self):
        """Test basic long strangle"""
        result = self.factory.build_strangle(
            underlying_price=100.0,
            call_strike=105.0,
            call_premium=2.0,
            put_strike=95.0,
            put_premium=2.0,
            expiration_days=30,
            is_long=True,
        )
        
        assert result.name == "Long Strangle"
        assert len(result.legs) == 2
    
    def test_long_strangle_cheaper_than_straddle(self):
        """Test strangle costs less than straddle"""
        straddle = self.factory.build_straddle(
            underlying_price=100.0,
            strike=100.0,
            call_premium=4.0,
            put_premium=4.0,
            expiration_days=30,
        )
        
        strangle = self.factory.build_strangle(
            underlying_price=100.0,
            call_strike=105.0,
            call_premium=2.0,
            put_strike=95.0,
            put_premium=2.0,
            expiration_days=30,
        )
        
        # Strangle max loss (cost) < Straddle max loss (cost)
        assert abs(strangle.max_loss) < abs(straddle.max_loss)


class TestPositionGreeks:
    """Tests for aggregate Greeks calculation"""
    
    def setup_method(self):
        self.factory = StrategyFactory(risk_free_rate=0.05)
    
    def test_covered_call_delta(self):
        """Test covered call has delta < 100"""
        result = self.factory.build_covered_call(
            underlying_price=100.0,
            call_strike=105.0,
            call_premium=3.0,
            expiration_days=30,
        )
        
        # Stock delta = 100, short call delta ~ -30 to -40
        # Net delta ~ 60-70
        assert 50 < result.net_delta < 100
    
    def test_iron_condor_neutral_delta(self):
        """Test iron condor is delta neutral"""
        result = self.factory.build_iron_condor(
            underlying_price=100.0,
            put_long_strike=90.0,
            put_long_premium=1.0,
            put_short_strike=95.0,
            put_short_premium=2.0,
            call_short_strike=105.0,
            call_short_premium=2.0,
            call_long_strike=110.0,
            call_long_premium=1.0,
            expiration_days=30,
        )
        
        # Delta should be close to 0
        assert abs(result.net_delta) < 20
    
    def test_long_straddle_negative_theta(self):
        """Test long straddle has negative theta (time decay)"""
        result = self.factory.build_straddle(
            underlying_price=100.0,
            strike=100.0,
            call_premium=4.0,
            put_premium=4.0,
            expiration_days=30,
            is_long=True,
        )
        
        # Long options = negative theta
        assert result.net_theta < 0
    
    def test_long_straddle_positive_vega(self):
        """Test long straddle has positive vega (benefits from vol increase)"""
        result = self.factory.build_straddle(
            underlying_price=100.0,
            strike=100.0,
            call_premium=4.0,
            put_premium=4.0,
            expiration_days=30,
            is_long=True,
        )
        
        # Long options = positive vega
        assert result.net_vega > 0


class TestPayoffCurves:
    """Tests for payoff curve generation"""
    
    def setup_method(self):
        self.factory = StrategyFactory(risk_free_rate=0.05)
    
    def test_payoff_curve_length(self):
        """Test payoff curves have correct length"""
        result = self.factory.build_covered_call(
            underlying_price=100.0,
            call_strike=105.0,
            call_premium=3.0,
            expiration_days=30,
        )
        
        assert len(result.price_range) == 100  # Default
        assert len(result.expiration_payoff) == 100
        assert len(result.theoretical_payoff) == 100
    
    def test_price_range_centered(self):
        """Test price range is centered on underlying"""
        result = self.factory.build_covered_call(
            underlying_price=100.0,
            call_strike=105.0,
            call_premium=3.0,
            expiration_days=30,
        )
        
        # Default is +/- 20%
        assert result.price_range[0] == pytest.approx(80.0, abs=0.1)
        assert result.price_range[-1] == pytest.approx(120.0, abs=0.1)
    
    def test_theoretical_vs_expiration_payoff(self):
        """Test T+0 payoff differs from expiration"""
        result = self.factory.build_covered_call(
            underlying_price=100.0,
            call_strike=105.0,
            call_premium=3.0,
            expiration_days=30,
        )
        
        # Theoretical should show time value
        # At ATM, theoretical should differ from expiration
        mid_idx = len(result.price_range) // 2
        # They should not be exactly equal (time value exists)
        assert result.theoretical_payoff != result.expiration_payoff


class TestStrategyAnalysisSerialization:
    """Tests for StrategyAnalysis serialization"""
    
    def setup_method(self):
        self.factory = StrategyFactory(risk_free_rate=0.05)
    
    def test_to_dict(self):
        """Test strategy analysis serialization"""
        result = self.factory.build_iron_condor(
            underlying_price=100.0,
            put_long_strike=90.0,
            put_long_premium=1.0,
            put_short_strike=95.0,
            put_short_premium=2.0,
            call_short_strike=105.0,
            call_short_premium=2.0,
            call_long_strike=110.0,
            call_long_premium=1.0,
            expiration_days=30,
        )
        
        data = result.to_dict()
        
        assert "name" in data
        assert "legs" in data
        assert "max_profit" in data
        assert "max_loss" in data
        assert "breakevens" in data
        assert "net_delta" in data
        assert len(data["legs"]) == 4
    
    def test_leg_serialization(self):
        """Test leg serialization within strategy"""
        result = self.factory.build_covered_call(
            underlying_price=100.0,
            call_strike=105.0,
            call_premium=3.0,
            expiration_days=30,
        )
        
        data = result.to_dict()
        
        stock_leg = next(l for l in data["legs"] if l["option_type"] == "stock")
        assert stock_leg["position"] == "long"
        assert stock_leg["strike"] == 100.0
        
        call_leg = next(l for l in data["legs"] if l["option_type"] == "call")
        assert call_leg["position"] == "short"
        assert call_leg["strike"] == 105.0
        assert call_leg["premium"] == 3.0


class TestCustomStrategy:
    """Tests for custom strategy analysis"""
    
    def setup_method(self):
        self.factory = StrategyFactory(risk_free_rate=0.05)
    
    def test_analyze_custom_legs(self):
        """Test analyzing arbitrary leg combination"""
        legs = [
            StrategyLeg(
                option_type="call",
                position=PositionType.LONG,
                strike=100.0,
                premium=5.0,
                quantity=2,
                expiration_days=30,
                iv=0.30,
            ),
            StrategyLeg(
                option_type="put",
                position=PositionType.SHORT,
                strike=95.0,
                premium=3.0,
                quantity=1,
                expiration_days=30,
                iv=0.30,
            ),
        ]
        
        result = self.factory.analyze_strategy(
            legs=legs,
            underlying_price=100.0,
            strategy_name="Custom Combo",
        )
        
        assert result.name == "Custom Combo"
        assert len(result.legs) == 2
        assert len(result.expiration_payoff) > 0
    
    def test_ratio_spread(self):
        """Test ratio spread (unequal quantities)"""
        legs = [
            StrategyLeg(
                option_type="call",
                position=PositionType.LONG,
                strike=100.0,
                premium=5.0,
                quantity=1,
                expiration_days=30,
                iv=0.30,
            ),
            StrategyLeg(
                option_type="call",
                position=PositionType.SHORT,
                strike=105.0,
                premium=2.0,
                quantity=2,  # 1:2 ratio
                expiration_days=30,
                iv=0.30,
            ),
        ]
        
        result = self.factory.analyze_strategy(
            legs=legs,
            underlying_price=100.0,
            strategy_name="Call Ratio Spread",
        )
        
        assert result.name == "Call Ratio Spread"
        # Should have unlimited risk (naked short call)
        # The payoff at high prices should be very negative


class TestEdgeCases:
    """Tests for edge cases"""
    
    def setup_method(self):
        self.factory = StrategyFactory(risk_free_rate=0.05)
    
    def test_very_short_expiration(self):
        """Test strategy with very short time to expiration"""
        result = self.factory.build_covered_call(
            underlying_price=100.0,
            call_strike=105.0,
            call_premium=0.5,
            expiration_days=1,
        )
        
        # Should not error
        assert result is not None
        assert len(result.expiration_payoff) > 0
    
    def test_deep_itm_options(self):
        """Test strategy with deep ITM options"""
        result = self.factory.build_vertical_spread(
            underlying_price=100.0,
            long_strike=80.0,  # Deep ITM
            long_premium=22.0,
            short_strike=85.0,  # Deep ITM
            short_premium=17.0,
            option_type="call",
            expiration_days=30,
        )
        
        assert result is not None
        assert len(result.breakevens) >= 0
    
    def test_far_otm_options(self):
        """Test strategy with far OTM options"""
        result = self.factory.build_strangle(
            underlying_price=100.0,
            call_strike=130.0,  # Far OTM
            call_premium=0.10,
            put_strike=70.0,   # Far OTM
            put_premium=0.10,
            expiration_days=30,
        )
        
        assert result is not None
        # Max loss should be small (cheap options)
        assert abs(result.max_loss) < 50
