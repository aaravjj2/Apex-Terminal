/**
 * Supergraph Chart Component
 * 
 * Advanced chart with:
 * - Candlestick + Volume
 * - VWAP overlay
 * - MA20, MA50 overlays
 * - Entry/Exit markers
 * - Real-time updates
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { 
    createChart, 
    ColorType, 
    CrosshairMode, 
    CandlestickSeries, 
    HistogramSeries,
    LineSeries,
    LineStyle
} from 'lightweight-charts';
import type { IChartApi, ISeriesApi, Time, SeriesMarker } from 'lightweight-charts';

const API_BASE = 'http://127.0.0.1:8000/api/v1';

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
}

interface ChartOverlay {
    id: string;
    type: 'vwap' | 'ma20' | 'ma50' | 'ema20' | 'bollinger';
    visible: boolean;
    color: string;
}

interface SupergraphChartProps {
    symbol?: string;
    timeframe?: string;
    showOverlays?: boolean;
    showMarkers?: boolean;
    height?: string | number;
    className?: string;
}

// Calculate Simple Moving Average
function calculateSMA(data: Candle[], period: number): { time: number; value: number }[] {
    const result: { time: number; value: number }[] = [];
    
    for (let i = period - 1; i < data.length; i++) {
        let sum = 0;
        for (let j = 0; j < period; j++) {
            sum += data[i - j].close;
        }
        result.push({
            time: data[i].time,
            value: sum / period
        });
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
            result.push({
                time: candle.time,
                value: cumulativeTPV / cumulativeVolume
            });
        }
    }
    
    return result;
}

// Generate mock candles for demo
function generateMockCandles(count: number = 200): Candle[] {
    const candles: Candle[] = [];
    let price = 190;
    const now = Math.floor(Date.now() / 1000);

    for (let i = 0; i < count; i++) {
        const open = price;
        const change = (Math.random() - 0.5) * 4;
        const close = open + change;
        const high = Math.max(open, close) + Math.random() * 2;
        const low = Math.min(open, close) - Math.random() * 2;

        candles.push({
            time: (now - (count - i) * 60) * 1000,
            open,
            high,
            low,
            close,
            volume: 10000 + Math.random() * 5000
        });

        price = close;
    }
    return candles;
}

// Overlay Toggle Button
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
            className={`
                px-2 py-1 text-[10px] font-medium rounded border
                transition-all duration-150
                ${active 
                    ? 'bg-opacity-20 border-current' 
                    : 'bg-transparent border-gray-700 text-gray-500 hover:text-gray-300'
                }
            `}
            style={{ color: active ? color : undefined, backgroundColor: active ? `${color}20` : undefined }}
        >
            {label}
        </button>
    );
}

export function SupergraphChart({
    symbol = 'AAPL',
    timeframe = '1m',
    showOverlays = true,
    showMarkers = true,
    height = '100%',
    className = ''
}: SupergraphChartProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
    const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
    const vwapSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const ma20SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const ma50SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

    const [candles, setCandles] = useState<Candle[]>([]);
    const [trades, setTrades] = useState<Trade[]>([]);
    const [overlays, setOverlays] = useState<ChartOverlay[]>([
        { id: 'vwap', type: 'vwap', visible: true, color: '#f59e0b' },
        { id: 'ma20', type: 'ma20', visible: true, color: '#3b82f6' },
        { id: 'ma50', type: 'ma50', visible: false, color: '#8b5cf6' },
    ]);
    const [crosshairPrice, setCrosshairPrice] = useState<number | null>(null);
    const [crosshairTime, setCrosshairTime] = useState<string | null>(null);

    // Fetch candle data
    const fetchCandles = useCallback(async () => {
        try {
            const response = await fetch(`${API_BASE}/charts/${symbol}/candles?timeframe=${timeframe}`);
            if (response.ok) {
                const data = await response.json();
                setCandles(data.candles || []);
            } else {
                // Fallback to mock
                setCandles(generateMockCandles(200));
            }
        } catch {
            setCandles(generateMockCandles(200));
        }
    }, [symbol, timeframe]);

    // Fetch trades for markers
    const fetchTrades = useCallback(async () => {
        try {
            const response = await fetch(`${API_BASE}/trades?symbol=${symbol}`);
            if (response.ok) {
                const data = await response.json();
                setTrades(data.trades || []);
            }
        } catch {
            // Mock trades
            const now = Date.now();
            setTrades([
                {
                    id: 't1',
                    timestamp: now - 60000 * 50,
                    symbol,
                    side: 'entry',
                    direction: 'long',
                    price: 188.50,
                    qty: 100,
                    strategy: 'VWAP_REVERSION'
                },
                {
                    id: 't2',
                    timestamp: now - 60000 * 20,
                    symbol,
                    side: 'exit',
                    direction: 'long',
                    price: 191.25,
                    qty: 100,
                    pnl: 275.00,
                    strategy: 'VWAP_REVERSION'
                }
            ]);
        }
    }, [symbol]);

    // Initialize chart
    const initChart = useCallback(() => {
        if (!containerRef.current) return;

        // Cleanup existing
        if (chartRef.current) {
            chartRef.current.remove();
        }

        const chart = createChart(containerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: '#0a0a0f' },
                textColor: '#9ca3af',
            },
            grid: {
                vertLines: { color: '#1f2937', style: LineStyle.Dotted },
                horzLines: { color: '#1f2937', style: LineStyle.Dotted },
            },
            width: containerRef.current.clientWidth,
            height: containerRef.current.clientHeight,
            crosshair: {
                mode: CrosshairMode.Normal,
                vertLine: {
                    color: '#6b7280',
                    width: 1,
                    style: LineStyle.Dashed,
                    labelBackgroundColor: '#374151',
                },
                horzLine: {
                    color: '#6b7280',
                    width: 1,
                    style: LineStyle.Dashed,
                    labelBackgroundColor: '#374151',
                },
            },
            timeScale: {
                timeVisible: true,
                secondsVisible: false,
                borderColor: '#1f2937',
            },
            rightPriceScale: {
                borderColor: '#1f2937',
            },
        });

        // Candlestick series
        const candleSeries = chart.addSeries(CandlestickSeries, {
            upColor: '#22c55e',
            downColor: '#ef4444',
            borderVisible: false,
            wickUpColor: '#22c55e',
            wickDownColor: '#ef4444',
        });

        // Volume series
        const volumeSeries = chart.addSeries(HistogramSeries, {
            priceFormat: { type: 'volume' },
            priceScaleId: 'volume',
        });
        
        volumeSeries.priceScale().applyOptions({
            scaleMargins: { top: 0.85, bottom: 0 },
        });

        // VWAP line
        const vwapSeries = chart.addSeries(LineSeries, {
            color: '#f59e0b',
            lineWidth: 2,
            lineStyle: LineStyle.Solid,
            priceScaleId: 'right',
            lastValueVisible: true,
            priceLineVisible: false,
        });

        // MA20 line
        const ma20Series = chart.addSeries(LineSeries, {
            color: '#3b82f6',
            lineWidth: 1,
            lineStyle: LineStyle.Solid,
            priceScaleId: 'right',
            lastValueVisible: false,
            priceLineVisible: false,
        });

        // MA50 line
        const ma50Series = chart.addSeries(LineSeries, {
            color: '#8b5cf6',
            lineWidth: 1,
            lineStyle: LineStyle.Solid,
            priceScaleId: 'right',
            lastValueVisible: false,
            priceLineVisible: false,
        });

        // Crosshair handler
        chart.subscribeCrosshairMove((param) => {
            if (param.point && param.time) {
                const price = param.seriesData.get(candleSeries);
                if (price && 'close' in price) {
                    setCrosshairPrice((price as any).close);
                }
                const date = new Date((param.time as number) * 1000);
                setCrosshairTime(date.toLocaleTimeString());
            } else {
                setCrosshairPrice(null);
                setCrosshairTime(null);
            }
        });

        chartRef.current = chart;
        candleSeriesRef.current = candleSeries;
        volumeSeriesRef.current = volumeSeries;
        vwapSeriesRef.current = vwapSeries;
        ma20SeriesRef.current = ma20Series;
        ma50SeriesRef.current = ma50Series;
    }, []);

    // Update chart data
    useEffect(() => {
        if (!candleSeriesRef.current || !volumeSeriesRef.current || candles.length === 0) return;

        // Format for chart (time in seconds)
        const chartData = candles.map(c => ({
            time: Math.floor(c.time / 1000) as Time,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
        }));

        const volumeData = candles.map(c => ({
            time: Math.floor(c.time / 1000) as Time,
            value: c.volume,
            color: c.close >= c.open ? 'rgba(34, 197, 94, 0.4)' : 'rgba(239, 68, 68, 0.4)',
        }));

        candleSeriesRef.current.setData(chartData);
        volumeSeriesRef.current.setData(volumeData);

        // Update overlays
        const vwapOverlay = overlays.find(o => o.id === 'vwap');
        const ma20Overlay = overlays.find(o => o.id === 'ma20');
        const ma50Overlay = overlays.find(o => o.id === 'ma50');

        if (vwapSeriesRef.current && vwapOverlay?.visible) {
            const vwapData = calculateVWAP(candles).map(d => ({
                time: Math.floor(d.time / 1000) as Time,
                value: d.value
            }));
            vwapSeriesRef.current.setData(vwapData);
            vwapSeriesRef.current.applyOptions({ visible: true });
        } else if (vwapSeriesRef.current) {
            vwapSeriesRef.current.applyOptions({ visible: false });
        }

        if (ma20SeriesRef.current && ma20Overlay?.visible) {
            const ma20Data = calculateSMA(candles, 20).map(d => ({
                time: Math.floor(d.time / 1000) as Time,
                value: d.value
            }));
            ma20SeriesRef.current.setData(ma20Data);
            ma20SeriesRef.current.applyOptions({ visible: true });
        } else if (ma20SeriesRef.current) {
            ma20SeriesRef.current.applyOptions({ visible: false });
        }

        if (ma50SeriesRef.current && ma50Overlay?.visible) {
            const ma50Data = calculateSMA(candles, 50).map(d => ({
                time: Math.floor(d.time / 1000) as Time,
                value: d.value
            }));
            ma50SeriesRef.current.setData(ma50Data);
            ma50SeriesRef.current.applyOptions({ visible: true });
        } else if (ma50SeriesRef.current) {
            ma50SeriesRef.current.applyOptions({ visible: false });
        }

        // Add trade markers
        if (showMarkers && candleSeriesRef.current) {
            const markers: SeriesMarker<Time>[] = trades.map(trade => ({
                time: Math.floor(trade.timestamp / 1000) as Time,
                position: trade.side === 'entry' ? 'belowBar' : 'aboveBar',
                color: trade.side === 'entry' 
                    ? (trade.direction === 'long' ? '#22c55e' : '#ef4444')
                    : '#f59e0b',
                shape: trade.side === 'entry' ? 'arrowUp' : 'arrowDown',
                text: `${trade.side.toUpperCase()} ${trade.qty}@${trade.price.toFixed(2)}${trade.pnl ? ` (${trade.pnl >= 0 ? '+' : ''}$${trade.pnl.toFixed(2)})` : ''}`,
            }));
            // Cast to handle lightweight-charts v5 type issue
            (candleSeriesRef.current as unknown as { setMarkers: (markers: SeriesMarker<Time>[]) => void }).setMarkers(markers);
        }

    }, [candles, trades, overlays, showMarkers]);

    // Toggle overlay visibility
    const toggleOverlay = useCallback((id: string) => {
        setOverlays(prev => prev.map(o => 
            o.id === id ? { ...o, visible: !o.visible } : o
        ));
    }, []);

    // Initialize
    useEffect(() => {
        initChart();
        fetchCandles();
        fetchTrades();

        // Resize handler
        const handleResize = () => {
            if (containerRef.current && chartRef.current) {
                chartRef.current.applyOptions({
                    width: containerRef.current.clientWidth,
                    height: containerRef.current.clientHeight,
                });
            }
        };

        window.addEventListener('resize', handleResize);
        const resizeObserver = new ResizeObserver(handleResize);
        if (containerRef.current) {
            resizeObserver.observe(containerRef.current);
        }

        // Auto-refresh
        const interval = setInterval(() => {
            fetchCandles();
        }, 30000);

        return () => {
            window.removeEventListener('resize', handleResize);
            resizeObserver.disconnect();
            clearInterval(interval);
            if (chartRef.current) {
                chartRef.current.remove();
                chartRef.current = null;
            }
        };
    }, [initChart, fetchCandles, fetchTrades]);

    // Last candle info
    const lastCandle = candles.length > 0 ? candles[candles.length - 1] : null;
    const priceChange = lastCandle ? lastCandle.close - lastCandle.open : 0;
    const priceChangePercent = lastCandle ? (priceChange / lastCandle.open) * 100 : 0;

    return (
        <div className={`flex flex-col h-full bg-[#0a0a0f] ${className}`} style={{ height }}>
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-white">{symbol}</span>
                        <span className="text-xs text-gray-500 px-1.5 py-0.5 bg-gray-800 rounded">{timeframe}</span>
                    </div>
                    {lastCandle && (
                        <div className="flex items-center gap-3">
                            <span className="text-lg font-semibold text-white tabular-nums">
                                ${lastCandle.close.toFixed(2)}
                            </span>
                            <span className={`text-sm tabular-nums ${priceChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)} ({priceChangePercent.toFixed(2)}%)
                            </span>
                        </div>
                    )}
                </div>

                {/* Overlay toggles */}
                {showOverlays && (
                    <div className="flex items-center gap-2">
                        {overlays.map(overlay => (
                            <OverlayToggle
                                key={overlay.id}
                                label={overlay.type.toUpperCase()}
                                color={overlay.color}
                                active={overlay.visible}
                                onClick={() => toggleOverlay(overlay.id)}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Chart */}
            <div ref={containerRef} className="flex-1 relative" />

            {/* Crosshair info */}
            {crosshairPrice !== null && (
                <div className="absolute top-12 left-3 bg-gray-900/80 px-2 py-1 rounded text-xs">
                    <span className="text-gray-400">{crosshairTime}</span>
                    <span className="ml-2 text-white tabular-nums">${crosshairPrice.toFixed(2)}</span>
                </div>
            )}

            {/* Legend */}
            <div className="absolute bottom-2 left-3 flex items-center gap-4 text-[10px]">
                {overlays.filter(o => o.visible).map(overlay => (
                    <div key={overlay.id} className="flex items-center gap-1">
                        <div 
                            className="w-3 h-0.5 rounded"
                            style={{ backgroundColor: overlay.color }}
                        />
                        <span style={{ color: overlay.color }}>{overlay.type.toUpperCase()}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default SupergraphChart;
