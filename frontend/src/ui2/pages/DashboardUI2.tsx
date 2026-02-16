/**
 * DashboardUI2 Page - Premium Trading Terminal Dashboard
 * Showcases KPI Strip, Insights Panel, and professional layout
 */

import React from 'react';
import { Panel, KPIStrip, InsightsPanel } from '../components';
import { DEMO_KPIS, DEMO_INSIGHTS, DEMO_POSITIONS } from '../demo/fixtures';
import { DataTable, formatPnL, formatPercent } from '../components/DataTable';
import type { ColumnDef } from '../components/DataTable';
import { EnhancedCommandCenterView } from '../../features/layout/views/EnhancedCommandCenterView';

export function DashboardUI2() {
  const [dismissedInsights, setDismissedInsights] = React.useState<string[]>([]);

  const visibleInsights = DEMO_INSIGHTS.filter((insight) => !dismissedInsights.includes(insight.id));

  const handleDismissInsight = (id: string) => {
    setDismissedInsights((prev) => [...prev, id]);
  };

  // Define positions table columns
  const positionsColumns: ColumnDef<typeof DEMO_POSITIONS[0]>[] = [
    {
      key: 'symbol',
      label: 'Symbol',
      width: '120px',
      render: (value) => (
        <span style={{ fontWeight: 600, color: 'var(--ui2-text-primary)' }}>{value}</span>
      ),
    },
    {
      key: 'quantity',
      label: 'Quantity',
      align: 'right',
      width: '100px',
      format: 'number',
    },
    {
      key: 'marketPrice',
      label: 'Price',
      align: 'right',
      width: '100px',
      format: 'currency',
    },
    {
      key: 'marketValue',
      label: 'Market Value',
      align: 'right',
      width: '120px',
      format: 'currency',
    },
    {
      key: 'pnl',
      label: 'P&L',
      align: 'right',
      width: '120px',
      render: (value) => {
        const { text, color } = formatPnL(value);
        return <span style={{ color, fontWeight: 600 }}>{text}</span>;
      },
    },
    {
      key: 'pnlPercent',
      label: 'P&L %',
      align: 'right',
      width: '100px',
      render: (value) => {
        const { text, color } = formatPercent(value);
        return <span style={{ color }}>{text}</span>;
      },
    },
    {
      key: 'dayChange',
      label: 'Day Change',
      align: 'right',
      width: '120px',
      render: (value) => {
        const { text, color } = formatPnL(value);
        return <span style={{ color }}>{text}</span>;
      },
    },
  ];

  return (
    <div
      data-testid="dashboard-ui2-page"
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
        <KPIStrip items={DEMO_KPIS} variant="hero" testId="ui2-kpi-strip-hero" />
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
            insights={visibleInsights}
            testId="ui2-insights-panel"
            onDismiss={handleDismissInsight}
          />
        </Panel>

        {/* Top Positions Table */}
        <Panel
          title="Top Positions"
          subtitle="4 holdings"
          testId="dashboard-positions-panel"
          variant="elevated"
          padding="md"
        >
          <DataTable
            columns={positionsColumns}
            data={DEMO_POSITIONS}
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

