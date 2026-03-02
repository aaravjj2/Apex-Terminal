import React, { useState, useEffect, useMemo } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ExposureItem {
  label: string;
  value: number;
  limit: number;
  color: string;
}

interface CorrelationPair {
  a: string;
  b: string;
  value: number;
}

interface RiskAlert {
  id: string;
  time: number;
  severity: 'info' | 'warning' | 'critical';
  message: string;
}

interface StressResult {
  scenario: string;
  impact: number;
  probability: string;
}

interface RiskMonitorProps {
  className?: string;
}

// ─── Mock Data ──────────────────────────────────────────────────────────────

function genDrawdown(): number[] {
  const pts: number[] = [];
  let peak = 100000, val = 100000;
  for (let i = 0; i < 60; i++) {
    val += (Math.random() - 0.47) * 1500;
    if (val > peak) peak = val;
    pts.push(((val - peak) / peak) * 100);
  }
  return pts;
}

function genWaterfall(): { label: string; value: number }[] {
  return [
    { label: 'Start', value: 0 },
    { label: 'AAPL', value: 2340 },
    { label: 'MSFT', value: 1280 },
    { label: 'NVDA', value: -3100 },
    { label: 'TSLA', value: 670 },
    { label: 'JPM', value: 890 },
    { label: 'META', value: 450 },
    { label: 'XOM', value: -780 },
    { label: 'Comm', value: -320 },
  ];
}

const SECTOR_EXPOSURE: ExposureItem[] = [
  { label: 'Technology', value: 78.5, limit: 80, color: '#f59e0b' },
  { label: 'Financials', value: 5.8, limit: 25, color: '#3b82f6' },
  { label: 'Consumer Disc.', value: 7.6, limit: 20, color: '#8b5cf6' },
  { label: 'Energy', value: 5.5, limit: 15, color: '#ef4444' },
  { label: 'Healthcare', value: 2.6, limit: 20, color: '#10b981' },
];

const ASSET_CLASS_EXPOSURE: ExposureItem[] = [
  { label: 'Equities', value: 92, limit: 100, color: '#f59e0b' },
  { label: 'Options', value: 5, limit: 15, color: '#8b5cf6' },
  { label: 'Cash', value: 3, limit: 100, color: '#6b7280' },
];

const GEO_EXPOSURE: ExposureItem[] = [
  { label: 'US', value: 85, limit: 100, color: '#3b82f6' },
  { label: 'Europe', value: 8, limit: 30, color: '#10b981' },
  { label: 'Asia', value: 5, limit: 20, color: '#f59e0b' },
  { label: 'Emerging', value: 2, limit: 15, color: '#ef4444' },
];

const CORRELATIONS: CorrelationPair[] = [
  { a: 'AAPL', b: 'MSFT', value: 0.82 },
  { a: 'AAPL', b: 'GOOGL', value: 0.75 },
  { a: 'MSFT', b: 'GOOGL', value: 0.71 },
  { a: 'NVDA', b: 'AAPL', value: 0.68 },
  { a: 'NVDA', b: 'MSFT', value: 0.73 },
  { a: 'TSLA', b: 'AAPL', value: 0.41 },
  { a: 'JPM', b: 'AAPL', value: 0.35 },
  { a: 'XOM', b: 'AAPL', value: 0.22 },
  { a: 'META', b: 'GOOGL', value: 0.79 },
];

const RISK_ALERTS: RiskAlert[] = [
  { id: 'r1', time: Date.now() - 120000, severity: 'warning', message: 'Technology sector exposure at 78.5% — approaching 80% limit' },
  { id: 'r2', time: Date.now() - 600000, severity: 'info', message: 'Portfolio VaR increased to $4,250 (prev: $3,890)' },
  { id: 'r3', time: Date.now() - 1800000, severity: 'critical', message: 'NVDA position 40.7% of portfolio — exceeds 35% single-name limit' },
  { id: 'r4', time: Date.now() - 3600000, severity: 'info', message: 'Drawdown recovered to -2.1% from -3.8% trough' },
  { id: 'r5', time: Date.now() - 7200000, severity: 'warning', message: 'Correlation spike detected: AAPL-MSFT moved to 0.92' },
];

const STRESS_TESTS: StressResult[] = [
  { scenario: 'Market Crash (-20%)', impact: -45200, probability: 'Low' },
  { scenario: 'Tech Selloff (-15%)', impact: -38100, probability: 'Medium' },
  { scenario: 'Rate Hike +100bps', impact: -12500, probability: 'Medium' },
  { scenario: 'USD Strength +10%', impact: -3200, probability: 'High' },
  { scenario: 'VIX Spike to 40', impact: -28700, probability: 'Low' },
  { scenario: 'Oil +30%', impact: -1800, probability: 'Medium' },
];

const POSITION_CONCENTRATIONS = [
  { symbol: 'NVDA', weight: 40.7, limit: 35 },
  { symbol: 'AAPL', weight: 18.5, limit: 25 },
  { symbol: 'MSFT', weight: 14.8, limit: 25 },
  { symbol: 'META', weight: 6.2, limit: 15 },
  { symbol: 'JPM', weight: 5.8, limit: 15 },
  { symbol: 'XOM', weight: 5.5, limit: 15 },
  { symbol: 'AMZN', weight: 2.8, limit: 15 },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

const fmtUsd = (n: number) => (n < 0 ? '-' : '') + '$' + Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtTime = (ts: number) => new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

function limitColor(val: number, limit: number): string {
  const ratio = val / limit;
  if (ratio >= 0.95) return 'bg-red-500';
  if (ratio >= 0.75) return 'bg-amber-500';
  return 'bg-emerald-500';
}

function limitTextColor(val: number, limit: number): string {
  const ratio = val / limit;
  if (ratio >= 0.95) return 'text-red-400';
  if (ratio >= 0.75) return 'text-amber-400';
  return 'text-emerald-400';
}

const severityStyle: Record<string, string> = {
  info: 'border-l-blue-500 bg-blue-900/10',
  warning: 'border-l-amber-500 bg-amber-900/10',
  critical: 'border-l-red-500 bg-red-900/10',
};

function corrColor(v: number): string {
  if (v >= 0.7) return 'bg-red-600/60';
  if (v >= 0.5) return 'bg-amber-600/40';
  if (v >= 0.3) return 'bg-amber-900/30';
  return 'bg-gray-800/30';
}

// ─── Sub Components ─────────────────────────────────────────────────────────

function VaRGauge({ value, limit }: { value: number; limit: number }) {
  const pct = Math.min(100, (value / limit) * 100);
  const color = pct >= 90 ? '#ef4444' : pct >= 70 ? '#f59e0b' : '#10b981';
  const angle = (pct / 100) * 180 - 90;
  return (
    <div className="flex flex-col items-center">
      <svg width="120" height="70" viewBox="0 0 120 70">
        <path d="M 10 65 A 50 50 0 0 1 110 65" fill="none" stroke="#1f1f35" strokeWidth="8" />
        <path d="M 10 65 A 50 50 0 0 1 110 65" fill="none" stroke={color} strokeWidth="8" strokeDasharray={`${pct * 1.57} 157`} />
        <line x1="60" y1="65" x2={60 + 35 * Math.cos((angle * Math.PI) / 180)} y2={65 - 35 * Math.sin((angle * Math.PI) / 180)} stroke={color} strokeWidth="2" />
        <circle cx="60" cy="65" r="3" fill={color} />
      </svg>
      <p className="text-amber-300 text-sm font-bold -mt-1">{fmtUsd(value)}</p>
      <p className="text-gray-500 text-[10px]">VaR (95%) / {fmtUsd(limit)} limit</p>
    </div>
  );
}

function DrawdownChart({ data }: { data: number[] }) {
  const min = Math.min(...data, 0);
  const range = Math.abs(min) || 1;
  const w = 240, h = 50;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((-v / range) * h * 0.9)}`).join(' ');
  const lastVal = data[data.length - 1];
  return (
    <div>
      <svg width={w} height={h} className="w-full">
        <defs>
          <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polyline points={points} fill="none" stroke="#ef4444" strokeWidth="1.5" />
        <polygon points={`0,0 ${points} ${w},0`} fill="url(#ddGrad)" />
      </svg>
      <p className="text-red-400 text-[10px] font-mono mt-0.5">Current: {lastVal.toFixed(2)}% | Max: {min.toFixed(2)}%</p>
    </div>
  );
}

function ExposureBars({ items, title }: { items: ExposureItem[]; title: string }) {
  return (
    <div>
      <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-1">{title}</p>
      <div className="space-y-1">
        {items.map(item => (
          <div key={item.label} className="flex items-center gap-2">
            <span className="text-gray-400 text-[10px] w-24 truncate">{item.label}</span>
            <div className="flex-1 h-3 bg-[#12121f] rounded overflow-hidden relative">
              <div className={`h-full rounded transition-all duration-500 ${limitColor(item.value, item.limit)}`} style={{ width: `${Math.min(100, item.value)}%`, opacity: 0.7 }} />
              <div className="absolute top-0 bottom-0 border-r border-dashed border-gray-500/40" style={{ left: `${Math.min(100, item.limit)}%` }} />
            </div>
            <span className={`text-[10px] w-10 text-right font-mono ${limitTextColor(item.value, item.limit)}`}>{item.value.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function RiskMonitor({ className = '' }: RiskMonitorProps) {
  const [drawdown] = useState(() => genDrawdown());
  const [waterfall] = useState(() => genWaterfall());
  const [varValue, setVarValue] = useState(4250);
  const varLimit = 6000;
  const [tab, setTab] = useState<'overview' | 'alerts' | 'stress'>('overview');

  useEffect(() => {
    const iv = setInterval(() => {
      setVarValue(v => Math.max(2000, Math.min(5800, v + (Math.random() - 0.48) * 200)));
    }, 3000);
    return () => clearInterval(iv);
  }, []);

  const riskTrend = useMemo(() => {
    const pts: number[] = [];
    let v = 3500;
    for (let i = 0; i < 30; i++) { v += (Math.random() - 0.48) * 300; pts.push(Math.max(1000, v)); }
    return pts;
  }, []);

  const uniqueSymbols = useMemo(() => Array.from(new Set(CORRELATIONS.flatMap(c => [c.a, c.b]))), []);

  return (
    <div className={`bg-[#0a0a14] border border-amber-900/30 rounded text-xs flex flex-col ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-amber-900/20 bg-[#0d0d1a]">
        <span className="text-amber-400 font-bold text-sm">Risk Monitor</span>
        <div className="flex gap-0.5">
          {(['overview', 'alerts', 'stress'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className={`px-2 py-0.5 rounded text-[10px] ${tab === t ? 'bg-amber-600 text-black' : 'bg-[#12121f] text-gray-400 border border-gray-800/50 hover:bg-[#1a1a2e]'}`}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 p-3 space-y-4" style={{ maxHeight: '550px' }}>
        {tab === 'overview' && (
          <>
            {/* VaR & Drawdown */}
            <div className="grid grid-cols-2 gap-4">
              <VaRGauge value={varValue} limit={varLimit} />
              <div>
                <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-1">Drawdown</p>
                <DrawdownChart data={drawdown} />
              </div>
            </div>

            {/* Exposure Breakdown */}
            <div className="grid grid-cols-3 gap-3">
              <ExposureBars items={SECTOR_EXPOSURE} title="Sector" />
              <ExposureBars items={ASSET_CLASS_EXPOSURE} title="Asset Class" />
              <ExposureBars items={GEO_EXPOSURE} title="Geography" />
            </div>

            {/* P&L Waterfall */}
            <div>
              <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-1">P&L Waterfall</p>
              <div className="flex items-end gap-1 h-16">
                {waterfall.map((w, i) => {
                  const maxVal = Math.max(...waterfall.map(x => Math.abs(x.value)));
                  const barH = maxVal > 0 ? (Math.abs(w.value) / maxVal) * 100 : 0;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center justify-end">
                      <div
                        className={`w-full rounded-t ${w.value >= 0 ? 'bg-emerald-500/50' : 'bg-red-500/50'}`}
                        style={{ height: `${barH}%`, minHeight: w.value !== 0 ? '2px' : '0px' }}
                      />
                      <span className="text-[8px] text-gray-500 mt-0.5 truncate w-full text-center">{w.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Position Concentration */}
            <div>
              <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-1">Position Concentration</p>
              <div className="space-y-1">
                {POSITION_CONCENTRATIONS.map(p => (
                  <div key={p.symbol} className="flex items-center gap-2">
                    <span className="text-amber-300 text-[10px] w-10">{p.symbol}</span>
                    <div className="flex-1 h-3 bg-[#12121f] rounded overflow-hidden relative">
                      <div className={`h-full rounded ${p.weight > p.limit ? 'bg-red-500/70' : p.weight > p.limit * 0.8 ? 'bg-amber-500/60' : 'bg-blue-500/50'}`} style={{ width: `${Math.min(100, p.weight * 2)}%` }} />
                      <div className="absolute top-0 bottom-0 border-r border-dashed border-gray-500/40" style={{ left: `${Math.min(100, p.limit * 2)}%` }} />
                    </div>
                    <span className={`text-[10px] w-12 text-right font-mono ${p.weight > p.limit ? 'text-red-400' : 'text-gray-400'}`}>{p.weight.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Correlation Mini Heatmap */}
            <div>
              <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-1">Correlation Heatmap</p>
              <div className="overflow-x-auto">
                <table className="min-w-max">
                  <thead>
                    <tr>
                      <th className="w-10" />
                      {uniqueSymbols.map(s => <th key={s} className="text-[9px] text-gray-500 px-1 w-8 text-center">{s}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {uniqueSymbols.map(row => (
                      <tr key={row}>
                        <td className="text-[9px] text-gray-500 pr-1">{row}</td>
                        {uniqueSymbols.map(col => {
                          if (row === col) return <td key={col} className="w-8 h-6 bg-gray-700/30 text-center text-[8px] text-gray-500">1.0</td>;
                          const pair = CORRELATIONS.find(c => (c.a === row && c.b === col) || (c.a === col && c.b === row));
                          const val = pair?.value ?? 0;
                          return <td key={col} className={`w-8 h-6 text-center text-[8px] text-gray-300 ${corrColor(val)}`}>{val.toFixed(1)}</td>;
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Historical Risk Trend */}
            <div>
              <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-1">Risk Trend (30d VaR)</p>
              <svg width="100%" height="40" viewBox="0 0 240 40" preserveAspectRatio="none">
                <polyline
                  points={riskTrend.map((v, i) => `${(i / (riskTrend.length - 1)) * 240},${40 - ((v - Math.min(...riskTrend)) / (Math.max(...riskTrend) - Math.min(...riskTrend) || 1)) * 38}`).join(' ')}
                  fill="none" stroke="#f59e0b" strokeWidth="1.5"
                />
              </svg>
            </div>
          </>
        )}

        {tab === 'alerts' && (
          <div className="space-y-1.5">
            {RISK_ALERTS.map(a => (
              <div key={a.id} className={`border-l-2 ${severityStyle[a.severity]} rounded-r px-3 py-2`}>
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-medium uppercase ${a.severity === 'critical' ? 'text-red-400' : a.severity === 'warning' ? 'text-amber-400' : 'text-blue-400'}`}>{a.severity}</span>
                  <span className="text-gray-600 text-[10px]">{fmtTime(a.time)}</span>
                </div>
                <p className="text-gray-300 text-[11px] mt-0.5">{a.message}</p>
              </div>
            ))}
          </div>
        )}

        {tab === 'stress' && (
          <div className="space-y-3">
            <p className="text-gray-500 text-[10px] uppercase tracking-wider">Stress Test Scenarios</p>
            <div className="space-y-1.5">
              {STRESS_TESTS.map((s, i) => (
                <div key={i} className="flex items-center gap-2 bg-[#0d0d1a] rounded px-3 py-2 border border-gray-800/30">
                  <div className="flex-1">
                    <span className="text-gray-300 text-[11px]">{s.scenario}</span>
                    <p className="text-gray-600 text-[10px]">Prob: {s.probability}</p>
                  </div>
                  <div className="w-32 h-3 bg-[#12121f] rounded overflow-hidden">
                    <div className="h-full bg-red-500/60 rounded" style={{ width: `${Math.min(100, (Math.abs(s.impact) / 50000) * 100)}%` }} />
                  </div>
                  <span className="text-red-400 font-mono text-[11px] w-20 text-right">{fmtUsd(s.impact)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
