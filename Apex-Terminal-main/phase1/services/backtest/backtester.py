"""
Backtester - Historical replay engine for strategy backtesting.
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Type, Any
from datetime import datetime, timedelta
from enum import Enum
import hashlib
import json
import logging
import os

from ..strategy.base_strategy import BaseStrategy, Bar, StrategyContext, StrategyState
from ..portfolio.manager import PortfolioManager
from ..portfolio.risk_manager import RiskManager, RiskLimits
from ..execution.order_types import Order, OrderType, OrderSide, OrderStatus, TimeInForce
from .fill_simulator import FillSimulator, SlippageConfig, CommissionConfig


logger = logging.getLogger(__name__)


class DataProvider(str, Enum):
    YFINANCE = "yfinance"
    ALPACA = "alpaca"
    FINNHUB = "finnhub"


@dataclass
class BacktestConfig:
    """Configuration for a backtest run."""
    symbol: str
    start_date: datetime
    end_date: datetime
    timeframe: str = "1m"
    initial_capital: float = 100000.0
    data_provider: DataProvider = DataProvider.YFINANCE
    slippage: Optional[SlippageConfig] = None
    commission: Optional[CommissionConfig] = None
    seed: Optional[int] = None
    
    def to_dict(self) -> dict:
        return {
            "symbol": self.symbol,
            "start_date": self.start_date.isoformat(),
            "end_date": self.end_date.isoformat(),
            "timeframe": self.timeframe,
            "initial_capital": self.initial_capital,
            "data_provider": self.data_provider.value,
            "seed": self.seed,
        }


@dataclass
class BacktestResult:
    """Results from a backtest run."""
    config: BacktestConfig
    strategy_name: str
    
    # Performance metrics
    initial_capital: float
    final_equity: float
    total_return: float
    total_return_pct: float
    
    # Trade statistics
    total_trades: int
    winning_trades: int
    losing_trades: int
    win_rate: float
    
    # Risk metrics
    max_drawdown: float
    max_drawdown_pct: float
    sharpe_ratio: float
    sortino_ratio: float
    
    # Equity curve
    equity_curve: List[Dict[str, Any]]
    
    # Trade log
    trades: List[Dict[str, Any]]
    
    # Determinism
    config_hash: str
    trade_log_hash: str
    equity_curve_hash: str
    
    def to_dict(self) -> dict:
        return {
            "config": self.config.to_dict(),
            "strategy_name": self.strategy_name,
            "metrics": {
                "initial_capital": self.initial_capital,
                "final_equity": self.final_equity,
                "total_return": self.total_return,
                "total_return_pct": self.total_return_pct,
                "total_trades": self.total_trades,
                "winning_trades": self.winning_trades,
                "losing_trades": self.losing_trades,
                "win_rate": self.win_rate,
                "max_drawdown": self.max_drawdown,
                "max_drawdown_pct": self.max_drawdown_pct,
                "sharpe_ratio": self.sharpe_ratio,
                "sortino_ratio": self.sortino_ratio,
            },
            "hashes": {
                "config": self.config_hash,
                "trade_log": self.trade_log_hash,
                "equity_curve": self.equity_curve_hash,
            },
        }


class Backtester:
    """
    Historical backtesting engine.
    
    Features:
    - Deterministic replay using historical data
    - Multiple data providers (yfinance, Alpaca, Finnhub)
    - Configurable slippage and commission
    - Trade log with canonical hashing for reproducibility
    """
    
    def __init__(
        self,
        config: BacktestConfig,
        risk_limits: Optional[RiskLimits] = None,
    ):
        self.config = config
        
        # Initialize components
        self.portfolio = PortfolioManager(initial_cash=config.initial_capital)
        self.risk_manager = RiskManager(self.portfolio, risk_limits)
        self.fill_simulator = FillSimulator(
            slippage=config.slippage,
            commission=config.commission,
        )
        
        # Order management
        self.orders: Dict[str, Order] = {}
        self._order_counter = 0
        
        # Equity curve tracking
        self.equity_curve: List[Dict[str, Any]] = []
        self.max_equity = config.initial_capital
        self.max_drawdown = 0.0
        
        # Current state
        self.current_bar_index = 0
        self.current_time: Optional[datetime] = None
        self.prev_close: Optional[float] = None
        
        # Strategy
        self.strategy: Optional[BaseStrategy] = None
    
    def _generate_order_id(self) -> str:
        self._order_counter += 1
        return f"BT-{self._order_counter:06d}"
    
    def load_data(self) -> List[Bar]:
        """Load historical data from configured provider."""
        provider = self.config.data_provider
        
        if provider == DataProvider.YFINANCE:
            return self._load_yfinance()
        elif provider == DataProvider.ALPACA:
            return self._load_alpaca()
        elif provider == DataProvider.FINNHUB:
            return self._load_finnhub()
        else:
            raise ValueError(f"Unknown data provider: {provider}")
    
    def _load_yfinance(self) -> List[Bar]:
        """Load data from yfinance."""
        try:
            import yfinance as yf
        except ImportError:
            raise ImportError("yfinance not installed. Run: pip install yfinance")
        
        symbol = self.config.symbol
        start = self.config.start_date.strftime("%Y-%m-%d")
        end = self.config.end_date.strftime("%Y-%m-%d")
        
        # Map timeframe
        tf_map = {
            "1m": "1m", "5m": "5m", "15m": "15m", "30m": "30m",
            "1h": "1h", "1d": "1d",
        }
        interval = tf_map.get(self.config.timeframe, "1d")
        
        logger.info(f"Loading {symbol} from yfinance: {start} to {end}, interval={interval}")
        
        ticker = yf.Ticker(symbol)
        df = ticker.history(start=start, end=end, interval=interval)
        
        if df.empty:
            raise ValueError(f"No data returned for {symbol}")
        
        bars = []
        for i, (idx, row) in enumerate(df.iterrows()):
            bars.append(Bar(
                symbol=symbol,
                timestamp=idx.to_pydatetime(),
                open=float(row["Open"]),
                high=float(row["High"]),
                low=float(row["Low"]),
                close=float(row["Close"]),
                volume=float(row["Volume"]),
                bar_index=i,
            ))
        
        logger.info(f"Loaded {len(bars)} bars from yfinance")
        return bars
    
    def _load_alpaca(self) -> List[Bar]:
        """Load data from Alpaca historical API."""
        # Check for API keys
        api_key = os.environ.get("APCA_API_KEY_ID")
        api_secret = os.environ.get("APCA_API_SECRET_KEY")
        
        if not api_key or not api_secret:
            raise ValueError("Alpaca API keys not set. Set APCA_API_KEY_ID and APCA_API_SECRET_KEY")
        
        try:
            from alpaca.data import StockHistoricalDataClient
            from alpaca.data.requests import StockBarsRequest
            from alpaca.data.timeframe import TimeFrame
        except ImportError:
            raise ImportError("alpaca-py not installed. Run: pip install alpaca-py")
        
        client = StockHistoricalDataClient(api_key, api_secret)
        
        # Map timeframe
        tf_map = {
            "1m": TimeFrame.Minute, "5m": TimeFrame.Minute,
            "1h": TimeFrame.Hour, "1d": TimeFrame.Day,
        }
        timeframe = tf_map.get(self.config.timeframe, TimeFrame.Day)
        
        request = StockBarsRequest(
            symbol_or_symbols=self.config.symbol,
            start=self.config.start_date,
            end=self.config.end_date,
            timeframe=timeframe,
        )
        
        data = client.get_stock_bars(request)
        df = data.df
        
        bars = []
        for i, (idx, row) in enumerate(df.iterrows()):
            bars.append(Bar(
                symbol=self.config.symbol,
                timestamp=idx[1] if isinstance(idx, tuple) else idx,
                open=float(row["open"]),
                high=float(row["high"]),
                low=float(row["low"]),
                close=float(row["close"]),
                volume=float(row["volume"]),
                bar_index=i,
            ))
        
        logger.info(f"Loaded {len(bars)} bars from Alpaca")
        return bars
    
    def _load_finnhub(self) -> List[Bar]:
        """Load data from Finnhub REST API."""
        api_key = os.environ.get("FINNHUB_API_KEY")
        
        if not api_key:
            raise ValueError("Finnhub API key not set. Set FINNHUB_API_KEY")
        
        import requests
        
        # Finnhub uses Unix timestamps
        start_ts = int(self.config.start_date.timestamp())
        end_ts = int(self.config.end_date.timestamp())
        
        # Map timeframe to resolution
        res_map = {
            "1m": "1", "5m": "5", "15m": "15", "30m": "30",
            "1h": "60", "1d": "D",
        }
        resolution = res_map.get(self.config.timeframe, "D")
        
        url = f"https://finnhub.io/api/v1/stock/candle"
        params = {
            "symbol": self.config.symbol,
            "resolution": resolution,
            "from": start_ts,
            "to": end_ts,
            "token": api_key,
        }
        
        response = requests.get(url, params=params)
        data = response.json()
        
        if data.get("s") != "ok":
            raise ValueError(f"Finnhub error: {data}")
        
        bars = []
        for i in range(len(data["t"])):
            bars.append(Bar(
                symbol=self.config.symbol,
                timestamp=datetime.fromtimestamp(data["t"][i]),
                open=float(data["o"][i]),
                high=float(data["h"][i]),
                low=float(data["l"][i]),
                close=float(data["c"][i]),
                volume=float(data["v"][i]),
                bar_index=i,
            ))
        
        logger.info(f"Loaded {len(bars)} bars from Finnhub")
        return bars
    
    def _place_order(
        self,
        symbol: str,
        side: OrderSide,
        quantity: float,
        order_type: OrderType,
        limit_price: Optional[float] = None,
        stop_price: Optional[float] = None,
        time_in_force: TimeInForce = TimeInForce.DAY,
    ) -> Optional[Order]:
        """Place an order (called by strategy context)."""
        # Get current price for risk check
        price = limit_price or stop_price or self.prev_close or 0
        
        # Risk check
        check = self.risk_manager.check_order(
            symbol=symbol,
            side=side.value,
            quantity=quantity,
            price=price,
        )
        
        if not check.passed:
            logger.warning(f"Order rejected by risk manager: {check.rejection_reasons}")
            return None
        
        order = Order(
            id=self._generate_order_id(),
            symbol=symbol,
            side=side,
            quantity=quantity,
            order_type=order_type,
            limit_price=limit_price,
            stop_price=stop_price,
            time_in_force=time_in_force,
            status=OrderStatus.SUBMITTED,
            submitted_at=self.current_time,
        )
        
        self.orders[order.id] = order
        logger.debug(f"Order placed: {order.id} {side.value} {quantity} {symbol}")
        
        return order
    
    def _cancel_order(self, order_id: str) -> bool:
        """Cancel an order."""
        if order_id not in self.orders:
            return False
        
        order = self.orders[order_id]
        if order.is_active:
            order.status = OrderStatus.CANCELLED
            return True
        return False
    
    def _get_orders(self, symbol: Optional[str] = None) -> List[Order]:
        """Get open orders."""
        orders = [o for o in self.orders.values() if o.is_active]
        if symbol:
            orders = [o for o in orders if o.symbol == symbol]
        return orders
    
    def _process_orders(self, bar: Bar) -> None:
        """Process pending orders against current bar."""
        for order in list(self.orders.values()):
            if not order.is_active:
                continue
            
            fill = self.fill_simulator.process_order(
                order=order,
                bar_open=bar.open,
                bar_high=bar.high,
                bar_low=bar.low,
                bar_close=bar.close,
                prev_close=self.prev_close,
                timestamp=bar.timestamp,
            )
            
            if fill:
                self.fill_simulator.apply_fill(order, fill)
                
                # Update portfolio
                self.portfolio.execute_fill(
                    symbol=fill.symbol,
                    side=fill.side.value,
                    quantity=fill.quantity,
                    price=fill.price,
                    timestamp=fill.timestamp,
                    commission=fill.commission,
                )
                
                # Notify strategy
                if self.strategy:
                    self.strategy.on_order_fill(order)
                
                logger.debug(f"Order filled: {order.id} @ {fill.price}")
    
    def _update_equity_curve(self, bar: Bar) -> None:
        """Update equity curve with current bar."""
        # Update position prices
        self.portfolio.update_price(bar.symbol, bar.close)
        
        equity = self.portfolio.equity
        
        # Track max equity and drawdown
        if equity > self.max_equity:
            self.max_equity = equity
        
        drawdown = self.max_equity - equity
        if drawdown > self.max_drawdown:
            self.max_drawdown = drawdown
        
        self.equity_curve.append({
            "timestamp": bar.timestamp.isoformat(),
            "bar_index": bar.bar_index,
            "equity": equity,
            "cash": self.portfolio.cash,
            "drawdown": drawdown,
        })
    
    def run(self, strategy: BaseStrategy) -> BacktestResult:
        """
        Run a backtest with the given strategy.
        
        Args:
            strategy: Strategy instance to run
        
        Returns:
            BacktestResult with metrics, trades, and hashes
        """
        self.strategy = strategy
        
        # Load historical data
        bars = self.load_data()
        
        if not bars:
            raise ValueError("No data loaded for backtest")
        
        # Set up strategy context
        context = StrategyContext(
            portfolio=self.portfolio,
            current_time=bars[0].timestamp,
            bar_index=0,
            _place_order=self._place_order,
            _cancel_order=self._cancel_order,
            _get_orders=self._get_orders,
        )
        
        strategy.set_context(context)
        strategy.on_init()
        strategy.on_start()
        
        # Main backtest loop
        for bar in bars:
            self.current_bar_index = bar.bar_index
            self.current_time = bar.timestamp
            context.current_time = bar.timestamp
            context.bar_index = bar.bar_index
            
            # Process pending orders at bar open
            self._process_orders(bar)
            
            # Call strategy
            try:
                strategy.on_bar(bar)
            except Exception as e:
                logger.error(f"Strategy error at bar {bar.bar_index}: {e}")
                strategy.on_error(e)
            
            # Update equity curve
            self._update_equity_curve(bar)
            
            # Store previous close
            self.prev_close = bar.close
        
        # Clean up
        strategy.on_stop()
        
        # Calculate results
        return self._calculate_results(strategy)
    
    def _calculate_results(self, strategy: BaseStrategy) -> BacktestResult:
        """Calculate backtest metrics and create result."""
        trades = self.portfolio.trades
        
        # Trade statistics
        winning = [t for t in trades if t.net_value > t.gross_value]
        losing = [t for t in trades if t.net_value <= t.gross_value]
        
        # Returns
        initial = self.config.initial_capital
        final = self.portfolio.equity
        total_return = final - initial
        total_return_pct = (total_return / initial) * 100 if initial > 0 else 0
        
        # Risk metrics
        max_dd_pct = (self.max_drawdown / self.max_equity) * 100 if self.max_equity > 0 else 0
        
        # Sharpe & Sortino (simplified - daily returns)
        returns = []
        for i in range(1, len(self.equity_curve)):
            prev_eq = self.equity_curve[i-1]["equity"]
            curr_eq = self.equity_curve[i]["equity"]
            if prev_eq > 0:
                returns.append((curr_eq - prev_eq) / prev_eq)
        
        if returns:
            import math
            avg_return = sum(returns) / len(returns)
            std_dev = math.sqrt(sum((r - avg_return) ** 2 for r in returns) / len(returns))
            sharpe = (avg_return / std_dev) * math.sqrt(252) if std_dev > 0 else 0
            
            neg_returns = [r for r in returns if r < 0]
            downside_std = math.sqrt(sum(r ** 2 for r in neg_returns) / len(neg_returns)) if neg_returns else 0
            sortino = (avg_return / downside_std) * math.sqrt(252) if downside_std > 0 else 0
        else:
            sharpe = 0
            sortino = 0
        
        # Create canonical trade log for hashing
        trade_log = [t.to_dict() for t in trades]
        trade_log_json = json.dumps(trade_log, sort_keys=True)
        trade_log_hash = hashlib.sha256(trade_log_json.encode()).hexdigest()
        
        # Equity curve hash
        eq_curve_json = json.dumps(self.equity_curve, sort_keys=True)
        eq_curve_hash = hashlib.sha256(eq_curve_json.encode()).hexdigest()
        
        # Config hash
        config_json = json.dumps(self.config.to_dict(), sort_keys=True)
        config_hash = hashlib.sha256(config_json.encode()).hexdigest()
        
        return BacktestResult(
            config=self.config,
            strategy_name=strategy.name,
            initial_capital=initial,
            final_equity=final,
            total_return=total_return,
            total_return_pct=total_return_pct,
            total_trades=len(trades),
            winning_trades=len(winning),
            losing_trades=len(losing),
            win_rate=len(winning) / len(trades) * 100 if trades else 0,
            max_drawdown=self.max_drawdown,
            max_drawdown_pct=max_dd_pct,
            sharpe_ratio=sharpe,
            sortino_ratio=sortino,
            equity_curve=self.equity_curve,
            trades=trade_log,
            config_hash=config_hash,
            trade_log_hash=trade_log_hash,
            equity_curve_hash=eq_curve_hash,
        )
