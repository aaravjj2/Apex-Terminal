import { Database, TrendingUp, PenTool, Bell, X } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../ui/Tabs';
import { IconButton } from '../../ui/IconButton';
import { useAppStore } from '../../state/appStore';
import { useStore } from '../../state/store';
import { IndicatorDock } from '../indicators/IndicatorDock';

// Panel content components
function DataInspector() {
    // Get data directly from stores
    const { candles, lastCandle } = useStore();
    const { providers } = useAppStore();

    // Determine current price data
    const current = lastCandle || (candles.length > 0 ? candles[candles.length - 1] : null);

    // Calculate change (using previous candle close if available)
    const prev = candles.length > 1 ? candles[candles.length - 2] : null;
    const change = current && prev ? current.close - prev.close : 0;
    const changePercent = current && prev && prev.close ? (change / prev.close) * 100 : 0;

    // Determine active provider
    const activeProvider = providers.alpaca.status === 'connected' ? 'Alpaca' :
        providers.finnhub.status === 'connected' ? 'Finnhub' : 'Mock/Offline';

    if (!current) {
        return <div className="p-3 text-xs text-text-secondary">No data available</div>;
    }

    const fmt = (n: number) => n.toFixed(2);
    const fmtVol = (n: number) => {
        if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
        if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
        return n.toString();
    };

    return (
        <div className="p-3 space-y-4">
            {/* OHLC */}
            <div>
                <h4 className="text-xxs text-text-secondary uppercase tracking-wider mb-2">Price</h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex justify-between">
                        <span className="text-text-secondary">Open</span>
                        <span className="text-text font-mono tabular-nums">{fmt(current.open)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-text-secondary">High</span>
                        <span className="text-up font-mono tabular-nums">{fmt(current.high)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-text-secondary">Low</span>
                        <span className="text-down font-mono tabular-nums">{fmt(current.low)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-text-secondary">Close</span>
                        <span className="text-text font-mono tabular-nums">{fmt(current.close)}</span>
                    </div>
                </div>
            </div>

            {/* Volume & Change */}
            <div>
                <h4 className="text-xxs text-text-secondary uppercase tracking-wider mb-2">Stats</h4>
                <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                        <span className="text-text-secondary">Volume</span>
                        <span className="text-text font-mono tabular-nums">{fmtVol(current.volume)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-text-secondary">Change</span>
                        <span className={`${change >= 0 ? 'text-up' : 'text-down'} font-mono tabular-nums`}>
                            {change >= 0 ? '+' : ''}{fmt(change)} ({fmt(changePercent)}%)
                        </span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-text-secondary">Spread</span>
                        {/* We don't have spread in bar data, defaulting to -- or est */}
                        <span className="text-text font-mono tabular-nums">--</span>
                    </div>
                </div>
            </div>

            {/* Provider Info */}
            <div>
                <h4 className="text-xxs text-text-secondary uppercase tracking-wider mb-2">Data Source</h4>
                <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                        <span className="text-text-secondary">Provider</span>
                        <span className="text-text">{activeProvider}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-text-secondary">Last Update</span>
                        <span className="text-text font-mono tabular-nums">
                            {new Date(current.time).toLocaleTimeString()}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}

function IndicatorManager() {
    return <IndicatorDock />;
}

function DrawingManager() {
    return (
        <div className="p-3">
            <div className="flex items-center justify-between mb-3">
                <h4 className="text-xxs text-text-secondary uppercase tracking-wider">Drawings</h4>
                <span className="text-xxs text-text-secondary">3 items</span>
            </div>
            <div className="space-y-1 text-xs text-text-secondary">
                <div className="py-1.5 px-2 rounded bg-element-bg">Trend Line • AAPL</div>
                <div className="py-1.5 px-2 rounded bg-element-bg">Horizontal Line • $185.00</div>
                <div className="py-1.5 px-2 rounded bg-element-bg">Rectangle • Support Zone</div>
            </div>
        </div>
    );
}

function AlertsPanel() {
    return (
        <div className="p-3">
            <div className="flex items-center justify-between mb-3">
                <h4 className="text-xxs text-text-secondary uppercase tracking-wider">Active Alerts</h4>
                <button className="text-xxs text-brand hover:underline">+ New</button>
            </div>
            <div className="space-y-2 text-xs">
                <div className="py-2 px-2 rounded bg-element-bg border-l-2 border-warn">
                    <div className="text-text">AAPL &gt; $190.00</div>
                    <div className="text-text-secondary text-xxs mt-0.5">Price above threshold</div>
                </div>
                <div className="py-2 px-2 rounded bg-element-bg border-l-2 border-brand">
                    <div className="text-text">RSI &gt; 70</div>
                    <div className="text-text-secondary text-xxs mt-0.5">Overbought condition</div>
                </div>
            </div>
        </div>
    );
}

export function RightPanel() {
    const { rightDockOpen, toggleRightDock } = useAppStore();

    if (!rightDockOpen) return null;

    return (
        <div className="h-full bg-panel-bg border-l border-border flex flex-col animate-slide-in-right">
            <Tabs defaultValue="data" className="flex-1">
                <TabsList className="px-1">
                    <TabsTrigger value="data" icon={<Database size={14} />}>Data</TabsTrigger>
                    <TabsTrigger value="indicators" icon={<TrendingUp size={14} />}>Ind</TabsTrigger>
                    <TabsTrigger value="drawings" icon={<PenTool size={14} />}>Draw</TabsTrigger>
                    <TabsTrigger value="alerts" icon={<Bell size={14} />}>Alerts</TabsTrigger>
                    <div className="flex-1" />
                    <IconButton
                        icon={<X size={14} />}
                        tooltip="Close panel"
                        variant="ghost"
                        size="sm"
                        onClick={toggleRightDock}
                    />
                </TabsList>

                <TabsContent value="data">
                    <DataInspector />
                </TabsContent>
                <TabsContent value="indicators">
                    <IndicatorManager />
                </TabsContent>
                <TabsContent value="drawings">
                    <DrawingManager />
                </TabsContent>
                <TabsContent value="alerts">
                    <AlertsPanel />
                </TabsContent>
            </Tabs>
        </div>
    );
}
