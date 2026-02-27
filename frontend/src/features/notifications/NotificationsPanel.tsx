// Bloomberg palette
const BG = '#0a0a0a';
const PANEL = '#111111';
const BORDER = '#1e1e1e';
const AMBER = '#f5a623';
const GREEN = '#26a69a';
const RED = '#ef5350';
const BLUE = '#42a5f5';
const PURPLE = '#ab47bc';
const ORANGE = '#ff8a65';
const SUBTLE = '#555';
const TEXT = '#d1d4dc';
const MONO = '"Roboto Mono","Courier New",monospace';

const API_BASE = '/api/v1';

const SEV_COLORS: Record<string, string> = {
  info: BLUE, warning: AMBER, critical: RED, error: RED, success: GREEN, debug: SUBTLE,
};

const TYPE_ICONS: Record<string, string> = {
  trade: 'â‡„', system: 'âš™', risk: 'âš ', strategy: 'â—ˆ', alert: 'â—‰', market: 'â–²', portfolio: 'â—Ž',
};

const SEVERITIES = ['all', 'critical', 'warning', 'info', 'success'];
const TYPES = ['all', 'trade', 'system', 'risk', 'strategy', 'alert', 'market', 'portfolio'];

interface Notification {
  id: string;
  type: string;
  severity: string;
  title: string;
  message: string;
  source: string;
  read: boolean;
  timestamp: string;
  meta?: Record<string, string | number>;
}

const NotifRow: React.FC<{
  notif: Notification;
  idx: number;
  selected: boolean;
  onClick: () => void;
  onMarkRead: () => void;
}> = ({ notif, idx, selected, onClick, onMarkRead }) => {
  const [hov, setHov] = React.useState(false);
  const sevCol = SEV_COLORS[notif.severity] || SUBTLE;
  const icon = TYPE_ICONS[notif.type] || 'â—‰';
  return (
    <div
      data-testid={`notification-item-${idx}`}
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: '8px 12px',
        borderBottom: `1px solid ${BORDER}`,
        background: selected ? '#1a1a2a' : hov ? '#141414' : notif.read ? 'transparent' : '#0f0f1a',
        cursor: 'pointer',
        borderLeft: `3px solid ${notif.read ? BORDER : sevCol}`,
        transition: 'background 0.12s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
        <span style={{ fontSize: 12, color: sevCol }}>{icon}</span>
        <span style={{ fontSize: 11, color: sevCol, letterSpacing: 0.5, textTransform: 'uppercase', fontSize: 9 }}>
          {notif.severity}
        </span>
        <span style={{ fontSize: 9, color: SUBTLE, marginLeft: 2 }}>{notif.type}</span>
        {!notif.read && <span style={{ marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%', background: sevCol, display: 'inline-block' }} />}
        {notif.read && <span style={{ marginLeft: 'auto' }} />}
      </div>
      <div style={{ fontSize: 12, color: notif.read ? SUBTLE : TEXT, fontWeight: notif.read ? 400 : 600, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {notif.title}
      </div>
      <div style={{ fontSize: 11, color: SUBTLE, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2 }}>
        {notif.message}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: SUBTLE }}>
        <span>{notif.source}</span>
        <span>{notif.timestamp?.replace('T', ' ').slice(0, 16)}</span>
      </div>
    </div>
  );
};

/**
 * Bloomberg NF â€” Notifications Feed
 */
import React, { useState, useEffect, useCallback } from 'react';

export function NotificationsPanel() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSev, setFilterSev] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterUnread, setFilterUnread] = useState(false);
  const [selectedNotif, setSelectedNotif] = useState<Notification | null>(null);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    fetch(`${API_BASE}/notifications`)
      .then(r => r.ok ? r.json() : [])
      .then(data => setNotifications(Array.isArray(data) ? data : []))
      .catch(() => setNotifications([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const markRead = (id: string) => {
    setReadIds(prev => new Set([...prev, id]));
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllRead = () => {
    const allIds = notifications.map(n => n.id);
    setReadIds(prev => new Set([...prev, ...allIds]));
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const enriched = notifications.map(n => ({
    ...n,
    read: n.read || readIds.has(n.id),
  }));

  const filtered = enriched
    .filter(n => filterSev === 'all' || n.severity === filterSev)
    .filter(n => filterType === 'all' || n.type === filterType)
    .filter(n => !filterUnread || !n.read)
    .filter(n => !search || n.title.toLowerCase().includes(search.toLowerCase()) || n.message.toLowerCase().includes(search.toLowerCase()));

  const unread = enriched.filter(n => !n.read).length;
  const bySev = SEVERITIES.slice(1).reduce<Record<string, number>>((acc, s) => {
    acc[s] = enriched.filter(n => n.severity === s).length;
    return acc;
  }, {});

  return (
    <div
      data-testid="notifications-panel"
      style={{ display: 'flex', flexDirection: 'column', height: '100%', background: BG, fontFamily: MONO, color: TEXT }}
    >
      {/* Header */}
      <div style={{ padding: '10px 14px', borderBottom: `1px solid ${BORDER}`, background: PANEL, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 13, color: AMBER, fontWeight: 700, letterSpacing: 2 }}>NF</span>
        <span style={{ fontSize: 11, color: SUBTLE, letterSpacing: 1 }}>NOTIFICATIONS</span>
        {unread > 0 && (
          <span data-testid="notifications-badge" style={{ fontSize: 10, background: RED, color: BG, borderRadius: 10, padding: '1px 6px', fontWeight: 700, fontFamily: MONO }}>
            {unread}
          </span>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button onClick={markAllRead} style={{ background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: 2, padding: '3px 10px', color: SUBTLE, fontFamily: MONO, fontSize: 10, cursor: 'pointer', letterSpacing: 1 }}>
            MARK ALL READ
          </button>
          <button onClick={load} style={{ background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: 2, padding: '3px 10px', color: SUBTLE, fontFamily: MONO, fontSize: 10, cursor: 'pointer' }}>â†º</button>
        </div>
      </div>

      {/* Summary strip */}
      <div style={{ padding: '5px 14px', borderBottom: `1px solid ${BORDER}`, background: PANEL, display: 'flex', gap: 16 }}>
        {[
          { label: 'TOTAL', val: enriched.length, col: TEXT },
          { label: 'UNREAD', val: unread, col: unread > 0 ? RED : SUBTLE },
          { label: 'CRIT', val: bySev.critical || 0, col: RED },
          { label: 'WARN', val: bySev.warning || 0, col: AMBER },
          { label: 'INFO', val: bySev.info || 0, col: BLUE },
        ].map(({ label, val, col }) => (
          <div key={label}>
            <div style={{ fontSize: 9, color: SUBTLE, letterSpacing: 1 }}>{label}</div>
            <div style={{ fontSize: 12, fontFamily: MONO, color: col, fontWeight: 600 }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div style={{ padding: '6px 14px', borderBottom: `1px solid ${BORDER}`, background: PANEL, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        {SEVERITIES.map(s => {
          const col = s === 'all' ? TEXT : (SEV_COLORS[s] || SUBTLE);
          const active = filterSev === s;
          return (
            <button key={s} onClick={() => setFilterSev(s)} style={{
              background: active ? col + '22' : 'transparent',
              border: `1px solid ${active ? col : BORDER}`,
              borderRadius: 2, padding: '2px 8px', color: active ? col : SUBTLE,
              fontFamily: MONO, fontSize: 10, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: 1,
            }}>{s}</button>
          );
        })}
        <button onClick={() => setFilterUnread(u => !u)} style={{
          background: filterUnread ? RED + '22' : 'transparent',
          border: `1px solid ${filterUnread ? RED : BORDER}`,
          borderRadius: 2, padding: '2px 8px', color: filterUnread ? RED : SUBTLE,
          fontFamily: MONO, fontSize: 10, cursor: 'pointer', marginLeft: 4,
        }}>UNREAD</button>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search..."
          style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 3, padding: '3px 8px', color: TEXT, fontFamily: MONO, fontSize: 11, outline: 'none', width: 120, marginLeft: 'auto' }}
        />
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ flex: selectedNotif ? '0 0 55%' : '1 1 auto', overflow: 'auto', borderRight: selectedNotif ? `1px solid ${BORDER}` : 'none' }}>
          {loading && (
            <div data-testid="notifications-loading" style={{ padding: 24, textAlign: 'center', color: AMBER, letterSpacing: 2 }}>LOADING...</div>
          )}
          {!loading && filtered.length === 0 && (
            <div data-testid="notifications-empty" style={{ padding: 32, textAlign: 'center', color: SUBTLE, fontSize: 13 }}>
              No notifications
            </div>
          )}
          {!loading && filtered.map((n, i) => (
            <NotifRow
              key={n.id}
              notif={n}
              idx={i}
              selected={selectedNotif?.id === n.id}
              onClick={() => {
                setSelectedNotif(prev => prev?.id === n.id ? null : n);
                if (!n.read) markRead(n.id);
              }}
              onMarkRead={() => markRead(n.id)}
            />
          ))}
        </div>

        {selectedNotif && (
          <div style={{ flex: '0 0 45%', overflow: 'auto', background: PANEL, padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 11, color: SUBTLE, letterSpacing: 1 }}>NOTIFICATION DETAIL</div>
                <div style={{ fontSize: 13, color: TEXT, fontWeight: 600, marginTop: 4, lineHeight: 1.4 }}>{selectedNotif.title}</div>
              </div>
              <button onClick={() => setSelectedNotif(null)} style={{ background: 'transparent', border: 'none', color: SUBTLE, cursor: 'pointer', fontSize: 16, padding: 4 }}>âœ•</button>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 9, color: SEV_COLORS[selectedNotif.severity] || SUBTLE, background: (SEV_COLORS[selectedNotif.severity] || SUBTLE) + '22', border: `1px solid ${(SEV_COLORS[selectedNotif.severity] || SUBTLE)}44`, borderRadius: 2, padding: '2px 7px', textTransform: 'uppercase', letterSpacing: 1 }}>
                  {selectedNotif.severity}
                </span>
                <span style={{ fontSize: 9, color: SUBTLE, background: SUBTLE + '22', border: `1px solid ${SUBTLE}44`, borderRadius: 2, padding: '2px 7px', textTransform: 'uppercase', letterSpacing: 1 }}>
                  {selectedNotif.type}
                </span>
              </div>
            </div>
            <div style={{ fontSize: 12, color: TEXT, lineHeight: 1.7, marginBottom: 14, background: BG, borderRadius: 3, padding: 10 }}>
              {selectedNotif.message}
            </div>
            {[
              { label: 'SOURCE', val: selectedNotif.source },
              { label: 'TIMESTAMP', val: selectedNotif.timestamp?.replace('T', ' ').slice(0, 19) || '--' },
              { label: 'STATUS', val: selectedNotif.read ? 'READ' : 'UNREAD', col: selectedNotif.read ? SUBTLE : RED },
            ].map(({ label, val, col }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 11 }}>
                <span style={{ color: SUBTLE, letterSpacing: 1 }}>{label}</span>
                <span style={{ color: col || TEXT, fontFamily: MONO }}>{val}</span>
              </div>
            ))}
            {selectedNotif.meta && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 10, color: SUBTLE, letterSpacing: 1, marginBottom: 6 }}>METADATA</div>
                {Object.entries(selectedNotif.meta).map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 11 }}>
                    <span style={{ color: SUBTLE }}>{k}</span>
                    <span style={{ color: TEXT, fontFamily: MONO }}>{String(v)}</span>
                  </div>
                ))}
              </div>
            )}
            <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
              {!selectedNotif.read && (
                <button onClick={() => { markRead(selectedNotif.id); setSelectedNotif(n => n ? { ...n, read: true } : n); }} style={{ flex: 1, background: GREEN + '22', border: `1px solid ${GREEN}`, borderRadius: 3, padding: '6px 0', color: GREEN, fontFamily: MONO, fontSize: 10, cursor: 'pointer', letterSpacing: 1 }}>
                  MARK READ
                </button>
              )}
              <button style={{ flex: 1, background: RED + '22', border: `1px solid ${RED}`, borderRadius: 3, padding: '6px 0', color: RED, fontFamily: MONO, fontSize: 10, cursor: 'pointer', letterSpacing: 1 }}>
                DISMISS
              </button>
            </div>
          </div>
        )}
      </div>
      <div data-testid="notifications-panel-ready" />
    </div>
  );
}

export default NotificationsPanel;
