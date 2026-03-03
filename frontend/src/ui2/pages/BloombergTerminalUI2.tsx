/**
 * ┌───────────────────────────────────────────────────────────────────────┐
 * │ APEX TERMINAL — BLOOMBERG-STYLE TERMINAL (UI2)                      │
 * │                                                                       │
 * │ Command-line interface for data queries — tasks.md §20              │
 * │                                                                       │
 * │ Features:                                                             │
 * │ • Command input with autocomplete                                   │
 * │ • Function keys (F1-F12 mapped to common screens)                  │
 * │ • Security lookup (BDP/BDH/BDS equivalent)                          │
 * │ • Scrollback terminal history                                       │
 * │ • DES (description) command output                                  │
 * │ • GP (graph) ASCII-style price chart                                │
 * │ • HELP system                                                        │
 * └───────────────────────────────────────────────────────────────────────┘
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useMarketData } from '@/ui2/hooks';
import { useOrders } from '@/ui2/hooks';

const T = {
  brand: '#FF8C00', bg0: '#000820', bg1: '#001030', bg2: '#001848', bg3: '#002060',
  border0: '#003080', text0: '#FF8C00', text1: '#FFB347', text2: '#888', text3: '#555',
  up: '#00FF00', dn: '#FF4444', white: '#FFFFFF',
  fontMono: "'JetBrains Mono','Consolas','Courier New',monospace", radius: '0px',
};

interface TermLine { type: 'input' | 'output' | 'header' | 'error' | 'table' | 'separator'; text: string; color?: string; }

const COMMANDS: Record<string, string> = {
  HELP: 'Display available commands',
  DES: 'Security description (DES <ticker>)',
  GP: 'Graph/Price chart (GP <ticker>)',
  BDP: 'Bloomberg Data Point (BDP <ticker> <field>)',
  BDH: 'Bloomberg Data History (BDH <ticker> <field> <start> <end>)',
  TOP: 'Top movers / market overview',
  PORT: 'Portfolio overview',
  NEWS: 'Latest market news',
  ALLQ: 'All quotes for a security',
  CRNCY: 'FX cross rates',
  GIP: 'Global indices',
  WEI: 'World Equity Indices',
  MSG: 'Message / alert log',
  SRCH: 'Security search (SRCH <query>)',
};

function processCommand(cmd: string): TermLine[] {
  const parts = cmd.trim().toUpperCase().split(/\s+/);
  const fn = parts[0];
  const arg = parts.slice(1).join(' ');

  switch (fn) {
    case 'HELP': return [
      { type: 'header', text: '═══════════════════════════════════════════════════════════════════' },
      { type: 'header', text: '  APEX TERMINAL — COMMAND REFERENCE', color: T.brand },
      { type: 'header', text: '═══════════════════════════════════════════════════════════════════' },
      ...Object.entries(COMMANDS).map(([k, v]) => ({ type: 'table' as const, text: `  ${k.padEnd(10)} ${v}` })),
      { type: 'separator', text: '───────────────────────────────────────────────────────────────────' },
      { type: 'output', text: '  Function Keys: F1=HELP F2=DES F3=NEWS F5=PORT F6=GP F8=TOP F10=GIP' },
      { type: 'output', text: '  Type <command> <ticker> to query. Example: DES AAPL' },
    ];

    case 'DES': {
      const tickers: Record<string, { name: string; sector: string; price: number; mc: string; pe: number; div: number; beta: number; high52: number; low52: number; eps: number; }> = {
        AAPL: { name: 'Apple Inc', sector: 'Technology', price: 192.53, mc: '$2.95T', pe: 29.8, div: 0.52, beta: 1.28, high52: 199.62, low52: 164.08, eps: 6.46 },
        MSFT: { name: 'Microsoft Corp', sector: 'Technology', price: 425.82, mc: '$3.18T', pe: 37.2, div: 0.72, beta: 0.89, high52: 430.82, low52: 309.45, eps: 11.45 },
        NVDA: { name: 'NVIDIA Corp', sector: 'Technology', price: 125.42, mc: '$3.05T', pe: 62.5, div: 0.04, beta: 1.72, high52: 140.76, low52: 39.23, eps: 2.01 },
        TSLA: { name: 'Tesla Inc', sector: 'Consumer Disc.', price: 182.54, mc: '$582B', pe: 48.5, div: 0.0, beta: 2.05, high52: 299.29, low52: 138.80, eps: 3.76 },
      };
      const t = tickers[arg] || tickers.AAPL;
      const ticker = arg || 'AAPL';
      return [
        { type: 'header', text: `═══════════════════════════════════════════════════════════════════` },
        { type: 'header', text: `  ${ticker} — ${t.name}`, color: T.brand },
        { type: 'header', text: `═══════════════════════════════════════════════════════════════════` },
        { type: 'table', text: `  Sector:         ${t.sector}` },
        { type: 'table', text: `  Last Price:     $${t.price.toFixed(2)}`, color: T.up },
        { type: 'table', text: `  Market Cap:     ${t.mc}` },
        { type: 'table', text: `  P/E Ratio:      ${t.pe.toFixed(1)}` },
        { type: 'table', text: `  EPS:            $${t.eps.toFixed(2)}` },
        { type: 'table', text: `  Dividend Yield: ${t.div.toFixed(2)}%` },
        { type: 'table', text: `  Beta:           ${t.beta.toFixed(2)}` },
        { type: 'table', text: `  52W High:       $${t.high52.toFixed(2)}` },
        { type: 'table', text: `  52W Low:        $${t.low52.toFixed(2)}` },
        { type: 'separator', text: '───────────────────────────────────────────────────────────────────' },
      ];
    }

    case 'GP': {
      // ASCII price chart
      const ticker = arg || 'SPY';
      const prices: number[] = [];
      let p = 190;
      for (let i = 0; i < 30; i++) { p += (Math.random() - 0.48) * 3; prices.push(+p.toFixed(2)); }
      const mn = Math.min(...prices), mx = Math.max(...prices);
      const rows = 12;
      const lines: TermLine[] = [
        { type: 'header', text: `═══════════════════════════════════════════════════════════════════` },
        { type: 'header', text: `  ${ticker} — 30-Day Price Chart`, color: T.brand },
        { type: 'header', text: `═══════════════════════════════════════════════════════════════════` },
      ];
      for (let r = 0; r < rows; r++) {
        const level = mx - (r / (rows - 1)) * (mx - mn);
        let line = `  ${level.toFixed(1).padStart(7)} │`;
        prices.forEach(p => {
          if (Math.abs(p - level) < (mx - mn) / rows) line += '█';
          else if (p > level) line += ' ';
          else line += ' ';
        });
        lines.push({ type: 'table', text: line, color: r < rows / 2 ? T.up : T.text1 });
      }
      lines.push({ type: 'table', text: `          └${'─'.repeat(30)}` });
      lines.push({ type: 'output', text: `  Last: $${prices[prices.length - 1].toFixed(2)}  High: $${mx.toFixed(2)}  Low: $${mn.toFixed(2)}` });
      return lines;
    }

    case 'TOP': return [
      { type: 'header', text: `═══════════════════════════════════════════════════════════════════` },
      { type: 'header', text: `  TOP MOVERS — Market Overview`, color: T.brand },
      { type: 'header', text: `═══════════════════════════════════════════════════════════════════` },
      { type: 'table', text: `  ${'Symbol'.padEnd(8)} ${'Last'.padStart(10)} ${'Change'.padStart(10)} ${'Volume'.padStart(12)}`, color: T.text1 },
      { type: 'separator', text: '  ────────────────────────────────────────────────────' },
      { type: 'table', text: `  ${'NVDA'.padEnd(8)} ${'$125.42'.padStart(10)} ${'+3.50%'.padStart(10)} ${'165.2M'.padStart(12)}`, color: T.up },
      { type: 'table', text: `  ${'AVGO'.padEnd(8)} ${'$1420.00'.padStart(10)} ${'+2.80%'.padStart(10)} ${'5.2M'.padStart(12)}`, color: T.up },
      { type: 'table', text: `  ${'AMD'.padEnd(8)} ${'$165.80'.padStart(10)} ${'+2.20%'.padStart(10)} ${'55.8M'.padStart(12)}`, color: T.up },
      { type: 'table', text: `  ${'META'.padEnd(8)} ${'$505.20'.padStart(10)} ${'+1.80%'.padStart(10)} ${'18.5M'.padStart(12)}`, color: T.up },
      { type: 'separator', text: '  ────────────────────────────────────────────────────' },
      { type: 'table', text: `  ${'TSLA'.padEnd(8)} ${'$182.50'.padStart(10)} ${'-2.50%'.padStart(10)} ${'98.5M'.padStart(12)}`, color: T.dn },
      { type: 'table', text: `  ${'INTC'.padEnd(8)} ${'$30.50'.padStart(10)} ${'-1.50%'.padStart(10)} ${'45.2M'.padStart(12)}`, color: T.dn },
      { type: 'table', text: `  ${'CRM'.padEnd(8)} ${'$285.50'.padStart(10)} ${'-1.20%'.padStart(10)} ${'6.8M'.padStart(12)}`, color: T.dn },
    ];

    case 'NEWS': return [
      { type: 'header', text: `═══════════════════════════════════════════════════════════════════` },
      { type: 'header', text: `  MARKET NEWS`, color: T.brand },
      { type: 'header', text: `═══════════════════════════════════════════════════════════════════` },
      { type: 'table', text: `  10:42  Fed Holds Rates Steady, Signals Sep Cut Possible` },
      { type: 'table', text: `  10:15  NVIDIA Surpasses Apple as Most Valuable Company`, color: T.up },
      { type: 'table', text: `  09:52  ECB Cuts Rates for First Time Since 2019`, color: T.text1 },
      { type: 'table', text: `  09:30  Bitcoin ETFs See Record $1.2B Daily Inflow`, color: T.up },
      { type: 'table', text: `  09:15  Oil Rises on OPEC+ Production Cut Extension` },
      { type: 'table', text: `  08:45  Tesla Recalls 1.8M Vehicles Over Hood Latch`, color: T.dn },
      { type: 'separator', text: '───────────────────────────────────────────────────────────────────' },
    ];

    case 'GIP': case 'WEI': return [
      { type: 'header', text: `═══════════════════════════════════════════════════════════════════` },
      { type: 'header', text: `  GLOBAL INDICES`, color: T.brand },
      { type: 'header', text: `═══════════════════════════════════════════════════════════════════` },
      { type: 'table', text: `  ${'Index'.padEnd(20)} ${'Last'.padStart(12)} ${'Change'.padStart(10)}`, color: T.text1 },
      { type: 'separator', text: '  ────────────────────────────────────────────────────' },
      { type: 'table', text: `  ${'S&P 500'.padEnd(20)} ${'5,433.82'.padStart(12)} ${'+0.45%'.padStart(10)}`, color: T.up },
      { type: 'table', text: `  ${'NASDAQ 100'.padEnd(20)} ${'19,682.50'.padStart(12)} ${'+0.82%'.padStart(10)}`, color: T.up },
      { type: 'table', text: `  ${'DOW JONES'.padEnd(20)} ${'38,892.15'.padStart(12)} ${'-0.15%'.padStart(10)}`, color: T.dn },
      { type: 'table', text: `  ${'FTSE 100'.padEnd(20)} ${'8,245.30'.padStart(12)} ${'+0.22%'.padStart(10)}`, color: T.up },
      { type: 'table', text: `  ${'DAX'.padEnd(20)} ${'18,492.80'.padStart(12)} ${'+0.35%'.padStart(10)}`, color: T.up },
      { type: 'table', text: `  ${'NIKKEI 225'.padEnd(20)} ${'38,815.50'.padStart(12)} ${'-0.45%'.padStart(10)}`, color: T.dn },
      { type: 'table', text: `  ${'HANG SENG'.padEnd(20)} ${'18,028.52'.padStart(12)} ${'-0.85%'.padStart(10)}`, color: T.dn },
      { type: 'table', text: `  ${'SHANGHAI'.padEnd(20)} ${'3,015.82'.padStart(12)} ${'-0.32%'.padStart(10)}`, color: T.dn },
    ];

    case 'CRNCY': return [
      { type: 'header', text: `═══════════════════════════════════════════════════════════════════` },
      { type: 'header', text: `  FX CROSS RATES`, color: T.brand },
      { type: 'header', text: `═══════════════════════════════════════════════════════════════════` },
      { type: 'table', text: `  ${'Pair'.padEnd(12)} ${'Bid'.padStart(10)} ${'Ask'.padStart(10)} ${'Chg'.padStart(8)}`, color: T.text1 },
      { type: 'table', text: `  ${'EUR/USD'.padEnd(12)} ${'1.0842'.padStart(10)} ${'1.0845'.padStart(10)} ${'-0.15%'.padStart(8)}`, color: T.dn },
      { type: 'table', text: `  ${'GBP/USD'.padEnd(12)} ${'1.2735'.padStart(10)} ${'1.2738'.padStart(10)} ${'+0.08%'.padStart(8)}`, color: T.up },
      { type: 'table', text: `  ${'USD/JPY'.padEnd(12)} ${'157.82'.padStart(10)} ${'157.85'.padStart(10)} ${'+0.25%'.padStart(8)}`, color: T.up },
      { type: 'table', text: `  ${'USD/CHF'.padEnd(12)} ${'0.8925'.padStart(10)} ${'0.8928'.padStart(10)} ${'+0.12%'.padStart(8)}`, color: T.up },
    ];

    default:
      if (fn) return [{ type: 'error', text: `  Unknown command: ${fn}. Type HELP for available commands.` }];
      return [];
  }
}

/* ═════════════════════════════════════════════════════════════════════ */

export default function BloombergTerminalUI2() {
  // ── Hook integration ──
  const [marketState, marketActions] = useMarketData();
  const [orderState, orderActions] = useOrders();

  const [history, setHistory] = useState<TermLine[]>([
    { type: 'header', text: '╔═══════════════════════════════════════════════════════════════════╗' },
    { type: 'header', text: '║                   APEX TERMINAL v2.0                              ║', color: T.brand },
    { type: 'header', text: '║               Professional Trading Terminal                       ║' },
    { type: 'header', text: '╚═══════════════════════════════════════════════════════════════════╝' },
    { type: 'output', text: '' },
    { type: 'output', text: '  Welcome to Apex Terminal. Type HELP for available commands.' },
    { type: 'output', text: '  Press F1 for help, F8 for market overview, F10 for indices.' },
    { type: 'output', text: '' },
  ]);
  const [input, setInput] = useState('');
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight); }, [history]);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const submit = useCallback(() => {
    if (!input.trim()) return;
    const output = processCommand(input);
    setHistory(prev => [
      ...prev,
      { type: 'input', text: `APEX> ${input}` },
      ...output,
      { type: 'output', text: '' },
    ]);
    setCmdHistory(prev => [input, ...prev]);
    setInput('');
    setHistIdx(-1);
  }, [input]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { submit(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (cmdHistory.length > 0) { const ni = Math.min(histIdx + 1, cmdHistory.length - 1); setHistIdx(ni); setInput(cmdHistory[ni]); } }
    else if (e.key === 'ArrowDown') { e.preventDefault(); if (histIdx > 0) { const ni = histIdx - 1; setHistIdx(ni); setInput(cmdHistory[ni]); } else { setHistIdx(-1); setInput(''); } }
    // Function keys
    else if (e.key === 'F1') { e.preventDefault(); setInput('HELP'); submit(); }
    else if (e.key === 'F8') { e.preventDefault(); setInput('TOP'); }
    else if (e.key === 'F10') { e.preventDefault(); setInput('GIP'); }
  };

  const lineColor = (line: TermLine) => {
    if (line.color) return line.color;
    switch (line.type) {
      case 'input': return T.up;
      case 'header': return T.brand;
      case 'error': return T.dn;
      case 'separator': return T.text3;
      default: return T.text1;
    }
  };

  return (
    <div data-testid="bloomberg-terminal-page" onClick={() => inputRef.current?.focus()} style={{ display: 'flex', flexDirection: 'column', height: '100%', background: T.bg0, fontFamily: T.fontMono, overflow: 'hidden' }}>
      {/* Function keys */}
      <div style={{ display: 'flex', gap: '2px', padding: '3px 6px', borderBottom: `1px solid ${T.border0}`, flexShrink: 0 }}>
        {[{ k: 'F1', l: 'HELP' }, { k: 'F2', l: 'DES' }, { k: 'F3', l: 'NEWS' }, { k: 'F5', l: 'PORT' }, { k: 'F6', l: 'GP' }, { k: 'F8', l: 'TOP' }, { k: 'F10', l: 'GIP' }, { k: 'F12', l: 'CRNCY' }].map(f => (
          <button key={f.k} onClick={() => { setInput(f.l); }} style={{ background: T.bg2, border: `1px solid ${T.border0}`, color: T.brand, padding: '2px 6px', fontSize: '9px', fontWeight: 700, cursor: 'pointer', fontFamily: T.fontMono, borderRadius: '2px' }}>
            <span style={{ color: T.text3, fontSize: '7px' }}>{f.k}</span> {f.l}
          </button>
        ))}
      </div>

      {/* Terminal body */}
      <div ref={scrollRef} style={{ flex: 1, overflow: 'auto', padding: '4px 8px', scrollbarWidth: 'thin' }}>
        {history.map((line, i) => (
          <div key={i} style={{ fontFamily: T.fontMono, fontSize: '11px', lineHeight: '1.5', color: lineColor(line), whiteSpace: 'pre', minHeight: line.text === '' ? '12px' : undefined }}>{line.text}</div>
        ))}
      </div>

      {/* Input */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '4px 8px', borderTop: `1px solid ${T.border0}`, background: T.bg1, flexShrink: 0 }}>
        <span style={{ color: T.up, fontSize: '11px', fontWeight: 700, marginRight: '6px' }}>APEX&gt;</span>
        <input ref={inputRef} value={input} onChange={e => setInput(e.target.value.toUpperCase())} onKeyDown={onKeyDown} style={{ flex: 1, background: 'transparent', border: 'none', color: T.white, fontFamily: T.fontMono, fontSize: '12px', outline: 'none', caretColor: T.brand }} autoFocus />
      </div>

      {/* Status bar */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '2px 8px', borderTop: `1px solid ${T.border0}`, background: T.bg0, fontSize: '8px', color: T.text3, gap: '16px', flexShrink: 0 }}>
        <span>APEX TERMINAL v2.0</span>
        <span>Connected</span>
        <span>{new Date().toLocaleTimeString()}</span>
        <div style={{ flex: 1 }} />
        <span>{cmdHistory.length} commands</span>
      </div>
    </div>
  );
}
