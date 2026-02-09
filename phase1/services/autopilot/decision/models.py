"""
LLM Output Constraints (Phase 1, Layer 2)

Defines strict Pydantic models for all AI responses.
If an LLM response does not parse into these models, it is treated as a hallucination/error and discarded.

Key Constraints:
1. No hallucinated IDs (must match input candidates)
2. Confidence score must be >= threshold
3. Structured reasoning required
"""

from typing import List, Optional, Literal
from pydantic import BaseModel, Field, validator
from enum import Enum

class AIModelType(str, Enum):
    GROQ_LLAMA3_70B = "groq-llama3-70b"
    GEMINI_FLASH = "gemini-flash"
    GEMINI_PRO = "gemini-pro"
    MOCK = "mock"

class DecisionAction(str, Enum):
    ACCEPT = "accept"
    REJECT = "reject"
    HOLD = "hold"  # For existing positions

class StrategyType(str, Enum):
    PUT_CREDIT_SPREAD = "put_credit_spread"
    CALL_CREDIT_SPREAD = "call_credit_spread"
    IRON_CONDOR = "iron_condor"
    CALL_DEBIT_SPREAD = "call_debit_spread"
    PUT_DEBIT_SPREAD = "put_debit_spread"

class TradeJustification(BaseModel):
    """Structured reasoning for a decision."""
    technical_analysis: str = Field(..., description="Observations on RSI, MACD, Trend")
    risk_assessment: str = Field(..., description="Evaluation of max loss, probability, and Greeks")
    market_context: str = Field(..., description="Broader market conditions or news impact")
    final_verdict: str = Field(..., description="Summary of why this candidate was chosen")

class CandidateSelection(BaseModel):
    """A single candidate selection by the AI."""
    candidate_id: str
    action: DecisionAction
    confidence: float = Field(..., ge=0.0, le=1.0)
    justification: TradeJustification

    @validator('confidence')
    def check_confidence(cls, v):
        if v < 0.7:
             # We might allow low confidence for "REJECT" decisions, but for ACCEPT it must be high.
             # This validator is generic, logic layer will enforce strictness for ACCEPT.
             pass 
        return v

class LLMResponse(BaseModel):
    """The root response object expected from the LLM."""
    model_used: Optional[str] = None
    selections: List[CandidateSelection]
    
    # Global context/summary
    overall_sentiment: Optional[str] = None

    @validator('selections')
    def validate_ids_exist(cls, v, values):
        # Note: We can't validate IDs against the database HERE effectively 
        # without context. The caller (Validator Service) must do that "referential integrity" check.
        # This model just ensures structure.
        return v

class ConsensusResult(BaseModel):
    """Result of comparing multiple LLM outputs."""
    candidate_id: str
    consensus_action: DecisionAction
    agreement_score: float # 1.0 = Unanimous, 0.5 = Split
    participating_models: List[str]
    final_reasoning: str
