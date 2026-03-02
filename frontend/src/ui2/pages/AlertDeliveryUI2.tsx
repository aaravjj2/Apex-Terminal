import React, { useState } from 'react';

const BG = '#0a0a0a', PANEL = '#111111', BORDER = '#1e1e1e';
const AMBER = '#f5a623', GREEN = '#26a69a', RED = '#ef5350', CYAN = '#00bcd4';
const DIM = '#555', TEXT = '#ccc', WHITE = '#e0e0e0';

interface AlertRule {
  id: string; name: string; type: 'Price' | 'Volume' | 'Technical' | 'News' | 'Portfolio' | 'Risk' | 'Custom';
  condition: string; symbol: string; channels: string[]; priority: 'Critical' | 'High' | 'Medium' | 'Low';
  status: 'Active' | 'Paused' | 'Expired'; triggered: number; lastTriggered: number | null;
  cooldown: number; expiry: number | null; created: number;
}

interface DeliveryChannel {
  id: string; name: string; type: 'Email' | 'SMS' | 'Webhook' | 'Push' | 'Slack' | 'Telegram' | 'Discord' | 'PagerDuty';
  config: Record<string, string>; status: 'Connected' | 'Disconnected' | 'Error';
  lastTest: number | null; deliveries: number; failures: number;
}

interface AlertHistory {
  id: string; ruleId: string; ruleName: string; symbol: string; message: string;
  priority: string; channels: string[]; timestamp: number; delivered: boolean;
}

function genRules(): AlertRule[] {
  const rules: { name: string; type: AlertRule['type']; condition: string; symbol: string; priority: AlertRule['priority'] }[] = [
    { name: 'AAPL Price Cross 200', type: 'Price', condition: 'Price > $200.00', symbol: 'AAPL', priority: 'High' },
    { name: 'SPY Volume Surge', type: 'Volume', condition: 'Volume > 3x Avg', symbol: 'SPY', priority: 'Medium' },
    { name: 'NVDA RSI Overbought', type: 'Technical', condition: 'RSI(14) > 70', symbol: 'NVDA', priority: 'Medium' },
    { name: 'TSLA Earnings Alert', type: 'News', condition: 'Earnings Release', symbol: 'TSLA', priority: 'High' },
    { name: 'Portfolio Drawdown', type: 'Portfolio', condition: 'Drawdown > 5%', symbol: 'PORTFOLIO', priority: 'Critical' },
    { name: 'VaR Breach', type: 'Risk', condition: 'VaR > $50K', symbol: 'PORTFOLIO', priority: 'Critical' },
    { name: 'MACD Crossover', type: 'Technical', condition: 'MACD Cross Signal', symbol: 'QQQ', priority: 'Low' },
    { name: 'BTC ATH Alert', type: 'Price', condition: 'Price > ATH', symbol: 'BTC-USD', priority: 'High' },
    { name: 'Gold Breakout', type: 'Price', condition: 'Price > $2100', symbol: 'GC1', priority: 'Medium' },
    { name: 'Margin Warning', type: 'Risk', condition: 'Margin Usage > 80%', symbol: 'ACCOUNT', priority: 'Critical' },
    { name: 'Custom Scan Hit', type: 'Custom', condition: 'Scanner Match', symbol: 'SCAN-001', priority: 'Low' },
    { name: 'Strategy Signal', type: 'Custom', condition: 'Enter Long Signal', symbol: 'MULTI', priority: 'High' },
    { name: 'EUR/USD Support', type: 'Price', condition: 'Price < 1.0800', symbol: 'EURUSD', priority: 'Medium' },
    { name: 'Sector Rotation', type: 'Portfolio', condition: 'Sector delta > 3%', symbol: 'SECTOR', priority: 'Low' },
    { name: 'Correlation Break', type: 'Risk', condition: 'Corr < -0.3', symbol: 'PAIRS', priority: 'Medium' },
  ];
  return rules.map((r, i) => ({
    id: `RULE-${String(i + 1).padStart(3, '0')}`,
    ...r,
    channels: ['Email', i % 2 === 0 ? 'Webhook' : 'Push', ...(r.priority === 'Critical' ? ['SMS', 'PagerDuty'] : [])],
    status: i < 12 ? 'Active' : i === 12 ? 'Paused' : 'Expired',
    triggered: Math.floor(Math.random() * 50),
    lastTriggered: i < 10 ? Date.now() - Math.floor(Math.random() * 86400000 * 7) : null,
    cooldown: [60, 300, 900, 3600][Math.floor(Math.random() * 4)],
    expiry: i > 10 ? Date.now() + Math.floor(Math.random() * 86400000 * 30) : null,
    created: Date.now() - Math.floor(Math.random() * 86400000 * 90),
  }));
}

function genChannels(): DeliveryChannel[] {
  return [
    { id: 'CH-001', name: 'Primary Email', type: 'Email', config: { to: 'trader@apex.com' }, status: 'Connected', lastTest: Date.now() - 3600000, deliveries: 1247, failures: 3 },
    { id: 'CH-002', name: 'SMS Alert', type: 'SMS', config: { phone: '+1-555-0123' }, status: 'Connected', lastTest: Date.now() - 7200000, deliveries: 89, failures: 1 },
    { id: 'CH-003', name: 'Trade Webhook', type: 'Webhook', config: { url: 'https://api.apex.com/webhook/alerts' }, status: 'Connected', lastTest: Date.now() - 1800000, deliveries: 3456, failures: 12 },
    { id: 'CH-004', name: 'Mobile Push', type: 'Push', config: { device: 'iPhone 15 Pro' }, status: 'Connected', lastTest: Date.now() - 900000, deliveries: 892, failures: 0 },
    { id: 'CH-005', name: 'Trading Slack', type: 'Slack', config: { channel: '#trading-alerts' }, status: 'Connected', lastTest: Date.now() - 5400000, deliveries: 2134, failures: 7 },
    { id: 'CH-006', name: 'Telegram Bot', type: 'Telegram', config: { chatId: '-1001234567890' }, status: 'Connected', lastTest: Date.now() - 10800000, deliveries: 567, failures: 2 },
    { id: 'CH-007', name: 'Discord Bot', type: 'Discord', config: { webhook: 'https://discord.com/api/...' }, status: 'Disconnected', lastTest: null, deliveries: 0, failures: 0 },
    { id: 'CH-008', name: 'PagerDuty', type: 'PagerDuty', config: { service: 'trading-critical' }, status: 'Connected', lastTest: Date.now() - 86400000, deliveries: 23, failures: 0 },
  ];
}

function genHistory(): AlertHistory[] {
  return Array.from({ length: 30 }, (_, i) => ({
    id: `ALT-${String(i + 1).padStart(5, '0')}`,
    ruleId: `RULE-${String(Math.floor(Math.random() * 15) + 1).padStart(3, '0')}`,
    ruleName: ['AAPL Price Cross', 'SPY Volume Surge', 'Portfolio Drawdown', 'VaR Breach', 'MACD Crossover', 'BTC ATH', 'Margin Warning'][Math.floor(Math.random() * 7)],
    symbol: ['AAPL', 'SPY', 'PORTFOLIO', 'QQQ', 'BTC-USD', 'NVDA', 'ACCOUNT'][Math.floor(Math.random() * 7)],
    message: ['Price target hit', 'Volume anomaly detected', 'Drawdown threshold breached', 'Risk limit exceeded', 'Technical signal generated', 'ATH breakthrough'][Math.floor(Math.random() * 6)],
    priority: (['Critical', 'High', 'Medium', 'Low'] as const)[Math.floor(Math.random() * 4)],
    channels: ['Email', 'Push'],
    timestamp: Date.now() - Math.floor(Math.random() * 86400000 * 7),
    delivered: Math.random() > 0.05,
  }));
}

const TABS = ['Alert Rules', 'Channels', 'History', 'Templates', 'Settings'];

const PRIORITY_COLORS: Record<string, string> = { Critical: RED, High: AMBER, Medium: CYAN, Low: DIM };
const STATUS_COLORS: Record<string, string> = { Active: GREEN, Paused: AMBER, Expired: DIM, Connected: GREEN, Disconnected: RED, Error: RED };

export default function AlertDeliveryUI2() {
  const [tab, setTab] = useState(0);
  const [rules] = useState(genRules);
  const [channels] = useState(genChannels);
  const [history] = useState(genHistory);
  const [filterPriority, setFilterPriority] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');

  const filteredRules = rules.filter(r => {
    if (filterPriority !== 'All' && r.priority !== filterPriority) return false;
    if (filterStatus !== 'All' && r.status !== filterStatus) return false;
    return true;
  });

  const activeCount = rules.filter(r => r.status === 'Active').length;
  const criticalCount = rules.filter(r => r.priority === 'Critical').length;
  const connectedChannels = channels.filter(c => c.status === 'Connected').length;
  const todayAlerts = history.filter(h => Date.now() - h.timestamp < 86400000).length;

  return (
    <div style={{ width: '100%', height: '100%', background: BG, color: TEXT, fontFamily: 'monospace', fontSize: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '8px 16px', borderBottom: `1px solid ${BORDER}`, gap: 12 }}>
        <span style={{ color: AMBER, fontWeight: 'bold', fontSize: 14 }}>🔔 ALERT DELIVERY SYSTEM</span>
        <span style={{ color: DIM }}>|</span>
        <span style={{ color: GREEN }}>{activeCount} active</span>
        <span style={{ color: RED }}>{criticalCount} critical</span>
        <span style={{ color: CYAN }}>{connectedChannels}/{channels.length} channels</span>
        <span style={{ color: DIM }}>{todayAlerts} today</span>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${BORDER}`, background: '#0d0d0d' }}>
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(i)} style={{
            padding: '8px 16px', background: tab === i ? PANEL : 'transparent', color: tab === i ? AMBER : DIM,
            border: 'none', borderBottom: tab === i ? `2px solid ${AMBER}` : '2px solid transparent',
            cursor: 'pointer', fontFamily: 'monospace', fontSize: 11
          }}>{t}</button>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        {/* Alert Rules */}
        {tab === 0 && (
          <div>
            <div style={{ padding: '8px 16px', borderBottom: `1px solid ${BORDER}`, display: 'flex', gap: 8 }}>
              {['All', 'Critical', 'High', 'Medium', 'Low'].map(p => (
                <button key={p} onClick={() => setFilterPriority(p)} style={{
                  padding: '3px 8px', background: filterPriority === p ? 'rgba(245,166,35,0.15)' : '#1a1a1a',
                  border: `1px solid ${filterPriority === p ? AMBER : BORDER}`, color: filterPriority === p ? AMBER : DIM,
                  cursor: 'pointer', fontFamily: 'monospace', fontSize: 10
                }}>{p}</button>
              ))}
              <span style={{ color: DIM }}>|</span>
              {['All', 'Active', 'Paused', 'Expired'].map(s => (
                <button key={s} onClick={() => setFilterStatus(s)} style={{
                  padding: '3px 8px', background: filterStatus === s ? 'rgba(245,166,35,0.15)' : '#1a1a1a',
                  border: `1px solid ${filterStatus === s ? AMBER : BORDER}`, color: filterStatus === s ? AMBER : DIM,
                  cursor: 'pointer', fontFamily: 'monospace', fontSize: 10
                }}>{s}</button>
              ))}
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ position: 'sticky', top: 0, background: '#0d0d0d', zIndex: 1 }}>
                  {['', 'Name', 'Type', 'Symbol', 'Condition', 'Priority', 'Channels', 'Triggered', 'Last', 'Status'].map(h => (
                    <th key={h} style={{ padding: '5px 8px', textAlign: 'left', color: AMBER, fontSize: 10, borderBottom: `1px solid ${BORDER}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRules.map(r => (
                  <tr key={r.id} style={{ borderBottom: `1px solid ${BORDER}` }}>
                    <td style={{ padding: '5px 8px', width: 20 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: PRIORITY_COLORS[r.priority] || DIM }} />
                    </td>
                    <td style={{ padding: '5px 8px', color: WHITE, fontWeight: 'bold' }}>{r.name}</td>
                    <td style={{ padding: '5px 8px' }}>
                      <span style={{ padding: '1px 4px', background: 'rgba(0,188,212,0.1)', border: `1px solid rgba(0,188,212,0.3)`, color: CYAN, fontSize: 9 }}>{r.type}</span>
                    </td>
                    <td style={{ padding: '5px 8px', color: AMBER }}>{r.symbol}</td>
                    <td style={{ padding: '5px 8px', color: TEXT, fontSize: 11 }}>{r.condition}</td>
                    <td style={{ padding: '5px 8px', color: PRIORITY_COLORS[r.priority] }}>{r.priority}</td>
                    <td style={{ padding: '5px 8px' }}>
                      <div style={{ display: 'flex', gap: 2 }}>
                        {r.channels.map(ch => (
                          <span key={ch} style={{ padding: '1px 3px', background: '#1a1a1a', border: `1px solid ${BORDER}`, color: DIM, fontSize: 8 }}>{ch}</span>
                        ))}
                      </div>
                    </td>
                    <td style={{ padding: '5px 8px', textAlign: 'center', color: TEXT }}>{r.triggered}</td>
                    <td style={{ padding: '5px 8px', color: DIM, fontSize: 10 }}>
                      {r.lastTriggered ? new Date(r.lastTriggered).toLocaleDateString() : '—'}
                    </td>
                    <td style={{ padding: '5px 8px' }}>
                      <span style={{ padding: '2px 6px', background: `rgba(${r.status === 'Active' ? '38,166,154' : r.status === 'Paused' ? '245,166,35' : '85,85,85'},0.1)`, color: STATUS_COLORS[r.status], fontSize: 10, fontWeight: 'bold' }}>
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Channels */}
        {tab === 1 && (
          <div style={{ padding: 16 }}>
            <div style={{ color: AMBER, fontWeight: 'bold', marginBottom: 16 }}>DELIVERY CHANNELS</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 12 }}>
              {channels.map(ch => (
                <div key={ch.id} style={{ background: PANEL, border: `1px solid ${ch.status === 'Connected' ? BORDER : RED}`, padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div>
                      <span style={{ color: WHITE, fontWeight: 'bold', fontSize: 13 }}>{ch.name}</span>
                      <span style={{ marginLeft: 8, padding: '1px 4px', background: 'rgba(0,188,212,0.1)', color: CYAN, fontSize: 9, border: `1px solid rgba(0,188,212,0.3)` }}>{ch.type}</span>
                    </div>
                    <span style={{ padding: '2px 8px', fontSize: 9, fontWeight: 'bold', background: `rgba(${ch.status === 'Connected' ? '38,166,154' : '239,83,80'},0.1)`, color: STATUS_COLORS[ch.status] }}>
                      {ch.status}
                    </span>
                  </div>
                  <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 8 }}>
                    {Object.entries(ch.config).map(([k, v]) => (
                      <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                        <span style={{ color: DIM }}>{k}</span>
                        <span style={{ color: TEXT, fontSize: 10, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{v}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTop: `1px solid ${BORDER}` }}>
                    <div>
                      <span style={{ color: DIM, fontSize: 10 }}>Sent: </span>
                      <span style={{ color: GREEN }}>{ch.deliveries.toLocaleString()}</span>
                    </div>
                    <div>
                      <span style={{ color: DIM, fontSize: 10 }}>Failed: </span>
                      <span style={{ color: ch.failures > 0 ? RED : GREEN }}>{ch.failures}</span>
                    </div>
                    <div>
                      <span style={{ color: DIM, fontSize: 10 }}>Success: </span>
                      <span style={{ color: GREEN }}>{ch.deliveries > 0 ? ((1 - ch.failures / ch.deliveries) * 100).toFixed(1) : 0}%</span>
                    </div>
                  </div>
                  <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                    <button style={{ padding: '4px 12px', background: '#1a1a1a', border: `1px solid ${BORDER}`, color: TEXT, cursor: 'pointer', fontFamily: 'monospace', fontSize: 10 }}>Test</button>
                    <button style={{ padding: '4px 12px', background: '#1a1a1a', border: `1px solid ${BORDER}`, color: TEXT, cursor: 'pointer', fontFamily: 'monospace', fontSize: 10 }}>Configure</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* History */}
        {tab === 2 && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ position: 'sticky', top: 0, background: '#0d0d0d', zIndex: 1 }}>
                {['Time', 'Rule', 'Symbol', 'Message', 'Priority', 'Channels', 'Status'].map(h => (
                  <th key={h} style={{ padding: '5px 8px', textAlign: 'left', color: AMBER, fontSize: 10, borderBottom: `1px solid ${BORDER}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {history.sort((a, b) => b.timestamp - a.timestamp).map(h => (
                <tr key={h.id} style={{ borderBottom: `1px solid ${BORDER}` }}>
                  <td style={{ padding: '4px 8px', color: DIM, fontSize: 10, whiteSpace: 'nowrap' }}>{new Date(h.timestamp).toLocaleString()}</td>
                  <td style={{ padding: '4px 8px', color: WHITE }}>{h.ruleName}</td>
                  <td style={{ padding: '4px 8px', color: AMBER }}>{h.symbol}</td>
                  <td style={{ padding: '4px 8px', color: TEXT, fontSize: 11 }}>{h.message}</td>
                  <td style={{ padding: '4px 8px', color: PRIORITY_COLORS[h.priority] }}>{h.priority}</td>
                  <td style={{ padding: '4px 8px' }}>
                    <div style={{ display: 'flex', gap: 2 }}>
                      {h.channels.map(ch => <span key={ch} style={{ padding: '1px 3px', background: '#1a1a1a', color: DIM, fontSize: 8 }}>{ch}</span>)}
                    </div>
                  </td>
                  <td style={{ padding: '4px 8px' }}>
                    <span style={{ color: h.delivered ? GREEN : RED, fontSize: 10 }}>{h.delivered ? '✓ Delivered' : '✗ Failed'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Templates */}
        {tab === 3 && (
          <div style={{ padding: 16 }}>
            <div style={{ color: AMBER, fontWeight: 'bold', marginBottom: 16 }}>ALERT TEMPLATES</div>
            {[
              { name: 'Price Breakout', desc: 'Alert when price breaks above/below key level', type: 'Price', vars: ['symbol', 'level', 'direction'] },
              { name: 'Volume Spike', desc: 'Notify on unusual volume activity', type: 'Volume', vars: ['symbol', 'multiplier', 'lookback'] },
              { name: 'RSI Extreme', desc: 'RSI overbought/oversold alert', type: 'Technical', vars: ['symbol', 'period', 'threshold'] },
              { name: 'Drawdown Warning', desc: 'Portfolio drawdown threshold alert', type: 'Portfolio', vars: ['threshold', 'timeframe'] },
              { name: 'Correlation Shift', desc: 'Alert on correlation regime change', type: 'Risk', vars: ['pair', 'threshold', 'window'] },
              { name: 'Earnings Alert', desc: 'Pre-earnings notification', type: 'News', vars: ['symbol', 'daysBefore'] },
            ].map(t => (
              <div key={t.name} style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: 12, marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ color: WHITE, fontWeight: 'bold' }}>{t.name}</div>
                  <div style={{ color: DIM, fontSize: 10, marginTop: 2 }}>{t.desc}</div>
                  <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                    <span style={{ padding: '1px 4px', background: 'rgba(0,188,212,0.1)', color: CYAN, fontSize: 8 }}>{t.type}</span>
                    {t.vars.map(v => <span key={v} style={{ padding: '1px 4px', background: '#1a1a1a', color: DIM, fontSize: 8 }}>{`{${v}}`}</span>)}
                  </div>
                </div>
                <button style={{ padding: '6px 16px', background: 'rgba(245,166,35,0.1)', border: `1px solid ${AMBER}`, color: AMBER, cursor: 'pointer', fontFamily: 'monospace', fontSize: 10 }}>Use Template</button>
              </div>
            ))}
          </div>
        )}

        {/* Settings */}
        {tab === 4 && (
          <div style={{ padding: 16, maxWidth: 600 }}>
            <div style={{ color: AMBER, fontWeight: 'bold', marginBottom: 16 }}>GLOBAL SETTINGS</div>
            {[
              { label: 'Max Alerts per Hour', value: '100', type: 'number' },
              { label: 'Default Cooldown (sec)', value: '300', type: 'number' },
              { label: 'Alert Retention (days)', value: '90', type: 'number' },
              { label: 'Quiet Hours Start', value: '22:00', type: 'time' },
              { label: 'Quiet Hours End', value: '06:00', type: 'time' },
              { label: 'Critical Override Quiet', value: 'true', type: 'checkbox' },
              { label: 'Batch Digest Interval', value: '3600', type: 'number' },
              { label: 'Escalation Timeout (min)', value: '15', type: 'number' },
            ].map(s => (
              <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${BORDER}` }}>
                <span style={{ color: TEXT }}>{s.label}</span>
                {s.type === 'checkbox' ? (
                  <div style={{ width: 40, height: 20, background: GREEN, borderRadius: 10, position: 'relative', cursor: 'pointer' }}>
                    <div style={{ width: 16, height: 16, background: WHITE, borderRadius: '50%', position: 'absolute', top: 2, right: 2 }} />
                  </div>
                ) : (
                  <input defaultValue={s.value} type={s.type} style={{ width: 120, padding: '4px 8px', background: '#1a1a1a', border: `1px solid ${BORDER}`, color: WHITE, fontFamily: 'monospace', fontSize: 11, textAlign: 'right' }} />
                )}
              </div>
            ))}

            <div style={{ color: AMBER, fontWeight: 'bold', marginTop: 24, marginBottom: 12 }}>ESCALATION CHAIN</div>
            {[
              { level: 1, action: 'Email + Push', delay: '0 min', target: 'Trader' },
              { level: 2, action: 'SMS + Slack', delay: '5 min', target: 'Team Lead' },
              { level: 3, action: 'PagerDuty + Phone', delay: '15 min', target: 'Risk Manager' },
              { level: 4, action: 'Emergency Broadcast', delay: '30 min', target: 'All Hands' },
            ].map(e => (
              <div key={e.level} style={{ display: 'flex', alignItems: 'center', padding: '6px 0', borderBottom: `1px solid ${BORDER}`, gap: 12 }}>
                <span style={{ width: 20, height: 20, borderRadius: '50%', background: 'rgba(245,166,35,0.15)', color: AMBER, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 'bold' }}>
                  {e.level}
                </span>
                <span style={{ color: WHITE, width: 150 }}>{e.action}</span>
                <span style={{ color: DIM }}>after {e.delay}</span>
                <span style={{ color: CYAN, marginLeft: 'auto' }}>{e.target}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 16px', borderTop: `1px solid ${BORDER}`, background: '#080808', fontSize: 10 }}>
        <span style={{ color: DIM }}>{activeCount} active rules | {criticalCount} critical</span>
        <span style={{ color: DIM }}>{connectedChannels} channels connected</span>
        <span style={{ color: DIM }}>Alert Delivery Management</span>
      </div>
    </div>
  );
}
