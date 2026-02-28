"""
Trade Journal Engine — Comprehensive trade journaling, analytics, and improvement tracking.

Covers:
  - Trade entry logging with detailed metadata
  - Trade tagging and categorization
  - Performance analytics by setup type, time, symbol, etc.
  - Streak analysis (win/loss streaks)
  - Emotional/discipline scoring
  - Trade review and lesson extraction
  - Calendar-based performance heatmap data
  - Equity curve generation
  - Trade comparison and similarity scoring
  - R-multiple analysis
  - Mistake categorization and tracking
  - Session analysis (AM/PM/overnight performance)
  - Day-of-week analysis
  - Monthly/weekly/daily P&L summaries
  - Trade duration analysis
  - Holding period analysis
  - Cost analysis (commissions, slippage impact)
  - Win rate by various dimensions
  - Expectancy tracking over time
"""

from __future__ import annotations

import math
import statistics
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any


# ── Enums ───────────────────────────────────────────────────────────────

class TradeDirection(Enum):
    LONG = "long"
    SHORT = "short"


class TradeStatus(Enum):
    OPEN = "open"
    CLOSED = "closed"
    CANCELLED = "cancelled"


class EmotionalState(Enum):
    CALM = "calm"
    ANXIOUS = "anxious"
    GREEDY = "greedy"
    FEARFUL = "fearful"
    FOMO = "fomo"
    REVENGE = "revenge"
    CONFIDENT = "confident"
    UNCERTAIN = "uncertain"
    FRUSTRATED = "frustrated"
    DISCIPLINED = "disciplined"


class SetupType(Enum):
    BREAKOUT = "breakout"
    PULLBACK = "pullback"
    REVERSAL = "reversal"
    TREND_FOLLOWING = "trend_following"
    MEAN_REVERSION = "mean_reversion"
    MOMENTUM = "momentum"
    RANGE_BOUND = "range_bound"
    GAP_FILL = "gap_fill"
    NEWS_CATALYST = "news_catalyst"
    EARNINGS_PLAY = "earnings_play"
    SCALP = "scalp"
    SWING = "swing"
    CUSTOM = "custom"


class MistakeType(Enum):
    EARLY_ENTRY = "early_entry"
    LATE_ENTRY = "late_entry"
    NO_STOP_LOSS = "no_stop_loss"
    MOVED_STOP = "moved_stop"
    OVERSIZED = "oversized"
    UNDERSIZED = "undersized"
    FOMO_ENTRY = "fomo_entry"
    REVENGE_TRADE = "revenge_trade"
    IGNORED_RULES = "ignored_rules"
    EARLY_EXIT = "early_exit"
    LATE_EXIT = "late_exit"
    AVERAGING_DOWN = "averaging_down"
    NO_PLAN = "no_plan"
    OVERTRADING = "overtrading"
    COUNTER_TREND = "counter_trend"


class TimeSession(Enum):
    PRE_MARKET = "pre_market"       # 4:00-9:30
    MORNING = "morning"             # 9:30-12:00
    MIDDAY = "midday"               # 12:00-14:00
    AFTERNOON = "afternoon"         # 14:00-16:00
    AFTER_HOURS = "after_hours"     # 16:00-20:00


# ── Data Classes ────────────────────────────────────────────────────────

@dataclass
class JournalTrade:
    """A single trade entry in the journal."""
    trade_id: str
    symbol: str
    direction: TradeDirection
    entry_price: float
    entry_time: datetime
    quantity: float
    status: TradeStatus = TradeStatus.OPEN
    exit_price: float | None = None
    exit_time: datetime | None = None
    stop_loss: float | None = None
    take_profit: float | None = None
    setup_type: SetupType = SetupType.CUSTOM
    emotional_state_entry: EmotionalState = EmotionalState.CALM
    emotional_state_exit: EmotionalState | None = None
    tags: list[str] = field(default_factory=list)
    notes: str = ""
    screenshot_url: str = ""
    mistakes: list[MistakeType] = field(default_factory=list)
    commission: float = 0.0
    slippage: float = 0.0
    planned_risk: float | None = None  # planned $ risk
    timeframe: str = "1D"
    confidence_level: int = 5  # 1-10
    followed_plan: bool = True
    lesson_learned: str = ""

    @property
    def pnl(self) -> float:
        if self.exit_price is None:
            return 0.0
        raw = (self.exit_price - self.entry_price) * self.quantity
        if self.direction == TradeDirection.SHORT:
            raw = -raw
        return raw - self.commission - self.slippage

    @property
    def pnl_pct(self) -> float:
        cost = self.entry_price * self.quantity
        if cost == 0:
            return 0.0
        return (self.pnl / cost) * 100

    @property
    def r_multiple(self) -> float | None:
        if self.planned_risk is None or self.planned_risk == 0:
            return None
        return self.pnl / self.planned_risk

    @property
    def holding_period(self) -> timedelta | None:
        if self.exit_time is None:
            return None
        return self.exit_time - self.entry_time

    @property
    def holding_hours(self) -> float | None:
        hp = self.holding_period
        if hp is None:
            return None
        return hp.total_seconds() / 3600

    @property
    def is_winner(self) -> bool:
        return self.pnl > 0

    @property
    def session(self) -> TimeSession:
        hour = self.entry_time.hour
        minute = self.entry_time.minute
        time_val = hour + minute / 60.0
        if time_val < 9.5:
            return TimeSession.PRE_MARKET
        elif time_val < 12.0:
            return TimeSession.MORNING
        elif time_val < 14.0:
            return TimeSession.MIDDAY
        elif time_val < 16.0:
            return TimeSession.AFTERNOON
        else:
            return TimeSession.AFTER_HOURS

    def to_dict(self) -> dict:
        return {
            "trade_id": self.trade_id,
            "symbol": self.symbol,
            "direction": self.direction.value,
            "entry_price": self.entry_price,
            "entry_time": self.entry_time.isoformat(),
            "exit_price": self.exit_price,
            "exit_time": self.exit_time.isoformat() if self.exit_time else None,
            "quantity": self.quantity,
            "status": self.status.value,
            "stop_loss": self.stop_loss,
            "take_profit": self.take_profit,
            "setup_type": self.setup_type.value,
            "emotional_state_entry": self.emotional_state_entry.value,
            "emotional_state_exit": self.emotional_state_exit.value if self.emotional_state_exit else None,
            "tags": self.tags,
            "notes": self.notes,
            "mistakes": [m.value for m in self.mistakes],
            "commission": self.commission,
            "slippage": self.slippage,
            "planned_risk": self.planned_risk,
            "pnl": round(self.pnl, 2),
            "pnl_pct": round(self.pnl_pct, 4),
            "r_multiple": round(self.r_multiple, 2) if self.r_multiple is not None else None,
            "holding_hours": round(self.holding_hours, 2) if self.holding_hours is not None else None,
            "is_winner": self.is_winner,
            "session": self.session.value,
            "confidence_level": self.confidence_level,
            "followed_plan": self.followed_plan,
            "lesson_learned": self.lesson_learned,
        }


# ── Trade Journal (in-memory store + analytics) ────────────────────────

class TradeJournal:
    """In-memory trade journal with full analytics."""

    def __init__(self) -> None:
        self._trades: list[JournalTrade] = []

    # ── CRUD ────────────────────────────────────────────────────────────

    def add_trade(self, trade: JournalTrade) -> str:
        self._trades.append(trade)
        return trade.trade_id

    def close_trade(
        self,
        trade_id: str,
        exit_price: float,
        exit_time: datetime,
        emotional_state_exit: EmotionalState = EmotionalState.CALM,
        mistakes: list[MistakeType] | None = None,
        lesson: str = "",
    ) -> JournalTrade | None:
        trade = self.get_trade(trade_id)
        if trade is None:
            return None
        trade.exit_price = exit_price
        trade.exit_time = exit_time
        trade.status = TradeStatus.CLOSED
        trade.emotional_state_exit = emotional_state_exit
        if mistakes:
            trade.mistakes.extend(mistakes)
        if lesson:
            trade.lesson_learned = lesson
        return trade

    def get_trade(self, trade_id: str) -> JournalTrade | None:
        for t in self._trades:
            if t.trade_id == trade_id:
                return t
        return None

    def get_all_trades(self) -> list[JournalTrade]:
        return list(self._trades)

    def get_closed_trades(self) -> list[JournalTrade]:
        return [t for t in self._trades if t.status == TradeStatus.CLOSED]

    def get_open_trades(self) -> list[JournalTrade]:
        return [t for t in self._trades if t.status == TradeStatus.OPEN]

    # ── Summary Analytics ───────────────────────────────────────────────

    def summary(self) -> dict:
        closed = self.get_closed_trades()
        if not closed:
            return {"total_trades": 0, "message": "No closed trades"}

        winners = [t for t in closed if t.is_winner]
        losers = [t for t in closed if not t.is_winner]
        pnls = [t.pnl for t in closed]
        win_pnls = [t.pnl for t in winners]
        loss_pnls = [t.pnl for t in losers]

        total_pnl = sum(pnls)
        win_rate = len(winners) / len(closed) if closed else 0.0
        avg_win = statistics.mean(win_pnls) if win_pnls else 0.0
        avg_loss = statistics.mean(loss_pnls) if loss_pnls else 0.0
        profit_factor = (sum(win_pnls) / abs(sum(loss_pnls))) if loss_pnls and sum(loss_pnls) != 0 else float("inf")
        expectancy = statistics.mean(pnls) if pnls else 0.0

        # Max drawdown
        equity = []
        running = 0.0
        for p in pnls:
            running += p
            equity.append(running)
        peak = equity[0]
        max_dd = 0.0
        for e in equity:
            if e > peak:
                peak = e
            dd = peak - e
            if dd > max_dd:
                max_dd = dd

        # Total costs
        total_commission = sum(t.commission for t in closed)
        total_slippage = sum(t.slippage for t in closed)

        return {
            "total_trades": len(closed),
            "winners": len(winners),
            "losers": len(losers),
            "win_rate": round(win_rate, 4),
            "total_pnl": round(total_pnl, 2),
            "avg_win": round(avg_win, 2),
            "avg_loss": round(avg_loss, 2),
            "largest_win": round(max(win_pnls), 2) if win_pnls else 0,
            "largest_loss": round(min(loss_pnls), 2) if loss_pnls else 0,
            "profit_factor": round(profit_factor, 4) if profit_factor != float("inf") else "inf",
            "expectancy": round(expectancy, 2),
            "max_drawdown": round(max_dd, 2),
            "total_commission": round(total_commission, 2),
            "total_slippage": round(total_slippage, 2),
            "net_after_costs": round(total_pnl - total_commission - total_slippage, 2),
        }


# ── Performance by Dimension ───────────────────────────────────────────

class PerformanceAnalyzer:
    """Analyze trade performance across multiple dimensions."""

    def __init__(self, trades: list[JournalTrade]) -> None:
        self._trades = [t for t in trades if t.status == TradeStatus.CLOSED]

    def by_setup_type(self) -> dict[str, dict]:
        groups: dict[str, list[JournalTrade]] = {}
        for t in self._trades:
            key = t.setup_type.value
            groups.setdefault(key, []).append(t)
        return {k: self._group_stats(v) for k, v in groups.items()}

    def by_symbol(self) -> dict[str, dict]:
        groups: dict[str, list[JournalTrade]] = {}
        for t in self._trades:
            groups.setdefault(t.symbol, []).append(t)
        return {k: self._group_stats(v) for k, v in groups.items()}

    def by_session(self) -> dict[str, dict]:
        groups: dict[str, list[JournalTrade]] = {}
        for t in self._trades:
            key = t.session.value
            groups.setdefault(key, []).append(t)
        return {k: self._group_stats(v) for k, v in groups.items()}

    def by_day_of_week(self) -> dict[str, dict]:
        days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        groups: dict[str, list[JournalTrade]] = {}
        for t in self._trades:
            key = days[t.entry_time.weekday()]
            groups.setdefault(key, []).append(t)
        return {k: self._group_stats(v) for k, v in groups.items()}

    def by_direction(self) -> dict[str, dict]:
        groups: dict[str, list[JournalTrade]] = {}
        for t in self._trades:
            key = t.direction.value
            groups.setdefault(key, []).append(t)
        return {k: self._group_stats(v) for k, v in groups.items()}

    def by_tag(self) -> dict[str, dict]:
        groups: dict[str, list[JournalTrade]] = {}
        for t in self._trades:
            for tag in t.tags:
                groups.setdefault(tag, []).append(t)
        return {k: self._group_stats(v) for k, v in groups.items()}

    def by_confidence(self) -> dict[int, dict]:
        groups: dict[int, list[JournalTrade]] = {}
        for t in self._trades:
            groups.setdefault(t.confidence_level, []).append(t)
        return {k: self._group_stats(v) for k, v in groups.items()}

    def by_month(self) -> dict[str, dict]:
        groups: dict[str, list[JournalTrade]] = {}
        for t in self._trades:
            key = t.entry_time.strftime("%Y-%m")
            groups.setdefault(key, []).append(t)
        return {k: self._group_stats(v) for k, v in sorted(groups.items())}

    def by_week(self) -> dict[str, dict]:
        groups: dict[str, list[JournalTrade]] = {}
        for t in self._trades:
            iso = t.entry_time.isocalendar()
            key = f"{iso[0]}-W{iso[1]:02d}"
            groups.setdefault(key, []).append(t)
        return {k: self._group_stats(v) for k, v in sorted(groups.items())}

    def _group_stats(self, trades: list[JournalTrade]) -> dict:
        pnls = [t.pnl for t in trades]
        winners = [t for t in trades if t.is_winner]
        losers = [t for t in trades if not t.is_winner]
        win_pnls = [t.pnl for t in winners]
        loss_pnls = [t.pnl for t in losers]
        return {
            "trades": len(trades),
            "win_rate": round(len(winners) / len(trades), 4) if trades else 0.0,
            "total_pnl": round(sum(pnls), 2),
            "avg_pnl": round(statistics.mean(pnls), 2) if pnls else 0.0,
            "avg_win": round(statistics.mean(win_pnls), 2) if win_pnls else 0.0,
            "avg_loss": round(statistics.mean(loss_pnls), 2) if loss_pnls else 0.0,
            "profit_factor": round(sum(win_pnls) / abs(sum(loss_pnls)), 4)
            if loss_pnls and sum(loss_pnls) != 0 else float("inf") if win_pnls else 0.0,
        }


# ── Streak Analysis ────────────────────────────────────────────────────

class StreakAnalyzer:
    """Analyze win/loss streaks."""

    def __init__(self, trades: list[JournalTrade]) -> None:
        self._trades = sorted(
            [t for t in trades if t.status == TradeStatus.CLOSED],
            key=lambda t: t.entry_time,
        )

    def current_streak(self) -> dict:
        if not self._trades:
            return {"type": "none", "length": 0}
        results = [t.is_winner for t in self._trades]
        streak_type = "win" if results[-1] else "loss"
        length = 0
        for r in reversed(results):
            if r == results[-1]:
                length += 1
            else:
                break
        return {"type": streak_type, "length": length}

    def max_win_streak(self) -> int:
        return self._max_streak(True)

    def max_loss_streak(self) -> int:
        return self._max_streak(False)

    def all_streaks(self) -> list[dict]:
        if not self._trades:
            return []
        results = [t.is_winner for t in self._trades]
        streaks = []
        current_type = results[0]
        length = 1
        for i in range(1, len(results)):
            if results[i] == current_type:
                length += 1
            else:
                streaks.append({
                    "type": "win" if current_type else "loss",
                    "length": length,
                })
                current_type = results[i]
                length = 1
        streaks.append({"type": "win" if current_type else "loss", "length": length})
        return streaks

    def streak_stats(self) -> dict:
        streaks = self.all_streaks()
        win_streaks = [s["length"] for s in streaks if s["type"] == "win"]
        loss_streaks = [s["length"] for s in streaks if s["type"] == "loss"]
        return {
            "current": self.current_streak(),
            "max_win_streak": max(win_streaks) if win_streaks else 0,
            "max_loss_streak": max(loss_streaks) if loss_streaks else 0,
            "avg_win_streak": round(statistics.mean(win_streaks), 2) if win_streaks else 0.0,
            "avg_loss_streak": round(statistics.mean(loss_streaks), 2) if loss_streaks else 0.0,
            "total_streaks": len(streaks),
        }

    def _max_streak(self, is_win: bool) -> int:
        if not self._trades:
            return 0
        results = [t.is_winner for t in self._trades]
        max_s = 0
        current = 0
        for r in results:
            if r == is_win:
                current += 1
                max_s = max(max_s, current)
            else:
                current = 0
        return max_s


# ── R-Multiple Analysis ────────────────────────────────────────────────

class RMultipleAnalyzer:
    """Analyze trades in terms of R-multiples (risk units)."""

    def __init__(self, trades: list[JournalTrade]) -> None:
        self._trades = [t for t in trades if t.status == TradeStatus.CLOSED and t.r_multiple is not None]

    def distribution(self) -> dict:
        if not self._trades:
            return {"count": 0}
        r_vals = [t.r_multiple for t in self._trades]
        return {
            "count": len(r_vals),
            "mean_r": round(statistics.mean(r_vals), 2),
            "median_r": round(statistics.median(r_vals), 2),
            "stdev_r": round(statistics.stdev(r_vals), 2) if len(r_vals) > 1 else 0.0,
            "min_r": round(min(r_vals), 2),
            "max_r": round(max(r_vals), 2),
            "positive_r_pct": round(sum(1 for r in r_vals if r > 0) / len(r_vals), 4),
            "above_2r_pct": round(sum(1 for r in r_vals if r >= 2) / len(r_vals), 4),
            "above_3r_pct": round(sum(1 for r in r_vals if r >= 3) / len(r_vals), 4),
        }

    def histogram(self, bins: int = 10) -> list[dict]:
        if not self._trades:
            return []
        r_vals = sorted(t.r_multiple for t in self._trades)
        min_r = r_vals[0]
        max_r = r_vals[-1]
        bin_width = (max_r - min_r) / bins if max_r != min_r else 1.0
        result = []
        for i in range(bins):
            lo = min_r + i * bin_width
            hi = lo + bin_width
            count = sum(1 for r in r_vals if lo <= r < hi or (i == bins - 1 and r == hi))
            result.append({
                "bin_low": round(lo, 2),
                "bin_high": round(hi, 2),
                "count": count,
            })
        return result

    def expectancy_in_r(self) -> float:
        if not self._trades:
            return 0.0
        return round(statistics.mean(t.r_multiple for t in self._trades), 4)

    def sqn(self) -> float:
        """System Quality Number = mean(R) / stdev(R) * sqrt(N)."""
        if len(self._trades) < 2:
            return 0.0
        r_vals = [t.r_multiple for t in self._trades]
        mean_r = statistics.mean(r_vals)
        std_r = statistics.stdev(r_vals)
        if std_r == 0:
            return 0.0
        return round(mean_r / std_r * math.sqrt(len(r_vals)), 4)


# ── Discipline Scorer ───────────────────────────────────────────────────

class DisciplineScorer:
    """Score trading discipline based on plan adherence and emotions."""

    def __init__(self, trades: list[JournalTrade]) -> None:
        self._trades = [t for t in trades if t.status == TradeStatus.CLOSED]

    def score(self) -> dict:
        if not self._trades:
            return {"score": 0, "grade": "N/A"}

        plan_adherence = sum(1 for t in self._trades if t.followed_plan) / len(self._trades)
        mistake_rate = sum(len(t.mistakes) for t in self._trades) / len(self._trades)
        calm_entry_rate = sum(
            1 for t in self._trades
            if t.emotional_state_entry in (EmotionalState.CALM, EmotionalState.DISCIPLINED, EmotionalState.CONFIDENT)
        ) / len(self._trades)

        # Weighted score: 50% plan adherence, 30% low mistake rate, 20% calm entry
        mistake_penalty = min(mistake_rate / 3.0, 1.0)  # cap at 3 mistakes per trade = 0 score
        raw_score = (plan_adherence * 0.5 + (1 - mistake_penalty) * 0.3 + calm_entry_rate * 0.2) * 100

        grade = self._grade(raw_score)

        return {
            "score": round(raw_score, 1),
            "grade": grade,
            "plan_adherence": round(plan_adherence * 100, 1),
            "avg_mistakes_per_trade": round(mistake_rate, 2),
            "calm_entry_rate": round(calm_entry_rate * 100, 1),
        }

    def mistake_breakdown(self) -> dict[str, int]:
        counts: dict[str, int] = {}
        for t in self._trades:
            for m in t.mistakes:
                counts[m.value] = counts.get(m.value, 0) + 1
        return dict(sorted(counts.items(), key=lambda x: x[1], reverse=True))

    def emotional_breakdown(self) -> dict:
        entry_counts: dict[str, int] = {}
        exit_counts: dict[str, int] = {}
        for t in self._trades:
            entry_counts[t.emotional_state_entry.value] = entry_counts.get(t.emotional_state_entry.value, 0) + 1
            if t.emotional_state_exit:
                exit_counts[t.emotional_state_exit.value] = exit_counts.get(t.emotional_state_exit.value, 0) + 1
        return {"entry_emotions": entry_counts, "exit_emotions": exit_counts}

    @staticmethod
    def _grade(score: float) -> str:
        if score >= 95:
            return "A+"
        elif score >= 90:
            return "A"
        elif score >= 85:
            return "A-"
        elif score >= 80:
            return "B+"
        elif score >= 75:
            return "B"
        elif score >= 70:
            return "B-"
        elif score >= 65:
            return "C+"
        elif score >= 60:
            return "C"
        elif score >= 50:
            return "D"
        else:
            return "F"


# ── Equity Curve Builder ───────────────────────────────────────────────

class EquityCurveBuilder:
    """Build equity curves from trade history."""

    def __init__(self, trades: list[JournalTrade], starting_capital: float = 100000.0) -> None:
        self._trades = sorted(
            [t for t in trades if t.status == TradeStatus.CLOSED],
            key=lambda t: t.exit_time or t.entry_time,
        )
        self._starting_capital = starting_capital

    def trade_by_trade(self) -> list[dict]:
        """Equity curve point per trade."""
        curve = [{"trade_num": 0, "equity": self._starting_capital, "pnl": 0}]
        equity = self._starting_capital
        for i, t in enumerate(self._trades, 1):
            equity += t.pnl
            curve.append({
                "trade_num": i,
                "equity": round(equity, 2),
                "pnl": round(t.pnl, 2),
                "cumulative_pnl": round(equity - self._starting_capital, 2),
            })
        return curve

    def daily_equity(self) -> list[dict]:
        """Equity curve aggregated by day."""
        if not self._trades:
            return []
        daily: dict[str, float] = {}
        for t in self._trades:
            day = (t.exit_time or t.entry_time).strftime("%Y-%m-%d")
            daily[day] = daily.get(day, 0) + t.pnl
        curve = []
        equity = self._starting_capital
        for day in sorted(daily.keys()):
            equity += daily[day]
            curve.append({"date": day, "equity": round(equity, 2), "daily_pnl": round(daily[day], 2)})
        return curve

    def drawdown_series(self) -> list[dict]:
        """Drawdown at each trade."""
        curve = self.trade_by_trade()
        peak = self._starting_capital
        result = []
        for pt in curve:
            if pt["equity"] > peak:
                peak = pt["equity"]
            dd = (peak - pt["equity"]) / peak * 100 if peak > 0 else 0
            result.append({
                "trade_num": pt["trade_num"],
                "drawdown_pct": round(dd, 4),
                "peak": round(peak, 2),
                "equity": pt["equity"],
            })
        return result

    def underwater_periods(self) -> list[dict]:
        """Periods where equity is below peak."""
        dd = self.drawdown_series()
        periods = []
        in_dd = False
        start_idx = 0
        for pt in dd:
            if pt["drawdown_pct"] > 0 and not in_dd:
                in_dd = True
                start_idx = pt["trade_num"]
            elif pt["drawdown_pct"] == 0 and in_dd:
                in_dd = False
                periods.append({
                    "start_trade": start_idx,
                    "end_trade": pt["trade_num"],
                    "length": pt["trade_num"] - start_idx,
                })
        if in_dd:
            periods.append({
                "start_trade": start_idx,
                "end_trade": dd[-1]["trade_num"],
                "length": dd[-1]["trade_num"] - start_idx,
                "ongoing": True,
            })
        return periods


# ── Holding Period Analysis ─────────────────────────────────────────────

class HoldingPeriodAnalyzer:
    """Analyze relationship between holding period and performance."""

    def __init__(self, trades: list[JournalTrade]) -> None:
        self._trades = [t for t in trades if t.status == TradeStatus.CLOSED and t.holding_hours is not None]

    def stats(self) -> dict:
        if not self._trades:
            return {"count": 0}
        hours = [t.holding_hours for t in self._trades]
        return {
            "count": len(hours),
            "avg_hours": round(statistics.mean(hours), 2),
            "median_hours": round(statistics.median(hours), 2),
            "min_hours": round(min(hours), 2),
            "max_hours": round(max(hours), 2),
        }

    def pnl_by_duration_bucket(self) -> dict[str, dict]:
        """Group trades into holding period buckets."""
        buckets: dict[str, list[JournalTrade]] = {
            "scalp_<1h": [],
            "intraday_1-8h": [],
            "swing_8-48h": [],
            "position_48h+": [],
        }
        for t in self._trades:
            h = t.holding_hours
            if h < 1:
                buckets["scalp_<1h"].append(t)
            elif h < 8:
                buckets["intraday_1-8h"].append(t)
            elif h < 48:
                buckets["swing_8-48h"].append(t)
            else:
                buckets["position_48h+"].append(t)

        result = {}
        for name, trades in buckets.items():
            if not trades:
                result[name] = {"trades": 0}
                continue
            pnls = [t.pnl for t in trades]
            winners = [t for t in trades if t.is_winner]
            result[name] = {
                "trades": len(trades),
                "win_rate": round(len(winners) / len(trades), 4),
                "total_pnl": round(sum(pnls), 2),
                "avg_pnl": round(statistics.mean(pnls), 2),
            }
        return result

    def optimal_holding_period(self) -> dict:
        """Find which holding period bucket has best expectancy."""
        by_bucket = self.pnl_by_duration_bucket()
        best_bucket = None
        best_avg = float("-inf")
        for name, stats in by_bucket.items():
            if stats["trades"] > 0 and stats.get("avg_pnl", 0) > best_avg:
                best_avg = stats["avg_pnl"]
                best_bucket = name
        return {"optimal_bucket": best_bucket, "avg_pnl": round(best_avg, 2) if best_bucket else 0}


# ── Calendar Heatmap Data ──────────────────────────────────────────────

class CalendarHeatmapBuilder:
    """Build calendar heatmap data from trades."""

    def __init__(self, trades: list[JournalTrade]) -> None:
        self._trades = [t for t in trades if t.status == TradeStatus.CLOSED]

    def daily_pnl_map(self) -> dict[str, float]:
        """Map of date -> total P&L for that day."""
        daily: dict[str, float] = {}
        for t in self._trades:
            day = (t.exit_time or t.entry_time).strftime("%Y-%m-%d")
            daily[day] = daily.get(day, 0) + t.pnl
        return {k: round(v, 2) for k, v in sorted(daily.items())}

    def monthly_summary(self) -> dict[str, dict]:
        """Monthly P&L summary."""
        monthly: dict[str, list[float]] = {}
        for t in self._trades:
            month = (t.exit_time or t.entry_time).strftime("%Y-%m")
            monthly.setdefault(month, []).append(t.pnl)
        result = {}
        for month, pnls in sorted(monthly.items()):
            result[month] = {
                "total_pnl": round(sum(pnls), 2),
                "trades": len(pnls),
                "avg_pnl": round(statistics.mean(pnls), 2),
                "best_day": round(max(pnls), 2),
                "worst_day": round(min(pnls), 2),
            }
        return result

    def weekly_summary(self) -> dict[str, dict]:
        """Weekly P&L summary."""
        weekly: dict[str, list[float]] = {}
        for t in self._trades:
            dt = t.exit_time or t.entry_time
            iso = dt.isocalendar()
            key = f"{iso[0]}-W{iso[1]:02d}"
            weekly.setdefault(key, []).append(t.pnl)
        result = {}
        for week, pnls in sorted(weekly.items()):
            result[week] = {
                "total_pnl": round(sum(pnls), 2),
                "trades": len(pnls),
                "avg_pnl": round(statistics.mean(pnls), 2),
            }
        return result


# ── Trade Similarity / Comparison ──────────────────────────────────────

class TradeComparator:
    """Compare trades to find similar setups and outcomes."""

    @staticmethod
    def similarity_score(t1: JournalTrade, t2: JournalTrade) -> float:
        """Score 0-1 measuring how similar two trades are."""
        score = 0.0
        weights = 0.0

        # Same symbol
        weights += 2.0
        if t1.symbol == t2.symbol:
            score += 2.0

        # Same direction
        weights += 1.0
        if t1.direction == t2.direction:
            score += 1.0

        # Same setup type
        weights += 3.0
        if t1.setup_type == t2.setup_type:
            score += 3.0

        # Similar time of day (within 1 hour)
        weights += 1.0
        h1 = t1.entry_time.hour + t1.entry_time.minute / 60
        h2 = t2.entry_time.hour + t2.entry_time.minute / 60
        time_diff = abs(h1 - h2)
        if time_diff <= 1:
            score += 1.0
        elif time_diff <= 2:
            score += 0.5

        # Similar confidence
        weights += 1.0
        if abs(t1.confidence_level - t2.confidence_level) <= 1:
            score += 1.0
        elif abs(t1.confidence_level - t2.confidence_level) <= 2:
            score += 0.5

        # Overlapping tags
        weights += 2.0
        if t1.tags and t2.tags:
            common = set(t1.tags) & set(t2.tags)
            all_tags = set(t1.tags) | set(t2.tags)
            if all_tags:
                score += 2.0 * len(common) / len(all_tags)

        return round(score / weights, 4) if weights > 0 else 0.0

    def find_similar(self, target: JournalTrade, trades: list[JournalTrade], top_n: int = 5) -> list[dict]:
        scored = []
        for t in trades:
            if t.trade_id == target.trade_id:
                continue
            sim = self.similarity_score(target, t)
            scored.append({"trade_id": t.trade_id, "similarity": sim, "pnl": round(t.pnl, 2), "symbol": t.symbol})
        scored.sort(key=lambda x: x["similarity"], reverse=True)
        return scored[:top_n]


# ── Cost Analysis ──────────────────────────────────────────────────────

class CostAnalyzer:
    """Analyze trading costs impact."""

    def __init__(self, trades: list[JournalTrade]) -> None:
        self._trades = [t for t in trades if t.status == TradeStatus.CLOSED]

    def total_costs(self) -> dict:
        if not self._trades:
            return {"total_commission": 0, "total_slippage": 0, "total_cost": 0}
        total_c = sum(t.commission for t in self._trades)
        total_s = sum(t.slippage for t in self._trades)
        gross_pnl = sum(
            ((t.exit_price - t.entry_price) * t.quantity * (1 if t.direction == TradeDirection.LONG else -1))
            for t in self._trades if t.exit_price is not None
        )
        net_pnl = sum(t.pnl for t in self._trades)
        return {
            "total_commission": round(total_c, 2),
            "total_slippage": round(total_s, 2),
            "total_cost": round(total_c + total_s, 2),
            "gross_pnl": round(gross_pnl, 2),
            "net_pnl": round(net_pnl, 2),
            "cost_as_pct_of_gross": round((total_c + total_s) / abs(gross_pnl) * 100, 2) if gross_pnl != 0 else 0.0,
            "avg_cost_per_trade": round((total_c + total_s) / len(self._trades), 2),
        }

    def cost_impact_on_winners(self) -> dict:
        """How many winners would flip to losers without costs."""
        winners = [t for t in self._trades if t.is_winner]
        flipped = 0
        for t in winners:
            gross = (t.exit_price - t.entry_price) * t.quantity
            if t.direction == TradeDirection.SHORT:
                gross = -gross
            # gross is before costs — if costs > gross, it's only a winner because costs are negative?
            # Actually pnl = gross - commission - slippage, and t.is_winner means pnl > 0
            # A winner that would flip: gross - 0 < 0 but that can't happen if pnl > 0 and costs >= 0
            # What we want: trades where gross profit < costs
            if gross <= 0 and t.pnl > 0:
                flipped += 1
        marginal = sum(1 for t in winners if t.pnl < (t.commission + t.slippage) * 2)
        return {
            "total_winners": len(winners),
            "marginal_winners": marginal,  # winners where P&L < 2x costs
            "cost_sensitive_pct": round(marginal / len(winners) * 100, 2) if winners else 0.0,
        }


# ── Orchestrator ────────────────────────────────────────────────────────

class TradeJournalEngine:
    """Top-level orchestrator for the trade journal system."""

    def __init__(self, starting_capital: float = 100000.0) -> None:
        self.journal = TradeJournal()
        self.starting_capital = starting_capital

    def add_trade(self, trade: JournalTrade) -> str:
        return self.journal.add_trade(trade)

    def close_trade(self, trade_id: str, exit_price: float, exit_time: datetime, **kwargs) -> dict | None:
        t = self.journal.close_trade(trade_id, exit_price, exit_time, **kwargs)
        return t.to_dict() if t else None

    def get_summary(self) -> dict:
        return self.journal.summary()

    def get_performance_by(self, dimension: str) -> dict:
        pa = PerformanceAnalyzer(self.journal.get_all_trades())
        dispatch = {
            "setup": pa.by_setup_type,
            "symbol": pa.by_symbol,
            "session": pa.by_session,
            "day_of_week": pa.by_day_of_week,
            "direction": pa.by_direction,
            "tag": pa.by_tag,
            "confidence": pa.by_confidence,
            "month": pa.by_month,
            "week": pa.by_week,
        }
        fn = dispatch.get(dimension)
        if fn is None:
            return {"error": f"Unknown dimension: {dimension}", "available": list(dispatch.keys())}
        return fn()

    def get_streaks(self) -> dict:
        sa = StreakAnalyzer(self.journal.get_all_trades())
        return sa.streak_stats()

    def get_r_analysis(self) -> dict:
        ra = RMultipleAnalyzer(self.journal.get_all_trades())
        return {
            "distribution": ra.distribution(),
            "expectancy_r": ra.expectancy_in_r(),
            "sqn": ra.sqn(),
            "histogram": ra.histogram(),
        }

    def get_discipline_score(self) -> dict:
        ds = DisciplineScorer(self.journal.get_all_trades())
        return {
            "score": ds.score(),
            "mistake_breakdown": ds.mistake_breakdown(),
            "emotions": ds.emotional_breakdown(),
        }

    def get_equity_curve(self) -> list[dict]:
        ecb = EquityCurveBuilder(self.journal.get_all_trades(), self.starting_capital)
        return ecb.trade_by_trade()

    def get_daily_equity(self) -> list[dict]:
        ecb = EquityCurveBuilder(self.journal.get_all_trades(), self.starting_capital)
        return ecb.daily_equity()

    def get_drawdowns(self) -> list[dict]:
        ecb = EquityCurveBuilder(self.journal.get_all_trades(), self.starting_capital)
        return ecb.drawdown_series()

    def get_holding_analysis(self) -> dict:
        hpa = HoldingPeriodAnalyzer(self.journal.get_all_trades())
        return {
            "stats": hpa.stats(),
            "by_duration": hpa.pnl_by_duration_bucket(),
            "optimal": hpa.optimal_holding_period(),
        }

    def get_calendar_heatmap(self) -> dict:
        chb = CalendarHeatmapBuilder(self.journal.get_all_trades())
        return {
            "daily": chb.daily_pnl_map(),
            "monthly": chb.monthly_summary(),
            "weekly": chb.weekly_summary(),
        }

    def get_cost_analysis(self) -> dict:
        ca = CostAnalyzer(self.journal.get_all_trades())
        return {
            "totals": ca.total_costs(),
            "impact": ca.cost_impact_on_winners(),
        }

    def find_similar_trades(self, trade_id: str, top_n: int = 5) -> list[dict]:
        target = self.journal.get_trade(trade_id)
        if target is None:
            return []
        tc = TradeComparator()
        return tc.find_similar(target, self.journal.get_all_trades(), top_n)

    def capabilities(self) -> dict:
        return {
            "engine": "TradeJournalEngine",
            "version": "1.0.0",
            "features": [
                "trade_logging",
                "performance_by_setup",
                "performance_by_symbol",
                "performance_by_session",
                "performance_by_day_of_week",
                "performance_by_direction",
                "performance_by_tag",
                "performance_by_confidence",
                "performance_by_month",
                "performance_by_week",
                "streak_analysis",
                "r_multiple_analysis",
                "system_quality_number",
                "discipline_scoring",
                "equity_curve",
                "drawdown_analysis",
                "holding_period_analysis",
                "calendar_heatmap",
                "cost_analysis",
                "trade_similarity",
            ],
            "dimensions": [
                "setup", "symbol", "session", "day_of_week",
                "direction", "tag", "confidence", "month", "week",
            ],
        }
