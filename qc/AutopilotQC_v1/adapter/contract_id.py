from datetime import datetime
from autopilot_brain.brain_types import OptionRight

class ContractIdManager:
    """
    Canonical ID Format: TICKER|YYYY-MM-DD|C/P|STRIKE
    Mappings QC Symbol <-> Canonical String
    """
    def __init__(self, algo):
        self.algo = algo
        # Caching if needed, though computation is cheap
        
    def to_canonical(self, qc_symbol) -> str:
        """QC Symbol -> Canonical String."""
        ticker = qc_symbol.Underlying.Value
        expiry = qc_symbol.ID.Date.strftime("%Y-%m-%d")
        right = "C" if qc_symbol.ID.OptionRight == OptionRight.Call else "P"
        strike = f"{qc_symbol.ID.StrikePrice:.2f}"
        
        return f"{ticker}|{expiry}|{right}|{strike}"
    
    def get_symbol_properties(self, canonical_id: str):
        """Parse canonical ID back to components."""
        parts = canonical_id.split("|")
        return {
            "ticker": parts[0],
            "expiry": datetime.strptime(parts[1], "%Y-%m-%d"),
            "right": parts[2],
            "strike": float(parts[3])
        }
        
    # Note: Going Canonical -> QC Symbol is harder because we need the SID/Market.
    # We maintain a lookup of available contracts in current chain if needed.
    # Alternatively, we carry the QC Symbol object in a runtime map during the cycle.
