// Bloomberg SV â€” Strategies View
const BG = '#0a0a0a';
const PANEL = '#111111';
const BORDER = '#1e1e1e';
const AMBER = '#f5a623';
const GREEN = '#26a69a';
const RED = '#ef5350';
const BLUE = '#42a5f5';
const PURPLE = '#ab47bc';
const SUBTLE = '#555';
const TEXT = '#d1d4dc';
const MONO = '"Roboto Mono","Courier New",monospace';

import { useState, useEffect, useCallback } from 'react';
import React from 'react';
import { ApiClient, type StrategyResponse } from '../../../data/ApiClient';

const STATUS_COLOR: Record<string, string> = {
  RUNNING: GREEN, STOPPED: SUBTLE, PAUSED: AMBER, ERROR: RED, CREATED: BLUE,
};

const mockTrades = [
  { id: 't-1', time: '09:31:42', symbol: 'AAPL', side: 'BUY',  qty: 100, price: 185.42, pnl: null  },
  { id: 't-2', time: '10:15:30', symbol: 'AAPL', side: 'SELL', qty: 100, price: 186.20, pnl: 78.00 },
  { id: 't-3', time: '11:02:15', symbol: 'AAPL', side: 'BUY',  qty: 50,  price: 185.80, pnl: null  },
];

function btn(color: string, sm?: boolean) {
  return {
    background: color + '22', border:`1px solid ${color}`, color,
    fontFamily:MONO, fontSize: sm ? 8 : 9, fontWeight:700, letterSpacing:0.5,
    padding: sm ? '2px 6px' : '4px 10px', cursor:'pointer', borderRadius:2,
  };
}

function StrategyList({ strategies, selectedId, onSelect, onNew }: {
  strategies: StrategyResponse[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
}) {
  const [search, setSearch] = useState('');
  const filtered = strategies.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.symbol.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column', background:PANEL, borderRight:`1px solid ${BORDER}` }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'6px 10px', borderBottom:`1px solid ${BORDER}`, background:BG }}>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <span style={{ color:AMBER, fontSize:12 }}>âš¡</span>
          <span style={{ color:AMBER, fontWeight:700, fontSize:10, letterSpacing:1 }}>STRATEGIES</span>
          <span style={{ color:SUBTLE, fontSize:9 }}>({strategies.length})</span>
        </div>
        <button onClick={onNew} style={btn(BLUE, true)}>+ NEW</button>
      </div>

      {/* Search */}
      <div style={{ padding:'4px 8px', borderBottom:`1px solid ${BORDER}` }}>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="SEARCH STRATEGIES..."
          style={{
            width:'100%', background:BG, border:`1px solid ${BORDER}`, color:TEXT,
            fontFamily:MONO, fontSize:9, padding:'4px 8px', outline:'none', borderRadius:2,
            boxSizing:'border-box',
          }} />
      </div>

      {/* List */}
      <div style={{ flex:1, overflowY:'auto' }}>
        {filtered.length === 0 ? (
          <div style={{ padding:24, textAlign:'center', color:SUBTLE, fontSize:9 }}>NO STRATEGIES FOUND</div>
        ) : filtered.map(s => {
          const active = selectedId === s.id;
          const color  = STATUS_COLOR[s.status] ?? SUBTLE;
          return (
            <button key={s.id} onClick={() => onSelect(s.id)}
              data-testid={`strategy-item-${s.id}`}
              style={{
                width:'100%', textAlign:'left', padding:'7px 10px',
                background: active ? BLUE + '11' : 'transparent',
                borderLeft: `2px solid ${active ? BLUE : 'transparent'}`,
                borderBottom:`1px solid ${BORDER}`, border:'none',
                borderLeftColor: active ? BLUE : 'transparent',
                fontFamily:MONO, cursor:'pointer',
              }}>
              <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:2 }}>
                <span style={{ width:6, height:6, borderRadius:'50%', background:color, flexShrink:0 }} />
                <span style={{ color:TEXT, fontSize:10, fontWeight: active ? 700 : 400, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.name}</span>
              </div>
              <div style={{ display:'flex', gap:6, paddingLeft:12 }}>
                <span style={{ color:color, fontSize:8, border:`1px solid ${color}`, padding:'0 3px', borderRadius:1 }}>{s.status}</span>
                <span style={{ color:SUBTLE, fontSize:8 }}>{s.symbol}</span>
                <span style={{ color:SUBTLE, fontSize:8 }}>{s.strategy_type}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StrategyDetail({ strategy, onStop, onStart, onDelete, onClose }: {
  strategy: StrategyResponse | null;
  onStop: () => void;
  onStart: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  if (!strategy) {
    return (
      <div style={{ height:'100%', display:'flex', alignItems:'center', justifyContent:'center', background:BG, fontFamily:MONO }}>
        <div style={{ textAlign:'center' }}>
          <div style={{ color:SUBTLE, fontSize:24, marginBottom:8 }}>ðŸ“ˆ</div>
          <div style={{ color:SUBTLE, fontSize:10 }}>SELECT A STRATEGY TO VIEW DETAILS</div>
        </div>
      </div>
    );
  }

  const running = strategy.status === 'RUNNING';
  const metrics = (strategy as typeof strategy & { metrics?: { pnl: number; trades: number; win_rate: number } }).metrics;

  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column', background:BG, fontFamily:MONO }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 12px', borderBottom:`1px solid ${BORDER}`, background:PANEL }}>
        <div>
          <div style={{ color:TEXT, fontSize:12, fontWeight:700 }}>{strategy.name}</div>
          <div style={{ display:'flex', gap:6, marginTop:2 }}>
            <span style={{ color:SUBTITLE, fontSize:8, border:`1px solid ${BORDER}`, padding:'0 3px', borderRadius:1 }}>{strategy.strategy_type}</span>
            <span style={{ color: STATUS_COLOR[strategy.status]??SUBTLE, fontSize:8, border:`1px solid ${STATUS_COLOR[strategy.status]??BORDER}`, padding:'0 3px', borderRadius:1 }}>{strategy.status}</span>
          </div>
        </div>
        <div style={{ display:'flex', gap:6, alignItems:'center' }}>
          {running ? (
            <>
              <button onClick={onStop} style={btn(RED, true)}>â–  STOP</button>
            </>
          ) : (
            <>
              <button onClick={onStart} style={btn(GREEN, true)}>â–¶ START</button>
              <button onClick={onDelete} style={btn(RED, true)}>âœ• DELETE</button>
            </>
          )}
          <button onClick={onClose} style={{ ...btn(SUBTLE, true), marginLeft:4 }}>âœ•</button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', borderBottom:`1px solid ${BORDER}` }}>
        {[
          { label:'P&L',     val: metrics ? (metrics.pnl >= 0 ? '+' : '') + `$${metrics.pnl.toFixed(2)}` : '+$0.00',     color: metrics && metrics.pnl < 0 ? RED : GREEN },
          { label:'TRADES',  val: metrics ? String(metrics.trades) : '0', color:TEXT },
          { label:'WIN RATE',val: metrics ? `${(metrics.win_rate*100).toFixed(0)}%` : '0%', color:TEXT },
          { label:'SYMBOL',  val: strategy.symbol, color:AMBER },
        ].map(m => (
          <div key={m.label} style={{ padding:'8px 12px', borderRight:`1px solid ${BORDER}` }}>
            <div style={{ color:SUBTLE, fontSize:8, letterSpacing:0.5, marginBottom:2 }}>{m.label}</div>
            <div style={{ color:m.color, fontSize:18, fontWeight:700 }}>{m.val}</div>
          </div>
        ))}
      </div>

      {/* Trades table */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <div style={{ padding:'4px 12px', borderBottom:`1px solid ${BORDER}`, color:SUBTLE, fontSize:8, letterSpacing:0.5 }}>
          RECENT TRADES
        </div>
        <div style={{ flex:1, overflow:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ background:'#0d0d0d' }}>
                {['TIME','SYMBOL','SIDE','QTY','PRICE','P&L'].map(h => (
                  <th key={h} style={{ padding:'3px 8px', textAlign: h==='QTY'||h==='PRICE'||h==='P&L' ? 'right' : 'left', color:SUBTLE, fontSize:8, fontWeight:600, letterSpacing:0.5, borderBottom:`1px solid ${BORDER}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mockTrades.map((t, i) => (
                <tr key={t.id} style={{ background: i%2===0 ? BG : '#0d0d0d', borderBottom:`1px solid ${BORDER}` }}>
                  <td style={{ padding:'3px 8px', color:SUBTLE, fontSize:9 }}>{t.time}</td>
                  <td style={{ padding:'3px 8px', color:TEXT, fontSize:9 }}>{t.symbol}</td>
                  <td style={{ padding:'3px 8px', color: t.side==='BUY' ? GREEN : RED, fontSize:9, fontWeight:700 }}>{t.side}</td>
                  <td style={{ padding:'3px 8px', textAlign:'right', color:TEXT, fontSize:9 }}>{t.qty}</td>
                  <td style={{ padding:'3px 8px', textAlign:'right', color:TEXT, fontSize:9 }}>${t.price.toFixed(2)}</td>
                  <td style={{ padding:'3px 8px', textAlign:'right', color: t.pnl!=null ? (t.pnl>=0?GREEN:RED) : SUBTLE, fontSize:9 }}>{t.pnl!=null ? `$${t.pnl.toFixed(2)}` : 'â€”'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Declare SUBTITLE here to avoid TypeScript undefined reference
const SUBTITLE = '#888';

function NewStrategyModal({ onSubmit, onClose }: { onSubmit: (data: {name:string;symbol:string;strategy_type:string}) => void; onClose: () => void }) {
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [type, setType] = useState<'standard'|'custom'>('standard');

  const inp = { background:BG, border:`1px solid ${BORDER}`, color:TEXT, fontFamily:MONO, fontSize:10, padding:'5px 8px', width:'100%', outline:'none', borderRadius:2, boxSizing:'border-box' as const };

  return (
    <div style={{ position:'fixed', inset:0, zIndex:9000, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:MONO }}>
      <div onClick={onClose} style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.75)' }} />
      <div style={{ position:'relative', background:PANEL, border:`1px solid ${BORDER}`, borderRadius:2, width:400, boxShadow:'0 8px 32px rgba(0,0,0,0.6)', overflow:'hidden' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'6px 12px', background:BG, borderBottom:`1px solid ${BORDER}` }}>
          <span style={{ color:AMBER, fontWeight:700, fontSize:10, letterSpacing:1 }}>CREATE NEW STRATEGY</span>
          <button onClick={onClose} style={{ background:'none', border:'none', color:SUBTLE, cursor:'pointer', fontSize:12 }}>âœ•</button>
        </div>
        <div style={{ padding:16 }}>
          <div style={{ marginBottom:10 }}>
            <div style={{ color:SUBTLE, fontSize:8, letterSpacing:0.5, marginBottom:3 }}>STRATEGY NAME</div>
            <input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. MEAN REVERSION" style={inp} autoFocus />
          </div>
          <div style={{ marginBottom:10 }}>
            <div style={{ color:SUBTLE, fontSize:8, letterSpacing:0.5, marginBottom:3 }}>SYMBOL</div>
            <input value={symbol} onChange={e=>setSymbol(e.target.value)} placeholder="AAPL" style={inp} />
          </div>
          <div style={{ marginBottom:16 }}>
            <div style={{ color:SUBTLE, fontSize:8, letterSpacing:0.5, marginBottom:6 }}>STRATEGY TYPE</div>
            {([['standard','STANDARD LOGIC','Simple implementation'],['custom','CUSTOM SCRIPT','Advanced Python strategy']] as const).map(([t, label, desc]) => (
              <button key={t} onClick={() => setType(t as 'standard'|'custom')}
                style={{ width:'100%', textAlign:'left', padding:'7px 10px', marginBottom:4, borderRadius:2, fontFamily:MONO,
                  background: type===t ? BLUE+'11' : BG, border:`1px solid ${type===t ? BLUE : BORDER}`, cursor:'pointer' }}>
                <div style={{ color: type===t ? BLUE : TEXT, fontSize:9, fontWeight:700 }}>{label}</div>
                <div style={{ color:SUBTLE, fontSize:8, marginTop:1 }}>{desc}</div>
              </button>
            ))}
          </div>
          <button onClick={() => name && symbol && onSubmit({ name, symbol, strategy_type:type })}
            disabled={!name || !symbol}
            style={{ ...btn(name&&symbol?BLUE:SUBTLE), width:'100%', padding:'7px 0', fontSize:9 }}>
            CREATE STRATEGY
          </button>
        </div>
      </div>
    </div>
  );
}

export function StrategiesView() {
  const [strategies, setStrategies] = useState<StrategyResponse[]>([
    { id:'s-1', name:'Sample Mean Reversion', symbol:'AAPL', strategy_type:'standard', status:'RUNNING', created_at:new Date().toISOString(), params:{}, started_at:new Date().toISOString(), metrics:{ pnl:120.50, trades:12, win_rate:0.65 } } as StrategyResponse,
    { id:'s-2', name:'Sample Breakout',       symbol:'TSLA', strategy_type:'standard', status:'STOPPED', created_at:new Date().toISOString(), params:{}, started_at:null, metrics:{ pnl:-45.00, trades:5,  win_rate:0.40 } } as StrategyResponse,
  ]);
  const [selectedId, setSelectedId] = useState<string|null>(null);
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [toast, setToast] = useState<{msg:string;color:string}|null>(null);

  const showToast = (msg:string, color:string=GREEN) => {
    setToast({msg, color});
    setTimeout(() => setToast(null), 2500);
  };

  const fetchStrategies = useCallback(async () => {
    try {
      const data = await ApiClient.listStrategies();
      if (data.length > 0) setStrategies(data);
    } catch { /* keep defaults */ }
  }, []);

  useEffect(() => { fetchStrategies(); }, [fetchStrategies]);

  const handleCreate = async (data: {name:string;symbol:string;strategy_type:string}) => {
    try { await ApiClient.createStrategy(data); showToast('Strategy created'); setIsNewOpen(false); fetchStrategies(); }
    catch { showToast('Failed to create strategy', RED); }
  };

  const handleStart = async (id:string) => {
    try { await ApiClient.startStrategy(id); showToast('Strategy started'); fetchStrategies(); }
    catch { showToast('Failed to start strategy', RED); }
  };

  const handleStop = async (id:string) => {
    try { await ApiClient.stopStrategy(id); showToast('Strategy stopped', AMBER); fetchStrategies(); }
    catch { showToast('Failed to stop strategy', RED); }
  };

  const handleDelete = async (id:string) => {
    try { await ApiClient.deleteStrategy(id); showToast('Strategy deleted', RED); if (selectedId===id) setSelectedId(null); fetchStrategies(); }
    catch { showToast('Failed to delete strategy', RED); }
  };

  const selectedStrategy = strategies.find(s => s.id === selectedId) ?? null;

  return (
    <div data-testid="strategies-view"
      style={{ height:'100%', background:BG, display:'flex', flexDirection:'column', fontFamily:MONO }}>

      {/* Page header if no selection */}
      {!selectedId && (
        <div data-testid="strategies-header"
          style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'6px 12px', background:PANEL, borderBottom:`1px solid ${BORDER}` }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ color:AMBER, fontSize:16 }}>âš¡</span>
            <div>
              <div style={{ color:AMBER, fontWeight:700, fontSize:11, letterSpacing:1 }}>STRATEGIES</div>
              <div style={{ color:SUBTLE, fontSize:9 }}>CREATE, CONFIGURE AND MONITOR TRADING STRATEGIES</div>
            </div>
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <span style={{ color:SUBTLE, fontSize:9 }}>{strategies.length} ACTIVE</span>
            <button onClick={() => setIsNewOpen(true)} style={btn(BLUE)}>+ NEW STRATEGY</button>
          </div>
        </div>
      )}

      {/* Main content */}
      <div style={{ flex:1, display:'flex', overflow:'hidden' }}>
        {!selectedId ? (
          <div style={{ width:'100%' }}>
            <StrategyList strategies={strategies} selectedId={selectedId} onSelect={setSelectedId} onNew={() => setIsNewOpen(true)} />
          </div>
        ) : (
          <>
            <div style={{ width:300, flexShrink:0 }}>
              <StrategyList strategies={strategies} selectedId={selectedId} onSelect={setSelectedId} onNew={() => setIsNewOpen(true)} />
            </div>
            <div style={{ width:4, background:BORDER, cursor:'col-resize', flexShrink:0 }} />
            <div style={{ flex:1, overflow:'hidden' }}>
              <StrategyDetail
                strategy={selectedStrategy}
                onStop={() => selectedStrategy && handleStop(selectedStrategy.id)}
                onStart={() => selectedStrategy && handleStart(selectedStrategy.id)}
                onDelete={() => selectedStrategy && handleDelete(selectedStrategy.id)}
                onClose={() => setSelectedId(null)}
              />
            </div>
          </>
        )}
      </div>

      {/* New strategy modal */}
      {isNewOpen && <NewStrategyModal onSubmit={handleCreate} onClose={() => setIsNewOpen(false)} />}

      {/* Toast */}
      {toast && (
        <div style={{
          position:'fixed', bottom:20, right:20, zIndex:9999,
          background:toast.color+'22', border:`1px solid ${toast.color}`,
          color:toast.color, fontFamily:MONO, fontSize:9, fontWeight:700,
          padding:'6px 14px', borderRadius:2,
        }}>{toast.msg}</div>
      )}
    </div>
  );
}
