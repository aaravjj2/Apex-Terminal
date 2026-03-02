import React, { useState, useRef, useEffect } from 'react';

// ── Bloomberg Theme ──
const BG = '#0a0a0a', PANEL = '#111111', BORDER = '#1e1e1e';
const AMBER = '#f5a623', GREEN = '#26a69a', RED = '#ef5350', CYAN = '#00bcd4';
const DIM = '#555', TEXT = '#ccc', WHITE = '#e0e0e0';

// ── Report Templates ──
interface ReportSection {
  id: string; type: 'header' | 'summary' | 'chart' | 'table' | 'text' | 'metrics' | 'pnl' | 'risk' | 'holdings' | 'transactions';
  title: string; enabled: boolean; order: number;
}

const DEFAULT_SECTIONS: ReportSection[] = [
  { id: 's1', type: 'header', title: 'Report Header & Date Range', enabled: true, order: 0 },
  { id: 's2', type: 'summary', title: 'Executive Summary', enabled: true, order: 1 },
  { id: 's3', type: 'metrics', title: 'Key Performance Metrics', enabled: true, order: 2 },
  { id: 's4', type: 'chart', title: 'Equity Curve Chart', enabled: true, order: 3 },
  { id: 's5', type: 'pnl', title: 'P&L Statement', enabled: true, order: 4 },
  { id: 's6', type: 'holdings', title: 'Current Holdings', enabled: true, order: 5 },
  { id: 's7', type: 'risk', title: 'Risk Analytics', enabled: true, order: 6 },
  { id: 's8', type: 'table', title: 'Trade History', enabled: true, order: 7 },
  { id: 's9', type: 'transactions', title: 'Transaction Log', enabled: false, order: 8 },
  { id: 's10', type: 'text', title: 'Notes & Commentary', enabled: false, order: 9 },
];

interface ReportTemplate {
  id: string; name: string; description: string; sections: string[];
  format: 'PDF' | 'Excel' | 'CSV' | 'HTML';
  schedule: string; lastGenerated: string;
}

const TEMPLATES: ReportTemplate[] = [
  { id: 't1', name: 'Daily P&L Report', description: 'End-of-day P&L summary with positions', sections: ['s1','s2','s5','s6'], format: 'PDF', schedule: 'Daily 4:30 PM', lastGenerated: '2024-01-15 16:30' },
  { id: 't2', name: 'Weekly Portfolio Review', description: 'Weekly performance with risk metrics', sections: ['s1','s2','s3','s4','s5','s7'], format: 'PDF', schedule: 'Friday 5:00 PM', lastGenerated: '2024-01-12 17:00' },
  { id: 't3', name: 'Monthly Compliance Report', description: 'Full compliance report with all trades', sections: ['s1','s2','s3','s4','s5','s6','s7','s8','s9'], format: 'PDF', schedule: 'Last business day', lastGenerated: '2023-12-29 18:00' },
  { id: 't4', name: 'Trade Blotter Export', description: 'Raw trade data for reconciliation', sections: ['s8','s9'], format: 'CSV', schedule: 'On demand', lastGenerated: '2024-01-15 09:45' },
  { id: 't5', name: 'Risk Dashboard Snapshot', description: 'VaR, stress test results, exposure', sections: ['s1','s7'], format: 'HTML', schedule: 'Hourly', lastGenerated: '2024-01-15 14:00' },
  { id: 't6', name: 'Client Statement', description: 'Client-facing account statement', sections: ['s1','s2','s3','s4','s5','s6'], format: 'PDF', schedule: 'Monthly', lastGenerated: '2023-12-31 23:59' },
];

// ── Report History ──
interface ReportHistory {
  id: string; template: string; generated: string; format: string; size: string;
  status: 'completed' | 'failed' | 'pending'; recipient: string;
}

const HISTORY: ReportHistory[] = Array.from({ length: 20 }, (_, i) => {
  const tpl = TEMPLATES[i % TEMPLATES.length];
  const d = new Date(); d.setDate(d.getDate() - i);
  return {
    id: `r_${i}`,
    template: tpl.name,
    generated: d.toISOString().split('T')[0] + ' ' + `${9 + (i % 8)}:${String(i * 7 % 60).padStart(2, '0')}`,
    format: tpl.format,
    size: `${(50 + Math.random() * 500).toFixed(0)} KB`,
    status: i === 3 ? 'failed' : i === 0 ? 'pending' : 'completed',
    recipient: i % 3 === 0 ? 'team@fund.com' : i % 3 === 1 ? 'compliance@fund.com' : 'client@email.com',
  };
});

// ── Export Formats ──
interface ExportConfig {
  format: string; description: string; icon: string;
  options: string[];
}

const EXPORT_FORMATS: ExportConfig[] = [
  { format: 'PDF', description: 'Formatted report with charts and tables', icon: '📄', options: ['Include charts', 'Include watermark', 'Landscape mode', 'Cover page'] },
  { format: 'Excel', description: 'Spreadsheet with formulas and pivot tables', icon: '📊', options: ['Include formulas', 'Multiple sheets', 'Pivot tables', 'Conditional formatting'] },
  { format: 'CSV', description: 'Raw data export for analysis tools', icon: '📋', options: ['UTF-8 encoding', 'Include headers', 'Date format ISO', 'Delimiter comma'] },
  { format: 'HTML', description: 'Interactive web report', icon: '🌐', options: ['Interactive charts', 'Dark theme', 'Responsive layout', 'Embedded data'] },
  { format: 'JSON', description: 'Structured data API format', icon: '🔗', options: ['Pretty print', 'Include metadata', 'Nested structure', 'Schema validation'] },
];

// ── Mock metrics for preview ──
const PREVIEW_METRICS = {
  totalReturn: 18.47, sharpe: 1.82, maxDrawdown: -6.34, winRate: 64.2,
  trades: 847, avgTrade: 0.32, profitFactor: 2.14, calmar: 2.91,
  alpha: 4.23, beta: 0.87, treynor: 12.45, sortino: 2.67,
};

// ── Canvas Preview ──
function drawPreview(ctx: CanvasRenderingContext2D, w: number, h: number, sections: ReportSection[]) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#151515';
  ctx.fillRect(0, 0, w, h);

  // Simulated report preview
  const enabled = sections.filter(s => s.enabled).sort((a, b) => a.order - b.order);
  const pad = 20;
  let y = pad;

  ctx.fillStyle = AMBER;
  ctx.font = 'bold 12px monospace';
  ctx.fillText('REPORT PREVIEW', pad, y); y += 20;

  enabled.forEach(section => {
    if (y > h - 30) return;

    ctx.fillStyle = BORDER;
    ctx.fillRect(pad, y, w - pad * 2, 1);
    y += 8;

    ctx.fillStyle = CYAN;
    ctx.font = 'bold 10px monospace';
    ctx.fillText(`[${section.type.toUpperCase()}] ${section.title}`, pad + 5, y);
    y += 16;

    // Draw section content placeholder
    switch (section.type) {
      case 'header':
        ctx.fillStyle = WHITE;
        ctx.font = 'bold 14px monospace';
        ctx.fillText('PORTFOLIO PERFORMANCE REPORT', pad + 5, y); y += 16;
        ctx.fillStyle = DIM;
        ctx.font = '10px monospace';
        ctx.fillText('Period: Jan 1 - Jan 15, 2024 | Generated: ' + new Date().toLocaleDateString(), pad + 5, y); y += 14;
        break;
      case 'summary':
        ctx.fillStyle = TEXT;
        ctx.font = '10px monospace';
        ctx.fillText('Portfolio returned +18.47% YTD with Sharpe ratio of 1.82.', pad + 5, y); y += 12;
        ctx.fillText('Max drawdown limited to -6.34%. Win rate: 64.2%.', pad + 5, y); y += 14;
        break;
      case 'metrics':
        const metrics = [
          ['Return', `${PREVIEW_METRICS.totalReturn}%`],
          ['Sharpe', PREVIEW_METRICS.sharpe.toString()],
          ['MaxDD', `${PREVIEW_METRICS.maxDrawdown}%`],
          ['Win%', `${PREVIEW_METRICS.winRate}%`]
        ];
        metrics.forEach((m, i) => {
          const mx = pad + 5 + i * 100;
          ctx.fillStyle = DIM; ctx.font = '9px monospace'; ctx.fillText(m[0], mx, y);
          ctx.fillStyle = AMBER; ctx.font = 'bold 12px monospace'; ctx.fillText(m[1], mx, y + 14);
        });
        y += 30;
        break;
      case 'chart':
        ctx.strokeStyle = DIM;
        ctx.strokeRect(pad + 5, y, w - pad * 2 - 10, 60);
        // Mini equity curve
        ctx.strokeStyle = GREEN;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        let cv = 30;
        for (let x = pad + 10; x < w - pad - 10; x += 4) {
          cv += (Math.random() - 0.4) * 3;
          cv = Math.max(5, Math.min(55, cv));
          x === pad + 10 ? ctx.moveTo(x, y + 60 - cv) : ctx.lineTo(x, y + 60 - cv);
        }
        ctx.stroke();
        ctx.lineWidth = 1;
        y += 68;
        break;
      case 'pnl':
        ctx.fillStyle = DIM; ctx.font = '9px monospace';
        ['Gross P&L: $1,847,234', 'Net P&L: $1,623,891', 'Commissions: $223,343', 'Slippage: $34,567'].forEach(line => {
          ctx.fillText(line, pad + 5, y); y += 12;
        });
        break;
      case 'risk':
        ctx.fillStyle = DIM; ctx.font = '9px monospace';
        ['VaR 95%: -$234,567', 'CVaR 99%: -$456,789', 'Beta: 0.87', 'Alpha: 4.23%'].forEach(line => {
          ctx.fillText(line, pad + 5, y); y += 12;
        });
        break;
      default:
        ctx.fillStyle = DIM; ctx.font = '9px monospace';
        ctx.fillText('[Section content...]', pad + 5, y); y += 14;
    }
    y += 6;
  });
}

// ── Main Component ──
const TABS = ['Builder', 'Templates', 'History', 'Export', 'Schedule'];

export default function ReportBuilderUI2() {
  const [tab, setTab] = useState(0);
  const [sections, setSections] = useState<ReportSection[]>(DEFAULT_SECTIONS);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [exportFormat, setExportFormat] = useState('PDF');
  const previewRef = useRef<HTMLCanvasElement>(null);

  // Draw preview
  useEffect(() => {
    if (tab !== 0) return;
    const c = previewRef.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const r = c.parentElement!.getBoundingClientRect();
    c.width = r.width; c.height = r.height;
    drawPreview(ctx, r.width, r.height, sections);
  }, [tab, sections]);

  const toggleSection = (id: string) => {
    setSections(prev => prev.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s));
  };

  const moveSection = (id: string, dir: -1 | 1) => {
    setSections(prev => {
      const arr = [...prev];
      const i = arr.findIndex(s => s.id === id);
      if (i < 0) return arr;
      const ni = Math.max(0, Math.min(arr.length - 1, i + dir));
      [arr[i], arr[ni]] = [arr[ni], arr[i]];
      return arr.map((s, j) => ({ ...s, order: j }));
    });
  };

  return (
    <div style={{ width: '100%', height: '100%', background: BG, color: TEXT, fontFamily: 'monospace', fontSize: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '8px 16px', borderBottom: `1px solid ${BORDER}`, gap: 12 }}>
        <span style={{ color: AMBER, fontWeight: 'bold', fontSize: 14 }}>📝 REPORT BUILDER</span>
        <span style={{ color: DIM }}>|</span>
        <span style={{ color: DIM }}>{sections.filter(s => s.enabled).length} sections enabled</span>
        <span style={{ color: DIM, marginLeft: 'auto' }}>Format: {exportFormat}</span>
        <button style={{
          padding: '4px 16px', background: GREEN, border: 'none', color: '#000',
          fontFamily: 'monospace', fontSize: 10, cursor: 'pointer', borderRadius: 2
        }}>GENERATE</button>
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

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {tab === 0 && (
          <>
            {/* Section list */}
            <div style={{ width: 280, borderRight: `1px solid ${BORDER}`, overflow: 'auto', padding: 12 }}>
              <div style={{ color: AMBER, fontWeight: 'bold', marginBottom: 8 }}>REPORT SECTIONS</div>
              <div style={{ color: DIM, fontSize: 10, marginBottom: 12 }}>Drag to reorder, toggle to include</div>
              {sections.sort((a, b) => a.order - b.order).map(s => (
                <div key={s.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '8px',
                  borderBottom: `1px solid ${BORDER}`, background: s.enabled ? 'rgba(245,166,35,0.05)' : 'transparent',
                  cursor: 'pointer'
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <button onClick={() => moveSection(s.id, -1)} style={{
                      background: 'none', border: 'none', color: DIM, cursor: 'pointer', padding: 0, fontSize: 8
                    }}>▲</button>
                    <button onClick={() => moveSection(s.id, 1)} style={{
                      background: 'none', border: 'none', color: DIM, cursor: 'pointer', padding: 0, fontSize: 8
                    }}>▼</button>
                  </div>
                  <input type="checkbox" checked={s.enabled} onChange={() => toggleSection(s.id)} />
                  <div style={{ flex: 1 }}>
                    <div style={{ color: s.enabled ? WHITE : DIM, fontSize: 11 }}>{s.title}</div>
                    <div style={{ color: DIM, fontSize: 9 }}>{s.type.toUpperCase()}</div>
                  </div>
                </div>
              ))}

              <div style={{ marginTop: 16, borderTop: `1px solid ${BORDER}`, paddingTop: 8 }}>
                <div style={{ color: AMBER, fontWeight: 'bold', marginBottom: 8, fontSize: 10 }}>FORMAT</div>
                {['PDF', 'Excel', 'CSV', 'HTML', 'JSON'].map(f => (
                  <label key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0', cursor: 'pointer' }}>
                    <input type="radio" name="format" checked={exportFormat === f} onChange={() => setExportFormat(f)} />
                    <span style={{ color: exportFormat === f ? AMBER : DIM }}>{f}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Preview */}
            <div style={{ flex: 1, position: 'relative' }}>
              <canvas ref={previewRef} style={{ width: '100%', height: '100%' }} />
            </div>
          </>
        )}

        {tab === 1 && (
          <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
            <div style={{ color: AMBER, fontWeight: 'bold', marginBottom: 12 }}>REPORT TEMPLATES</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: 12 }}>
              {TEMPLATES.map(tpl => (
                <div key={tpl.id} onClick={() => setSelectedTemplate(tpl.id)} style={{
                  background: selectedTemplate === tpl.id ? 'rgba(245,166,35,0.1)' : PANEL,
                  border: `1px solid ${selectedTemplate === tpl.id ? AMBER : BORDER}`,
                  padding: 16, cursor: 'pointer'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ color: WHITE, fontWeight: 'bold' }}>{tpl.name}</span>
                    <span style={{ padding: '2px 8px', background: 'rgba(0,188,212,0.15)', color: CYAN, fontSize: 9, borderRadius: 2 }}>
                      {tpl.format}
                    </span>
                  </div>
                  <div style={{ color: DIM, fontSize: 10, marginBottom: 8 }}>{tpl.description}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                    <span style={{ color: DIM }}>Schedule: {tpl.schedule}</span>
                    <span style={{ color: DIM }}>Last: {tpl.lastGenerated}</span>
                  </div>
                  <div style={{ marginTop: 8, display: 'flex', gap: 4 }}>
                    {tpl.sections.map(sid => (
                      <span key={sid} style={{
                        padding: '1px 4px', background: 'rgba(245,166,35,0.1)', color: AMBER,
                        fontSize: 8, borderRadius: 2
                      }}>
                        {DEFAULT_SECTIONS.find(s => s.id === sid)?.type || sid}
                      </span>
                    ))}
                  </div>
                  <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                    <button style={{ padding: '3px 12px', background: 'rgba(38,166,154,0.2)', border: 'none', color: GREEN, fontFamily: 'monospace', fontSize: 10, cursor: 'pointer' }}>
                      GENERATE
                    </button>
                    <button style={{ padding: '3px 12px', background: 'rgba(245,166,35,0.1)', border: 'none', color: AMBER, fontFamily: 'monospace', fontSize: 10, cursor: 'pointer' }}>
                      EDIT
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 2 && (
          <div style={{ flex: 1, overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ position: 'sticky', top: 0, background: '#0d0d0d', zIndex: 1 }}>
                  {['Template', 'Generated', 'Format', 'Size', 'Status', 'Recipient', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '6px 8px', textAlign: 'left', color: AMBER, fontSize: 10, borderBottom: `1px solid ${BORDER}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {HISTORY.map(r => (
                  <tr key={r.id} style={{ borderBottom: `1px solid ${BORDER}` }}>
                    <td style={{ padding: '5px 8px', color: WHITE }}>{r.template}</td>
                    <td style={{ padding: '5px 8px', color: DIM }}>{r.generated}</td>
                    <td style={{ padding: '5px 8px' }}>
                      <span style={{ padding: '1px 6px', background: 'rgba(0,188,212,0.15)', color: CYAN, fontSize: 9, borderRadius: 2 }}>
                        {r.format}
                      </span>
                    </td>
                    <td style={{ padding: '5px 8px', color: DIM }}>{r.size}</td>
                    <td style={{ padding: '5px 8px' }}>
                      <span style={{
                        padding: '1px 6px', borderRadius: 2, fontSize: 9,
                        background: r.status === 'completed' ? 'rgba(38,166,154,0.2)' : r.status === 'failed' ? 'rgba(239,83,80,0.2)' : 'rgba(245,166,35,0.2)',
                        color: r.status === 'completed' ? GREEN : r.status === 'failed' ? RED : AMBER
                      }}>{r.status.toUpperCase()}</span>
                    </td>
                    <td style={{ padding: '5px 8px', color: DIM, fontSize: 10 }}>{r.recipient}</td>
                    <td style={{ padding: '5px 8px' }}>
                      <button style={{ padding: '2px 8px', background: 'rgba(245,166,35,0.1)', border: 'none', color: AMBER, fontFamily: 'monospace', fontSize: 9, cursor: 'pointer', marginRight: 4 }}>
                        VIEW
                      </button>
                      <button style={{ padding: '2px 8px', background: 'rgba(0,188,212,0.1)', border: 'none', color: CYAN, fontFamily: 'monospace', fontSize: 9, cursor: 'pointer' }}>
                        RESEND
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 3 && (
          <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
            <div style={{ color: AMBER, fontWeight: 'bold', marginBottom: 12 }}>DATA EXPORT FORMATS</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
              {EXPORT_FORMATS.map(ef => (
                <div key={ef.format} style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 20 }}>{ef.icon}</span>
                    <div>
                      <div style={{ color: WHITE, fontWeight: 'bold' }}>{ef.format}</div>
                      <div style={{ color: DIM, fontSize: 10 }}>{ef.description}</div>
                    </div>
                  </div>
                  <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 8 }}>
                    {ef.options.map(opt => (
                      <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0', cursor: 'pointer' }}>
                        <input type="checkbox" defaultChecked />
                        <span style={{ color: TEXT, fontSize: 11 }}>{opt}</span>
                      </label>
                    ))}
                  </div>
                  <button style={{
                    marginTop: 8, width: '100%', padding: '6px', background: 'rgba(245,166,35,0.2)',
                    border: 'none', color: AMBER, fontFamily: 'monospace', fontSize: 10, cursor: 'pointer'
                  }}>EXPORT AS {ef.format}</button>
                </div>
              ))}
            </div>

            {/* Quick Export */}
            <div style={{ marginTop: 16, background: PANEL, border: `1px solid ${BORDER}`, padding: 16 }}>
              <div style={{ color: AMBER, fontWeight: 'bold', marginBottom: 8 }}>QUICK EXPORT</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
                {['Portfolio Holdings', 'Trade History', 'P&L Statement', 'Risk Report', 'Tax Lots', 'Corporate Actions'].map(item => (
                  <div key={item} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', background: '#0d0d0d', border: `1px solid ${BORDER}` }}>
                    <span style={{ color: TEXT, fontSize: 11 }}>{item}</span>
                    <button style={{ padding: '2px 8px', background: 'rgba(0,188,212,0.1)', border: 'none', color: CYAN, fontFamily: 'monospace', fontSize: 9, cursor: 'pointer' }}>
                      CSV
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 4 && (
          <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
            <div style={{ color: AMBER, fontWeight: 'bold', marginBottom: 12 }}>SCHEDULED REPORTS</div>
            {TEMPLATES.map(tpl => (
              <div key={tpl.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px', borderBottom: `1px solid ${BORDER}`, background: PANEL, marginBottom: 4
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ color: WHITE, fontWeight: 'bold' }}>{tpl.name}</div>
                  <div style={{ color: DIM, fontSize: 10 }}>{tpl.description}</div>
                </div>
                <div style={{ textAlign: 'right', minWidth: 200 }}>
                  <div style={{ color: AMBER }}>{tpl.schedule}</div>
                  <div style={{ color: DIM, fontSize: 10 }}>Last: {tpl.lastGenerated}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginLeft: 16 }}>
                  <button style={{ padding: '4px 12px', background: 'rgba(38,166,154,0.2)', border: 'none', color: GREEN, fontFamily: 'monospace', fontSize: 10, cursor: 'pointer' }}>
                    ACTIVE
                  </button>
                  <button style={{ padding: '4px 12px', background: 'rgba(245,166,35,0.1)', border: 'none', color: AMBER, fontFamily: 'monospace', fontSize: 10, cursor: 'pointer' }}>
                    EDIT
                  </button>
                </div>
              </div>
            ))}

            {/* Delivery Settings */}
            <div style={{ marginTop: 16, background: PANEL, border: `1px solid ${BORDER}`, padding: 16 }}>
              <div style={{ color: AMBER, fontWeight: 'bold', marginBottom: 12 }}>DELIVERY SETTINGS</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <div style={{ color: DIM, fontSize: 10, marginBottom: 4 }}>Email Recipients</div>
                  <textarea defaultValue="team@fund.com&#10;compliance@fund.com" style={{
                    width: '100%', height: 60, background: '#1a1a1a', border: `1px solid ${BORDER}`,
                    color: WHITE, fontFamily: 'monospace', fontSize: 10, padding: 8, resize: 'none'
                  }} />
                </div>
                <div>
                  <div style={{ color: DIM, fontSize: 10, marginBottom: 4 }}>SFTP Destination</div>
                  <input defaultValue="sftp://reports.fund.com/daily/" style={{
                    width: '100%', padding: '6px 8px', background: '#1a1a1a', border: `1px solid ${BORDER}`,
                    color: WHITE, fontFamily: 'monospace', fontSize: 10
                  }} />
                  <div style={{ color: DIM, fontSize: 10, marginTop: 8, marginBottom: 4 }}>Webhook URL</div>
                  <input defaultValue="https://hooks.slack.com/services/..." style={{
                    width: '100%', padding: '6px 8px', background: '#1a1a1a', border: `1px solid ${BORDER}`,
                    color: WHITE, fontFamily: 'monospace', fontSize: 10
                  }} />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Status */}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 16px', borderTop: `1px solid ${BORDER}`, background: '#080808', fontSize: 10 }}>
        <span style={{ color: DIM }}>{TEMPLATES.length} templates configured</span>
        <span style={{ color: DIM }}>{HISTORY.filter(h => h.status === 'completed').length}/{HISTORY.length} reports delivered</span>
        <span style={{ color: DIM }}>Updated: {new Date().toLocaleTimeString()}</span>
      </div>
    </div>
  );
}
