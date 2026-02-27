const BG='#0a0a0a'; const PANEL='#111111'; const BORDER='#1e1e1e';
const AMBER='#f5a623'; const GREEN='#26a69a'; const RED='#ef5350';
const BLUE='#42a5f5'; const PURPLE='#ab47bc'; const SUBTLE='#555';
const TEXT='#d1d4dc'; const MONO='"Roboto Mono","Courier New",monospace';

import React, { useState, useEffect, useCallback } from 'react';

const API_BASE = '/api/v1';

interface Trade {
  id: string;
  symbol: string;
  strategy: string;
  timestamp: number;
  side: 'entry' | 'exit';
}

interface TradeDetails {
  strategy_template: string;
  parameters: {
    dte: number;
    strikes: { type: string; strike: number; qty: number }[];
    width?: number;
    credit_debit: 'credit' | 'debit';
    premium: number;
  };
  entry_rationale: {
    regime: string;
    regime_confidence: number;
    key_features: string[];
    sentiment_summary: string;
    sentiment_score: number;
    forecast_snapshot?: { p10: number; p50: number; p90: number };
  };
  exit_rules: {
    profit_target: { percent: number; price?: number };
    stop_loss: { percent: number; price?: number };
    time_stop: { dte_threshold: number; action: string };
    delta_stop?: { threshold: number };
  };
  current_status: {
    pnl: number;
    pnl_percent: number;
    dte_remaining: number;
    time_to_expiry: string;
    next_action_condition: string;
  };
  broker_confirmation: {
    alpaca_order_status: 'filled' | 'partial' | 'rejected' | 'pending' | 'unknown';
    alpaca_position_status: 'open' | 'closed' | 'unknown';
    internal_status: 'open' | 'closed';
    mismatch: boolean;
    mismatch_details?: string;
    order_id: string;
    client_order_id: string;
    fill_price: number;
    fill_time: string;
    commission: number;
  };
}

interface TradeLifecycleDrawerProps {
  trade: Trade;
  onClose: () => void;
}

const S = {
  section: {
    background: PANEL,
    border: `1px solid ${BORDER}`,
    borderRadius: 3,
    padding: '10px 12px',
    marginBottom: 10,
  } as React.CSSProperties,
  sectionTitle: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.1em',
    color: AMBER,
    textTransform: 'uppercase' as const,
    marginBottom: 8,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  } as React.CSSProperties,
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontSize: 11,
    color: TEXT,
    padding: '3px 0',
    borderBottom: `1px solid ${BORDER}`,
  } as React.CSSProperties,
  label: { fontSize: 10, color: SUBTLE, fontFamily: MONO } as React.CSSProperties,
  value: { fontSize: 11, color: TEXT, fontFamily: MONO } as React.CSSProperties,
  badge: (color: string) => ({
    display: 'inline-block',
    padding: '1px 6px',
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    background: color + '22',
    color: color,
    border: `1px solid ${color}44`,
    borderRadius: 2,
    fontFamily: MONO,
  } as React.CSSProperties),
};

function SectionTitle({ icon, label }: { icon: string; label: string }) {
  return (
    <div style={S.sectionTitle}>
      <span style={{ fontSize: 12 }}>{icon}</span>
      {label}
    </div>
  );
}

function DataRow({ label, value, valueColor }: { label: string; value: React.ReactNode; valueColor?: string }) {
  return (
    <div style={S.row}>
      <span style={S.label}>{label}</span>
      <span style={{ ...S.value, color: valueColor || TEXT }}>{value}</span>
    </div>
  );
}

function StatusBadge({ status, colorMap }: { status: string; colorMap: Record<string, string> }) {
  const color = colorMap[status] || SUBTLE;
  return <span style={S.badge(color)}>{status}</span>;
}

export function TradeLifecycleDrawer({ trade, onClose }: TradeLifecycleDrawerProps) {
  const [details, setDetails] = useState<TradeDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [spinAngle, setSpinAngle] = useState(0);

  useEffect(() => {
    if (loading || verifying) {
      const t = setInterval(() => setSpinAngle(a => (a + 20) % 360), 50);
      return () => clearInterval(t);
    }
  }, [loading, verifying]);

  const fetchDetails = useCallback(async () => {
    setLoading(true);
    try {
      const mockDetails: TradeDetails = {
        strategy_template: trade.strategy || 'PCS',
        parameters: {
          dte: 21,
          strikes: [
            { type: 'short_put', strike: 445, qty: -1 },
            { type: 'long_put', strike: 440, qty: 1 },
          ],
          width: 5,
          credit_debit: 'credit',
          premium: 1.25,
        },
        entry_rationale: {
          regime: 'Bullish Trend',
          regime_confidence: 0.75,
          key_features: [
            'ADX > 25 (strong trend)',
            'Price above 20 MA',
            'Positive momentum divergence',
            'Volume confirming trend',
          ],
          sentiment_summary: 'Moderately positive news flow with Fed stability narrative',
          sentiment_score: 0.35,
          forecast_snapshot: { p10: -2.5, p50: 0.8, p90: 3.2 },
        },
        exit_rules: {
          profit_target: { percent: 50, price: 0.62 },
          stop_loss: { percent: -100, price: 2.50 },
          time_stop: { dte_threshold: 5, action: 'close_position' },
          delta_stop: { threshold: 0.30 },
        },
        current_status: {
          pnl: 45.50,
          pnl_percent: 36.4,
          dte_remaining: 14,
          time_to_expiry: '2 weeks',
          next_action_condition: 'If premium drops to $0.62 (50% profit), position will be closed automatically.',
        },
        broker_confirmation: {
          alpaca_order_status: 'filled',
          alpaca_position_status: 'open',
          internal_status: 'open',
          mismatch: false,
          order_id: 'ord_abc123',
          client_order_id: `autopilot_${trade.id}`,
          fill_price: 1.25,
          fill_time: new Date(trade.timestamp * 1000).toISOString(),
          commission: 1.30,
        },
      };
      setDetails(mockDetails);
    } catch (err) {
      console.error('Failed to fetch trade details:', err);
    }
    setLoading(false);
  }, [trade]);

  const verifyWithBroker = async () => {
    setVerifying(true);
    try {
      await fetch(`${API_BASE}/autopilot/broker/metrics`);
      await fetchDetails();
    } catch (err) {
      console.error('Failed to verify with broker:', err);
    }
    setVerifying(false);
  };

  useEffect(() => { fetchDetails(); }, [fetchDetails]);

  const drawerStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    right: 0,
    bottom: 0,
    width: 450,
    background: BG,
    borderLeft: `1px solid ${BORDER}`,
    boxShadow: '-4px 0 24px rgba(0,0,0,0.7)',
    zIndex: 1000,
    display: 'flex',
    flexDirection: 'column',
    fontFamily: MONO,
  };

  if (loading) {
    return (
      <div style={drawerStyle} data-testid="trade-lifecycle-drawer">
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 10 }}>
          <div style={{ width: 28, height: 28, border: `2px solid ${BORDER}`, borderTopColor: AMBER, borderRadius: '50%', transform: `rotate(${spinAngle}deg)` }} />
          <span style={{ fontSize: 11, color: SUBTLE, letterSpacing: '0.08em' }}>LOADING TRADE DATA</span>
        </div>
      </div>
    );
  }

  if (!details) {
    return (
      <div style={drawerStyle} data-testid="trade-lifecycle-drawer">
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 11, color: RED }}>FAILED TO LOAD TRADE DETAILS</span>
        </div>
      </div>
    );
  }

  const d = details;
  const orderColorMap: Record<string, string> = { filled: GREEN, partial: AMBER, rejected: RED, pending: BLUE, unknown: SUBTLE };
  const posColorMap: Record<string, string> = { open: GREEN, closed: SUBTLE, unknown: AMBER };

  return (
    <div style={drawerStyle} data-testid="trade-lifecycle-drawer">
      {/* Header */}
      <div style={{ padding: '10px 14px', borderBottom: `1px solid ${BORDER}`, background: PANEL, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: TEXT, letterSpacing: '0.04em' }}>
            {trade.symbol} <span style={{ color: AMBER }}></span> {trade.strategy}
          </div>
          <div style={{ fontSize: 10, color: SUBTLE, marginTop: 2 }}>
            {trade.side.toUpperCase()}  {new Date(trade.timestamp * 1000).toLocaleString()}
          </div>
        </div>
        <button
          onClick={onClose}
          style={{ background: 'none', border: `1px solid ${BORDER}`, color: SUBTLE, width: 26, height: 26, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 2 }}
          data-testid="tld-close"
        >
          
        </button>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px' }}>

        {/* Strategy Template */}
        <div style={S.section}>
          <SectionTitle icon="" label="Strategy Template" />
          <DataRow label="TEMPLATE" value={d.strategy_template} valueColor={AMBER} />
          <DataRow label="DTE AT ENTRY" value={`${d.parameters.dte} days`} />
          <DataRow label="WIDTH" value={`$${d.parameters.width}`} />
          <DataRow label="TYPE" value={d.parameters.credit_debit.toUpperCase()} valueColor={d.parameters.credit_debit === 'credit' ? GREEN : BLUE} />
          <div style={{ marginTop: 8, borderTop: `1px solid ${BORDER}`, paddingTop: 6 }}>
            <div style={{ fontSize: 10, color: SUBTLE, marginBottom: 4 }}>STRIKES</div>
            {d.parameters.strikes.map((s, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, padding: '2px 0', color: TEXT }}>
                <span style={{ color: SUBTLE, textTransform: 'uppercase' }}>{s.type.replace(/_/g, ' ')}</span>
                <span style={{ fontFamily: MONO }}>${s.strike}  {s.qty}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginTop: 6, paddingTop: 6, borderTop: `1px solid ${BORDER}` }}>
              <span style={{ color: SUBTLE }}>PREMIUM COLLECTED</span>
              <span style={{ color: GREEN, fontWeight: 700 }}>${d.parameters.premium.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Entry Rationale */}
        <div style={S.section}>
          <SectionTitle icon="" label="Entry Rationale" />
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 10, color: SUBTLE, marginBottom: 4 }}>REGIME AT ENTRY</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={S.badge(GREEN)}>{d.entry_rationale.regime}</span>
              <span style={{ fontSize: 10, color: SUBTLE }}>{(d.entry_rationale.regime_confidence * 100).toFixed(0)}% conf</span>
            </div>
          </div>
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 10, color: SUBTLE, marginBottom: 4 }}>KEY FEATURES</div>
            {d.entry_rationale.key_features.map((f, i) => (
              <div key={i} style={{ fontSize: 10, color: TEXT, padding: '1px 0', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                <span style={{ color: GREEN, marginTop: 1 }}></span>
                {f}
              </div>
            ))}
          </div>
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 10, color: SUBTLE, marginBottom: 4 }}>SENTIMENT</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: d.entry_rationale.sentiment_score > 0.2 ? GREEN : d.entry_rationale.sentiment_score < -0.2 ? RED : TEXT }}>
                {d.entry_rationale.sentiment_score > 0 ? '+' : ''}{(d.entry_rationale.sentiment_score * 100).toFixed(0)}%
              </span>
            </div>
            <div style={{ fontSize: 10, color: SUBTLE }}>{d.entry_rationale.sentiment_summary}</div>
          </div>
          {d.entry_rationale.forecast_snapshot && (
            <div>
              <div style={{ fontSize: 10, color: SUBTLE, marginBottom: 4 }}>FORECAST SNAPSHOT</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, textAlign: 'center' }}>
                <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 2, padding: '4px 0' }}>
                  <div style={{ fontSize: 9, color: SUBTLE }}>P10</div>
                  <div style={{ fontSize: 12, color: RED, fontWeight: 700 }}>{d.entry_rationale.forecast_snapshot.p10}%</div>
                </div>
                <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 2, padding: '4px 0' }}>
                  <div style={{ fontSize: 9, color: SUBTLE }}>P50</div>
                  <div style={{ fontSize: 12, color: TEXT, fontWeight: 700 }}>{d.entry_rationale.forecast_snapshot.p50}%</div>
                </div>
                <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 2, padding: '4px 0' }}>
                  <div style={{ fontSize: 9, color: SUBTLE }}>P90</div>
                  <div style={{ fontSize: 12, color: GREEN, fontWeight: 700 }}>+{d.entry_rationale.forecast_snapshot.p90}%</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Exit Rules */}
        <div style={S.section}>
          <SectionTitle icon="" label="Exit Rules Active" />
          <DataRow
            label="PROFIT TARGET"
            value={`${d.exit_rules.profit_target.percent}%${d.exit_rules.profit_target.price !== undefined ? ` ($${d.exit_rules.profit_target.price.toFixed(2)})` : ''}`}
            valueColor={GREEN}
          />
          <DataRow
            label="STOP LOSS"
            value={`${d.exit_rules.stop_loss.percent}%${d.exit_rules.stop_loss.price !== undefined ? ` ($${d.exit_rules.stop_loss.price.toFixed(2)})` : ''}`}
            valueColor={RED}
          />
          <DataRow
            label="TIME STOP"
            value={`DTE  ${d.exit_rules.time_stop.dte_threshold}  ${d.exit_rules.time_stop.action}`}
            valueColor={AMBER}
          />
          {d.exit_rules.delta_stop && (
            <DataRow label="DELTA STOP" value={`Δ > ${d.exit_rules.delta_stop.threshold}`} valueColor={PURPLE} />
          )}
        </div>

        {/* Current Status */}
        <div style={S.section}>
          <SectionTitle icon="" label="Current Status" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 2, padding: '6px 8px' }}>
              <div style={{ fontSize: 9, color: SUBTLE, marginBottom: 2 }}>P&L</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: d.current_status.pnl >= 0 ? GREEN : RED, fontFamily: MONO }}>
                ${d.current_status.pnl.toFixed(2)}
              </div>
              <div style={{ fontSize: 10, color: d.current_status.pnl_percent >= 0 ? GREEN : RED }}>
                ({d.current_status.pnl_percent >= 0 ? '+' : ''}{d.current_status.pnl_percent.toFixed(1)}%)
              </div>
            </div>
            <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 2, padding: '6px 8px' }}>
              <div style={{ fontSize: 9, color: SUBTLE, marginBottom: 2 }}>TIME TO EXPIRY</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: AMBER, fontFamily: MONO }}>{d.current_status.dte_remaining} DTE</div>
              <div style={{ fontSize: 10, color: SUBTLE }}>{d.current_status.time_to_expiry}</div>
            </div>
          </div>
          <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 8 }}>
            <div style={{ fontSize: 10, color: SUBTLE, marginBottom: 4 }}>NEXT ACTION CONDITION</div>
            <div style={{ fontSize: 11, color: TEXT, lineHeight: 1.5 }}>{d.current_status.next_action_condition}</div>
          </div>
        </div>

        {/* Broker Confirmation */}
        <div style={{ ...S.section, background: d.broker_confirmation.mismatch ? '#1a0a0a' : PANEL, borderColor: d.broker_confirmation.mismatch ? RED + '44' : BORDER }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <SectionTitle icon={d.broker_confirmation.mismatch ? '' : ''} label="Broker Confirmation" />
            <button
              onClick={verifyWithBroker}
              disabled={verifying}
              style={{ fontSize: 10, color: AMBER, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, letterSpacing: '0.06em', fontFamily: MONO }}
              data-testid="tld-verify"
            >
              <span style={{ display: 'inline-block', transform: `rotate(${spinAngle}deg)` }}></span>
              VERIFY
            </button>
          </div>

          {d.broker_confirmation.mismatch && (
            <div style={{ background: RED + '22', border: `1px solid ${RED}44`, borderRadius: 2, padding: '6px 8px', marginBottom: 8, display: 'flex', gap: 8 }}>
              <span style={{ color: RED, fontSize: 14 }}></span>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: RED }}>POSITION MISMATCH DETECTED</div>
                <div style={{ fontSize: 10, color: '#ff8a80', marginTop: 2 }}>{d.broker_confirmation.mismatch_details}</div>
              </div>
            </div>
          )}

          <DataRow
            label="ALPACA ORDER STATUS"
            value={<StatusBadge status={d.broker_confirmation.alpaca_order_status} colorMap={orderColorMap} />}
          />
          <DataRow
            label="ALPACA POSITION STATUS"
            value={<StatusBadge status={d.broker_confirmation.alpaca_position_status} colorMap={posColorMap} />}
          />
          <DataRow label="INTERNAL STATUS" value={d.broker_confirmation.internal_status.toUpperCase()} />
          <div style={{ borderTop: `1px solid ${BORDER}`, marginTop: 6, paddingTop: 6 }}>
            <DataRow label="ORDER ID" value={d.broker_confirmation.order_id} valueColor={BLUE} />
            <DataRow label="CLIENT ORDER ID" value={d.broker_confirmation.client_order_id} />
            <DataRow label="FILL PRICE" value={`$${d.broker_confirmation.fill_price.toFixed(2)}`} valueColor={GREEN} />
            <DataRow label="FILL TIME" value={new Date(d.broker_confirmation.fill_time).toLocaleString()} />
            <DataRow label="COMMISSION" value={`$${d.broker_confirmation.commission.toFixed(2)}`} valueColor={RED} />
          </div>
        </div>

      </div>
    </div>
  );
}