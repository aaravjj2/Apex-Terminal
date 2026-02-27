const BG='#0a0a0a'; const PANEL='#111111'; const BORDER='#1e1e1e';
const AMBER='#f5a623'; const GREEN='#26a69a'; const RED='#ef5350';
const BLUE='#42a5f5'; const PURPLE='#ab47bc'; const SUBTLE='#555';
const TEXT='#d1d4dc'; const MONO='"Roboto Mono","Courier New",monospace';

import React from 'react';
import { useAutopilotStore } from '../store';
import type { Incident } from '../types';

const SEV_BG: Record<string, string> = { error: RED + '22', critical: RED + '33', warning: AMBER + '22' };
const SEV_BORDER: Record<string, string> = { error: RED + '44', critical: RED + '66', warning: AMBER + '44' };
const SEV_COLOR: Record<string, string> = { error: RED, critical: RED, warning: AMBER };
const SEV_ICON: Record<string, string> = { error: '', critical: '', warning: '' };

export const IncidentsPanel: React.FC = () => {
  const { incidents, dismissIncident } = useAutopilotStore();
  if (!incidents || incidents.length === 0) return null;
  return (
    <div data-testid="incidents-panel" style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10, fontFamily: MONO }}>
      {incidents.map((incident: Incident, idx: number) => (
        <div key={`${incident.timestamp}-${idx}`} data-testid={`incident-${idx}`}
          style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '8px 12px', background: SEV_BG[incident.severity] || SEV_BG.error, border: `1px solid ${SEV_BORDER[incident.severity] || SEV_BORDER.error}`, borderRadius: 2 }}>
          <div style={{ display: 'flex', gap: 10, flex: 1 }}>
            <span style={{ color: SEV_COLOR[incident.severity] || RED, fontSize: 14, flexShrink: 0 }}>{SEV_ICON[incident.severity] || ''}</span>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: SEV_COLOR[incident.severity] || RED, letterSpacing: '0.05em' }}>{incident.title.toUpperCase()}</div>
              <div style={{ fontSize: 10, color: TEXT, marginTop: 2 }}>{incident.description}</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 4, fontSize: 10, color: SUBTLE }}>
                <span>{new Date(incident.timestamp).toLocaleTimeString()}</span>
                <span></span>
                <span>{incident.category}</span>
              </div>
            </div>
          </div>
          <button data-testid={`dismiss-incident-${idx}`} onClick={() => dismissIncident(idx)}
            style={{ background: 'none', border: 'none', color: SUBTLE, cursor: 'pointer', fontSize: 14, flexShrink: 0, marginLeft: 8 }}></button>
        </div>
      ))}
    </div>
  );
};