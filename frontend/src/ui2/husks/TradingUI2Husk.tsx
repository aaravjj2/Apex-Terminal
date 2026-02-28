/**
 * TradingUI2Husk — Bloomberg Terminal Trading Page Skeleton
 *
 * Layout mirrors the real TradingUI2 panel grid:
 *
 *  ┌───────────────────────────────────────────────────────────┐
 *  │  QUOTE BAR                                                │
 *  ├─────────┬─────────────────────────────────┬──────────────┤
 *  │WATCHLIST│  ADVANCED CHART                 │  ORDER BOOK  │
 *  │         │                                 │  TIME&SALES  │
 *  ├─────────┼─────────────────────────────────┼──────────────┤
 *  │ ORDERS BLOTTER                            │ ORDER ENTRY  │
 *  └───────────────────────────────────────────┴──────────────┘
 */
import React from 'react';
import { BG, PANEL, AMBER, GREEN, RED, TEXT, SUBTLE, MONO, BORDER, panelStyle, panelHdr } from './ui2-tokens';

function QuoteBarHusk() {
  const fields = [
    { label: 'BID',  value: '—' },
    { label: 'ASK',  value: '—' },
    { label: 'LAST', value: '—' },
    { label: 'CHG',  value: '—' },
    { label: 'VOL',  value: '—' },
    { label: 'HIGH', value: '—' },
    { label: 'LOW',  value: '—' },
  ];
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 20, padding: '5px 14px',
      background: BG, borderBottom: `1px solid ${BORDER}`,
      fontFamily: MONO, fontSize: 12, flexShrink: 0,
    }}>
      <span style={{ color: AMBER, fontWeight: 700, fontSize: 14, letterSpacing: '0.08em' }}>AAPL</span>
      {fields.map(f => (
        <span key={f.label} style={{ color: TEXT }}>
          <span style={{ color: SUBTLE, fontSize: 10 }}>{f.label} </span>{f.value}
        </span>
      ))}
      <span style={{ marginLeft: 'auto', color: SUBTLE, fontSize: 10 }}>—:—:—</span>
    </div>
  );
}

function PanelShell({ title, children, style }: { title: string; children?: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ ...panelStyle, ...style }}>
      <div style={panelHdr}>{title}</div>
      <div style={{ flex: 1, padding: 12, color: SUBTLE, fontSize: 11, fontFamily: MONO }}>
        {children ?? <span style={{ opacity: 0.5 }}>{title} — placeholder</span>}
      </div>
    </div>
  );
}

function DepthRow({ price, size, side }: { price: string; size: string; side: 'bid' | 'ask' }) {
  const col = side === 'bid' ? GREEN : RED;
  return (
    <div style={{ display: 'flex', padding: '2px 8px', fontSize: 11, fontFamily: MONO, justifyContent: 'space-between' }}>
      <span style={{ color: col }}>{price}</span>
      <span style={{ color: TEXT }}>{size}</span>
    </div>
  );
}

function OrderBookHusk() {
  const mockAsks = ['185.42', '185.40', '185.38', '185.36', '185.34'];
  const mockBids = ['185.30', '185.28', '185.26', '185.24', '185.22'];
  return (
    <div style={{ ...panelStyle, height: '100%' }}>
      <div style={panelHdr}>ORDER BOOK · AAPL</div>
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '4px 0' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          {mockAsks.slice().reverse().map((p, i) => <DepthRow key={i} price={p} size="1.2K" side="ask" />)}
        </div>
        <div style={{ textAlign: 'center', padding: '3px 0', fontSize: 10, color: AMBER, fontFamily: MONO, borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}` }}>
          SPREAD 0.0200
        </div>
        <div style={{ flex: 1 }}>
          {mockBids.map((p, i) => <DepthRow key={i} price={p} size="2.4K" side="bid" />)}
        </div>
      </div>
    </div>
  );
}

function OrderEntryHusk() {
  const btnBase: React.CSSProperties = {
    flex: 1, padding: '5px 0', border: 'none', borderRadius: 2, cursor: 'pointer',
    fontFamily: MONO, fontSize: 11, fontWeight: 700,
  };
  return (
    <div style={{ ...panelStyle, width: 220, flexShrink: 0 }}>
      <div style={panelHdr}>ORDER ENTRY</div>
      <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', gap: 4 }}>
          <button style={{ ...btnBase, background: 'rgba(0,216,138,0.2)', color: GREEN }}>BUY</button>
          <button style={{ ...btnBase, background: `rgba(255,59,92,0.12)`, color: '#666' }}>SELL</button>
        </div>
        <div style={{ fontSize: 13, fontFamily: MONO, color: AMBER, fontWeight: 700 }}>AAPL</div>
        {['MARKET', 'LIMIT', 'STOP', 'STOP LMT'].map(k => (
          <button key={k} disabled style={{ padding: '3px 6px', background: PANEL, border: `1px solid ${BORDER}`, color: SUBTLE, fontFamily: MONO, fontSize: 9, cursor: 'not-allowed' }}>{k}</button>
        ))}
        {[['QTY', '100'], ['LIMIT', '—'], ['STOP', '—']].map(([l, v]) => (
          <div key={l}>
            <div style={{ fontSize: 9, color: SUBTLE, fontFamily: MONO, marginBottom: 2 }}>{l}</div>
            <div style={{ background: '#080810', border: `1px solid ${BORDER}`, color: TEXT, padding: '4px 8px', fontFamily: MONO, fontSize: 12 }}>{v}</div>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 3 }}>
          {['DAY', 'GTC', 'IOC'].map(t => (
            <button key={t} disabled style={{ flex: 1, padding: '3px 0', background: PANEL, border: `1px solid ${BORDER}`, color: SUBTLE, fontFamily: MONO, fontSize: 9, cursor: 'not-allowed' }}>{t}</button>
          ))}
        </div>
        <button disabled style={{ padding: 8, background: 'rgba(0,216,138,0.15)', border: `1px solid ${GREEN}`, color: GREEN, fontFamily: MONO, fontWeight: 700, fontSize: 12, cursor: 'not-allowed', borderRadius: 2 }}>
          BUY AAPL
        </button>
      </div>
    </div>
  );
}

export function TradingUI2Husk(): React.JSX.Element {
  return (
    <div style={{ background: BG, minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: MONO, color: TEXT }}>
      <QuoteBarHusk />

      {/* Main 3-column layout */}
      <div style={{ flex: 1, display: 'flex', gap: 8, padding: 8, overflow: 'hidden' }}>
        {/* Left — Watchlist */}
        <PanelShell title="WATCHLIST" style={{ width: 200, flexShrink: 0 }}>
          {['AAPL', 'MSFT', 'NVDA', 'TSLA', 'SPY', 'QQQ'].map(sym => (
            <div key={sym} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: `1px solid ${BORDER}` }}>
              <span style={{ color: AMBER }}>{sym}</span>
              <span style={{ color: SUBTLE }}>—</span>
            </div>
          ))}
        </PanelShell>

        {/* Center — Chart */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <PanelShell title="ADVANCED CHART · AAPL · 1D" style={{ flex: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#2a2a3e', fontSize: 48, fontWeight: 700 }}>
              ▲
            </div>
          </PanelShell>

          {/* Bottom row — Orders + Trades */}
          <div style={{ flex: 1, display: 'flex', gap: 8 }}>
            <PanelShell title="ORDERS BLOTTER" style={{ flex: 1 }} />
            <PanelShell title="TRADES LEDGER" style={{ flex: 1 }} />
          </div>
        </div>

        {/* Right — Order book + T&S + Entry */}
        <div style={{ width: 220, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <OrderBookHusk />
          <PanelShell title="TIME & SALES · AAPL" style={{ flex: 1 }} />
          <OrderEntryHusk />
        </div>
      </div>
    </div>
  );
}
