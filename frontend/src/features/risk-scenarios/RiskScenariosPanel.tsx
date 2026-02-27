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

interface Scenario {
  id: string;
  name: string;
  description: string;
  shock: Record<string, number>;
  portfolio_impact: number;
  max_drawdown: number;
  recovery_days: number;
  status: string;
  probability?: number;
  var_95?: number;
  var_99?: number;
  category?: string;
}

const MOCK_SCENARIOS: Scenario[] = [
  { id: '1', name: '2008 Credit Crisis', category: 'HISTORICAL', description: 'Replicate 2008 financial crisis conditions with credit freeze and equity collapse.', shock: { equity: -0.42, credit: -0.25, vol: +1.8, rates: +0.02 }, portfolio_impact: -48230, max_drawdown: -0.42, recovery_days: 612, status: 'active', probability: 0.02, var_95: -28400, var_99: -42100 },
  { id: '2', name: 'Flash Crash +20%', category: 'STRESS', description: 'Sudden VIX spike to 80+, S&P drops 20% intraday then recovers 60%.', shock: { equity: -0.20, vol: +3.0, liquidity: -0.70 }, portfolio_impact: -22100, max_drawdown: -0.20, recovery_days: 7, status: 'active', probability: 0.04, var_95: -18200, var_99: -21800 },
  { id: '3', name: 'Rate Hike Shock', category: 'MACRO', description: 'Fed surprise 200bps rate hike, bond/equity dual bear market.', shock: { rates: +0.02, bonds: -0.15, equity: -0.18 }, portfolio_impact: -16450, max_drawdown: -0.18, recovery_days: 180, status: 'active', probability: 0.08, var_95: -10100, var_99: -15900 },
  { id: '4', name: 'Tech Sector Crash', category: 'SECTOR', description: 'Nasdaq -40% over 6 months, similar to 2000 dot-com.', shock: { tech: -0.40, nasdaq: -0.35, growth: -0.30 }, portfolio_impact: -31200, max_drawdown: -0.40, recovery_days: 840, status: 'active', probability: 0.05, var_95: -19800, var_99: -30900 },
  { id: '5', name: 'FX Dollar Collapse', category: 'CURRENCY', description: 'USD drops 15% against majors, commodity surge.', shock: { usd: -0.15, commodities: +0.25, intl_equity: +0.08 }, portfolio_impact: 4200, max_drawdown: -0.03, recovery_days: 90, status: 'active', probability: 0.06, var_95: -2100, var_99: -4200 },
];

const CATEGORY_COLORS: Record<string, string> = {
  HISTORICAL: RED, STRESS: ORANGE, MACRO: BLUE, SECTOR: PURPLE, CURRENCY: GREEN, CUSTOM: AMBER,
};

import React, { useState, useEffect } from 'react';

export function RiskScenariosPanel() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [selected, setSelected] = useState<Scenario | null>(null);
  const [catFilter, setCatFilter] = useState('all');
  const [sortKey, setSortKey] = useState<'impact' | 'drawdown' | 'recovery' | 'prob'>('impact');
  const [showCustom, setShowCustom] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/risk-scenarios`)
      .then(r => r.json())
      .then(data => setScenarios(Array.isArray(data) ? data : []))
      .catch(() => setScenarios(MOCK_SCENARIOS))
      .finally(() => setLoading(false));
  }, []);

  const categories = ['all', ...Array.from(new Set(scenarios.map(s => s.category ?? 'CUSTOM')))];
  const filtered = scenarios
    .filter(s => catFilter === 'all' || (s.category ?? 'CUSTOM') === catFilter)
    .sort((a, b) => {
      if (sortKey === 'impact') return a.portfolio_impact - b.portfolio_impact;
      if (sortKey === 'drawdown') return a.max_drawdown - b.max_drawdown;
      if (sortKey === 'recovery') return b.recovery_days - a.recovery_days;
      if (sortKey === 'prob') return (b.probability ?? 0) - (a.probability ?? 0);
      return 0;
    });

  const worstImpact = scenarios.reduce((w, s) => s.portfolio_impact < w.portfolio_impact ? s : w, scenarios[0]);
  const avgDrawdown = scenarios.length ? (scenarios.reduce((a, s) => a + s.max_drawdown, 0) / scenarios.length) : 0;

  return (
    <div data-testid="risk-scenarios-panel" style={{ height: '100%', display: 'flex', flexDirection: 'column', background: BG, fontFamily: MONO, color: TEXT }}>
      {/* Header */}
      <div style={{ padding: '10px 14px', borderBottom: `1px solid ${BORDER}`, background: PANEL, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 13, color: AMBER, fontWeight: 700, letterSpacing: 2 }}>RS</span>
        <span style={{ fontSize: 11, color: SUBTLE, letterSpacing: 1 }}>RISK SCENARIOS</span>
        <span style={{ fontSize: 10, color: RED, background: RED + '22', border: `1px solid ${RED}44`, borderRadius: 10, padding: '1px 6px' }}>STRESS TEST</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button onClick={() => setShowCustom(s => !s)} style={{ background: showCustom ? AMBER + '22' : 'transparent', border: `1px solid ${showCustom ? AMBER : BORDER}`, borderRadius: 2, padding: '2px 8px', color: showCustom ? AMBER : SUBTLE, fontFamily: MONO, fontSize: 10, cursor: 'pointer', letterSpacing: 1 }}>+ CUSTOM</button>
        </div>
      </div>

      {/* Summary */}
      {!loading && scenarios.length > 0 && (
        <div style={{ padding: '5px 14px', borderBottom: `1px solid ${BORDER}`, background: PANEL, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {[
            { label: 'SCENARIOS', val: scenarios.length, col: TEXT },
            { label: 'WORST IMPACT', val: worstImpact ? `$${worstImpact.portfolio_impact.toLocaleString()}` : '--', col: RED },
            { label: 'AVG DD', val: `${(avgDrawdown * 100).toFixed(1)}%`, col: AMBER },
            { label: 'MAX RECOVERY', val: `${Math.max(...scenarios.map(s => s.recovery_days))}d`, col: ORANGE },
          ].map(({ label, val, col }) => (
            <div key={label}>
              <div style={{ fontSize: 9, color: SUBTLE, letterSpacing: 1 }}>{label}</div>
              <div style={{ fontSize: 12, color: col, fontFamily: MONO, fontWeight: 600 }}>{val}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filter / Sort */}
      <div style={{ padding: '5px 14px', borderBottom: `1px solid ${BORDER}`, background: PANEL, display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap' }}>
        {categories.map(c => {
          const col = c === 'all' ? TEXT : CATEGORY_COLORS[c] || SUBTLE;
          const active = catFilter === c;
          return (
            <button key={c} onClick={() => setCatFilter(c)} style={{
              background: active ? col + '22' : 'transparent', border: `1px solid ${active ? col : BORDER}`,
              borderRadius: 2, padding: '2px 7px', color: active ? col : SUBTLE, fontFamily: MONO, fontSize: 10, cursor: 'pointer',
            }}>{c}</button>
          );
        })}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4, alignItems: 'center' }}>
          <span style={{ fontSize: 9, color: SUBTLE }}>SORT:</span>
          {(['impact', 'drawdown', 'recovery', 'prob'] as const).map(k => (
            <button key={k} onClick={() => setSortKey(k)} style={{
              background: sortKey === k ? '#1a1a1a' : 'transparent', border: `1px solid ${sortKey === k ? AMBER : BORDER}`,
              borderRadius: 2, padding: '2px 6px', color: sortKey === k ? AMBER : SUBTLE, fontFamily: MONO, fontSize: 9, cursor: 'pointer',
            }}>{k.toUpperCase()}</button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ flex: selected ? '0 0 55%' : 1, overflow: 'auto' }}>
          {loading && <div data-testid="risk-scenarios-loading" style={{ padding: 32, textAlign: 'center', color: AMBER, letterSpacing: 2 }}>LOADING...</div>}
          {!loading && filtered.length === 0 && <div data-testid="risk-scenarios-empty" style={{ padding: 48, textAlign: 'center', color: SUBTLE }}>No scenarios</div>}
          {!loading && filtered.map((s, idx) => {
            const isExpanded = expanded === s.id;
            const isSelected = selected?.id === s.id;
            const catCol = CATEGORY_COLORS[s.category ?? 'CUSTOM'] || SUBTLE;
            const impactCol = s.portfolio_impact >= 0 ? GREEN : s.portfolio_impact > -20000 ? AMBER : RED;
            return (
              <div
                key={s.id}
                data-testid={`scenario-card-${idx}`}
                style={{
                  borderBottom: `1px solid ${BORDER}`, borderLeft: `3px solid ${isSelected ? catCol : 'transparent'}`,
                  background: isSelected ? '#1a0e0e' : 'transparent',
                }}
              >
                <div
                  onClick={() => { setSelected(prev => prev?.id === s.id ? null : s); setExpanded(isExpanded ? null : s.id); }}
                  style={{ padding: '10px 14px', cursor: 'pointer' }}
                  onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = '#141414'; }}
                  onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: TEXT, fontWeight: 600 }}>{s.name}</span>
                      <span style={{ fontSize: 9, padding: '1px 6px', background: catCol + '22', border: `1px solid ${catCol}44`, borderRadius: 8, color: catCol }}>{s.category ?? 'CUSTOM'}</span>
                    </div>
                    <span style={{ fontSize: 10, color: isExpanded ? AMBER : SUBTLE }}>{ isExpanded ? 'â–²' : 'â–¼'}</span>
                  </div>
                  <p style={{ fontSize: 10, color: SUBTLE, margin: '0 0 8px', lineHeight: 1.5 }}>{s.description}</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 9, color: SUBTLE, letterSpacing: 1 }}>IMPACT</div>
                      <div style={{ fontSize: 12, fontFamily: MONO, color: impactCol, fontWeight: 600 }}>
                        {s.portfolio_impact >= 0 ? '+' : ''}${s.portfolio_impact.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 9, color: SUBTLE, letterSpacing: 1 }}>MAX DD</div>
                      <div style={{ fontSize: 12, fontFamily: MONO, color: s.max_drawdown < -0.3 ? RED : AMBER, fontWeight: 600 }}>{(s.max_drawdown * 100).toFixed(1)}%</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 9, color: SUBTLE, letterSpacing: 1 }}>RECOVERY</div>
                      <div style={{ fontSize: 12, fontFamily: MONO, color: s.recovery_days > 365 ? RED : TEXT }}>{s.recovery_days}d</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 9, color: SUBTLE, letterSpacing: 1 }}>PROB</div>
                      <div style={{ fontSize: 12, fontFamily: MONO, color: TEXT }}>{s.probability != null ? `${(s.probability * 100).toFixed(0)}%` : '--'}</div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div data-testid={`scenario-shock-${idx}`} style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${BORDER}` }}>
                      <div style={{ fontSize: 9, color: SUBTLE, letterSpacing: 1, marginBottom: 6 }}>SHOCK PARAMETERS</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                        {Object.entries(s.shock).map(([k, v]) => (
                          <span key={k} style={{
                            fontSize: 10, fontFamily: MONO, padding: '2px 8px', borderRadius: 3,
                            background: (v > 0 && k !== 'vol' && k !== 'liquidity') ? GREEN + '22' : RED + '22',
                            border: `1px solid ${(v > 0 && k !== 'vol' && k !== 'liquidity') ? GREEN + '55' : RED + '55'}`,
                            color: (v > 0 && k !== 'vol' && k !== 'liquidity') ? GREEN : RED,
                          }}>
                            {k}: {v > 0 ? '+' : ''}{(v * 100).toFixed(0)}%
                          </span>
                        ))}
                      </div>
                      {(s.var_95 != null || s.var_99 != null) && (
                        <div style={{ display: 'flex', gap: 12 }}>
                          {s.var_95 != null && <span style={{ fontSize: 10, color: SUBTLE }}>VaR 95%: <span style={{ color: AMBER, fontFamily: MONO }}>${s.var_95.toLocaleString()}</span></span>}
                          {s.var_99 != null && <span style={{ fontSize: 10, color: SUBTLE }}>VaR 99%: <span style={{ color: RED, fontFamily: MONO }}>${s.var_99.toLocaleString()}</span></span>}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {selected && (
          <div style={{ flex: '0 0 45%', borderLeft: `1px solid ${BORDER}`, background: PANEL, padding: 14, overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 10, color: SUBTLE, letterSpacing: 1 }}>SCENARIO DETAIL</div>
                <div style={{ fontSize: 14, color: AMBER, fontWeight: 700, marginTop: 2 }}>{selected.name}</div>
                <div style={{ fontSize: 10, color: CATEGORY_COLORS[selected.category ?? 'CUSTOM'] || SUBTLE, marginTop: 2 }}>{selected.category ?? 'CUSTOM'}</div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: SUBTLE, cursor: 'pointer', fontSize: 16 }}>âœ•</button>
            </div>
            <p style={{ fontSize: 10, color: SUBTLE, lineHeight: 1.6, marginBottom: 12 }}>{selected.description}</p>
            {[
              { label: 'PORTFOLIO IMPACT', val: `${selected.portfolio_impact >= 0 ? '+' : ''}$${selected.portfolio_impact.toLocaleString()}`, col: selected.portfolio_impact >= 0 ? GREEN : RED },
              { label: 'MAX DRAWDOWN', val: `${(selected.max_drawdown * 100).toFixed(2)}%`, col: selected.max_drawdown < -0.3 ? RED : AMBER },
              { label: 'RECOVERY DAYS', val: `${selected.recovery_days}d`, col: selected.recovery_days > 365 ? RED : TEXT },
              { label: 'PROBABILITY', val: selected.probability != null ? `${(selected.probability * 100).toFixed(1)}%` : '--', col: TEXT },
              { label: 'VaR 95%', val: selected.var_95 != null ? `$${selected.var_95.toLocaleString()}` : '--', col: AMBER },
              { label: 'VaR 99%', val: selected.var_99 != null ? `$${selected.var_99.toLocaleString()}` : '--', col: RED },
            ].map(({ label, val, col }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 11 }}>
                <span style={{ color: SUBTLE, letterSpacing: 1 }}>{label}</span>
                <span style={{ color: col, fontFamily: MONO, fontWeight: 600 }}>{val}</span>
              </div>
            ))}
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 10, color: SUBTLE, letterSpacing: 1, marginBottom: 8 }}>SHOCKS</div>
              {Object.entries(selected.shock).map(([k, v]) => {
                const posGood = k !== 'vol' && k !== 'liquidity';
                const col = (v >= 0 && posGood) || (v < 0 && !posGood) ? GREEN : RED;
                const barW = Math.min(Math.abs(v) * 100 * 2, 100);
                return (
                  <div key={k} style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ fontSize: 10, color: SUBTLE, textTransform: 'uppercase' }}>{k}</span>
                      <span style={{ fontSize: 10, color: col, fontFamily: MONO, fontWeight: 600 }}>{v >= 0 ? '+' : ''}{(v * 100).toFixed(0)}%</span>
                    </div>
                    <div style={{ background: BORDER, height: 4, borderRadius: 2 }}>
                      <div style={{ width: `${barW}%`, height: '100%', background: col, borderRadius: 2 }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: 14, display: 'flex', gap: 6 }}>
              <button style={{ flex: 1, background: RED + '22', border: `1px solid ${RED}`, borderRadius: 3, padding: '5px 0', color: RED, fontFamily: MONO, fontSize: 10, cursor: 'pointer', letterSpacing: 1 }}>RUN TEST</button>
              <button style={{ flex: 1, background: BLUE + '22', border: `1px solid ${BLUE}`, borderRadius: 3, padding: '5px 0', color: BLUE, fontFamily: MONO, fontSize: 10, cursor: 'pointer', letterSpacing: 1 }}>EXPORT</button>
            </div>
          </div>
        )}
      </div>

      <div data-testid="risk-scenarios-panel-ready" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden' }}>ready</div>
    </div>
  );
}


interface Scenario {
  id: string;
  name: string;
  description: string;
  shock: Record<string, number>;
  portfolio_impact: number;
  max_drawdown: number;
  recovery_days: number;
  status: string;
}
