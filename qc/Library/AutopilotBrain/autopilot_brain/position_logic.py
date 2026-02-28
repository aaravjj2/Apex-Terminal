from typing import List, Optional
from .types import PositionView, Action, ActionType, ActionReason, Snapshot, BrainState
from .config import TIME_STOP_DTE

class PositionLogic:
    @staticmethod
    def check_exits(snapshot: Snapshot, state: BrainState) -> List[Action]:
        actions = []
        
        for pos in snapshot.positions:
            contract_id = pos.contract_id
            
            # 1. Time Stop (DTE)
            if pos.dte <= TIME_STOP_DTE:
                actions.append(Action(
                    type=ActionType.EXIT,
                    contract_id=contract_id,
                    reason=ActionReason.TIME_STOP,
                    qty=pos.qty,
                    details=f"DTE {pos.dte} <= {TIME_STOP_DTE}"
                ))
                continue
                
            # 2. State-based Profit/Loss
            # Retrieve meta if available
            meta = state.position_meta.get(contract_id)
            if meta:
                stop_pct = meta.stop_loss_pct # e.g. 0.10
                target_pct = meta.profit_target_pct # e.g. 0.50
                
                # Check Stop Loss
                if pos.unrealized_pnl_pct <= -stop_pct: # -0.20 <= -0.10
                     actions.append(Action(
                        type=ActionType.EXIT,
                        contract_id=contract_id,
                        reason=ActionReason.STOP_LOSS,
                        qty=pos.qty,
                        details=f"PnL {pos.unrealized_pnl_pct:.2f} <= -{stop_pct:.2f}"
                    ))
                     continue

                # Check Profit Target
                if pos.unrealized_pnl_pct >= target_pct:
                     actions.append(Action(
                        type=ActionType.EXIT,
                        contract_id=contract_id,
                        reason=ActionReason.PROFIT_TARGET,
                        qty=pos.qty,
                        details=f"PnL {pos.unrealized_pnl_pct:.2f} >= {target_pct:.2f}"
                    ))
                     continue
                     
            # 3. Fallback / Hard Stops (V1-A)
            # If no meta, use config defaults or just hold
            # ... (implemented via meta normally)

        return actions
