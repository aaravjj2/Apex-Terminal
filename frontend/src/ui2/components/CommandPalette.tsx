/**
 * CommandPalette â€” Bloomberg Terminal Edition
 * Ctrl+K command palette for navigation and actions
 */
// â”€â”€â”€ Bloomberg palette â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const BG='#0a0a0a',PANEL='#111111',BORDER='#1e1e1e'
const AMBER='#f5a623',GREEN='#26a69a',BLUE='#42a5f5'
const PURPLE='#ab47bc',ORANGE='#ff8a65',SUBTLE='#555',TEXT='#d1d4dc'
const MONO='"Roboto Mono","Courier New",monospace'

import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

export interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon?: string;
  category?: 'navigation' | 'action' | 'setting' | 'ticker';
  keywords?: string[];
  onSelect?: () => void;
  path?: string;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  commands: CommandItem[];
  testId?: string;
}

const catColor=(cat:string)=>{
  if(cat==='navigation') return BLUE;
  if(cat==='action') return GREEN;
  if(cat==='setting') return AMBER;
  if(cat==='ticker') return ORANGE;
  return PURPLE;
}

export function CommandPalette({
  isOpen, onClose, commands, testId='command-palette',
}: CommandPaletteProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredCommands = useMemo(() => {
    if (!query.trim()) return commands;
    const lq = query.toLowerCase();
    return commands.filter(cmd=>
      cmd.label.toLowerCase().includes(lq)||
      cmd.description?.toLowerCase().includes(lq)||
      cmd.keywords?.some(k=>k.toLowerCase().includes(lq))
    );
  }, [query, commands]);

  useEffect(() => { setSelectedIndex(0); }, [filteredCommands]);
  useEffect(() => {
    if(isOpen){ setQuery(''); setSelectedIndex(0); setTimeout(()=>inputRef.current?.focus(),80); }
  }, [isOpen]);

  useEffect(() => {
    if(!isOpen) return;
    const h=(e:KeyboardEvent)=>{
      if(e.key==='Escape') onClose();
      else if(e.key==='ArrowDown'){e.preventDefault();setSelectedIndex(i=>Math.min(i+1,filteredCommands.length-1));}
      else if(e.key==='ArrowUp'){e.preventDefault();setSelectedIndex(i=>Math.max(i-1,0));}
      else if(e.key==='Enter'){e.preventDefault();const c=filteredCommands[selectedIndex];if(c)handleSelect(c);}
    };
    window.addEventListener('keydown',h);
    return ()=>window.removeEventListener('keydown',h);
  }, [isOpen, filteredCommands, selectedIndex, onClose]);

  const handleSelect=(cmd:CommandItem)=>{
    if(cmd.onSelect) cmd.onSelect();
    else if(cmd.path) navigate(cmd.path);
    onClose();
  };

  if(!isOpen) return null;

  const groups=filteredCommands.reduce((acc,cmd)=>{
    const cat=cmd.category||'other';
    if(!acc[cat]) acc[cat]=[];
    acc[cat].push(cmd);
    return acc;
  },{} as Record<string,CommandItem[]>);

  return (
    <>
      {/* Backdrop */}
      <div data-testid={`${testId}-backdrop`} onClick={onClose}
        style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.75)',zIndex:1000,backdropFilter:'blur(2px)'}}/>

      {/* Palette */}
      <div data-testid={testId} data-state="open"
        style={{position:'fixed',top:'18vh',left:'50%',transform:'translateX(-50%)',
          width:'90%',maxWidth:640,background:PANEL,border:`1px solid ${BORDER}`,
          borderRadius:3,boxShadow:`0 24px 64px rgba(0,0,0,0.8)`,zIndex:1001,overflow:'hidden',
          fontFamily:MONO}}>

        {/* Bloomberg header band */}
        <div style={{padding:'6px 14px',borderBottom:`1px solid ${BORDER}`,background:BG,
          display:'flex',alignItems:'center',gap:8}}>
          <span style={{fontSize:10,color:GREEN,letterSpacing:'0.1em'}}>CMD</span>
          <span style={{fontSize:11,color:TEXT}}>COMMAND PALETTE</span>
          <span style={{flex:1}}/>
          <span style={{fontSize:9,color:SUBTLE}}>â†‘â†“ NAVIGATE Â· ENTER SELECT Â· ESC CLOSE</span>
        </div>

        {/* Input */}
        <div style={{padding:'10px 14px',borderBottom:`1px solid ${BORDER}`,background:BG}}>
          <input ref={inputRef} type="text" value={query} onChange={e=>setQuery(e.target.value)}
            placeholder="Type command, view name, or ticker..."
            data-testid={`${testId}-input`}
            style={{width:'100%',background:PANEL,border:`1px solid ${BORDER}`,borderRadius:2,
              padding:'8px 12px',fontSize:12,color:TEXT,outline:'none',fontFamily:MONO,
              letterSpacing:'0.04em',boxSizing:'border-box' as const}}/>
        </div>

        {/* Results */}
        <div data-testid={`${testId}-results`}
          style={{maxHeight:380,overflowY:'auto' as const,overflowX:'hidden' as const}}>
          {filteredCommands.length===0?(
            <div style={{padding:'32px 20px',textAlign:'center' as const,color:SUBTLE,fontSize:11}}>
              No commands found for &quot;{query}&quot;
            </div>
          ):(
            Object.entries(groups).map(([category,items])=>(
              <div key={category}>
                {/* Category header */}
                <div style={{padding:'6px 14px 3px',fontSize:9,color:catColor(category),
                  letterSpacing:'0.12em',textTransform:'uppercase' as const,
                  borderTop:`1px solid ${BORDER}`,background:BG}}>
                  {category} ({items.length})
                </div>
                {items.map(cmd=>{
                  const gi=filteredCommands.indexOf(cmd);
                  const sel=gi===selectedIndex;
                  return (
                    <button key={cmd.id} data-testid={`${testId}-item-${cmd.id}`}
                      onClick={()=>handleSelect(cmd)}
                      style={{width:'100%',display:'flex',alignItems:'center',gap:10,padding:'9px 14px',
                        textAlign:'left' as const,background:sel?`${BORDER}`:'transparent',
                        border:'none',cursor:'pointer',transition:'background 0.08s',
                        borderLeft:`3px solid ${sel?catColor(category):'transparent'}`}}>
                      {cmd.icon&&(
                        <span style={{fontSize:16,flexShrink:0,width:20,textAlign:'center' as const}}>{cmd.icon}</span>
                      )}
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:12,color:sel?TEXT:TEXT,fontWeight:sel?700:400,letterSpacing:'0.03em'}}>
                          {cmd.label}
                        </div>
                        {cmd.description&&(
                          <div style={{fontSize:10,color:SUBTLE,marginTop:2,overflow:'hidden',
                            textOverflow:'ellipsis',whiteSpace:'nowrap' as const}}>
                            {cmd.description}
                          </div>
                        )}
                      </div>
                      {cmd.category&&(
                        <span style={{fontSize:9,padding:'2px 6px',border:`1px solid ${catColor(cmd.category)}44`,
                          color:catColor(cmd.category),borderRadius:2,letterSpacing:'0.07em',flexShrink:0}}>
                          {cmd.category.toUpperCase()}
                        </span>
                      )}
                      {sel&&(
                        <span style={{fontSize:10,color:SUBTLE,padding:'2px 6px',
                          background:BG,borderRadius:2,border:`1px solid ${BORDER}`,flexShrink:0}}>â†µ</span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div style={{padding:'5px 14px',borderTop:`1px solid ${BORDER}`,background:BG,
          display:'flex',gap:16,fontSize:9,color:SUBTLE}}>
          <span><span style={{color:TEXT}}>â†‘â†“</span> NAVIGATE</span>
          <span><span style={{color:TEXT}}>ENTER</span> EXECUTE</span>
          <span><span style={{color:TEXT}}>ESC</span> CLOSE</span>
          <span style={{flex:1}}/>
          <span>{filteredCommands.length} RESULT{filteredCommands.length!==1?'S':''}</span>
        </div>
      </div>
    </>
  );
}

export interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon?: string;
  category?: 'navigation' | 'action' | 'setting' | 'ticker';
  keywords?: string[];
  onSelect?: () => void;
  path?: string;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  commands: CommandItem[];
  testId?: string;
}

