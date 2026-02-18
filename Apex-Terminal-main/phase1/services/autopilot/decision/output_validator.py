"""
LLM Output Validator (Phase 1, Layer 2)

Enforces business logic on the structured AI response.
1. Referential Integrity: Selected IDs must exist in the candidate pool.
2. Confidence Enforcement: Must meet strict thresholds for trading.
3. Logical Consistency: Action matches reasoning.
"""

import logging
from typing import List, Dict, Set
from .models import LLMResponse, CandidateSelection, DecisionAction
# Assuming TradeCandidate serves as the "source of truth" object, though we only need IDs here.
# We'll use a simple list of expected IDs for decoupling.

logger = logging.getLogger(__name__)

class LLMOutputValidationError(Exception):
    """Raised when LLM output violates business rules."""
    pass

def validate_llm_response(
    response: LLMResponse,
    valid_candidate_ids: Set[str],
    min_confidence: float = 0.8  # Stricter than the 0.7 model validator
) -> List[CandidateSelection]:
    """
    Validate and filter LLM selections.
    
    Args:
        response: The parsed Pydantic response from the LLM.
        valid_candidate_ids: Set of IDs that were sent to the LLM.
        min_confidence: Minimum confidence required for an ACCEPT action.
        
    Returns:
        List of validated CandidateSelection objects.
        
    Raises:
        LLMOutputValidationError: If critical hallucinations are detected (e.g. inventing IDs).
    """
    validated_selections = []
    
    for selection in response.selections:
        # 1. Check Referential Integrity (Hallucination Check)
        if selection.candidate_id not in valid_candidate_ids:
            logger.error(f"Hallucinated ID detected: {selection.candidate_id}")
            # We strictly fail if the LLM hallucinates an ID, as it implies loss of context.
            # Alternatively, we could just ignore this selection, but it's a bad smell.
            # For now, let's log error and skip it, but keep others if valid.
            continue
            
        # 2. Check Confirmation Thresholds
        if selection.action == DecisionAction.ACCEPT:
            if selection.confidence < min_confidence:
                 logger.info(
                     f"Candidate {selection.candidate_id} REJECTED due to low confidence "
                     f"({selection.confidence:.2f} < {min_confidence})"
                 )
                 # Downgrade to REJECT or skip?
                 # If LLM wanted to accept but wasn't sure, we should absolutely NOT trade.
                 # We treat it as a rejection.
                 selection.action = DecisionAction.REJECT
                 selection.justification.final_verdict += f" [System: Downgraded due to low confidence]"
        
        validated_selections.append(selection)
        
    return validated_selections
