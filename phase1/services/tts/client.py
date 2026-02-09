
import os
import hashlib
import time
import httpx
import structlog
import sqlite3
from typing import Optional, Dict, Any
from pathlib import Path
from ..config import get_settings

logger = structlog.get_logger()

CACHE_DB_PATH = Path("tts_cache.db")

class ElevenLabsTTSClient:
    def __init__(self):
        self.settings = get_settings()
        self.api_key = self.settings.elevenlabs_api_key
        self.base_url = "https://api.elevenlabs.io/v1"
        self._init_cache()

    def _init_cache(self):
        """Initialize SQLite cache for TTS."""
        try:
            with sqlite3.connect(CACHE_DB_PATH) as conn:
                conn.execute("""
                    CREATE TABLE IF NOT EXISTS tts_cache (
                        hash TEXT PRIMARY KEY,
                        voice_id TEXT,
                        model_id TEXT,
                        audio_data BLOB,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """)
        except Exception as e:
            logger.error("tts_cache_init_failed", error=str(e))

    def _get_cache_key(self, text: str, voice_id: str, model_id: str) -> str:
        """Generate a stable hash for the request."""
        payload = f"{text}|{voice_id}|{model_id}"
        return hashlib.sha256(payload.encode()).hexdigest()

    def _get_from_cache(self, cache_key: str) -> Optional[bytes]:
        try:
            with sqlite3.connect(CACHE_DB_PATH) as conn:
                cursor = conn.execute("SELECT audio_data FROM tts_cache WHERE hash = ?", (cache_key,))
                row = cursor.fetchone()
                if row:
                    logger.info("tts_cache_hit", hash=cache_key)
                    return row[0]
        except Exception as e:
            logger.warning("tts_cache_read_error", error=str(e))
        return None

    def _save_to_cache(self, cache_key: str, voice_id: str, model_id: str, data: bytes):
        try:
            with sqlite3.connect(CACHE_DB_PATH) as conn:
                conn.execute(
                    "INSERT OR REPLACE INTO tts_cache (hash, voice_id, model_id, audio_data) VALUES (?, ?, ?, ?)",
                    (cache_key, voice_id, model_id, data)
                )
        except Exception as e:
            logger.warning("tts_cache_write_error", error=str(e))

    async def convert_text_to_speech(
        self, 
        text: str, 
        voice_id: Optional[str] = None, 
        model_id: Optional[str] = None
    ) -> Optional[bytes]:
        """
        Convert text to speech using ElevenLabs API with caching.
        Returns bytes or None on failure.
        """
        if not self.api_key:
            logger.warning("tts_disabled_no_key")
            return None

        # Defaults
        voice_id = voice_id or self.settings.elevenlabs_voice_id
        model_id = model_id or self.settings.elevenlabs_model_id
        
        # Safety: Cap text length
        MAX_CHARS = 1000
        if len(text) > MAX_CHARS:
            text = text[:MAX_CHARS] + "..."
            logger.info("tts_text_truncated", length=len(text))

        # Check Cache
        cache_key = self._get_cache_key(text, voice_id, model_id)
        cached_audio = self._get_from_cache(cache_key)
        if cached_audio:
            return cached_audio

        # Call API
        url = f"{self.base_url}/text-to-speech/{voice_id}"
        headers = {
            "Accept": "audio/mpeg",
            "xi-api-key": self.api_key,
            "Content-Type": "application/json"
        }
        data = {
            "text": text,
            "model_id": model_id,
            "voice_settings": {
                "stability": self.settings.elevenlabs_stability,
                "similarity_boost": self.settings.elevenlabs_similarity_boost
            }
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(url, json=data, headers=headers)
                
                if response.status_code == 200:
                    audio_data = response.content
                    self._save_to_cache(cache_key, voice_id, model_id, audio_data)
                    logger.info("tts_generation_success", size=len(audio_data))
                    return audio_data
                else:
                    logger.error("tts_api_error", status=response.status_code, response=response.text[:200])
                    return None
        except Exception as e:
            logger.error("tts_request_failed", error=str(e))
            return None

    def get_status(self) -> Dict[str, Any]:
        return {
            "enabled": bool(self.api_key),
            "voice_id": self.settings.elevenlabs_voice_id,
            "model_id": self.settings.elevenlabs_model_id
        }

# Singleton
_client: Optional[ElevenLabsTTSClient] = None

def get_tts_client() -> ElevenLabsTTSClient:
    global _client
    if _client is None:
        _client = ElevenLabsTTSClient()
    return _client
