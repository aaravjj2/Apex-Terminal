/**
 * Strategy Payoff Chart â€” Bloomberg Terminal Edition
 */
// â”€â”€â”€ Bloomberg palette â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const BG='#0a0a0a',PANEL='#111111',BORDER='#1e1e1e'
const AMBER='#f5a623',GREEN='#26a69a',RED='#ef5350',BLUE='#42a5f5'
const SUBTLE='#555',TEXT='#d1d4dc'
const MONO='"Roboto Mono","Courier New",monospace'

import React, { useMemo, useRef, useEffect } from 'react';
import type { StrategyAnalysis } from '../types';

interface PayoffChartProps {
  strategy: StrategyAnalysis;
  width?: number;
  height?: number;
  showTheoretical?: boolean;
}

function drawChart(
  canvas: HTMLCanvasElement,
  strategy: StrategyAnalysis,
  width: number,
  height: number,
  showTheoretical: boolean
) {
  const ctx = canvas.getContext('2d'); if(!ctx) return;
  const dpr = window.devicePixelRatio||1;
  canvas.width = width*dpr; canvas.height = height*dpr;
  canvas.style.width = `${width}px`; canvas.style.height = `${height}px`;
  ctx.scale(dpr, dpr);

  const mg = {top:10, right:10, bottom:28, left:56};
  const cw = width-mg.left-mg.right, ch = height-mg.top-mg.bottom;

  const prices = strategy.priceRange;
  const expPayoff = strategy.expirationPayoff;
  const theoPayoff = strategy.theoreticalPayoff;
  const allVals = [...expPayoff, ...theoPayoff, 0];
  const mn = Math.min(...prices), mx = Math.max(...prices);
  const mnP = Math.min(...allVals)-Math.abs(Math.min(...allVals))*0.1;
  const mxP = Math.max(...allVals)+Math.abs(Math.max(...allVals))*0.1||10;

  const sx = (p:number) => mg.left + ((p-mn)/(mx-mn||1))*cw;
  const sy = (v:number) => mg.top + ch - ((v-mnP)/(mxP-mnP||1))*ch;

  // Background
  ctx.fillStyle = BG; ctx.fillRect(0,0,width,height);

  // Grid lines (horizontal)
  ctx.strokeStyle = BORDER; ctx.lineWidth = 0.5;
  for(let i=0;i<=4;i++){
    const y = mg.top + (ch/4)*i;
    ctx.beginPath(); ctx.moveTo(mg.left,y); ctx.lineTo(width-mg.right,y); ctx.stroke();
  }

  // Zero line
  const z = sy(0);
  ctx.strokeStyle = SUBTLE; ctx.lineWidth = 1; ctx.setLineDash([4,4]);
  ctx.beginPath(); ctx.moveTo(mg.left,z); ctx.lineTo(width-mg.right,z); ctx.stroke();
  ctx.setLineDash([]);

  // Current price vertical line
  const curX = sx(strategy.underlyingPrice);
  ctx.strokeStyle = `${BLUE}66`; ctx.lineWidth = 1; ctx.setLineDash([2,2]);
  ctx.beginPath(); ctx.moveTo(curX,mg.top); ctx.lineTo(curX,height-mg.bottom); ctx.stroke();
  ctx.setLineDash([]);

  // Breakeven lines
  ctx.strokeStyle = AMBER; ctx.lineWidth = 1; ctx.setLineDash([3,3]);
  strategy.breakevens.forEach(be=>{
    const bx = sx(be);
    ctx.beginPath(); ctx.moveTo(bx,mg.top); ctx.lineTo(bx,height-mg.bottom); ctx.stroke();
  });
  ctx.setLineDash([]);

  // Fill profit area (green)
  ctx.beginPath();
  let inP=false;
  prices.forEach((price,i)=>{
    const v=expPayoff[i]; const x=sx(price); const y=sy(v);
    if(v>0){if(!inP){ctx.moveTo(x,z);inP=true;} ctx.lineTo(x,y);}
    else if(inP){ctx.lineTo(x,z);ctx.closePath();ctx.fillStyle=`${GREEN}22`;ctx.fill();ctx.beginPath();inP=false;}
  });
  if(inP){ctx.lineTo(sx(mx),z);ctx.closePath();ctx.fillStyle=`${GREEN}22`;ctx.fill();}

  // Fill loss area (red)
  ctx.beginPath(); let inL=false;
  prices.forEach((price,i)=>{
    const v=expPayoff[i]; const x=sx(price); const y=sy(v);
    if(v<0){if(!inL){ctx.moveTo(x,z);inL=true;} ctx.lineTo(x,y);}
    else if(inL){ctx.lineTo(x,z);ctx.closePath();ctx.fillStyle=`${RED}22`;ctx.fill();ctx.beginPath();inL=false;}
  });
  if(inL){ctx.lineTo(sx(mx),z);ctx.closePath();ctx.fillStyle=`${RED}22`;ctx.fill();}

  // Theoretical payoff line
  if(showTheoretical&&theoPayoff.length>0){
    ctx.strokeStyle=BLUE; ctx.lineWidth=1; ctx.beginPath();
    prices.forEach((p,i)=>{const x=sx(p),y=sy(theoPayoff[i]);i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);});
    ctx.stroke();
  }

  // Expiration payoff line (main)
  ctx.strokeStyle=GREEN; ctx.lineWidth=2; ctx.beginPath();
  prices.forEach((p,i)=>{const x=sx(p),y=sy(expPayoff[i]);i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);});
  ctx.stroke();

  // X-axis labels
  ctx.fillStyle=SUBTLE; ctx.font=`10px ${MONO}`; ctx.textAlign='center' as CanvasTextAlign;
  [mn, strategy.underlyingPrice, mx].forEach(p=>{
    ctx.fillText(`$${p.toFixed(0)}`,sx(p),height-6);
  });

  // Y-axis labels
  ctx.textAlign='right' as CanvasTextAlign;
  [mnP,0,mxP].forEach(v=>{
    const y=sy(v); if(y>mg.top&&y<height-mg.bottom){
      ctx.fillStyle=v>0?GREEN:v<0?RED:SUBTLE;
      ctx.fillText(`$${v.toFixed(0)}`,mg.left-5,y+3);
    }
  });

  // Legend
  ctx.font=`9px ${MONO}`; ctx.textAlign='left' as CanvasTextAlign;
  ctx.fillStyle=GREEN; ctx.fillText('â–¬ EXPIRY',mg.left,mg.top+8);
  if(showTheoretical){ctx.fillStyle=BLUE; ctx.fillText('â–¬ THEO',mg.left+70,mg.top+8);}
  ctx.fillStyle=AMBER; ctx.fillText('â•Œ B/E',mg.left+showTheoretical?140:70,mg.top+8);
}

export const PayoffChart: React.FC<PayoffChartProps> = ({
  strategy, width=500, height=220, showTheoretical=true
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(()=>{
    if(canvasRef.current) drawChart(canvasRef.current,strategy,width,height,showTheoretical);
  },[strategy,width,height,showTheoretical]);
  return (
    <div style={{background:BG,border:`1px solid ${BORDER}`,borderRadius:2,padding:4}}>
      <canvas ref={canvasRef} style={{display:'block'}}/>
    </div>
  );
};

// â”€â”€â”€ StrategyMetrics â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
interface StrategyMetricsProps { strategy: StrategyAnalysis; }

export const StrategyMetrics: React.FC<StrategyMetricsProps> = ({ strategy }) => {
  const fmt=(v:number):string=>{
    if(v===999999999||v===Infinity||v===-999999999||v===-Infinity) return 'UNLIMITED';
    return `$${v.toFixed(0)}`;
  };
  const card=(label:string,val:string,color?:string):React.ReactNode=>(
    <div style={{background:PANEL,border:`1px solid ${BORDER}`,borderRadius:2,padding:'8px 12px'}}>
      <div style={{fontSize:9,color:SUBTLE,letterSpacing:'0.1em',marginBottom:3}}>{label}</div>
      <div style={{fontSize:14,fontFamily:MONO,fontWeight:700,color:color||TEXT}}>{val}</div>
    </div>
  );
  return (
    <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:8,fontFamily:MONO}}>
      {card('MAX PROFIT',fmt(strategy.maxProfit),GREEN)}
      {card('MAX LOSS',fmt(Math.abs(strategy.maxLoss)),RED)}
      {card('BREAKEVENS',strategy.breakevens.length>0
        ?strategy.breakevens.map(b=>`$${b.toFixed(2)}`).join(' / '):'NONE',AMBER)}
      {card('CURRENT PRICE',`$${strategy.underlyingPrice.toFixed(2)}`,BLUE)}
    </div>
  );
};

export default PayoffChart;

interface PayoffChartProps {
  strategy: StrategyAnalysis;
  width?: number;
  height?: number;
  className?: string;
  showTheoretical?: boolean;
}

