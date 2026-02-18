"""
Consensus Engine (Phase 1, Layer 3)

Orchestrates the dual-LLM validation process.
1. Calls Groq and Gemini in parallel.
2. strictly validates outputs against valid candidate IDs.
3. Compares decisions to find consensus.
4. Returns Final Decision (only ACCEPT if both agree).

"If there is doubt, there is no doubt." - Ronin
"""

import logging
import asyncio
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime

from .models import LLMResponse, CandidateSelection, DecisionAction, ConsensusResult
from .clients import GroqClientV2, GeminiClientV2
from .output_validator import validate_llm_response, LLMOutputValidationError
from ..config import AutopilotConfig

logger = logging.getLogger(__name__)

class ConsensusEngine:
    def __init__(self, config: AutopilotConfig):
        self.config = config
        self.groq = GroqClientV2(
            model="llama3-70b", # Force high-quality model for consensus
            api_key=config.llm_settings.groq_api_key
        )
        self.gemini = GeminiClientV2(
            model="flash", 
            api_key=config.llm_settings.gemini_api_key
        )
        
    async def decide_with_consensus(
        self, 
        candidates: List[Any], 
        context: Dict[str, Any]
    ) -> List[ConsensusResult]:
        """
        Run consensus cycle.
        
        Args:
            candidates: List of trade candidates (must have 'id' attr)
            context: Market/Portfolio context
            
        Returns:
            List of ConsensusResult for each candidate.
        """
        candidate_ids = {c.id for c in candidates}
        
        # 1. Run LLMs in parallel
        logger.info("Requesting dual-LLM consensus...")
        
        try:
            # We use asyncio.to_thread because the providers are synchronous (requests)
            groq_future = asyncio.to_thread(self.groq.get_decision, context)
            gemini_future = asyncio.to_thread(self.gemini.get_decision, context)
            
            results = await asyncio.gather(groq_future, gemini_future, return_exceptions=True)
            
            groq_resp = results[0]
            gemini_resp = results[1]
            
        except Exception as e:
            logger.error(f"Consensus execution failed: {e}")
            return [] # Fail safe
            
        # 2. Validate Outputs (Layer 2)
        valid_groq = self._safe_validate(groq_resp, candidate_ids, "Groq")
        valid_gemini = self._safe_validate(gemini_resp, candidate_ids, "Gemini")
        
        if not valid_groq and not valid_gemini:
            logger.warning("Both LLMs failed to produce valid output.")
            return []
            
        # 3. Compare and Reformulate
        final_decisions = self._compare_decisions(valid_groq, valid_gemini, candidate_ids)
        
        # Log summary
        accepts = len([d for d in final_decisions if d.consensus_action == DecisionAction.ACCEPT])
        logger.info(f"Consensus Cycle Complete. {len(final_decisions)} decisions, {accepts} ACCEPTED.")
        
        return final_decisions
        
    def _safe_validate(
        self, 
        response: Any, 
        valid_ids: set, 
        provider_name: str
    ) -> List[CandidateSelection]:
        """Validate LLM response safely, handling exceptions."""
        if isinstance(response, Exception):
            logger.error(f"{provider_name} failed: {response}")
            return []
            
        if not isinstance(response, LLMResponse):
            logger.error(f"{provider_name} returned invalid type: {type(response)}")
            return []
            
        try:
            return validate_llm_response(response, valid_ids)
        except Exception as e:
            logger.error(f"{provider_name} validation failed: {e}")
            return []

    def _compare_decisions(
        self,
        groq_selections: List[CandidateSelection],
        gemini_selections: List[CandidateSelection],
        candidate_ids: set
    ) -> List[ConsensusResult]:
        """
        Merge decisions.
        Strategy: Default to REJECT. Only ACCEPT if both explicitly ACCEPT.
        """
        # Index by ID
        groq_map = {s.candidate_id: s for s in groq_selections}
        gemini_map = {s.candidate_id: s for s in gemini_selections}
        
        results = []
        
        for cid in candidate_ids:
            g_sel = groq_map.get(cid)
            gem_sel = gemini_map.get(cid)
            
            action = DecisionAction.REJECT
            reason = "No consensus reached."
            models = []
            
            if g_sel: models.append("Groq")
            if gem_sel: models.append("Gemini")
            
            # CONSENSUS LOGIC
            if g_sel and gem_sel:
                if g_sel.action == DecisionAction.ACCEPT and gem_sel.action == DecisionAction.ACCEPT:
                    # UNANIMOUS ACCEPT
                    action = DecisionAction.ACCEPT
                    agreement = 1.0
                    reason = f"Unanimous Agreement. Groq: {g_sel.justification.final_verdict} | Gemini: {gem_sel.justification.final_verdict}"
                elif g_sel.action == DecisionAction.REJECT and gem_sel.action == DecisionAction.REJECT:
                    # UNANIMOUS REJECT - useful to know
                    action = DecisionAction.REJECT
                    agreement = 1.0
                    reason = "Unanimous Rejection."
                else:
                    # DISAGREEMENT
                    action = DecisionAction.REJECT
                    agreement = 0.5
                    reason = f"Split Decision (Groq: {g_sel.action}, Gemini: {gem_sel.action}). Defaulting to Reject."
            elif g_sel and g_sel.action == DecisionAction.ACCEPT:
                # Gemini missing or silent, Groq likes it.
                # STRICT SAFETY: Single model is not enough.
                action = DecisionAction.REJECT
                agreement = 0.5
                reason = "Gemini silent/invalid, Groq ACCEPT insufficient for consensus."
            elif gem_sel and gem_sel.action == DecisionAction.ACCEPT:
                action = DecisionAction.REJECT
                agreement = 0.5
                reason = "Groq silent/invalid, Gemini ACCEPT insufficient for consensus."
                
            # Create Result
            results.append(ConsensusResult(
                candidate_id=cid,
                consensus_action=action,
                agreement_score=agreement if 'agreement' in locals() else 0.0,
                participating_models=models,
                final_reasoning=reason
            ))
            
        return results
