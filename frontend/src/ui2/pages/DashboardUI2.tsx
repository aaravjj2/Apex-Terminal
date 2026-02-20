/**
 * DashboardUI2 Page - Premium Trading Terminal Dashboard
 * Showcases KPI Strip, Insights Panel, and professional layout
 * Wave 9: Now using real data from tradingStore
 * v1.93: Removed DEMO_INSIGHTS, using insightsStore
 * v1.114: Terminal-grade polish with design tokens & tabular numbers
 */

import React, { useSyncExternalStore, useEffect } from 'react';
import { Panel, KPIStrip, InsightsPanel } from '../components';
import { DataTable } from '../components/DataTable';
import type { ColumnDef } from '../components/DataTable';
import { NumericValue } from '../components/NumericDisplay';
import { EnhancedCommandCenterView } from '../../features/layout/views/EnhancedCommandCenterView';
import { tradingStore, type Position } from '../stores/tradingStore';
import { insightsStore } from '../stores/insightsStore';

export function DashboardUI2() {
  const [dismissedInsights, setDismissedInsights] = React.useState<string[]>([]);
  
  // Subscribe to trading store for real data
  const positions = useSyncExternalStore(tradingStore.subscribe, tradingStore.getPositions);
  const pnl = useSyncExternalStore(tradingStore.subscribe, tradingStore.getPnL);
  const orders = useSyncExternalStore(tradingStore.subscribe, tradingStore.getOrders);
  
  // Subscribe to insights store
  const allInsights = useSyncExternalStore(insightsStore.subscribe, insightsStore.getInsights);
  
  // Start streaming (WebSocket preferred, polling fallback) on mount
  useEffect(() => {
    tradingStore.startStreaming();
    return () => { tradingStore.stopStreaming(); };
  }, []);

  const visibleInsights = allInsights.filter((insight) => !dismissedInsights.includes(insight.id));

  const handleDismissInsight = (id: string) => {
    setDismissedInsights((prev) => [...prev, id]);
  };

  // KPIs from real data
  const kpis = [
    { 
      id: 'total-pnl', 
      label: 'Total P&L', 
      value: `$${pnl.total_pnl.toFixed(2)}`, 
      change: pnl.total_pnl !== 0 ? { 
        value: `$${Math.abs(pnl.total_pnl).toFixed(2)}`, 
        direction: pnl.total_pnl >= 0 ? 'up' as const : 'down' as const 
      } : undefined,
      testId: 'kpi-total-pnl' 
    },
    { 
      id: 'unrealized-pnl', 
      label: 'Unrealized P&L', 
      value: `$${pnl.unrealized_pnl.toFixed(2)}`, 
      change: pnl.unrealized_pnl !== 0 ? { 
        value: `$${Math.abs(pnl.unrealized_pnl).toFixed(2)}`, 
        direction: pnl.unrealized_pnl >= 0 ? 'up' as const : 'down' as const 
      } : undefined,
      testId: 'kpi-unrealized-pnl' 
    },
    { id: 'positions', label: 'Positions', value: `${pnl.positions_count}`, testId: 'kpi-positions-count' },
    { id: 'orders', label: 'Orders Today', value: `${orders.length}`, testId: 'kpi-orders-count' },
    { id: 'notional', label: 'Total Notional', value: `$${(pnl.total_notional / 1000).toFixed(1)}k`, testId: 'kpi-total-notional' },
  ];

  // Define positions table columns with tabular numeric formatting
  const positionsColumns: ColumnDef<Position>[] = [
    {
      key: 'symbol',
      label: 'Symbol',
      width: '120px',
      render: (value?: unknown) => (
        <span className="font-semibold text-neutral-100">{value as string}</span>
      ),
    },
    {
      key: 'quantity',
      label: 'Quantity',
      align: 'right',
      width: '100px',
      render: (value?: unknown) => (
        <NumericValue value={value as number} decimals={0} />
      ),
    },
    {
      key: 'market_price',
      label: 'Price',
      align: 'right',
      width: '100px',
      render: (value?: unknown) => (
        <NumericValue value={value as number} format="currency" decimals={2} />
      ),
    },
    {
      key: 'avg_price',
      label: 'Avg Price',
      align: 'right',
      width: '100px',
      render: (value?: unknown) => (
        <NumericValue value={value as number} format="currency" decimals={2} />
      ),
    },
    {
      key: 'unrealized_pnl',
      label: 'P&L',
      align: 'right',
      width: '120px',
      render: (value?: unknown) => (
        <NumericValue
          value={value as number || 0}
          format="currency"
          decimals={2}
          showSign
          colorize
        />
      ),
    },
    {
      key: 'sector',
      label: 'Sector',
      align: 'left',
      width: '120px',
    },
  ];

  return (
    <div
      data-testid="dashboard-ui2-page"
      data-ready="true"
      data-ui2-dashboard-ready="true"
      style={{
        height: '100%',
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        padding: '16px',
      }}
      className="ui2-scrollable"
    >
      {/* Hero KPI Strip */}
      <div data-testid="dashboard-kpi-strip">
        <KPIStrip items={kpis} variant="hero" testId="ui2-kpi-strip-hero" />
      </div>

      {/* Two-column layout: Insights + Positions */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1.5fr',
          gap: '16px',
          minHeight: '400px',
        }}
      >
        {/* AI Insights Panel */}
        <Panel
          title="AI Insights"
          subtitle={`${visibleInsights.length} active`}
          testId="dashboard-insights-panel"
          variant="elevated"
          padding="md"
        >
          <InsightsPanel
            insights={visibleInsights as any}
            testId="ui2-insights-panel"
            onDismiss={handleDismissInsight}
          />
        </Panel>

        {/* Top Positions Table */}
        <Panel
          title="Top Positions"
          subtitle={`${positions.length} holdings`}
          testId="dashboard-positions-panel"
          variant="elevated"
          padding="md"
        >
          <DataTable
            columns={positionsColumns}
            data={positions}
            keyField="symbol"
            density="normal"
            striped
            testId="ui2-data-table-positions"
          />
        </Panel>
      </div>

      {/* Embedded Command Center (original UI1 view for continuity) */}
      <Panel
        title="Command Center"
        subtitle="Full analytics suite"
        testId="dashboard-command-center-panel"
        variant="default"
        padding="none"
      >
        <div style={{ minHeight: '400px' }}>
          <EnhancedCommandCenterView />
        </div>
      </Panel>
    </div>
  );
}

