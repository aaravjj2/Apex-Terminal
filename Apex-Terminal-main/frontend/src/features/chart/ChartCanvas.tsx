import { useEffect, useRef, useCallback, useState } from 'react';
import { createChart, ColorType, CrosshairMode, CandlestickSeries, HistogramSeries } from 'lightweight-charts';
import type { IChartApi, ISeriesApi } from 'lightweight-charts';
import { useStore } from '../../state/store.ts';
import { ReplayControls } from './ReplayControls.tsx';
import { ChartControls } from './ChartControls.tsx';
import { Toolbar } from '../drawings/Toolbar.tsx';
import { DrawingLayer } from '../drawings/DrawingLayer';
import { useChartIndicators } from './hooks/useChartIndicators';
import type { Candle } from '../../core/types.ts';

// Generate mock candle data for demo/testing
const generateMockCandles = (count: number = 100): Candle[] => {
    const candles: Candle[] = [];
    let price = 150;
    const now = Math.floor(Date.now() / 1000); // Unix timestamp (seconds)

    for (let i = 0; i < count; i++) {
        const open = price;
        const change = (Math.random() - 0.5) * 4;
        const close = open + change;
        const high = Math.max(open, close) + Math.random() * 2;
        const low = Math.min(open, close) - Math.random() * 2;

        candles.push({
            time: (now - (count - i) * 60) * 1000, // MS for store
            open,
            high,
            low,
            close,
            volume: 1000 + Math.random() * 500
        });

        price = close;
    }
    return candles;
};

interface ChartCanvasProps {
    className?: string;
}

export const ChartCanvas = ({ className }: ChartCanvasProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const candleSeriesRef = useRef<ISeriesApi<any> | null>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const volumeSeriesRef = useRef<ISeriesApi<any> | null>(null);

    // Track ready state to render layer
    const [chartReady, setChartReady] = useState(false);

    const { connect, disconnect, candles, lastCandle, activeIndicators, setCandles } = useStore();

    // Hook to manage indicator series
    useChartIndicators(chartReady ? chartRef.current : null);

    // Data connection effect
    const [useMockFallback, setUseMockFallback] = useState(true);

    useEffect(() => {
        // Check backend config to decide fallback behavior
        (async () => {
            try {
                const res = await fetch('http://127.0.0.1:8000/api/v1/debug/config');
                if (res.ok) {
                    const cfg = await res.json();
                    setUseMockFallback(cfg.ingestion_mode === 'mock');
                }
            } catch (e) {
                // Keep fallback enabled if we cannot contact backend
                console.warn('Failed to fetch backend config, keeping mock fallback enabled', e);
            }
        })();

        connect();
        const timer = setTimeout(() => {
            if (useStore.getState().candles.length === 0 && useMockFallback) {
                console.log('No WS data and backend in mock mode, loading mock candles...');
                setCandles(generateMockCandles(100));
            } else if (useStore.getState().candles.length === 0 && !useMockFallback) {
                console.warn('No WS data but backend is live — waiting for live data (no mock fallback)');
            }
        }, 3000);
        return () => {
            clearTimeout(timer);
            disconnect();
        };
    }, [connect, disconnect, setCandles]);

    // Initialize Chart
    const initChart = useCallback(() => {
        if (!containerRef.current) return;

        // Dispose existing if any
        if (chartRef.current) {
            chartRef.current.remove();
        }

        const chart = createChart(containerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: '#0f0f12' },
                textColor: '#d1d5db',
            },
            grid: {
                vertLines: { color: '#1f2937' },
                horzLines: { color: '#1f2937' },
            },
            width: containerRef.current.clientWidth,
            height: containerRef.current.clientHeight,
            crosshair: {
                mode: CrosshairMode.Normal,
            },
            timeScale: {
                timeVisible: true,
                secondsVisible: false,
            },
        });

        // V5 API: Use addSeries with series type
        const candleSeries = chart.addSeries(CandlestickSeries, {
            upColor: '#26a69a',
            downColor: '#ef5350',
            borderVisible: false,
            wickUpColor: '#26a69a',
            wickDownColor: '#ef5350',
        });

        // Volume Series (Overlay)
        const volumeSeries = chart.addSeries(HistogramSeries, {
            color: '#26a69a',
            priceFormat: {
                type: 'volume',
            },
            priceScaleId: '', // Overlay
        });

        // Adjust volume to bottom
        volumeSeries.priceScale().applyOptions({
            scaleMargins: {
                top: 0.8, // Highest volume is at 80% from top (so bottom 20%)
                bottom: 0,
            },
        });

        chartRef.current = chart;
        candleSeriesRef.current = candleSeries;
        volumeSeriesRef.current = volumeSeries;
        setChartReady(true);
    }, []);

    useEffect(() => {
        initChart();

        const handleResize = () => {
            if (containerRef.current && chartRef.current) {
                chartRef.current.applyOptions({
                    width: containerRef.current.clientWidth,
                    height: containerRef.current.clientHeight
                });
            }
        };

        window.addEventListener('resize', handleResize);
        const resizeObserver = new ResizeObserver(handleResize);
        if (containerRef.current) {
            resizeObserver.observe(containerRef.current);
        }

        return () => {
            window.removeEventListener('resize', handleResize);
            resizeObserver.disconnect();
            if (chartRef.current) {
                chartRef.current.remove();
                chartRef.current = null;
            }
        };
    }, [initChart]);

    // Update Data
    useEffect(() => {
        if (!candleSeriesRef.current || !volumeSeriesRef.current) return;

        const allCandles = lastCandle ? [...candles, lastCandle] : candles;

        if (allCandles.length === 0) return;

        // Map to lightweight-charts format (time must be Unix timestamp in seconds)
        // Store uses MS.
        const chartData = allCandles.map(c => ({
            time: Math.floor(c.time / 1000),
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
        }));

        const volumeData = allCandles.map(c => ({
            time: Math.floor(c.time / 1000),
            value: c.volume,
            color: c.close >= c.open ? 'rgba(38, 166, 154, 0.5)' : 'rgba(239, 83, 80, 0.5)',
        }));

        candleSeriesRef.current.setData(chartData);
        volumeSeriesRef.current.setData(volumeData);

    }, [candles, lastCandle]);

    // Handle Indicators (Placeholder logic for visualization)
    useEffect(() => {
        if (!chartRef.current || !candleSeriesRef.current) return;
        // Indicator logic here
    }, [activeIndicators]);

    return (
        <div className={`w-full h-full relative ${className || ''}`} data-testid="chart-canvas">
            <ReplayControls />
            <Toolbar />
            <div ref={containerRef} className="w-full h-full" />
            {chartReady && chartRef.current && candleSeriesRef.current && (
                <DrawingLayer chart={chartRef.current} series={candleSeriesRef.current} />
            )}
            <ChartControls chartRef={chartRef} />
        </div>
    );
};
