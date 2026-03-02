// Bloomberg palette
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

import React, { useState } from 'react';
import { useAppStore } from '../../../state/appStore';

export type ViewId = 'monitor' | 'dashboard' | 'options' | 'replay' | 'strategies' | 'alerts' | 'portfolio' | 'reports' | 'automation' | 'incidents' | 'autopilot' | 'settings';

interface LeftNavProps {
  activeView: ViewId;
  onViewChange: (view: ViewId) => void;
}

const NAV_ITEMS: { id: ViewId; icon: string; label: string; shortcut: string; color: string }[] = [
  { id: 'monitor',    icon: 'â—ˆ', label: 'Chart',      shortcut: 'âŒ˜1', color: BLUE },
  { id: 'dashboard',  icon: 'âŠž', label: 'Dashboard',  shortcut: 'âŒ˜2', color: AMBER },
  { id: 'options',    icon: 'â—‰', label: 'Options',    shortcut: 'âŒ˜3', color: GREEN },
  { id: 'autopilot',  icon: 'âŠ™', label: 'Autopilot',  shortcut: 'âŒ˜0', color: '#ab47bc' },
  { id: 'replay',     icon: 'â–·', label: 'Replay',     shortcut: 'âŒ˜4', color: BLUE },
  { id: 'strategies', icon: 'âŸ‘', label: 'Strategies', shortcut: 'âŒ˜5', color: AMBER },
  { id: 'alerts',     icon: 'âš‘', label: 'Alerts',     shortcut: 'âŒ˜6', color: RED },
  { id: 'portfolio',  icon: 'â—«', label: 'Portfolio',  shortcut: 'âŒ˜7', color: GREEN },
  { id: 'reports',    icon: 'â‰¡', label: 'Reports',    shortcut: '',   color: SUBTLE },
  { id: 'automation', icon: 'âŠ¶', label: 'Automation', shortcut: 'âŒ˜8', color: '#ab47bc' },
  { id: 'incidents',  icon: 'âš ', label: 'Incidents',  shortcut: 'âŒ˜9', color: RED },
];

export function LeftNav({ activeView, onViewChange }: LeftNavProps) {
  const { leftNavExpanded, toggleLeftNav } = useAppStore();
  const [hovered, setHovered] = useState<ViewId | null>(null);
  const expanded = leftNavExpanded;

  return (
    <nav style={{
      background: PANEL, borderRight: `1px solid ${BORDER}`,
      display: 'flex', flexDirection: 'column', padding: '8px 0',
      width: expanded ? 200 : 52, flexShrink: 0,
      transition: 'width 0.2s ease', fontFamily: MONO, zIndex: 40,
      overflowX: 'hidden',
    }}>
      {/* Logo / brand strip */}
      <div style={{
        padding: expanded ? '10px 14px 12px' : '10px 0 12px',
        display: 'flex', alignItems: 'center',
        justifyContent: expanded ? 'flex-start' : 'center',
        borderBottom: `1px solid ${BORDER}`, marginBottom: 6,
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 4,
          background: AMBER, display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: 14, fontWeight: 900,
          color: BG, flexShrink: 0,
        }}>A</div>
        {expanded && (
          <div style={{ marginLeft: 10 }}>
            <div style={{ fontSize: 11, color: TEXT, fontWeight: 700, letterSpacing: 2 }}>APEX</div>
            <div style={{ fontSize: 9, color: SUBTLE, letterSpacing: 1 }}>TERMINAL</div>
          </div>
        )}
      </div>

      {/* Main nav items */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 4px' }}>
        {NAV_ITEMS.map(item => {
          const isActive = activeView === item.id;
          const isHov = hovered === item.id;
          return (
            <button
              key={item.id}
              data-testid={`nav-item-${item.id}`}
              onClick={() => onViewChange(item.id)}
              title={!expanded ? `${item.label}${item.shortcut ? '  ' + item.shortcut : ''}` : undefined}
              onMouseEnter={() => setHovered(item.id)}
              onMouseLeave={() => setHovered(null)}
              style={{
                display: 'flex', alignItems: 'center',
                width: '100%', padding: expanded ? '8px 10px' : '10px 0',
                justifyContent: expanded ? 'flex-start' : 'center',
                background: isActive ? '#1a1a1a' : isHov ? '#161616' : 'transparent',
                border: 'none', borderRadius: 4, cursor: 'pointer',
                borderLeft: isActive ? `3px solid ${item.color}` : '3px solid transparent',
                marginBottom: 2, transition: 'all 0.12s',
                position: 'relative',
              }}
            >
              <span style={{
                fontSize: 15, color: isActive ? item.color : isHov ? TEXT : SUBTLE,
                flexShrink: 0, lineHeight: 1, transition: 'color 0.12s',
              }}>{item.icon}</span>
              {expanded && (
                <>
                  <span style={{
                    marginLeft: 10, fontSize: 11, color: isActive ? TEXT : isHov ? TEXT : '#888',
                    fontWeight: isActive ? 600 : 400, letterSpacing: 0.5, flex: 1,
                    textAlign: 'left',
                  }}>{item.label}</span>
                  {item.shortcut && (
                    <span style={{ fontSize: 9, color: SUBTLE }}>{item.shortcut}</span>
                  )}
                </>
              )}
              {isActive && !expanded && (
                <div style={{
                  position: 'absolute', right: 0, top: '25%', height: '50%',
                  width: 2, background: item.color, borderRadius: '2px 0 0 2px',
                }} />
              )}
            </button>
          );
        })}
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: BORDER, margin: '6px 8px' }} />

      {/* Settings */}
      <div style={{ padding: '0 4px' }}>
        {(['settings'] as ViewId[]).map(id => {
          const isActive = activeView === id;
          const isHov = hovered === id;
          return (
            <button
              key={id}
              data-testid={`nav-item-${id}`}
              onClick={() => onViewChange(id)}
              onMouseEnter={() => setHovered(id)}
              onMouseLeave={() => setHovered(null)}
              style={{
                display: 'flex', alignItems: 'center', width: '100%',
                padding: expanded ? '8px 10px' : '10px 0',
                justifyContent: expanded ? 'flex-start' : 'center',
                background: isActive ? '#1a1a1a' : isHov ? '#161616' : 'transparent',
                border: 'none', borderRadius: 4, cursor: 'pointer',
                borderLeft: isActive ? `3px solid ${SUBTLE}` : '3px solid transparent',
                marginBottom: 2,
              }}
            >
              <span style={{ fontSize: 14, color: isHov ? TEXT : SUBTLE }}>âš™</span>
              {expanded && <span style={{ marginLeft: 10, fontSize: 11, color: isHov ? TEXT : SUBTLE }}>Settings</span>}
            </button>
          );
        })}

        {/* Collapse/expand toggle */}
        <button
          onClick={toggleLeftNav}
          title={expanded ? 'Collapse' : 'Expand'}
          style={{
            display: 'flex', alignItems: 'center', width: '100%',
            padding: expanded ? '8px 10px' : '10px 0',
            justifyContent: expanded ? 'flex-start' : 'center',
            background: 'transparent', border: 'none', borderLeft: '3px solid transparent',
            borderRadius: 4, cursor: 'pointer', marginBottom: 4,
          }}
          onMouseEnter={e => (e.currentTarget.style.background = '#161616')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <span style={{ fontSize: 13, color: SUBTLE }}>{expanded ? 'â—€' : 'â–¶'}</span>
          {expanded && <span style={{ marginLeft: 10, fontSize: 10, color: SUBTLE }}>COLLAPSE</span>}
        </button>
      </div>
    </nav>
  );
}
