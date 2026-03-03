/**
 * ┌───────────────────────────────────────────────────────────────────────┐
 * │  APEX TERMINAL — Nova AI Agent (UI2)                                │
 * │  AI-powered trading assistant with tool-calling, chain-of-thought,  │
 * │  risk compliance, conversation memory, and audit trail              │
 * └───────────────────────────────────────────────────────────────────────┘
 */
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';

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

/* ── Types ───────────────────────────────────────────────────────────── */
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: string;
  toolCalls?: ToolCall[];
  thinking?: string;
  confidence?: number;
  citations?: string[];
  complianceFlag?: 'pass' | 'warn' | 'block';
}

interface ToolCall {
  name: string;
  args: Record<string, unknown>;
  result?: string;
  duration?: number;
  status: 'pending' | 'running' | 'success' | 'error';
}

interface NovaSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  model: string;
  tokensUsed: number;
}

/* ── Mock Data ───────────────────────────────────────────────────────── */
const TOOLS = [
  { name: 'get_market_data', desc: 'Fetch real-time price, volume, fundamentals' },
  { name: 'analyze_options', desc: 'Calculate Greeks, IV surface, strategy payoffs' },
  { name: 'run_backtest', desc: 'Execute strategy backtest with PnL analysis' },
  { name: 'portfolio_risk', desc: 'Compute VaR, CVaR, stress test, correlation' },
  { name: 'screen_stocks', desc: 'Filter stocks by technical/fundamental criteria' },
  { name: 'sentiment_scan', desc: 'Analyze news/social sentiment for a ticker' },
  { name: 'place_order', desc: 'Submit order to OMS (requires compliance gate)' },
  { name: 'get_economic_data', desc: 'Fetch FRED/macro indicators, calendar events' },
  { name: 'technical_analysis', desc: 'Compute indicators, support/resistance, signals' },
  { name: 'generate_report', desc: 'Create formatted market/portfolio report' },
  { name: 'fx_analytics', desc: 'FX rates, cross-currency analysis, carry trade' },
  { name: 'crypto_analysis', desc: 'On-chain metrics, DeFi TVL, exchange flows' },
];

function generateDemoSession(): NovaSession {
  return {
    id: 'session_001',
    title: 'Market Analysis — NVDA Options Strategy',
    createdAt: new Date().toISOString(),
    model: 'Gemini-2.0-Flash',
    tokensUsed: 14520,
    messages: [
      {
        id: '1', role: 'system', content: 'Nova agent initialized. Model: gemini-2.0-flash. Tools: 12 available. Compliance: enabled. Risk limits: active.',
        timestamp: '09:30:00',
      },
      {
        id: '2', role: 'user', content: 'Analyze NVDA and suggest an options strategy for earnings next week.',
        timestamp: '09:30:15',
      },
      {
        id: '3', role: 'assistant',
        content: 'I\'ll analyze NVDA comprehensively before recommending a strategy. Let me gather the data.',
        timestamp: '09:30:16',
        thinking: 'User wants pre-earnings options strategy. Need: 1) Current price/technicals, 2) IV rank/surface, 3) Historical earnings moves, 4) Sentiment. Will use multiple tools.',
        toolCalls: [
          { name: 'get_market_data', args: { ticker: 'NVDA', fields: ['price', 'volume', 'fundamentals'] }, result: 'NVDA @ $875.50 | Vol: 42.5M | P/E: 62.5 | Rev Growth: +122% YoY', duration: 245, status: 'success' },
          { name: 'analyze_options', args: { ticker: 'NVDA', expiry: '2024-02-23', type: 'surface' }, result: 'IV30: 58.2% (rank: 85th) | Skew: -4.2 | Term Structure: Backwardated | ATM Straddle: $65', duration: 312, status: 'success' },
          { name: 'sentiment_scan', args: { ticker: 'NVDA', sources: ['news', 'social', 'analyst'] }, result: 'Sentiment: +0.72 (bullish) | Analyst consensus: $950 PT | Social mentions: +340% vs avg', duration: 189, status: 'success' },
          { name: 'technical_analysis', args: { ticker: 'NVDA', indicators: ['RSI', 'MACD', 'BB', 'support_resistance'] }, result: 'RSI: 68 | MACD: bullish | Above 20/50/200 SMA | Support: $840 | Resistance: $920', duration: 156, status: 'success' },
        ],
        confidence: 0.88,
        citations: ['Polygon Market Data', 'CBOE Options Analytics', 'NewsAPI Sentiment', 'TradingView Technicals'],
      },
      {
        id: '4', role: 'assistant',
        content: `## NVDA Pre-Earnings Analysis

**Current Setup:**
- Price: $875.50 | RSI: 68 (neutral-bullish)
- IV Rank: 85th percentile — premium is expensive
- Historical earnings move: ±8.5% avg (last 8 quarters)
- ATM straddle pricing: $65 (implies ±7.4% move)

**Recommended Strategy: Iron Condor (if neutral) or Bull Put Spread (if bullish)**

### Option 1: Iron Condor (Sell premium)
- Sell 850/840 Put Spread + Sell 920/930 Call Spread
- Credit: ~$3.80 | Max Loss: $6.20 | POP: ~62%
- Rationale: IV crush post-earnings + range-bound expectation

### Option 2: Bull Put Spread (Directional)
- Sell 840P / Buy 820P | Feb 23 expiry
- Credit: ~$5.50 | Max Loss: $14.50 | POP: ~72%
- Rationale: Strong support at $840, bullish sentiment

⚠️ **Risk Warning:** NVDA can gap ±15% on earnings. Position size accordingly.`,
        timestamp: '09:30:22',
        confidence: 0.88,
        complianceFlag: 'pass',
      },
      {
        id: '5', role: 'user', content: 'Go with the bull put spread. Size it for 2% portfolio risk.',
        timestamp: '09:31:00',
      },
      {
        id: '6', role: 'assistant',
        content: 'Calculating position size based on 2% portfolio risk...',
        timestamp: '09:31:01',
        thinking: 'Portfolio size needed. Max risk = 2% of portfolio. Max loss per spread = $14.50 × 100. Need to calculate contracts.',
        toolCalls: [
          { name: 'portfolio_risk', args: { action: 'size_position', strategy: 'bull_put_spread', maxPortfolioRisk: 0.02, maxLossPerUnit: 1450 }, result: 'Portfolio: $500,000 | 2% risk = $10,000 | Max contracts: 6 | Total premium: $3,300 | Max loss: $8,700', duration: 98, status: 'success' },
          { name: 'place_order', args: { ticker: 'NVDA', strategy: 'bull_put_spread', strikes: [840, 820], expiry: '2024-02-23', contracts: 6, type: 'credit' }, result: '⚠️ COMPLIANCE GATE: Order requires manual approval. Reason: Earnings event within 5 days. Order queued: ORD-2024-0215-001', duration: 45, status: 'success' },
        ],
        confidence: 0.92,
        complianceFlag: 'warn',
      },
      {
        id: '7', role: 'assistant',
        content: `### Order Confirmation

**Strategy:** NVDA Bull Put Spread (Feb 23)
| Leg | Strike | Side | Contracts | Premium |
|-----|--------|------|-----------|---------|
| Put | $840 | SELL | 6 | +$3,300 |
| Put | $820 | BUY | 6 | -$1,200 |

**Net Credit:** $2,100 | **Max Loss:** $8,700 (1.74% of portfolio)
**Breakeven:** $836.50 | **POP:** ~72%

⚠️ **Compliance Note:** Order queued for manual approval (earnings proximity rule). Order ID: ORD-2024-0215-001`,
        timestamp: '09:31:05',
        complianceFlag: 'warn',
      },
    ],
  };
}

/* ── Sub Components ──────────────────────────────────────────────────── */
function ToolCallVisualization({ call }: { call: ToolCall }) {
  const statusColors = { pending: T.tx3, running: T.warn, success: T.up, error: T.dn };
  return (
    <div style={{ background: T.bg0, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '6px', marginBottom: '4px', fontSize: '8px', fontFamily: T.mono }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '3px' }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: statusColors[call.status] }} />
        <span style={{ color: T.brand, fontWeight: 700 }}>{call.name}</span>
        <span style={{ color: T.tx3 }}>({JSON.stringify(call.args).slice(0, 60)}...)</span>
        {call.duration && <span style={{ color: T.tx3, marginLeft: 'auto' }}>{call.duration}ms</span>}
      </div>
      {call.result && (
        <div style={{ color: T.tx2, fontSize: '7px', paddingLeft: '10px', borderLeft: `2px solid ${statusColors[call.status]}` }}>
          {call.result}
        </div>
      )}
    </div>
  );
}

function ThinkingBlock({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{ background: `${T.purple}10`, border: `1px solid ${T.purple}30`, borderRadius: T.r, padding: '4px 8px', marginBottom: '4px', cursor: 'pointer' }} onClick={() => setExpanded(!expanded)}>
      <div style={{ fontSize: '7px', color: T.purple, fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
        <span>{expanded ? '▼' : '▶'}</span> Chain-of-Thought
      </div>
      {expanded && <div style={{ fontSize: '8px', color: T.tx2, marginTop: '3px', fontStyle: 'italic', fontFamily: T.mono }}>{text}</div>}
    </div>
  );
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  if (msg.role === 'system') {
    return (
      <div style={{ textAlign: 'center', padding: '6px', fontSize: '7px', color: T.tx3, fontFamily: T.mono, borderBottom: `1px solid ${T.border}`, marginBottom: '8px' }}>
        ⚙️ {msg.content}
      </div>
    );
  }

  const isUser = msg.role === 'user';
  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', marginBottom: '10px' }}>
      <div style={{ maxWidth: '85%' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
          {!isUser && <div style={{ width: 18, height: 18, borderRadius: '50%', background: `linear-gradient(135deg, ${T.brand}, ${T.purple})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px' }}>N</div>}
          <span style={{ fontSize: '8px', color: T.tx3 }}>{isUser ? 'You' : 'Nova'} · {msg.timestamp}</span>
          {msg.confidence != null && (
            <span style={{ fontSize: '7px', color: msg.confidence > 0.8 ? T.up : T.warn, fontFamily: T.mono }}>
              conf: {(msg.confidence * 100).toFixed(0)}%
            </span>
          )}
          {msg.complianceFlag && (
            <span style={{ fontSize: '7px', padding: '1px 4px', borderRadius: '2px',
              background: msg.complianceFlag === 'pass' ? `${T.up}20` : msg.complianceFlag === 'warn' ? `${T.warn}20` : `${T.dn}20`,
              color: msg.complianceFlag === 'pass' ? T.up : msg.complianceFlag === 'warn' ? T.warn : T.dn,
              fontWeight: 700 }}>
              {msg.complianceFlag === 'pass' ? '✓ PASS' : msg.complianceFlag === 'warn' ? '⚠ WARN' : '✗ BLOCK'}
            </span>
          )}
        </div>
        {/* Thinking */}
        {msg.thinking && <ThinkingBlock text={msg.thinking} />}
        {/* Tool calls */}
        {msg.toolCalls && msg.toolCalls.map((tc, i) => <ToolCallVisualization key={i} call={tc} />)}
        {/* Content */}
        <div style={{
          background: isUser ? T.brand : T.bg2,
          border: isUser ? 'none' : `1px solid ${T.border}`,
          borderRadius: T.r, padding: '8px',
          color: T.tx0, fontSize: '9px', lineHeight: 1.5,
          whiteSpace: 'pre-wrap', fontFamily: T.sans,
        }}>
          {msg.content}
        </div>
        {/* Citations */}
        {msg.citations && msg.citations.length > 0 && (
          <div style={{ display: 'flex', gap: '4px', marginTop: '3px', flexWrap: 'wrap' }}>
            {msg.citations.map((c, i) => (
              <span key={i} style={{ fontSize: '6px', color: T.tx3, background: T.bg3, padding: '1px 4px', borderRadius: '2px' }}>[{i + 1}] {c}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ToolRegistryPanel() {
  return (
    <div style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '8px' }}>
      <div style={{ fontSize: '10px', fontWeight: 700, color: T.tx0, marginBottom: '6px' }}>Tool Registry ({TOOLS.length})</div>
      {TOOLS.map(t => (
        <div key={t.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: `1px solid ${T.border}`, fontSize: '8px' }}>
          <span style={{ color: T.brand, fontFamily: T.mono, fontWeight: 600 }}>{t.name}</span>
          <span style={{ color: T.tx3, maxWidth: '200px', textAlign: 'right' }}>{t.desc}</span>
        </div>
      ))}
    </div>
  );
}

function SessionStatsPanel({ session }: { session: NovaSession }) {
  const toolCalls = session.messages.reduce((c, m) => c + (m.toolCalls?.length || 0), 0);
  const stats = [
    { label: 'Model', value: session.model, color: T.brand },
    { label: 'Messages', value: String(session.messages.length), color: T.tx0 },
    { label: 'Tool Calls', value: String(toolCalls), color: T.info },
    { label: 'Tokens Used', value: session.tokensUsed.toLocaleString(), color: T.warn },
    { label: 'Session ID', value: session.id.slice(0, 12), color: T.tx3 },
  ];

  return (
    <div style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '8px' }}>
      <div style={{ fontSize: '10px', fontWeight: 700, color: T.tx0, marginBottom: '6px' }}>Session Info</div>
      {stats.map(s => (
        <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: '8px' }}>
          <span style={{ color: T.tx3 }}>{s.label}</span>
          <span style={{ color: s.color, fontFamily: T.mono, fontWeight: 600 }}>{s.value}</span>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════ */
/* MAIN                                                                  */
/* ═══════════════════════════════════════════════════════════════════════ */
type NovaTab = 'chat' | 'tools' | 'audit';

export default function NovaUI2() {
  const [tab, setTab] = useState<NovaTab>('chat');
  const [input, setInput] = useState('');
  const session = useMemo(() => generateDemoSession(), []);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session.messages]);

  return (
    <div data-testid="nova-page" style={{ display: 'flex', flexDirection: 'column', height: '100%', background: T.bg0, fontFamily: T.sans, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '6px 10px', gap: '8px', background: T.bg1, borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
        <div style={{ width: 22, height: 22, borderRadius: '50%', background: `linear-gradient(135deg, ${T.brand}, ${T.purple})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 800, color: '#FFF' }}>N</div>
        <span style={{ fontSize: '12px', fontWeight: 800, color: T.tx0 }}>NOVA AI AGENT</span>
        <div style={{ height: 14, width: 1, background: T.border2 }} />
        <span style={{ fontSize: '8px', color: T.up, fontFamily: T.mono }}>● ONLINE</span>
        <span style={{ fontSize: '8px', color: T.tx3, fontFamily: T.mono }}>{session.model}</span>
      </div>
      <div style={{ display: 'flex', borderBottom: `1px solid ${T.border}`, background: T.bg1, flexShrink: 0 }}>
        {([
          { key: 'chat' as NovaTab, label: '💬 Chat' },
          { key: 'tools' as NovaTab, label: '🔧 Tools' },
          { key: 'audit' as NovaTab, label: '📋 Audit' },
        ]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            background: tab === t.key ? T.bg3 : 'transparent', color: tab === t.key ? T.tx0 : T.tx3,
            border: 'none', padding: '6px 14px', fontSize: '9px', fontWeight: 600, cursor: 'pointer',
            borderBottom: tab === t.key ? `2px solid ${T.brand}` : '2px solid transparent',
          }}>{t.label}</button>
        ))}
      </div>
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Main area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {tab === 'chat' && (
            <>
              <div style={{ flex: 1, overflow: 'auto', padding: '10px' }}>
                {session.messages.map(m => <MessageBubble key={m.id} msg={m} />)}
                <div ref={chatEndRef} />
              </div>
              <div style={{ padding: '8px', borderTop: `1px solid ${T.border}`, background: T.bg1, display: 'flex', gap: '6px' }}>
                <input value={input} onChange={e => setInput(e.target.value)} placeholder="Ask Nova anything..."
                  style={{ flex: 1, background: T.bg2, color: T.tx0, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '8px 10px', fontSize: '10px', fontFamily: T.sans, outline: 'none' }}
                  onKeyDown={e => e.key === 'Enter' && setInput('')}
                />
                <button style={{ background: T.brand, color: '#FFF', border: 'none', borderRadius: T.r, padding: '6px 16px', fontSize: '9px', fontWeight: 700, cursor: 'pointer' }}>Send</button>
              </div>
            </>
          )}
          {tab === 'tools' && (
            <div style={{ overflow: 'auto', padding: '8px' }}>
              <ToolRegistryPanel />
            </div>
          )}
          {tab === 'audit' && (
            <div style={{ overflow: 'auto', padding: '8px' }}>
              <div style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '8px' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: T.tx0, marginBottom: '6px' }}>Audit Trail</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8px', fontFamily: T.mono }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${T.border2}` }}>
                      {['Time', 'Action', 'Tool', 'Status', 'Duration', 'Compliance'].map(h => (
                        <th key={h} style={{ padding: '3px 4px', color: T.tx3, fontWeight: 600, textAlign: 'left' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {session.messages.flatMap(m => (m.toolCalls || []).map((tc, j) => (
                      <tr key={`${m.id}-${j}`} style={{ borderBottom: `1px solid ${T.border}` }}>
                        <td style={{ padding: '3px 4px', color: T.tx3 }}>{m.timestamp}</td>
                        <td style={{ padding: '3px 4px', color: T.tx1 }}>tool_call</td>
                        <td style={{ padding: '3px 4px', color: T.brand }}>{tc.name}</td>
                        <td style={{ padding: '3px 4px' }}>
                          <span style={{ color: tc.status === 'success' ? T.up : T.dn }}>{tc.status}</span>
                        </td>
                        <td style={{ padding: '3px 4px', color: T.tx2 }}>{tc.duration}ms</td>
                        <td style={{ padding: '3px 4px' }}>
                          {m.complianceFlag && <span style={{ color: m.complianceFlag === 'pass' ? T.up : m.complianceFlag === 'warn' ? T.warn : T.dn }}>{m.complianceFlag}</span>}
                        </td>
                      </tr>
                    )))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
        {/* Sidebar */}
        <div style={{ width: '220px', borderLeft: `1px solid ${T.border}`, padding: '8px', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', background: T.bg1 }}>
          <SessionStatsPanel session={session} />
          <div style={{ background: T.bg2, borderRadius: T.r, padding: '6px', fontSize: '8px' }}>
            <div style={{ fontWeight: 700, color: T.tx0, marginBottom: '4px' }}>Quick Actions</div>
            {['Analyze portfolio risk', 'Screen for high momentum', 'Check earnings calendar', 'Review open positions', 'Generate daily report'].map(a => (
              <div key={a} style={{ padding: '3px 0', color: T.brand, cursor: 'pointer', borderBottom: `1px solid ${T.border}` }}>{a}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export { NovaUI2 };
