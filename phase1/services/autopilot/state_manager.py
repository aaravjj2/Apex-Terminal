
import json
import logging
import os
from datetime import datetime, date
from typing import Dict, List, Any, Optional
from dataclasses import asdict

from .position_manager import OptionsPosition, PositionManager
from .paper_broker import PaperBroker, PaperOrder, PaperFill, OrderStatus, OrderType
from .candidates import OptionLeg, StrategyTemplate, TradeCandidate

logger = logging.getLogger(__name__)

class StateManager:
    """Manages persistence of autopilot state to JSON files."""
    
    def __init__(self, data_dir: str = "data"):
        self.data_dir = data_dir
        os.makedirs(data_dir, exist_ok=True)
        self.state_file = os.path.join(data_dir, "autopilot_state.json")
        
    def save_state(self, position_manager: PositionManager, broker: PaperBroker):
        """Save current state to disk."""
        try:
            state = {
                "timestamp": datetime.utcnow().isoformat(),
                "positions": [self._position_to_dict(p) for p in position_manager.positions.values()],
                "orders": [self._order_to_dict(o) for o in broker.orders.values()],
                "balance": position_manager.cash,
                "equity": position_manager.equity,
            }
            
            with open(self.state_file, 'w') as f:
                json.dump(state, f, indent=2, default=str)
                
            logger.debug(f"Saved state with {len(state['positions'])} positions")
            
        except Exception as e:
            logger.error(f"Failed to save state: {e}")
            
    def load_state(self, position_manager: PositionManager, broker: PaperBroker) -> bool:
        """Load state from disk into managers."""
        if not os.path.exists(self.state_file):
            logger.info("No saved state found, starting fresh")
            return False
            
        try:
            with open(self.state_file, 'r') as f:
                state = json.load(f)
                
            # Restore positions
            positions = {}
            for p_data in state.get("positions", []):
                try:
                    pos = self._dict_to_position(p_data)
                    positions[pos.symbol] = pos
                except Exception as e:
                    logger.error(f"Error restoring position: {e}")
            position_manager.positions = positions
            
            # Restore orders
            orders = {}
            for o_data in state.get("orders", []):
                try:
                    order = self._dict_to_order(o_data)
                    orders[order.order_id] = order
                except Exception as e:
                    logger.error(f"Error restoring order: {e}")
            broker.orders = orders
            
            logger.info(f"Loaded state: {len(positions)} positions, {len(orders)} orders")
            return True
            
        except Exception as e:
            logger.error(f"Failed to load state: {e}")
            return False

    # --- Serialization Helpers ---
    
    def _position_to_dict(self, pos: OptionsPosition) -> Dict:
        return asdict(pos)

    def _dict_to_position(self, data: Dict) -> OptionsPosition:
        data['template'] = StrategyTemplate(data['template'])
        if isinstance(data.get('entry_time'), str):
            data['entry_time'] = datetime.fromisoformat(data['entry_time'])
        if isinstance(data.get('exit_time'), str):
            data['exit_time'] = datetime.fromisoformat(data['exit_time'])
            
        legs = []
        for l in data.get('legs', []):
            if isinstance(l, dict):
                if isinstance(l.get('expiry'), str):
                     l['expiry'] = date.fromisoformat(l['expiry'])
                legs.append(OptionLeg(**l))
        data['legs'] = legs
        return OptionsPosition(**data)
        
    def _order_to_dict(self, order: PaperOrder) -> Dict:
        return asdict(order)

    def _dict_to_order(self, data: Dict) -> PaperOrder:
        # Enum conversions
        if isinstance(data.get('status'), str):
            data['status'] = OrderStatus(data['status'])
        if isinstance(data.get('order_type'), str):
            data['order_type'] = OrderType(data['order_type'])
            
        # Datettime conversions
        for field in ['created_at', 'updated_at', 'filled_at', 'cancelled_at']:
            if data.get(field):
                data[field] = datetime.fromisoformat(data[field])
                
        # Legs
        legs = []
        for l in data.get('legs', []):
            if isinstance(l, dict):
                if isinstance(l.get('expiry'), str):
                     l['expiry'] = date.fromisoformat(l['expiry'])
                legs.append(OptionLeg(**l))
        data['legs'] = legs
        
        # Fills
        fills = []
        for f in data.get('fills', []):
            if isinstance(f, dict):
                if isinstance(f.get('timestamp'), str):
                    f['timestamp'] = datetime.fromisoformat(f['timestamp'])
                fills.append(PaperFill(**f))
        data['fills'] = fills
        
        return PaperOrder(**data)
        
