import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────

type AssetCategory = 'EQUITY' | 'FI' | 'CRNCY' | 'CMDTY' | 'INDEX' | 'GOVT';

interface CommandEntry {
  id: string;
  raw: string;
  parsed: ParsedCommand | null;
  timestamp: number;
}

interface ParsedCommand {
  symbol?: string;
  category?: AssetCategory;
  function?: string;
  args?: string[];
}

interface Suggestion {
  text: string;
  type: 'security' | 'function' | 'category' | 'recent';
  description: string;
}

interface CommandLineProps {
  onExecute?: (cmd: ParsedCommand) => void;
  onSymbolChange?: (symbol: string, category: AssetCategory) => void;
  linkedPanels?: string[];
  className?: string;
}

// ─── Data ───────────────────────────────────────────────────────────────────

const CATEGORIES: Record<AssetCategory, string> = {
  EQUITY: 'Equity',
  FI: 'Fixed Income',
  CRNCY: 'Currency',
  CMDTY: 'Commodity',
  INDEX: 'Index',
  GOVT: 'Government',
};

const FUNCTIONS: Record<string, { desc: string; cat: string }> = {
  TOP: { desc: 'Top News', cat: 'News' },
  N: { desc: 'News Search', cat: 'News' },
  WEI: { desc: 'World Equity Indices', cat: 'Market' },
  ALLQ: { desc: 'All Quotes', cat: 'Pricing' },
  FA: { desc: 'Financial Analysis', cat: 'Fundamental' },
  DES: { desc: 'Description', cat: 'Reference' },
  GP: { desc: 'Graph/Price Chart', cat: 'Chart' },
  COMP: { desc: 'Comparative Returns', cat: 'Chart' },
  ERN: { desc: 'Earnings Analysis', cat: 'Fundamental' },
  PORT: { desc: 'Portfolio Analytics', cat: 'Portfolio' },
  MARS: { desc: 'Multi-Asset Risk System', cat: 'Risk' },
  OMON: { desc: 'Option Monitor', cat: 'Derivatives' },
  OVME: { desc: 'Option Valuation', cat: 'Derivatives' },
  BQL: { desc: 'Bloomberg Query Language', cat: 'Data' },
  ANR: { desc: 'Analyst Recommendations', cat: 'Research' },
  DVD: { desc: 'Dividend Calendar', cat: 'Corporate' },
  RV: { desc: 'Relative Value', cat: 'Analysis' },
  YAS: { desc: 'Yield & Spread Analysis', cat: 'Fixed Income' },
  FIHB: { desc: 'FI Heatmap', cat: 'Fixed Income' },
  SRCH: { desc: 'Security Search', cat: 'Reference' },
  SECF: { desc: 'Security Finder', cat: 'Reference' },
  CACS: { desc: 'Corporate Actions', cat: 'Corporate' },
  GIP: { desc: 'Intraday Graph', cat: 'Chart' },
  HP: { desc: 'Historical Prices', cat: 'Pricing' },
  BETA: { desc: 'Beta Analysis', cat: 'Risk' },
  HRA: { desc: 'Historical Regression', cat: 'Analysis' },
  TRA: { desc: 'Transaction Cost Analysis', cat: 'Trading' },
  VWAP: { desc: 'Volume Weighted Avg Price', cat: 'Trading' },
};

const MOCK_SECURITIES = [
  { ticker: 'AAPL', name: 'Apple Inc', cat: 'EQUITY' as AssetCategory, exchange: 'US' },
  { ticker: 'MSFT', name: 'Microsoft Corp', cat: 'EQUITY' as AssetCategory, exchange: 'US' },
  { ticker: 'GOOGL', name: 'Alphabet Inc', cat: 'EQUITY' as AssetCategory, exchange: 'US' },
  { ticker: 'AMZN', name: 'Amazon.com Inc', cat: 'EQUITY' as AssetCategory, exchange: 'US' },
  { ticker: 'TSLA', name: 'Tesla Inc', cat: 'EQUITY' as AssetCategory, exchange: 'US' },
  { ticker: 'JPM', name: 'JPMorgan Chase', cat: 'EQUITY' as AssetCategory, exchange: 'US' },
  { ticker: 'EURUSD', name: 'Euro/US Dollar', cat: 'CRNCY' as AssetCategory, exchange: 'FX' },
  { ticker: 'GBPUSD', name: 'British Pound/USD', cat: 'CRNCY' as AssetCategory, exchange: 'FX' },
  { ticker: 'USDJPY', name: 'US Dollar/Yen', cat: 'CRNCY' as AssetCategory, exchange: 'FX' },
  { ticker: 'CL1', name: 'WTI Crude Oil Future', cat: 'CMDTY' as AssetCategory, exchange: 'CME' },
  { ticker: 'GC1', name: 'Gold Future', cat: 'CMDTY' as AssetCategory, exchange: 'CME' },
  { ticker: 'SPX', name: 'S&P 500 Index', cat: 'INDEX' as AssetCategory, exchange: 'US' },
  { ticker: 'NDX', name: 'Nasdaq 100 Index', cat: 'INDEX' as AssetCategory, exchange: 'US' },
  { ticker: 'US10Y', name: 'US 10Y Treasury', cat: 'GOVT' as AssetCategory, exchange: 'GOVT' },
  { ticker: 'US2Y', name: 'US 2Y Treasury', cat: 'GOVT' as AssetCategory, exchange: 'GOVT' },
  { ticker: 'NVDA', name: 'NVIDIA Corp', cat: 'EQUITY' as AssetCategory, exchange: 'US' },
  { ticker: 'META', name: 'Meta Platforms', cat: 'EQUITY' as AssetCategory, exchange: 'US' },
  { ticker: 'BRK/B', name: 'Berkshire Hathaway B', cat: 'EQUITY' as AssetCategory, exchange: 'US' },
];

const FAVORITES = ['AAPL EQUITY GP', 'SPX INDEX DES', 'TOP', 'PORT'];

const SHORTCUTS: Record<string, string> = {
  'F1': 'Help',
  'F5': 'TOP',
  'F6': 'PORT',
  'F7': 'GP',
  'F8': 'FA',
  'F9': 'N',
  'F10': 'SRCH',
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function fuzzyMatch(input: string, target: string): boolean {
  const lower = input.toLowerCase();
  const t = target.toLowerCase();
  let j = 0;
  for (let i = 0; i < t.length && j < lower.length; i++) {
    if (t[i] === lower[j]) j++;
  }
  return j === lower.length;
}

function parseCommand(raw: string): ParsedCommand | null {
  const parts = raw.trim().toUpperCase().split(/\s+/);
  if (parts.length === 0 || parts[0] === '') return null;

  if (parts.length === 1) {
    if (FUNCTIONS[parts[0]]) return { function: parts[0] };
    const sec = MOCK_SECURITIES.find(s => s.ticker === parts[0]);
    if (sec) return { symbol: sec.ticker, category: sec.cat };
    return { function: parts[0] };
  }

  if (parts.length === 2) {
    const cat = parts[1] as AssetCategory;
    if (CATEGORIES[cat]) return { symbol: parts[0], category: cat };
    if (FUNCTIONS[parts[1]]) return { symbol: parts[0], function: parts[1] };
    return { symbol: parts[0], args: [parts[1]] };
  }

  const cat = parts[1] as AssetCategory;
  if (CATEGORIES[cat]) {
    return {
      symbol: parts[0],
      category: cat,
      function: parts[2],
      args: parts.slice(3),
    };
  }

  return {
    symbol: parts[0],
    function: parts[1],
    args: parts.slice(2),
  };
}

let cmdId = 0;

// ─── Component ──────────────────────────────────────────────────────────────

export default function CommandLine({
  onExecute,
  onSymbolChange,
  className = '',
}: CommandLineProps) {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<CommandEntry[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showRecent, setShowRecent] = useState(false);
  const [showFavorites, setShowFavorites] = useState(false);
  const [activeCategory, setActiveCategory] = useState<AssetCategory | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const buildSuggestions = useCallback((query: string): Suggestion[] => {
    if (!query.trim()) return [];
    const q = query.toUpperCase();
    const results: Suggestion[] = [];

    MOCK_SECURITIES.forEach(s => {
      if (
        s.ticker.startsWith(q) ||
        s.name.toUpperCase().includes(q) ||
        fuzzyMatch(q, s.ticker)
      ) {
        results.push({
          text: `${s.ticker} ${s.cat}`,
          type: 'security',
          description: `${s.name} (${s.exchange})`,
        });
      }
    });

    Object.entries(FUNCTIONS).forEach(([key, val]) => {
      if (key.startsWith(q) || val.desc.toUpperCase().includes(q) || fuzzyMatch(q, key)) {
        results.push({
          text: key,
          type: 'function',
          description: `${val.desc} [${val.cat}]`,
        });
      }
    });

    Object.entries(CATEGORIES).forEach(([key, val]) => {
      if (key.startsWith(q) || val.toUpperCase().includes(q)) {
        results.push({ text: key, type: 'category', description: val });
      }
    });

    history.slice(0, 5).forEach(h => {
      if (h.raw.toUpperCase().includes(q)) {
        results.push({ text: h.raw, type: 'recent', description: 'Recent' });
      }
    });

    return results.slice(0, 12);
  }, [history]);

  useEffect(() => {
    const s = buildSuggestions(input);
    setSuggestions(s);
    setSelectedSuggestion(0);
    setShowSuggestions(s.length > 0 && input.length > 0);
  }, [input, buildSuggestions]);

  const execute = useCallback((raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    const parsed = parseCommand(trimmed);
    const entry: CommandEntry = {
      id: `cmd-${++cmdId}`,
      raw: trimmed,
      parsed,
      timestamp: Date.now(),
    };
    setHistory(prev => [entry, ...prev]);
    setInput('');
    setHistoryIdx(-1);
    setShowSuggestions(false);
    setShowRecent(false);

    if (parsed) {
      onExecute?.(parsed);
      if (parsed.symbol && parsed.category) {
        onSymbolChange?.(parsed.symbol, parsed.category);
      }
    }
  }, [onExecute, onSymbolChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (showSuggestions && suggestions[selectedSuggestion]) {
        setInput(suggestions[selectedSuggestion].text);
        setShowSuggestions(false);
      } else {
        execute(input);
      }
      e.preventDefault();
      return;
    }

    if (e.key === 'Tab' && showSuggestions && suggestions[selectedSuggestion]) {
      setInput(suggestions[selectedSuggestion].text + ' ');
      setShowSuggestions(false);
      e.preventDefault();
      return;
    }

    if (e.key === 'Escape') {
      setShowSuggestions(false);
      setShowRecent(false);
      setShowFavorites(false);
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (showSuggestions) {
        setSelectedSuggestion(prev => Math.max(0, prev - 1));
      } else {
        setHistoryIdx(prev => {
          const next = Math.min(prev + 1, history.length - 1);
          if (history[next]) setInput(history[next].raw);
          return next;
        });
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (showSuggestions) {
        setSelectedSuggestion(prev => Math.min(suggestions.length - 1, prev + 1));
      } else {
        setHistoryIdx(prev => {
          const next = Math.max(prev - 1, -1);
          if (next === -1) setInput('');
          else if (history[next]) setInput(history[next].raw);
          return next;
        });
      }
      return;
    }

    const fKey = e.key.match(/^F(\d+)$/);
    if (fKey && SHORTCUTS[e.key]) {
      e.preventDefault();
      execute(SHORTCUTS[e.key]);
    }
  }, [input, showSuggestions, suggestions, selectedSuggestion, execute, history]);

  const suggestionTypeColor = useMemo(() => ({
    security: 'text-[#ff9900]',
    function: 'text-[#00cc66]',
    category: 'text-[#6699ff]',
    recent: 'text-[#888]',
  }), []);

  const categoryBadgeColor = useMemo(() => ({
    EQUITY: 'bg-[#ff9900]/20 text-[#ff9900]',
    FI: 'bg-[#6699ff]/20 text-[#6699ff]',
    CRNCY: 'bg-[#00cc66]/20 text-[#00cc66]',
    CMDTY: 'bg-[#cc6600]/20 text-[#cc6600]',
    INDEX: 'bg-[#cc66ff]/20 text-[#cc66ff]',
    GOVT: 'bg-[#66cccc]/20 text-[#66cccc]',
  }), []);

  return (
    <div className={`bg-[#0a0a14] border border-[#1a1a2e] font-mono ${className}`}>
      {/* Header Bar */}
      <div className="flex items-center justify-between px-3 py-1 border-b border-[#1a1a2e] bg-[#0f0f1e]">
        <div className="flex items-center gap-3">
          <span className="text-[#ff9900] font-bold text-xs tracking-wider">BLOOMBERG</span>
          <div className="flex gap-1">
            {(Object.keys(CATEGORIES) as AssetCategory[]).map(cat => (
              <button
                key={cat}
                onClick={() => {
                  setActiveCategory(activeCategory === cat ? null : cat);
                  setInput(cat + ' ');
                  inputRef.current?.focus();
                }}
                className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
                  activeCategory === cat
                    ? categoryBadgeColor[cat]
                    : 'text-[#555] hover:text-[#888] hover:bg-[#1a1a2e]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setShowFavorites(!showFavorites); setShowRecent(false); }}
            className="text-[10px] text-[#666] hover:text-[#ff9900] transition-colors"
            title="Favorites"
          >
            ★ FAV
          </button>
          <button
            onClick={() => { setShowRecent(!showRecent); setShowFavorites(false); }}
            className="text-[10px] text-[#666] hover:text-[#ff9900] transition-colors"
            title="Recent"
          >
            ↻ RCT
          </button>
        </div>
      </div>

      {/* Input */}
      <div className="relative flex items-center">
        <span className="pl-3 text-[#ff9900] text-sm font-bold select-none">&gt;</span>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value.toUpperCase())}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (input) setShowSuggestions(suggestions.length > 0); }}
          placeholder="Enter command (e.g. AAPL EQUITY GP)"
          className="flex-1 bg-transparent text-[#ff9900] text-sm px-2 py-2 outline-none placeholder-[#333] caret-[#ff9900]"
          spellCheck={false}
          autoComplete="off"
        />
        {input && (
          <button
            onClick={() => { setInput(''); inputRef.current?.focus(); }}
            className="pr-3 text-[#555] hover:text-[#ff9900] text-xs"
          >
            ✕
          </button>
        )}
      </div>

      {/* Suggestions Dropdown */}
      {showSuggestions && (
        <div
          ref={suggestionsRef}
          className="border-t border-[#1a1a2e] max-h-64 overflow-y-auto"
        >
          {suggestions.map((s, i) => (
            <button
              key={`${s.text}-${i}`}
              onClick={() => {
                if (s.type === 'security' || s.type === 'recent') {
                  execute(s.text);
                } else {
                  setInput(s.text + ' ');
                  setShowSuggestions(false);
                  inputRef.current?.focus();
                }
              }}
              className={`w-full flex items-center gap-3 px-3 py-1.5 text-left transition-colors ${
                i === selectedSuggestion ? 'bg-[#1a1a2e]' : 'hover:bg-[#111122]'
              }`}
            >
              <span className={`text-[10px] uppercase w-16 ${suggestionTypeColor[s.type]}`}>
                {s.type}
              </span>
              <span className="text-[#ff9900] text-sm font-bold min-w-[100px]">{s.text}</span>
              <span className="text-[#666] text-xs truncate">{s.description}</span>
            </button>
          ))}
        </div>
      )}

      {/* Favorites Panel */}
      {showFavorites && (
        <div className="border-t border-[#1a1a2e] p-2">
          <div className="text-[10px] text-[#555] mb-1 tracking-wider">SPEED DIAL</div>
          <div className="flex flex-wrap gap-1">
            {FAVORITES.map(f => (
              <button
                key={f}
                onClick={() => execute(f)}
                className="px-2 py-1 text-xs text-[#ff9900] bg-[#1a1a2e] rounded hover:bg-[#252540] transition-colors"
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Recent Commands */}
      {showRecent && history.length > 0 && (
        <div className="border-t border-[#1a1a2e] max-h-40 overflow-y-auto">
          <div className="text-[10px] text-[#555] px-3 pt-2 tracking-wider">RECENT</div>
          {history.slice(0, 10).map(h => (
            <button
              key={h.id}
              onClick={() => execute(h.raw)}
              className="w-full flex items-center justify-between px-3 py-1 text-left hover:bg-[#111122] transition-colors"
            >
              <span className="text-[#ff9900] text-xs">{h.raw}</span>
              <span className="text-[#333] text-[10px]">
                {new Date(h.timestamp).toLocaleTimeString()}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Keyboard Shortcuts */}
      <div className="flex items-center gap-3 px-3 py-1 border-t border-[#1a1a2e] overflow-x-auto">
        {Object.entries(SHORTCUTS).map(([key, val]) => (
          <span key={key} className="flex items-center gap-1 whitespace-nowrap">
            <kbd className="text-[9px] bg-[#1a1a2e] text-[#666] px-1 rounded">{key}</kbd>
            <span className="text-[9px] text-[#444]">{val}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
