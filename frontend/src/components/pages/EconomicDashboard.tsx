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
  ReferenceLine,
} from 'recharts';
import {
  Calendar, Globe, TrendingUp, TrendingDown, Filter,
  ChevronRight, Clock, AlertTriangle, BarChart3, ArrowUpDown,
  RefreshCw, Landmark, Banknote, Users,
} from 'lucide-react';

// --- Types ---

type Impact = 'high' | 'medium' | 'low';
type Country = 'US' | 'EU' | 'UK' | 'JP' | 'CN' | 'AU' | 'CA';
type EconCategory = 'all' | 'gdp' | 'employment' | 'inflation' | 'rates' | 'manufacturing' | 'housing' | 'consumer';

interface EconomicEvent {
  id: string;
  date: string;
  time: string;
  country: Country;
  event: string;
  impact: Impact;
  actual: string | null;
  forecast: string;
  previous: string;
  category: EconCategory;
}

// --- Mock Data ---

const FLAGS: Record<Country, string> = {
  US: '🇺🇸', EU: '🇪🇺', UK: '🇬🇧', JP: '🇯🇵', CN: '🇨🇳', AU: '🇦🇺', CA: '🇨🇦',
};

const EVENTS: EconomicEvent[] = [
  { id: 'e1', date: '2025-03-03', time: '08:30', country: 'US', event: 'Non-Farm Payrolls', impact: 'high', actual: '275K', forecast: '200K', previous: '229K', category: 'employment' },
  { id: 'e2', date: '2025-03-03', time: '08:30', country: 'US', event: 'Unemployment Rate', impact: 'high', actual: '3.9%', forecast: '3.7%', previous: '3.7%', category: 'employment' },
  { id: 'e3', date: '2025-03-03', time: '10:00', country: 'US', event: 'ISM Manufacturing PMI', impact: 'high', actual: '47.8', forecast: '49.5', previous: '49.1', category: 'manufacturing' },
  { id: 'e4', date: '2025-03-04', time: '05:00', country: 'EU', event: 'CPI (YoY)', impact: 'high', actual: null, forecast: '2.6%', previous: '2.8%', category: 'inflation' },
  { id: 'e5', date: '2025-03-04', time: '08:30', country: 'US', event: 'Trade Balance', impact: 'medium', actual: null, forecast: '-$63.5B', previous: '-$62.2B', category: 'gdp' },
  { id: 'e6', date: '2025-03-05', time: '08:15', country: 'US', event: 'ADP Employment Change', impact: 'medium', actual: null, forecast: '150K', previous: '140K', category: 'employment' },
  { id: 'e7', date: '2025-03-05', time: '10:00', country: 'US', event: 'ISM Services PMI', impact: 'high', actual: null, forecast: '53.0', previous: '53.4', category: 'manufacturing' },
  { id: 'e8', date: '2025-03-05', time: '10:00', country: 'CA', event: 'Bank of Canada Rate', impact: 'high', actual: null, forecast: '5.00%', previous: '5.00%', category: 'rates' },
  { id: 'e9', date: '2025-03-06', time: '07:00', country: 'UK', event: 'GDP (QoQ)', impact: 'high', actual: null, forecast: '0.1%', previous: '-0.1%', category: 'gdp' },
  { id: 'e10', date: '2025-03-06', time: '08:30', country: 'US', event: 'Initial Jobless Claims', impact: 'medium', actual: null, forecast: '215K', previous: '210K', category: 'employment' },
  { id: 'e11', date: '2025-03-07', time: '21:30', country: 'CN', event: 'CPI (YoY)', impact: 'medium', actual: null, forecast: '0.7%', previous: '0.8%', category: 'inflation' },
  { id: 'e12', date: '2025-03-07', time: '05:00', country: 'JP', event: 'GDP (QoQ)', impact: 'high', actual: null, forecast: '0.3%', previous: '0.1%', category: 'gdp' },
];

const CENTRAL_BANKS = [
  { bank: 'Federal Reserve', country: 'US' as Country, rate: 5.50, change: 0, next: 'Mar 20', outlook: 'Hold' },
  { bank: 'ECB', country: 'EU' as Country, rate: 4.50, change: 0, next: 'Mar 07', outlook: 'Cut expected' },
  { bank: 'Bank of England', country: 'UK' as Country, rate: 5.25, change: 0, next: 'Mar 21', outlook: 'Hold' },
  { bank: 'Bank of Japan', country: 'JP' as Country, rate: 0.10, change: 0.10, next: 'Mar 19', outlook: 'Hike bias' },
  { bank: 'PBOC', country: 'CN' as Country, rate: 3.45, change: -0.10, next: 'Mar 15', outlook: 'Easing' },
  { bank: 'RBA', country: 'AU' as Country, rate: 4.35, change: 0, next: 'Apr 02', outlook: 'Hold' },
  { bank: 'Bank of Canada', country: 'CA' as Country, rate: 5.00, change: 0, next: 'Mar 05', outlook: 'Hold' },
];

const GDP_COMPARISON = [
  { country: 'US', q1: 3.2, q2: 2.9, q3: 2.1, q4: 1.8 },
  { country: 'EU', q1: 0.4, q2: 0.3, q3: 0.1, q4: 0.0 },
  { country: 'UK', q1: 0.3, q2: 0.2, q3: -0.1, q4: 0.1 },
  { country: 'JP', q1: 1.2, q2: 0.8, q3: 0.5, q4: 0.3 },
  { country: 'CN', q1: 5.3, q2: 4.7, q3: 4.9, q4: 5.2 },
];

const INFLATION_DATA = Array.from({ length: 12 }, (_, i) => {
  const d = new Date(2024, i, 1);
  return {
    month: d.toLocaleDateString('en', { month: 'short', year: '2-digit' }),
    US: +(3.1 - i * 0.08 + Math.random() * 0.2).toFixed(1),
    EU: +(2.8 - i * 0.06 + Math.random() * 0.15).toFixed(1),
    UK: +(4.0 - i * 0.1 + Math.random() * 0.2).toFixed(1),
    JP: +(2.5 - i * 0.05 + Math.random() * 0.15).toFixed(1),
  };
});

const EMPLOYMENT_DATA = Array.from({ length: 12 }, (_, i) => ({
  month: new Date(2024, i, 1).toLocaleDateString('en', { month: 'short' }),
  nfp: Math.floor(150 + Math.random() * 130),
  unemployment: +(3.5 + Math.sin(i * 0.3) * 0.3 + Math.random() * 0.1).toFixed(1),
}));

// --- Main Component ---

export const EconomicDashboard: React.FC<{ className?: string }> = ({ className = '' }) => {
  const [activeTab, setActiveTab] = useState<'calendar' | 'indicators' | 'rates' | 'gdp' | 'inflation' | 'employment'>('calendar');
  const [countryFilter, setCountryFilter] = useState<Country | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<EconCategory>('all');
  const [impactFilter, setImpactFilter] = useState<Impact | 'all'>('all');

  const filteredEvents = useMemo(() =>
    EVENTS.filter((e) => {
      if (countryFilter !== 'all' && e.country !== countryFilter) return false;
      if (categoryFilter !== 'all' && e.category !== categoryFilter) return false;
      if (impactFilter !== 'all' && e.impact !== impactFilter) return false;
      return true;
    }),
    [countryFilter, categoryFilter, impactFilter]
  );

  const groupedEvents = useMemo(() => {
    const groups: Record<string, EconomicEvent[]> = {};
    filteredEvents.forEach((e) => {
      if (!groups[e.date]) groups[e.date] = [];
      groups[e.date].push(e);
    });
    return groups;
  }, [filteredEvents]);

  const TABS: { key: typeof activeTab; label: string; icon: React.ReactNode }[] = [
    { key: 'calendar', label: 'Calendar', icon: <Calendar size={12} /> },
    { key: 'indicators', label: 'Indicators', icon: <BarChart3 size={12} /> },
    { key: 'rates', label: 'Central Banks', icon: <Landmark size={12} /> },
    { key: 'gdp', label: 'GDP', icon: <TrendingUp size={12} /> },
    { key: 'inflation', label: 'Inflation', icon: <Banknote size={12} /> },
    { key: 'employment', label: 'Employment', icon: <Users size={12} /> },
  ];

  return (
    <div className={`flex flex-col h-full bg-[#0a0a14] text-gray-300 font-mono ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-[#1a1a2e] bg-[#0d0d1a]">
        <Globe size={16} className="text-amber-400" />
        <span className="text-amber-400 font-bold text-sm">Economic Dashboard</span>
        <div className="flex items-center gap-0.5 ml-4 bg-[#0a0a14] rounded p-0.5 overflow-x-auto">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setActiveTab(t.key)} className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded transition-colors whitespace-nowrap ${activeTab === t.key ? 'bg-amber-500/20 text-amber-400' : 'text-gray-500 hover:text-gray-300'}`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <button className="text-gray-500 hover:text-gray-300 p-1"><RefreshCw size={14} /></button>
      </div>

      {/* Filters (for calendar) */}
      {activeTab === 'calendar' && (
        <div className="flex items-center gap-3 px-4 py-1.5 border-b border-[#1a1a2e] bg-[#0c0c18]">
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-gray-500">Country:</span>
            <div className="flex items-center gap-0.5">
              <button onClick={() => setCountryFilter('all')} className={`px-2 py-0.5 text-[10px] rounded ${countryFilter === 'all' ? 'bg-amber-500/20 text-amber-400' : 'text-gray-500 hover:text-gray-300'}`}>All</button>
              {(Object.keys(FLAGS) as Country[]).map((c) => (
                <button key={c} onClick={() => setCountryFilter(c)} className={`px-1.5 py-0.5 text-[10px] rounded ${countryFilter === c ? 'bg-amber-500/20 text-amber-400' : 'text-gray-500 hover:text-gray-300'}`}>
                  {FLAGS[c]} {c}
                </button>
              ))}
            </div>
          </div>
          <div className="h-4 w-px bg-[#1a1a2e]" />
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-gray-500">Impact:</span>
            {(['all', 'high', 'medium', 'low'] as const).map((imp) => (
              <button key={imp} onClick={() => setImpactFilter(imp)} className={`px-2 py-0.5 text-[10px] rounded capitalize ${impactFilter === imp ? 'bg-amber-500/20 text-amber-400' : 'text-gray-500 hover:text-gray-300'}`}>
                {imp === 'all' ? 'All' : imp}
              </button>
            ))}
          </div>
          <div className="h-4 w-px bg-[#1a1a2e]" />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as EconCategory)}
            className="bg-[#12121f] border border-[#1a1a2e] text-gray-300 text-[10px] px-2 py-0.5 rounded focus:outline-none focus:border-amber-500/50"
          >
            <option value="all">All Categories</option>
            <option value="gdp">GDP</option>
            <option value="employment">Employment</option>
            <option value="inflation">Inflation</option>
            <option value="rates">Interest Rates</option>
            <option value="manufacturing">Manufacturing</option>
            <option value="housing">Housing</option>
            <option value="consumer">Consumer</option>
          </select>
        </div>
      )}

      <div className="flex-1 overflow-auto">
        {activeTab === 'calendar' && (
          <div className="p-4 space-y-3">
            {Object.entries(groupedEvents).map(([date, events]) => {
              const d = new Date(date);
              const isToday = date === '2025-03-03';
              return (
                <div key={date}>
                  <div className={`flex items-center gap-2 mb-1.5 ${isToday ? 'text-amber-400' : 'text-gray-500'}`}>
                    <Calendar size={12} />
                    <span className="text-xs font-medium">
                      {d.toLocaleDateString('en', { weekday: 'long', month: 'short', day: 'numeric' })}
                      {isToday && <span className="ml-1.5 px-1 py-0.5 bg-amber-500/20 rounded text-[9px]">TODAY</span>}
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    {events.map((ev) => (
                      <div key={ev.id} className="flex items-center gap-3 px-3 py-2 bg-[#0d0d1a] border border-[#1a1a2e] rounded hover:border-amber-900/30 transition-colors">
                        <span className="text-[10px] text-gray-600 w-10">{ev.time}</span>
                        <span className="text-xs">{FLAGS[ev.country]}</span>
                        <div className={`w-1.5 h-1.5 rounded-full ${ev.impact === 'high' ? 'bg-[#ff3333]' : ev.impact === 'medium' ? 'bg-[#ff9900]' : 'bg-gray-600'}`} title={ev.impact} />
                        <span className="text-xs text-gray-300 flex-1">{ev.event}</span>
                        <div className="flex items-center gap-4 text-xs">
                          <div className="w-16 text-right">
                            {ev.actual ? (
                              <span className={
                                ev.actual > ev.forecast ? 'text-[#00cc66] font-medium' :
                                ev.actual < ev.forecast ? 'text-[#ff3333] font-medium' : 'text-gray-300'
                              }>{ev.actual}</span>
                            ) : (
                              <span className="text-gray-600">—</span>
                            )}
                          </div>
                          <div className="w-16 text-right text-gray-500">{ev.forecast}</div>
                          <div className="w-16 text-right text-gray-600">{ev.previous}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Column Headers Legend */}
            <div className="flex items-center gap-3 px-3 py-1 text-[9px] text-gray-600 justify-end">
              <span className="w-16 text-right">Actual</span>
              <span className="w-16 text-right">Forecast</span>
              <span className="w-16 text-right">Previous</span>
            </div>
          </div>
        )}

        {activeTab === 'rates' && (
          <div className="p-4">
            <div className="bg-[#0d0d1a] border border-[#1a1a2e] rounded-lg">
              <div className="px-3 py-2 border-b border-[#1a1a2e]">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider">Central Bank Rate Tracker</span>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#1a1a2e]">
                    <th className="px-3 py-2 text-left text-gray-500 font-medium">Central Bank</th>
                    <th className="px-3 py-2 text-right text-gray-500 font-medium">Rate</th>
                    <th className="px-3 py-2 text-right text-gray-500 font-medium">Last Change</th>
                    <th className="px-3 py-2 text-center text-gray-500 font-medium">Next Meeting</th>
                    <th className="px-3 py-2 text-left text-gray-500 font-medium">Outlook</th>
                  </tr>
                </thead>
                <tbody>
                  {CENTRAL_BANKS.map((cb) => (
                    <tr key={cb.bank} className="border-b border-[#1a1a2e]/30 hover:bg-[#12121f]">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span>{FLAGS[cb.country]}</span>
                          <span className="text-gray-300">{cb.bank}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right text-amber-400 font-bold">{cb.rate.toFixed(2)}%</td>
                      <td className={`px-3 py-2 text-right font-medium ${cb.change > 0 ? 'text-[#ff3333]' : cb.change < 0 ? 'text-[#00cc66]' : 'text-gray-600'}`}>
                        {cb.change > 0 ? '+' : ''}{cb.change === 0 ? 'Unch' : `${cb.change.toFixed(2)}%`}
                      </td>
                      <td className="px-3 py-2 text-center text-gray-400">{cb.next}</td>
                      <td className="px-3 py-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                          cb.outlook.includes('Cut') ? 'bg-[#00cc66]/20 text-[#00cc66]' :
                          cb.outlook.includes('Hike') ? 'bg-[#ff3333]/20 text-[#ff3333]' :
                          cb.outlook.includes('Easing') ? 'bg-[#6699ff]/20 text-[#6699ff]' :
                          'bg-[#1a1a2e] text-gray-400'
                        }`}>
                          {cb.outlook}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'gdp' && (
          <div className="p-4 space-y-4">
            <div className="bg-[#0d0d1a] border border-[#1a1a2e] rounded-lg p-3">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">GDP Growth (QoQ Annualized) — 2024</div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={GDP_COMPARISON} margin={{ left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2e" />
                    <XAxis dataKey="country" tick={{ fill: '#999', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#666', fontSize: 10 }} tickFormatter={(v: number) => `${v}%`} />
                    <Tooltip contentStyle={{ background: '#0d0d1a', border: '1px solid #1a1a2e', borderRadius: 4, fontSize: 11, color: '#ccc' }} formatter={(v: number) => `${v}%`} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <ReferenceLine y={0} stroke="#666" />
                    <Bar dataKey="q1" name="Q1" fill="#6699ff" fillOpacity={0.7} radius={[2, 2, 0, 0]} />
                    <Bar dataKey="q2" name="Q2" fill="#ff9900" fillOpacity={0.7} radius={[2, 2, 0, 0]} />
                    <Bar dataKey="q3" name="Q3" fill="#00cc66" fillOpacity={0.7} radius={[2, 2, 0, 0]} />
                    <Bar dataKey="q4" name="Q4" fill="#cc66ff" fillOpacity={0.7} radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'inflation' && (
          <div className="p-4 space-y-4">
            <div className="bg-[#0d0d1a] border border-[#1a1a2e] rounded-lg p-3">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">CPI YoY — Major Economies</div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={INFLATION_DATA} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2e" />
                    <XAxis dataKey="month" tick={{ fill: '#666', fontSize: 10 }} />
                    <YAxis tick={{ fill: '#666', fontSize: 10 }} tickFormatter={(v: number) => `${v}%`} />
                    <Tooltip contentStyle={{ background: '#0d0d1a', border: '1px solid #1a1a2e', borderRadius: 4, fontSize: 11, color: '#ccc' }} formatter={(v: number) => `${v}%`} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <ReferenceLine y={2} stroke="#ff990080" strokeDasharray="4 2" label={{ value: '2% Target', fill: '#ff9900', fontSize: 10 }} />
                    <Line type="monotone" dataKey="US" stroke="#6699ff" strokeWidth={2} dot={{ r: 2 }} />
                    <Line type="monotone" dataKey="EU" stroke="#ff9900" strokeWidth={2} dot={{ r: 2 }} />
                    <Line type="monotone" dataKey="UK" stroke="#00cc66" strokeWidth={2} dot={{ r: 2 }} />
                    <Line type="monotone" dataKey="JP" stroke="#cc66ff" strokeWidth={2} dot={{ r: 2 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'employment' && (
          <div className="p-4 space-y-4">
            <div className="bg-[#0d0d1a] border border-[#1a1a2e] rounded-lg p-3">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">US Employment — NFP & Unemployment Rate</div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={EMPLOYMENT_DATA} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2e" />
                    <XAxis dataKey="month" tick={{ fill: '#666', fontSize: 10 }} />
                    <YAxis yAxisId="left" tick={{ fill: '#666', fontSize: 10 }} tickFormatter={(v: number) => `${v}K`} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fill: '#666', fontSize: 10 }} tickFormatter={(v: number) => `${v}%`} domain={[3, 4.5]} />
                    <Tooltip contentStyle={{ background: '#0d0d1a', border: '1px solid #1a1a2e', borderRadius: 4, fontSize: 11, color: '#ccc' }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Bar yAxisId="left" dataKey="nfp" name="NFP (K)" fill="#6699ff" fillOpacity={0.6} radius={[2, 2, 0, 0]} />
                    <Line yAxisId="right" type="monotone" dataKey="unemployment" name="Unemp Rate %" stroke="#ff3333" strokeWidth={2} dot={{ r: 3 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'indicators' && (
          <div className="p-4 space-y-3">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider">Key Economic Indicators</div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'US GDP (QoQ)', value: '1.8%', prev: '2.1%', trend: 'down' },
                { label: 'US CPI (YoY)', value: '2.9%', prev: '3.1%', trend: 'down' },
                { label: 'Core PCE', value: '2.8%', prev: '2.9%', trend: 'down' },
                { label: 'Unemployment', value: '3.9%', prev: '3.7%', trend: 'up' },
                { label: 'ISM Mfg PMI', value: '47.8', prev: '49.1', trend: 'down' },
                { label: 'ISM Svc PMI', value: '53.4', prev: '52.7', trend: 'up' },
                { label: 'Retail Sales (MoM)', value: '0.6%', prev: '-0.8%', trend: 'up' },
                { label: 'Housing Starts', value: '1.33M', prev: '1.46M', trend: 'down' },
                { label: 'Consumer Confidence', value: '106.7', prev: '110.9', trend: 'down' },
              ].map((ind) => (
                <div key={ind.label} className="bg-[#0d0d1a] border border-[#1a1a2e] rounded-lg p-3">
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider">{ind.label}</div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-lg font-bold text-gray-200">{ind.value}</span>
                    <div className="flex items-center gap-1">
                      {ind.trend === 'up' ? <TrendingUp size={12} className="text-[#00cc66]" /> : <TrendingDown size={12} className="text-[#ff3333]" />}
                      <span className="text-[10px] text-gray-500">prev: {ind.prev}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EconomicDashboard;
