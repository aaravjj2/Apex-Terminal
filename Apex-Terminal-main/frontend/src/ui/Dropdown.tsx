import { useState, useRef, useEffect, type ReactNode } from 'react';
import { ChevronDown, Search, Check } from 'lucide-react';
import { cn } from './utils';

interface DropdownOption {
    value: string;
    label: string;
    icon?: ReactNode;
    description?: string;
}

interface DropdownProps {
    options: DropdownOption[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    searchable?: boolean;
    disabled?: boolean;
    size?: 'sm' | 'md';
    className?: string;
}

export function Dropdown({
    options,
    value,
    onChange,
    placeholder = 'Select...',
    searchable = false,
    disabled = false,
    size = 'md',
    className,
}: DropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);

    const selectedOption = options.find(o => o.value === value);

    const filteredOptions = searchable && search
        ? options.filter(o =>
            o.label.toLowerCase().includes(search.toLowerCase()) ||
            o.value.toLowerCase().includes(search.toLowerCase())
        )
        : options;

    // Close on click outside
    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
                setSearch('');
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    // Focus search when opened
    useEffect(() => {
        if (isOpen && searchable && searchRef.current) {
            searchRef.current.focus();
        }
    }, [isOpen, searchable]);

    const handleSelect = (opt: DropdownOption) => {
        onChange(opt.value);
        setIsOpen(false);
        setSearch('');
    };

    return (
        <div ref={containerRef} className={cn('relative', className)}>
            {/* Trigger */}
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className={cn(
                    'flex items-center justify-between gap-2 w-full rounded border border-border transition-colors',
                    'bg-element-bg hover:border-border-active focus:outline-none focus:ring-1 focus:ring-blue-500/50',
                    'disabled:opacity-50 disabled:pointer-events-none',
                    {
                        'h-7 px-2 text-xs': size === 'sm',
                        'h-9 px-3 text-sm': size === 'md',
                        'border-brand/50': isOpen,
                    }
                )}
            >
                <span className={cn('truncate', !selectedOption && 'text-text-secondary')}>
                    {selectedOption ? (
                        <span className="flex items-center gap-2">
                            {selectedOption.icon}
                            {selectedOption.label}
                        </span>
                    ) : placeholder}
                </span>
                <ChevronDown size={14} className={cn(
                    'text-text-secondary transition-transform shrink-0',
                    isOpen && 'rotate-180'
                )} />
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute z-dropdown top-full left-0 right-0 mt-1 bg-panel-bg border border-border rounded shadow-dropdown animate-fade-in overflow-hidden">
                    {/* Search */}
                    {searchable && (
                        <div className="p-2 border-b border-border">
                            <div className="flex items-center gap-2 px-2 py-1 bg-element-bg rounded">
                                <Search size={14} className="text-text-secondary shrink-0" />
                                <input
                                    ref={searchRef}
                                    type="text"
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    placeholder="Search..."
                                    className="flex-1 bg-transparent text-sm text-text outline-none placeholder:text-text-muted"
                                />
                            </div>
                        </div>
                    )}

                    {/* Options */}
                    <div className="max-h-60 overflow-auto py-1">
                        {filteredOptions.length === 0 ? (
                            <div className="px-3 py-2 text-xs text-text-secondary text-center">
                                No results found
                            </div>
                        ) : (
                            filteredOptions.map(opt => (
                                <button
                                    key={opt.value}
                                    onClick={() => handleSelect(opt)}
                                    className={cn(
                                        'flex items-center gap-2 w-full px-3 py-2 text-left text-sm transition-colors',
                                        'hover:bg-element-bg',
                                        opt.value === value && 'bg-brand/10 text-brand'
                                    )}
                                >
                                    {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                                    <div className="flex-1 min-w-0">
                                        <div className="truncate">{opt.label}</div>
                                        {opt.description && (
                                            <div className="text-xs text-text-secondary truncate">
                                                {opt.description}
                                            </div>
                                        )}
                                    </div>
                                    {opt.value === value && (
                                        <Check size={14} className="text-brand shrink-0" />
                                    )}
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
