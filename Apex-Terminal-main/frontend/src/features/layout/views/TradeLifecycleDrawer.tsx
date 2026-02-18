/**
 * Trade Lifecycle Drawer (Section C3)
 * 
 * Opens when clicking a trade marker on the chart:
 * - Strategy template + parameters
 * - Entry rationale snapshot
 * - Exit rules active now
 * - Next action condition
 * - Broker confirmation panel
 */

import { useState, useEffect, useCallback } from 'react';
import {
    X, Target, Shield, Clock,
    TrendingUp, TrendingDown, Activity, CheckCircle2,
    AlertTriangle, Info, ExternalLink, RefreshCw
} from 'lucide-react';
import { cn } from '../../../ui/utils';

const API_BASE = 'http://127.0.0.1:8000/api/v1';

interface Trade {
    id: string;
    symbol: string;
    strategy: string;
    timestamp: number;
    side: 'entry' | 'exit';
}

interface TradeDetails {
    // Strategy info
    strategy_template: string;
    parameters: {
        dte: number;
        strikes: { type: string; strike: number; qty: number }[];
        width?: number;
        credit_debit: 'credit' | 'debit';
        premium: number;
    };
    
    // Entry rationale
    entry_rationale: {
        regime: string;
        regime_confidence: number;
        key_features: string[];
        sentiment_summary: string;
        sentiment_score: number;
        forecast_snapshot?: {
            p10: number;
            p50: number;
            p90: number;
        };
    };
    
    // Exit rules
    exit_rules: {
        profit_target: { percent: number; price?: number };
        stop_loss: { percent: number; price?: number };
        time_stop: { dte_threshold: number; action: string };
        delta_stop?: { threshold: number };
    };
    
    // Current status
    current_status: {
        pnl: number;
        pnl_percent: number;
        dte_remaining: number;
        time_to_expiry: string;
        next_action_condition: string;
    };
    
    // Broker confirmation
    broker_confirmation: {
        alpaca_order_status: 'filled' | 'partial' | 'rejected' | 'pending' | 'unknown';
        alpaca_position_status: 'open' | 'closed' | 'unknown';
        internal_status: 'open' | 'closed';
        mismatch: boolean;
        mismatch_details?: string;
        order_id: string;
        client_order_id: string;
        fill_price: number;
        fill_time: string;
        commission: number;
    };
}

interface TradeLifecycleDrawerProps {
    trade: Trade;
    onClose: () => void;
}

export function TradeLifecycleDrawer({ trade, onClose }: TradeLifecycleDrawerProps) {
    const [details, setDetails] = useState<TradeDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [verifying, setVerifying] = useState(false);

    // Fetch trade details
    const fetchDetails = useCallback(async () => {
        setLoading(true);
        try {
            // In a real implementation, this would fetch from the API
            // For now, generate mock data
            const mockDetails: TradeDetails = {
                strategy_template: trade.strategy || 'PCS',
                parameters: {
                    dte: 21,
                    strikes: [
                        { type: 'short_put', strike: 445, qty: -1 },
                        { type: 'long_put', strike: 440, qty: 1 }
                    ],
                    width: 5,
                    credit_debit: 'credit',
                    premium: 1.25
                },
                entry_rationale: {
                    regime: 'Bullish Trend',
                    regime_confidence: 0.75,
                    key_features: [
                        'ADX > 25 (strong trend)',
                        'Price above 20 MA',
                        'Positive momentum divergence',
                        'Volume confirming trend'
                    ],
                    sentiment_summary: 'Moderately positive news flow with Fed stability narrative',
                    sentiment_score: 0.35,
                    forecast_snapshot: {
                        p10: -2.5,
                        p50: 0.8,
                        p90: 3.2
                    }
                },
                exit_rules: {
                    profit_target: { percent: 50, price: 0.62 },
                    stop_loss: { percent: -100, price: 2.50 },
                    time_stop: { dte_threshold: 5, action: 'close_position' },
                    delta_stop: { threshold: 0.30 }
                },
                current_status: {
                    pnl: 45.50,
                    pnl_percent: 36.4,
                    dte_remaining: 14,
                    time_to_expiry: '2 weeks',
                    next_action_condition: 'If premium drops to $0.62 (50% profit), position will be closed automatically.'
                },
                broker_confirmation: {
                    alpaca_order_status: 'filled',
                    alpaca_position_status: 'open',
                    internal_status: 'open',
                    mismatch: false,
                    order_id: 'ord_abc123',
                    client_order_id: `autopilot_${trade.id}`,
                    fill_price: 1.25,
                    fill_time: new Date(trade.timestamp * 1000).toISOString(),
                    commission: 1.30
                }
            };
            
            setDetails(mockDetails);
        } catch (err) {
            console.error('Failed to fetch trade details:', err);
        }
        setLoading(false);
    }, [trade]);

    // Verify with broker
    const verifyWithBroker = async () => {
        setVerifying(true);
        try {
            await fetch(`${API_BASE}/autopilot/broker/metrics`);
            // Refresh details after verification
            await fetchDetails();
        } catch (err) {
            console.error('Failed to verify with broker:', err);
        }
        setVerifying(false);
    };

    useEffect(() => {
        fetchDetails();
    }, [fetchDetails]);

    if (loading) {
        return (
            <div className="fixed inset-y-0 right-0 w-[450px] bg-panel-bg border-l border-border shadow-xl z-drawer flex items-center justify-center">
                <RefreshCw size={24} className="animate-spin text-brand" />
            </div>
        );
    }

    if (!details) {
        return (
            <div className="fixed inset-y-0 right-0 w-[450px] bg-panel-bg border-l border-border shadow-xl z-drawer flex items-center justify-center">
                <p className="text-text-secondary">Failed to load trade details</p>
            </div>
        );
    }

    return (
        <div 
            className="fixed inset-y-0 right-0 w-[450px] bg-panel-bg border-l border-border shadow-xl z-drawer flex flex-col"
            data-testid="trade-lifecycle-drawer"
        >
            {/* Header */}
            <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-element-bg">
                <div>
                    <h2 className="text-lg font-semibold text-text">{trade.symbol} - {trade.strategy}</h2>
                    <p className="text-xs text-text-secondary">
                        {trade.side.toUpperCase()} • {new Date(trade.timestamp * 1000).toLocaleString()}
                    </p>
                </div>
                <button 
                    onClick={onClose}
                    className="p-1.5 rounded hover:bg-border transition-colors"
                >
                    <X size={18} className="text-text-secondary" />
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Strategy Template + Parameters */}
                <section className="bg-element-bg rounded-lg p-3">
                    <h3 className="text-xs font-medium text-text mb-3 flex items-center gap-2">
                        <Target size={14} className="text-brand" />
                        Strategy Template
                    </h3>
                    
                    <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                            <span className="text-text-muted">Template</span>
                            <div className="text-text font-medium">{details.strategy_template}</div>
                        </div>
                        <div>
                            <span className="text-text-muted">DTE at Entry</span>
                            <div className="text-text font-medium">{details.parameters.dte} days</div>
                        </div>
                        <div>
                            <span className="text-text-muted">Width</span>
                            <div className="text-text font-medium">${details.parameters.width}</div>
                        </div>
                        <div>
                            <span className="text-text-muted">Type</span>
                            <div className="text-text font-medium capitalize">{details.parameters.credit_debit}</div>
                        </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-border">
                        <span className="text-text-muted text-[10px]">Strikes</span>
                        <div className="space-y-1 mt-1">
                            {details.parameters.strikes.map((s, i) => (
                                <div key={i} className="flex items-center justify-between text-xs">
                                    <span className="text-text-secondary capitalize">{s.type.replace('_', ' ')}</span>
                                    <span className="text-text font-mono">${s.strike} × {s.qty}</span>
                                </div>
                            ))}
                        </div>
                        <div className="flex items-center justify-between text-xs mt-2 pt-2 border-t border-border">
                            <span className="text-text-secondary">Premium Collected</span>
                            <span className="text-green-400 font-medium">${details.parameters.premium.toFixed(2)}</span>
                        </div>
                    </div>
                </section>

                {/* Entry Rationale Snapshot */}
                <section className="bg-element-bg rounded-lg p-3">
                    <h3 className="text-xs font-medium text-text mb-3 flex items-center gap-2">
                        <Info size={14} className="text-blue-500" />
                        Entry Rationale
                    </h3>

                    <div className="space-y-3">
                        {/* Regime */}
                        <div>
                            <span className="text-text-muted text-[10px]">Regime at Entry</span>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="px-2 py-0.5 bg-green-500/20 text-green-400 rounded text-xs font-medium">
                                    {details.entry_rationale.regime}
                                </span>
                                <span className="text-xs text-text-secondary">
                                    ({(details.entry_rationale.regime_confidence * 100).toFixed(0)}% confidence)
                                </span>
                            </div>
                        </div>

                        {/* Key Features */}
                        <div>
                            <span className="text-text-muted text-[10px]">Key Features</span>
                            <ul className="mt-1 space-y-0.5">
                                {details.entry_rationale.key_features.map((f, i) => (
                                    <li key={i} className="text-xs text-text-secondary flex items-start gap-1">
                                        <CheckCircle2 size={10} className="text-green-400 mt-0.5 shrink-0" />
                                        {f}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Sentiment */}
                        <div>
                            <span className="text-text-muted text-[10px]">Sentiment at Entry</span>
                            <div className="flex items-center gap-2 mt-1">
                                <span className={cn(
                                    "text-xs font-medium",
                                    details.entry_rationale.sentiment_score > 0.2 ? "text-green-400" :
                                    details.entry_rationale.sentiment_score < -0.2 ? "text-red-400" : "text-text"
                                )}>
                                    {details.entry_rationale.sentiment_score > 0 ? '+' : ''}
                                    {(details.entry_rationale.sentiment_score * 100).toFixed(0)}%
                                </span>
                            </div>
                            <p className="text-[10px] text-text-secondary mt-1">{details.entry_rationale.sentiment_summary}</p>
                        </div>

                        {/* Forecast */}
                        {details.entry_rationale.forecast_snapshot && (
                            <div>
                                <span className="text-text-muted text-[10px]">Forecast Snapshot</span>
                                <div className="grid grid-cols-3 gap-2 mt-1 text-center">
                                    <div className="text-xs">
                                        <div className="text-text-muted">P10</div>
                                        <div className="text-red-400">{details.entry_rationale.forecast_snapshot.p10}%</div>
                                    </div>
                                    <div className="text-xs">
                                        <div className="text-text-muted">P50</div>
                                        <div className="text-text">{details.entry_rationale.forecast_snapshot.p50}%</div>
                                    </div>
                                    <div className="text-xs">
                                        <div className="text-text-muted">P90</div>
                                        <div className="text-green-400">+{details.entry_rationale.forecast_snapshot.p90}%</div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </section>

                {/* Exit Rules Active Now */}
                <section className="bg-element-bg rounded-lg p-3">
                    <h3 className="text-xs font-medium text-text mb-3 flex items-center gap-2">
                        <Shield size={14} className="text-yellow-500" />
                        Exit Rules Active
                    </h3>

                    <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                                <TrendingUp size={12} className="text-green-400" />
                                <span className="text-text-secondary">Profit Target</span>
                            </div>
                            <span className="text-text font-medium">
                                {details.exit_rules.profit_target.percent}% (${details.exit_rules.profit_target.price?.toFixed(2)})
                            </span>
                        </div>

                        <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                                <TrendingDown size={12} className="text-red-400" />
                                <span className="text-text-secondary">Stop Loss</span>
                            </div>
                            <span className="text-text font-medium">
                                {details.exit_rules.stop_loss.percent}% (${details.exit_rules.stop_loss.price?.toFixed(2)})
                            </span>
                        </div>

                        <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                                <Clock size={12} className="text-yellow-400" />
                                <span className="text-text-secondary">Time Stop</span>
                            </div>
                            <span className="text-text font-medium">
                                DTE ≤ {details.exit_rules.time_stop.dte_threshold} → {details.exit_rules.time_stop.action}
                            </span>
                        </div>

                        {details.exit_rules.delta_stop && (
                            <div className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-2">
                                    <Activity size={12} className="text-purple-400" />
                                    <span className="text-text-secondary">Delta Stop</span>
                                </div>
                                <span className="text-text font-medium">
                                    Δ {'>'} {details.exit_rules.delta_stop.threshold}
                                </span>
                            </div>
                        )}
                    </div>
                </section>

                {/* Current Status */}
                <section className="bg-element-bg rounded-lg p-3">
                    <h3 className="text-xs font-medium text-text mb-3 flex items-center gap-2">
                        <Activity size={14} className="text-cyan-500" />
                        Current Status
                    </h3>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                            <span className="text-text-muted">P&L</span>
                            <div className={cn(
                                "text-lg font-bold",
                                details.current_status.pnl >= 0 ? "text-green-400" : "text-red-400"
                            )}>
                                ${details.current_status.pnl.toFixed(2)}
                            </div>
                            <div className="text-text-secondary">
                                ({details.current_status.pnl_percent >= 0 ? '+' : ''}{details.current_status.pnl_percent.toFixed(1)}%)
                            </div>
                        </div>
                        <div>
                            <span className="text-text-muted">Time to Expiry</span>
                            <div className="text-text font-medium">{details.current_status.dte_remaining} DTE</div>
                            <div className="text-text-secondary">{details.current_status.time_to_expiry}</div>
                        </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-border">
                        <span className="text-text-muted text-[10px]">Next Action Condition</span>
                        <p className="text-xs text-text mt-1">{details.current_status.next_action_condition}</p>
                    </div>
                </section>

                {/* Broker Confirmation Panel */}
                <section className={cn(
                    "rounded-lg p-3 border",
                    details.broker_confirmation.mismatch 
                        ? "bg-red-500/10 border-red-500/30" 
                        : "bg-element-bg border-border"
                )}>
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-xs font-medium text-text flex items-center gap-2">
                            <Shield size={14} className={details.broker_confirmation.mismatch ? "text-red-400" : "text-green-400"} />
                            Broker Confirmation
                        </h3>
                        <button
                            onClick={verifyWithBroker}
                            disabled={verifying}
                            className="text-xs text-brand hover:underline flex items-center gap-1"
                        >
                            <RefreshCw size={10} className={verifying ? 'animate-spin' : ''} />
                            Verify Now
                        </button>
                    </div>

                    {details.broker_confirmation.mismatch && (
                        <div className="mb-3 p-2 bg-red-500/20 rounded flex items-start gap-2">
                            <AlertTriangle size={14} className="text-red-400 mt-0.5 shrink-0" />
                            <div>
                                <div className="text-xs font-medium text-red-400">Position Mismatch Detected</div>
                                <div className="text-[10px] text-red-300">{details.broker_confirmation.mismatch_details}</div>
                            </div>
                        </div>
                    )}

                    <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-text-secondary">Alpaca Order Status</span>
                            <span className={cn(
                                "px-1.5 py-0.5 rounded text-[10px] font-medium uppercase",
                                details.broker_confirmation.alpaca_order_status === 'filled' ? "bg-green-500/20 text-green-400" :
                                details.broker_confirmation.alpaca_order_status === 'partial' ? "bg-yellow-500/20 text-yellow-400" :
                                details.broker_confirmation.alpaca_order_status === 'rejected' ? "bg-red-500/20 text-red-400" :
                                "bg-gray-500/20 text-gray-400"
                            )}>
                                {details.broker_confirmation.alpaca_order_status}
                            </span>
                        </div>

                        <div className="flex items-center justify-between text-xs">
                            <span className="text-text-secondary">Alpaca Position Status</span>
                            <span className={cn(
                                "px-1.5 py-0.5 rounded text-[10px] font-medium uppercase",
                                details.broker_confirmation.alpaca_position_status === 'open' ? "bg-green-500/20 text-green-400" :
                                details.broker_confirmation.alpaca_position_status === 'closed' ? "bg-gray-500/20 text-gray-400" :
                                "bg-yellow-500/20 text-yellow-400"
                            )}>
                                {details.broker_confirmation.alpaca_position_status}
                            </span>
                        </div>

                        <div className="flex items-center justify-between text-xs">
                            <span className="text-text-secondary">Internal Status</span>
                            <span className="text-text font-medium capitalize">{details.broker_confirmation.internal_status}</span>
                        </div>

                        <div className="pt-2 mt-2 border-t border-border space-y-1">
                            <div className="flex items-center justify-between text-[10px]">
                                <span className="text-text-muted">Order ID</span>
                                <a href="#" className="text-brand hover:underline flex items-center gap-1">
                                    {details.broker_confirmation.order_id}
                                    <ExternalLink size={8} />
                                </a>
                            </div>
                            <div className="flex items-center justify-between text-[10px]">
                                <span className="text-text-muted">Client Order ID</span>
                                <span className="text-text font-mono">{details.broker_confirmation.client_order_id}</span>
                            </div>
                            <div className="flex items-center justify-between text-[10px]">
                                <span className="text-text-muted">Fill Price</span>
                                <span className="text-text">${details.broker_confirmation.fill_price.toFixed(2)}</span>
                            </div>
                            <div className="flex items-center justify-between text-[10px]">
                                <span className="text-text-muted">Fill Time</span>
                                <span className="text-text">
                                    {new Date(details.broker_confirmation.fill_time).toLocaleString()}
                                </span>
                            </div>
                            <div className="flex items-center justify-between text-[10px]">
                                <span className="text-text-muted">Commission</span>
                                <span className="text-text">${details.broker_confirmation.commission.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}
