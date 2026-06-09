export interface ArbOpportunity {
  id: string;
  kalshi_ticker: string;
  poly_market_id: string;
  question: string;
  kalshi_title: string;
  poly_title: string;
  kalshi_yes_ask: number;
  poly_no_ask: number;
  gross_spread: number;
  net_edge: number;
  settlement_match_score: number;
  settlement_flags: string[];
  volume_kalshi: number;
  volume_poly: number;
  category: string;
  kelly_fraction: number;
  detection_ts?: string;
  resolution_ts?: string;
  outcome?: string;
  pnl?: number;
}
