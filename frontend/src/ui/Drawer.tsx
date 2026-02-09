import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from './utils';

interface DrawerProps {
    open: boolean;
    onClose: () => void;
    title: string;
    description?: string;
    children?: ReactNode;
    footer?: ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
    side?: 'right' | 'left';
}

export function Drawer({
    open,
    onClose,
    title,
    description,
    children,
    footer,
    size = 'md',
    side = 'right',
}: DrawerProps) {
    const overlayRef = useRef<HTMLDivElement>(null);

    // Close on Escape
    useEffect(() => {
        if (!open) return;

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [open, onClose]);

    // Prevent body scroll when open
    useEffect(() => {
        if (open) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [open]);

    if (!open) return null;

    return (
        <div
            ref={overlayRef}
            className="fixed inset-0 z-modal flex overflow-hidden"
            onClick={(e) => e.target === overlayRef.current && onClose()}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 animate-fade-in backdrop-blur-sm" />

            {/* Drawer Panel */}
            <div className={cn(
                'relative flex flex-col h-full bg-panel-bg shadow-2xl transition-transform transform',
                {
                    'ml-auto border-l border-border animate-slide-in-right': side === 'right',
                    'mr-auto border-r border-border animate-slide-in-left': side === 'left',

                    // Sizes
                    'w-80': size === 'sm',
                    'w-96': size === 'md',
                    'w-[32rem]': size === 'lg',
                    'w-[40rem]': size === 'xl',
                    'w-full': size === 'full',
                }
            )}>
                {/* Header */}
                <div className="flex items-start justify-between p-4 border-b border-border shrink-0">
                    <div>
                        <h2 className="text-lg font-semibold text-text">{title}</h2>
                        {description && (
                            <p className="text-sm text-text-secondary mt-1">{description}</p>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="text-text-secondary hover:text-text p-1 -mr-1 rounded hover:bg-element-bg transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4">
                    {children}
                </div>

                {/* Footer */}
                {footer && (
                    <div className="flex items-center justify-end gap-3 p-4 border-t border-border shrink-0 bg-panel-bg">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
}
