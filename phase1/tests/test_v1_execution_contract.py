"""
Tests for V1 Execution Contract.

Phase 2: Limit-only execution with bounded chase.
"""
import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime

from services.autopilot.v1_execution_contract import (
    V1ExecutionContract,
    V1ExecutionResult,
    V1DeterministicFillSimulator,
    ExecutionStatus,
    V1_MAX_CHASE_ATTEMPTS,
    V1_MAX_CHASE_SPREAD_PCT,
    get_v1_execution_contract,
    reset_v1_execution_contract,
)


class TestV1ExecutionConstants:
    """Test V1 execution constants."""
    
    def test_max_chase_attempts(self):
        """Max chase attempts should be 3."""
        assert V1_MAX_CHASE_ATTEMPTS == 3
    
    def test_max_chase_spread_pct(self):
        """Max chase spread percent should be 5%."""
        assert V1_MAX_CHASE_SPREAD_PCT == 0.05


class TestV1ExecutionContract:
    """Test V1ExecutionContract enforcement."""
    
    @pytest.fixture
    def contract(self):
        """Create fresh execution contract."""
        reset_v1_execution_contract()
        return get_v1_execution_contract()
    
    @pytest.fixture
    def mock_broker(self):
        """Create mock broker functions."""
        submit = AsyncMock(return_value="ORDER-001")
        check = AsyncMock(return_value=("filled", 1, 2.50))
        cancel = AsyncMock(return_value=True)
        return submit, check, cancel
    
    @pytest.mark.asyncio
    async def test_rejects_short_premium_templates(self, contract, mock_broker):
        """V1 should reject non-long-premium templates."""
        submit, check, cancel = mock_broker
        
        candidate = {
            "symbol": "AAPL",
            "template": "put_credit_spread",  # V2+ template
            "qty": 1,
        }
        
        result = await contract.execute(
            candidate=candidate,
            bid=2.00,
            ask=2.50,
            broker_submit_fn=submit,
            broker_check_fn=check,
            broker_cancel_fn=cancel,
        )
        
        assert result.success is False
        assert result.status == ExecutionStatus.REJECTED
        assert "only long_call/long_put allowed" in result.rejection_reason
        assert submit.call_count == 0  # Never submitted
    
    @pytest.mark.asyncio
    async def test_accepts_long_call(self, contract, mock_broker):
        """V1 should accept long_call template."""
        submit, check, cancel = mock_broker
        
        candidate = {
            "symbol": "AAPL",
            "template": "long_call",
            "qty": 1,
        }
        
        # Use prices that result in < $150 position: mid of $1.00-$1.40 = $1.20 * 100 = $120
        result = await contract.execute(
            candidate=candidate,
            bid=1.00,
            ask=1.40,
            broker_submit_fn=submit,
            broker_check_fn=check,
            broker_cancel_fn=cancel,
        )
        
        assert result.success is True
        assert result.status == ExecutionStatus.FILLED
    
    @pytest.mark.asyncio
    async def test_accepts_long_put(self, contract, mock_broker):
        """V1 should accept long_put template."""
        submit, check, cancel = mock_broker
        
        candidate = {
            "symbol": "AAPL",
            "template": "long_put",
            "qty": 1,
        }
        
        # Use prices that result in < $150 position: mid of $1.00-$1.40 = $1.20 * 100 = $120
        result = await contract.execute(
            candidate=candidate,
            bid=1.00,
            ask=1.40,
            broker_submit_fn=submit,
            broker_check_fn=check,
            broker_cancel_fn=cancel,
        )
        
        assert result.success is True
        assert result.status == ExecutionStatus.FILLED
    
    @pytest.mark.asyncio
    async def test_rejects_invalid_quotes(self, contract, mock_broker):
        """V1 should reject invalid bid/ask quotes."""
        submit, check, cancel = mock_broker
        
        candidate = {
            "symbol": "AAPL",
            "template": "long_call",
            "qty": 1,
        }
        
        # Invalid: ask < bid (use small values within position limit)
        result = await contract.execute(
            candidate=candidate,
            bid=1.50,
            ask=1.00,  # Invalid: ask < bid
            broker_submit_fn=submit,
            broker_check_fn=check,
            broker_cancel_fn=cancel,
        )
        
        assert result.success is False
        assert result.status == ExecutionStatus.REJECTED
        assert "Invalid bid/ask" in result.rejection_reason
    
    @pytest.mark.asyncio
    async def test_anti_thrash_integration(self, contract, mock_broker):
        """V1 should check anti-thrash gates when engine provided."""
        submit, check, cancel = mock_broker
        
        # Mock engine with blocked ticker
        mock_engine = MagicMock()
        mock_engine._check_anti_thrash_gates.return_value = (False, "AAPL on cooldown")
        
        candidate = {
            "symbol": "AAPL",
            "template": "long_call",
            "qty": 1,
        }
        
        # Use prices within $150 limit: mid of $1.00-$1.40 = $1.20 * 100 = $120
        result = await contract.execute(
            candidate=candidate,
            bid=1.00,
            ask=1.40,
            broker_submit_fn=submit,
            broker_check_fn=check,
            broker_cancel_fn=cancel,
            engine=mock_engine,
        )
        
        assert result.success is False
        assert result.status == ExecutionStatus.BLOCKED_THRASH
        assert "Anti-thrash" in result.rejection_reason
    
    @pytest.mark.asyncio
    async def test_bounded_chase_ladder(self, contract):
        """V1 should use bounded chase ladder (max 3 attempts)."""
        attempts_made = []
        
        async def track_submit(symbol, price, qty):
            attempts_made.append(price)
            return f"ORDER-{len(attempts_made)}"
        
        # Never fill - force all attempts
        async def never_fill(order_id):
            return ("pending", 0, None)
        
        cancel = AsyncMock(return_value=True)
        
        candidate = {
            "symbol": "AAPL",
            "template": "long_call",
            "qty": 1,
        }
        
        # Use prices within $150 limit: mid of $1.00-$1.40 = $1.20 * 100 = $120
        result = await contract.execute(
            candidate=candidate,
            bid=1.00,
            ask=1.40,
            broker_submit_fn=track_submit,
            broker_check_fn=never_fill,
            broker_cancel_fn=cancel,
        )
        
        # Should have made exactly 3 attempts (V1_MAX_CHASE_ATTEMPTS)
        assert len(attempts_made) == 3
        assert result.total_attempts == 3
        assert result.status == ExecutionStatus.TIMEOUT
    
    @pytest.mark.asyncio
    async def test_chase_prices_bounded(self, contract):
        """Chase prices should not exceed max spread improvement."""
        attempts_prices = []
        
        async def track_submit(symbol, price, qty):
            attempts_prices.append(price)
            return f"ORDER-{len(attempts_prices)}"
        
        async def never_fill(order_id):
            return ("pending", 0, None)
        
        cancel = AsyncMock(return_value=True)
        
        # Use prices within $150 limit: mid of $1.00-$1.40 = $1.20 * 100 = $120
        bid = 1.00
        ask = 1.40
        spread = ask - bid
        mid = (bid + ask) / 2  # 1.20
        
        candidate = {
            "symbol": "AAPL",
            "template": "long_call",
            "qty": 1,
        }
        
        await contract.execute(
            candidate=candidate,
            bid=bid,
            ask=ask,
            broker_submit_fn=track_submit,
            broker_check_fn=never_fill,
            broker_cancel_fn=cancel,
        )
        
        # All prices should be between mid and mid + 5% of spread
        max_price = mid + spread * V1_MAX_CHASE_SPREAD_PCT
        for price in attempts_prices:
            assert price >= mid, f"Price {price} below mid {mid}"
            assert price <= max_price + 0.01, f"Price {price} exceeds max chase {max_price}"


class TestV1DeterministicFillSimulator:
    """Test deterministic paper fill simulator."""
    
    @pytest.fixture
    def simulator(self):
        """Create fresh simulator."""
        return V1DeterministicFillSimulator()
    
    @pytest.mark.asyncio
    async def test_deterministic_fill_at_mid(self, simulator):
        """Paper fills should be deterministic at mid-point."""
        order_id = await simulator.submit_order("AAPL250117C00200000", 2.30, 1)
        
        # Check with known bid/ask
        status, qty, price = await simulator.check_order(order_id, bid=2.00, ask=2.50)
        
        assert status == "filled"
        assert qty == 1
        assert price == 2.25  # Mid-point
    
    @pytest.mark.asyncio
    async def test_fills_are_recorded(self, simulator):
        """All fills should be recorded."""
        order_id = await simulator.submit_order("AAPL250117C00200000", 2.30, 1)
        await simulator.check_order(order_id, bid=2.00, ask=2.50)
        
        fills = simulator.get_fills()
        assert len(fills) == 1
        assert fills[0]["order_id"] == order_id
        assert fills[0]["fill_price"] == 2.25
    
    @pytest.mark.asyncio
    async def test_reset_clears_state(self, simulator):
        """Reset should clear all state."""
        await simulator.submit_order("AAPL", 2.30, 1)
        simulator.reset()
        
        assert simulator._order_counter == 0
        assert len(simulator.get_fills()) == 0


class TestV1ExecutionMetrics:
    """Test execution metrics tracking."""
    
    @pytest.fixture
    def contract(self):
        """Create fresh execution contract."""
        reset_v1_execution_contract()
        return get_v1_execution_contract()
    
    @pytest.mark.asyncio
    async def test_metrics_track_fills(self, contract):
        """Metrics should track successful fills."""
        submit = AsyncMock(return_value="ORDER-001")
        check = AsyncMock(return_value=("filled", 1, 1.20))
        cancel = AsyncMock(return_value=True)
        
        # Use prices within $150 limit: mid of $1.00-$1.40 = $1.20 * 100 = $120
        candidate = {"symbol": "AAPL", "template": "long_call", "qty": 1}
        
        await contract.execute(candidate, 1.00, 1.40, submit, check, cancel)
        
        # Need a different symbol for second trade (max 1 per underlying)
        candidate2 = {"symbol": "MSFT", "template": "long_call", "qty": 1}
        await contract.execute(candidate2, 1.00, 1.40, submit, check, cancel)
        
        metrics = contract.get_metrics()
        assert metrics["total_executions"] == 2
        assert metrics["fills"] == 2
        assert metrics["fill_rate"] == 1.0
    
    @pytest.mark.asyncio
    async def test_metrics_track_rejections(self, contract):
        """Metrics should track rejections."""
        submit = AsyncMock(return_value="ORDER-001")
        check = AsyncMock(return_value=("filled", 1, 1.20))
        cancel = AsyncMock(return_value=True)
        
        # This will be rejected (wrong template)
        candidate = {"symbol": "AAPL", "template": "iron_condor", "qty": 1}
        await contract.execute(candidate, 1.00, 1.40, submit, check, cancel)
        
        metrics = contract.get_metrics()
        assert metrics["rejections"] == 1
        assert metrics["fills"] == 0
        
        metrics = contract.get_metrics()
        assert metrics["rejections"] == 1
        assert metrics["fills"] == 0


class TestV1ExecutionResult:
    """Test V1ExecutionResult serialization."""
    
    def test_to_dict(self):
        """Result should serialize to dict."""
        result = V1ExecutionResult(
            success=True,
            status=ExecutionStatus.FILLED,
            ticker="AAPL",
            template="long_call",
            requested_qty=1,
            filled_qty=1,
            avg_fill_price=2.30,
            total_attempts=1,
            total_latency_ms=150.0,
            slippage_bps=5.0,
            broker_order_id="ORDER-001",
        )
        
        d = result.to_dict()
        assert d["success"] is True
        assert d["status"] == "filled"
        assert d["ticker"] == "AAPL"
        assert d["avg_fill_price"] == 2.30
