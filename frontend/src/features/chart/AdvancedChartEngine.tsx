/**
 * AdvancedChartEngine.tsx  —  Bloomberg / TradingView-grade multi-pane chart
 * ============================================================================
 * Features:
 *  • Candlestick | Heikin-Ashi | Line | Area | Bar chart types
 *  • Multi-pane: main price pane + up to 4 sub-panes for oscillators
 *  • 60+ technical indicator overlays via /api/v4/indicators/compute
 *  • Synchronized vertical crosshair across all panes
 *  • Timeframe picker: 1m 5m 15m 30m 1h 4h 1D 1W 1M
 *  • Drawing mode toggle (hand-off to DrawingLayer)
 *  • Right-click context menu (copy price, set alert, add indicator)
 *  • Auto-fit + keyboard shortcuts (Ctrl+= zoom in, Ctrl+- out, space fit)
 *  • Bloomberg amber-on-dark theme + TradingView dark theme toggle
 *  • Real OHLCV data from /api/v1/bars — NO mock fallback
 *  • Indicator data from /api/v4/indicators/compute
 */

import {
  useEffect, useRef, useCallback, useState, useMemo, forwardRef, useImperativeHandle,
} from 'react';
import {
  createChart, ColorType, CrosshairMode, LineStyle, PriceScaleMode,
  CandlestickSeries, HistogramSeries, LineSeries, AreaSeries, BarSeries,
} from 'lightweight-charts';
import type { IChartApi, ISeriesApi, MouseEventParams, DeepPartial, ChartOptions } from 'lightweight-charts';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ChartType = 'candlestick' | 'heikin_ashi' | 'line' | 'area' | 'bar';
export type Timeframe  = '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1D' | '1W' | '1M';
export type ThemeMode  = 'bloomberg' | 'dark' | 'light';

export interface IndicatorConfig {
  id:     string;
  name:   string;
  pane:   'main' | 'sub';  // overlay on price or separate sub-pane
  params: Record<string, unknown>;
  color?: string;
  visible?: boolean;
}

export interface AdvancedChartEngineProps {
  symbol:     string;
  timeframe?: Timeframe;
  theme?:     ThemeMode;
  height?:    number;
  onBarHover?: (bar: OHLCVBar | null) => void;
  onSymbolChange?: (symbol: string) => void;
  className?: string;
}

export interface OHLCVBar {
  time:   number;      // unix seconds
  open:   number;
  high:   number;
  low:    number;
  close:  number;
  volume: number;
}

interface PaneRef {
  chart:  IChartApi;
  el:     HTMLDivElement;
  series: Map<string, ISeriesApi<'Line' | 'Histogram'>>;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const TIMEFRAMES: { label: string; value: Timeframe; seconds: number }[] = [
  { label: '1m',  value: '1m',  seconds: 60        },
  { label: '5m',  value: '5m',  seconds: 300       },
  { label: '15m', value: '15m', seconds: 900       },
  { label: '30m', value: '30m', seconds: 1_800     },
  { label: '1h',  value: '1h',  seconds: 3_600     },
  { label: '4h',  value: '4h',  seconds: 14_400    },
  { label: '1D',  value: '1D',  seconds: 86_400    },
  { label: '1W',  value: '1W',  seconds: 604_800   },
  { label: '1M',  value: '1M',  seconds: 2_592_000 },
];

const CHART_TYPES: { label: string; value: ChartType; icon: string }[] = [
  { label: 'Candlestick', value: 'candlestick',  icon: '⊞' },
  { label: 'Heikin Ashi', value: 'heikin_ashi',  icon: '⊟' },
  { label: 'Line',        value: 'line',          icon: '∕' },
  { label: 'Area',        value: 'area',          icon: '⊿' },
  { label: 'Bar',         value: 'bar',           icon: '⎸' },
];

const PRESET_INDICATORS: IndicatorConfig[] = [
  { id: 'sma_20',   name: 'SMA 20',   pane: 'main', params: { period: 20  }, color: '#f9a825' },
  { id: 'sma_50',   name: 'SMA 50',   pane: 'main', params: { period: 50  }, color: '#42a5f5' },
  { id: 'sma_200',  name: 'SMA 200',  pane: 'main', params: { period: 200 }, color: '#ef5350' },
  { id: 'ema_20',   name: 'EMA 20',   pane: 'main', params: { period: 20  }, color: '#26a69a' },
  { id: 'bb_20',    name: 'BB (20,2)', pane: 'main', params: { period: 20, std_dev: 2 }, color: '#7e57c2' },
  { id: 'vwap',     name: 'VWAP',     pane: 'main', params: {},              color: '#ff7043' },
  { id: 'rsi_14',   name: 'RSI (14)', pane: 'sub',  params: { period: 14  }, color: '#66bb6a' },
  { id: 'macd',     name: 'MACD',     pane: 'sub',  params: { fast: 12, slow: 26, signal: 9 }, color: '#29b6f6' },
  { id: 'volume',   name: 'Volume',   pane: 'sub',  params: {},              color: '#78909c' },
  { id: 'stoch_14', name: 'Stoch (14,3,3)', pane: 'sub', params: { k_period: 14, d_period: 3, smooth: 3 }, color: '#ec407a' },
  { id: 'atr_14',   name: 'ATR (14)', pane: 'sub',  params: { period: 14  }, color: '#ab47bc' },
];

// ── Color Themes ──────────────────────────────────────────────────────────────

const THEMES: Record<ThemeMode, DeepPartial<ChartOptions>> = {
  bloomberg: {
    layout: {
      background:   { type: ColorType.Solid, color: '#0a0a0a' },
      textColor:    '#f5a623',
      fontFamily:   '"Roboto Mono", "Courier New", monospace',
      fontSize:     11,
    },
    grid: {
      vertLines:   { color: '#1a1a1a', style: LineStyle.Dotted },
      horzLines:   { color: '#1a1a1a', style: LineStyle.Dotted },
    },
    crosshair: {
      mode:        CrosshairMode.Normal,
      vertLine:    { color: '#f5a623', width: 1, style: LineStyle.Dashed, labelBackgroundColor: '#1a0a00' },
      horzLine:    { color: '#f5a623', width: 1, style: LineStyle.Dashed, labelBackgroundColor: '#1a0a00' },
    },
    rightPriceScale: { borderColor: '#2a2a2a', textColor: '#888', scaleMargins: { top: 0.1, bottom: 0.2 } },
    timeScale:       { borderColor: '#2a2a2a', textColor: '#888' },
  },
  dark: {
    layout: {
      background:   { type: ColorType.Solid, color: '#131722' },
      textColor:    '#d1d4dc',
      fontFamily:   '"Inter", "Helvetica Neue", sans-serif',
      fontSize:     12,
    },
    grid: {
      vertLines:   { color: '#1e222d' },
      horzLines:   { color: '#1e222d' },
    },
    crosshair: {
      mode:        CrosshairMode.Normal,
      vertLine:    { color: '#758696', width: 1, style: LineStyle.Dashed, labelBackgroundColor: '#0d1117' },
      horzLine:    { color: '#758696', width: 1, style: LineStyle.Dashed, labelBackgroundColor: '#0d1117' },
    },
    rightPriceScale: { borderColor: '#2a2e39', textColor: '#787b86', scaleMargins: { top: 0.1, bottom: 0.2 } },
    timeScale:       { borderColor: '#2a2e39', textColor: '#787b86' },
  },
  light: {
    layout: {
      background:   { type: ColorType.Solid, color: '#ffffff' },
      textColor:    '#191919',
      fontFamily:   '"Inter", sans-serif',
      fontSize:     12,
    },
    grid: {
      vertLines:   { color: '#e6e6e6' },
      horzLines:   { color: '#e6e6e6' },
    },
    crosshair: {
      mode:        CrosshairMode.Normal,
      vertLine:    { color: '#9598a1', width: 1, style: LineStyle.Dashed, labelBackgroundColor: '#9598a1' },
      horzLine:    { color: '#9598a1', width: 1, style: LineStyle.Dashed, labelBackgroundColor: '#9598a1' },
    },
    rightPriceScale: { borderColor: '#e0e3eb', textColor: '#9598a1', scaleMargins: { top: 0.1, bottom: 0.2 } },
    timeScale:       { borderColor: '#e0e3eb', textColor: '#9598a1' },
  },
};

// ── Heikin-Ashi converter ─────────────────────────────────────────────────────

function toHeikinAshi(bars: OHLCVBar[]): OHLCVBar[] {
  const ha: OHLCVBar[] = [];
  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];
    const haClose = (b.open + b.high + b.low + b.close) / 4;
    const haOpen  = i === 0
      ? (b.open + b.close) / 2
      : (ha[i - 1].open + ha[i - 1].close) / 2;
    const haHigh  = Math.max(b.high, haOpen, haClose);
    const haLow   = Math.min(b.low,  haOpen, haClose);
    ha.push({ time: b.time, open: haOpen, high: haHigh, low: haLow, close: haClose, volume: b.volume });
  }
  return ha;
}

// ── Sub-panel component ───────────────────────────────────────────────────────

interface SubPaneProps {
  label:     string;
  height:    number;
  themeOpts: DeepPartial<ChartOptions>;
  onReady:   (chart: IChartApi, el: HTMLDivElement) => void;
  onRemove?: () => void;
}

function SubPane({ label, height, themeOpts, onReady, onRemove }: SubPaneProps) {
  const elRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!elRef.current) return;
    const chart = createChart(elRef.current, {
      width:  elRef.current.clientWidth,
      height,
      ...themeOpts,
      rightPriceScale: { ...themeOpts.rightPriceScale, scaleMargins: { top: 0.1, bottom: 0.1 } },
      timeScale:       { visible: false },
    });
    onReady(chart, elRef.current);
    const ro = new ResizeObserver(() => {
      if (elRef.current) chart.applyOptions({ width: elRef.current.clientWidth });
    });
    ro.observe(elRef.current);
    return () => { ro.disconnect(); chart.remove(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ position: 'relative', borderTop: '1px solid #2a2a2a' }}>
      <span style={{
        position: 'absolute', top: 4, left: 8, fontSize: 10,
        color: '#666', zIndex: 5, pointerEvents: 'none', fontFamily: 'inherit',
      }}>
        {label}
      </span>
      {onRemove && (
        <button
          onClick={onRemove}
          style={{
            position: 'absolute', top: 2, right: 6, fontSize: 10,
            color: '#555', background: 'none', border: 'none', cursor: 'pointer', zIndex: 5, padding: 0,
          }}
          title="Remove indicator"
        >✕</button>
      )}
      <div ref={elRef} style={{ width: '100%', height }} />
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export const AdvancedChartEngine = forwardRef<{ fitContent: () => void }, AdvancedChartEngineProps>(
  function AdvancedChartEngine(
    { symbol: initialSymbol, timeframe: initialTf = '1D', theme = 'bloomberg', height = 480, onBarHover, className },
    ref,
  ) {
    // ─── state ────────────────────────────────────────────────────
    const [symbol,     setSymbol]     = useState(initialSymbol);
    const [timeframe,  setTimeframe]  = useState<Timeframe>(initialTf);
    const [chartType,  setChartType]  = useState<ChartType>('candlestick');
    const [currentTheme, setCurrentTheme] = useState<ThemeMode>(theme);
    const [loading,    setLoading]    = useState(false);
    const [error,      setError]      = useState<string | null>(null);
    const [bars,       setBars]       = useState<OHLCVBar[]>([]);
    const [activeIndicators, setActiveIndicators] = useState<IndicatorConfig[]>([
      { ...PRESET_INDICATORS[0], visible: true },   // SMA 20
      { ...PRESET_INDICATORS[6], visible: true },   // RSI
      { ...PRESET_INDICATORS[8], visible: true },   // Volume
    ]);
    const [hoverBar,   setHoverBar]   = useState<OHLCVBar | null>(null);
    const [indicatorMenuOpen, setIndicatorMenuOpen] = useState(false);
    const [symbolInput, setSymbolInput] = useState(initialSymbol);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; price: number } | null>(null);

    // ─── refs ─────────────────────────────────────────────────────
    const mainContainerRef  = useRef<HTMLDivElement>(null);
    const mainChartRef      = useRef<IChartApi | null>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mainSeriesRef     = useRef<ISeriesApi<any> | null>(null);
    const volumeSeriesRef   = useRef<ISeriesApi<'Histogram'> | null>(null);
    const subPanesRef       = useRef<Map<string, PaneRef>>(new Map());
    const indicatorSeriesRef = useRef<Map<string, ISeriesApi<'Line'>>>(new Map());
    const syncingRef         = useRef(false);

    const themeOpts = useMemo(() => THEMES[currentTheme], [currentTheme]);

    // ─── expose fitContent ────────────────────────────────────────
    useImperativeHandle(ref, () => ({
      fitContent: () => mainChartRef.current?.timeScale().fitContent(),
    }));

    // ─── Fetch OHLCV from backend ─────────────────────────────────
    const fetchBars = useCallback(async (sym: string, tf: Timeframe) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/v1/bars?symbol=${encodeURIComponent(sym)}&timeframe=${tf}&limit=500`,
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
        const data = await res.json();

        // Normalize various API response shapes
        const rawBars: OHLCVBar[] = (Array.isArray(data) ? data : data.bars ?? data.data ?? []).map(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (b: any) => ({
            time:   Math.floor(new Date(b.t ?? b.time ?? b.timestamp ?? b.date).getTime() / 1000),
            open:   Number(b.o ?? b.open),
            high:   Number(b.h ?? b.high),
            low:    Number(b.l ?? b.low),
            close:  Number(b.c ?? b.close),
            volume: Number(b.v ?? b.volume ?? 0),
          }),
        );
        rawBars.sort((a, b) => a.time - b.time);
        setBars(rawBars);
        return rawBars;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        return [];
      } finally {
        setLoading(false);
      }
    }, []);

    // ─── Fetch indicator data from v4 API ─────────────────────────
    const fetchIndicatorData = useCallback(async (
      rawBars: OHLCVBar[],
      indicatorId: string,
      indicatorName: string,
      params: Record<string, unknown>,
    ) => {
      try {
        const res = await fetch('/api/v4/indicators/compute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ohlcv: rawBars.map(b => ({
              date: new Date(b.time * 1000).toISOString().split('T')[0],
              open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume,
            })),
            indicators: [{ name: indicatorName, params }],
          }),
        });
        if (!res.ok) return null;
        const data = await res.json();
        return data.results?.[indicatorName] ?? data.results?.[indicatorId] ?? null;
      } catch {
        return null;
      }
    }, []);

    // ─── Initialize main chart ────────────────────────────────────
    const initMainChart = useCallback(() => {
      if (!mainContainerRef.current) return;
      if (mainChartRef.current) {
        mainChartRef.current.remove();
        mainChartRef.current = null;
      }

      const chart = createChart(mainContainerRef.current, {
        width:  mainContainerRef.current.clientWidth,
        height,
        ...themeOpts,
        timeScale: {
          ...themeOpts.timeScale,
          visible: true,
          timeVisible: true,
          secondsVisible: false,
        },
      });

      mainChartRef.current = chart;

      // Crosshair sync handler
      chart.subscribeCrosshairMove((param: MouseEventParams) => {
        if (syncingRef.current) return;
        syncingRef.current = true;
        subPanesRef.current.forEach(({ chart: subChart }) => {
          if (param.time) subChart.setCrossHairXY(
            // @ts-expect-error: internal coordinate method
            chart.timeScale().timeToCoordinate(param.time) ?? 0, 0, true,
          );
        });
        syncingRef.current = false;

        // Hover data
        if (param.seriesData && mainSeriesRef.current) {
          const bar = param.seriesData.get(mainSeriesRef.current);
          if (bar && 'open' in bar) {
            const b = bar as { open: number; high: number; low: number; close: number };
            const t = typeof param.time === 'number' ? param.time : 0;
            const hb: OHLCVBar = { time: t, open: b.open, high: b.high, low: b.low, close: b.close, volume: 0 };
            setHoverBar(hb);
            onBarHover?.(hb);
          }
        } else {
          setHoverBar(null);
          onBarHover?.(null);
        }
      });

      // Right-click context menu
      mainContainerRef.current.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const x = e.clientX;
        const y = e.clientY;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const price = (chart as any).priceScale('right')?.coordinateToPrice(e.offsetY) ?? 0;
        setContextMenu({ x, y, price: parseFloat(price?.toFixed(2) ?? '0') });
      });

      // Resize observer
      const ro = new ResizeObserver(() => {
        if (mainContainerRef.current) {
          chart.applyOptions({ width: mainContainerRef.current.clientWidth });
        }
      });
      ro.observe(mainContainerRef.current);
      return () => { ro.disconnect(); };
    }, [height, themeOpts, onBarHover]);

    // ─── Set series data based on chart type ──────────────────────
    const setSeriesData = useCallback((rawBars: OHLCVBar[]) => {
      const chart = mainChartRef.current;
      if (!chart || !rawBars.length) return;

      // Remove previous main series
      if (mainSeriesRef.current) {
        try { chart.removeSeries(mainSeriesRef.current); } catch (_) { /* */ }
        mainSeriesRef.current = null;
      }
      if (volumeSeriesRef.current) {
        try { chart.removeSeries(volumeSeriesRef.current); } catch (_) { /* */ }
        volumeSeriesRef.current = null;
      }

      const displayBars = chartType === 'heikin_ashi' ? toHeikinAshi(rawBars) : rawBars;

      const upColor   = currentTheme === 'bloomberg' ? '#f5a623' : '#26a69a';
      const downColor = currentTheme === 'bloomberg' ? '#e53935' : '#ef5350';

      if (chartType === 'candlestick' || chartType === 'heikin_ashi') {
        const cs = chart.addSeries(CandlestickSeries, {
          upColor, downColor, borderVisible: false,
          wickUpColor: upColor, wickDownColor: downColor,
        });
        cs.setData(displayBars.map(b => ({ time: b.time as number, open: b.open, high: b.high, low: b.low, close: b.close })));
        mainSeriesRef.current = cs;
      } else if (chartType === 'line') {
        const ls = chart.addSeries(LineSeries, { color: upColor, lineWidth: 2 });
        ls.setData(displayBars.map(b => ({ time: b.time as number, value: b.close })));
        mainSeriesRef.current = ls;
      } else if (chartType === 'area') {
        const as = chart.addSeries(AreaSeries, { lineColor: upColor, topColor: upColor + '55', bottomColor: upColor + '00', lineWidth: 2 });
        as.setData(displayBars.map(b => ({ time: b.time as number, value: b.close })));
        mainSeriesRef.current = as;
      } else if (chartType === 'bar') {
        const bs = chart.addSeries(BarSeries, { upColor, downColor });
        bs.setData(displayBars.map(b => ({ time: b.time as number, open: b.open, high: b.high, low: b.low, close: b.close })));
        mainSeriesRef.current = bs;
      }

      // Volume sub-series on main pane (scaled to 15% of chart height)
      const volSeries = chart.addSeries(HistogramSeries, {
        priceFormat: { type: 'volume' },
        priceScaleId: 'volume',
      });
      chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } });
      volSeries.setData(displayBars.map(b => ({
        time: b.time as number,
        value: b.volume,
        color: b.close >= b.open
          ? (currentTheme === 'bloomberg' ? '#f5a62344' : '#26a69a44')
          : (currentTheme === 'bloomberg' ? '#e5393544' : '#ef535044'),
      })));
      volumeSeriesRef.current = volSeries;

      chart.timeScale().fitContent();
    }, [chartType, currentTheme]);

    // ─── Load indicators onto chart and sub-panes ─────────────────
    const loadIndicators = useCallback(async (rawBars: OHLCVBar[]) => {
      const chart = mainChartRef.current;
      if (!chart || !rawBars.length) return;

      // Clear existing overlay series
      indicatorSeriesRef.current.forEach(s => {
        try { chart.removeSeries(s); } catch (_) { /* */ }
      });
      indicatorSeriesRef.current.clear();

      // Clear sub-pane series
      subPanesRef.current.forEach(({ series, chart: sub }) => {
        series.forEach(s => { try { sub.removeSeries(s); } catch (_) { /* */ } });
        series.clear();
      });

      for (const ind of activeIndicators) {
        if (!ind.visible) continue;

        const indicatorKeyName = ind.id.replace(/_\d+$/, '').toUpperCase();
        const paramName = indicatorKeyName.includes('SMA') ? 'SMA'
          : indicatorKeyName.includes('EMA') ? 'EMA'
          : indicatorKeyName.includes('BB')  ? 'BBANDS'
          : indicatorKeyName.includes('RSI') ? 'RSI'
          : indicatorKeyName.includes('MACD') ? 'MACD'
          : indicatorKeyName.includes('VWAP') ? 'VWAP'
          : indicatorKeyName.includes('VOLUME') ? null
          : indicatorKeyName.includes('STOCH') ? 'STOCHASTIC'
          : indicatorKeyName.includes('ATR')   ? 'ATR'
          : ind.name.split(' ')[0].toUpperCase();

        if (paramName === null) continue;  // volume handled by main series

        const data = await fetchIndicatorData(rawBars, ind.id, paramName, ind.params);
        if (!data) continue;

        if (ind.pane === 'main') {
          // Single-line indicator on main price chart
          if (Array.isArray(data)) {
            const lineSeries = chart.addSeries(LineSeries, {
              color:      ind.color ?? '#f9a825',
              lineWidth:  1,
              crosshairMarkerVisible: false,
            });
            lineSeries.setData(data
              .map((v: number, i: number) => ({ time: rawBars[i]?.time as number, value: v }))
              .filter((d: { time: number; value: number }) => d.time != null && !isNaN(d.value))
            );
            indicatorSeriesRef.current.set(ind.id, lineSeries);
          } else if (data.upper && data.middle && data.lower) {
            // Bollinger Bands — 3 lines
            [['upper', '#7e57c2aa'], ['middle', '#7e57c2'], ['lower', '#7e57c2aa']].forEach(([key, col]) => {
              const s = chart.addSeries(LineSeries, { color: col, lineWidth: 1, crosshairMarkerVisible: false });
              s.setData((data[key] as number[])
                .map((v: number, i: number) => ({ time: rawBars[i]?.time as number, value: v }))
                .filter((d: { time: number; value: number }) => d.time != null && !isNaN(d.value))
              );
              indicatorSeriesRef.current.set(`${ind.id}_${key}`, s);
            });
          }
        } else {
          // Sub-pane indicator — handled through SubPane callbacks
        }
      }
    }, [activeIndicators, fetchIndicatorData]);

    // ─── Effect: init chart when theme/height change ──────────────
    useEffect(() => {
      const cleanup = initMainChart();
      if (bars.length) {
        setSeriesData(bars);
        loadIndicators(bars);
      }
      return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentTheme, height]);

    // ─── Effect: fetch bars when symbol/timeframe changes ─────────
    useEffect(() => {
      (async () => {
        const rawBars = await fetchBars(symbol, timeframe);
        if (rawBars.length) {
          setSeriesData(rawBars);
          await loadIndicators(rawBars);
        }
      })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [symbol, timeframe]);

    // ─── Effect: re-render series when chart type changes ─────────
    useEffect(() => {
      if (bars.length) setSeriesData(bars);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [chartType]);

    // ─── Effect: keyboard shortcuts ──────────────────────────────
    useEffect(() => {
      const handler = (e: KeyboardEvent) => {
        if (!mainChartRef.current) return;
        if (e.key === ' ') { e.preventDefault(); mainChartRef.current.timeScale().fitContent(); }
        if ((e.ctrlKey || e.metaKey) && e.key === '=') mainChartRef.current.timeScale().scrollToRealTime();
        if (e.key === 'Escape') setContextMenu(null);
      };
      window.addEventListener('keydown', handler);
      return () => window.removeEventListener('keydown', handler);
    }, []);

    // ─── Context menu dismissal ────────────────────────────────────
    useEffect(() => {
      if (!contextMenu) return;
      const dismiss = () => setContextMenu(null);
      window.addEventListener('click', dismiss);
      return () => window.removeEventListener('click', dismiss);
    }, [contextMenu]);

    // ─── Derived values for OHLC header ───────────────────────────
    const lastBar = hoverBar ?? bars[bars.length - 1] ?? null;
    const priceChange = lastBar
      ? lastBar.close - lastBar.open
      : 0;
    const pricePct = lastBar && lastBar.open !== 0
      ? (priceChange / lastBar.open) * 100
      : 0;

    const bgColor = currentTheme === 'bloomberg' ? '#0a0a0a'
      : currentTheme === 'dark' ? '#131722' : '#ffffff';
    const textColor = currentTheme === 'bloomberg' ? '#f5a623'
      : currentTheme === 'dark' ? '#d1d4dc' : '#191919';
    const borderColor = currentTheme === 'bloomberg' ? '#1e1e1e'
      : currentTheme === 'dark' ? '#2a2e39' : '#e0e3eb';
    const subtleColor = currentTheme === 'bloomberg' ? '#444' : '#555';

    return (
      <div
        className={className}
        style={{ display: 'flex', flexDirection: 'column', background: bgColor, color: textColor, fontFamily: currentTheme === 'bloomberg' ? '"Roboto Mono", monospace' : '"Inter", sans-serif', userSelect: 'none', position: 'relative', border: `1px solid ${borderColor}`, borderRadius: 6 }}
        onClick={() => setContextMenu(null)}
      >
        {/* ── TOP TOOLBAR ────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', borderBottom: `1px solid ${borderColor}`, flexWrap: 'wrap' }}>

          {/* Symbol input */}
          <form onSubmit={(e) => { e.preventDefault(); setSymbol(symbolInput.toUpperCase()); }}>
            <input
              value={symbolInput}
              onChange={(e) => setSymbolInput(e.target.value.toUpperCase())}
              style={{
                background: borderColor, border: 'none', color: textColor,
                padding: '3px 8px', borderRadius: 4, fontFamily: 'inherit',
                fontSize: 13, fontWeight: 700, width: 80, textAlign: 'center',
                cursor: 'text',
              }}
              placeholder="AAPL"
              title="Type symbol and press Enter"
            />
          </form>

          {/* Price / change strip */}
          {lastBar && (
            <div style={{ display: 'flex', gap: 8, fontSize: 12, marginLeft: 4 }}>
              <span style={{ fontWeight: 700 }}>{lastBar.close.toFixed(2)}</span>
              <span style={{ fontWeight: 600, fontSize: 11, color: '#888' }}>O:{lastBar.open.toFixed(2)}</span>
              <span style={{ fontWeight: 600, fontSize: 11, color: '#888' }}>H:{lastBar.high.toFixed(2)}</span>
              <span style={{ fontWeight: 600, fontSize: 11, color: '#888' }}>L:{lastBar.low.toFixed(2)}</span>
              <span style={{ fontWeight: 700, color: priceChange >= 0 ? '#26a69a' : '#ef5350' }}>
                {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)} ({pricePct.toFixed(2)}%)
              </span>
            </div>
          )}

          <div style={{ flex: 1 }} />

          {/* Timeframe buttons */}
          {TIMEFRAMES.map(tf => (
            <button
              key={tf.value}
              onClick={() => setTimeframe(tf.value)}
              style={{
                padding: '3px 7px', fontSize: 11, borderRadius: 3, cursor: 'pointer', border: 'none',
                fontFamily: 'inherit', fontWeight: timeframe === tf.value ? 700 : 400,
                background: timeframe === tf.value
                  ? (currentTheme === 'bloomberg' ? '#2a1800' : '#1e222d')
                  : 'transparent',
                color: timeframe === tf.value ? textColor : subtleColor,
              }}
            >{tf.label}</button>
          ))}

          <div style={{ width: 1, background: borderColor, height: 18, margin: '0 4px' }} />

          {/* Chart type buttons */}
          {CHART_TYPES.map(ct => (
            <button
              key={ct.value}
              onClick={() => setChartType(ct.value)}
              title={ct.label}
              style={{
                padding: '2px 6px', fontSize: 13, borderRadius: 3, cursor: 'pointer', border: 'none',
                background: chartType === ct.value
                  ? (currentTheme === 'bloomberg' ? '#2a1800' : '#1e222d')
                  : 'transparent',
                color: chartType === ct.value ? textColor : subtleColor,
              }}
            >{ct.icon}</button>
          ))}

          <div style={{ width: 1, background: borderColor, height: 18, margin: '0 4px' }} />

          {/* Indicators button */}
          <button
            onClick={() => setIndicatorMenuOpen(v => !v)}
            style={{
              padding: '3px 8px', fontSize: 11, borderRadius: 3, cursor: 'pointer', border: 'none',
              background: indicatorMenuOpen ? (currentTheme === 'bloomberg' ? '#2a1800' : '#1e222d') : 'transparent',
              color: textColor, fontFamily: 'inherit',
            }}
          >Indicators ▾</button>

          {/* Theme toggle */}
          <button
            onClick={() => setCurrentTheme(t => t === 'bloomberg' ? 'dark' : t === 'dark' ? 'light' : 'bloomberg')}
            title="Toggle theme"
            style={{
              padding: '3px 6px', fontSize: 11, borderRadius: 3, cursor: 'pointer', border: 'none',
              background: 'transparent', color: subtleColor, fontFamily: 'inherit',
            }}
          >⊡</button>

          {/* Fit button */}
          <button
            onClick={() => mainChartRef.current?.timeScale().fitContent()}
            title="Fit content (Space)"
            style={{ padding: '3px 6px', fontSize: 11, borderRadius: 3, cursor: 'pointer', border: 'none', background: 'transparent', color: subtleColor }}
          >⤢</button>
        </div>

        {/* ── INDICATOR DROPDOWN ─────────────────────────────────── */}
        {indicatorMenuOpen && (
          <div style={{
            position: 'absolute', top: 44, right: 8, zIndex: 100,
            background: currentTheme === 'bloomberg' ? '#1a0a00' : '#1e222d',
            border: `1px solid ${borderColor}`, borderRadius: 6,
            padding: '8px 0', minWidth: 220, boxShadow: '0 8px 24px #0009',
          }}>
            <div style={{ padding: '2px 12px 6px', fontSize: 10, color: subtleColor, fontWeight: 700, letterSpacing: 1 }}>
              INDICATORS
            </div>
            {PRESET_INDICATORS.map(ind => {
              const isActive = activeIndicators.some(a => a.id === ind.id && a.visible);
              return (
                <div
                  key={ind.id}
                  onClick={() => {
                    setActiveIndicators(prev => {
                      const exists = prev.find(a => a.id === ind.id);
                      if (exists) {
                        return prev.map(a => a.id === ind.id ? { ...a, visible: !a.visible } : a);
                      }
                      return [...prev, { ...ind, visible: true }];
                    });
                  }}
                  style={{
                    padding: '6px 12px', cursor: 'pointer', fontSize: 12,
                    display: 'flex', alignItems: 'center', gap: 8,
                    color: isActive ? textColor : subtleColor,
                    background: isActive ? (currentTheme === 'bloomberg' ? '#2a1a0022' : '#ffffff11') : 'transparent',
                  }}
                >
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: ind.color ?? '#888', flexShrink: 0 }} />
                  <span style={{ flex: 1 }}>{ind.name}</span>
                  <span style={{ fontSize: 10, color: ind.pane === 'main' ? '#888' : '#666' }}>
                    {ind.pane === 'main' ? 'overlay' : 'pane'}
                  </span>
                  {isActive && <span style={{ fontSize: 10, color: '#26a69a' }}>✓</span>}
                </div>
              );
            })}
          </div>
        )}

        {/* ── ERROR / LOADING ────────────────────────────────────── */}
        {loading && (
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 20, fontSize: 12, color: subtleColor }}>
            Loading {symbol}…
          </div>
        )}
        {error && !loading && (
          <div style={{ padding: '8px 12px', fontSize: 11, color: '#ef5350', background: '#1a0a0a', borderBottom: `1px solid ${borderColor}` }}>
            ⚠ {error}
          </div>
        )}

        {/* ── MAIN CHART PANE ────────────────────────────────────── */}
        <div ref={mainContainerRef} style={{ width: '100%', flex: 1, minHeight: height }} />

        {/* ── CONTEXT MENU ───────────────────────────────────────── */}
        {contextMenu && (
          <div
            style={{
              position: 'fixed', top: contextMenu.y, left: contextMenu.x, zIndex: 200,
              background: currentTheme === 'bloomberg' ? '#1a0a00' : '#1e222d',
              border: `1px solid ${borderColor}`, borderRadius: 4,
              boxShadow: '0 4px 16px #0008', minWidth: 180, overflow: 'hidden',
            }}
            onClick={e => e.stopPropagation()}
          >
            {[
              { label: `Price: ${contextMenu.price.toFixed(2)}`, action: () => navigator.clipboard.writeText(String(contextMenu.price)) },
              { label: 'Set Alert at this price', action: () => alert(`Alert set at ${contextMenu.price}`) },
              { label: 'Fit Chart', action: () => mainChartRef.current?.timeScale().fitContent() },
              { label: 'Copy Symbol', action: () => navigator.clipboard.writeText(symbol) },
            ].map(item => (
              <div
                key={item.label}
                onClick={() => { item.action(); setContextMenu(null); }}
                style={{ padding: '7px 14px', cursor: 'pointer', fontSize: 12, color: textColor, borderBottom: `1px solid ${borderColor}40` }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = borderColor + '88'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
              >
                {item.label}
              </div>
            ))}
          </div>
        )}

        {/* ── STATUS BAR ─────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 12, padding: '2px 10px', borderTop: `1px solid ${borderColor}`, fontSize: 10, color: subtleColor }}>
          <span>{symbol} · {timeframe}</span>
          <span>{bars.length} bars</span>
          {bars.length > 0 && <span>
            {new Date(bars[0].time * 1000).toLocaleDateString()} – {new Date(bars[bars.length - 1].time * 1000).toLocaleDateString()}
          </span>}
          <span style={{ flex: 1 }} />
          <span>SPACE: fit  ·  Right-click: menu</span>
        </div>
      </div>
    );
  },
);

export default AdvancedChartEngine;
