const BG='#0a0a0a'; const PANEL='#111111'; const BORDER='#1e1e1e';
const AMBER='#f5a623'; const GREEN='#26a69a'; const RED='#ef5350';
const BLUE='#42a5f5'; const PURPLE='#ab47bc'; const SUBTLE='#555';
const TEXT='#d1d4dc'; const MONO='"Roboto Mono","Courier New",monospace';

import React, { useEffect, useState } from 'react';
import { API_BASE } from '../../../config/api';

interface AgentStatus { symbol: string; running: boolean; interval: number; last_check: string; status: string; }
interface AgentsResponse { agents: AgentStatus[]; count: number; monitoring_active: boolean; }

export const AutopilotAgents: React.FC = () => {
  const [data, setData] = useState<AgentsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAgents = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/autopilot/agents`);
      if (res.ok) setData(await res.json());
    } catch (e) { console.error('Failed to fetch agents', e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAgents(); const iv = setInterval(fetchAgents, 3000); return () => clearInterval(iv); }, []);

  if (loading && !data) return <div style={{ fontSize: 11, color: SUBTLE, padding: 12, fontFamily: MONO }}>Loading agents...</div>;

  if (!data || data.agents.length === 0) {
    if (!data?.monitoring_active) return null;
    return (
      <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 2, padding: '10px 12px', marginBottom: 8, fontFamily: MONO }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: TEXT }}> ACTIVE GUARDIANS</span>
          <span style={{ fontSize: 10, color: GREEN, padding: '2px 6px', background: GREEN + '22', borderRadius: 2 }}>DISPATCHER ACTIVE</span>
        </div>
        <div style={{ fontSize: 11, color: SUBTLE, textAlign: 'center', padding: '4px 0' }}>No active positions to monitor.</div>
      </div>
    );
  }

  return (
    <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 2, padding: '10px 12px', marginBottom: 8, fontFamily: MONO }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: TEXT }}> ACTIVE GUARDIANS</span>
          <span style={{ fontSize: 10, color: BLUE, padding: '2px 6px', background: BLUE + '22', borderRadius: 2 }}>{data.count} ACTIVE</span>
        </div>
        {data.monitoring_active && <span style={{ fontSize: 10, color: GREEN, fontFamily: MONO }}> DISPATCHER</span>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {data.agents.map(agent => (
          <div key={agent.symbol} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: BG, padding: '6px 10px', borderRadius: 2, border: `1px solid ${BORDER}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: agent.running ? GREEN : RED }} />
              <span style={{ fontSize: 11, fontWeight: 700, fontFamily: MONO }}>{agent.symbol}</span>
            </div>
            <div style={{ display: 'flex', gap: 14, fontSize: 10, color: SUBTLE }}>
              <span>INTERVAL: {agent.interval}s</span>
              <span style={{ color: agent.status === 'watching' ? GREEN : SUBTLE }}>{agent.status.toUpperCase()}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};