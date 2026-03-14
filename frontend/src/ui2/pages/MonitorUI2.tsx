/**
 * ┌───────────────────────────────────────────────────────────────────────┐
 * │  APEX TERMINAL — System Monitor (UI2)                                │
 * │  Multi-panel trading monitor with ContextBus-driven symbol sync,     │
 * │  system health, WebSocket stats, memory/CPU gauges, and log viewer   │
 * └───────────────────────────────────────────────────────────────────────┘
 */
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';

const T = {
  bg0: '#0C0E12', bg1: '#131722', bg2: '#1E222D', bg3: '#2A2E39',
  border: '#1E222D', border2: '#2A2E39',
  tx0: '#FFF', tx1: '#D1D4DC', tx2: '#787B86', tx3: '#50535E',
  brand: '#2962FF', up: '#26A69A', dn: '#EF5350',
  warn: '#FF9800', info: '#42A5F5', purple: '#AB47BC',
  mono: "'JetBrains Mono','Fira Code',monospace",
  sans: "'Inter','Segoe UI',system-ui,sans-serif",
  r: '4px',
};

interface SystemMetric {
  name: string;
  value: number;
  max: number;
  unit: string;
  status: 'ok' | 'warn' | 'critical';
}

interface WebSocketStatus {
  endpoint: string;
  status: 'connected' | 'disconnected' | 'reconnecting';
  latency: number;
  messagesPerSec: number;
  uptime: number;
  lastMessage: string;
}

interface ServiceHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  responseTime: number;
  uptime: number;
  version: string;
  lastCheck: string;
}

interface LogEntry {
  id: string;
  timestamp: string;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';
  source: string;
  message: string;
  details?: string;
}

interface PerformanceMetric {
  time: number;
  cpu: number;
  memory: number;
  network: number;
  disk: number;
}

interface APICallStat {
  endpoint: string;
  method: string;
  count: number;
  avgLatency: number;
  p50: number;
  p95: number;
  p99: number;
  errorRate: number;
  lastCall: string;
}

interface QueueMetric {
  name: string;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  avgProcessTime: number;
}

/* ── Mock Data ───────────────────────────────────────────────────────── */
function generateSystemMetrics(): SystemMetric[] {
  return [
    { name: 'CPU Usage', value: 25 + Math.random() * 40, max: 100, unit: '%', status: 'ok' },
    { name: 'Memory', value: 4.2 + Math.random() * 3, max: 16, unit: 'GB', status: 'ok' },
    { name: 'Disk I/O', value: 120 + Math.random() * 200, max: 500, unit: 'MB/s', status: 'ok' },
    { name: 'Network', value: 45 + Math.random() * 80, max: 1000, unit: 'Mbps', status: 'ok' },
    { name: 'Open Files', value: Math.round(200 + Math.random() * 500), max: 65535, unit: '', status: 'ok' },
    { name: 'Threads', value: Math.round(30 + Math.random() * 50), max: 500, unit: '', status: 'ok' },
    { name: 'Heap Size', value: 256 + Math.random() * 512, max: 2048, unit: 'MB', status: 'ok' },
    { name: 'GC Pauses', value: Math.random() * 15, max: 100, unit: 'ms', status: 'ok' },
  ].map(m => ({ ...m, status: m.value / m.max > 0.85 ? 'critical' : m.value / m.max > 0.65 ? 'warn' : 'ok' }));
}

function generateWSStatus(): WebSocketStatus[] {
  return [
    { endpoint: 'wss://stream.data.alpaca.markets', status: 'connected', latency: 12 + Math.random() * 30, messagesPerSec: 150 + Math.random() * 300, uptime: 99.99, lastMessage: new Date().toISOString() },
    { endpoint: 'wss://ws.finnhub.io', status: 'connected', latency: 8 + Math.random() * 20, messagesPerSec: 200 + Math.random() * 400, uptime: 99.95, lastMessage: new Date().toISOString() },
    { endpoint: 'wss://ws.polygon.io', status: Math.random() > 0.9 ? 'reconnecting' : 'connected', latency: 15 + Math.random() * 25, messagesPerSec: 100 + Math.random() * 200, uptime: 99.8, lastMessage: new Date().toISOString() },
    { endpoint: 'ws://localhost:8000/ws', status: 'connected', latency: 1 + Math.random() * 5, messagesPerSec: 50 + Math.random() * 100, uptime: 100, lastMessage: new Date().toISOString() },
    { endpoint: 'wss://stream.tradier.com', status: Math.random() > 0.8 ? 'disconnected' : 'connected', latency: 20 + Math.random() * 40, messagesPerSec: 80 + Math.random() * 150, uptime: 98.5, lastMessage: new Date().toISOString() },
  ];
}

function generateServiceHealth(): ServiceHealth[] {
  return [
    { name: 'Market Data Service', status: 'healthy', responseTime: 5 + Math.random() * 15, uptime: 99.99, version: '2.4.1', lastCheck: new Date().toISOString() },
    { name: 'Order Management', status: 'healthy', responseTime: 3 + Math.random() * 10, uptime: 99.95, version: '1.8.3', lastCheck: new Date().toISOString() },
    { name: 'Risk Engine', status: 'healthy', responseTime: 8 + Math.random() * 20, uptime: 99.9, version: '3.1.0', lastCheck: new Date().toISOString() },
    { name: 'Portfolio Manager', status: Math.random() > 0.95 ? 'degraded' : 'healthy', responseTime: 12 + Math.random() * 25, uptime: 99.85, version: '2.0.5', lastCheck: new Date().toISOString() },
    { name: 'Strategy Engine', status: 'healthy', responseTime: 15 + Math.random() * 30, uptime: 99.9, version: '1.5.2', lastCheck: new Date().toISOString() },
    { name: 'News Service', status: 'healthy', responseTime: 50 + Math.random() * 100, uptime: 99.5, version: '1.2.0', lastCheck: new Date().toISOString() },
    { name: 'AI Analytics', status: 'healthy', responseTime: 200 + Math.random() * 500, uptime: 98.5, version: '0.9.1', lastCheck: new Date().toISOString() },
    { name: 'Alert Service', status: 'healthy', responseTime: 2 + Math.random() * 8, uptime: 99.99, version: '1.1.4', lastCheck: new Date().toISOString() },
    { name: 'Screener Service', status: 'healthy', responseTime: 25 + Math.random() * 50, uptime: 99.7, version: '1.3.1', lastCheck: new Date().toISOString() },
    { name: 'Options Analytics', status: 'healthy', responseTime: 30 + Math.random() * 60, uptime: 99.6, version: '2.1.0', lastCheck: new Date().toISOString() },
  ];
}

function generateLogs(): LogEntry[] {
  const sources = ['MarketData', 'OMS', 'Risk', 'WebSocket', 'Auth', 'Strategy', 'Portfolio', 'System'];
  const messages: Record<string, string[]> = {
    DEBUG: ['Cache hit for AAPL bars', 'WebSocket heartbeat sent', 'GC cycle completed in 2ms', 'Connection pool size: 15'],
    INFO: ['Market data connected successfully', 'Order filled: BUY 100 AAPL @ 185.50', 'Portfolio rebalanced', 'Risk limits updated', 'Strategy backtest completed'],
    WARN: ['High latency detected: 250ms', 'Rate limit approaching: 95%', 'Memory usage above 70%', 'Reconnecting to WebSocket'],
    ERROR: ['Failed to fetch market data: timeout', 'Order rejected: insufficient margin', 'Database connection lost'],
    FATAL: ['Critical: OMS heartbeat failed'],
  };
  const levels: LogEntry['level'][] = ['DEBUG', 'DEBUG', 'INFO', 'INFO', 'INFO', 'WARN', 'ERROR'];
  return Array.from({ length: 50 }, (_, i) => {
    const level = i === 0 ? 'FATAL' : levels[Math.floor(Math.random() * levels.length)];
    const msgs = messages[level] ?? messages.INFO!;
    return {
      id: `LOG-${1000 + i}`,
      timestamp: new Date(Date.now() - i * 15000).toISOString(),
      level,
      source: sources[Math.floor(Math.random() * sources.length)],
      message: msgs[Math.floor(Math.random() * msgs.length)],
    };
  });
}

function generatePerfHistory(): PerformanceMetric[] {
  return Array.from({ length: 60 }, (_, i) => ({
    time: Date.now() - (60 - i) * 60000,
    cpu: 20 + Math.random() * 50 + Math.sin(i / 5) * 10,
    memory: 40 + Math.random() * 20 + i * 0.2,
    network: 30 + Math.random() * 60,
    disk: 10 + Math.random() * 30,
  }));
}

function generateAPIStats(): APICallStat[] {
  return [
    { endpoint: '/api/v1/bars', method: 'GET', count: 15420, avgLatency: 45, p50: 35, p95: 120, p99: 250, errorRate: 0.1, lastCall: new Date().toISOString() },
    { endpoint: '/api/v1/quote', method: 'GET', count: 84200, avgLatency: 12, p50: 8, p95: 35, p99: 80, errorRate: 0.02, lastCall: new Date().toISOString() },
    { endpoint: '/api/v1/orders', method: 'POST', count: 1250, avgLatency: 85, p50: 60, p95: 200, p99: 500, errorRate: 0.5, lastCall: new Date().toISOString() },
    { endpoint: '/api/v1/portfolio', method: 'GET', count: 5600, avgLatency: 25, p50: 18, p95: 65, p99: 150, errorRate: 0.05, lastCall: new Date().toISOString() },
    { endpoint: '/api/v1/risk', method: 'GET', count: 3200, avgLatency: 55, p50: 40, p95: 150, p99: 350, errorRate: 0.15, lastCall: new Date().toISOString() },
    { endpoint: '/api/v1/news', method: 'GET', count: 2800, avgLatency: 150, p50: 100, p95: 400, p99: 800, errorRate: 1.2, lastCall: new Date().toISOString() },
    { endpoint: '/api/v1/screener', method: 'POST', count: 890, avgLatency: 200, p50: 150, p95: 500, p99: 1200, errorRate: 0.8, lastCall: new Date().toISOString() },
    { endpoint: '/api/v1/analytics', method: 'POST', count: 450, avgLatency: 350, p50: 250, p95: 800, p99: 2000, errorRate: 2.1, lastCall: new Date().toISOString() },
  ];
}

function generateQueues(): QueueMetric[] {
  return [
    { name: 'Order Queue', pending: Math.round(Math.random() * 5), processing: Math.round(Math.random() * 3), completed: 1250, failed: 2, avgProcessTime: 85 },
    { name: 'Market Data', pending: Math.round(Math.random() * 20), processing: Math.round(5 + Math.random() * 10), completed: 84200, failed: 15, avgProcessTime: 12 },
    { name: 'Risk Calc', pending: Math.round(Math.random() * 10), processing: Math.round(Math.random() * 5), completed: 3200, failed: 5, avgProcessTime: 55 },
    { name: 'Analytics', pending: Math.round(Math.random() * 8), processing: Math.round(Math.random() * 3), completed: 450, failed: 10, avgProcessTime: 350 },
    { name: 'Alert Eval', pending: Math.round(Math.random() * 15), processing: Math.round(Math.random() * 5), completed: 5600, failed: 0, avgProcessTime: 8 },
  ];
}

/* ── Sub-Components ──────────────────────────────────────────────────── */
function GaugeWidget({ metric }: { metric: SystemMetric }) {
  const pct = Math.min((metric.value / metric.max) * 100, 100);
  const statusColors = { ok: T.up, warn: T.warn, critical: T.dn };
  const color = statusColors[metric.status];
  return (
    <div style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '8px', textAlign: 'center' }}>
      <div style={{ fontSize: '8px', color: T.tx3, marginBottom: '4px' }}>{metric.name}</div>
      <div style={{ position: 'relative', width: '60px', height: '60px', margin: '0 auto' }}>
        <svg width="60" height="60" viewBox="0 0 60 60">
          <circle cx="30" cy="30" r="25" fill="none" stroke={T.bg3} strokeWidth="4" strokeDasharray="120 157" strokeDashoffset="-18" transform="rotate(135 30 30)" />
          <circle cx="30" cy="30" r="25" fill="none" stroke={color} strokeWidth="4" strokeDasharray={`${pct * 1.2} ${157 - pct * 1.2}`} strokeDashoffset="-18" transform="rotate(135 30 30)" strokeLinecap="round" />
        </svg>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color, fontFamily: T.mono }}>{metric.value.toFixed(metric.value > 100 ? 0 : 1)}</div>
          <div style={{ fontSize: '7px', color: T.tx3 }}>{metric.unit}</div>
        </div>
      </div>
    </div>
  );
}

function PerformanceChart({ history }: { history: PerformanceMetric[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cvs = canvasRef.current; if (!cvs || !history.length) return;
    const parent = cvs.parentElement; cvs.width = parent?.clientWidth ?? 500; cvs.height = 150;
    const ctx = cvs.getContext('2d'); if (!ctx) return;
    const w = cvs.width, h = cvs.height;
    ctx.clearRect(0, 0, w, h);

    // Grid
    ctx.strokeStyle = T.border; ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) { const y = 5 + (i / 4) * (h - 20); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }

    const series = [
      { key: 'cpu' as const, color: T.brand, label: 'CPU' },
      { key: 'memory' as const, color: T.up, label: 'MEM' },
      { key: 'network' as const, color: T.warn, label: 'NET' },
      { key: 'disk' as const, color: T.purple, label: 'DISK' },
    ];

    series.forEach(({ key, color }) => {
      ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = 1.2;
      history.forEach((p, i) => {
        const x = (i / (history.length - 1)) * w;
        const y = 5 + ((100 - p[key]) / 100) * (h - 20);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
    });

    // Legend
    let legendX = 5;
    series.forEach(({ color, label }) => {
      ctx.fillStyle = color; ctx.fillRect(legendX, h - 10, 8, 3); legendX += 10;
      ctx.fillStyle = T.tx2; ctx.font = '7px Inter'; ctx.textAlign = 'left';
      ctx.fillText(label, legendX, h - 7); legendX += 25;
    });
  }, [history]);
  return <canvas ref={canvasRef} style={{ width: '100%', height: '150px' }} />;
}

function ServiceHealthPanel({ services }: { services: ServiceHealth[] }) {
  const statusIcons = { healthy: '🟢', degraded: '🟡', down: '🔴' };
  return (
    <div style={{ overflow: 'auto', maxHeight: '300px' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9px' }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${T.border}` }}>
            {['Status', 'Service', 'Response', 'Uptime', 'Version'].map(h => (
              <th key={h} style={{ padding: '3px 6px', color: T.tx2, textAlign: 'left', fontWeight: 600, fontFamily: T.sans }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {services.map(s => (
            <tr key={s.name} style={{ borderBottom: `1px solid ${T.border}` }}>
              <td style={{ padding: '3px 6px', fontSize: '10px' }}>{statusIcons[s.status]}</td>
              <td style={{ padding: '3px 6px', color: T.tx0, fontWeight: 600 }}>{s.name}</td>
              <td style={{ padding: '3px 6px', color: s.responseTime > 200 ? T.dn : s.responseTime > 50 ? T.warn : T.up, fontFamily: T.mono }}>{s.responseTime.toFixed(0)}ms</td>
              <td style={{ padding: '3px 6px', color: s.uptime > 99.9 ? T.up : T.warn, fontFamily: T.mono }}>{s.uptime.toFixed(2)}%</td>
              <td style={{ padding: '3px 6px', color: T.tx3, fontFamily: T.mono }}>{s.version}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function WebSocketPanel({ connections }: { connections: WebSocketStatus[] }) {
  const statusColors = { connected: T.up, disconnected: T.dn, reconnecting: T.warn };
  return (
    <div style={{ overflow: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8px', fontFamily: T.mono }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${T.border}` }}>
            {['Endpoint', 'Status', 'Latency', 'msg/s', 'Uptime'].map(h => (
              <th key={h} style={{ padding: '3px 6px', color: T.tx2, textAlign: 'left', fontWeight: 600 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {connections.map(ws => (
            <tr key={ws.endpoint} style={{ borderBottom: `1px solid ${T.border}` }}>
              <td style={{ padding: '3px 6px', color: T.tx1, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ws.endpoint}</td>
              <td style={{ padding: '3px 6px' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: statusColors[ws.status], fontSize: '8px', fontWeight: 700 }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: statusColors[ws.status], boxShadow: ws.status === 'connected' ? `0 0 4px ${statusColors[ws.status]}` : 'none' }} />
                  {ws.status.toUpperCase()}
                </span>
              </td>
              <td style={{ padding: '3px 6px', color: ws.latency > 50 ? T.warn : T.tx1 }}>{ws.latency.toFixed(0)}ms</td>
              <td style={{ padding: '3px 6px', color: T.tx1 }}>{ws.messagesPerSec.toFixed(0)}</td>
              <td style={{ padding: '3px 6px', color: ws.uptime > 99.9 ? T.up : T.warn }}>{ws.uptime.toFixed(2)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LogViewer({ logs, filter, setFilter }: { logs: LogEntry[]; filter: string; setFilter: (f: string) => void }) {
  const levelColors: Record<string, string> = { DEBUG: T.tx3, INFO: T.info, WARN: T.warn, ERROR: T.dn, FATAL: '#FF1744' };
  const filtered = logs.filter(l => !filter || l.level === filter);

  return (
    <div>
      <div style={{ display: 'flex', gap: '4px', marginBottom: '6px' }}>
        {['', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            background: filter === f ? T.brand : T.bg3, color: filter === f ? '#FFF' : T.tx2,
            border: `1px solid ${filter === f ? T.brand : T.border}`, borderRadius: '2px',
            padding: '2px 6px', fontSize: '8px', fontWeight: 600, cursor: 'pointer',
          }}>{f || 'ALL'}</button>
        ))}
      </div>
      <div style={{ overflow: 'auto', maxHeight: '300px', fontFamily: T.mono, fontSize: '8px' }}>
        {filtered.map(l => (
          <div key={l.id} style={{
            display: 'flex', gap: '6px', padding: '2px 4px',
            background: l.level === 'FATAL' ? 'rgba(255,23,68,0.1)' : l.level === 'ERROR' ? 'rgba(239,83,80,0.05)' : 'transparent',
            borderBottom: `1px solid ${T.border}`,
          }}>
            <span style={{ color: T.tx3, minWidth: '65px' }}>{new Date(l.timestamp).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
            <span style={{
              color: levelColors[l.level], fontWeight: 700, minWidth: '35px',
              background: `${levelColors[l.level]}15`, padding: '0 3px', borderRadius: '2px',
            }}>{l.level}</span>
            <span style={{ color: T.brand, minWidth: '65px' }}>[{l.source}]</span>
            <span style={{ color: T.tx1, flex: 1 }}>{l.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function APIStatsPanel({ stats }: { stats: APICallStat[] }) {
  return (
    <div style={{ overflow: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8px', fontFamily: T.mono }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${T.border}` }}>
            {['Endpoint', 'Method', 'Calls', 'Avg', 'P50', 'P95', 'P99', 'Err%'].map(h => (
              <th key={h} style={{ padding: '3px 4px', color: T.tx2, textAlign: 'right', fontWeight: 600 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {stats.map(s => (
            <tr key={s.endpoint} style={{ borderBottom: `1px solid ${T.border}` }}>
              <td style={{ padding: '3px 4px', color: T.tx0, textAlign: 'left', fontWeight: 600 }}>{s.endpoint}</td>
              <td style={{ padding: '3px 4px', color: s.method === 'GET' ? T.up : T.brand, textAlign: 'right' }}>{s.method}</td>
              <td style={{ padding: '3px 4px', color: T.tx1, textAlign: 'right' }}>{s.count.toLocaleString()}</td>
              <td style={{ padding: '3px 4px', color: T.tx1, textAlign: 'right' }}>{s.avgLatency}ms</td>
              <td style={{ padding: '3px 4px', color: T.tx2, textAlign: 'right' }}>{s.p50}ms</td>
              <td style={{ padding: '3px 4px', color: s.p95 > 200 ? T.warn : T.tx2, textAlign: 'right' }}>{s.p95}ms</td>
              <td style={{ padding: '3px 4px', color: s.p99 > 500 ? T.dn : T.tx2, textAlign: 'right' }}>{s.p99}ms</td>
              <td style={{ padding: '3px 4px', color: s.errorRate > 1 ? T.dn : s.errorRate > 0.5 ? T.warn : T.up, textAlign: 'right' }}>{s.errorRate.toFixed(2)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function QueuePanel({ queues }: { queues: QueueMetric[] }) {
  return (
    <div style={{ overflow: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9px', fontFamily: T.mono }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${T.border}` }}>
            {['Queue', 'Pending', 'Processing', 'Completed', 'Failed', 'Avg Time'].map(h => (
              <th key={h} style={{ padding: '3px 6px', color: T.tx2, textAlign: 'right', fontWeight: 600 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {queues.map(q => (
            <tr key={q.name} style={{ borderBottom: `1px solid ${T.border}` }}>
              <td style={{ padding: '3px 6px', color: T.tx0, fontWeight: 600, textAlign: 'left' }}>{q.name}</td>
              <td style={{ padding: '3px 6px', color: q.pending > 10 ? T.warn : T.tx1, textAlign: 'right' }}>{q.pending}</td>
              <td style={{ padding: '3px 6px', color: T.info, textAlign: 'right' }}>{q.processing}</td>
              <td style={{ padding: '3px 6px', color: T.up, textAlign: 'right' }}>{q.completed.toLocaleString()}</td>
              <td style={{ padding: '3px 6px', color: q.failed > 0 ? T.dn : T.tx3, textAlign: 'right' }}>{q.failed}</td>
              <td style={{ padding: '3px 6px', color: T.tx2, textAlign: 'right' }}>{q.avgProcessTime}ms</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════ */
/* MAIN COMPONENT                                                        */
/* ── API-backed system health hook ──────────────────────────────────── */
/**
 * Polls GET /api/v1/platform/health every 10 seconds.
 * Returns the parsed response or null when the API is unreachable.
 * Consumers fall back to the random generator functions when null.
 */
function useSystemMetrics() {
  const [health, setHealth] = React.useState<any>(null);
  React.useEffect(() => {
    const fetch_health = () => {
      fetch('/api/v1/platform/health')
        .then(r => r.ok ? r.json() : null)
        .catch(() => null)
        .then(data => { if (data) setHealth(data); });
    };
    fetch_health();
    const id = setInterval(fetch_health, 10000);
    return () => clearInterval(id);
  }, []);
  return health;
}

/* ═══════════════════════════════════════════════════════════════════════ */
type MonitorTab = 'overview' | 'services' | 'websockets' | 'logs' | 'api' | 'queues';

export default function MonitorUI2() {
  const systemHealth = useSystemMetrics(); // real API data; null while unavailable
  const [tab, setTab] = useState<MonitorTab>('overview');
  const [metrics, setMetrics] = useState<SystemMetric[]>(generateSystemMetrics());
  const [wsStatus, setWsStatus] = useState<WebSocketStatus[]>(generateWSStatus());
  const [services, setServices] = useState<ServiceHealth[]>(generateServiceHealth());
  const [logs, setLogs] = useState<LogEntry[]>(generateLogs());
  const [perfHistory] = useState<PerformanceMetric[]>(generatePerfHistory());
  const [apiStats] = useState<APICallStat[]>(generateAPIStats());
  const [queues, setQueues] = useState<QueueMetric[]>(generateQueues());
  const [logFilter, setLogFilter] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Apply real API data to state whenever a new health response arrives
  useEffect(() => {
    if (!systemHealth) return;
    if (systemHealth.metrics) setMetrics(systemHealth.metrics);
    if (systemHealth.services) setServices(systemHealth.services);
  }, [systemHealth]);

  // Auto-refresh: use API-provided data when available; fall back to generators
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      if (!systemHealth) {
        setMetrics(generateSystemMetrics());
        setServices(generateServiceHealth());
      }
      setWsStatus(generateWSStatus());
      setQueues(generateQueues());
    }, 3000);
    return () => clearInterval(interval);
  }, [autoRefresh, systemHealth]);

  const healthySvcs = services.filter(s => s.status === 'healthy').length;
  const connectedWS = wsStatus.filter(w => w.status === 'connected').length;
  const errorLogs = logs.filter(l => l.level === 'ERROR' || l.level === 'FATAL').length;
  const totalMsgSec = wsStatus.reduce((s, w) => s + w.messagesPerSec, 0);

  const summaryCards = [
    { label: 'Services', value: `${healthySvcs}/${services.length}`, color: healthySvcs === services.length ? T.up : T.warn, sub: 'healthy' },
    { label: 'WebSocket', value: `${connectedWS}/${wsStatus.length}`, color: connectedWS === wsStatus.length ? T.up : T.warn, sub: 'connected' },
    { label: 'Errors', value: `${errorLogs}`, color: errorLogs > 5 ? T.dn : errorLogs > 0 ? T.warn : T.up, sub: 'last 15min' },
    { label: 'msg/sec', value: totalMsgSec.toFixed(0), color: T.info, sub: 'throughput' },
  ];

  const tabs: { id: MonitorTab; label: string; icon: string }[] = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'services', label: 'Services', icon: '🏥' },
    { id: 'websockets', label: 'WebSockets', icon: '🔌' },
    { id: 'logs', label: 'Logs', icon: '📋' },
    { id: 'api', label: 'API Stats', icon: '📡' },
    { id: 'queues', label: 'Queues', icon: '📬' },
  ];

  return (
    <div data-testid="monitor-page" style={{ display: 'flex', flexDirection: 'column', height: '100%', background: T.bg0, fontFamily: T.sans, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '6px 10px', gap: '8px', background: T.bg1, borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
        <span style={{ fontSize: '12px', fontWeight: 800, color: T.tx0 }}>SYSTEM MONITOR</span>
        <div style={{ height: 14, width: 1, background: T.border2 }} />
        {summaryCards.map(c => (
          <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '2px 8px', background: T.bg2, borderRadius: T.r, border: `1px solid ${T.border}` }}>
            <span style={{ fontSize: '8px', color: T.tx3 }}>{c.label}:</span>
            <span style={{ fontSize: '10px', fontWeight: 700, color: c.color, fontFamily: T.mono }}>{c.value}</span>
          </div>
        ))}
        <div style={{ flex: 1 }} />
        <button onClick={() => setAutoRefresh(!autoRefresh)} style={{
          background: autoRefresh ? T.up : T.bg3, color: autoRefresh ? '#FFF' : T.tx3,
          border: `1px solid ${autoRefresh ? T.up : T.border}`, borderRadius: '2px',
          padding: '2px 8px', fontSize: '8px', fontWeight: 600, cursor: 'pointer',
        }}>
          {autoRefresh ? '⏸ Auto-Refresh ON' : '▶ Auto-Refresh OFF'}
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '1px', padding: '2px 6px', background: T.bg1, borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            background: tab === t.id ? T.bg3 : 'transparent', color: tab === t.id ? T.tx0 : T.tx3,
            border: 'none', padding: '4px 8px', borderRadius: '3px 3px 0 0', fontSize: '9px', fontWeight: 600,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px',
            borderBottom: tab === t.id ? `2px solid ${T.brand}` : '2px solid transparent',
          }}><span>{t.icon}</span> {t.label}</button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
        {tab === 'overview' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
            {/* Gauges */}
            {metrics.map(m => <GaugeWidget key={m.name} metric={m} />)}
            {/* Performance chart */}
            <div style={{ gridColumn: '1 / -1', background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '10px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: T.tx0, marginBottom: '6px' }}>Performance History (60min)</div>
              <PerformanceChart history={perfHistory} />
            </div>
            {/* Service Health */}
            <div style={{ gridColumn: '1 / 3', background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '10px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: T.tx0, marginBottom: '6px' }}>Service Health</div>
              <ServiceHealthPanel services={services} />
            </div>
            {/* WebSocket */}
            <div style={{ gridColumn: '3 / 5', background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '10px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: T.tx0, marginBottom: '6px' }}>WebSocket Connections</div>
              <WebSocketPanel connections={wsStatus} />
            </div>
            {/* Queues */}
            <div style={{ gridColumn: '1 / 3', background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '10px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: T.tx0, marginBottom: '6px' }}>Queue Status</div>
              <QueuePanel queues={queues} />
            </div>
            {/* Recent Logs Preview */}
            <div style={{ gridColumn: '3 / 5', background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '10px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: T.tx0, marginBottom: '6px' }}>Recent Logs</div>
              <div style={{ maxHeight: '150px', overflow: 'auto', fontFamily: T.mono, fontSize: '8px' }}>
                {logs.slice(0, 10).map(l => (
                  <div key={l.id} style={{ display: 'flex', gap: '4px', padding: '1px 2px', borderBottom: `1px solid ${T.border}` }}>
                    <span style={{ color: T.tx3, minWidth: '50px' }}>{new Date(l.timestamp).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                    <span style={{ color: { DEBUG: T.tx3, INFO: T.info, WARN: T.warn, ERROR: T.dn, FATAL: '#FF1744' }[l.level], fontWeight: 700, minWidth: '30px' }}>{l.level}</span>
                    <span style={{ color: T.tx1, flex: 1 }}>{l.message}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'services' && (
          <div style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '12px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: T.tx0, marginBottom: '8px' }}>Service Health Dashboard</div>
            <ServiceHealthPanel services={services} />
          </div>
        )}

        {tab === 'websockets' && (
          <div style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '12px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: T.tx0, marginBottom: '8px' }}>WebSocket Connections</div>
            <WebSocketPanel connections={wsStatus} />
          </div>
        )}

        {tab === 'logs' && (
          <div style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '12px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: T.tx0, marginBottom: '8px' }}>System Logs</div>
            <LogViewer logs={logs} filter={logFilter} setFilter={setLogFilter} />
          </div>
        )}

        {tab === 'api' && (
          <div style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '12px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: T.tx0, marginBottom: '8px' }}>API Performance Statistics</div>
            <APIStatsPanel stats={apiStats} />
          </div>
        )}

        {tab === 'queues' && (
          <div style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '12px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: T.tx0, marginBottom: '8px' }}>Queue Status</div>
            <QueuePanel queues={queues} />
          </div>
        )}
      </div>
    </div>
  );
}

export { MonitorUI2 };
