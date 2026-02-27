const BG='#0a0a0a'; const PANEL='#111111'; const BORDER='#1e1e1e';
const AMBER='#f5a623'; const GREEN='#26a69a'; const RED='#ef5350';
const BLUE='#42a5f5'; const PURPLE='#ab47bc'; const SUBTLE='#555';
const TEXT='#d1d4dc'; const MONO='"Roboto Mono","Courier New",monospace';

import React, { useEffect, useState } from 'react';
import { useAutopilotStore } from '../store';
import type { AutopilotPosition } from '../types';

const fmt$ = (v: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(v);
const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`;

const TH: React.CSSProperties = { padding: '6px 12px', textAlign: 'left', fontSize: 9, color: SUBTLE, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700, borderBottom: `1px solid ${BORDER}`, background: PANEL, position: 'sticky', top: 0 };

const STATUS_COLOR: Record<string, string> = { open: GREEN, closed: SUBTLE, pending: AMBER, expired: PURPLE };

function PositionDetails({ position }: { position: AutopilotPosition }) {
  return (
    <div data-testid={`position-details-${position.position_id}`} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, padding: 12 }}>
      <div>
        <div style={{ fontSize: 10, color: SUBTLE, letterSpacing: '0.1em', marginBottom: 8 }}>LEGS</div>
        <table style={{ width: '100%', fontSize: 10 }}>
          <thead><tr>{['SIDE','STRIKE','TYPE','QTY','ENTRY'].map(h => <th key={h} style={{ textAlign: h === 'QTY' || h === 'ENTRY' ? 'right' : 'left', color: SUBTLE, paddingBottom: 4, fontWeight: 700 }}>{h}</th>)}</tr></thead>
          <tbody>
            {position.legs?.map((leg: any, i: number) => (
              <tr key={i} style={{ borderTop: `1px solid ${BORDER}` }}>
                <td style={{ color: leg.side === 'buy' ? GREEN : RED, fontWeight: 700, padding: '3px 0' }}>{leg.side.toUpperCase()}</td>
                <td style={{ fontFamily: MONO, color: TEXT }}>${leg.strike}</td>
                <td style={{ color: TEXT }}>{leg.option_type.toUpperCase()}</td>
                <td style={{ textAlign: 'right', color: TEXT, fontFamily: MONO }}>{leg.quantity}</td>
                <td style={{ textAlign: 'right', color: TEXT, fontFamily: MONO }}>{fmt$(leg.entry_price)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div>
        <div style={{ fontSize: 10, color: SUBTLE, letterSpacing: '0.1em', marginBottom: 8 }}>POSITION GREEKS</div>
        {position.greeks && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginBottom: 12 }}>
            {[
              { label: 'Delta', value: position.greeks.delta?.toFixed(2) },
              { label: 'Gamma', value: position.greeks.gamma?.toFixed(4) },
              { label: 'Theta', value: position.greeks.theta?.toFixed(2) },
              { label: 'Vega', value: position.greeks.vega?.toFixed(2) },
            ].map(g => (
              <div key={g.label} style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 2, padding: '6px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: SUBTLE }}>{g.label}</div>
                <div style={{ fontSize: 12, color: TEXT, fontFamily: MONO, marginTop: 2 }}>{g.value ?? 'N/A'}</div>
              </div>
            ))}
          </div>
        )}
        <div style={{ fontSize: 10, color: SUBTLE, letterSpacing: '0.1em', marginBottom: 6 }}>TRADE INFO</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 10 }}>
          {[
            { label: 'Entry Time', value: new Date(position.entry_time).toLocaleString() },
            { label: 'Expiration', value: position.expiration },
            { label: 'Underlying', value: fmt$(position.underlying_price ?? 0) },
            { label: 'IV Rank', value: position.iv_rank ? fmtPct(position.iv_rank) : 'N/A' },
          ].map(r => (
            <div key={r.label}>
              <span style={{ color: SUBTLE }}>{r.label}: </span>
              <span style={{ color: TEXT, fontFamily: MONO }}>{r.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PositionRow({ position, expanded, onToggle, onClose }: { position: AutopilotPosition; expanded: boolean; onToggle: () => void; onClose: (symbol: string) => void }) {
  const up = position.unrealized_pnl >= 0;
  const sc = STATUS_COLOR[position.status] || SUBTLE;
  return (
    <>
      <tr data-testid={`position-row-${position.position_id}`} onClick={onToggle} style={{ borderBottom: `1px solid ${BORDER}`, cursor: 'pointer' }}>
        <td style={{ padding: '6px 12px', color: SUBTLE, fontSize: 10 }}>{expanded ? '' : ''}</td>
        <td style={{ padding: '6px 12px', fontWeight: 700, color: TEXT, fontFamily: MONO }}>{position.symbol}</td>
        <td style={{ padding: '6px 12px' }}>
          <span style={{ fontSize: 9, padding: '1px 6px', background: sc + '22', color: sc, border: `1px solid ${sc}44`, borderRadius: 2 }}>{position.status.toUpperCase()}</span>
        </td>
        <td style={{ padding: '6px 12px', color: SUBTLE, fontSize: 11 }}>{position.template}</td>
        <td style={{ padding: '6px 12px', color: TEXT, fontSize: 11 }}>{position.legs?.length ?? 0}</td>
        <td style={{ padding: '6px 12px', textAlign: 'right', fontFamily: MONO, color: TEXT }}>{fmt$(position.entry_cost)}</td>
        <td style={{ padding: '6px 12px', textAlign: 'right', fontFamily: MONO, color: TEXT }}>{fmt$(position.max_risk)}</td>
        <td style={{ padding: '6px 12px', textAlign: 'right', fontFamily: MONO, color: up ? GREEN : RED, fontWeight: 700 }}>{fmt$(position.unrealized_pnl)}</td>
        <td style={{ padding: '6px 12px', textAlign: 'right', fontFamily: MONO, color: up ? GREEN : RED }}>{fmtPct(position.unrealized_pnl / position.max_risk)}</td>
        <td style={{ padding: '6px 12px', textAlign: 'right', color: SUBTLE, fontSize: 11 }}>{position.days_to_expiry}d</td>
        <td style={{ padding: '6px 12px' }}>
          {position.status === 'open' && (
            <button onClick={e => { e.stopPropagation(); onClose(position.symbol); }} data-testid={`panic-sell-${position.symbol}`}
              style={{ fontSize: 9, padding: '2px 6px', background: RED + '22', color: RED, border: `1px solid ${RED}44`, borderRadius: 2, cursor: 'pointer', fontFamily: MONO }}>
               CLOSE
            </button>
          )}
        </td>
      </tr>
      {expanded && (
        <tr style={{ background: PANEL }}>
          <td colSpan={11}><PositionDetails position={position} /></td>
        </tr>
      )}
    </>
  );
}

type FilterStatus = 'all' | 'open' | 'closed';

export const AutopilotPositions: React.FC = () => {
  const { positions = [], isLoading, fetchPositions, closePosition } = useAutopilotStore();
  const [filter, setFilter] = useState<FilterStatus>('open');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchPositions(filter === 'all' ? undefined : filter);
    const t = setInterval(() => fetchPositions(filter === 'all' ? undefined : filter), 15000);
    return () => clearInterval(t);
  }, [filter, fetchPositions]);

  const toggleExpand = (id: string) => setExpandedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const safe = positions ?? [];
  const totalPnl = safe.reduce((s, p) => s + (p.unrealized_pnl ?? 0), 0);
  const totalRisk = safe.reduce((s, p) => s + (p.max_risk ?? 0), 0);

  return (
    <div data-testid="autopilot-positions" style={{ display: 'flex', flexDirection: 'column', height: '100%', background: BG, color: TEXT, fontFamily: MONO }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
        <span data-testid="position-ledger-heading" style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.04em' }}> POSITION LEDGER</span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {(['open', 'closed', 'all'] as FilterStatus[]).map(s => (
            <button key={s} data-testid={`filter-${s}`} onClick={() => setFilter(s)}
              style={{ padding: '4px 10px', fontSize: 10, fontWeight: 700, background: filter === s ? BLUE : PANEL, color: filter === s ? '#000' : SUBTLE, border: `1px solid ${filter === s ? BLUE : BORDER}`, borderRadius: 2, cursor: 'pointer', fontFamily: MONO, letterSpacing: '0.06em' }}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
          <button data-testid="refresh-positions" onClick={() => fetchPositions(filter === 'all' ? undefined : filter)} disabled={isLoading}
            style={{ padding: '4px 10px', fontSize: 10, background: PANEL, color: TEXT, border: `1px solid ${BORDER}`, borderRadius: 2, cursor: 'pointer', fontFamily: MONO }}>
            {isLoading ? '' : ''} REFRESH
          </button>
        </div>
      </div>

      {/* Summary */}
      <div style={{ display: 'flex', gap: 20, padding: '6px 16px', background: PANEL, borderBottom: `1px solid ${BORDER}`, fontSize: 11, flexShrink: 0 }}>
        {[
          { label: 'Positions', value: positions.length.toString(), color: TEXT },
          { label: 'Total Risk', value: fmt$(totalRisk), color: TEXT },
          { label: 'Total P&L', value: fmt$(totalPnl), color: totalPnl >= 0 ? GREEN : RED },
        ].map(m => (
          <div key={m.label} style={{ display: 'flex', gap: 6 }}>
            <span style={{ color: SUBTLE }}>{m.label}:</span>
            <span style={{ color: m.color, fontWeight: 700, fontFamily: MONO }}>{m.value}</span>
          </div>
        ))}
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {safe.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: SUBTLE, fontSize: 11 }}>
            {isLoading ? ' Loading positions...' : 'No positions found'}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr>{['', 'SYMBOL', 'STATUS', 'TEMPLATE', 'LEGS', 'ENTRY COST', 'MAX RISK', 'UNREALIZED P&L', '% P&L', 'DTE', ''].map((h, i) => <th key={i} style={{ ...TH, textAlign: i >= 5 && i <= 9 ? 'right' : 'left' }}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {safe.map(p => <PositionRow key={p.position_id} position={p} expanded={expandedIds.has(p.position_id)} onToggle={() => toggleExpand(p.position_id)} onClose={closePosition} />)}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default AutopilotPositions;