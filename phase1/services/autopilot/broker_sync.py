"""
Broker Sync Service

Responsible for:
1.  Synchronizing Alpaca account, positions, and orders (Source of Truth).
2.  Reconciling internal order intents with actual Alpaca orders.
3.  Providing a normalized "Portfolio Snapshot" for the UI.
"""

import asyncio
import logging
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field
from datetime import datetime

from .alpaca_client import get_alpaca_client, AlpacaPosition, AlpacaOrder, AlpacaAccount
from .broker_position_manager import get_broker_position_manager, EnrichedBrokerPosition
from .unified_engine import get_unified_engine, RunArtifact

logger = logging.getLogger(__name__)


@dataclass
class OrderReconciliation:
    """Reconciliation of an internal order intent with an actual broker order."""
    client_order_id: str
    symbol: str
    side: str
    qty: int
    intent_status: str  # internal status
    broker_status: str  # alpaca status
    matched: bool
    broker_order_id: Optional[str] = None
    filled_qty: int = 0
    filled_price: float = 0.0
    timestamp: Optional[str] = None


@dataclass
class PortfolioSnapshot:
    """Normalized snapshot for the UI."""
    timestamp: str
    account: Dict[str, Any]
    positions: List[Dict[str, Any]]
    orders: List[Dict[str, Any]]  # Reconciled orders
    verification: Dict[str, Any]  # Sync health stats


class BrokerSyncService:
    """
    Singleton service to sync broker state and reconcile with internal state.
    """
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(BrokerSyncService, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        self.alpaca = get_alpaca_client()
        self.pos_manager = get_broker_position_manager()
        self.engine = get_unified_engine()
        self.last_snapshot: Optional[PortfolioSnapshot] = None
        self._initialized = True

    async def sync(self) -> PortfolioSnapshot:
        """
        Perform a full sync with Alpaca and generate a clean snapshot.
        """
        try:
            # Ensure client is connected
            if not self.alpaca.is_connected:
                self.alpaca._init_client()

            # 1. Fetch Broker Data
            account = await self.alpaca.get_account()
            positions = await self.alpaca.list_positions()
            # Fetch closed orders too for history
            orders_open = await self.alpaca.list_orders(status="open", limit=50)
            orders_closed = await self.alpaca.list_orders(status="closed", limit=50)
            all_broker_orders = orders_open + orders_closed

            # 2. Reconcile Positions (Enrich with metadata)
            enriched_positions = self.pos_manager.enrich_positions(positions)

            # 3. Reconcile Orders
            reconciled_orders = self._reconcile_orders(all_broker_orders)

            # 4. Construct Snapshot
            snapshot = PortfolioSnapshot(
                timestamp=datetime.utcnow().isoformat(),
                account=account.to_dict() if account else {},
                positions=[p.to_dict() for p in enriched_positions],
                orders=[o.__dict__ for o in reconciled_orders], # Simple dict conversion
                verification={
                    "positions_count": len(positions),
                    "orders_tracked": len(reconciled_orders),
                    "connected": self.alpaca.is_connected,
                }
            )

            self.last_snapshot = snapshot
            return snapshot

        except Exception as e:
            logger.error(f"Broker sync failed: {e}", exc_info=True)
            # Return empty/error snapshot if failed
            return PortfolioSnapshot(
                timestamp=datetime.utcnow().isoformat(),
                account={},
                positions=[],
                orders=[],
                verification={"error": str(e), "connected": False}
            )

    def _reconcile_orders(self, broker_orders: List[AlpacaOrder]) -> List[OrderReconciliation]:
        """
        Match internal order intents (from recent runs) with broker orders.
        """
        reconciled: List[OrderReconciliation] = []
        
        # Map broker orders by client_order_id for fast lookup
        broker_map = {o.client_order_id: o for o in broker_orders}
        
        # Get recent run artifacts to find intents
        # Note: In a real DB system we'd query orders table. 
        # Here we scan the in-memory run history of the engine.
        intents = []
        if self.engine.run_history:
            for artifact in self.engine.run_history[-20:]: # Last 20 runs
                if artifact.orders_placed:
                    intents.extend(artifact.orders_placed)

        # 1. Process Internal Intents
        processed_ids = set()
        
        for intent in intents:
            if not intent.client_order_id:
                continue
                
            broker_order = broker_map.get(intent.client_order_id)
            matched = broker_order is not None
            
            rec = OrderReconciliation(
                client_order_id=intent.client_order_id,
                symbol=intent.symbol,
                side=intent.side,
                qty=intent.qty,
                intent_status=intent.status,
                broker_status=broker_order.status if broker_order else "unknown",
                matched=matched,
                broker_order_id=broker_order.id if broker_order else None,
                filled_qty=int(broker_order.filled_qty) if broker_order else 0,
                filled_price=float(broker_order.filled_avg_price or 0) if broker_order else 0.0,
                timestamp=intent.submitted_at.isoformat() if intent.submitted_at else None
            )
            reconciled.append(rec)
            processed_ids.add(intent.client_order_id)

        # 2. Process Unmatched Broker Orders (Manual/Legacy orders)
        for order in broker_orders:
            if order.client_order_id not in processed_ids:
                rec = OrderReconciliation(
                    client_order_id=order.client_order_id,
                    symbol=order.symbol,
                    side=order.side,
                    qty=order.qty,
                    intent_status="manual", # Generated outside known bot runs
                    broker_status=order.status,
                    matched=False,
                    broker_order_id=order.id,
                    filled_qty=order.filled_qty,
                    filled_price=order.filled_avg_price or 0.0,
                    timestamp=order.created_at.isoformat() if order.created_at else None
                )
                reconciled.append(rec)

        # Sort by timestamp descending
        reconciled.sort(key=lambda x: x.timestamp or "", reverse=True)
        return reconciled


# Global Accessor
_broker_sync: Optional[BrokerSyncService] = None

def get_broker_sync() -> BrokerSyncService:
    global _broker_sync
    if _broker_sync is None:
        _broker_sync = BrokerSyncService()
    return _broker_sync
