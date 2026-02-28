from autopilot_brain.brain_types import Action, ActionType
from .contract_id import ContractIdManager

class OrderRouter:
    def __init__(self, algo, dry_run=False):
        self.algo = algo
        self.dry_run = dry_run
        self.id_mgr = ContractIdManager(algo)
        
    def execute(self, actions):
        """Translate Brain Actions to QC Orders."""
        
        for action in actions:
            # Recover QC Symbol from runtime map in SnapshotBuilder or recreate?
            # SnapshotBuilder cleared it. 
            # Better to reconstruct using ID Manager logic or assume mapped.
            # Using SnapshotBuilder.runtime_symbol_map from Main is cleaner, 
            # Or pass symbol map in.
            
            # For now, simplistic symbol recovery via algorithm lookup or id manager
            # But the exact symbol object is needed for trading.
            
            # We will use the snapshot builder's map if stored on Algo, 
            # or try to find it in Algo.Securities.
            
            qc_symbol = self._find_symbol(action.contract_id)
            if not qc_symbol:
                self.algo.Log(f"Router: Could not find symbol for {action.contract_id} - skipping")
                continue
                
            if action.type == ActionType.ENTER:
                if self.dry_run:
                    self.algo.Log(f"[DRY] BUY {action.qty} {action.contract_id} @ {action.limit_intent}")
                else:
                    # Conservative: Limit at Ask (or limit intent)
                    self.algo.MarketOrder(qc_symbol, action.qty) # V1-A: Market for simplicity in scaffold
                    self.algo.Log(f"BUY {action.qty} {action.contract_id}")

            elif action.type == ActionType.EXIT:
                if self.dry_run:
                    self.algo.Log(f"[DRY] SELL {action.qty} {action.contract_id}")
                else:
                    self.algo.MarketOrder(qc_symbol, -action.qty) # Exit
                    self.algo.Log(f"SELL {action.qty} {action.contract_id}")

    def _find_symbol(self, contract_id):
        # Look in Portfolio first
        for kvp in self.algo.Portfolio:
            if self.id_mgr.to_canonical(kvp.Key) == contract_id:
                return kvp.Key
        
        # Look in Securities (universes)
        # Scan all securities?
        for sec in self.algo.Securities.Values:
            # Optimization: check type
            # if sec.Symbol.SecurityType == SecurityType.Option:
             try:
                 if self.id_mgr.to_canonical(sec.Symbol) == contract_id:
                     return sec.Symbol
             except:
                 pass
        return None
