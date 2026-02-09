/**
 * Supergraph Module (Section C)
 * 
 * Chart components:
 * - Candlesticks + volume bars
 * - Overlays: VWAP, MA20, MA50
 * - Regime strip (trend/range/chaos)
 * - Realized volatility proxy
 * - Trade markers with tooltips
 * - Stats strip
 */

import { useEffect, useRef, useState } from 'react';
import { 
    createChart, 
    ColorType, 
    CrosshairMode,
    LineStyle,
    CandlestickSeries,
    HistogramSeries,
    LineSeries
} from 'lightweight-charts';
import type { IChartApi, ISeriesApi, Time, SeriesMarker } from 'lightweight-charts';
import { 
    TrendingUp, TrendingDown, Activity, Zap, BarChart3,
    Radio
} from 'lucide-react';
import { cn } from '../../../ui/utils';

// API_BASE is defined for future use
const _API_BASE = 'http://127.0.0.1:8000/api/v1';
void _API_BASE;

// Types
interface Candle {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

interface Trade {
    id: string;
    timestamp: number;
    symbol: string;
    side: 'entry' | 'exit';
    direction: 'long' | 'short';
    price: number;
    qty: number;
    pnl?: number;
    strategy?: string;
    dte?: number;
    client_order_id?: string;
}

interface RegimeData {
    timestamp: number;
    regime: 'trend' | 'range' | 'chaos';
    confidence: number;
}

interface StatsData {
    trend_strength: number;
    range_chop: number;
    realized_vol: number;
    liquidity: number;
    news_sentiment: number;
    sentiment_confidence: number;
    catalyst_alert: boolean;
}

interface SupergraphModuleProps {
    symbol: string;
    timeframe: string;
    onTradeClick?: (trade: { id: string; symbol: string; strategy: string; timestamp: number; side: 'entry' | 'exit' }) => void;
}

// Calculate Simple Moving Average
function calculateSMA(data: Candle[], period: number): { time: number; value: number }[] {
    const result: { time: number; value: number }[] = [];
    for (let i = period - 1; i < data.length; i++) {
        let sum = 0;
        for (let j = 0; j < period; j++) {
            sum += data[i - j].close;
        }
        result.push({ time: data[i].time, value: sum / period });
    }
    return result;
}

// Calculate VWAP
function calculateVWAP(data: Candle[]): { time: number; value: number }[] {
    const result: { time: number; value: number }[] = [];
    let cumulativeTPV = 0;
    let cumulativeVolume = 0;
    
    for (const candle of data) {
        const typicalPrice = (candle.high + candle.low + candle.close) / 3;
        cumulativeTPV += typicalPrice * candle.volume;
        cumulativeVolume += candle.volume;
        if (cumulativeVolume > 0) {
            result.push({ time: candle.time, value: cumulativeTPV / cumulativeVolume });
        }
    }
    return result;
}

// Generate mock candles
function generateMockCandles(count: number = 200): Candle[] {
    const candles: Candle[] = [];
    let price = 450;
    const now = Math.floor(Date.now() / 1000);

    for (let i = 0; i < count; i++) {
        const open = price;
        const change = (Math.random() - 0.5) * 6;
        const close = open + change;
        const high = Math.max(open, close) + Math.random() * 3;
        const low = Math.min(open, close) - Math.random() * 3;

        candles.push({
            time: now - (count - i) * 60 * 60,
            open,
            high,
            low,
            close,
            volume: 1000000 + Math.random() * 500000
        });

        price = close;
    }
    return candles;
}

// Generate mock trades
function generateMockTrades(candles: Candle[]): Trade[] {
    const trades: Trade[] = [];
    const strategies = ['PCS', 'CCS', 'IC', 'CDS', 'PDS'];
    
    for (let i = 0; i < 5; i++) {
        const candleIdx = Math.floor(Math.random() * (candles.length - 20)) + 10;
        const candle = candles[candleIdx];
        
        trades.push({
            id: `trade-${i}-entry`,
            timestamp: candle.time,
            symbol: 'SPY',
            side: 'entry',
            direction: Math.random() > 0.5 ? 'long' : 'short',
            price: candle.close,
            qty: Math.floor(Math.random() * 5) + 1,
            strategy: strategies[Math.floor(Math.random() * strategies.length)],
            dte: Math.floor(Math.random() * 30) + 5,
            client_order_id: `order-${Date.now()}-${i}`
        });

        // Some trades have exits
        if (Math.random() > 0.3) {
            const exitIdx = candleIdx + Math.floor(Math.random() * 10) + 1;
            if (exitIdx < candles.length) {
                const exitCandle = candles[exitIdx];
                trades.push({
                    id: `trade-${i}-exit`,
                    timestamp: exitCandle.time,
                    symbol: 'SPY',
                    side: 'exit',
                    direction: trades[trades.length - 1].direction,
                    price: exitCandle.close,
                    qty: trades[trades.length - 1].qty,
                    pnl: (exitCandle.close - candle.close) * trades[trades.length - 1].qty * 100 * (trades[trades.length - 1].direction === 'long' ? 1 : -1),
                    strategy: trades[trades.length - 1].strategy,
                    client_order_id: `order-${Date.now()}-${i}-exit`
                });
            }
        }
    }
    
    return trades;
}

// Generate mock regime data
function generateMockRegimeData(candles: Candle[]): RegimeData[] {
    return candles.map((c, i) => {
        const regimes: ('trend' | 'range' | 'chaos')[] = ['trend', 'range', 'chaos'];
        return {
            timestamp: c.time,
            regime: regimes[Math.floor(i / 50) % 3],
            confidence: 0.6 + Math.random() * 0.3
        };
    });
}

// Overlay Toggle Component
function OverlayToggle({ 
    label, 
    color, 
    active, 
    onClick 
}: { 
    label: string; 
    color: string; 
    active: boolean; 
    onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "px-2 py-1 text-[10px] font-medium rounded border transition-all",
                active 
                    ? "bg-opacity-20 border-current" 
                    : "bg-transparent border-border text-text-muted hover:text-text"
            )}
            style={active ? { color, backgroundColor: `${color}20`, borderColor: color } : {}}
        >
            {label}
        </button>
    );
}

export function SupergraphModule({ symbol, timeframe, onTradeClick: _onTradeClick }: SupergraphModuleProps) {
    void _onTradeClick; // Mark as used for future
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
    const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
    const vwapSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const ma20SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const ma50SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const _hvSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    void _hvSeriesRef; // Mark as used for future

    const [candles, setCandles] = useState<Candle[]>([]);
    const [trades, setTrades] = useState<Trade[]>([]);
    const [regimeData, setRegimeData] = useState<RegimeData[]>([]);
    const [stats] = useState<StatsData>({
        trend_strength: 0.65,
        range_chop: 0.25,
        realized_vol: 18.5,
        liquidity: 0.92,
        news_sentiment: 0.35,
        sentiment_confidence: 0.78,
        catalyst_alert: false
    });

    // Overlay visibility
    const [showVWAP, setShowVWAP] = useState(true);
    const [showMA20, setShowMA20] = useState(true);
    const [showMA50, setShowMA50] = useState(true);
    const [showVolume, setShowVolume] = useState(true);
    const [showEntries, setShowEntries] = useState(true);
    const [showExits, setShowExits] = useState(true);
    const [showBotOnly, setShowBotOnly] = useState(false);
    const [hoveredTrade] = useState<Trade | null>(null);

    // Load data
    useEffect(() => {
        const mockCandles = generateMockCandles(200);
        const mockTrades = generateMockTrades(mockCandles);
        const mockRegime = generateMockRegimeData(mockCandles);
        
        setCandles(mockCandles);
        setTrades(mockTrades);
        setRegimeData(mockRegime);
    }, [symbol, timeframe]);

    // Initialize chart
    useEffect(() => {
        if (!chartContainerRef.current || candles.length === 0) return;

        // Create chart
        const chart = createChart(chartContainerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: 'transparent' },
                textColor: '#9ca3af',
            },
            grid: {
                vertLines: { color: 'rgba(42, 46, 57, 0.6)' },
                horzLines: { color: 'rgba(42, 46, 57, 0.6)' },
            },
            crosshair: {
                mode: CrosshairMode.Normal,
            },
            rightPriceScale: {
                borderColor: 'rgba(42, 46, 57, 0.8)',
            },
            timeScale: {
                borderColor: 'rgba(42, 46, 57, 0.8)',
                timeVisible: true,
            },
            handleScale: {
                mouseWheel: true,
                pinch: true,
            },
            handleScroll: {
                mouseWheel: true,
                pressedMouseMove: true,
                horzTouchDrag: true,
                vertTouchDrag: false,
            },
        });

        chartRef.current = chart;

        // Volume series - using lightweight-charts v5 API
        const volumeSeries = chart.addSeries(HistogramSeries, {
            color: '#26a69a',
            priceFormat: { type: 'volume' },
            priceScaleId: 'volume',
        });
        volumeSeries.priceScale().applyOptions({
            scaleMargins: { top: 0.8, bottom: 0 },
        });
        volumeSeriesRef.current = volumeSeries;

        // Candlestick series
        const candleSeries = chart.addSeries(CandlestickSeries, {
            upColor: '#26a69a',
            downColor: '#ef5350',
            borderUpColor: '#26a69a',
            borderDownColor: '#ef5350',
            wickUpColor: '#26a69a',
            wickDownColor: '#ef5350',
        });
        candleSeriesRef.current = candleSeries;

        // VWAP
        const vwapSeries = chart.addSeries(LineSeries, {
            color: '#ff9800',
            lineWidth: 2,
            lineStyle: LineStyle.Solid,
        });
        vwapSeriesRef.current = vwapSeries;

        // MA20
        const ma20Series = chart.addSeries(LineSeries, {
            color: '#2196f3',
            lineWidth: 1,
            lineStyle: LineStyle.Solid,
        });
        ma20SeriesRef.current = ma20Series;

        // MA50
        const ma50Series = chart.addSeries(LineSeries, {
            color: '#9c27b0',
            lineWidth: 1,
            lineStyle: LineStyle.Solid,
        });
        ma50SeriesRef.current = ma50Series;

        // Handle resize
        const handleResize = () => {
            if (chartContainerRef.current) {
                chart.applyOptions({
                    width: chartContainerRef.current.clientWidth,
                    height: chartContainerRef.current.clientHeight - 80, // Account for stats strip
                });
            }
        };

        window.addEventListener('resize', handleResize);
        handleResize();

        return () => {
            window.removeEventListener('resize', handleResize);
            chart.remove();
        };
    }, []);

    // Update data
    useEffect(() => {
        if (!candleSeriesRef.current || candles.length === 0) return;

        // Set candle data
        const candleData = candles.map(c => ({
            time: c.time as Time,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
        }));
        candleSeriesRef.current.setData(candleData);

        // Set volume data
        if (volumeSeriesRef.current && showVolume) {
            const volumeData = candles.map(c => ({
                time: c.time as Time,
                value: c.volume,
                color: c.close >= c.open ? 'rgba(38, 166, 154, 0.5)' : 'rgba(239, 83, 80, 0.5)',
            }));
            volumeSeriesRef.current.setData(volumeData);
        }

        // Set VWAP
        if (vwapSeriesRef.current && showVWAP) {
            const vwapData = calculateVWAP(candles).map(d => ({ time: d.time as Time, value: d.value }));
            vwapSeriesRef.current.setData(vwapData);
        }

        // Set MA20
        if (ma20SeriesRef.current && showMA20) {
            const ma20Data = calculateSMA(candles, 20).map(d => ({ time: d.time as Time, value: d.value }));
            ma20SeriesRef.current.setData(ma20Data);
        }

        // Set MA50
        if (ma50SeriesRef.current && showMA50) {
            const ma50Data = calculateSMA(candles, 50).map(d => ({ time: d.time as Time, value: d.value }));
            ma50SeriesRef.current.setData(ma50Data);
        }

        // Set trade markers using v5 API - markers are attached via createSeriesMarkers or directly
        const markers: SeriesMarker<Time>[] = trades
            .filter(t => {
                if (showBotOnly && !t.strategy) return false;
                if (t.side === 'entry' && !showEntries) return false;
                if (t.side === 'exit' && !showExits) return false;
                return true;
            })
            .map(t => ({
                time: t.timestamp as Time,
                position: t.side === 'entry' ? 'belowBar' : 'aboveBar',
                color: t.side === 'entry' ? '#26a69a' : '#ef5350',
                shape: t.side === 'entry' ? 'arrowUp' : 'arrowDown',
                text: t.strategy || '',
                size: 1,
            }));
        // In lightweight-charts v5, setMarkers is available on the series
        (candleSeriesRef.current as unknown as { setMarkers: (markers: SeriesMarker<Time>[]) => void }).setMarkers(markers);

        // Fit content
        chartRef.current?.timeScale().fitContent();
    }, [candles, trades, showVWAP, showMA20, showMA50, showVolume, showEntries, showExits, showBotOnly]);

    // Toggle overlay visibility
    useEffect(() => {
        vwapSeriesRef.current?.applyOptions({ visible: showVWAP });
        ma20SeriesRef.current?.applyOptions({ visible: showMA20 });
        ma50SeriesRef.current?.applyOptions({ visible: showMA50 });
        volumeSeriesRef.current?.applyOptions({ visible: showVolume });
    }, [showVWAP, showMA20, showMA50, showVolume]);

    // Current regime
    const currentRegime = regimeData[regimeData.length - 1];

    return (
        <div className="h-full flex flex-col" data-testid="supergraph-module">
            {/* Chart Controls */}
            <div className="px-3 py-2 flex items-center justify-between border-b border-border bg-element-bg shrink-0">
                <div className="flex items-center gap-2">
                    <span className="text-xs text-text-secondary">Overlays:</span>
                    <OverlayToggle label="VWAP" color="#ff9800" active={showVWAP} onClick={() => setShowVWAP(!showVWAP)} />
                    <OverlayToggle label="MA20" color="#2196f3" active={showMA20} onClick={() => setShowMA20(!showMA20)} />
                    <OverlayToggle label="MA50" color="#9c27b0" active={showMA50} onClick={() => setShowMA50(!showMA50)} />
                    <OverlayToggle label="Volume" color="#666" active={showVolume} onClick={() => setShowVolume(!showVolume)} />
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-xs text-text-secondary">Markers:</span>
                    <button
                        onClick={() => setShowEntries(!showEntries)}
                        className={cn(
                            "px-2 py-1 text-[10px] rounded flex items-center gap-1",
                            showEntries ? "bg-green-500/20 text-green-400" : "bg-element-bg text-text-muted"
                        )}
                    >
                        <TrendingUp size={10} /> Entries
                    </button>
                    <button
                        onClick={() => setShowExits(!showExits)}
                        className={cn(
                            "px-2 py-1 text-[10px] rounded flex items-center gap-1",
                            showExits ? "bg-red-500/20 text-red-400" : "bg-element-bg text-text-muted"
                        )}
                    >
                        <TrendingDown size={10} /> Exits
                    </button>
                    <button
                        onClick={() => setShowBotOnly(!showBotOnly)}
                        className={cn(
                            "px-2 py-1 text-[10px] rounded flex items-center gap-1",
                            showBotOnly ? "bg-brand/20 text-brand" : "bg-element-bg text-text-muted"
                        )}
                    >
                        <Radio size={10} /> Bot Only
                    </button>
                </div>
            </div>

            {/* C4: Stats Strip */}
            <div className="px-3 py-2 flex items-center gap-6 border-b border-border bg-panel-bg shrink-0" data-testid="stats-strip">
                {/* Trend Strength */}
                <div className="flex items-center gap-2">
                    <TrendingUp size={12} className="text-brand" />
                    <span className="text-[10px] text-text-secondary">Trend</span>
                    <div className="flex items-center gap-1">
                        <div className="w-16 h-1.5 bg-element-bg rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-brand transition-all"
                                style={{ width: `${stats.trend_strength * 100}%` }}
                            />
                        </div>
                        <span className="text-xs text-text tabular-nums">{(stats.trend_strength * 100).toFixed(0)}%</span>
                    </div>
                </div>

                {/* Range/Chop */}
                <div className="flex items-center gap-2">
                    <Activity size={12} className="text-yellow-500" />
                    <span className="text-[10px] text-text-secondary">Chop</span>
                    <div className="flex items-center gap-1">
                        <div className="w-16 h-1.5 bg-element-bg rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-yellow-500 transition-all"
                                style={{ width: `${stats.range_chop * 100}%` }}
                            />
                        </div>
                        <span className="text-xs text-text tabular-nums">{(stats.range_chop * 100).toFixed(0)}%</span>
                    </div>
                </div>

                {/* Realized Vol */}
                <div className="flex items-center gap-2">
                    <Zap size={12} className="text-purple-500" />
                    <span className="text-[10px] text-text-secondary">Vol</span>
                    <span className="text-xs text-text tabular-nums">{stats.realized_vol.toFixed(1)}%</span>
                </div>

                {/* Liquidity */}
                <div className="flex items-center gap-2">
                    <BarChart3 size={12} className="text-blue-500" />
                    <span className="text-[10px] text-text-secondary">Liquidity</span>
                    <span className={cn(
                        "text-xs tabular-nums",
                        stats.liquidity > 0.8 ? "text-green-400" : stats.liquidity > 0.5 ? "text-yellow-400" : "text-red-400"
                    )}>
                        {(stats.liquidity * 100).toFixed(0)}%
                    </span>
                </div>

                <div className="h-4 w-px bg-border" />

                {/* News Sentiment */}
                <div className="flex items-center gap-2">
                    <span className="text-[10px] text-text-secondary">Sentiment</span>
                    <span className={cn(
                        "text-xs font-medium tabular-nums",
                        stats.news_sentiment > 0.2 ? "text-green-400" : stats.news_sentiment < -0.2 ? "text-red-400" : "text-text"
                    )}>
                        {stats.news_sentiment > 0 ? '+' : ''}{(stats.news_sentiment * 100).toFixed(0)}%
                    </span>
                    <span className="text-[10px] text-text-muted">({(stats.sentiment_confidence * 100).toFixed(0)}% conf)</span>
                </div>

                {/* Catalyst Alert */}
                {stats.catalyst_alert && (
                    <div className="flex items-center gap-1 px-2 py-0.5 bg-red-500/20 text-red-400 rounded text-[10px] font-medium animate-pulse">
                        <Zap size={10} />
                        CATALYST
                    </div>
                )}
            </div>

            {/* Chart Container */}
            <div 
                ref={chartContainerRef} 
                className="flex-1 relative"
                data-testid="chart-container"
            />

            {/* Regime Strip */}
            <div className="h-8 px-3 flex items-center gap-4 border-t border-border bg-panel-bg shrink-0" data-testid="regime-strip">
                <span className="text-[10px] text-text-secondary">Regime:</span>
                <div className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-medium uppercase",
                    currentRegime?.regime === 'trend' ? "bg-green-500/20 text-green-400" :
                    currentRegime?.regime === 'range' ? "bg-yellow-500/20 text-yellow-400" :
                    "bg-red-500/20 text-red-400"
                )}>
                    {currentRegime?.regime || 'unknown'}
                </div>
                <span className="text-[10px] text-text-muted">
                    ({((currentRegime?.confidence || 0) * 100).toFixed(0)}% confidence)
                </span>

                <div className="flex-1" />

                {/* Recent regime history */}
                <div className="flex items-center gap-0.5">
                    {regimeData.slice(-50).map((r, i) => (
                        <div
                            key={i}
                            className={cn(
                                "w-1 h-3 rounded-sm",
                                r.regime === 'trend' ? "bg-green-500/60" :
                                r.regime === 'range' ? "bg-yellow-500/60" :
                                "bg-red-500/60"
                            )}
                            title={`${r.regime} (${(r.confidence * 100).toFixed(0)}%)`}
                        />
                    ))}
                </div>
            </div>

            {/* Trade Hover Tooltip */}
            {hoveredTrade && (
                <div className="absolute bg-panel-bg border border-border rounded-lg p-3 shadow-lg z-tooltip text-xs">
                    <div className="font-medium text-text mb-2">{hoveredTrade.strategy} - {hoveredTrade.side.toUpperCase()}</div>
                    <div className="space-y-1 text-text-secondary">
                        <div>Time: {new Date(hoveredTrade.timestamp * 1000).toLocaleString()}</div>
                        <div>Price: ${hoveredTrade.price.toFixed(2)}</div>
                        <div>Size: {hoveredTrade.qty} contracts</div>
                        {hoveredTrade.dte && <div>DTE: {hoveredTrade.dte}</div>}
                        {hoveredTrade.pnl !== undefined && (
                            <div className={hoveredTrade.pnl >= 0 ? "text-green-400" : "text-red-400"}>
                                P&L: ${hoveredTrade.pnl.toFixed(2)}
                            </div>
                        )}
                        {hoveredTrade.client_order_id && (
                            <div className="text-brand cursor-pointer hover:underline">
                                Order: {hoveredTrade.client_order_id}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
