/**
 * DrawingToolbar.tsx — TradingView-style vertical drawing tools sidebar
 * =====================================================================
 * All 26 drawing tool types from core/types.ts, organized in groups.
 * Bloomberg amber-on-dark styling. Integrates with DrawingLayer via store.
 */

import { useState, useCallback } from 'react';

// ── Drawing Tool Definitions ──────────────────────────────────────────────────

export type DrawingToolType =
  | 'cursor' | 'crosshair'
  | 'line' | 'ray' | 'extended_line' | 'arrow'
  | 'hline' | 'vline' | 'price_range' | 'date_range'
  | 'parallel_channel' | 'regression_channel'
  | 'fib' | 'fib_channel' | 'fib_time' | 'fib_circle'
  | 'pitchfork' | 'schiff_pitchfork' | 'modified_schiff'
  | 'rect' | 'ellipse' | 'triangle'
  | 'text' | 'callout' | 'note'
  | 'brush' | 'highlighter'
  | 'risk_reward' | 'long_position' | 'short_position';

interface DrawingTool {
  id:     DrawingToolType;
  label:  string;
  icon:   string;
  group:  string;
  hotkey?: string;
}

const TOOL_GROUPS: { id: string; label: string }[] = [
  { id: 'pointer',   label: 'Pointer' },
  { id: 'lines',     label: 'Lines' },
  { id: 'hv',        label: 'H/V Lines' },
  { id: 'channels',  label: 'Channels' },
  { id: 'fib',       label: 'Fibonacci' },
  { id: 'pitchfork', label: 'Pitchfork' },
  { id: 'shapes',    label: 'Shapes' },
  { id: 'text',      label: 'Text' },
  { id: 'measure',   label: 'Measure' },
  { id: 'paint',     label: 'Paint' },
];

const TOOLS: DrawingTool[] = [
  // Pointer
  { id: 'cursor',        label: 'Cursor',            icon: '↖', group: 'pointer', hotkey: 'V' },
  { id: 'crosshair',     label: 'Crosshair',         icon: '✚', group: 'pointer' },
  // Lines
  { id: 'line',          label: 'Trend Line',         icon: '╲', group: 'lines', hotkey: 'T' },
  { id: 'ray',           label: 'Ray',                icon: '⟶', group: 'lines' },
  { id: 'extended_line', label: 'Extended Line',       icon: '⟷', group: 'lines' },
  { id: 'arrow',         label: 'Arrow',              icon: '→', group: 'lines' },
  // H/V Lines
  { id: 'hline',         label: 'Horizontal Line',    icon: '─', group: 'hv', hotkey: 'H' },
  { id: 'vline',         label: 'Vertical Line',      icon: '│', group: 'hv' },
  { id: 'price_range',   label: 'Price Range',        icon: '⇕', group: 'hv' },
  { id: 'date_range',    label: 'Date Range',         icon: '⇔', group: 'hv' },
  // Channels
  { id: 'parallel_channel',   label: 'Parallel Channel',   icon: '╏', group: 'channels' },
  { id: 'regression_channel', label: 'Regression Channel',  icon: '⊏', group: 'channels' },
  // Fibonacci
  { id: 'fib',           label: 'Fib Retracement',    icon: '🌀', group: 'fib', hotkey: 'F' },
  { id: 'fib_channel',   label: 'Fib Channel',        icon: '⊚', group: 'fib' },
  { id: 'fib_time',      label: 'Fib Time Zones',     icon: '⊙', group: 'fib' },
  { id: 'fib_circle',    label: 'Fib Arcs',           icon: '◠', group: 'fib' },
  // Pitchfork
  { id: 'pitchfork',        label: "Andrew's Pitchfork", icon: 'Ψ', group: 'pitchfork' },
  { id: 'schiff_pitchfork', label: 'Schiff Pitchfork',   icon: 'Ÿ', group: 'pitchfork' },
  { id: 'modified_schiff',  label: 'Mod. Schiff',        icon: 'ÿ', group: 'pitchfork' },
  // Shapes
  { id: 'rect',          label: 'Rectangle',          icon: '▭', group: 'shapes', hotkey: 'R' },
  { id: 'ellipse',       label: 'Ellipse',            icon: '◯', group: 'shapes' },
  { id: 'triangle',      label: 'Triangle',           icon: '△', group: 'shapes' },
  // Text
  { id: 'text',          label: 'Text',               icon: 'T', group: 'text' },
  { id: 'callout',       label: 'Callout',            icon: '💬', group: 'text' },
  { id: 'note',          label: 'Note',               icon: '📝', group: 'text' },
  // Measure
  { id: 'risk_reward',   label: 'Risk/Reward',        icon: '⇡', group: 'measure' },
  { id: 'long_position', label: 'Long Position',      icon: '▲', group: 'measure' },
  { id: 'short_position',label: 'Short Position',     icon: '▼', group: 'measure' },
  // Paint
  { id: 'brush',         label: 'Brush',              icon: '🖌', group: 'paint' },
  { id: 'highlighter',   label: 'Highlighter',        icon: '🖍', group: 'paint' },
];

// ── Component ─────────────────────────────────────────────────────────────────

interface DrawingToolbarProps {
  activeTool:   DrawingToolType;
  onToolSelect: (tool: DrawingToolType) => void;
  onClearAll?:  () => void;
  onUndo?:      () => void;
  theme?:       'bloomberg' | 'dark' | 'light';
  collapsed?:   boolean;
}

const themeColors = {
  bloomberg: { bg: '#0a0a0a', surface: '#111', border: '#1e1e1e', text: '#e8e8ee', accent: '#f5a623', dim: '#555', hover: '#1a0a00', active: '#2a1800' },
  dark:      { bg: '#131722', surface: '#1e222d', border: '#2a2e39', text: '#d1d4dc', accent: '#2962ff', dim: '#787b86', hover: '#1e222d', active: '#2a2e39' },
  light:     { bg: '#fff', surface: '#f8f9fd', border: '#e0e3eb', text: '#131722', accent: '#2962ff', dim: '#787b86', hover: '#f0f3fa', active: '#e3ecfc' },
};

export function DrawingToolbar({
  activeTool, onToolSelect, onClearAll, onUndo, theme = 'bloomberg', collapsed = false,
}: DrawingToolbarProps) {
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [hoveredTool, setHoveredTool]     = useState<string | null>(null);
  const c = themeColors[theme];

  const handleGroupClick = useCallback((groupId: string) => {
    setExpandedGroup(prev => prev === groupId ? null : groupId);
  }, []);

  if (collapsed) {
    return (
      <div style={{
        width: 36, display: 'flex', flexDirection: 'column',
        background: c.bg, borderRight: `1px solid ${c.border}`,
        padding: '4px 0', gap: 1,
      }}>
        {TOOL_GROUPS.slice(0, 6).map(g => {
          const firstTool = TOOLS.find(t => t.group === g.id);
          if (!firstTool) return null;
          const active = TOOLS.filter(t => t.group === g.id).some(t => t.id === activeTool);
          return (
            <button
              key={g.id}
              onClick={() => onToolSelect(firstTool.id)}
              title={g.label}
              style={{
                width: 32, height: 28, margin: '0 auto',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: active ? c.active : 'transparent',
                border: 'none', borderRadius: 3, cursor: 'pointer',
                color: active ? c.accent : c.dim, fontSize: 14,
              }}
            >
              {firstTool.icon}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div style={{
      width: 44, display: 'flex', flexDirection: 'column',
      background: c.bg, borderRight: `1px solid ${c.border}`,
      padding: '4px 0', gap: 1, overflow: 'auto',
      fontFamily: theme === 'bloomberg' ? '"Roboto Mono", monospace' : '"Inter", sans-serif',
    }}>
      {TOOL_GROUPS.map(group => {
        const groupTools = TOOLS.filter(t => t.group === group.id);
        const isExpanded = expandedGroup === group.id;
        const hasActive = groupTools.some(t => t.id === activeTool);
        const displayTool = groupTools.find(t => t.id === activeTool) ?? groupTools[0];

        return (
          <div key={group.id} style={{ position: 'relative' }}>
            {/* Group button — shows first/active tool of group */}
            <button
              onClick={() => {
                if (groupTools.length === 1) {
                  onToolSelect(displayTool.id);
                } else {
                  handleGroupClick(group.id);
                }
              }}
              onDoubleClick={() => {
                if (groupTools.length > 1) onToolSelect(displayTool.id);
              }}
              onMouseEnter={() => setHoveredTool(displayTool.id)}
              onMouseLeave={() => setHoveredTool(null)}
              title={`${displayTool.label}${displayTool.hotkey ? ` (${displayTool.hotkey})` : ''}`}
              style={{
                width: 36, height: 30, margin: '0 auto',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: hasActive ? c.active
                  : hoveredTool === displayTool.id ? c.hover
                  : 'transparent',
                border: 'none', borderRadius: 3, cursor: 'pointer',
                color: hasActive ? c.accent : c.dim,
                fontSize: 14, position: 'relative',
              }}
            >
              {displayTool.icon}
              {groupTools.length > 1 && (
                <span style={{
                  position: 'absolute', bottom: 2, right: 3,
                  fontSize: 6, color: c.dim,
                }}>▼</span>
              )}
            </button>

            {/* Expanded flyout for group */}
            {isExpanded && groupTools.length > 1 && (
              <div style={{
                position: 'absolute', left: 44, top: 0, zIndex: 100,
                background: c.surface, border: `1px solid ${c.border}`,
                borderRadius: 4, boxShadow: '0 4px 16px #0008',
                padding: '4px 0', minWidth: 160,
              }}>
                <div style={{
                  padding: '4px 10px 6px', fontSize: 9, fontWeight: 700,
                  letterSpacing: 1, color: c.accent,
                }}>
                  {group.label.toUpperCase()}
                </div>
                {groupTools.map(tool => {
                  const active = tool.id === activeTool;
                  return (
                    <div
                      key={tool.id}
                      onClick={() => { onToolSelect(tool.id); setExpandedGroup(null); }}
                      style={{
                        padding: '5px 10px', cursor: 'pointer', fontSize: 11,
                        display: 'flex', alignItems: 'center', gap: 8,
                        color: active ? c.accent : c.text,
                        background: active ? c.active : 'transparent',
                      }}
                    >
                      <span style={{ width: 18, textAlign: 'center' }}>{tool.icon}</span>
                      <span style={{ flex: 1 }}>{tool.label}</span>
                      {tool.hotkey && (
                        <span style={{
                          fontSize: 9, padding: '1px 4px', borderRadius: 2,
                          background: c.border, color: c.dim,
                        }}>
                          {tool.hotkey}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* Separator */}
      <div style={{ height: 1, background: c.border, margin: '4px 6px' }} />

      {/* Undo */}
      {onUndo && (
        <button
          onClick={onUndo}
          title="Undo last drawing"
          style={{
            width: 36, height: 28, margin: '0 auto',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'transparent', border: 'none', borderRadius: 3,
            cursor: 'pointer', color: c.dim, fontSize: 12,
          }}
        >↩</button>
      )}

      {/* Clear all */}
      {onClearAll && (
        <button
          onClick={onClearAll}
          title="Clear all drawings"
          style={{
            width: 36, height: 28, margin: '0 auto',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'transparent', border: 'none', borderRadius: 3,
            cursor: 'pointer', color: c.dim, fontSize: 12,
          }}
        >🗑</button>
      )}
    </div>
  );
}

export default DrawingToolbar;
export { TOOLS, TOOL_GROUPS };
export type { DrawingTool };
