/**
 * Enhanced Left Navigation
 * 
 * Navigation items:
 * - Dashboard
 * - Portfolio
 * - Orders
 * - Runs / Audit Log
 * - Strategies & Rules
 * - Settings
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

// Primary navigation items as per acceptance checklist
const primaryNavItems: { id: ViewId; icon: React.ReactNode; label: string; shortcut: string; badge?: number }[] = [
    { id: 'dashboard', icon: <LayoutDashboard size={20} />, label: 'Dashboard', shortcut: '⌘D' },
    { id: 'portfolio', icon: <Wallet size={20} />, label: 'Portfolio', shortcut: '⌘P' },
    { id: 'orders', icon: <ListOrdered size={20} />, label: 'Orders', shortcut: '⌘O' },
    { id: 'runs', icon: <History size={20} />, label: 'Runs / Audit Log', shortcut: '⌘R' },
    { id: 'strategies', icon: <Layers size={20} />, label: 'Strategies & Rules', shortcut: '⌘S' },
];

// Secondary navigation items
const secondaryNavItems: { id: ViewId; icon: React.ReactNode; label: string; shortcut: string }[] = [
    { id: 'monitor', icon: <BarChart3 size={20} />, label: 'Chart', shortcut: '⌘1' },
    { id: 'options', icon: <TrendingUp size={20} />, label: 'Options', shortcut: '⌘2' },
    { id: 'backtest', icon: <FlaskConical size={20} />, label: 'Backtests', shortcut: '⌘B' },
    { id: 'autopilot', icon: <Bot size={20} />, label: 'Autopilot', shortcut: '⌘A' },
    { id: 'replay', icon: <Clock size={20} />, label: 'Replay', shortcut: '⌘3' },
    { id: 'alerts', icon: <AlertTriangle size={20} />, label: 'Alerts', shortcut: '⌘4' },
    { id: 'incidents', icon: <Activity size={20} />, label: 'Incidents', shortcut: '⌘I' },
];

function NavItem({ id, icon, label, shortcut, badge, activeView, onViewChange, expanded }: NavItemProps) {
    const isActive = activeView === id;

    return (
        <button
            onClick={() => onViewChange(id)}
            title={!expanded ? `${label} ${shortcut}` : undefined}
            data-testid={`nav-item-${id}`}
            className={cn(
                "relative flex items-center gap-3 rounded-lg transition-all w-full",
                expanded ? "px-3 py-2.5" : "w-12 h-12 justify-center",
                isActive
                    ? "text-brand bg-brand/10"
                    : "text-text-secondary hover:text-text hover:bg-element-bg"
            )}
        >
            {/* Active indicator */}
            {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-brand rounded-r" />
            )}

            <span className="shrink-0">{icon}</span>

            {expanded && (
                <>
                    <span className="text-sm font-medium flex-1 text-left">{label}</span>
                    {badge !== undefined && (
                        <span className="px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-brand/20 text-brand">
                            {badge}
                        </span>
                    )}
                    {shortcut && !badge && (
                        <span className="text-xxs text-text-muted">{shortcut}</span>
                    )}
                </>
            )}

            {!expanded && badge !== undefined && (
                <span className="absolute -top-1 -right-1 w-4 h-4 text-[9px] font-bold rounded-full bg-brand text-white flex items-center justify-center">
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
                leftNavExpanded ? "w-56 px-2" : "w-16 items-center"
            )}
            data-testid="left-nav"
        >
            {/* Primary navigation */}
            <div className="flex flex-col gap-0.5">
                {expanded && (
                    <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-text-muted font-medium">
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
            <div className={cn("my-3", leftNavExpanded ? "mx-3 border-t border-border" : "w-8 border-t border-border")} />

            {/* Secondary navigation */}
            <div className="flex flex-col gap-0.5">
                {leftNavExpanded && (
                    <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-text-muted font-medium">
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
                    icon={<Settings size={20} />}
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
                        "flex items-center justify-center text-text-secondary hover:text-text hover:bg-element-bg rounded-lg transition-colors mt-2",
                        leftNavExpanded ? "py-2" : "w-12 h-10"
                    )}
                    title={leftNavExpanded ? "Collapse" : "Expand"}
                    data-testid="nav-toggle"
                >
                    {leftNavExpanded ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
                </button>
            </div>
        </nav>
    );
}

// Helper for checking expanded state
const expanded = true; // Will be replaced by actual state
