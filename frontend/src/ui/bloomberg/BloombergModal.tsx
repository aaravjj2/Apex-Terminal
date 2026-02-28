/**
 * BloombergModal.tsx
 * Modal, Drawer, Popover, and Dialog primitives for Apex Terminal.
 * Fully accessible (focus trap, ESC close, aria roles), Bloomberg dark theme,
 * supports keyboard navigation, drag-to-resize drawers, and portal rendering.
 */

import React, {
  useState, useEffect, useRef, useCallback, createContext, useContext,
  createPortal, type ReactNode,
} from 'react';

// ─── Context ──────────────────────────────────────────────────────────────────

interface ModalStackContextType {
  push: (id: string) => void;
  pop: (id: string) => void;
  isTop: (id: string) => boolean;
}

const ModalStackContext = createContext<ModalStackContextType>({
  push: () => undefined,
  pop: () => undefined,
  isTop: () => true,
});

export const ModalStackProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [stack, setStack] = useState<string[]>([]);
  const push = useCallback((id: string) => setStack(s => [...s, id]), []);
  const pop = useCallback((id: string) => setStack(s => s.filter(x => x !== id)), []);
  const isTop = useCallback((id: string) => stack[stack.length - 1] === id, [stack]);
  return (
    <ModalStackContext.Provider value={{ push, pop, isTop }}>
      {children}
    </ModalStackContext.Provider>
  );
};

// ─── Focus Trap ───────────────────────────────────────────────────────────────

function useFocusTrap(containerRef: React.RefObject<HTMLElement | null>, active: boolean): void {
  useEffect(() => {
    if (!active || !containerRef.current) return;
    const el = containerRef.current;
    const focusable = el.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    first?.focus();

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    };

    el.addEventListener('keydown', handleTab);
    return () => el.removeEventListener('keydown', handleTab);
  }, [active, containerRef]);
}

// ─── Lock Body Scroll ─────────────────────────────────────────────────────────

let lockCount = 0;
function lockBodyScroll(): () => void {
  lockCount++;
  if (lockCount === 1) {
    const scrollY = window.scrollY;
    document.body.style.cssText = `position:fixed;top:-${scrollY}px;left:0;right:0;overflow-y:scroll;`;
  }
  return () => {
    lockCount--;
    if (lockCount === 0) {
      const scrollY = -parseInt(document.body.style.top || '0', 10);
      document.body.style.cssText = '';
      window.scrollTo(0, scrollY);
    }
  };
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';
export type DrawerSide = 'left' | 'right' | 'top' | 'bottom';
export type DialogVariant = 'info' | 'warning' | 'error' | 'success' | 'confirm';
export type PopoverPlacement = 'top' | 'bottom' | 'left' | 'right' | 'auto';

interface BaseOverlayProps {
  open: boolean;
  onClose: () => void;
  closeOnBackdrop?: boolean;
  closeOnEsc?: boolean;
  id?: string;
}

// ─── Overlay Backdrop ─────────────────────────────────────────────────────────

interface BackdropProps {
  visible: boolean;
  onClick?: () => void;
  blur?: boolean;
  opacity?: number;
}

const Backdrop: React.FC<BackdropProps> = ({ visible, onClick, blur = false, opacity = 0.6 }) => (
  <div
    className={`bloomberg-backdrop ${visible ? 'bloomberg-backdrop--visible' : ''}`}
    onClick={onClick}
    style={{
      position: 'fixed',
      inset: 0,
      background: `rgba(5, 12, 24, ${opacity})`,
      backdropFilter: blur ? 'blur(2px)' : undefined,
      zIndex: 900,
      opacity: visible ? 1 : 0,
      transition: 'opacity 0.2s ease',
      pointerEvents: visible ? 'auto' : 'none',
    }}
  />
);

// ─── Modal ────────────────────────────────────────────────────────────────────

const SIZE_WIDTHS: Record<ModalSize, number | string> = {
  sm: 400,
  md: 600,
  lg: 800,
  xl: 1100,
  full: '96vw',
};

export interface ModalProps extends BaseOverlayProps {
  title?: string;
  size?: ModalSize;
  children: ReactNode;
  footer?: ReactNode;
  headerActions?: ReactNode;
  showClose?: boolean;
  scrollable?: boolean;
  className?: string;
}

export const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  closeOnBackdrop = true,
  closeOnEsc = true,
  title,
  size = 'md',
  children,
  footer,
  headerActions,
  showClose = true,
  scrollable = true,
  className = '',
  id,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const { push, pop } = useContext(ModalStackContext);
  const uid = id ?? `modal-${Math.random().toString(36).slice(2)}`;

  useFocusTrap(dialogRef, open);

  useEffect(() => {
    if (open) { push(uid); return lockBodyScroll(); }
    else { pop(uid); }
    return undefined;
  }, [open, uid, push, pop]);

  useEffect(() => {
    if (!closeOnEsc || !open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [closeOnEsc, open, onClose]);

  if (!open) return null;

  return createPortal(
    <>
      <Backdrop visible={open} onClick={closeOnBackdrop ? onClose : undefined} blur />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${uid}-title`}
        ref={dialogRef}
        className={`bloomberg-modal ${className}`}
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: SIZE_WIDTHS[size],
          maxWidth: '95vw',
          maxHeight: '90vh',
          background: '#0e1c2e',
          border: '1px solid #2a3a4a',
          borderRadius: 6,
          display: 'flex',
          flexDirection: 'column',
          zIndex: 1000,
          boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header */}
        {(title || showClose || headerActions) && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            padding: '12px 16px',
            borderBottom: '1px solid #1a2a3a',
            flexShrink: 0,
          }}>
            {title && (
              <div id={`${uid}-title`} style={{ flex: 1, color: '#ddd', fontSize: 14, fontWeight: 'bold', fontFamily: 'monospace' }}>
                {title}
              </div>
            )}
            {headerActions && <div style={{ marginRight: 8 }}>{headerActions}</div>}
            {showClose && (
              <button
                onClick={onClose}
                aria-label="Close modal"
                style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 16, padding: '0 4px', lineHeight: 1 }}
              >
                ✕
              </button>
            )}
          </div>
        )}
        {/* Body */}
        <div style={{ flex: 1, overflow: scrollable ? 'auto' : 'hidden', padding: '16px' }}>
          {children}
        </div>
        {/* Footer */}
        {footer && (
          <div style={{ padding: '12px 16px', borderTop: '1px solid #1a2a3a', flexShrink: 0 }}>
            {footer}
          </div>
        )}
      </div>
    </>,
    document.body,
  );
};

// ─── Drawer ───────────────────────────────────────────────────────────────────

export interface DrawerProps extends BaseOverlayProps {
  side?: DrawerSide;
  width?: number | string;
  height?: number | string;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  showClose?: boolean;
  className?: string;
}

export const Drawer: React.FC<DrawerProps> = ({
  open,
  onClose,
  closeOnBackdrop = true,
  closeOnEsc = true,
  side = 'right',
  width = 440,
  height = '50vh',
  title,
  children,
  footer,
  showClose = true,
  className = '',
  id,
}) => {
  const drawerRef = useRef<HTMLDivElement>(null);
  useFocusTrap(drawerRef, open);

  useEffect(() => {
    if (open) { return lockBodyScroll(); }
    return undefined;
  }, [open]);

  useEffect(() => {
    if (!closeOnEsc || !open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [closeOnEsc, open, onClose]);

  const isHorizontal = side === 'left' || side === 'right';
  const sizeStyle: React.CSSProperties = isHorizontal
    ? { width, height: '100vh', top: 0, bottom: 0, [side]: 0 }
    : { height, width: '100vw', left: 0, right: 0, [side]: 0 };

  const translate = (() => {
    switch (side) {
      case 'left': return open ? 'translateX(0)' : 'translateX(-100%)';
      case 'right': return open ? 'translateX(0)' : 'translateX(100%)';
      case 'top': return open ? 'translateY(0)' : 'translateY(-100%)';
      case 'bottom': return open ? 'translateY(0)' : 'translateY(100%)';
    }
  })();

  if (!open) return null;

  return createPortal(
    <>
      <Backdrop visible={open} onClick={closeOnBackdrop ? onClose : undefined} />
      <div
        role="dialog"
        aria-modal="true"
        ref={drawerRef}
        className={`bloomberg-drawer bloomberg-drawer--${side} ${className}`}
        style={{
          position: 'fixed',
          ...sizeStyle,
          background: '#0e1c2e',
          border: `1px solid #2a3a4a`,
          display: 'flex',
          flexDirection: 'column',
          zIndex: 1000,
          transform: translate,
          transition: 'transform 0.25s ease',
          boxShadow: '0 0 40px rgba(0,0,0,0.5)',
        }}
      >
        {(title || showClose) && (
          <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #1a2a3a', flexShrink: 0 }}>
            {title && <div style={{ flex: 1, color: '#ddd', fontSize: 13, fontWeight: 'bold', fontFamily: 'monospace' }}>{title}</div>}
            {showClose && (
              <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 16 }}>
                ✕
              </button>
            )}
          </div>
        )}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>{children}</div>
        {footer && <div style={{ padding: '12px 16px', borderTop: '1px solid #1a2a3a', flexShrink: 0 }}>{footer}</div>}
      </div>
    </>,
    document.body,
  );
};

// ─── Dialog (Confirm/Alert) ────────────────────────────────────────────────────

export interface DialogProps extends BaseOverlayProps {
  variant?: DialogVariant;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  loading?: boolean;
  className?: string;
}

const DIALOG_ICONS: Record<DialogVariant, string> = {
  info: 'ℹ',
  warning: '⚠',
  error: '✕',
  success: '✓',
  confirm: '?',
};

const DIALOG_COLORS: Record<DialogVariant, string> = {
  info: '#4a9eff',
  warning: '#ffcc00',
  error: '#ff4444',
  success: '#00d4aa',
  confirm: '#888',
};

export const Dialog: React.FC<DialogProps> = ({
  open,
  onClose,
  variant = 'info',
  title,
  message,
  confirmLabel = 'OK',
  cancelLabel = 'Cancel',
  onConfirm,
  loading = false,
  className = '',
}) => {
  const color = DIALOG_COLORS[variant];
  return (
    <Modal open={open} onClose={onClose} size="sm" className={className} showClose={false}>
      <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
        <div style={{ fontSize: 36, marginBottom: 12, color }}>{DIALOG_ICONS[variant]}</div>
        <div style={{ color: '#ddd', fontSize: 16, fontWeight: 'bold', marginBottom: 8 }}>{title}</div>
        <div style={{ color: '#aaa', fontSize: 13, lineHeight: 1.5 }}>{message}</div>
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 8 }}>
        {variant === 'confirm' && (
          <button
            onClick={onClose}
            style={{ padding: '8px 20px', background: '#1a2a3a', border: '1px solid #2a3a4a', borderRadius: 4, color: '#aaa', cursor: 'pointer', fontSize: 12 }}
          >
            {cancelLabel}
          </button>
        )}
        <button
          onClick={() => { onConfirm?.(); onClose(); }}
          disabled={loading}
          style={{ padding: '8px 20px', background: color, border: 'none', borderRadius: 4, color: '#000', cursor: 'pointer', fontWeight: 'bold', fontSize: 12 }}
        >
          {loading ? '...' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
};

// ─── Popover ──────────────────────────────────────────────────────────────────

export interface PopoverProps {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  placement?: PopoverPlacement;
  children: ReactNode;
  closeOnClickOutside?: boolean;
  className?: string;
}

export const Popover: React.FC<PopoverProps> = ({
  open,
  onClose,
  anchorRef,
  placement = 'bottom',
  children,
  closeOnClickOutside = true,
  className = '',
}) => {
  const popRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!open || !anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    const pop = popRef.current;
    const pw = pop?.offsetWidth ?? 200;
    const ph = pop?.offsetHeight ?? 100;
    let top = 0, left = 0;
    switch (placement) {
      case 'bottom': top = rect.bottom + 6; left = rect.left; break;
      case 'top': top = rect.top - ph - 6; left = rect.left; break;
      case 'left': top = rect.top; left = rect.left - pw - 6; break;
      case 'right': top = rect.top; left = rect.right + 6; break;
      default: top = rect.bottom + 6; left = rect.left;
    }
    setPosition({ top, left });
  }, [open, placement, anchorRef]);

  useEffect(() => {
    if (!closeOnClickOutside || !open) return;
    const handler = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node) &&
        anchorRef.current && !anchorRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [closeOnClickOutside, open, onClose, anchorRef]);

  if (!open) return null;

  return createPortal(
    <div
      ref={popRef}
      className={`bloomberg-popover ${className}`}
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        background: '#0e1c2e',
        border: '1px solid #3a4a5a',
        borderRadius: 6,
        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        zIndex: 1050,
        minWidth: 180,
        padding: 4,
      }}
    >
      {children}
    </div>,
    document.body,
  );
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useModal(defaultOpen = false): { open: boolean; openModal: () => void; closeModal: () => void; toggle: () => void } {
  const [open, setOpen] = useState(defaultOpen);
  return {
    open,
    openModal: useCallback(() => setOpen(true), []),
    closeModal: useCallback(() => setOpen(false), []),
    toggle: useCallback(() => setOpen(p => !p), []),
  };
}

export function useDialog(): {
  dialogProps: Pick<DialogProps, 'open' | 'onClose' | 'title' | 'message' | 'variant' | 'onConfirm'>;
  openDialog: (opts: { title: string; message: ReactNode; variant?: DialogVariant; onConfirm?: () => void }) => void;
  closeDialog: () => void;
} {
  const [state, setState] = useState<{ open: boolean; title: string; message: ReactNode; variant: DialogVariant; onConfirm?: () => void }>({
    open: false, title: '', message: '', variant: 'info',
  });
  return {
    dialogProps: {
      open: state.open,
      onClose: () => setState(s => ({ ...s, open: false })),
      title: state.title,
      message: state.message,
      variant: state.variant,
      onConfirm: state.onConfirm,
    },
    openDialog: (opts) => setState({ open: true, title: opts.title, message: opts.message, variant: opts.variant ?? 'info', onConfirm: opts.onConfirm }),
    closeDialog: () => setState(s => ({ ...s, open: false })),
  };
}

export default Modal;
