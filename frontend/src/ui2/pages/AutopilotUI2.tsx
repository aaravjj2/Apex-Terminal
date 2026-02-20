/**
 * v1.69 — AutopilotUI2 Page (Enhanced with 2.0 Pipeline)
 * Kill switch, rule toggles, activity feed + Pipeline 2.0 stages/ledger
 */

import { useState, useEffect, useSyncExternalStore } from 'react';
import { PageHeader, Pill, StatusBadge, DataTable, type ColumnDef } from '../components';
import { autopilotStore } from '../stores/autopilotStore';
import { autopilot2Store, type AP2Stage } from '../stores/autopilot2Store';
import { autopilotDepthStore, type RiskControls, type ExecutionParams } from '../stores/autopilotDepthStore';

type TabKey = 'controls' | 'pipeline' | 'ledger' | 'risk' | 'evaluation';

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

  // Depth stores
  const riskControls = useSyncExternalStore(autopilotDepthStore.subscribe, autopilotDepthStore.getRiskControls);
  const execParams = useSyncExternalStore(autopilotDepthStore.subscribe, autopilotDepthStore.getExecutionParams);
  const [evalRunId, setEvalRunId] = useState<string | null>(null);
  const evaluation = evalRunId ? autopilotDepthStore.getEvaluation(evalRunId) : null;

  const handleRunEvaluation = () => {
    const rid = currentRun?.run_id || 'demo-run-1';
    autopilotDepthStore.runEvaluation(rid);
    setEvalRunId(rid);
    setTab('evaluation');
  };

  const handleRiskChange = (field: keyof RiskControls, value: number) => {
    autopilotDepthStore.updateRiskControls({ [field]: value });
  };

  const handleExecChange = (field: keyof ExecutionParams, value: number) => {
    autopilotDepthStore.updateExecutionParams({ [field]: value });
  };

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'controls', label: 'Controls' },
    { key: 'pipeline', label: 'Pipeline 2.0' },
    { key: 'ledger', label: 'Decision Ledger' },
    { key: 'risk', label: 'Risk Controls' },
    { key: 'evaluation', label: 'Evaluation' },
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
        {/* Run Pipeline button updates to also run evaluation */}
        <div style={{ flex: 1 }} />
        <button data-testid="autopilot-run-pipeline-btn" onClick={handleRunPipeline}
          style={{
            padding: '6px 16px', fontSize: '12px', fontWeight: 600,
            background: 'var(--ui2-accent)', color: 'white', border: 'none',
            borderRadius: 'var(--ui2-radius-md)', cursor: 'pointer', marginBottom: '4px',
          }}
        >Run Pipeline</button>
        <button data-testid="autopilot-run-eval-btn" onClick={handleRunEvaluation}
          style={{
            padding: '6px 16px', fontSize: '12px', fontWeight: 600, marginLeft: '8px',
            background: 'var(--ui2-warning, #f59e0b)', color: 'white', border: 'none',
            borderRadius: 'var(--ui2-radius-md)', cursor: 'pointer', marginBottom: '4px',
          }}
        >Run Evaluation</button>
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

        {/* ── Risk Controls Tab ── */}
        {tab === 'risk' && (
          <div data-testid="autopilot-risk-panel">
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ui2-text-primary)', marginBottom: '12px' }}>Portfolio Risk Limits</div>
            <div data-testid="autopilot-risk-controls" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
              {([
                { field: 'max_position_notional' as const, label: 'Max Position Notional ($)', step: 1000 },
                { field: 'max_gross_exposure' as const, label: 'Max Gross Exposure ($)', step: 5000 },
                { field: 'max_daily_loss' as const, label: 'Max Daily Loss ($)', step: 500 },
                { field: 'max_trades_per_run' as const, label: 'Max Trades Per Run', step: 1 },
              ]).map(({ field, label, step }) => (
                <div key={field} data-testid={`autopilot-risk-${field}`} style={{
                  padding: '12px', background: 'var(--ui2-bg-panel)', border: '1px solid var(--ui2-border)',
                  borderRadius: 'var(--ui2-radius-md)',
                }}>
                  <label style={{ fontSize: '11px', color: 'var(--ui2-text-muted)', display: 'block', marginBottom: '4px' }}>{label}</label>
                  <input
                    data-testid={`autopilot-risk-input-${field}`}
                    type="number"
                    value={riskControls[field]}
                    onChange={(e) => handleRiskChange(field, Number(e.target.value))}
                    step={step}
                    style={{
                      width: '100%', padding: '6px 8px', fontSize: '13px', fontWeight: 600,
                      background: 'var(--ui2-bg-input)', border: '1px solid var(--ui2-border)',
                      borderRadius: 'var(--ui2-radius-sm)', color: 'var(--ui2-text-primary)',
                    }}
                  />
                </div>
              ))}
            </div>

            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ui2-text-primary)', marginBottom: '12px' }}>Execution Model</div>
            <div data-testid="autopilot-exec-params" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {([
                { field: 'fee_per_order' as const, label: 'Fee Per Order ($)', step: 0.25 },
                { field: 'bps_fee' as const, label: 'BPS Fee', step: 0.5 },
                { field: 'slippage_base_bps' as const, label: 'Slippage Base (bps)', step: 0.5 },
                { field: 'slippage_vol_multiplier' as const, label: 'Slippage Vol Multiplier', step: 0.1 },
              ]).map(({ field, label, step }) => (
                <div key={field} data-testid={`autopilot-exec-${field}`} style={{
                  padding: '12px', background: 'var(--ui2-bg-panel)', border: '1px solid var(--ui2-border)',
                  borderRadius: 'var(--ui2-radius-md)',
                }}>
                  <label style={{ fontSize: '11px', color: 'var(--ui2-text-muted)', display: 'block', marginBottom: '4px' }}>{label}</label>
                  <input
                    data-testid={`autopilot-exec-input-${field}`}
                    type="number"
                    value={execParams[field]}
                    onChange={(e) => handleExecChange(field, Number(e.target.value))}
                    step={step}
                    style={{
                      width: '100%', padding: '6px 8px', fontSize: '13px', fontWeight: 600,
                      background: 'var(--ui2-bg-input)', border: '1px solid var(--ui2-border)',
                      borderRadius: 'var(--ui2-radius-sm)', color: 'var(--ui2-text-primary)',
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Evaluation Tab ── */}
        {tab === 'evaluation' && (
          <div data-testid="autopilot-eval-panel">
            {!evaluation && (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--ui2-text-muted)', fontSize: '13px' }}>
                Click <strong>Run Evaluation</strong> to generate attribution analysis.
              </div>
            )}
            {evaluation && (
              <>
                {/* Summary */}
                <div data-testid="autopilot-eval-summary" style={{
                  display: 'flex', gap: '16px', padding: '12px 14px', marginBottom: '16px',
                  background: 'var(--ui2-bg-panel)', border: '1px solid var(--ui2-border)',
                  borderRadius: 'var(--ui2-radius-md)', flexWrap: 'wrap',
                }}>
                  <div><span style={{ fontSize: '11px', color: 'var(--ui2-text-muted)' }}>Expected PnL</span><br/>
                    <span data-testid="autopilot-eval-expected" style={{ fontSize: '14px', fontWeight: 700, color: 'var(--ui2-text-primary)' }}>${evaluation.expected_pnl.toFixed(2)}</span></div>
                  <div><span style={{ fontSize: '11px', color: 'var(--ui2-text-muted)' }}>Realized PnL</span><br/>
                    <span data-testid="autopilot-eval-realized" style={{ fontSize: '14px', fontWeight: 700, color: evaluation.realized_pnl >= 0 ? 'var(--ui2-success)' : 'var(--ui2-danger)' }}>${evaluation.realized_pnl.toFixed(2)}</span></div>
                  <div><span style={{ fontSize: '11px', color: 'var(--ui2-text-muted)' }}>Total Fees</span><br/>
                    <span data-testid="autopilot-eval-fees" style={{ fontSize: '14px', fontWeight: 700, color: 'var(--ui2-danger)' }}>-${evaluation.total_fees.toFixed(2)}</span></div>
                  <div><span style={{ fontSize: '11px', color: 'var(--ui2-text-muted)' }}>Slippage</span><br/>
                    <span data-testid="autopilot-eval-slippage" style={{ fontSize: '14px', fontWeight: 700, color: 'var(--ui2-danger)' }}>-${evaluation.total_slippage.toFixed(2)}</span></div>
                  <div style={{ marginLeft: 'auto' }}>
                    <span style={{ fontSize: '11px', color: 'var(--ui2-text-muted)' }}>Eval Hash</span><br/>
                    <span data-testid="autopilot-eval-hash" style={{ fontSize: '12px', fontFamily: 'monospace', color: 'var(--ui2-text-secondary)' }}>{evaluation.hash}</span></div>
                </div>

                {/* Attribution Table */}
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ui2-text-primary)', marginBottom: '8px' }}>PnL Attribution</div>
                  <table data-testid="autopilot-eval-attribution" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead><tr style={{ borderBottom: '1px solid var(--ui2-border)' }}>
                      <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--ui2-text-muted)' }}>Category</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--ui2-text-muted)' }}>Expected</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--ui2-text-muted)' }}>Realized</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--ui2-text-muted)' }}>Delta</th>
                    </tr></thead>
                    <tbody>
                      {evaluation.attribution.map((a, i) => (
                        <tr key={a.category} data-testid={`autopilot-eval-attr-row-${i}`} style={{ borderBottom: '1px solid var(--ui2-border)' }}>
                          <td style={{ padding: '6px 8px', color: 'var(--ui2-text-primary)', fontWeight: a.category === 'Net PnL' ? 700 : 400 }}>{a.category}</td>
                          <td style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--ui2-text-secondary)' }}>${a.expected.toFixed(2)}</td>
                          <td style={{ textAlign: 'right', padding: '6px 8px', color: a.realized >= 0 ? 'var(--ui2-success)' : 'var(--ui2-danger)' }}>${a.realized.toFixed(2)}</td>
                          <td style={{ textAlign: 'right', padding: '6px 8px', color: a.delta >= 0 ? 'var(--ui2-success)' : 'var(--ui2-danger)' }}>{a.delta >= 0 ? '+' : ''}{a.delta.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Risk Budget */}
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ui2-text-primary)', marginBottom: '8px' }}>Risk Budget Remaining</div>
                  <div data-testid="autopilot-eval-budget" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    {([
                      { label: 'Notional', used: evaluation.risk_budget_remaining.notional_used, rem: evaluation.risk_budget_remaining.notional_remaining },
                      { label: 'Exposure', used: evaluation.risk_budget_remaining.exposure_used, rem: evaluation.risk_budget_remaining.exposure_remaining },
                      { label: 'Daily Loss', used: evaluation.risk_budget_remaining.daily_loss_used, rem: evaluation.risk_budget_remaining.daily_loss_remaining },
                      { label: 'Trades', used: evaluation.risk_budget_remaining.trades_used, rem: evaluation.risk_budget_remaining.trades_remaining },
                    ]).map(({ label, used, rem }) => (
                      <div key={label} data-testid={`autopilot-eval-budget-${label.toLowerCase().replace(/\s/g, '-')}`} style={{
                        padding: '8px 12px', background: 'var(--ui2-bg-panel)', border: '1px solid var(--ui2-border)',
                        borderRadius: 'var(--ui2-radius-sm)',
                      }}>
                        <div style={{ fontSize: '11px', color: 'var(--ui2-text-muted)' }}>{label}</div>
                        <div style={{ fontSize: '12px' }}>
                          <span style={{ color: 'var(--ui2-text-primary)', fontWeight: 600 }}>{typeof used === 'number' && used > 100 ? `$${used.toLocaleString()}` : used}</span>
                          <span style={{ color: 'var(--ui2-text-muted)' }}> used · </span>
                          <span style={{ color: rem > 0 ? 'var(--ui2-success)' : 'var(--ui2-danger)', fontWeight: 600 }}>{typeof rem === 'number' && Math.abs(rem) > 100 ? `$${rem.toLocaleString()}` : rem}</span>
                          <span style={{ color: 'var(--ui2-text-muted)' }}> remaining</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Breaches */}
                {evaluation.breaches.length > 0 && (
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ui2-danger)', marginBottom: '8px' }}>Risk Breaches ({evaluation.breaches.length})</div>
                    <div data-testid="autopilot-eval-breaches" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {evaluation.breaches.map((b, i) => (
                        <div key={i} data-testid={`autopilot-eval-breach-${i}`} style={{
                          padding: '8px 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                          borderRadius: 'var(--ui2-radius-sm)',
                        }}>
                          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ui2-danger)' }}>{b.rejected_symbol} — {b.rule}</div>
                          <div style={{ fontSize: '11px', color: 'var(--ui2-text-secondary)', marginTop: '2px' }}>{b.reason}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Fills Table */}
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ui2-text-primary)', marginBottom: '8px' }}>Fill Records ({evaluation.fills.length})</div>
                  <table data-testid="autopilot-eval-fills" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead><tr style={{ borderBottom: '1px solid var(--ui2-border)' }}>
                      <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--ui2-text-muted)' }}>Symbol</th>
                      <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--ui2-text-muted)' }}>Side</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--ui2-text-muted)' }}>Qty</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--ui2-text-muted)' }}>Expected</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--ui2-text-muted)' }}>Fill</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--ui2-text-muted)' }}>Slip (bps)</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--ui2-text-muted)' }}>Fee</th>
                    </tr></thead>
                    <tbody>
                      {evaluation.fills.map((f, i) => (
                        <tr key={f.symbol} data-testid={`autopilot-eval-fill-${i}`} style={{ borderBottom: '1px solid var(--ui2-border)' }}>
                          <td style={{ padding: '6px 8px', color: 'var(--ui2-text-primary)', fontWeight: 600 }}>{f.symbol}</td>
                          <td style={{ padding: '6px 8px' }}><StatusBadge variant={f.side === 'buy' ? 'success' : 'danger'} testId="">{f.side.toUpperCase()}</StatusBadge></td>
                          <td style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--ui2-text-secondary)' }}>{f.qty}</td>
                          <td style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--ui2-text-secondary)' }}>${f.expected_price.toFixed(2)}</td>
                          <td style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--ui2-text-primary)' }}>${f.fill_price.toFixed(2)}</td>
                          <td style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--ui2-danger)' }}>{f.slippage_bps.toFixed(2)}</td>
                          <td style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--ui2-danger)' }}>${f.fee.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}
      </div>
      <div data-testid="autopilot-ready" style={{ display: 'none' }} />
    </div>
  );
}
