/**
 * L2OrderBookPanel — Level 2 bid/ask ladder
 * Fetches from /api/v1/orderbook or uses mock data
 */

import { useState, useEffect, useCallback } from 'react';

export interface OrderBookLevel {
  price: number;
  size: number;
  delta?: number;
}

export interface L2OrderBookPanelProps {
  symbol?: string;
  levels?: number;
  className?: string;
}

const MOCK_BIDS: OrderBookLevel[] = [
  { price: 547.22, size: 1200, delta: 50 },
  { price: 547.21, size: 800, delta: -20 },
  { price: 547.20, size: 2100, delta: 100 },
  { price: 547.19, size: 450, delta: 0 },
  { price: 547.18, size: 1800, delta: -30 },
  { price: 547.17, size: 600, delta: 15 },
  { price: 547.16, size: 900, delta: 0 },
  { price: 547.15, size: 1100, delta: -50 },
  { price: 547.14, size: 700, delta: 25 },
  { price: 547.13, size: 400, delta: 0 },
];

const MOCK_ASKS: OrderBookLevel[] = [
  { price: 547.23, size: 950, delta: -40 },
  { price: 547.24, size: 1300, delta: 60 },
  { price: 547.25, size: 550, delta: 0 },
  { price: 547.26, size: 1700, delta: -80 },
  { price: 547.27, size: 400, delta: 10 },
  { price: 547.28, size: 1100, delta: 0 },
  { price: 547.29, size: 800, delta: -20 },
  { price: 547.30, size: 600, delta: 30 },
  { price: 547.31, size: 350, delta: 0 },
  { price: 547.32, size: 900, delta: -15 },
];

export function L2OrderBookPanel({
  symbol = 'SPY',
  levels = 10,
  className,
}: L2OrderBookPanelProps) {
  const [bids, setBids] = useState<OrderBookLevel[]>([]);
  const [asks, setAsks] = useState<OrderBookLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrderBook = useCallback(async (sym: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/orderbook?symbol=${encodeURIComponent(sym)}&levels=${levels}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const bidsRaw = data.bids ?? data.bid ?? [];
      const asksRaw = data.asks ?? data.ask ?? [];
      setBids(
        bidsRaw.slice(0, levels).map((r: { price?: number; size?: number; qty?: number; delta?: number } | number[]) =>
          Array.isArray(r)
            ? { price: r[0], size: r[1], delta: r[2] }
            : { price: r.price ?? 0, size: r.size ?? r.qty ?? 0, delta: r.delta }
        )
      );
      setAsks(
        asksRaw.slice(0, levels).map((r: { price?: number; size?: number; qty?: number; delta?: number } | number[]) =>
          Array.isArray(r)
            ? { price: r[0], size: r[1], delta: r[2] }
            : { price: r.price ?? 0, size: r.size ?? r.qty ?? 0, delta: r.delta }
        )
      );
    } catch {
      setError('API unavailable');
      setBids(MOCK_BIDS.slice(0, levels));
      setAsks(MOCK_ASKS.slice(0, levels));
    } finally {
      setLoading(false);
    }
  }, [levels]);

  useEffect(() => {
    fetchOrderBook(symbol);
  }, [symbol, fetchOrderBook]);

  const bg = '#0a0a0a';
  const border = '#1e1e1e';
  const text = '#d1d4dc';
  const up = '#26a69a';
  const dn = '#ef5350';
  const subtle = '#555';

  return (
    <div
      data-testid="l2-orderbook-panel"
      className={className}
      style={{
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 4,
        overflow: 'hidden',
        fontFamily: '"Roboto Mono", monospace',
      }}
    >
      <div
        style={{
          padding: '6px 10px',
          borderBottom: `1px solid ${border}`,
          fontSize: 11,
          fontWeight: 700,
          color: text,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span>{symbol} — Order Book</span>
        {loading && <span style={{ fontSize: 10, color: subtle }}>…</span>}
        {error && <span style={{ fontSize: 10, color: dn }}>{error}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', fontSize: 10 }}>
        {/* Bids */}
        <div style={{ borderRight: `1px solid ${border}` }}>
          <div
            style={{
              padding: '4px 8px',
              background: 'rgba(38, 166, 154, 0.1)',
              fontSize: 9,
              fontWeight: 600,
              color: up,
              letterSpacing: '0.05em',
            }}
          >
            BIDS
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '4px 8px', color: subtle, fontWeight: 600 }}>Price</th>
                <th style={{ textAlign: 'right', padding: '4px 8px', color: subtle, fontWeight: 600 }}>Size</th>
                <th style={{ textAlign: 'right', padding: '4px 8px', color: subtle, fontWeight: 600 }}>Δ</th>
              </tr>
            </thead>
            <tbody>
              {bids.map((r, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${border}40` }}>
                  <td style={{ padding: '3px 8px', color: up }}>{r.price.toFixed(2)}</td>
                  <td style={{ padding: '3px 8px', textAlign: 'right', color: text }}>{r.size.toLocaleString()}</td>
                  <td style={{ padding: '3px 8px', textAlign: 'right', color: r.delta != null ? (r.delta >= 0 ? up : dn) : subtle }}>{r.delta != null ? (r.delta >= 0 ? '+' : '') + r.delta : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Asks */}
        <div>
          <div
            style={{
              padding: '4px 8px',
              background: 'rgba(239, 83, 80, 0.1)',
              fontSize: 9,
              fontWeight: 600,
              color: dn,
              letterSpacing: '0.05em',
            }}
          >
            ASKS
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '4px 8px', color: subtle, fontWeight: 600 }}>Price</th>
                <th style={{ textAlign: 'right', padding: '4px 8px', color: subtle, fontWeight: 600 }}>Size</th>
                <th style={{ textAlign: 'right', padding: '4px 8px', color: subtle, fontWeight: 600 }}>Δ</th>
              </tr>
            </thead>
            <tbody>
              {asks.map((r, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${border}40` }}>
                  <td style={{ padding: '3px 8px', color: dn }}>{r.price.toFixed(2)}</td>
                  <td style={{ padding: '3px 8px', textAlign: 'right', color: text }}>{r.size.toLocaleString()}</td>
                  <td style={{ padding: '3px 8px', textAlign: 'right', color: r.delta != null ? (r.delta >= 0 ? up : dn) : subtle }}>{r.delta != null ? (r.delta >= 0 ? '+' : '') + r.delta : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default L2OrderBookPanel;
