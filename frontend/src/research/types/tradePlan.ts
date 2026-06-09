export interface ResearchQuality {
  score: number;
  grade: string;
  warnings: string[];
  data_provenance: Record<string, string>;
}

export interface NewsIngestion {
  headline: string;
  summary: string;
  source: string;
  provider_detail: string;
  fetch_ok: boolean;
  article_count: number;
  inferred_event_type?: string | null;
  selected?: {
    headline: string;
    source: string;
    url: string;
    published_at: string;
    relevance_score: number;
  };
}

export interface TradePlanPayload {
  trade_plan_id: string;
  timestamp: string;
  research_quality?: ResearchQuality;
  news_ingestion?: NewsIngestion;
  orchestrator_node: {
    osi_symbol: string;
    parsed_components: {
      underlying: string;
      expiration_date: string;
      option_type: string;
      strike_price: number;
    };
  };
  quantitative_engine: {
    spot_price: number;
    black_scholes_theoretical_price: number;
    market_bid_ask_mid: number;
    market_bid?: number | null;
    market_ask?: number | null;
    bid_ask_spread_pct?: number | null;
    moneyness?: number;
    days_to_expiry?: number;
    intrinsic_value?: number;
    iv_reliable?: boolean;
    market_data_source?: string;
    risk_free_rate?: number;
    implied_volatility: {
      value: number;
      algorithm: string;
      initial_guess_method: string;
      convergence_iterations: number;
      tolerance_epsilon: number;
    };
    greeks: Record<string, number>;
  };
  sentiment_quantization: {
    finbert_polarity_score: number;
    softmax_probabilities: Record<string, number>;
    deterministic_catalyst_tag: string;
    confidence?: number;
    catalyst_strength?: number;
    ticker_mentioned?: boolean;
    engine?: string;
  };
  synthesis_and_risk: {
    recommended_strategy: string;
    implied_volatility_percentile: number;
    iv_crush_probability_score: number;
    conformal_pid_control: Record<string, unknown>;
    spci_residual_lag_w: number;
    execution_status: string;
  };
  pipeline_nodes?: Record<string, string>;
}

export interface ResearchNewsArticle {
  headline: string;
  summary: string;
  source: string;
  provider: string;
  url: string;
  published_at: string;
  relevance_score: number;
}

export interface ResearchAgentStatus {
  agent: string;
  version: string;
  nodes: { id: number; name: string; capabilities: string[] }[];
  llm_free: boolean;
  finbert_available?: boolean;
  mcp_sse_mounted?: boolean;
  mcp_sse_url?: string;
  handshake_url?: string;
  news_sources?: string[];
  finnhub_configured?: boolean;
}

export interface ResearchHandshakeResult {
  accepted: boolean;
  ticker: string;
  gate_results: Record<string, string>;
  all_gates_passed: boolean;
  autopilot_run_id: string | null;
  message: string;
  handshake_mode?: string;
  trade_plan_id?: string;
  trade_plan?: TradePlanPayload;
}
