/**
 * BloombergNotification.tsx
 * Bloomberg-style notification system.
 * Toast messages, notification center, alert banners,
 * notification badges, sound alerts, and global notification context.
 */

import React, { useState, useCallback, useEffect, useRef, createContext, useContext, useReducer } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type NotificationType = 'info' | 'success' | 'warning' | 'error' | 'trade' | 'alert' | 'news';
export type NotificationPriority = 'low' | 'medium' | 'high' | 'critical';
export type ToastPosition = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center';

export interface Notification {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  persistent?: boolean;
  duration?: number;    // ms, 0 = persistent
  action?: { label: string; onClick: () => void };
  ticker?: string;
  badge?: string;
  groupKey?: string;
}

export interface Toast extends Notification {
  visible: boolean;
  removing: boolean;
}

// ─── State ────────────────────────────────────────────────────────────────────

interface NotifState {
  notifications: Notification[];
  toasts: Toast[];
  unreadCount: number;
  panelOpen: boolean;
}

type NotifAction =
  | { type: 'ADD'; payload: Notification }
  | { type: 'REMOVE_TOAST'; id: string }
  | { type: 'MARK_READ'; id: string }
  | { type: 'MARK_ALL_READ' }
  | { type: 'DELETE'; id: string }
  | { type: 'CLEAR_ALL' }
  | { type: 'TOGGLE_PANEL' }
  | { type: 'CLOSE_PANEL' };

function notifReducer(state: NotifState, action: NotifAction): NotifState {
  switch (action.type) {
    case 'ADD': {
      const toast: Toast = { ...action.payload, visible: true, removing: false };
      return {
        ...state,
        notifications: [action.payload, ...state.notifications].slice(0, 200),
        toasts: [toast, ...state.toasts].slice(0, 6),
        unreadCount: state.unreadCount + 1,
      };
    }
    case 'REMOVE_TOAST':
      return { ...state, toasts: state.toasts.filter(t => t.id !== action.id) };
    case 'MARK_READ': {
      const notifs = state.notifications.map(n => n.id === action.id ? { ...n, read: true } : n);
      return { ...state, notifications: notifs, unreadCount: notifs.filter(n => !n.read).length };
    }
    case 'MARK_ALL_READ':
      return { ...state, notifications: state.notifications.map(n => ({ ...n, read: true })), unreadCount: 0 };
    case 'DELETE':
      return { ...state, notifications: state.notifications.filter(n => n.id !== action.id) };
    case 'CLEAR_ALL':
      return { ...state, notifications: [], unreadCount: 0 };
    case 'TOGGLE_PANEL':
      return { ...state, panelOpen: !state.panelOpen };
    case 'CLOSE_PANEL':
      return { ...state, panelOpen: false };
    default:
      return state;
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface NotifContextValue {
  state: NotifState;
  notify: (opts: Omit<Notification, 'id' | 'timestamp' | 'read'>) => string;
  success: (title: string, message: string, opts?: Partial<Notification>) => void;
  error: (title: string, message: string, opts?: Partial<Notification>) => void;
  warning: (title: string, message: string, opts?: Partial<Notification>) => void;
  info: (title: string, message: string, opts?: Partial<Notification>) => void;
  trade: (title: string, message: string, opts?: Partial<Notification>) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  remove: (id: string) => void;
  clearAll: () => void;
  togglePanel: () => void;
}

const NotifContext = createContext<NotifContextValue | null>(null);

export function useNotifications(): NotifContextValue {
  const ctx = useContext(NotifContext);
  if (!ctx) throw new Error('useNotifications must be used inside NotificationProvider');
  return ctx;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export const NotificationProvider: React.FC<{ children: React.ReactNode; position?: ToastPosition }> = ({
  children, position = 'top-right',
}) => {
  const [state, dispatch] = useReducer(notifReducer, {
    notifications: [], toasts: [], unreadCount: 0, panelOpen: false,
  });
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const notify = useCallback((opts: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    const id = `notif_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const notification: Notification = { ...opts, id, timestamp: new Date(), read: false };
    dispatch({ type: 'ADD', payload: notification });
    const dur = opts.duration ?? (opts.type === 'error' ? 8000 : opts.type === 'trade' ? 6000 : 4000);
    if (dur > 0 && !opts.persistent) {
      const timer = setTimeout(() => dispatch({ type: 'REMOVE_TOAST', id }), dur);
      timers.current.set(id, timer);
    }
    return id;
  }, []);

  const success = useCallback((title: string, message: string, opts?: Partial<Notification>) =>
    notify({ type: 'success', priority: 'medium', title, message, ...opts }) && undefined, [notify]);
  const error = useCallback((title: string, message: string, opts?: Partial<Notification>) =>
    notify({ type: 'error', priority: 'high', title, message, ...opts }) && undefined, [notify]);
  const warning = useCallback((title: string, message: string, opts?: Partial<Notification>) =>
    notify({ type: 'warning', priority: 'medium', title, message, ...opts }) && undefined, [notify]);
  const info = useCallback((title: string, message: string, opts?: Partial<Notification>) =>
    notify({ type: 'info', priority: 'low', title, message, ...opts }) && undefined, [notify]);
  const trade = useCallback((title: string, message: string, opts?: Partial<Notification>) =>
    notify({ type: 'trade', priority: 'high', title, message, ...opts }) && undefined, [notify]);
  const markRead = useCallback((id: string) => dispatch({ type: 'MARK_READ', id }), []);
  const markAllRead = useCallback(() => dispatch({ type: 'MARK_ALL_READ' }), []);
  const remove = useCallback((id: string) => { clearTimeout(timers.current.get(id)); dispatch({ type: 'DELETE', id }); }, []);
  const clearAll = useCallback(() => dispatch({ type: 'CLEAR_ALL' }), []);
  const togglePanel = useCallback(() => dispatch({ type: 'TOGGLE_PANEL' }), []);

  useEffect(() => () => { timers.current.forEach(t => clearTimeout(t)); }, []);

  return (
    <NotifContext.Provider value={{ state, notify, success, error, warning, info, trade, markRead, markAllRead, remove, clearAll, togglePanel }}>
      {children}
      <ToastContainer toasts={state.toasts} position={position} onClose={(id) => { clearTimeout(timers.current.get(id)); dispatch({ type: 'REMOVE_TOAST', id }); }} />
      {state.panelOpen && <NotificationPanel onClose={() => dispatch({ type: 'CLOSE_PANEL' })} />}
    </NotifContext.Provider>
  );
};

// ─── Type Configs ─────────────────────────────────────────────────────────────

function typeConfig(type: NotificationType): { color: string; icon: string; bg: string } {
  return ({
    info:    { color: '#4a9eff', icon: 'ℹ', bg: '#4a9eff22' },
    success: { color: '#00d4aa', icon: '✓', bg: '#00d4aa22' },
    warning: { color: '#ffcc00', icon: '⚠', bg: '#ffcc0022' },
    error:   { color: '#ff4466', icon: '✕', bg: '#ff446622' },
    trade:   { color: '#ff9900', icon: '◈', bg: '#ff990022' },
    alert:   { color: '#cc44ff', icon: '⚡', bg: '#cc44ff22' },
    news:    { color: '#00d4aa', icon: '📰', bg: '#00d4aa22' },
  })[type];
}

// ─── Toast Item ───────────────────────────────────────────────────────────────

const ToastItem: React.FC<{ toast: Toast; onClose: () => void }> = ({ toast, onClose }) => {
  const cfg = typeConfig(toast.type);
  return (
    <div style={{
      background: '#0e1c2e', border: `1px solid ${cfg.color}44`, borderLeft: `3px solid ${cfg.color}`,
      borderRadius: 4, padding: '10px 14px', minWidth: 280, maxWidth: 380, boxShadow: '0 4px 24px #000a',
      fontFamily: 'monospace', animation: 'slideIn 0.2s ease-out',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ color: cfg.color, fontSize: 13 }}>{cfg.icon}</span>
          <span style={{ color: '#ddd', fontSize: 11, fontWeight: 'bold' }}>{toast.title}</span>
          {toast.ticker && <span style={{ color: cfg.color, fontSize: 9, background: cfg.bg, padding: '1px 5px', borderRadius: 2 }}>{toast.ticker}</span>}
        </div>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#555', cursor: 'pointer', fontSize: 14, padding: 0, lineHeight: 1 }}>×</button>
      </div>
      <div style={{ color: '#888', fontSize: 10, paddingLeft: 22 }}>{toast.message}</div>
      {toast.action && (
        <button onClick={toast.action.onClick} style={{ marginTop: 8, marginLeft: 22, background: 'transparent', border: `1px solid ${cfg.color}44`, borderRadius: 2, color: cfg.color, cursor: 'pointer', fontSize: 9, padding: '2px 8px', fontFamily: 'monospace' }}>
          {toast.action.label}
        </button>
      )}
    </div>
  );
};

// ─── Toast Container ──────────────────────────────────────────────────────────

function positionStyle(pos: ToastPosition): React.CSSProperties {
  const base: React.CSSProperties = { position: 'fixed', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8 };
  const pad = 16;
  if (pos === 'top-right') return { ...base, top: pad, right: pad };
  if (pos === 'top-left') return { ...base, top: pad, left: pad };
  if (pos === 'bottom-right') return { ...base, bottom: pad, right: pad, flexDirection: 'column-reverse' };
  if (pos === 'bottom-left') return { ...base, bottom: pad, left: pad, flexDirection: 'column-reverse' };
  return { ...base, top: pad, left: '50%', transform: 'translateX(-50%)', alignItems: 'center' };
}

const ToastContainer: React.FC<{ toasts: Toast[]; position: ToastPosition; onClose: (id: string) => void }> = ({
  toasts, position, onClose,
}) => (
  <div style={positionStyle(position)}>
    {toasts.map(t => <ToastItem key={t.id} toast={t} onClose={() => onClose(t.id)} />)}
  </div>
);

// ─── Notification Panel ───────────────────────────────────────────────────────

const NotificationPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { state, markRead, markAllRead, remove, clearAll } = useNotifications();
  const [filter, setFilter] = useState<NotificationType | 'all'>('all');

  const filtered = state.notifications.filter(n => filter === 'all' || n.type === filter);

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0, width: 380, background: '#0a1628',
      borderLeft: '1px solid #1a2a38', zIndex: 9998, display: 'flex', flexDirection: 'column',
      fontFamily: 'monospace',
    }}>
      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid #1a2a38', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ color: '#ccc', fontSize: 12, fontWeight: 'bold' }}>NOTIFICATIONS</div>
          {state.unreadCount > 0 && <div style={{ color: '#4a9eff', fontSize: 9 }}>{state.unreadCount} unread</div>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={markAllRead} style={{ background: 'transparent', border: '1px solid #1a2a38', borderRadius: 2, color: '#4a9eff', cursor: 'pointer', fontSize: 9, padding: '3px 8px' }}>Mark All Read</button>
          <button onClick={clearAll} style={{ background: 'transparent', border: '1px solid #1a2a38', borderRadius: 2, color: '#ff4466', cursor: 'pointer', fontSize: 9, padding: '3px 8px' }}>Clear All</button>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#555', cursor: 'pointer', fontSize: 18 }}>×</button>
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', padding: '6px 8px', gap: 4, borderBottom: '1px solid #1a2a38', flexWrap: 'wrap' }}>
        {(['all', 'info', 'success', 'warning', 'error', 'trade', 'alert'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '2px 8px', borderRadius: 2, border: 'none', cursor: 'pointer', fontSize: 8,
            background: filter === f ? '#1a2a44' : 'transparent',
            color: filter === f ? '#4a9eff' : '#555',
          }}>{f.toUpperCase()}</button>
        ))}
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {filtered.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: '#444', fontSize: 10 }}>No notifications</div>
        )}
        {filtered.map(n => {
          const cfg = typeConfig(n.type);
          return (
            <div key={n.id} onClick={() => markRead(n.id)} style={{
              padding: '10px 16px', borderBottom: '1px solid #0e1c2e',
              background: n.read ? 'transparent' : '#0e1c2e',
              cursor: 'pointer', display: 'flex', gap: 10,
            }}>
              <span style={{ color: cfg.color, fontSize: 14, marginTop: 1 }}>{cfg.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                  <span style={{ color: n.read ? '#888' : '#ddd', fontSize: 10, fontWeight: 'bold' }}>{n.title}</span>
                  <span style={{ color: '#444', fontSize: 8 }}>{n.timestamp.toLocaleTimeString()}</span>
                </div>
                <div style={{ color: '#666', fontSize: 9, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.message}</div>
                {!n.read && <div style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.color, marginTop: 4 }} />}
              </div>
              <button onClick={e => { e.stopPropagation(); remove(n.id); }} style={{
                background: 'transparent', border: 'none', color: '#444', cursor: 'pointer', fontSize: 14, padding: 0, alignSelf: 'center',
              }}>×</button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Notification Bell ────────────────────────────────────────────────────────

export const NotificationBell: React.FC<{ size?: number }> = ({ size = 18 }) => {
  const { state, togglePanel } = useNotifications();
  return (
    <button onClick={togglePanel} style={{ background: 'transparent', border: 'none', cursor: 'pointer', position: 'relative', padding: 6 }}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={state.panelOpen ? '#4a9eff' : '#888'} strokeWidth={1.8}>
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
      {state.unreadCount > 0 && (
        <div style={{
          position: 'absolute', top: 2, right: 2, minWidth: 14, height: 14, borderRadius: 7,
          background: '#ff4466', color: '#fff', fontSize: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px',
        }}>{state.unreadCount > 99 ? '99+' : state.unreadCount}</div>
      )}
    </button>
  );
};

// ─── Alert Banner ─────────────────────────────────────────────────────────────

export interface AlertBannerProps {
  type?: NotificationType;
  title?: string;
  message: string;
  onClose?: () => void;
  action?: { label: string; onClick: () => void };
}

export const AlertBanner: React.FC<AlertBannerProps> = ({ type = 'info', title, message, onClose, action }) => {
  const cfg = typeConfig(type);
  return (
    <div style={{
      width: '100%', background: cfg.bg, borderTop: `2px solid ${cfg.color}`, padding: '8px 16px',
      display: 'flex', alignItems: 'center', gap: 12, fontFamily: 'monospace',
    }}>
      <span style={{ color: cfg.color, fontSize: 14 }}>{cfg.icon}</span>
      <div style={{ flex: 1 }}>
        {title && <span style={{ color: cfg.color, fontWeight: 'bold', fontSize: 10, marginRight: 8 }}>{title}</span>}
        <span style={{ color: '#bbb', fontSize: 10 }}>{message}</span>
      </div>
      {action && (
        <button onClick={action.onClick} style={{ background: 'transparent', border: `1px solid ${cfg.color}55`, borderRadius: 2, color: cfg.color, cursor: 'pointer', fontSize: 9, padding: '3px 10px', fontFamily: 'monospace' }}>
          {action.label}
        </button>
      )}
      {onClose && (
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#555', cursor: 'pointer', fontSize: 16 }}>×</button>
      )}
    </div>
  );
};

// ─── NotificationBadge ────────────────────────────────────────────────────────

export const NotificationBadge: React.FC<{ count: number; color?: string; children: React.ReactNode }> = ({
  count, color = '#ff4466', children,
}) => (
  <div style={{ position: 'relative', display: 'inline-flex' }}>
    {children}
    {count > 0 && (
      <div style={{
        position: 'absolute', top: -4, right: -6, minWidth: 14, height: 14, borderRadius: 7,
        background: color, color: '#fff', fontSize: 8, display: 'flex', alignItems: 'center',
        justifyContent: 'center', padding: '0 3px', fontFamily: 'monospace', fontWeight: 'bold',
      }}>{count > 99 ? '99+' : count}</div>
    )}
  </div>
);

export default NotificationProvider;
