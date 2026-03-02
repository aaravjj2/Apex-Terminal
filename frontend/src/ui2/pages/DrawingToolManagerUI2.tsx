import React, { useState } from 'react';

const BG = '#0a0a0a', PANEL = '#111111', BORDER = '#1e1e1e';
const AMBER = '#f5a623', GREEN = '#26a69a', RED = '#ef5350', CYAN = '#00bcd4';
const DIM = '#555', TEXT = '#ccc', WHITE = '#e0e0e0';

interface DrawingTool {
  id: string;
  name: string;
  category: string;
  icon: string;
  shortcut: string;
  description: string;
  properties: { name: string; type: string; default: string }[];
  isCustom: boolean;
  isFavorite: boolean;
  usageCount: number;
}

interface DrawingTemplate {
  id: string;
  name: string;
  tools: string[];
  description: string;
  createdAt: string;
  isShared: boolean;
}

const CATEGORIES = ['Trend', 'Fibonacci', 'Geometric', 'Annotation', 'Pattern', 'Gann', 'Elliott Wave', 'Measurement', 'Custom'];

const TOOLS: DrawingTool[] = [
  // Trend
  { id: 'T1', name: 'Trend Line', category: 'Trend', icon: '╱', shortcut: 'T', description: 'Draw a straight line between two points to identify trend direction', properties: [{ name: 'color', type: 'color', default: '#f5a623' }, { name: 'lineWidth', type: 'number', default: '2' }, { name: 'lineStyle', type: 'select', default: 'solid' }, { name: 'extend', type: 'select', default: 'right' }], isCustom: false, isFavorite: true, usageCount: 342 },
  { id: 'T2', name: 'Ray', category: 'Trend', icon: '→', shortcut: 'R', description: 'Semi-infinite line extending from anchor point', properties: [{ name: 'color', type: 'color', default: '#f5a623' }, { name: 'lineWidth', type: 'number', default: '1' }], isCustom: false, isFavorite: false, usageCount: 128 },
  { id: 'T3', name: 'Extended Line', category: 'Trend', icon: '↔', shortcut: 'E', description: 'Infinite line extending both directions', properties: [{ name: 'color', type: 'color', default: '#f5a623' }, { name: 'lineWidth', type: 'number', default: '1' }], isCustom: false, isFavorite: false, usageCount: 89 },
  { id: 'T4', name: 'Horizontal Line', category: 'Trend', icon: '―', shortcut: 'H', description: 'Horizontal support/resistance line', properties: [{ name: 'color', type: 'color', default: '#26a69a' }, { name: 'lineWidth', type: 'number', default: '1' }, { name: 'price', type: 'number', default: '0' }], isCustom: false, isFavorite: true, usageCount: 456 },
  { id: 'T5', name: 'Vertical Line', category: 'Trend', icon: '|', shortcut: 'V', description: 'Vertical time marker', properties: [{ name: 'color', type: 'color', default: '#555' }, { name: 'lineWidth', type: 'number', default: '1' }], isCustom: false, isFavorite: false, usageCount: 167 },
  { id: 'T6', name: 'Parallel Channel', category: 'Trend', icon: '⫽', shortcut: 'P', description: 'Two parallel trend lines forming a channel', properties: [{ name: 'color', type: 'color', default: '#00bcd4' }, { name: 'fillColor', type: 'color', default: 'rgba(0,188,212,0.1)' }, { name: 'lineWidth', type: 'number', default: '1' }], isCustom: false, isFavorite: true, usageCount: 234 },
  { id: 'T7', name: 'Regression Channel', category: 'Trend', icon: '≋', shortcut: '', description: 'Linear regression with standard deviation bands', properties: [{ name: 'color', type: 'color', default: '#ab47bc' }, { name: 'stdDev', type: 'number', default: '2' }], isCustom: false, isFavorite: false, usageCount: 67 },
  { id: 'T8', name: 'Pitchfork', category: 'Trend', icon: 'Ψ', shortcut: '', description: "Andrew's Pitchfork with median line and parallels", properties: [{ name: 'color', type: 'color', default: '#f5a623' }, { name: 'style', type: 'select', default: 'Andrews' }], isCustom: false, isFavorite: false, usageCount: 45 },

  // Fibonacci
  { id: 'F1', name: 'Fib Retracement', category: 'Fibonacci', icon: '⊟', shortcut: 'F', description: 'Fibonacci retracement levels (23.6%, 38.2%, 50%, 61.8%, 78.6%)', properties: [{ name: 'levels', type: 'text', default: '0,0.236,0.382,0.5,0.618,0.786,1' }, { name: 'color', type: 'color', default: '#f5a623' }], isCustom: false, isFavorite: true, usageCount: 512 },
  { id: 'F2', name: 'Fib Extension', category: 'Fibonacci', icon: '⊞', shortcut: '', description: 'Fibonacci extension projection levels', properties: [{ name: 'levels', type: 'text', default: '0,1,1.272,1.618,2,2.618' }, { name: 'color', type: 'color', default: '#00bcd4' }], isCustom: false, isFavorite: true, usageCount: 298 },
  { id: 'F3', name: 'Fib Fan', category: 'Fibonacci', icon: '⊿', shortcut: '', description: 'Fibonacci fan lines from anchor point', properties: [{ name: 'color', type: 'color', default: '#f5a623' }], isCustom: false, isFavorite: false, usageCount: 78 },
  { id: 'F4', name: 'Fib Time Zone', category: 'Fibonacci', icon: '⊡', shortcut: '', description: 'Vertical Fibonacci time intervals', properties: [{ name: 'color', type: 'color', default: '#ab47bc' }], isCustom: false, isFavorite: false, usageCount: 34 },
  { id: 'F5', name: 'Fib Channel', category: 'Fibonacci', icon: '⊠', shortcut: '', description: 'Fibonacci-spaced parallel channel', properties: [{ name: 'color', type: 'color', default: '#26a69a' }], isCustom: false, isFavorite: false, usageCount: 56 },

  // Geometric
  { id: 'G1', name: 'Rectangle', category: 'Geometric', icon: '□', shortcut: '', description: 'Draw rectangle zones for support/resistance', properties: [{ name: 'borderColor', type: 'color', default: '#26a69a' }, { name: 'fillColor', type: 'color', default: 'rgba(38,166,154,0.1)' }], isCustom: false, isFavorite: true, usageCount: 189 },
  { id: 'G2', name: 'Circle', category: 'Geometric', icon: '○', shortcut: '', description: 'Draw circle annotations', properties: [{ name: 'borderColor', type: 'color', default: '#f5a623' }, { name: 'fillColor', type: 'color', default: 'rgba(245,166,35,0.1)' }], isCustom: false, isFavorite: false, usageCount: 45 },
  { id: 'G3', name: 'Triangle', category: 'Geometric', icon: '△', shortcut: '', description: 'Triangle pattern/zone marker', properties: [{ name: 'borderColor', type: 'color', default: '#ef5350' }, { name: 'fillColor', type: 'color', default: 'rgba(239,83,80,0.1)' }], isCustom: false, isFavorite: false, usageCount: 67 },
  { id: 'G4', name: 'Arc', category: 'Geometric', icon: '⌒', shortcut: '', description: 'Curved arc between two points', properties: [{ name: 'color', type: 'color', default: '#00bcd4' }], isCustom: false, isFavorite: false, usageCount: 23 },
  { id: 'G5', name: 'Polyline', category: 'Geometric', icon: '⌇', shortcut: '', description: 'Multi-segment connected line', properties: [{ name: 'color', type: 'color', default: '#f5a623' }, { name: 'lineWidth', type: 'number', default: '2' }], isCustom: false, isFavorite: false, usageCount: 89 },

  // Annotation
  { id: 'A1', name: 'Text', category: 'Annotation', icon: 'A', shortcut: '', description: 'Add text annotation to chart', properties: [{ name: 'text', type: 'text', default: 'Note' }, { name: 'fontsize', type: 'number', default: '14' }, { name: 'color', type: 'color', default: '#e0e0e0' }], isCustom: false, isFavorite: true, usageCount: 234 },
  { id: 'A2', name: 'Callout', category: 'Annotation', icon: '💬', shortcut: '', description: 'Text callout with arrow pointer', properties: [{ name: 'text', type: 'text', default: '' }, { name: 'background', type: 'color', default: '#1a1a1a' }], isCustom: false, isFavorite: false, usageCount: 112 },
  { id: 'A3', name: 'Arrow', category: 'Annotation', icon: '↗', shortcut: '', description: 'Directional arrow annotation', properties: [{ name: 'color', type: 'color', default: '#26a69a' }, { name: 'size', type: 'number', default: '18' }], isCustom: false, isFavorite: false, usageCount: 156 },
  { id: 'A4', name: 'Price Label', category: 'Annotation', icon: '$', shortcut: 'L', description: 'Price level label', properties: [{ name: 'price', type: 'number', default: '0' }, { name: 'color', type: 'color', default: '#f5a623' }], isCustom: false, isFavorite: true, usageCount: 278 },
  { id: 'A5', name: 'Note', category: 'Annotation', icon: '📝', shortcut: '', description: 'Sticky note on chart', properties: [{ name: 'text', type: 'text', default: '' }, { name: 'background', type: 'color', default: '#332200' }], isCustom: false, isFavorite: false, usageCount: 89 },

  // Pattern
  { id: 'P1', name: 'Head & Shoulders', category: 'Pattern', icon: '⌂', shortcut: '', description: 'Head and shoulders reversal pattern', properties: [{ name: 'color', type: 'color', default: '#ef5350' }], isCustom: false, isFavorite: false, usageCount: 34 },
  { id: 'P2', name: 'XABCD Pattern', category: 'Pattern', icon: '✦', shortcut: '', description: 'Harmonic XABCD pattern (Gartley, Butterfly, etc.)', properties: [{ name: 'color', type: 'color', default: '#00bcd4' }, { name: 'patternType', type: 'select', default: 'Gartley' }], isCustom: false, isFavorite: false, usageCount: 45 },
  { id: 'P3', name: 'ABC Pattern', category: 'Pattern', icon: '⊿', shortcut: '', description: 'Three-wave ABC correction pattern', properties: [{ name: 'color', type: 'color', default: '#f5a623' }], isCustom: false, isFavorite: false, usageCount: 56 },
  { id: 'P4', name: 'Wedge', category: 'Pattern', icon: '◇', shortcut: '', description: 'Rising/falling wedge pattern', properties: [{ name: 'color', type: 'color', default: '#ab47bc' }], isCustom: false, isFavorite: false, usageCount: 78 },

  // Gann
  { id: 'GN1', name: 'Gann Fan', category: 'Gann', icon: '⊿', shortcut: '', description: 'Gann fan with 1x1, 2x1, 1x2 angles', properties: [{ name: 'color', type: 'color', default: '#f5a623' }], isCustom: false, isFavorite: false, usageCount: 23 },
  { id: 'GN2', name: 'Gann Square', category: 'Gann', icon: '⊞', shortcut: '', description: 'Gann square of 9 price/time analysis', properties: [{ name: 'color', type: 'color', default: '#00bcd4' }], isCustom: false, isFavorite: false, usageCount: 12 },
  { id: 'GN3', name: 'Gann Box', category: 'Gann', icon: '□', shortcut: '', description: 'Gann box with price and time divisions', properties: [{ name: 'color', type: 'color', default: '#ab47bc' }], isCustom: false, isFavorite: false, usageCount: 18 },

  // Elliott Wave
  { id: 'EW1', name: 'Elliott Impulse', category: 'Elliott Wave', icon: '12345', shortcut: '', description: '5-wave impulse labeling', properties: [{ name: 'color', type: 'color', default: '#26a69a' }], isCustom: false, isFavorite: false, usageCount: 67 },
  { id: 'EW2', name: 'Elliott Correction', category: 'Elliott Wave', icon: 'ABC', shortcut: '', description: '3-wave correction labeling', properties: [{ name: 'color', type: 'color', default: '#ef5350' }], isCustom: false, isFavorite: false, usageCount: 45 },
  { id: 'EW3', name: 'Wave Count', category: 'Elliott Wave', icon: '#', shortcut: '', description: 'Custom wave count labels', properties: [{ name: 'color', type: 'color', default: '#f5a623' }], isCustom: false, isFavorite: false, usageCount: 34 },

  // Measurement
  { id: 'M1', name: 'Price Range', category: 'Measurement', icon: '↕', shortcut: '', description: 'Measure price movement between two levels', properties: [{ name: 'color', type: 'color', default: '#26a69a' }], isCustom: false, isFavorite: true, usageCount: 456 },
  { id: 'M2', name: 'Date Range', category: 'Measurement', icon: '↔', shortcut: '', description: 'Measure time between two dates', properties: [{ name: 'color', type: 'color', default: '#00bcd4' }], isCustom: false, isFavorite: false, usageCount: 189 },
  { id: 'M3', name: 'Date & Price', category: 'Measurement', icon: '⟋', shortcut: '', description: 'Measure both price and time between two points', properties: [{ name: 'color', type: 'color', default: '#f5a623' }], isCustom: false, isFavorite: true, usageCount: 345 },
  { id: 'M4', name: 'Risk/Reward', category: 'Measurement', icon: 'R:R', shortcut: '', description: 'Visualize risk/reward ratio with entry, stop, target', properties: [{ name: 'color', type: 'color', default: '#26a69a' }, { name: 'entryPrice', type: 'number', default: '0' }, { name: 'stopPrice', type: 'number', default: '0' }, { name: 'targetPrice', type: 'number', default: '0' }], isCustom: false, isFavorite: true, usageCount: 567 },

  // Custom
  { id: 'C1', name: 'Supply Zone', category: 'Custom', icon: '▰', shortcut: '', description: 'Custom supply/resistance zone with gradient fill', properties: [{ name: 'color', type: 'color', default: '#ef5350' }, { name: 'opacity', type: 'number', default: '0.2' }], isCustom: true, isFavorite: true, usageCount: 123 },
  { id: 'C2', name: 'Demand Zone', category: 'Custom', icon: '▰', shortcut: '', description: 'Custom demand/support zone with gradient fill', properties: [{ name: 'color', type: 'color', default: '#26a69a' }, { name: 'opacity', type: 'number', default: '0.2' }], isCustom: true, isFavorite: true, usageCount: 134 },
  { id: 'C3', name: 'Order Block', category: 'Custom', icon: '▣', shortcut: '', description: 'ICT-style order block zone', properties: [{ name: 'color', type: 'color', default: '#f5a623' }, { name: 'opacity', type: 'number', default: '0.15' }], isCustom: true, isFavorite: false, usageCount: 89 },
];

const TEMPLATES: DrawingTemplate[] = [
  { id: 'TPL1', name: 'Fibonacci Analysis', tools: ['F1', 'F2', 'T1', 'T4'], description: 'Standard Fibonacci retracement & extension with trend lines', createdAt: '2024-01-15', isShared: true },
  { id: 'TPL2', name: 'Support/Resistance', tools: ['T4', 'G1', 'C1', 'C2'], description: 'S/R levels with zones', createdAt: '2024-02-01', isShared: true },
  { id: 'TPL3', name: 'Elliott Wave Setup', tools: ['EW1', 'EW2', 'F1', 'T1'], description: 'Elliott wave count with Fibonacci retracements', createdAt: '2024-02-10', isShared: false },
  { id: 'TPL4', name: 'Trade Setup', tools: ['M4', 'T4', 'A4', 'T1'], description: 'Risk/reward with entry, stop, target levels', createdAt: '2024-03-01', isShared: true },
  { id: 'TPL5', name: 'Channel Trading', tools: ['T6', 'T4', 'A1', 'M1'], description: 'Parallel channel with horizontal levels', createdAt: '2024-03-15', isShared: false },
  { id: 'TPL6', name: 'Harmonic Patterns', tools: ['P2', 'F1', 'F2', 'T1'], description: 'XABCD pattern with Fibonacci validation', createdAt: '2024-04-01', isShared: false },
];

const TABS = ['Tool Library', 'Templates', 'Properties', 'Sync & Share'];

export default function DrawingToolManagerUI2() {
  const [tab, setTab] = useState(TABS[0]);
  const [tools, setTools] = useState(TOOLS);
  const [filterCategory, setFilterCategory] = useState('All');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [selectedTool, setSelectedTool] = useState<DrawingTool | null>(TOOLS[0]);
  const [sortBy, setSortBy] = useState<'name' | 'usage' | 'category'>('category');

  const filteredTools = tools
    .filter(t => filterCategory === 'All' || t.category === filterCategory)
    .filter(t => !showFavoritesOnly || t.isFavorite)
    .filter(t => !searchText || t.name.toLowerCase().includes(searchText.toLowerCase()) || t.description.toLowerCase().includes(searchText.toLowerCase()))
    .sort((a, b) => sortBy === 'name' ? a.name.localeCompare(b.name) : sortBy === 'usage' ? b.usageCount - a.usageCount : a.category.localeCompare(b.category));

  const toggleFavorite = (id: string) => {
    setTools(tools.map(t => t.id === id ? { ...t, isFavorite: !t.isFavorite } : t));
  };

  const categoryColors: Record<string, string> = {
    'Trend': AMBER, 'Fibonacci': '#ab47bc', 'Geometric': CYAN, 'Annotation': GREEN,
    'Pattern': RED, 'Gann': '#ff9800', 'Elliott Wave': '#4fc3f7', 'Measurement': '#8bc34a', 'Custom': '#f06292',
  };

  return (
    <div style={{ width: '100%', height: '100%', background: BG, color: TEXT, fontFamily: 'monospace', fontSize: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '6px 16px', borderBottom: `1px solid ${BORDER}`, gap: 12 }}>
        <span style={{ color: AMBER, fontWeight: 'bold', fontSize: 14 }}>✏ DRAWING TOOLS</span>
        <div style={{ display: 'flex', gap: 2 }}>
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '3px 8px', background: tab === t ? 'rgba(245,166,35,0.15)' : 'transparent',
              border: `1px solid ${tab === t ? AMBER : 'transparent'}`, color: tab === t ? AMBER : DIM,
              cursor: 'pointer', fontFamily: 'monospace', fontSize: 10
            }}>{t}</button>
          ))}
        </div>
        <span style={{ marginLeft: 'auto', color: DIM, fontSize: 10 }}>{tools.length} tools | {tools.filter(t => t.isFavorite).length} favorites</span>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {tab === 'Tool Library' && (
          <>
            {/* Left: Filters */}
            <div style={{ width: 180, borderRight: `1px solid ${BORDER}`, padding: 8, overflowY: 'auto' }}>
              <input value={searchText} onChange={e => setSearchText(e.target.value)} placeholder="Search..."
                style={{ width: '100%', padding: '4px 8px', background: '#1a1a1a', border: `1px solid ${BORDER}`, color: TEXT, fontFamily: 'monospace', fontSize: 10, marginBottom: 8, boxSizing: 'border-box' }} />

              <div style={{ marginBottom: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, color: DIM, fontSize: 10, cursor: 'pointer', marginBottom: 6 }}>
                  <input type="checkbox" checked={showFavoritesOnly} onChange={() => setShowFavoritesOnly(!showFavoritesOnly)} style={{ accentColor: AMBER }} />
                  Favorites Only
                </label>
              </div>

              <div style={{ color: AMBER, fontSize: 9, fontWeight: 'bold', marginBottom: 4 }}>CATEGORIES</div>
              <div onClick={() => setFilterCategory('All')} style={{
                padding: '4px 8px', cursor: 'pointer', background: filterCategory === 'All' ? 'rgba(245,166,35,0.1)' : 'transparent',
                color: filterCategory === 'All' ? AMBER : TEXT, fontSize: 10, marginBottom: 2
              }}>All ({tools.length})</div>
              {CATEGORIES.map(cat => {
                const count = tools.filter(t => t.category === cat).length;
                return (
                  <div key={cat} onClick={() => setFilterCategory(cat)} style={{
                    padding: '4px 8px', cursor: 'pointer', background: filterCategory === cat ? `${categoryColors[cat]}10` : 'transparent',
                    color: filterCategory === cat ? categoryColors[cat] : DIM, fontSize: 10, marginBottom: 2,
                    display: 'flex', justifyContent: 'space-between'
                  }}>
                    <span>{cat}</span>
                    <span style={{ color: DIM }}>{count}</span>
                  </div>
                );
              })}

              <div style={{ borderTop: `1px solid ${BORDER}`, marginTop: 8, paddingTop: 8 }}>
                <div style={{ color: AMBER, fontSize: 9, fontWeight: 'bold', marginBottom: 4 }}>SORT BY</div>
                {(['category', 'name', 'usage'] as const).map(s => (
                  <div key={s} onClick={() => setSortBy(s)} style={{
                    padding: '3px 8px', cursor: 'pointer', color: sortBy === s ? AMBER : DIM, fontSize: 10, textTransform: 'capitalize'
                  }}>{s === 'usage' ? 'Most Used' : s}</div>
                ))}
              </div>
            </div>

            {/* Center: Grid */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 6 }}>
                {filteredTools.map(tool => (
                  <div key={tool.id} onClick={() => setSelectedTool(tool)} style={{
                    background: selectedTool?.id === tool.id ? 'rgba(245,166,35,0.08)' : PANEL,
                    border: `1px solid ${selectedTool?.id === tool.id ? AMBER : BORDER}`,
                    padding: '10px 12px', cursor: 'pointer', position: 'relative'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 16, color: categoryColors[tool.category] || TEXT }}>{tool.icon}</span>
                      <span style={{ color: WHITE, fontWeight: 'bold', fontSize: 11 }}>{tool.name}</span>
                      <span onClick={e => { e.stopPropagation(); toggleFavorite(tool.id); }} style={{ marginLeft: 'auto', cursor: 'pointer', color: tool.isFavorite ? AMBER : DIM, fontSize: 14 }}>
                        {tool.isFavorite ? '★' : '☆'}
                      </span>
                    </div>
                    <div style={{ color: DIM, fontSize: 9, marginBottom: 4 }}>{tool.description}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9 }}>
                      <span style={{ color: categoryColors[tool.category], padding: '0 4px', background: `${categoryColors[tool.category]}15` }}>{tool.category}</span>
                      <span style={{ color: DIM }}>{tool.shortcut && `⌨ ${tool.shortcut}`} | {tool.usageCount} uses</span>
                    </div>
                    {tool.isCustom && <span style={{ position: 'absolute', top: 4, right: 6, color: '#f06292', fontSize: 8 }}>CUSTOM</span>}
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Details */}
            {selectedTool && (
              <div style={{ width: 260, borderLeft: `1px solid ${BORDER}`, padding: 12, overflowY: 'auto', background: '#0d0d0d' }}>
                <div style={{ textAlign: 'center', marginBottom: 12, padding: 16, background: PANEL, border: `1px solid ${BORDER}` }}>
                  <div style={{ fontSize: 32, color: categoryColors[selectedTool.category], marginBottom: 4 }}>{selectedTool.icon}</div>
                  <div style={{ color: WHITE, fontWeight: 'bold', fontSize: 14 }}>{selectedTool.name}</div>
                  <div style={{ color: categoryColors[selectedTool.category], fontSize: 10, marginTop: 2 }}>{selectedTool.category}</div>
                </div>

                <div style={{ color: TEXT, fontSize: 10, marginBottom: 12, lineHeight: 1.4 }}>{selectedTool.description}</div>

                <div style={{ marginBottom: 12 }}>
                  <div style={{ color: AMBER, fontWeight: 'bold', fontSize: 10, marginBottom: 6 }}>PROPERTIES</div>
                  {selectedTool.properties.map(p => (
                    <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, padding: '3px 6px', background: PANEL, border: `1px solid ${BORDER}` }}>
                      <span style={{ color: TEXT, fontSize: 10 }}>{p.name}</span>
                      <span style={{ color: CYAN, fontSize: 10 }}>{p.default}</span>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: 8, textAlign: 'center' }}>
                    <div style={{ color: DIM, fontSize: 8 }}>USES</div>
                    <div style={{ color: WHITE, fontSize: 16, fontWeight: 'bold' }}>{selectedTool.usageCount}</div>
                  </div>
                  <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: 8, textAlign: 'center' }}>
                    <div style={{ color: DIM, fontSize: 8 }}>SHORTCUT</div>
                    <div style={{ color: AMBER, fontSize: 16, fontWeight: 'bold' }}>{selectedTool.shortcut || '—'}</div>
                  </div>
                </div>

                <div style={{ marginTop: 12, display: 'flex', gap: 4 }}>
                  <button style={{ flex: 1, padding: '6px', background: 'rgba(38,166,154,0.2)', border: `1px solid ${GREEN}`, color: GREEN, cursor: 'pointer', fontFamily: 'monospace', fontSize: 10 }}>Apply to Chart</button>
                  <button onClick={() => toggleFavorite(selectedTool.id)} style={{ padding: '6px 10px', background: 'rgba(245,166,35,0.1)', border: `1px solid ${AMBER}`, color: AMBER, cursor: 'pointer', fontFamily: 'monospace', fontSize: 10 }}>
                    {selectedTool.isFavorite ? '★' : '☆'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {tab === 'Templates' && (
          <div style={{ flex: 1, padding: 16, overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ color: AMBER, fontWeight: 'bold', fontSize: 12 }}>DRAWING TEMPLATES</span>
              <button style={{ padding: '4px 12px', background: 'rgba(38,166,154,0.2)', border: `1px solid ${GREEN}`, color: GREEN, cursor: 'pointer', fontFamily: 'monospace', fontSize: 10 }}>+ New Template</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
              {TEMPLATES.map(tpl => (
                <div key={tpl.id} style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ color: AMBER, fontWeight: 'bold', fontSize: 12 }}>{tpl.name}</span>
                    {tpl.isShared && <span style={{ color: CYAN, fontSize: 9, padding: '1px 4px', background: 'rgba(0,188,212,0.1)' }}>Shared</span>}
                  </div>
                  <div style={{ color: TEXT, fontSize: 10, marginBottom: 8 }}>{tpl.description}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                    {tpl.tools.map(tid => {
                      const tool = TOOLS.find(t => t.id === tid);
                      return tool ? (
                        <span key={tid} style={{ padding: '2px 6px', background: `${categoryColors[tool.category]}15`, color: categoryColors[tool.category], fontSize: 9 }}>
                          {tool.icon} {tool.name}
                        </span>
                      ) : null;
                    })}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9 }}>
                    <span style={{ color: DIM }}>Created: {tpl.createdAt}</span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button style={{ padding: '2px 6px', background: 'rgba(38,166,154,0.1)', border: `1px solid ${GREEN}`, color: GREEN, cursor: 'pointer', fontFamily: 'monospace', fontSize: 9 }}>Apply</button>
                      <button style={{ padding: '2px 6px', background: 'rgba(0,188,212,0.1)', border: `1px solid ${CYAN}`, color: CYAN, cursor: 'pointer', fontFamily: 'monospace', fontSize: 9 }}>Edit</button>
                      <button style={{ padding: '2px 6px', background: 'rgba(239,83,80,0.1)', border: `1px solid ${RED}`, color: RED, cursor: 'pointer', fontFamily: 'monospace', fontSize: 9 }}>Delete</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'Properties' && (
          <div style={{ flex: 1, padding: 16, overflowY: 'auto' }}>
            <div style={{ color: AMBER, fontWeight: 'bold', fontSize: 12, marginBottom: 12 }}>DEFAULT TOOL PROPERTIES</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              {/* Line defaults */}
              <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: 16 }}>
                <div style={{ color: AMBER, fontWeight: 'bold', fontSize: 11, marginBottom: 8 }}>LINE DEFAULTS</div>
                {[
                  { label: 'Default Color', value: AMBER },
                  { label: 'Line Width', value: '2px' },
                  { label: 'Line Style', value: 'Solid' },
                  { label: 'Extend', value: 'None' },
                  { label: 'Snap to Price', value: 'On' },
                  { label: 'Show Price Labels', value: 'On' },
                ].map(p => (
                  <div key={p.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 10 }}>
                    <span style={{ color: DIM }}>{p.label}</span>
                    <span style={{ color: TEXT }}>{p.value}</span>
                  </div>
                ))}
              </div>

              {/* Zone defaults */}
              <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: 16 }}>
                <div style={{ color: AMBER, fontWeight: 'bold', fontSize: 11, marginBottom: 8 }}>ZONE DEFAULTS</div>
                {[
                  { label: 'Fill Opacity', value: '10%' },
                  { label: 'Border Width', value: '1px' },
                  { label: 'Default Fill Color', value: 'Match border' },
                  { label: 'Extend to Right', value: 'Off' },
                ].map(p => (
                  <div key={p.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 10 }}>
                    <span style={{ color: DIM }}>{p.label}</span>
                    <span style={{ color: TEXT }}>{p.value}</span>
                  </div>
                ))}
              </div>

              {/* Fibonacci defaults */}
              <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: 16 }}>
                <div style={{ color: AMBER, fontWeight: 'bold', fontSize: 11, marginBottom: 8 }}>FIBONACCI DEFAULTS</div>
                {['0%', '23.6%', '38.2%', '50%', '61.8%', '78.6%', '100%'].map((lvl, i) => (
                  <div key={lvl} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <input type="checkbox" defaultChecked style={{ accentColor: AMBER }} />
                    <span style={{ color: TEXT, fontSize: 10, flex: 1 }}>{lvl}</span>
                    <div style={{ width: 16, height: 16, background: ['#ef5350', '#f57c00', '#fbc02d', '#9e9e9e', '#66bb6a', '#42a5f5', '#ab47bc'][i], borderRadius: 2 }} />
                  </div>
                ))}
              </div>

              {/* Drawing behavior */}
              <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: 16 }}>
                <div style={{ color: AMBER, fontWeight: 'bold', fontSize: 11, marginBottom: 8 }}>BEHAVIOR SETTINGS</div>
                {[
                  { label: 'Magnet Mode', value: true },
                  { label: 'Drawing Mode Stay', value: false },
                  { label: 'Lock Drawings', value: false },
                  { label: 'Show Drawing Toolbar', value: true },
                  { label: 'Multi-Symbol Sync', value: true },
                  { label: 'Auto-Save Drawings', value: true },
                ].map(p => (
                  <div key={p.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, fontSize: 10 }}>
                    <span style={{ color: DIM }}>{p.label}</span>
                    <input type="checkbox" defaultChecked={p.value} style={{ accentColor: AMBER }} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'Sync & Share' && (
          <div style={{ flex: 1, padding: 16, overflowY: 'auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
              {/* Sync status */}
              <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: 16 }}>
                <div style={{ color: AMBER, fontWeight: 'bold', fontSize: 12, marginBottom: 12 }}>CLOUD SYNC</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: GREEN }} />
                  <span style={{ color: GREEN }}>Synced</span>
                  <span style={{ color: DIM, marginLeft: 'auto', fontSize: 10 }}>Last sync: 30 seconds ago</span>
                </div>
                {[
                  { label: 'Drawings Synced', value: '47 drawings across 12 symbols' },
                  { label: 'Templates Synced', value: `${TEMPLATES.length} templates` },
                  { label: 'Custom Tools', value: `${tools.filter(t => t.isCustom).length} tools` },
                  { label: 'Storage Used', value: '2.4 MB / 50 MB' },
                  { label: 'Auto-Sync', value: 'Enabled (every 60s)' },
                ].map(item => (
                  <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 10 }}>
                    <span style={{ color: DIM }}>{item.label}</span>
                    <span style={{ color: TEXT }}>{item.value}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button style={{ flex: 1, padding: '6px', background: 'rgba(38,166,154,0.2)', border: `1px solid ${GREEN}`, color: GREEN, cursor: 'pointer', fontFamily: 'monospace', fontSize: 10 }}>Sync Now</button>
                  <button style={{ flex: 1, padding: '6px', background: 'rgba(0,188,212,0.2)', border: `1px solid ${CYAN}`, color: CYAN, cursor: 'pointer', fontFamily: 'monospace', fontSize: 10 }}>Export All</button>
                </div>
              </div>

              {/* Share */}
              <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: 16 }}>
                <div style={{ color: AMBER, fontWeight: 'bold', fontSize: 12, marginBottom: 12 }}>SHARE DRAWINGS</div>
                {[
                  { label: 'Share via Link', desc: 'Generate shareable URL', color: CYAN },
                  { label: 'Export as Image', desc: 'PNG/SVG with drawings', color: GREEN },
                  { label: 'Import Drawings', desc: 'Import from file or URL', color: AMBER },
                  { label: 'Copy to Symbol', desc: 'Copy drawings to another chart', color: '#ab47bc' },
                ].map(opt => (
                  <button key={opt.label} style={{
                    width: '100%', padding: '10px 12px', background: `${opt.color}10`, border: `1px solid ${opt.color}30`,
                    color: TEXT, cursor: 'pointer', fontFamily: 'monospace', fontSize: 10, marginBottom: 6, textAlign: 'left', display: 'block'
                  }}>
                    <div style={{ color: opt.color, fontWeight: 'bold' }}>{opt.label}</div>
                    <div style={{ color: DIM, fontSize: 9, marginTop: 2 }}>{opt.desc}</div>
                  </button>
                ))}
              </div>

              {/* Recent activity */}
              <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: 16, gridColumn: '1 / -1' }}>
                <div style={{ color: AMBER, fontWeight: 'bold', fontSize: 12, marginBottom: 12 }}>RECENT DRAWING ACTIVITY</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
                  <thead>
                    <tr>
                      {['Action', 'Tool', 'Symbol', 'Time', 'Synced'].map(h => (
                        <th key={h} style={{ padding: '4px 8px', background: '#1a1a1a', color: DIM, borderBottom: `1px solid ${BORDER}`, textAlign: 'left', fontSize: 9 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { action: 'Created', tool: 'Fib Retracement', symbol: 'AAPL', time: '2 min ago', synced: true },
                      { action: 'Modified', tool: 'Horizontal Line', symbol: 'AAPL', time: '5 min ago', synced: true },
                      { action: 'Created', tool: 'Supply Zone', symbol: 'MSFT', time: '12 min ago', synced: true },
                      { action: 'Deleted', tool: 'Trend Line', symbol: 'NVDA', time: '18 min ago', synced: true },
                      { action: 'Created', tool: 'Risk/Reward', symbol: 'TSLA', time: '25 min ago', synced: true },
                      { action: 'Modified', tool: 'Parallel Channel', symbol: 'SPY', time: '31 min ago', synced: true },
                      { action: 'Created', tool: 'Text', symbol: 'GOOGL', time: '45 min ago', synced: true },
                      { action: 'Imported', tool: 'Template', symbol: '—', time: '1 hr ago', synced: true },
                    ].map((item, i) => (
                      <tr key={i}>
                        <td style={{ padding: '4px 8px', borderBottom: `1px solid ${BORDER}`, color: item.action === 'Created' ? GREEN : item.action === 'Deleted' ? RED : item.action === 'Modified' ? AMBER : CYAN }}>{item.action}</td>
                        <td style={{ padding: '4px 8px', borderBottom: `1px solid ${BORDER}`, color: TEXT }}>{item.tool}</td>
                        <td style={{ padding: '4px 8px', borderBottom: `1px solid ${BORDER}`, color: AMBER }}>{item.symbol}</td>
                        <td style={{ padding: '4px 8px', borderBottom: `1px solid ${BORDER}`, color: DIM }}>{item.time}</td>
                        <td style={{ padding: '4px 8px', borderBottom: `1px solid ${BORDER}`, color: item.synced ? GREEN : RED }}>{item.synced ? '✓' : '✗'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Favorites bar */}
      <div style={{ borderTop: `1px solid ${BORDER}`, background: '#0d0d0d', padding: '4px 16px', display: 'flex', gap: 4, alignItems: 'center' }}>
        <span style={{ color: DIM, fontSize: 9, marginRight: 4 }}>★ Quick:</span>
        {tools.filter(t => t.isFavorite).map(t => (
          <button key={t.id} onClick={() => setSelectedTool(t)} title={t.name} style={{
            padding: '2px 6px', background: selectedTool?.id === t.id ? 'rgba(245,166,35,0.15)' : '#1a1a1a',
            border: `1px solid ${selectedTool?.id === t.id ? AMBER : BORDER}`, color: selectedTool?.id === t.id ? AMBER : categoryColors[t.category] || TEXT,
            cursor: 'pointer', fontFamily: 'monospace', fontSize: 11
          }}>{t.icon}</button>
        ))}
        <span style={{ marginLeft: 'auto', color: DIM, fontSize: 9 }}>Drawing Tool Manager v2.0</span>
      </div>
    </div>
  );
}
