// Bloomberg PP — Provider Pill
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

import React from 'react';

export interface ProviderPillProps {
  provider: string;
  mode: 'DEMO' | 'LOCAL';
  source: 'replay' | 'cache' | 'demo' | 'live';
  testIdPrefix?: string;
}

const MODE_COLOR: Record<string, string> = { DEMO: AMBER, LOCAL: BLUE };
const SOURCE_COLOR: Record<string, string> = {
  replay: GREEN, cache: SUBTLE, live: RED, demo: PURPLE,
};

const pill = (color: string) => ({
  display:'inline-block', padding:'1px 6px', borderRadius:2,
  background: color + '22', border:`1px solid ${color}`,
  color, fontSize:9, fontFamily:MONO, letterSpacing:1,
  whiteSpace:'nowrap' as const,
});

export function ProviderPill({ provider, mode, source, testIdPrefix = 'provider-pill' }: ProviderPillProps) {
  return (
    <div data-testid={testIdPrefix}
      style={{ display:'inline-flex', alignItems:'center', gap:4, fontFamily:MONO }}>
      <span data-testid={`${testIdPrefix}-mode`} style={pill(MODE_COLOR[mode] ?? AMBER)}>
        {mode}
      </span>
      <span data-testid={`${testIdPrefix}-provider`} style={pill(SUBTLE)}>
        {provider.toUpperCase()}
      </span>
      <span data-testid={`${testIdPrefix}-source`} style={pill(SOURCE_COLOR[source] ?? SUBTLE)}>
        {source.toUpperCase()}
      </span>
    </div>
  );
}

export interface ModeBannerProps {
  mode: 'DEMO' | 'LOCAL';
  replayAvailable: boolean;
  replayEnabled: boolean;
}

export function ModeBanner({ mode, replayAvailable, replayEnabled }: ModeBannerProps) {
  const color = mode === 'DEMO' ? AMBER : BLUE;

  let message = '';
  if (mode === 'DEMO') {
    message = replayAvailable
      ? 'DEMO MODE — USING REPLAY ARTIFACTS (100% DETERMINISTIC)'
      : 'DEMO MODE — USING FIXTURE FILES (NO NETWORK CALLS)';
  } else {
    message = replayEnabled
      ? 'LOCAL MODE — FETCHING LIVE DATA (REPLAYS WILL BE SAVED)'
      : 'LOCAL MODE — FETCHING LIVE DATA (READ-ONLY)';
  }

  return (
    <div data-testid="mode-banner"
      style={{
        width:'100%', borderLeft:`3px solid ${color}`,
        background: color + '11', padding:'5px 12px',
        fontFamily:MONO,
      }}>
      <div data-testid="mode-banner-text"
        style={{ color, fontSize:10, fontWeight:700, letterSpacing:0.5 }}>
        {message}
      </div>
      {replayAvailable && (
        <div data-testid="mode-banner-detail"
          style={{ color:SUBTLE, fontSize:9, marginTop:2 }}>
          REPLAY ARTIFACTS AVAILABLE — PROVIDER NETWORK CALLS BLOCKED
        </div>
      )}
    </div>
  );
}
