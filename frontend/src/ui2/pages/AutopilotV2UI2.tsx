/**
 * Wave 8 — AutopilotV2UI2 Page (v1.73-v1.75)
 * Full pipeline: candidates → scoring → risk → sizing → execution sim
 * Kill switch, seed selector, explain panel, orders/positions tables
 */

import { useSyncExternalStore } from 'react';
import { PageHeader, StatusBadge, DataTable, Pill, type ColumnDef } from '../components';
import { Tabs } from '../components/Tabs';
import { autopilotV2Store, type CandidateV2, type OrderRecordV2, type PositionRecordV2, type RejectionV2, type ExplainEntry, type StageResultV2 } from '../stores/autopilotV2Store';

export function AutopilotV2UI2() {
  const runs = useSyncExternalStore(autopilotV2Store.subscribe, autopilotV2Store.getRuns);
  const currentRun = useSyncExternalStore(autopilotV2Store.subscribe, autopilotV2Store.getCurrentRun);
  const activeTab = useSyncExternalStore(autopilotV2Store.subscribe, autopilotV2Store.getActiveTab);
  const seed = useSyncExternalStore(autopilotV2Store.subscribe, autopilotV2Store.getSeed);
  const killSwitch = useSyncExternalStore(autopilotV2Store.subscribe, autopilotV2Store.getKillSwitch);

  const handleRun = () => { autopilotV2Store.execute(); };
  const handleToggleKillSwitch = () => {
    if (killSwitch.armed) {
      autopilotV2Store.disarmKillSwitch();
    } else {
      autopilotV2Store.armKillSwitch();
    }
  };

  const tabItems = [
    { id: 'candidates', label: 'Candidates' },
    { id: 'explain', label: 'Explain' },
    { id: 'orders', label: 'Orders' },
    { id: 'positions', label: 'Positions' },
    { id: 'rejections', label: 'Rejections' },
    { id: 'timeline', label: 'Timeline' },
  ];

  const candidateColumns: ColumnDef<CandidateV2>[] = [
    { key: 'symbol', label: 'Symbol', width: '80px' },
    { key: 'side', label: 'Side', width: '60px', render: (val: unknown) => {
      const v = val as string;
      return <StatusBadge variant={v === 'buy' ? 'success' : 'danger'} testId="">{v.toUpperCase()}</StatusBadge>;
    }},
    { key: 'confidence', label: 'Conf', width: '80px', render: (val: unknown) => `${((val as number) * 100).toFixed(0)}%` },
    { key: 'signal_tags', label: 'Signals', render: (val: unknown) => {
      const tags = val as string[];
      return <span>{tags.join(', ')}</span>;
    }},
  ];

  const orderColumns: ColumnDef<OrderRecordV2>[] = [
    { key: 'order_id', label: 'Order ID', width: '140px' },
    { key: 'symbol', label: 'Symbol', width: '80px' },
    { key: 'side', label: 'Side', width: '60px', render: (val: unknown) => {
      const v = val as string;
      return <StatusBadge variant={v === 'buy' ? 'success' : 'danger'} testId="">{v.toUpperCase()}</StatusBadge>;
    }},
    { key: 'quantity', label: 'Qty', width: '60px' },
    { key: 'fill_price', label: 'Fill $', width: '90px', render: (val: unknown) => `$${(val as number).toFixed(2)}` },
    { key: 'status', label: 'Status', width: '80px', render: (val: unknown) => (
      <StatusBadge variant="success" testId="">{val as string}</StatusBadge>
    )},
  ];

  const positionColumns: ColumnDef<PositionRecordV2>[] = [
    { key: 'symbol', label: 'Symbol', width: '80px' },
    { key: 'side', label: 'Side', width: '60px' },
    { key: 'quantity', label: 'Qty', width: '60px' },
    { key: 'avg_price', label: 'Avg $', width: '90px', render: (val: unknown) => `$${(val as number).toFixed(2)}` },
    { key: 'unrealized_pnl', label: 'P&L', width: '90px', render: (val: unknown) => {
      const n = val as number;
      return <span style={{ color: n >= 0 ? 'var(--ui2-green)' : 'var(--ui2-red)' }}>${n.toFixed(2)}</span>;
    }},
    { key: 'sector', label: 'Sector', width: '120px' },
  ];

  const rejectionColumns: ColumnDef<RejectionV2>[] = [
    { key: 'symbol', label: 'Symbol', width: '80px' },
    { key: 'reason_code', label: 'Code', width: '140px', render: (val: unknown) => (
      <StatusBadge variant="danger" testId="">{val as string}</StatusBadge>
    )},
    { key: 'stage', label: 'Stage', width: '100px' },
    { key: 'reason_text', label: 'Explanation' },
  ];

  const explainColumns: ColumnDef<ExplainEntry>[] = [
    { key: 'symbol', label: 'Symbol', width: '80px' },
    { key: 'final_action', label: 'Action', width: '100px', render: (val: unknown) => {
      const v = val as string;
      return <StatusBadge variant={v === 'EXECUTED' ? 'success' : 'danger'} testId="">{v}</StatusBadge>;
    }},
    { key: 'score_breakdown', label: 'Score', width: '80px', render: (_v: unknown, row: ExplainEntry) => `${row.score_breakdown.raw_score}` },
    { key: 'risk_result', label: 'Risk', width: '80px', render: (_v: unknown, row: ExplainEntry) => (
      <StatusBadge variant={row.risk_result.passed ? 'success' : 'danger'} testId="">{row.risk_result.passed ? 'PASS' : 'FAIL'}</StatusBadge>
    )},
    { key: 'sizing', label: 'Qty', width: '60px', render: (_v: unknown, row: ExplainEntry) => row.sizing ? `${row.sizing.quantity}` : '—' },
  ];

  const timelineColumns: ColumnDef<StageResultV2>[] = [
    { key: 'stage_number', label: '#', width: '40px' },
    { key: 'stage_name', label: 'Stage', width: '120px' },
    { key: 'status', label: 'Status', width: '100px', render: (val: unknown) => (
      <StatusBadge variant="success" testId="">{val as string}</StatusBadge>
    )},
    { key: 'input_count', label: 'In', width: '60px' },
    { key: 'output_count', label: 'Out', width: '60px' },
    { key: 'duration_ms', label: 'ms', width: '60px' },
  ];

  return (
    <div data-testid="autopilot-v2-page" style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px 0 16px' }}>
        <PageHeader
          title="Autopilot V2"
          subtitle="State Machine Pipeline · Candidate → Score → Risk → Size → Execute"
          testId="ui2-autopilot-v2-header"
        />
      </div>

      {/* Controls bar */}
      <div data-testid="ui2-autopilot-controls" style={{ padding: '8px 16px', display: 'flex', gap: '12px', alignItems: 'center', borderBottom: '1px solid var(--ui2-border)' }}>
        <button
          data-testid="ui2-autopilot-run-btn"
          onClick={handleRun}
          disabled={killSwitch.armed}
          style={{
            padding: '6px 16px', fontSize: '13px', fontWeight: 600,
            background: killSwitch.armed ? 'var(--ui2-bg-muted)' : 'var(--ui2-brand)',
            color: killSwitch.armed ? 'var(--ui2-text-disabled)' : '#fff',
            border: 'none', borderRadius: '4px', cursor: killSwitch.armed ? 'not-allowed' : 'pointer',
          }}
        >
          Run Pipeline
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <label style={{ fontSize: '12px', color: 'var(--ui2-text-secondary)' }}>Seed:</label>
          <select
            data-testid="ui2-autopilot-seed-select"
            value={seed}
            onChange={e => autopilotV2Store.setSeed(Number(e.target.value))}
            style={{
              padding: '4px 8px', fontSize: '12px',
              background: 'var(--ui2-bg-elevated)', color: 'var(--ui2-text-primary)',
              border: '1px solid var(--ui2-border)', borderRadius: '4px',
            }}
          >
            <option value={42}>42</option>
            <option value={123}>123</option>
            <option value={999}>999</option>
          </select>
        </div>

        <button
          data-testid="ui2-autopilot-killswitch-toggle"
          onClick={handleToggleKillSwitch}
          style={{
            padding: '6px 12px', fontSize: '12px', fontWeight: 600,
            background: killSwitch.armed ? 'var(--ui2-red, #e74c3c)' : 'transparent',
            color: killSwitch.armed ? '#fff' : 'var(--ui2-text-secondary)',
            border: killSwitch.armed ? 'none' : '1px solid var(--ui2-border)',
            borderRadius: '4px', cursor: 'pointer',
          }}
        >
          {killSwitch.armed ? '🛑 Kill Switch ON' : 'Kill Switch'}
        </button>

        {runs.length > 0 && (
          <Pill testId="ui2-autopilot-run-count">{runs.length} run{runs.length !== 1 ? 's' : ''}</Pill>
        )}

        {currentRun && (
          <span style={{ fontSize: '11px', color: 'var(--ui2-text-muted)', marginLeft: 'auto' }}>
            Hash: {currentRun.deterministic_hash}
          </span>
        )}
      </div>

      {/* Last Run Outcome Summary */}
      {currentRun && (
        <div data-testid="ui2-autopilot-outcome-summary" style={{
          margin: '8px 16px', padding: '12px', background: 'var(--ui2-bg-elevated)',
          border: '1px solid var(--ui2-border)', borderRadius: '4px', display: 'flex', gap: '24px', flexWrap: 'wrap',
        }}>
          <div data-testid="ui2-autopilot-outcome-trades">
            <div style={{ fontSize: '11px', color: 'var(--ui2-text-secondary)', marginBottom: '4px' }}>Trades Placed</div>
            <div style={{ fontSize: '20px', fontWeight: 600, color: 'var(--ui2-brand)' }}>
              {currentRun.orders.length}
            </div>
          </div>
          <div data-testid="ui2-autopilot-outcome-rejections">
            <div style={{ fontSize: '11px', color: 'var(--ui2-text-secondary)', marginBottom: '4px' }}>Rejections</div>
            <div style={{ fontSize: '20px', fontWeight: 600, color: currentRun.rejections.length > 0 ? 'var(--ui2-red)' : 'var(--ui2-text-secondary)' }}>
              {currentRun.rejections.length}
            </div>
          </div>
          <div data-testid="ui2-autopilot-outcome-exposure">
            <div style={{ fontSize: '11px', color: 'var(--ui2-text-secondary)', marginBottom: '4px' }}>Net Exposure</div>
            <div style={{ fontSize: '20px', fontWeight: 600, color: 'var(--ui2-text-primary)' }}>
              ${(currentRun.positions.reduce((sum, p) => sum + p.quantity * p.avg_price, 0)).toFixed(0)}
            </div>
          </div>
          {currentRun.rejections.length > 0 && (
            <div data-testid="ui2-autopilot-outcome-rejection-reasons" style={{ flex: 1, minWidth: '300px' }}>
              <div style={{ fontSize: '11px', color: 'var(--ui2-text-secondary)', marginBottom: '4px' }}>Top Rejection Reasons</div>
              <div style={{ fontSize: '12px', color: 'var(--ui2-text-primary)' }}>
                {(() => {
                  const counts: Record<string, number> = {};
                  currentRun.rejections.forEach(r => { counts[r.reason_code] = (counts[r.reason_code] || 0) + 1; });
                  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3);
                  return sorted.map(([code, count]) => `${code} (${count})`).join(', ');
                })()}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div style={{ padding: '0 16px' }}>
        <Tabs
          items={tabItems}
          activeTab={activeTab}
          onTabChange={tab => autopilotV2Store.setActiveTab(tab)}
          testId="ui2-autopilot-tabs"
        />
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 16px 16px 16px' }}>
        {!currentRun ? (
          <div data-testid="ui2-autopilot-empty" style={{ padding: '40px', textAlign: 'center', color: 'var(--ui2-text-muted)' }}>
            Click <strong>Run Pipeline</strong> to execute the Autopilot V2 state machine
          </div>
        ) : activeTab === 'candidates' ? (
          <div data-testid="ui2-autopilot-candidates-table">
            <DataTable
              columns={candidateColumns as unknown as ColumnDef<Record<string, unknown>>[]}
              data={currentRun.candidates as unknown as Record<string, unknown>[]}
              testId="ui2-autopilot-candidates-dt"
              density="compact"
            />
          </div>
        ) : activeTab === 'explain' ? (
          <div data-testid="ui2-autopilot-explain-panel">
            <DataTable
              columns={explainColumns as unknown as ColumnDef<Record<string, unknown>>[]}
              data={currentRun.explain as unknown as Record<string, unknown>[]}
              testId="ui2-autopilot-explain-dt"
              density="compact"
            />
          </div>
        ) : activeTab === 'orders' ? (
          <div data-testid="ui2-autopilot-orders-table">
            <DataTable
              columns={orderColumns as unknown as ColumnDef<Record<string, unknown>>[]}
              data={currentRun.orders as unknown as Record<string, unknown>[]}
              testId="ui2-autopilot-orders-dt"
              density="compact"
            />
          </div>
        ) : activeTab === 'positions' ? (
          <div data-testid="ui2-autopilot-positions-table">
            <DataTable
              columns={positionColumns as unknown as ColumnDef<Record<string, unknown>>[]}
              data={currentRun.positions as unknown as Record<string, unknown>[]}
              testId="ui2-autopilot-positions-dt"
              density="compact"
            />
          </div>
        ) : activeTab === 'rejections' ? (
          <div data-testid="ui2-autopilot-rejections-table">
            <DataTable
              columns={rejectionColumns as unknown as ColumnDef<Record<string, unknown>>[]}
              data={currentRun.rejections as unknown as Record<string, unknown>[]}
              testId="ui2-autopilot-rejections-dt"
              density="compact"
            />
          </div>
        ) : activeTab === 'timeline' ? (
          <div data-testid="ui2-autopilot-timeline">
            <DataTable
              columns={timelineColumns as unknown as ColumnDef<Record<string, unknown>>[]}
              data={currentRun.stages as unknown as Record<string, unknown>[]}
              testId="ui2-autopilot-timeline-dt"
              density="compact"
            />
          </div>
        ) : null}
      </div>

      {/* Ready marker */}
      <div data-testid="autopilot-v2-ready" style={{ display: 'none' }} />
    </div>
  );
}
