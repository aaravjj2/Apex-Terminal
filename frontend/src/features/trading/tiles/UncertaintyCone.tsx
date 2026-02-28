// â”€â”€â”€ Bloomberg palette â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const BG='#0a0a0a',PANEL='#111111',BORDER='#1e1e1e'
const AMBER='#f5a623',GREEN='#26a69a',RED='#ef5350',BLUE='#42a5f5'
const PURPLE='#ab47bc',SUBTLE='#555',TEXT='#d1d4dc'
const MONO='"Roboto Mono","Courier New",monospace'

import { useState, useEffect, useCallback, useRef } from 'react';
import React from 'react';
import { ApiClient } from '../../../data/ApiClient';
import type { ForecastResponse } from '../../../data/ApiClient';
import { useSymbol } from '../../../state/appStore';

interface TileProps { tileId: string; onClose: ()=>void; onMaximize: ()=>void; isMaximized: boolean; }
interface UncertaintyConeContentProps { symbol: string; showControls?: boolean; }

function drawCone(canvas: HTMLCanvasElement, forecast: ForecastResponse) {
  const ctx = canvas.getContext('2d'); if(!ctx) return;
  const W=canvas.width, H=canvas.height;
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle=BG; ctx.fillRect(0,0,W,H);
  const cone95=forecast.cones['95%'], cone68=forecast.cones['68%'];
  if(!cone95||!cone68) return;
  const days=forecast.forecast_days;
  const allVals=[...cone95.upper,...cone95.lower,...cone68.upper,...cone68.lower];
  const minV=Math.min(...allVals), maxV=Math.max(...allVals);
  const padH=32, padV=20;
  const scaleX=(i:number)=>padH+(i/(days-1))*(W-padH*2);
  const scaleY=(v:number)=>padV+((maxV-v)/(maxV-minV))*(H-padV*2);
  // Grid lines
  ctx.strokeStyle=`${BORDER}88`; ctx.lineWidth=0.5;
  for(let i=0;i<=4;i++){
    const y=padV+i*(H-padV*2)/4;
    ctx.beginPath(); ctx.moveTo(padH,y); ctx.lineTo(W-padH,y); ctx.stroke();
    const v=maxV-i*(maxV-minV)/4;
    ctx.fillStyle=SUBTLE; ctx.font=`9px ${MONO}`;
    ctx.fillText(`$${v.toFixed(0)}`,2,y+3);
  }
  // 95% cone fill (outer)
  ctx.beginPath();
  cone95.upper.forEach((v,i)=>{i===0?ctx.moveTo(scaleX(i),scaleY(v)):ctx.lineTo(scaleX(i),scaleY(v))});
  [...cone95.lower].reverse().forEach((v,i)=>{ctx.lineTo(scaleX(days-1-i),scaleY(v));});
  ctx.closePath();
  ctx.fillStyle=`${BLUE}28`; ctx.fill();
  // 68% cone fill (inner)
  ctx.beginPath();
  cone68.upper.forEach((v,i)=>{i===0?ctx.moveTo(scaleX(i),scaleY(v)):ctx.lineTo(scaleX(i),scaleY(v))});
  [...cone68.lower].reverse().forEach((v,i)=>{ctx.lineTo(scaleX(days-1-i),scaleY(v));});
  ctx.closePath();
  ctx.fillStyle=`${GREEN}35`; ctx.fill();
  // 95% borders
  ctx.strokeStyle=`${BLUE}77`; ctx.lineWidth=1;
  ctx.beginPath(); cone95.upper.forEach((v,i)=>{i===0?ctx.moveTo(scaleX(i),scaleY(v)):ctx.lineTo(scaleX(i),scaleY(v))}); ctx.stroke();
  ctx.beginPath(); cone95.lower.forEach((v,i)=>{i===0?ctx.moveTo(scaleX(i),scaleY(v)):ctx.lineTo(scaleX(i),scaleY(v))}); ctx.stroke();
  // 68% borders
  ctx.strokeStyle=`${GREEN}bb`; ctx.lineWidth=1.5;
  ctx.beginPath(); cone68.upper.forEach((v,i)=>{i===0?ctx.moveTo(scaleX(i),scaleY(v)):ctx.lineTo(scaleX(i),scaleY(v))}); ctx.stroke();
  ctx.beginPath(); cone68.lower.forEach((v,i)=>{i===0?ctx.moveTo(scaleX(i),scaleY(v)):ctx.lineTo(scaleX(i),scaleY(v))}); ctx.stroke();
  // Median dashed white
  if(cone68.median){
    ctx.strokeStyle=TEXT; ctx.lineWidth=1.5; ctx.setLineDash([4,4]);
    ctx.beginPath(); cone68.median.forEach((v,i)=>{i===0?ctx.moveTo(scaleX(i),scaleY(v)):ctx.lineTo(scaleX(i),scaleY(v))}); ctx.stroke();
    ctx.setLineDash([]);
  }
  // Current price marker
  const cp=forecast.current_price;
  ctx.strokeStyle=AMBER; ctx.lineWidth=1; ctx.setLineDash([3,3]);
  ctx.beginPath(); ctx.moveTo(padH,scaleY(cp)); ctx.lineTo(scaleX(0),scaleY(cp)); ctx.stroke();
  ctx.setLineDash([]);
  // X labels
  ctx.fillStyle=SUBTLE; ctx.font=`9px ${MONO}`;
  [0,Math.floor(days/4),Math.floor(days/2),Math.floor(days*3/4),days-1].forEach(i=>{
    ctx.fillText(`D+${i+1}`,scaleX(i)-10,H-4);
  });
}

export function UncertaintyConeContent({symbol,showControls=true}:UncertaintyConeContentProps) {
  const [forecast, setForecast] = useState<ForecastResponse|null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const days=30;

  const fetchForecast = useCallback(async()=>{
    setLoading(true); setError(null);
    try {
      const data=await ApiClient.getForecast(symbol,days);
      setForecast(data);
    } catch(e) { setError((e as Error).message); }
    finally { setLoading(false); }
  },[symbol,days]);

  useEffect(()=>{fetchForecast();},[fetchForecast]);

  useEffect(()=>{
    if(canvasRef.current&&forecast) drawCone(canvasRef.current,forecast);
  },[forecast]);

  const StatBox=({label,value,color}:{label:string,value:string,color?:string})=>(
    <div style={{background:BG,border:`1px solid ${BORDER}`,borderRadius:2,padding:'6px 10px',flex:1,textAlign:'center' as const}}>
      <div style={{fontSize:9,color:SUBTLE,marginBottom:2}}>{label}</div>
      <div style={{fontSize:13,color:color||TEXT,fontFamily:MONO,fontWeight:700}}>{value}</div>
    </div>
  );

  return (
    <div style={{height:'100%',display:'flex',flexDirection:'column' as const,background:BG}}>
      {showControls&&(
        <div style={{display:'flex',justifyContent:'flex-end',padding:'4px 8px'}}>
          <button onClick={fetchForecast} disabled={loading}
            style={{background:'none',border:`1px solid ${BORDER}`,color:loading?SUBTLE:TEXT,
              fontFamily:MONO,fontSize:9,padding:'3px 8px',cursor:'pointer',borderRadius:2}}>
            {loading?'LOADING...':'â†» REFRESH'}
          </button>
        </div>
      )}
      {error&&(
        <div style={{padding:'6px 10px',fontSize:10,color:RED,background:`${RED}11`,borderBottom:`1px solid ${RED}33`}}>
          âš  {error}
        </div>
      )}
      {forecast?(
        <>
          <div style={{display:'flex',gap:6,padding:'6px 10px'}}>
            <StatBox label="CURRENT" value={`$${forecast.current_price.toFixed(2)}`} color={AMBER}/>
            <StatBox label="ANN. VOL" value={`${(forecast.historical_volatility*100).toFixed(1)}%`} color={PURPLE}/>
            <StatBox label="FORECAST DAYS" value={String(forecast.forecast_days)}/>
          </div>
          <div style={{flex:1,padding:'0 10px 8px',minHeight:0}}>
            <canvas ref={canvasRef} style={{width:'100%',height:'100%',display:'block'}}
              width={600} height={280}/>
          </div>
          <div style={{display:'flex',gap:12,justifyContent:'center',padding:'4px 0 8px',
            fontSize:9,color:SUBTLE,fontFamily:MONO}}>
            <span style={{display:'inline-flex',alignItems:'center',gap:4}}>
              <span style={{width:10,height:10,border:`1px solid ${GREEN}`,background:`${GREEN}30`,display:'inline-block'}}/>
              68% CONFIDENCE
            </span>
            <span style={{display:'inline-flex',alignItems:'center',gap:4}}>
              <span style={{width:10,height:10,border:`1px solid ${BLUE}66`,background:`${BLUE}20`,display:'inline-block'}}/>
              95% CONFIDENCE
            </span>
            <span style={{display:'inline-flex',alignItems:'center',gap:4}}>
              <span style={{width:10,height:2,background:TEXT,display:'inline-block'}}/>
              MEDIAN
            </span>
          </div>
        </>
      ):(!error&&loading&&(
        <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',color:SUBTLE,fontSize:11}}>
          Loading forecast...
        </div>
      ))}
    </div>
  );
}

export function UncertaintyCone({tileId:_tileId}:TileProps) {
  const symbol=useSymbol();
  return (
    <div style={{height:'100%',display:'flex',flexDirection:'column' as const,background:PANEL,
      border:`1px solid ${BORDER}`}}>
      <div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 12px',
        borderBottom:`1px solid ${BORDER}`,background:BG}}>
        <span style={{fontSize:10,color:AMBER,letterSpacing:'0.1em',fontFamily:MONO}}>UC</span>
        <span style={{fontSize:11,color:TEXT,fontWeight:700,fontFamily:MONO}}>UNCERTAINTY CONE</span>
        <span style={{fontSize:11,color:BLUE,fontFamily:MONO}}>({symbol})</span>
      </div>
      <UncertaintyConeContent symbol={symbol}/>
    </div>
  );
}
