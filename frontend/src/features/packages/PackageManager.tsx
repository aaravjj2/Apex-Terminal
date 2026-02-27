// â”€â”€â”€ Bloomberg palette â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const BG='#0a0a0a',PANEL='#111111',BORDER='#1e1e1e'
const AMBER='#f5a623',GREEN='#26a69a',RED='#ef5350',BLUE='#42a5f5'
const PURPLE='#ab47bc',ORANGE='#ff8a65',SUBTLE='#555',TEXT='#d1d4dc'
const MONO='"Roboto Mono","Courier New",monospace'

function TypeBadge({type}:{type:string}){
  const c=type==='strategy'?PURPLE:type==='indicator'?BLUE:ORANGE
  return <span style={{fontSize:9,color:c,border:`1px solid ${c}`,padding:'1px 5px',borderRadius:2,
    fontFamily:MONO,textTransform:'uppercase' as const,letterSpacing:'0.07em'}}>{type}</span>
}
function CapBadge({cap,danger}:{cap:string,danger:boolean}){
  return <span style={{fontSize:9,padding:'1px 5px',borderRadius:2,fontFamily:MONO,
    color:danger?RED:SUBTLE,border:`1px solid ${danger?RED:BORDER}`,marginRight:3}}>{cap}</span>
}
function StatCard({label,value,color}:{label:string,value:string,color?:string}){
  return (
    <div style={{background:PANEL,border:`1px solid ${BORDER}`,borderRadius:2,padding:'7px 10px',minWidth:90}}>
      <div style={{fontSize:9,fontFamily:MONO,color:SUBTLE,textTransform:'uppercase' as const,letterSpacing:'0.08em',marginBottom:3}}>{label}</div>
      <div style={{fontSize:15,fontFamily:MONO,color:color||AMBER,fontWeight:700}}>{value}</div>
    </div>
  )
}

import React, { useState, useEffect } from 'react';

const API_BASE = '/api/v1';

interface InstalledPackage {
    name: string;
    version: string;
    type: string;
    description: string;
    author: string;
    capabilities: string[];
    enabled: boolean;
    installed_at: string;
}

const DANGER_CAPS = ['place_orders','access_network','write_files','admin']
const TABS=['PACKAGES','INSTALL','DETAILS'] as const
type PMTab=typeof TABS[number]

const TEXTAREA:React.CSSProperties={width:'100%',background:BG,border:`1px solid ${BORDER}`,color:TEXT,
  fontFamily:MONO,fontSize:11,padding:'6px 8px',borderRadius:2,outline:'none',resize:'vertical' as const,boxSizing:'border-box' as const}

export function PackageManager() {
    const [packages, setPackages] = useState<InstalledPackage[]>([]);
    const [loading, setLoading] = useState(false);
    const [tab, setTab] = useState<PMTab>('PACKAGES');
    const [selected, setSelected] = useState<InstalledPackage|null>(null);
    const [installCode, setInstallCode] = useState('# strategy code here\n\ndef on_bar(ctx):\n    pass');
    const [installManifest, setInstallManifest] = useState(() =>
        JSON.stringify({name:'my-strategy',version:'1.0.0',description:'A custom strategy',
            author:'user',type:'strategy',capabilities:['read_bars']},null,2));
    const [installMsg, setInstallMsg] = useState('');
    const [installing, setInstalling] = useState(false);

    useEffect(() => { fetchPackages(); }, []);

    const fetchPackages = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/packages`);
            if (res.ok) setPackages(await res.json());
        } catch (e) { console.error('Failed to fetch packages:', e); }
        finally { setLoading(false); }
    };

    const handleInstall = async () => {
        setInstalling(true); setInstallMsg('');
        try {
            const manifest = JSON.parse(installManifest);
            const res = await fetch(`${API_BASE}/packages`, {
                method: 'POST',
                headers: {'Content-Type':'application/json'},
                body: JSON.stringify({manifest, code: installCode})
            });
            if (res.ok) {
                setInstallMsg('Package installed successfully');
                setTab('PACKAGES');
                fetchPackages();
            } else {
                const err = await res.json().catch(()=>({detail:'Unknown error'}));
                setInstallMsg(`Error: ${err.detail}`);
            }
        } catch (e) { setInstallMsg(`JSON parse error: ${e}`); }
        finally { setInstalling(false); }
    };

    const handleUninstall = async (name: string) => {
        try {
            await fetch(`${API_BASE}/packages/${name}`, {method:'DELETE'});
            if (selected?.name===name) { setSelected(null); setTab('PACKAGES'); }
            fetchPackages();
        } catch (e) { console.error('Uninstall failed:', e); }
    };

    const handleToggle = async (name: string, enabled: boolean) => {
        try {
            await fetch(`${API_BASE}/packages/${name}/${enabled?'disable':'enable'}`, {method:'POST'});
            fetchPackages();
            setSelected(s=>s&&s.name===name?{...s,enabled:!enabled}:s);
        } catch (e) { console.error('Toggle failed:', e); }
    };

    const strategies=packages.filter(p=>p.type==='strategy');
    const indicators=packages.filter(p=>p.type==='indicator');

    const S:React.CSSProperties={height:'100%',display:'flex',flexDirection:'column' as const,background:BG,fontFamily:MONO}
    const HDR:React.CSSProperties={display:'flex',alignItems:'center',gap:8,padding:'8px 14px',
        borderBottom:`1px solid ${BORDER}`,background:PANEL,flexShrink:0}
    const TABBAR:React.CSSProperties={display:'flex',gap:2,padding:'0 14px',borderBottom:`1px solid ${BORDER}`,
        background:PANEL,flexShrink:0}
    const tbtn=(a:boolean):React.CSSProperties=>({padding:'7px 12px',fontSize:10,fontFamily:MONO,letterSpacing:'0.08em',
        cursor:'pointer',background:'none',border:'none',borderBottom:a?`2px solid ${AMBER}`:'2px solid transparent',
        color:a?AMBER:SUBTLE,textTransform:'uppercase' as const})

    return (
        <div style={S}>
            <div style={HDR}>
                <span style={{fontSize:11,color:BLUE,letterSpacing:'0.1em'}}>PM</span>
                <span style={{fontSize:13,color:TEXT,fontWeight:700}}>PACKAGE MANAGER</span>
                <span style={{fontSize:10,color:SUBTLE}}>APEX PLUGIN REGISTRY</span>
                <div style={{flex:1}}/>
                {loading&&<span style={{fontSize:10,color:AMBER}}>LOADING</span>}
                <button onClick={fetchPackages} style={{fontSize:10,fontFamily:MONO,background:PANEL,
                    border:`1px solid ${BORDER}`,color:BLUE,padding:'3px 8px',cursor:'pointer',borderRadius:2}}>REFRESH</button>
                <button onClick={()=>setTab('INSTALL')} style={{fontSize:10,fontFamily:MONO,background:AMBER,
                    border:'none',color:BG,padding:'3px 10px',cursor:'pointer',borderRadius:2,fontWeight:700}}>+ INSTALL</button>
            </div>

            {/* Stats */}
            <div style={{display:'flex',gap:8,padding:'8px 14px',borderBottom:`1px solid ${BORDER}`,
                background:PANEL,flexShrink:0}}>
                <StatCard label="Total" value={String(packages.length)} color={TEXT}/>
                <StatCard label="Enabled" value={String(packages.filter(p=>p.enabled).length)} color={GREEN}/>
                <StatCard label="Strategies" value={String(strategies.length)} color={PURPLE}/>
                <StatCard label="Indicators" value={String(indicators.length)} color={BLUE}/>
            </div>

            <div style={TABBAR}>
                {TABS.map(t=><button key={t} style={tbtn(tab===t)} onClick={()=>setTab(t)}>{t}</button>)}
            </div>

            {/* PACKAGES list */}
            {tab==='PACKAGES'&&(
                <div style={{flex:1,overflowY:'auto' as const,padding:'8px 0'}}>
                    {packages.length===0&&(
                        <div style={{padding:40,textAlign:'center' as const,fontSize:12,color:SUBTLE}}>
                            NO PACKAGES INSTALLED â€” CLICK + INSTALL
                        </div>
                    )}
                    {packages.map(pkg=>(
                        <div key={pkg.name}
                            onClick={()=>{setSelected(pkg);setTab('DETAILS');}}
                            style={{padding:'10px 14px',borderBottom:`1px solid ${BORDER}`,cursor:'pointer',
                                background:selected?.name===pkg.name?`${AMBER}0a`:'transparent',
                                opacity:pkg.enabled?1:0.55}}>
                            <div style={{display:'flex',gap:8,alignItems:'flex-start'}}>
                                <div style={{flex:1,minWidth:0}}>
                                    <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:4}}>
                                        <span style={{fontSize:12,color:TEXT,fontWeight:700}}>{pkg.name}</span>
                                        <span style={{fontSize:9,color:SUBTLE,fontFamily:MONO}}>v{pkg.version}</span>
                                        <TypeBadge type={pkg.type}/>
                                        {!pkg.enabled&&<span style={{fontSize:9,color:SUBTLE,border:`1px solid ${SUBTLE}`,padding:'1px 4px',borderRadius:2}}>DISABLED</span>}
                                    </div>
                                    <div style={{fontSize:11,color:SUBTLE,marginBottom:4}}>{pkg.description}</div>
                                    <div style={{display:'flex',flexWrap:'wrap' as const,gap:2}}>
                                        {pkg.capabilities.map(c=>(
                                            <CapBadge key={c} cap={c} danger={DANGER_CAPS.includes(c)}/>
                                        ))}
                                    </div>
                                </div>
                                <div style={{display:'flex',gap:6,alignItems:'center',flexShrink:0}}
                                    onClick={e=>e.stopPropagation()}>
                                    <button onClick={()=>handleToggle(pkg.name,pkg.enabled)}
                                        style={{fontSize:9,fontFamily:MONO,background:PANEL,cursor:'pointer',borderRadius:2,
                                            border:`1px solid ${pkg.enabled?GREEN:SUBTLE}`,
                                            color:pkg.enabled?GREEN:SUBTLE,padding:'3px 8px'}}>
                                        {pkg.enabled?'DISABLE':'ENABLE'}
                                    </button>
                                    <button onClick={()=>handleUninstall(pkg.name)}
                                        style={{fontSize:9,fontFamily:MONO,background:PANEL,cursor:'pointer',borderRadius:2,
                                            border:`1px solid ${RED}`,color:RED,padding:'3px 8px'}}>
                                        REMOVE
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* INSTALL form */}
            {tab==='INSTALL'&&(
                <div style={{flex:1,overflowY:'auto' as const,padding:14}}>
                    <div style={{maxWidth:540,display:'flex',flexDirection:'column' as const,gap:14}}>
                        <div style={{fontSize:11,color:TEXT,fontWeight:700}}>INSTALL PACKAGE</div>
                        <div>
                            <div style={{fontSize:9,color:SUBTLE,textTransform:'uppercase' as const,letterSpacing:'0.08em',marginBottom:4}}>Manifest (JSON)</div>
                            <textarea value={installManifest} onChange={e=>setInstallManifest(e.target.value)}
                                rows={10} style={TEXTAREA}/>
                        </div>
                        <div>
                            <div style={{fontSize:9,color:SUBTLE,textTransform:'uppercase' as const,letterSpacing:'0.08em',marginBottom:4}}>Code (Python)</div>
                            <textarea value={installCode} onChange={e=>setInstallCode(e.target.value)}
                                rows={8} style={TEXTAREA}/>
                        </div>
                        <div style={{display:'flex',gap:8,alignItems:'center'}}>
                            <button onClick={handleInstall} disabled={installing}
                                style={{padding:'7px 18px',fontSize:11,fontFamily:MONO,background:AMBER,
                                    border:'none',color:BG,cursor:installing?'not-allowed':'pointer',
                                    borderRadius:2,fontWeight:700,opacity:installing?0.6:1}}>
                                {installing?'INSTALLING...':'INSTALL PACKAGE'}
                            </button>
                            <button onClick={()=>setTab('PACKAGES')}
                                style={{padding:'7px 14px',fontSize:10,fontFamily:MONO,background:PANEL,
                                    border:`1px solid ${BORDER}`,color:SUBTLE,cursor:'pointer',borderRadius:2}}>CANCEL</button>
                        </div>
                        {installMsg&&<div style={{fontSize:11,fontFamily:MONO,
                            color:installMsg.startsWith('Error')||installMsg.includes('error')?RED:GREEN}}>{installMsg}</div>}
                    </div>
                </div>
            )}

            {/* DETAILS panel */}
            {tab==='DETAILS'&&(
                <div style={{flex:1,overflowY:'auto' as const,padding:14}}>
                    {!selected&&<div style={{padding:40,textAlign:'center' as const,color:SUBTLE,fontSize:12}}>SELECT A PACKAGE</div>}
                    {selected&&(
                        <div style={{display:'flex',flexDirection:'column' as const,gap:14,maxWidth:520}}>
                            <div style={{display:'flex',gap:10,alignItems:'center'}}>
                                <span style={{fontSize:13,color:TEXT,fontWeight:700}}>{selected.name}</span>
                                <span style={{fontSize:10,color:SUBTLE,fontFamily:MONO}}>v{selected.version}</span>
                                <TypeBadge type={selected.type}/>
                                <div style={{flex:1}}/>
                                <button onClick={()=>handleToggle(selected.name,selected.enabled)}
                                    style={{fontSize:10,fontFamily:MONO,background:PANEL,cursor:'pointer',borderRadius:2,
                                        border:`1px solid ${selected.enabled?GREEN:SUBTLE}`,
                                        color:selected.enabled?GREEN:SUBTLE,padding:'4px 10px'}}>
                                    {selected.enabled?'DISABLE':'ENABLE'}
                                </button>
                                <button onClick={()=>handleUninstall(selected.name)}
                                    style={{fontSize:10,fontFamily:MONO,background:PANEL,cursor:'pointer',borderRadius:2,
                                        border:`1px solid ${RED}`,color:RED,padding:'4px 10px'}}>REMOVE</button>
                            </div>
                            <div style={{background:PANEL,border:`1px solid ${BORDER}`,borderRadius:2,padding:'10px 12px'}}>
                                <div style={{fontSize:11,color:SUBTLE}}>{selected.description}</div>
                            </div>
                            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                                <div style={{background:PANEL,border:`1px solid ${BORDER}`,borderRadius:2,padding:'8px 12px'}}>
                                    <div style={{fontSize:8,color:SUBTLE,textTransform:'uppercase' as const,marginBottom:3}}>Author</div>
                                    <div style={{fontSize:11,color:TEXT,fontFamily:MONO}}>{selected.author}</div>
                                </div>
                                <div style={{background:PANEL,border:`1px solid ${BORDER}`,borderRadius:2,padding:'8px 12px'}}>
                                    <div style={{fontSize:8,color:SUBTLE,textTransform:'uppercase' as const,marginBottom:3}}>Installed</div>
                                    <div style={{fontSize:11,color:TEXT,fontFamily:MONO}}>{new Date(selected.installed_at).toLocaleDateString()}</div>
                                </div>
                            </div>
                            <div style={{background:PANEL,border:`1px solid ${BORDER}`,borderRadius:2,padding:'10px 12px'}}>
                                <div style={{fontSize:9,color:SUBTLE,textTransform:'uppercase' as const,marginBottom:6}}>Capabilities</div>
                                <div style={{display:'flex',flexWrap:'wrap' as const,gap:4}}>
                                    {selected.capabilities.map(c=><CapBadge key={c} cap={c} danger={DANGER_CAPS.includes(c)}/>)}
                                </div>
                                {selected.capabilities.some(c=>DANGER_CAPS.includes(c))&&(
                                    <div style={{fontSize:10,color:RED,marginTop:8,fontFamily:MONO}}>
                                        âš  This package requests elevated permissions
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
