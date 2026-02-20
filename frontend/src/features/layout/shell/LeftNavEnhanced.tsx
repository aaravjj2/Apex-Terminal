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
    AlertTriangle, TrendingUp, Activity, Clock, FlaskConical, Database,
    Search, Cpu, List, Grid3X3, BookOpen, Bell, Shield, PieChart,
    Zap, BarChart, GitCompare, HeartPulse
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
    { id: 'search', icon: <Search size={20} />, label: 'Search', shortcut: '⌘F' },
    { id: 'agents', icon: <Cpu size={20} />, label: 'Agents', shortcut: '⌘G' },
    { id: 'cache', icon: <Database size={20} />, label: 'Cache', shortcut: '⌘C' },
    { id: 'watchlist', icon: <List size={20} />, label: 'Watchlist', shortcut: '⌘W' },
    { id: 'correlation', icon: <Grid3X3 size={20} />, label: 'Correlation', shortcut: '⌘5' },
    { id: 'journal', icon: <BookOpen size={20} />, label: 'Journal', shortcut: '⌘J' },
    { id: 'notifications', icon: <Bell size={20} />, label: 'Notifications', shortcut: '⌘N' },
    { id: 'audit', icon: <Shield size={20} />, label: 'Audit Log', shortcut: '⌘6' },
    { id: 'attribution', icon: <PieChart size={20} />, label: 'Attribution', shortcut: '⌘7' },
    { id: 'risk-scenarios', icon: <Zap size={20} />, label: 'Risk Scenarios', shortcut: '⌘8' },
    { id: 'data-quality', icon: <BarChart size={20} />, label: 'Data Quality', shortcut: '⌘9' },
    { id: 'strategy-compare', icon: <GitCompare size={20} />, label: 'Strategy Compare', shortcut: '⌘0' },
    { id: 'platform-health', icon: <HeartPulse size={20} />, label: 'Platform Health', shortcut: '⌘H' },
];

function NavItem({ id, icon, label, shortcut, badge, activeView, onViewChange, expanded }: NavItemProps) {
    const isActive = activeView === id;

    return (
        <button
            onClick={() => onViewChange(id)}
            title={!expanded ? `${label} ${shortcut}` : undefined}
            data-testid={`nav-item-${id}`}
            className={cn(
                "relative flex items-center gap-3 rounded-lg transition-all w-full group",
                expanded ? "px-3 py-2" : "w-12 h-12 justify-center",
                isActive
                    ? "nav-item-active bg-brand/10"
                    : "text-text-secondary hover:text-text-primary hover:bg-hover"
            )}
        >
            {/* Active indicator - gradient pill */}
            {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-7 rounded-r-full bg-gradient-to-b from-blue-400 to-blue-600" />
            )}

            <span className={cn("shrink-0 transition-colors", isActive ? "text-brand" : "group-hover:text-text-primary")}>{icon}</span>

            {expanded && (
                <>
                    <span className="text-[13px] font-medium flex-1 text-left tracking-tight">{label}</span>
                    {badge !== undefined && (
                        <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-brand/15 text-brand-400 ring-1 ring-brand/20">
                            {badge}
                        </span>
                    )}
                    {shortcut && !badge && (
                        <span className="text-xxs text-text-muted opacity-0 group-hover:opacity-100 transition-opacity">{shortcut}</span>
                    )}
                </>
            )}

            {!expanded && badge !== undefined && (
                <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 text-[9px] font-bold rounded-full bg-brand text-white flex items-center justify-center px-1">
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
                "bg-panel-bg border-r border-border/80 flex flex-col py-3 shrink-0 z-dock transition-all duration-200",
                leftNavExpanded ? "w-56 px-2" : "w-16 items-center"
            )}
            data-testid="left-nav"
        >
            {/* Primary navigation */}
            <div className="flex flex-col gap-0.5">
                {leftNavExpanded && (
                    <div className="px-3 py-1.5 mb-1 text-[10px] uppercase tracking-widest text-text-muted/70 font-semibold flex items-center gap-2">
                        <span className="w-3 h-px bg-border" />
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
            <div className={cn("my-2", leftNavExpanded ? "mx-3 border-t border-border/60" : "w-8 border-t border-border/60")} />

            {/* Secondary navigation */}
            <div className="flex flex-col gap-0.5 overflow-y-auto scrollbar-hide">
                {leftNavExpanded && (
                    <div className="px-3 py-1.5 mb-1 text-[10px] uppercase tracking-widest text-text-muted/70 font-semibold flex items-center gap-2">
                        <span className="w-3 h-px bg-border" />
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
                        "flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-hover rounded-lg transition-colors mt-2 border border-transparent hover:border-border/50",
                        leftNavExpanded ? "py-2" : "w-12 h-10"
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

