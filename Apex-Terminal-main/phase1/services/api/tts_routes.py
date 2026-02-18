
from fastapi import APIRouter, HTTPException, Depends, Body
from fastapi.responses import Response, JSONResponse
import structlog
from typing import Optional
from pydantic import BaseModel

from ..tts.client import get_tts_client, ElevenLabsTTSClient

router = APIRouter()
logger = structlog.get_logger()

class SpeakRequest(BaseModel):
    text: str
    voice_id: Optional[str] = None
    model_id: Optional[str] = None

@router.get("/status")
async def get_tts_status():
    """Get the status of the TTS service."""
    client = get_tts_client()
    return client.get_status()

@router.post("/speak")
async def speak_text(request: SpeakRequest):
    """
    Convert text to speech.
    Returns audio/mpeg bytes.
    """
    client = get_tts_client()
    
    # Fail fast if disabled
    if not client.api_key:
        raise HTTPException(
            status_code=503, 
            detail="TTS service is disabled. Configure ELEVENLABS_API_KEY."
        )

    if not request.text or not request.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")

    logger.info("tts_request_received", text_preview=request.text[:50])

    try:
        audio_bytes = await client.convert_text_to_speech(
            text=request.text, 
            voice_id=request.voice_id, 
            model_id=request.model_id
        )

        if not audio_bytes:
            raise HTTPException(status_code=502, detail="Failed to generate audio from upstream provider.")
        
        return Response(content=audio_bytes, media_type="audio/mpeg")

    except HTTPException:
        raise
    except Exception as e:
        logger.error("tts_route_error", error=str(e))
        raise HTTPException(status_code=500, detail="Internal TTS processing error")
