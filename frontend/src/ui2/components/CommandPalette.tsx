/**
 * UI2 CommandPalette Component
 * Ctrl+K command palette for navigation and actions
 * Bloomberg Terminal-style command interface
 */

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

export function CommandPalette({
  isOpen,
  onClose,
  commands,
  testId = 'command-palette',
}: CommandPaletteProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter commands based on query
  const filteredCommands = useMemo(() => {
    if (!query.trim()) return commands;

    const lowerQuery = query.toLowerCase();
    return commands.filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(lowerQuery) ||
        cmd.description?.toLowerCase().includes(lowerQuery) ||
        cmd.keywords?.some((k) => k.toLowerCase().includes(lowerQuery))
    );
  }, [query, commands]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredCommands]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filteredCommands.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const cmd = filteredCommands[selectedIndex];
        if (cmd) {
          handleSelect(cmd);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredCommands, selectedIndex, onClose]);

  const handleSelect = (cmd: CommandItem) => {
    if (cmd.onSelect) {
      cmd.onSelect();
    } else if (cmd.path) {
      navigate(cmd.path);
    }
    onClose();
  };

  if (!isOpen) return null;

  const categoryGroups = filteredCommands.reduce((acc, cmd) => {
    const cat = cmd.category || 'other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(cmd);
    return acc;
  }, {} as Record<string, CommandItem[]>);

  return (
    <>
      {/* Backdrop */}
      <div
        data-testid={`${testId}-backdrop`}
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          zIndex: 'var(--ui2-z-modal)',
          backdropFilter: 'blur(2px)',
        }}
      />

      {/* Command Palette */}
      <div
        data-testid={testId}
        data-state={isOpen ? 'open' : 'closed'}
        style={{
          position: 'fixed',
          top: '20vh',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '90%',
          maxWidth: '640px',
          background: 'var(--ui2-bg-panel)',
          border: '1px solid var(--ui2-border-strong)',
          borderRadius: 'var(--ui2-radius-lg)',
          boxShadow: 'var(--ui2-shadow-xl)',
          zIndex: 'var(--ui2-z-modal)',
          overflow: 'hidden',
        }}
      >
        {/* Input */}
        <div
          style={{
            padding: '16px',
            borderBottom: '1px solid var(--ui2-border)',
          }}
        >
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search... (Esc to close)"
            data-testid={`${testId}-input`}
            style={{
              width: '100%',
              background: 'var(--ui2-bg-input)',
              border: '1px solid var(--ui2-border)',
              borderRadius: 'var(--ui2-radius-md)',
              padding: '10px 14px',
              fontSize: '14px',
              color: 'var(--ui2-text-primary)',
              outline: 'none',
            }}
            className="ui2-focus-ring"
          />
        </div>

        {/* Results */}
        <div
          data-testid={`${testId}-results`}
          className="ui2-scrollable"
          style={{
            maxHeight: '400px',
            overflow: 'auto',
          }}
        >
          {filteredCommands.length === 0 ? (
            <div
              style={{
                padding: '40px 20px',
                textAlign: 'center',
                color: 'var(--ui2-text-muted)',
                fontSize: '13px',
              }}
            >
              No commands found for "{query}"
            </div>
          ) : (
            Object.entries(categoryGroups).map(([category, items]) => (
              <div key={category} style={{ padding: '8px 0' }}>
                <div
                  style={{
                    padding: '4px 16px',
                    fontSize: '11px',
                    fontWeight: 600,
                    color: 'var(--ui2-text-tertiary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  {category}
                </div>
                {items.map((cmd) => {
                  const globalIndex = filteredCommands.indexOf(cmd);
                  const isSelected = globalIndex === selectedIndex;
                  return (
                    <button
                      key={cmd.id}
                      data-testid={`${testId}-item-${cmd.id}`}
                      onClick={() => handleSelect(cmd)}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '10px 16px',
                        textAlign: 'left',
                        background: isSelected
                          ? 'var(--ui2-bg-hover)'
                          : 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--ui2-text-primary)',
                        transition: 'background var(--ui2-transition-fast)',
                      }}
                    >
                      {cmd.icon && (
                        <span style={{ fontSize: '18px', flexShrink: 0 }}>
                          {cmd.icon}
                        </span>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: '13px',
                            fontWeight: 500,
                            color: 'var(--ui2-text-primary)',
                          }}
                        >
                          {cmd.label}
                        </div>
                        {cmd.description && (
                          <div
                            style={{
                              fontSize: '12px',
                              color: 'var(--ui2-text-secondary)',
                              marginTop: '2px',
                            }}
                          >
                            {cmd.description}
                          </div>
                        )}
                      </div>
                      {isSelected && (
                        <div
                          style={{
                            fontSize: '11px',
                            color: 'var(--ui2-text-tertiary)',
                            padding: '2px 6px',
                            background: 'var(--ui2-bg-elevated)',
                            borderRadius: 'var(--ui2-radius-sm)',
                          }}
                        >
                          ↵
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
