const BG='#0a0a0a'; const PANEL='#111111'; const BORDER='#1e1e1e';
const AMBER='#f5a623'; const GREEN='#26a69a'; const RED='#ef5350';
const BLUE='#42a5f5'; const PURPLE='#ab47bc'; const SUBTLE='#555';
const TEXT='#d1d4dc'; const MONO='"Roboto Mono","Courier New",monospace';

import React, { useEffect, useState } from 'react';
import { useAutopilotStore } from '../store';
import type { ActivityLogEntry } from '../types';

const fmtTime = (ts: string) => new Date(ts).toLocaleTimeString();
const fmtDate = (ts: string) => new Date(ts).toLocaleDateString();

type EventFilter = 'all' | 'trades' | 'validation' | 'errors';

const EVT_COLOR: Record<string, string> = {
  cycle_start: BLUE, cycle_complete: BLUE, candidate_generated: PURPLE, candidate_selected: PURPLE,
  validation_passed: GREEN, validation_failed: RED, order_submitted: AMBER, order_filled: GREEN,
  order_rejected: RED, position_opened: GREEN, position_closed: SUBTLE, exit_signal: '#ff9800',
  kill_switch: RED, error: RED,
};

const LEVEL_ICON: Record<string, string> = { info: 'ℹ', warning: '', error: '', success: '', debug: '' };

function LogEntry({ entry }: { entry: ActivityLogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const icon = LEVEL_ICON[entry.level] || 'ℹ';
  const evtColor = EVT_COLOR[entry.event_type] || SUBTLE;
  const hasMeta = entry.metadata && Object.keys(entry.metadata).length > 0;
  return (
    <div data-testid={`log-entry-${entry.id}`} style={{ borderBottom: `1px solid ${BORDER}` }}>
      <div onClick={() => hasMeta && setExpanded(!expanded)} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 14px', cursor: hasMeta ? 'pointer' : 'default' }}>
        <span style={{ color: evtColor, fontSize: 12, marginTop: 1 }}>{icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 10 }}>
            <span style={{ color: SUBTLE, fontFamily: MONO }}>{fmtTime(entry.timestamp)}</span>
            <span style={{ color: evtColor, fontWeight: 700 }}>{entry.event_type.replace(/_/g, ' ').toUpperCase()}</span>
            {entry.symbol && <span style={{ color: AMBER, fontFamily: MONO, fontSize: 10, padding: '1px 5px', background: AMBER + '22', borderRadius: 2 }}>{entry.symbol}</span>}
          </div>
          <div style={{ fontSize: 11, color: TEXT, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.message}</div>
        </div>
        {hasMeta && <span style={{ color: SUBTLE, fontSize: 10 }}>{expanded ? '' : ''}</span>}
      </div>
      {expanded && entry.metadata && (
        <div style={{ padding: '0 14px 10px 38px' }}>
          <pre style={{ fontSize: 10, color: SUBTLE, background: PANEL, padding: 8, borderRadius: 2, overflowX: 'auto', fontFamily: MONO }}>{JSON.stringify(entry.metadata, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

const getEventTypes = (f: EventFilter) => ({ all: undefined, trades: 'order_filled,position_opened,position_closed', validation: 'validation_passed,validation_failed', errors: 'error,kill_switch' }[f]);

export const AutopilotActivity: React.FC = () => {
  const { logs = [], isLoading, fetchLogs } = useAutopilotStore();
  const [filter, setFilter] = useState<EventFilter>('all');
  const [limit, setLimit] = useState(50);
  const safeLogs = logs ?? [];

  useEffect(() => { fetchLogs({ limit, event_type: getEventTypes(filter) }); }, [filter, limit, fetchLogs]);

  const handleRefresh = () => fetchLogs({ limit, event_type: getEventTypes(filter) });

  const grouped = safeLogs.reduce<Record<string, ActivityLogEntry[]>>((acc, log) => {
    const d = fmtDate(log.timestamp); if (!acc[d]) acc[d] = []; acc[d].push(log); return acc;
  }, {});

  const tabStyle = (active: boolean): React.CSSProperties => ({ fontSize: 10, padding: '4px 10px', background: active ? BLUE : PANEL, color: active ? '#000' : TEXT, border: `1px solid ${active ? BLUE : BORDER}`, borderRadius: 2, cursor: 'pointer', fontFamily: MONO, fontWeight: active ? 700 : 400 });

  return (
    <div data-testid="autopilot-activity" style={{ display: 'flex', flexDirection: 'column', height: '100%', background: BG, color: TEXT, fontFamily: MONO }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
        <span data-testid="activity-log-heading" style={{ fontSize: 13, fontWeight: 700 }}> ACTIVITY LOG</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['all', 'trades', 'validation', 'errors'] as EventFilter[]).map(f => (
              <button key={f} data-testid={`filter-${f}`} onClick={() => setFilter(f)} style={tabStyle(filter === f)}>{f.toUpperCase()}</button>
            ))}
          </div>
          <select value={limit} onChange={e => setLimit(Number(e.target.value))} data-testid="limit-select" style={{ background: PANEL, color: TEXT, border: `1px solid ${BORDER}`, borderRadius: 2, padding: '3px 6px', fontSize: 10, fontFamily: MONO }}>
            {[25, 50, 100, 200].map(n => <option key={n} value={n}>{n} entries</option>)}
          </select>
          <button data-testid="refresh-logs" onClick={handleRefresh} disabled={isLoading} style={{ ...tabStyle(false), padding: '4px 8px' }}>{isLoading ? '' : ''}</button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 20, padding: '6px 14px', background: PANEL, fontSize: 10, borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
        <span style={{ color: SUBTLE }}>TOTAL: <span style={{ color: TEXT, fontWeight: 700 }}>{safeLogs.length}</span></span>
        <span style={{ color: SUBTLE }}>ERRORS: <span style={{ color: RED, fontWeight: 700 }}>{safeLogs.filter(l => l.level === 'error').length}</span></span>
        <span style={{ color: SUBTLE }}>WARNINGS: <span style={{ color: AMBER, fontWeight: 700 }}>{safeLogs.filter(l => l.level === 'warning').length}</span></span>
      </div>

      {/* Log Stream */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {safeLogs.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: SUBTLE, fontSize: 11 }}>{isLoading ? ' Loading activity...' : 'No activity found'}</div>
        ) : (
          Object.entries(grouped).map(([date, entries]) => (
            <div key={date}>
              <div style={{ position: 'sticky', top: 0, background: PANEL, padding: '5px 14px', fontSize: 10, color: SUBTLE, fontWeight: 700, borderBottom: `1px solid ${BORDER}` }}>{date}</div>
              {entries.map(entry => <LogEntry key={entry.id} entry={entry} />)}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AutopilotActivity;