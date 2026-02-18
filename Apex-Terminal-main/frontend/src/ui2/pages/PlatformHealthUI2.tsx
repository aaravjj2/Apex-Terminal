/**
 * Wave 8 — PlatformHealthUI2 Page (v1.80)
 * Platform health observability with service status and metrics.
 */

import { useSyncExternalStore } from 'react';
import { PageHeader, StatusBadge } from '../components';
import { platformHealthStore } from '../stores/platformHealthStore';

export function PlatformHealthUI2() {
  const health = useSyncExternalStore(platformHealthStore.subscribe, platformHealthStore.getHealth);
  const lastRefresh = useSyncExternalStore(platformHealthStore.subscribe, platformHealthStore.getLastRefresh);

  return (
    <div data-testid="platform-health-page" style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px 0 16px' }}>
        <PageHeader
          title="Platform Health"
          subtitle="Service status, metrics, and observability"
          testId="ui2-platform-health-header"
        />
      </div>

      <div style={{ padding: '8px 16px', display: 'flex', gap: '12px', alignItems: 'center', borderBottom: '1px solid var(--ui2-border)' }}>
        <button
          data-testid="ui2-health-refresh-btn"
          onClick={() => platformHealthStore.refresh()}
          style={{
            padding: '6px 16px', fontSize: '13px', fontWeight: 600,
            background: 'var(--ui2-brand)', color: '#fff',
            border: 'none', borderRadius: '4px', cursor: 'pointer',
          }}
        >
          Refresh
        </button>
        <StatusBadge variant={health.status === 'healthy' ? 'success' : 'danger'} testId="ui2-health-badge">
          {health.status.toUpperCase()}
        </StatusBadge>
        <span style={{ fontSize: '11px', color: 'var(--ui2-text-muted)', marginLeft: 'auto' }}>
          Last refresh: {lastRefresh}
        </span>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
        {/* Services */}
        <div data-testid="ui2-health-services" style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ui2-text-primary)', marginBottom: '12px' }}>
            Services
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
            {Object.entries(health.services).map(([name, svc]) => (
              <div
                key={name}
                data-testid={`ui2-health-service-${name}`}
                style={{
                  padding: '12px', background: 'var(--ui2-bg-elevated)', borderRadius: '6px',
                  border: '1px solid var(--ui2-border)',
                }}
              >
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ui2-text-primary)', marginBottom: '4px' }}>
                  {name}
                </div>
                <StatusBadge variant={svc.status === 'ok' ? 'success' : 'info'} testId="">
                  {svc.status}
                </StatusBadge>
                {svc.version && (
                  <span style={{ fontSize: '11px', color: 'var(--ui2-text-muted)', marginLeft: '8px' }}>
                    v{svc.version}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Metrics */}
        <div data-testid="ui2-health-metrics" style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ui2-text-primary)', marginBottom: '12px' }}>
            Metrics
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
            <div style={{ padding: '12px', background: 'var(--ui2-bg-elevated)', borderRadius: '6px', border: '1px solid var(--ui2-border)' }}>
              <div style={{ fontSize: '11px', color: 'var(--ui2-text-muted)' }}>Uptime</div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--ui2-text-primary)' }}>
                {Math.floor(health.metrics.uptime_seconds / 3600)}h
              </div>
            </div>
            <div style={{ padding: '12px', background: 'var(--ui2-bg-elevated)', borderRadius: '6px', border: '1px solid var(--ui2-border)' }}>
              <div style={{ fontSize: '11px', color: 'var(--ui2-text-muted)' }}>Autopilot Runs</div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--ui2-text-primary)' }}>
                {health.metrics.total_autopilot_runs}
              </div>
            </div>
            <div style={{ padding: '12px', background: 'var(--ui2-bg-elevated)', borderRadius: '6px', border: '1px solid var(--ui2-border)' }}>
              <div style={{ fontSize: '11px', color: 'var(--ui2-text-muted)' }}>Automation Runs</div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--ui2-text-primary)' }}>
                {health.metrics.total_automation_runs}
              </div>
            </div>
            <div style={{ padding: '12px', background: 'var(--ui2-bg-elevated)', borderRadius: '6px', border: '1px solid var(--ui2-border)' }}>
              <div style={{ fontSize: '11px', color: 'var(--ui2-text-muted)' }}>Error Rate</div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--ui2-text-primary)' }}>
                {(health.metrics.error_rate * 100).toFixed(1)}%
              </div>
            </div>
          </div>
        </div>

        {/* Mode + info */}
        <div data-testid="ui2-health-info" style={{ padding: '12px', background: 'var(--ui2-bg-elevated)', borderRadius: '6px', fontSize: '13px', color: 'var(--ui2-text-secondary)' }}>
          <div><strong>Mode:</strong> {health.mode}</div>
          <div><strong>Timestamp:</strong> {health.timestamp}</div>
        </div>
      </div>

      {/* Ready marker */}
      <div data-testid="platform-health-ready" style={{ display: 'none' }} />
    </div>
  );
}
