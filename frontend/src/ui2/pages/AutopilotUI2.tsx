/**
 * v1.69 — AutopilotUI2 Page (Enhanced with 2.0 Pipeline)
 * Kill switch, rule toggles, activity feed + Pipeline 2.0 stages/ledger
 */

import { useState, useEffect, useSyncExternalStore } from 'react';
import { PageHeader, Pill, StatusBadge, DataTable, type ColumnDef } from '../components';
import { autopilotStore } from '../stores/autopilotStore';
import { autopilot2Store, type AP2Stage } from '../stores/autopilot2Store';

type TabKey = 'controls' | 'pipeline' | 'ledger';

export function AutopilotUI2() {
  const [killSwitch, setKillSwitch] = useState(autopilotStore.isKillSwitchActive());
  const [rules, setRules] = useState(autopilotStore.getRules());
  const [activity, setActivity] = useState(autopilotStore.getActivity());
  const [confirmModal, setConfirmModal] = useState(false);
  const [tab, setTab] = useState<TabKey>('controls');

  const ap2Runs = useSyncExternalStore(autopilot2Store.subscribe, autopilot2Store.getRuns);
  const ap2Selected = useSyncExternalStore(autopilot2Store.subscribe, autopilot2Store.getSelectedRun);
  const ledgerTab = useSyncExternalStore(autopilot2Store.subscribe, autopilot2Store.getLedgerTab);

  const currentRun = ap2Runs.find(r => r.run_id === ap2Selected) ?? null;

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

  const handleRunPipeline = () => {
    autopilot2Store.execute();
    setTab('pipeline');
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

  const decisionColumns: ColumnDef<Record<string, unknown>>[] = [
    { key: 'symbol', label: 'Symbol', width: '80px' },
    { key: 'action', label: 'Action', width: '60px', render: (val: unknown) => {
      const v = val as string;
      return <StatusBadge variant={v === 'buy' ? 'success' : 'danger'} testId="">{v.toUpperCase()}</StatusBadge>;
    }},
    { key: 'quantity', label: 'Qty', width: '60px' },
    { key: 'price', label: 'Price', width: '90px', render: (val: unknown) => `$${(val as number).toFixed(2)}` },
    { key: 'reason_code', label: 'Code', width: '120px' },
    { key: 'risk_score', label: 'Risk', width: '60px', render: (val: unknown) => `${((val as number) * 100).toFixed(0)}%` },
    { key: 'reason_text', label: 'Explanation' },
  ];

  const rejectionColumns: ColumnDef<Record<string, unknown>>[] = [
    { key: 'symbol', label: 'Symbol', width: '80px' },
    { key: 'reason_code', label: 'Code', width: '140px', render: (val: unknown) => (
      <StatusBadge variant="danger" testId="">{val as string}</StatusBadge>
    )},
    { key: 'stage', label: 'Stage', width: '100px' },
    { key: 'reason_text', label: 'Explanation' },
  ];

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'controls', label: 'Controls' },
    { key: 'pipeline', label: 'Pipeline 2.0' },
    { key: 'ledger', label: 'Decision Ledger' },
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

      {/* Tabs */}
      <div data-testid="autopilot-tabs" style={{ display: 'flex', gap: '2px', padding: '8px 16px 0 16px', borderBottom: '1px solid var(--ui2-border)' }}>
        {tabs.map(t => (
          <button key={t.key} data-testid={`autopilot-tab-${t.key}`}
            onClick={() => setTab(t.key)}
            style={{
              padding: '8px 16px', fontSize: '12px', fontWeight: tab === t.key ? 600 : 400,
              border: 'none', borderBottom: tab === t.key ? '2px solid var(--ui2-accent)' : '2px solid transparent',
              background: 'none', color: tab === t.key ? 'var(--ui2-accent)' : 'var(--ui2-text-secondary)',
              cursor: 'pointer', marginBottom: '-1px',
            }}
          >{t.label}</button>
        ))}
        <div style={{ flex: 1 }} />
        <button data-testid="autopilot-run-pipeline-btn" onClick={handleRunPipeline}
          style={{
            padding: '6px 16px', fontSize: '12px', fontWeight: 600,
            background: 'var(--ui2-accent)', color: 'white', border: 'none',
            borderRadius: 'var(--ui2-radius-md)', cursor: 'pointer', marginBottom: '4px',
          }}
        >Run Pipeline</button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px 16px 16px' }}>
        {/* ── Controls Tab ── */}
        {tab === 'controls' && (
          <>
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
          </>
        )}

        {/* ── Pipeline 2.0 Tab ── */}
        {tab === 'pipeline' && (
          <div data-testid="autopilot-pipeline-panel">
            {/* Run selector */}
            {ap2Runs.length > 0 && (
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
                {ap2Runs.map((r, i) => (
                  <button key={r.run_id} data-testid={`autopilot-run-select-${i}`}
                    onClick={() => autopilot2Store.selectRun(r.run_id)}
                    style={{
                      padding: '4px 12px', fontSize: '11px', fontWeight: ap2Selected === r.run_id ? 600 : 400,
                      background: ap2Selected === r.run_id ? 'var(--ui2-accent)' : 'var(--ui2-bg-input)',
                      color: ap2Selected === r.run_id ? 'white' : 'var(--ui2-text-secondary)',
                      border: '1px solid var(--ui2-border)', borderRadius: 'var(--ui2-radius-sm)', cursor: 'pointer',
                    }}
                  >Run #{i + 1}</button>
                ))}
              </div>
            )}

            {!currentRun && (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--ui2-text-muted)', fontSize: '13px' }}>
                Click <strong>Run Pipeline</strong> to execute Autopilot 2.0
              </div>
            )}

            {currentRun && (
              <>
                {/* Stage Timeline */}
                <div data-testid="autopilot-stage-timeline" style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ui2-text-primary)', marginBottom: '8px' }}>
                    Pipeline Stages
                  </div>
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    {currentRun.stages.map((s: AP2Stage) => (
                      <div key={s.stage_number} data-testid={`autopilot-stage-${s.stage_number}`} style={{
                        flex: '1 1 140px', padding: '10px 12px',
                        background: 'var(--ui2-bg-panel)', border: '1px solid var(--ui2-border)',
                        borderRadius: 'var(--ui2-radius-sm)',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--ui2-accent)' }}>
                            Stage {s.stage_number}
                          </span>
                          <StatusBadge variant="success" testId="">{s.status}</StatusBadge>
                        </div>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ui2-text-primary)' }}>
                          {s.stage_name}
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--ui2-text-muted)', marginTop: '4px' }}>
                          {s.input_count} in → {s.output_count} out · {s.duration_ms}ms
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Summary bar */}
                <div data-testid="autopilot-summary-bar" style={{
                  display: 'flex', gap: '16px', padding: '10px 14px', marginBottom: '12px',
                  background: 'var(--ui2-bg-panel)', border: '1px solid var(--ui2-border)',
                  borderRadius: 'var(--ui2-radius-md)',
                }}>
                  <div><span style={{ fontSize: '11px', color: 'var(--ui2-text-muted)' }}>Candidates</span><br/>
                    <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--ui2-text-primary)' }}>{currentRun.candidates.length}</span></div>
                  <div><span style={{ fontSize: '11px', color: 'var(--ui2-text-muted)' }}>Accepted</span><br/>
                    <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--ui2-success)' }}>{currentRun.decisions.length}</span></div>
                  <div><span style={{ fontSize: '11px', color: 'var(--ui2-text-muted)' }}>Rejected</span><br/>
                    <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--ui2-danger)' }}>{currentRun.rejections.length}</span></div>
                  <div><span style={{ fontSize: '11px', color: 'var(--ui2-text-muted)' }}>Orders</span><br/>
                    <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--ui2-accent)' }}>{currentRun.orders.length}</span></div>
                  <div style={{ marginLeft: 'auto' }}>
                    <span style={{ fontSize: '11px', color: 'var(--ui2-text-muted)' }}>Hash</span><br/>
                    <span data-testid="autopilot-run-hash" style={{ fontSize: '12px', fontFamily: 'monospace', color: 'var(--ui2-text-secondary)' }}>
                      {currentRun.deterministic_hash}
                    </span>
                  </div>
                </div>

                {/* Decisions table */}
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ui2-text-primary)', marginBottom: '6px' }}>Accepted Trades</div>
                  <DataTable
                    data={currentRun.decisions as any}
                    columns={decisionColumns}
                    keyField="symbol"
                    testId="autopilot-decisions-table"
                  />
                </div>

                {/* Rejections table */}
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ui2-text-primary)', marginBottom: '6px' }}>Rejected</div>
                  <DataTable
                    data={currentRun.rejections as any}
                    columns={rejectionColumns}
                    keyField="symbol"
                    testId="autopilot-rejections-table"
                  />
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Ledger Tab ── */}
        {tab === 'ledger' && (
          <div data-testid="autopilot-ledger-panel">
            {!currentRun && (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--ui2-text-muted)', fontSize: '13px' }}>
                Run the pipeline first to generate a ledger.
              </div>
            )}
            {currentRun && (
              <>
                <div style={{ display: 'flex', gap: '4px', marginBottom: '12px' }}>
                  {['decisions', 'rejections', 'orders', 'postmortem'].map(lt => (
                    <button key={lt} data-testid={`autopilot-ledger-tab-${lt}`}
                      onClick={() => autopilot2Store.setLedgerTab(lt)}
                      style={{
                        padding: '6px 14px', fontSize: '11px', fontWeight: ledgerTab === lt ? 600 : 400,
                        background: ledgerTab === lt ? 'var(--ui2-accent)' : 'var(--ui2-bg-input)',
                        color: ledgerTab === lt ? 'white' : 'var(--ui2-text-secondary)',
                        border: '1px solid var(--ui2-border)', borderRadius: 'var(--ui2-radius-sm)', cursor: 'pointer',
                      }}
                    >{lt.charAt(0).toUpperCase() + lt.slice(1)}</button>
                  ))}
                </div>

                {ledgerTab === 'decisions' && (
                  <DataTable data={currentRun.decisions as any} columns={decisionColumns} keyField="symbol" testId="autopilot-ledger-decisions" />
                )}
                {ledgerTab === 'rejections' && (
                  <DataTable data={currentRun.rejections as any} columns={rejectionColumns} keyField="symbol" testId="autopilot-ledger-rejections" />
                )}
                {ledgerTab === 'orders' && (
                  <pre data-testid="autopilot-ledger-orders" style={{
                    padding: '12px', background: 'var(--ui2-bg-input)', borderRadius: 'var(--ui2-radius-md)',
                    fontSize: '11px', color: 'var(--ui2-text-secondary)', overflow: 'auto', maxHeight: '400px',
                  }}>{JSON.stringify(currentRun.orders, null, 2)}</pre>
                )}
                {ledgerTab === 'postmortem' && (
                  <pre data-testid="autopilot-ledger-postmortem" style={{
                    padding: '12px', background: 'var(--ui2-bg-input)', borderRadius: 'var(--ui2-radius-md)',
                    fontSize: '12px', color: 'var(--ui2-text-secondary)', overflow: 'auto', maxHeight: '500px',
                    whiteSpace: 'pre-wrap', lineHeight: 1.6,
                  }}>{currentRun.postmortem}</pre>
                )}
              </>
            )}
          </div>
        )}
      </div>
      <div data-testid="autopilot-ready" style={{ display: 'none' }} />
    </div>
  );
}
