/**
 * Research Agent — 4-node deterministic state machine UI.
 * Blueprint: OSI → BSM/Greeks/IV → FinBERT sentiment → Conformal PID/SPCI synthesis.
 */
import { useState } from 'react';

import { useResearchAgent } from '@/research/hooks/useResearchAgent';
import type { TradePlanPayload } from '@/research/types/tradePlan';
import { cn } from '@/tcc/lib/cn';

import '@/research/styles/research-agent.css';

const NODES = [
  { id: 1, key: 'node_1_orchestrator', label: 'Orchestrator', sub: 'OSI parse · MCP' },
  { id: 2, key: 'node_2_quantitative', label: 'Quant Engine', sub: 'BSM · Newton IV' },
  { id: 3, key: 'node_3_sentiment', label: 'Sentiment', sub: 'FinBERT · Ontology' },
  { id: 4, key: 'node_4_synthesis', label: 'Synthesis', sub: 'PID · SPCI' },
] as const;

const DEFAULT_OSI = 'SPY   251219C00600000';

function nodeStatus(plan: TradePlanPayload | null, key: string): string {
  if (!plan?.pipeline_nodes) return 'idle';
  return plan.pipeline_nodes[key] ?? 'idle';
}

export default function ResearchAgentUI2() {
  const agent = useResearchAgent();
  const [osi, setOsi] = useState(DEFAULT_OSI);
  const [news, setNews] = useState('SPY beats earnings estimates; guidance raised for next quarter');
  const [marketMid, setMarketMid] = useState('12.60');
  const [autoFetchNews, setAutoFetchNews] = useState(true);

  const underlying = osi.trim().split(/\s+/)[0] || 'SPY';

  const handleFetchNews = () => {
    void agent.fetchNews(underlying).then((text) => {
      if (text) setNews(text);
    });
  };

  const handleRun = () => {
    void agent.run({
      osi_symbol: osi.length === 21 ? osi : undefined,
      occ_symbol: osi.length !== 21 ? osi.replace(/\s/g, '') : undefined,
      news_text: news,
      market_mid: parseFloat(marketMid) || undefined,
      fetch_news: autoFetchNews && !news.trim(),
    });
  };

  const plan = agent.plan;

  return (
    <div className="ra-shell" data-testid="research-agent-page">
      <header className="ra-header">
        <div>
          <h1 className="ra-title">Research Agent</h1>
          <p className="ra-sub">
            4-node state machine · LLM-free · {agent.status?.version ?? '…'}
          </p>
        </div>
        <div className="ra-meta">
          {agent.status?.mcp_sse_mounted ? (
            <span className="ra-chip ra-chip--ok" data-testid="ra-mcp-badge">MCP SSE</span>
          ) : (
            <span className="ra-chip" data-testid="ra-mcp-badge">MCP off</span>
          )}
          <span className="ra-chip" data-testid="ra-finbert-badge">
            {agent.status?.finbert_available ? 'FinBERT' : 'Lexicon'}
          </span>
          <span className="ra-chip" data-testid="ra-news-badge">
            {agent.status?.finnhub_configured ? 'Finnhub' : 'RSS+yfinance'}
          </span>
        </div>
        <div className="ra-actions">
          <button type="button" className="ra-btn" disabled={agent.busy} onClick={() => agent.runDemo()} data-testid="ra-demo">
            Blueprint Demo
          </button>
          <button type="button" className="ra-btn ra-btn--primary" disabled={agent.busy} onClick={handleRun} data-testid="ra-run">
            {agent.busy ? 'Running…' : 'Run Pipeline'}
          </button>
          <button
            type="button"
            className="ra-btn ra-btn--accent"
            disabled={agent.busy || plan?.synthesis_and_risk.execution_status !== 'APPROVED'}
            onClick={() => void agent.submitHandshake()}
            data-testid="ra-handshake"
          >
            TCC Handshake
          </button>
        </div>
      </header>

      <section className="ra-nodes" data-testid="ra-nodes">
        {NODES.map((n) => {
          const st = nodeStatus(plan, n.key);
          return (
            <div key={n.id} className={cn('ra-node', st === 'COMPLETE' || st === 'APPROVED' ? 'ra-node--ok' : st === 'REJECTED' ? 'ra-node--bad' : st !== 'idle' ? 'ra-node--active' : '')}>
              <span className="ra-node__id">N{n.id}</span>
              <span className="ra-node__label">{n.label}</span>
              <span className="ra-node__sub">{n.sub}</span>
              <span className="ra-node__status">{plan ? st : '—'}</span>
            </div>
          );
        })}
      </section>

      <section className="ra-inputs" aria-label="Run inputs">
        <label>
          OSI / OCC
          <input value={osi} onChange={(e) => setOsi(e.target.value)} data-testid="ra-osi" className="ra-input" />
        </label>
        <label>
          News text
          <input value={news} onChange={(e) => setNews(e.target.value)} className="ra-input ra-input--wide" data-testid="ra-news" />
        </label>
        <label>
          Market mid
          <input value={marketMid} onChange={(e) => setMarketMid(e.target.value)} className="ra-input ra-input--sm" />
        </label>
        <label className="ra-check">
          <input type="checkbox" checked={autoFetchNews} onChange={(e) => setAutoFetchNews(e.target.checked)} />
          Auto-fetch news when empty
        </label>
        <button type="button" className="ra-btn" disabled={agent.busy} onClick={handleFetchNews} data-testid="ra-fetch-news">
          Fetch Live News
        </button>
      </section>

      {agent.newsPreview.length ? (
        <section className="ra-news-preview" data-testid="ra-news-preview">
          {agent.newsPreview.slice(0, 3).map((a) => (
            <button
              key={`${a.headline}-${a.published_at}`}
              type="button"
              className="ra-news-item"
              onClick={() => setNews(a.summary ? `${a.headline}. ${a.summary}` : a.headline)}
            >
              <span className="ra-news-item__src">{a.provider}</span>
              <span className="ra-news-item__headline">{a.headline}</span>
            </button>
          ))}
        </section>
      ) : null}

      {agent.error ? <div className="ra-error" data-testid="ra-error">{agent.error}</div> : null}

      {plan ? (
        <div className="ra-payload" data-testid="ra-payload">
          <div className="ra-payload__hdr">
            <span className="ra-mono">{plan.trade_plan_id}</span>
            <span className={cn('ra-badge', plan.synthesis_and_risk.execution_status === 'APPROVED' ? 'ra-badge--ok' : plan.synthesis_and_risk.execution_status === 'REJECTED' ? 'ra-badge--bad' : 'ra-badge--warn')}>
              {plan.synthesis_and_risk.execution_status}
            </span>
            {plan.research_quality ? (
              <span className={cn('ra-badge', plan.research_quality.score >= 70 ? 'ra-badge--ok' : plan.research_quality.score >= 50 ? 'ra-badge--warn' : 'ra-badge--bad')} data-testid="ra-quality-score">
                Quality {plan.research_quality.score} ({plan.research_quality.grade})
              </span>
            ) : null}
            <span className="ra-strategy">{plan.synthesis_and_risk.recommended_strategy}</span>
          </div>

          {plan.research_quality?.warnings?.length ? (
            <div className="ra-warnings" data-testid="ra-warnings">
              {plan.research_quality.warnings.map((w) => (
                <span key={w} className="ra-chip ra-chip--warn">{w}</span>
              ))}
            </div>
          ) : null}

          <div className="ra-grid">
            <Panel title="Node 1 · Orchestrator">
              <Row k="Underlying" v={plan.orchestrator_node.parsed_components.underlying} />
              <Row k="Expiry" v={plan.orchestrator_node.parsed_components.expiration_date} />
              <Row k="Type" v={plan.orchestrator_node.parsed_components.option_type} />
              <Row k="Strike" v={`$${plan.orchestrator_node.parsed_components.strike_price.toFixed(2)}`} />
            </Panel>

            <Panel title="Node 2 · Quantitative">
              <Row k="Spot" v={`$${plan.quantitative_engine.spot_price}`} />
              <Row k="Theo" v={`$${plan.quantitative_engine.black_scholes_theoretical_price}`} />
              <Row k="Mid" v={`$${plan.quantitative_engine.market_bid_ask_mid}`} />
              <Row k="Bid/Ask" v={
                plan.quantitative_engine.market_bid != null && plan.quantitative_engine.market_ask != null
                  ? `$${plan.quantitative_engine.market_bid} / $${plan.quantitative_engine.market_ask}`
                  : '—'
              } />
              <Row k="Spread" v={plan.quantitative_engine.bid_ask_spread_pct != null ? `${plan.quantitative_engine.bid_ask_spread_pct}%` : '—'} />
              <Row k="IV" v={`${(plan.quantitative_engine.implied_volatility.value * 100).toFixed(2)}%`} />
              <Row k="IV method" v={plan.quantitative_engine.implied_volatility.initial_guess_method} />
              <Row k="Moneyness" v={plan.quantitative_engine.moneyness != null ? String(plan.quantitative_engine.moneyness) : '—'} />
              <Row k="DTE" v={plan.quantitative_engine.days_to_expiry != null ? String(plan.quantitative_engine.days_to_expiry) : '—'} />
              <Row k="Source" v={plan.quantitative_engine.market_data_source ?? '—'} />
              <Row k="Δ" v={String(plan.quantitative_engine.greeks.delta)} />
              <Row k="Γ" v={String(plan.quantitative_engine.greeks.gamma)} />
              <Row k="Θ" v={String(plan.quantitative_engine.greeks.theta)} />
              <Row k="ν" v={String(plan.quantitative_engine.greeks.vega)} />
              <Row k="ρ" v={String(plan.quantitative_engine.greeks.rho)} />
            </Panel>

            {plan.news_ingestion ? (
              <Panel title="News Engine">
                <Row k="Source" v={plan.news_ingestion.source} />
                <Row k="Provider" v={plan.news_ingestion.provider_detail} />
                <Row k="Headline" v={plan.news_ingestion.headline.slice(0, 80)} />
                <Row k="Articles" v={String(plan.news_ingestion.article_count)} />
                <Row k="Event" v={plan.news_ingestion.inferred_event_type ?? '—'} />
              </Panel>
            ) : null}

            <Panel title="Node 3 · Sentiment">
              <Row k="Engine" v={plan.sentiment_quantization.engine ?? 'lexicon'} />
              <Row k="Polarity" v={plan.sentiment_quantization.finbert_polarity_score.toFixed(4)} />
              <Row k="Confidence" v={plan.sentiment_quantization.confidence?.toFixed(2) ?? '—'} />
              <Row k="Catalyst" v={plan.sentiment_quantization.deterministic_catalyst_tag} />
              <Row k="Strength" v={plan.sentiment_quantization.catalyst_strength?.toFixed(2) ?? '—'} />
              <Row k="Ticker ref" v={plan.sentiment_quantization.ticker_mentioned ? 'yes' : 'no'} />
              <Row k="P+" v={plan.sentiment_quantization.softmax_probabilities.positive?.toFixed(2) ?? '—'} />
              <Row k="P−" v={plan.sentiment_quantization.softmax_probabilities.negative?.toFixed(2) ?? '—'} />
            </Panel>

            <Panel title="Node 4 · Synthesis">
              <Row k="IV %" v={`${plan.synthesis_and_risk.implied_volatility_percentile}`} />
              <Row k="Crush" v={plan.synthesis_and_risk.iv_crush_probability_score.toFixed(2)} />
              <Row k="SPCI w" v={String(plan.synthesis_and_risk.spci_residual_lag_w)} />
              <Row k="PID α" v={String((plan.synthesis_and_risk.conformal_pid_control as { target_alpha?: number }).target_alpha ?? '—')} />
            </Panel>
          </div>

          {agent.handshake ? (
            <div className="ra-handshake" data-testid="ra-handshake-result">
              <span className={cn('ra-badge', agent.handshake.accepted ? 'ra-badge--ok' : 'ra-badge--bad')}>
                {agent.handshake.accepted ? 'HANDSHAKE OK' : 'HANDSHAKE BLOCKED'}
              </span>
              <span className="ra-mono">{agent.handshake.message}</span>
              {agent.handshake.autopilot_run_id ? (
                <span className="ra-mono">run: {agent.handshake.autopilot_run_id}</span>
              ) : null}
            </div>
          ) : null}

          <details className="ra-json">
            <summary>Full JSON trade plan</summary>
            <pre>{JSON.stringify(plan, null, 2)}</pre>
          </details>
        </div>
      ) : (
        <p className="ra-empty">Run the pipeline or load the blueprint demo to see the trade plan payload.</p>
      )}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="ra-panel">
      <div className="ra-panel__title">{title}</div>
      <div className="ra-panel__body">{children}</div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="ra-row">
      <span>{k}</span>
      <span className="ra-mono">{v}</span>
    </div>
  );
}
