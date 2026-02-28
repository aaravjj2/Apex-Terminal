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

interface PortfolioValuation {
  portfolio_id: string;
  net_value: number;
  unrealised_pnl: number;
  positions: number;
}

interface MultiValuationData {
  valuations: PortfolioValuation[];
  total_net_value: number;
  total_pnl: number;
}

interface MultiValuationCardsProps {
  portfolioIds: string[];
}

const API_BASE = '/api/v1';

import React, { useState, useEffect } from 'react';

function fmt(n: number) { return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function pnlColor(n: number) { return n > 0 ? GREEN : n < 0 ? RED : SUBTLE; }
function sparkBar(val: number, total: number) {
  const pct = total !== 0 ? Math.min(100, Math.abs(val / total) * 100) : 0;
  return <div style={{ height: 3, background: BORDER, borderRadius: 2, marginTop: 4 }}><div style={{ width: `${pct}%`, height: '100%', background: GREEN, borderRadius: 2 }} /></div>;
}

export function MultiValuationCards({ portfolioIds }: MultiValuationCardsProps) {
  const [data, setData] = useState<MultiValuationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (portfolioIds.length === 0) { setData(null); return; }
    fetchValuations();
  }, [portfolioIds.join(',')]);

  const fetchValuations = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API_BASE}/portfolios/multi-valuation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portfolio_ids: portfolioIds }),
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch {
      // Mock fallback
      const valuations: PortfolioValuation[] = portfolioIds.map((id, i) => ({
        portfolio_id: id, net_value: 100000 + i * 25000,
        unrealised_pnl: (i % 2 === 0 ? 1 : -1) * (1200 + i * 300), positions: 4 + i * 2,
      }));
      setData({
        valuations,
        total_net_value: valuations.reduce((s, v) => s + v.net_value, 0),
        total_pnl: valuations.reduce((s, v) => s + v.unrealised_pnl, 0),
      });
    } finally { setLoading(false); }
  };

  if (portfolioIds.length === 0) return (
    <div data-testid="multi-valuation-empty" style={{ padding: 16, textAlign: 'center', fontSize: 11, color: SUBTLE, fontFamily: MONO }}>
      No portfolios selected
    </div>
  );

  if (loading) return (
    <div data-testid="multi-valuation-loading" style={{ display: 'flex', gap: 8, padding: 12, fontFamily: MONO }}>
      {[1,2,3].map(i => <div key={i} style={{ flex: 1, height: 72, background: '#181818', borderRadius: 4, animation: 'pulse 1.5s infinite' }} />)}
    </div>
  );

  if (error) return (
    <div data-testid="multi-valuation-error" style={{ padding: 12, color: RED, fontSize: 11, fontFamily: MONO }}>{error}</div>
  );

  if (!data) return null;

  const selectedVal = data.valuations.find(v => v.portfolio_id === selected);

  return (
    <div data-testid="multi-valuation-cards" style={{ fontFamily: MONO }}>
      {/* Summary row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, padding: '10px 10px 0' }}>
        <div style={{ background: '#141414', border: `1px solid ${BORDER}`, borderTop: `2px solid ${BLUE}`, borderRadius: 4, padding: '10px 12px' }}>
          <div style={{ fontSize: 9, color: SUBTLE, letterSpacing: 1 }}>PORTFOLIOS</div>
          <div data-testid="multi-valuation-count" style={{ fontSize: 18, color: TEXT, fontWeight: 700 }}>{data.valuations.length}</div>
        </div>
        <div style={{ background: '#141414', border: `1px solid ${BORDER}`, borderTop: `2px solid ${GREEN}`, borderRadius: 4, padding: '10px 12px' }}>
          <div style={{ fontSize: 9, color: SUBTLE, letterSpacing: 1 }}>TOTAL VALUE</div>
          <div data-testid="multi-valuation-total" style={{ fontSize: 15, color: TEXT, fontWeight: 700 }}>${fmt(data.total_net_value)}</div>
        </div>
        <div style={{ background: '#141414', border: `1px solid ${BORDER}`, borderTop: `2px solid ${pnlColor(data.total_pnl)}`, borderRadius: 4, padding: '10px 12px' }}>
          <div style={{ fontSize: 9, color: SUBTLE, letterSpacing: 1 }}>TOTAL P&L</div>
          <div data-testid="multi-valuation-pnl" style={{ fontSize: 15, color: pnlColor(data.total_pnl), fontWeight: 700 }}>
            {data.total_pnl >= 0 ? '+' : ''}${fmt(data.total_pnl)}
          </div>
        </div>
      </div>

      {/* Per-portfolio breakdown */}
      {data.valuations.length > 1 && (
        <div data-testid="multi-valuation-breakdown" style={{ padding: '8px 10px' }}>
          <div style={{ fontSize: 9, color: SUBTLE, letterSpacing: 1, marginBottom: 6 }}>BREAKDOWN</div>
          {data.valuations.map(v => {
            const isSel = selected === v.portfolio_id;
            return (
              <div
                key={v.portfolio_id}
                data-testid={`multi-valuation-row-${v.portfolio_id}`}
                onClick={() => setSelected(prev => prev === v.portfolio_id ? null : v.portfolio_id)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '6px 10px', marginBottom: 3, borderRadius: 4, cursor: 'pointer',
                  background: isSel ? '#1a1a1a' : '#141414',
                  border: `1px solid ${isSel ? AMBER + '44' : BORDER}`,
                  borderLeft: `3px solid ${isSel ? AMBER : BORDER}`,
                }}
                onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = '#181818'; }}
                onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = '#141414'; }}
              >
                <span style={{ fontSize: 10, color: TEXT, fontFamily: MONO }}>{v.portfolio_id}</span>
                <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                  <span style={{ fontSize: 10, color: SUBTLE }}>${fmt(v.net_value)}</span>
                  <span style={{ fontSize: 10, color: pnlColor(v.unrealised_pnl), minWidth: 72, textAlign: 'right' }}>
                    {v.unrealised_pnl >= 0 ? '+' : ''}${fmt(v.unrealised_pnl)}
                  </span>
                  <span style={{ fontSize: 9, color: SUBTLE }}>{v.positions}p</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Selected detail */}
      {selectedVal && (
        <div style={{ margin: '0 10px 10px', padding: 12, background: '#141414', border: `1px solid ${AMBER}33`, borderRadius: 4 }}>
          <div style={{ fontSize: 9, color: AMBER, letterSpacing: 2, marginBottom: 8 }}>DETAIL â€” {selectedVal.portfolio_id}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {[
              { label: 'NET VALUE', value: `$${fmt(selectedVal.net_value)}`, color: TEXT },
              { label: 'UNREALISED P&L', value: `${selectedVal.unrealised_pnl >= 0 ? '+' : ''}$${fmt(selectedVal.unrealised_pnl)}`, color: pnlColor(selectedVal.unrealised_pnl) },
              { label: 'POSITIONS', value: String(selectedVal.positions), color: BLUE },
            ].map(stat => (
              <div key={stat.label}>
                <div style={{ fontSize: 9, color: SUBTLE }}>{stat.label}</div>
                <div style={{ fontSize: 13, color: stat.color, fontWeight: 700 }}>{stat.value}</div>
                {sparkBar(selectedVal.net_value, data.total_net_value)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


interface PortfolioValuation {
  portfolio_id: string;
  net_value: number;
  unrealised_pnl: number;
  positions: number;
}

interface MultiValuationData {
  valuations: PortfolioValuation[];
  total_net_value: number;
  total_pnl: number;
}

interface MultiValuationCardsProps {
  portfolioIds: string[];
}

