"""
Time Series Forecasting Engine — ARIMA-like models, exponential smoothing,
Holt-Winters, GARCH volatility, seasonal decomposition, trend analysis,
moving average models, regression-based forecasting, ensemble methods,
change point detection, anomaly detection.

Pure computation — no FastAPI dependencies.
"""

from __future__ import annotations

import math
import random
import statistics
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple


# ── Enums ───────────────────────────────────────────────────────────────

class ForecastMethod(str, Enum):
    SIMPLE_MOVING_AVERAGE = "sma"
    EXPONENTIAL_SMOOTHING = "exponential_smoothing"
    DOUBLE_EXPONENTIAL = "double_exponential"
    HOLT_WINTERS = "holt_winters"
    LINEAR_REGRESSION = "linear_regression"
    POLYNOMIAL_REGRESSION = "poly_regression"
    AR = "ar"
    MA = "ma"
    ARMA = "arma"
    GARCH = "garch"
    THETA = "theta"
    ENSEMBLE = "ensemble"


class SeasonalityType(str, Enum):
    NONE = "none"
    ADDITIVE = "additive"
    MULTIPLICATIVE = "multiplicative"


class TrendType(str, Enum):
    NONE = "none"
    LINEAR = "linear"
    EXPONENTIAL = "exponential"
    DAMPED = "damped"


# ── Data Classes ────────────────────────────────────────────────────────

@dataclass
class ForecastResult:
    """Result of a forecast."""
    method: str
    point_forecast: list[float]
    lower_bound: list[float] = field(default_factory=list)
    upper_bound: list[float] = field(default_factory=list)
    confidence: float = 0.95
    fitted_values: list[float] = field(default_factory=list)
    residuals: list[float] = field(default_factory=list)
    metrics: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "method": self.method,
            "point_forecast": [round(v, 4) for v in self.point_forecast],
            "lower_bound": [round(v, 4) for v in self.lower_bound],
            "upper_bound": [round(v, 4) for v in self.upper_bound],
            "confidence": self.confidence,
            "metrics": {k: round(v, 6) if isinstance(v, float) else v for k, v in self.metrics.items()},
        }


@dataclass
class DecompositionResult:
    """Result of time series decomposition."""
    trend: list[float]
    seasonal: list[float]
    residual: list[float]
    observed: list[float]
    seasonality_type: str = "additive"
    period: int = 0

    def to_dict(self) -> dict:
        return {
            "trend": [round(v, 4) for v in self.trend],
            "seasonal": [round(v, 4) for v in self.seasonal],
            "residual": [round(v, 4) for v in self.residual],
            "seasonality_type": self.seasonality_type,
            "period": self.period,
        }


@dataclass
class ChangePoint:
    index: int
    value: float
    change_magnitude: float
    confidence: float

    def to_dict(self) -> dict:
        return {
            "index": self.index,
            "value": round(self.value, 4),
            "change_magnitude": round(self.change_magnitude, 4),
            "confidence": round(self.confidence, 4),
        }


# ── Error Metrics ──────────────────────────────────────────────────────

class ForecastMetrics:
    """Error metrics for forecast evaluation."""

    @staticmethod
    def mae(actual: list[float], predicted: list[float]) -> float:
        n = min(len(actual), len(predicted))
        return sum(abs(actual[i] - predicted[i]) for i in range(n)) / n if n else 0

    @staticmethod
    def mse(actual: list[float], predicted: list[float]) -> float:
        n = min(len(actual), len(predicted))
        return sum((actual[i] - predicted[i]) ** 2 for i in range(n)) / n if n else 0

    @staticmethod
    def rmse(actual: list[float], predicted: list[float]) -> float:
        return math.sqrt(ForecastMetrics.mse(actual, predicted))

    @staticmethod
    def mape(actual: list[float], predicted: list[float]) -> float:
        n = min(len(actual), len(predicted))
        errors = [abs((actual[i] - predicted[i]) / actual[i])
                  for i in range(n) if abs(actual[i]) > 1e-10]
        return statistics.mean(errors) * 100 if errors else 0

    @staticmethod
    def smape(actual: list[float], predicted: list[float]) -> float:
        n = min(len(actual), len(predicted))
        errors = [abs(actual[i] - predicted[i]) / (abs(actual[i]) + abs(predicted[i]))
                  for i in range(n) if abs(actual[i]) + abs(predicted[i]) > 1e-10]
        return statistics.mean(errors) * 200 if errors else 0

    @staticmethod
    def theil_u(actual: list[float], predicted: list[float]) -> float:
        n = min(len(actual), len(predicted))
        if n < 2:
            return 0
        num = math.sqrt(sum((predicted[i] - actual[i]) ** 2 for i in range(1, n)) / (n - 1))
        den = math.sqrt(sum(actual[i] ** 2 for i in range(1, n)) / (n - 1))
        return num / den if den > 0 else 0

    @staticmethod
    def r_squared(actual: list[float], predicted: list[float]) -> float:
        n = min(len(actual), len(predicted))
        if n < 2:
            return 0
        mean_actual = statistics.mean(actual[:n])
        ss_res = sum((actual[i] - predicted[i]) ** 2 for i in range(n))
        ss_tot = sum((actual[i] - mean_actual) ** 2 for i in range(n))
        return 1 - ss_res / ss_tot if ss_tot > 0 else 0

    @staticmethod
    def all_metrics(actual: list[float], predicted: list[float]) -> dict:
        return {
            "mae": ForecastMetrics.mae(actual, predicted),
            "mse": ForecastMetrics.mse(actual, predicted),
            "rmse": ForecastMetrics.rmse(actual, predicted),
            "mape": ForecastMetrics.mape(actual, predicted),
            "smape": ForecastMetrics.smape(actual, predicted),
            "r_squared": ForecastMetrics.r_squared(actual, predicted),
        }


# ── Simple Moving Average ────────────────────────────────────────────

class SMAForecaster:
    """Simple Moving Average forecast."""

    @staticmethod
    def forecast(
        data: list[float],
        window: int = 20,
        horizon: int = 10,
    ) -> ForecastResult:
        n = len(data)
        if n < window:
            window = max(1, n)

        # Fitted values
        fitted = [None] * (window - 1)
        for i in range(window - 1, n):
            fitted.append(statistics.mean(data[i - window + 1:i + 1]))

        # Clean fitted
        fitted_clean = [f if f is not None else data[0] for f in fitted]

        # Forecast
        last_window = data[-window:]
        point = [statistics.mean(last_window)] * horizon

        # Confidence bounds
        residuals = [data[i] - fitted_clean[i] for i in range(window - 1, n)]
        std_resid = statistics.stdev(residuals) if len(residuals) > 1 else 0

        lower = [p - 1.96 * std_resid * math.sqrt(1 + i / window) for i, p in enumerate(point)]
        upper = [p + 1.96 * std_resid * math.sqrt(1 + i / window) for i, p in enumerate(point)]

        return ForecastResult(
            method="sma",
            point_forecast=point,
            lower_bound=lower,
            upper_bound=upper,
            fitted_values=fitted_clean,
            residuals=residuals,
            metrics=ForecastMetrics.all_metrics(data[window - 1:], fitted_clean[window - 1:]),
        )


# ── Exponential Smoothing ────────────────────────────────────────────

class ExponentialSmoothingForecaster:
    """Simple, double, and triple (Holt-Winters) exponential smoothing."""

    @staticmethod
    def simple(
        data: list[float],
        alpha: float = 0.3,
        horizon: int = 10,
    ) -> ForecastResult:
        """Simple exponential smoothing (SES)."""
        n = len(data)
        level = data[0]
        fitted = [level]

        for i in range(1, n):
            level = alpha * data[i] + (1 - alpha) * level
            fitted.append(level)

        point = [level] * horizon
        residuals = [data[i] - fitted[i] for i in range(n)]
        std_resid = statistics.stdev(residuals) if len(residuals) > 1 else 0

        lower = [p - 1.96 * std_resid * math.sqrt(1 + i * alpha ** 2) for i, p in enumerate(point)]
        upper = [p + 1.96 * std_resid * math.sqrt(1 + i * alpha ** 2) for i, p in enumerate(point)]

        return ForecastResult(
            method="ses",
            point_forecast=point,
            lower_bound=lower,
            upper_bound=upper,
            fitted_values=fitted,
            residuals=residuals,
            metrics=ForecastMetrics.all_metrics(data, fitted),
        )

    @staticmethod
    def double(
        data: list[float],
        alpha: float = 0.3,
        beta: float = 0.1,
        horizon: int = 10,
        damped: bool = False,
        phi: float = 0.9,
    ) -> ForecastResult:
        """Holt's double exponential smoothing (linear trend)."""
        n = len(data)
        level = data[0]
        trend = data[1] - data[0] if n > 1 else 0
        fitted = [level]

        for i in range(1, n):
            prev_level = level
            if damped:
                level = alpha * data[i] + (1 - alpha) * (prev_level + phi * trend)
                trend = beta * (level - prev_level) + (1 - beta) * phi * trend
            else:
                level = alpha * data[i] + (1 - alpha) * (prev_level + trend)
                trend = beta * (level - prev_level) + (1 - beta) * trend
            fitted.append(level + trend)

        # Forecast
        point = []
        for h in range(1, horizon + 1):
            if damped:
                cumulative_phi = sum(phi ** j for j in range(1, h + 1))
                point.append(level + trend * cumulative_phi)
            else:
                point.append(level + trend * h)

        residuals = [data[i] - fitted[i] for i in range(n)]
        std_resid = statistics.stdev(residuals) if len(residuals) > 1 else 0
        lower = [p - 1.96 * std_resid for p in point]
        upper = [p + 1.96 * std_resid for p in point]

        return ForecastResult(
            method="double_exponential" + ("_damped" if damped else ""),
            point_forecast=point,
            lower_bound=lower,
            upper_bound=upper,
            fitted_values=fitted,
            residuals=residuals,
            metrics=ForecastMetrics.all_metrics(data, fitted),
        )

    @staticmethod
    def holt_winters(
        data: list[float],
        alpha: float = 0.3,
        beta: float = 0.1,
        gamma: float = 0.1,
        season_length: int = 12,
        seasonality: str = "additive",
        horizon: int = 12,
    ) -> ForecastResult:
        """Holt-Winters triple exponential smoothing."""
        n = len(data)
        if n < 2 * season_length:
            return ExponentialSmoothingForecaster.double(data, alpha, beta, horizon)

        # Initialize
        level = statistics.mean(data[:season_length])
        trend = sum(data[season_length + i] - data[i] for i in range(season_length)) / (season_length ** 2)

        if seasonality == "additive":
            seasonal = [data[i] - level for i in range(season_length)]
        else:
            seasonal = [data[i] / level if level != 0 else 1.0 for i in range(season_length)]

        fitted = []
        for i in range(n):
            s_idx = i % season_length
            prev_level = level

            if seasonality == "additive":
                level = alpha * (data[i] - seasonal[s_idx]) + (1 - alpha) * (prev_level + trend)
                trend = beta * (level - prev_level) + (1 - beta) * trend
                seasonal[s_idx] = gamma * (data[i] - level) + (1 - gamma) * seasonal[s_idx]
                fitted.append(level + trend + seasonal[s_idx])
            else:
                level = alpha * (data[i] / seasonal[s_idx] if seasonal[s_idx] != 0 else data[i]) + \
                        (1 - alpha) * (prev_level + trend)
                trend = beta * (level - prev_level) + (1 - beta) * trend
                seasonal[s_idx] = gamma * (data[i] / level if level != 0 else 1) + \
                                  (1 - gamma) * seasonal[s_idx]
                fitted.append((level + trend) * seasonal[s_idx])

        # Forecast
        point = []
        for h in range(1, horizon + 1):
            s_idx = (n + h - 1) % season_length
            if seasonality == "additive":
                point.append(level + trend * h + seasonal[s_idx])
            else:
                point.append((level + trend * h) * seasonal[s_idx])

        residuals = [data[i] - fitted[i] for i in range(n)]
        std_resid = statistics.stdev(residuals) if len(residuals) > 1 else 0
        lower = [p - 1.96 * std_resid for p in point]
        upper = [p + 1.96 * std_resid for p in point]

        return ForecastResult(
            method=f"holt_winters_{seasonality}",
            point_forecast=point,
            lower_bound=lower,
            upper_bound=upper,
            fitted_values=fitted,
            residuals=residuals,
            metrics=ForecastMetrics.all_metrics(data, fitted),
        )


# ── Autoregressive Model ────────────────────────────────────────────

class ARForecaster:
    """Autoregressive model (pure AR)."""

    @staticmethod
    def _fit_ar_coefficients(data: list[float], order: int) -> list[float]:
        """Estimate AR coefficients using Yule-Walker equations (simplified)."""
        n = len(data)
        mean = statistics.mean(data)
        centered = [x - mean for x in data]

        # Autocorrelations
        var = sum(c ** 2 for c in centered) / n
        if var == 0:
            return [0.0] * order

        acf = []
        for lag in range(order + 1):
            c = sum(centered[i] * centered[i - lag] for i in range(lag, n)) / n
            acf.append(c / var)

        # Levinson-Durbin
        if order == 1:
            return [acf[1]]

        coeffs = [0.0] * order
        coeffs[0] = acf[1]
        error = var * (1 - acf[1] ** 2)

        for k in range(1, order):
            phi_k = (acf[k + 1] - sum(coeffs[j] * acf[k - j] for j in range(k))) / error if error > 0 else 0
            new_coeffs = [0.0] * order
            new_coeffs[k] = phi_k
            for j in range(k):
                new_coeffs[j] = coeffs[j] - phi_k * coeffs[k - 1 - j]
            coeffs = new_coeffs
            error *= (1 - phi_k ** 2)

        return coeffs

    @staticmethod
    def forecast(
        data: list[float],
        order: int = 5,
        horizon: int = 10,
    ) -> ForecastResult:
        n = len(data)
        mean = statistics.mean(data)
        coeffs = ARForecaster._fit_ar_coefficients(data, order)

        # Fitted values
        fitted = list(data[:order])
        for i in range(order, n):
            pred = mean + sum(coeffs[j] * (data[i - j - 1] - mean) for j in range(order))
            fitted.append(pred)

        # Forecast
        ext = list(data)
        point = []
        for h in range(horizon):
            pred = mean + sum(coeffs[j] * (ext[-(j + 1)] - mean) for j in range(order))
            point.append(pred)
            ext.append(pred)

        residuals = [data[i] - fitted[i] for i in range(order, n)]
        std_resid = statistics.stdev(residuals) if len(residuals) > 1 else 0
        lower = [p - 1.96 * std_resid for p in point]
        upper = [p + 1.96 * std_resid for p in point]

        return ForecastResult(
            method=f"ar({order})",
            point_forecast=point,
            lower_bound=lower,
            upper_bound=upper,
            fitted_values=fitted,
            residuals=residuals,
            metrics=ForecastMetrics.all_metrics(data[order:], fitted[order:]),
        )


# ── Moving Average Model ────────────────────────────────────────────

class MAForecaster:
    """Moving average model (MA)."""

    @staticmethod
    def forecast(
        data: list[float],
        order: int = 3,
        horizon: int = 10,
    ) -> ForecastResult:
        n = len(data)
        mean = statistics.mean(data)

        # Estimate MA errors
        errors = [0.0] * n
        fitted = [mean] * n

        for iteration in range(20):  # Iterative estimation
            for i in range(1, n):
                ma_component = sum(
                    errors[i - j - 1] * 0.5 ** (j + 1)
                    for j in range(min(order, i))
                )
                fitted[i] = mean + ma_component
                errors[i] = data[i] - fitted[i]

        # MA coefficients (simplified)
        ma_coeffs = [0.5 ** (j + 1) for j in range(order)]

        point = [mean] * horizon  # MA forecast reverts to mean
        residuals = [data[i] - fitted[i] for i in range(n)]
        std_resid = statistics.stdev(residuals) if len(residuals) > 1 else 0
        lower = [p - 1.96 * std_resid for p in point]
        upper = [p + 1.96 * std_resid for p in point]

        return ForecastResult(
            method=f"ma({order})",
            point_forecast=point,
            lower_bound=lower,
            upper_bound=upper,
            fitted_values=fitted,
            residuals=residuals,
            metrics=ForecastMetrics.all_metrics(data, fitted),
        )


# ── GARCH Volatility ──────────────────────────────────────────────────

class GARCHForecaster:
    """GARCH(1,1) volatility forecasting."""

    @staticmethod
    def fit_garch11(
        returns: list[float],
        omega: float = 0.00001,
        alpha: float = 0.1,
        beta: float = 0.85,
    ) -> Tuple[list[float], dict]:
        """Fit GARCH(1,1): sigma_t^2 = omega + alpha * e_{t-1}^2 + beta * sigma_{t-1}^2"""
        n = len(returns)
        variance = [statistics.variance(returns)] if n > 1 else [0.0001]

        for i in range(1, n):
            var_t = omega + alpha * returns[i - 1] ** 2 + beta * variance[-1]
            variance.append(max(var_t, 1e-10))

        volatility = [math.sqrt(v) for v in variance]

        # Long-run variance
        long_run_var = omega / (1 - alpha - beta) if (alpha + beta) < 1 else variance[-1]

        return volatility, {
            "omega": omega,
            "alpha": alpha,
            "beta": beta,
            "persistence": alpha + beta,
            "long_run_variance": long_run_var,
            "long_run_volatility": math.sqrt(long_run_var),
            "half_life": -math.log(2) / math.log(alpha + beta) if 0 < alpha + beta < 1 else float("inf"),
        }

    @staticmethod
    def forecast_volatility(
        returns: list[float],
        omega: float = 0.00001,
        alpha: float = 0.1,
        beta: float = 0.85,
        horizon: int = 30,
    ) -> ForecastResult:
        volatility, params = GARCHForecaster.fit_garch11(returns, omega, alpha, beta)

        # Forecast variance
        last_var = volatility[-1] ** 2
        last_return = returns[-1]

        var_forecast = []
        for h in range(horizon):
            if h == 0:
                var_t = omega + alpha * last_return ** 2 + beta * last_var
            else:
                var_t = omega + (alpha + beta) * var_forecast[-1]
            var_forecast.append(var_t)

        vol_forecast = [math.sqrt(v) for v in var_forecast]

        return ForecastResult(
            method="garch(1,1)",
            point_forecast=vol_forecast,
            fitted_values=volatility,
            metrics=params,
        )

    @staticmethod
    def ewma_volatility(
        returns: list[float],
        lambda_: float = 0.94,
        horizon: int = 30,
    ) -> ForecastResult:
        """EWMA (RiskMetrics) volatility model."""
        n = len(returns)
        variance = [returns[0] ** 2] if n > 0 else [0.0001]

        for i in range(1, n):
            var_t = lambda_ * variance[-1] + (1 - lambda_) * returns[i] ** 2
            variance.append(var_t)

        # EWMA forecast is flat (last conditional variance)
        vol_forecast = [math.sqrt(variance[-1])] * horizon

        return ForecastResult(
            method="ewma",
            point_forecast=vol_forecast,
            fitted_values=[math.sqrt(v) for v in variance],
            metrics={"lambda": lambda_},
        )


# ── Linear Regression Forecast ───────────────────────────────────────

class RegressionForecaster:
    """Linear and polynomial regression for forecasting."""

    @staticmethod
    def linear(
        data: list[float],
        horizon: int = 10,
    ) -> ForecastResult:
        n = len(data)
        x = list(range(n))
        x_mean = statistics.mean(x)
        y_mean = statistics.mean(data)

        ss_xy = sum((x[i] - x_mean) * (data[i] - y_mean) for i in range(n))
        ss_xx = sum((x[i] - x_mean) ** 2 for i in range(n))

        slope = ss_xy / ss_xx if ss_xx > 0 else 0
        intercept = y_mean - slope * x_mean

        fitted = [intercept + slope * i for i in range(n)]
        point = [intercept + slope * (n + i) for i in range(horizon)]

        residuals = [data[i] - fitted[i] for i in range(n)]
        std_resid = statistics.stdev(residuals) if len(residuals) > 1 else 0
        lower = [p - 1.96 * std_resid for p in point]
        upper = [p + 1.96 * std_resid for p in point]

        return ForecastResult(
            method="linear_regression",
            point_forecast=point,
            lower_bound=lower,
            upper_bound=upper,
            fitted_values=fitted,
            residuals=residuals,
            metrics={
                **ForecastMetrics.all_metrics(data, fitted),
                "slope": slope,
                "intercept": intercept,
            },
        )

    @staticmethod
    def polynomial(
        data: list[float],
        degree: int = 2,
        horizon: int = 10,
    ) -> ForecastResult:
        """Polynomial regression (simplified using normal equations)."""
        n = len(data)
        x = list(range(n))

        # Build Vandermonde-like system (simplified for degree 2)
        if degree == 2:
            sx = sum(x)
            sx2 = sum(xi ** 2 for xi in x)
            sx3 = sum(xi ** 3 for xi in x)
            sx4 = sum(xi ** 4 for xi in x)
            sy = sum(data)
            sxy = sum(x[i] * data[i] for i in range(n))
            sx2y = sum(x[i] ** 2 * data[i] for i in range(n))

            # Solve 3x3 system (Cramer's rule simplified)
            det = n * (sx2 * sx4 - sx3 ** 2) - sx * (sx * sx4 - sx2 * sx3) + sx2 * (sx * sx3 - sx2 ** 2)
            if abs(det) < 1e-14:
                return RegressionForecaster.linear(data, horizon)

            a0 = (sy * (sx2 * sx4 - sx3 ** 2) - sx * (sxy * sx4 - sx2y * sx3) + sx2 * (sxy * sx3 - sx2y * sx2)) / det
            a1 = (n * (sxy * sx4 - sx2y * sx3) - sy * (sx * sx4 - sx2 * sx3) + sx2 * (sx * sx2y - sx2 * sxy)) / det
            a2 = (n * (sx2 * sx2y - sx3 * sxy) - sx * (sx * sx2y - sx2 * sxy) + sy * (sx * sx3 - sx2 ** 2)) / det

            fitted = [a0 + a1 * i + a2 * i ** 2 for i in range(n)]
            point = [a0 + a1 * (n + i) + a2 * (n + i) ** 2 for i in range(horizon)]
        else:
            return RegressionForecaster.linear(data, horizon)

        residuals = [data[i] - fitted[i] for i in range(n)]
        std_resid = statistics.stdev(residuals) if len(residuals) > 1 else 0
        lower = [p - 1.96 * std_resid for p in point]
        upper = [p + 1.96 * std_resid for p in point]

        return ForecastResult(
            method=f"poly_regression(degree={degree})",
            point_forecast=point,
            lower_bound=lower,
            upper_bound=upper,
            fitted_values=fitted,
            residuals=residuals,
            metrics=ForecastMetrics.all_metrics(data, fitted),
        )


# ── Seasonal Decomposition ──────────────────────────────────────────

class SeasonalDecomposition:
    """Time series decomposition into trend, seasonal, residual."""

    @staticmethod
    def decompose(
        data: list[float],
        period: int = 12,
        seasonality: str = "additive",
    ) -> DecompositionResult:
        n = len(data)
        if n < 2 * period:
            return DecompositionResult(
                trend=list(data), seasonal=[0.0] * n,
                residual=[0.0] * n, observed=list(data),
                seasonality_type=seasonality, period=period,
            )

        # Trend: centered moving average
        half = period // 2
        trend = [0.0] * n
        for i in range(half, n - half):
            window = data[i - half:i + half + 1]
            if period % 2 == 0:
                window = data[i - half:i + half + 1]
                trend[i] = (sum(window) - 0.5 * window[0] - 0.5 * window[-1]) / period
            else:
                trend[i] = statistics.mean(window)

        # Fill edges
        for i in range(half):
            trend[i] = trend[half]
        for i in range(n - half, n):
            trend[i] = trend[n - half - 1]

        # Seasonal
        if seasonality == "additive":
            detrended = [data[i] - trend[i] for i in range(n)]
        else:
            detrended = [data[i] / trend[i] if trend[i] != 0 else 1.0 for i in range(n)]

        seasonal_indices = [0.0] * period
        for s in range(period):
            vals = [detrended[i] for i in range(s, n, period)]
            seasonal_indices[s] = statistics.mean(vals)

        # Normalize
        if seasonality == "additive":
            adj = statistics.mean(seasonal_indices)
            seasonal_indices = [s - adj for s in seasonal_indices]
        else:
            adj = statistics.mean(seasonal_indices)
            seasonal_indices = [s / adj if adj != 0 else 1.0 for s in seasonal_indices]

        seasonal = [seasonal_indices[i % period] for i in range(n)]

        # Residual
        if seasonality == "additive":
            residual = [data[i] - trend[i] - seasonal[i] for i in range(n)]
        else:
            residual = [data[i] / (trend[i] * seasonal[i]) if trend[i] * seasonal[i] != 0 else 0
                        for i in range(n)]

        return DecompositionResult(
            trend=trend,
            seasonal=seasonal,
            residual=residual,
            observed=list(data),
            seasonality_type=seasonality,
            period=period,
        )


# ── Change Point Detection ──────────────────────────────────────────

class ChangePointDetector:
    """Detect structural breaks in time series."""

    @staticmethod
    def cusum(
        data: list[float],
        threshold: float = 5.0,
    ) -> list[ChangePoint]:
        """CUSUM (cumulative sum) change point detection."""
        n = len(data)
        if n < 4:
            return []

        mean = statistics.mean(data)
        std = statistics.stdev(data) if n > 1 else 1.0

        s_pos = [0.0]
        s_neg = [0.0]
        change_points = []

        for i in range(1, n):
            deviation = (data[i] - mean) / std if std > 0 else 0
            s_pos.append(max(0, s_pos[-1] + deviation - 0.5))
            s_neg.append(max(0, s_neg[-1] - deviation - 0.5))

            if s_pos[-1] > threshold:
                change_points.append(ChangePoint(
                    index=i, value=data[i],
                    change_magnitude=s_pos[-1],
                    confidence=min(s_pos[-1] / (threshold * 2), 1.0),
                ))
                s_pos[-1] = 0

            if s_neg[-1] > threshold:
                change_points.append(ChangePoint(
                    index=i, value=data[i],
                    change_magnitude=-s_neg[-1],
                    confidence=min(s_neg[-1] / (threshold * 2), 1.0),
                ))
                s_neg[-1] = 0

        return change_points

    @staticmethod
    def binary_segmentation(
        data: list[float],
        min_segment: int = 10,
        max_changepoints: int = 5,
    ) -> list[ChangePoint]:
        """Binary segmentation for change point detection."""
        n = len(data)
        if n < 2 * min_segment:
            return []

        change_points = []

        def _find_best(start: int, end: int) -> Optional[ChangePoint]:
            best_stat = 0.0
            best_idx = -1

            total_var = statistics.variance(data[start:end]) if end - start > 1 else 0
            if total_var == 0:
                return None

            for k in range(start + min_segment, end - min_segment):
                left = data[start:k]
                right = data[k:end]
                if len(left) < 2 or len(right) < 2:
                    continue

                left_mean = statistics.mean(left)
                right_mean = statistics.mean(right)
                diff = abs(left_mean - right_mean)

                # t-statistic approximation
                left_var = statistics.variance(left) / len(left)
                right_var = statistics.variance(right) / len(right)
                pooled_se = math.sqrt(left_var + right_var)
                stat = diff / pooled_se if pooled_se > 0 else 0

                if stat > best_stat:
                    best_stat = stat
                    best_idx = k

            if best_idx >= 0 and best_stat > 2.0:  # ~95% significance
                return ChangePoint(
                    index=best_idx, value=data[best_idx],
                    change_magnitude=statistics.mean(data[best_idx:end]) - statistics.mean(data[start:best_idx]),
                    confidence=min(best_stat / 5.0, 1.0),
                )
            return None

        segments = [(0, n)]
        for _ in range(max_changepoints):
            best_cp = None
            best_seg_idx = -1

            for seg_idx, (start, end) in enumerate(segments):
                cp = _find_best(start, end)
                if cp and (best_cp is None or cp.confidence > best_cp.confidence):
                    best_cp = cp
                    best_seg_idx = seg_idx

            if best_cp is None:
                break

            change_points.append(best_cp)
            start, end = segments[best_seg_idx]
            segments[best_seg_idx] = (start, best_cp.index)
            segments.insert(best_seg_idx + 1, (best_cp.index, end))

        return sorted(change_points, key=lambda c: c.index)


# ── Anomaly Detection ──────────────────────────────────────────────────

class AnomalyDetector:
    """Time series anomaly detection."""

    @staticmethod
    def zscore_method(
        data: list[float],
        window: int = 20,
        threshold: float = 3.0,
    ) -> list[dict]:
        n = len(data)
        anomalies = []

        for i in range(window, n):
            window_data = data[i - window:i]
            mean = statistics.mean(window_data)
            std = statistics.stdev(window_data) if len(window_data) > 1 else 0.001

            z = abs(data[i] - mean) / std if std > 0 else 0

            if z > threshold:
                anomalies.append({
                    "index": i,
                    "value": data[i],
                    "z_score": round(z, 4),
                    "expected": round(mean, 4),
                    "type": "spike" if data[i] > mean else "dip",
                })

        return anomalies

    @staticmethod
    def iqr_method(
        data: list[float],
        multiplier: float = 1.5,
    ) -> list[dict]:
        sorted_data = sorted(data)
        n = len(sorted_data)
        q1 = sorted_data[n // 4]
        q3 = sorted_data[3 * n // 4]
        iqr = q3 - q1

        lower = q1 - multiplier * iqr
        upper = q3 + multiplier * iqr

        anomalies = []
        for i, v in enumerate(data):
            if v < lower or v > upper:
                anomalies.append({
                    "index": i,
                    "value": v,
                    "lower_bound": round(lower, 4),
                    "upper_bound": round(upper, 4),
                    "type": "above" if v > upper else "below",
                })

        return anomalies

    @staticmethod
    def moving_median_method(
        data: list[float],
        window: int = 20,
        threshold: float = 3.0,
    ) -> list[dict]:
        n = len(data)
        anomalies = []

        for i in range(window, n):
            window_data = sorted(data[i - window:i])
            median = window_data[len(window_data) // 2]
            mad = statistics.median([abs(v - median) for v in window_data])
            mad_scaled = 1.4826 * mad  # Scale to be comparable to std

            if mad_scaled > 0:
                score = abs(data[i] - median) / mad_scaled
                if score > threshold:
                    anomalies.append({
                        "index": i,
                        "value": data[i],
                        "median": round(median, 4),
                        "mad_score": round(score, 4),
                        "type": "spike" if data[i] > median else "dip",
                    })

        return anomalies


# ── Theta Method ──────────────────────────────────────────────────────

class ThetaForecaster:
    """Theta method (Assimakopoulos-Nikolopoulos)."""

    @staticmethod
    def forecast(
        data: list[float],
        horizon: int = 10,
        theta: float = 2.0,
    ) -> ForecastResult:
        n = len(data)

        # Decompose into theta lines
        # Theta = 0: linear regression
        # Theta = 2: amplified curvature

        x = list(range(n))
        x_mean = statistics.mean(x)
        y_mean = statistics.mean(data)
        ss_xy = sum((x[i] - x_mean) * (data[i] - y_mean) for i in range(n))
        ss_xx = sum((x[i] - x_mean) ** 2 for i in range(n))
        slope = ss_xy / ss_xx if ss_xx > 0 else 0
        intercept = y_mean - slope * x_mean

        # Theta line = data + theta * second differences
        theta_line = list(data)
        for i in range(2, n):
            dd = data[i] - 2 * data[i - 1] + data[i - 2]
            theta_line[i] = data[i] + theta * dd

        # SES on theta line
        alpha = 0.3
        level = theta_line[0]
        for i in range(1, n):
            level = alpha * theta_line[i] + (1 - alpha) * level

        # Combine: forecast = SES + drift
        point = []
        for h in range(1, horizon + 1):
            point.append(level + slope * h / 2)

        residuals = [data[i] - theta_line[i] for i in range(n)]
        std_resid = statistics.stdev(residuals) if len(residuals) > 1 else 0
        lower = [p - 1.96 * std_resid for p in point]
        upper = [p + 1.96 * std_resid for p in point]

        return ForecastResult(
            method="theta",
            point_forecast=point,
            lower_bound=lower,
            upper_bound=upper,
            fitted_values=theta_line,
            residuals=residuals,
            metrics=ForecastMetrics.all_metrics(data, theta_line),
        )


# ── Ensemble Forecaster ──────────────────────────────────────────────

class EnsembleForecaster:
    """Combine multiple forecasting methods."""

    @staticmethod
    def forecast(
        data: list[float],
        horizon: int = 10,
        methods: list[str] = None,
    ) -> ForecastResult:
        if methods is None:
            methods = ["ses", "double_exp", "linear", "ar", "theta"]

        individual_forecasts = []
        weights = []

        for method in methods:
            if method == "ses":
                f = ExponentialSmoothingForecaster.simple(data, horizon=horizon)
            elif method == "double_exp":
                f = ExponentialSmoothingForecaster.double(data, horizon=horizon)
            elif method == "linear":
                f = RegressionForecaster.linear(data, horizon=horizon)
            elif method == "ar":
                f = ARForecaster.forecast(data, horizon=horizon)
            elif method == "theta":
                f = ThetaForecaster.forecast(data, horizon=horizon)
            elif method == "sma":
                f = SMAForecaster.forecast(data, horizon=horizon)
            else:
                continue

            individual_forecasts.append(f)
            # Weight by inverse RMSE
            rmse = f.metrics.get("rmse", 1.0)
            weights.append(1.0 / rmse if rmse > 0 else 1.0)

        if not individual_forecasts:
            return ExponentialSmoothingForecaster.simple(data, horizon=horizon)

        total_w = sum(weights)
        weights = [w / total_w for w in weights]

        # Weighted average forecast
        point = [0.0] * horizon
        for i, f in enumerate(individual_forecasts):
            for h in range(min(horizon, len(f.point_forecast))):
                point[h] += weights[i] * f.point_forecast[h]

        # Bounds from combined forecasts
        lower = [min(f.point_forecast[h] for f in individual_forecasts if h < len(f.point_forecast))
                 for h in range(horizon)]
        upper = [max(f.point_forecast[h] for f in individual_forecasts if h < len(f.point_forecast))
                 for h in range(horizon)]

        return ForecastResult(
            method="ensemble",
            point_forecast=point,
            lower_bound=lower,
            upper_bound=upper,
            metrics={"n_models": len(individual_forecasts), "weights": {methods[i]: round(weights[i], 4) for i in range(len(methods))}},
        )


# ── Orchestrator ──────────────────────────────────────────────────────

class TimeSeriesForecastingEngine:
    """Top-level orchestrator for time series forecasting."""

    def __init__(self) -> None:
        self.sma = SMAForecaster()
        self.ets = ExponentialSmoothingForecaster()
        self.ar = ARForecaster()
        self.ma = MAForecaster()
        self.garch = GARCHForecaster()
        self.regression = RegressionForecaster()
        self.decomposition = SeasonalDecomposition()
        self.change_points = ChangePointDetector()
        self.anomalies = AnomalyDetector()
        self.theta = ThetaForecaster()
        self.ensemble = EnsembleForecaster()
        self.metrics = ForecastMetrics()

    def forecast(
        self,
        data: list[float],
        method: str = "ensemble",
        horizon: int = 10,
        **kwargs,
    ) -> dict:
        method_map = {
            "sma": lambda: self.sma.forecast(data, horizon=horizon, **kwargs),
            "ses": lambda: self.ets.simple(data, horizon=horizon, **kwargs),
            "double_exp": lambda: self.ets.double(data, horizon=horizon, **kwargs),
            "holt_winters": lambda: self.ets.holt_winters(data, horizon=horizon, **kwargs),
            "ar": lambda: self.ar.forecast(data, horizon=horizon, **kwargs),
            "ma": lambda: self.ma.forecast(data, horizon=horizon, **kwargs),
            "linear": lambda: self.regression.linear(data, horizon=horizon),
            "polynomial": lambda: self.regression.polynomial(data, horizon=horizon, **kwargs),
            "theta": lambda: self.theta.forecast(data, horizon=horizon, **kwargs),
            "ensemble": lambda: self.ensemble.forecast(data, horizon=horizon),
        }

        forecaster = method_map.get(method, method_map["ensemble"])
        result = forecaster()
        return result.to_dict()

    def volatility_forecast(
        self,
        returns: list[float],
        method: str = "garch",
        horizon: int = 30,
    ) -> dict:
        if method == "garch":
            result = self.garch.forecast_volatility(returns, horizon=horizon)
        else:
            result = self.garch.ewma_volatility(returns, horizon=horizon)
        return result.to_dict()

    def decompose(
        self,
        data: list[float],
        period: int = 12,
        seasonality: str = "additive",
    ) -> dict:
        result = self.decomposition.decompose(data, period, seasonality)
        return result.to_dict()

    def detect_change_points(
        self,
        data: list[float],
        method: str = "cusum",
    ) -> list[dict]:
        if method == "cusum":
            cps = self.change_points.cusum(data)
        else:
            cps = self.change_points.binary_segmentation(data)
        return [cp.to_dict() for cp in cps]

    def detect_anomalies(
        self,
        data: list[float],
        method: str = "zscore",
        **kwargs,
    ) -> list[dict]:
        if method == "zscore":
            return self.anomalies.zscore_method(data, **kwargs)
        elif method == "iqr":
            return self.anomalies.iqr_method(data, **kwargs)
        else:
            return self.anomalies.moving_median_method(data, **kwargs)

    def compare_methods(
        self,
        data: list[float],
        horizon: int = 10,
    ) -> list[dict]:
        methods = ["ses", "double_exp", "ar", "linear", "theta", "sma"]
        results = []
        for m in methods:
            r = self.forecast(data, m, horizon)
            results.append(r)
        return results

    def capabilities(self) -> dict:
        return {
            "engine": "TimeSeriesForecastingEngine",
            "version": "1.0.0",
            "features": [
                "simple_moving_average",
                "exponential_smoothing (simple, double, Holt-Winters)",
                "autoregressive (AR) models",
                "moving_average (MA) models",
                "GARCH(1,1) volatility forecasting",
                "EWMA volatility (RiskMetrics)",
                "linear_regression forecasting",
                "polynomial_regression forecasting",
                "theta_method",
                "ensemble_forecasting (weighted combination)",
                "seasonal_decomposition (additive, multiplicative)",
                "change_point_detection (CUSUM, binary segmentation)",
                "anomaly_detection (z-score, IQR, MAD)",
                "forecast_metrics (MAE, RMSE, MAPE, sMAPE, R², Theil U)",
            ],
        }
