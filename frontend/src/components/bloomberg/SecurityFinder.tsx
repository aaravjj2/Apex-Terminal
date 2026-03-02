import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────

type AssetClass = 'Equity' | 'Bond' | 'FX' | 'Commodity' | 'Index' | 'Fund';

interface Security {
  ticker: string;
  name: string;
  assetClass: AssetClass;
  exchange: string;
  cusip?: string;
  isin?: string;
  sedol?: string;
  currency: string;
  country: string;
  sector?: string;
  marketCap?: number;
  lastPrice?: number;
  change?: number;
  changePct?: number;
}

interface SecurityFinderProps {
  onSelect?: (security: Security) => void;
  className?: string;
}

// ─── Mock Data ──────────────────────────────────────────────────────────────

const MOCK_SECURITIES: Security[] = [
  { ticker: 'AAPL US', name: 'Apple Inc', assetClass: 'Equity', exchange: 'NASDAQ', cusip: '037833100', isin: 'US0378331005', sedol: '2046251', currency: 'USD', country: 'US', sector: 'Technology', marketCap: 3200000, lastPrice: 189.84, change: 2.31, changePct: 1.23 },
  { ticker: 'MSFT US', name: 'Microsoft Corp', assetClass: 'Equity', exchange: 'NASDAQ', cusip: '594918104', isin: 'US5949181045', currency: 'USD', country: 'US', sector: 'Technology', marketCap: 2800000, lastPrice: 378.91, change: -1.22, changePct: -0.32 },
  { ticker: 'GOOGL US', name: 'Alphabet Inc Cl A', assetClass: 'Equity', exchange: 'NASDAQ', isin: 'US02079K3059', currency: 'USD', country: 'US', sector: 'Technology', marketCap: 1900000, lastPrice: 141.80, change: 0.95, changePct: 0.67 },
  { ticker: 'AMZN US', name: 'Amazon.com Inc', assetClass: 'Equity', exchange: 'NASDAQ', isin: 'US0231351067', currency: 'USD', country: 'US', sector: 'Consumer', marketCap: 1600000, lastPrice: 178.25, change: 3.11, changePct: 1.78 },
  { ticker: 'TSLA US', name: 'Tesla Inc', assetClass: 'Equity', exchange: 'NASDAQ', currency: 'USD', country: 'US', sector: 'Auto', marketCap: 780000, lastPrice: 248.42, change: -5.18, changePct: -2.04 },
  { ticker: 'JPM US', name: 'JPMorgan Chase & Co', assetClass: 'Equity', exchange: 'NYSE', cusip: '46625H100', isin: 'US46625H1005', currency: 'USD', country: 'US', sector: 'Financials', marketCap: 520000, lastPrice: 196.21, change: 1.05, changePct: 0.54 },
  { ticker: 'NVDA US', name: 'NVIDIA Corp', assetClass: 'Equity', exchange: 'NASDAQ', currency: 'USD', country: 'US', sector: 'Technology', marketCap: 3100000, lastPrice: 878.36, change: 12.44, changePct: 1.44 },
  { ticker: 'VOD LN', name: 'Vodafone Group PLC', assetClass: 'Equity', exchange: 'LSE', isin: 'GB00BH4HKS39', sedol: 'BH4HKS3', currency: 'GBP', country: 'GB', sector: 'Telecom', marketCap: 22000, lastPrice: 72.46, change: -0.34, changePct: -0.47 },
  { ticker: 'EURUSD Curncy', name: 'EUR/USD Spot', assetClass: 'FX', exchange: 'FX', currency: 'USD', country: 'GL', lastPrice: 1.0862, change: 0.0023, changePct: 0.21 },
  { ticker: 'GBPUSD Curncy', name: 'GBP/USD Spot', assetClass: 'FX', exchange: 'FX', currency: 'USD', country: 'GL', lastPrice: 1.2654, change: -0.0011, changePct: -0.09 },
  { ticker: 'USDJPY Curncy', name: 'USD/JPY Spot', assetClass: 'FX', exchange: 'FX', currency: 'JPY', country: 'GL', lastPrice: 150.23, change: 0.45, changePct: 0.30 },
  { ticker: 'CL1 Comdty', name: 'WTI Crude Oil Future', assetClass: 'Commodity', exchange: 'NYMEX', currency: 'USD', country: 'US', lastPrice: 78.42, change: -0.88, changePct: -1.11 },
  { ticker: 'GC1 Comdty', name: 'Gold 100 OZ Future', assetClass: 'Commodity', exchange: 'COMEX', currency: 'USD', country: 'US', lastPrice: 2034.50, change: 8.30, changePct: 0.41 },
  { ticker: 'SPX Index', name: 'S&P 500 Index', assetClass: 'Index', exchange: 'US', currency: 'USD', country: 'US', lastPrice: 5029.73, change: 22.07, changePct: 0.44 },
  { ticker: 'NDX Index', name: 'Nasdaq 100 Index', assetClass: 'Index', exchange: 'US', currency: 'USD', country: 'US', lastPrice: 17874.55, change: 95.32, changePct: 0.54 },
  { ticker: 'T 4.5 11/15/33', name: 'US Treasury 4.5% 2033', assetClass: 'Bond', exchange: 'GOVT', cusip: '91282CJL6', isin: 'US91282CJL63', currency: 'USD', country: 'US', lastPrice: 101.25, change: 0.125, changePct: 0.12 },
  { ticker: 'SPY US', name: 'SPDR S&P 500 ETF', assetClass: 'Fund', exchange: 'NYSE ARCA', cusip: '78462F103', isin: 'US78462F1030', currency: 'USD', country: 'US', marketCap: 480000, lastPrice: 502.65, change: 2.18, changePct: 0.44 },
  { ticker: 'QQQ US', name: 'Invesco QQQ Trust', assetClass: 'Fund', exchange: 'NASDAQ', currency: 'USD', country: 'US', marketCap: 230000, lastPrice: 435.22, change: 3.01, changePct: 0.70 },
];

const ASSET_CLASSES: AssetClass[] = ['Equity', 'Bond', 'FX', 'Commodity', 'Index', 'Fund'];

const EXCHANGES = ['ALL', 'NASDAQ', 'NYSE', 'LSE', 'FX', 'NYMEX', 'COMEX', 'GOVT', 'NYSE ARCA'];

// ─── Helpers ────────────────────────────────────────────────────────────────

function fuzzyScore(query: string, target: string): number {
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  if (t.includes(q)) return 100;
  if (t.startsWith(q)) return 90;
  let score = 0;
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) { score += 10; qi++; }
  }
  return qi === q.length ? score : 0;
}

function formatMarketCap(mc?: number): string {
  if (!mc) return '—';
  if (mc >= 1000000) return `$${(mc / 1000000).toFixed(1)}T`;
  if (mc >= 1000) return `$${(mc / 1000).toFixed(0)}B`;
  return `$${mc}M`;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function SecurityFinder({ onSelect, className = '' }: SecurityFinderProps) {
  const [query, setQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState<AssetClass | 'All'>('All');
  const [selectedExchange, setSelectedExchange] = useState('ALL');
  const [recentSearches, setRecentSearches] = useState<Security[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set(['AAPL US', 'SPX Index']));
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [previewSecurity, setPreviewSecurity] = useState<Security | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    let filtered = MOCK_SECURITIES;

    if (selectedClass !== 'All') {
      filtered = filtered.filter(s => s.assetClass === selectedClass);
    }
    if (selectedExchange !== 'ALL') {
      filtered = filtered.filter(s => s.exchange === selectedExchange);
    }
    if (!query.trim()) return filtered;

    const q = query.trim();
    return filtered
      .map(s => {
        const tickerScore = fuzzyScore(q, s.ticker);
        const nameScore = fuzzyScore(q, s.name) * 0.8;
        const cusipScore = s.cusip ? fuzzyScore(q, s.cusip) * 0.9 : 0;
        const isinScore = s.isin ? fuzzyScore(q, s.isin) * 0.9 : 0;
        const sedolScore = s.sedol ? fuzzyScore(q, s.sedol) * 0.9 : 0;
        const maxScore = Math.max(tickerScore, nameScore, cusipScore, isinScore, sedolScore);
        return { security: s, score: maxScore };
      })
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(r => r.security);
  }, [query, selectedClass, selectedExchange]);

  const groupedResults = useMemo(() => {
    const groups: Record<string, Security[]> = {};
    results.forEach(s => {
      const key = s.assetClass;
      if (!groups[key]) groups[key] = [];
      groups[key].push(s);
    });
    return groups;
  }, [results]);

  useEffect(() => {
    setSelectedIdx(0);
  }, [query, selectedClass, selectedExchange]);

  useEffect(() => {
    if (results[selectedIdx]) {
      setPreviewSecurity(results[selectedIdx]);
    }
  }, [selectedIdx, results]);

  const handleSelect = useCallback((sec: Security) => {
    setRecentSearches(prev => {
      const filtered = prev.filter(s => s.ticker !== sec.ticker);
      return [sec, ...filtered].slice(0, 10);
    });
    onSelect?.(sec);
  }, [onSelect]);

  const toggleFavorite = useCallback((ticker: string) => {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(ticker)) next.delete(ticker);
      else next.add(ticker);
      return next;
    });
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx(prev => Math.min(prev + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIdx]) {
      handleSelect(results[selectedIdx]);
    }
  }, [results, selectedIdx, handleSelect]);

  const assetClassColor: Record<AssetClass, string> = {
    Equity: 'text-[#ff9900]',
    Bond: 'text-[#6699ff]',
    FX: 'text-[#00cc66]',
    Commodity: 'text-[#cc6600]',
    Index: 'text-[#cc66ff]',
    Fund: 'text-[#66cccc]',
  };

  return (
    <div className={`bg-[#0a0a14] border border-[#1a1a2e] font-mono flex flex-col h-full ${className}`}>
      {/* Header */}
      <div className="px-3 py-2 border-b border-[#1a1a2e] bg-[#0f0f1e]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[#ff9900] font-bold text-xs tracking-wider">SECF &lt;GO&gt;</span>
          <span className="text-[#555] text-[10px]">{results.length} securities</span>
        </div>
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search by ticker, name, CUSIP, ISIN, SEDOL..."
          className="w-full bg-[#0a0a14] border border-[#1a1a2e] text-[#ff9900] text-sm px-3 py-1.5 rounded outline-none focus:border-[#ff9900]/40 placeholder-[#333] caret-[#ff9900]"
          spellCheck={false}
        />
      </div>

      {/* Filters */}
      <div className="px-3 py-1.5 border-b border-[#1a1a2e] flex flex-col gap-1.5">
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-[#555] w-10">CLASS</span>
          <button
            onClick={() => setSelectedClass('All')}
            className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
              selectedClass === 'All' ? 'bg-[#ff9900]/20 text-[#ff9900]' : 'text-[#555] hover:text-[#888]'
            }`}
          >ALL</button>
          {ASSET_CLASSES.map(ac => (
            <button
              key={ac}
              onClick={() => setSelectedClass(ac)}
              className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
                selectedClass === ac ? 'bg-[#ff9900]/20 text-[#ff9900]' : 'text-[#555] hover:text-[#888]'
              }`}
            >{ac}</button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-[#555] w-10">EXCH</span>
          {EXCHANGES.map(ex => (
            <button
              key={ex}
              onClick={() => setSelectedExchange(ex)}
              className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
                selectedExchange === ex ? 'bg-[#6699ff]/20 text-[#6699ff]' : 'text-[#555] hover:text-[#888]'
              }`}
            >{ex}</button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 min-h-0">
        {/* Results */}
        <div ref={listRef} className="flex-1 overflow-y-auto">
          {query.trim() === '' && recentSearches.length > 0 && (
            <div className="px-3 py-2 border-b border-[#1a1a2e]">
              <div className="text-[10px] text-[#555] mb-1 tracking-wider">RECENT SEARCHES</div>
              {recentSearches.map(s => (
                <button
                  key={`recent-${s.ticker}`}
                  onClick={() => handleSelect(s)}
                  className="w-full flex items-center gap-2 px-2 py-1 text-left hover:bg-[#111122] rounded transition-colors"
                >
                  <span className={`text-xs ${assetClassColor[s.assetClass]}`}>{s.ticker}</span>
                  <span className="text-[#666] text-[10px] truncate">{s.name}</span>
                </button>
              ))}
            </div>
          )}

          {query.trim() === '' && favorites.size > 0 && (
            <div className="px-3 py-2 border-b border-[#1a1a2e]">
              <div className="text-[10px] text-[#555] mb-1 tracking-wider">FAVORITES</div>
              {MOCK_SECURITIES.filter(s => favorites.has(s.ticker)).map(s => (
                <button
                  key={`fav-${s.ticker}`}
                  onClick={() => handleSelect(s)}
                  className="w-full flex items-center gap-2 px-2 py-1 text-left hover:bg-[#111122] rounded transition-colors"
                >
                  <span className="text-[#ff9900] text-[10px]">★</span>
                  <span className={`text-xs ${assetClassColor[s.assetClass]}`}>{s.ticker}</span>
                  <span className="text-[#666] text-[10px] truncate">{s.name}</span>
                </button>
              ))}
            </div>
          )}

          {Object.entries(groupedResults).map(([cls, secs]) => (
            <div key={cls}>
              <div className="px-3 py-1 bg-[#0f0f1e] text-[10px] text-[#555] tracking-wider sticky top-0">
                {cls.toUpperCase()} ({secs.length})
              </div>
              {secs.map((s, i) => {
                const flatIdx = results.indexOf(s);
                return (
                  <button
                    key={s.ticker}
                    onClick={() => handleSelect(s)}
                    onMouseEnter={() => { setSelectedIdx(flatIdx); setPreviewSecurity(s); }}
                    className={`w-full grid grid-cols-[140px_1fr_80px_70px_60px] items-center gap-1 px-3 py-1 text-left transition-colors ${
                      flatIdx === selectedIdx ? 'bg-[#1a1a2e]' : 'hover:bg-[#111122]'
                    }`}
                  >
                    <span className={`text-xs font-bold ${assetClassColor[s.assetClass]}`}>{s.ticker}</span>
                    <span className="text-[#999] text-[11px] truncate">{s.name}</span>
                    <span className="text-[#ccc] text-xs text-right">{s.lastPrice?.toFixed(2)}</span>
                    <span className={`text-xs text-right ${(s.change ?? 0) >= 0 ? 'text-[#00cc66]' : 'text-[#ff3333]'}`}>
                      {(s.change ?? 0) >= 0 ? '+' : ''}{s.change?.toFixed(2)}
                    </span>
                    <button
                      onClick={e => { e.stopPropagation(); toggleFavorite(s.ticker); }}
                      className={`text-right text-xs ${favorites.has(s.ticker) ? 'text-[#ff9900]' : 'text-[#333] hover:text-[#666]'}`}
                    >
                      {favorites.has(s.ticker) ? '★' : '☆'}
                    </button>
                  </button>
                );
              })}
            </div>
          ))}

          {results.length === 0 && query.trim() !== '' && (
            <div className="flex items-center justify-center py-12 text-[#555] text-sm">
              No securities match "{query}"
            </div>
          )}
        </div>

        {/* Preview Panel */}
        {previewSecurity && (
          <div className="w-64 border-l border-[#1a1a2e] p-3 overflow-y-auto">
            <div className="text-[#ff9900] font-bold text-sm mb-1">{previewSecurity.ticker}</div>
            <div className="text-[#999] text-xs mb-3">{previewSecurity.name}</div>

            <div className="space-y-2 text-[11px]">
              <Row label="Asset Class" value={previewSecurity.assetClass} />
              <Row label="Exchange" value={previewSecurity.exchange} />
              <Row label="Currency" value={previewSecurity.currency} />
              <Row label="Country" value={previewSecurity.country} />
              {previewSecurity.sector && <Row label="Sector" value={previewSecurity.sector} />}
              {previewSecurity.marketCap && <Row label="Market Cap" value={formatMarketCap(previewSecurity.marketCap)} />}
              {previewSecurity.cusip && <Row label="CUSIP" value={previewSecurity.cusip} />}
              {previewSecurity.isin && <Row label="ISIN" value={previewSecurity.isin} />}
              {previewSecurity.sedol && <Row label="SEDOL" value={previewSecurity.sedol} />}

              <div className="border-t border-[#1a1a2e] pt-2 mt-2">
                <div className="flex items-center justify-between">
                  <span className="text-[#555]">Last</span>
                  <span className="text-[#ccc] font-bold">{previewSecurity.lastPrice?.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#555]">Change</span>
                  <span className={`font-bold ${(previewSecurity.change ?? 0) >= 0 ? 'text-[#00cc66]' : 'text-[#ff3333]'}`}>
                    {(previewSecurity.change ?? 0) >= 0 ? '+' : ''}{previewSecurity.change?.toFixed(2)} ({previewSecurity.changePct?.toFixed(2)}%)
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => previewSecurity && handleSelect(previewSecurity)}
              className="w-full mt-4 py-1.5 bg-[#ff9900]/20 text-[#ff9900] text-xs rounded hover:bg-[#ff9900]/30 transition-colors"
            >
              SELECT &lt;GO&gt;
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[#555]">{label}</span>
      <span className="text-[#ccc]">{value}</span>
    </div>
  );
}
