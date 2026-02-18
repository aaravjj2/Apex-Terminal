import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from './utils';
import { Button } from './Button';

interface ModalProps {
    open: boolean;
    onClose: () => void;
    title: string;
    description?: string;
    children?: ReactNode;
    footer?: ReactNode;
    variant?: 'default' | 'danger';
    size?: 'sm' | 'md' | 'lg';
}

export function Modal({
    open,
    onClose,
    title,
    description,
    children,
    footer,
    variant = 'default',
    size = 'md',
}: ModalProps) {
    const overlayRef = useRef<HTMLDivElement>(null);
    const titleId = useRef<string>(`modal-title-${Math.random().toString(36).slice(2,9)}`);

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

    // Auto-focus first focusable element inside modal when opened (helps tests & accessibility)
    useEffect(() => {
        if (!open || !overlayRef.current) return;
        // Wait for content to render
        requestAnimationFrame(() => {
            const focusable = overlayRef.current!.querySelector<HTMLElement>('input, button, [tabindex]:not([tabindex="-1"])');
            if (focusable) focusable.focus();
        });
    }, [open]);

    if (!open) return null;

    return (
        <div
            ref={overlayRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId.current}
            data-testid="modal-dialog"
            className="fixed inset-0 z-modal flex items-center justify-center p-4"
            style={{ zIndex: 9999 }}
            onClick={(e) => e.target === overlayRef.current && onClose()}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 animate-fade-in" />

            {/* Modal */}
            <div className={cn(
                'relative bg-panel-bg border border-border rounded-lg shadow-modal animate-fade-in',
                'flex flex-col max-h-[85vh]',
                {
                    'w-full max-w-sm': size === 'sm',
                    'w-full max-w-md': size === 'md',
                    'w-full max-w-lg': size === 'lg',
                }
            )}>
                {/* Header */}
                <div className="flex items-start justify-between p-4 border-b border-border shrink-0">
                    <div>
                        <h2 id={titleId.current} className={cn(
                            'text-base font-semibold',
                            variant === 'danger' ? 'text-down' : 'text-text'
                        )}>
                            {title}
                        </h2>
                        {description && (
                            <p className="text-sm text-text-secondary mt-1">{description}</p>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="text-text-secondary hover:text-text p-1 -mr-1"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Content */}
                {children && (
                    <div className="flex-1 overflow-auto p-4">
                        {children}
                    </div>
                )}

                {/* Footer */}
                {footer && (
                    <div className="flex items-center justify-end gap-2 p-4 border-t border-border shrink-0">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
}

// Convenience component for confirmation dialogs
interface ConfirmModalProps {
    open: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'default' | 'danger';
    isLoading?: boolean;
}

export function ConfirmModal({
    open,
    onClose,
    onConfirm,
    title,
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    variant = 'default',
    isLoading = false,
}: ConfirmModalProps) {
    return (
        <Modal
            open={open}
            onClose={onClose}
            title={title}
            description={message}
            variant={variant}
            size="sm"
            footer={
                <>
                    <Button variant="ghost" onClick={onClose} disabled={isLoading}>
                        {cancelLabel}
                    </Button>
                    <Button
                        variant={variant === 'danger' ? 'danger' : 'primary'}
                        onClick={onConfirm}
                        isLoading={isLoading}
                    >
                        {confirmLabel}
                    </Button>
                </>
            }
        />
    );
}
