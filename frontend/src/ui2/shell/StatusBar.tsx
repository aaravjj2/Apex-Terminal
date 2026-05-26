/**
 * Apex Terminal — StatusBar
 *
 * Tied to the live quote store + account summary. No mock numbers.
 */
import { useEffect, useState } from 'react';
import { useLiveStatus, useLiveQuotes } from '../lib/liveQuoteStore';

interface StatusBarProps {
  marketOpen: boolean;
  marketSession: string;
  connectionStatus: string;
}

const TICKER_SYMBOLS = ['SPY', 'QQQ', 'DIA', 'IWM', 'AAPL', 'MSFT', 'NVDA', 'TSLA', 'META', 'AMZN', 'GOOGL', 'AMD', 'NFLX'];

const STATUS_LABEL: Record<string, string> = {
  live: 'LIVE',
  reconnecting: 'RECONNECTING…',
  offline: 'OFFLINE',
};
const STATUS_CLASS: Record<string, string> = {
  live: 'ok',
  reconnecting: 'warn',
  offline: 'err',
};

export function StatusBar({ marketOpen, marketSession }: StatusBarProps) {
  const live = useLiveStatus();
  const quotes = useLiveQuotes(TICKER_SYMBOLS);
  const [nav, setNav] = useState<number | null>(null);
  const [equityChange, setEquityChange] = useState<number | null>(null);

  useEffect(() => {
    const load = () =>
      fetch('/api/v1/account/summary')
        .then(r => (r.ok ? r.json() : null))
        .then(d => {
          if (!d) return;
          const equity =
            Number(d.equity ?? d.portfolio_value ?? d.account?.equity ?? 0) || null;
          const last =
            Number(d.last_equity ?? d.account?.last_equity ?? 0) || null;
          if (equity) setNav(equity);
          if (equity && last) setEquityChange(equity - last);
        })
        .catch(() => {});
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, []);

  const tickerItems = TICKER_SYMBOLS
    .map(s => {
      const q = quotes[s];
      if (!q || q.price <= 0) return null;
      return { sym: s, price: q.price, pct: q.changePct, up: q.change >= 0 };
    })
    .filter((x): x is { sym: string; price: number; pct: number; up: boolean } => x !== null);

  return (
    <div className="apex-statusbar" data-testid="ui2-status-bar">
      {/* Live quote stream status */}
      <div className="sb-item" title={`Live quote stream: ${live}`}>
        <div className={`sb-dot ${STATUS_CLASS[live] ?? 'err'}`} />
        <span>{STATUS_LABEL[live] ?? 'OFFLINE'}</span>
      </div>

      {/* Market status */}
      <div className="sb-item" data-testid="ui2-market-status">
        <div className={`sb-dot ${marketOpen ? 'ok' : 'warn'}`} />
        <span>
          {marketOpen
            ? 'Market Open'
            : marketSession === 'pre'
            ? 'Pre-Market'
            : marketSession === 'post'
            ? 'After Hours'
            : 'Closed'}
        </span>
      </div>

      {/* NAV (real Alpaca paper account) */}
      <div className="sb-item" style={{ fontFamily: 'var(--mono)' }}>
        <span style={{ color: 'var(--tx2)' }}>NAV</span>
        <span style={{ color: equityChange == null ? 'var(--tx)' : equityChange >= 0 ? 'var(--up)' : 'var(--dn)' }}>
          {nav != null ? `$${nav.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '…'}
        </span>
        {equityChange != null && (
          <span style={{ color: equityChange >= 0 ? 'var(--up)' : 'var(--dn)', fontSize: 10, marginLeft: 4 }}>
            {equityChange >= 0 ? '+' : ''}${equityChange.toFixed(2)}
          </span>
        )}
      </div>

      {/* Live ticker tape */}
      <div className="sb-ticker">
        <div className="sb-tape">
          {tickerItems.length ? (
            [...tickerItems, ...tickerItems].map((item, i) => (
              <div key={i} className="tape-item">
                <span className="tape-sym">{item.sym}</span>
                <span className="tape-val">${item.price.toFixed(2)}</span>
                <span className={`tape-chg ${item.up ? 'up' : 'dn'}`}>
                  {item.up ? '+' : ''}
                  {item.pct.toFixed(2)}%
                </span>
              </div>
            ))
          ) : (
            <span style={{ color: 'var(--tx3)', fontFamily: 'var(--mono)', fontSize: 10 }}>
              waiting for live quotes…
            </span>
          )}
        </div>
      </div>

      <div className="sb-item" style={{ marginLeft: 'auto', color: 'var(--tx3)', fontSize: 10 }}>
        v2.0
      </div>
    </div>
  );
}
