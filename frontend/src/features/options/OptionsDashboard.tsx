// Bloomberg OD — Options Dashboard
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

import React, { useEffect, useState } from 'react';
import { useOptionsStore } from './store';
import { useTickerInput } from '../ticker/useTickerInput';
import { TickerDisambiguationDialog } from '../ticker/TickerDisambiguationDialog';
import {
  IVAnalyticsPanel,
  PutCallRatioPanel,
  PayoffChart,
  StrategyMetrics,
  PositionGreeksPanel,
} from './components';
import type { StrategyAnalysis } from './types';

interface OptionsDashboardProps {
  symbol?: string;
  className?: string;
}

export const OptionsDashboard: React.FC<OptionsDashboardProps> = ({
  symbol: initialSymbol,
}) => {
  const {
    symbol,
    fetchAll,
    chain,
    selectedExpiration,
    setSelectedExpiration,
    strategyTemplates,
    loadStrategyTemplates,
  } = useOptionsStore();

  const [strategy] = useState<StrategyAnalysis | null>(null);

  const tickerInput = useTickerInput({
    initialValue: initialSymbol || '',
    onResolved: (resolvedSymbol) => fetchAll(resolvedSymbol),
    watchlist: [],
  });

  useEffect(() => { loadStrategyTemplates(); }, [loadStrategyTemplates]);

  useEffect(() => {
    if (initialSymbol && initialSymbol !== symbol) {
      tickerInput.onChange(initialSymbol);
      fetchAll(initialSymbol);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSymbol]);

  const handleSymbolSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    tickerInput.submit();
  };

  const card = { background:PANEL, border:`1px solid ${BORDER}`, borderRadius:2, padding:12 };

  return (
    <div style={{ background:BG, color:TEXT, padding:12, fontFamily:MONO }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12, paddingBottom:8, borderBottom:`1px solid ${BORDER}` }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ color:PURPLE, fontSize:16 }}>◈</span>
          <div>
            <div style={{ color:AMBER, fontWeight:700, fontSize:12, letterSpacing:1 }}>OPTIONS ANALYTICS</div>
            {symbol && <div style={{ color:SUBTLE, fontSize:9 }}>UNDERLYING: {symbol}</div>}
          </div>
        </div>
        <form onSubmit={handleSymbolSubmit} style={{ display:'flex', gap:6 }}>
          <input
            type="text"
            value={tickerInput.value}
            onChange={(e) => tickerInput.onChange(e.target.value)}
            placeholder="SYMBOL (e.g. AAPL)"
            data-testid="analytics-symbol-input"
            style={{
              background:'#141414', border:`1px solid ${BORDER}`, color:TEXT,
              fontFamily:MONO, fontSize:10, padding:'4px 8px', width:130,
              outline:'none', borderRadius:2,
            }}
          />
          <button type="submit" style={{
            background: BLUE+'22', border:`1px solid ${BLUE}`, color:BLUE,
            fontFamily:MONO, fontSize:9, fontWeight:700, padding:'4px 10px',
            cursor:'pointer', borderRadius:2, letterSpacing:1,
          }}>LOAD</button>
        </form>
      </div>

      {/* Main grid */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:8, marginBottom:8 }}>
        {/* IV Analytics */}
        <div style={card}><IVAnalyticsPanel /></div>

        {/* Put/Call Ratio */}
        <div style={card}><PutCallRatioPanel /></div>

        {/* Strategy Templates */}
        <div style={card}>
          <div style={{ color:AMBER, fontSize:10, fontWeight:700, letterSpacing:1, marginBottom:6 }}>
            STRATEGY TEMPLATES ({strategyTemplates.length})
          </div>
          <div style={{ maxHeight:220, overflowY:'auto' }}>
            {strategyTemplates.map(t => (
              <button key={t.name}
                onClick={() => console.log('Selected template:', t.name)}
                disabled={!chain}
                style={{
                  width:'100%', textAlign:'left', background:BG, border:`1px solid ${BORDER}`,
                  color: chain ? TEXT : SUBTLE, fontFamily:MONO, padding:'5px 8px',
                  marginBottom:3, cursor: chain ? 'pointer' : 'default', borderRadius:2,
                }}>
                <div style={{ fontSize:9, fontWeight:700 }}>{t.name}</div>
                <div style={{ fontSize:8, color:SUBTLE, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.description}</div>
              </button>
            ))}
            {strategyTemplates.length === 0 && (
              <div style={{ color:SUBTLE, fontSize:9 }}>LOADING TEMPLATES...</div>
            )}
          </div>
          {chain && (
            <div style={{ marginTop:8, paddingTop:6, borderTop:`1px solid ${BORDER}` }}>
              {[
                { label:'UNDERLYING', val:`$${chain.underlyingPrice.toFixed(2)}`, color:AMBER },
                { label:'CONTRACTS',  val:String(chain.totalContracts), color:TEXT },
                { label:'EXPIRATIONS',val:String(chain.expirations.length), color:TEXT },
              ].map(m => (
                <div key={m.label} style={{ display:'flex', justifyContent:'space-between', marginBottom:2 }}>
                  <span style={{ color:SUBTLE, fontSize:8 }}>{m.label}</span>
                  <span style={{ color:m.color, fontSize:9, fontWeight:700 }}>{m.val}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Expiration selector */}
      {chain && chain.expirations.length > 0 && (
        <div style={{ marginBottom:8, display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ color:SUBTLE, fontSize:9 }}>EXPIRATION:</span>
          <select
            value={selectedExpiration || ''}
            onChange={(e) => setSelectedExpiration(e.target.value)}
            style={{
              background:'#141414', border:`1px solid ${BORDER}`, color:TEXT,
              fontFamily:MONO, fontSize:9, padding:'3px 8px', borderRadius:2, outline:'none',
            }}>
            {chain.expirations.map(exp => (
              <option key={exp} value={exp}>{exp}</option>
            ))}
          </select>
        </div>
      )}

      {/* Strategy analysis */}
      {strategy && (
        <div style={card}>
          <div style={{ color:AMBER, fontSize:10, fontWeight:700, letterSpacing:1, marginBottom:8 }}>
            {strategy.name.toUpperCase()} ANALYSIS
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div>
              <PayoffChart strategy={strategy} width={400} height={250} />
              <div style={{ marginTop:6, display:'flex', gap:12, fontSize:8 }}>
                {[['—', GREEN, 'EXPIRATION'],['—', BLUE, 'THEORETICAL'],['—', AMBER, 'BREAKEVEN']].map(([dash, color, label]) => (
                  <span key={label} style={{ display:'flex', alignItems:'center', gap:4 }}>
                    <span style={{ color, fontSize:12 }}>{dash}</span>
                    <span style={{ color:SUBTLE }}>{label}</span>
                  </span>
                ))}
              </div>
            </div>
            <div>
              <StrategyMetrics strategy={strategy} />
              <div style={{ marginTop:8 }}><PositionGreeksPanel strategy={strategy} /></div>
            </div>
          </div>
        </div>
      )}

      <TickerDisambiguationDialog {...tickerInput.dialogProps} />
    </div>
  );
};

export default OptionsDashboard;
