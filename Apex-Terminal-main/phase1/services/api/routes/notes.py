"""
Notes API Routes - Journaling and annotations.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import uuid

router = APIRouter(tags=["Notes"])


class Note(BaseModel):
    id: str
    content: str
    anchor_type: str  # 'bar', 'trade', 'order', 'time'
    anchor_id: Optional[str] = None
    anchor_timestamp: Optional[str] = None
    symbol: Optional[str] = None
    created_at: str
    updated_at: str
    tags: List[str] = []


class NoteCreate(BaseModel):
    content: str
    anchor_type: str
    anchor_id: Optional[str] = None
    anchor_timestamp: Optional[str] = None
    symbol: Optional[str] = None
    tags: List[str] = []


class NoteUpdate(BaseModel):
    content: Optional[str] = None
    tags: Optional[List[str]] = None


# In-memory store (production would use database)
_notes: dict = {}


@router.get("/notes", response_model=List[Note])
async def list_notes(
    symbol: Optional[str] = None,
    anchor_type: Optional[str] = None,
    tag: Optional[str] = None
):
    """List all notes with optional filters."""
    notes = list(_notes.values())
    
    if symbol:
        notes = [n for n in notes if n.get("symbol") == symbol]
    if anchor_type:
        notes = [n for n in notes if n.get("anchor_type") == anchor_type]
    if tag:
        notes = [n for n in notes if tag in n.get("tags", [])]
    
    return sorted(notes, key=lambda x: x.get("created_at", ""), reverse=True)


@router.get("/notes/{note_id}", response_model=Note)
async def get_note(note_id: str):
    """Get a specific note."""
    if note_id not in _notes:
        raise HTTPException(status_code=404, detail="Note not found")
    return _notes[note_id]


@router.post("/notes", response_model=Note)
async def create_note(data: NoteCreate):
    """Create a new note."""
    note_id = str(uuid.uuid4())[:8]
    now = datetime.utcnow().isoformat()
    
    note = {
        "id": note_id,
        "content": data.content,
        "anchor_type": data.anchor_type,
        "anchor_id": data.anchor_id,
        "anchor_timestamp": data.anchor_timestamp,
        "symbol": data.symbol,
        "created_at": now,
        "updated_at": now,
        "tags": data.tags
    }
    
    _notes[note_id] = note
    return note


@router.put("/notes/{note_id}", response_model=Note)
async def update_note(note_id: str, data: NoteUpdate):
    """Update a note."""
    if note_id not in _notes:
        raise HTTPException(status_code=404, detail="Note not found")
    
    note = _notes[note_id]
    if data.content is not None:
        note["content"] = data.content
    if data.tags is not None:
        note["tags"] = data.tags
    note["updated_at"] = datetime.utcnow().isoformat()
    
    return note


@router.delete("/notes/{note_id}")
async def delete_note(note_id: str):
    """Delete a note."""
    if note_id not in _notes:
        raise HTTPException(status_code=404, detail="Note not found")
    
    del _notes[note_id]
    return {"message": "Note deleted"}


@router.get("/notes/export")
async def export_notes(format: str = "json"):
    """Export all notes as JSON."""
    return {
        "exported_at": datetime.utcnow().isoformat(),
        "count": len(_notes),
        "notes": list(_notes.values())
    }
