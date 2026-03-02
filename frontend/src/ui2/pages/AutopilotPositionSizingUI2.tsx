import React, { useState } from 'react';

const BG = '#0a0a0a', PANEL = '#111111', BORDER = '#1e1e1e';
const AMBER = '#f5a623', GREEN = '#26a69a', RED = '#ef5350', CYAN = '#00bcd4';
const DIM = '#555', TEXT = '#ccc', WHITE = '#e0e0e0';

interface Position {
  id: string;
  symbol: string;
  side: 'Long' | 'Short';
  currentSize: number;
  maxSize: number;
  entryPrice: number;
  currentPrice: number;
  pnl: number;
  kellyFraction: number;
  regime: string;
  riskBudget: number;
  volatility: number;
  beta: number;
  marginUsed: number;
  sector: string;
}

const REGIMES = ['Bull', 'Bear', 'Range', 'Crisis', 'Recovery'];
const SECTORS = ['Technology', 'Finance', 'Healthcare', 'Energy', 'Consumer', 'Industrial'];

const POSITIONS: Position[] = [
  { id: 'P1', symbol: 'AAPL', side: 'Long', currentSize: 500, maxSize: 800, entryPrice: 178.50, currentPrice: 182.30, pnl: 1900, kellyFraction: 0.42, regime: 'Bull', riskBudget: 8.5, volatility: 0.22, beta: 1.12, marginUsed: 45625, sector: 'Technology' },
  { id: 'P2', symbol: 'MSFT', side: 'Long', currentSize: 300, maxSize: 500, entryPrice: 395.00, currentPrice: 402.15, pnl: 2145, kellyFraction: 0.38, regime: 'Bull', riskBudget: 7.2, volatility: 0.20, beta: 1.05, marginUsed: 60322, sector: 'Technology' },
  { id: 'P3', symbol: 'JPM', side: 'Long', currentSize: 400, maxSize: 600, entryPrice: 195.20, currentPrice: 192.80, pnl: -960, kellyFraction: 0.25, regime: 'Range', riskBudget: 5.8, volatility: 0.25, beta: 1.18, marginUsed: 38560, sector: 'Finance' },
  { id: 'P4', symbol: 'XOM', side: 'Short', currentSize: 200, maxSize: 400, entryPrice: 112.40, currentPrice: 109.75, pnl: 530, kellyFraction: 0.31, regime: 'Bear', riskBudget: 4.5, volatility: 0.28, beta: 0.85, marginUsed: 21950, sector: 'Energy' },
  { id: 'P5', symbol: 'NVDA', side: 'Long', currentSize: 150, maxSize: 300, entryPrice: 875.00, currentPrice: 920.50, pnl: 6825, kellyFraction: 0.55, regime: 'Bull', riskBudget: 12.0, volatility: 0.45, beta: 1.65, marginUsed: 69037, sector: 'Technology' },
  { id: 'P6', symbol: 'TSLA', side: 'Long', currentSize: 100, maxSize: 250, entryPrice: 245.00, currentPrice: 238.20, pnl: -680, kellyFraction: 0.18, regime: 'Range', riskBudget: 6.0, volatility: 0.55, beta: 1.82, marginUsed: 23820, sector: 'Technology' },
  { id: 'P7', symbol: 'JNJ', side: 'Long', currentSize: 350, maxSize: 500, entryPrice: 158.40, currentPrice: 161.20, pnl: 980, kellyFraction: 0.35, regime: 'Recovery', riskBudget: 4.2, volatility: 0.15, beta: 0.65, marginUsed: 28210, sector: 'Healthcare' },
  { id: 'P8', symbol: 'GS', side: 'Short', currentSize: 100, maxSize: 200, entryPrice: 385.00, currentPrice: 392.40, pnl: -740, kellyFraction: 0.15, regime: 'Bear', riskBudget: 3.8, volatility: 0.30, beta: 1.35, marginUsed: 39240, sector: 'Finance' },
  { id: 'P9', symbol: 'AMZN', side: 'Long', currentSize: 200, maxSize: 400, entryPrice: 178.30, currentPrice: 185.60, pnl: 1460, kellyFraction: 0.40, regime: 'Bull', riskBudget: 9.0, volatility: 0.32, beta: 1.25, marginUsed: 37120, sector: 'Technology' },
  { id: 'P10', symbol: 'CVX', side: 'Long', currentSize: 250, maxSize: 400, entryPrice: 155.80, currentPrice: 152.40, pnl: -850, kellyFraction: 0.22, regime: 'Range', riskBudget: 5.0, volatility: 0.26, beta: 0.90, marginUsed: 38100, sector: 'Energy' },
];

const REGIME_MULTIPLIERS: Record<string, { label: string; mult: number; color: string; desc: string }> = {
  Bull: { label: 'Bull Market', mult: 1.2, color: GREEN, desc: 'Trend following, higher allocation' },
  Bear: { label: 'Bear Market', mult: 0.5, color: RED, desc: 'Defensive, reduced exposure' },
  Range: { label: 'Range-Bound', mult: 0.8, color: AMBER, desc: 'Mean reversion, moderate sizing' },
  Crisis: { label: 'Crisis', mult: 0.25, color: '#ff1744', desc: 'Capital preservation, minimal exposure' },
  Recovery: { label: 'Recovery', mult: 1.0, color: CYAN, desc: 'Gradual re-entry, balanced sizing' },
};

const TABS = ['Position Sizes', 'Kelly Calculator', 'Regime Sizing', 'Risk Limits', 'Risk Budget'];

export default function AutopilotPositionSizingUI2() {
  const [tab, setTab] = useState(TABS[0]);
  const [portfolioValue] = useState(1000000);
  const [maxPortfolioRisk] = useState(2.0);
  const [maxPositionPct] = useState(15);
  const [maxSectorPct] = useState(35);
  const [currentRegime, setCurrentRegime] = useState('Bull');

  // Kelly calculator state
  const [kellyWinRate, setKellyWinRate] = useState(0.55);
  const [kellyWinLoss, setKellyWinLoss] = useState(1.5);
  const [kellyFraction, setKellyFraction] = useState(0.5); // half-Kelly

  const fullKelly = kellyWinRate - (1 - kellyWinRate) / kellyWinLoss;
  const adjustedKelly = fullKelly * kellyFraction;

  const regimeMult = REGIME_MULTIPLIERS[currentRegime].mult;
  const totalMargin = POSITIONS.reduce((a, p) => a + p.marginUsed, 0);
  const totalPnL = POSITIONS.reduce((a, p) => a + p.pnl, 0);
  const totalRiskBudget = POSITIONS.reduce((a, p) => a + p.riskBudget, 0);
  const avgKelly = POSITIONS.reduce((a, p) => a + p.kellyFraction, 0) / POSITIONS.length;

  // Sector exposure
  const sectorExposure: Record<string, number> = {};
  POSITIONS.forEach(p => {
    sectorExposure[p.sector] = (sectorExposure[p.sector] || 0) + p.marginUsed;
  });

  const cellStyle: React.CSSProperties = { padding: '6px 8px', borderBottom: `1px solid ${BORDER}`, textAlign: 'right', fontSize: 11 };
  const headerStyle: React.CSSProperties = { ...cellStyle, background: '#1a1a1a', color: DIM, fontWeight: 'bold', position: 'sticky' as const, top: 0, textAlign: 'right', fontSize: 10 };

  return (
    <div style={{ width: '100%', height: '100%', background: BG, color: TEXT, fontFamily: 'monospace', fontSize: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '6px 16px', borderBottom: `1px solid ${BORDER}`, gap: 12 }}>
        <span style={{ color: AMBER, fontWeight: 'bold', fontSize: 14 }}>⚖ POSITION SIZING</span>
        <div style={{ display: 'flex', gap: 2 }}>
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '3px 8px', background: tab === t ? 'rgba(245,166,35,0.15)' : 'transparent',
              border: `1px solid ${tab === t ? AMBER : 'transparent'}`, color: tab === t ? AMBER : DIM,
              cursor: 'pointer', fontFamily: 'monospace', fontSize: 10
            }}>{t}</button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, fontSize: 10 }}>
          <span style={{ color: DIM }}>Regime:</span>
          <select value={currentRegime} onChange={e => setCurrentRegime(e.target.value)} style={{ padding: '2px 6px', background: '#1a1a1a', border: `1px solid ${BORDER}`, color: REGIME_MULTIPLIERS[currentRegime].color, fontFamily: 'monospace', fontSize: 10 }}>
            {REGIMES.map(r => <option key={r}>{r}</option>)}
          </select>
          <span style={{ color: REGIME_MULTIPLIERS[currentRegime].color }}>{REGIME_MULTIPLIERS[currentRegime].mult}x</span>
        </div>
      </div>

      {/* Summary strip */}
      <div style={{ display: 'flex', padding: '6px 16px', gap: 16, borderBottom: `1px solid ${BORDER}`, background: '#0d0d0d', fontSize: 10 }}>
        <span style={{ color: DIM }}>Portfolio: <span style={{ color: AMBER }}>${(portfolioValue / 1e6).toFixed(2)}M</span></span>
        <span style={{ color: DIM }}>Exposure: <span style={{ color: WHITE }}>${(totalMargin / 1000).toFixed(0)}K ({((totalMargin / portfolioValue) * 100).toFixed(1)}%)</span></span>
        <span style={{ color: DIM }}>P&L: <span style={{ color: totalPnL >= 0 ? GREEN : RED }}>{totalPnL >= 0 ? '+' : ''}${totalPnL.toLocaleString()}</span></span>
        <span style={{ color: DIM }}>Risk Used: <span style={{ color: totalRiskBudget > 80 ? RED : totalRiskBudget > 60 ? AMBER : GREEN }}>{totalRiskBudget.toFixed(1)}%</span></span>
        <span style={{ color: DIM }}>Avg Kelly: <span style={{ color: TEXT }}>{(avgKelly * 100).toFixed(1)}%</span></span>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {tab === 'Position Sizes' && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Symbol', 'Side', 'Current', 'Max', '% Used', 'Kelly f*', 'Regime Adj', 'Optimal', 'Action', 'P&L', 'Risk %'].map(h => (
                  <th key={h} style={headerStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {POSITIONS.map(p => {
                const regimeAdj = p.kellyFraction * regimeMult;
                const optimalSize = Math.round(p.maxSize * Math.min(regimeAdj, 1));
                const action = p.currentSize < optimalSize ? 'ADD' : p.currentSize > optimalSize ? 'REDUCE' : 'HOLD';
                const delta = optimalSize - p.currentSize;
                return (
                  <tr key={p.id} style={{ background: 'transparent' }}>
                    <td style={{ ...cellStyle, textAlign: 'left', color: AMBER, fontWeight: 'bold' }}>{p.symbol}</td>
                    <td style={{ ...cellStyle, color: p.side === 'Long' ? GREEN : RED }}>{p.side}</td>
                    <td style={cellStyle}>{p.currentSize}</td>
                    <td style={{ ...cellStyle, color: DIM }}>{p.maxSize}</td>
                    <td style={cellStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                        <div style={{ width: 50, height: 6, background: '#1a1a1a', borderRadius: 3 }}>
                          <div style={{ width: `${(p.currentSize / p.maxSize) * 100}%`, height: '100%', background: p.currentSize / p.maxSize > 0.8 ? AMBER : GREEN, borderRadius: 3 }} />
                        </div>
                        <span style={{ fontSize: 10 }}>{((p.currentSize / p.maxSize) * 100).toFixed(0)}%</span>
                      </div>
                    </td>
                    <td style={{ ...cellStyle, color: CYAN }}>{(p.kellyFraction * 100).toFixed(0)}%</td>
                    <td style={{ ...cellStyle, color: REGIME_MULTIPLIERS[p.regime].color }}>{(regimeAdj * 100).toFixed(0)}%</td>
                    <td style={{ ...cellStyle, fontWeight: 'bold' }}>{optimalSize}</td>
                    <td style={{ ...cellStyle, color: action === 'ADD' ? GREEN : action === 'REDUCE' ? RED : DIM }}>
                      {action} {delta !== 0 ? `(${delta > 0 ? '+' : ''}${delta})` : ''}
                    </td>
                    <td style={{ ...cellStyle, color: p.pnl >= 0 ? GREEN : RED }}>{p.pnl >= 0 ? '+' : ''}${p.pnl.toLocaleString()}</td>
                    <td style={cellStyle}>{p.riskBudget.toFixed(1)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {tab === 'Kelly Calculator' && (
          <div style={{ padding: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 16 }}>
              {/* Inputs */}
              <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: 16 }}>
                <div style={{ color: AMBER, fontWeight: 'bold', fontSize: 12, marginBottom: 12 }}>KELLY CRITERION CALCULATOR</div>
                {[
                  { label: 'Win Rate (p)', value: kellyWinRate, set: setKellyWinRate, min: 0.01, max: 0.99, step: 0.01, format: (v: number) => `${(v * 100).toFixed(0)}%` },
                  { label: 'Win/Loss Ratio (b)', value: kellyWinLoss, set: setKellyWinLoss, min: 0.1, max: 5, step: 0.1, format: (v: number) => `${v.toFixed(1)}x` },
                  { label: 'Kelly Fraction', value: kellyFraction, set: setKellyFraction, min: 0.1, max: 1, step: 0.05, format: (v: number) => `${(v * 100).toFixed(0)}% Kelly` },
                ].map(({ label, value, set, min, max, step, format }) => (
                  <div key={label} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ color: DIM, fontSize: 10 }}>{label}</span>
                      <span style={{ color: WHITE, fontSize: 10 }}>{format(value)}</span>
                    </div>
                    <input type="range" value={value} onChange={e => set(parseFloat(e.target.value))} min={min} max={max} step={step}
                      style={{ width: '100%', accentColor: AMBER }} />
                  </div>
                ))}
                <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 12, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ color: DIM, fontSize: 10 }}>Formula: f* = p - (1-p)/b</div>
                  <div style={{ color: DIM, fontSize: 10 }}>f* = {kellyWinRate.toFixed(2)} - {(1 - kellyWinRate).toFixed(2)}/{kellyWinLoss.toFixed(1)} = <span style={{ color: fullKelly > 0 ? GREEN : RED, fontWeight: 'bold' }}>{(fullKelly * 100).toFixed(1)}%</span></div>
                </div>
              </div>

              {/* Results */}
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
                  <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: 16, textAlign: 'center' }}>
                    <div style={{ color: DIM, fontSize: 10 }}>FULL KELLY</div>
                    <div style={{ color: fullKelly > 0 ? GREEN : RED, fontSize: 28, fontWeight: 'bold' }}>{(fullKelly * 100).toFixed(1)}%</div>
                    <div style={{ color: DIM, fontSize: 9 }}>${(portfolioValue * Math.max(fullKelly, 0)).toLocaleString()} allocation</div>
                  </div>
                  <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: 16, textAlign: 'center' }}>
                    <div style={{ color: DIM, fontSize: 10 }}>ADJUSTED ({(kellyFraction * 100).toFixed(0)}%)</div>
                    <div style={{ color: AMBER, fontSize: 28, fontWeight: 'bold' }}>{(adjustedKelly * 100).toFixed(1)}%</div>
                    <div style={{ color: DIM, fontSize: 9 }}>${(portfolioValue * Math.max(adjustedKelly, 0)).toLocaleString()} allocation</div>
                  </div>
                  <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: 16, textAlign: 'center' }}>
                    <div style={{ color: DIM, fontSize: 10 }}>EXPECTED GROWTH</div>
                    <div style={{ color: CYAN, fontSize: 28, fontWeight: 'bold' }}>{(
                      kellyWinRate * Math.log(1 + adjustedKelly * kellyWinLoss) + (1 - kellyWinRate) * Math.log(1 - adjustedKelly)
                    ).toFixed(4)}</div>
                    <div style={{ color: DIM, fontSize: 9 }}>log-wealth per bet</div>
                  </div>
                </div>

                <div style={{ color: AMBER, fontWeight: 'bold', fontSize: 11, marginBottom: 8 }}>FRACTION COMPARISON</div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['Fraction', 'Kelly %', 'Allocation', 'Expected Growth', 'Risk of Ruin', 'Recommendation'].map(h => (
                        <th key={h} style={headerStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[0.25, 0.5, 0.75, 1.0, 1.5, 2.0].map(frac => {
                      const k = fullKelly * frac;
                      const growth = k > 0 && k < 1 ? kellyWinRate * Math.log(1 + k * kellyWinLoss) + (1 - kellyWinRate) * Math.log(1 - k) : -999;
                      const ror = k > 0 ? Math.pow((1 - kellyWinRate) / kellyWinRate, 1 / (k * kellyWinLoss)) : 0;
                      const rec = frac === 0.25 ? 'Conservative' : frac === 0.5 ? 'Recommended' : frac === 0.75 ? 'Aggressive' : frac === 1.0 ? 'Full Kelly' : 'Over-bet ⚠';
                      return (
                        <tr key={frac} style={{ background: frac === kellyFraction ? 'rgba(245,166,35,0.05)' : 'transparent' }}>
                          <td style={{ ...cellStyle, color: frac === kellyFraction ? AMBER : TEXT }}>{(frac * 100).toFixed(0)}%</td>
                          <td style={cellStyle}>{(k * 100).toFixed(1)}%</td>
                          <td style={cellStyle}>${(portfolioValue * Math.max(k, 0)).toLocaleString()}</td>
                          <td style={{ ...cellStyle, color: growth > 0 ? GREEN : RED }}>{growth > -999 ? growth.toFixed(6) : 'N/A'}</td>
                          <td style={{ ...cellStyle, color: ror > 0.1 ? RED : ror > 0.01 ? AMBER : GREEN }}>{(ror * 100).toFixed(2)}%</td>
                          <td style={{ ...cellStyle, color: frac <= 0.5 ? GREEN : frac <= 1 ? AMBER : RED, textAlign: 'left' }}>{rec}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {tab === 'Regime Sizing' && (
          <div style={{ padding: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 16 }}>
              {REGIMES.map(r => {
                const info = REGIME_MULTIPLIERS[r];
                return (
                  <div key={r} onClick={() => setCurrentRegime(r)} style={{
                    background: currentRegime === r ? `${info.color}15` : PANEL,
                    border: `1px solid ${currentRegime === r ? info.color : BORDER}`,
                    padding: 16, cursor: 'pointer', textAlign: 'center'
                  }}>
                    <div style={{ color: info.color, fontWeight: 'bold', fontSize: 14 }}>{info.label}</div>
                    <div style={{ color: WHITE, fontSize: 28, fontWeight: 'bold', margin: '8px 0' }}>{info.mult}x</div>
                    <div style={{ color: DIM, fontSize: 9 }}>{info.desc}</div>
                  </div>
                );
              })}
            </div>

            <div style={{ color: AMBER, fontWeight: 'bold', fontSize: 11, marginBottom: 8 }}>REGIME-ADJUSTED SIZING</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Symbol', 'Base Kelly', `${currentRegime} Mult`, 'Adjusted %', 'Current Qty', 'Target Qty', 'Delta', 'Action'].map(h => (
                    <th key={h} style={headerStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {POSITIONS.map(p => {
                  const adj = p.kellyFraction * regimeMult;
                  const target = Math.round(p.maxSize * Math.min(adj, 1));
                  const delta = target - p.currentSize;
                  return (
                    <tr key={p.id}>
                      <td style={{ ...cellStyle, textAlign: 'left', color: AMBER }}>{p.symbol}</td>
                      <td style={{ ...cellStyle, color: CYAN }}>{(p.kellyFraction * 100).toFixed(0)}%</td>
                      <td style={{ ...cellStyle, color: REGIME_MULTIPLIERS[currentRegime].color }}>{regimeMult}x</td>
                      <td style={{ ...cellStyle, color: WHITE }}>{(adj * 100).toFixed(0)}%</td>
                      <td style={cellStyle}>{p.currentSize}</td>
                      <td style={{ ...cellStyle, fontWeight: 'bold' }}>{target}</td>
                      <td style={{ ...cellStyle, color: delta > 0 ? GREEN : delta < 0 ? RED : DIM }}>{delta > 0 ? '+' : ''}{delta}</td>
                      <td style={{ ...cellStyle, color: delta > 0 ? GREEN : delta < 0 ? RED : DIM, textAlign: 'left' }}>
                        {delta > 0 ? `BUY ${delta}` : delta < 0 ? `SELL ${Math.abs(delta)}` : 'HOLD'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'Risk Limits' && (
          <div style={{ padding: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
              {/* Position limits */}
              <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: 16 }}>
                <div style={{ color: AMBER, fontWeight: 'bold', fontSize: 12, marginBottom: 12 }}>POSITION LIMITS</div>
                {POSITIONS.map(p => {
                  const pct = (p.marginUsed / portfolioValue) * 100;
                  const breached = pct > maxPositionPct;
                  return (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ color: AMBER, width: 40, fontWeight: 'bold' }}>{p.symbol}</span>
                      <div style={{ flex: 1, height: 8, background: '#1a1a1a', borderRadius: 4, position: 'relative' }}>
                        <div style={{ width: `${Math.min(pct / maxPositionPct * 100, 100)}%`, height: '100%', background: breached ? RED : pct / maxPositionPct > 0.8 ? AMBER : GREEN, borderRadius: 4 }} />
                        <div style={{ position: 'absolute', top: -2, left: '100%', width: 1, height: 12, background: RED }} />
                      </div>
                      <span style={{ color: breached ? RED : TEXT, width: 50, textAlign: 'right', fontSize: 10 }}>{pct.toFixed(1)}%</span>
                      <span style={{ color: DIM, fontSize: 9 }}>/ {maxPositionPct}%</span>
                    </div>
                  );
                })}
              </div>

              {/* Sector limits */}
              <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: 16 }}>
                <div style={{ color: AMBER, fontWeight: 'bold', fontSize: 12, marginBottom: 12 }}>SECTOR LIMITS</div>
                {SECTORS.map(s => {
                  const exposure = sectorExposure[s] || 0;
                  const pct = (exposure / portfolioValue) * 100;
                  const breached = pct > maxSectorPct;
                  return (
                    <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span style={{ color: TEXT, width: 80, fontSize: 10 }}>{s}</span>
                      <div style={{ flex: 1, height: 8, background: '#1a1a1a', borderRadius: 4, position: 'relative' }}>
                        <div style={{ width: `${Math.min(pct / maxSectorPct * 100, 100)}%`, height: '100%', background: breached ? RED : pct / maxSectorPct > 0.8 ? AMBER : GREEN, borderRadius: 4 }} />
                      </div>
                      <span style={{ color: breached ? RED : TEXT, width: 80, textAlign: 'right', fontSize: 10 }}>${(exposure / 1000).toFixed(0)}K ({pct.toFixed(1)}%)</span>
                      <span style={{ color: DIM, fontSize: 9 }}>/ {maxSectorPct}%</span>
                    </div>
                  );
                })}

                <div style={{ borderTop: `1px solid ${BORDER}`, marginTop: 12, paddingTop: 12 }}>
                  <div style={{ color: AMBER, fontWeight: 'bold', fontSize: 11, marginBottom: 8 }}>PORTFOLIO-LEVEL LIMITS</div>
                  {[
                    { label: 'Max Daily VaR', current: 1.8, limit: maxPortfolioRisk, unit: '%' },
                    { label: 'Max Drawdown', current: 3.2, limit: 10, unit: '%' },
                    { label: 'Gross Leverage', current: (totalMargin / portfolioValue), limit: 2.0, unit: 'x' },
                    { label: 'Net Leverage', current: 0.85, limit: 1.5, unit: 'x' },
                    { label: 'Max Positions', current: POSITIONS.length, limit: 20, unit: '' },
                  ].map(l => (
                    <div key={l.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 10 }}>
                      <span style={{ color: DIM }}>{l.label}</span>
                      <span style={{ color: (l.current / l.limit) > 0.9 ? RED : (l.current / l.limit) > 0.7 ? AMBER : GREEN }}>
                        {typeof l.current === 'number' ? l.current.toFixed(l.unit === 'x' ? 2 : 1) : l.current}{l.unit} / {l.limit}{l.unit}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'Risk Budget' && (
          <div style={{ padding: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16 }}>
              <div>
                <div style={{ color: AMBER, fontWeight: 'bold', fontSize: 11, marginBottom: 8 }}>RISK BUDGET ALLOCATION</div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['Symbol', 'Risk Budget %', 'Marginal VaR', 'Component VaR', 'Risk Contrib %', 'Status'].map(h => (
                        <th key={h} style={headerStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {POSITIONS.map(p => {
                      const margVaR = p.currentPrice * p.currentSize * p.volatility * 2.33 / Math.sqrt(252);
                      const compVaR = margVaR * p.beta;
                      const riskContrib = (p.riskBudget / totalRiskBudget) * 100;
                      return (
                        <tr key={p.id}>
                          <td style={{ ...cellStyle, textAlign: 'left', color: AMBER }}>{p.symbol}</td>
                          <td style={cellStyle}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                              <div style={{ width: 60, height: 6, background: '#1a1a1a', borderRadius: 3 }}>
                                <div style={{ width: `${p.riskBudget * 5}%`, height: '100%', background: p.riskBudget > 10 ? RED : p.riskBudget > 7 ? AMBER : GREEN, borderRadius: 3 }} />
                              </div>
                              {p.riskBudget.toFixed(1)}%
                            </div>
                          </td>
                          <td style={cellStyle}>${margVaR.toFixed(0)}</td>
                          <td style={cellStyle}>${compVaR.toFixed(0)}</td>
                          <td style={{ ...cellStyle, color: riskContrib > 15 ? RED : TEXT }}>{riskContrib.toFixed(1)}%</td>
                          <td style={{ ...cellStyle, color: p.riskBudget > 10 ? RED : GREEN, textAlign: 'left' }}>
                            {p.riskBudget > 10 ? '⚠ HIGH' : p.riskBudget > 7 ? 'MODERATE' : '✓ OK'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: 16, textAlign: 'center' }}>
                  <div style={{ color: DIM, fontSize: 10 }}>TOTAL RISK BUDGET</div>
                  <div style={{ color: totalRiskBudget > 80 ? RED : AMBER, fontSize: 28, fontWeight: 'bold' }}>{totalRiskBudget.toFixed(1)}%</div>
                  <div style={{ color: DIM, fontSize: 9 }}>of 100% capacity</div>
                </div>
                <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: 16, textAlign: 'center' }}>
                  <div style={{ color: DIM, fontSize: 10 }}>REMAINING BUDGET</div>
                  <div style={{ color: GREEN, fontSize: 28, fontWeight: 'bold' }}>{(100 - totalRiskBudget).toFixed(1)}%</div>
                  <div style={{ color: DIM, fontSize: 9 }}>available for new positions</div>
                </div>
                <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: 16, textAlign: 'center' }}>
                  <div style={{ color: DIM, fontSize: 10 }}>PORTFOLIO VaR (95%)</div>
                  <div style={{ color: RED, fontSize: 20, fontWeight: 'bold' }}>$18,450</div>
                  <div style={{ color: DIM, fontSize: 9 }}>1.85% of portfolio</div>
                </div>
                <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: 16, textAlign: 'center' }}>
                  <div style={{ color: DIM, fontSize: 10 }}>MAX CORRELATION</div>
                  <div style={{ color: AMBER, fontSize: 20, fontWeight: 'bold' }}>0.72</div>
                  <div style={{ color: DIM, fontSize: 9 }}>AAPL-MSFT pair</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Status */}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 16px', borderTop: `1px solid ${BORDER}`, background: '#080808', fontSize: 10 }}>
        <span style={{ color: DIM }}>{POSITIONS.length} positions | {currentRegime} regime ({regimeMult}x)</span>
        <span style={{ color: totalRiskBudget > 80 ? RED : GREEN }}>Risk: {totalRiskBudget.toFixed(1)}% used</span>
        <span style={{ color: DIM }}>Autopilot Position Sizing Engine v2.1</span>
      </div>
    </div>
  );
}
