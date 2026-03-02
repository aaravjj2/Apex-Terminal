import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  PieChart,
  Pie,
  Cell,
  RadialBarChart,
  RadialBar,
} from 'recharts';
import {
  Shield, AlertTriangle, TrendingDown, Activity, Layers,
  Target, Zap, Bell, ChevronRight, BarChart3, RefreshCw,
} from 'lucide-react';

// --- Types & Mock Data ---

const VAR_DATA = { current: 2.8, limit: 5.0, pct95: 2.8, pct99: 4.1, stressed: 6.2 };

const STRESS_TESTS = [
  { scenario: '2008 GFC Replay', portfolioImpact: -18.4, varImpact: 8.2, status: 'fail' as const },
  { scenario: 'COVID March 2020', portfolioImpact: -14.2, varImpact: 6.8, status: 'fail' as const },
  { scenario: 'Fed +100bp Shock', portfolioImpact: -5.3, varImpact: 3.1, status: 'pass' as const },
  { scenario: 'China Hard Landing', portfolioImpact: -9.7, varImpact: 4.9, status: 'pass' as const },
  { scenario: 'Oil Spike +50%', portfolioImpact: -3.8, varImpact: 2.4, status: 'pass' as const },
  { scenario: 'USD +10% Rally', portfolioImpact: -4.1, varImpact: 2.7, status: 'pass' as const },
  { scenario: 'Tech Selloff -20%', portfolioImpact: -11.6, varImpact: 5.5, status: 'fail' as const },
  { scenario: 'Credit Spread +200bp', portfolioImpact: -6.9, varImpact: 3.8, status: 'pass' as const },
];

const EXPOSURE_DATA = [
  { name: 'US Equity', gross: 85, net: 72, color: '#6699ff' },
  { name: 'Intl Equity', gross: 15, net: 12, color: '#ff9900' },
  { name: 'Fixed Income', gross: 25, net: -8, color: '#00cc66' },
  { name: 'Commodities', gross: 10, net: 5, color: '#cc66ff' },
  { name: 'FX', gross: 20, net: 3, color: '#ff3333' },
  { name: 'Options', gross: 30, net: -15, color: '#66cccc' },
];

const RISK_LIMITS = [
  { name: 'Total VaR', current: 2.8, limit: 5.0, pct: 56 },
  { name: 'Sector Concentration', current: 56.6, limit: 40.0, pct: 141 },
  { name: 'Single Name', current: 19.7, limit: 15.0, pct: 131 },
  { name: 'Gross Leverage', current: 1.85, limit: 3.0, pct: 62 },
  { name: 'Beta Exposure', current: 1.08, limit: 1.5, pct: 72 },
  { name: 'Duration', current: 2.1, limit: 5.0, pct: 42 },
];

const CORRELATION_PAIRS = [
  ['', 'AAPL', 'MSFT', 'GOOGL', 'JPM', 'XOM', 'JNJ'],
  ['AAPL', 1.0, 0.82, 0.78, 0.45, 0.22, 0.18],
  ['MSFT', 0.82, 1.0, 0.85, 0.42, 0.19, 0.15],
  ['GOOGL', 0.78, 0.85, 1.0, 0.38, 0.16, 0.12],
  ['JPM', 0.45, 0.42, 0.38, 1.0, 0.55, 0.32],
  ['XOM', 0.22, 0.19, 0.16, 0.55, 1.0, 0.28],
  ['JNJ', 0.18, 0.15, 0.12, 0.32, 0.28, 1.0],
];

const HISTORICAL_RISK = Array.from({ length: 60 }, (_, i) => {
  const d = new Date(2024, 7, 1);
  d.setDate(d.getDate() + i);
  return {
    date: `${d.getMonth() + 1}/${d.getDate()}`,
    var95: +(2 + Math.sin(i * 0.15) * 1.2 + Math.random() * 0.5).toFixed(2),
    var99: +(3 + Math.sin(i * 0.15) * 1.5 + Math.random() * 0.6).toFixed(2),
    realizedVol: +(12 + Math.sin(i * 0.12) * 4 + Math.random() * 2).toFixed(1),
  };
});

const FACTOR_RISK = [
  { factor: 'Market Beta', contribution: 62, marginal: 1.82 },
  { factor: 'Size', contribution: 8, marginal: 0.24 },
  { factor: 'Value', contribution: -3, marginal: -0.09 },
  { factor: 'Momentum', contribution: 12, marginal: 0.35 },
  { factor: 'Quality', contribution: 5, marginal: 0.15 },
  { factor: 'Volatility', contribution: 9, marginal: 0.26 },
  { factor: 'Idiosyncratic', contribution: 7, marginal: 0.21 },
];

const RISK_ALERTS = [
  { id: 'a1', time: '14:32', level: 'critical' as const, message: 'Sector concentration exceeds 40% limit (Tech: 56.6%)' },
  { id: 'a2', time: '14:15', level: 'warning' as const, message: 'Single name exposure MSFT at 19.7% (limit: 15%)' },
  { id: 'a3', time: '13:48', level: 'info' as const, message: 'VaR increased 12% from yesterday (2.5% → 2.8%)' },
  { id: 'a4', time: '12:20', level: 'warning' as const, message: 'Correlation spike detected: AAPL-MSFT (0.82 → 0.91)' },
  { id: 'a5', time: '11:05', level: 'info' as const, message: 'Portfolio beta drift: 1.02 → 1.08 over 5 days' },
];

const CONCENTRATION = [
  { name: 'Top 1', value: 19.7, color: '#ff3333' },
  { name: 'Top 3', value: 56.6, color: '#ff9900' },
  { name: 'Top 5', value: 76.0, color: '#6699ff' },
  { name: 'Top 10', value: 100, color: '#00cc66' },
];

// --- Sub-components ---

const VaRGauge: React.FC = () => {
  const pct = (VAR_DATA.current / VAR_DATA.limit) * 100;
  const gaugeData = [{ name: 'VaR', value: pct, fill: pct > 80 ? '#ff3333' : pct > 60 ? '#ff9900' : '#00cc66' }];

  return (
    <div className="bg-[#0d0d1a] border border-[#1a1a2e] rounded-lg p-3">
      <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Value at Risk (95%)</div>
      <div className="flex items-center gap-4">
        <div className="w-32 h-20">
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart cx="50%" cy="100%" innerRadius="60%" outerRadius="100%" startAngle={180} endAngle={0} data={gaugeData} barSize={10}>
              <RadialBar background={{ fill: '#1a1a2e' }} dataKey="value" cornerRadius={5} />
            </RadialBarChart>
          </ResponsiveContainer>
        </div>
        <div>
          <div className="text-2xl font-bold text-amber-400">{VAR_DATA.pct95}%</div>
          <div className="text-[10px] text-gray-500">of ${(EXPOSURE_DATA.reduce((s, e) => s + e.gross, 0) * 1000).toLocaleString()}</div>
          <div className="flex items-center gap-3 mt-1 text-[10px]">
            <div><span className="text-gray-500">99%:</span> <span className="text-[#ff9900]">{VAR_DATA.pct99}%</span></div>
            <div><span className="text-gray-500">Stressed:</span> <span className="text-[#ff3333]">{VAR_DATA.stressed}%</span></div>
          </div>
        </div>
      </div>
    </div>
  );
};

const CorrelationHeatmap: React.FC = () => {
  const getColor = (v: number) => {
    if (typeof v !== 'number') return '';
    if (v >= 0.8) return 'bg-[#ff3333]/60';
    if (v >= 0.6) return 'bg-[#ff9900]/40';
    if (v >= 0.4) return 'bg-[#ff9900]/20';
    if (v >= 0.2) return 'bg-[#6699ff]/20';
    return 'bg-[#6699ff]/10';
  };

  return (
    <table className="w-full text-[10px]">
      <thead>
        <tr>
          {(CORRELATION_PAIRS[0] as string[]).map((h, i) => (
            <th key={i} className={`px-2 py-1 ${i === 0 ? 'text-left' : 'text-center'} text-amber-400 font-medium`}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {CORRELATION_PAIRS.slice(1).map((row, ri) => (
          <tr key={ri}>
            {(row as (string | number)[]).map((cell, ci) => (
              <td key={ci} className={`px-2 py-1 ${ci === 0 ? 'text-amber-400 font-medium text-left' : `text-center ${typeof cell === 'number' ? getColor(cell) : ''}`} ${typeof cell === 'number' && cell === 1 ? 'text-gray-600' : 'text-gray-300'}`}>
                {typeof cell === 'number' ? cell.toFixed(2) : cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

// --- Main Component ---

export const RiskDashboard: React.FC<{ className?: string }> = ({ className = '' }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'stress' | 'factors' | 'scenarios'>('overview');

  const TABS: { key: typeof activeTab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'stress', label: 'Stress Tests' },
    { key: 'factors', label: 'Factor Risk' },
    { key: 'scenarios', label: 'Scenarios' },
  ];

  return (
    <div className={`flex flex-col h-full bg-[#0a0a14] text-gray-300 font-mono ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-[#1a1a2e] bg-[#0d0d1a]">
        <Shield size={16} className="text-amber-400" />
        <span className="text-amber-400 font-bold text-sm">Risk Dashboard</span>
        <div className="flex items-center gap-0.5 ml-4 bg-[#0a0a14] rounded p-0.5">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setActiveTab(t.key)} className={`px-3 py-1 text-xs rounded transition-colors ${activeTab === t.key ? 'bg-amber-500/20 text-amber-400' : 'text-gray-500 hover:text-gray-300'}`}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <span className="text-[10px] text-gray-600">Last updated: 14:35 EST</span>
        <button className="text-gray-500 hover:text-gray-300 p-1"><RefreshCw size={14} /></button>
      </div>

      <div className="flex-1 overflow-auto">
        {activeTab === 'overview' && (
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <VaRGauge />

              {/* Risk Limit Utilization */}
              <div className="bg-[#0d0d1a] border border-[#1a1a2e] rounded-lg p-3 col-span-2">
                <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Risk Limit Utilization</div>
                <div className="space-y-2">
                  {RISK_LIMITS.map((rl) => (
                    <div key={rl.name} className="flex items-center gap-3">
                      <span className="text-xs text-gray-400 w-36">{rl.name}</span>
                      <div className="flex-1 bg-[#1a1a2e] rounded-full h-2 relative">
                        <div
                          className={`h-2 rounded-full transition-all ${rl.pct > 100 ? 'bg-[#ff3333]' : rl.pct > 75 ? 'bg-[#ff9900]' : 'bg-[#00cc66]'}`}
                          style={{ width: `${Math.min(100, rl.pct)}%` }}
                        />
                        {rl.pct > 100 && <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0.5 h-3 bg-white/50" />}
                      </div>
                      <span className={`text-xs font-medium w-12 text-right ${rl.pct > 100 ? 'text-[#ff3333]' : rl.pct > 75 ? 'text-[#ff9900]' : 'text-gray-400'}`}>
                        {rl.pct}%
                      </span>
                      {rl.pct > 100 && <AlertTriangle size={12} className="text-[#ff3333]" />}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Exposure Breakdown */}
              <div className="bg-[#0d0d1a] border border-[#1a1a2e] rounded-lg p-3">
                <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Exposure Breakdown</div>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={EXPOSURE_DATA} layout="vertical" margin={{ left: 0 }}>
                      <XAxis type="number" tick={{ fill: '#666', fontSize: 10 }} />
                      <YAxis type="category" dataKey="name" tick={{ fill: '#999', fontSize: 10 }} width={80} />
                      <Tooltip contentStyle={{ background: '#0d0d1a', border: '1px solid #1a1a2e', borderRadius: 4, fontSize: 11, color: '#ccc' }} />
                      <Bar dataKey="gross" name="Gross" fill="#6699ff" fillOpacity={0.5} radius={[0, 3, 3, 0]} />
                      <Bar dataKey="net" name="Net" fill="#ff9900" radius={[0, 3, 3, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Correlation Heatmap */}
              <div className="bg-[#0d0d1a] border border-[#1a1a2e] rounded-lg p-3">
                <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Correlation Matrix</div>
                <CorrelationHeatmap />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {/* Historical Risk */}
              <div className="bg-[#0d0d1a] border border-[#1a1a2e] rounded-lg p-3 col-span-2">
                <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Historical VaR Trend</div>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={HISTORICAL_RISK} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2e" />
                      <XAxis dataKey="date" tick={{ fill: '#666', fontSize: 9 }} tickCount={8} />
                      <YAxis tick={{ fill: '#666', fontSize: 10 }} tickFormatter={(v: number) => `${v}%`} />
                      <Tooltip contentStyle={{ background: '#0d0d1a', border: '1px solid #1a1a2e', borderRadius: 4, fontSize: 11, color: '#ccc' }} />
                      <Area type="monotone" dataKey="var95" name="VaR 95%" fill="#ff990020" stroke="#ff9900" strokeWidth={1.5} />
                      <Line type="monotone" dataKey="var99" name="VaR 99%" stroke="#ff3333" strokeWidth={1} dot={false} strokeDasharray="3 2" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Risk Alerts */}
              <div className="bg-[#0d0d1a] border border-[#1a1a2e] rounded-lg p-3">
                <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Bell size={10} /> Risk Alerts
                </div>
                <div className="space-y-1.5 overflow-y-auto max-h-40">
                  {RISK_ALERTS.map((alert) => (
                    <div key={alert.id} className="flex items-start gap-2 p-1.5 rounded bg-[#0a0a14] border border-[#1a1a2e]">
                      <AlertTriangle
                        size={10}
                        className={`mt-0.5 shrink-0 ${alert.level === 'critical' ? 'text-[#ff3333]' : alert.level === 'warning' ? 'text-[#ff9900]' : 'text-[#6699ff]'}`}
                      />
                      <div>
                        <div className="text-[10px] text-gray-300 leading-tight">{alert.message}</div>
                        <div className="text-[9px] text-gray-600 mt-0.5">{alert.time}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Concentration */}
            <div className="bg-[#0d0d1a] border border-[#1a1a2e] rounded-lg p-3">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Concentration Analysis</div>
              <div className="flex items-center gap-6">
                {CONCENTRATION.map((c) => (
                  <div key={c.name} className="flex-1">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-gray-500">{c.name}</span>
                      <span className="font-medium" style={{ color: c.color }}>{c.value}%</span>
                    </div>
                    <div className="bg-[#1a1a2e] rounded-full h-2">
                      <div className="h-2 rounded-full transition-all" style={{ width: `${c.value}%`, backgroundColor: c.color, opacity: 0.7 }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'stress' && (
          <div className="p-4">
            <div className="bg-[#0d0d1a] border border-[#1a1a2e] rounded-lg">
              <div className="px-3 py-2 border-b border-[#1a1a2e]">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider">Stress Test Results</span>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#1a1a2e]">
                    <th className="px-3 py-2 text-left text-gray-500 font-medium">Scenario</th>
                    <th className="px-3 py-2 text-right text-gray-500 font-medium">Portfolio Impact</th>
                    <th className="px-3 py-2 text-right text-gray-500 font-medium">VaR Impact</th>
                    <th className="px-3 py-2 text-center text-gray-500 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {STRESS_TESTS.map((test, i) => (
                    <tr key={i} className="border-b border-[#1a1a2e]/30 hover:bg-[#12121f]">
                      <td className="px-3 py-2 text-gray-300">{test.scenario}</td>
                      <td className="px-3 py-2 text-right text-[#ff3333] font-medium">{test.portfolioImpact}%</td>
                      <td className="px-3 py-2 text-right text-[#ff9900]">{test.varImpact}%</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${test.status === 'pass' ? 'bg-[#00cc66]/20 text-[#00cc66]' : 'bg-[#ff3333]/20 text-[#ff3333]'}`}>
                          {test.status.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'factors' && (
          <div className="p-4 space-y-4">
            <div className="bg-[#0d0d1a] border border-[#1a1a2e] rounded-lg p-3">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Factor Risk Decomposition</div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={FACTOR_RISK} layout="vertical" margin={{ left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2e" />
                    <XAxis type="number" tick={{ fill: '#666', fontSize: 10 }} tickFormatter={(v: number) => `${v}%`} />
                    <YAxis type="category" dataKey="factor" tick={{ fill: '#999', fontSize: 10 }} width={100} />
                    <Tooltip contentStyle={{ background: '#0d0d1a', border: '1px solid #1a1a2e', borderRadius: 4, fontSize: 11, color: '#ccc' }} formatter={(v: number) => `${v}%`} />
                    <Bar dataKey="contribution" name="Contribution %" radius={[0, 3, 3, 0]}>
                      {FACTOR_RISK.map((f, i) => (
                        <Cell key={i} fill={f.contribution >= 0 ? '#6699ff' : '#ff3333'} fillOpacity={0.7} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-[#0d0d1a] border border-[#1a1a2e] rounded-lg">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#1a1a2e]">
                    <th className="px-3 py-2 text-left text-gray-500 font-medium">Factor</th>
                    <th className="px-3 py-2 text-right text-gray-500 font-medium">Contribution %</th>
                    <th className="px-3 py-2 text-right text-gray-500 font-medium">Marginal VaR</th>
                  </tr>
                </thead>
                <tbody>
                  {FACTOR_RISK.map((f) => (
                    <tr key={f.factor} className="border-b border-[#1a1a2e]/30 hover:bg-[#12121f]">
                      <td className="px-3 py-2 text-gray-300">{f.factor}</td>
                      <td className={`px-3 py-2 text-right font-medium ${f.contribution >= 0 ? 'text-[#6699ff]' : 'text-[#ff3333]'}`}>{f.contribution}%</td>
                      <td className="px-3 py-2 text-right text-gray-400">{f.marginal.toFixed(2)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'scenarios' && (
          <div className="p-4">
            <div className="bg-[#0d0d1a] border border-[#1a1a2e] rounded-lg p-3">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-3">Scenario Analysis</div>
              <div className="grid grid-cols-3 gap-3">
                {['Bull Case', 'Base Case', 'Bear Case'].map((scenario, si) => (
                  <div key={scenario} className="bg-[#0a0a14] border border-[#1a1a2e] rounded p-3">
                    <div className={`text-xs font-medium mb-2 ${si === 0 ? 'text-[#00cc66]' : si === 1 ? 'text-amber-400' : 'text-[#ff3333]'}`}>
                      {scenario}
                    </div>
                    <div className="space-y-1.5 text-[10px]">
                      <div className="flex justify-between"><span className="text-gray-500">Probability:</span><span>{si === 0 ? '25%' : si === 1 ? '50%' : '25%'}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">SPX:</span><span className={si === 0 ? 'text-[#00cc66]' : si === 2 ? 'text-[#ff3333]' : ''}>{si === 0 ? '+15%' : si === 1 ? '+5%' : '-20%'}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Portfolio:</span><span className={si === 0 ? 'text-[#00cc66]' : si === 2 ? 'text-[#ff3333]' : ''}>{si === 0 ? '+22%' : si === 1 ? '+8%' : '-18%'}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">VaR:</span><span>{si === 0 ? '1.8%' : si === 1 ? '2.8%' : '6.2%'}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">10Y Yield:</span><span>{si === 0 ? '3.5%' : si === 1 ? '4.2%' : '5.0%'}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RiskDashboard;
