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
import { Button } from '../../../ui/Button';
import { PageHeader } from '../../../ui/PageHeader';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../../ui/Tabs';
import { FinancialIntelligenceDashboard } from '../../dashboard/FinancialIntelligenceDashboard';
import { MultiAgentFinancePanel } from '../../dashboard/MultiAgentFinancePanel';
import { RealTimePnLAnalytics } from '../../dashboard/RealTimePnLAnalytics';
import { useAutopilotStore } from '../../autopilot/store';
import { API_BASE } from '../../../config/api';

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

// Quick Stat Pill - Professional Bloomberg-style
function StatPill({ icon: Icon, label, value, trend, compact = false }: {
    icon: React.ElementType;
    label: string;
    value: string;
    trend?: 'up' | 'down' | 'neutral';
    compact?: boolean;
}) {
    return (
        <div className={cn(
            "flex items-center gap-2.5 px-3.5 py-2 rounded-lg border transition-colors",
            compact ? "gap-1.5 px-2.5 py-1.5" : "gap-2.5",
            trend === 'up' ? 'bg-green-500/5 border-green-500/15' :
            trend === 'down' ? 'bg-red-500/5 border-red-500/15' :
            'bg-element-bg/80 border-border/50'
        )}>
            <div className={cn(
                "flex items-center justify-center w-7 h-7 rounded-md",
                trend === 'up' ? 'bg-green-500/10' :
                trend === 'down' ? 'bg-red-500/10' :
                'bg-brand/10'
            )}>
                <Icon size={compact ? 12 : 14} className={cn(
                    trend === 'up' ? 'text-up' :
                    trend === 'down' ? 'text-down' :
                    'text-brand'
                )} />
            </div>
            <div className="flex flex-col">
                {!compact && <span className="text-[10px] text-text-muted uppercase tracking-wider leading-none mb-0.5">{label}</span>}
                <span className={cn(
                    "text-sm font-semibold tabular-nums leading-none",
                    trend === 'up' ? 'text-up' :
                    trend === 'down' ? 'text-down' :
                    'text-text'
                )}>
                    {value}
                </span>
            </div>
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
            const res = await fetch(`${API_BASE}/api/v1/portfolio/unified`);
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
        <div className="h-full flex flex-col bg-background overflow-hidden" data-testid="command-center-view">
            {/* Enhanced Header with PageHeader */}
            <PageHeader
                title="Command Center"
                subtitle="Real-time portfolio intelligence &amp; analytics"
                icon={<Activity size={20} />}
                badge={
                    <div className="flex items-center gap-2">
                        <MarketStatusBadge status={marketStatus} />
                        <Badge
                            variant={autopilotStatus?.state === 'running' ? 'success' :
                                    autopilotStatus?.state === 'paused' ? 'warning' :
                                    autopilotStatus?.kill_switch ? 'error' : 'default'}
                            dot
                        >
                            <Bot size={10} className="mr-0.5" />
                            AP: {autopilotStatus?.kill_switch ? 'KILLED' : autopilotStatus?.state?.toUpperCase() || 'IDLE'}
                        </Badge>
                    </div>
                }
                actions={
                    <div className="flex items-center gap-2">
                        <Button
                            variant="success"
                            size="sm"
                            onClick={() => {
                                window.dispatchEvent(new CustomEvent('navigate-risk-desk', { detail: { loadDemo: true } }));
                            }}
                            data-testid="start-risk-desk-demo-btn"
                        >
                            <TrendingUp size={14} />
                            Risk Desk Demo
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={fetchData}
                            disabled={loading}
                        >
                            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                        </Button>
                    </div>
                }
                data-testid="command-center-header"
            />

            {/* Quick Stats Ribbon */}
            <div className="shrink-0 px-5 py-2.5 flex items-center gap-2.5 bg-gradient-to-r from-panel-bg/80 to-panel-bg/40 border-b border-border/50 overflow-x-auto">
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
                {autopilotStatus?.sentiment && (
                    <div className={cn(
                        "flex items-center gap-2 px-3 py-1 rounded-md text-xs border border-border/50",
                        (autopilotStatus.sentiment.sentiment_scores?.MARKET ?? 0) > 0.3 ? 'bg-up/5 text-up' :
                        (autopilotStatus.sentiment.sentiment_scores?.MARKET ?? 0) < -0.3 ? 'bg-down/5 text-down' :
                        'bg-element-bg text-text-secondary'
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

            {/* Tabbed Content */}
            <Tabs 
                defaultValue="overview"
                value={activeTab} 
                onValueChange={setActiveTab}
                className="flex-1 flex flex-col min-h-0"
            >
                <TabsList className="px-6 mt-1">
                    <TabsTrigger value="overview" icon={<Brain size={12} />}>
                        Intelligence
                    </TabsTrigger>
                    <TabsTrigger value="agents" icon={<Bot size={12} />}>
                        AI Agents
                    </TabsTrigger>
                    <TabsTrigger value="analytics" icon={<BarChart2 size={12} />}>
                        P&amp;L Analytics
                    </TabsTrigger>
                </TabsList>

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
