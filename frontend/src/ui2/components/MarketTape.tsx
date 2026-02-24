/**
 * v1.56 — MarketTape Component
 * Scrolling ticker tape with live prices from backend API.
 * Falls back to streamSimulator if API unavailable.
 */

import { useState, useEffect, useRef } from 'react';
import { streamSimulator, type StreamTick } from '../stores/streamSimulator';

const SYMBOLS = ['AAPL', 'MSFT', 'NVDA', 'SPY', 'TSLA'];
const QUOTE_INTERVAL_MS = 15_000; // refresh every 15 s

async function fetchQuote(symbol: string): Promise<number | null> {
  try {
    const res = await fetch('/api/v1/market-data/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol }),
    });
    if (!res.ok) return null;
    const d = await res.json();
    return typeof d.price === 'number' && d.price > 0 ? d.price : null;
  } catch {
    return null;
  }
}

interface MarketTapeProps {
  testId?: string;
}

export function MarketTape({ testId = 'ui2-market-tape' }: MarketTapeProps) {
  const [ticks, setTicks] = useState<StreamTick[]>([]);
  const [status, setStatus] = useState<'live' | 'replay' | 'offline' | 'disconnected'>('disconnected');
  const prevPricesRef = useRef<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;

    // Merge a real price into ticks, computing change vs previous
    function applyRealPrice(symbol: string, price: number) {
      if (cancelled) return;
      const prev = prevPricesRef.current[symbol] ?? price;
      const change = Math.round((price - prev) * 100) / 100;
      const changePct = prev > 0 ? Math.round(((price - prev) / prev) * 10000) / 100 : 0;
      prevPricesRef.current[symbol] = price;

      const tick: StreamTick = {
        symbol,
        price,
        change,
        changePct,
        volume: 0,
        timestamp: Date.now(),
        sequence: 0,
      };
      setTicks(prev => {
        const updated = [...prev];
        const idx = updated.findIndex(t => t.symbol === symbol);
        if (idx >= 0) updated[idx] = tick; else updated.push(tick);
        return updated.sort((a, b) => a.symbol.localeCompare(b.symbol));
      });
    }

    // Fetch all symbols from real API
    async function fetchAll() {
      let anySuccess = false;
      await Promise.all(
        SYMBOLS.map(async sym => {
          const price = await fetchQuote(sym);
          if (price !== null) {
            anySuccess = true;
            applyRealPrice(sym, price);
          }
        })
      );
      if (!cancelled) {
        setStatus(anySuccess ? 'live' : 'offline');
      }
      return anySuccess;
    }

    // Initial fetch; fall back to simulator if backend unavailable
    fetchAll().then(ok => {
      if (cancelled) return;
      if (!ok) {
        // Backend quotes unavailable — use simulator
        streamSimulator.reset();
        streamSimulator.start(2000);
        setStatus(streamSimulator.status as any);
        try { (window as any).__streamSimulator = streamSimulator; } catch { /* no-op */ }
      }
    });

    // Subscribe to simulator for fast updates between real fetches
    const unsub = streamSimulator.subscribe(tick => {
      if (cancelled) return;
      // Only apply simulator updates for symbols that don't yet have real data
      setTicks(prev => {
        const hasPrev = prev.some(t => t.symbol === tick.symbol);
        if (hasPrev) {
          // If we have a real price (non-zero prev), don't overwrite with sim
          if (prevPricesRef.current[tick.symbol]) return prev;
        }
        const updated = [...prev];
        const idx = updated.findIndex(t => t.symbol === tick.symbol);
        if (idx >= 0) updated[idx] = tick; else updated.push(tick);
        return updated.sort((a, b) => a.symbol.localeCompare(b.symbol));
      });
    });

    // Poll real API every 15 s
    const pollTimer = setInterval(fetchAll, QUOTE_INTERVAL_MS);

    // Expose simulator on window for E2E determinism checks
    try { (window as any).__streamSimulator = streamSimulator; } catch { /* no-op */ }

    return () => {
      cancelled = true;
      unsub();
      clearInterval(pollTimer);
      streamSimulator.stop();
      try { delete (window as any).__streamSimulator; } catch { /* no-op */ }
    };
  }, []);

  return (
    <div
      data-testid={testId}
      data-stream-status={status}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: '4px 16px',
        background: 'var(--ui2-bg-elevated)',
        borderBottom: '1px solid var(--ui2-border)',
        fontSize: '12px',
        fontFamily: 'var(--ui2-font-mono, monospace)',
        overflow: 'hidden',
        height: '28px',
      }}
    >
      {/* Connection status badge */}
      <div
        data-testid={`${testId}-status`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '2px 8px',
          borderRadius: 'var(--ui2-radius-sm)',
          background: status === 'live' ? 'rgba(34,197,94,0.15)' : 'rgba(148,163,184,0.15)',
          color: status === 'live' ? 'var(--ui2-success)' : 'var(--ui2-text-muted)',
          fontWeight: 600,
          fontSize: '10px',
          textTransform: 'uppercase',
          flexShrink: 0,
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: status === 'live' ? 'var(--ui2-success)' : 'var(--ui2-text-muted)' }} />
        {status === 'live' ? 'LIVE' : status === 'replay' ? 'REPLAY' : 'OFFLINE'}
      </div>

      {/* Ticker symbols */}
      <div style={{ display: 'flex', gap: '16px', flex: 1, overflow: 'hidden' }}>
        {ticks.map(tick => (
          <div
            key={tick.symbol}
            data-testid={`${testId}-tick-${tick.symbol}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              flexShrink: 0,
            }}
          >
            <span style={{ fontWeight: 600, color: 'var(--ui2-text-primary)' }}>
              {tick.symbol}
            </span>
            <span style={{ color: 'var(--ui2-text-secondary)' }}>
              {tick.price.toFixed(2)}
            </span>
            <span
              data-testid={`${testId}-change-${tick.symbol}`}
              style={{
                color: tick.change >= 0 ? 'var(--ui2-success)' : 'var(--ui2-danger)',
                fontWeight: 500,
              }}
            >
              {tick.change >= 0 ? '+' : ''}{tick.changePct.toFixed(2)}%
            </span>
          </div>
        ))}
      </div>

      {/* Hidden latest-tick snapshots (exposed for E2E checks) */}
      <div aria-hidden="true" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 }}>
        {ticks.map(t => (
          <span key={t.symbol} data-testid={`ui2-stream-latest-${t.symbol}`}>{t.price.toFixed(2)}</span>
        ))}
      </div>

      {/* Sequence counter for determinism verification */}
      <div
        data-testid={`${testId}-sequence`}
        style={{
          color: 'var(--ui2-text-muted)',
          fontSize: '10px',
          flexShrink: 0,
        }}
      >
        seq:{ticks.length > 0 ? Math.max(...ticks.map(t => t.sequence)) : 0}
      </div>
    </div>
  );
}
