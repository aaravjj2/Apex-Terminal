"""
Phase 1: Deterministic Data & Bar Engine
Core configuration and settings management.

Secrets loading priority:
1. PROFILE=prod → Environment variables ONLY (Heroku/production mode)
2. PROFILE=dev (or unset) → Loads from keys.env files, then env vars override
"""

import os
from typing import Optional, Literal
from pydantic_settings import BaseSettings
from pydantic import Field
from functools import lru_cache


# Check profile BEFORE any other imports to control secrets loading behavior
PROFILE = os.environ.get("PROFILE", "dev")
IS_PRODUCTION = PROFILE == "prod"


class Settings(BaseSettings):
    """Application settings loaded from environment."""
    
    # Profile
    profile: Literal["dev", "prod"] = Field(default="dev", description="Runtime profile (dev or prod)")
    
    # Database
    database_url: str = Field(
        default="sqlite+aiosqlite:///./phase1.db",
        description="Database connection URL"
    )
    
    # API Server
    api_host: str = Field(default="0.0.0.0")
    api_port: int = Field(default=7500)
    
    # Finnhub
    finnhub_api_key: Optional[str] = Field(default=None)
    finnhub2_api_key: Optional[str] = Field(default=None)
    
    # Alpaca
    apca_api_key_id: Optional[str] = Field(default=None, validation_alias="ALPACA3_KEY") 
    apca_api_secret_key: Optional[str] = Field(default=None, validation_alias="ALPACA3_SECRET")
    apca_endpoint: str = Field(default="https://paper-api.alpaca.markets", validation_alias="ALPACA3_ENDPOINT")
    # Enable using Alpaca for options chain data (experimental)
    enable_alpaca_options: bool = Field(default=False)
    
    # Tiingo (for yfinance fallback)
    tiingo_api_key: Optional[str] = Field(default=None)
    
    # Tradier (options data and streaming)
    tradier_brokerage_key: Optional[str] = Field(default=None)
    tradier_sandbox_key: Optional[str] = Field(default=None)
    tradier_stream_enabled: bool = Field(default=True)
    options_data_provider: str = Field(default="tradier")
    options_stream_provider: str = Field(default="tradier")
    
    # Ingestion
    ingestion_mode: Literal["mock", "live"] = Field(default="live")
    ingestion_symbols: str = Field(default="AAPL,MSFT")
    
    # Bar Engine
    bar_cache_size: int = Field(default=10000, description="LRU cache size for recent bars")
    supported_timeframes: str = Field(default="1m,5m,15m,1h,1d")
    
    # Session Calendar
    enable_extended_hours: bool = Field(default=False)
    default_timezone: str = Field(default="America/New_York")
    
    # Logging
    log_level: str = Field(default="INFO")
    log_format: Literal["json", "text"] = Field(default="json")
    debug_mode: bool = Field(default=False)

    # ElevenLabs TTS
    elevenlabs_api_key: Optional[str] = Field(default=None)
    elevenlabs_voice_id: str = Field(default="21m00Tcm4TlvDq8ikWAM")  # Default "Rachel"
    elevenlabs_model_id: str = Field(default="eleven_monolingual_v1")
    elevenlabs_stability: float = Field(default=0.5)
    elevenlabs_similarity_boost: float = Field(default=0.75)
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"
    
    def is_production(self) -> bool:
        """Check if running in production mode."""
        return self.profile == "prod"
    
    @property
    def timeframes_list(self) -> list[str]:
        """Parse supported timeframes into list."""
        return [tf.strip() for tf in self.supported_timeframes.split(",")]
    
    @property
    def symbols_list(self) -> list[str]:
        """Parse ingestion symbols into list."""
        return [s.strip() for s in self.ingestion_symbols.split(",")]


def _load_keys_env_if_dev() -> None:
    """
    Load keys.env files only in dev mode (PROFILE != "prod").
    In production, environment variables must be set externally (Heroku Config Vars).
    """
    if IS_PRODUCTION:
        print("[CONFIG] PROFILE=prod — skipping keys.env file loading (env vars only)")
        return
    
    current_dir = os.path.dirname(os.path.abspath(__file__))
    potential_paths = [
        os.path.join(current_dir, "..", "keys.env"),        # phase1/keys.env
        os.path.join(current_dir, "..", "..", "keys.env"),  # root/keys.env
        os.path.join(current_dir, "keys.env"),              # services/keys.env
    ]
    
    for path in potential_paths:
        if os.path.exists(path):
            from dotenv import load_dotenv
            print(f"[CONFIG] Loading keys from: {path}")
            load_dotenv(path)
            return
    
    print("[CONFIG] No keys.env file found (env vars may still be used)")


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    _load_keys_env_if_dev()
    return Settings()


# Timeframe definitions in milliseconds
TIMEFRAME_MS = {
    "1m": 60 * 1000,
    "5m": 5 * 60 * 1000,
    "15m": 15 * 60 * 1000,
    "1h": 60 * 60 * 1000,
    "1d": 24 * 60 * 60 * 1000,
}

# Timeframe hierarchy for aggregation
TIMEFRAME_HIERARCHY = ["1m", "5m", "15m", "1h", "1d"]


def timeframe_to_ms(timeframe: str) -> int:
    """Convert timeframe string to milliseconds."""
    if timeframe not in TIMEFRAME_MS:
        raise ValueError(f"Unsupported timeframe: {timeframe}")
    return TIMEFRAME_MS[timeframe]
