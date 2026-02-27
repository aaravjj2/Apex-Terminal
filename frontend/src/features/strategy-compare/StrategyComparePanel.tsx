// Bloomberg palette
const BG = '#0a0a0a';
const PANEL = '#111111';
const BORDER = '#1e1e1e';
const AMBER = '#f5a623';
const GREEN = '#26a69a';
const RED = '#ef5350';
const BLUE = '#42a5f5';
const PURPLE = '#ab47bc';
const ORANGE = '#ff8a65';
const SUBTLE = '#555';
const TEXT = '#d1d4dc';
const MONO = '"Roboto Mono","Courier New",monospace';

const API_BASE = '/api/v1';

const MOCK_COMPARE: StrategyMetrics[] = [
  { id: '1', name: 'SMA Crossover', sharpe: 1.42, sortino: 1.87, max_drawdown: -0.034, win_rate: 0.58, avg_return: 0.021, total_trades: 47, profit_factor: 1.68, calmar: 2.31 },
  { id: '2', name: 'RSI Reversal', sharpe: 0.87, sortino: 1.12, max_drawdown: -0.089, win_rate: 0.43, avg_return: -0.008, total_trades: 21, profit_factor: 0.92, calmar: 0.78 },
  { id: '3', name: 'Breakout Alpha', sharpe: 2.01, sortino: 2.54, max_drawdown: -0.021, win_rate: 0.65, avg_return: 0.034, total_trades: 89, profit_factor: 2.14, calmar: 3.87 },
  { id: '4', name: 'MACD Trend', sharpe: 1.15, sortino: 1.43, max_drawdown: -0.056, win_rate: 0.51, avg_return: 0.011, total_trades: 63, profit_factor: 1.21, calmar: 1.44 },
  { id: '5', name: 'Vol Mean Revert', sharpe: 0.62, sortino: 0.88, max_drawdown: -0.112, win_rate: 0.39, avg_return: -0.014, total_trades: 34, profit_factor: 0.78, calmar: 0.41 },
];

const COLS: { key: string; label: string; fmt: (v: number) => string; goodHigh?: boolean }[] = [
  { key: 'sharpe', label: 'SHARPE', fmt: v => v.toFixed(2), goodHigh: true },
  { key: 'sortino', label: 'SORTINO', fmt: v => v.toFixed(2), goodHigh: true },
  { key: 'calmar', label: 'CALMAR', fmt: v => v.toFixed(2), goodHigh: true },
  { key: 'profit_factor', label: 'PROF.F', fmt: v => v.toFixed(2), goodHigh: true },
  { key: 'win_rate', label: 'WIN%', fmt: v => `${(v * 100).toFixed(1)}%`, goodHigh: true },
  { key: 'avg_return', label: 'AVG RET', fmt: v => `${(v * 100).toFixed(2)}%`, goodHigh: true },
  { key: 'max_drawdown', label: 'MAX DD', fmt: v => `${(v * 100).toFixed(1)}%`, goodHigh: false },
  { key: 'total_trades', label: 'TRADES', fmt: v => String(Math.round(v)) },
];

function getMetricColor(key: string, val: number, goodHigh?: boolean): string {
  if (key === 'max_drawdown') return val > -0.05 ? GREEN : val > -0.10 ? AMBER : RED;
  if (key === 'avg_return') return val >= 0 ? GREEN : RED;
  if (key === 'profit_factor') return val >= 1.5 ? GREEN : val >= 1.0 ? AMBER : RED;
  if (key === 'win_rate') return val >= 0.55 ? GREEN : val >= 0.45 ? AMBER : RED;
  if (goodHigh) return val >= 1.5 ? GREEN : val >= 0.8 ? AMBER : RED;
  return TEXT;
}

import React, { useState, useEffect } from 'react';

interface StrategyMetrics {
  id: string;
  name: string;
  sharpe: number;
  sortino: number;
  max_drawdown: number;
  win_rate: number;
  avg_return: number;
  total_trades: number;
  profit_factor: number;
  calmar: number;
}

export function StrategyComparePanel() {
  const [strategies, setStrategies] = useState<StrategyMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<string>('sharpe');
  const [sortAsc, setSortAsc] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hovRow, setHovRow] = useState<string | null>(null);
  const [showChart, setShowChart] = useState(false);
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set(['1', '3']));

  useEffect(() => {
    setLoading(true);
    fetch(`${API_BASE}/strategy-compare`)
      .then(r => r.json())
      .then(data => setStrategies(Array.isArray(data) ? data : []))
      .catch(() => setStrategies(MOCK_COMPARE))
      .finally(() => setLoading(false));
  }, []);

  const handleSort = (key: string) => {
    if (sortKey === key) setSortAsc(a => !a);
    else { setSortKey(key); setSortAsc(false); }
  };

  const sorted = [...strategies].sort((a, b) => {
    const av = (a as Record<string, unknown>)[sortKey] as number ?? 0;
    const bv = (b as Record<string, unknown>)[sortKey] as number ?? 0;
    const res = av - bv;
    return sortAsc ? res : -res;
  });

  const selected = strategies.find(s => s.id === selectedId);

  const bestVals = COLS.reduce((acc, c) => {
    const vals = strategies.map(s => (s as Record<string, unknown>)[c.key] as number ?? 0);
    acc[c.key] = c.goodHigh === false ? Math.max(...vals) : Math.max(...vals);
    return acc;
  }, {} as Record<string, number>);

  const togglePin = (id: string) => setPinnedIds(prev => {
    const n = new Set(prev);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  return (
    <div data-testid="strategy-compare-panel" style={{ height: '100%', display: 'flex', flexDirection: 'column', background: BG, fontFamily: MONO, color: TEXT }}>
      {/* Header */}
      <div style={{ padding: '10px 14px', borderBottom: `1px solid ${BORDER}`, background: PANEL, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 13, color: AMBER, fontWeight: 700, letterSpacing: 2 }}>CM</span>
        <span style={{ fontSize: 11, color: SUBTLE, letterSpacing: 1 }}>COMPARE MATRIX</span>
        <span style={{ fontSize: 10, color: BLUE, background: BLUE + '22', border: `1px solid ${BLUE}44`, borderRadius: 10, padding: '1px 6px' }}>{strategies.length} STRATEGIES</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button onClick={() => setShowChart(s => !s)} style={{ background: showChart ? PURPLE + '22' : 'transparent', border: `1px solid ${showChart ? PURPLE : BORDER}`, borderRadius: 2, padding: '2px 8px', color: showChart ? PURPLE : SUBTLE, fontFamily: MONO, fontSize: 10, cursor: 'pointer' }}>CHART</button>
        </div>
      </div>

      {/* Summary bar */}
      {!loading && strategies.length > 0 && (
        <div style={{ padding: '5px 14px', borderBottom: `1px solid ${BORDER}`, background: PANEL, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {[
            { label: 'BEST SHARPE', val: Math.max(...strategies.map(s => s.sharpe)).toFixed(2), col: GREEN },
            { label: 'BEST WIN%', val: `${(Math.max(...strategies.map(s => s.win_rate)) * 100).toFixed(1)}%`, col: GREEN },
            { label: 'LOWEST DD', val: `${(Math.max(...strategies.map(s => s.max_drawdown)) * 100).toFixed(1)}%`, col: AMBER },
            { label: 'AVG SHARPE', val: (strategies.reduce((a, s) => a + s.sharpe, 0) / strategies.length).toFixed(2), col: BLUE },
          ].map(({ label, val, col }) => (
            <div key={label}>
              <div style={{ fontSize: 9, color: SUBTLE, letterSpacing: 1 }}>{label}</div>
              <div style={{ fontSize: 12, color: col, fontFamily: MONO }}>{val}</div>
            </div>
          ))}
        </div>
      )}

      {/* Main body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ flex: selected ? '0 0 60%' : 1, overflow: 'auto' }}>
          {loading && (
            <div data-testid="strategy-compare-loading" style={{ padding: 32, textAlign: 'center', color: AMBER, letterSpacing: 2 }}>LOADING...</div>
          )}
          {!loading && strategies.length === 0 && (
            <div data-testid="strategy-compare-empty" style={{ padding: 48, textAlign: 'center', color: SUBTLE }}>No strategies to compare</div>
          )}
          {!loading && strategies.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${BORDER}`, position: 'sticky', top: 0, background: PANEL, zIndex: 1 }}>
                  <th style={{ textAlign: 'left', padding: '8px 12px', color: SUBTLE, fontSize: 10, letterSpacing: 1, position: 'sticky', left: 0, background: PANEL }}></th>
                  <th style={{ textAlign: 'left', padding: '8px 12px', color: SUBTLE, fontSize: 10, letterSpacing: 1, position: 'sticky', left: 20, background: PANEL }}>STRATEGY</th>
                  {COLS.map(c => (
                    <th
                      key={c.key}
                      data-testid={`compare-col-${c.key}`}
                      onClick={() => handleSort(c.key)}
                      style={{
                        textAlign: 'right', padding: '8px 12px', color: sortKey === c.key ? AMBER : SUBTLE,
                        fontSize: 10, letterSpacing: 1, cursor: 'pointer',
                        userSelect: 'none', whiteSpace: 'nowrap',
                      }}
                    >
                      {c.label} {sortKey === c.key ? (sortAsc ? 'â–²' : 'â–¼') : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((s, idx) => {
                  const isSelected = selectedId === s.id;
                  const isPinned = pinnedIds.has(s.id);
                  return (
                    <tr
                      key={s.id}
                      data-testid={`compare-row-${idx}`}
                      onClick={() => setSelectedId(prev => prev === s.id ? null : s.id)}
                      onMouseEnter={() => setHovRow(s.id)}
                      onMouseLeave={() => setHovRow(null)}
                      style={{
                        borderBottom: `1px solid ${BORDER}`,
                        background: isSelected ? '#1a1a2e' : hovRow === s.id ? '#141414' : 'transparent',
                        cursor: 'pointer',
                        borderLeft: `3px solid ${isPinned ? AMBER : isSelected ? BLUE : 'transparent'}`,
                      }}
                    >
                      <td style={{ padding: '8px 4px 8px 8px', textAlign: 'center' }}>
                        <button onClick={e => { e.stopPropagation(); togglePin(s.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: isPinned ? AMBER : SUBTLE, fontSize: 12 }}>
                          {isPinned ? 'â˜…' : 'â˜†'}
                        </button>
                      </td>
                      <td style={{ padding: '8px 12px', color: TEXT, fontWeight: 600, position: 'sticky', left: 20, background: isSelected ? '#1a1a2e' : hovRow === s.id ? '#141414' : BG, whiteSpace: 'nowrap' }}>
                        {s.name}
                      </td>
                      {COLS.map(c => {
                        const v = (s as Record<string, unknown>)[c.key] as number ?? 0;
                        const col = getMetricColor(c.key, v, c.goodHigh);
                        const isBest = bestVals[c.key] === v;
                        return (
                          <td key={c.key} style={{ padding: '8px 12px', textAlign: 'right', fontFamily: MONO, color: col, fontWeight: isBest ? 700 : 400 }}>
                            {isBest && <span style={{ color: AMBER, marginRight: 4 }}>â—</span>}
                            {c.fmt(v)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Detail panel */}
        {selected && (
          <div style={{ flex: '0 0 40%', borderLeft: `1px solid ${BORDER}`, background: PANEL, padding: 14, overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 10, color: SUBTLE, letterSpacing: 1 }}>STRATEGY STATS</div>
                <div style={{ fontSize: 14, color: AMBER, fontWeight: 700, marginTop: 2 }}>{selected.name}</div>
              </div>
              <button onClick={() => setSelectedId(null)} style={{ background: 'none', border: 'none', color: SUBTLE, cursor: 'pointer', fontSize: 16 }}>âœ•</button>
            </div>
            {COLS.map(c => {
              const v = (selected as Record<string, unknown>)[c.key] as number ?? 0;
              const col = getMetricColor(c.key, v, c.goodHigh);
              const barPct = Math.abs(v) > 1 ? 100 : Math.abs(v) * 100;
              return (
                <div key={c.key} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontSize: 10, color: SUBTLE, letterSpacing: 1 }}>{c.label}</span>
                    <span style={{ fontSize: 11, color: col, fontFamily: MONO, fontWeight: 700 }}>{c.fmt(v)}</span>
                  </div>
                  {c.key !== 'total_trades' && (
                    <div style={{ background: BORDER, height: 3, borderRadius: 2 }}>
                      <div style={{ width: `${Math.min(barPct, 100)}%`, height: '100%', background: col, borderRadius: 2, transition: 'width 0.3s' }} />
                    </div>
                  )}
                </div>
              );
            })}
            <div style={{ marginTop: 16, padding: '10px 12px', background: BG, border: `1px solid ${BORDER}`, borderRadius: 3 }}>
              <div style={{ fontSize: 10, color: SUBTLE, letterSpacing: 1, marginBottom: 6 }}>RANK</div>
              {COLS.filter(c => c.key !== 'total_trades').map(c => {
                const vals = sorted.map(s => (s as Record<string, unknown>)[c.key] as number ?? 0);
                const rank = sorted.findIndex(s => s.id === selected.id) + 1;
                return (
                  <div key={c.key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 4 }}>
                    <span style={{ color: SUBTLE }}>{c.label}</span>
                    <span style={{ color: rank <= 2 ? GREEN : AMBER, fontFamily: MONO }}>#{rank} / {vals.length}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div data-testid="strategy-compare-panel-ready" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden' }}>ready</div>
    </div>
  );
}
