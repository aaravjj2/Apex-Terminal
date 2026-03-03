/**
 * ┌───────────────────────────────────────────────────────────────────────┐
 * │  APEX TERMINAL — Research Queue Manager (UI2)                       │
 * │  Pipeline of research tasks: idea → hypothesis → backtest → review  │
 * │  Kanban board, priority scoring, assignment, notes, attachments     │
 * └───────────────────────────────────────────────────────────────────────┘
 */
import React, { useState, useMemo } from 'react';

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
interface ResearchItem {
  id: string;
  title: string;
  description: string;
  stage: 'idea' | 'hypothesis' | 'backtest' | 'review' | 'approved' | 'rejected';
  priority: 'critical' | 'high' | 'medium' | 'low';
  assignee: string;
  tags: string[];
  created: string;
  updated: string;
  score: number;
  notes: string;
  attachments: number;
  expectedSharpe: number;
  complexity: number;
}

const STAGES = ['idea', 'hypothesis', 'backtest', 'review', 'approved', 'rejected'] as const;
const STAGE_COLORS: Record<string, string> = { idea: T.info, hypothesis: T.purple, backtest: T.warn, review: T.brand, approved: T.up, rejected: T.dn };
const PRIORITY_COLORS: Record<string, string> = { critical: T.dn, high: T.warn, medium: T.info, low: T.tx3 };

/* ── Mock ─────────────────────────────────────────────────────────────── */
function generateResearchItems(): ResearchItem[] {
  const items: { title: string; desc: string; stage: ResearchItem['stage']; priority: ResearchItem['priority']; tags: string[] }[] = [
    { title: 'Mean Reversion with Bollinger Band Squeeze', desc: 'Entry on BB squeeze breakout with volume confirmation', stage: 'backtest', priority: 'high', tags: ['mean-reversion', 'equity', 'intraday'] },
    { title: 'Cross-Asset Momentum (Equities + Commodities)', desc: 'Dual momentum across SPY/GLD/TLT/USO with regime filter', stage: 'review', priority: 'critical', tags: ['momentum', 'cross-asset', 'monthly'] },
    { title: 'Volatility Risk Premium Harvest', desc: 'Systematic short straddle on SPX with delta hedging', stage: 'hypothesis', priority: 'high', tags: ['options', 'volatility', 'premium'] },
    { title: 'Earnings Drift Anomaly — NLP Enhanced', desc: 'Post-earnings drift with NLP sentiment on earnings calls', stage: 'idea', priority: 'medium', tags: ['earnings', 'NLP', 'event'] },
    { title: 'Pairs Trading: Cointegration Scanner', desc: 'Automated cointegration pairs with Kalman filter hedge ratio', stage: 'backtest', priority: 'high', tags: ['pairs', 'stat-arb', 'equity'] },
    { title: 'Intraday VWAP Deviation Strategy', desc: 'Mean reversion to VWAP with order flow imbalance trigger', stage: 'idea', priority: 'medium', tags: ['intraday', 'VWAP', 'microstructure'] },
    { title: 'Macro Regime Switch Model', desc: 'HMM-based regime detection for tactical asset allocation', stage: 'hypothesis', priority: 'critical', tags: ['macro', 'regime', 'HMM', 'allocation'] },
    { title: 'Crypto Funding Rate Arbitrage', desc: 'Long spot / short perps when funding is elevated', stage: 'approved', priority: 'medium', tags: ['crypto', 'arbitrage', 'funding'] },
    { title: 'Options Skew Trading Strategy', desc: 'Trade put-call skew normalization after extreme readings', stage: 'review', priority: 'high', tags: ['options', 'skew', 'volatility'] },
    { title: 'Sector Rotation with Economic Cycle', desc: 'Rotate sectors based on leading economic indicators', stage: 'idea', priority: 'low', tags: ['sector', 'macro', 'rotation'] },
    { title: 'Tail Risk Hedging Portfolio', desc: 'Systematic OTM put buying with volatility timing', stage: 'rejected', priority: 'low', tags: ['hedging', 'tail-risk', 'options'] },
    { title: 'Statistical Momentum with Ranking', desc: 'Cross-sectional momentum with Fama-French factor neutralization', stage: 'backtest', priority: 'medium', tags: ['momentum', 'factor', 'equity'] },
    { title: 'FX Carry with Crash Protection', desc: 'G10 carry trade with draw‐down stop and vol targeting', stage: 'hypothesis', priority: 'medium', tags: ['FX', 'carry', 'risk-management'] },
    { title: 'ESG Alpha Signal Extraction', desc: 'Long high-ESG / short low-ESG with sector neutralization', stage: 'idea', priority: 'low', tags: ['ESG', 'factor', 'long-short'] },
    { title: 'Dark Pool Flow Momentum', desc: 'Trading signals from unusual dark pool activity', stage: 'backtest', priority: 'high', tags: ['darkpool', 'flow', 'institutional'] },
    { title: 'Bond Butterfly Spread Optimization', desc: '2-5-10Y butterfly using PCA on yield curve', stage: 'hypothesis', priority: 'medium', tags: ['fixed-income', 'curve', 'PCA'] },
  ];

  return items.map((item, i) => ({
    id: `RQ-${String(i + 1).padStart(3, '0')}`,
    title: item.title,
    description: item.desc,
    stage: item.stage,
    priority: item.priority,
    assignee: ['Alex K.', 'Sarah M.', 'David L.', 'Emma R.', 'James W.'][i % 5],
    tags: item.tags,
    created: `2024-0${1 + Math.floor(i / 5)}-${String(10 + i).padStart(2, '0')}`,
    updated: `2024-03-${String(15 + (i % 8)).padStart(2, '0')}`,
    score: Math.round(30 + Math.random() * 70),
    notes: `${Math.floor(Math.random() * 8)} research notes attached`,
    attachments: Math.floor(Math.random() * 5),
    expectedSharpe: +(0.3 + Math.random() * 2).toFixed(2),
    complexity: Math.ceil(Math.random() * 5),
  }));
}

/* ── Sub Components ──────────────────────────────────────────────────── */
function KanbanCard({ item }: { item: ResearchItem }) {
  return (
    <div style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '6px', marginBottom: '4px', cursor: 'pointer' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
        <span style={{ fontSize: '7px', color: T.tx3, fontFamily: T.mono }}>{item.id}</span>
        <span style={{ fontSize: '7px', padding: '1px 4px', borderRadius: '2px', background: `${PRIORITY_COLORS[item.priority]}20`, color: PRIORITY_COLORS[item.priority], fontWeight: 700 }}>
          {item.priority}
        </span>
      </div>
      <div style={{ fontSize: '8px', fontWeight: 700, color: T.tx0, lineHeight: 1.3, marginBottom: '3px' }}>{item.title}</div>
      <div style={{ fontSize: '7px', color: T.tx3, marginBottom: '4px', lineHeight: 1.2 }}>{item.description.slice(0, 60)}...</div>
      <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap', marginBottom: '4px' }}>
        {item.tags.slice(0, 3).map(tag => (
          <span key={tag} style={{ fontSize: '6px', padding: '1px 3px', borderRadius: '2px', background: T.bg3, color: T.tx2 }}>{tag}</span>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '7px' }}>
        <span style={{ color: T.tx3 }}>{item.assignee}</span>
        <span style={{ color: T.info, fontFamily: T.mono }}>E[SR]: {item.expectedSharpe}</span>
      </div>
    </div>
  );
}

function KanbanBoard({ items }: { items: ResearchItem[] }) {
  return (
    <div style={{ display: 'flex', gap: '6px', overflow: 'auto', minHeight: 0 }}>
      {STAGES.map(stage => {
        const stageItems = items.filter(i => i.stage === stage);
        return (
          <div key={stage} style={{ flex: '1 1 180px', minWidth: 170, background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '6px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: STAGE_COLORS[stage] }} />
              <span style={{ fontSize: '9px', fontWeight: 700, color: T.tx0, textTransform: 'uppercase' }}>{stage}</span>
              <span style={{ fontSize: '8px', color: T.tx3, fontFamily: T.mono, marginLeft: 'auto' }}>{stageItems.length}</span>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: '4px' }}>
              {stageItems.map(item => <KanbanCard key={item.id} item={item} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ListView({ items }: { items: ResearchItem[] }) {
  return (
    <div style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '8px' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8px', fontFamily: T.mono }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${T.border2}` }}>
            {['ID', 'Title', 'Stage', 'Priority', 'Assignee', 'Score', 'E[SR]', 'Tags', 'Updated'].map(h => (
              <th key={h} style={{ padding: '3px 4px', color: T.tx3, fontWeight: 600, textAlign: h === 'Title' ? 'left' : 'center' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map(item => (
            <tr key={item.id} style={{ borderBottom: `1px solid ${T.border}`, cursor: 'pointer' }}>
              <td style={{ padding: '3px 4px', color: T.tx3, textAlign: 'center' }}>{item.id}</td>
              <td style={{ padding: '3px 4px', textAlign: 'left' }}>
                <div style={{ color: T.tx0, fontWeight: 600 }}>{item.title}</div>
                <div style={{ color: T.tx3, fontSize: '7px' }}>{item.description.slice(0, 50)}...</div>
              </td>
              <td style={{ padding: '3px 4px', textAlign: 'center' }}>
                <span style={{ fontSize: '7px', padding: '1px 4px', borderRadius: '2px', background: `${STAGE_COLORS[item.stage]}20`, color: STAGE_COLORS[item.stage] }}>
                  {item.stage}
                </span>
              </td>
              <td style={{ padding: '3px 4px', textAlign: 'center' }}>
                <span style={{ fontSize: '7px', padding: '1px 4px', borderRadius: '2px', background: `${PRIORITY_COLORS[item.priority]}20`, color: PRIORITY_COLORS[item.priority] }}>
                  {item.priority}
                </span>
              </td>
              <td style={{ padding: '3px 4px', color: T.tx2, textAlign: 'center' }}>{item.assignee}</td>
              <td style={{ padding: '3px 4px', textAlign: 'center' }}>
                <span style={{ color: item.score > 70 ? T.up : item.score > 40 ? T.warn : T.tx3 }}>{item.score}</span>
              </td>
              <td style={{ padding: '3px 4px', color: T.info, textAlign: 'center' }}>{item.expectedSharpe}</td>
              <td style={{ padding: '3px 4px', textAlign: 'center' }}>
                <div style={{ display: 'flex', gap: '2px', justifyContent: 'center', flexWrap: 'wrap' }}>
                  {item.tags.slice(0, 2).map(tag => (
                    <span key={tag} style={{ fontSize: '6px', padding: '1px 3px', borderRadius: '2px', background: T.bg3, color: T.tx2 }}>{tag}</span>
                  ))}
                </div>
              </td>
              <td style={{ padding: '3px 4px', color: T.tx3, textAlign: 'center', fontSize: '7px' }}>{item.updated}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PipelineStats({ items }: { items: ResearchItem[] }) {
  const byStage = STAGES.map(s => ({ stage: s, count: items.filter(i => i.stage === s).length }));
  const total = items.length;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '6px', marginBottom: '8px' }}>
      <div style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '8px', textAlign: 'center' }}>
        <div style={{ fontSize: '8px', color: T.tx3 }}>Total Items</div>
        <div style={{ fontSize: '16px', fontWeight: 800, color: T.tx0, fontFamily: T.mono }}>{total}</div>
      </div>
      {byStage.map(s => (
        <div key={s.stage} style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '8px', textAlign: 'center' }}>
          <div style={{ fontSize: '8px', color: T.tx3 }}>{s.stage.toUpperCase()}</div>
          <div style={{ fontSize: '16px', fontWeight: 800, color: STAGE_COLORS[s.stage], fontFamily: T.mono }}>{s.count}</div>
          <div style={{ width: '100%', height: 3, background: T.bg3, borderRadius: 2, marginTop: '3px' }}>
            <div style={{ width: `${(s.count / total) * 100}%`, height: '100%', background: STAGE_COLORS[s.stage], borderRadius: 2 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════ */
/* MAIN                                                                  */
/* ═══════════════════════════════════════════════════════════════════════ */
type RQTab = 'kanban' | 'list' | 'stats';

export default function ResearchQueueUI2() {
  const [tab, setTab] = useState<RQTab>('kanban');
  const [filterPriority, setFilterPriority] = useState('all');
  const items = useMemo(() => generateResearchItems(), []);
  const filtered = filterPriority === 'all' ? items : items.filter(i => i.priority === filterPriority);

  return (
    <div data-testid="research-queue-page" style={{ display: 'flex', flexDirection: 'column', height: '100%', background: T.bg0, fontFamily: T.sans, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '6px 10px', gap: '8px', background: T.bg1, borderBottom: `1px solid ${T.border}`, flexShrink: 0, flexWrap: 'wrap' }}>
        <span style={{ fontSize: '12px', fontWeight: 800, color: T.tx0 }}>RESEARCH QUEUE</span>
        <div style={{ height: 14, width: 1, background: T.border2 }} />
        <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}
          style={{ background: T.bg3, color: T.tx1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '2px 6px', fontSize: '8px', fontFamily: T.mono }}>
          <option value="all">All Priorities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: '8px', color: T.tx3, fontFamily: T.mono }}>{filtered.length} items</span>
      </div>
      <div style={{ display: 'flex', borderBottom: `1px solid ${T.border}`, background: T.bg1, flexShrink: 0 }}>
        {([
          { key: 'kanban' as RQTab, label: '📋 Kanban' },
          { key: 'list' as RQTab, label: '📄 List' },
          { key: 'stats' as RQTab, label: '📊 Stats' },
        ]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            background: tab === t.key ? T.bg3 : 'transparent', color: tab === t.key ? T.tx0 : T.tx3,
            border: 'none', padding: '6px 14px', fontSize: '9px', fontWeight: 600, cursor: 'pointer',
            borderBottom: tab === t.key ? `2px solid ${T.brand}` : '2px solid transparent',
          }}>{t.label}</button>
        ))}
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
        {tab === 'kanban' && <KanbanBoard items={filtered} />}
        {tab === 'list' && <ListView items={filtered} />}
        {tab === 'stats' && <PipelineStats items={filtered} />}
      </div>
    </div>
  );
}

export { ResearchQueueUI2 };
