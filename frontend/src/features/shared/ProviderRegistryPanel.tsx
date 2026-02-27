// Bloomberg PRP — Provider Registry Panel
const BG = '#0a0a0a';
const PANEL = '#111111';
const BORDER = '#1e1e1e';
const AMBER = '#f5a623';
const GREEN = '#26a69a';
const RED = '#ef5350';
const BLUE = '#42a5f5';
const PURPLE = '#ab47bc';
const SUBTLE = '#555';
const TEXT = '#d1d4dc';
const MONO = '"Roboto Mono","Courier New",monospace';

import { useState, useEffect } from 'react';
import React from 'react';

interface Provider {
  name: string;
  mode: string;
  enabled: boolean;
  subsystem: string;
  replay_status: string | null;
  metadata: Record<string, unknown>;
}

const DEMO_PROVIDERS: Provider[] = [
  { name: 'demo_fixtures',  mode: 'demo',    enabled: true,  subsystem: 'market_data', replay_status: null,         metadata: {} },
  { name: 'cboe_delayed',   mode: 'delayed', enabled: true,  subsystem: 'options',     replay_status: null,         metadata: {} },
  { name: 'polygon',        mode: 'live',    enabled: false, subsystem: 'market_data', replay_status: 'ready',      metadata: {} },
  { name: 'alpaca',         mode: 'live',    enabled: false, subsystem: 'trading',     replay_status: null,         metadata: {} },
];

const MODE_COLORS: Record<string, string> = { live: RED, demo: AMBER, delayed: BLUE, cache: PURPLE };

const badge = (color: string) => ({
  display:'inline-block', padding:'0 5px', borderRadius:2,
  background: color + '22', border:`1px solid ${color}`,
  color, fontSize:8, fontFamily:MONO, letterSpacing:1,
  whiteSpace:'nowrap' as const,
});

export function ProviderRegistryPanel() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/v1/provider-registry/providers', { signal: AbortSignal.timeout(3000) })
      .then(r => r.json())
      .then(data => { setProviders(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => { setProviders(DEMO_PROVIDERS); setLoading(false); });
  }, []);

  if (loading) {
    return (
      <div data-testid="provider-registry"
        style={{ padding:8, background:PANEL, border:`1px solid ${BORDER}`, borderRadius:2, fontFamily:MONO }}>
        <div data-testid="provider-registry-loading">
          {[1,2,3].map(i => (
            <div key={i} style={{ height:22, background:BG, borderRadius:2, marginBottom:4, opacity:0.6 - i*0.1 }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div data-testid="provider-registry"
      style={{ background:PANEL, border:`1px solid ${BORDER}`, borderRadius:2, fontFamily:MONO }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'4px 8px', borderBottom:`1px solid ${BORDER}`, background:BG }}>
        <span style={{ color:AMBER, fontWeight:700, fontSize:10, letterSpacing:1 }}>PROVIDER REGISTRY</span>
        <span style={{ color:SUBTLE, fontSize:9 }}>{providers.length} PROVIDERS</span>
      </div>

      {/* Column headers */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 60px 36px 80px 52px', gap:4, padding:'3px 8px', borderBottom:`1px solid ${BORDER}` }}>
        {['PROVIDER','MODE','STATUS','SUBSYSTEM','REPLAY'].map(h => (
          <span key={h} style={{ color:SUBTLE, fontSize:8, letterSpacing:0.5 }}>{h}</span>
        ))}
      </div>

      {/* Rows */}
      <div>
        {providers.map((p, i) => {
          const modeColor = MODE_COLORS[p.mode] ?? SUBTLE;
          return (
            <div key={p.name}
              data-testid={`provider-row-${p.name}`}
              style={{
                display:'grid', gridTemplateColumns:'1fr 60px 36px 80px 52px', gap:4,
                padding:'4px 8px', alignItems:'center',
                borderBottom: i < providers.length-1 ? `1px solid ${BORDER}` : 'none',
                background: i % 2 === 0 ? BG : PANEL,
              }}>
              <span style={{ color:TEXT, fontSize:10, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</span>
              <span data-testid="provider-mode" style={badge(modeColor)}>{p.mode.toUpperCase()}</span>
              <span data-testid="provider-enabled" style={badge(p.enabled ? GREEN : RED)}>
                {p.enabled ? 'ON' : 'OFF'}
              </span>
              <span data-testid="provider-subsystem" style={{ color:SUBTLE, fontSize:9, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {p.subsystem}
              </span>
              {p.replay_status ? (
                <span data-testid="provider-replay" style={badge(PURPLE)}>{p.replay_status}</span>
              ) : (
                <span style={{ color:SUBTLE, fontSize:9 }}>—</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
