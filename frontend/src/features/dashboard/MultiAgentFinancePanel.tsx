const BG='#0a0a0a'; const PANEL='#111111'; const BORDER='#1e1e1e';
const AMBER='#f5a623'; const GREEN='#26a69a'; const RED='#ef5350';
const BLUE='#42a5f5'; const PURPLE='#ab47bc'; const SUBTLE='#555';
const TEXT='#d1d4dc'; const MONO='"Roboto Mono","Courier New",monospace';

import { useState, useCallback } from 'react';

interface StockAnalysis { symbol: string; price: number; change: number; change_pct: number; recommendation: 'strong_buy'|'buy'|'hold'|'sell'|'strong_sell'; target_price: number; analyst_count: number; news_sentiment: number; technical_score: number; fundamental_score: number; }
interface NewsItem { title: string; source: string; published: string; sentiment: 'positive'|'neutral'|'negative'; url: string; }
interface AgentTask { id: string; agent: string; task: string; status: 'pending'|'running'|'completed'|'error'; }

const fmtCur = (v: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v);
const fmtPct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;

const AGENTS = [
  { id: 'market-analyst', name: 'Market Analyst', desc: 'Market conditions, trends, sector performance', icon: '' },
  { id: 'stock-researcher', name: 'Stock Researcher', desc: 'Company fundamentals and technicals', icon: '' },
  { id: 'sentiment-analyzer', name: 'Sentiment Agent', desc: 'News and social sentiment signals', icon: '' },
  { id: 'risk-assessor', name: 'Risk Assessor', desc: 'Position and portfolio risk levels', icon: '' },
];

const REC_COLOR: Record<string, string> = { strong_buy: GREEN, buy: GREEN + '88', hold: AMBER, sell: RED + '88', strong_sell: RED };
const REC_LABEL: Record<string, string> = { strong_buy: 'STRONG BUY', buy: 'BUY', hold: 'HOLD', sell: 'SELL', strong_sell: 'STRONG SELL' };
const SENT_COLOR: Record<string, string> = { positive: GREEN, neutral: SUBTLE, negative: RED };
const TASK_COLOR: Record<string, string> = { pending: SUBTLE, running: BLUE, completed: GREEN, error: RED };

function ScoreBar({ score }: { score: number }) {
  const pct = Math.max(0, Math.min(100, score * 100));
  const c = score >= 0.7 ? GREEN : score >= 0.4 ? AMBER : RED;
  return <div style={{ height: 4, background: BORDER, borderRadius: 2, overflow: 'hidden' }}><div style={{ height: '100%', width: `${pct}%`, background: c }} /></div>;
}

function StockCard({ a }: { a: StockAnalysis }) {
  return (
    <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 2, padding: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>{a.symbol}</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: REC_COLOR[a.recommendation], border: `1px solid ${REC_COLOR[a.recommendation]}44`, borderRadius: 2, padding: '1px 5px' }}>{REC_LABEL[a.recommendation]}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: TEXT, fontFamily: MONO }}>{fmtCur(a.price)}</span>
            <span style={{ fontSize: 11, color: a.change >= 0 ? GREEN : RED, fontFamily: MONO }}>{a.change >= 0 ? '' : ''} {fmtPct(a.change_pct)}</span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 10, color: SUBTLE }}>TARGET</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: BLUE, fontFamily: MONO }}>{fmtCur(a.target_price)}</div>
          <div style={{ fontSize: 10, color: SUBTLE }}>{a.analyst_count} analysts</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, paddingTop: 10, borderTop: `1px solid ${BORDER}` }}>
        {[{ label: 'TECHNICAL', score: a.technical_score }, { label: 'FUNDAMENTAL', score: a.fundamental_score }, { label: 'SENTIMENT', score: (a.news_sentiment + 1) / 2 }].map(s => (
          <div key={s.label} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: SUBTLE, marginBottom: 4 }}>{s.label}</div>
            <ScoreBar score={s.score} />
          </div>
        ))}
      </div>
    </div>
  );
}

function NewsCard({ news }: { news: NewsItem }) {
  return (
    <div style={{ display: 'flex', gap: 10, padding: '8px 12px', borderBottom: `1px solid ${BORDER}` }}>
      <span style={{ color: SENT_COLOR[news.sentiment], fontSize: 12, marginTop: 1 }}>{news.sentiment === 'positive' ? '' : news.sentiment === 'negative' ? '' : ''}</span>
      <div style={{ flex: 1 }}>
        <a href={news.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: TEXT, textDecoration: 'none' }}>{news.title}</a>
        <div style={{ fontSize: 10, color: SUBTLE, marginTop: 3 }}>{news.source}  {news.published}</div>
      </div>
    </div>
  );
}

export function MultiAgentFinancePanel() {
  const [query, setQuery] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [analyses, setAnalyses] = useState<StockAnalysis[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [agentResponse, setAgentResponse] = useState('');

  const runAnalysis = useCallback(async () => {
    if (!query.trim()) return;
    setIsAnalyzing(true); setAgentResponse(''); setTasks([]);
    const symbols = query.toUpperCase().match(/[A-Z]{1,5}/g) || ['AAPL'];
    const newTasks: AgentTask[] = AGENTS.map((a, i) => ({ id: String(i), agent: a.id, task: `${a.desc}...`, status: 'pending' as const }));
    setTasks(newTasks);
    for (let i = 0; i < newTasks.length; i++) {
      await new Promise(r => setTimeout(r, 800));
      setTasks(prev => prev.map((t, idx) => idx === i ? { ...t, status: 'running' } : t));
      await new Promise(r => setTimeout(r, 1200 + Math.random() * 800));
      setTasks(prev => prev.map((t, idx) => idx === i ? { ...t, status: 'completed' } : t));
    }
    const recs: StockAnalysis['recommendation'][] = ['strong_buy', 'buy', 'hold', 'sell'];
    const mockAnalyses: StockAnalysis[] = symbols.slice(0, 4).map(sym => ({
      symbol: sym, price: 150 + Math.random() * 200, change: (Math.random() - 0.5) * 10,
      change_pct: (Math.random() - 0.5) * 5, recommendation: recs[Math.floor(Math.random() * 4)],
      target_price: 160 + Math.random() * 200, analyst_count: Math.floor(10 + Math.random() * 30),
      news_sentiment: (Math.random() - 0.5) * 2, technical_score: Math.random(), fundamental_score: Math.random()
    }));
    setAnalyses(mockAnalyses);
    setNews([
      { title: `${symbols[0]} Reports Strong Q4 Earnings, Beats Expectations`, source: 'MarketWatch', published: '2h ago', sentiment: 'positive', url: '#' },
      { title: `Analysts Upgrade ${symbols[0]} on Cloud Growth Momentum`, source: 'Bloomberg', published: '4h ago', sentiment: 'positive', url: '#' },
      { title: 'Tech Sector Faces Headwinds Amid Rate Concerns', source: 'Reuters', published: '6h ago', sentiment: 'negative', url: '#' },
      { title: 'Market Volatility Expected to Continue This Week', source: 'CNBC', published: '8h ago', sentiment: 'neutral', url: '#' },
    ]);
    const posCount = mockAnalyses.filter(a => ['strong_buy','buy'].includes(a.recommendation)).length;
    setAgentResponse(`Analysis Complete  ${posCount}/${mockAnalyses.length} stocks rated BUY/STRONG BUY. Top pick: ${mockAnalyses.sort((a,b)=>(b.technical_score+b.fundamental_score)-(a.technical_score+a.fundamental_score))[0]?.symbol}`);
    setIsAnalyzing(false);
  }, [query]);

  const tabStyle = (active: boolean): React.CSSProperties => ({ fontSize: 10, padding: '4px 10px', background: active ? BLUE : PANEL, color: active ? '#000' : TEXT, border: `1px solid ${active ? BLUE : BORDER}`, borderRadius: 2, cursor: 'pointer', fontFamily: MONO });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: BG, color: TEXT, fontFamily: MONO, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', borderBottom: `1px solid ${BORDER}`, flexShrink: 0, background: PANEL }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}> AI FINANCE AGENT TEAM</span>
        <span style={{ fontSize: 10, color: BLUE, border: `1px solid ${BLUE}44`, borderRadius: 2, padding: '2px 8px' }}>{AGENTS.length} AGENTS READY</span>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left: Query + Tasks */}
        <div style={{ width: '33%', borderRight: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: 12, borderBottom: `1px solid ${BORDER}` }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <input type="text" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && runAnalysis()} placeholder="Analyze AAPL vs GOOGL..." style={{ flex: 1, background: BG, color: TEXT, border: `1px solid ${BORDER}`, borderRadius: 2, padding: '7px 10px', fontSize: 11, fontFamily: MONO }} />
              <button onClick={runAnalysis} disabled={isAnalyzing || !query.trim()} style={{ padding: '7px 12px', background: isAnalyzing || !query.trim() ? BORDER : BLUE, color: '#000', border: 'none', borderRadius: 2, cursor: 'pointer', fontSize: 12, fontFamily: MONO }}>{isAnalyzing ? '' : ''}</button>
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              {['AAPL','NVDA','GOOGL','SPY'].map(sym => (
                <button key={sym} onClick={() => setQuery(`Analyze ${sym}`)} style={tabStyle(false)}>{sym}</button>
              ))}
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: SUBTLE, marginBottom: 8 }}>AGENT TASKS</div>
            {tasks.length === 0 ? (
              <div style={{ fontSize: 11, color: SUBTLE, textAlign: 'center', paddingTop: 20 }}>Enter a query to start analysis</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {tasks.map(task => {
                  const agent = AGENTS.find(a => a.id === task.agent);
                  return (
                    <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: BG, border: `1px solid ${BORDER}`, borderRadius: 2 }}>
                      <span style={{ color: TASK_COLOR[task.status], fontSize: 14 }}>{agent?.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: TEXT }}>{agent?.name}</div>
                        <div style={{ fontSize: 10, color: SUBTLE }}>{task.task}</div>
                      </div>
                      <span style={{ fontSize: 10, color: TASK_COLOR[task.status] }}>{task.status.toUpperCase()}</span>
                    </div>
                  );
                })}
              </div>
            )}
            {agentResponse && (
              <div style={{ marginTop: 12, padding: 10, background: BG, border: `1px solid ${BORDER}`, borderRadius: 2 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: BLUE, marginBottom: 6 }}> TEAM SUMMARY</div>
                <div style={{ fontSize: 11, color: TEXT }}>{agentResponse}</div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Results */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
          {analyses.length > 0 ? (
            <>
              <div style={{ fontSize: 10, fontWeight: 700, color: SUBTLE, marginBottom: 8 }}> STOCK ANALYSIS</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
                {analyses.map(a => <StockCard key={a.symbol} a={a} />)}
              </div>
              <div style={{ fontSize: 10, fontWeight: 700, color: SUBTLE, marginBottom: 8 }}> RELATED NEWS</div>
              <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 2 }}>
                {news.map((n, i) => <NewsCard key={i} news={n} />)}
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}></div>
              <div style={{ fontSize: 14, fontWeight: 700, color: TEXT, marginBottom: 8 }}>AI Finance Team Ready</div>
              <div style={{ fontSize: 11, color: SUBTLE, maxWidth: 340 }}>Multi-agent team: market analysis, stock research, sentiment analysis, and risk assessment.</div>
              <div style={{ display: 'flex', gap: 16, marginTop: 20 }}>
                {AGENTS.map(a => (
                  <div key={a.id} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 24, color: BLUE, marginBottom: 4 }}>{a.icon}</div>
                    <div style={{ fontSize: 10, color: SUBTLE }}>{a.name}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default MultiAgentFinancePanel;