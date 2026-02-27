// Bloomberg RV — Replay View
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

import { useState } from 'react';
import React from 'react';
import { ChartCanvas } from '../../chart/ChartCanvas';
import { ChartHeaderStrip } from '../../chart/ChartHeaderStrip';
import { ReplayControlBar } from '../../replay/ReplayControlBar';
import { useAppStore } from '../../../state/appStore';

function ReplayRightDock() {
  const { parityMismatch } = useAppStore();
  const [tab, setTab] = useState<'events'|'markers'>('events');

  const events = [
    { time: 'SYSTEM', type: 'info',  message: 'Replay session active' },
    ...(parityMismatch ? [{ time: 'ALERT', type: 'error', message: 'Determinism mismatch detected' }] : []),
  ];

  return (
    <div style={{ height:'100%', background:PANEL, borderLeft:`1px solid ${BORDER}`, display:'flex', flexDirection:'column', fontFamily:MONO }}>
      {/* Tab bar */}
      <div style={{ display:'flex', borderBottom:`1px solid ${BORDER}`, background:BG }}>
        {(['events','markers'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{
              flex:1, padding:'5px 0', background:'transparent', border:'none',
              borderBottom: tab===t ? `2px solid ${BLUE}` : '2px solid transparent',
              color: tab===t ? BLUE : SUBTLE, fontFamily:MONO, fontSize:9, fontWeight:700,
              cursor:'pointer', letterSpacing:1,
            }}>
            {t === 'events' ? '◉ EVENTS' : '◈ MARKERS'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex:1, overflow:'auto', padding:6 }}>
        {tab === 'events' && (
          <div>
            {events.map((evt, i) => (
              <div key={i} style={{
                display:'flex', alignItems:'flex-start', gap:6, padding:'4px 6px',
                marginBottom:2, background:BG, border:`1px solid ${BORDER}`,
                borderLeft:`2px solid ${evt.type === 'error' ? RED : BLUE}`, borderRadius:2,
              }}>
                <span style={{ color:SUBTLE, fontSize:8, flexShrink:0, paddingTop:1 }}>{evt.time}</span>
                <span style={{ color: evt.type === 'error' ? RED : BLUE, fontSize:8, flexShrink:0 }}>
                  [{evt.type.toUpperCase()}]
                </span>
                <span style={{ color:TEXT, fontSize:9 }}>{evt.message}</span>
              </div>
            ))}
          </div>
        )}
        {tab === 'markers' && (
          <div style={{ color:SUBTLE, fontSize:9, textAlign:'center', paddingTop:16 }}>NO MARKERS SET — CLICK CHART TO ADD</div>
        )}
      </div>

      {/* Determinism proof */}
      <div style={{ padding:'6px 10px', borderTop:`1px solid ${BORDER}`, background:BG }}>
        <div style={{ color:SUBTLE, fontSize:8, letterSpacing:1, marginBottom:4 }}>DETERMINISM PROOF</div>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ color:SUBTLE, fontSize:9 }}>PARITY STATUS</span>
          <span style={{
            padding:'1px 6px', borderRadius:2, fontSize:8,
            background: parityMismatch ? RED+'22' : GREEN+'22',
            border:`1px solid ${parityMismatch ? RED : GREEN}`,
            color: parityMismatch ? RED : GREEN,
          }}>{parityMismatch ? 'MISMATCH' : 'SYNCED'}</span>
        </div>
      </div>
    </div>
  );
}

export function ReplayView() {
  return (
    <div data-testid="replay-view"
      style={{ height:'100%', display:'flex', flexDirection:'column', background:BG, fontFamily:MONO }}>
      <ReplayControlBar />

      {/* Main split */}
      <div style={{ flex:1, display:'flex', overflow:'hidden', minHeight:0 }}>
        {/* Chart area */}
        <div style={{ flex:'0 0 75%', display:'flex', flexDirection:'column', overflow:'hidden' }}>
          <ChartHeaderStrip />
          <div style={{ flex:1, position:'relative' }}>
            <ChartCanvas style={{ position:'absolute', inset:0 }} />
          </div>
        </div>

        {/* Right dock — resize handle */}
        <div style={{ width:4, background:BORDER, cursor:'col-resize', flexShrink:0 }} />

        {/* Right dock */}
        <div style={{ flex:'0 0 25%', minWidth:180, maxWidth:'40%', overflow:'hidden' }}>
          <ReplayRightDock />
        </div>
      </div>
    </div>
  );
}
