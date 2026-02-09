import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { X, CheckCircle, AlertTriangle, XCircle, Info } from 'lucide-react';
import { cn } from './utils';

// Toast types
export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

interface Toast {
    id: string;
    message: string;
    variant: ToastVariant;
    action?: { label: string; onClick: () => void };
    duration?: number;
}

interface ToastContextValue {
    toasts: Toast[];
    addToast: (toast: Omit<Toast, 'id'>) => void;
    removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) throw new Error('useToast must be used within ToastProvider');
    return context;
}

// Toast Provider
interface ToastProviderProps {
    children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
        const id = Math.random().toString(36).slice(2);
        const duration = toast.duration ?? 4000;

        setToasts(prev => [...prev, { ...toast, id }]);

        if (duration > 0) {
            setTimeout(() => {
                setToasts(prev => prev.filter(t => t.id !== id));
            }, duration);
        }
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
            {children}
            <ToastContainer />
        </ToastContext.Provider>
    );
}

// Toast Container
function ToastContainer() {
    const { toasts, removeToast } = useToast();

    if (toasts.length === 0) return null;

    return (
        <div className="fixed bottom-4 right-4 z-toast flex flex-col gap-2 max-w-sm">
            {toasts.map(toast => (
                <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
            ))}
        </div>
    );
}

// Individual Toast
interface ToastItemProps {
    toast: Toast;
    onClose: () => void;
}

const variantConfig: Record<ToastVariant, { icon: ReactNode; className: string }> = {
    success: {
        icon: <CheckCircle size={16} />,
        className: 'border-up/30 text-up',
    },
    error: {
        icon: <XCircle size={16} />,
        className: 'border-down/30 text-down',
    },
    warning: {
        icon: <AlertTriangle size={16} />,
        className: 'border-warn/30 text-warn',
    },
    info: {
        icon: <Info size={16} />,
        className: 'border-brand/30 text-brand',
    },
};

function ToastItem({ toast, onClose }: ToastItemProps) {
    const config = variantConfig[toast.variant];

    return (
        <div className={cn(
            'flex items-start gap-3 p-3 rounded border bg-panel-bg shadow-toast animate-slide-up',
            config.className
        )}>
            <span className="shrink-0 mt-0.5">{config.icon}</span>
            <div className="flex-1 min-w-0">
                <p className="text-sm text-text">{toast.message}</p>
                {toast.action && (
                    <button
                        onClick={toast.action.onClick}
                        className="text-xs font-medium mt-1 hover:underline"
                    >
                        {toast.action.label}
                    </button>
                )}
            </div>
            <button
                onClick={onClose}
                className="text-text-secondary hover:text-text shrink-0"
            >
                <X size={14} />
            </button>
        </div>
    );
}
