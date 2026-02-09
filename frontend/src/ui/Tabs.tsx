import { createContext, useContext, useState, type ReactNode } from 'react';
import { cn } from './utils';

// Context for active tab
interface TabsContextValue {
    activeTab: string;
    setActiveTab: (id: string) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext() {
    const context = useContext(TabsContext);
    if (!context) throw new Error('Tabs components must be used within a Tabs provider');
    return context;
}

// Root container
interface TabsProps {
    defaultValue: string;
    value?: string;
    onValueChange?: (value: string) => void;
    children: ReactNode;
    className?: string;
}

export function Tabs({ defaultValue, value, onValueChange, children, className }: TabsProps) {
    const [internalValue, setInternalValue] = useState(defaultValue);
    const activeTab = value ?? internalValue;

    const setActiveTab = (id: string) => {
        if (onValueChange) {
            onValueChange(id);
        } else {
            setInternalValue(id);
        }
    };

    return (
        <TabsContext.Provider value={{ activeTab, setActiveTab }}>
            <div className={cn('flex flex-col h-full', className)}>
                {children}
            </div>
        </TabsContext.Provider>
    );
}

// Tab list (header)
interface TabsListProps {
    children: ReactNode;
    className?: string;
}

export function TabsList({ children, className }: TabsListProps) {
    return (
        <div className={cn(
            'flex items-center gap-1 px-2 py-1 border-b border-border bg-panel-bg shrink-0',
            className
        )}>
            {children}
        </div>
    );
}

// Individual tab trigger
interface TabsTriggerProps {
    value: string;
    children: ReactNode;
    icon?: ReactNode;
    className?: string;
    disabled?: boolean;
}

export function TabsTrigger({ value, children, icon, className, disabled }: TabsTriggerProps) {
    const { activeTab, setActiveTab } = useTabsContext();
    const isActive = activeTab === value;

    return (
        <button
            onClick={() => !disabled && setActiveTab(value)}
            disabled={disabled}
            className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors',
                'focus:outline-none focus:ring-1 focus:ring-blue-500/50',
                {
                    'bg-element-bg text-text border border-border-active': isActive,
                    'text-text-secondary hover:text-text hover:bg-element-bg': !isActive && !disabled,
                    'opacity-50 cursor-not-allowed': disabled,
                },
                className
            )}
        >
            {icon && <span className="opacity-70">{icon}</span>}
            {children}
        </button>
    );
}

// Tab content
interface TabsContentProps {
    value: string;
    children: ReactNode;
    className?: string;
}

export function TabsContent({ value, children, className }: TabsContentProps) {
    const { activeTab } = useTabsContext();

    if (activeTab !== value) return null;

    return (
        <div className={cn('flex-1 overflow-auto', className)}>
            {children}
        </div>
    );
}
