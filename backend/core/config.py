"""
backend/core/config.py
Canonical Pydantic-settings config for Apex Terminal (Wave 84).
Wraps and extends phase1/services/config.py with additional W84 fields.
Fail-fast: raises ValueError on startup if required fields missing in prod mode.
"""
from __future__ import annotations

import os
from functools import lru_cache
from typing import Optional, Literal

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings


class ApexSettings(BaseSettings):
    """
    Central config for Apex Terminal.
    
    In prod mode (PROFILE=prod): required keys must be set or ValueError is raised.
    In dev mode: optional keys default to None (read-only/paper ops remain available).
    """

    # ── Profile ──────────────────────────────────────────────────────────────
    profile: Literal["dev", "prod"] = Field(default="dev")

    # ── Database ─────────────────────────────────────────────────────────────
    database_url: str = Field(
        default="sqlite+aiosqlite:///./phase1.db",
        description="Database URL. SQLite for dev, Postgres for prod."
    )

    # ── Elasticsearch ────────────────────────────────────────────────────────
    elasticsearch_url: str = Field(
        default="http://localhost:9200",
        description="Elasticsearch cluster URL"
    )
    elasticsearch_user: Optional[str] = Field(default=None)
    elasticsearch_password: Optional[str] = Field(default=None)

    # ── Alpaca (paper) ───────────────────────────────────────────────────────
    apca_api_key_id: Optional[str] = Field(default=None, alias="APCA_API_KEY_ID")
    apca_api_secret_key: Optional[str] = Field(default=None, alias="APCA_API_SECRET_KEY")
    apca_endpoint: str = Field(
        default="https://paper-api.alpaca.markets",
        alias="APCA_ENDPOINT"
    )

    # ── API Server ───────────────────────────────────────────────────────────
    api_host: str = Field(default="0.0.0.0")
    api_port: int = Field(default=8090)

    # ── Logging ──────────────────────────────────────────────────────────────
    log_level: str = Field(default="INFO")
    debug_mode: bool = Field(default=False)

    # ── W84 Startup check config ──────────────────────────────────────────────
    startup_check_timeout_s: float = Field(default=5.0)
    require_elasticsearch: bool = Field(default=False)  # True in prod
    require_broker: bool = Field(default=False)          # True in prod

    model_config = {
        "env_file": ".env",
        "populate_by_name": True,
        "extra": "ignore",
    }

    @model_validator(mode="after")
    def validate_prod_requirements(self) -> "ApexSettings":
        """Fail-fast in prod if required fields are missing."""
        if self.profile == "prod":
            missing = []
            if not self.apca_api_key_id:
                missing.append("APCA_API_KEY_ID")
            if not self.apca_api_secret_key:
                missing.append("APCA_API_SECRET_KEY")
            if "sqlite" in self.database_url.lower():
                missing.append("DATABASE_URL (must be Postgres in prod)")
            if missing:
                raise ValueError(
                    f"PROFILE=prod but required config missing: {', '.join(missing)}"
                )
        return self


@lru_cache(maxsize=1)
def get_apex_settings() -> ApexSettings:
    """Return cached ApexSettings instance. Call once at startup."""
    return ApexSettings()
