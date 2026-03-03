/**
 * ┌───────────────────────────────────────────────────────────────────────┐
 * │  APEX TERMINAL — Risk Network Visualization (UI2)                  │
 * │  Interactive correlation network graph with systemic risk metrics,  │
 * │  contagion paths, stress propagation, and cluster analysis          │
 * └───────────────────────────────────────────────────────────────────────┘
 */
import React, { useState, useMemo, useRef, useEffect } from 'react';

const T = {
  bg0: '#0C0E12', bg1: '#131722', bg2: '#1E222D', bg3: '#2A2E39',
  border: '#1E222D', border2: '#2A2E39',
  tx0: '#FFF', tx1: '#D1D4DC', tx2: '#787B86', tx3: '#50535E',
  brand: '#2962FF', up: '#26A69A', dn: '#EF5350',
  warn: '#FF9800', info: '#42A5F5', purple: '#AB47BC',
  mono: "'JetBrains Mono','Fira Code',monospace",
  sans: "'Inter','Segoe UI',system-ui,sans-serif",
  r: '4px',
};

/* ── Types ───────────────────────────────────────────────────────────── */
interface RiskNode {
  id: string; name: string; sector: string; x: number; y: number;
  marketCap: number; beta: number; systemicScore: number;
  var95: number; connections: number;
}

interface RiskEdge {
  source: string; target: string; correlation: number; weight: number;
}

interface ContagionPath {
  path: string[]; probability: number; severity: number; mechanism: string;
}

interface ClusterInfo {
  id: number; name: string; nodes: string[]; avgCorrelation: number;
  systemicRisk: number; color: string;
}

/* ── Mock ─────────────────────────────────────────────────────────────── */
function generateNetwork() {
  const sectors: Record<string, string[]> = {
    'Tech': ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'META'],
    'Finance': ['JPM', 'GS', 'BAC', 'MS', 'C'],
    'Energy': ['XOM', 'CVX', 'COP', 'SLB'],
    'Healthcare': ['JNJ', 'UNH', 'PFE', 'ABBV'],
    'Consumer': ['AMZN', 'WMT', 'COST'],
  };

  const nodes: RiskNode[] = [];
  const clusterColors = [T.brand, T.up, T.dn, T.warn, T.purple];
  let idx = 0;
  Object.entries(sectors).forEach(([sector, syms], si) => {
    syms.forEach((s, i) => {
      const angle = (si / 5) * Math.PI * 2 + (i / syms.length) * (Math.PI * 2 / 5);
      const radius = 120 + Math.random() * 40;
      nodes.push({
        id: s, name: s, sector,
        x: 200 + Math.cos(angle) * radius + (Math.random() - 0.5) * 30,
        y: 200 + Math.sin(angle) * radius + (Math.random() - 0.5) * 30,
        marketCap: Math.floor(100 + Math.random() * 2900),
        beta: +(0.5 + Math.random() * 1.5).toFixed(2),
        systemicScore: +(20 + Math.random() * 75).toFixed(1),
        var95: +(1 + Math.random() * 5).toFixed(2),
        connections: 0,
      });
      idx++;
    });
  });

  const edges: RiskEdge[] = [];
  // Intra-sector (high correlation)
  Object.values(sectors).forEach(syms => {
    for (let i = 0; i < syms.length; i++) {
      for (let j = i + 1; j < syms.length; j++) {
        if (Math.random() > 0.3) {
          const corr = +(0.4 + Math.random() * 0.5).toFixed(3);
          edges.push({ source: syms[i], target: syms[j], correlation: corr, weight: corr });
        }
      }
    }
  });
  // Cross-sector (lower correlation)
  const allSyms = nodes.map(n => n.id);
  for (let i = 0; i < 15; i++) {
    const a = allSyms[Math.floor(Math.random() * allSyms.length)];
    let b = allSyms[Math.floor(Math.random() * allSyms.length)];
    while (b === a) b = allSyms[Math.floor(Math.random() * allSyms.length)];
    const corr = +(0.1 + Math.random() * 0.4).toFixed(3);
    if (!edges.find(e => (e.source === a && e.target === b) || (e.source === b && e.target === a))) {
      edges.push({ source: a, target: b, correlation: corr, weight: corr });
    }
  }
  edges.forEach(e => {
    const sn = nodes.find(n => n.id === e.source);
    const tn = nodes.find(n => n.id === e.target);
    if (sn) sn.connections++;
    if (tn) tn.connections++;
  });

  const clusters: ClusterInfo[] = Object.entries(sectors).map(([name, syms], i) => ({
    id: i, name, nodes: syms,
    avgCorrelation: +(0.45 + Math.random() * 0.35).toFixed(3),
    systemicRisk: +(30 + Math.random() * 50).toFixed(1),
    color: clusterColors[i],
  }));

  const contagion: ContagionPath[] = [
    { path: ['JPM', 'GS', 'BAC', 'C'], probability: 0.23, severity: 8.5, mechanism: 'Counterparty exposure chain' },
    { path: ['NVDA', 'MSFT', 'GOOGL'], probability: 0.18, severity: 6.2, mechanism: 'AI capex correlation' },
    { path: ['XOM', 'CVX', 'COP', 'SLB'], probability: 0.31, severity: 7.1, mechanism: 'Oil price shock propagation' },
    { path: ['AAPL', 'AMZN', 'META'], probability: 0.15, severity: 5.8, mechanism: 'Consumer sentiment contagion' },
    { path: ['UNH', 'JNJ', 'PFE'], probability: 0.12, severity: 4.5, mechanism: 'Regulatory shock' },
    { path: ['JPM', 'AAPL', 'NVDA'], probability: 0.09, severity: 9.2, mechanism: 'Cross-sector systemic cascade' },
  ];

  return { nodes, edges, clusters, contagion };
}

/* ── Canvas ───────────────────────────────────────────────────────────── */
function NetworkCanvas({ nodes, edges, clusters }: { nodes: RiskNode[]; edges: RiskEdge[]; clusters: ClusterInfo[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const W = 440, H = 400;
    c.width = W * 2; c.height = H * 2; ctx.scale(2, 2);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = T.bg1; ctx.fillRect(0, 0, W, H);

    const clusterColor = (id: string) => {
      for (const cl of clusters) {
        if (cl.nodes.includes(id)) return cl.color;
      }
      return T.tx3;
    };

    // Draw edges
    edges.forEach(e => {
      const sn = nodes.find(n => n.id === e.source);
      const tn = nodes.find(n => n.id === e.target);
      if (!sn || !tn) return;
      ctx.strokeStyle = `${T.tx3}${Math.floor(e.correlation * 0.6 * 255).toString(16).padStart(2, '0')}`;
      ctx.lineWidth = e.correlation * 2;
      ctx.beginPath(); ctx.moveTo(sn.x, sn.y); ctx.lineTo(tn.x, tn.y); ctx.stroke();
    });

    // Draw nodes
    nodes.forEach(n => {
      const radius = 4 + (n.systemicScore / 100) * 8;
      const col = clusterColor(n.id);

      // Glow
      ctx.beginPath(); ctx.arc(n.x, n.y, radius + 3, 0, Math.PI * 2);
      ctx.fillStyle = `${col}20`; ctx.fill();

      // Node
      ctx.beginPath(); ctx.arc(n.x, n.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = `${col}90`; ctx.fill();
      ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.stroke();

      // Label
      ctx.fillStyle = T.tx0; ctx.font = `bold 7px ${T.mono}`;
      ctx.textAlign = 'center'; ctx.fillText(n.name, n.x, n.y + radius + 9);
    });

    // Legend
    const lx = 10, ly = 10;
    clusters.forEach((cl, i) => {
      ctx.beginPath(); ctx.arc(lx + 5, ly + i * 14 + 5, 4, 0, Math.PI * 2);
      ctx.fillStyle = cl.color; ctx.fill();
      ctx.fillStyle = T.tx2; ctx.font = `7px ${T.sans}`; ctx.textAlign = 'left';
      ctx.fillText(cl.name, lx + 14, ly + i * 14 + 8);
    });
  }, [nodes, edges, clusters]);
  return <canvas ref={ref} style={{ width: '100%', height: 400, borderRadius: T.r }} />;
}

function CorrelationHeatmap({ nodes, edges }: { nodes: RiskNode[]; edges: RiskEdge[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const top8 = nodes.slice(0, 10);
    const sz = 22, pad = 35;
    const W = pad + top8.length * sz + 10;
    const H = pad + top8.length * sz + 10;
    c.width = W * 2; c.height = H * 2; ctx.scale(2, 2);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = T.bg2; ctx.fillRect(0, 0, W, H);

    // Labels
    ctx.font = `6px ${T.mono}`; ctx.fillStyle = T.tx2;
    top8.forEach((n, i) => {
      ctx.save(); ctx.translate(pad + i * sz + sz / 2, pad - 3);
      ctx.rotate(-Math.PI / 4); ctx.textAlign = 'left';
      ctx.fillText(n.id, 0, 0); ctx.restore();
      ctx.textAlign = 'right';
      ctx.fillText(n.id, pad - 3, pad + i * sz + sz / 2 + 2);
    });

    // Cells
    top8.forEach((nr, r) => {
      top8.forEach((nc, ci) => {
        let corr = r === ci ? 1 : 0;
        const edge = edges.find(e =>
          (e.source === nr.id && e.target === nc.id) ||
          (e.source === nc.id && e.target === nr.id)
        );
        if (edge) corr = edge.correlation;
        const x = pad + ci * sz; const y = pad + r * sz;
        const g = Math.floor(corr * 200);
        const rb = Math.floor((1 - corr) * 50);
        ctx.fillStyle = r === ci ? `${T.brand}60` :
          corr > 0.5 ? `rgba(${rb},${g},${rb + 50},0.8)` :
          corr > 0.2 ? `rgba(${rb + 80},${g + 50},${rb},0.5)` :
          `${T.bg3}80`;
        ctx.fillRect(x + 1, y + 1, sz - 2, sz - 2);
        if (corr > 0.01) {
          ctx.fillStyle = T.tx0; ctx.font = `6px ${T.mono}`; ctx.textAlign = 'center';
          ctx.fillText(corr.toFixed(2), x + sz / 2, y + sz / 2 + 2);
        }
      });
    });
  }, [nodes, edges]);
  return <canvas ref={ref} style={{ width: '100%', maxWidth: 350, height: 280, borderRadius: T.r }} />;
}

/* ═══════════════════════════════════════════════════════════════════════ */
/* MAIN                                                                  */
/* ═══════════════════════════════════════════════════════════════════════ */
type RNTab = 'network' | 'heatmap' | 'contagion' | 'clusters';

export default function RiskNetworkUI2() {
  const [tab, setTab] = useState<RNTab>('network');
  const { nodes, edges, clusters, contagion } = useMemo(() => generateNetwork(), []);

  return (
    <div data-testid="risk-network-page" style={{ display: 'flex', flexDirection: 'column', height: '100%', background: T.bg0, fontFamily: T.sans, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '6px 10px', gap: '8px', background: T.bg1, borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
        <span style={{ fontSize: '12px', fontWeight: 800, color: T.tx0 }}>RISK NETWORK</span>
        <div style={{ height: 14, width: 1, background: T.border2 }} />
        <span style={{ fontSize: '8px', fontFamily: T.mono, color: T.tx3 }}>Nodes: <span style={{ color: T.tx0 }}>{nodes.length}</span></span>
        <span style={{ fontSize: '8px', fontFamily: T.mono, color: T.tx3 }}>Edges: <span style={{ color: T.brand }}>{edges.length}</span></span>
        <span style={{ fontSize: '8px', fontFamily: T.mono, color: T.tx3 }}>Clusters: <span style={{ color: T.purple }}>{clusters.length}</span></span>
      </div>
      <div style={{ display: 'flex', borderBottom: `1px solid ${T.border}`, background: T.bg1, flexShrink: 0 }}>
        {([
          { key: 'network' as RNTab, label: '🕸️ Network' },
          { key: 'heatmap' as RNTab, label: '🟥 Heatmap' },
          { key: 'contagion' as RNTab, label: '⚡ Contagion' },
          { key: 'clusters' as RNTab, label: '🔵 Clusters' },
        ]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            background: tab === t.key ? T.bg3 : 'transparent', color: tab === t.key ? T.tx0 : T.tx3,
            border: 'none', padding: '6px 14px', fontSize: '9px', fontWeight: 600, cursor: 'pointer',
            borderBottom: tab === t.key ? `2px solid ${T.brand}` : '2px solid transparent',
          }}>{t.label}</button>
        ))}
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
        {tab === 'network' && (
          <div>
            <NetworkCanvas nodes={nodes} edges={edges} clusters={clusters} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginTop: '8px' }}>
              {[
                { label: 'Network Density', value: `${(edges.length / (nodes.length * (nodes.length - 1) / 2) * 100).toFixed(1)}%`, color: T.brand },
                { label: 'Avg Correlation', value: (edges.reduce((s, e) => s + e.correlation, 0) / edges.length).toFixed(3), color: T.up },
                { label: 'Max Node Degree', value: String(Math.max(...nodes.map(n => n.connections))), color: T.warn },
                { label: 'Systemic Score', value: `${(nodes.reduce((s, n) => s + n.systemicScore, 0) / nodes.length).toFixed(1)}`, color: T.dn },
              ].map(m => (
                <div key={m.label} style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '7px', color: T.tx3 }}>{m.label}</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: m.color, fontFamily: T.mono }}>{m.value}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        {tab === 'heatmap' && (
          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: T.tx0, marginBottom: '6px' }}>Pairwise Correlation Heatmap</div>
            <CorrelationHeatmap nodes={nodes} edges={edges} />
            <div style={{ border: `1px solid ${T.border}`, borderRadius: T.r, overflow: 'hidden', marginTop: '8px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8px', fontFamily: T.mono }}>
                <thead><tr style={{ background: T.bg2 }}>
                  {['Node','Sector','Beta','Systemic','VaR 95%','Connections'].map(h => (
                    <th key={h} style={{ padding: '5px 4px', textAlign: h === 'Node' || h === 'Sector' ? 'left' : 'right', color: T.tx3, fontWeight: 600 }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {nodes.sort((a, b) => b.systemicScore - a.systemicScore).slice(0, 12).map(n => (
                    <tr key={n.id} style={{ borderBottom: `1px solid ${T.border}` }}>
                      <td style={{ padding: '4px', fontWeight: 700, color: T.tx0 }}>{n.name}</td>
                      <td style={{ padding: '4px', color: T.tx2 }}>{n.sector}</td>
                      <td style={{ padding: '4px', textAlign: 'right', color: n.beta > 1.2 ? T.warn : T.tx1 }}>{n.beta}</td>
                      <td style={{ padding: '4px', textAlign: 'right', color: n.systemicScore > 60 ? T.dn : T.tx1, fontWeight: 700 }}>{n.systemicScore}</td>
                      <td style={{ padding: '4px', textAlign: 'right', color: T.dn }}>{n.var95}%</td>
                      <td style={{ padding: '4px', textAlign: 'right', color: T.tx1 }}>{n.connections}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {tab === 'contagion' && (
          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: T.tx0, marginBottom: '6px' }}>Contagion Propagation Paths</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {contagion.map((cp, i) => (
                <div key={i} style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
                      {cp.path.map((node, j) => (
                        <React.Fragment key={j}>
                          <span style={{ fontSize: '9px', fontWeight: 700, color: T.tx0, background: T.bg3, borderRadius: '2px', padding: '1px 4px' }}>{node}</span>
                          {j < cp.path.length - 1 && <span style={{ fontSize: '9px', color: T.dn }}>→</span>}
                        </React.Fragment>
                      ))}
                    </div>
                    <span style={{
                      fontSize: '7px', padding: '1px 4px', borderRadius: '2px', fontWeight: 700,
                      background: cp.severity > 7 ? `${T.dn}20` : cp.severity > 5 ? `${T.warn}20` : `${T.up}20`,
                      color: cp.severity > 7 ? T.dn : cp.severity > 5 ? T.warn : T.up,
                    }}>SEV {cp.severity.toFixed(1)}</span>
                  </div>
                  <div style={{ fontSize: '7px', color: T.tx2, marginBottom: '4px' }}>{cp.mechanism}</div>
                  <div style={{ display: 'flex', gap: '12px', fontSize: '7px', fontFamily: T.mono }}>
                    <span style={{ color: T.tx3 }}>P(contagion): <span style={{ color: T.warn }}>{(cp.probability * 100).toFixed(1)}%</span></span>
                    <span style={{ color: T.tx3 }}>Hops: <span style={{ color: T.tx1 }}>{cp.path.length - 1}</span></span>
                  </div>
                  <div style={{ height: 4, background: T.bg3, borderRadius: 2, marginTop: '4px' }}>
                    <div style={{ width: `${cp.probability * 100}%`, height: '100%', background: cp.severity > 7 ? T.dn : T.warn, borderRadius: 2 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {tab === 'clusters' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '6px' }}>
            {clusters.map(cl => (
              <div key={cl.id} style={{ background: T.bg1, border: `1px solid ${cl.color}30`, borderRadius: T.r, padding: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: cl.color }} />
                    <span style={{ fontSize: '10px', fontWeight: 700, color: T.tx0 }}>{cl.name}</span>
                  </div>
                  <span style={{ fontSize: '8px', color: T.tx3 }}>{cl.nodes.length} nodes</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', marginBottom: '6px' }}>
                  {cl.nodes.map(n => (
                    <span key={n} style={{ fontSize: '8px', background: `${cl.color}15`, color: cl.color, borderRadius: '2px', padding: '1px 4px', fontFamily: T.mono }}>{n}</span>
                  ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px', fontSize: '7px', fontFamily: T.mono }}>
                  <div><span style={{ color: T.tx3 }}>Avg Corr:</span> <span style={{ color: T.tx0 }}>{cl.avgCorrelation}</span></div>
                  <div><span style={{ color: T.tx3 }}>Systemic:</span> <span style={{ color: +cl.systemicRisk > 60 ? T.dn : T.tx0 }}>{cl.systemicRisk}</span></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export { RiskNetworkUI2 };
