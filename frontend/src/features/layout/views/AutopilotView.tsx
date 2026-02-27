// Bloomberg AV — Autopilot View
const BG = '#0a0a0a';
const PANEL = '#111111';
const BORDER = '#1e1e1e';
const AMBER = '#f5a623';
const GREEN = '#26a69a';
const BLUE = '#42a5f5';
const PURPLE = '#ab47bc';
const SUBTLE = '#555';
const TEXT = '#d1d4dc';
const MONO = '"Roboto Mono","Courier New",monospace';

import { useState } from 'react';
import React from 'react';
import {
  AutopilotDashboard,
  AutopilotPositions,
  AutopilotActivity,
  AutopilotSettings,
} from '../../autopilot/components';
import { AIPanel } from './AIPanel';
import { useAppStore } from '../../../state/appStore';

type TabId = 'dashboard' | 'positions' | 'activity' | 'settings';

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'DASHBOARD', icon: '◉' },
  { id: 'positions', label: 'POSITIONS', icon: '▤' },
  { id: 'activity',  label: 'ACTIVITY',  icon: '≋' },
  { id: 'settings',  label: 'SETTINGS',  icon: '⚙' },
];

const TAB_COLOR: Record<TabId, string> = { dashboard: AMBER, positions: GREEN, activity: BLUE, settings: PURPLE };

export function AutopilotView() {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const { symbol } = useAppStore();

  return (
    <div data-testid="autopilot-view"
      style={{ height:'100%', width:'100%', display:'flex', flexDirection:'column', background:BG, fontFamily:MONO }}>

      {/* Header */}
      <div data-testid="autopilot-header"
        style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'6px 12px', background:PANEL, borderBottom:`1px solid ${BORDER}` }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ color:PURPLE, fontSize:16 }}>◎</span>
          <div>
            <div style={{ color:AMBER, fontWeight:700, fontSize:11, letterSpacing:1 }}>APEX AUTOPILOT</div>
            <div style={{ color:SUBTLE, fontSize:9 }}>AI-POWERED AUTONOMOUS TRADING ENGINE</div>
          </div>
        </div>
        <div style={{ display:'flex', gap:12 }}>
          {[{ label:'ACTIVE STRATS', val:'3', color:GREEN },{ label:'P&L TODAY', val:'+$1,842', color:GREEN },{ label:'WIN RATE', val:'67%', color:BLUE }].map(m => (
            <div key={m.label} style={{ textAlign:'right' }}>
              <div style={{ color:SUBTLE, fontSize:8 }}>{m.label}</div>
              <div style={{ color:m.color, fontSize:11, fontWeight:700 }}>{m.val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display:'flex', gap:1, background:PANEL, borderBottom:`1px solid ${BORDER}`, padding:'0 8px' }}>
        {TABS.map(tab => {
          const active = activeTab === tab.id;
          const color = TAB_COLOR[tab.id];
          return (
            <button key={tab.id}
              data-testid={`autopilot-tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              aria-selected={active}
              style={{
                background:'transparent', border:'none', borderBottom: active ? `2px solid ${color}` : '2px solid transparent',
                color: active ? color : SUBTLE, fontFamily:MONO, fontSize:9, fontWeight:700,
                padding:'6px 12px', cursor:'pointer', letterSpacing:1,
              }}>
              {tab.icon} {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div style={{ flex:1, overflow:'hidden', display:'flex', minHeight:0 }}>
        <div style={{ flex:1, overflow:'auto' }}>
          {activeTab === 'dashboard' && <AutopilotDashboard />}
          {activeTab === 'positions' && <div style={{ height:'100%', padding:16, background:BG }}><AutopilotPositions /></div>}
          {activeTab === 'activity'  && <div style={{ height:'100%', padding:16, background:BG }}><AutopilotActivity /></div>}
          {activeTab === 'settings'  && <div style={{ height:'100%', padding:16, background:BG }}><AutopilotSettings /></div>}
        </div>
        <div style={{ width:320, flexShrink:0, borderLeft:`1px solid ${BORDER}`, overflow:'auto', background:PANEL }}>
          <AIPanel symbol={symbol || 'SPY'} />
        </div>
      </div>
    </div>
  );
}
