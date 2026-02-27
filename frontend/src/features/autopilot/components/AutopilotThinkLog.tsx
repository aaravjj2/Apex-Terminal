const BG='#0a0a0a'; const PANEL='#111111'; const BORDER='#1e1e1e';
const AMBER='#f5a623'; const GREEN='#26a69a'; const RED='#ef5350';
const BLUE='#42a5f5'; const PURPLE='#ab47bc'; const SUBTLE='#555';
const TEXT='#d1d4dc'; const MONO='"Roboto Mono","Courier New",monospace';

import React, { useEffect, useState, useCallback } from 'react';
import { API_BASE } from '../../../config/api';
import { useAutopilotStore } from '../store';

interface ThinkLogEntry {
  timestamp: string;
  emoji?: string;
  phase: string;
  thought: string;
  details?: Record<string, unknown>;
}

interface ThinkLogResponse {
  run_id: string | null;
  timestamp?: string;
  success?: boolean;
  duration_ms?: number;
  think_log: ThinkLogEntry[];
  count: number;
  summary?: { orders_filled: number; exits_triggered: number; candidates_generated: number };
  message?: string;
}

const PHASE_COLOR: Record<string, string> = {
  START: BLUE, OBSERVE: '#26c6da', MONITOR: PURPLE, EVALUATE: AMBER, DECIDE: GREEN,
  SELECT: '#66bb6a', REJECT: RED, SKIP: SUBTLE, EXECUTE: '#ff9800', ALERT: RED, SAVE: SUBTLE, COMPLETE: GREEN,
};

export const AutopilotThinkLog: React.FC = () => {
  const [thinkLog, setThinkLog] = useState<ThinkLogEntry[]>([]);
  const [runId, setRunId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchThinkLog = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/v1/autopilot/think-log`);
      if (res.ok) {
        const data: ThinkLogResponse = await res.json();
        setThinkLog(data.think_log || []); setRunId(data.run_id); setLastUpdated(new Date());
      }
    } catch (e) { console.error('Failed to fetch think log:', e); }
    finally { setLoading(false); }
  }, []);

  const { thinkLog: storeThinkLog, connectionStatus } = useAutopilotStore();

  useEffect(() => {
    if (connectionStatus === 'CONNECTED') {
      setThinkLog(storeThinkLog);
      if (storeThinkLog.length > 0) setLastUpdated(new Date());
    } else if (autoRefresh) {
      fetchThinkLog();
      const iv = setInterval(fetchThinkLog, 5000);
      return () => clearInterval(iv);
    }
  }, [connectionStatus, storeThinkLog, fetchThinkLog, autoRefresh]);

  return (
    <div data-testid="think-log" style={{ display: 'flex', flexDirection: 'column', height: '100%', background: PANEL, border: `1px solid ${BORDER}`, overflow: 'hidden', fontFamily: MONO }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 12px', borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: PURPLE }}> THINK ENGINE</span>
          {runId && <span style={{ fontSize: 10, color: SUBTLE }}>{runId.slice(0, 8)}</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 10, color: SUBTLE, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
            <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} style={{ accentColor: BLUE }} />
            AUTO
          </label>
          <button onClick={fetchThinkLog} disabled={loading} style={{ fontSize: 10, padding: '3px 8px', background: BLUE, color: '#000', border: 'none', borderRadius: 2, cursor: 'pointer', fontFamily: MONO }}>{loading ? '' : ''}</button>
        </div>
      </div>

      {/* Log Entries */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0', fontFamily: MONO, fontSize: 10 }}>
        {thinkLog.length === 0 ? (
          <div style={{ color: SUBTLE, textAlign: 'center', padding: '24px 12px', fontSize: 11 }}>No think log entries. Run a cycle to see AI reasoning.</div>
        ) : (
          thinkLog.map((entry, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '3px 12px' }}>
              <span style={{ color: SUBTLE, width: 56, flexShrink: 0 }}>{entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString([], { hour12: false }) : ''}</span>
              <span style={{ fontSize: 11 }}>{entry.emoji}</span>
              <span style={{ color: PHASE_COLOR[entry.phase] || TEXT, fontWeight: 700 }}>[{entry.phase}]</span>
              <span style={{ color: TEXT, flex: 1 }}>{entry.thought}</span>
            </div>
          ))
        )}
      </div>

      {lastUpdated && (
        <div style={{ padding: '4px 12px', borderTop: `1px solid ${BORDER}`, fontSize: 10, color: SUBTLE, flexShrink: 0 }}>
          Updated: {lastUpdated.toLocaleTimeString()}{thinkLog.length > 0 ? `  ${thinkLog.length} entries` : ''}
        </div>
      )}
    </div>
  );
};

export default AutopilotThinkLog;