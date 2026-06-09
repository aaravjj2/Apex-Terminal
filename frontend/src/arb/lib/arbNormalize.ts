import type { ArbOpportunity } from '@/arb/types/arb';

/** Coerce API/SQLite arb rows for the zustand store (from autopilot-public). */
export function normalizeArbRow(row: Record<string, unknown>): ArbOpportunity {
  let flags = row.settlement_flags;
  if (typeof flags === 'string') {
    try {
      flags = JSON.parse(flags);
    } catch {
      flags = [];
    }
  }
  if (!Array.isArray(flags)) {
    flags = [];
  }
  return {
    id: String(row.id ?? ''),
    kalshi_ticker: String(row.kalshi_ticker ?? ''),
    poly_market_id: String(row.poly_market_id ?? ''),
    question: String(row.question ?? ''),
    kalshi_title: String(row.kalshi_title ?? ''),
    poly_title: String(row.poly_title ?? ''),
    kalshi_yes_ask: Number(row.kalshi_yes_ask ?? 0),
    poly_no_ask: Number(row.poly_no_ask ?? 0),
    gross_spread: Number(row.gross_spread ?? 0),
    net_edge: Number(row.net_edge ?? 0),
    settlement_match_score: Number(row.settlement_match_score ?? 0),
    settlement_flags: flags as string[],
    volume_kalshi: Number(row.volume_kalshi ?? 0),
    volume_poly: Number(row.volume_poly ?? 0),
    category: String(row.category ?? ''),
    kelly_fraction: Number(row.kelly_fraction ?? 0),
    detection_ts: row.detection_ts != null ? String(row.detection_ts) : undefined,
    resolution_ts: row.resolution_ts != null ? String(row.resolution_ts) : undefined,
    outcome: row.outcome != null ? String(row.outcome) : undefined,
    pnl: row.pnl != null ? Number(row.pnl) : undefined,
  };
}

export function normalizeArbRows(rows: unknown[]): ArbOpportunity[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((r) => normalizeArbRow(r as Record<string, unknown>));
}
