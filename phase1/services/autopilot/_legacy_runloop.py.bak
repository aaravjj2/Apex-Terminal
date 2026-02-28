"""
Runloop Module
Orchestrates a complete autopilot cycle: scan → select → execute → monitor.
"""

from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any, Callable
from datetime import datetime, date
from enum import Enum
import logging
import traceback

from .config import AutopilotConfig, AutopilotMode
from .universe import UniverseManager
from .features import FeatureEngine
from .candidates import CandidateGenerator, TradeCandidate
from .selector import CandidateSelector, DeterministicRanker, SelectionResult, create_selector
from .validator import TradeValidator, BatchValidationResult
from .paper_broker import PaperBroker, PaperOrder, OrderStatus
from .alpaca_broker import AlpacaOptionsBroker  # Use Alpaca-enabled broker
from .position_manager import PositionManager, PortfolioState
from .monitor import PositionMonitor, MonitoringResult
from .reporting import ReportGenerator, ActivityLogger, DailyReport

logger = logging.getLogger(__name__)


class RunloopState(Enum):
    """State of the autopilot runloop"""
    IDLE = "idle"
    RUNNING = "running"
    PAUSED = "paused"
    ERROR = "error"


@dataclass
class CycleResult:
    """Result of a single autopilot cycle"""
    cycle_id: str
    started_at: datetime
    completed_at: datetime
    success: bool
    
    # Candidate phase
    candidates_generated: int
    candidates_by_template: Dict[str, int]
    
    # Selection phase
    selected_count: int
    rejected_count: int
    selection_method: str
    
    # Validation phase
    valid_count: int
    invalid_count: int
    validation_errors: List[str]
    
    # Execution phase
    orders_submitted: int
    orders_filled: int
    orders_rejected: int
    
    # Monitoring phase
    exit_signals: int
    exits_executed: int
    risk_alerts: int
    
    # Error info
    error_message: Optional[str] = None
    error_traceback: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "cycle_id": self.cycle_id,
            "started_at": self.started_at.isoformat(),
            "completed_at": self.completed_at.isoformat(),
            "duration_ms": (self.completed_at - self.started_at).total_seconds() * 1000,
            "success": self.success,
            "candidates": {
                "generated": self.candidates_generated,
                "by_template": self.candidates_by_template,
            },
            "selection": {
                "selected": self.selected_count,
                "rejected": self.rejected_count,
                "method": self.selection_method,
            },
            "validation": {
                "valid": self.valid_count,
                "invalid": self.invalid_count,
                "errors": self.validation_errors,
            },
            "execution": {
                "submitted": self.orders_submitted,
                "filled": self.orders_filled,
                "rejected": self.orders_rejected,
            },
            "monitoring": {
                "exit_signals": self.exit_signals,
                "exits_executed": self.exits_executed,
                "risk_alerts": self.risk_alerts,
            },
            "error": {
                "message": self.error_message,
                "traceback": self.error_traceback,
            } if self.error_message else None,
        }


class AutopilotRunloop:
    """
    Main autopilot orchestration loop.
    Coordinates all components for paper trading.
    """
    
    def __init__(
        self,
        config: AutopilotConfig,
        data_provider: Optional[Any] = None,
        llm_provider: Optional[Any] = None,
    ):
        """
        Initialize autopilot runloop.
        
        Args:
            config: Autopilot configuration
            data_provider: Optional data provider for options chains
            llm_provider: Optional LLM provider for selection
        """
        self.config = config
        self.data_provider = data_provider
        self.llm_provider = llm_provider
        
        # Initialize components
        self.universe = UniverseManager(config.universe)
        self.features = FeatureEngine()
        self.candidate_gen = CandidateGenerator(config, self.universe, self.features)
        self.selector = create_selector(config, llm_provider)
        self.validator = TradeValidator(config, self.universe)
        self.broker = AlpacaOptionsBroker(deterministic=True, alpaca_enabled=config.enable_alpaca)  # Alpaca-enabled
        self.positions = PositionManager(initial_equity=config.paper_equity)
        self.monitor = PositionMonitor(config, self.positions, self.broker)
        self.reporter = ReportGenerator(config, self.positions)
        self.activity_log = ActivityLogger()
        
        # State
        self._state = RunloopState.IDLE
        self._cycle_counter = 0
        self._last_cycle_result: Optional[CycleResult] = None
        self._no_trade_reasons: List[str] = []
    
    @property
    def state(self) -> RunloopState:
        return self._state
    
    @property
    def last_cycle_result(self) -> Optional[CycleResult]:
        return self._last_cycle_result
    
    def run_cycle(
        self,
        option_chains: Optional[Dict[str, Any]] = None,
        current_prices: Optional[Dict[str, float]] = None,
        market_context: Optional[Dict[str, Any]] = None,
    ) -> CycleResult:
        """
        Run a single autopilot cycle.
        
        Args:
            option_chains: Options chain data (or fetched from provider)
            current_prices: Current underlying prices
            market_context: Market regime and forecast data
            
        Returns:
            CycleResult with full cycle details
        """
        self._cycle_counter += 1
        cycle_id = f"R{self._cycle_counter:06d}"
        started_at = datetime.utcnow()
        
        self._state = RunloopState.RUNNING
        self._no_trade_reasons = []
        
        self.activity_log.log(
            "cycle_start",
            f"Starting autopilot cycle {cycle_id}",
            level="info",
        )
        
        # Initialize result with defaults
        result_data = {
            "cycle_id": cycle_id,
            "started_at": started_at,
            "candidates_generated": 0,
            "candidates_by_template": {},
            "selected_count": 0,
            "rejected_count": 0,
            "selection_method": "none",
            "valid_count": 0,
            "invalid_count": 0,
            "validation_errors": [],
            "orders_submitted": 0,
            "orders_filled": 0,
            "orders_rejected": 0,
            "exit_signals": 0,
            "exits_executed": 0,
            "risk_alerts": 0,
        }
        
        try:
            # Check if paused
            if self.config.mode == AutopilotMode.PAUSED:
                self._no_trade_reasons.append("Autopilot is paused")
                raise ValueError("Autopilot is paused")
            
            # Check kill switch
            if self.validator.kill_switch_active:
                self._no_trade_reasons.append("Kill switch is active")
                raise ValueError("Kill switch is active")
            
            # Fetch data if not provided
            if option_chains is None or current_prices is None:
                option_chains, current_prices = self._fetch_market_data()
            
            market_context = market_context or {}
            
            # Phase 1: Generate candidates
            candidates = self._phase_generate_candidates(
                option_chains, current_prices, result_data
            )
            
            if not candidates:
                self._no_trade_reasons.append("No viable candidates generated")
            
            # Phase 2: Select candidates
            selection_result = self._phase_select_candidates(
                candidates, market_context, result_data
            )
            
            # Phase 3: Validate selected candidates
            validated = self._phase_validate_candidates(
                selection_result.selected, result_data
            )
            
            # Phase 4: Execute trades
            self._phase_execute_trades(validated, candidates, result_data)
            
            # Phase 5: Monitor positions
            self._phase_monitor_positions(market_context, result_data)
            
            # Success
            completed_at = datetime.utcnow()
            result = CycleResult(
                success=True,
                completed_at=completed_at,
                **result_data
            )
            
            self.activity_log.log(
                "cycle_complete",
                f"Cycle {cycle_id} completed successfully",
                level="info",
                details={"duration_ms": (completed_at - started_at).total_seconds() * 1000},
            )
            
        except Exception as e:
            # Error handling
            completed_at = datetime.utcnow()
            result = CycleResult(
                success=False,
                completed_at=completed_at,
                error_message=str(e),
                error_traceback=traceback.format_exc(),
                **result_data
            )
            
            self.activity_log.log(
                "cycle_error",
                f"Cycle {cycle_id} failed: {str(e)}",
                level="error",
                details={"traceback": traceback.format_exc()},
            )
            
            self._state = RunloopState.ERROR
        
        finally:
            if self._state == RunloopState.RUNNING:
                self._state = RunloopState.IDLE
        
        # Log cycle
        self.reporter.log_cycle(
            started_at=started_at,
            candidates_generated=result.candidates_generated,
            selection_result=selection_result if 'selection_result' in dir() else None,
            trades_executed=result.orders_filled,
            monitoring_result=None,
            error=Exception(result.error_message) if result.error_message else None,
        )
        
        self._last_cycle_result = result
        return result
    
    def _fetch_market_data(self) -> tuple:
        """Fetch market data from Tradier/yFinance provider with mock fallback."""
        if self.data_provider is None:
            return self._get_mock_market_data()
        
        # Fetch from real data provider (Tradier + yFinance)
        symbols = [s.symbol for s in self.universe.get_tradeable_symbols()]
        option_chains = {}
        current_prices = {}
        
        for symbol in symbols:
            try:
                # Get stock price from yFinance/Tradier
                price = self.data_provider.get_stock_price(symbol)
                if price > 0:
                    current_prices[symbol] = price
                
                # Get options chain from Tradier
                chain = self.data_provider.get_options_chain(symbol)
                if chain:
                    option_chains[symbol] = self._convert_chain_format(chain, price)
                    
            except Exception as e:
                logger.warning(f"Failed to fetch data for {symbol}: {e}")
        
        # Log what we got
        logger.info(f"Fetched prices for {len(current_prices)} symbols, chains for {len(option_chains)}")
        
        # If we got no option chains, fall back to mock data
        if not option_chains:
            logger.warning("No real option chains available - using mock data")
            return self._get_mock_market_data()
        
        return option_chains, current_prices
    
    def _convert_chain_format(self, chain, price) -> Dict:
        """Convert OptionQuote list to expected chain format."""
        from datetime import datetime
        
        chains_by_expiry = {}
        for opt in chain:
            exp_str = opt.expiry.isoformat()
            if exp_str not in chains_by_expiry:
                chains_by_expiry[exp_str] = {"puts": [], "calls": []}
            
            opt_data = {
                "strike": opt.strike,
                "bid": opt.bid,
                "ask": opt.ask,
                "last": opt.last,
                "iv": opt.implied_vol,
                "delta": opt.delta,
                "gamma": opt.gamma,
                "theta": opt.theta,
                "vega": opt.vega,
                "volume": opt.volume,
                "oi": opt.open_interest,
            }
            
            if opt.option_type == "put":
                chains_by_expiry[exp_str]["puts"].append(opt_data)
            else:
                chains_by_expiry[exp_str]["calls"].append(opt_data)
        
        return {
            "expirations": list(chains_by_expiry.keys()),
            "chains": chains_by_expiry,
            "underlying_price": price,
        }
    
    def _get_mock_market_data(self) -> tuple:
        """Get mock market data for testing."""
        from datetime import timedelta
        
        symbols = [s.symbol for s in self.universe.get_tradeable_symbols()]
        option_chains = {}
        current_prices = {}
        
        # Mock prices
        mock_prices = {
            "AAPL": 185.0, "MSFT": 380.0, "NVDA": 480.0, "GOOGL": 140.0,
            "META": 350.0, "AMZN": 155.0, "AMD": 120.0, "TSLA": 250.0,
            "SPY": 475.0, "QQQ": 410.0, "IWM": 200.0, "DIA": 380.0,
            "XLK": 190.0, "SMH": 200.0, "XLF": 40.0, "XLE": 85.0,
            "TLT": 95.0, "GLD": 190.0,
        }
        
        for symbol in symbols:
            price = mock_prices.get(symbol, 100.0)
            current_prices[symbol] = price
            
            # Generate mock chain
            expiries = []
            today = date.today()
            for weeks in [2, 3, 4, 5, 6]:
                expiries.append((today + timedelta(weeks=weeks)).isoformat())
            
            chain = {"expirations": expiries, "chains": {}}
            
            for exp in expiries:
                puts = []
                calls = []
                
                # Generate strikes around price
                for strike_offset in range(-5, 6):
                    strike = round(price * (1 + strike_offset * 0.02), 0)
                    
                    # Rough premium calculation
                    otm_pct = abs(strike_offset) * 0.02
                    base_premium = price * 0.02 * (1 - otm_pct)
                    
                    puts.append({
                        "strike": strike,
                        "bid": max(0.05, base_premium * 0.95),
                        "ask": base_premium * 1.05,
                        "delta": -0.5 + strike_offset * 0.05,
                        "iv": 0.25,
                    })
                    
                    calls.append({
                        "strike": strike,
                        "bid": max(0.05, base_premium * 0.95),
                        "ask": base_premium * 1.05,
                        "delta": 0.5 - strike_offset * 0.05,
                        "iv": 0.25,
                    })
                
                chain["chains"][exp] = {"puts": puts, "calls": calls}
            
            option_chains[symbol] = chain
        
        return option_chains, current_prices
    
    def _phase_generate_candidates(
        self,
        option_chains: Dict[str, Any],
        current_prices: Dict[str, float],
        result_data: Dict[str, Any],
    ) -> List[TradeCandidate]:
        """Phase 1: Generate trade candidates."""
        self.activity_log.log("phase_candidates", "Generating candidates...")
        
        candidates = self.candidate_gen.generate_candidates(
            option_chains=option_chains,
            current_prices=current_prices,
        )
        
        result_data["candidates_generated"] = len(candidates)
        
        # Count by template
        by_template: Dict[str, int] = {}
        for c in candidates:
            t = c.template.value
            by_template[t] = by_template.get(t, 0) + 1
        result_data["candidates_by_template"] = by_template
        
        self.activity_log.log(
            "candidates_generated",
            f"Generated {len(candidates)} candidates",
            details={"by_template": by_template},
        )
        
        return candidates
    
    def _phase_select_candidates(
        self,
        candidates: List[TradeCandidate],
        market_context: Dict[str, Any],
        result_data: Dict[str, Any],
    ) -> SelectionResult:
        """Phase 2: Select candidates."""
        self.activity_log.log("phase_selection", "Selecting candidates...")
        
        portfolio_state = self.positions.get_portfolio_state().to_dict()
        
        selection_result = self.selector.select(
            candidates=candidates,
            config=self.config,
            portfolio_state=portfolio_state,
            market_context=market_context,
        )
        
        result_data["selected_count"] = len(selection_result.selected)
        result_data["rejected_count"] = len(selection_result.rejected)
        result_data["selection_method"] = selection_result.method
        
        self.activity_log.log(
            "selection_complete",
            f"Selected {len(selection_result.selected)}/{len(candidates)} candidates",
            details={"method": selection_result.method, "rationale": selection_result.rationale},
        )
        
        return selection_result
    
    def _phase_validate_candidates(
        self,
        selected: List[TradeCandidate],
        result_data: Dict[str, Any],
    ) -> List[TradeCandidate]:
        """Phase 3: Validate selected candidates."""
        self.activity_log.log("phase_validation", "Validating candidates...")
        
        portfolio_state = self.positions.get_portfolio_state().to_dict()
        
        validation_result = self.validator.validate_batch(
            candidates=selected,
            portfolio_state=portfolio_state,
        )
        
        result_data["valid_count"] = len(validation_result.valid)
        result_data["invalid_count"] = len(validation_result.invalid)
        result_data["validation_errors"] = [
            f"{c.id}: {', '.join(r.rejection_details)}"
            for c, r in validation_result.invalid
        ]
        
        self.activity_log.log(
            "validation_complete",
            f"Validated {len(validation_result.valid)}/{len(selected)} candidates",
            details={"invalid_reasons": result_data["validation_errors"]},
        )
        
        return validation_result.valid
    
    def _phase_execute_trades(
        self,
        validated: List[TradeCandidate],
        all_candidates: List[TradeCandidate],
        result_data: Dict[str, Any],
    ) -> None:
        """Phase 4: Execute paper trades."""
        self.activity_log.log("phase_execution", "Executing trades...")
        
        filled = 0
        rejected = 0
        
        for candidate in validated:
            try:
                # Submit order
                order = self.broker.submit_order(candidate)
                result_data["orders_submitted"] += 1
                
                # Execute order
                self.broker.execute_order(order.order_id)
                
                if order.status == OrderStatus.FILLED:
                    # Create position
                    self.positions.create_position_from_order(order, candidate)
                    filled += 1
                    
                    self.activity_log.log(
                        "trade_executed",
                        f"Executed {candidate.symbol} {candidate.template.value}",
                        details={"candidate_id": candidate.id, "order_id": order.order_id},
                    )
                else:
                    rejected += 1
                    
            except Exception as e:
                logger.error(f"Failed to execute trade for {candidate.id}: {e}")
                rejected += 1
        
        result_data["orders_filled"] = filled
        result_data["orders_rejected"] = rejected
        
        self.activity_log.log(
            "execution_complete",
            f"Executed {filled} trades, {rejected} rejected",
        )
    
    def _phase_monitor_positions(
        self,
        market_context: Dict[str, Any],
        result_data: Dict[str, Any],
    ) -> MonitoringResult:
        """Phase 5: Monitor positions and execute exits."""
        self.activity_log.log("phase_monitoring", "Monitoring positions...")
        
        monitoring_result = self.monitor.run_monitoring_cycle(
            market_data=market_context.get("market_data"),
            auto_execute_exits=True,
        )
        
        result_data["exit_signals"] = len(monitoring_result.exit_signals)
        result_data["exits_executed"] = monitoring_result.exits_executed
        result_data["risk_alerts"] = len(monitoring_result.risk_alerts)
        
        # Log alerts
        for alert in monitoring_result.risk_alerts:
            self.activity_log.log(
                "risk_alert",
                alert.message,
                level="warning" if alert.severity == "warning" else "error",
                details=alert.to_dict(),
            )
        
        self.activity_log.log(
            "monitoring_complete",
            f"Monitoring: {len(monitoring_result.exit_signals)} signals, {monitoring_result.exits_executed} exits",
        )
        
        return monitoring_result
    
    # Public control methods
    
    def pause(self) -> None:
        """Pause the autopilot."""
        self.config.mode = AutopilotMode.PAUSED
        self._state = RunloopState.PAUSED
        self.activity_log.log("autopilot_paused", "Autopilot paused")
    
    def resume(self) -> None:
        """Resume the autopilot."""
        self.config.mode = AutopilotMode.PAPER
        self._state = RunloopState.IDLE
        self.activity_log.log("autopilot_resumed", "Autopilot resumed")
    
    def activate_kill_switch(self, close_all: bool = False) -> None:
        """Activate kill switch."""
        self.validator.activate_kill_switch()
        self.activity_log.log(
            "kill_switch_activated",
            "Kill switch activated",
            level="warning",
        )
        
        if close_all:
            self._close_all_positions()
    
    def deactivate_kill_switch(self) -> None:
        """Deactivate kill switch."""
        self.validator.deactivate_kill_switch()
        self.activity_log.log("kill_switch_deactivated", "Kill switch deactivated")
    
    def _close_all_positions(self) -> None:
        """Close all open positions."""
        for position in self.positions.get_open_positions():
            try:
                exit_order = self.broker.close_position(
                    symbol=position.symbol,
                    legs=position.legs,
                    reason="kill_switch",
                )
                self.positions.close_position(
                    position_id=position.position_id,
                    exit_order=exit_order,
                    reason="kill_switch",
                )
            except Exception as e:
                logger.error(f"Failed to close position {position.position_id}: {e}")
    
    def get_status(self) -> Dict[str, Any]:
        """Get current autopilot status."""
        portfolio = self.positions.get_portfolio_state()
        
        return {
            "state": self._state.value,
            "mode": self.config.mode.value,
            "kill_switch_active": self.validator.kill_switch_active,
            "last_cycle": self._last_cycle_result.to_dict() if self._last_cycle_result else None,
            "portfolio": portfolio.to_dict(),
            "open_positions": len(self.positions.get_open_positions()),
            "broker_metrics": self.broker.get_metrics().to_dict(),
        }
    
    def get_daily_report(self) -> DailyReport:
        """Generate daily report."""
        return self.reporter.generate_daily_report(
            no_trade_reasons=self._no_trade_reasons,
            alerts=[a.message for a in self.monitor.get_active_alerts()],
        )
    
    def get_activity_log(self, limit: int = 100) -> List[Dict[str, Any]]:
        """Get recent activity log entries."""
        return self.activity_log.get_entries(limit=limit)
