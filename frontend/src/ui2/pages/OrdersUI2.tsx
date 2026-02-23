/**
 * OrdersUI2 Page - Premium Order Management
 * Showcases DataTable with status badges, progress indicators, and action buttons
 * Wave 9: Now using real data from tradingStore
 */

import { useSyncExternalStore, useEffect } from 'react';
import { Panel, StatusBadge, ActionButton, ProgressBar } from '../components';
import { DataTable } from '../components/DataTable';
import type { ColumnDef } from '../components/DataTable';
import { tradingStore } from '../stores/tradingStore';

// Map backend order to UI format
type UIOrder = {
  id: string;
  timestamp: string;
  symbol: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit';
  quantity: number;
  price: number | null;
  filled: number;
  status: 'queued' | 'working' | 'filled' | 'rejected' | 'canceled';
  source: string;
};

const statusVariantMap: Record<UIOrder['status'], any> = {
  queued: 'queued',
  working: 'working',
  filled: 'filled',
  rejected: 'rejected',
  canceled: 'canceled',
};

export function OrdersUI2() {
  // Subscribe to trading store for real orders
  const backendOrders = useSyncExternalStore(tradingStore.subscribe, tradingStore.getOrders);
  
  // Map backend orders to UI format
  const orders: UIOrder[] = backendOrders.map(order => ({
    id: order.order_id,
    timestamp: order.timestamp,
    symbol: order.symbol,
    side: order.side as 'buy' | 'sell',
    type: order.price ? 'limit' : 'market',
    quantity: order.quantity,
    price: order.price || null,
    filled: order.filled_quantity,
    status: order.status as UIOrder['status'],
    source: order.source,
  }));

  // Start polling on mount
  useEffect(() => {
    tradingStore.startPolling(5000);
    return () => { tradingStore.stopPolling(); };
  }, []);

  const handleCancelOrder = (orderId: string) => {
    console.log('Cancel order:', orderId);
    // In real app, call backend API: DELETE /api/v1/trading/orders/{orderId}
  };

  const ordersColumns: ColumnDef<UIOrder>[] = [
    {
      key: 'id',
      label: 'Order ID',
      width: '140px',
      render: (value?: unknown) => (
        <span className="ui2-mono" style={{ fontSize: '12px', color: 'var(--ui2-text-tertiary)' }}>
          {String(value).slice(0, 8)}...
        </span>
      ),
    },
    {
      key: 'timestamp',
      label: 'Time',
      width: '100px',
      format: 'time',
    },
    {
      key: 'symbol',
      label: 'Symbol',
      width: '100px',
      render: (value?: unknown) => (
        <span style={{ fontWeight: 600, color: 'var(--ui2-text-primary)' }}>{value as string}</span>
      ),
    },
    {
      key: 'side',
      label: 'Side',
      width: '80px',
      align: 'center',
      render: (value?: unknown) => (
        <span
          style={{
            fontWeight: 600,
            color: (value as string) === 'buy' ? 'var(--ui2-success)' : 'var(--ui2-danger)',
            textTransform: 'uppercase',
          }}
        >
          {value as string}
        </span>
      ),
    },
    {
      key: 'type',
      label: 'Type',
      width: '80px',
      align: 'center',
      render: (value?: unknown) => (
        <span className="ui2-micro" style={{ color: 'var(--ui2-text-secondary)' }}>
          {String(value).toUpperCase()}
        </span>
      ),
    },
    {
      key: 'quantity',
      label: 'Qty',
      width: '80px',
      align: 'right',
      format: 'number',
    },
    {
      key: 'price',
      label: 'Price',
      width: '100px',
      align: 'right',
      render: (value?: unknown) => {
        if (value === null || value === undefined) return <span style={{ color: 'var(--ui2-text-muted)' }}>Market</span>;
        return `$${(value as number).toFixed(2)}`;
      },
    },
    {
      key: 'filled',
      label: 'Filled',
      width: '140px',
      align: 'right',
      render: (value?: unknown, row?: UIOrder) => {
        if (!row) return null;
        const fillPercent = ((value as number) / row.quantity) * 100;
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="ui2-tabular" style={{ minWidth: '60px', textAlign: 'right' }}>
              {value as number}/{row.quantity}
            </span>
            {row.status === 'working' && (
              <div style={{ flex: 1, minWidth: '40px' }}>
                <ProgressBar value={fillPercent} variant={fillPercent === 100 ? 'success' : 'default'} height="3px" showLabel testId={`order-progress-${row.id}`} />
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: 'status',
      label: 'Status',
      width: '120px',
      align: 'center',
      render: (value?: unknown, row?: UIOrder) => {
        if (!row) return null;
        return (
          <StatusBadge variant={statusVariantMap[value as UIOrder['status']]} testId={`order-status-${row.id}`}>
            {value as string}
          </StatusBadge>
        );
      },
    },
    {
      key: 'id',
      label: 'Actions',
      width: '120px',
      align: 'center',
      render: (value?: unknown, row?: UIOrder) => {
        if (!row) return null;
        const canCancel = row.status === 'queued' || row.status === 'working';
        return (
          <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
            <ActionButton
              icon="◉"
              title="View Details"
              onClick={() => console.log('View', value)}
              testId={`order-view-${value}`}
            />
            <ActionButton
              icon="⎘"
              title="Clone Order"
              onClick={() => console.log('Clone', value)}
              testId={`order-clone-${value}`}
            />
            <ActionButton
              icon="×"
              title="Cancel Order"
              onClick={() => handleCancelOrder(value as string)}
              disabled={!canCancel}
              testId={`order-cancel-${value}`}
            />
          </div>
        );
      },
    },
  ];

  return (
    <div
      data-testid="orders-ui2-page"
      style={{
        height: '100%',
        overflow: 'auto',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}
      className="ui2-scrollable"
    >
      <Panel
        title="Order Management"
        subtitle={`${orders.length} orders today`}
        testId="orders-panel"
        variant="elevated"
        padding="md"
        actions={
          <button
            className="ui2-btn ui2-btn-primary"
            data-testid="orders-new-order-btn"
            style={{ height: '32px', fontSize: '12px' }}
            onClick={() => console.log('New Order')}
          >
            + New Order
          </button>
        }
      >
        <DataTable
          columns={ordersColumns}
          data={orders}
          keyField="id"
          density="normal"
          testId="ui2-data-table-orders"
        />
      </Panel>

      {/* Summary Stats */}
      <div>
        <div className="ui2-title" style={{ marginBottom: '12px' }}>Summary Stats</div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: '12px',
          }}
        >
        {[
          { id: 'total', label: 'Total Orders', value: orders.length, variant: 'neutral' },
          { id: 'filled', label: 'Filled', value: orders.filter((o) => o.status === 'filled').length, variant: 'success' },
          { id: 'working', label: 'Working', value: orders.filter((o) => o.status === 'working').length, variant: 'working' },
          { id: 'queued', label: 'Queued', value: orders.filter((o) => o.status === 'queued').length, variant: 'queued' },
          { id: 'canceled', label: 'Canceled/Rejected', value: orders.filter((o) => o.status === 'canceled' || o.status === 'rejected').length, variant: 'canceled' },
        ].map((stat) => (
          <div
            key={stat.label}
            data-testid={`order-summary-${stat.id}`}
            className="ui2-elevation-1"
            style={{
              padding: '12px',
              borderRadius: 'var(--ui2-radius-md)',
              textAlign: 'center',
            }}
          >
            <div className="ui2-micro" style={{ color: 'var(--ui2-text-tertiary)', marginBottom: '4px' }}>
              {stat.label}
            </div>
            <div className="ui2-display" style={{ fontSize: '24px', marginBottom: '6px' }}>
              {stat.value}
            </div>
            <StatusBadge variant={stat.variant as any}>{stat.variant.toUpperCase()}</StatusBadge>
          </div>
        ))}
        </div>
      </div>
    </div>
  );
}

