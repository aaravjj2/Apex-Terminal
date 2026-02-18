from typing import Tuple, List
from datetime import datetime
from .brain_types import Snapshot, BrainState, Action, Explain, ActionType, ActionReason, PositionMeta
from .config import MAX_OPEN_POSITIONS, MAX_PREMIUM_EXPOSURE, PROFIT_TARGET_PCT, STOP_LOSS_PCT
from .candidates import CandidateGenerator
from .scoring import Scorer
from .position_logic import PositionLogic

class Brain:
    @staticmethod
    def decide(snapshot: Snapshot, state: BrainState) -> Tuple[List[Action], BrainState, Explain]:
        """
        Pure function: Snapshot + State -> Actions + NewState + Explain.
        """
        actions: List[Action] = []
        new_state = state # In a real immutable design we'd clone, but in Py we assume we modify or copy
        
        # 1. Check Exits (Priority 1)
        exit_actions = PositionLogic.check_exits(snapshot, new_state)
        actions.extend(exit_actions)
        
        # 2. Check Capacity for New Entries
        current_positions = len(snapshot.positions)
        pending_exits = len([a for a in actions if a.type == ActionType.EXIT])
        projected_positions = current_positions - pending_exits
        
        can_enter = True
        skip_reasons = []
        
        if projected_positions >= MAX_OPEN_POSITIONS:
            can_enter = False
            skip_reasons.append("MAX_POSITIONS_REACHED")
            
        if snapshot.risk.premium_exposure_used >= MAX_PREMIUM_EXPOSURE:
            can_enter = False
            skip_reasons.append("MAX_EXPOSURE_REACHED")
            
        candidates = []
        top_details = ""
        
        if can_enter:
            # 3. Generate & Score Candidates
            candidates = CandidateGenerator.generate_candidates(snapshot)
            candidates = Scorer.score_candidates(candidates, snapshot)
            
            # Sort Deterministically: Score desc, then Contract Key
            candidates.sort(key=lambda c: (-c.score, c.contract.contract_id))
            
            # Select Top 1
            if candidates:
                top = candidates[0]
                if top.score > 0: # Threshold
                    # Create Entry Action
                    # Determine Qty (1 for V1-A)
                    entry_action = Action(
                        type=ActionType.ENTER,
                        contract_id=top.contract.contract_id,
                        reason=ActionReason.SIGNAL_ENTRY,
                        qty=1,
                        limit_intent=top.contract.ask,
                        details=f"Score={top.score:.1f} {top.template}"
                    )
                    actions.append(entry_action)
                    top_details = entry_action.details
                    
                    # Update State with Metadata for this new position
                    # Note: State update happens here, but acts as "intent". 
                    # If execution fails, state might de-sync? 
                    # Pattern A: State tracks intent or we reconcile later. 
                    # Usually, adapter confirms execution. 
                    # But for Brain state (meta), we assume entry success for tracking purpose OR 
                    # we rely on Adapter to feed meta back in next Snapshot.
                    # BETTER: Brain returns "Intended Meta" via Actions or NewState.
                    # Here we update NewState envisioning successful entry.
                    
                    meta = PositionMeta(
                        contract_id=top.contract.contract_id,
                        entry_time=snapshot.cycle_time.isoformat(),
                        strategy_id="V1-A",
                        stop_loss_pct=STOP_LOSS_PCT,
                        profit_target_pct=PROFIT_TARGET_PCT,
                        max_days_hold=7
                    )
                    new_state.position_meta[top.contract.contract_id] = meta
                    
                else:
                    skip_reasons.append("TOP_SCORE_TOO_LOW")
            else:
                skip_reasons.append("NO_CANDIDATES")
        
        explain = Explain(
            regime="UNKNOWN", # TODO: wiring feature regime
            candidates_count=len(candidates),
            actions_count=len(actions),
            skip_reasons=skip_reasons,
            top_candidate_details=top_details
        )
        
        return actions, new_state, explain
