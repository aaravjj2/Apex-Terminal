from typing import List, Tuple, Optional
from .brain_types import OptionContract, Snapshot, ActionReason
from .config import MAX_DTE_ENTRY, MIN_DTE_ENTRY, MAX_RISK_PER_TRADE_PCT, INITIAL_BUDGET

class TradeValidator:
    @staticmethod
    def validate_entry(contract: OptionContract, snapshot: Snapshot) -> Tuple[bool, str]:
        """Check hard entrance gates."""
        
        # 1. Kill Switch
        if snapshot.risk.kill_switch:
            return False, "KILL_SWITCH_ACTIVE"
        
        # 2. DTE Guards (V1-A)
        days_to_expiry = (contract.expiry - snapshot.cycle_time).days
        if days_to_expiry < MIN_DTE_ENTRY or days_to_expiry > MAX_DTE_ENTRY:
             return False, f"DTE_{days_to_expiry}_OUT_OF_BOUNDS"
        
        # 3. Spread Check (to prevent bad fills)
        if contract.spread_pct > 0.20: # 20% max spread
            return False, "SPREAD_TOO_WIDE"
            
        # 4. Budget/Cost
        cost = contract.ask * 100
        max_cost = INITIAL_BUDGET * MAX_RISK_PER_TRADE_PCT
        if cost > max_cost:
            return False, f"COST_{cost:.0f}_EXCEEDS_LIMIT_{max_cost:.0f}"
            
        return True, "OK"
