import { useState, useEffect, useRef } from 'react';
import { Activity, Gauge, Zap, AlertTriangle, RefreshCw } from 'lucide-react';

const API_BASE = 'http://127.0.0.1:8000/api/v1';

interface Metrics {
    uptime_seconds: number;
    feed_latency_avg_ms: number;
    order_latency_avg_ms: number;
    bar_processing_avg_ms: number;
    dropped_messages: number;
    ws_messages_received: number;
    ws_messages_sent: number;
    error_count: number;
}

interface LatencyPoint {
    timestamp: string;
    value: number;
}

export function PerformanceDashboard() {
    const [metrics, setMetrics] = useState<Metrics | null>(null);
    const [feedLatency, setFeedLatency] = useState<LatencyPoint[]>([]);
    const [loading, setLoading] = useState(false);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        fetchMetrics();
        const interval = setInterval(fetchMetrics, 5000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        drawChart();
    }, [feedLatency]);

    const fetchMetrics = async () => {
        setLoading(true);
        try {
            const [metricsRes, latencyRes] = await Promise.all([
                fetch(`${API_BASE}/metrics`),
                fetch(`${API_BASE}/metrics/feed-latency?limit=50`)
            ]);

            if (metricsRes.ok) {
                setMetrics(await metricsRes.json());
            }
            if (latencyRes.ok) {
                setFeedLatency(await latencyRes.json());
            }
        } catch (e) {
            console.error('Failed to fetch metrics:', e);
        } finally {
            setLoading(false);
        }
    };

    const drawChart = () => {
        const canvas = canvasRef.current;
        if (!canvas || feedLatency.length === 0) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const { width, height } = canvas;
        ctx.clearRect(0, 0, width, height);

        // Background
        ctx.fillStyle = '#131722';
        ctx.fillRect(0, 0, width, height);

        // Grid
        ctx.strokeStyle = '#2a2e39';
        ctx.lineWidth = 1;
        for (let i = 0; i < 5; i++) {
            const y = (height / 5) * i;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }

        // Data
        const values = feedLatency.map(p => p.value);
        const max = Math.max(...values, 100);
        const min = 0;

        ctx.strokeStyle = '#2962ff';
        ctx.lineWidth = 2;
        ctx.beginPath();

        values.forEach((val, i) => {
            const x = (width / (values.length - 1)) * i;
            const y = height - ((val - min) / (max - min)) * height;

            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });

        ctx.stroke();

        // Fill
        ctx.lineTo(width, height);
        ctx.lineTo(0, height);
        ctx.closePath();
        ctx.fillStyle = 'rgba(41, 98, 255, 0.1)';
        ctx.fill();
    };

    const formatUptime = (seconds: number) => {
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        return `${hours}h ${mins}m`;
    };

    return (
        <div className="h-full flex flex-col bg-[#131722]">
            {/* Header */}
            <div className="h-10 border-b border-[#2a2e39] flex items-center px-4 justify-between bg-[#1e222d]">
                <div className="flex items-center gap-2">
                    <Activity size={16} className="text-[#2962ff]" />
                    <span className="text-sm font-bold text-[#d1d4dc]">Performance</span>
                </div>
                <button onClick={fetchMetrics} className="p-1 hover:bg-[#2a2e39] rounded">
                    <RefreshCw size={14} className={`text-[#787b86] ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* Metrics Grid */}
            <div className="p-4 grid grid-cols-4 gap-3">
                <MetricCard
                    label="Uptime"
                    value={metrics ? formatUptime(metrics.uptime_seconds) : '--'}
                    icon={<Activity size={14} />}
                />
                <MetricCard
                    label="Feed Latency"
                    value={metrics ? `${metrics.feed_latency_avg_ms}ms` : '--'}
                    icon={<Gauge size={14} />}
                    color={metrics && metrics.feed_latency_avg_ms > 100 ? '#f23645' : '#089981'}
                />
                <MetricCard
                    label="Order RTT"
                    value={metrics ? `${metrics.order_latency_avg_ms}ms` : '--'}
                    icon={<Zap size={14} />}
                />
                <MetricCard
                    label="Errors"
                    value={metrics ? String(metrics.error_count) : '--'}
                    icon={<AlertTriangle size={14} />}
                    color={metrics && metrics.error_count > 0 ? '#f23645' : '#787b86'}
                />
            </div>

            {/* Throughput */}
            <div className="px-4 pb-2 flex gap-4 text-xs">
                <div className="text-[#787b86]">
                    WS In: <span className="text-[#d1d4dc]">{metrics?.ws_messages_received ?? 0}</span>
                </div>
                <div className="text-[#787b86]">
                    WS Out: <span className="text-[#d1d4dc]">{metrics?.ws_messages_sent ?? 0}</span>
                </div>
                <div className="text-[#787b86]">
                    Dropped: <span className={metrics?.dropped_messages ? 'text-red-400' : 'text-[#d1d4dc]'}>{metrics?.dropped_messages ?? 0}</span>
                </div>
            </div>

            {/* Latency Chart */}
            <div className="flex-1 px-4 pb-4">
                <div className="text-xs text-[#787b86] mb-2">Feed Latency (last 50 samples)</div>
                <canvas
                    ref={canvasRef}
                    width={600}
                    height={150}
                    className="w-full h-36 rounded border border-[#2a2e39]"
                />
            </div>
        </div>
    );
}

function MetricCard({ label, value, icon, color }: { label: string, value: string, icon: React.ReactNode, color?: string }) {
    return (
        <div className="bg-[#1e222d] border border-[#2a2e39] rounded p-3">
            <div className="flex items-center gap-2 text-[#787b86] text-[10px] uppercase mb-1">
                {icon}
                {label}
            </div>
            <div className="text-lg font-bold" style={{ color: color || '#d1d4dc' }}>
                {value}
            </div>
        </div>
    );
}
