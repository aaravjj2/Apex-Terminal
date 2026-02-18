/**
 * v1.46 — Performance Attribution Panel
 * DEMO-first P&L breakdown by strategy, sector, time.
 */
import { useState, useEffect } from 'react';
import { API_BASE } from '../../config/api';

interface StrategyAttribution {
  strategy: string;
  pnl: number;
  trades: number;
  win_rate: number;
}

interface SectorAttribution {
  sector: string;
  pnl: number;
  weight: number;
}

interface BucketAttribution {
  bucket: string;
  pnl: number;
}

interface Attribution {
  total_pnl: number;
  period: string;
  by_strategy: StrategyAttribution[];
  by_sector: SectorAttribution[];
  by_bucket: BucketAttribution[];
}

export function AttributionPanel() {
  const [data, setData] = useState<Attribution | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/v1/attribution`)
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div data-testid="attribution-panel" className="h-full flex flex-col bg-background p-4">
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-lg font-semibold text-text">Performance Attribution</h2>
        <span className="text-xs text-text-muted bg-element-bg px-2 py-0.5 rounded">v1.46 — DEMO</span>
      </div>

      {loading && (
        <div data-testid="attribution-loading" className="animate-pulse space-y-3">
          <div className="h-20 bg-element-bg/50 rounded-lg" />
          <div className="h-40 bg-element-bg/50 rounded-lg" />
        </div>
      )}

      {!loading && !data && (
        <div data-testid="attribution-empty" className="text-center py-12 text-text-muted">
          <p className="text-sm">No attribution data</p>
        </div>
      )}

      {!loading && data && (
        <div className="flex-1 overflow-y-auto space-y-6">
          {/* Summary header */}
          <div data-testid="attribution-summary" className="p-4 rounded-lg border border-brand/30 bg-brand/5">
            <div className="text-xs text-text-muted mb-1">{data.period}</div>
            <div className={`text-2xl font-bold ${data.total_pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              ${data.total_pnl.toLocaleString()}
            </div>
            <div className="text-xs text-text-muted">Total P&L</div>
          </div>

          {/* By Strategy */}
          <div>
            <h3 className="text-sm font-semibold text-text mb-2">By Strategy</h3>
            <div className="space-y-2">
              {data.by_strategy.map((s, idx) => (
                <div key={s.strategy} data-testid={`attr-strategy-${idx}`} className="flex items-center gap-3 p-2 rounded-lg bg-element-bg/20">
                  <span className="text-sm text-text flex-1">{s.strategy}</span>
                  <span className="text-xs text-text-muted">{s.trades} trades</span>
                  <span className="text-xs text-text-muted">{(s.win_rate * 100).toFixed(0)}% win</span>
                  <span className={`text-sm font-mono ${s.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    ${s.pnl.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* By Sector */}
          <div>
            <h3 className="text-sm font-semibold text-text mb-2">By Sector</h3>
            <div className="space-y-2">
              {data.by_sector.map((s, idx) => (
                <div key={s.sector} data-testid={`attr-sector-${idx}`} className="flex items-center gap-3 p-2 rounded-lg bg-element-bg/20">
                  <span className="text-sm text-text flex-1">{s.sector}</span>
                  <div className="w-20 h-2 bg-element-bg rounded-full overflow-hidden">
                    <div className="h-full bg-brand rounded-full" style={{ width: `${s.weight * 100}%` }} />
                  </div>
                  <span className="text-xs text-text-muted">{(s.weight * 100).toFixed(0)}%</span>
                  <span className={`text-sm font-mono ${s.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    ${s.pnl.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* By Bucket */}
          <div>
            <h3 className="text-sm font-semibold text-text mb-2">By Time Bucket</h3>
            <div className="grid grid-cols-2 gap-3">
              {data.by_bucket.map((b, idx) => (
                <div key={b.bucket} data-testid={`attr-bucket-${idx}`} className="p-3 rounded-lg bg-element-bg/20 text-center">
                  <div className="text-xs text-text-muted">{b.bucket}</div>
                  <div className={`text-lg font-bold ${b.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    ${b.pnl.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div data-testid="attribution-panel-ready" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden' }}>ready</div>
    </div>
  );
}
