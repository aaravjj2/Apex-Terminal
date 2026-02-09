import { useState, useEffect } from 'react';
import {
    Wallet, TrendingUp, TrendingDown, DollarSign,
    Filter, RefreshCw
} from 'lucide-react';
import { Badge } from '../../../ui/Badge';
import { IconButton } from '../../../ui/IconButton';
import { Table, type Column } from '../../../ui/Table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../../ui/Tabs';
import { ApiClient, type Position, type Order } from '../../../data/ApiClient';
import { useToast } from '../../../ui/Toast';

// Mock fills still needed as API doesn't have a dedicated fills endpoint yet
const mockFills: any[] = [
    { id: 'f1', time: '09:31:42', orderId: 'o1', symbol: 'AAPL', side: 'BUY', qty: 100, price: 185.42, fee: 0.50 },
    { id: 'f2', time: '09:15:30', orderId: 'o4', symbol: 'SPY', side: 'BUY', qty: 200, price: 510.50, fee: 1.00 },
];

function PortfolioSummary({ positions }: { positions: Position[] }) {
    // Calculate stats from positions
    const totalPnl = positions.reduce((acc, p) => acc + (p.pnl || 0), 0);
    // Rough estimate of portfolio value (cash + positions) - assuming arbitrary cash for now since API doesn't return account balance yet
    const portfolioValue = 100000 + positions.reduce((acc, p) => acc + (p.qty * p.current_price), 0);
    const buyingPower = 45000.00; // Mocked until account API exists

    return (
        <div className="grid grid-cols-4 gap-4 p-4 bg-panel-bg border-b border-border">
            <div className="p-4 bg-element-bg rounded">
                <div className="flex items-center gap-2 text-text-secondary mb-2">
                    <Wallet size={16} />
                    <span className="text-xs uppercase tracking-wider">Portfolio Value</span>
                </div>
                <div className="text-2xl font-semibold text-text tabular-nums">
                    ${portfolioValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
            </div>

            <div className="p-4 bg-element-bg rounded">
                <div className="flex items-center gap-2 text-text-secondary mb-2">
                    {totalPnl >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                    <span className="text-xs uppercase tracking-wider">Total P&L</span>
                </div>
                <div className={`text-2xl font-semibold tabular-nums flex items-center gap-2 ${totalPnl >= 0 ? 'text-up' : 'text-down'}`}>
                    {totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}
                </div>
            </div>

            <div className="p-4 bg-element-bg rounded">
                <div className="flex items-center gap-2 text-text-secondary mb-2">
                    <DollarSign size={16} />
                    <span className="text-xs uppercase tracking-wider">Buying Power</span>
                </div>
                <div className="text-2xl font-semibold text-text tabular-nums">
                    ${buyingPower.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
            </div>

            <div className="p-4 bg-element-bg rounded">
                <div className="flex items-center gap-2 text-text-secondary mb-2">
                    <span className="text-xs uppercase tracking-wider">Open Positions</span>
                </div>
                <div className="text-2xl font-semibold text-text tabular-nums">
                    {positions.length}
                </div>
            </div>
        </div>
    );
}

export function PortfolioView() {
    const [positions, setPositions] = useState<Position[]>([]);
    const [orders, setOrders] = useState<Order[]>([]);
    const { addToast } = useToast();

    const fetchData = async () => {
        try {
            const [posData, ordData] = await Promise.all([
                ApiClient.getPositions(),
                ApiClient.getOrders()
            ]);
            setPositions(posData);
            setOrders(ordData);
        } catch (error) {
            console.error('Failed to load portfolio data', error);
            addToast({ message: 'Failed to update portfolio', variant: 'error' });
        }
    };

    useEffect(() => {
        fetchData();
        // Poll every 5 seconds for updates
        const interval = setInterval(fetchData, 5000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="h-full flex flex-col bg-background">
            <PortfolioSummary positions={positions} />

            <Tabs defaultValue="positions" className="flex-1 flex flex-col">
                <div className="flex items-center justify-between px-4 py-2 border-b border-border shrink-0">
                    <TabsList>
                        <TabsTrigger value="positions">Positions</TabsTrigger>
                        <TabsTrigger value="orders">Orders</TabsTrigger>
                        <TabsTrigger value="fills">Fills</TabsTrigger>
                    </TabsList>
                    <div className="flex items-center gap-2">
                        <IconButton icon={<Filter size={14} />} tooltip="Filter" variant="ghost" size="sm" />
                        <IconButton
                            icon={<RefreshCw size={14} />}
                            tooltip="Refresh"
                            variant="ghost"
                            size="sm"
                            onClick={fetchData}
                        />
                    </div>
                </div>

                <TabsContent value="positions" className="flex-1 overflow-auto">
                    <Table
                        columns={[
                            {
                                key: 'symbol', header: 'Symbol', render: (row) => (
                                    <span className="font-semibold">{row.symbol}</span>
                                )
                            },
                            { key: 'qty', header: 'Qty', align: 'right' },
                            { key: 'avg_price', header: 'Avg Price', align: 'right', render: (row) => `$${row.avg_price.toFixed(2)}` },
                            { key: 'current_price', header: 'Current', align: 'right', render: (row) => `$${row.current_price.toFixed(2)}` },
                            {
                                key: 'pnl', header: 'P&L', align: 'right', render: (row) => (
                                    <span className={(row.pnl || 0) >= 0 ? 'text-up' : 'text-down'}>
                                        {(row.pnl || 0) >= 0 ? '+' : ''}${row.pnl?.toFixed(2)}
                                    </span>
                                )
                            },
                        ] as Column<Position>[]}
                        data={positions}
                        keyExtractor={(row) => row.symbol}
                    />
                </TabsContent>

                <TabsContent value="orders" className="flex-1 overflow-auto">
                    <Table
                        columns={[
                            { key: 'created_at', header: 'Time', render: (row) => new Date(row.created_at).toLocaleTimeString() },
                            { key: 'symbol', header: 'Symbol' },
                            {
                                key: 'side', header: 'Side', render: (row) => (
                                    <span className={row.side === 'BUY' ? 'text-up' : 'text-down'}>{row.side}</span>
                                )
                            },
                            { key: 'type', header: 'Type' },
                            { key: 'qty', header: 'Qty', align: 'right' },
                            { key: 'filled_qty', header: 'Filled', align: 'right' },
                            {
                                key: 'status', header: 'Status', render: (row) => (
                                    <Badge
                                        variant={row.status === 'FILLED' ? 'success' : row.status === 'PENDING' ? 'warning' : 'default'}
                                        size="sm"
                                    >
                                        {row.status}
                                    </Badge>
                                )
                            },
                        ] as Column<Order>[]}
                        data={orders}
                        keyExtractor={(row) => row.id}
                    />
                </TabsContent>

                <TabsContent value="fills" className="flex-1 overflow-auto">
                    <Table
                        columns={[
                            { key: 'time', header: 'Time' },
                            { key: 'symbol', header: 'Symbol' },
                            {
                                key: 'side', header: 'Side', render: (row) => (
                                    <span className={row.side === 'BUY' ? 'text-up' : 'text-down'}>{row.side}</span>
                                )
                            },
                            { key: 'qty', header: 'Qty', align: 'right' },
                            { key: 'price', header: 'Price', align: 'right', render: (row) => `$${row.price.toFixed(2)}` },
                            { key: 'fee', header: 'Fee', align: 'right', render: (row) => `$${row.fee.toFixed(2)}` },
                        ] as Column<typeof mockFills[0]>[]}
                        data={mockFills}
                        keyExtractor={(row) => row.id}
                    />
                </TabsContent>
            </Tabs>
        </div>
    );
}
