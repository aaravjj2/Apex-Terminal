/**
 * Shared live quote fetch — Alpaca → Finnhub → yfinance via backend.
 */

export interface LiveQuote {
  symbol: string;
  price: number;
  bid: number;
  ask: number;
  last: number;
  change: number;
  changePct: number;
  source?: string;
}

function parseQuote(symbol: string, q: Record<string, unknown>): LiveQuote | null {
  const last = Number(q.last ?? q.price ?? q.close ?? 0);
  if (!last || last <= 0) return null;
  const change = Number(q.change ?? 0);
  const changePct = Number(q.change_pct ?? q.changePct ?? q.change_percent ?? 0);
  return {
    symbol,
    price: last,
    bid: Number(q.bid ?? last),
    ask: Number(q.ask ?? last),
    last,
    change,
    changePct,
    source: String(q.source ?? ''),
  };
}

export async function fetchLiveQuote(symbol: string, signal?: AbortSignal): Promise<LiveQuote | null> {
  const sym = symbol.toUpperCase().trim();
  if (!sym) return null;
  try {
    const res = await fetch(`/api/v1/market/quote?symbol=${encodeURIComponent(sym)}`, { signal });
    if (!res.ok) return null;
    const data = await res.json();
    return parseQuote(sym, data as Record<string, unknown>);
  } catch {
    return null;
  }
}

export async function fetchLiveQuotes(
  symbols: string[],
  signal?: AbortSignal,
): Promise<Record<string, LiveQuote>> {
  const syms = [...new Set(symbols.map(s => s.toUpperCase().trim()).filter(Boolean))];
  if (!syms.length) return {};
  const out: Record<string, LiveQuote> = {};
  try {
    const res = await fetch(
      `/api/v1/market/quotes?symbols=${encodeURIComponent(syms.join(','))}`,
      { signal },
    );
    if (!res.ok) return out;
    const data = await res.json();
    const quotes: unknown[] = Array.isArray(data.quotes) ? data.quotes : [];
    for (const item of quotes) {
      const q = item as Record<string, unknown>;
      const sym = String(q.symbol ?? '');
      const parsed = parseQuote(sym, q);
      if (parsed) out[sym] = parsed;
    }
  } catch {
    /* empty */
  }
  return out;
}
