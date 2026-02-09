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
    variant?: 'default' | 'underline' | 'pills';
}

export function TabsList({ children, className, variant = 'default' }: TabsListProps) {
    return (
        <div className={cn(
            'flex items-center shrink-0',
            {
                'gap-1 px-3 py-1.5 border-b border-border bg-panel-bg': variant === 'default',
                'gap-0 px-4 border-b border-border bg-panel-bg': variant === 'underline',
                'gap-1 px-3 py-1.5 bg-panel-bg': variant === 'pills',
            },
            className
        )} data-variant={variant}>
            {children}
        </div>
    );
}

// Individual tab trigger
interface TabsTriggerProps {
    value: string;
    children: ReactNode;
    icon?: ReactNode;
    badge?: string | number;
    className?: string;
    disabled?: boolean;
    'data-testid'?: string;
}

export function TabsTrigger({ value, children, icon, badge, className, disabled, 'data-testid': testId }: TabsTriggerProps) {
    const { activeTab, setActiveTab } = useTabsContext();
    const isActive = activeTab === value;

    return (
        <button
            onClick={() => !disabled && setActiveTab(value)}
            disabled={disabled}
            data-testid={testId}
            className={cn(
                'inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md transition-all',
                'focus:outline-none focus:ring-1 focus:ring-brand/40',
                {
                    'bg-brand/10 text-brand border border-brand/20': isActive,
                    'text-text-secondary hover:text-text hover:bg-element-bg': !isActive && !disabled,
                    'opacity-40 cursor-not-allowed': disabled,
                },
                className
            )}
        >
            {icon && <span className={cn(isActive ? 'opacity-100' : 'opacity-60')}>{icon}</span>}
            {children}
            {badge !== undefined && (
                <span className={cn(
                    'ml-1 px-1.5 py-0.5 text-[9px] rounded-full font-semibold tabular-nums',
                    isActive ? 'bg-brand/20 text-brand' : 'bg-element-bg text-text-muted'
                )}>
                    {badge}
                </span>
            )}
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
