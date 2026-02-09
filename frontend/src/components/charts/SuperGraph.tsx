/**
 * SuperGraph - Reusable Chart Foundation Component
 * 
 * Features:
 * - Lightweight chart wrapper using Recharts
 * - Themeable with dark/light mode support
 * - Responsive sizing
 * - Common chart patterns: Line, Area, Bar, Composed
 */

import React, { useMemo } from 'react';
import {
    ResponsiveContainer,
    ComposedChart,
    Line,
    Area,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ReferenceLine,
} from 'recharts';

// Types
export interface ChartDataPoint {
    timestamp: string | number;
    value: number;
    [key: string]: string | number | undefined;
}

export interface SeriesConfig {
    dataKey: string;
    type: 'line' | 'area' | 'bar';
    color: string;
    name?: string;
    strokeWidth?: number;
    fillOpacity?: number;
    dot?: boolean;
}

export interface SuperGraphProps {
    data: ChartDataPoint[];
    series: SeriesConfig[];
    height?: number | string;
    xAxisKey?: string;
    showGrid?: boolean;
    showLegend?: boolean;
    showTooltip?: boolean;
    zeroLine?: boolean;
    className?: string;
    formatXAxis?: (value: string | number) => string;
    formatTooltip?: (value: number) => string;
}

// Theme colors
const theme = {
    grid: '#333',
    axis: '#666',
    tooltip: {
        bg: '#1a1a2e',
        border: '#333',
        text: '#fff',
    },
    reference: '#444',
};

// Custom Tooltip
const CustomTooltip = ({
    active,
    payload,
    label,
    formatTooltip
}: {
    active?: boolean;
    payload?: Array<{ value: number; color: string; name: string }>;
    label?: string;
    formatTooltip?: (value: number) => string;
}) => {
    if (!active || !payload?.length) return null;

    const formatter = formatTooltip || ((v: number) => v.toFixed(2));

    return (
        <div
            style={{
                backgroundColor: theme.tooltip.bg,
                border: `1px solid ${theme.tooltip.border}`,
                borderRadius: '4px',
                padding: '8px 12px',
                fontSize: '12px',
                color: theme.tooltip.text,
            }}
        >
            <p style={{ marginBottom: '4px', color: '#888' }}>{label}</p>
            {payload.map((entry, index) => (
                <p key={index} style={{ color: entry.color, margin: '2px 0' }}>
                    {entry.name}: {formatter(entry.value)}
                </p>
            ))}
        </div>
    );
};

export const SuperGraph: React.FC<SuperGraphProps> = ({
    data,
    series,
    height = 200,
    xAxisKey = 'timestamp',
    showGrid = true,
    showLegend = false,
    showTooltip = true,
    zeroLine = false,
    className = '',
    formatXAxis,
    formatTooltip,
}) => {
    // Memoize rendered series
    const renderedSeries = useMemo(() => {
        return series.map((s, idx) => {
            const commonProps = {
                key: idx,
                dataKey: s.dataKey,
                name: s.name || s.dataKey,
                stroke: s.color,
                strokeWidth: s.strokeWidth || 2,
            };

            switch (s.type) {
                case 'area':
                    return (
                        <Area
                            {...commonProps}
                            fill={s.color}
                            fillOpacity={s.fillOpacity || 0.3}
                            dot={s.dot ?? false}
                        />
                    );
                case 'bar':
                    return (
                        <Bar
                            {...commonProps}
                            fill={s.color}
                            fillOpacity={s.fillOpacity || 0.8}
                        />
                    );
                case 'line':
                default:
                    return (
                        <Line
                            {...commonProps}
                            dot={s.dot ?? false}
                            activeDot={{ r: 4 }}
                        />
                    );
            }
        });
    }, [series]);

    const defaultXAxisFormatter = (value: string | number) => {
        if (typeof value === 'string') {
            const date = new Date(value);
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }
        return String(value);
    };

    return (
        <div className={`supergraph-container ${className}`} style={{ width: '100%', height }}>
            <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                    {showGrid && (
                        <CartesianGrid
                            strokeDasharray="3 3"
                            stroke={theme.grid}
                            vertical={false}
                        />
                    )}
                    <XAxis
                        dataKey={xAxisKey}
                        tick={{ fill: theme.axis, fontSize: 10 }}
                        tickLine={{ stroke: theme.axis }}
                        axisLine={{ stroke: theme.axis }}
                        tickFormatter={formatXAxis || defaultXAxisFormatter}
                        minTickGap={30}
                    />
                    <YAxis
                        tick={{ fill: theme.axis, fontSize: 10 }}
                        tickLine={{ stroke: theme.axis }}
                        axisLine={{ stroke: theme.axis }}
                        width={50}
                        tickFormatter={(v: number) => formatTooltip?.(v) || v.toLocaleString()}
                    />
                    {showTooltip && (
                        <Tooltip
                            content={<CustomTooltip formatTooltip={formatTooltip} />}
                            cursor={{ stroke: theme.axis, strokeWidth: 1 }}
                        />
                    )}
                    {showLegend && (
                        <Legend
                            wrapperStyle={{ fontSize: '12px', color: theme.axis }}
                        />
                    )}
                    {zeroLine && (
                        <ReferenceLine y={0} stroke={theme.reference} strokeDasharray="3 3" />
                    )}
                    {renderedSeries}
                </ComposedChart>
            </ResponsiveContainer>
        </div>
    );
};

/**
 * Pre-configured chart variants
 */

// Equity Curve Chart
export const EquityCurve: React.FC<{
    data: Array<{ date: string; equity: number }>;
    height?: number;
}> = ({ data, height = 120 }) => (
    <SuperGraph
        data={data.map(d => ({ timestamp: d.date, value: d.equity }))}
        series={[{ dataKey: 'value', type: 'area', color: '#22c55e', name: 'Equity' }]}
        height={height}
        formatTooltip={(v) => `$${v.toLocaleString()}`}
    />
);

// P&L Chart
export const PnLChart: React.FC<{
    data: Array<{ date: string; pnl: number }>;
    height?: number;
}> = ({ data, height = 120 }) => (
    <SuperGraph
        data={data.map(d => ({ timestamp: d.date, value: d.pnl }))}
        series={[{
            dataKey: 'value',
            type: 'bar',
            color: '#06b6d4',
            name: 'P&L'
        }]}
        height={height}
        zeroLine
        formatTooltip={(v) => `${v >= 0 ? '+' : ''}$${v.toFixed(2)}`}
    />
);

export default SuperGraph;
