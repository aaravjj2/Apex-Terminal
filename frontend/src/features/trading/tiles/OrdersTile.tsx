/**
 * Orders Tile - Shows active and recent orders
 */

import { useState } from 'react';
import { Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { cn } from '../../../ui/utils';

interface TileProps {
    tileId: string;
    onClose: () => void;
    onMaximize: () => void;
    isMaximized: boolean;
}

type OrderStatus = 'pending' | 'filled' | 'cancelled' | 'rejected';
type OrderSide = 'buy' | 'sell';

interface Order {
    id: string;
    symbol: string;
    side: OrderSide;
    type: string;
    quantity: number;
    price: number | null;
    status: OrderStatus;
    filledQty: number;
    time: string;
}

const MOCK_ORDERS: Order[] = [
    { id: '1', symbol: 'AAPL', side: 'buy', type: 'limit', quantity: 100, price: 175.00, status: 'pending', filledQty: 0, time: '10:32:15' },
    { id: '2', symbol: 'MSFT', side: 'sell', type: 'market', quantity: 50, price: null, status: 'filled', filledQty: 50, time: '10:28:42' },
    { id: '3', symbol: 'NVDA', side: 'buy', type: 'limit', quantity: 25, price: 850.00, status: 'pending', filledQty: 10, time: '10:15:30' },
    { id: '4', symbol: 'TSLA', side: 'sell', type: 'stop', quantity: 100, price: 240.00, status: 'cancelled', filledQty: 0, time: '09:45:20' },
];

const statusIcons: Record<OrderStatus, React.ReactNode> = {
    pending: <Clock size={14} className="text-yellow-500" />,
    filled: <CheckCircle size={14} className="text-green-500" />,
    cancelled: <XCircle size={14} className="text-text-muted" />,
    rejected: <AlertCircle size={14} className="text-red-500" />,
};


export function OrdersTile({ tileId, onClose, onMaximize, isMaximized }: TileProps) {
    // Reserved for future integration: tileId will be used for persistent state
    // onClose, onMaximize, isMaximized are handled by parent TileWrapper
    void tileId; void onClose; void onMaximize; void isMaximized;
    const [filter, setFilter] = useState<'all' | 'active' | 'filled'>('all');

    const filteredOrders = MOCK_ORDERS.filter(order => {
        if (filter === 'active') return order.status === 'pending';
        if (filter === 'filled') return order.status === 'filled';
        return true;
    });

    return (
        <div className="h-full flex flex-col">
            {/* Tabs */}
            <div className="flex gap-2 p-2 border-b border-border">
                {(['all', 'active', 'filled'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setFilter(tab)}
                        className={cn(
                            "px-3 py-1 rounded text-sm capitalize",
                            filter === tab
                                ? "bg-brand text-white"
                                : "bg-element-bg text-text-secondary hover:text-text"
                        )}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {/* Header */}
            <div className="grid grid-cols-6 gap-2 px-3 py-1 text-xs text-text-muted border-b border-border">
                <div>Symbol</div>
                <div>Side</div>
                <div>Type</div>
                <div className="text-right">Qty</div>
                <div className="text-right">Price</div>
                <div>Status</div>
            </div>

            {/* Orders */}
            <div className="flex-1 overflow-y-auto">
                {filteredOrders.map(order => (
                    <div
                        key={order.id}
                        className="grid grid-cols-6 gap-2 px-3 py-1 text-sm hover:bg-element-bg cursor-pointer border-b border-border/50"
                    >
                        <div className="font-medium text-text">{order.symbol}</div>
                        <div className={cn(
                            "uppercase text-xs font-semibold",
                            order.side === 'buy' ? "text-up" : "text-down"
                        )}>
                            {order.side}
                        </div>
                        <div className="text-text-secondary capitalize">{order.type}</div>
                        <div className="text-right text-text-secondary tabular-nums">
                            {order.filledQty > 0 ? `${order.filledQty}/${order.quantity}` : order.quantity}
                        </div>
                        <div className="text-right font-mono text-text">
                            {order.price ? `$${order.price.toFixed(2)}` : 'MKT'}
                        </div>
                        <div className="flex items-center gap-1">
                            {statusIcons[order.status]}
                            <span className="text-xs text-text-muted capitalize">{order.status}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
