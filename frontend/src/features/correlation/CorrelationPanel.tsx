// Bloomberg palette
const BG = '#0a0a0a';
const PANEL = '#111111';
const BORDER = '#1e1e1e';
const AMBER = '#f5a623';
const GREEN = '#26a69a';
const RED = '#ef5350';
const BLUE = '#42a5f5';
const SUBTLE = '#555';
const TEXT = '#d1d4dc';
const MONO = '"Roboto Mono","Courier New",monospace';

const API_BASE = '/api/v1';

const PERIODS = ['1M', '3M', '6M', '1Y', '2Y'];

interface CorrelationData {
  symbols: string[];
  data: number[][];
  period: string;
  computed_at: string;
}

const getCellBg = (val: number): string => {
  if (val === 1) return '#2a2a2a';
  if (val >= 0.8) return GREEN + '55';
  if (val >= 0.5) return GREEN + '30';
  if (val >= 0.2) return GREEN + '15';
  if (val >= -0.2) return 'transparent';
  if (val >= -0.5) return RED + '15';
  if (val >= -0.8) return RED + '30';
  return RED + '55';
};

const getCellColor = (val: number): string => {
  if (val === 1) return SUBTLE;
  if (val >= 0.5) return GREEN;
  if (val <= -0.5) return RED;
  return TEXT;
};

/**
 * Bloomberg CM â€” Correlation Matrix Panel
 */
import React, { useState, useEffect, useCallback } from 'react';

export function CorrelationPanel() {
  const [data, setData] = useState<CorrelationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('3M');
  const [hovSymbol, setHovSymbol] = useState<string | null>(null);
  const [selectedPair, setSelectedPair] = useState<{ r: number; c: number } | null>(null);
  const [showHeatmap, setShowHeatmap] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`${API_BASE}/correlation/matrix?period=${period}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [period]);

  useEffect(() => { load(); }, [load]);

  const selectedVal = selectedPair && data
    ? data.data[selectedPair.r]?.[selectedPair.c]
    : null;
  const selectedPairSymbols = selectedPair && data
    ? [data.symbols[selectedPair.r], data.symbols[selectedPair.c]]
    : null;

  // Compute avg correlation per symbol
  const avgCorr = data?.symbols.map((_, ri) => {
    const row = data.data[ri];
    const vals = row.filter((v, ci) => ci !== ri);
    return vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
  }) ?? [];

  return (
    <div
      data-testid="correlation-panel"
      style={{ display: 'flex', flexDirection: 'column', height: '100%', background: BG, fontFamily: MONO, color: TEXT }}
    >
      {/* Header */}
      <div style={{ padding: '10px 14px', borderBottom: `1px solid ${BORDER}`, background: PANEL, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 13, color: AMBER, fontWeight: 700, letterSpacing: 2 }}>CM</span>
        <span style={{ fontSize: 11, color: SUBTLE, letterSpacing: 1 }}>CORRELATION MATRIX</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
          {PERIODS.map(p => (
            <button key={p} onClick={() => setPeriod(p)} style={{
              background: period === p ? AMBER + '22' : 'transparent',
              border: `1px solid ${period === p ? AMBER : BORDER}`,
              borderRadius: 2, padding: '2px 8px', color: period === p ? AMBER : SUBTLE,
              fontFamily: MONO, fontSize: 10, cursor: 'pointer',
            }}>{p}</button>
          ))}
          <button onClick={() => setShowHeatmap(h => !h)} style={{
            background: showHeatmap ? BLUE + '22' : 'transparent',
            border: `1px solid ${showHeatmap ? BLUE : BORDER}`,
            borderRadius: 2, padding: '2px 8px', color: showHeatmap ? BLUE : SUBTLE,
            fontFamily: MONO, fontSize: 10, cursor: 'pointer', marginLeft: 6,
          }}>HEAT</button>
          <button onClick={load} style={{ background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: 2, padding: '2px 8px', color: SUBTLE, fontFamily: MONO, fontSize: 10, cursor: 'pointer' }}>â†º</button>
        </div>
      </div>

      {/* Meta info */}
      {data && (
        <div style={{ padding: '5px 14px', borderBottom: `1px solid ${BORDER}`, background: PANEL, display: 'flex', gap: 20 }}>
          <span style={{ fontSize: 10, color: SUBTLE }}>PERIOD: <span style={{ color: AMBER }}>{data.period || period}</span></span>
          <span style={{ fontSize: 10, color: SUBTLE }}>SYMBOLS: <span style={{ color: TEXT }}>{data.symbols.length}</span></span>
          <span style={{ fontSize: 10, color: SUBTLE }}>COMPUTED: <span style={{ color: TEXT }}>{data.computed_at ? new Date(data.computed_at).toLocaleDateString() : '--'}</span></span>
        </div>
      )}

      {loading && (
        <div data-testid="correlation-loading" style={{ padding: 24, textAlign: 'center', color: AMBER, letterSpacing: 2 }}>LOADING...</div>
      )}

      {!loading && !data && (
        <div data-testid="correlation-empty" style={{ padding: 32, textAlign: 'center', color: SUBTLE, fontSize: 13 }}>
          No correlation data available
        </div>
      )}

      {!loading && data && (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Matrix */}
          <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
            <table style={{ borderCollapse: 'collapse', fontSize: 11, fontFamily: MONO }}>
              <thead>
                <tr>
                  <th style={{ padding: '4px 8px', fontSize: 9, color: SUBTLE }}></th>
                  {data.symbols.map(s => (
                    <th
                      key={s}
                      data-testid={`corr-header-${s}`}
                      onMouseEnter={() => setHovSymbol(s)}
                      onMouseLeave={() => setHovSymbol(null)}
                      style={{
                        padding: '4px 6px', fontSize: 9, letterSpacing: 0.5,
                        color: hovSymbol === s ? AMBER : SUBTLE, cursor: 'pointer',
                        writingMode: 'vertical-rl', textOrientation: 'mixed',
                        minWidth: 36,
                      }}
                    >{s}</th>
                  ))}
                  <th style={{ padding: '4px 8px', fontSize: 9, color: SUBTLE }}>AVG</th>
                </tr>
              </thead>
              <tbody>
                {data.symbols.map((row, ri) => (
                  <tr key={row}>
                    <td
                      onMouseEnter={() => setHovSymbol(row)}
                      onMouseLeave={() => setHovSymbol(null)}
                      style={{ padding: '4px 8px', fontSize: 10, color: hovSymbol === row ? AMBER : SUBTLE, cursor: 'pointer', fontWeight: 600 }}
                    >{row}</td>
                    {data.data[ri].map((val, ci) => {
                      const isHov = hovSymbol === row || hovSymbol === data.symbols[ci];
                      const isSel = selectedPair?.r === ri && selectedPair?.c === ci;
                      return (
                        <td
                          key={`${ri}-${ci}`}
                          data-testid={`corr-cell-${ri}-${ci}`}
                          onClick={() => setSelectedPair(prev => (prev?.r === ri && prev?.c === ci) ? null : { r: ri, c: ci })}
                          style={{
                            padding: '4px 6px',
                            textAlign: 'center',
                            fontFamily: MONO,
                            fontSize: 10,
                            background: isSel ? AMBER + '33' : (showHeatmap ? getCellBg(val) : 'transparent'),
                            color: getCellColor(val),
                            fontWeight: val === 1 ? 400 : Math.abs(val) > 0.7 ? 700 : 400,
                            cursor: 'pointer',
                            border: isHov ? `1px solid ${AMBER}44` : `1px solid transparent`,
                            borderRadius: 2,
                            minWidth: 36,
                            transition: 'background 0.1s',
                          }}
                        >
                          {val.toFixed(2)}
                        </td>
                      );
                    })}
                    <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: MONO, fontSize: 10, color: (avgCorr[ri] ?? 0) >= 0 ? GREEN : RED, fontWeight: 600 }}>
                      {(avgCorr[ri] ?? 0).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Detail panel */}
          {selectedPair && selectedVal != null && selectedPairSymbols && (
            <div style={{ width: 200, borderLeft: `1px solid ${BORDER}`, background: PANEL, padding: 14, overflow: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: SUBTLE, letterSpacing: 1 }}>PAIR DETAIL</div>
                <button onClick={() => setSelectedPair(null)} style={{ background: 'transparent', border: 'none', color: SUBTLE, cursor: 'pointer', fontSize: 14 }}>âœ•</button>
              </div>
              <div style={{ fontSize: 14, color: AMBER, fontWeight: 700, fontFamily: MONO, marginBottom: 12, lineHeight: 1.4 }}>
                {selectedPairSymbols[0]} / {selectedPairSymbols[1]}
              </div>
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 10, color: SUBTLE, marginBottom: 4, letterSpacing: 1 }}>CORRELATION</div>
                <div style={{ fontSize: 22, fontFamily: MONO, color: getCellColor(selectedVal), fontWeight: 700 }}>
                  {selectedVal.toFixed(4)}
                </div>
              </div>
              <div style={{ height: 1, background: BORDER, margin: '10px 0' }} />
              {[
                { label: 'STRENGTH', val: Math.abs(selectedVal) >= 0.8 ? 'STRONG' : Math.abs(selectedVal) >= 0.5 ? 'MODERATE' : 'WEAK', col: Math.abs(selectedVal) >= 0.8 ? GREEN : Math.abs(selectedVal) >= 0.5 ? AMBER : SUBTLE },
                { label: 'DIRECTION', val: selectedVal > 0 ? 'POSITIVE' : selectedVal < 0 ? 'NEGATIVE' : 'NEUTRAL', col: selectedVal > 0 ? GREEN : selectedVal < 0 ? RED : SUBTLE },
                { label: 'PERIOD', val: data.period || period },
              ].map(({ label, val, col }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 10 }}>
                  <span style={{ color: SUBTLE, letterSpacing: 1 }}>{label}</span>
                  <span style={{ color: col || TEXT, fontWeight: 600 }}>{val}</span>
                </div>
              ))}
              <div style={{ marginTop: 12 }}>
                <div style={{ height: 6, background: BORDER, borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{
                    width: `${(Math.abs(selectedVal) * 100).toFixed(0)}%`,
                    height: '100%',
                    background: selectedVal > 0 ? GREEN : RED,
                    borderRadius: 3,
                  }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: SUBTLE, marginTop: 2 }}>
                  <span>-1.0</span><span>0</span><span>+1.0</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      <div data-testid="correlation-panel-ready" />
    </div>
  );
}

export default CorrelationPanel;
