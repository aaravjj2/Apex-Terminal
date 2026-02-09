/**
 * Enhanced Command Center View
 * 
 * Unified dashboard combining:
 * - Financial Intelligence Dashboard
 * - Multi-Agent Finance Analysis
 * - Real-Time P&L Analytics
 * - Risk Assessment
 * - Portfolio Overview
 */

import { useState, useEffect, useCallback } from 'react';
import {
    Activity, Brain, Bot, BarChart2, Wallet, TrendingUp,
    TrendingDown, RefreshCw, Globe, Target, FileText
} from 'lucide-react';
import { cn } from '../../../ui/utils';
import { Badge } from '../../../ui/Badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../../ui/Tabs';
import { FinancialIntelligenceDashboard } from '../../dashboard/FinancialIntelligenceDashboard';
import { MultiAgentFinancePanel } from '../../dashboard/MultiAgentFinancePanel';
import { RealTimePnLAnalytics } from '../../dashboard/RealTimePnLAnalytics';
import { useAutopilotStore } from '../../autopilot/store';

const API_BASE = '/api/v1';

// Types
interface QuickStats {
    total_equity: number;
    open_pnl: number;
    day_pnl: number;
    buying_power: number;
    position_count: number;
    active_orders: number;
    win_rate: number;
}

interface MarketStatus {
    status: 'open' | 'closed' | 'pre' | 'post';
    next_open?: string;
    next_close?: string;
}

// Format helpers
const formatCurrency = (v: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v);

// Quick Stat Pill
function StatPill({ icon: Icon, label, value, trend, compact = false }: {
    icon: React.ElementType;
    label: string;
    value: string;
    trend?: 'up' | 'down' | 'neutral';
    compact?: boolean;
}) {
    return (
        <div className={cn(
            "flex items-center gap-2 px-3 py-1.5 bg-element-bg rounded-lg",
            compact ? "gap-1.5" : "gap-2"
        )}>
            <Icon size={compact ? 12 : 14} className={cn(
                trend === 'up' ? 'text-up' :
                trend === 'down' ? 'text-down' :
                'text-text-secondary'
            )} />
            {!compact && <span className="text-[10px] text-text-secondary uppercase">{label}</span>}
            <span className={cn(
                "text-sm font-semibold tabular-nums",
                trend === 'up' ? 'text-up' :
                trend === 'down' ? 'text-down' :
                'text-text'
            )}>
                {value}
            </span>
        </div>
    );
}

// Market Status Badge
function MarketStatusBadge({ status }: { status: MarketStatus | null }) {
    if (!status) return null;

    const colors = {
        open: 'bg-up/20 text-up border-up',
        closed: 'bg-down/20 text-down border-down',
        pre: 'bg-warn/20 text-warn border-warn',
        post: 'bg-brand/20 text-brand border-brand'
    };

    const labels = {
        open: '🟢 Market Open',
        closed: '🔴 Market Closed',
        pre: '🟡 Pre-Market',
        post: '🟣 After Hours'
    };

    return (
        <span className={cn(
            "px-2 py-0.5 rounded text-[10px] font-bold uppercase border",
            colors[status.status]
        )}>
            {labels[status.status]}
        </span>
    );
}

// Main Component
export function EnhancedCommandCenterView() {
    const [stats, setStats] = useState<QuickStats | null>(null);
    const [marketStatus] = useState<MarketStatus | null>({ status: 'open' });
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('overview');

    const { status: autopilotStatus, fetchStatus } = useAutopilotStore();

    // Fetch data
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/portfolio/unified`);
            if (res.ok) {
                const data = await res.json();
                setStats({
                    total_equity: data.stats?.total_equity ?? 0,
                    open_pnl: data.stats?.open_pnl ?? 0,
                    day_pnl: data.stats?.day_pnl ?? 0,
                    buying_power: data.stats?.buying_power ?? 0,
                    position_count: data.stats?.position_count ?? 0,
                    active_orders: data.stats?.order_count ?? 0,
                    win_rate: 0.65 // Would come from analytics
                });
            }
        } catch (e) {
            console.error('Failed to fetch stats:', e);
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        let mounted = true;
        const load = async () => {
            if (mounted) {
                await fetchData();
                await fetchStatus();
            }
        };
        load();
        const interval = setInterval(load, 30000);
        return () => {
            mounted = false;
            clearInterval(interval);
        };
    }, [fetchData, fetchStatus]);

    const isPnlPositive = (stats?.open_pnl ?? 0) >= 0;

    return (
        <div className="h-full flex flex-col bg-background overflow-hidden">
            {/* Enhanced Header */}
            <div className="shrink-0 border-b border-border bg-panel-bg">
                {/* Top row - Title and Status */}
                <div className="h-12 px-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <Activity className="w-5 h-5 text-brand" />
                            <h1 className="text-lg font-semibold text-text">Command Center</h1>
                        </div>

                        <MarketStatusBadge status={marketStatus} />

                        {/* Autopilot Status */}
                        <Badge
                            variant={autopilotStatus?.state === 'running' ? 'success' :
                                    autopilotStatus?.state === 'paused' ? 'warning' :
                                    autopilotStatus?.kill_switch ? 'error' : 'default'}
                        >
                            <Bot size={12} className="mr-1" />
                            AP: {autopilotStatus?.kill_switch ? 'KILLED' : autopilotStatus?.state?.toUpperCase() || 'IDLE'}
                        </Badge>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Start Risk Desk Demo Quick Action */}
                        <button
                            onClick={() => {
                                // Dispatch custom event for Shell to navigate
                                window.dispatchEvent(new CustomEvent('navigate-risk-desk', { detail: { loadDemo: true } }));
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-medium transition-colors"
                            data-testid="start-risk-desk-demo-btn"
                        >
                            <TrendingUp size={14} />
                            Start Risk Desk Demo
                        </button>

                        <button
                            onClick={fetchData}
                            disabled={loading}
                            className="p-2 rounded bg-element-bg hover:bg-border transition-colors"
                        >
                            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </div>

                {/* Second row - Quick Stats */}
                <div className="h-10 px-4 flex items-center gap-3 bg-background/50">
                    <StatPill
                        icon={Wallet}
                        label="Equity"
                        value={stats ? formatCurrency(stats.total_equity) : '---'}
                    />
                    <StatPill
                        icon={isPnlPositive ? TrendingUp : TrendingDown}
                        label="P&L"
                        value={stats ? formatCurrency(stats.open_pnl) : '---'}
                        trend={isPnlPositive ? 'up' : 'down'}
                    />
                    <StatPill
                        icon={Target}
                        label="Win Rate"
                        value={stats ? `${(stats.win_rate * 100).toFixed(0)}%` : '---'}
                        trend={(stats?.win_rate ?? 0) >= 0.5 ? 'up' : 'down'}
                    />
                    <StatPill
                        icon={BarChart2}
                        label="Positions"
                        value={stats?.position_count?.toString() ?? '---'}
                    />
                    <StatPill
                        icon={FileText}
                        label="Orders"
                        value={stats?.active_orders?.toString() ?? '---'}
                    />

                    <div className="flex-1" />

                    {/* Sentiment indicator */}
                    {autopilotStatus?.sentiment && (
                        <div className={cn(
                            "flex items-center gap-2 px-3 py-1 rounded-lg text-xs",
                            (autopilotStatus.sentiment.sentiment_scores?.MARKET ?? 0) > 0.3 ? 'bg-up/20 text-up' :
                            (autopilotStatus.sentiment.sentiment_scores?.MARKET ?? 0) < -0.3 ? 'bg-down/20 text-down' :
                            'bg-border text-text-secondary'
                        )}>
                            <Globe size={12} />
                            <span>
                                {(autopilotStatus.sentiment.sentiment_scores?.MARKET ?? 0) > 0.3 ? '🐂 Bullish' :
                                 (autopilotStatus.sentiment.sentiment_scores?.MARKET ?? 0) < -0.3 ? '🐻 Bearish' :
                                 '⚖️ Neutral'}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Tabbed Content */}
            <Tabs 
                defaultValue="overview"
                value={activeTab} 
                onValueChange={setActiveTab}
                className="flex-1 flex flex-col min-h-0"
            >
                <div className="px-4 py-2 border-b border-border bg-panel-bg shrink-0">
                    <TabsList>
                        <TabsTrigger value="overview">
                            <Brain size={12} className="mr-1.5" />
                            Intelligence
                        </TabsTrigger>
                        <TabsTrigger value="agents">
                            <Bot size={12} className="mr-1.5" />
                            AI Agents
                        </TabsTrigger>
                        <TabsTrigger value="analytics">
                            <BarChart2 size={12} className="mr-1.5" />
                            P&L Analytics
                        </TabsTrigger>
                    </TabsList>
                </div>

                {/* Tab Contents */}
                <TabsContent value="overview" className="flex-1 overflow-hidden m-0 p-0">
                    <FinancialIntelligenceDashboard />
                </TabsContent>

                <TabsContent value="agents" className="flex-1 overflow-hidden m-0 p-0">
                    <MultiAgentFinancePanel />
                </TabsContent>

                <TabsContent value="analytics" className="flex-1 overflow-hidden m-0 p-0">
                    <RealTimePnLAnalytics />
                </TabsContent>
            </Tabs>
        </div>
    );
}

export default EnhancedCommandCenterView;
