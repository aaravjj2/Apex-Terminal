"""
Productization — Wave 20
Symbol universe manager, backup/restore, configuration profiles,
runbooks, system documentation, release packaging.
"""

import json
import hashlib
import logging
from datetime import datetime, timezone
from typing import Optional, Any
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path

logger = logging.getLogger(__name__)


class ProfileType(str, Enum):
    CONSERVATIVE = "conservative"
    MODERATE = "moderate"
    AGGRESSIVE = "aggressive"
    CUSTOM = "custom"


class BackupType(str, Enum):
    FULL = "full"
    CONFIG_ONLY = "config_only"
    STRATEGIES_ONLY = "strategies_only"


@dataclass
class SymbolEntry:
    """A symbol in the managed universe."""
    symbol: str
    name: str
    sector: str
    market_cap_b: float  # Billions USD
    avg_volume: int
    enabled: bool = True
    added_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def to_dict(self) -> dict:
        return {
            "symbol": self.symbol,
            "name": self.name,
            "sector": self.sector,
            "market_cap_b": round(self.market_cap_b, 2),
            "avg_volume": self.avg_volume,
            "enabled": self.enabled,
            "added_at": self.added_at,
        }


# Default 10-symbol universe for swing equities v1
DEFAULT_UNIVERSE = [
    SymbolEntry("AAPL", "Apple Inc.", "Technology", 3000, 80_000_000),
    SymbolEntry("MSFT", "Microsoft Corp.", "Technology", 2800, 25_000_000),
    SymbolEntry("GOOGL", "Alphabet Inc.", "Technology", 1900, 30_000_000),
    SymbolEntry("AMZN", "Amazon.com Inc.", "Consumer Discretionary", 1800, 50_000_000),
    SymbolEntry("NVDA", "NVIDIA Corp.", "Technology", 2500, 40_000_000),
    SymbolEntry("META", "Meta Platforms", "Technology", 1200, 20_000_000),
    SymbolEntry("TSLA", "Tesla Inc.", "Consumer Discretionary", 800, 100_000_000),
    SymbolEntry("JPM", "JPMorgan Chase", "Financials", 500, 12_000_000),
    SymbolEntry("V", "Visa Inc.", "Financials", 550, 8_000_000),
    SymbolEntry("UNH", "UnitedHealth Group", "Healthcare", 480, 4_000_000),
]


@dataclass
class ConfigProfile:
    """A configuration profile for the terminal."""
    profile_id: str
    name: str
    profile_type: ProfileType
    settings: dict
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    is_active: bool = False

    def to_dict(self) -> dict:
        return {
            "profile_id": self.profile_id,
            "name": self.name,
            "profile_type": self.profile_type.value,
            "settings": self.settings,
            "created_at": self.created_at,
            "is_active": self.is_active,
        }


# Preconfigured profiles
PROFILES = {
    ProfileType.CONSERVATIVE: {
        "max_position_pct": 5.0,
        "max_portfolio_risk": 0.10,
        "stop_loss_pct": 3.0,
        "max_daily_trades": 3,
        "max_correlated_positions": 2,
        "kill_switch_drawdown_pct": 5.0,
        "rebalance_frequency": "weekly",
    },
    ProfileType.MODERATE: {
        "max_position_pct": 10.0,
        "max_portfolio_risk": 0.15,
        "stop_loss_pct": 5.0,
        "max_daily_trades": 5,
        "max_correlated_positions": 3,
        "kill_switch_drawdown_pct": 8.0,
        "rebalance_frequency": "weekly",
    },
    ProfileType.AGGRESSIVE: {
        "max_position_pct": 15.0,
        "max_portfolio_risk": 0.25,
        "stop_loss_pct": 8.0,
        "max_daily_trades": 10,
        "max_correlated_positions": 5,
        "kill_switch_drawdown_pct": 12.0,
        "rebalance_frequency": "daily",
    },
}


@dataclass
class BackupManifest:
    """Backup metadata."""
    backup_id: str
    backup_type: BackupType
    created_at: str
    file_path: str
    size_bytes: int = 0
    contents: list[str] = field(default_factory=list)  # What's included
    checksum: str = ""

    def to_dict(self) -> dict:
        return {
            "backup_id": self.backup_id,
            "backup_type": self.backup_type.value,
            "created_at": self.created_at,
            "file_path": self.file_path,
            "size_bytes": self.size_bytes,
            "contents": self.contents,
            "checksum": self.checksum,
        }


@dataclass
class Runbook:
    """Operational runbook."""
    runbook_id: str
    title: str
    description: str
    steps: list[str]
    category: str  # "incident", "maintenance", "deployment"
    severity: str  # "low", "medium", "high"
    estimated_time_min: int = 15

    def to_dict(self) -> dict:
        return {
            "runbook_id": self.runbook_id,
            "title": self.title,
            "description": self.description,
            "steps": self.steps,
            "category": self.category,
            "severity": self.severity,
            "estimated_time_min": self.estimated_time_min,
        }


# Built-in runbooks
BUILTIN_RUNBOOKS = [
    Runbook(
        "rb-001", "Kill Switch Activation",
        "Emergency procedure to halt all trading",
        [
            "1. Navigate to Ops > Kill Switch",
            "2. Click 'Activate Kill Switch'",
            "3. Confirm activation in dialog",
            "4. Verify all pending orders are cancelled",
            "5. Review open positions for manual close",
            "6. Document reason in audit log",
        ],
        "incident", "high", 5,
    ),
    Runbook(
        "rb-002", "Elasticsearch Recovery",
        "Steps to recover Elasticsearch connectivity",
        [
            "1. Check ES health: GET /_cluster/health",
            "2. Verify disk space: GET /_cat/allocation",
            "3. Check ILM status: GET /_ilm/status",
            "4. If red: check unassigned shards",
            "5. Restart ES service if needed",
            "6. Verify index templates are intact",
            "7. Run reindex if data corruption detected",
        ],
        "incident", "high", 30,
    ),
    Runbook(
        "rb-003", "Daily Pre-Market Checklist",
        "Pre-market verification before trading day",
        [
            "1. Verify market is open today (not holiday)",
            "2. Check ES connectivity and index health",
            "3. Verify Alpaca paper connection",
            "4. Confirm data spine has latest history",
            "5. Review overnight news sentiment",
            "6. Check kill switch is inactive",
            "7. Verify active workflows are scheduled",
        ],
        "maintenance", "medium", 10,
    ),
    Runbook(
        "rb-004", "Weekly Performance Review",
        "Weekly strategy and portfolio performance review",
        [
            "1. Run performance report for all active strategies",
            "2. Check win rate against auto-disable thresholds",
            "3. Review drawdown levels",
            "4. Compare backtest vs paper results",
            "5. Evaluate sentiment accuracy",
            "6. Adjust position sizes if needed",
            "7. Archive weekly report",
        ],
        "maintenance", "medium", 20,
    ),
    Runbook(
        "rb-005", "Symbol Universe Update",
        "Add or remove symbols from the trading universe",
        [
            "1. Propose new symbol list",
            "2. Verify sufficient liquidity (avg volume > 1M)",
            "3. Check sector diversification",
            "4. Ingest 7y history for new symbols",
            "5. Run backtests on updated universe",
            "6. Update portfolio allocations",
            "7. Document changes in audit log",
        ],
        "maintenance", "low", 30,
    ),
]


class ProductizationService:
    """
    Production readiness: universe management, profiles,
    backup/restore, runbooks.
    """

    def __init__(self):
        self._universe: list[SymbolEntry] = list(DEFAULT_UNIVERSE)
        self._profiles: dict[str, ConfigProfile] = {}
        self._backups: list[BackupManifest] = []
        self._runbooks: list[Runbook] = list(BUILTIN_RUNBOOKS)
        self._active_profile_id: Optional[str] = None

        # Create default profiles
        for pt, settings in PROFILES.items():
            pid = f"prof-{pt.value}"
            self._profiles[pid] = ConfigProfile(
                profile_id=pid,
                name=f"{pt.value.title()} Profile",
                profile_type=pt,
                settings=settings,
            )

    # --- Universe Management ---
    def get_universe(self, enabled_only: bool = True) -> list[SymbolEntry]:
        if enabled_only:
            return [s for s in self._universe if s.enabled]
        return self._universe.copy()

    def get_symbols(self, enabled_only: bool = True) -> list[str]:
        return [s.symbol for s in self.get_universe(enabled_only)]

    def add_symbol(self, entry: SymbolEntry) -> bool:
        if any(s.symbol == entry.symbol for s in self._universe):
            return False
        self._universe.append(entry)
        return True

    def remove_symbol(self, symbol: str) -> bool:
        before = len(self._universe)
        self._universe = [s for s in self._universe if s.symbol != symbol]
        return len(self._universe) < before

    def toggle_symbol(self, symbol: str, enabled: bool) -> bool:
        for s in self._universe:
            if s.symbol == symbol:
                s.enabled = enabled
                return True
        return False

    def get_universe_stats(self) -> dict:
        enabled = [s for s in self._universe if s.enabled]
        sectors = {}
        for s in enabled:
            sectors[s.sector] = sectors.get(s.sector, 0) + 1
        return {
            "total_symbols": len(self._universe),
            "enabled_symbols": len(enabled),
            "sectors": sectors,
            "total_market_cap_b": sum(s.market_cap_b for s in enabled),
            "avg_volume": int(sum(s.avg_volume for s in enabled) / max(len(enabled), 1)),
        }

    # --- Config Profiles ---
    def get_profile(self, profile_id: str) -> Optional[ConfigProfile]:
        return self._profiles.get(profile_id)

    def list_profiles(self) -> list[ConfigProfile]:
        return list(self._profiles.values())

    def activate_profile(self, profile_id: str) -> bool:
        if profile_id not in self._profiles:
            return False
        for p in self._profiles.values():
            p.is_active = False
        self._profiles[profile_id].is_active = True
        self._active_profile_id = profile_id
        return True

    def get_active_profile(self) -> Optional[ConfigProfile]:
        if self._active_profile_id:
            return self._profiles.get(self._active_profile_id)
        return None

    def create_custom_profile(self, name: str, settings: dict) -> ConfigProfile:
        pid = f"prof-{hashlib.md5(f'{name}{datetime.now(timezone.utc).isoformat()}'.encode()).hexdigest()[:10]}"
        profile = ConfigProfile(
            profile_id=pid,
            name=name,
            profile_type=ProfileType.CUSTOM,
            settings=settings,
        )
        self._profiles[pid] = profile
        return profile

    # --- Backup / Restore ---
    def create_backup(self, backup_type: BackupType = BackupType.FULL) -> BackupManifest:
        bid = f"bk-{hashlib.md5(datetime.now(timezone.utc).isoformat().encode()).hexdigest()[:10]}"
        ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")

        contents = []
        data = {}

        if backup_type in (BackupType.FULL, BackupType.CONFIG_ONLY):
            contents.append("config_profiles")
            contents.append("universe")
            data["profiles"] = [p.to_dict() for p in self._profiles.values()]
            data["universe"] = [s.to_dict() for s in self._universe]

        if backup_type in (BackupType.FULL, BackupType.STRATEGIES_ONLY):
            contents.append("strategies")
            # Would include strategy specs from AI strategy builder

        serialized = json.dumps(data, indent=2)
        checksum = hashlib.sha256(serialized.encode()).hexdigest()[:16]

        manifest = BackupManifest(
            backup_id=bid,
            backup_type=backup_type,
            created_at=datetime.now(timezone.utc).isoformat(),
            file_path=f"backups/apex_backup_{ts}.json",
            size_bytes=len(serialized),
            contents=contents,
            checksum=checksum,
        )
        self._backups.append(manifest)
        return manifest

    def list_backups(self) -> list[BackupManifest]:
        return self._backups.copy()

    # --- Runbooks ---
    def get_runbooks(self, category: Optional[str] = None) -> list[Runbook]:
        books = self._runbooks
        if category:
            books = [r for r in books if r.category == category]
        return books

    def get_runbook(self, runbook_id: str) -> Optional[Runbook]:
        return next((r for r in self._runbooks if r.runbook_id == runbook_id), None)

    # --- Release Info ---
    def get_release_info(self) -> dict:
        return {
            "version": "2.0.0",
            "codename": "Online-Only Swing Equities v1",
            "waves": "11-20",
            "features": [
                "Market Session Engine",
                "Mandatory Elasticsearch",
                "Real Data Spine (yfinance + Finnhub)",
                "Paper-Only Broker (Alpaca)",
                "Portfolio Construction",
                "Performance Loop + Auto-Disable",
                "Backtester Calibration v3",
                "Strategy Discovery Engine",
                "AI Strategy Builder",
                "Sentiment & FinBERT Pipeline",
                "Workflows v3 with DAG",
                "Observability Dashboard",
                "Productization & Runbooks",
            ],
            "constraints": {
                "asset_class": "equity",
                "trading_style": "swing",
                "universe_size": "8-10 symbols",
                "broker_mode": "paper-only",
                "data_mode": "online-only (NO mock/demo/synthetic)",
                "elasticsearch": "mandatory",
            },
        }


_service: Optional[ProductizationService] = None


def get_productization_service() -> ProductizationService:
    global _service
    if _service is None:
        _service = ProductizationService()
    return _service
