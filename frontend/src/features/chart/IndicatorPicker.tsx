/**
 * IndicatorPicker.tsx — TradingView-style indicator picker modal
 * ===============================================================
 * Categorized, searchable indicator picker with parameter editing.
 * Bloomberg amber-on-dark styling with smooth animations.
 */

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  INDICATORS, INDICATOR_CATEGORIES,
  searchIndicators, getIndicatorsByCategory,
  type IndicatorDef,
} from './IndicatorRegistry';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ActiveIndicator {
  definitionId: string;
  instanceId:   string;  // unique per instance (allows duplicate SMAs with different periods)
  params:       Record<string, unknown>;
  color:        string;
  visible:      boolean;
}

interface IndicatorPickerProps {
  isOpen:            boolean;
  onClose:           () => void;
  activeIndicators:  ActiveIndicator[];
  onToggle:          (indicator: IndicatorDef) => void;
  onRemove:          (instanceId: string) => void;
  onParamChange:     (instanceId: string, paramName: string, value: unknown) => void;
  theme?:            'bloomberg' | 'dark' | 'light';
}

// ── Color Palette ─────────────────────────────────────────────────────────────

const palette = {
  bloomberg: {
    bg:       '#0d0d0d',
    surface:  '#141414',
    border:   '#1e1e1e',
    text:     '#e8e8ee',
    accent:   '#f5a623',
    dim:      '#555',
    hover:    '#1a1000',
    active:   '#2a1800',
    search:   '#1a1a1a',
    green:    '#26a69a',
    red:      '#ef5350',
  },
  dark: {
    bg:       '#131722',
    surface:  '#1e222d',
    border:   '#2a2e39',
    text:     '#d1d4dc',
    accent:   '#2962ff',
    dim:      '#787b86',
    hover:    '#1e222d',
    active:   '#2a2e39',
    search:   '#1e222d',
    green:    '#26a69a',
    red:      '#ef5350',
  },
  light: {
    bg:       '#ffffff',
    surface:  '#f8f9fd',
    border:   '#e0e3eb',
    text:     '#131722',
    accent:   '#2962ff',
    dim:      '#787b86',
    hover:    '#f0f3fa',
    active:   '#e3ecfc',
    search:   '#f0f3fa',
    green:    '#26a69a',
    red:      '#ef5350',
  },
};

// ── Component ─────────────────────────────────────────────────────────────────

export function IndicatorPicker({
  isOpen, onClose, activeIndicators, onToggle, onRemove, onParamChange, theme = 'bloomberg',
}: IndicatorPickerProps) {
  const [search, setSearch]     = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const c = palette[theme];

  // Focus search on open
  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setTimeout(() => searchRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // ESC to close
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // Filtered indicators
  const filtered = useMemo(() => {
    if (search.length >= 2) return searchIndicators(search);
    if (activeCategory) return getIndicatorsByCategory(activeCategory);
    return INDICATORS;
  }, [search, activeCategory]);

  // Active check
  const isActive = useCallback(
    (id: string) => activeIndicators.some(a => a.definitionId === id && a.visible),
    [activeIndicators],
  );

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: '#00000088', zIndex: 1000,
          backdropFilter: 'blur(2px)',
        }}
      />

      {/* Modal */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        zIndex: 1001, width: 680, maxHeight: '80vh',
        background: c.bg, border: `1px solid ${c.border}`, borderRadius: 8,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: '0 16px 48px #000a',
        fontFamily: theme === 'bloomberg' ? '"Roboto Mono", monospace' : '"Inter", sans-serif',
        color: c.text,
      }}>

        {/* ── Header ─────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '12px 16px', borderBottom: `1px solid ${c.border}`,
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: c.accent }}>
            INDICATORS
          </span>
          <span style={{ fontSize: 10, color: c.dim }}>
            {INDICATORS.length} available · {activeIndicators.filter(a => a.visible).length} active
          </span>
          <div style={{ flex: 1 }} />
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', color: c.dim, cursor: 'pointer',
              fontSize: 16, padding: '2px 6px', borderRadius: 4,
            }}
          >✕</button>
        </div>

        {/* ── Search ─────────────────────────────────────── */}
        <div style={{ padding: '8px 16px', borderBottom: `1px solid ${c.border}` }}>
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setActiveCategory(null); }}
            placeholder="Search indicators... (e.g. 'RSI', 'Bollinger', 'volume')"
            style={{
              width: '100%', background: c.search, border: `1px solid ${c.border}`,
              borderRadius: 4, padding: '8px 12px', color: c.text, fontSize: 12,
              fontFamily: 'inherit', outline: 'none',
            }}
          />
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* ── Category sidebar ─────────────────────────── */}
          <div style={{
            width: 180, borderRight: `1px solid ${c.border}`,
            overflow: 'auto', padding: '4px 0',
          }}>
            <div
              onClick={() => { setActiveCategory(null); setSearch(''); }}
              style={{
                padding: '8px 12px', cursor: 'pointer', fontSize: 11,
                color: !activeCategory && !search ? c.accent : c.dim,
                background: !activeCategory && !search ? c.active : 'transparent',
                fontWeight: !activeCategory && !search ? 700 : 400,
              }}
            >
              All ({INDICATORS.length})
            </div>
            {INDICATOR_CATEGORIES.map(cat => {
              const count = getIndicatorsByCategory(cat.id).length;
              const active = cat.id === activeCategory;
              return (
                <div
                  key={cat.id}
                  onClick={() => { setActiveCategory(cat.id); setSearch(''); }}
                  style={{
                    padding: '8px 12px', cursor: 'pointer', fontSize: 11,
                    display: 'flex', alignItems: 'center', gap: 6,
                    color: active ? c.accent : c.text,
                    background: active ? c.active : 'transparent',
                    fontWeight: active ? 700 : 400,
                  }}
                >
                  <span>{cat.icon}</span>
                  <span style={{ flex: 1 }}>{cat.label}</span>
                  <span style={{ fontSize: 9, color: c.dim }}>{count}</span>
                </div>
              );
            })}

            {/* Active indicators section */}
            <div style={{ borderTop: `1px solid ${c.border}`, marginTop: 4, paddingTop: 4 }}>
              <div style={{
                padding: '6px 12px', fontSize: 10, fontWeight: 700,
                letterSpacing: 1, color: c.accent,
              }}>
                ACTIVE ({activeIndicators.filter(a => a.visible).length})
              </div>
              {activeIndicators.filter(a => a.visible).map(ai => {
                const def = INDICATORS.find(d => d.id === ai.definitionId);
                return (
                  <div
                    key={ai.instanceId}
                    style={{
                      padding: '4px 12px', fontSize: 10, display: 'flex',
                      alignItems: 'center', gap: 6, color: c.text,
                    }}
                  >
                    <span style={{
                      width: 8, height: 8, borderRadius: 2,
                      background: ai.color, flexShrink: 0,
                    }} />
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {def?.shortName ?? ai.definitionId}
                    </span>
                    <button
                      onClick={() => onRemove(ai.instanceId)}
                      style={{
                        background: 'none', border: 'none', color: c.red,
                        cursor: 'pointer', fontSize: 10, padding: 0,
                      }}
                    >✕</button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Indicator list ───────────────────────────── */}
          <div style={{ flex: 1, overflow: 'auto', padding: '4px 0' }}>
            {filtered.length === 0 && (
              <div style={{ padding: 24, textAlign: 'center', color: c.dim, fontSize: 12 }}>
                No indicators match "{search}"
              </div>
            )}
            {filtered.map(ind => {
              const active = isActive(ind.id);
              const expanded = expandedId === ind.id;
              const instanceForParams = activeIndicators.find(a => a.definitionId === ind.id);
              const paramEntries = Object.entries(ind.params);

              return (
                <div key={ind.id} style={{ borderBottom: `1px solid ${c.border}22` }}>
                  {/* Main row */}
                  <div
                    style={{
                      padding: '8px 16px', cursor: 'pointer', display: 'flex',
                      alignItems: 'center', gap: 8, fontSize: 12,
                      color: active ? c.text : c.dim,
                      background: active ? c.active + '44' : 'transparent',
                    }}
                    onClick={() => onToggle(ind)}
                    onContextMenu={(e) => { e.preventDefault(); setExpandedId(expanded ? null : ind.id); }}
                  >
                    {/* Color dot */}
                    <span style={{
                      width: 10, height: 10, borderRadius: 2,
                      background: ind.color, flexShrink: 0,
                      opacity: active ? 1 : 0.4,
                    }} />

                    {/* Name */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 12 }}>
                        {ind.shortName}
                        <span style={{ fontWeight: 400, marginLeft: 6, fontSize: 11, color: c.dim }}>
                          {ind.name}
                        </span>
                      </div>
                      {expanded && (
                        <div style={{ fontSize: 10, color: c.dim, marginTop: 2 }}>
                          {ind.description}
                        </div>
                      )}
                    </div>

                    {/* Pane badge */}
                    <span style={{
                      fontSize: 9, padding: '1px 5px', borderRadius: 3,
                      background: ind.pane === 'main' ? c.accent + '22' : c.border,
                      color: ind.pane === 'main' ? c.accent : c.dim,
                    }}>
                      {ind.pane === 'main' ? 'overlay' : 'pane'}
                    </span>

                    {/* API badge */}
                    <span style={{
                      fontSize: 9, padding: '1px 4px', borderRadius: 3,
                      background: ind.api === 'v5' ? c.green + '22' : 'transparent',
                      color: ind.api === 'v5' ? c.green : c.dim,
                    }}>
                      {ind.api}
                    </span>

                    {/* Check / expand */}
                    {active && <span style={{ color: c.green, fontSize: 12 }}>✓</span>}
                    {paramEntries.length > 0 && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setExpandedId(expanded ? null : ind.id); }}
                        style={{
                          background: 'none', border: 'none', color: c.dim,
                          cursor: 'pointer', fontSize: 10, padding: '2px 4px',
                        }}
                      >
                        {expanded ? '▲' : '⚙'}
                      </button>
                    )}
                  </div>

                  {/* Parameter editor */}
                  {expanded && paramEntries.length > 0 && (
                    <div style={{
                      padding: '4px 16px 10px 38px', display: 'flex',
                      gap: 12, flexWrap: 'wrap', background: c.surface,
                    }}>
                      {paramEntries.map(([key, paramDef]) => (
                        <label key={key} style={{
                          display: 'flex', flexDirection: 'column', gap: 2,
                          fontSize: 10, color: c.dim,
                        }}>
                          <span>{paramDef.label}</span>
                          {paramDef.type === 'number' ? (
                            <input
                              type="number"
                              value={Number(instanceForParams?.params[key] ?? paramDef.default)}
                              min={paramDef.min}
                              max={paramDef.max}
                              onChange={e => {
                                if (instanceForParams) {
                                  onParamChange(instanceForParams.instanceId, key, Number(e.target.value));
                                }
                              }}
                              style={{
                                width: 60, background: c.search, border: `1px solid ${c.border}`,
                                borderRadius: 3, padding: '3px 6px', color: c.text,
                                fontSize: 11, fontFamily: 'inherit',
                              }}
                            />
                          ) : (
                            <input
                              type="text"
                              value={String(instanceForParams?.params[key] ?? paramDef.default)}
                              onChange={e => {
                                if (instanceForParams) {
                                  onParamChange(instanceForParams.instanceId, key, e.target.value);
                                }
                              }}
                              style={{
                                width: 80, background: c.search, border: `1px solid ${c.border}`,
                                borderRadius: 3, padding: '3px 6px', color: c.text,
                                fontSize: 11, fontFamily: 'inherit',
                              }}
                            />
                          )}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Footer ─────────────────────────────────────── */}
        <div style={{
          padding: '8px 16px', borderTop: `1px solid ${c.border}`,
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 10, color: c.dim,
        }}>
          <span>Click to toggle · Right-click for params · ESC to close</span>
          <div style={{ flex: 1 }} />
          <span>{filtered.length} showing</span>
        </div>
      </div>
    </>
  );
}

export default IndicatorPicker;
