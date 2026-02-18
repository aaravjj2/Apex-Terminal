/**
 * Uncertainty Cone Tile
 * 
 * Displays price forecast with confidence interval cones based on historical volatility.
 */

import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, RefreshCw, AlertCircle } from 'lucide-react';
import { Line } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Filler,
    Title,
    Tooltip,
    Legend,
} from 'chart.js';
import type { TooltipItem } from 'chart.js';
import { ApiClient } from '../../../data/ApiClient';
import type { ForecastResponse } from '../../../data/ApiClient';
import { Panel } from '../../../ui/Panel';
import { Button } from '../../../ui/Button';

// Register Chart.js components
ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Filler,
    Title,
    Tooltip,
    Legend
);

import { useSymbol } from '../../../state/appStore';

interface TileProps {
    tileId: string;
    onClose: () => void;
    onMaximize: () => void;
    isMaximized: boolean;
}


interface UncertaintyConeContentProps {
    symbol: string;
    showControls?: boolean;
}

export function UncertaintyConeContent({ symbol, showControls = true }: UncertaintyConeContentProps) {
    const days = 30; // Default days for tile view
    const [forecast, setForecast] = useState<ForecastResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchForecast = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await ApiClient.getForecast(symbol, days);
            setForecast(data);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setLoading(false);
        }
    }, [symbol, days]);

    useEffect(() => {
        fetchForecast();
    }, [fetchForecast]);

    // Generate chart data
    const chartData = forecast ? {
        labels: Array.from({ length: days }, (_, i) => `D+${i + 1}`),
        datasets: [
            // 95% confidence - outer cone (light fill)
            forecast.cones['95%'] && {
                label: '95% Upper',
                data: forecast.cones['95%'].upper,
                borderColor: 'rgba(59, 130, 246, 0.3)',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                fill: '+1',
                pointRadius: 0,
                borderWidth: 1,
            },
            forecast.cones['95%'] && {
                label: '95% Lower',
                data: forecast.cones['95%'].lower,
                borderColor: 'rgba(59, 130, 246, 0.3)',
                backgroundColor: 'transparent',
                fill: false,
                pointRadius: 0,
                borderWidth: 1,
            },
            // 68% confidence - inner cone (darker fill)
            forecast.cones['68%'] && {
                label: '68% Upper',
                data: forecast.cones['68%'].upper,
                borderColor: 'rgba(34, 197, 94, 0.5)',
                backgroundColor: 'rgba(34, 197, 94, 0.2)',
                fill: '+1',
                pointRadius: 0,
                borderWidth: 1.5,
            },
            forecast.cones['68%'] && {
                label: '68% Lower',
                data: forecast.cones['68%'].lower,
                borderColor: 'rgba(34, 197, 94, 0.5)',
                backgroundColor: 'transparent',
                fill: false,
                pointRadius: 0,
                borderWidth: 1.5,
            },
            // Median line
            forecast.cones['68%'] && {
                label: 'Median',
                data: forecast.cones['68%'].median,
                borderColor: '#fff',
                backgroundColor: 'transparent',
                fill: false,
                pointRadius: 0,
                borderWidth: 2,
                borderDash: [4, 4],
            },
        ].filter(Boolean),
    } : { labels: [], datasets: [] };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false,
            },
            tooltip: {
                mode: 'index' as const,
                intersect: false,
                callbacks: {
                    label: (context: TooltipItem<'line'>) => {
                        const label = context.dataset.label || '';
                        const value = context.parsed.y;
                        return `${label}: $${value?.toFixed(2) ?? 'N/A'}`;
                    },
                },
            },
        },
        scales: {
            x: {
                grid: {
                    color: 'rgba(255, 255, 255, 0.1)',
                },
                ticks: {
                    color: 'rgba(255, 255, 255, 0.5)',
                    maxTicksLimit: 6,
                },
            },
            y: {
                grid: {
                    color: 'rgba(255, 255, 255, 0.1)',
                },
                ticks: {
                    color: 'rgba(255, 255, 255, 0.5)',
                    callback: (value: number | string) => `$${value}`,
                },
            },
        },
        interaction: {
            mode: 'nearest' as const,
            axis: 'x' as const,
            intersect: false,
        },
    };

    return (
        <div className="h-full flex flex-col min-h-0">
            {showControls && (
                <div className="flex justify-end p-2">
                    <Button variant="ghost" size="sm" onClick={fetchForecast} disabled={loading}>
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    </Button>
                </div>
            )}

            <div className="flex-1 p-2 min-h-0">
                {error && (
                    <div className="flex items-center gap-2 text-red-500 mb-4">
                        <AlertCircle size={16} />
                        <span className="text-sm">{error}</span>
                    </div>
                )}

                {forecast && (
                    <>
                        {/* Stats */}
                        <div className="grid grid-cols-3 gap-4 mb-4 text-center">
                            <div>
                                <p className="text-xs text-text-muted">Current</p>
                                <p className="text-lg font-mono">${forecast.current_price.toFixed(2)}</p>
                            </div>
                            <div>
                                <p className="text-xs text-text-muted">Ann. Vol</p>
                                <p className="text-lg font-mono">{(forecast.historical_volatility * 100).toFixed(1)}%</p>
                            </div>
                            <div>
                                <p className="text-xs text-text-muted">Days</p>
                                <p className="text-lg font-mono">{forecast.forecast_days}</p>
                            </div>
                        </div>

                        {/* Chart */}
                        <div className="h-48">
                            <Line data={chartData} options={chartOptions} />
                        </div>

                        {/* Legend */}
                        <div className="flex items-center justify-center gap-6 mt-4 text-xs text-text-muted">
                            <div className="flex items-center gap-1">
                                <div className="w-3 h-3 rounded bg-green-500/30 border border-green-500"></div>
                                <span>68% Confidence</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <div className="w-3 h-3 rounded bg-blue-500/20 border border-blue-500/50"></div>
                                <span>95% Confidence</span>
                            </div>
                        </div>
                    </>
                )}

                {!forecast && !error && loading && (
                    <div className="h-48 flex items-center justify-center">
                        <RefreshCw size={24} className="animate-spin text-brand" />
                    </div>
                )}
            </div>
        </div>
    );
}

export function UncertaintyCone({ tileId: _tileId }: TileProps) {
    const symbol = useSymbol();

    return (
        <Panel className="h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
                <div className="flex items-center gap-2">
                    <TrendingUp size={18} className="text-brand" />
                    <h3 className="font-semibold text-text">Uncertainty Cone</h3>
                    <span className="text-sm text-text-muted">({symbol})</span>
                </div>
            </div>

            {/* Content */}
            <UncertaintyConeContent symbol={symbol} />
        </Panel>
    );
}

