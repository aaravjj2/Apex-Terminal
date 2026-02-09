"""
Ranker Training Infrastructure (Milestone 4)

Provides infrastructure for training a tabular ranker from logged trade data.
- Logging schema for training data
- Feature extraction
- Training dataset builder
- Simple gradient boosting ranker
"""

import logging
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any
from datetime import datetime
import json

logger = logging.getLogger(__name__)

@dataclass
class TradeLogEntry:
    """
    Complete log entry for a single trade.
    This is the dataset that enables training later.
    """
    # Identifiers
    trade_id: str
    timestamp: datetime
    symbol: str
    
    # Context at decision time
    regime: str
    sentiment_score: float
    shock_flag: bool
    regime_confidence: float = 0.0
    
    # Candidate info
    template_type: str = ""
    direction: str = ""
    entry_score: float = 0.0
    liquidity_score: float = 0.0
    volatility_score: float = 0.0
    
    # Trade details
    entry_price: float = 0.0
    exit_price: float = 0.0
    max_loss: float = 0.0
    
    # Outcomes (filled after close)
    pnl: float = 0.0
    pnl_pct: float = 0.0
    mae: float = 0.0  # Max adverse excursion
    mfe: float = 0.0  # Max favorable excursion
    holding_minutes: float = 0.0
    exit_reason: str = ""
    
    # Meta
    was_token_trade: bool = False
    llm_advised: bool = False
    llm_selected_index: int = -1
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "trade_id": self.trade_id,
            "timestamp": self.timestamp.isoformat(),
            "symbol": self.symbol,
            "regime": self.regime,
            "sentiment_score": self.sentiment_score,
            "shock_flag": self.shock_flag,
            "template_type": self.template_type,
            "direction": self.direction,
            "entry_score": self.entry_score,
            "pnl": self.pnl,
            "pnl_pct": self.pnl_pct,
            "mae": self.mae,
            "mfe": self.mfe,
            "holding_minutes": self.holding_minutes,
            "exit_reason": self.exit_reason,
        }
    
    def to_feature_vector(self) -> Dict[str, float]:
        """Extract features for training."""
        return {
            "sentiment_score": self.sentiment_score,
            "shock_flag": 1.0 if self.shock_flag else 0.0,
            "regime_confidence": self.regime_confidence,
            "entry_score": self.entry_score,
            "liquidity_score": self.liquidity_score,
            "volatility_score": self.volatility_score,
            "max_loss": self.max_loss,
            "is_debit": 1.0 if self.template_type == "debit_spread" else 0.0,
            "is_bullish": 1.0 if self.direction == "bullish" else 0.0,
        }

class TradeLogger:
    """
    Logs all trade data for future training.
    
    Stores in JSON Lines format for easy streaming.
    """
    
    def __init__(self, log_path: str = "trade_log.jsonl"):
        self.log_path = log_path
        self._entries: List[TradeLogEntry] = []
    
    def log(self, entry: TradeLogEntry):
        """Log a trade entry."""
        self._entries.append(entry)
        
        # Append to file
        with open(self.log_path, "a") as f:
            f.write(json.dumps(entry.to_dict()) + "\n")
        
        logger.debug(f"Logged trade: {entry.trade_id}")
    
    def get_entries(self) -> List[TradeLogEntry]:
        """Get all logged entries."""
        return self._entries
    
    def load_from_file(self) -> List[Dict[str, Any]]:
        """Load entries from file."""
        entries = []
        try:
            with open(self.log_path, "r") as f:
                for line in f:
                    if line.strip():
                        entries.append(json.loads(line))
        except FileNotFoundError:
            pass
        return entries

class TrainingDatasetBuilder:
    """
    Builds training datasets from logged trades.
    """
    
    def __init__(self, min_trades: int = 100):
        self.min_trades = min_trades
    
    def build_entry_score_dataset(
        self,
        entries: List[TradeLogEntry],
    ) -> Dict[str, Any]:
        """
        Build dataset for entry score prediction.
        
        Target: Was the trade profitable? (binary classification)
        Or: Normalized PnL (regression)
        """
        X = []
        y_binary = []
        y_regression = []
        
        for entry in entries:
            if entry.pnl == 0:
                continue  # Skip incomplete
            
            features = entry.to_feature_vector()
            X.append(features)
            
            y_binary.append(1 if entry.pnl > 0 else 0)
            y_regression.append(entry.pnl_pct)
        
        return {
            "X": X,
            "y_binary": y_binary,
            "y_regression": y_regression,
            "num_samples": len(X),
            "feature_names": list(X[0].keys()) if X else [],
        }
    
    def build_exit_urgency_dataset(
        self,
        entries: List[TradeLogEntry],
    ) -> Dict[str, Any]:
        """
        Build dataset for exit urgency prediction.
        
        Target: Should we exit early? Based on MAE vs MFE ratio.
        """
        X = []
        y = []
        
        for entry in entries:
            if entry.holding_minutes == 0:
                continue
            
            features = entry.to_feature_vector()
            
            # Add outcome features (at decision time, these would be current values)
            features["current_pnl_pct"] = entry.pnl_pct * 0.5  # Simulate mid-trade
            
            X.append(features)
            
            # Urgency: high MAE relative to MFE = should have exited earlier
            if entry.mfe > 0:
                urgency = entry.mae / entry.mfe
            else:
                urgency = 0.5
            
            y.append(min(1.0, urgency))
        
        return {
            "X": X,
            "y": y,
            "num_samples": len(X),
            "feature_names": list(X[0].keys()) if X else [],
        }

class SimpleRanker:
    """
    Simple gradient boosting ranker for candidate scoring.
    
    Uses scikit-learn if available, otherwise falls back to
    weighted sum based on feature importance.
    """
    
    def __init__(self):
        self._model = None
        self._feature_names: List[str] = []
        self._weights: Dict[str, float] = {}
    
    def train(
        self,
        X: List[Dict[str, float]],
        y: List[float],
        feature_names: List[str],
    ) -> Dict[str, Any]:
        """
        Train the ranker.
        
        Returns training metrics.
        """
        self._feature_names = feature_names
        
        try:
            from sklearn.ensemble import GradientBoostingClassifier
            from sklearn.model_selection import train_test_split
            from sklearn.metrics import accuracy_score, roc_auc_score
            
            # Convert to arrays
            X_arr = [[x[f] for f in feature_names] for x in X]
            y_arr = y
            
            # Split
            X_train, X_test, y_train, y_test = train_test_split(
                X_arr, y_arr, test_size=0.2, random_state=42
            )
            
            # Train
            self._model = GradientBoostingClassifier(
                n_estimators=50,
                max_depth=3,
                random_state=42,
            )
            self._model.fit(X_train, y_train)
            
            # Evaluate
            y_pred = self._model.predict(X_test)
            y_proba = self._model.predict_proba(X_test)[:, 1]
            
            accuracy = accuracy_score(y_test, y_pred)
            auc = roc_auc_score(y_test, y_proba)
            
            # Store feature importance
            self._weights = dict(zip(
                feature_names,
                self._model.feature_importances_
            ))
            
            logger.info(f"Ranker trained: accuracy={accuracy:.3f}, AUC={auc:.3f}")
            
            return {
                "accuracy": accuracy,
                "auc": auc,
                "feature_importance": self._weights,
            }
            
        except ImportError:
            logger.warning("scikit-learn not available, using simple weighting")
            
            # Fallback: simple correlation-based weights
            self._weights = {f: 1.0 / len(feature_names) for f in feature_names}
            
            return {
                "accuracy": 0.0,
                "auc": 0.0,
                "feature_importance": self._weights,
                "fallback": True,
            }
    
    def predict(self, features: Dict[str, float]) -> float:
        """Predict score for a candidate."""
        if self._model is not None:
            try:
                X = [[features.get(f, 0) for f in self._feature_names]]
                proba = self._model.predict_proba(X)[0][1]
                return proba * 100  # Scale to 0-100
            except:
                pass
        
        # Fallback: weighted sum
        score = sum(
            features.get(f, 0) * w
            for f, w in self._weights.items()
        )
        # Clamp to 0-100 range
        return max(0, min(100, score * 100))
    
    def save(self, path: str):
        """Save model to file."""
        import pickle
        
        with open(path, "wb") as f:
            pickle.dump({
                "model": self._model,
                "feature_names": self._feature_names,
                "weights": self._weights,
            }, f)
    
    def load(self, path: str):
        """Load model from file."""
        import pickle
        
        with open(path, "rb") as f:
            data = pickle.load(f)
            self._model = data.get("model")
            self._feature_names = data.get("feature_names", [])
            self._weights = data.get("weights", {})
