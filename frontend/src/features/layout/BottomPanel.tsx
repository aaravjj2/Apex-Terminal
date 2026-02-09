import { Terminal, ListOrdered, Bell, X, Filter, Trash2 } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../ui/Tabs';
import { IconButton } from '../../ui/IconButton';
import { Badge } from '../../ui/Badge';
import { useAppStore } from '../../state/appStore';

// Mock log entries
const mockLogs = [
    { time: '09:31:42', level: 'info', message: 'Bar confirmed: AAPL 1m @ 186.54', component: 'bar_engine' },
    { time: '09:31:41', level: 'debug', message: 'WebSocket message received', component: 'ws' },
    { time: '09:31:40', level: 'info', message: 'Connected to Finnhub stream', component: 'provider' },
    { time: '09:31:39', level: 'warn', message: 'Rate limit approaching: 45/60', component: 'provider' },
    { time: '09:31:38', level: 'info', message: 'Bar saved: index=29465922', component: 'repository' },
];

// Mock orders
const mockOrders = [
    { id: 'ord-001', symbol: 'AAPL', side: 'BUY', qty: 100, type: 'LIMIT', price: 185.00, status: 'PENDING' },
    { id: 'ord-002', symbol: 'MSFT', side: 'SELL', qty: 50, type: 'MARKET', price: null, status: 'FILLED' },
];

// Mock alert triggers
const mockAlertTriggers = [
    { time: '09:30:15', alert: 'AAPL > $186.00', triggered: true },
    { time: '09:28:42', alert: 'Volume spike detected', triggered: true },
];

function LogsPanel() {
    const levelColors: Record<string, string> = {
        info: 'text-text-secondary',
        debug: 'text-text-muted',
        warn: 'text-warn',
        error: 'text-down',
    };

    return (
        <div className="h-full flex flex-col">
            {/* Toolbar */}
            <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border/50 shrink-0">
                <IconButton icon={<Filter size={12} />} tooltip="Filter logs" variant="ghost" size="sm" />
                <IconButton icon={<Trash2 size={12} />} tooltip="Clear logs" variant="ghost" size="sm" />
                <div className="flex-1" />
                <span className="text-xxs text-text-secondary">{mockLogs.length} entries</span>
            </div>

            {/* Log entries */}
            <div className="flex-1 overflow-auto font-mono text-xs">
                {mockLogs.map((log, i) => (
                    <div
                        key={i}
                        className="flex items-start gap-2 px-3 py-1 hover:bg-element-bg border-b border-border/30"
                    >
                        <span className="text-text-muted shrink-0">{log.time}</span>
                        <span className={`shrink-0 uppercase text-xxs ${levelColors[log.level]}`}>
                            [{log.level}]
                        </span>
                        <span className="text-text-secondary shrink-0">[{log.component}]</span>
                        <span className="text-text">{log.message}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function OrdersPanel() {
    return (
        <div className="h-full overflow-auto">
            <table className="w-full text-xs">
                <thead className="sticky top-0 bg-panel-bg">
                    <tr className="border-b border-border text-text-secondary">
                        <th className="text-left px-3 py-2 font-medium">Symbol</th>
                        <th className="text-left px-3 py-2 font-medium">Side</th>
                        <th className="text-right px-3 py-2 font-medium">Qty</th>
                        <th className="text-left px-3 py-2 font-medium">Type</th>
                        <th className="text-right px-3 py-2 font-medium">Price</th>
                        <th className="text-left px-3 py-2 font-medium">Status</th>
                    </tr>
                </thead>
                <tbody>
                    {mockOrders.map((order, i) => (
                        <tr key={i} className="border-b border-border/50 hover:bg-element-bg">
                            <td className="px-3 py-2 font-medium text-text">{order.symbol}</td>
                            <td className={`px-3 py-2 ${order.side === 'BUY' ? 'text-up' : 'text-down'}`}>
                                {order.side}
                            </td>
                            <td className="px-3 py-2 text-right text-text tabular-nums">{order.qty}</td>
                            <td className="px-3 py-2 text-text-secondary">{order.type}</td>
                            <td className="px-3 py-2 text-right text-text tabular-nums">
                                {order.price ? `$${order.price.toFixed(2)}` : '—'}
                            </td>
                            <td className="px-3 py-2">
                                <Badge
                                    variant={order.status === 'FILLED' ? 'success' : 'warning'}
                                    size="sm"
                                >
                                    {order.status}
                                </Badge>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function AlertStreamPanel() {
    return (
        <div className="h-full overflow-auto p-2 space-y-1">
            {mockAlertTriggers.map((alert, i) => (
                <div
                    key={i}
                    className="flex items-center gap-2 px-2 py-1.5 rounded bg-element-bg text-xs"
                >
                    <span className="text-text-muted font-mono">{alert.time}</span>
                    <Badge variant="success" size="sm">TRIGGERED</Badge>
                    <span className="text-text">{alert.alert}</span>
                </div>
            ))}
        </div>
    );
}

export function BottomPanel() {
    const { bottomDockOpen, toggleBottomDock } = useAppStore();

    if (!bottomDockOpen) return null;

    return (
        <div className="h-full bg-panel-bg border-t border-border flex flex-col animate-slide-up">
            <Tabs defaultValue="logs" className="flex-1 flex flex-col">
                <TabsList className="px-1">
                    <TabsTrigger value="logs" icon={<Terminal size={14} />}>Logs</TabsTrigger>
                    <TabsTrigger value="orders" icon={<ListOrdered size={14} />}>Orders</TabsTrigger>
                    <TabsTrigger value="alerts" icon={<Bell size={14} />}>Alert Stream</TabsTrigger>
                    <div className="flex-1" />
                    <IconButton
                        icon={<X size={14} />}
                        tooltip="Close panel"
                        variant="ghost"
                        size="sm"
                        onClick={toggleBottomDock}
                    />
                </TabsList>

                <TabsContent value="logs" className="flex-1">
                    <LogsPanel />
                </TabsContent>
                <TabsContent value="orders" className="flex-1">
                    <OrdersPanel />
                </TabsContent>
                <TabsContent value="alerts" className="flex-1">
                    <AlertStreamPanel />
                </TabsContent>
            </Tabs>
        </div>
    );
}
