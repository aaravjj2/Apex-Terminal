import { useEffect, useState } from 'react';

import { useArbStream } from '@/arb/hooks/useArbStream';
import { useArbStore } from '@/arb/lib/useArbStore';
import { cn } from '@/tcc/lib/cn';

export function ArbTracker() {
  useArbStream('/api/arb/stream');
  const opportunities = useArbStore((s) => s.opportunities);
  const isConnected = useArbStore((s) => s.streamConnected);
  const patchMode = useArbStore((s) => s.patchMode);
  const maxEdge = useArbStore((s) => s.maxEdge);
  const lastPatchAt = useArbStore((s) => s.lastPatchAt);
  const [demoMode, setDemoMode] = useState(false);

  useEffect(() => {
    fetch('/api/demo/status')
      .then((r) => r.json())
      .then((d) => setDemoMode(Boolean(d.demo_mode)))
      .catch(() => setDemoMode(false));
  }, []);

  const loading = !isConnected && opportunities.length === 0;

  const handlePaperTrade = async (id: string) => {
    try {
      const res = await fetch(`/api/arb/${id}/paper-trade`, { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        const k = (body as { kalshi_order_id?: string }).kalshi_order_id;
        const p = (body as { poly_order_id?: string }).poly_order_id;
        alert(`Paper trade OK\nKalshi: ${k}\nPolymarket: ${p}`);
      } else {
        const detail = (body as { detail?: string }).detail || res.statusText;
        alert(`Paper trade rejected: ${detail}`);
      }
    } catch {
      alert('Paper trade failed — is the API running?');
    }
  };

  return (
    <section className="arb-tracker" data-testid="arb-tracker" aria-label="Arbitrage tracker">
      <div className="arb-tracker__header">
        <div>
          <h2 className="arb-tracker__title">Arb Radar</h2>
          <p className="arb-tracker__sub">Kalshi ↔ Polymarket · live spreads</p>
        </div>
        <div className="arb-tracker__stats">
          <span
            data-testid="arb-connection"
            className={cn('arb-pill', isConnected ? 'arb-pill--ok' : 'arb-pill--bad')}
          >
            {isConnected ? 'Live' : 'Offline'}
          </span>
          <span className="arb-pill" data-testid="arb-patch-mode">
            {patchMode ? 'Patch' : 'Full'}
          </span>
          <span className="arb-pill">
            Max <strong>{(maxEdge * 100).toFixed(1)}%</strong>
          </span>
          <span className="arb-pill">
            Pairs <strong>{opportunities.length}</strong>
          </span>
          {lastPatchAt ? (
            <span className="arb-pill arb-pill--muted" data-testid="arb-last-updated">
              {new Date(lastPatchAt).toLocaleTimeString()}
            </span>
          ) : null}
          {demoMode ? <span className="arb-pill arb-pill--muted">Demo</span> : null}
        </div>
      </div>

      <div className="arb-tracker__body">
        {loading ? (
          <p className="arb-empty" data-testid="arb-loading">
            Connecting to arb stream…
          </p>
        ) : opportunities.length === 0 ? (
          <p className="arb-empty" data-testid="arb-empty">
            No arbitrage opportunities found
          </p>
        ) : (
          <table className="arb-table">
            <thead>
              <tr>
                <th>Event</th>
                <th>K</th>
                <th>P</th>
                <th>Net</th>
                <th>Match</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {opportunities.map((opp) => (
                <tr key={opp.id} data-testid={`arb-row-${opp.id}`}>
                  <td>
                    <div className="arb-ticker">{opp.kalshi_ticker}</div>
                    <div className="arb-question" title={opp.question}>
                      {opp.question}
                    </div>
                  </td>
                  <td className="arb-num">${opp.kalshi_yes_ask.toFixed(3)}</td>
                  <td className="arb-num">${opp.poly_no_ask.toFixed(3)}</td>
                  <td className="arb-num arb-num--edge">{(opp.net_edge * 100).toFixed(1)}%</td>
                  <td>
                    <span
                      className={cn(
                        'arb-match',
                        opp.settlement_match_score >= 0.75
                          ? 'arb-match--high'
                          : opp.settlement_match_score >= 0.45
                            ? 'arb-match--mid'
                            : 'arb-match--low',
                      )}
                    >
                      {(opp.settlement_match_score * 100).toFixed(0)}%
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="arb-btn"
                      data-testid={`arb-paper-${opp.id}`}
                      onClick={() => handlePaperTrade(opp.id)}
                    >
                      Paper
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
