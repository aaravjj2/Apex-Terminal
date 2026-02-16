/**
 * v1.59 — RiskUI2 Page (Enhanced)
 * Scenario builder, deterministic results, export bundle
 */

import { useState, useEffect } from 'react';
import { PageHeader, Tabs, DataTable, StatusBadge, type ColumnDef } from '../components';
import { scenarioStore, type ScenarioInput, type ScenarioResult, type Severity, type Horizon } from '../stores/scenarioStore';
import { OptionsView } from '../../features/layout/views/OptionsView';

export function RiskUI2() {
  const [activeTab, setActiveTab] = useState('scenarios');
  const [results, setResults] = useState<ScenarioResult[]>([]);
  const [severity, setSeverity] = useState<Severity>('moderate');
  const [equityShock, setEquityShock] = useState(-5);
  const [volShock, setVolShock] = useState(15);
  const [rateShock, setRateShock] = useState(25);
  const [horizon, setHorizon] = useState<Horizon>('5d');
  const [lastExportHash, setLastExportHash] = useState('');

  useEffect(() => {
    const unsub = scenarioStore.subscribe(() => {
      setResults(scenarioStore.getResults());
    });
    return unsub;
  }, []);

  const runScenario = () => {
    const inputs: ScenarioInput = { severity, equityShock: Math.abs(equityShock), volShock, rateShock, horizon };
    scenarioStore.runScenario(inputs);
  };

  const exportBundle = () => {
    const bundle = scenarioStore.exportBundle();
    setLastExportHash(bundle.hash);
    // Create downloadable JSON
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `risk-scenario-export-${bundle.hash}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const resultColumns: ColumnDef<Record<string, unknown>>[] = [
    { key: 'id', label: 'Scenario', width: '140px' },
    { key: 'inputs', label: 'Severity', width: '80px', render: (_v: unknown, row: Record<string, unknown>) => {
      const inp = row['inputs'] as ScenarioInput;
      const variant = inp.severity === 'extreme' ? 'danger' : inp.severity === 'severe' ? 'warning' : 'info';
      return <StatusBadge variant={variant} testId={`scenario-severity-${row['id']}`}>{inp.severity}</StatusBadge>;
    }},
    { key: 'portfolioImpact', label: 'P&L Impact', width: '120px', render: (v: unknown) => {
      const n = v as number;
      return <span style={{ color: 'var(--ui2-danger)' }}>${n.toLocaleString()}</span>;
    }},
    { key: 'var95', label: 'VaR 95%', width: '100px', render: (v: unknown) => `$${(v as number).toLocaleString()}` },
    { key: 'cvar95', label: 'CVaR 95%', width: '100px', render: (v: unknown) => `$${(v as number).toLocaleString()}` },
    { key: 'maxDrawdown', label: 'Max DD', width: '80px', render: (v: unknown) => `${v}%` },
    { key: 'recoveryDays', label: 'Recovery', width: '80px', render: (v: unknown) => `${v}d` },
    { key: 'hash', label: 'Hash', width: '120px' },
  ];

  return (
    <div data-testid="risk-ui2-page" style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px 0 16px' }}>
        <PageHeader
          title="Risk & Options"
          subtitle="Scenario builder, stress testing, and options analysis"
          icon="R"
          testId="risk-header"
        />
      </div>

      <div style={{ padding: '0 16px 8px 16px' }}>
        <Tabs
          items={[
            { id: 'scenarios', label: 'Scenario Builder' },
            { id: 'options', label: 'Options Chain' },
          ]}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          testId="risk-tabs"
        />
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '0 16px 16px 16px' }}>
        {activeTab === 'scenarios' && (
          <div data-testid="risk-scenario-builder">
            {/* Controls */}
            <div data-testid="risk-scenario-controls" style={{
              display: 'grid', gridTemplateColumns: 'repeat(5, 1fr) auto', gap: '12px',
              padding: '12px', background: 'var(--ui2-bg-panel)', border: '1px solid var(--ui2-border)',
              borderRadius: 'var(--ui2-radius-md)', marginBottom: '16px', alignItems: 'end',
            }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: 'var(--ui2-text-muted)', marginBottom: '4px' }}>Severity</label>
                <select data-testid="risk-severity" value={severity} onChange={e => setSeverity(e.target.value as Severity)}
                  style={{ width: '100%', padding: '6px', background: 'var(--ui2-bg-input)', border: '1px solid var(--ui2-border)', borderRadius: 'var(--ui2-radius-sm)', color: 'var(--ui2-text-primary)', fontSize: '12px' }}>
                  <option value="mild">Mild</option>
                  <option value="moderate">Moderate</option>
                  <option value="severe">Severe</option>
                  <option value="extreme">Extreme</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: 'var(--ui2-text-muted)', marginBottom: '4px' }}>Equity Shock %</label>
                <input data-testid="risk-equity-shock" type="number" value={equityShock} onChange={e => setEquityShock(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '6px', background: 'var(--ui2-bg-input)', border: '1px solid var(--ui2-border)', borderRadius: 'var(--ui2-radius-sm)', color: 'var(--ui2-text-primary)', fontSize: '12px' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: 'var(--ui2-text-muted)', marginBottom: '4px' }}>Vol Shock %</label>
                <input data-testid="risk-vol-shock" type="number" value={volShock} onChange={e => setVolShock(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '6px', background: 'var(--ui2-bg-input)', border: '1px solid var(--ui2-border)', borderRadius: 'var(--ui2-radius-sm)', color: 'var(--ui2-text-primary)', fontSize: '12px' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: 'var(--ui2-text-muted)', marginBottom: '4px' }}>Rate bps</label>
                <input data-testid="risk-rate-shock" type="number" value={rateShock} onChange={e => setRateShock(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '6px', background: 'var(--ui2-bg-input)', border: '1px solid var(--ui2-border)', borderRadius: 'var(--ui2-radius-sm)', color: 'var(--ui2-text-primary)', fontSize: '12px' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: 'var(--ui2-text-muted)', marginBottom: '4px' }}>Horizon</label>
                <select data-testid="risk-horizon" value={horizon} onChange={e => setHorizon(e.target.value as Horizon)}
                  style={{ width: '100%', padding: '6px', background: 'var(--ui2-bg-input)', border: '1px solid var(--ui2-border)', borderRadius: 'var(--ui2-radius-sm)', color: 'var(--ui2-text-primary)', fontSize: '12px' }}>
                  <option value="1d">1 Day</option>
                  <option value="5d">5 Days</option>
                  <option value="10d">10 Days</option>
                  <option value="30d">30 Days</option>
                </select>
              </div>
              <button data-testid="risk-run-scenario" onClick={runScenario}
                style={{ padding: '6px 16px', background: 'var(--ui2-brand-primary)', color: 'white', border: 'none', borderRadius: 'var(--ui2-radius-md)', fontWeight: 600, fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                Run Scenario
              </button>
            </div>

            {/* Results */}
            {results.length > 0 && (
              <>
                <DataTable
                  data={results as any}
                  columns={resultColumns}
                  keyField="id"
                  testId="risk-scenario-results"
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '12px' }}>
                  <button data-testid="risk-export-btn" onClick={exportBundle}
                    style={{ padding: '8px 16px', background: 'var(--ui2-brand-primary)', color: 'white', border: 'none', borderRadius: 'var(--ui2-radius-md)', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
                    Export Bundle
                  </button>
                  {lastExportHash && (
                    <span data-testid="risk-export-hash" style={{ fontSize: '12px', color: 'var(--ui2-text-muted)', fontFamily: 'monospace' }}>
                      Hash: {lastExportHash}
                    </span>
                  )}
                </div>
              </>
            )}
            {results.length === 0 && (
              <div data-testid="risk-empty-state" style={{ padding: '40px', textAlign: 'center', color: 'var(--ui2-text-muted)', fontSize: '13px' }}>
                Configure scenario parameters above and click "Run Scenario" to begin stress testing.
              </div>
            )}
          </div>
        )}

        {activeTab === 'options' && (
          <div data-testid="risk-options-embed">
            <OptionsView />
          </div>
        )}
      </div>
      <div data-testid="risk-ready" style={{ display: 'none' }} />
    </div>
  );
}
