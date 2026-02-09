import { cn } from './utils';

export interface SegmentedControlProps {
    options: { value: string; label: string; icon?: React.ReactNode }[];
    value: string;
    onChange: (value: string) => void;
    size?: 'sm' | 'md';
    className?: string;
    'data-testid'?: string;
}

export function SegmentedControl({
    options,
    value,
    onChange,
    size = 'md',
    className,
    'data-testid': testId,
}: SegmentedControlProps) {
    return (
        <div
            className={cn(
                'inline-flex items-center rounded-lg bg-element-bg border border-border p-0.5',
                className
            )}
            data-testid={testId}
            role="tablist"
        >
            {options.map((option) => {
                const isActive = option.value === value;
                return (
                    <button
                        key={option.value}
                        onClick={() => onChange(option.value)}
                        role="tab"
                        aria-selected={isActive}
                        className={cn(
                            'inline-flex items-center gap-1.5 rounded-md font-medium transition-all',
                            size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm',
                            isActive
                                ? 'bg-brand text-white shadow-sm'
                                : 'text-text-secondary hover:text-text'
                        )}
                    >
                        {option.icon}
                        {option.label}
                    </button>
                );
            })}
        </div>
    );
}
