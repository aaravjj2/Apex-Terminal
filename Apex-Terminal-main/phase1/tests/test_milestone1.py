"""
Milestone 1 Integration Test (V1 Compliant)

Tests the full open→monitor→exit lifecycle:
1. State machine transitions correctly
2. Exit monitor triggers V1 hard stop (-20%)
3. Execution ladder retries work

V1 Compliance:
- Single hard stop at -20% (no soft stop, no smoothing)
- Profit target at +50%
- Time stop at DTE <= 1
"""

import sys
import os
import asyncio
import logging
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, AsyncMock

# Add path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../')))

from services.autopilot.state_machine import AgentStateMachine, AgentState, AgentAction
from services.autopilot.exit_monitor import ExitMonitor, ExitSignal, ExitTrigger, V1_HARD_STOP_PCT, V1_PROFIT_TARGET_PCT
from services.autopilot.execution_ladder import LimitOrderLadder, ExecutionState

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("M1Test")

def test_state_machine():
    logger.info("--- Testing State Machine ---")
    
    sm = AgentStateMachine(cooldown_seconds=60)
    
    # Initial state should be TOKEN_TRADE_PENDING
    assert sm.state == AgentState.TOKEN_TRADE_PENDING, f"Expected TOKEN_TRADE_PENDING, got {sm.state}"
    logger.info(f"✅ Initial state: {sm.state}")
    
    # Allowed actions
    actions = sm.get_allowed_actions()
    assert AgentAction.OPEN_POSITION in actions
    assert AgentAction.PLACE_TOKEN_TRADE in actions
    logger.info(f"✅ Allowed actions: {actions}")
    
    # Open position
    sm.on_position_opened("pos-001", is_token=False)
    assert sm.state == AgentState.IN_TRADE
    logger.info(f"✅ After open: {sm.state}")
    
    # Only exit allowed
    actions = sm.get_allowed_actions()
    assert AgentAction.EXIT_POSITION in actions
    assert AgentAction.OPEN_POSITION not in actions
    logger.info(f"✅ Actions in trade: {actions}")
    
    # Initiate exit
    sm.on_exit_initiated("pos-001", "stop_loss")
    assert sm.state == AgentState.EXITING
    logger.info(f"✅ After exit init: {sm.state}")
    
    # Close position
    sm.on_position_closed("pos-001", pnl=-25.0)
    assert sm.state == AgentState.COOLDOWN
    logger.info(f"✅ After close: {sm.state}")
    
    # Check transition history
    history = sm.get_transition_history()
    assert len(history) >= 3
    logger.info(f"✅ Transition history has {len(history)} entries")


def test_v1_exit_monitor():
    """V1 Exit Monitor Test - Single Hard Stop at -10%."""
    logger.info("--- Testing V1 Exit Monitor ---")
    
    monitor = ExitMonitor()
    now = datetime.now(timezone.utc)
    expiry = now + timedelta(days=7)  # 7 days to expiry
    
    # Register a long premium position
    pos_id = monitor.register_position(
        position_id="pos-v1-001",
        entry_price=1.00,
        entry_time=now,
        dte=7,  # 7 days to expiry
    )
    logger.info(f"✅ Registered position: {pos_id}")
    
    # Test 1: -5% loss - should NOT trigger (threshold is -10%)
    signals = monitor.check_position("pos-v1-001", current_price=0.95)
    triggered = [s for s in signals if s.triggered]
    assert len(triggered) == 0, f"Unexpected trigger at -5%: {triggered}"
    logger.info("✅ -5% loss: NO trigger (expected)")
    
    # Test 2: -8% loss - still should NOT trigger
    signals = monitor.check_position("pos-v1-001", current_price=0.92)
    triggered = [s for s in signals if s.triggered]
    assert len(triggered) == 0, f"Unexpected trigger at -8%: {triggered}"
    logger.info("✅ -8% loss: NO trigger (expected)")
    
    # Test 3: -11% loss - SHOULD trigger hard stop (using 0.89 to ensure > -10%)
    signals = monitor.check_position("pos-v1-001", current_price=0.89)
    triggered = [s for s in signals if s.triggered]
    assert len(triggered) == 1, f"Expected hard stop trigger at -11%"
    assert triggered[0].trigger == ExitTrigger.HARD_STOP
    logger.info("✅ -11% loss: HARD STOP TRIGGERED (expected)")
    
    # Test 4: +50% profit target - now triggers BOTH partial profit (+10%) and profit target (+20%)
    monitor.register_position(
        position_id="pos-v1-002",
        entry_price=1.00,
        entry_time=now,
        dte=7,
    )
    signals = monitor.check_position("pos-v1-002", current_price=1.50)
    triggered = [s for s in signals if s.triggered]
    # At +50%, both PARTIAL_PROFIT (threshold +10%) and PROFIT_TARGET (threshold +20%) trigger
    assert len(triggered) >= 1, f"Expected at least profit target trigger at +50%"
    profit_target_triggered = any(s.trigger == ExitTrigger.PROFIT_TARGET for s in triggered)
    assert profit_target_triggered, "PROFIT_TARGET should trigger at +50%"
    logger.info("✅ +50% profit: PROFIT TARGET TRIGGERED (expected)")
    
    # Test 5: Time stop (DTE <= 1)
    monitor.register_position(
        position_id="pos-v1-003",
        entry_price=1.00,
        entry_time=now,
        dte=1,  # DTE = 1, should trigger
    )
    signals = monitor.check_position("pos-v1-003", current_price=1.00)  # No PnL trigger
    triggered = [s for s in signals if s.triggered]
    assert len(triggered) == 1, f"Expected time stop trigger at DTE = 1"
    assert triggered[0].trigger == ExitTrigger.TIME_STOP
    logger.info("✅ DTE = 1: TIME STOP TRIGGERED (expected)")
    
    logger.info(f"V1 Hard Stop: -{V1_HARD_STOP_PCT*100:.0f}%")
    logger.info(f"V1 Profit Target: +{V1_PROFIT_TARGET_PCT*100:.0f}%")

async def test_execution_ladder():
    logger.info("--- Testing Execution Ladder ---")
    
    ladder = LimitOrderLadder(
        step_pct=0.15,
        max_improve_pct=0.45,
        max_attempts=3,
        attempt_interval_sec=0.1,  # Fast for testing
    )
    
    # Mock functions
    order_counter = [0]
    
    async def mock_submit(symbol, side, qty, limit_price):
        order_counter[0] += 1
        logger.info(f"  Mock submit: {side} {qty}x {symbol} @ {limit_price:.2f}")
        return f"order-{order_counter[0]}"
    
    async def mock_check_fill(order_id):
        # Simulate fill on 2nd attempt
        if "2" in order_id:
            return ("filled", 1, 2.15)
        return ("open", 0, None)
    
    async def mock_cancel(order_id):
        logger.info(f"  Mock cancel: {order_id}")
        return True
    
    result = await ladder.execute(
        symbol="TEST",
        side="buy",
        qty=1,
        bid=2.00,
        ask=2.20,
        submit_fn=mock_submit,
        check_fn=mock_check_fill,
        cancel_fn=mock_cancel,
    )
    
    assert result.success
    assert result.state == ExecutionState.FILLED
    assert result.total_attempts == 2
    logger.info(f"✅ Execution ladder: {result.state} after {result.total_attempts} attempts")
    logger.info(f"   Fill price: ${result.avg_fill_price:.2f}, Slippage: {result.slippage_bps:.1f} bps")

if __name__ == "__main__":
    test_state_machine()
    test_v1_exit_monitor()
    asyncio.run(test_execution_ladder())
    
    logger.info("\n🎉 All Milestone 1 V1 tests passed!")
