import { useEffect, useRef } from 'react';
import type { IChartApi, ISeriesApi } from 'lightweight-charts';
import { LineSeries, HistogramSeries } from 'lightweight-charts';
import { useStore } from '../../../state/store';
import { INDICATOR_REGISTRY } from '../../indicators/IndicatorRegistry';

export function useChartIndicators(chart: IChartApi | null) {
    const { activeIndicators, candles } = useStore();
    // Map of IndicatorID -> Map<SeriesKey, SeriesAPI>
    const seriesMapRef = useRef<Map<string, Map<string, ISeriesApi<any>>>>(new Map());

    useEffect(() => {
        if (!chart || candles.length === 0) return;

        // 1. Cleanup removed indicators
        const activeIds = new Set(activeIndicators.map(i => i.id));
        seriesMapRef.current.forEach((seriesSet, id) => {
            if (!activeIds.has(id)) {
                seriesSet.forEach(series => chart.removeSeries(series));
                seriesMapRef.current.delete(id);
            }
        });

        // 2. Render active indicators
        activeIndicators.forEach(ind => {
            const config = INDICATOR_REGISTRY[ind.type];
            if (!config) return;

            // Ensure series set exists
            let seriesSet = seriesMapRef.current.get(ind.id);
            if (!seriesSet) {
                seriesSet = new Map();
                seriesMapRef.current.set(ind.id, seriesSet);
            }

            // Defaults
            const mainColor = ind.color || '#2962ff';

            // --- Helper to manage series --- 
            const updateSeries = (
                key: string, 
                SeriesClass: any, 
                data: any[], 
                color: string, 
                options: any = {}
            ) => {
                if (!data || data.length === 0) return;

                // Filter out NaN/null/undefined values
                const validData = data.filter(d => {
                    return d && 
                           typeof d.value === 'number' && 
                           !isNaN(d.value) && 
                           isFinite(d.value) &&
                           d.time !== undefined;
                });

                if (validData.length === 0) return;

                // Convert time to seconds (Lightweight Charts requires seconds)
                const chartData = validData.map(d => ({
                    ...d,
                    time: Math.floor(d.time / 1000)
                }));

                let series = seriesSet!.get(key);
                if (!series) {
                    const seriesOptions: any = {
                        color: color,
                        lineWidth: 2,
                        priceLineVisible: false,
                        lastValueVisible: true,
                        ...options
                    };
                    
                    // Handle Pane Type
                    if (config.paneType === 'separate') {
                        seriesOptions.priceScaleId = ind.id;
                    }

                    series = chart.addSeries(SeriesClass, seriesOptions);
                    seriesSet!.set(key, series);
                    
                    // Configure separate pane scale AFTER adding series
                    if (config.paneType === 'separate') {
                        try {
                            // Use series.priceScale() if available, or chart.priceScale()
                            const scale = series.priceScale();
                            if (scale) {
                                scale.applyOptions({
                                    autoScale: true,
                                    scaleMargins: { top: 0.8, bottom: 0 }
                                });
                                // Also adjust main chart margins to make room
                                chart.priceScale('right').applyOptions({
                                    scaleMargins: { top: 0.1, bottom: 0.25 }
                                });
                            }
                        } catch (e) {
                            console.warn('Failed to configure price scale:', e);
                        }
                    }
                }
                
                // Update options if needed (e.g. color changed)
                series.applyOptions({ color });

                // Set Data
                series.setData(chartData);
            };

            // --- Main Series ---
            const mainType = config.renderType === 'histogram' ? HistogramSeries : LineSeries;
            updateSeries('main', mainType, ind.data, mainColor);

            // --- Signal Line ---
            if (ind.signalData) {
                // Determine signal color (usually orange-ish or distinct)
                const signalColor = config.params.find(p => p.name === 'signalColor')?.default as string || '#ff6d00';
                updateSeries('signal', LineSeries, ind.signalData, signalColor);
            }

            // --- Histogram (for MACD, etc) ---
            if (ind.histogramData) {
                // If main was line, this is extra histogram
                // Histogram color can be a function or string, but applyOptions expects string usually for 'color' prop
                // For per-bar color, we embed color in data for MACD.
                let histData = ind.histogramData;
                if (ind.type === 'MACD') {
                    // Map MACD histogram colors
                    histData = ind.histogramData.map(d => ({
                        ...d,
                        color: d.value >= 0 ? '#26a69a' : '#ef5350'
                    }));
                }

                updateSeries('hist', HistogramSeries, histData, '#bdbdbd');
                }

            // --- Upper / Lower Bands ---
            if (ind.upperData) {
                const bandColor = config.params.find(p => p.name === 'upperColor')?.default as string || '#26a69a'; // Default green-ish
                updateSeries('upper', LineSeries, ind.upperData, bandColor);
            }
            if (ind.lowerData) {
                const bandColor = config.params.find(p => p.name === 'lowerColor')?.default as string || '#ef5350'; // Default red-ish
                updateSeries('lower', LineSeries, ind.lowerData, bandColor);
            }
            
            // --- Span A / Span B (Ichimoku) ---
            // Lightweight charts doesn't do clouded areas natively easily without plugins
            // We just draw lines for now
        });

    }, [chart, activeIndicators, candles]);
}
