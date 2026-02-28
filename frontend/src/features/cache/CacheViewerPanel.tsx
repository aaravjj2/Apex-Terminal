// â”€â”€â”€ Bloomberg palette â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const BG='#0a0a0a',PANEL='#111111',BORDER='#1e1e1e'
const AMBER='#f5a623',GREEN='#26a69a',RED='#ef5350',BLUE='#42a5f5'
const SUBTLE='#555',TEXT='#d1d4dc'
const MONO='"Roboto Mono","Courier New",monospace'

import { useState, useEffect } from 'react';
import React from 'react';
import { API_BASE } from '../../config/api';

interface CacheEntry {
  cache_key: string; request_type: string;
  params: Record<string, unknown>; checksum: string; captured_at: string;
}
interface CacheListResponse { mode: string; entries: CacheEntry[]; total: number; }

const Th=({c,testid}:{c:string,testid?:string})=><th data-testid={testid}
  style={{padding:'5px 10px',fontSize:9,letterSpacing:'0.1em',color:SUBTLE,
    textAlign:'left' as const,borderBottom:`1px solid ${BORDER}`,background:PANEL,fontFamily:MONO}}>{c}</th>

export function CacheViewerPanel() {
  const [response, setResponse] = useState<CacheListResponse|null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|null>(null);
  const [copiedKey, setCopiedKey] = useState<string|null>(null);

  useEffect(()=>{loadCacheEntries();},[]);

  const loadCacheEntries=async()=>{
    try {
      setLoading(true); setError(null);
      const res=await fetch(`${API_BASE}/api/v1/cache/entries`,{signal:AbortSignal.timeout(5000)});
      setResponse(await res.json());
    } catch { setResponse({mode:'DEMO',entries:[],total:0}); }
    finally { setLoading(false); }
  };

  const copyChecksum=async(checksum:string,key:string)=>{
    try { await navigator.clipboard.writeText(checksum); setCopiedKey(key); setTimeout(()=>setCopiedKey(null),2000); }
    catch { console.error('Failed to copy'); }
  };

  if(loading) return(
    <div data-testid="cache-viewer-loading" style={{height:'100%',display:'flex',alignItems:'center',
      justifyContent:'center',background:BG,color:SUBTLE,fontFamily:MONO,fontSize:11}}>
      Loading cache entries...
    </div>
  );
  if(error) return(
    <div data-testid="cache-viewer-error" style={{height:'100%',display:'flex',alignItems:'center',
      justifyContent:'center',background:BG,color:RED,fontFamily:MONO,fontSize:11}}>
      Error: {error}
    </div>
  );
  if(!response) return null;

  // DEMO mode
  if(response.mode==='DEMO') return(
    <div data-testid="cache-viewer-demo" style={{height:'100%',display:'flex',flexDirection:'column' as const,
      background:BG,padding:16,fontFamily:MONO}}>
      <div style={{fontSize:13,color:TEXT,fontWeight:700,marginBottom:12}}>CACHE VIEWER</div>
      <div data-testid="cache-viewer-demo-message"
        style={{background:`${AMBER}11`,border:`1px solid ${AMBER}55`,borderRadius:2,padding:16,textAlign:'center' as const}}>
        <div style={{fontSize:12,color:AMBER,fontWeight:700}}>NOT AVAILABLE IN DEMO MODE</div>
        <div style={{fontSize:10,color:SUBTLE,marginTop:6}}>
          Cache inspection is only available in LOCAL mode to prevent vendor data exposure.
        </div>
      </div>
    </div>
  );

  const entries=response.entries||[];
  return (
    <div data-testid="cache-viewer-ready" style={{height:'100%',display:'flex',flexDirection:'column' as const,background:BG}}>
      {/* Header */}
      <div style={{display:'flex',alignItems:'center',gap:10,padding:'8px 14px',
        borderBottom:`1px solid ${BORDER}`,background:PANEL,flexShrink:0}}>
        <span style={{fontSize:10,color:AMBER,letterSpacing:'0.1em',fontFamily:MONO}}>CV</span>
        <span style={{fontSize:12,color:TEXT,fontWeight:700,fontFamily:MONO}}>CACHE VIEWER</span>
        <span style={{fontSize:9,padding:'1px 6px',border:`1px solid ${GREEN}`,color:GREEN,borderRadius:2,fontFamily:MONO}}>LOCAL</span>
        <div style={{flex:1}}/>
        <span style={{fontSize:10,color:BLUE,fontFamily:MONO}}>{entries.length} ENTRIES</span>
        <button onClick={loadCacheEntries}
          style={{background:PANEL,border:`1px solid ${BORDER}`,color:TEXT,fontFamily:MONO,
            fontSize:9,padding:'3px 8px',cursor:'pointer',borderRadius:2}}>REFRESH</button>
      </div>

      {/* Content */}
      <div style={{flex:1,overflow:'auto'}}>
        {entries.length===0?(
          <div data-testid="cache-viewer-empty" style={{padding:32,textAlign:'center' as const,color:SUBTLE,fontFamily:MONO,fontSize:11}}>
            No cache entries found.<br/>
            <span style={{fontSize:9,marginTop:6,display:'block'}}>Cache entries appear when replay artifacts are saved in LOCAL mode.</span>
          </div>
        ):(
          <table data-testid="cache-viewer-table" style={{width:'100%',borderCollapse:'collapse' as const}}>
            <thead><tr>
              <Th c="CACHE KEY" testid="cache-table-header-cache-key"/>
              <Th c="TYPE" testid="cache-table-header-type"/>
              <Th c="PARAMS" testid="cache-table-header-params"/>
              <Th c="CHECKSUM" testid="cache-table-header-checksum"/>
              <Th c="CAPTURED" testid="cache-table-header-captured"/>
            </tr></thead>
            <tbody>
              {entries.map((entry,i)=>(
                <tr key={entry.cache_key} data-testid={`cache-entry-${i}`}
                  style={{background:'transparent'}}
                  onMouseEnter={e=>{e.currentTarget.style.background=`${BORDER}66`}}
                  onMouseLeave={e=>{e.currentTarget.style.background='transparent'}}>
                  <td data-testid={`cache-entry-${i}-cache-key`}
                    style={{padding:'6px 10px',fontSize:10,color:BLUE,fontFamily:MONO,
                      borderBottom:`1px solid ${BORDER}33`,maxWidth:160,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const}}>
                    {entry.cache_key}
                  </td>
                  <td data-testid={`cache-entry-${i}-type`}
                    style={{padding:'6px 10px',fontSize:10,color:AMBER,fontFamily:MONO,borderBottom:`1px solid ${BORDER}33`}}>
                    {entry.request_type}
                  </td>
                  <td data-testid={`cache-entry-${i}-params`}
                    style={{padding:'6px 10px',fontSize:9,color:SUBTLE,fontFamily:MONO,borderBottom:`1px solid ${BORDER}33`,maxWidth:200,overflow:'hidden',textOverflow:'ellipsis' as const}}>
                    {JSON.stringify(entry.params).substring(0,80)}{JSON.stringify(entry.params).length>80?'...':''}
                  </td>
                  <td data-testid={`cache-entry-${i}-checksum`}
                    style={{padding:'6px 10px',borderBottom:`1px solid ${BORDER}33`}}>
                    <div style={{display:'flex',alignItems:'center',gap:6}}>
                      <code style={{fontSize:9,fontFamily:MONO,color:SUBTLE}}>{entry.checksum.substring(0,12)}...</code>
                      <button onClick={()=>copyChecksum(entry.checksum,entry.cache_key)}
                        data-testid={`copy-checksum-${i}`}
                        style={{fontSize:8,padding:'2px 6px',fontFamily:MONO,cursor:'pointer',
                          border:`1px solid ${copiedKey===entry.cache_key?GREEN:BORDER}`,
                          background:copiedKey===entry.cache_key?`${GREEN}22`:PANEL,
                          color:copiedKey===entry.cache_key?GREEN:TEXT,borderRadius:2}}>
                        {copiedKey===entry.cache_key?'âœ“ COPIED':'COPY'}
                      </button>
                    </div>
                  </td>
                  <td data-testid={`cache-entry-${i}-captured`}
                    style={{padding:'6px 10px',fontSize:9,color:SUBTLE,fontFamily:MONO,borderBottom:`1px solid ${BORDER}33`}}>
                    {new Date(entry.captured_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

