"""
Audit System (Phase 1, Layer 4)

Handles persistence of LLM logs and validation events.
Designed to be non-blocking.
"""

import logging
import uuid
from datetime import datetime
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session

from .autopilot_models import LLMLog, AutopilotRun

logger = logging.getLogger(__name__)

class AuditLogger:
    def __init__(self, session_factory):
        self.session_factory = session_factory
    
    def log_llm_interaction(
        self,
        run_id: str,
        provider: str,
        model: str,
        latency_ms: float,
        raw_response: str,
        success: bool,
        error_message: Optional[str] = None,
        context_summary: Optional[str] = None,
        tokens: Dict[str, int] = None
    ) -> str:
        """
        Log an LLM interaction to the DB.
        Returns the log ID.
        """
        log_id = str(uuid.uuid4())
        
        try:
            with self.session_factory() as session:
                log_entry = LLMLog(
                    id=log_id,
                    run_id=run_id,
                    provider=provider,
                    model=model,
                    latency_ms=latency_ms,
                    raw_response=raw_response,
                    success=success,
                    error_message=error_message,
                    context_summary=context_summary,
                    prompt_tokens=tokens.get("prompt_tokens", 0) if tokens else 0,
                    completion_tokens=tokens.get("completion_tokens", 0) if tokens else 0,
                    created_at=datetime.utcnow()
                )
                session.add(log_entry)
                session.commit()
                
        except Exception as e:
            logger.error(f"Failed to write audit log: {e}")
            
        return log_id
