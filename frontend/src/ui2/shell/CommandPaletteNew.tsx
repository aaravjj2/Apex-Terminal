/**
 * Apex Terminal — New Command Palette
 * Matches demo/index.html command palette with TradingView styling
 * Sections: Views, Symbols, Actions
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useContextBus } from '../stores/contextBusStore';

export interface CmdItem {
  id: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  category: 'navigation' | 'symbol' | 'action' | 'command';
  keywords?: string[];
  path?: string;
  onSelect?: () => void;
}

interface CommandPaletteNewProps {
  isOpen: boolean;
  onClose: () => void;
  items: CmdItem[];
}

export function CommandPaletteNew({ isOpen, onClose, items }: CommandPaletteNewProps) {
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const setActiveSymbol = useContextBus(s => s.setActiveSymbol);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Global Escape handler — catches Escape even when input is not focused
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const filtered = query.trim()
    ? items.filter(item => {
        const q = query.toLowerCase();
        return (
          item.label.toLowerCase().includes(q) ||
          item.description?.toLowerCase().includes(q) ||
          item.keywords?.some(k => k.toLowerCase().includes(q))
        );
      })
    : items;

  // Group by category
  const groups: Record<string, CmdItem[]> = {};
  filtered.forEach(item => {
    const cat = item.category;
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(item);
  });

  const flatItems = Object.values(groups).flat();

  const handleSelect = useCallback((item: CmdItem) => {
    if (item.onSelect) {
      item.onSelect();
    } else if (item.category === 'symbol') {
      setActiveSymbol(item.label);
    } else if (item.path) {
      navigate(item.path);
    }
    onClose();
  }, [navigate, onClose, setActiveSymbol]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx(prev => Math.min(prev + 1, flatItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (flatItems[selectedIdx]) {
        handleSelect(flatItems[selectedIdx]);
      }
    }
  };

  // Focus trap: keep focus inside the dialog (hooks must be before early return)
  const boxRef = useRef<HTMLDivElement>(null);
  const handleTabTrap = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== 'Tab' || !boxRef.current) return;
    const focusable = boxRef.current.querySelectorAll<HTMLElement>('input, button, [tabindex]:not([tabindex="-1"])');
    if (!focusable.length) return;
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }, []);

  if (!isOpen) return null;

  const CATEGORY_LABELS: Record<string, string> = {
    navigation: 'VIEWS',
    symbol: 'SYMBOLS',
    action: 'ACTIONS',
    command: 'COMMANDS',
  };

  let globalIdx = 0;

  const activeDescendant = flatItems[selectedIdx] ? `cmd-item-${selectedIdx}` : undefined;

  return (
    <div
      className={`cmd-overlay${isOpen ? ' open' : ''}`}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      data-testid="command-palette"
      data-state={isOpen ? 'open' : 'closed'}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      onKeyDown={handleTabTrap}
    >
      <div className="cmd-box" ref={boxRef}>
        <div className="cmd-in-wrap">
          <svg width="16" height="16" fill="none" stroke="var(--tx2)" strokeWidth="2" aria-hidden="true">
            <circle cx="7" cy="7" r="5" />
            <path d="m11 11 3.5 3.5" />
          </svg>
          <input
            ref={inputRef}
            className="cmd-in"
            placeholder="Search views, symbols, actions..."
            value={query}
            onChange={e => { setQuery(e.target.value); setSelectedIdx(0); }}
            onKeyDown={handleKeyDown}
            data-testid="command-palette-input"
            role="combobox"
            aria-expanded="true"
            aria-controls="cmd-results-list"
            aria-activedescendant={activeDescendant}
            aria-autocomplete="list"
            aria-label="Search commands"
          />
          <span style={{ fontSize: '11px', color: 'var(--tx3)' }} aria-hidden="true">ESC</span>
        </div>
        <div className="cmd-results" id="cmd-results-list" role="listbox" aria-label="Command results">
          {Object.entries(groups).map(([cat, catItems]) => (
            <div key={cat} role="group" aria-label={CATEGORY_LABELS[cat] || cat}>
              <div className="cmd-sec" aria-hidden="true">{CATEGORY_LABELS[cat] || cat.toUpperCase()}</div>
              {catItems.map(item => {
                const idx = globalIdx++;
                const isSel = idx === selectedIdx;
                return (
                  <div
                    key={item.id}
                    id={`cmd-item-${idx}`}
                    data-testid={`command-palette-item-${item.id}`}
                    className={`cmd-item${isSel ? ' sel' : ''}`}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setSelectedIdx(idx)}
                    role="option"
                    aria-selected={isSel}
                  >
                    <div className="cmd-ico" aria-hidden="true">
                      {item.icon || (
                        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <rect x="2" y="2" width="10" height="10" rx="1" />
                        </svg>
                      )}
                    </div>
                    <span className="cmd-name">{item.label}</span>
                    {item.description && <span className="cmd-desc">{item.description}</span>}
                  </div>
                );
              })}
            </div>
          ))}
          {flatItems.length === 0 && (
            <div role="status" style={{ padding: '20px', textAlign: 'center', color: 'var(--tx3)', fontSize: '13px' }}>
              No results for "{query}"
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
