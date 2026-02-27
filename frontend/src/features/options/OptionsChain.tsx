// Bloomberg OC — Options Chain
const BG = '#0a0a0a';
const PANEL = '#111111';
const BORDER = '#1e1e1e';
const AMBER = '#f5a623';
const GREEN = '#26a69a';
const RED = '#ef5350';
const BLUE = '#42a5f5';
const SUBTLE = '#555';
const TEXT = '#d1d4dc';
const MONO = '"Roboto Mono","Courier New",monospace';

import { useMemo } from 'react';
import React from 'react';
import { useOptionsStore } from './store';
import type { OptionContract } from './types';

interface OptionsChainProps {
  symbol: string;
  expiration: string;
  underlyingPrice?: number;
}

const cell = (bg: string, color: string, align: 'left'|'right'|'center' = 'right') => ({
  padding:'3px 5px', textAlign:align as 'left'|'right'|'center',
  background:bg, color, fontSize:9, fontFamily:MONO,
  borderBottom:`1px solid ${BORDER}`, whiteSpace:'nowrap' as const,
});

export const OptionsChain = ({ underlyingPrice }: OptionsChainProps) => {
  const { chain, chainLoading } = useOptionsStore();

  const chainData = useMemo(() => {
    if (!chain?.contracts) return [];
    const map = new Map<number, { strike:number; call?:OptionContract; put?:OptionContract }>();
    chain.contracts.forEach(c => {
      if (!map.has(c.strike)) map.set(c.strike, { strike:c.strike });
      const entry = map.get(c.strike)!;
      if (c.optionType === 'call') entry.call = c;
      else entry.put = c;
    });
    return Array.from(map.values()).sort((a,b) => a.strike - b.strike);
  }, [chain]);

  const isNearMoney = (strike: number) => {
    if (!underlyingPrice) return false;
    return Math.abs(strike - underlyingPrice) / underlyingPrice < 0.02;
  };

  if (chainLoading && chainData.length === 0) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:256, fontFamily:MONO }}>
        <span style={{ color:SUBTLE, fontSize:10 }}>LOADING OPTIONS CHAIN...</span>
      </div>
    );
  }

  if (!chainLoading && chainData.length === 0) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:256, fontFamily:MONO }}>
        <div style={{ textAlign:'center' }}>
          <div style={{ color:SUBTLE, fontSize:10 }}>NO OPTIONS DATA FOR THIS EXPIRATION</div>
          <div style={{ color:SUBTLE, fontSize:9, marginTop:4, opacity:0.6 }}>TRY DIFFERENT DATE OR SYMBOL</div>
        </div>
      </div>
    );
  }

  const TH = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
    <th style={{ padding:'3px 5px', fontSize:8, fontWeight:700, letterSpacing:0.5, color:SUBTLE, background:'#0d0d0d', fontFamily:MONO, ...style }}>
      {children}
    </th>
  );

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', background:BG, overflow:'hidden', fontFamily:MONO }}>
      <div style={{ flex:1, overflow:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', tableLayout:'fixed' }}>
          <colgroup>
            {/* Calls (5) + Strike + Puts (5) */}
            {Array(11).fill(0).map((_,i) => <col key={i} style={{ width: i===5 ? '8%' : '8.4%' }} />)}
          </colgroup>
          <thead style={{ position:'sticky', top:0, zIndex:1 }}>
            <tr>
              <th colSpan={5} style={{ padding:'4px 0', textAlign:'center', background: GREEN+'11', color:GREEN, fontSize:9, fontWeight:700, borderBottom:`1px solid ${BORDER}`, borderRight:`2px solid ${BORDER}` }}>
                CALLS
              </th>
              <th style={{ padding:'4px 0', textAlign:'center', background:'#0d0d0d', color:AMBER, fontSize:9, fontWeight:700, borderBottom:`1px solid ${BORDER}` }}>
                STRIKE
              </th>
              <th colSpan={5} style={{ padding:'4px 0', textAlign:'center', background: RED+'11', color:RED, fontSize:9, fontWeight:700, borderBottom:`1px solid ${BORDER}`, borderLeft:`2px solid ${BORDER}` }}>
                PUTS
              </th>
            </tr>
            <tr style={{ borderBottom:`1px solid ${BORDER}` }}>
              <TH style={{ textAlign:'right' }}>BID</TH>
              <TH style={{ textAlign:'right' }}>ASK</TH>
              <TH style={{ textAlign:'right' }}>VOL</TH>
              <TH style={{ textAlign:'right' }}>OI</TH>
              <TH style={{ textAlign:'right', borderRight:`2px solid ${BORDER}` }}>IV%</TH>
              <TH style={{ textAlign:'center', color:AMBER }}>$</TH>
              <TH style={{ textAlign:'right', borderLeft:`2px solid ${BORDER}` }}>IV%</TH>
              <TH style={{ textAlign:'right' }}>VOL</TH>
              <TH style={{ textAlign:'right' }}>OI</TH>
              <TH style={{ textAlign:'right' }}>BID</TH>
              <TH style={{ textAlign:'right' }}>ASK</TH>
            </tr>
          </thead>
          <tbody>
            {chainData.map((row, idx) => {
              const { call, put } = row;
              const itmCall = underlyingPrice ? row.strike < underlyingPrice : false;
              const itmPut  = underlyingPrice ? row.strike > underlyingPrice : false;
              const atm     = isNearMoney(row.strike);
              const rowBg   = idx % 2 === 0 ? BG : '#0d0d0d';
              const callBg  = itmCall ? GREEN+'0d' : rowBg;
              const putBg   = itmPut  ? RED+'0d'   : rowBg;

              return (
                <tr key={row.strike}>
                  {/* Calls */}
                  <td style={cell(callBg, itmCall ? GREEN : TEXT)}>{call?.bid?.toFixed(2) || '—'}</td>
                  <td style={cell(callBg, itmCall ? GREEN : TEXT)}>{call?.ask?.toFixed(2) || '—'}</td>
                  <td style={cell(callBg, SUBTLE)}>{call?.volume ?? '0'}</td>
                  <td style={cell(callBg, SUBTLE)}>{call?.openInterest ?? '0'}</td>
                  <td style={{ ...cell(callBg, SUBTLE), borderRight:`2px solid ${BORDER}` }}>
                    {call?.impliedVolatility ? (call.impliedVolatility*100).toFixed(1)+'%' : '—'}
                  </td>
                  {/* Strike */}
                  <td style={{ ...cell(atm ? AMBER+'22' : '#0d0d0d', atm ? AMBER : TEXT, 'center'), fontWeight:700, borderLeft:`2px solid ${BORDER}`, borderRight:`2px solid ${BORDER}` }}>
                    {row.strike.toFixed(1)}
                  </td>
                  {/* Puts */}
                  <td style={{ ...cell(putBg, SUBTLE), borderLeft:`2px solid ${BORDER}` }}>
                    {put?.impliedVolatility ? (put.impliedVolatility*100).toFixed(1)+'%' : '—'}
                  </td>
                  <td style={cell(putBg, SUBTLE)}>{put?.volume ?? '0'}</td>
                  <td style={cell(putBg, SUBTLE)}>{put?.openInterest ?? '0'}</td>
                  <td style={cell(putBg, itmPut ? RED : TEXT)}>{put?.bid?.toFixed(2) || '—'}</td>
                  <td style={cell(putBg, itmPut ? RED : TEXT)}>{put?.ask?.toFixed(2) || '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
