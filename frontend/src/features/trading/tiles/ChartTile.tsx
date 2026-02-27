// Bloomberg CT — Chart Terminal Tile
const BG = '#0a0a0a';
const PANEL = '#111111';
const BORDER = '#1e1e1e';
const AMBER = '#f5a623';
const GREEN = '#26a69a';
const RED = '#ef5350';
const BLUE = '#42a5f5';
const PURPLE = '#ab47bc';
const SUBTLE = '#555';
const TEXT = '#d1d4dc';
const MONO = '"Roboto Mono","Courier New",monospace';

import { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, CandlestickSeries, LineSeries } from 'lightweight-charts';
import type { UTCTimestamp } from 'lightweight-charts';

interface TileProps {
    tileId: string;
    onClose: () => void;
    onMaximize: () => void;
    isMaximized: boolean;
}

const SYMBOLS_CHART = ['SPY', 'AAPL', 'TSLA', 'NVDA', 'MSFT'];
const TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h', '1D'];
const CHART_TYPES = ['Candle', 'Line'];

function generateMockCandles(count: number = 200, basePrice = 150) {
    const candles: { time: UTCTimestamp; open: number; high: number; low: number; close: number }[] = [];
    let price = basePrice;
    const baseTime = Math.floor(Date.now() / 1000) - count * 60;
    for (let i = 0; i < count; i++) {
        const vol = 0.018;
        const chg = price * vol * (Math.random() - 0.5);
        const open = price;
        const close = price + chg;
        const high = Math.max(open, close) + Math.abs(chg) * Math.random() * 0.5;
        const low = Math.min(open, close) - Math.abs(chg) * Math.random() * 0.5;
        candles.push({ time: (baseTime + i * 60) as UTCTimestamp, open, high, low, close });
        price = close;
    }
    return candles;
}

const SEED_BASE: Record<string, number> = { SPY: 547, AAPL: 182, TSLA: 218, NVDA: 789, MSFT: 412 };

import React from 'react';

export function ChartTile({ tileId: _tileId, isMaximized: _isMaximized }: TileProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<ReturnType<typeof createChart> | null>(null);
    const [activeSym, setActiveSym] = useState('SPY');
    const [activeTF, setActiveTF] = useState('1m');
    const [chartType, setChartType] = useState<'Candle' | 'Line'>('Candle');
    const [lastPrice, setLastPrice] = useState<number>(SEED_BASE['SPY']);
    const [ohlc, setOhlc] = useState({ o: 0, h: 0, l: 0, c: 0 });

    useEffect(() => {
        if (!containerRef.current) return;
        const chart = createChart(containerRef.current, {
            layout: { background: { type: ColorType.Solid, color: BG }, textColor: SUBTLE },
            grid: { vertLines: { color: BORDER }, horzLines: { color: BORDER } },
            width: containerRef.current.clientWidth,
            height: containerRef.current.clientHeight,
            timeScale: { borderColor: BORDER, timeVisible: true, secondsVisible: false },
            rightPriceScale: { borderColor: BORDER },
            crosshair: { mode: 1 },
        });

        const base = SEED_BASE[activeSym] ?? 150;
        const candles = generateMockCandles(200, base);
        const last = candles[candles.length - 1];
        setLastPrice(last.close);
        setOhlc({ o: last.open, h: last.high, l: last.low, c: last.close });

        if (chartType === 'Candle') {
            const series = chart.addSeries(CandlestickSeries, {
                upColor: GREEN, downColor: RED, borderVisible: false,
                wickUpColor: GREEN, wickDownColor: RED,
            });
            series.setData(candles);
        } else {
            const series = chart.addSeries(LineSeries, { color: BLUE, lineWidth: 2 });
            series.setData(candles.map(c => ({ time: c.time, value: c.close })));
        }

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
        const ro = new ResizeObserver(handleResize);
        ro.observe(containerRef.current);

        return () => {
            window.removeEventListener('resize', handleResize);
            ro.disconnect();
            chart.remove();
        };
    }, [activeSym, activeTF, chartType]);

    const priceChange = lastPrice - (SEED_BASE[activeSym] ?? lastPrice);
    const priceChangePct = SEED_BASE[activeSym] ? (priceChange / SEED_BASE[activeSym]) * 100 : 0;

    return (
        <div style={{ height:'100%', display:'flex', flexDirection:'column', background:BG, fontFamily:MONO }}>
            {/* Header */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'4px 8px', background:PANEL, borderBottom:`1px solid ${BORDER}`, flexShrink:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ color:AMBER, fontWeight:700, fontSize:11, letterSpacing:2 }}>CT</span>
                    {SYMBOLS_CHART.map(s => (
                        <button key={s} onClick={() => setActiveSym(s)}
                            style={{ background:'none', border:'none', color: activeSym === s ? AMBER : SUBTLE, fontFamily:MONO, fontSize:11, cursor:'pointer', fontWeight: activeSym === s ? 700 : 400, padding:'0 2px' }}>
                            {s}
                        </button>
                    ))}
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <span style={{ color:priceChangePct >= 0 ? GREEN : RED, fontFamily:MONO, fontSize:11 }}>
                        {lastPrice.toFixed(2)} {priceChangePct >= 0 ? '+' : ''}{priceChangePct.toFixed(2)}%
                    </span>
                </div>
            </div>

            {/* Toolbar */}
            <div style={{ display:'flex', alignItems:'center', gap:4, padding:'3px 8px', background:'#0d0d0d', borderBottom:`1px solid ${BORDER}`, flexShrink:0 }}>
                {TIMEFRAMES.map(tf => (
                    <button key={tf} onClick={() => setActiveTF(tf)}
                        style={{ background: activeTF === tf ? AMBER : 'transparent', border:`1px solid ${activeTF === tf ? AMBER : BORDER}`, color: activeTF === tf ? BG : SUBTLE, fontFamily:MONO, fontSize:10, padding:'1px 5px', cursor:'pointer', borderRadius:2 }}>
                        {tf}
                    </button>
                ))}
                <div style={{ width:1, height:12, background:BORDER, margin:'0 4px' }} />
                {CHART_TYPES.map(ct => (
                    <button key={ct} onClick={() => setChartType(ct as 'Candle' | 'Line')}
                        style={{ background: chartType === ct ? PURPLE : 'transparent', border:`1px solid ${chartType === ct ? PURPLE : BORDER}`, color: chartType === ct ? '#fff' : SUBTLE, fontFamily:MONO, fontSize:10, padding:'1px 5px', cursor:'pointer', borderRadius:2 }}>
                        {ct}
                    </button>
                ))}
                <div style={{ flex:1 }} />
                <span style={{ color:SUBTLE, fontSize:9 }}>MOCK</span>
            </div>

            {/* OHLC bar */}
            <div style={{ display:'flex', gap:12, padding:'2px 8px', background:BG, borderBottom:`1px solid ${BORDER}`, flexShrink:0 }}>
                {[['O', ohlc.o, TEXT], ['H', ohlc.h, GREEN], ['L', ohlc.l, RED], ['C', ohlc.c, priceChangePct >= 0 ? GREEN : RED]].map(([lbl, val, col]) => (
                    <span key={lbl as string} style={{ fontFamily:MONO, fontSize:10, color:SUBTLE }}>
                        {lbl as string} <span style={{ color:col as string }}>{(val as number).toFixed(2)}</span>
                    </span>
                ))}
            </div>

            {/* Chart area */}
            <div style={{ flex:1, position:'relative', overflow:'hidden' }}>
                <div ref={containerRef} style={{ width:'100%', height:'100%' }} />
            </div>
        </div>
    );
}
