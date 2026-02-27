const BG='#0a0a0a'; const PANEL='#111111'; const BORDER='#1e1e1e';
const AMBER='#f5a623'; const GREEN='#26a69a'; const RED='#ef5350';
const BLUE='#42a5f5'; const PURPLE='#ab47bc'; const SUBTLE='#555';
const TEXT='#d1d4dc'; const MONO='"Roboto Mono","Courier New",monospace';

import React, { useState } from 'react';
import { useAppStore } from '../../../state/appStore';

export type ViewId = 
    | 'dashboard' 
    | 'portfolio' 
    | 'orders' 
    | 'runs' 
    | 'strategies' 
    | 'settings'
    | 'monitor'
    | 'options'
    | 'backtest'
    | 'autopilot'
    | 'replay'
    | 'alerts'
    | 'reports'
    | 'automation'
    | 'incidents'
    | 'cache'
    | 'search'
    | 'agents'
    | 'watchlist'
    | 'correlation'
    | 'journal'
    | 'notifications'
    | 'audit'
    | 'attribution'
    | 'risk-scenarios'
    | 'data-quality'
    | 'strategy-compare'
    | 'platform-health';

interface LeftNavEnhancedProps {
    activeView: ViewId;
    onViewChange: (view: ViewId) => void;
}

interface NavItemProps {
    id: ViewId;
    icon: React.ReactNode;
    label: string;
    shortcut?: string;
    badge?: number | string;
    activeView: ViewId;
    onViewChange: (view: ViewId) => void;
    expanded: boolean;
}

// Bloomberg icon characters map
const ICONS: Record<string, string> = {
    dashboard: '⊞', portfolio: '◈', orders: '≡', runs: '⏳', strategies: '⊛',
    settings: '⚙', monitor: '◷', options: '⧖', backtest: '⊡', autopilot: '◉',
    replay: '↺', alerts: '⚠', reports: '▤', automation: '⟲', incidents: '◐',
    cache: '⊙', search: '⌕', agents: '⊕', watchlist: '☰', correlation: '⊞',
    journal: '▦', notifications: '◻', audit: '⊟', attribution: '◑',
    'risk-scenarios': '⚡', 'data-quality': '◫', 'strategy-compare': '⇄',
    'platform-health': '♥',
};

const primaryNavItems: { id: ViewId; label: string; shortcut: string; badge?: number }[] = [
    { id: 'dashboard', label: 'Dashboard', shortcut: '⌘D' },
    { id: 'portfolio', label: 'Portfolio', shortcut: '⌘P' },
    { id: 'orders', label: 'Orders', shortcut: '⌘O' },
    { id: 'runs', label: 'Runs / Audit Log', shortcut: '⌘R' },
    { id: 'strategies', label: 'Strategies & Rules', shortcut: '⌘S' },
];

const secondaryNavItems: { id: ViewId; label: string; shortcut: string }[] = [
    { id: 'monitor', label: 'Chart', shortcut: '⌘1' },
    { id: 'options', label: 'Options', shortcut: '⌘2' },
    { id: 'backtest', label: 'Backtests', shortcut: '⌘B' },
    { id: 'autopilot', label: 'Autopilot', shortcut: '⌘A' },
    { id: 'replay', label: 'Replay', shortcut: '⌘3' },
    { id: 'alerts', label: 'Alerts', shortcut: '⌘4' },
    { id: 'incidents', label: 'Incidents', shortcut: '⌘I' },
    { id: 'search', label: 'Search', shortcut: '⌘F' },
    { id: 'agents', label: 'Agents', shortcut: '⌘G' },
    { id: 'cache', label: 'Cache', shortcut: '⌘C' },
    { id: 'watchlist', label: 'Watchlist', shortcut: '⌘W' },
    { id: 'correlation', label: 'Correlation', shortcut: '⌘5' },
    { id: 'journal', label: 'Journal', shortcut: '⌘J' },
    { id: 'notifications', label: 'Notifications', shortcut: '⌘N' },
    { id: 'audit', label: 'Audit Log', shortcut: '⌘6' },
    { id: 'attribution', label: 'Attribution', shortcut: '⌘7' },
    { id: 'risk-scenarios', label: 'Risk Scenarios', shortcut: '⌘8' },
    { id: 'data-quality', label: 'Data Quality', shortcut: '⌘9' },
    { id: 'strategy-compare', label: 'Strategy Compare', shortcut: '⌘0' },
    { id: 'platform-health', label: 'Platform Health', shortcut: '⌘H' },
];

function NavItem({
    id, label, shortcut, badge, activeView, onViewChange, expanded,
}: {
    id: ViewId; label: string; shortcut?: string; badge?: number | string;
    activeView: ViewId; onViewChange: (v: ViewId) => void; expanded: boolean;
}) {
    const isActive = activeView === id;
    const [hovered, setHovered] = useState(false);
    const icon = ICONS[id] || '▸';

    return (
        <button
            onClick={() => onViewChange(id)}
            title={!expanded ? `${label} ${shortcut ?? ''}` : undefined}
            data-testid={`nav-item-${id}`}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: expanded ? '100%' : 44,
                height: 36,
                justifyContent: expanded ? 'flex-start' : 'center',
                padding: expanded ? '0 10px' : 0,
                margin: '1px 0',
                border: 'none',
                borderRadius: 3,
                cursor: 'pointer',
                background: isActive ? 'rgba(66,165,245,0.12)' : hovered ? 'rgba(255,255,255,0.04)' : 'transparent',
                transition: 'background 0.1s',
                fontFamily: MONO,
            }}
        >
            {isActive && (
                <div style={{
                    position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
                    width: 3, height: 20, borderRadius: '0 2px 2px 0',
                    background: `linear-gradient(to bottom, ${BLUE}, #1565c0)`,
                }} />
            )}
            <span style={{
                fontSize: 14, color: isActive ? BLUE : hovered ? TEXT : SUBTLE,
                flexShrink: 0, width: 18, textAlign: 'center', transition: 'color 0.1s',
            }}>{icon}</span>
            {expanded && (
                <>
                    <span style={{
                        fontSize: 11, fontFamily: MONO,
                        color: isActive ? TEXT : hovered ? TEXT : '#888',
                        flex: 1, textAlign: 'left', letterSpacing: '0.02em',
                        textTransform: 'uppercase', fontWeight: isActive ? 600 : 400,
                        transition: 'color 0.1s',
                    }}>{label}</span>
                    {badge !== undefined && (
                        <span style={{
                            fontSize: 9, fontFamily: MONO, fontWeight: 700,
                            padding: '1px 4px', borderRadius: 2,
                            background: 'rgba(66,165,245,0.2)', color: BLUE,
                            border: `1px solid rgba(66,165,245,0.3)`,
                        }}>{badge}</span>
                    )}
                    {shortcut && badge === undefined && hovered && (
                        <span style={{ fontSize: 9, color: SUBTLE, fontFamily: MONO }}>{shortcut}</span>
                    )}
                </>
            )}
            {!expanded && badge !== undefined && (
                <span style={{
                    position: 'absolute', top: 2, right: 2,
                    minWidth: 14, height: 14, fontSize: 8, fontWeight: 700,
                    borderRadius: '50%', background: BLUE, color: BG,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '0 2px', fontFamily: MONO,
                }}>{badge}</span>
            )}
        </button>
    );
}

export function LeftNavEnhanced({ activeView, onViewChange }: LeftNavEnhancedProps) {
    const { leftNavExpanded, toggleLeftNav } = useAppStore();

    return (
        <nav
            data-testid="left-nav"
            style={{
                background: PANEL, borderRight: `1px solid ${BORDER}`,
                display: 'flex', flexDirection: 'column',
                padding: '8px 0',
                width: leftNavExpanded ? 200 : 52,
                flexShrink: 0, zIndex: 40,
                transition: 'width 0.15s ease', overflow: 'hidden',
            }}
        >
            {/* Primary nav */}
            <div style={{ padding: leftNavExpanded ? '0 6px' : '0 4px' }}>
                {leftNavExpanded && (
                    <div style={{
                        padding: '4px 8px 6px', fontSize: 9, fontFamily: MONO,
                        color: SUBTLE, letterSpacing: '0.1em', textTransform: 'uppercase',
                        borderBottom: `1px solid ${BORDER}`, marginBottom: 4,
                    }}>MAIN</div>
                )}
                {primaryNavItems.map(item => (
                    <NavItem key={item.id} {...item} activeView={activeView} onViewChange={onViewChange} expanded={leftNavExpanded} />
                ))}
            </div>

            {/* Divider */}
            <div style={{ margin: '6px 10px', height: 1, background: BORDER }} />

            {/* Secondary nav — scrollable */}
            <div style={{
                flex: 1, overflowY: 'auto',
                padding: leftNavExpanded ? '0 6px' : '0 4px',
                scrollbarWidth: 'none',
            }}>
                {leftNavExpanded && (
                    <div style={{
                        padding: '4px 8px 6px', fontSize: 9, fontFamily: MONO,
                        color: SUBTLE, letterSpacing: '0.1em', textTransform: 'uppercase',
                        borderBottom: `1px solid ${BORDER}`, marginBottom: 4,
                    }}>TOOLS</div>
                )}
                {secondaryNavItems.map(item => (
                    <NavItem key={item.id} {...item} activeView={activeView} onViewChange={onViewChange} expanded={leftNavExpanded} />
                ))}
            </div>

            {/* Bottom: Settings + collapse toggle */}
            <div style={{
                padding: leftNavExpanded ? '6px 6px 0' : '6px 4px 0',
                borderTop: `1px solid ${BORDER}`, marginTop: 4,
            }}>
                <NavItem
                    id="settings" label="Settings" shortcut=""
                    activeView={activeView} onViewChange={onViewChange} expanded={leftNavExpanded}
                />
                <button
                    onClick={toggleLeftNav}
                    data-testid="nav-toggle"
                    title={leftNavExpanded ? 'Collapse' : 'Expand'}
                    style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: leftNavExpanded ? '100%' : 44, height: 28, marginTop: 4,
                        border: `1px solid ${BORDER}`, borderRadius: 3,
                        background: 'transparent', color: SUBTLE,
                        cursor: 'pointer', fontSize: 10, fontFamily: MONO,
                        letterSpacing: '0.05em',
                    }}
                >{leftNavExpanded ? '« COLLAPSE' : '»'}</button>
            </div>
        </nav>
    );
}

