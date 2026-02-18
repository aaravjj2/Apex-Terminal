/**
 * Chart Tile - Mini chart for dashboard
 */

import { useEffect, useRef } from 'react';
import { createChart, ColorType, CandlestickSeries } from 'lightweight-charts';
import type { UTCTimestamp } from 'lightweight-charts';

interface TileProps {
    tileId: string;
    onClose: () => void;
    onMaximize: () => void;
    isMaximized: boolean;
}

// Generate mock candle data
function generateMockCandles(count: number = 100) {
    const candles = [];
    let basePrice = 150 + Math.random() * 50;
    const baseTime = Math.floor(Date.now() / 1000) - count * 60;

    for (let i = 0; i < count; i++) {
        const volatility = 0.02;
        const change = basePrice * volatility * (Math.random() - 0.5);
        const open = basePrice;
        const close = basePrice + change;
        const high = Math.max(open, close) + Math.abs(change) * Math.random();
        const low = Math.min(open, close) - Math.abs(change) * Math.random();

        candles.push({
            time: (baseTime + i * 60) as UTCTimestamp,
            open,
            high,
            low,
            close,
        });

        basePrice = close;
    }

    return candles;
}

// Use underscore prefix for unused props that are part of interface
export function ChartTile({ tileId: _tileId, isMaximized: _isMaximized }: TileProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<ReturnType<typeof createChart> | null>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        const chart = createChart(containerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: 'transparent' },
                textColor: '#787B86',
            },
            grid: {
                vertLines: { color: '#2B2B43' },
                horzLines: { color: '#2B2B43' },
            },
            width: containerRef.current.clientWidth,
            height: containerRef.current.clientHeight,
            timeScale: {
                borderColor: '#2B2B43',
                timeVisible: true,
            },
            rightPriceScale: {
                borderColor: '#2B2B43',
            },
            crosshair: {
                mode: 0,
            },
        });

        const candlestickSeries = chart.addSeries(CandlestickSeries, {
            upColor: '#26a69a',
            downColor: '#ef5350',
            borderVisible: false,
            wickUpColor: '#26a69a',
            wickDownColor: '#ef5350',
        });

        candlestickSeries.setData(generateMockCandles());
        chart.timeScale().fitContent();
        chartRef.current = chart;

        const handleResize = () => {
            if (containerRef.current) {
                chart.applyOptions({
                    width: containerRef.current.clientWidth,
                    height: containerRef.current.clientHeight,
                });
            }
        };

        window.addEventListener('resize', handleResize);
        const resizeObserver = new ResizeObserver(handleResize);
        resizeObserver.observe(containerRef.current);

        return () => {
            window.removeEventListener('resize', handleResize);
            resizeObserver.disconnect();
            chart.remove();
        };
    }, []);

    return (
        <div className="relative h-full w-full">
            <div className="absolute top-2 right-2 z-10 px-1.5 py-0.5 bg-yellow-900/50 text-yellow-500 rounded text-[10px] border border-yellow-800 backdrop-blur-sm pointer-events-none">
                MOCK CHART
            </div>
            <div ref={containerRef} className="h-full w-full" />
        </div>
    );
}
