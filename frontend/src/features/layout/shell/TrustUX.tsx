import { useEffect, useState } from 'react';
import { Activity, AlertCircle, CheckCircle, Clock, Database, WifiOff } from 'lucide-react';
import { useAppStore, type AppMode, type ProviderName } from '../../../state/appStore';
import { cn } from '../../../ui/utils';

interface DataSource {
    symbol: string;
    provider: string;
    type: 'bars' | 'options' | 'fundamentals';
    status: 'live' | 'cached' | 'unavailable';
}

interface TrustMetrics {
    mode: AppMode;
    primaryProvider: ProviderName | null;
    providerHealth: 'healthy' | 'degraded' | 'offline';
    lastTickTime: number | null;
    dataSources: DataSource[];
    alpacaKeysConfigured: boolean;
}

const API_BASE = 'http://127.0.0.1:8000';

export function TrustUX() {
    const { mode, symbol, providers } = useAppStore();
    const [metrics, setMetrics] = useState<TrustMetrics>({
        mode,
        primaryProvider: null,
        providerHealth: 'offline',
        lastTickTime: null,
        dataSources: [],
        alpacaKeysConfigured: false,
    });
    const [showDetails, setShowDetails] = useState(false);
    const [isStale, setIsStale] = useState(false);

    // Fetch provider health and data provenance
    useEffect(() => {
        const fetchHealth = async () => {
            try {
                // Fetch actual data sources from health endpoint
                const healthRes = await fetch(`${API_BASE}/health`);
                const healthData = await healthRes.json();
                
                // Check Alpaca keys from health endpoint
                const alpacaConfigured = healthData.alpaca_configured || false;
                const alpacaConnected = healthData.alpaca_connected || false;

                // Get ingestion status
                const ingestRes = await fetch(`${API_BASE}/api/v1/ingest/status`);
                const ingestData = await ingestRes.json();

                // Determine primary provider
                let primaryProvider: ProviderName | null = null;
                if (providers.alpaca.status === 'connected') primaryProvider = 'alpaca';
                else if (providers.finnhub.status === 'connected') primaryProvider = 'finnhub';
                else if (providers.yahoo.status === 'connected') primaryProvider = 'yahoo';

                // Provider health
                const providerHealth =
                    primaryProvider && providers[primaryProvider]?.status === 'connected'
                        ? 'healthy'
                        : primaryProvider && providers[primaryProvider]?.status === 'error'
                        ? 'offline'
                        : 'degraded';

                // Build data sources
                let dataSources: DataSource[] = [];
                try {
                    
                    // Bars source - use healthData values
                    dataSources.push({
                        symbol,
                        provider: alpacaConnected ? 'Alpaca (LIVE)' : (alpacaConfigured ? 'Alpaca (configured)' : 'Mock CSV'),
                        type: 'bars',
                        status: alpacaConnected ? 'live' : 'cached',
                    });
                    
                    // Options source
                    const optionsProvider = healthData.options_provider || 'yfinance';
                    const optionsLive = healthData.tradier_connected || false;
                    dataSources.push({
                        symbol,
                        provider: optionsProvider === 'tradier' ? 'Tradier' : 'yfinance',
                        type: 'options',
                        status: optionsLive ? 'live' : 'cached',
                    });
                } catch (e) {
                    // Fallback to basic sources
                    dataSources = [
                        {
                            symbol,
                            provider: alpacaConfigured ? 'Alpaca' : 'Mock CSV',
                            type: 'bars',
                            status: alpacaConfigured ? 'live' : 'cached',
                        },
                        {
                            symbol,
                            provider: 'yfinance',
                            type: 'options',
                            status: 'cached',
                        },
                    ];
                }

                setMetrics({
                    mode,
                    primaryProvider,
                    providerHealth,
                    lastTickTime: ingestData.last_tick_time || null,
                    dataSources,
                    alpacaKeysConfigured: alpacaConfigured,
                });
            } catch (error) {
                console.error('Trust UX: Failed to fetch health', error);
                setMetrics(prev => ({ ...prev, providerHealth: 'offline' }));
            }
        };

        fetchHealth();
        const interval = setInterval(fetchHealth, 15000); // Poll every 15s
        return () => clearInterval(interval);
    }, [mode, symbol, providers]);

    // Check for stale data (>5s since last tick in LIVE mode)
    useEffect(() => {
        if (mode === 'LIVE' && metrics.lastTickTime) {
            const checkStale = () => {
                const age = Date.now() - metrics.lastTickTime!;
                setIsStale(age > 5000);
            };
            checkStale();
            const interval = setInterval(checkStale, 1000);
            return () => clearInterval(interval);
        } else {
            setIsStale(false);
        }
    }, [mode, metrics.lastTickTime]);

    const getModeIcon = () => {
        switch (mode) {
            case 'LIVE':
                return <Activity size={12} className="animate-pulse" />;
            case 'REPLAY':
                return <Clock size={12} />;
            case 'BACKTEST':
                return <Database size={12} />;
            case 'PAPER':
                return <Activity size={12} />;
        }
    };

    const getModeColor = () => {
        switch (mode) {
            case 'LIVE':
                return 'bg-green-500/10 text-green-400 border-green-500/30';
            case 'PAPER':
                return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30';
            case 'REPLAY':
                return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
            case 'BACKTEST':
                return 'bg-gray-500/10 text-gray-400 border-gray-500/30';
        }
    };

    const getHealthIcon = () => {
        switch (metrics.providerHealth) {
            case 'healthy':
                return <CheckCircle size={12} className="text-green-400" />;
            case 'degraded':
                return <AlertCircle size={12} className="text-yellow-400" />;
            case 'offline':
                return <WifiOff size={12} className="text-red-400" />;
        }
    };

    const formatLastTick = () => {
        if (!metrics.lastTickTime) return 'No data';
        const age = Date.now() - metrics.lastTickTime;
        if (age < 1000) return 'Just now';
        if (age < 60000) return `${Math.floor(age / 1000)}s ago`;
        return `${Math.floor(age / 60000)}m ago`;
    };

    return (
        <div className="fixed bottom-4 right-4 z-[100]">
            {/* Compact Trust Badge */}
            <button
                onClick={() => setShowDetails(!showDetails)}
                className={cn(
                    'flex items-center gap-2 px-3 py-1.5 rounded-lg border backdrop-blur-sm transition-all',
                    getModeColor(),
                    'hover:scale-105 shadow-lg'
                )}
            >
                {getModeIcon()}
                <span className="font-semibold text-xs tracking-wide uppercase">{mode}</span>
                <div className="h-3 w-px bg-white/20" />
                {getHealthIcon()}
                {isStale && mode === 'LIVE' && (
                    <>
                        <div className="h-3 w-px bg-white/20" />
                        <AlertCircle size={12} className="text-orange-400 animate-pulse" />
                    </>
                )}
            </button>

            {/* Details Panel */}
            {showDetails && (
                <div className="absolute bottom-12 right-0 w-96 bg-panel-bg border border-border rounded-lg shadow-2xl p-4 space-y-3 backdrop-blur-md">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-border pb-2">
                        <h3 className="font-semibold text-sm text-white">Trust & Provenance</h3>
                        <button
                            onClick={() => setShowDetails(false)}
                            className="text-text-secondary hover:text-white text-xs"
                        >
                            Close
                        </button>
                    </div>

                    {/* Mode */}
                    <div>
                        <div className="text-xs text-text-secondary mb-1">Mode</div>
                        <div className={cn('inline-flex items-center gap-2 px-2 py-1 rounded border text-xs font-medium', getModeColor())}>
                            {getModeIcon()}
                            {mode}
                        </div>
                    </div>

                    {/* Provider Health */}
                    <div>
                        <div className="text-xs text-text-secondary mb-1">Provider Health</div>
                        <div className="flex items-center gap-2">
                            {getHealthIcon()}
                            <span className="text-xs text-text capitalize">{metrics.providerHealth}</span>
                            {metrics.primaryProvider && (
                                <span className="text-xs text-text-secondary">
                                    ({metrics.primaryProvider})
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Last Tick */}
                    {mode === 'LIVE' && (
                        <div>
                            <div className="text-xs text-text-secondary mb-1">Last Tick</div>
                            <div className="flex items-center gap-2">
                                <Clock size={12} className={isStale ? 'text-orange-400' : 'text-green-400'} />
                                <span className="text-xs text-text">{formatLastTick()}</span>
                                {isStale && (
                                    <span className="text-[10px] text-orange-400 bg-orange-400/10 px-1.5 py-0.5 rounded">
                                        Stale
                                    </span>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Data Sources */}
                    <div>
                        <div className="text-xs text-text-secondary mb-2">Data Sources</div>
                        <div className="space-y-1.5">
                            {metrics.dataSources.map((source, i) => (
                                <div key={i} className="flex items-center justify-between text-xs bg-element-bg px-2 py-1.5 rounded">
                                    <div className="flex items-center gap-2">
                                        <span className="text-text-secondary capitalize">{source.type}:</span>
                                        <span className="text-text">{source.provider}</span>
                                    </div>
                                    <span
                                        className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium', {
                                            'bg-green-400/10 text-green-400': source.status === 'live',
                                            'bg-blue-400/10 text-blue-400': source.status === 'cached',
                                            'bg-red-400/10 text-red-400': source.status === 'unavailable',
                                        })}
                                    >
                                        {source.status}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Alpaca Status */}
                    <div>
                        <div className="text-xs text-text-secondary mb-1">Alpaca API</div>
                        <div className="flex items-center gap-2">
                            {metrics.alpacaKeysConfigured ? (
                                <>
                                    <CheckCircle size={12} className="text-green-400" />
                                    <span className="text-xs text-text">Keys configured</span>
                                </>
                            ) : (
                                <>
                                    <AlertCircle size={12} className="text-orange-400" />
                                    <span className="text-xs text-text">No keys - using mock data</span>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
