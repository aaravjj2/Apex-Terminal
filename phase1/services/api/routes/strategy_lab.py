"""
Strategy Lab API Router
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional

from ...strategy_lab.models import StrategyDefinition, ValidationResult
from ...strategy_lab.validator import validate_strategy
from ...strategy_lab.storage import get_storage

router = APIRouter(prefix="/api/strategy", tags=["Strategy Lab"])


class SaveStrategyResponse(BaseModel):
    """Response from saving a strategy"""
    strategy: StrategyDefinition
    validation: ValidationResult


@router.post("/save", response_model=SaveStrategyResponse)
async def save_strategy(strategy: StrategyDefinition):
    """
    Save a strategy definition.
    Validates before saving.
    """
    # Validate
    validation = validate_strategy(strategy)
    
    if not validation.valid:
        raise HTTPException(status_code=400, detail={
            "message": "Strategy validation failed",
            "errors": [e.dict() for e in validation.errors]
        })
    
    # Save
    storage = get_storage()
    saved_strategy = storage.save(strategy)
    
    return SaveStrategyResponse(
        strategy=saved_strategy,
        validation=validation
    )


@router.get("/list", response_model=List[StrategyDefinition])
async def list_strategies(tags: Optional[str] = None):
    """
    List all strategies.
    Optionally filter by tags (comma-separated).
    """
    storage = get_storage()
    
    tag_list = tags.split(",") if tags else None
    strategies = storage.list(tags=tag_list)
    
    return strategies


@router.get("/{strategy_id}", response_model=StrategyDefinition)
async def get_strategy(strategy_id: str):
    """Get a single strategy by ID"""
    storage = get_storage()
    strategy = storage.get(strategy_id)
    
    if not strategy:
        raise HTTPException(status_code=404, detail=f"Strategy not found: {strategy_id}")
    
    return strategy


@router.delete("/{strategy_id}")
async def delete_strategy(strategy_id: str):
    """Delete a strategy"""
    storage = get_storage()
    deleted = storage.delete(strategy_id)
    
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Strategy not found: {strategy_id}")
    
    return {"success": True, "strategy_id": strategy_id}


@router.post("/validate", response_model=ValidationResult)
async def validate_strategy_endpoint(strategy: StrategyDefinition):
    """
    Validate a strategy definition without saving.
    Returns validation errors and warnings.
    """
    validation = validate_strategy(strategy)
    return validation
