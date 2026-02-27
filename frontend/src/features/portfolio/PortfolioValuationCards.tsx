// Bloomberg palette
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

const API_BASE = '/api/v1';

interface ValuationSnapshot {
  snapshot_id: string;
  portfolio_id: string;
  as_of: string;
  net_value: string;
  pnl_total: string;
  cash_balance: string;
  positions_market_value: string;
  valuation_inputs: {
    pricing_source: string;
    source_checksum: string;
    rounding_policy: string;
    as_of: string;
  };
}

interface PortfolioValuationCardsProps {
  portfolioId: string;
}

import React, { useState, useEffect } from 'react';

export function PortfolioValuationCards({ portfolioId }: PortfolioValuationCardsProps) {
  const [valuation, setValuation] = useState<ValuationSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (portfolioId) fetchValuation();
  }, [portfolioId]);

  const fetchValuation = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/portfolios/${portfolioId}/valuation`, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error(res.status === 404 ? 'Portfolio not found' : `HTTP ${res.status}`);
      setValuation(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch valuation');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', gap: 12 }}>
        {[0, 1, 2, 3].map(i => (
          <div key={i} style={{ flex: 1, height: 70, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, animation: 'pulse 1.5s infinite' }} />
        ))}
      </div>
    );
  }

  if (error) {
    return <div data-testid="portfolio-valuation-error" style={{ color: RED, fontFamily: MONO, fontSize: 11 }}>{error}</div>;
  }

  if (!valuation) return null;

  const netValue = parseFloat(valuation.net_value);
  const pnlTotal = parseFloat(valuation.pnl_total);
  const cash = parseFloat(valuation.cash_balance);
  const posMktVal = parseFloat(valuation.positions_market_value);
  const pnlCol = pnlTotal > 0 ? GREEN : pnlTotal < 0 ? RED : SUBTLE;
  const pnlSign = pnlTotal > 0 ? '+' : '';

  const cards = [
    {
      testId: 'portfolio-valuation-net', label: 'NET VALUE', icon: 'â—ˆ',
      main: `$${netValue.toFixed(2)}`, mainCol: TEXT,
      sub: `Portfolio ID: ${valuation.portfolio_id.slice(0, 8)}...`, subCol: SUBTLE,
      borderCol: BLUE,
    },
    {
      testId: 'portfolio-valuation-pnl', label: 'TOTAL P&L', icon: 'â–²',
      main: `${pnlSign}$${Math.abs(pnlTotal).toFixed(2)}`, mainCol: pnlCol,
      sub: `Unrealized Â· ${valuation.valuation_inputs.pricing_source}`, subCol: SUBTLE,
      borderCol: pnlCol,
    },
    {
      testId: 'portfolio-valuation-cash', label: 'CASH BALANCE', icon: '$',
      main: `$${cash.toFixed(2)}`, mainCol: AMBER,
      sub: `As of ${valuation.as_of.replace('T', ' ').slice(0, 19)}`, subCol: SUBTLE,
      borderCol: AMBER,
    },
    {
      testId: 'portfolio-valuation-positions', label: 'POSITIONS VALUE', icon: 'â‰¡',
      main: `$${posMktVal.toFixed(2)}`, mainCol: PURPLE,
      sub: `Source: ${valuation.valuation_inputs.pricing_source}`, subCol: SUBTLE,
      borderCol: PURPLE,
    },
  ];

  return (
    <div style={{ display: 'flex', gap: 8, fontFamily: MONO }}>
      {cards.map(c => (
        <div
          key={c.testId}
          data-testid={c.testId}
          style={{
            flex: 1, background: PANEL, border: `1px solid ${BORDER}`,
            borderTop: `2px solid ${c.borderCol}`, borderRadius: 4, padding: '10px 12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <span style={{ fontSize: 10, color: c.borderCol }}>{c.icon}</span>
            <span style={{ fontSize: 9, color: SUBTLE, letterSpacing: 1 }}>{c.label}</span>
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: c.mainCol, fontFamily: MONO, marginBottom: 4 }}>{c.main}</div>
          <div style={{ fontSize: 9, color: c.subCol, lineHeight: 1.4 }}>{c.sub}</div>
        </div>
      ))}
    </div>
  );
}


interface ValuationSnapshot {
  snapshot_id: string;
  portfolio_id: string;
  as_of: string;
  net_value: string;
  pnl_total: string;
  cash_balance: string;
  positions_market_value: string;
  valuation_inputs: {
    pricing_source: string;
    source_checksum: string;
    rounding_policy: string;
    as_of: string;
  };
}

interface PortfolioValuationCardsProps {
  /** Portfolio ID to fetch valuation for */
  portfolioId: string;
}
