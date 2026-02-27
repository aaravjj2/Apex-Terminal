// Bloomberg CommandPalette
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

import { useState, useEffect, useRef } from 'react';
import React from 'react';
import { useAppStore } from '../../../state/appStore';
import { disambiguate } from '../../ticker/disambiguator';
import { TickerDisambiguationDialog } from '../../ticker/TickerDisambiguationDialog';
import type { AmbiguousEntry } from '../../ticker/disambiguator';

const NAV_ITEMS = [
  { icon: '▦', label: 'Go to Monitor',    shortcut: '⌘1' },
  { icon: '⏪', label: 'Go to Replay',    shortcut: '⌘2' },
  { icon: '⚡', label: 'Go to Strategies', shortcut: '⌘3' },
  { icon: '🔔', label: 'Go to Alerts',    shortcut: '⌘4' },
  { icon: '📄', label: 'Go to Reports',   shortcut: '⌘5' },
  { icon: '⚙', label: 'Go to Settings',  shortcut: '⌘,' },
];

const ACTION_ITEMS = [
  { icon: '▶', label: 'Start Strategy' },
  { icon: '■', label: 'Stop All Strategies' },
];

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const [search, setSearch] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const { setSymbol } = useAppStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const [disambigDialog, setDisambigDialog] = useState<{
    open: boolean; symbol: string; entry: AmbiguousEntry;
  }>({ open: false, symbol: '', entry: { company: '', confusion: '' } });

  const isSymbol = search.length > 0 && /^[A-Z]{1,5}$/i.test(search);
  const allItems = [
    ...(isSymbol ? [{ type: 'symbol', label: `Switch to ${search.toUpperCase()}`, icon: '🔍', shortcut: '↵' }] : []),
    ...NAV_ITEMS.map(i => ({ ...i, type: 'nav' })),
    ...ACTION_ITEMS.map(i => ({ ...i, type: 'action' })),
  ];

  const handleSymbolSelect = () => {
    const result = disambiguate(search);
    if (result.isAmbiguous && result.entry) {
      setDisambigDialog({ open: true, symbol: result.symbol, entry: result.entry });
    } else if (result.symbol) {
      setSymbol(result.symbol);
      onOpenChange(false);
      setSearch('');
    }
  };

  const handleSelect = (item: typeof allItems[number]) => {
    if (item.type === 'symbol') { handleSymbolSelect(); }
    else { onOpenChange(false); }
  };

  useEffect(() => {
    if (open) { setTimeout(() => inputRef.current?.focus(), 10); setSelectedIdx(0); }
  }, [open]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === 'Escape') { onOpenChange(false); setSearch(''); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, allItems.length - 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)); }
      else if (e.key === 'Enter') { if (allItems[selectedIdx]) handleSelect(allItems[selectedIdx]); }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [open, allItems, selectedIdx, onOpenChange]);

  if (!open) return null;

  return (
    <div
      onClick={() => { onOpenChange(false); setSearch(''); }}
      data-testid="command-palette-backdrop"
      style={{ position: 'fixed', inset: 0, zIndex: 9100, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '18vh', fontFamily: MONO }}
    >
      <div
        onClick={e => e.stopPropagation()}
        data-testid="command-palette"
        style={{ width: 560, background: PANEL, border: `1px solid ${AMBER}`, borderRadius: 2, boxShadow: '0 12px 48px rgba(0,0,0,0.7)', overflow: 'hidden' }}
      >
        {/* Search input */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 12px', borderBottom: `1px solid ${BORDER}`, background: BG }}>
          <span style={{ color: SUBTLE, fontSize: 12, marginRight: 8 }}>🔍</span>
          <input
            ref={inputRef}
            value={search}
            onChange={e => { setSearch(e.target.value); setSelectedIdx(0); }}
            placeholder="TYPE A COMMAND OR SEARCH..."
            data-testid="command-palette-input"
            style={{
              flex: 1, height: 48, background: 'transparent', border: 'none', outline: 'none',
              color: TEXT, fontFamily: MONO, fontSize: 12, letterSpacing: 0.3,
            }}
          />
          <kbd style={{ fontSize: 9, color: SUBTLE, background: BG, border: `1px solid ${BORDER}`, padding: '2px 6px', borderRadius: 2 }}>ESC</kbd>
        </div>

        {/* Results */}
        <div style={{ maxHeight: 340, overflowY: 'auto' }}>
          {allItems.length === 0 && (
            <div style={{ padding: '24px 0', textAlign: 'center', color: SUBTLE, fontSize: 11 }}>NO RESULTS FOUND.</div>
          )}

          {/* Symbol group */}
          {isSymbol && (
            <div>
              <div style={{ padding: '4px 12px', fontSize: 9, color: SUBTLE, letterSpacing: 0.8, borderBottom: `1px solid ${BORDER}`, background: BG }}>SYMBOLS</div>
              {allItems.filter(i => i.type === 'symbol').map((item, idx) => (
                <button key={idx} onClick={() => handleSelect(item)}
                  style={{
                    width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10,
                    padding: '9px 12px', background: selectedIdx === idx ? AMBER + '18' : 'transparent',
                    border: 'none', borderBottom: `1px solid ${BORDER}`, cursor: 'pointer', fontFamily: MONO,
                    borderLeft: `2px solid ${selectedIdx === idx ? AMBER : 'transparent'}`,
                  }}
                  onMouseEnter={() => setSelectedIdx(idx)}
                >
                  <span style={{ color: AMBER, fontSize: 12 }}>{item.icon}</span>
                  <span style={{ flex: 1, color: TEXT, fontSize: 11 }}>{item.label}</span>
                  <kbd style={{ fontSize: 9, color: AMBER, background: AMBER + '22', border: `1px solid ${AMBER}`, padding: '1px 5px', borderRadius: 2 }}>{item.shortcut}</kbd>
                </button>
              ))}
            </div>
          )}

          {/* Navigation group */}
          <div>
            <div style={{ padding: '4px 12px', fontSize: 9, color: SUBTLE, letterSpacing: 0.8, borderBottom: `1px solid ${BORDER}`, background: BG }}>NAVIGATION</div>
            {allItems.filter(i => i.type === 'nav').map((item, localIdx) => {
              const globalIdx = (isSymbol ? 1 : 0) + localIdx;
              return (
                <button key={item.label} onClick={() => handleSelect(item)}
                  style={{
                    width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10,
                    padding: '9px 12px', background: selectedIdx === globalIdx ? BLUE + '18' : 'transparent',
                    border: 'none', borderBottom: `1px solid ${BORDER}`, cursor: 'pointer', fontFamily: MONO,
                    borderLeft: `2px solid ${selectedIdx === globalIdx ? BLUE : 'transparent'}`,
                  }}
                  onMouseEnter={() => setSelectedIdx(globalIdx)}
                >
                  <span style={{ color: BLUE, fontSize: 12 }}>{item.icon}</span>
                  <span style={{ flex: 1, color: TEXT, fontSize: 11 }}>{item.label}</span>
                  {item.shortcut && <kbd style={{ fontSize: 9, color: SUBTLE, background: BG, border: `1px solid ${BORDER}`, padding: '1px 5px', borderRadius: 2 }}>{item.shortcut}</kbd>}
                  <span style={{ color: SUBTLE, fontSize: 9 }}>›</span>
                </button>
              );
            })}
          </div>

          {/* Actions group */}
          <div>
            <div style={{ padding: '4px 12px', fontSize: 9, color: SUBTLE, letterSpacing: 0.8, borderBottom: `1px solid ${BORDER}`, background: BG }}>ACTIONS</div>
            {allItems.filter(i => i.type === 'action').map((item, localIdx) => {
              const globalIdx = (isSymbol ? 1 : 0) + NAV_ITEMS.length + localIdx;
              return (
                <button key={item.label} onClick={() => handleSelect(item)}
                  style={{
                    width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10,
                    padding: '9px 12px', background: selectedIdx === globalIdx ? GREEN + '18' : 'transparent',
                    border: 'none', borderBottom: `1px solid ${BORDER}`, cursor: 'pointer', fontFamily: MONO,
                    borderLeft: `2px solid ${selectedIdx === globalIdx ? GREEN : 'transparent'}`,
                  }}
                  onMouseEnter={() => setSelectedIdx(globalIdx)}
                >
                  <span style={{ color: GREEN, fontSize: 12 }}>{item.icon}</span>
                  <span style={{ flex: 1, color: TEXT, fontSize: 11 }}>{item.label}</span>
                  <span style={{ color: SUBTLE, fontSize: 9 }}>›</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <TickerDisambiguationDialog
        {...disambigDialog}
        onConfirm={(sym) => {
          setDisambigDialog(d => ({ ...d, open: false }));
          setSymbol(sym);
          onOpenChange(false);
          setSearch('');
        }}
        onCancel={() => setDisambigDialog(d => ({ ...d, open: false }))}
      />
    </div>
  );
}

