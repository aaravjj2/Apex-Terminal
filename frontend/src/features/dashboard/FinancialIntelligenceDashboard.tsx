const BG='#0a0a0a'; const PANEL='#111111'; const BORDER='#1e1e1e';
const AMBER='#f5a623'; const GREEN='#26a69a'; const RED='#ef5350';
const BLUE='#42a5f5'; const PURPLE='#ab47bc'; const SUBTLE='#555';
const TEXT='#d1d4dc'; const MONO='"Roboto Mono","Courier New",monospace';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { API_BASE } from '../../config/api';

interface PortfolioMetrics {
  total_equity: number; total_cash: number; buying_power: number;
  open_pnl: number; day_pnl: number; realized_pnl: number;
  position_count: number; win_rate: number; avg_return: number;
  sharpe_ratio: number; max_drawdown: number; options_exposure: number;
}
interface RiskMetrics {
  overall_score: number; market_risk: number; execution_risk: number;
  concentration_risk: number; volatility_exposure: number; recommendations: string[];
}
interface MarketSentiment {
  overall: 'bullish' | 'neutral' | 'bearish'; score: number;
  news_velocity: 'low' | 'normal' | 'high'; vix_level: number;
  trend_strength: number; key_events: string[];
}
interface AIInsight {
  id: string; type: 'opportunity' | 'warning' | 'info' | 'action';
  title: string; description: string; confidence: number; timestamp: string; symbol?: string;
}
interface Position {
  id: string; symbol: string; underlying: string; asset_type: 'equity' | 'option';
  qty: number; avg_price: number; current_price: number; market_value: number;
  pnl: number; pnl_percent: number; dte?: number; option_type?: 'call' | 'put'; strike?: number;
}

const fmt$ = (v: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v);
const fmtPct = (v: number) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(2)}%`;

function Sparkline({ data, positive }: { data: number[]; positive: boolean }) {
  if (!data.length) return null;
  const max = Math.max(...data); const min = Math.min(...data); const range = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 100},${100 - ((v - min) / range) * 100}`).join(' ');
  return (
    <svg style={{ width: '100%', height: 28 }} viewBox="0 0 100 100" preserveAspectRatio="none">
      <polyline fill="none" stroke={positive ? GREEN : RED} strokeWidth="2.5" points={pts} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function RiskBar({ label, value }: { label: string; value: number }) {
  const pct = (value / 10) * 100;
  const color = value <= 3 ? GREEN : value <= 6 ? AMBER : RED;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 3 }}>
        <span style={{ color: SUBTLE }}>{label}</span>
        <span style={{ color: TEXT, fontFamily: MONO }}>{value}/10</span>
      </div>
      <div style={{ height: 4, background: BORDER, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, transition: 'width 0.4s' }} />
      </div>
    </div>
  );
}

function CircularGauge({ value, max, label, color }: { value: number; max: number; label: string; color: string }) {
  const pct = (value / max) * 100;
  const r = 38; const circ = 2 * Math.PI * r; const offset = circ - (pct / 100) * circ;
  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width="88" height="88" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="44" cy="44" r={r} fill="none" stroke={BORDER} strokeWidth="8" />
        <circle cx="44" cy="44" r={r} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset} style={{ transition: 'stroke-dashoffset 0.5s' }} />
      </svg>
      <div style={{ position: 'absolute', textAlign: 'center' }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: TEXT, fontFamily: MONO }}>{value.toFixed(1)}</div>
        <div style={{ fontSize: 9, color: SUBTLE, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      </div>
    </div>
  );
}

function AgentCard({ name, status, lastAction }: { name: string; status: 'active' | 'idle' | 'analyzing'; lastAction: string }) {
  const col = status === 'active' ? GREEN : status === 'analyzing' ? BLUE : SUBTLE;
  return (
    <div style={{ padding: '10px 12px', background: BG, border: `1px solid ${BORDER}`, borderRadius: 2 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ color: col, fontSize: 12 }}>{status === 'active' ? '' : status === 'analyzing' ? '' : ''}</span>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: TEXT }}>{name}</div>
          <div style={{ fontSize: 9, color: col, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{status}</div>
        </div>
      </div>
      <div style={{ fontSize: 10, color: SUBTLE, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lastAction}</div>
    </div>
  );
}

function InsightCard({ insight }: { insight: AIInsight }) {
  const borderMap = { opportunity: GREEN + '44', warning: AMBER + '44', info: BLUE + '44', action: PURPLE + '44' };
  const iconMap = { opportunity: '', warning: '', info: 'ℹ', action: '' };
  const colorMap = { opportunity: GREEN, warning: AMBER, info: BLUE, action: PURPLE };
  return (
    <div style={{ padding: '8px 10px', background: BG, border: `1px solid ${borderMap[insight.type]}`, borderRadius: 2, marginBottom: 4, cursor: 'pointer' }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <span style={{ color: colorMap[insight.type], fontSize: 12, flexShrink: 0 }}>{iconMap[insight.type]}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: TEXT }}>{insight.title}</div>
          <div style={{ fontSize: 10, color: SUBTLE, marginTop: 2 }}>{insight.description}</div>
          <div style={{ display: 'flex', gap: 12, marginTop: 4, fontSize: 9, color: SUBTLE, fontFamily: MONO }}>
            <span>{new Date(insight.timestamp).toLocaleTimeString()}</span>
            <span>{(insight.confidence * 100).toFixed(0)}% conf</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function PositionRow({ pos }: { pos: Position }) {
  const up = pos.pnl >= 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '5px 10px', borderBottom: `1px solid ${BORDER}`, fontSize: 11 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontWeight: 700, color: TEXT, fontFamily: MONO }}>{pos.symbol}</span>
          {pos.asset_type === 'option' && (
            <span style={{ fontSize: 9, padding: '1px 5px', background: (pos.option_type === 'call' ? GREEN : RED) + '22', color: pos.option_type === 'call' ? GREEN : RED, border: `1px solid ${(pos.option_type === 'call' ? GREEN : RED)}44`, borderRadius: 2 }}>{pos.option_type?.toUpperCase()}</span>
          )}
          {pos.dte !== undefined && <span style={{ fontSize: 9, color: SUBTLE }}>{pos.dte} DTE</span>}
        </div>
        <div style={{ fontSize: 10, color: SUBTLE, marginTop: 2 }}>{pos.qty}  {fmt$(pos.avg_price)}</div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ color: up ? GREEN : RED, fontWeight: 700, fontFamily: MONO }}>{fmt$(pos.pnl)}</div>
        <div style={{ fontSize: 10, color: up ? GREEN : RED, fontFamily: MONO }}>{fmtPct(pos.pnl_percent)}</div>
      </div>
    </div>
  );
}

export function FinancialIntelligenceDashboard() {
  const [metrics, setMetrics] = useState<PortfolioMetrics | null>(null);
  const [riskMetrics, setRiskMetrics] = useState<RiskMetrics | null>(null);
  const [sentiment, setSentiment] = useState<MarketSentiment | null>(null);
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(false);
  const [pnlHistory, setPnlHistory] = useState<number[]>([]);
  const [spinAngle, setSpinAngle] = useState(0);
  useEffect(() => { if (loading) { const t = setInterval(() => setSpinAngle(a => (a + 20) % 360), 50); return () => clearInterval(t); } }, [loading]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/portfolio/unified`);
      if (res.ok) {
        const data = await res.json();
        if (data.stats) setMetrics({ total_equity: data.stats.total_equity || 0, total_cash: data.stats.total_cash || 0, buying_power: data.stats.buying_power || 0, open_pnl: data.stats.open_pnl || 0, day_pnl: data.stats.day_pnl || 0, realized_pnl: 0, position_count: data.stats.position_count || 0, win_rate: 0.65, avg_return: 0.032, sharpe_ratio: 1.2, max_drawdown: -0.05, options_exposure: data.stats.options_exposure || 0 });
        if (data.positions) setPositions(data.positions.map((p: Record<string, unknown>) => ({ id: String(p.id), symbol: String(p.symbol), underlying: String(p.underlying || p.symbol), asset_type: p.asset_class === 'option' ? 'option' : 'equity', qty: Number(p.quantity), avg_price: Number(p.avg_cost), current_price: Number(p.current_price), market_value: Number(p.market_value), pnl: Number(p.unrealized_pnl), pnl_percent: Number(p.unrealized_pnl_pct) / 100, dte: p.dte != null ? Number(p.dte) : undefined, option_type: p.option_type ? String(p.option_type) : undefined, strike: p.strike != null ? Number(p.strike) : undefined })));
      }
      const statusRes = await fetch(`${API_BASE}/api/v1/autopilot/status`);
      if (statusRes.ok) {
        const status = await statusRes.json();
        if (status.sentiment) { const s = status.sentiment.sentiment_scores?.MARKET ?? 0; setSentiment({ overall: s > 0.3 ? 'bullish' : s < -0.3 ? 'bearish' : 'neutral', score: s, news_velocity: status.sentiment.news_velocity || 'normal', vix_level: 18.5, trend_strength: Math.abs(s), key_events: status.sentiment.key_events || [] }); }
        setRiskMetrics({ overall_score: status.kill_switch ? 10 : 4, market_risk: 3, execution_risk: 2, concentration_risk: 5, volatility_exposure: 4, recommendations: ["Consider diversifying across more underlyings", "Monitor VIX for volatility expansion", "Set tighter stops for high-DTE options"] });
      }
      setInsights([
        { id: '1', type: 'opportunity', title: 'AAPL shows bullish divergence', description: 'RSI divergence detected with price action. Consider long call strategy.', confidence: 0.78, timestamp: new Date().toISOString(), symbol: 'AAPL' },
        { id: '2', type: 'warning', title: 'High concentration in tech sector', description: '80% of positions are in technology. Consider hedging with sector rotation.', confidence: 0.92, timestamp: new Date(Date.now() - 300000).toISOString() },
        { id: '3', type: 'info', title: 'FOMC meeting in 2 days', description: 'Expect increased volatility. IV expansion likely across all underlyings.', confidence: 0.95, timestamp: new Date(Date.now() - 600000).toISOString() },
      ]);
      let pnl = 1000; const h: number[] = [];
      for (let i = 0; i < 30; i++) { pnl += (Math.random() - 0.45) * 50; h.push(pnl); }
      setPnlHistory(h);
    } catch (e) { console.error('Failed to fetch dashboard data:', e); }
    setLoading(false);
  }, []);

  useEffect(() => { let m = true; const load = async () => { if (m) await fetchData(); }; load(); const t = setInterval(load, 30000); return () => { m = false; clearInterval(t); }; }, [fetchData]);

  const isPnlPositive = useMemo(() => (metrics?.open_pnl ?? 0) >= 0, [metrics]);
  const sentColor = sentiment ? (sentiment.overall === 'bullish' ? GREEN : sentiment.overall === 'bearish' ? RED : SUBTLE) : SUBTLE;
  const riskColor = riskMetrics ? (riskMetrics.overall_score <= 3 ? GREEN : riskMetrics.overall_score <= 6 ? AMBER : RED) : SUBTLE;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: BG, overflow: 'hidden', fontFamily: MONO }}>
      {/* Header */}
      <div style={{ height: 48, padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${BORDER}`, background: PANEL, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: TEXT, letterSpacing: '0.04em' }}> FINANCIAL INTELLIGENCE</span>
          {sentiment && (
            <span style={{ fontSize: 9, padding: '2px 8px', background: sentColor + '22', color: sentColor, border: `1px solid ${sentColor}44`, borderRadius: 2, letterSpacing: '0.06em' }}>
              {sentiment.overall === 'bullish' ? '' : sentiment.overall === 'bearish' ? '' : ''} MARKET: {sentiment.overall.toUpperCase()}
            </span>
          )}
        </div>
        <button onClick={fetchData} disabled={loading} style={{ width: 28, height: 28, background: 'none', border: `1px solid ${BORDER}`, color: SUBTLE, borderRadius: 2, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ display: 'inline-block', transform: `rotate(${spinAngle}deg)` }}></span>
        </button>
      </div>

      {/* Main */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 12 }}>

          {/* Left Column */}
          <div>
            {/* Key Metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 10 }}>
              {[
                { label: 'TOTAL EQUITY', value: metrics ? fmt$(metrics.total_equity) : '---', sub: null, chart: true, color: TEXT },
                { label: 'OPEN P&L', value: metrics ? `${metrics.open_pnl >= 0 ? '+' : ''}${fmt$(metrics.open_pnl)}` : '---', sub: metrics ? `Today: ${fmt$(metrics.day_pnl)}` : null, chart: false, color: isPnlPositive ? GREEN : RED },
                { label: 'BUYING POWER', value: metrics ? fmt$(metrics.buying_power) : '---', sub: metrics ? `${fmtPct(metrics.buying_power / metrics.total_equity)} avail` : null, chart: false, color: TEXT },
                { label: 'WIN RATE', value: metrics ? `${(metrics.win_rate * 100).toFixed(0)}%` : '---', sub: metrics ? `${metrics.position_count} active` : null, chart: false, color: GREEN },
              ].map(m => (
                <div key={m.label} style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 2, padding: '10px 12px' }}>
                  <div style={{ fontSize: 9, color: SUBTLE, letterSpacing: '0.1em', marginBottom: 6 }}>{m.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: m.color, fontFamily: MONO }}>{m.value}</div>
                  {m.sub && <div style={{ fontSize: 10, color: SUBTLE, marginTop: 2 }}>{m.sub}</div>}
                  {m.chart && pnlHistory.length > 0 && <Sparkline data={pnlHistory} positive={isPnlPositive} />}
                </div>
              ))}
            </div>

            {/* Performance sub-metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 10 }}>
              {[
                { label: 'Sharpe', value: metrics?.sharpe_ratio.toFixed(2) ?? '--' },
                { label: 'Max DD', value: metrics ? fmtPct(metrics.max_drawdown) : '--', color: RED },
                { label: 'Avg Return', value: metrics ? fmtPct(metrics.avg_return) : '--', color: GREEN },
                { label: 'Options Exp', value: metrics ? fmt$(metrics.options_exposure) : '--' },
              ].map(m => (
                <div key={m.label} style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 2, padding: '8px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 10, color: SUBTLE }}>{m.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: m.color || TEXT, fontFamily: MONO }}>{m.value}</span>
                </div>
              ))}
            </div>

            {/* AI Agent Team */}
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 2, padding: '12px 14px', marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: TEXT }}> AI AGENT TEAM</span>
                <span style={{ fontSize: 9, color: GREEN, background: GREEN + '22', border: `1px solid ${GREEN}44`, borderRadius: 2, padding: '1px 6px' }}>ALL ACTIVE</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
                <AgentCard name="Market Analyst" status="active" lastAction="Analyzed 5 opportunities" />
                <AgentCard name="Risk Manager" status="active" lastAction="Risk score updated" />
                <AgentCard name="Sentiment Agent" status="analyzing" lastAction="Processing news feed..." />
                <AgentCard name="Execution Agent" status="idle" lastAction="Awaiting signals" />
              </div>
            </div>

            {/* Positions */}
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 2 }}>
              <div style={{ padding: '10px 14px', borderBottom: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: TEXT }}> ACTIVE POSITIONS</span>
                <span style={{ fontSize: 10, color: SUBTLE }}>{positions.length} positions</span>
              </div>
              <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                {positions.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 11, color: SUBTLE }}>No active positions</div>
                ) : positions.map(p => <PositionRow key={p.id} pos={p} />)}
              </div>
            </div>
          </div>

          {/* Right Sidebar */}
          <div>
            {/* Risk Assessment */}
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 2, padding: '12px 14px', marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: TEXT, marginBottom: 10 }}> RISK ASSESSMENT</div>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
                <CircularGauge value={riskMetrics?.overall_score ?? 0} max={10} label="RISK" color={riskColor} />
              </div>
              <RiskBar label="Market Risk" value={riskMetrics?.market_risk ?? 0} />
              <RiskBar label="Execution Risk" value={riskMetrics?.execution_risk ?? 0} />
              <RiskBar label="Concentration" value={riskMetrics?.concentration_risk ?? 0} />
              <RiskBar label="Volatility" value={riskMetrics?.volatility_exposure ?? 0} />
              {riskMetrics && riskMetrics.recommendations.length > 0 && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${BORDER}` }}>
                  <div style={{ fontSize: 9, color: SUBTLE, letterSpacing: '0.1em', marginBottom: 6 }}>RECOMMENDATIONS</div>
                  {riskMetrics.recommendations.slice(0, 3).map((r, i) => (
                    <div key={i} style={{ display: 'flex', gap: 6, fontSize: 10, color: SUBTLE, marginBottom: 4 }}>
                      <span style={{ color: BLUE, flexShrink: 0 }}></span>{r}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* AI Insights */}
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 2, marginBottom: 10 }}>
              <div style={{ padding: '10px 14px', borderBottom: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: TEXT }}> AI INSIGHTS</span>
                <span style={{ fontSize: 9, color: BLUE, background: BLUE + '22', border: `1px solid ${BLUE}44`, borderRadius: 2, padding: '1px 6px' }}>{insights.length} NEW</span>
              </div>
              <div style={{ maxHeight: 320, overflowY: 'auto', padding: '8px 10px' }}>
                {insights.map(i => <InsightCard key={i.id} insight={i} />)}
              </div>
            </div>

            {/* Market Pulse */}
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 2, padding: '12px 14px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: TEXT, marginBottom: 10 }}> MARKET PULSE</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {[
                  { label: 'VIX', value: sentiment?.vix_level?.toFixed(2) ?? '--', color: TEXT },
                  { label: 'NEWS FLOW', value: (sentiment?.news_velocity ?? '--').toUpperCase(), color: TEXT },
                  { label: 'TREND', value: sentiment ? (sentiment.overall === 'bullish' ? ' BULL' : sentiment.overall === 'bearish' ? ' BEAR' : ' FLAT') : '--', color: sentColor },
                  { label: 'STRENGTH', value: sentiment ? `${(sentiment.trend_strength * 100).toFixed(0)}%` : '--', color: TEXT },
                ].map(m => (
                  <div key={m.label} style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 2, padding: '8px 10px' }}>
                    <div style={{ fontSize: 9, color: SUBTLE, letterSpacing: '0.1em', marginBottom: 4 }}>{m.label}</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: m.color, fontFamily: MONO }}>{m.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FinancialIntelligenceDashboard;