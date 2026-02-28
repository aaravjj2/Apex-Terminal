// Bloomberg TrustUX â€” data provenance badge
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

import { useEffect, useState } from 'react';
import React from 'react';
import { useAppStore, type AppMode, type ProviderName } from '../../../state/appStore';

interface DataSource { symbol: string; provider: string; type: 'bars' | 'options' | 'fundamentals'; status: 'live' | 'cached' | 'unavailable' }
interface TrustMetrics { mode: AppMode; primaryProvider: ProviderName | null; providerHealth: 'healthy' | 'degraded' | 'offline'; lastTickTime: number | null; dataSources: DataSource[]; alpacaKeysConfigured: boolean }

function modeColor(m: AppMode) { return m === 'LIVE' ? GREEN : m === 'PAPER' ? AMBER : m === 'REPLAY' ? BLUE : SUBTLE; }
function healthColor(h: string) { return h === 'healthy' ? GREEN : h === 'degraded' ? AMBER : RED; }
function srcColor(s: string) { return s === 'live' ? GREEN : s === 'cached' ? BLUE : RED; }

export function TrustUX() {
  const { mode, symbol, providers } = useAppStore();
  const [metrics, setMetrics] = useState<TrustMetrics>({ mode, primaryProvider: null, providerHealth: 'offline', lastTickTime: null, dataSources: [], alpacaKeysConfigured: false });
  const [showDetails, setShowDetails] = useState(false);
  const [isStale, setIsStale] = useState(false);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const healthRes = await fetch('/health');
        const healthData = await healthRes.json();
        const alpacaConfigured = healthData.alpaca_configured || false;
        const alpacaConnected = healthData.alpaca_connected || false;
        const ingestRes = await fetch('/api/v1/ingest/status');
        const ingestData = await ingestRes.json();

        let primaryProvider: ProviderName | null = null;
        if (providers.alpaca.status === 'connected') primaryProvider = 'alpaca';
        else if (providers.finnhub.status === 'connected') primaryProvider = 'finnhub';
        else if (providers.yahoo.status === 'connected') primaryProvider = 'yahoo';

        const providerHealth = primaryProvider && providers[primaryProvider]?.status === 'connected' ? 'healthy' : primaryProvider && providers[primaryProvider]?.status === 'error' ? 'offline' : 'degraded';

        const dataSources: DataSource[] = [
          { symbol, provider: alpacaConnected ? 'Alpaca (LIVE)' : alpacaConfigured ? 'Alpaca (configured)' : 'Mock CSV', type: 'bars', status: alpacaConnected ? 'live' : 'cached' },
          { symbol, provider: healthData.options_provider === 'tradier' ? 'Tradier' : 'yfinance', type: 'options', status: healthData.tradier_connected ? 'live' : 'cached' },
        ];

        setMetrics({ mode, primaryProvider, providerHealth, lastTickTime: ingestData.last_tick_time || null, dataSources, alpacaKeysConfigured: alpacaConfigured });
      } catch { setMetrics(prev => ({ ...prev, providerHealth: 'offline' })); }
    };
    fetchHealth();
    const i = setInterval(fetchHealth, 15000);
    return () => clearInterval(i);
  }, [mode, symbol, providers]);

  useEffect(() => {
    if (mode === 'LIVE' && metrics.lastTickTime) {
      const check = () => setIsStale(Date.now() - metrics.lastTickTime! > 5000);
      check();
      const i = setInterval(check, 1000);
      return () => clearInterval(i);
    } else { setIsStale(false); }
  }, [mode, metrics.lastTickTime]);

  const formatLastTick = () => {
    if (!metrics.lastTickTime) return 'NO DATA';
    const age = Date.now() - metrics.lastTickTime;
    if (age < 1000) return 'JUST NOW';
    if (age < 60000) return `${Math.floor(age / 1000)}S AGO`;
    return `${Math.floor(age / 60000)}M AGO`;
  };

  const mc = modeColor(mode);

  return (
    <div style={{ position: 'fixed', bottom: 16, right: 16, zIndex: 9100, fontFamily: MONO }}>
      {/* Badge */}
      <button onClick={() => setShowDetails(!showDetails)}
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: mc + '22', border: `1px solid ${mc}`, borderRadius: 2, cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: mc }} />
        <span style={{ color: mc, fontSize: 9, fontWeight: 700, letterSpacing: 1 }}>{mode}</span>
        <div style={{ width: 1, height: 12, background: mc + '44' }} />
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: healthColor(metrics.providerHealth) }} />
        {isStale && mode === 'LIVE' && <span style={{ color: AMBER, fontSize: 9 }}>âš </span>}
      </button>

      {/* Details panel */}
      {showDetails && (
        <div style={{ position: 'absolute', bottom: 36, right: 0, width: 340, background: PANEL, border: `1px solid ${AMBER}`, borderRadius: 2, padding: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${BORDER}`, paddingBottom: 8, marginBottom: 10 }}>
            <span style={{ color: AMBER, fontSize: 10, fontWeight: 700, letterSpacing: 0.5 }}>TRUST & PROVENANCE</span>
            <button onClick={() => setShowDetails(false)} style={{ background: 'none', border: 'none', color: SUBTLE, cursor: 'pointer', fontSize: 10 }}>CLOSE âœ•</button>
          </div>

          {/* Mode */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 8, color: SUBTLE, letterSpacing: 0.5, marginBottom: 3 }}>MODE</div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px', background: mc + '22', border: `1px solid ${mc}`, borderRadius: 2, fontSize: 9, color: mc, fontWeight: 700 }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: mc }} />
              {mode}
            </div>
          </div>

          {/* Provider health */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 8, color: SUBTLE, letterSpacing: 0.5, marginBottom: 3 }}>PROVIDER HEALTH</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: healthColor(metrics.providerHealth) }} />
              <span style={{ color: healthColor(metrics.providerHealth), fontWeight: 700 }}>{metrics.providerHealth.toUpperCase()}</span>
              {metrics.primaryProvider && <span style={{ color: SUBTLE, fontSize: 9 }}>({metrics.primaryProvider})</span>}
            </div>
          </div>

          {/* Last tick */}
          {mode === 'LIVE' && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 8, color: SUBTLE, letterSpacing: 0.5, marginBottom: 3 }}>LAST TICK</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10 }}>
                <span style={{ color: isStale ? AMBER : GREEN }}>â±</span>
                <span style={{ color: isStale ? AMBER : GREEN }}>{formatLastTick()}</span>
                {isStale && <span style={{ fontSize: 8, color: AMBER, background: AMBER + '22', border: `1px solid ${AMBER}`, padding: '1px 4px', borderRadius: 2 }}>STALE</span>}
              </div>
            </div>
          )}

          {/* Data sources */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 8, color: SUBTLE, letterSpacing: 0.5, marginBottom: 6 }}>DATA SOURCES</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {metrics.dataSources.map((src, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px', background: BG, border: `1px solid ${BORDER}`, borderRadius: 2 }}>
                  <div style={{ display: 'flex', gap: 6, fontSize: 9 }}>
                    <span style={{ color: SUBTLE }}>{src.type.toUpperCase()}:</span>
                    <span style={{ color: TEXT }}>{src.provider}</span>
                  </div>
                  <span style={{ fontSize: 8, padding: '1px 5px', background: srcColor(src.status) + '22', border: `1px solid ${srcColor(src.status)}`, color: srcColor(src.status), borderRadius: 2 }}>{src.status.toUpperCase()}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Alpaca API */}
          <div>
            <div style={{ fontSize: 8, color: SUBTLE, letterSpacing: 0.5, marginBottom: 3 }}>ALPACA API</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: metrics.alpacaKeysConfigured ? GREEN : AMBER }} />
              <span style={{ color: metrics.alpacaKeysConfigured ? GREEN : AMBER }}>
                {metrics.alpacaKeysConfigured ? 'KEYS CONFIGURED' : 'NO KEYS â€” USING MOCK DATA'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
