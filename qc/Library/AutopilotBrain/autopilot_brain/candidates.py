from typing import List, Dict, Any
from .types import Snapshot, OptionContract, Candidate, UnderlyingSnapshot
from .config import TARGET_DELTA_MIN, TARGET_DELTA_MAX, ALLOWED_TEMPLATES, PREFER_DELTA
from .validator import TradeValidator
from .utils_determinism import contract_sort_key

class CandidateGenerator:
    @staticmethod
    def generate_candidates(snapshot: Snapshot) -> List[Candidate]:
        candidates = []
        
        for ticker, data in snapshot.underlyings.items():
            # Get options for this ticker
            ticker_options = [o for o in snapshot.options if o.underlying == ticker]
            
            # Simple strategy: If price > SMA20 -> Bullish -> Long Call
            # If price < SMA20 -> Bearish -> Long Put
            # Note: Features should be passed or pre-calculated elsewhere. 
            # For scaffold, we assume features are computed in decide or passed via logic. 
            # This generator splits by strategy.
            
            # Filter options for validity first
            valid_options = []
            for opt in ticker_options:
                is_valid, reason = TradeValidator.validate_entry(opt, snapshot)
                if is_valid:
                    valid_options.append(opt)
            
            # Pick Best Call and Best Put
            best_call = CandidateGenerator._select_best_contract(valid_options, "CALL", data.last_price)
            best_put = CandidateGenerator._select_best_contract(valid_options, "PUT", data.last_price)
            
            if best_call:
                candidates.append(Candidate(
                    contract=best_call, 
                    score=0.0, # To be filled by scorer
                    template="LONG_CALL",
                    predicted_credit=0.0,
                    metadata={}
                ))
            
            if best_put:
                candidates.append(Candidate(
                    contract=best_put,
                    score=0.0,
                    template="LONG_PUT",
                    predicted_credit=0.0,
                    metadata={}
                ))
                
        return candidates

    @staticmethod
    def _select_best_contract(options: List[OptionContract], right: str, underlying_price: float) -> OptionContract:
        filtered = [o for o in options if o.right.value == right]
        if not filtered:
            return None
            
        # Priority 1: Delta Band (if available)
        if PREFER_DELTA:
            delta_band = [o for o in filtered if o.delta is not None and TARGET_DELTA_MIN <= abs(o.delta) <= TARGET_DELTA_MAX]
            if delta_band:
                filtered = delta_band
        
        # Priority 2: ATM Distance (Fallback)
        # Sort by distance abs(strike - price)
        # Use stable sort key for tie breaking
        
        def atm_dist(o):
            return abs(o.strike - underlying_price) / underlying_price
            
        filtered.sort(key=lambda o: (atm_dist(o), contract_sort_key(o)))
        
        return filtered[0] # Closest to ATM (or best delta)
