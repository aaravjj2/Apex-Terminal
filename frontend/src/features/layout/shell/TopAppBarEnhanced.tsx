// Bloomberg TopAppBarEnhanced
const BG = '#0a0a0a';
const PANEL = '#111111';
const BORDER = '#1e1e1e';
const AMBER = '#f5a623';
const GREEN = '#26a69a';
const RED = '#ef5350';
const BLUE = '#42a5f5';
const PURPLE = '#ab47bc';
const SUBTLE = '#555';
const TEXT = '#d1d4dc';
const MONO = '"Roboto Mono","Courier New",monospace';

import { useState, useEffect, useCallback } from 'react';
import React from 'react';
import { useStore } from '../../../state/store';
import { VoiceControl } from '../../tts/VoiceControl';
import { DataSourceSelector } from '../../data/DataSourceSelector';
import type { DataSourceId } from '../../data/providers';

interface AutopilotStatus {
  state: 'idle' | 'running' | 'paused' | 'error';
  mode: 'paper' | 'paused';
  kill_switch_active: boolean;
  last_cycle?: { success: boolean; timestamp: string; trades_placed: number; error?: string };
  next_run?: string;
  schedule: { enabled: boolean; interval_minutes: number; market_hours_only: boolean };
}
interface HealthStatus { provider: string; status: 'connected' | 'degraded' | 'disconnected' | 'error'; latency_ms?: number; last_check?: string; error?: string }
interface AccountInfo { broker: string; account_id: string; label?: string }
interface Notification { id: string; type: 'info' | 'warning' | 'error' | 'success'; title: string; message: string; timestamp: string; read: boolean }

function statusColor(s: string) {
  if (s === 'connected') return GREEN;
  if (s === 'degraded') return AMBER;
  if (s === 'error') return RED;
  return SUBTLE;
}
function wsColor(s: string) { return s === 'CONNECTED' ? GREEN : s === 'CONNECTING' ? AMBER : s === 'DEGRADED' ? AMBER : RED; }

export function TopAppBarEnhanced() {
  const [autopilotStatus, setAutopilotStatus] = useState<AutopilotStatus | null>(null);
  const [healthStatuses, setHealthStatuses] = useState<Record<string, HealthStatus>>({});
  const [accountInfo, setAccountInfo] = useState<AccountInfo | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [marketTime, setMarketTime] = useState(new Date());
  const [wsReconnecting, setWsReconnecting] = useState(false);
  const [dataSource, setDataSource] = useState<DataSourceId>('fixture');

  const wsState = useStore(state => state.wsState);
  const forceReconnect = useStore(state => state.forceReconnect);

  const handleWsReconnect = async () => {
    setWsReconnecting(true);
    try { forceReconnect(); await new Promise(r => setTimeout(r, 2000)); } finally { setWsReconnecting(false); }
  };

  const fetchAutopilotStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/autopilot/status');
      if (res.ok) {
        const data = await res.json();
        setAutopilotStatus({ state: data.state || 'idle', mode: data.mode || 'paper', kill_switch_active: data.kill_switch_active || false, last_cycle: data.last_cycle, next_run: data.next_run, schedule: data.schedule || { enabled: true, interval_minutes: 15, market_hours_only: true } });
      }
    } catch { /* ignore */ }
  }, []);

  const fetchHealthStatuses = useCallback(async () => {
    const statuses: Record<string, HealthStatus> = {};
    try { const res = await fetch('/api/v1/autopilot/broker/metrics'); if (res.ok) { const d = await res.json(); statuses['alpaca_rest'] = { provider: 'Alpaca REST', status: d.connected ? 'connected' : 'disconnected', latency_ms: d.avg_latency_ms }; } } catch { statuses['alpaca_rest'] = { provider: 'Alpaca REST', status: 'disconnected' }; }
    if (autopilotStatus) statuses['alpaca_stream'] = { provider: 'Alpaca Stream', status: autopilotStatus.state === 'running' ? 'connected' : 'degraded' };
    try { const res = await fetch('/health'); if (res.ok) { statuses['finnhub'] = { provider: 'Finnhub', status: 'connected' }; statuses['yfinance'] = { provider: 'yfinance', status: 'connected' }; } } catch { statuses['finnhub'] = { provider: 'Finnhub', status: 'disconnected' }; statuses['yfinance'] = { provider: 'yfinance', status: 'disconnected' }; }
    try { const res = await fetch('/api/v1/autopilot/config'); if (res.ok) { const d = await res.json(); const llm = d.config?.llm_settings?.enabled; statuses['groq'] = { provider: 'Groq', status: llm ? 'connected' : 'disconnected' }; statuses['gemini'] = { provider: 'Gemini', status: llm ? 'connected' : 'disconnected' }; } } catch { statuses['groq'] = { provider: 'Groq', status: 'disconnected' }; statuses['gemini'] = { provider: 'Gemini', status: 'disconnected' }; }
    setHealthStatuses(statuses);
  }, [autopilotStatus]);

  const fetchAccountInfo = useCallback(async () => {
    try { const res = await fetch('/api/v1/autopilot/broker/metrics'); if (res.ok) { const d = await res.json(); setAccountInfo({ broker: 'Alpaca', account_id: d.account_id || 'PAPER-XXXX', label: 'Paper Trading' }); } }
    catch { setAccountInfo({ broker: 'Alpaca', account_id: 'PAPER-XXXX', label: 'Paper Trading' }); }
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/autopilot/logs?limit=20');
      if (res.ok) {
        const data = await res.json();
        const notifs: Notification[] = (data.logs || []).slice(0, 10).map((log: any, idx: number) => ({
          id: `notif-${idx}`, type: log.level === 'error' ? 'error' : log.level === 'warning' ? 'warning' : 'info',
          title: log.event_type || 'Event', message: log.message || JSON.stringify(log.data || {}),
          timestamp: log.timestamp, read: false,
        }));
        setNotifications(notifs);
      }
    } catch { /* ignore */ }
  }, []);

  const toggleAutopilot = async () => {
    setLoading(true);
    try { const ep = autopilotStatus?.state === 'paused' ? 'resume' : 'pause'; await fetch(`/api/v1/autopilot/${ep}`, { method: 'POST' }); await fetchAutopilotStatus(); } catch { /* ignore */ }
    setLoading(false);
  };

  const activateKillSwitch = async () => {
    if (!confirm('Activate kill switch? This will pause autopilot and cancel open orders.')) return;
    setLoading(true);
    try { await fetch('/api/v1/autopilot/kill_switch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ activate: true, close_all: false }) }); await fetchAutopilotStatus(); } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { const i = setInterval(() => setMarketTime(new Date()), 1000); return () => clearInterval(i); }, []);
  useEffect(() => { fetchAutopilotStatus(); fetchAccountInfo(); fetchNotifications(); }, [fetchAutopilotStatus, fetchAccountInfo, fetchNotifications]);
  useEffect(() => { fetchHealthStatuses(); const i = setInterval(fetchHealthStatuses, 60000); return () => clearInterval(i); }, [fetchHealthStatuses]);

  const formatTime = (d: Date) => d.toLocaleTimeString('en-US', { hour12: false, timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const cycleOk = autopilotStatus?.last_cycle?.success;
  const cycleTime = autopilotStatus?.last_cycle ? new Date(autopilotStatus.last_cycle.timestamp).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }) : '';
  const unreadCount = notifications.filter(n => !n.read).length;
  const apColor = autopilotStatus?.state === 'running' ? GREEN : autopilotStatus?.state === 'paused' ? AMBER : SUBTLE;

  const smallBtn = (col: string): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', fontFamily: MONO, fontSize: 9,
    letterSpacing: 0.5, cursor: 'pointer', background: col + '22', border: `1px solid ${col}`,
    color: col, borderRadius: 2,
  });

  return (
    <header data-testid="top-app-bar" style={{ background: PANEL, borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
      {/* PAPER MODE Banner */}
      <div data-testid="topbar-paper-mode-banner"
        style={{ height: 26, background: AMBER + 'ee', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: MONO, fontSize: 10, fontWeight: 700, color: '#000', letterSpacing: 0.5 }}>
        âš  PAPER MODE â€” ALL TRADES ARE SIMULATED âš 
      </div>

      {/* Main bar */}
      <div style={{ height: 44, display: 'flex', alignItems: 'center', padding: '0 12px', justifyContent: 'space-between', fontFamily: MONO }}>

        {/* Left section */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Logo */}
          <div style={{ width: 28, height: 28, background: AMBER + '22', border: `1px solid ${AMBER}`, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', color: AMBER, fontWeight: 700, fontSize: 12 }}>T</div>

          {/* Mode badge */}
          <span data-testid="mode-badge" style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.5, background: AMBER + '22', border: `1px solid ${AMBER}`, color: AMBER, padding: '2px 6px', borderRadius: 2 }}>
            {accountInfo?.label || 'DEMO'}
          </span>

          {/* Symbol / Timeframe */}
          <span data-testid="symbol-display" style={{ fontSize: 11, color: TEXT, fontWeight: 700 }}>SPY</span>
          <span data-testid="timeframe-display" style={{ fontSize: 10, color: SUBTLE }}>1D</span>

          <div style={{ width: 1, height: 20, background: BORDER }} />

          {/* Broker info */}
          <div data-testid="broker-info" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10 }}>
            <span style={{ color: SUBTLE }}>BROKER:</span>
            <span style={{ color: TEXT, fontWeight: 600 }}>{accountInfo?.broker || 'ALPACA'}</span>
            <span style={{ color: SUBTLE }}>({accountInfo?.label} â€¢â€¢â€¢{accountInfo?.account_id?.slice(-4) || 'XXXX'})</span>
          </div>

          <div style={{ width: 1, height: 20, background: BORDER }} />

          {/* Autopilot toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button onClick={toggleAutopilot} disabled={loading || autopilotStatus?.kill_switch_active || false}
              data-testid="autopilot-toggle"
              style={{ ...smallBtn(apColor), opacity: loading ? 0.6 : 1 }}>
              {loading ? 'âŸ³' : autopilotStatus?.state === 'running' ? 'â–¶' : 'â¸'}
              <span>AUTOPILOT</span>
              <span style={{ fontSize: 8, padding: '0 3px', background: apColor + '33', borderRadius: 1 }}>
                {autopilotStatus?.state === 'running' ? 'ON' : 'OFF'}
              </span>
            </button>

            {/* Kill switch */}
            <button onClick={activateKillSwitch} disabled={loading || autopilotStatus?.kill_switch_active || false}
              data-testid="kill-switch"
              title="Kill Switch â€” Emergency Stop"
              style={{ background: RED + (autopilotStatus?.kill_switch_active ? '44' : '22'), border: `1px solid ${RED}`, color: RED, padding: '4px 7px', cursor: 'pointer', borderRadius: 2, fontSize: 12, fontFamily: MONO }}>
              â»
            </button>
          </div>

          <div style={{ width: 1, height: 20, background: BORDER }} />

          {/* Last cycle status */}
          {autopilotStatus?.last_cycle && (
            <div data-testid="last-cycle-status"
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '2px 7px', background: (cycleOk ? GREEN : RED) + '22', border: `1px solid ${cycleOk ? GREEN : RED}`, borderRadius: 2, fontSize: 9, color: cycleOk ? GREEN : RED }}>
              {cycleOk ? 'âœ“' : 'âœ•'} LAST: {cycleOk ? 'OK' : 'FAIL'} <span style={{ color: SUBTLE }}>{cycleTime}</span>
            </div>
          )}

          {/* Next run */}
          {autopilotStatus?.next_run && (
            <div data-testid="next-run" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, color: SUBTLE }}>
              â° NEXT: {new Date(autopilotStatus.next_run).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>

        {/* Right section */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Voice control */}
          <VoiceControl />

          {/* Health chips */}
          <div data-testid="health-chips" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {Object.entries(healthStatuses).slice(0, 6).map(([key, h]) => (
              <div key={key} title={`${h.provider}: ${h.status}${h.latency_ms ? ` (${h.latency_ms}ms)` : ''}`}
                style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 8, color: SUBTLE }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: statusColor(h.status) }} />
                <span style={{ display: 'none' }}>{h.provider}</span>
              </div>
            ))}
          </div>

          <div style={{ width: 1, height: 16, background: BORDER }} />

          {/* WS Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div data-testid="ws-status-pill" data-ws-status={wsState}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 7px', background: wsColor(wsState) + '22', border: `1px solid ${wsColor(wsState)}`, borderRadius: 2, fontSize: 9, color: wsColor(wsState) }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: wsColor(wsState) }} />
              {wsState}
            </div>
            <button onClick={handleWsReconnect} disabled={wsReconnecting || wsState === 'CONNECTING'}
              data-testid="ws-reconnect-btn" aria-label="Reconnect WebSocket"
              title="Force WebSocket Reconnect"
              style={{ background: 'none', border: `1px solid ${BORDER}`, color: SUBTLE, padding: '3px 5px', cursor: 'pointer', borderRadius: 2, fontSize: 10, fontFamily: MONO, opacity: wsReconnecting ? 0.5 : 1 }}>â†º</button>
          </div>

          <div style={{ width: 1, height: 16, background: BORDER }} />

          {/* Data source selector */}
          <DataSourceSelector value={dataSource} onChange={setDataSource} />

          <div style={{ width: 1, height: 16, background: BORDER }} />

          {/* Search */}
          <div style={{ position: 'relative' }}>
            <button onClick={() => setSearchOpen(!searchOpen)}
              data-testid="global-search-btn"
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 8px', background: BG, border: `1px solid ${BORDER}`, color: SUBTLE, cursor: 'pointer', borderRadius: 2, fontFamily: MONO, fontSize: 9 }}>
              ðŸ” SEARCH <kbd style={{ fontSize: 8, color: SUBTLE, background: PANEL, border: `1px solid ${BORDER}`, padding: '1px 4px', borderRadius: 2 }}>/</kbd>
            </button>
            {searchOpen && (
              <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4, width: 280, background: PANEL, border: `1px solid ${AMBER}`, borderRadius: 2, padding: 8, zIndex: 500, boxShadow: '0 8px 24px rgba(0,0,0,0.6)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: BG, border: `1px solid ${BORDER}`, borderRadius: 2, padding: '4px 8px' }}>
                  <span style={{ color: SUBTLE, fontSize: 11 }}>ðŸ”</span>
                  <input type="text" placeholder="SEARCH SYMBOL, ORDER ID..." value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)} autoFocus
                    style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: TEXT, fontFamily: MONO, fontSize: 10 }} />
                  <button onClick={() => setSearchOpen(false)} style={{ background: 'none', border: 'none', color: SUBTLE, cursor: 'pointer', fontSize: 11 }}>âœ•</button>
                </div>
              </div>
            )}
          </div>

          <div style={{ width: 1, height: 16, background: BORDER }} />

          {/* Market Clock */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: SUBTLE, fontFamily: MONO }}>
            â± <span>{formatTime(marketTime)} ET</span>
          </div>

          <div style={{ width: 1, height: 16, background: BORDER }} />

          {/* Notifications */}
          <div style={{ position: 'relative' }}>
            <button onClick={() => setNotificationsOpen(!notificationsOpen)}
              data-testid="notifications-btn" aria-label="Notifications"
              style={{ position: 'relative', background: 'none', border: 'none', color: SUBTLE, cursor: 'pointer', fontSize: 16, padding: '3px 5px', fontFamily: MONO }}>
              ðŸ””
              {unreadCount > 0 && (
                <span style={{ position: 'absolute', top: 0, right: 0, width: 14, height: 14, background: RED, borderRadius: '50%', fontSize: 8, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {notificationsOpen && (
              <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4, width: 300, background: PANEL, border: `1px solid ${AMBER}`, borderRadius: 2, zIndex: 500, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.6)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', borderBottom: `1px solid ${BORDER}`, background: BG }}>
                  <span style={{ fontSize: 10, color: AMBER, fontWeight: 700, letterSpacing: 0.5 }}>NOTIFICATIONS</span>
                  <span style={{ fontSize: 9, color: SUBTLE }}>{unreadCount} UNREAD</span>
                </div>
                <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                  {notifications.length === 0 ? (
                    <div style={{ padding: 16, textAlign: 'center', color: SUBTLE, fontSize: 10 }}>NO NOTIFICATIONS</div>
                  ) : notifications.map(notif => (
                    <div key={notif.id}
                      style={{ padding: '7px 10px', borderBottom: `1px solid ${BORDER}`, background: notif.read ? 'transparent' : BLUE + '08', cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                        <span style={{ fontSize: 11, color: notif.type === 'error' ? RED : notif.type === 'warning' ? AMBER : notif.type === 'success' ? GREEN : BLUE }}>
                          {notif.type === 'error' ? 'âœ•' : notif.type === 'warning' ? 'âš ' : notif.type === 'success' ? 'âœ“' : 'â„¹'}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 10, color: TEXT, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{notif.title}</div>
                          <div style={{ fontSize: 9, color: SUBTLE, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{notif.message}</div>
                        </div>
                        <span style={{ fontSize: 8, color: SUBTLE, flexShrink: 0 }}>
                          {new Date(notif.timestamp).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
