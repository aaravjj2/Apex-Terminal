/**
 * v1.58 — AutopilotUI2 Page (Enhanced)
 * Kill switch, rule toggles, activity feed with full testIds
 */

import { useState, useEffect } from 'react';
import { PageHeader, Pill, StatusBadge, DataTable, type ColumnDef } from '../components';
import { autopilotStore } from '../stores/autopilotStore';

export function AutopilotUI2() {
  const [killSwitch, setKillSwitch] = useState(autopilotStore.isKillSwitchActive());
  const [rules, setRules] = useState(autopilotStore.getRules());
  const [activity, setActivity] = useState(autopilotStore.getActivity());
  const [confirmModal, setConfirmModal] = useState(false);

  useEffect(() => {
    const unsub = autopilotStore.subscribe(() => {
      setKillSwitch(autopilotStore.isKillSwitchActive());
      setRules(autopilotStore.getRules());
      setActivity(autopilotStore.getActivity());
    });
    return unsub;
  }, []);

  const handleKillSwitch = () => {
    if (!killSwitch) {
      setConfirmModal(true);
    } else {
      autopilotStore.deactivateKillSwitch();
    }
  };

  const confirmKill = () => {
    autopilotStore.activateKillSwitch();
    setConfirmModal(false);
  };

  const activityColumns: ColumnDef<Record<string, unknown>>[] = [
    { key: 'type', label: 'Type', width: '100px', render: (_val: unknown, row: Record<string, unknown>) => {
      const v = row['type'] as string;
      const variant = v === 'accepted' ? 'success' : v === 'rejected' ? 'danger' : v === 'kill-switch' ? 'danger' : 'info';
      return <StatusBadge variant={variant} testId={`autopilot-activity-badge-${row['id']}`}>{v}</StatusBadge>;
    }},
    { key: 'symbol', label: 'Symbol', width: '80px' },
    { key: 'side', label: 'Side', width: '60px' },
    { key: 'quantity', label: 'Qty', width: '60px' },
    { key: 'reason', label: 'Reason' },
    { key: 'confidence', label: 'Conf', width: '60px', render: (val: unknown) => {
      const n = val as number;
      return n ? `${(n * 100).toFixed(0)}%` : '-';
    }},
  ];

  return (
    <div data-testid="autopilot-ui2-page" style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px 0 16px' }}>
        <PageHeader
          title="Autopilot"
          subtitle="AI agent orchestration and autonomous trading"
          icon="A"
          badge={
            killSwitch
              ? <Pill variant="danger" size="xs">HALTED</Pill>
              : <Pill variant="success" size="xs">ACTIVE</Pill>
          }
          testId="autopilot-header"
        />
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px 16px 16px' }}>
        {/* Kill Switch */}
        <div data-testid="autopilot-kill-switch-panel" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', background: killSwitch ? 'rgba(239,68,68,0.1)' : 'var(--ui2-bg-panel)',
          border: `1px solid ${killSwitch ? 'rgba(239,68,68,0.3)' : 'var(--ui2-border)'}`,
          borderRadius: 'var(--ui2-radius-md)', marginBottom: '16px',
        }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: killSwitch ? 'var(--ui2-danger)' : 'var(--ui2-text-primary)' }}>
              Kill Switch
            </div>
            <div style={{ fontSize: '12px', color: 'var(--ui2-text-secondary)', marginTop: '2px' }}>
              {killSwitch ? 'All autopilot trading is HALTED' : 'Autopilot is actively monitoring and trading'}
            </div>
          </div>
          <button
            data-testid="autopilot-kill-switch-btn"
            onClick={handleKillSwitch}
            style={{
              padding: '8px 20px', fontWeight: 600, fontSize: '13px', border: 'none', borderRadius: 'var(--ui2-radius-md)', cursor: 'pointer',
              background: killSwitch ? 'var(--ui2-success)' : 'var(--ui2-danger)',
              color: 'white',
            }}
          >
            {killSwitch ? 'Resume Trading' : 'KILL SWITCH'}
          </button>
        </div>

        {/* Confirm Modal */}
        {confirmModal && (
          <>
            <div data-testid="autopilot-confirm-backdrop" onClick={() => setConfirmModal(false)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000 }} />
            <div data-testid="autopilot-confirm-modal" style={{
              position: 'fixed', top: '30%', left: '50%', transform: 'translateX(-50%)',
              width: '400px', padding: '24px', background: 'var(--ui2-bg-panel)',
              border: '1px solid var(--ui2-danger)', borderRadius: 'var(--ui2-radius-lg)',
              zIndex: 1001, boxShadow: 'var(--ui2-shadow-xl)',
            }}>
              <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--ui2-danger)', marginBottom: '12px' }}>
                Confirm Kill Switch Activation
              </div>
              <div style={{ fontSize: '13px', color: 'var(--ui2-text-secondary)', marginBottom: '20px' }}>
                This will immediately halt ALL autopilot trading activity. Active orders will remain but no new trades will be placed.
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button data-testid="autopilot-confirm-cancel" onClick={() => setConfirmModal(false)}
                  style={{ padding: '8px 16px', background: 'var(--ui2-bg-input)', border: '1px solid var(--ui2-border)', borderRadius: 'var(--ui2-radius-md)', color: 'var(--ui2-text-secondary)', cursor: 'pointer', fontSize: '13px' }}>
                  Cancel
                </button>
                <button data-testid="autopilot-confirm-activate" onClick={confirmKill}
                  style={{ padding: '8px 16px', background: 'var(--ui2-danger)', border: 'none', borderRadius: 'var(--ui2-radius-md)', color: 'white', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}>
                  Activate Kill Switch
                </button>
              </div>
            </div>
          </>
        )}

        {/* Rules */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ui2-text-primary)', marginBottom: '8px' }}>Risk Rules</div>
          <div data-testid="autopilot-rules-list" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {rules.map(rule => (
              <div key={rule.id} data-testid={`autopilot-rule-${rule.id}`} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 12px', background: 'var(--ui2-bg-panel)', border: '1px solid var(--ui2-border)',
                borderRadius: 'var(--ui2-radius-sm)',
              }}>
                <div>
                  <div style={{ fontSize: '13px', color: 'var(--ui2-text-primary)' }}>{rule.name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--ui2-text-muted)' }}>{rule.value} {rule.unit}</div>
                </div>
                <button
                  data-testid={`autopilot-rule-toggle-${rule.id}`}
                  onClick={() => autopilotStore.toggleRule(rule.id)}
                  style={{
                    padding: '4px 12px', fontSize: '11px', fontWeight: 600,
                    background: rule.enabled ? 'rgba(34,197,94,0.15)' : 'rgba(148,163,184,0.15)',
                    color: rule.enabled ? 'var(--ui2-success)' : 'var(--ui2-text-muted)',
                    border: 'none', borderRadius: 'var(--ui2-radius-sm)', cursor: 'pointer',
                  }}
                >
                  {rule.enabled ? 'ON' : 'OFF'}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Activity Feed */}
        <div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ui2-text-primary)', marginBottom: '8px' }}>Activity Feed</div>
          <DataTable
            data={activity as any}
            columns={activityColumns}
            keyField="id"
            testId="autopilot-activity-table"
          />
        </div>
      </div>
      <div data-testid="autopilot-ready" style={{ display: 'none' }} />
    </div>
  );
}
