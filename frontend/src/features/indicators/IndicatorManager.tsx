// â”€â”€â”€ Bloomberg palette â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const BG='#0a0a0a',PANEL='#111111',BORDER='#1e1e1e'
const AMBER='#f5a623',GREEN='#26a69a',RED='#ef5350',BLUE='#42a5f5'
const PURPLE='#ab47bc',ORANGE='#ff8a65',SUBTLE='#555',TEXT='#d1d4dc'
const MONO='"Roboto Mono","Courier New",monospace'
const IND_COLORS=[BLUE,GREEN,AMBER,RED,PURPLE,ORANGE]

import { useState, useEffect } from 'react';
import React from 'react';

interface Indicator {
  id: string; type: string; name: string;
  params: Record<string, unknown>; visible: boolean; color?: string;
}
interface IndicatorManagerProps { symbol: string; onIndicatorUpdate: (indicators: Indicator[]) => void; }

const INDICATOR_PRESETS=[
  {type:'volume_profile',name:'Volume Profile',defaultParams:{profile_type:'visible_range'},category:'VOLUME'},
  {type:'anchored_vwap',name:'Anchored VWAP',defaultParams:{anchor_date:new Date().toISOString().split('T')[0]},category:'PRICE'},
  {type:'atr_bands',name:'ATR Bands',defaultParams:{period:14,multiplier:2.0},category:'VOLATILITY'},
  {type:'ema_regime',name:'EMA Regime',defaultParams:{fast:9,slow:21},category:'TREND'},
  {type:'patterns',name:'Pattern Detection',defaultParams:{confidence:0.7},category:'PATTERN'},
  {type:'rsi',name:'RSI',defaultParams:{period:14,overbought:70,oversold:30},category:'MOMENTUM'},
  {type:'macd',name:'MACD',defaultParams:{fast:12,slow:26,signal:9},category:'MOMENTUM'},
  {type:'bollinger',name:'Bollinger Bands',defaultParams:{period:20,stddev:2.0},category:'VOLATILITY'},
  {type:'pivot_points',name:'Pivot Points',defaultParams:{type:'standard'},category:'PRICE'},
  {type:'ichimoku',name:'Ichimoku Cloud',defaultParams:{tenkan:9,kijun:26,senkou_b:52},category:'TREND'},
];

export const IndicatorManager=({symbol,onIndicatorUpdate}:IndicatorManagerProps)=>{
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string|null>(null);
  const [catFilter, setCatFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  useEffect(()=>{
    const saved=localStorage.getItem(`indicators_${symbol}`);
    if(saved){try{const p=JSON.parse(saved);setIndicators(p);onIndicatorUpdate(p);}
    catch{console.error('Failed to parse saved indicators');}}
  },[symbol]);

  const saveIndicators=(next:Indicator[])=>{
    setIndicators(next);
    localStorage.setItem(`indicators_${symbol}`,JSON.stringify(next));
    onIndicatorUpdate(next);
  };

  const addIndicator=(preset:typeof INDICATOR_PRESETS[0])=>{
    const ci=indicators.length%IND_COLORS.length;
    saveIndicators([...indicators,{id:`${preset.type}_${Date.now()}`,
      type:preset.type,name:preset.name,params:{...preset.defaultParams},
      visible:true,color:IND_COLORS[ci]}]);
    setShowAdd(false);
  };
  const removeIndicator=(id:string)=>saveIndicators(indicators.filter(i=>i.id!==id));
  const toggleVisibility=(id:string)=>saveIndicators(indicators.map(i=>i.id===id?{...i,visible:!i.visible}:i));
  const updateParam=(id:string,key:string,val:unknown)=>saveIndicators(indicators.map(i=>i.id===id?{...i,params:{...i.params,[key]:val}}:i));

  const cats=['ALL',...new Set(INDICATOR_PRESETS.map(p=>p.category))];
  const filteredPresets=INDICATOR_PRESETS.filter(p=>(catFilter==='ALL'||p.category===catFilter)&&
    (!search||p.name.toLowerCase().includes(search.toLowerCase())));

  const INP:React.CSSProperties={background:BG,border:`1px solid ${BORDER}`,color:TEXT,fontFamily:MONO,
    fontSize:10,padding:'4px 8px',borderRadius:2,outline:'none',width:'100%',boxSizing:'border-box' as const}

  return (
    <div style={{display:'flex',flexDirection:'column' as const,height:'100%',background:BG,fontFamily:MONO}}>
      {/* Header */}
      <div style={{display:'flex',alignItems:'center',padding:'6px 10px',
        borderBottom:`1px solid ${BORDER}`,background:PANEL,flexShrink:0}}>
        <span style={{fontSize:9,color:AMBER,letterSpacing:'0.1em'}}>IM</span>
        <span style={{fontSize:11,color:TEXT,fontWeight:700,marginLeft:6}}>INDICATORS</span>
        <span style={{fontSize:9,color:BLUE,marginLeft:6,fontFamily:MONO}}>({symbol})</span>
        <div style={{flex:1}}/>
        <span style={{fontSize:9,color:SUBTLE,marginRight:8}}>{indicators.length} ACTIVE</span>
        <button onClick={()=>setShowAdd(!showAdd)}
          style={{padding:'3px 8px',fontSize:9,fontFamily:MONO,cursor:'pointer',
            border:`1px solid ${showAdd?AMBER:BORDER}`,background:showAdd?`${AMBER}22`:PANEL,
            color:showAdd?AMBER:TEXT,borderRadius:2}}>
          {showAdd?'âœ• CLOSE':'+ ADD'}
        </button>
      </div>

      {/* Add panel */}
      {showAdd&&(
        <div style={{borderBottom:`1px solid ${BORDER}`,background:PANEL,padding:'8px 10px',flexShrink:0}}>
          <div style={{display:'flex',gap:4,marginBottom:8,flexWrap:'wrap' as const}}>
            {cats.map(c=>(
              <button key={c} onClick={()=>setCatFilter(c)}
                style={{fontSize:8,padding:'2px 7px',fontFamily:MONO,cursor:'pointer',
                  border:`1px solid ${catFilter===c?AMBER:BORDER}`,
                  background:catFilter===c?`${AMBER}22`:BG,color:catFilter===c?AMBER:SUBTLE,borderRadius:2}}>
                {c}
              </button>
            ))}
          </div>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search..."
            style={{...INP,marginBottom:6}}/>
          <div style={{maxHeight:150,overflowY:'auto' as const}}>
            {filteredPresets.map(preset=>(
              <div key={preset.type}
                onClick={()=>addIndicator(preset)}
                style={{cursor:'pointer',padding:'5px 8px',fontSize:10,color:TEXT,
                  borderBottom:`1px solid ${BORDER}33`,display:'flex',justifyContent:'space-between',alignItems:'center'}}
                onMouseEnter={e=>{e.currentTarget.style.background=`${BORDER}88`}}
                onMouseLeave={e=>{e.currentTarget.style.background='transparent'}}>
                <span>{preset.name}</span>
                <span style={{fontSize:8,color:SUBTLE,padding:'1px 4px',border:`1px solid ${BORDER}`,borderRadius:2}}>
                  {preset.category}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active indicators list */}
      <div style={{flex:1,overflowY:'auto' as const,padding:8}}>
        {indicators.length===0?(
          <div style={{textAlign:'center' as const,padding:20,color:SUBTLE,fontSize:10}}>
            No indicators. Click + ADD to add.
          </div>
        ):(
          indicators.map(ind=>(
            <div key={ind.id} style={{background:PANEL,border:`1px solid ${BORDER}`,
              borderRadius:2,marginBottom:4,
              borderLeft:`3px solid ${ind.color||BLUE}${ind.visible?'':'44'}`}}>
              {/* Row */}
              <div style={{display:'flex',alignItems:'center',padding:'5px 8px'}}>
                <div style={{width:8,height:8,borderRadius:'50%',background:ind.color||BLUE,
                  opacity:ind.visible?1:0.3,marginRight:6,flexShrink:0}}/>
                <span style={{fontSize:10,color:ind.visible?TEXT:SUBTLE,flex:1}}>{ind.name}</span>
                <button onClick={()=>toggleVisibility(ind.id)} title={ind.visible?'Hide':'Show'}
                  style={{background:'none',border:'none',color:ind.visible?GREEN:SUBTLE,cursor:'pointer',
                    fontSize:11,padding:'0 3px'}}>
                  {ind.visible?'â—‰':'â—‹'}
                </button>
                <button onClick={()=>setEditingId(editingId===ind.id?null:ind.id)}
                  style={{background:'none',border:'none',color:SUBTLE,cursor:'pointer',fontSize:10,padding:'0 3px'}}>
                  âš™
                </button>
                <button onClick={()=>removeIndicator(ind.id)}
                  style={{background:'none',border:'none',color:`${RED}88`,cursor:'pointer',fontSize:11,padding:'0 3px'}}>
                  âœ•
                </button>
              </div>
              {/* Settings */}
              {editingId===ind.id&&(
                <div style={{padding:'6px 10px',borderTop:`1px solid ${BORDER}`,background:BG}}>
                  {Object.entries(ind.params).map(([k,v])=>(
                    <div key={k} style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}>
                      <label style={{fontSize:9,color:SUBTLE,flex:1,fontFamily:MONO}}>{k}:</label>
                      <input type={typeof v==='number'?'number':'text'} value={String(v)}
                        onChange={e=>updateParam(ind.id,k,typeof v==='number'?parseFloat(e.target.value):e.target.value)}
                        style={{...INP,width:80,flex:'none'}}/>
                    </div>
                  ))}
                  <div style={{display:'flex',gap:4,marginTop:6}}>
                    {IND_COLORS.map(c=>(
                      <div key={c} onClick={()=>saveIndicators(indicators.map(i=>i.id===ind.id?{...i,color:c}:i))}
                        style={{width:14,height:14,borderRadius:'50%',background:c,cursor:'pointer',
                          border:ind.color===c?`2px solid ${TEXT}`:'2px solid transparent'}}/>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

interface Indicator {
  id: string;
  type: string;
  name: string;
  params: Record<string, any>;
  visible: boolean;
  color?: string;
}

interface IndicatorManagerProps {
  symbol: string;
  onIndicatorUpdate: (indicators: Indicator[]) => void;
}
