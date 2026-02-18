/**
 * Platform Health V4 UI2 — v1.139
 * All 8 subsystems with detailed status cards.
 */
import { useSyncExternalStore } from 'react';
import { PageHeader } from '../components/PageHeader';
import { Activity, CheckCircle, XCircle, AlertTriangle, Wifi, Database, Cpu, Globe, Search, BrainCircuit, Play, Server } from 'lucide-react';
import { wave1314Store } from '../stores/wave1314Store';

const SUBSYSTEM_ICONS: Record<string, React.ReactNode> = {
  backend: <Server className="w-5 h-5" />,
  frontend: <Globe className="w-5 h-5" />,
  database: <Database className="w-5 h-5" />,
  websocket: <Wifi className="w-5 h-5" />,
  search: <Search className="w-5 h-5" />,
  llm: <BrainCircuit className="w-5 h-5" />,
  replay: <Play className="w-5 h-5" />,
  automation: <Cpu className="w-5 h-5" />,
};

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'healthy':
      return <CheckCircle className="w-5 h-5 text-green-400" />;
    case 'degraded':
      return <AlertTriangle className="w-5 h-5 text-yellow-400" />;
    case 'down':
      return <XCircle className="w-5 h-5 text-red-400" />;
    default:
      return <Activity className="w-5 h-5 text-neutral-500" />;
  }
}

const STATUS_BG: Record<string, string> = {
  healthy: 'border-green-500/30 bg-green-500/5',
  degraded: 'border-yellow-500/30 bg-yellow-500/5',
  down: 'border-red-500/30 bg-red-500/5',
};

export function PlatformHealthV4UI2() {
  useSyncExternalStore(wave1314Store.subscribe, wave1314Store.getSnapshot);
  const health = wave1314Store.getHealthV4();

  if (!health) {
    return (
      <div className="flex flex-col h-full" data-testid="ui2-platform-health-v4-page" data-ready="true">
        <PageHeader title="Platform Health V4" subtitle="Loading..." testId="ui2-platform-health-v4-header" />
        <div className="flex-1 flex items-center justify-center text-neutral-500" data-testid="ui2-platform-health-v4-loading">Loading health data...</div>
      </div>
    );
  }

  const overall = health.status;
  const subsystemEntries = Object.entries(health.subsystems);
  const healthyCount = subsystemEntries.filter(([, v]) => v.status === 'healthy').length;

  return (
    <div className="flex flex-col h-full" data-testid="ui2-platform-health-v4-page" data-ready="true">
      <PageHeader
        title="Platform Health V4"
        subtitle={`${healthyCount}/${subsystemEntries.length} healthy · Overall: ${overall}`}
        testId="ui2-platform-health-v4-header"
      />

      <div className="flex-1 overflow-auto p-4">
        {/* Overall banner */}
        <div
          className={`rounded-lg border p-4 mb-6 flex items-center gap-4 ${STATUS_BG[overall] || ''}`}
          data-testid="ui2-platform-health-v4-overall"
        >
          <StatusIcon status={overall} />
          <div>
            <div className="text-lg font-bold text-neutral-100">System Status: {String(overall).toUpperCase()}</div>
            <div className="text-sm text-neutral-400">
              Checked at {new Date(health.timestamp).toLocaleString()} · Version {health.version}
            </div>
          </div>
        </div>

        {/* Subsystem grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="ui2-platform-health-v4-grid">
          {subsystemEntries.map(([name, data]) => {
            const status = String(data.status || 'unknown');
            const entries = Object.entries(data).filter(([k]) => k !== 'status');
            return (
              <div
                key={name}
                className={`rounded-lg border p-4 ${STATUS_BG[status] || 'border-neutral-800'}`}
                data-testid={`ui2-health-subsystem-${name}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-neutral-300">
                    {SUBSYSTEM_ICONS[name] || <Activity className="w-5 h-5" />}
                    <span className="text-sm font-semibold capitalize">{name}</span>
                  </div>
                  <StatusIcon status={status} />
                </div>

                <div className="space-y-1">
                  {entries.map(([k, v]) => (
                    <div key={k} className="flex justify-between text-xs">
                      <span className="text-neutral-500">{k.replace(/_/g, ' ')}</span>
                      <span className="font-mono text-neutral-300">{String(v)}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
