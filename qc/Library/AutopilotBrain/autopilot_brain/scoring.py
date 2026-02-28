from typing import List
from .types import Candidate, UnderlyingSnapshot, Snapshot
from .features import FeatureCalculator

class Scorer:
    @staticmethod
    def score_candidates(candidates: List[Candidate], snapshot: Snapshot) -> List[Candidate]:
        """
        Assign scores to candidates based on technical features.
        Deterministic.
        """
        for cand in candidates:
            underlying = snapshot.underlyings.get(cand.contract.underlying)
            if not underlying:
                cand.score = -1.0
                continue
                
            feats = FeatureCalculator.compute_features(underlying.bars_daily)
            
            # Simple Logic:
            # Bullish Trend (score 2) + Long Call = High Score
            # Bearish Trend (score 0) + Long Put = High Score
            
            trend = feats.get("trend_score", 1.0) # 0, 1, 2
            
            base_score = 0.0
            
            if cand.template == "LONG_CALL":
                if trend >= 2.0: base_score = 100.0 # Strong Bull
                elif trend >= 1.0: base_score = 50.0 # Weak Bull
                else: base_score = 0.0
            elif cand.template == "LONG_PUT":
                if trend <= 0.0: base_score = 100.0 # Strong Bear
                elif trend <= 1.0: base_score = 50.0 # Weak Bear
                else: base_score = 0.0
                
            # Adjusment by RSI (Mean Reversion / Momentum)
            # Avoid buying calls if RSI > 70
            rsi = feats.get("rsi_14", 50.0)
            if cand.template == "LONG_CALL" and rsi > 70:
                base_score -= 20
            if cand.template == "LONG_PUT" and rsi < 30:
                base_score -= 20
                
            cand.score = base_score
            cand.metadata.update(feats)
            
        return candidates
