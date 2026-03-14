"""
Phase 1: Deterministic Data & Bar Engine
Core configuration and settings management.

Secrets loading priority:
1. PROFILE=prod → Environment variables ONLY (Heroku/production mode)
2. PROFILE=dev (or unset) → Loads from keys.env files, then env vars override
"""

import logging
import os
from typing import Optional, Literal
from pydantic_settings import BaseSettings
from pydantic import Field
from functools import lru_cache

_cfg_log = logging.getLogger("apex.config")


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
    api_port: int = Field(default=8000, description="Backend port — single source of truth (8000)")
    # CORS — comma-separated allowed origins; set via ALLOWED_ORIGINS env var in prod
    allowed_origins: str = Field(
        default="http://localhost:5100,http://localhost:5173,http://localhost:3000",
        description="Comma-separated CORS allowed origins"
    )
    
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
    
    # Polygon
    polygon_api_key: Optional[str] = Field(default=None)
    
    # Market Data Universe — swing/position symbols for 7-year hydration
    market_universe: str = Field(
        default="AAPL,MSFT,GOOGL,AMZN,NVDA,TSLA,META,SPY,QQQ,IWM",
        description="Comma-separated list of symbols for canonical market data pipeline"
    )
    market_history_years: int = Field(default=7, description="Years of daily bar history to maintain")
    
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
    elastic_required: bool = Field(default=False, description="Set True only if ES is available in your env")

    # ElevenLabs TTS
    elevenlabs_api_key: Optional[str] = Field(default=None)
    elevenlabs_voice_id: str = Field(default="21m00Tcm4TlvDq8ikWAM")  # Default "Rachel"
    elevenlabs_model_id: str = Field(default="eleven_monolingual_v1")
    elevenlabs_stability: float = Field(default=0.5)
    elevenlabs_similarity_boost: float = Field(default=0.75)
    
    class Config:
        env_file = "keys.env"
        env_file_encoding = "utf-8"
        extra = "ignore"
    
    def is_production(self) -> bool:
        """Check if running in production mode."""
        return self.profile == "prod"
    
    @property
    def origins_list(self) -> list[str]:
        """Parse allowed CORS origins into list."""
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]

    @property
    def timeframes_list(self) -> list[str]:
        """Parse supported timeframes into list."""
        return [tf.strip() for tf in self.supported_timeframes.split(",")]
    
    @property
    def symbols_list(self) -> list[str]:
        """Parse ingestion symbols into list."""
        return [s.strip() for s in self.ingestion_symbols.split(",")]

    @property
    def universe_list(self) -> list[str]:
        """Parse market universe symbols into list."""
        return [s.strip().upper() for s in self.market_universe.split(",") if s.strip()]


def _load_keys_env_if_dev() -> None:
    """
    Load keys.env files only in dev mode (PROFILE != "prod").
    In production, environment variables must be set externally (Heroku Config Vars).
    """
    if IS_PRODUCTION:
        _cfg_log.info("PROFILE=prod — skipping keys.env file loading (env vars only)")
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
            _cfg_log.info(f"Loading keys from: {os.path.abspath(path)}")
            load_dotenv(path)
            return

    _cfg_log.warning("No keys.env file found — relying on environment variables only")


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance. Logs a full key inventory on first call."""
    _load_keys_env_if_dev()
    settings = Settings()

    # ── Key inventory ────────────────────────────────────────────────────────
    configured: list[str] = []
    missing: list[str] = []

    def _check(label: str, value: Optional[str]) -> None:
        if value:
            configured.append(label)
        else:
            missing.append(label)

    _check("APCA_API_KEY_ID",      settings.apca_api_key_id)
    _check("APCA_API_SECRET_KEY",  settings.apca_api_secret_key)
    _check("FINNHUB_API_KEY",      settings.finnhub_api_key)
    _check("FINNHUB2_API_KEY",     settings.finnhub2_api_key)
    _check("TRADIER_BROKERAGE_KEY", settings.tradier_brokerage_key)
    _check("TRADIER_SANDBOX_KEY",  settings.tradier_sandbox_key)
    _check("POLYGON_API_KEY",      settings.polygon_api_key)
    _check("TIINGO_API_KEY",       settings.tiingo_api_key)
    _check("ELEVENLABS_API_KEY",   settings.elevenlabs_api_key)
    _check("ELASTICSEARCH_API_KEY", settings.elasticsearch_api_key)

    if configured:
        _cfg_log.info(f"API keys configured: {', '.join(configured)}")
    if missing:
        _cfg_log.warning(f"API keys NOT set (features will degrade): {', '.join(missing)}")

    # ── Critical key warnings ────────────────────────────────────────────────
    if not settings.apca_api_key_id:
        _cfg_log.error(
            "APCA_API_KEY_ID is missing — Alpaca broker and live market data are DISABLED. "
            "Set this in keys.env to enable trading."
        )
    if not settings.apca_api_secret_key:
        _cfg_log.error(
            "APCA_API_SECRET_KEY is missing — Alpaca authentication will fail."
        )
    if not settings.finnhub_api_key and not settings.tiingo_api_key:
        _cfg_log.warning(
            "No streaming market data key (FINNHUB_API_KEY / TIINGO_API_KEY) — "
            "falling back to yfinance delayed quotes only."
        )

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
