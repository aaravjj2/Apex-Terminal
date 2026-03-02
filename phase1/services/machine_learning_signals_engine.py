"""
Machine Learning Signals Engine — Feature engineering, ensemble models,
signal generation, regime-aware predictions, walk-forward validation,
model evaluation, feature importance, prediction confidence.

Pure computation — numpy/scipy-free, standard library only.
"""

from __future__ import annotations

import math
import random
import statistics
from collections import defaultdict
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple


class ModelType(str, Enum):
    LINEAR_REGRESSION = "linear_regression"
    LOGISTIC_REGRESSION = "logistic_regression"
    DECISION_TREE = "decision_tree"
    RANDOM_FOREST = "random_forest"
    GRADIENT_BOOSTING = "gradient_boosting"
    KNN = "knn"
    NAIVE_BAYES = "naive_bayes"
    ENSEMBLE = "ensemble"


class SignalStrength(str, Enum):
    STRONG_BUY = "strong_buy"
    BUY = "buy"
    WEAK_BUY = "weak_buy"
    NEUTRAL = "neutral"
    WEAK_SELL = "weak_sell"
    SELL = "sell"
    STRONG_SELL = "strong_sell"


@dataclass
class ModelMetrics:
    accuracy: float = 0.0
    precision: float = 0.0
    recall: float = 0.0
    f1_score: float = 0.0
    auc: float = 0.0
    sharpe_from_signals: float = 0.0

    def to_dict(self) -> dict:
        return {
            "accuracy": round(self.accuracy, 4),
            "precision": round(self.precision, 4),
            "recall": round(self.recall, 4),
            "f1_score": round(self.f1_score, 4),
            "auc": round(self.auc, 4),
            "sharpe_from_signals": round(self.sharpe_from_signals, 4),
        }


@dataclass
class PredictionResult:
    prediction: float
    confidence: float
    signal: str
    feature_contributions: dict[str, float]
    model_agreement: float

    def to_dict(self) -> dict:
        return {
            "prediction": round(self.prediction, 6),
            "confidence": round(self.confidence, 4),
            "signal": self.signal,
            "feature_contributions": {k: round(v, 6) for k, v in self.feature_contributions.items()},
            "model_agreement": round(self.model_agreement, 4),
        }


# ── Feature Engineering ──────────────────────────────────────────────

class FeatureEngineering:
    @staticmethod
    def price_features(
        prices: list[float],
        volumes: list[float] | None = None,
    ) -> list[dict]:
        """Generate technical features from price data."""
        n = len(prices)
        if n < 30:
            return []

        features_list = []
        for i in range(30, n):
            f = {}

            # Returns at various horizons
            f["return_1d"] = (prices[i] - prices[i - 1]) / prices[i - 1] if prices[i - 1] != 0 else 0
            f["return_5d"] = (prices[i] - prices[i - 5]) / prices[i - 5] if prices[i - 5] != 0 else 0
            f["return_10d"] = (prices[i] - prices[i - 10]) / prices[i - 10] if prices[i - 10] != 0 else 0
            f["return_20d"] = (prices[i] - prices[i - 20]) / prices[i - 20] if prices[i - 20] != 0 else 0

            # Moving average features
            sma5 = statistics.mean(prices[i - 5:i])
            sma10 = statistics.mean(prices[i - 10:i])
            sma20 = statistics.mean(prices[i - 20:i])

            f["price_sma5_ratio"] = prices[i] / sma5 if sma5 > 0 else 1
            f["price_sma10_ratio"] = prices[i] / sma10 if sma10 > 0 else 1
            f["price_sma20_ratio"] = prices[i] / sma20 if sma20 > 0 else 1
            f["sma5_sma20_cross"] = 1 if sma5 > sma20 else -1

            # Volatility features
            rets = [(prices[i - j] - prices[i - j - 1]) / prices[i - j - 1] if prices[i - j - 1] != 0 else 0 for j in range(20)]
            f["volatility_5d"] = statistics.stdev(rets[:5]) if len(rets[:5]) > 1 else 0
            f["volatility_20d"] = statistics.stdev(rets[:20]) if len(rets[:20]) > 1 else 0
            f["vol_ratio"] = f["volatility_5d"] / f["volatility_20d"] if f["volatility_20d"] > 0 else 1

            # RSI approximation
            gains = [r for r in rets[:14] if r > 0]
            losses = [-r for r in rets[:14] if r < 0]
            avg_gain = statistics.mean(gains) if gains else 0
            avg_loss = statistics.mean(losses) if losses else 1e-10
            rs = avg_gain / avg_loss if avg_loss > 0 else 100
            f["rsi_14"] = 100 - 100 / (1 + rs)

            # Price position within range
            high_20 = max(prices[i - 20:i + 1])
            low_20 = min(prices[i - 20:i + 1])
            f["price_position"] = (prices[i] - low_20) / (high_20 - low_20) if high_20 > low_20 else 0.5

            # Momentum
            f["momentum_5"] = prices[i] - prices[i - 5]
            f["momentum_10"] = prices[i] - prices[i - 10]
            f["rate_of_change"] = f["return_10d"]

            # Volume features if available
            if volumes and len(volumes) > i:
                avg_vol_5 = statistics.mean(volumes[i - 5:i])
                avg_vol_20 = statistics.mean(volumes[i - 20:i])
                f["volume_ratio"] = volumes[i] / avg_vol_20 if avg_vol_20 > 0 else 1
                f["volume_trend"] = avg_vol_5 / avg_vol_20 if avg_vol_20 > 0 else 1

            f["_index"] = i
            features_list.append(f)

        return features_list

    @staticmethod
    def normalize_features(features: list[dict]) -> list[dict]:
        """Z-score normalize all numeric features."""
        if not features:
            return []

        keys = [k for k in features[0].keys() if k != "_index" and isinstance(features[0].get(k), (int, float))]

        stats = {}
        for k in keys:
            vals = [f[k] for f in features if k in f]
            if len(vals) > 1:
                stats[k] = {"mean": statistics.mean(vals), "std": statistics.stdev(vals)}
            else:
                stats[k] = {"mean": 0, "std": 1}

        normalized = []
        for f in features:
            nf = {"_index": f.get("_index", 0)}
            for k in keys:
                mean = stats[k]["mean"]
                std = stats[k]["std"]
                nf[k] = (f.get(k, 0) - mean) / std if std > 0 else 0
            normalized.append(nf)

        return normalized


# ── Linear Regression Model ──────────────────────────────────────────

class LinearRegressionModel:
    def __init__(self) -> None:
        self.weights: dict[str, float] = {}
        self.intercept: float = 0.0

    def fit(
        self,
        features: list[dict],
        targets: list[float],
        lr: float = 0.001,
        epochs: int = 500,
    ) -> ModelMetrics:
        """Fit linear regression using gradient descent."""
        n = min(len(features), len(targets))
        if n == 0:
            return ModelMetrics()

        keys = [k for k in features[0].keys() if k != "_index"]
        self.weights = {k: 0.0 for k in keys}
        self.intercept = 0.0

        for epoch in range(epochs):
            for i in range(n):
                pred = self.intercept + sum(self.weights.get(k, 0) * features[i].get(k, 0) for k in keys)
                error = targets[i] - pred

                self.intercept += lr * error / n
                for k in keys:
                    self.weights[k] += lr * error * features[i].get(k, 0) / n

        # Calculate metrics
        predictions = [self.predict_raw(f) for f in features[:n]]
        mse = statistics.mean((targets[i] - predictions[i]) ** 2 for i in range(n))
        var_y = statistics.variance(targets[:n]) if n > 1 else 1
        r2 = 1 - mse / var_y if var_y > 0 else 0

        return ModelMetrics(accuracy=r2)

    def predict_raw(self, features: dict) -> float:
        keys = [k for k in features.keys() if k != "_index"]
        return self.intercept + sum(self.weights.get(k, 0) * features.get(k, 0) for k in keys)

    def predict(self, features: dict) -> float:
        return self.predict_raw(features)

    def feature_importance(self) -> dict[str, float]:
        total = sum(abs(v) for v in self.weights.values())
        if total <= 0:
            return self.weights
        return {k: abs(v) / total for k, v in self.weights.items()}


# ── Logistic Regression ──────────────────────────────────────────────

class LogisticRegressionModel:
    def __init__(self) -> None:
        self.weights: dict[str, float] = {}
        self.intercept: float = 0.0

    @staticmethod
    def sigmoid(x: float) -> float:
        x = max(-500, min(500, x))
        return 1 / (1 + math.exp(-x))

    def fit(
        self,
        features: list[dict],
        labels: list[int],  # 0 or 1
        lr: float = 0.01,
        epochs: int = 500,
    ) -> ModelMetrics:
        n = min(len(features), len(labels))
        if n == 0:
            return ModelMetrics()

        keys = [k for k in features[0].keys() if k != "_index"]
        self.weights = {k: 0.0 for k in keys}
        self.intercept = 0.0

        for epoch in range(epochs):
            for i in range(n):
                z = self.intercept + sum(self.weights.get(k, 0) * features[i].get(k, 0) for k in keys)
                pred = self.sigmoid(z)
                error = labels[i] - pred

                self.intercept += lr * error / n
                for k in keys:
                    self.weights[k] += lr * error * features[i].get(k, 0) / n

        # Metrics
        predictions = [1 if self.predict_prob(f) > 0.5 else 0 for f in features[:n]]
        tp = sum(1 for i in range(n) if predictions[i] == 1 and labels[i] == 1)
        fp = sum(1 for i in range(n) if predictions[i] == 1 and labels[i] == 0)
        fn = sum(1 for i in range(n) if predictions[i] == 0 and labels[i] == 1)
        tn = sum(1 for i in range(n) if predictions[i] == 0 and labels[i] == 0)

        accuracy = (tp + tn) / n if n > 0 else 0
        precision = tp / (tp + fp) if (tp + fp) > 0 else 0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0
        f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0

        return ModelMetrics(accuracy=accuracy, precision=precision, recall=recall, f1_score=f1)

    def predict_prob(self, features: dict) -> float:
        keys = [k for k in features.keys() if k != "_index"]
        z = self.intercept + sum(self.weights.get(k, 0) * features.get(k, 0) for k in keys)
        return self.sigmoid(z)

    def predict(self, features: dict) -> int:
        return 1 if self.predict_prob(features) > 0.5 else 0


# ── Decision Tree ─────────────────────────────────────────────────────

class DecisionTree:
    def __init__(self, max_depth: int = 5, min_samples: int = 5) -> None:
        self.max_depth = max_depth
        self.min_samples = min_samples
        self.tree: dict | None = None

    def _gini(self, labels: list[int]) -> float:
        if not labels:
            return 0
        n = len(labels)
        counts = defaultdict(int)
        for l in labels:
            counts[l] += 1
        return 1 - sum((c / n) ** 2 for c in counts.values())

    def _best_split(self, features: list[dict], labels: list[int]) -> tuple[str, float, float]:
        best_gain = -1
        best_feature = ""
        best_threshold = 0.0
        n = len(labels)
        parent_gini = self._gini(labels)

        keys = [k for k in features[0].keys() if k != "_index"]

        for key in keys:
            values = sorted(set(f.get(key, 0) for f in features))
            for j in range(len(values) - 1):
                threshold = (values[j] + values[j + 1]) / 2
                left_labels = [labels[i] for i in range(n) if features[i].get(key, 0) <= threshold]
                right_labels = [labels[i] for i in range(n) if features[i].get(key, 0) > threshold]

                if len(left_labels) < self.min_samples or len(right_labels) < self.min_samples:
                    continue

                gain = parent_gini - (
                    len(left_labels) / n * self._gini(left_labels) +
                    len(right_labels) / n * self._gini(right_labels)
                )

                if gain > best_gain:
                    best_gain = gain
                    best_feature = key
                    best_threshold = threshold

        return best_feature, best_threshold, best_gain

    def _build_tree(self, features: list[dict], labels: list[int], depth: int) -> dict:
        if depth >= self.max_depth or len(labels) <= self.min_samples or len(set(labels)) == 1:
            counts = defaultdict(int)
            for l in labels:
                counts[l] += 1
            majority = max(counts.keys(), key=lambda k: counts[k]) if counts else 0
            return {"leaf": True, "prediction": majority, "counts": dict(counts), "n_samples": len(labels)}

        feature, threshold, gain = self._best_split(features, labels)
        if gain <= 0:
            counts = defaultdict(int)
            for l in labels:
                counts[l] += 1
            majority = max(counts.keys(), key=lambda k: counts[k]) if counts else 0
            return {"leaf": True, "prediction": majority, "counts": dict(counts), "n_samples": len(labels)}

        n = len(labels)
        left_idx = [i for i in range(n) if features[i].get(feature, 0) <= threshold]
        right_idx = [i for i in range(n) if features[i].get(feature, 0) > threshold]

        return {
            "leaf": False,
            "feature": feature,
            "threshold": round(threshold, 6),
            "gain": round(gain, 4),
            "left": self._build_tree([features[i] for i in left_idx], [labels[i] for i in left_idx], depth + 1),
            "right": self._build_tree([features[i] for i in right_idx], [labels[i] for i in right_idx], depth + 1),
        }

    def fit(self, features: list[dict], labels: list[int]) -> None:
        self.tree = self._build_tree(features, labels, 0)

    def predict(self, features: dict) -> int:
        node = self.tree
        while node and not node.get("leaf"):
            if features.get(node["feature"], 0) <= node["threshold"]:
                node = node["left"]
            else:
                node = node["right"]
        return node["prediction"] if node else 0


# ── Random Forest ─────────────────────────────────────────────────────

class RandomForest:
    def __init__(self, n_trees: int = 10, max_depth: int = 5, sample_ratio: float = 0.7) -> None:
        self.n_trees = n_trees
        self.max_depth = max_depth
        self.sample_ratio = sample_ratio
        self.trees: list[DecisionTree] = []

    def fit(self, features: list[dict], labels: list[int]) -> ModelMetrics:
        self.trees = []
        n = len(features)
        sample_size = int(n * self.sample_ratio)

        for _ in range(self.n_trees):
            indices = random.choices(range(n), k=sample_size)
            sampled_features = [features[i] for i in indices]
            sampled_labels = [labels[i] for i in indices]

            tree = DecisionTree(max_depth=self.max_depth)
            tree.fit(sampled_features, sampled_labels)
            self.trees.append(tree)

        # OOB accuracy
        predictions = [self.predict(f) for f in features]
        accuracy = sum(1 for i in range(n) if predictions[i] == labels[i]) / n if n > 0 else 0

        return ModelMetrics(accuracy=accuracy)

    def predict(self, features: dict) -> int:
        votes = [t.predict(features) for t in self.trees]
        return max(set(votes), key=votes.count) if votes else 0

    def predict_proba(self, features: dict) -> float:
        votes = [t.predict(features) for t in self.trees]
        return sum(votes) / len(votes) if votes else 0.5


# ── KNN ────────────────────────────────────────────────────────────────

class KNNClassifier:
    def __init__(self, k: int = 5) -> None:
        self.k = k
        self.train_features: list[dict] = []
        self.train_labels: list[int] = []

    def fit(self, features: list[dict], labels: list[int]) -> None:
        self.train_features = features
        self.train_labels = labels

    def _distance(self, a: dict, b: dict) -> float:
        keys = [k for k in a.keys() if k != "_index"]
        return math.sqrt(sum((a.get(k, 0) - b.get(k, 0)) ** 2 for k in keys))

    def predict(self, features: dict) -> int:
        distances = [(self._distance(features, tf), self.train_labels[i]) for i, tf in enumerate(self.train_features)]
        distances.sort(key=lambda x: x[0])
        neighbors = [d[1] for d in distances[:self.k]]
        return max(set(neighbors), key=neighbors.count) if neighbors else 0


# ── Ensemble ──────────────────────────────────────────────────────────

class EnsemblePredictor:
    def __init__(self) -> None:
        self.linear = LinearRegressionModel()
        self.logistic = LogisticRegressionModel()
        self.rf = RandomForest(n_trees=5, max_depth=4)
        self.knn = KNNClassifier(k=5)

    def fit(
        self,
        features: list[dict],
        regression_targets: list[float],
        classification_labels: list[int],
    ) -> dict:
        metrics = {}

        m = self.linear.fit(features, regression_targets)
        metrics["linear_regression"] = m.to_dict()

        m = self.logistic.fit(features, classification_labels)
        metrics["logistic_regression"] = m.to_dict()

        m = self.rf.fit(features, classification_labels)
        metrics["random_forest"] = m.to_dict()

        self.knn.fit(features, classification_labels)
        preds = [self.knn.predict(f) for f in features]
        n = len(classification_labels)
        knn_acc = sum(1 for i in range(n) if preds[i] == classification_labels[i]) / n if n > 0 else 0
        metrics["knn"] = {"accuracy": round(knn_acc, 4)}

        return metrics

    def predict(self, features: dict) -> PredictionResult:
        reg_pred = self.linear.predict(features)
        log_prob = self.logistic.predict_prob(features)
        rf_prob = self.rf.predict_proba(features)
        knn_pred = self.knn.predict(features)

        # Weighted ensemble
        ensemble_prob = 0.2 * (1 if reg_pred > 0 else 0) + 0.3 * log_prob + 0.35 * rf_prob + 0.15 * knn_pred

        # Signal
        if ensemble_prob > 0.7:
            signal = SignalStrength.STRONG_BUY.value
        elif ensemble_prob > 0.6:
            signal = SignalStrength.BUY.value
        elif ensemble_prob > 0.55:
            signal = SignalStrength.WEAK_BUY.value
        elif ensemble_prob > 0.45:
            signal = SignalStrength.NEUTRAL.value
        elif ensemble_prob > 0.4:
            signal = SignalStrength.WEAK_SELL.value
        elif ensemble_prob > 0.3:
            signal = SignalStrength.SELL.value
        else:
            signal = SignalStrength.STRONG_SELL.value

        # Model agreement
        preds_binary = [1 if reg_pred > 0 else 0, self.logistic.predict(features), self.rf.predict(features), knn_pred]
        agreement = max(sum(preds_binary), len(preds_binary) - sum(preds_binary)) / len(preds_binary)

        # Feature contributions
        importance = self.linear.feature_importance()

        return PredictionResult(
            prediction=ensemble_prob,
            confidence=agreement,
            signal=signal,
            feature_contributions=importance,
            model_agreement=agreement,
        )


# ── Walk-Forward Validation ──────────────────────────────────────────

class WalkForwardValidator:
    @staticmethod
    def validate(
        features: list[dict],
        targets: list[float],
        labels: list[int],
        train_window: int = 252,
        test_window: int = 21,
    ) -> dict:
        """Walk-forward cross-validation."""
        n = len(features)
        results = []

        i = train_window
        while i + test_window <= n:
            train_f = features[i - train_window:i]
            train_t = targets[i - train_window:i]
            train_l = labels[i - train_window:i]
            test_f = features[i:i + test_window]
            test_t = targets[i:i + test_window]
            test_l = labels[i:i + test_window]

            model = LinearRegressionModel()
            model.fit(train_f, train_t)

            preds = [model.predict(f) for f in test_f]
            mse = statistics.mean((test_t[j] - preds[j]) ** 2 for j in range(len(test_t)))

            # Directional accuracy
            correct = sum(1 for j in range(len(test_t)) if (preds[j] > 0) == (test_t[j] > 0))
            dir_acc = correct / len(test_t) if test_t else 0

            results.append({
                "period_start": i,
                "period_end": i + test_window,
                "mse": round(mse, 8),
                "directional_accuracy": round(dir_acc, 4),
            })

            i += test_window

        if not results:
            return {"n_periods": 0}

        return {
            "n_periods": len(results),
            "avg_mse": round(statistics.mean(r["mse"] for r in results), 8),
            "avg_directional_accuracy": round(statistics.mean(r["directional_accuracy"] for r in results), 4),
            "best_period_accuracy": round(max(r["directional_accuracy"] for r in results), 4),
            "worst_period_accuracy": round(min(r["directional_accuracy"] for r in results), 4),
            "periods": results,
        }


# ── Orchestrator ──────────────────────────────────────────────────────

class MachineLearningSignalsEngine:
    def __init__(self) -> None:
        self.feature_eng = FeatureEngineering()
        self.ensemble = EnsemblePredictor()
        self.validator = WalkForwardValidator()

    def generate_features(self, prices: list[float], volumes: list[float] | None = None) -> list[dict]:
        return self.feature_eng.price_features(prices, volumes)

    def normalize(self, features: list[dict]) -> list[dict]:
        return self.feature_eng.normalize_features(features)

    def train_ensemble(
        self,
        features: list[dict],
        regression_targets: list[float],
        classification_labels: list[int],
    ) -> dict:
        return self.ensemble.fit(features, regression_targets, classification_labels)

    def predict(self, features: dict) -> dict:
        result = self.ensemble.predict(features)
        return result.to_dict()

    def get_live_signal(self, prices: list[float], volumes: list[float] | None = None) -> float:
        """
        Generate ML signal from price history. Returns value in [-1, 1]:
        strong_sell=-1, neutral=0, strong_buy=+1.
        """
        features = self.generate_features(prices, volumes)
        if len(features) < 20:
            return 0.0
        normed = self.normalize(features)
        train_f = normed[:-1]
        if len(train_f) < 10:
            return 0.0
        targets = []
        labels = []
        for f in train_f:
            idx = f.get("_index", len(targets) + 30)
            if idx + 1 < len(prices) and prices[idx] > 0:
                ret = (prices[idx + 1] - prices[idx]) / prices[idx]
                targets.append(ret)
                labels.append(1 if ret > 0 else 0)
            else:
                targets.append(0.0)
                labels.append(0)
        if len(train_f) != len(targets):
            train_f = train_f[:len(targets)]
            labels = labels[:len(train_f)]
            targets = targets[:len(train_f)]
        if len(train_f) < 10:
            return 0.0
        try:
            self.train_ensemble(train_f, targets, labels)
            result = self.ensemble.predict(normed[-1])
            sig_map = {
                "strong_buy": 1.0, "buy": 0.6, "weak_buy": 0.2,
                "neutral": 0.0,
                "weak_sell": -0.2, "sell": -0.6, "strong_sell": -1.0,
            }
            return sig_map.get(result.signal, (result.prediction - 0.5) * 2 if result.prediction else 0)
        except Exception:
            return 0.0

    def walk_forward_validate(self, features: list[dict], targets: list[float], labels: list[int], **kwargs) -> dict:
        return self.validator.validate(features, targets, labels, **kwargs)

    def capabilities(self) -> dict:
        return {
            "engine": "MachineLearningSignalsEngine",
            "version": "1.0.0",
            "features": [
                "automated_feature_engineering",
                "feature_normalization (z-score)",
                "linear_regression",
                "logistic_regression",
                "decision_tree_classifier",
                "random_forest_ensemble",
                "knn_classifier",
                "ensemble_prediction (weighted voting)",
                "signal_generation (7-level strong_buy to strong_sell)",
                "walk_forward_validation",
                "feature_importance_analysis",
                "model_agreement_scoring",
                "prediction_confidence_estimation",
            ],
        }
