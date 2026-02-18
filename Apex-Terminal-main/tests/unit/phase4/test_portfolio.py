"""
Unit tests for Phase 4 - Portfolio Manager.
"""

import pytest
from datetime import datetime

# Add path for imports
import sys
from pathlib import Path
_project_root = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(_project_root / "phase1"))

from services.portfolio.manager import PortfolioManager, Position, Trade, PositionSide


class TestPosition:
    """Tests for Position dataclass."""
    
    def test_position_long(self):
        pos = Position(symbol="AAPL", quantity=100, avg_cost=150.0, current_price=160.0)
        
        assert pos.side == PositionSide.LONG
        assert pos.market_value == 16000.0
        assert pos.cost_basis == 15000.0
        assert pos.unrealized_pnl == 1000.0
        assert pos.unrealized_pnl_pct == pytest.approx(6.67, rel=0.01)
    
    def test_position_short(self):
        pos = Position(symbol="TSLA", quantity=-50, avg_cost=200.0, current_price=180.0)
        
        assert pos.side == PositionSide.SHORT
        assert pos.market_value == -9000.0  # Negative for short
        assert pos.unrealized_pnl == 1000.0  # Profit on short
    
    def test_position_flat(self):
        pos = Position(symbol="MSFT")
        
        assert pos.side == PositionSide.FLAT
        assert pos.quantity == 0
        assert pos.market_value == 0
    
    def test_position_to_dict(self):
        pos = Position(symbol="AAPL", quantity=100, avg_cost=150.0, current_price=160.0)
        d = pos.to_dict()
        
        assert d["symbol"] == "AAPL"
        assert d["quantity"] == 100
        assert d["side"] == "long"
        assert d["unrealized_pnl"] == 1000.0


class TestPortfolioManager:
    """Tests for PortfolioManager class."""
    
    def test_initial_state(self):
        pm = PortfolioManager(initial_cash=100000.0)
        
        assert pm.cash == 100000.0
        assert pm.equity == 100000.0
        assert pm.realized_pnl == 0.0
        assert len(pm.trades) == 0
        assert len(pm.get_positions()) == 0
    
    def test_buy_creates_position(self):
        pm = PortfolioManager(initial_cash=100000.0)
        
        trade = pm.execute_fill(
            symbol="AAPL",
            side="buy",
            quantity=100,
            price=150.0,
            timestamp=datetime.now(),
        )
        
        assert trade is not None
        assert trade.symbol == "AAPL"
        assert trade.quantity == 100
        
        pos = pm.get_position("AAPL")
        assert pos.quantity == 100
        assert pos.avg_cost == 150.0
        
        # Cash reduced
        assert pm.cash == 100000.0 - (100 * 150)
    
    def test_sell_closes_position(self):
        pm = PortfolioManager(initial_cash=100000.0)
        
        # Buy first
        pm.execute_fill("AAPL", "buy", 100, 150.0, datetime.now())
        
        # Sell to close
        pm.execute_fill("AAPL", "sell", 100, 160.0, datetime.now())
        
        pos = pm.get_position("AAPL")
        assert pos.quantity == 0
        
        # Realized profit
        assert pm.realized_pnl == 1000.0  # (160-150) * 100
    
    def test_partial_close(self):
        pm = PortfolioManager(initial_cash=100000.0)
        
        # Buy 100
        pm.execute_fill("AAPL", "buy", 100, 150.0, datetime.now())
        
        # Sell 50
        pm.execute_fill("AAPL", "sell", 50, 160.0, datetime.now())
        
        pos = pm.get_position("AAPL")
        assert pos.quantity == 50
        assert pos.avg_cost == 150.0  # Same avg cost
        
        # Realized profit on 50 shares
        assert pm.realized_pnl == 500.0
    
    def test_average_up(self):
        pm = PortfolioManager(initial_cash=100000.0)
        
        # Buy 100 @ 150
        pm.execute_fill("AAPL", "buy", 100, 150.0, datetime.now())
        
        # Buy 100 @ 160 (averaging up)
        pm.execute_fill("AAPL", "buy", 100, 160.0, datetime.now())
        
        pos = pm.get_position("AAPL")
        assert pos.quantity == 200
        assert pos.avg_cost == 155.0  # (150*100 + 160*100) / 200
    
    def test_commission_deducted(self):
        pm = PortfolioManager(initial_cash=100000.0)
        
        trade = pm.execute_fill(
            symbol="AAPL",
            side="buy",
            quantity=100,
            price=150.0,
            timestamp=datetime.now(),
            commission=10.0,
        )
        
        assert trade.commission == 10.0
        # Cash reduced by order + commission
        assert pm.cash == 100000.0 - (100 * 150) - 10.0
    
    def test_export_trades_json(self):
        pm = PortfolioManager(initial_cash=100000.0)
        pm.execute_fill("AAPL", "buy", 100, 150.0, datetime.now())
        
        json_str = pm.export_trades_json()
        assert "AAPL" in json_str
        assert "buy" in json_str
    
    def test_export_trades_csv(self):
        pm = PortfolioManager(initial_cash=100000.0)
        pm.execute_fill("AAPL", "buy", 100, 150.0, datetime.now())
        
        csv_str = pm.export_trades_csv()
        assert "AAPL" in csv_str
        assert "id,symbol,side" in csv_str
    
    def test_reset(self):
        pm = PortfolioManager(initial_cash=100000.0)
        pm.execute_fill("AAPL", "buy", 100, 150.0, datetime.now())
        
        pm.reset()
        
        assert pm.cash == 100000.0
        assert len(pm.trades) == 0
        assert len(pm.positions) == 0


class TestTrade:
    """Tests for Trade dataclass."""
    
    def test_trade_values(self):
        trade = Trade(
            id="TRD-001",
            symbol="AAPL",
            side="buy",
            quantity=100,
            price=150.0,
            timestamp=datetime.now(),
            commission=10.0,
        )
        
        assert trade.gross_value == 15000.0
        assert trade.net_value == 15010.0  # Gross + commission for buy
    
    def test_trade_to_dict(self):
        trade = Trade(
            id="TRD-001",
            symbol="AAPL",
            side="buy",
            quantity=100,
            price=150.0,
            timestamp=datetime.now(),
        )
        
        d = trade.to_dict()
        assert d["id"] == "TRD-001"
        assert d["symbol"] == "AAPL"
        assert "timestamp" in d
