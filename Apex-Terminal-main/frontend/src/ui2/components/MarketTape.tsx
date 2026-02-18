/**
 * v1.56 — MarketTape Component
 * Scrolling ticker tape with deterministic stream simulation
 */

import { useState, useEffect } from 'react';
import { streamSimulator, type StreamTick } from '../stores/streamSimulator';

interface MarketTapeProps {
  testId?: string;
}

export function MarketTape({ testId = 'ui2-market-tape' }: MarketTapeProps) {
  const [ticks, setTicks] = useState<StreamTick[]>([]);
  const [status, setStatus] = useState(streamSimulator.status);

  useEffect(() => {
    // Start the simulator
    streamSimulator.reset();
    streamSimulator.start(2000);
    setStatus(streamSimulator.status);

    const unsub = streamSimulator.subscribe((tick) => {
      setTicks(prev => {
        const updated = [...prev];
        const idx = updated.findIndex(t => t.symbol === tick.symbol);
        if (idx >= 0) {
          updated[idx] = tick;
        } else {
          updated.push(tick);
        }
        return updated.sort((a, b) => a.symbol.localeCompare(b.symbol));
      });
      setStatus(streamSimulator.status);
    });

    return () => {
      unsub();
      streamSimulator.stop();
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
          background: status === 'demo' ? 'rgba(34,197,94,0.15)' : 'rgba(148,163,184,0.15)',
          color: status === 'demo' ? 'var(--ui2-success)' : 'var(--ui2-text-muted)',
          fontWeight: 600,
          fontSize: '10px',
          textTransform: 'uppercase',
          flexShrink: 0,
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: status === 'demo' ? 'var(--ui2-success)' : 'var(--ui2-text-muted)' }} />
        {status === 'demo' ? 'DEMO STREAM' : status === 'replay' ? 'REPLAY' : 'OFFLINE'}
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
