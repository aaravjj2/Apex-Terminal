/**
 * StrategyBuilderProUI2 — Visual Strategy Builder
 * Drag/drop condition blocks, code editor, templates, position sizing,
 * stop/take-profit config, multi-timeframe, strategy validation.
 */
import { useState, useMemo, useRef, useEffect } from 'react';

const BG = '#0a0a0a', PANEL = '#111111', BORDER = '#1e1e1e';
const AMBER = '#f5a623', GREEN = '#26a69a', RED = '#ef5350', MUTED = '#888';

/* ─── Types ──────────────────────────────────────────────────────────── */
interface ConditionBlock { id: string; type: 'entry' | 'exit' | 'filter'; indicator: string; operator: string; value: string; timeframe: string; enabled: boolean }
interface StrategyTemplate { name: string; category: string; description: string; winRate: number; sharpe: number; blocks: Omit<ConditionBlock, 'id' | 'enabled'>[] }
interface ValidationError { severity: 'error' | 'warning'; message: string; blockId?: string }
interface SizeRule { method: string; value: number }

/* ─── Indicators ─────────────────────────────────────────────────────── */
const INDICATORS = [
  'SMA', 'EMA', 'WMA', 'DEMA', 'TEMA', 'RSI', 'MACD', 'MACD Signal', 'MACD Histogram',
  'Stochastic %K', 'Stochastic %D', 'Bollinger Upper', 'Bollinger Lower', 'Bollinger Mid',
  'ATR', 'ADX', 'CCI', 'Williams %R', 'MFI', 'OBV', 'VWAP', 'Pivot High', 'Pivot Low',
  'Price', 'Close', 'Open', 'High', 'Low', 'Volume', 'ROC', 'Momentum',
];
const OPERATORS = ['crosses above', 'crosses below', '>', '<', '>=', '<=', '==', 'increases', 'decreases'];
const TIMEFRAMES = ['1m', '5m', '15m', '30m', '1H', '4H', '1D', '1W', '1M'];

/* ─── Templates ──────────────────────────────────────────────────────── */
const TEMPLATES: StrategyTemplate[] = [
  { name: 'Golden Cross', category: 'Trend', description: 'SMA 50 crosses above SMA 200', winRate: 0.54, sharpe: 0.82,
    blocks: [
      { type: 'entry', indicator: 'SMA', operator: 'crosses above', value: 'SMA(200)', timeframe: '1D' },
      { type: 'exit', indicator: 'SMA', operator: 'crosses below', value: 'SMA(200)', timeframe: '1D' },
      { type: 'filter', indicator: 'Volume', operator: '>', value: 'SMA(vol,20)', timeframe: '1D' },
    ]
  },
  { name: 'RSI Reversal', category: 'Mean Reversion', description: 'Buy oversold RSI, sell overbought', winRate: 0.61, sharpe: 0.95,
    blocks: [
      { type: 'entry', indicator: 'RSI', operator: '<', value: '30', timeframe: '1D' },
      { type: 'exit', indicator: 'RSI', operator: '>', value: '70', timeframe: '1D' },
    ]
  },
  { name: 'Bollinger Bounce', category: 'Mean Reversion', description: 'Buy at lower band, sell at upper', winRate: 0.58, sharpe: 0.88,
    blocks: [
      { type: 'entry', indicator: 'Price', operator: '<', value: 'BB Lower(20,2)', timeframe: '1D' },
      { type: 'exit', indicator: 'Price', operator: '>', value: 'BB Upper(20,2)', timeframe: '1D' },
      { type: 'filter', indicator: 'ADX', operator: '<', value: '25', timeframe: '1D' },
    ]
  },
  { name: 'MACD Momentum', category: 'Momentum', description: 'MACD crossover with trend filter', winRate: 0.52, sharpe: 0.76,
    blocks: [
      { type: 'entry', indicator: 'MACD', operator: 'crosses above', value: 'MACD Signal', timeframe: '4H' },
      { type: 'exit', indicator: 'MACD', operator: 'crosses below', value: 'MACD Signal', timeframe: '4H' },
      { type: 'filter', indicator: 'EMA', operator: '>', value: 'EMA(200)', timeframe: '1D' },
    ]
  },
  { name: 'Breakout Trading', category: 'Breakout', description: '20-day high breakout with volume', winRate: 0.48, sharpe: 0.71,
    blocks: [
      { type: 'entry', indicator: 'High', operator: '>', value: 'Pivot High(20)', timeframe: '1D' },
      { type: 'exit', indicator: 'Low', operator: '<', value: 'EMA(10)', timeframe: '1D' },
      { type: 'filter', indicator: 'Volume', operator: '>', value: '1.5x avg', timeframe: '1D' },
      { type: 'filter', indicator: 'ATR', operator: '>', value: 'ATR(20)*0.8', timeframe: '1D' },
    ]
  },
  { name: 'VWAP Reversion', category: 'Intraday', description: 'Mean revert to VWAP intraday', winRate: 0.63, sharpe: 1.12,
    blocks: [
      { type: 'entry', indicator: 'Price', operator: '<', value: 'VWAP - 2*StdDev', timeframe: '5m' },
      { type: 'exit', indicator: 'Price', operator: '>', value: 'VWAP', timeframe: '5m' },
      { type: 'filter', indicator: 'Volume', operator: '>', value: '500', timeframe: '5m' },
    ]
  },
  { name: 'Dual Momentum', category: 'Momentum', description: 'Absolute + relative momentum', winRate: 0.56, sharpe: 0.93,
    blocks: [
      { type: 'entry', indicator: 'ROC', operator: '>', value: '0', timeframe: '1M' },
      { type: 'entry', indicator: 'ROC', operator: '>', value: 'Benchmark ROC', timeframe: '1M' },
      { type: 'exit', indicator: 'ROC', operator: '<', value: '0', timeframe: '1M' },
    ]
  },
  { name: 'Trend + Volatility', category: 'Adaptive', description: 'ADX trend + ATR position sizing', winRate: 0.51, sharpe: 0.85,
    blocks: [
      { type: 'entry', indicator: 'ADX', operator: '>', value: '25', timeframe: '1D' },
      { type: 'entry', indicator: 'EMA', operator: 'crosses above', value: 'EMA(50)', timeframe: '1D' },
      { type: 'exit', indicator: 'ATR', operator: '>', value: '3x trailing stop', timeframe: '1D' },
    ]
  },
];

/* ─── Canvas: Signal Preview ─────────────────────────────────────────── */
function SignalPreviewChart({ blocks }: { blocks: ConditionBlock[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const W = c.width = c.offsetWidth * 2, H = c.height = c.offsetHeight * 2;
    ctx.scale(2, 2); const w = W / 2, h = H / 2;
    ctx.fillStyle = PANEL; ctx.fillRect(0, 0, w, h);

    // Generate mock price data
    const pts = 120;
    const prices: number[] = [100];
    for (let i = 1; i < pts; i++) {
      prices.push(prices[i - 1] + (Math.random() - 0.48) * 2);
    }
    const minP = Math.min(...prices), maxP = Math.max(...prices);
    const px = (i: number) => 10 + (i / (pts - 1)) * (w - 20);
    const py = (v: number) => 20 + ((maxP - v) / (maxP - minP)) * (h - 40);

    // Price line
    ctx.strokeStyle = '#666'; ctx.lineWidth = 1;
    ctx.beginPath();
    prices.forEach((p, i) => i === 0 ? ctx.moveTo(px(i), py(p)) : ctx.lineTo(px(i), py(p)));
    ctx.stroke();

    // Generate mock signals based on blocks
    const entryBlocks = blocks.filter(b => b.type === 'entry' && b.enabled);
    const exitBlocks = blocks.filter(b => b.type === 'exit' && b.enabled);

    if (entryBlocks.length > 0) {
      // Mock entry signals
      const entryPts = [15, 42, 68, 95].filter(i => i < pts);
      entryPts.forEach(i => {
        ctx.fillStyle = GREEN;
        ctx.beginPath(); 
        ctx.moveTo(px(i), py(prices[i]) + 8);
        ctx.lineTo(px(i) - 4, py(prices[i]) + 14);
        ctx.lineTo(px(i) + 4, py(prices[i]) + 14);
        ctx.closePath(); ctx.fill();
      });
      
      // Mock exit signals
      const exitPts = [28, 55, 82, 110].filter(i => i < pts);
      exitPts.forEach(i => {
        ctx.fillStyle = RED;
        ctx.beginPath();
        ctx.moveTo(px(i), py(prices[i]) - 8);
        ctx.lineTo(px(i) - 4, py(prices[i]) - 14);
        ctx.lineTo(px(i) + 4, py(prices[i]) - 14);
        ctx.closePath(); ctx.fill();
      });

      // Highlight regions
      for (let j = 0; j < entryPts.length; j++) {
        const start = entryPts[j];
        const end = exitPts[j] ?? pts - 1;
        ctx.fillStyle = 'rgba(38,166,154,0.08)';
        ctx.fillRect(px(start), 20, px(end) - px(start), h - 40);
      }
    }

    // Labels
    ctx.fillStyle = MUTED; ctx.font = '9px monospace'; ctx.textAlign = 'left';
    ctx.fillText(`${blocks.filter(b => b.enabled).length} active rules`, 12, 14);
    ctx.fillText(`${entryBlocks.length} entries, ${exitBlocks.length} exits`, 12, h - 6);
  }, [blocks]);
  return <canvas ref={ref} style={{ width: '100%', height: 180, borderRadius: 4 }} />;
}

/* ─── Pine Script Code Generator ─────────────────────────────────────── */
function generatePineScript(blocks: ConditionBlock[], sizeRule: SizeRule): string {
  const lines = [
    '//@version=5',
    'strategy("Custom Strategy", overlay=true, default_qty_type=strategy.percent_of_equity)',
    '',
    '// === INPUTS ===',
  ];
  
  const usedIndicators = new Set(blocks.map(b => b.indicator));
  if (usedIndicators.has('SMA')) lines.push('smaLen = input.int(50, "SMA Length")');
  if (usedIndicators.has('EMA')) lines.push('emaLen = input.int(20, "EMA Length")');
  if (usedIndicators.has('RSI')) lines.push('rsiLen = input.int(14, "RSI Length")');
  if (usedIndicators.has('MACD')) lines.push('macdFast = input.int(12, "MACD Fast")\nmacdSlow = input.int(26, "MACD Slow")\nmacdSignal = input.int(9, "MACD Signal")');
  if (usedIndicators.has('ATR')) lines.push('atrLen = input.int(14, "ATR Length")');
  if (usedIndicators.has('ADX')) lines.push('adxLen = input.int(14, "ADX Length")');
  
  lines.push('', '// === INDICATORS ===');
  if (usedIndicators.has('SMA')) lines.push('sma50 = ta.sma(close, smaLen)', 'sma200 = ta.sma(close, 200)');
  if (usedIndicators.has('EMA')) lines.push('ema20 = ta.ema(close, emaLen)');
  if (usedIndicators.has('RSI')) lines.push('rsi = ta.rsi(close, rsiLen)');
  if (usedIndicators.has('MACD')) lines.push('[macdLine, signalLine, hist] = ta.macd(close, macdFast, macdSlow, macdSignal)');
  if (usedIndicators.has('ATR')) lines.push('atr = ta.atr(atrLen)');
  
  lines.push('', '// === ENTRY CONDITIONS ===');
  const entries = blocks.filter(b => b.type === 'entry' && b.enabled);
  entries.forEach((b, i) => {
    lines.push(`entryCond${i + 1} = ${b.indicator.toLowerCase()} ${b.operator === 'crosses above' ? '> ' : b.operator === 'crosses below' ? '< ' : b.operator + ' '}${b.value}`);
  });
  if (entries.length > 0) {
    lines.push(`entrySignal = ${entries.map((_, i) => `entryCond${i + 1}`).join(' and ')}`);
  }
  
  lines.push('', '// === EXIT CONDITIONS ===');
  const exits = blocks.filter(b => b.type === 'exit' && b.enabled);
  exits.forEach((b, i) => {
    lines.push(`exitCond${i + 1} = ${b.indicator.toLowerCase()} ${b.operator === 'crosses above' ? '> ' : b.operator === 'crosses below' ? '< ' : b.operator + ' '}${b.value}`);
  });
  if (exits.length > 0) {
    lines.push(`exitSignal = ${exits.map((_, i) => `exitCond${i + 1}`).join(' or ')}`);
  }
  
  lines.push('', '// === POSITION SIZING ===');
  lines.push(`posSize = ${sizeRule.method === 'Fixed %' ? `strategy.equity * ${sizeRule.value / 100}` : sizeRule.value}`);
  
  lines.push('', '// === EXECUTION ===');
  lines.push('if entrySignal', '    strategy.entry("Long", strategy.long)');
  lines.push('if exitSignal', '    strategy.close("Long")');
  
  return lines.join('\n');
}

/* ─── Tabs ───────────────────────────────────────────────────────────── */
const TABS = ['VISUAL BUILDER', 'CODE EDITOR', 'TEMPLATES', 'SIZING & STOPS'] as const;
type Tab = typeof TABS[number];

let blockCounter = 0;
function newBlock(type: ConditionBlock['type'], indicator = 'SMA', operator = 'crosses above', value = 'SMA(200)', timeframe = '1D'): ConditionBlock {
  return { id: `block-${++blockCounter}`, type, indicator, operator, value, timeframe, enabled: true };
}

export default function StrategyBuilderProUI2() {
  const [tab, setTab] = useState<Tab>('VISUAL BUILDER');
  const [blocks, setBlocks] = useState<ConditionBlock[]>([
    newBlock('entry', 'SMA', 'crosses above', 'SMA(200)', '1D'),
    newBlock('exit', 'SMA', 'crosses below', 'SMA(200)', '1D'),
    newBlock('filter', 'Volume', '>', 'SMA(vol,20)', '1D'),
  ]);
  const [strategyName, setStrategyName] = useState('My Strategy');
  const [sizeRule, setSizeRule] = useState<SizeRule>({ method: 'Fixed %', value: 10 });
  const [stopLoss, setStopLoss] = useState({ enabled: true, type: 'ATR', value: 2 });
  const [takeProfit, setTakeProfit] = useState({ enabled: true, type: 'ATR', value: 3 });
  const [trailingStop, setTrailingStop] = useState({ enabled: false, type: 'ATR', value: 1.5 });
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  const validation = useMemo((): ValidationError[] => {
    const errors: ValidationError[] = [];
    const entries = blocks.filter(b => b.type === 'entry' && b.enabled);
    const exits = blocks.filter(b => b.type === 'exit' && b.enabled);
    if (entries.length === 0) errors.push({ severity: 'error', message: 'At least one entry condition required' });
    if (exits.length === 0) errors.push({ severity: 'warning', message: 'No exit condition — position will be held indefinitely' });
    const tfs = new Set(blocks.filter(b => b.enabled).map(b => b.timeframe));
    if (tfs.size > 2) errors.push({ severity: 'warning', message: `Using ${tfs.size} timeframes — may cause lookahead bias` });
    blocks.forEach(b => {
      if (b.enabled && !b.value.trim()) errors.push({ severity: 'error', message: `Block "${b.indicator}" has empty value`, blockId: b.id });
    });
    if (stopLoss.enabled && takeProfit.enabled && takeProfit.value <= stopLoss.value) {
      errors.push({ severity: 'warning', message: 'Take profit should be larger than stop loss for positive R:R' });
    }
    return errors;
  }, [blocks, stopLoss, takeProfit]);

  const pineScript = useMemo(() => generatePineScript(blocks, sizeRule), [blocks, sizeRule]);

  const updateBlock = (id: string, field: keyof ConditionBlock, value: any) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, [field]: value } : b));
  };
  const removeBlock = (id: string) => setBlocks(prev => prev.filter(b => b.id !== id));
  const addBlock = (type: ConditionBlock['type']) => setBlocks(prev => [...prev, newBlock(type)]);
  const loadTemplate = (t: StrategyTemplate) => {
    setStrategyName(t.name);
    setBlocks(t.blocks.map(b => newBlock(b.type, b.indicator, b.operator, b.value, b.timeframe)));
    setSelectedTemplate(t.name);
  };

  const typeColor = (t: string) => t === 'entry' ? GREEN : t === 'exit' ? RED : AMBER;

  const ps: React.CSSProperties = { background: BG, color: '#eee', height: '100%', display: 'flex', flexDirection: 'column', fontFamily: "'Inter','SF Mono',monospace", fontSize: 12 };
  const panelStyle: React.CSSProperties = { background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 6, padding: 12 };

  return (
    <div style={ps}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: AMBER }}>🔧 STRATEGY BUILDER</span>
          <input value={strategyName} onChange={e => setStrategyName(e.target.value)}
            style={{ background: '#1a1a1a', border: `1px solid ${BORDER}`, borderRadius: 4, color: '#eee', padding: '4px 10px', fontSize: 12, fontWeight: 600, width: 180 }} />
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {validation.filter(v => v.severity === 'error').length > 0 ? (
            <span style={{ color: RED, fontSize: 11 }}>⚠ {validation.filter(v => v.severity === 'error').length} error(s)</span>
          ) : (
            <span style={{ color: GREEN, fontSize: 11 }}>✓ Valid</span>
          )}
          <button style={{ background: GREEN, color: '#fff', border: 'none', borderRadius: 4, padding: '6px 16px', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>BACKTEST</button>
          <button style={{ background: AMBER, color: '#000', border: 'none', borderRadius: 4, padding: '6px 16px', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>DEPLOY</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${BORDER}` }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '8px 16px', background: 'transparent', border: 'none',
            color: tab === t ? AMBER : MUTED, fontWeight: tab === t ? 700 : 400,
            borderBottom: tab === t ? `2px solid ${AMBER}` : '2px solid transparent',
            cursor: 'pointer', fontSize: 11, letterSpacing: 0.5
          }}>{t}</button>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
        {tab === 'VISUAL BUILDER' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 12, height: '100%' }}>
            <div>
              {/* Condition blocks */}
              {(['entry', 'exit', 'filter'] as const).map(type => (
                <div key={type} style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ color: typeColor(type), fontWeight: 700, fontSize: 11, textTransform: 'uppercase' }}>
                      {type === 'entry' ? '▲ ENTRY CONDITIONS' : type === 'exit' ? '▼ EXIT CONDITIONS' : '◆ FILTERS'}
                    </span>
                    <button onClick={() => addBlock(type)} style={{
                      background: 'transparent', border: `1px solid ${typeColor(type)}`, borderRadius: 3,
                      color: typeColor(type), padding: '2px 10px', fontSize: 10, cursor: 'pointer'
                    }}>+ ADD</button>
                  </div>
                  {blocks.filter(b => b.type === type).map(block => (
                    <div key={block.id} style={{
                      display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', marginBottom: 4,
                      background: block.enabled ? '#0f0f0f' : '#0a0a0a',
                      border: `1px solid ${block.enabled ? typeColor(type) + '44' : BORDER}`,
                      borderRadius: 6, opacity: block.enabled ? 1 : 0.5,
                      borderLeft: `3px solid ${typeColor(type)}`,
                    }}>
                      <input type="checkbox" checked={block.enabled} onChange={() => updateBlock(block.id, 'enabled', !block.enabled)}
                        style={{ accentColor: typeColor(type) }} />
                      <select value={block.indicator} onChange={e => updateBlock(block.id, 'indicator', e.target.value)}
                        style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 3, color: '#eee', padding: '3px 6px', fontSize: 10, width: 100 }}>
                        {INDICATORS.map(ind => <option key={ind}>{ind}</option>)}
                      </select>
                      <select value={block.operator} onChange={e => updateBlock(block.id, 'operator', e.target.value)}
                        style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 3, color: AMBER, padding: '3px 6px', fontSize: 10, width: 110 }}>
                        {OPERATORS.map(op => <option key={op}>{op}</option>)}
                      </select>
                      <input value={block.value} onChange={e => updateBlock(block.id, 'value', e.target.value)}
                        style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 3, color: '#eee', padding: '3px 6px', fontSize: 10, flex: 1 }} />
                      <select value={block.timeframe} onChange={e => updateBlock(block.id, 'timeframe', e.target.value)}
                        style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 3, color: '#999', padding: '3px 6px', fontSize: 10, width: 55 }}>
                        {TIMEFRAMES.map(tf => <option key={tf}>{tf}</option>)}
                      </select>
                      <button onClick={() => removeBlock(block.id)} style={{
                        background: 'transparent', border: 'none', color: '#555', fontSize: 14, cursor: 'pointer', padding: '0 4px'
                      }}>×</button>
                    </div>
                  ))}
                  {blocks.filter(b => b.type === type).length === 0 && (
                    <div style={{ padding: 12, textAlign: 'center', color: '#444', fontSize: 10, border: `1px dashed ${BORDER}`, borderRadius: 4 }}>
                      No {type} conditions — click + ADD
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Right panel */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={panelStyle}>
                <span style={{ color: AMBER, fontWeight: 600, fontSize: 11 }}>SIGNAL PREVIEW</span>
                <SignalPreviewChart blocks={blocks} />
              </div>
              <div style={panelStyle}>
                <span style={{ color: AMBER, fontWeight: 600, fontSize: 11 }}>VALIDATION</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
                  {validation.length === 0 ? (
                    <div style={{ color: GREEN, fontSize: 11 }}>✓ Strategy is valid</div>
                  ) : validation.map((v, i) => (
                    <div key={i} style={{ display: 'flex', gap: 6, fontSize: 10, padding: 4, background: v.severity === 'error' ? 'rgba(239,83,80,0.08)' : 'rgba(245,166,35,0.08)', borderRadius: 3 }}>
                      <span style={{ color: v.severity === 'error' ? RED : AMBER }}>{v.severity === 'error' ? '✗' : '⚠'}</span>
                      <span style={{ color: '#ccc' }}>{v.message}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={panelStyle}>
                <span style={{ color: AMBER, fontWeight: 600, fontSize: 11 }}>STRATEGY SUMMARY</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6, fontSize: 11 }}>
                  {[
                    { l: 'Entry Rules', v: blocks.filter(b => b.type === 'entry' && b.enabled).length, c: GREEN },
                    { l: 'Exit Rules', v: blocks.filter(b => b.type === 'exit' && b.enabled).length, c: RED },
                    { l: 'Filters', v: blocks.filter(b => b.type === 'filter' && b.enabled).length, c: AMBER },
                    { l: 'Timeframes', v: new Set(blocks.filter(b => b.enabled).map(b => b.timeframe)).size, c: '#eee' },
                    { l: 'Stop Loss', v: stopLoss.enabled ? `${stopLoss.value}x ${stopLoss.type}` : 'OFF', c: stopLoss.enabled ? RED : MUTED },
                    { l: 'Take Profit', v: takeProfit.enabled ? `${takeProfit.value}x ${takeProfit.type}` : 'OFF', c: takeProfit.enabled ? GREEN : MUTED },
                  ].map(s => (
                    <div key={s.l} style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: MUTED }}>{s.l}</span>
                      <span style={{ color: s.c, fontWeight: 600 }}>{s.v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'CODE EDITOR' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 12, height: '100%' }}>
            <div style={panelStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: AMBER, fontWeight: 600, fontSize: 11 }}>PINE SCRIPT (AUTO-GENERATED)</span>
                <button style={{ background: '#1a1a1a', border: `1px solid ${BORDER}`, borderRadius: 3, color: AMBER, padding: '3px 10px', fontSize: 9, cursor: 'pointer' }}>COPY</button>
              </div>
              <pre style={{
                background: '#050505', border: `1px solid ${BORDER}`, borderRadius: 4,
                padding: 12, color: '#d4d4d4', fontSize: 11, lineHeight: 1.6,
                overflow: 'auto', maxHeight: 'calc(100vh - 240px)', fontFamily: 'monospace',
                whiteSpace: 'pre-wrap'
              }}>
                {pineScript.split('\n').map((line, i) => (
                  <div key={i} style={{ display: 'flex' }}>
                    <span style={{ color: '#444', minWidth: 30, textAlign: 'right', marginRight: 12, userSelect: 'none' }}>{i + 1}</span>
                    <span style={{
                      color: line.startsWith('//') ? '#6a9955' : line.startsWith('strategy') ? '#569cd6' :
                             line.includes('input') ? '#ce9178' : line.includes('ta.') ? '#dcdcaa' : '#d4d4d4'
                    }}>{line}</span>
                  </div>
                ))}
              </pre>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={panelStyle}>
                <span style={{ color: AMBER, fontWeight: 600, fontSize: 11 }}>CODE STATS</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8, fontSize: 11 }}>
                  {[
                    { l: 'Lines', v: pineScript.split('\n').length },
                    { l: 'Indicators', v: new Set(blocks.map(b => b.indicator)).size },
                    { l: 'Conditions', v: blocks.filter(b => b.enabled).length },
                    { l: 'Language', v: 'Pine Script v5' },
                  ].map(s => (
                    <div key={s.l} style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: MUTED }}>{s.l}</span>
                      <span style={{ fontWeight: 600 }}>{s.v}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={panelStyle}>
                <span style={{ color: AMBER, fontWeight: 600, fontSize: 11 }}>EXPORT OPTIONS</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                  {['Pine Script', 'Python', 'JSON Config', 'API Spec'].map(fmt => (
                    <button key={fmt} style={{
                      background: '#0a0a0a', border: `1px solid ${BORDER}`, borderRadius: 4,
                      color: '#eee', padding: '6px 12px', fontSize: 11, cursor: 'pointer', textAlign: 'left'
                    }}>{fmt}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'TEMPLATES' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            {TEMPLATES.map(t => (
              <div key={t.name} onClick={() => loadTemplate(t)} style={{
                ...panelStyle, cursor: 'pointer', transition: 'border-color 0.2s',
                borderColor: selectedTemplate === t.name ? AMBER : BORDER,
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = AMBER)}
              onMouseLeave={e => (e.currentTarget.style.borderColor = selectedTemplate === t.name ? AMBER : BORDER)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>{t.name}</span>
                  <span style={{ padding: '1px 8px', borderRadius: 3, fontSize: 9, background: 'rgba(245,166,35,0.12)', color: AMBER }}>{t.category}</span>
                </div>
                <div style={{ color: MUTED, fontSize: 11, marginBottom: 8 }}>{t.description}</div>
                <div style={{ display: 'flex', gap: 16, marginBottom: 8, fontSize: 10 }}>
                  <span><span style={{ color: MUTED }}>Win Rate: </span><span style={{ color: t.winRate > 0.55 ? GREEN : AMBER, fontWeight: 600 }}>{(t.winRate * 100).toFixed(0)}%</span></span>
                  <span><span style={{ color: MUTED }}>Sharpe: </span><span style={{ color: t.sharpe > 0.9 ? GREEN : AMBER, fontWeight: 600 }}>{t.sharpe.toFixed(2)}</span></span>
                </div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {t.blocks.map((b, i) => (
                    <span key={i} style={{
                      padding: '2px 6px', borderRadius: 3, fontSize: 9,
                      background: `${typeColor(b.type)}15`, color: typeColor(b.type), border: `1px solid ${typeColor(b.type)}33`,
                    }}>{b.type}: {b.indicator} {b.operator} {b.value}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'SIZING & STOPS' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={panelStyle}>
              <span style={{ color: AMBER, fontWeight: 600, fontSize: 11 }}>POSITION SIZING</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
                {['Fixed %', 'Fixed $', 'Kelly Criterion', 'Risk-Based', 'Volatility-Scaled'].map(method => (
                  <div key={method} onClick={() => setSizeRule(prev => ({ ...prev, method }))} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 12px', borderRadius: 4, cursor: 'pointer',
                    background: sizeRule.method === method ? 'rgba(245,166,35,0.1)' : '#0a0a0a',
                    border: `1px solid ${sizeRule.method === method ? AMBER : BORDER}`,
                  }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 12 }}>{method}</div>
                      <div style={{ color: MUTED, fontSize: 10 }}>
                        {method === 'Fixed %' ? 'Allocate fixed percentage of equity' :
                         method === 'Fixed $' ? 'Fixed dollar amount per trade' :
                         method === 'Kelly Criterion' ? 'Optimal fraction based on edge' :
                         method === 'Risk-Based' ? 'Size based on ATR stop distance' :
                         'Scale by inverse volatility'}
                      </div>
                    </div>
                    {sizeRule.method === method && (
                      <input type="number" value={sizeRule.value} onChange={e => setSizeRule(prev => ({ ...prev, value: Number(e.target.value) }))}
                        style={{ width: 60, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 3, color: AMBER, padding: '4px 6px', fontSize: 12, textAlign: 'right' }} />
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div style={panelStyle}>
              <span style={{ color: AMBER, fontWeight: 600, fontSize: 11 }}>RISK CONTROLS</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
                {[
                  { label: 'Stop Loss', state: stopLoss, setter: setStopLoss, color: RED },
                  { label: 'Take Profit', state: takeProfit, setter: setTakeProfit, color: GREEN },
                  { label: 'Trailing Stop', state: trailingStop, setter: setTrailingStop, color: AMBER },
                ].map(ctrl => (
                  <div key={ctrl.label} style={{
                    padding: 12, borderRadius: 6,
                    background: ctrl.state.enabled ? '#0f0f0f' : '#0a0a0a',
                    border: `1px solid ${ctrl.state.enabled ? ctrl.color + '44' : BORDER}`,
                    opacity: ctrl.state.enabled ? 1 : 0.6,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input type="checkbox" checked={ctrl.state.enabled}
                          onChange={() => ctrl.setter((prev: any) => ({ ...prev, enabled: !prev.enabled }))}
                          style={{ accentColor: ctrl.color }} />
                        <span style={{ color: ctrl.color, fontWeight: 700, fontSize: 12 }}>{ctrl.label}</span>
                      </div>
                    </div>
                    {ctrl.state.enabled && (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <select value={ctrl.state.type}
                          onChange={e => ctrl.setter((prev: any) => ({ ...prev, type: e.target.value }))}
                          style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 3, color: '#eee', padding: '4px 6px', fontSize: 11 }}>
                          {['ATR', 'Percent', 'Fixed $', 'Points'].map(t => <option key={t}>{t}</option>)}
                        </select>
                        <span style={{ color: MUTED, fontSize: 10 }}>×</span>
                        <input type="number" step="0.5" value={ctrl.state.value}
                          onChange={e => ctrl.setter((prev: any) => ({ ...prev, value: Number(e.target.value) }))}
                          style={{ width: 60, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 3, color: '#eee', padding: '4px 6px', fontSize: 11, textAlign: 'right' }} />
                        <span style={{ color: MUTED, fontSize: 10 }}>{ctrl.state.type === 'ATR' ? 'ATR' : ctrl.state.type === 'Percent' ? '%' : ctrl.state.type === 'Fixed $' ? '$' : 'pts'}</span>
                      </div>
                    )}
                  </div>
                ))}

                {/* R:R display */}
                <div style={{ background: '#0a0a0a', borderRadius: 6, padding: 12, marginTop: 8 }}>
                  <span style={{ color: MUTED, fontSize: 10 }}>RISK : REWARD RATIO</span>
                  <div style={{ fontSize: 24, fontWeight: 700, color: AMBER, marginTop: 4 }}>
                    1 : {stopLoss.enabled && takeProfit.enabled ? (takeProfit.value / stopLoss.value).toFixed(1) : '—'}
                  </div>
                  {stopLoss.enabled && takeProfit.enabled && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 8, height: 12, borderRadius: 6, overflow: 'hidden' }}>
                      <div style={{ flex: stopLoss.value, background: RED, borderRadius: '6px 0 0 6px' }} />
                      <div style={{ flex: takeProfit.value, background: GREEN, borderRadius: '0 6px 6px 0' }} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
