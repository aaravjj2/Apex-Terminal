/**
 * v1.44 — Notifications Center Panel
 * DEMO-first unified notification feed.
 */
import { useState, useEffect } from 'react';
import { API_BASE } from '../../config/api';

interface Notification {
  id: string;
  type: string;
  severity: string;
  title: string;
  message: string;
  source: string;
  read: boolean;
  timestamp: string;
}

const severityColors: Record<string, string> = {
  info: 'bg-blue-500/20 text-blue-400',
  warning: 'bg-yellow-500/20 text-yellow-400',
  critical: 'bg-red-500/20 text-red-400',
};

export function NotificationsPanel() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/v1/notifications`)
      .then(r => r.json())
      .then(data => setNotifications(Array.isArray(data) ? data : []))
      .catch(() => setNotifications([]))
      .finally(() => setLoading(false));
  }, []);

  const unread = notifications.filter(n => !n.read).length;

  return (
    <div data-testid="notifications-panel" className="h-full flex flex-col bg-background p-4">
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-lg font-semibold text-text">Notifications</h2>
        <span className="text-xs text-text-muted bg-element-bg px-2 py-0.5 rounded">v1.44 — DEMO</span>
        {unread > 0 && (
          <span data-testid="notifications-badge" className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full font-medium">
            {unread} unread
          </span>
        )}
      </div>

      {loading && (
        <div data-testid="notifications-loading" className="animate-pulse space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-16 bg-element-bg/50 rounded-lg" />)}
        </div>
      )}

      {!loading && notifications.length === 0 && (
        <div data-testid="notifications-empty" className="text-center py-12 text-text-muted">
          <p className="text-sm">No notifications</p>
        </div>
      )}

      {!loading && notifications.length > 0 && (
        <div className="flex-1 overflow-y-auto space-y-2">
          {notifications.map((n, idx) => (
            <div
              key={n.id}
              data-testid={`notification-item-${idx}`}
              className={`p-3 rounded-lg border transition-colors ${
                n.read ? 'border-border/30 bg-element-bg/10' : 'border-brand/30 bg-brand/5'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${severityColors[n.severity] || 'bg-gray-500/20 text-gray-400'}`}>
                  {n.severity}
                </span>
                <span className="text-sm font-medium text-text">{n.title}</span>
                {!n.read && <span className="ml-auto w-2 h-2 rounded-full bg-brand" />}
              </div>
              <p className="text-xs text-text-secondary">{n.message}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[9px] text-text-muted">{n.source}</span>
                <span className="text-[9px] text-text-muted ml-auto">{n.timestamp}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div data-testid="notifications-panel-ready" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden' }}>ready</div>
    </div>
  );
}
