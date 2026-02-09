/**
 * Enhanced Left Navigation – v2 UI Overhaul
 * 
 * Two‑tier nav: Primary (Main) + Secondary (Tools)
 * Collapsible sidebar with smooth transitions.
 */

import {
    LayoutDashboard, Wallet, History, Layers, Settings,
    ChevronLeft, ChevronRight, BarChart3, ListOrdered, Bot, 
    AlertTriangle, TrendingUp, Activity, Clock, FlaskConical
} from 'lucide-react';
import { cn } from '../../../ui/utils';
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
    | 'incidents';

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

// Primary navigation items
const primaryNavItems: { id: ViewId; icon: React.ReactNode; label: string; shortcut: string; badge?: number }[] = [
    { id: 'dashboard', icon: <LayoutDashboard size={18} />, label: 'Dashboard', shortcut: '⌘D' },
    { id: 'portfolio', icon: <Wallet size={18} />, label: 'Portfolio', shortcut: '⌘P' },
    { id: 'orders', icon: <ListOrdered size={18} />, label: 'Orders', shortcut: '⌘O' },
    { id: 'runs', icon: <History size={18} />, label: 'Runs / Audit', shortcut: '⌘R' },
    { id: 'strategies', icon: <Layers size={18} />, label: 'Strategies', shortcut: '⌘S' },
];

// Secondary navigation items
const secondaryNavItems: { id: ViewId; icon: React.ReactNode; label: string; shortcut: string }[] = [
    { id: 'monitor', icon: <BarChart3 size={18} />, label: 'Chart', shortcut: '⌘1' },
    { id: 'options', icon: <TrendingUp size={18} />, label: 'Options', shortcut: '⌘2' },
    { id: 'backtest', icon: <FlaskConical size={18} />, label: 'Backtests', shortcut: '⌘B' },
    { id: 'autopilot', icon: <Bot size={18} />, label: 'Autopilot', shortcut: '⌘A' },
    { id: 'replay', icon: <Clock size={18} />, label: 'Replay', shortcut: '⌘3' },
    { id: 'alerts', icon: <AlertTriangle size={18} />, label: 'Alerts', shortcut: '⌘4' },
    { id: 'incidents', icon: <Activity size={18} />, label: 'Incidents', shortcut: '⌘I' },
];

function NavItem({ id, icon, label, shortcut, badge, activeView, onViewChange, expanded }: NavItemProps) {
    const isActive = activeView === id;

    return (
        <button
            onClick={() => onViewChange(id)}
            title={!expanded ? `${label} ${shortcut}` : undefined}
            data-testid={`nav-item-${id}`}
            className={cn(
                "relative flex items-center gap-3 rounded-md transition-all duration-150 w-full group",
                expanded ? "px-3 py-2" : "w-11 h-11 justify-center",
                isActive
                    ? "text-brand bg-brand/10 shadow-sm"
                    : "text-text-secondary hover:text-text hover:bg-element-bg/70"
            )}
        >
            {/* Active indicator bar */}
            {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-brand rounded-r-full" />
            )}

            <span className={cn("shrink-0 transition-transform duration-150", isActive && "scale-110")}>{icon}</span>

            {expanded && (
                <>
                    <span className="text-[13px] font-medium flex-1 text-left truncate">{label}</span>
                    {badge !== undefined && (
                        <span className="px-1.5 py-0.5 text-[9px] font-semibold rounded-full bg-brand/20 text-brand tabular-nums">
                            {badge}
                        </span>
                    )}
                    {shortcut && !badge && (
                        <span className="text-[10px] text-text-muted opacity-0 group-hover:opacity-100 transition-opacity">{shortcut}</span>
                    )}
                </>
            )}

            {!expanded && badge !== undefined && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 text-[9px] font-bold rounded-full bg-brand text-white flex items-center justify-center shadow-sm">
                    {badge}
                </span>
            )}
        </button>
    );
}

export function LeftNavEnhanced({ activeView, onViewChange }: LeftNavEnhancedProps) {
    const { leftNavExpanded, toggleLeftNav } = useAppStore();

    return (
        <nav 
            className={cn(
                "bg-panel-bg border-r border-border flex flex-col py-3 shrink-0 z-dock transition-all duration-200",
                leftNavExpanded ? "w-52 px-2" : "w-14 items-center"
            )}
            data-testid="left-nav"
        >
            {/* Primary navigation */}
            <div className="flex flex-col gap-0.5">
                {leftNavExpanded && (
                    <div className="px-3 py-1 text-[10px] uppercase tracking-widest text-text-muted/70 font-semibold select-none">
                        Main
                    </div>
                )}
                {primaryNavItems.map(item => (
                    <NavItem
                        key={item.id}
                        {...item}
                        activeView={activeView}
                        onViewChange={onViewChange}
                        expanded={leftNavExpanded}
                    />
                ))}
            </div>

            {/* Divider */}
            <div className={cn("my-2.5", leftNavExpanded ? "mx-3 border-t border-border/60" : "w-7 border-t border-border/60")} />

            {/* Secondary navigation */}
            <div className="flex flex-col gap-0.5">
                {leftNavExpanded && (
                    <div className="px-3 py-1 text-[10px] uppercase tracking-widest text-text-muted/70 font-semibold select-none">
                        Tools
                    </div>
                )}
                {secondaryNavItems.map(item => (
                    <NavItem
                        key={item.id}
                        {...item}
                        activeView={activeView}
                        onViewChange={onViewChange}
                        expanded={leftNavExpanded}
                    />
                ))}
            </div>

            <div className="flex-1" />

            {/* Settings at bottom */}
            <div className="flex flex-col gap-1">
                <NavItem
                    id="settings"
                    icon={<Settings size={18} />}
                    label="Settings"
                    shortcut=""
                    activeView={activeView}
                    onViewChange={onViewChange}
                    expanded={leftNavExpanded}
                />

                {/* Collapse toggle */}
                <button
                    onClick={toggleLeftNav}
                    className={cn(
                        "flex items-center justify-center text-text-muted hover:text-text hover:bg-element-bg/70 rounded-md transition-all duration-150 mt-1",
                        leftNavExpanded ? "py-1.5 mx-1" : "w-11 h-9"
                    )}
                    title={leftNavExpanded ? "Collapse" : "Expand"}
                    data-testid="nav-toggle"
                >
                    {leftNavExpanded ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
                </button>
            </div>
        </nav>
    );
}
