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
        default="postgresql+asyncpg://dashboard_user:newpassword@localhost:5432/financial_dashboard",
        description="Database connection URL (Postgres required)"
    )
    
    # API Server
    api_host: str = Field(default="0.0.0.0")
    api_port: int = Field(default=8090, description="Backend port — env-driven single source of truth")
    
    # Finnhub
    finnhub_api_key: Optional[str] = Field(default=None)
    finnhub2_api_key: Optional[str] = Field(default=None)
    
    # Alpaca — read from APCA_API_KEY_ID / APCA_API_SECRET_KEY (standard env names)
    apca_api_key_id: Optional[str] = Field(default=None)
    apca_api_secret_key: Optional[str] = Field(default=None)
    apca_endpoint: str = Field(default="https://paper-api.alpaca.markets")
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
    
    # Elasticsearch
    elasticsearch_url: str = Field(default="http://localhost:9200")
    elasticsearch_api_key: Optional[str] = Field(default=None)
    elastic_required: bool = Field(default=True, description="Fail-fast if ES not reachable")

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
    settings = Settings()
    
    # Startup validation — warn about missing providers
    warnings = []
    if not settings.apca_api_key_id:
        warnings.append("APCA_API_KEY_ID not set — broker/live data unavailable")
    if not settings.finnhub_api_key and not settings.tiingo_api_key:
        warnings.append("No market data API key (FINNHUB/TIINGO) — yfinance-only mode")
    if not settings.elasticsearch_url:
        warnings.append("ELASTICSEARCH_URL not set — ES features disabled")
    
    for w in warnings:
        print(f"[CONFIG WARNING] {w}")
    
    return settings


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
