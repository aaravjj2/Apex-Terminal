/**
 * Incidents UI2 — v1.128
 * Incident list + create from telemetry events + detail view
 */
import { useState, useSyncExternalStore } from 'react';
import { PageHeader } from '../components/PageHeader';
import { AlertTriangle, Plus, Clock, CheckCircle, AlertCircle, ChevronRight } from 'lucide-react';
import { wave1314Store, type Incident } from '../stores/wave1314Store';

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-400 border-red-500/40',
  error: 'bg-orange-500/20 text-orange-400 border-orange-500/40',
  warning: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40',
  info: 'bg-blue-500/20 text-blue-400 border-blue-500/40',
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  open: <AlertCircle className="w-4 h-4 text-red-400" />,
  investigating: <Clock className="w-4 h-4 text-yellow-400" />,
  resolved: <CheckCircle className="w-4 h-4 text-green-400" />,
};

export function IncidentsUI2() {
  useSyncExternalStore(wave1314Store.subscribe, wave1314Store.getSnapshot);
  const incidents = wave1314Store.getIncidents();
  const [selected, setSelected] = useState<Incident | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newSeverity, setNewSeverity] = useState<string>('medium');

  const handleCreate = () => {
    if (!newTitle.trim()) return;
    wave1314Store.createIncident(newTitle.trim(), newSeverity as Incident['severity'], 'User-reported incident');
    setNewTitle('');
    setShowCreate(false);
  };

  return (
    <div className="flex flex-col h-full" data-testid="ui2-incidents-page" data-ready="true">
      <PageHeader
        title="Incidents"
        subtitle={`${incidents.length} incident(s)`}
        testId="ui2-incidents-header"
        actions={
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-2 px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded text-sm font-medium"
            data-testid="ui2-incidents-create-btn"
          >
            <Plus className="w-4 h-4" /> Report Incident
          </button>
        }
      />

      <div className="flex flex-1 overflow-hidden">
        {/* List */}
        <div className="flex-1 overflow-auto p-4 space-y-2">
          {showCreate && (
            <div className="bg-neutral-900 border border-red-600/50 rounded-lg p-4 space-y-3" data-testid="ui2-incidents-create-form">
              <input
                value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Incident title"
                className="w-full bg-neutral-950 border border-neutral-700 rounded px-3 py-2 text-sm text-neutral-200 focus:border-red-500 outline-none"
                data-testid="ui2-incidents-title-input"
              />
              <select
                value={newSeverity} onChange={(e) => setNewSeverity(e.target.value)}
                className="bg-neutral-950 border border-neutral-700 rounded px-3 py-2 text-sm text-neutral-200"
                data-testid="ui2-incidents-severity-select"
              >
                <option value="critical">Critical</option>
                <option value="error">Error</option>
                <option value="warning">Warning</option>
                <option value="info">Info</option>
              </select>
              <div className="flex gap-2">
                <button onClick={handleCreate} className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded text-sm" data-testid="ui2-incidents-submit-btn">Create</button>
                <button onClick={() => setShowCreate(false)} className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded text-sm">Cancel</button>
              </div>
            </div>
          )}

          <div data-testid="ui2-incidents-list">
            {incidents.length === 0 && (
              <div className="text-center text-neutral-500 py-12" data-testid="ui2-incidents-empty">No incidents reported</div>
            )}
            {incidents.map((inc) => (
              <button
                key={inc.incident_id}
                onClick={() => setSelected(inc)}
                className={`w-full text-left bg-neutral-900 border rounded-lg px-4 py-3 flex items-center gap-3 mb-2 transition-colors ${
                  selected?.incident_id === inc.incident_id ? 'border-blue-500' : 'border-neutral-800 hover:border-neutral-700'
                }`}
                data-testid={`ui2-incident-row-${inc.incident_id}`}
              >
                <div className="flex-shrink-0">{STATUS_ICONS[inc.status] || STATUS_ICONS.open}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-neutral-100 truncate">{inc.title}</div>
                  <div className="flex gap-3 mt-1 text-xs text-neutral-500">
                    <span className={`px-1.5 py-0.5 rounded border ${SEVERITY_COLORS[inc.severity] || ''}`}>{inc.severity}</span>
                    <span className="font-mono">{inc.incident_id}</span>
                    <span>{new Date(inc.created_at).toLocaleString()}</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-neutral-600 flex-shrink-0" />
              </button>
            ))}
          </div>
        </div>

        {/* Detail drawer */}
        {selected && (
          <div className="w-96 border-l border-neutral-800 overflow-auto p-4 bg-neutral-950" data-testid="ui2-incident-detail">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-400" />
                <h3 className="text-lg font-bold text-neutral-100">Incident Detail</h3>
              </div>
              <button onClick={() => setSelected(null)} className="text-neutral-500 hover:text-neutral-300 text-sm">Close</button>
            </div>

            <div className="space-y-4">
              <div>
                <div className="text-xs text-neutral-500 mb-1">Title</div>
                <div className="text-sm text-neutral-200" data-testid="ui2-incident-detail-title">{selected.title}</div>
              </div>

              <div>
                <div className="text-xs text-neutral-500 mb-1">Incident ID</div>
                <div className="text-sm font-mono text-neutral-300" data-testid="ui2-incident-detail-id">{selected.incident_id}</div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-neutral-500 mb-1">Status</div>
                  <div className="flex items-center gap-1.5 text-sm">{STATUS_ICONS[selected.status]} <span className="text-neutral-200">{selected.status}</span></div>
                </div>
                <div>
                  <div className="text-xs text-neutral-500 mb-1">Severity</div>
                  <span className={`text-xs px-1.5 py-0.5 rounded border ${SEVERITY_COLORS[selected.severity] || ''}`}>{selected.severity}</span>
                </div>
              </div>

              <div>
                <div className="text-xs text-neutral-500 mb-1">Description</div>
                <div className="text-sm text-neutral-300" data-testid="ui2-incident-detail-description">{selected.description}</div>
              </div>

              {selected.source_event_id && (
                <div>
                  <div className="text-xs text-neutral-500 mb-1">Source Event</div>
                  <span className="text-xs font-mono px-1.5 py-0.5 bg-neutral-800 text-blue-400 rounded" data-testid="ui2-incident-detail-source">{selected.source_event_id}</span>
                </div>
              )}

              {selected.notes && (
                <div>
                  <div className="text-xs text-neutral-500 mb-1">Notes</div>
                  <div className="text-xs text-neutral-400" data-testid="ui2-incident-detail-notes">{selected.notes}</div>
                </div>
              )}

              <div>
                <div className="text-xs text-neutral-500 mb-1">Created</div>
                <div className="text-xs text-neutral-400">{new Date(selected.created_at).toLocaleString()}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
