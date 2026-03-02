import React, { useState } from 'react';

const BG = '#0a0a0a', PANEL = '#111111', BORDER = '#1e1e1e';
const AMBER = '#f5a623', GREEN = '#26a69a', RED = '#ef5350', CYAN = '#00bcd4';
const DIM = '#555', TEXT = '#ccc', WHITE = '#e0e0e0';

interface Workspace {
  id: string; name: string; description: string; layout: string;
  panels: string[]; created: number; modified: number; pinned: boolean;
  icon: string; theme: string; keybindings: number;
}

interface KeyBinding {
  id: string; action: string; keys: string; category: string; custom: boolean;
}

interface ThemeConfig {
  name: string; background: string; panel: string; accent: string; text: string; preview: string[];
}

const WORKSPACES: Workspace[] = [
  { id: 'ws-001', name: 'Trading Floor', description: 'Primary trading workspace with charts, order book, and execution', layout: '3-column', panels: ['Chart', 'Order Book', 'Execution', 'Positions', 'News Feed'], created: Date.now() - 86400000 * 90, modified: Date.now() - 3600000, pinned: true, icon: '📈', theme: 'Bloomberg Dark', keybindings: 12 },
  { id: 'ws-002', name: 'Risk Monitor', description: 'Portfolio risk dashboard with VaR, Greeks, and stress testing', layout: '2x2-grid', panels: ['Risk Dashboard', 'Greeks Monitor', 'Stress Test', 'Correlation Matrix'], created: Date.now() - 86400000 * 60, modified: Date.now() - 7200000, pinned: true, icon: '⚠️', theme: 'Bloomberg Dark', keybindings: 8 },
  { id: 'ws-003', name: 'Research Desk', description: 'Fundamental analysis workspace with financials and screeners', layout: '2-column', panels: ['Financial Analysis', 'Stock Screener', 'News Terminal', 'Comparable Cos'], created: Date.now() - 86400000 * 45, modified: Date.now() - 14400000, pinned: false, icon: '🔬', theme: 'Bloomberg Dark', keybindings: 5 },
  { id: 'ws-004', name: 'Algo Lab', description: 'Strategy development with backtesting and execution monitoring', layout: '3-row', panels: ['Strategy Builder', 'Backtest Engine', 'Algo Execution', 'Monte Carlo'], created: Date.now() - 86400000 * 30, modified: Date.now() - 28800000, pinned: true, icon: '🤖', theme: 'Matrix Green', keybindings: 15 },
  { id: 'ws-005', name: 'Options Desk', description: 'Options trading with chain, pricing lab, and vol surface', layout: '2x2-grid', panels: ['Options Chain', 'Vol Surface', 'Options Pricing', 'Greeks'], created: Date.now() - 86400000 * 20, modified: Date.now() - 43200000, pinned: false, icon: '🎯', theme: 'Bloomberg Dark', keybindings: 10 },
  { id: 'ws-006', name: 'Macro Dashboard', description: 'Global macro view with economic indicators and FX', layout: 'wide', panels: ['Economic Indicators', 'FX Dashboard', 'Yield Curve', 'Market Overview'], created: Date.now() - 86400000 * 15, modified: Date.now() - 86400000, pinned: false, icon: '🌍', theme: 'Bloomberg Dark', keybindings: 3 },
  { id: 'ws-007', name: 'Crypto Terminal', description: 'Cryptocurrency trading and analytics', layout: '2-column', panels: ['Crypto Dashboard', 'Order Book', 'DeFi Monitor', 'Social Feed'], created: Date.now() - 86400000 * 10, modified: Date.now() - 172800000, pinned: false, icon: '₿', theme: 'Neon Purple', keybindings: 6 },
  { id: 'ws-008', name: 'Clean Slate', description: 'Minimal workspace for focused analysis', layout: 'single', panels: ['Chart'], created: Date.now() - 86400000 * 5, modified: Date.now() - 259200000, pinned: false, icon: '✨', theme: 'Bloomberg Dark', keybindings: 0 },
];

const KEYBINDINGS: KeyBinding[] = [
  { id: 'kb-001', action: 'Open Command Palette', keys: 'Ctrl+K', category: 'Navigation', custom: false },
  { id: 'kb-002', action: 'Switch Workspace', keys: 'Ctrl+Shift+W', category: 'Navigation', custom: false },
  { id: 'kb-003', action: 'Toggle Left Rail', keys: 'Ctrl+B', category: 'Layout', custom: false },
  { id: 'kb-004', action: 'Toggle Right Sidebar', keys: 'Ctrl+Shift+B', category: 'Layout', custom: false },
  { id: 'kb-005', action: 'New Order', keys: 'Ctrl+N', category: 'Trading', custom: false },
  { id: 'kb-006', action: 'Quick Buy', keys: 'F2', category: 'Trading', custom: true },
  { id: 'kb-007', action: 'Quick Sell', keys: 'F3', category: 'Trading', custom: true },
  { id: 'kb-008', action: 'Flatten Position', keys: 'F4', category: 'Trading', custom: true },
  { id: 'kb-009', action: 'Search Security', keys: 'Ctrl+/', category: 'Navigation', custom: false },
  { id: 'kb-010', action: 'Toggle Chart Tools', keys: 'Ctrl+T', category: 'Chart', custom: false },
  { id: 'kb-011', action: 'Zoom In', keys: 'Ctrl+=', category: 'Chart', custom: false },
  { id: 'kb-012', action: 'Zoom Out', keys: 'Ctrl+-', category: 'Chart', custom: false },
  { id: 'kb-013', action: 'Toggle Crosshair', keys: 'C', category: 'Chart', custom: false },
  { id: 'kb-014', action: 'Screenshot', keys: 'Ctrl+Shift+S', category: 'Utility', custom: false },
  { id: 'kb-015', action: 'Lock Trading', keys: 'Ctrl+L', category: 'Trading', custom: true },
  { id: 'kb-016', action: 'Open Alerts', keys: 'Ctrl+A', category: 'Navigation', custom: false },
  { id: 'kb-017', action: 'Cycle Timeframes', keys: 'Tab', category: 'Chart', custom: false },
  { id: 'kb-018', action: 'Toggle Fullscreen', keys: 'F11', category: 'Layout', custom: false },
  { id: 'kb-019', action: 'Save Layout', keys: 'Ctrl+S', category: 'Layout', custom: false },
  { id: 'kb-020', action: 'Undo', keys: 'Ctrl+Z', category: 'Utility', custom: false },
  { id: 'kb-021', action: 'Strategy Hotkey', keys: 'F5', category: 'Trading', custom: true },
  { id: 'kb-022', action: 'PnL Summary', keys: 'Ctrl+P', category: 'Utility', custom: true },
];

const THEMES: ThemeConfig[] = [
  { name: 'Bloomberg Dark', background: '#0a0a0a', panel: '#111111', accent: '#f5a623', text: '#cccccc', preview: ['#0a0a0a', '#111111', '#1e1e1e', '#f5a623', '#26a69a'] },
  { name: 'Matrix Green', background: '#0a0f0a', panel: '#0f1a0f', accent: '#00ff41', text: '#a0ffa0', preview: ['#0a0f0a', '#0f1a0f', '#1a2e1a', '#00ff41', '#26a69a'] },
  { name: 'Neon Purple', background: '#0a0a12', panel: '#12121e', accent: '#b388ff', text: '#d0d0e0', preview: ['#0a0a12', '#12121e', '#1e1e30', '#b388ff', '#7c4dff'] },
  { name: 'Deep Ocean', background: '#05101a', panel: '#0a1a2e', accent: '#00bcd4', text: '#b0d4e0', preview: ['#05101a', '#0a1a2e', '#0f2a42', '#00bcd4', '#26a69a'] },
  { name: 'Midnight Blue', background: '#0a0e1a', panel: '#101828', accent: '#4fc3f7', text: '#c0d0e0', preview: ['#0a0e1a', '#101828', '#1a2840', '#4fc3f7', '#81d4fa'] },
  { name: 'Classic Terminal', background: '#000000', panel: '#0a0a0a', accent: '#00ff00', text: '#00cc00', preview: ['#000000', '#0a0a0a', '#111111', '#00ff00', '#008800'] },
];

const TABS = ['Workspaces', 'Layout Editor', 'Themes', 'Keybindings', 'Import/Export'];
const LAYOUT_TYPES = ['single', '2-column', '3-column', '2x2-grid', '3-row', 'wide', 'custom'];

export default function WorkspaceManagerUI2() {
  const [tab, setTab] = useState(0);
  const [selectedWS, setSelectedWS] = useState<Workspace | null>(WORKSPACES[0]);
  const [selectedTheme, setSelectedTheme] = useState('Bloomberg Dark');
  const [kbFilter, setKbFilter] = useState('All');
  const [searchKb, setSearchKb] = useState('');

  const kbCategories = ['All', ...new Set(KEYBINDINGS.map(k => k.category))];
  const filteredKb = KEYBINDINGS.filter(kb => {
    if (kbFilter !== 'All' && kb.category !== kbFilter) return false;
    if (searchKb && !kb.action.toLowerCase().includes(searchKb.toLowerCase()) && !kb.keys.toLowerCase().includes(searchKb.toLowerCase())) return false;
    return true;
  });

  return (
    <div style={{ width: '100%', height: '100%', background: BG, color: TEXT, fontFamily: 'monospace', fontSize: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '8px 16px', borderBottom: `1px solid ${BORDER}`, gap: 12 }}>
        <span style={{ color: AMBER, fontWeight: 'bold', fontSize: 14 }}>⚙️ WORKSPACE MANAGER</span>
        <span style={{ color: DIM }}>|</span>
        <span style={{ color: DIM }}>{WORKSPACES.length} workspaces</span>
        <span style={{ color: DIM }}>{KEYBINDINGS.filter(k => k.custom).length} custom bindings</span>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${BORDER}`, background: '#0d0d0d' }}>
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(i)} style={{
            padding: '8px 16px', background: tab === i ? PANEL : 'transparent', color: tab === i ? AMBER : DIM,
            border: 'none', borderBottom: tab === i ? `2px solid ${AMBER}` : '2px solid transparent',
            cursor: 'pointer', fontFamily: 'monospace', fontSize: 11
          }}>{t}</button>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        {/* Workspaces */}
        {tab === 0 && (
          <div style={{ display: 'flex', height: '100%' }}>
            <div style={{ width: 360, borderRight: `1px solid ${BORDER}`, overflow: 'auto' }}>
              {WORKSPACES.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)).map(ws => (
                <div key={ws.id} onClick={() => setSelectedWS(ws)} style={{
                  padding: 12, borderBottom: `1px solid ${BORDER}`, cursor: 'pointer',
                  background: selectedWS?.id === ws.id ? 'rgba(245,166,35,0.08)' : 'transparent'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: WHITE, fontWeight: 'bold', fontSize: 13 }}>
                      {ws.icon} {ws.name}
                    </span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {ws.pinned && <span style={{ color: AMBER, fontSize: 10 }}>📌</span>}
                      <span style={{ padding: '1px 4px', background: '#1a1a1a', color: DIM, fontSize: 8 }}>{ws.layout}</span>
                    </div>
                  </div>
                  <div style={{ color: DIM, fontSize: 10, marginTop: 4 }}>{ws.description}</div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 4, fontSize: 9, color: DIM }}>
                    <span>{ws.panels.length} panels</span>
                    <span>Modified: {new Date(ws.modified).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
              <div style={{ padding: 12, borderTop: `1px solid ${AMBER}`, cursor: 'pointer', background: 'rgba(245,166,35,0.03)' }}>
                <span style={{ color: AMBER }}>+ Create New Workspace</span>
              </div>
            </div>

            {/* Detail */}
            {selectedWS && (
              <div style={{ flex: 1, padding: 16, overflow: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div>
                    <div style={{ color: WHITE, fontWeight: 'bold', fontSize: 18 }}>{selectedWS.icon} {selectedWS.name}</div>
                    <div style={{ color: DIM, marginTop: 4 }}>{selectedWS.description}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button style={{ padding: '6px 16px', background: 'rgba(245,166,35,0.1)', border: `1px solid ${AMBER}`, color: AMBER, cursor: 'pointer', fontFamily: 'monospace', fontSize: 10 }}>Load</button>
                    <button style={{ padding: '6px 16px', background: '#1a1a1a', border: `1px solid ${BORDER}`, color: TEXT, cursor: 'pointer', fontFamily: 'monospace', fontSize: 10 }}>Duplicate</button>
                    <button style={{ padding: '6px 16px', background: '#1a1a1a', border: `1px solid ${RED}`, color: RED, cursor: 'pointer', fontFamily: 'monospace', fontSize: 10 }}>Delete</button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                  {[
                    { label: 'Layout', value: selectedWS.layout },
                    { label: 'Theme', value: selectedWS.theme },
                    { label: 'Panels', value: selectedWS.panels.length.toString() },
                    { label: 'Custom Keybindings', value: selectedWS.keybindings.toString() },
                    { label: 'Created', value: new Date(selectedWS.created).toLocaleDateString() },
                    { label: 'Modified', value: new Date(selectedWS.modified).toLocaleString() },
                  ].map(row => (
                    <div key={row.label} style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: 8 }}>
                      <div style={{ color: DIM, fontSize: 9 }}>{row.label}</div>
                      <div style={{ color: WHITE, fontWeight: 'bold' }}>{row.value}</div>
                    </div>
                  ))}
                </div>

                <div style={{ color: AMBER, fontWeight: 'bold', marginBottom: 8, fontSize: 11 }}>PANELS</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {selectedWS.panels.map(p => (
                    <div key={p} style={{ padding: '6px 12px', background: PANEL, border: `1px solid ${BORDER}`, color: TEXT }}>
                      {p}
                    </div>
                  ))}
                  <div style={{ padding: '6px 12px', background: 'rgba(245,166,35,0.05)', border: `1px dashed ${AMBER}`, color: AMBER, cursor: 'pointer' }}>+ Add Panel</div>
                </div>

                {/* Layout preview */}
                <div style={{ marginTop: 16 }}>
                  <div style={{ color: AMBER, fontWeight: 'bold', marginBottom: 8, fontSize: 11 }}>LAYOUT PREVIEW</div>
                  <div style={{ width: 400, height: 200, background: '#050505', border: `1px solid ${BORDER}`, padding: 4, display: 'grid',
                    gridTemplateColumns: selectedWS.layout === '3-column' ? '1fr 1fr 1fr' : selectedWS.layout === '2-column' ? '1fr 1fr' : selectedWS.layout === '2x2-grid' ? '1fr 1fr' : '1fr',
                    gridTemplateRows: selectedWS.layout === '2x2-grid' ? '1fr 1fr' : selectedWS.layout === '3-row' ? '1fr 1fr 1fr' : '1fr',
                    gap: 2
                  }}>
                    {selectedWS.panels.slice(0, selectedWS.layout === '2x2-grid' ? 4 : selectedWS.layout === '3-column' ? 3 : selectedWS.layout === '3-row' ? 3 : selectedWS.layout === '2-column' ? 2 : 1).map((p, i) => (
                      <div key={i} style={{ background: PANEL, border: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: DIM, fontSize: 9 }}>
                        {p}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Layout Editor */}
        {tab === 1 && (
          <div style={{ padding: 16 }}>
            <div style={{ color: AMBER, fontWeight: 'bold', marginBottom: 16 }}>LAYOUT TEMPLATES</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
              {LAYOUT_TYPES.map(lt => (
                <div key={lt} style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: 12, cursor: 'pointer' }}>
                  <div style={{ width: '100%', height: 100, background: '#050505', border: `1px solid ${BORDER}`, marginBottom: 8, display: 'grid',
                    gridTemplateColumns: lt === '3-column' ? '1fr 1fr 1fr' : lt === '2-column' ? '1fr 1fr' : lt === '2x2-grid' ? '1fr 1fr' : '1fr',
                    gridTemplateRows: lt === '2x2-grid' ? '1fr 1fr' : lt === '3-row' ? '1fr 1fr 1fr' : '1fr',
                    gap: 2, padding: 2
                  }}>
                    {Array.from({ length: lt === '2x2-grid' ? 4 : lt === '3-column' || lt === '3-row' ? 3 : lt === '2-column' ? 2 : 1 }).map((_, i) => (
                      <div key={i} style={{ background: '#1a1a1a', border: `1px solid ${BORDER}` }} />
                    ))}
                  </div>
                  <div style={{ color: WHITE, textAlign: 'center', textTransform: 'capitalize' }}>{lt.replace('-', ' ')}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Themes */}
        {tab === 2 && (
          <div style={{ padding: 16 }}>
            <div style={{ color: AMBER, fontWeight: 'bold', marginBottom: 16 }}>COLOR THEMES</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
              {THEMES.map(t => (
                <div key={t.name} onClick={() => setSelectedTheme(t.name)} style={{
                  background: t.panel, border: `2px solid ${selectedTheme === t.name ? t.accent : BORDER}`,
                  padding: 16, cursor: 'pointer'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <span style={{ color: t.accent, fontWeight: 'bold', fontSize: 13 }}>{t.name}</span>
                    {selectedTheme === t.name && <span style={{ color: GREEN, fontSize: 10 }}>● Active</span>}
                  </div>
                  {/* Color swatches */}
                  <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                    {t.preview.map((c, i) => (
                      <div key={i} style={{ width: 30, height: 20, background: c, border: '1px solid rgba(255,255,255,0.1)' }} />
                    ))}
                  </div>
                  {/* Preview area */}
                  <div style={{ background: t.background, padding: 8, border: `1px solid rgba(255,255,255,0.05)` }}>
                    <div style={{ color: t.accent, fontSize: 10, fontWeight: 'bold', marginBottom: 4 }}>AAPL 189.84</div>
                    <div style={{ color: t.text, fontSize: 9 }}>Quick brown fox jumps over</div>
                    <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                      <span style={{ padding: '1px 4px', background: 'rgba(38,166,154,0.2)', color: GREEN, fontSize: 8 }}>+1.24%</span>
                      <span style={{ padding: '1px 4px', background: 'rgba(239,83,80,0.2)', color: RED, fontSize: 8 }}>-0.87%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Keybindings */}
        {tab === 3 && (
          <div>
            <div style={{ padding: '8px 16px', borderBottom: `1px solid ${BORDER}`, display: 'flex', gap: 8, alignItems: 'center' }}>
              <input value={searchKb} onChange={e => setSearchKb(e.target.value)} placeholder="Search keybindings..."
                style={{ padding: '6px 10px', background: '#1a1a1a', border: `1px solid ${BORDER}`, color: WHITE, fontFamily: 'monospace', fontSize: 11, width: 250 }} />
              {kbCategories.map(c => (
                <button key={c} onClick={() => setKbFilter(c)} style={{
                  padding: '3px 8px', background: kbFilter === c ? 'rgba(245,166,35,0.15)' : '#1a1a1a',
                  border: `1px solid ${kbFilter === c ? AMBER : BORDER}`, color: kbFilter === c ? AMBER : DIM,
                  cursor: 'pointer', fontFamily: 'monospace', fontSize: 10
                }}>{c}</button>
              ))}
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ position: 'sticky', top: 0, background: '#0d0d0d', zIndex: 1 }}>
                  {['Action', 'Keybinding', 'Category', 'Source'].map(h => (
                    <th key={h} style={{ padding: '6px 12px', textAlign: 'left', color: AMBER, fontSize: 10, borderBottom: `1px solid ${BORDER}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredKb.map(kb => (
                  <tr key={kb.id} style={{ borderBottom: `1px solid ${BORDER}` }}>
                    <td style={{ padding: '6px 12px', color: WHITE }}>{kb.action}</td>
                    <td style={{ padding: '6px 12px' }}>
                      <kbd style={{ padding: '2px 8px', background: '#1a1a1a', border: `1px solid ${BORDER}`, color: AMBER, fontFamily: 'monospace', fontSize: 11, borderRadius: 2 }}>
                        {kb.keys}
                      </kbd>
                    </td>
                    <td style={{ padding: '6px 12px' }}>
                      <span style={{ padding: '1px 6px', background: 'rgba(0,188,212,0.1)', color: CYAN, fontSize: 9 }}>{kb.category}</span>
                    </td>
                    <td style={{ padding: '6px 12px', color: kb.custom ? AMBER : DIM }}>{kb.custom ? 'Custom' : 'Default'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Import/Export */}
        {tab === 4 && (
          <div style={{ padding: 16, maxWidth: 600 }}>
            <div style={{ color: AMBER, fontWeight: 'bold', marginBottom: 16 }}>IMPORT / EXPORT</div>

            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: 16, marginBottom: 16 }}>
              <div style={{ color: WHITE, fontWeight: 'bold', marginBottom: 8 }}>Export Workspace</div>
              <div style={{ color: DIM, fontSize: 10, marginBottom: 12 }}>Export workspace configuration including layouts, themes, keybindings, and preferences.</div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                {['Layouts', 'Themes', 'Keybindings', 'Preferences', 'Alerts', 'Watchlists'].map(item => (
                  <label key={item} style={{ display: 'flex', alignItems: 'center', gap: 4, color: TEXT, fontSize: 11 }}>
                    <input type="checkbox" defaultChecked style={{ accentColor: AMBER }} />{item}
                  </label>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={{ padding: '6px 16px', background: 'rgba(245,166,35,0.1)', border: `1px solid ${AMBER}`, color: AMBER, cursor: 'pointer', fontFamily: 'monospace', fontSize: 10 }}>Export JSON</button>
                <button style={{ padding: '6px 16px', background: '#1a1a1a', border: `1px solid ${BORDER}`, color: TEXT, cursor: 'pointer', fontFamily: 'monospace', fontSize: 10 }}>Export to Cloud</button>
              </div>
            </div>

            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: 16, marginBottom: 16 }}>
              <div style={{ color: WHITE, fontWeight: 'bold', marginBottom: 8 }}>Import Workspace</div>
              <div style={{ color: DIM, fontSize: 10, marginBottom: 12 }}>Import workspace configuration from JSON file or cloud backup.</div>
              <div style={{ padding: 24, border: `2px dashed ${BORDER}`, textAlign: 'center', color: DIM, marginBottom: 12 }}>
                Drop JSON file here or click to browse
              </div>
              <button style={{ padding: '6px 16px', background: '#1a1a1a', border: `1px solid ${BORDER}`, color: TEXT, cursor: 'pointer', fontFamily: 'monospace', fontSize: 10 }}>Browse Files</button>
            </div>

            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: 16 }}>
              <div style={{ color: WHITE, fontWeight: 'bold', marginBottom: 8 }}>Cloud Sync</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ color: DIM, fontSize: 10 }}>Auto-sync workspaces across devices</div>
                  <div style={{ color: GREEN, fontSize: 10, marginTop: 2 }}>Last synced: {new Date().toLocaleString()}</div>
                </div>
                <div style={{ width: 40, height: 20, background: GREEN, borderRadius: 10, position: 'relative', cursor: 'pointer' }}>
                  <div style={{ width: 16, height: 16, background: WHITE, borderRadius: '50%', position: 'absolute', top: 2, right: 2 }} />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 16px', borderTop: `1px solid ${BORDER}`, background: '#080808', fontSize: 10 }}>
        <span style={{ color: DIM }}>{WORKSPACES.length} workspaces | Theme: {selectedTheme}</span>
        <span style={{ color: DIM }}>{KEYBINDINGS.length} keybindings ({KEYBINDINGS.filter(k => k.custom).length} custom)</span>
        <span style={{ color: DIM }}>Workspace Manager</span>
      </div>
    </div>
  );
}
