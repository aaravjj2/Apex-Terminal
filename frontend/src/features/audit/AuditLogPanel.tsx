/**
 * v1.45 — System Audit Log Panel
 * DEMO-first structured action trail for compliance.
 */
import { useState, useEffect } from 'react';
import { API_BASE } from '../../config/api';

interface AuditEntry {
  id: string;
  action: string;
  actor: string;
  target: string;
  detail: string;
  ip: string;
  timestamp: string;
}

export function AuditLogPanel() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/v1/audit`)
      .then(r => r.json())
      .then(data => setEntries(Array.isArray(data) ? data : []))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div data-testid="audit-panel" className="h-full flex flex-col bg-background p-4">
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-lg font-semibold text-text">Audit Log</h2>
        <span className="text-xs text-text-muted bg-element-bg px-2 py-0.5 rounded">v1.45 — DEMO</span>
        <span data-testid="audit-count" className="text-xs text-text-muted">{entries.length} entries</span>
      </div>

      {loading && (
        <div data-testid="audit-loading" className="animate-pulse space-y-3">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-14 bg-element-bg/50 rounded-lg" />)}
        </div>
      )}

      {!loading && entries.length === 0 && (
        <div data-testid="audit-empty" className="text-center py-12 text-text-muted">
          <p className="text-sm">No audit entries</p>
        </div>
      )}

      {!loading && entries.length > 0 && (
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-text-muted text-xs border-b border-border">
                <th className="text-left py-2 px-2">Action</th>
                <th className="text-left py-2 px-2">Actor</th>
                <th className="text-left py-2 px-2">Target</th>
                <th className="text-left py-2 px-2">Detail</th>
                <th className="text-left py-2 px-2">Time</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, idx) => (
                <tr key={e.id} data-testid={`audit-row-${idx}`} className="border-b border-border/30">
                  <td className="py-2 px-2">
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-mono bg-element-bg text-text">{e.action}</span>
                  </td>
                  <td className="py-2 px-2 text-text-secondary text-xs">{e.actor}</td>
                  <td className="py-2 px-2 text-text text-xs font-mono">{e.target}</td>
                  <td className="py-2 px-2 text-text-secondary text-xs max-w-[300px] truncate">{e.detail}</td>
                  <td className="py-2 px-2 text-text-muted text-[10px]">{e.timestamp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div data-testid="audit-panel-ready" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden' }}>ready</div>
    </div>
  );
}
