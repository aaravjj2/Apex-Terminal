"""
Drawings API routes for persistence.
"""

from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional
import json
import os

router = APIRouter(prefix="/drawings", tags=["Drawings"])

# Simple file-based storage for drawings (in-memory for now, file backup)
DRAWINGS_FILE = "data/drawings.json"
_drawings: dict = {}  # symbol -> list of drawings


class Point(BaseModel):
    time: int
    price: float


class Drawing(BaseModel):
    id: str
    type: str
    points: List[Point]
    color: str
    text: Optional[str] = None


class DrawingsResponse(BaseModel):
    symbol: str
    drawings: List[Drawing]


def _load_drawings():
    global _drawings
    if os.path.exists(DRAWINGS_FILE):
        try:
            with open(DRAWINGS_FILE, "r") as f:
                _drawings = json.load(f)
        except:
            _drawings = {}


def _save_drawings():
    os.makedirs(os.path.dirname(DRAWINGS_FILE), exist_ok=True)
    with open(DRAWINGS_FILE, "w") as f:
        json.dump(_drawings, f, indent=2)


# Load on startup
_load_drawings()


@router.get("/{symbol}", response_model=DrawingsResponse)
async def get_drawings(symbol: str):
    """Get all drawings for a symbol."""
    symbol = symbol.upper()
    drawings_list = _drawings.get(symbol, [])
    return DrawingsResponse(symbol=symbol, drawings=[Drawing(**d) for d in drawings_list])


@router.post("/{symbol}")
async def save_drawing(symbol: str, drawing: Drawing):
    """Save a drawing for a symbol."""
    symbol = symbol.upper()
    if symbol not in _drawings:
        _drawings[symbol] = []
    
    # Check if drawing already exists (update)
    existing = next((i for i, d in enumerate(_drawings[symbol]) if d.get("id") == drawing.id), None)
    if existing is not None:
        _drawings[symbol][existing] = drawing.model_dump()
    else:
        _drawings[symbol].append(drawing.model_dump())
    
    _save_drawings()
    return {"status": "saved", "id": drawing.id}


@router.delete("/{symbol}/{drawing_id}")
async def delete_drawing(symbol: str, drawing_id: str):
    """Delete a drawing."""
    symbol = symbol.upper()
    if symbol in _drawings:
        _drawings[symbol] = [d for d in _drawings[symbol] if d.get("id") != drawing_id]
        _save_drawings()
    return {"status": "deleted", "id": drawing_id}
