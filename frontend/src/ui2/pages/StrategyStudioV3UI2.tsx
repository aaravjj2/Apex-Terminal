import React, { useState, useEffect } from 'react';

const API = '/api/v3/strategy-studio';

interface Strategy {
  id: string;
  name: string;
  strategy_type: string;
  symbols: string[];
  start_date: string;
  end_date: string;
  params: Record<string, any>;
  version: number;
  archived: boolean;
  created_at: string;
}

interface Template {
  id: string;
  name: string;
  strategy_type: string;
  description: string;
  symbols: string[];
  start_date: string;
  end_date: string;
  params: Record<string, any>;
}

interface LintError { field: string; rule: string; message: string }

const STRATEGY_TYPES = ['ma_cross', 'mean_reversion', 'buy_and_hold', 'rsi', 'breakout', 'momentum'];

export function StrategyStudioV3UI2() {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selected, setSelected] = useState<Strategy | null>(null);
  const [lintErrors, setLintErrors] = useState<LintError[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [searchQ, setSearchQ] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [stratType, setStratType] = useState('ma_cross');
  const [symbols, setSymbols] = useState('AAPL');
  const [startDate, setStartDate] = useState('2024-01-01');
  const [endDate, setEndDate] = useState('2024-12-31');

  const loadAll = async (q = '') => {
    const [s, t] = await Promise.all([
      fetch(`${API}/strategies${q ? `?q=${encodeURIComponent(q)}` : ''}`).then(r => r.json()),
      fetch(`${API}/templates`).then(r => r.json()),
    ]);
    setStrategies(s.strategies ?? []);
    setTemplates(t.templates ?? []);
  };

  useEffect(() => { loadAll(); }, []);

  const runLint = async (spec: Record<string, any>) => {
    const r = await fetch(`${API}/lint`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(spec),
    });
    const data = await r.json();
    setLintErrors(data.errors ?? []);
    return data.valid as boolean;
  };

  const formSpec = () => ({
    name, strategy_type: stratType,
    symbols: symbols.split(',').map(s => s.trim()).filter(Boolean),
    start_date: startDate, end_date: endDate,
    params: {},
  });

  const handleCreate = async () => {
    setError(null);
    const spec = formSpec();
    const valid = await runLint(spec);
    if (!valid) return;
    const r = await fetch(`${API}/strategies`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(spec),
    });
    if (!r.ok) {
      const err = await r.json();
      setError(JSON.stringify(err.detail));
      return;
    }
    await loadAll(searchQ);
  };

  const handleSelectStrategy = async (s: Strategy) => {
    setSelected(s);
    const h = await fetch(`${API}/strategies/${s.id}/history`).then(r => r.json());
    setHistory(h.history ?? []);
  };

  const handleUseTemplate = (t: Template) => {
    setName(t.name);
    setStratType(t.strategy_type);
    setSymbols(t.symbols.join(', '));
    setStartDate(t.start_date);
    setEndDate(t.end_date);
  };

  const handleDelete = async (id: string) => {
    await fetch(`${API}/strategies/${id}`, { method: 'DELETE' });
    if (selected?.id === id) setSelected(null);
    await loadAll(searchQ);
  };

  const handleSearch = async () => {
    await loadAll(searchQ);
  };

  return (
    <div data-testid="strategy-studio-page" style={{ padding: 20, fontFamily: 'monospace', display: 'flex', gap: 16, maxWidth: 1200 }}>

      {/* Left: templates + strategy list */}
      <div style={{ width: 280, flexShrink: 0 }}>
        <h3>Template Gallery</h3>
        <div data-testid="template-gallery">
          {templates.map(t => (
            <div key={t.id} data-testid={`template-row-${t.id}`}
              style={{ border: '1px solid #444', borderRadius: 4, padding: 10, marginBottom: 8, cursor: 'pointer', background: '#1a1a2e' }}
              onClick={() => handleUseTemplate(t)}>
              <strong style={{ fontSize: 13 }}>{t.name}</strong>
              <p style={{ margin: '3px 0 0', color: '#888', fontSize: 11 }}>{t.description}</p>
              <button data-testid={`use-template-btn-${t.id}`}
                style={{ marginTop: 6, padding: '3px 10px', fontSize: 11, background: '#2a4a8a', color: '#fff', border: 'none', borderRadius: 3, cursor: 'pointer' }}>
                Use Template
              </button>
            </div>
          ))}
        </div>

        <h3 style={{ marginTop: 16 }}>Strategies</h3>
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          <input
            value={searchQ} onChange={e => setSearchQ(e.target.value)}
            placeholder="Search…"
            data-testid="strategy-search-input"
            style={{ flex: 1, background: '#222', color: '#eee', border: '1px solid #555', padding: '4px 6px', borderRadius: 3 }}
          />
          <button onClick={handleSearch} data-testid="strategy-search-btn"
            style={{ padding: '4px 10px', background: '#444', color: '#eee', border: 'none', borderRadius: 3, cursor: 'pointer' }}>
            Go
          </button>
        </div>
        <div data-testid="strategies-list">
          {strategies.length === 0 && <p data-testid="strategies-empty">No strategies yet</p>}
          {strategies.map(s => (
            <div key={s.id} data-testid={`strategy-row-${s.id}`}
              onClick={() => handleSelectStrategy(s)}
              style={{
                border: `1px solid ${selected?.id === s.id ? '#4af' : '#444'}`,
                borderRadius: 4, padding: '8px 10px', marginBottom: 6,
                cursor: 'pointer', background: selected?.id === s.id ? '#1a2a3a' : '#111',
              }}>
              <strong style={{ fontSize: 12 }}>{s.name}</strong>
              <span style={{ marginLeft: 6, fontSize: 10, color: '#888' }}>v{s.version}</span>
              <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>{s.strategy_type}</div>
              <button data-testid={`delete-strategy-btn-${s.id}`}
                onClick={e => { e.stopPropagation(); handleDelete(s.id); }}
                style={{ marginTop: 4, padding: '2px 8px', fontSize: 10, background: '#4a1a1a', color: '#f88', border: '1px solid #6a2a2a', borderRadius: 3, cursor: 'pointer' }}>
                Delete
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Center: editor */}
      <div style={{ flex: 1 }}>
        <h3>Strategy Editor</h3>
        {error && <p style={{ color: '#f55' }} data-testid="editor-error">{error}</p>}
        <div data-testid="strategy-editor" style={{ border: '1px solid #444', borderRadius: 6, padding: 16 }}>
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: 'block', fontSize: 12, marginBottom: 3 }}>Name</label>
            <input value={name} onChange={e => setName(e.target.value)}
              data-testid="strategy-name-input" placeholder="My Strategy"
              style={{ width: '100%', background: '#222', color: '#eee', border: '1px solid #555', padding: '6px 8px', borderRadius: 3 }} />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: 'block', fontSize: 12, marginBottom: 3 }}>Strategy Type</label>
            <select value={stratType} onChange={e => setStratType(e.target.value)}
              data-testid="strategy-type-select"
              style={{ width: '100%', background: '#222', color: '#eee', border: '1px solid #555', padding: '6px 8px', borderRadius: 3 }}>
              {STRATEGY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: 'block', fontSize: 12, marginBottom: 3 }}>Symbols (comma-separated)</label>
            <input value={symbols} onChange={e => setSymbols(e.target.value)}
              data-testid="strategy-symbols-input" placeholder="AAPL, MSFT"
              style={{ width: '100%', background: '#222', color: '#eee', border: '1px solid #555', padding: '6px 8px', borderRadius: 3 }} />
          </div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 12, marginBottom: 3 }}>Start Date</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                data-testid="strategy-start-date"
                style={{ width: '100%', background: '#222', color: '#eee', border: '1px solid #555', padding: '5px 8px', borderRadius: 3 }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 12, marginBottom: 3 }}>End Date</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                data-testid="strategy-end-date"
                style={{ width: '100%', background: '#222', color: '#eee', border: '1px solid #555', padding: '5px 8px', borderRadius: 3 }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button data-testid="lint-strategy-btn"
              onClick={async () => { await runLint(formSpec()); }}
              style={{ padding: '8px 16px', background: '#444', color: '#eee', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
              Lint
            </button>
            <button data-testid="create-strategy-btn"
              onClick={handleCreate}
              style={{ padding: '8px 20px', background: '#1e6fd4', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
              Create Strategy
            </button>
          </div>
        </div>

        {/* Lint errors */}
        <div data-testid="lint-errors-panel" style={{ marginTop: 12 }}>
          {lintErrors.length > 0 ? (
            <div style={{ border: '1px solid #6a2a2a', borderRadius: 4, padding: 10, background: '#2a1a1a' }}>
              <strong style={{ color: '#f88' }}>Lint Errors ({lintErrors.length})</strong>
              <ul style={{ margin: '6px 0 0', padding: '0 0 0 16px' }}>
                {lintErrors.map((e, i) => (
                  <li key={i} data-testid={`lint-error-${i}`} style={{ color: '#fa8', fontSize: 12 }}>
                    <code>[{e.field}][{e.rule}]</code> {e.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p data-testid="lint-ok-badge" style={{ color: '#4f4', fontSize: 12 }}>✓ No lint errors</p>
          )}
        </div>
      </div>

      {/* Right: version history */}
      {selected && (
        <div style={{ width: 260, flexShrink: 0 }}>
          <h3>Version History</h3>
          <p style={{ fontSize: 12, color: '#aaa' }}>{selected.name} (v{selected.version})</p>
          <div data-testid="version-history-panel">
            {history.length === 0 ? (
              <p style={{ fontSize: 12, color: '#666' }}>No history records</p>
            ) : (
              history.map(h => (
                <div key={h.id} data-testid={`history-row-v${h.version}`}
                  style={{ border: '1px solid #333', borderRadius: 3, padding: '6px 8px', marginBottom: 6, fontSize: 11 }}>
                  <strong>v{h.version}</strong> — {h.name}
                  <div style={{ color: '#888', marginTop: 2 }}>{h.changed_at?.slice(0, 19).replace('T', ' ')}</div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
