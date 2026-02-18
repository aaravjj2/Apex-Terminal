import { History, Layers, Bell, Settings, FileText, Wallet, ChevronLeft, ChevronRight, BarChart3, Grid3X3, Bot, AlertTriangle, TrendingUp, Cpu } from 'lucide-react';
import { cn } from '../../../ui/utils';
import { useAppStore } from '../../../state/appStore';

export type ViewId = 'monitor' | 'dashboard' | 'options' | 'replay' | 'strategies' | 'alerts' | 'portfolio' | 'reports' | 'automation' | 'incidents' | 'autopilot' | 'settings';

interface LeftNavProps {
    activeView: ViewId;
    onViewChange: (view: ViewId) => void;
}

interface NavItemProps {
    id: ViewId;
    icon: React.ReactNode;
    label: string;
    shortcut?: string;
    activeView: ViewId;
    onViewChange: (view: ViewId) => void;
    expanded: boolean;
}

const navItems: { id: ViewId; icon: React.ReactNode; label: string; shortcut: string }[] = [
    { id: 'monitor', icon: <BarChart3 size={20} />, label: 'Chart', shortcut: '⌘1' },
    { id: 'dashboard', icon: <Grid3X3 size={20} />, label: 'Dashboard', shortcut: '⌘2' },
    { id: 'options', icon: <TrendingUp size={20} />, label: 'Options', shortcut: '⌘3' },
    { id: 'autopilot', icon: <Cpu size={20} />, label: 'Autopilot', shortcut: '⌘0' },
    { id: 'replay', icon: <History size={20} />, label: 'Replay', shortcut: '⌘4' },
    { id: 'strategies', icon: <Layers size={20} />, label: 'Strategies', shortcut: '⌘5' },
    { id: 'alerts', icon: <Bell size={20} />, label: 'Alerts', shortcut: '⌘6' },
    { id: 'portfolio', icon: <Wallet size={20} />, label: 'Portfolio', shortcut: '⌘7' },
    { id: 'reports', icon: <FileText size={20} />, label: 'Reports', shortcut: '' },
    { id: 'automation', icon: <Bot size={20} />, label: 'Automation', shortcut: '⌘8' },
    { id: 'incidents', icon: <AlertTriangle size={20} />, label: 'Incidents', shortcut: '⌘9' },
];

function NavItem({ id, icon, label, shortcut, activeView, onViewChange, expanded }: NavItemProps) {
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
                    <span className="text-sm font-medium">{label}</span>
                    {shortcut && (
                        <span className="ml-auto text-xxs text-text-muted">{shortcut}</span>
                    )}
                </>
            )}
        </button>
    );
}

export function LeftNav({ activeView, onViewChange }: LeftNavProps) {
    const { leftNavExpanded, toggleLeftNav } = useAppStore();

    return (
        <nav className={cn(
            "bg-panel-bg border-r border-border flex flex-col py-3 shrink-0 z-dock transition-all duration-200",
            leftNavExpanded ? "w-60 px-2" : "w-16 items-center"
        )}>
            {/* Main nav items */}
            <div className="flex flex-col gap-1">
                {navItems.map(item => (
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

            {/* Bottom items */}
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
                >
                    {leftNavExpanded ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
                </button>
            </div>
        </nav>
    );
}
