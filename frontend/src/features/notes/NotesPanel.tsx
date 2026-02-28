// â”€â”€â”€ Bloomberg palette â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const BG='#0a0a0a',PANEL='#111111',BORDER='#1e1e1e'
const AMBER='#f5a623',GREEN='#26a69a',RED='#ef5350',BLUE='#42a5f5'
const SUBTLE='#555',TEXT='#d1d4dc'
const MONO='"Roboto Mono","Courier New",monospace'

import { useState, useEffect } from 'react';
import React from 'react';

const API_BASE='/api/v1';

interface Note {
  id: string; content: string; anchor_type: string; anchor_id?: string;
  anchor_timestamp?: string; symbol?: string; created_at: string;
  updated_at: string; tags: string[];
}

export function NotesPanel() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [newAnchorType, setNewAnchorType] = useState('time');
  const [newTags, setNewTags] = useState('');
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState<{msg:string,ok:boolean}|null>(null);

  useEffect(()=>{fetchNotes();},[]);

  const showT=(msg:string,ok=true)=>{setToast({msg,ok});setTimeout(()=>setToast(null),2500);};

  const fetchNotes=async()=>{
    setLoading(true);
    try {const res=await fetch(`${API_BASE}/notes`);if(res.ok)setNotes(await res.json());}
    catch{console.error('Failed to fetch notes');}
    finally{setLoading(false);}
  };

  const createNote=async()=>{
    if(!newContent.trim()) return;
    try {
      const res=await fetch(`${API_BASE}/notes`,{method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({content:newContent,anchor_type:newAnchorType,
          tags:newTags.split(',').map(t=>t.trim()).filter(Boolean)})});
      if(res.ok){setShowCreate(false);setNewContent('');setNewTags('');fetchNotes();showT('Note saved');}
    } catch{showT('Failed to save note',false);}
  };

  const deleteNote=async(id:string)=>{
    if(!confirm('Delete this note?')) return;
    try{await fetch(`${API_BASE}/notes/${id}`,{method:'DELETE'});fetchNotes();showT('Note deleted');}
    catch{showT('Failed to delete',false);}
  };

  const fmtDate=(iso:string)=>{
    const d=new Date(iso);
    return d.toLocaleDateString()+' '+d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
  };

  const anchorColors:Record<string,string>={time:SUBTLE,bar:BLUE,trade:GREEN,order:AMBER};
  const filteredNotes=notes.filter(n=>!search||n.content.toLowerCase().includes(search.toLowerCase())||
    n.tags.some(t=>t.toLowerCase().includes(search.toLowerCase())));

  const INP:React.CSSProperties={background:BG,border:`1px solid ${BORDER}`,color:TEXT,fontFamily:MONO,
    fontSize:10,padding:'5px 8px',borderRadius:2,outline:'none',width:'100%',boxSizing:'border-box' as const}

  return (
    <div style={{height:'100%',display:'flex',flexDirection:'column' as const,background:BG,fontFamily:MONO}}>
      {/* Header */}
      <div style={{display:'flex',alignItems:'center',gap:8,padding:'6px 10px',
        borderBottom:`1px solid ${BORDER}`,background:PANEL,flexShrink:0}}>
        <span style={{fontSize:10,color:AMBER,letterSpacing:'0.1em'}}>JR</span>
        <span style={{fontSize:11,color:TEXT,fontWeight:700}}>JOURNAL</span>
        <span style={{fontSize:9,color:SUBTLE}}>({notes.length} notes)</span>
        <div style={{flex:1}}/>
        <button onClick={fetchNotes}
          style={{background:'none',border:'none',color:loading?AMBER:SUBTLE,cursor:'pointer',fontSize:12,padding:'0 4px'}}>
          {loading?'âŸ³':'â†»'}
        </button>
        <button onClick={()=>setShowCreate(!showCreate)}
          style={{fontSize:9,padding:'3px 8px',fontFamily:MONO,cursor:'pointer',
            border:`1px solid ${showCreate?AMBER:GREEN}`,background:showCreate?`${AMBER}22`:`${GREEN}22`,
            color:showCreate?AMBER:GREEN,borderRadius:2}}>
          {showCreate?'âœ• CANCEL':'+ ADD'}
        </button>
      </div>

      {/* Search */}
      <div style={{padding:'6px 10px',borderBottom:`1px solid ${BORDER}`,background:PANEL,flexShrink:0}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search notes..."
          style={{...INP}}/>
      </div>

      {/* Toast */}
      {toast&&(
        <div style={{padding:'4px 10px',background:toast.ok?`${GREEN}22`:`${RED}22`,
          borderBottom:`1px solid ${toast.ok?GREEN:RED}`,fontSize:9,color:toast.ok?GREEN:RED}}>
          {toast.msg}
        </div>
      )}

      {/* Create form */}
      {showCreate&&(
        <div style={{padding:'10px',borderBottom:`1px solid ${BORDER}`,background:PANEL,flexShrink:0}}>
          <textarea value={newContent} onChange={e=>setNewContent(e.target.value)}
            placeholder="Write your note..."
            style={{...INP,height:80,resize:'vertical' as const,lineHeight:'1.4'}}/>
          <div style={{display:'flex',gap:6,marginTop:6}}>
            <select value={newAnchorType} onChange={e=>setNewAnchorType(e.target.value)}
              style={{...INP,width:100,flex:'none',appearance:'none' as const}}>
              <option value="time">GENERAL</option>
              <option value="bar">BAR</option>
              <option value="trade">TRADE</option>
              <option value="order">ORDER</option>
            </select>
            <input type="text" value={newTags} onChange={e=>setNewTags(e.target.value)}
              placeholder="tags, comma-separated" style={{...INP,flex:1}}/>
          </div>
          <div style={{display:'flex',justifyContent:'flex-end',gap:6,marginTop:6}}>
            <button onClick={()=>setShowCreate(false)}
              style={{fontSize:9,padding:'4px 10px',fontFamily:MONO,cursor:'pointer',
                border:`1px solid ${BORDER}`,background:PANEL,color:SUBTLE,borderRadius:2}}>CANCEL</button>
            <button onClick={createNote} disabled={!newContent.trim()}
              style={{fontSize:9,padding:'4px 10px',fontFamily:MONO,cursor:'pointer',
                border:`1px solid ${GREEN}`,background:`${GREEN}22`,color:GREEN,borderRadius:2,
                opacity:!newContent.trim()?0.4:1}}>SAVE NOTE</button>
          </div>
        </div>
      )}

      {/* Notes list */}
      <div style={{flex:1,overflowY:'auto' as const,padding:8}}>
        {filteredNotes.length===0?(
          <div style={{textAlign:'center' as const,color:SUBTLE,fontSize:10,padding:20}}>
            {search?'No notes match search.':'No notes yet. Click + ADD to create one.'}
          </div>
        ):(
          filteredNotes.map(note=>(
            <div key={note.id} style={{background:PANEL,border:`1px solid ${BORDER}`,marginBottom:6,borderRadius:2,
              borderLeft:`3px solid ${anchorColors[note.anchor_type]||SUBTLE}`}}>
              <div style={{padding:'8px 10px'}}>
                <div style={{display:'flex',alignItems:'flex-start',gap:6}}>
                  <div style={{flex:1}}>
                    <p style={{fontSize:10,color:TEXT,margin:0,whiteSpace:'pre-wrap' as const,lineHeight:'1.5'}}>{note.content}</p>
                    <div style={{display:'flex',flexWrap:'wrap' as const,gap:4,marginTop:6}}>
                      <span style={{fontSize:8,padding:'1px 5px',border:`1px solid ${anchorColors[note.anchor_type]||SUBTLE}`,
                        color:anchorColors[note.anchor_type]||SUBTLE,borderRadius:2}}>{note.anchor_type.toUpperCase()}</span>
                      {note.tags.map(tag=>(
                        <span key={tag} style={{fontSize:8,padding:'1px 5px',border:`1px solid ${BLUE}55`,
                          color:BLUE,borderRadius:2}}>#{tag}</span>
                      ))}
                    </div>
                    <div style={{fontSize:9,color:SUBTLE,marginTop:4}}>{fmtDate(note.created_at)}</div>
                  </div>
                  <button onClick={()=>deleteNote(note.id)}
                    style={{background:'none',border:'none',color:`${RED}66`,cursor:'pointer',fontSize:12,padding:'0 4px',flexShrink:0}}
                    onMouseEnter={e=>{e.currentTarget.style.color=RED}}
                    onMouseLeave={e=>{e.currentTarget.style.color=`${RED}66`}}>âœ•</button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

interface Note {
    id: string;
    content: string;
    anchor_type: string;
    anchor_id?: string;
    anchor_timestamp?: string;
    symbol?: string;
    created_at: string;
    updated_at: string;
    tags: string[];
}

